/**
 * PDF内の画像の再圧縮（Canvas使用のためブラウザ専用、純粋関数部分はテスト可能）
 * - 写真（色数が多い画像）: JPEGで再符号化
 * - スクリーンショット・図（色数が少ない画像）: JPEGにせず可逆（Flate）のまま。縮小時のみ再符号化
 * - 解像度上限: 画像の長辺がページの長辺×上限ppiを超える場合に縮小
 */
import {
	PDFDocument,
	PDFName,
	PDFNumber,
	PDFRawStream,
	PDFRef,
	PDFArray,
	PDFNull,
	decodePDFRawStream,
	PDFDict
} from 'pdf-lib';
import { filterNames, maxPageSidePt } from './pdf-optimizer';

export type ImageRecompressOptions = {
	quality: number; // JPEG品質 0-1
	maxPpi: number | null; // ページ全面に配置した場合の解像度上限。nullなら縮小しない
};

/** 画像の圧縮レベル（解像度は縦横両方に効くため主に段階づけ、品質は補助） */
export const IMAGE_PRESETS = {
	low: {
		label: '弱（高画質）',
		note: '300 ppi・品質0.92。印刷する資料向け',
		maxPpi: 300,
		quality: 0.92
	},
	medium: {
		label: '中（推奨）',
		note: '150 ppi・品質0.85。画面で見る資料・メール添付向け',
		maxPpi: 150,
		quality: 0.85
	},
	high: {
		label: '強（高圧縮）',
		note: '96 ppi・品質0.6。容量制限が厳しい場合向け',
		maxPpi: 96,
		quality: 0.6
	}
} as const satisfies Record<string, ImageRecompressOptions & { label: string; note: string }>;

export type ImagePresetKey = keyof typeof IMAGE_PRESETS;

/** この色数以下ならスクリーンショット・図とみなし、JPEGにしない */
export const FEW_COLORS_THRESHOLD = 256;

const N = (name: string) => PDFName.of(name);

/** 解像度上限に合わせた縮小後のサイズ（縮小不要ならnull） */
export function computeTargetSize(
	width: number,
	height: number,
	pageSidePt: number,
	maxPpi: number | null
): { width: number; height: number } | null {
	if (maxPpi === null || pageSidePt <= 0) return null;
	const limit = Math.round((pageSidePt / 72) * maxPpi);
	const long = Math.max(width, height);
	if (long <= limit) return null;
	const ratio = limit / long;
	return {
		width: Math.max(1, Math.round(width * ratio)),
		height: Math.max(1, Math.round(height * ratio))
	};
}

/** RGBA画素の色数を数える（limitを超えた時点で打ち切り） */
export function countColorsUpTo(rgba: Uint8ClampedArray, limit: number): number {
	const seen = new Set<number>();
	for (let i = 0; i < rgba.length; i += 4) {
		seen.add((rgba[i] << 16) | (rgba[i + 1] << 8) | rgba[i + 2]);
		if (seen.size > limit) return seen.size;
	}
	return seen.size;
}

/** PNG予測子（Predictor 10-15）の逆変換。rowBytes は Columns × 成分数（8bpc前提） */
export function reversePngPredictor(data: Uint8Array, rowBytes: number, bpp: number): Uint8Array {
	const stride = rowBytes + 1;
	const rows = Math.floor(data.length / stride);
	const out = new Uint8Array(rowBytes * rows);
	const prev = new Uint8Array(rowBytes);

	for (let row = 0; row < rows; row++) {
		const filterType = data[row * stride];
		const src = data.subarray(row * stride + 1, (row + 1) * stride);
		const dst = out.subarray(row * rowBytes, (row + 1) * rowBytes);
		for (let i = 0; i < rowBytes; i++) {
			const left = i >= bpp ? dst[i - bpp] : 0;
			const up = prev[i];
			const upLeft = i >= bpp ? prev[i - bpp] : 0;
			let pred = 0;
			if (filterType === 1) pred = left;
			else if (filterType === 2) pred = up;
			else if (filterType === 3) pred = (left + up) >>> 1;
			else if (filterType === 4) {
				const p = left + up - upLeft;
				const pa = Math.abs(p - left);
				const pb = Math.abs(p - up);
				const pc = Math.abs(p - upLeft);
				pred = pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft;
			}
			dst[i] = (src[i] + pred) & 0xff;
		}
		prev.set(dst);
	}
	return out;
}

/** 生の画素（RGBまたはGray）をRGBAに展開 */
export function toRgba(pixels: Uint8Array, components: 1 | 3, count: number): Uint8ClampedArray {
	const out = new Uint8ClampedArray(count * 4);
	for (let i = 0; i < count; i++) {
		if (components === 3) {
			out[i * 4] = pixels[i * 3];
			out[i * 4 + 1] = pixels[i * 3 + 1];
			out[i * 4 + 2] = pixels[i * 3 + 2];
		} else {
			out[i * 4] = out[i * 4 + 1] = out[i * 4 + 2] = pixels[i];
		}
		out[i * 4 + 3] = 255;
	}
	return out;
}

/** RGBAから生の画素（RGBまたはGray）を取り出す */
export function fromRgba(rgba: Uint8ClampedArray, components: 1 | 3): Uint8Array {
	const count = rgba.length / 4;
	const out = new Uint8Array(count * components);
	for (let i = 0; i < count; i++) {
		if (components === 3) {
			out[i * 3] = rgba[i * 4];
			out[i * 3 + 1] = rgba[i * 4 + 1];
			out[i * 3 + 2] = rgba[i * 4 + 2];
		} else {
			out[i] = rgba[i * 4];
		}
	}
	return out;
}

/** 再圧縮の対象にできる色空間の成分数（DeviceRGB/DeviceGrayのみ） */
function componentsOf(dict: PDFDict): 1 | 3 | null {
	const cs = dict.lookup(N('ColorSpace'));
	if (!(cs instanceof PDFName)) return null;
	if (cs.decodeText() === 'DeviceRGB') return 3;
	if (cs.decodeText() === 'DeviceGray') return 1;
	return null;
}

function createCanvas(width: number, height: number) {
	const canvas = document.createElement('canvas');
	canvas.width = width;
	canvas.height = height;
	const ctx = canvas.getContext('2d');
	if (!ctx) throw new Error('Canvas 2D context が利用できません');
	return { canvas, ctx };
}

/** source を指定サイズのCanvasに描画（縮小時は高品質補間） */
function drawScaled(source: CanvasImageSource, width: number, height: number) {
	const result = createCanvas(width, height);
	result.ctx.imageSmoothingQuality = 'high';
	result.ctx.drawImage(source, 0, 0, width, height);
	return result;
}

async function canvasToJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Uint8Array> {
	const blob = await new Promise<Blob | null>((resolve) =>
		canvas.toBlob(resolve, 'image/jpeg', quality)
	);
	if (!blob) throw new Error('JPEGへの変換に失敗しました');
	return new Uint8Array(await blob.arrayBuffer());
}

async function deflate(bytes: Uint8Array): Promise<Uint8Array> {
	const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate'));
	return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** FlateDecode画像を生画素に復号（8bpc、PNG予測子対応）。対応外ならnull */
/**
 * DecodeParms から予測子を読む（単一要素の配列にも対応）。対応外の指定なら null
 * PNG予測子は Colors・Columns が画像辞書と一致する場合のみ扱う
 */
export function readPredictor(
	stream: PDFRawStream,
	width: number,
	components: 1 | 3
): number | null {
	let parms = stream.dict.lookup(N('DecodeParms'));
	if (parms instanceof PDFArray) parms = parms.size() > 0 ? parms.lookup(0) : undefined;
	if (parms === undefined || parms === PDFNull) return 1;
	if (!(parms instanceof PDFDict)) return null;

	const num = (key: string, fallback: number) =>
		parms.lookupMaybe(N(key), PDFNumber)?.asNumber() ?? fallback;
	const predictor = num('Predictor', 1);
	if (predictor === 1) return 1;
	if (predictor < 10) return null; // TIFF予測子は未対応
	if (num('Colors', 1) !== components || num('Columns', 1) !== width) return null;
	if (num('BitsPerComponent', 8) !== 8) return null;
	return predictor;
}

function decodeFlatePixels(
	stream: PDFRawStream,
	width: number,
	height: number,
	components: 1 | 3
): Uint8Array | null {
	const predictor = readPredictor(stream, width, components);
	if (predictor === null) return null;

	let raw = (decodePDFRawStream(stream) as { decode(): Uint8Array }).decode();
	if (predictor >= 10) raw = reversePngPredictor(raw, width * components, components);
	return raw.length >= width * height * components ? raw : null;
}

type Replacement = {
	contents: Uint8Array;
	filter: 'DCTDecode' | 'FlateDecode';
	width: number;
	height: number;
	colorSpace: 'DeviceRGB' | 'DeviceGray';
};

async function recompressImage(
	stream: PDFRawStream,
	pageSidePt: number,
	options: ImageRecompressOptions
): Promise<Replacement | null> {
	const dict = stream.dict;
	const filters = filterNames(dict);
	const bpc = dict.lookupMaybe(N('BitsPerComponent'), PDFNumber)?.asNumber();
	const width = dict.lookupMaybe(N('Width'), PDFNumber)?.asNumber() ?? 0;
	const height = dict.lookupMaybe(N('Height'), PDFNumber)?.asNumber() ?? 0;
	const components = componentsOf(dict);
	// マスク画像・カラーキーマスク・Decode配列付きは非可逆化で見た目が変わるため対象外
	if (
		filters.length !== 1 ||
		bpc !== 8 ||
		!components ||
		width < 1 ||
		height < 1 ||
		dict.has(N('ImageMask')) ||
		dict.has(N('Mask')) ||
		dict.has(N('Decode'))
	)
		return null;

	const target = computeTargetSize(width, height, pageSidePt, options.maxPpi) ?? { width, height };

	if (filters[0] === 'DCTDecode') {
		// PDFビューアはEXIFの向きやICCを使わないため、ブラウザ側の回転・色変換も無効にする
		const bitmap = await createImageBitmap(
			new Blob([stream.getContents()], { type: 'image/jpeg' }),
			{ imageOrientation: 'none', colorSpaceConversion: 'none' }
		);
		const { canvas } = drawScaled(bitmap, target.width, target.height);
		bitmap.close();
		// CanvasのJPEG出力は常にカラー（3成分）なので色空間もRGBにする
		return {
			contents: await canvasToJpeg(canvas, options.quality),
			filter: 'DCTDecode',
			...target,
			colorSpace: 'DeviceRGB'
		};
	}

	if (filters[0] !== 'FlateDecode') return null;
	const pixels = decodeFlatePixels(stream, width, height, components);
	if (!pixels) return null;

	const rgba = toRgba(pixels, components, width * height);
	const fewColors = countColorsUpTo(rgba, FEW_COLORS_THRESHOLD) <= FEW_COLORS_THRESHOLD;
	const resized = target.width !== width || target.height !== height;
	if (fewColors && !resized) return null;

	const src = createCanvas(width, height);
	src.ctx.putImageData(new ImageData(rgba, width, height), 0, 0);
	const { canvas, ctx } = resized
		? drawScaled(src.canvas, target.width, target.height)
		: { canvas: src.canvas, ctx: src.ctx };

	if (fewColors) {
		const scaled = ctx.getImageData(0, 0, target.width, target.height).data;
		return {
			contents: await deflate(fromRgba(scaled, components)),
			filter: 'FlateDecode',
			...target,
			colorSpace: components === 3 ? 'DeviceRGB' : 'DeviceGray'
		};
	}
	return {
		contents: await canvasToJpeg(canvas, options.quality),
		filter: 'DCTDecode',
		...target,
		colorSpace: 'DeviceRGB'
	};
}

/** 文書内の画像を再圧縮し、小さくなったものだけ置き換える。置き換え数を返す */
export async function recompressImages(
	doc: PDFDocument,
	options: ImageRecompressOptions
): Promise<number> {
	const pageSidePt = maxPageSidePt(doc);
	// 透明度マスク（SMask）はGrayのまま使う必要があるため対象外
	const smaskRefs = new Set<PDFRef>();
	for (const [, obj] of doc.context.enumerateIndirectObjects()) {
		const smask = obj instanceof PDFRawStream ? obj.dict.get(N('SMask')) : undefined;
		if (smask instanceof PDFRef) smaskRefs.add(smask);
	}
	let count = 0;
	for (const [ref, obj] of doc.context.enumerateIndirectObjects()) {
		if (!(obj instanceof PDFRawStream) || smaskRefs.has(ref)) continue;
		const subtype = obj.dict.lookup(N('Subtype'));
		if (!(subtype instanceof PDFName) || subtype.decodeText() !== 'Image') continue;

		let rep: Replacement | null;
		try {
			rep = await recompressImage(obj, pageSidePt, options);
		} catch {
			continue; // 復号できない画像は元のまま
		}
		if (!rep || rep.contents.length >= obj.getContentsSize()) continue;

		const dict = obj.dict.clone(doc.context);
		dict.set(N('Filter'), N(rep.filter));
		dict.delete(N('DecodeParms'));
		dict.set(N('Width'), PDFNumber.of(rep.width));
		dict.set(N('Height'), PDFNumber.of(rep.height));
		dict.set(N('ColorSpace'), N(rep.colorSpace));
		dict.set(N('Length'), PDFNumber.of(rep.contents.length));
		doc.context.assign(ref, PDFRawStream.of(dict, rep.contents));
		count++;
	}
	return count;
}

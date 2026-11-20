/**
 * PDF内の画像の再圧縮（OffscreenCanvas使用のためブラウザ・Web Worker専用、純粋関数部分はテスト可能）
 * - 写真（色数が多い画像）: JPEGで再符号化
 * - スクリーンショット・図（色数が少ない画像）: JPEGにせず可逆（Flate）のまま。縮小時のみ再符号化
 * - 解像度上限: 紙面に描かれた大きさでの実効解像度が上限を超える場合に縮小
 *   （配置を特定できない画像は、ページの長辺いっぱいに描かれるものとみなす）
 * - 透明度マスク（SMask）: 親画像の配置に合わせて可逆のまま縮小する
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
import { unzlibSync, zlibSync } from 'fflate';
import { filterNames, maxPageSidePt } from './pdf-optimizer';
import { collectImagePlacements, type Placement } from './image-placement';

export type ImageRecompressOptions = {
	quality: number; // JPEG品質 0-1
	maxPpi: number | null; // 紙面での実効解像度の上限。nullなら縮小しない
	/** DeviceGray の画像もJPEGにする（カラーのJPEGになるため色空間はDeviceRGBに変わる） */
	jpegGray: boolean;
	/** 色数の少ない画像（スクリーンショット・図）もJPEGにする（文字や線がにじむことがある） */
	jpegFewColors: boolean;
};

/** Canvasで扱える面積の上限（iOS Safari等。超えると描画が無音で失敗し、黒や透明の画像になる） */
export const MAX_CANVAS_PIXELS = 16_777_216;

/** この色数以下ならスクリーンショット・図とみなし、JPEGにしない */
export const FEW_COLORS_THRESHOLD = 256;

const N = (name: string) => PDFName.of(name);

/** 実効解像度の上限に合わせた縮小後のサイズ（縮小不要ならnull）。最も大きく描かれた軸に合わせて縦横比を保つ */
export function computeTargetSize(
	width: number,
	height: number,
	drawn: Placement,
	maxPpi: number | null
): { width: number; height: number } | null {
	if (maxPpi === null) return null;
	const ratio = Math.max((drawn.widthIn * maxPpi) / width, (drawn.heightIn * maxPpi) / height);
	if (!(ratio > 0) || ratio >= 1) return null;
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

/** 再圧縮の対象にできる色空間の成分数（DeviceRGB/DeviceGray、成分数3/1のICCBased） */
export function componentsOf(dict: PDFDict): 1 | 3 | null {
	const cs = dict.lookup(N('ColorSpace'));
	if (cs instanceof PDFName) {
		if (cs.decodeText() === 'DeviceRGB') return 3;
		if (cs.decodeText() === 'DeviceGray') return 1;
		return null;
	}
	if (cs instanceof PDFArray && cs.size() === 2 && cs.lookup(0) === N('ICCBased')) {
		const profile = cs.lookup(1);
		const n =
			profile instanceof PDFRawStream
				? profile.dict.lookupMaybe(N('N'), PDFNumber)?.asNumber()
				: undefined;
		if (n === 3 || n === 1) return n;
	}
	return null;
}

/** Web Worker でも動くよう OffscreenCanvas を使う */
function createCanvas(width: number, height: number) {
	const canvas = new OffscreenCanvas(width, height);
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

async function canvasToJpeg(canvas: OffscreenCanvas, quality: number): Promise<Uint8Array> {
	const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality });
	return new Uint8Array(await blob.arrayBuffer());
}

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

/** FlateDecode画像を生画素に復号（8bpc、PNG予測子対応）。対応外ならnull */
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
	/** keep: 元の色空間（ICCBased含む）を保つ。DeviceRGB: CanvasのJPEG出力が3成分のため書き換える */
	colorSpace: 'keep' | 'DeviceRGB';
};

async function recompressImage(
	stream: PDFRawStream,
	drawn: Placement,
	options: ImageRecompressOptions,
	isMask: boolean
): Promise<Replacement | null> {
	const dict = stream.dict;
	const filters = filterNames(dict);
	const bpc = dict.lookupMaybe(N('BitsPerComponent'), PDFNumber)?.asNumber();
	const width = dict.lookupMaybe(N('Width'), PDFNumber)?.asNumber() ?? 0;
	const height = dict.lookupMaybe(N('Height'), PDFNumber)?.asNumber() ?? 0;
	const components = componentsOf(dict);
	// JPEGに可逆のFlateを重ねたもの（[/FlateDecode /DCTDecode]）はJPEGとして扱う
	const isJpeg =
		(filters.length === 1 && filters[0] === 'DCTDecode') ||
		(filters.length === 2 && filters[0] === 'FlateDecode' && filters[1] === 'DCTDecode');
	// マスク画像・カラーキーマスク・Decode配列付きは非可逆化で見た目が変わるため対象外
	if (
		(!isJpeg && filters.length !== 1) ||
		bpc !== 8 ||
		!components ||
		width < 1 ||
		height < 1 ||
		width * height > MAX_CANVAS_PIXELS ||
		dict.has(N('ImageMask')) ||
		dict.has(N('Mask')) ||
		dict.has(N('Decode'))
	)
		return null;

	const target = computeTargetSize(width, height, drawn, options.maxPpi) ?? { width, height };
	const resized = target.width !== width || target.height !== height;
	// CanvasのJPEG出力はカラー（3成分）のみ。Grayは、ICCプロファイルのない DeviceGray を許可した場合だけJPEGにする
	// （ICC付きGrayは階調が、印刷ではK版のみの黒がRGBの黒に変わるため）。透明度マスクは1成分である必要があるため常に可逆
	const jpegAllowed =
		!isMask &&
		(components === 3 || (options.jpegGray && dict.lookup(N('ColorSpace')) === N('DeviceGray')));

	if (isJpeg) {
		if (!jpegAllowed) return null;
		const jpeg = filters.length === 2 ? unzlibSync(stream.getContents()) : stream.getContents();
		// PDFビューアはEXIFの向きやICCを使わないため、ブラウザ側の回転・色変換も無効にする
		const bitmap = await createImageBitmap(new Blob([jpeg], { type: 'image/jpeg' }), {
			imageOrientation: 'none',
			colorSpaceConversion: 'none'
		});
		const { canvas } = drawScaled(bitmap, target.width, target.height);
		bitmap.close();
		return {
			contents: await canvasToJpeg(canvas, options.quality),
			filter: 'DCTDecode',
			...target,
			colorSpace: components === 3 ? 'keep' : 'DeviceRGB'
		};
	}

	if (filters[0] !== 'FlateDecode') return null;
	const pixels = decodeFlatePixels(stream, width, height, components);
	if (!pixels) return null;

	const rgba = toRgba(pixels, components, width * height);
	const lossless =
		!jpegAllowed ||
		(!options.jpegFewColors && countColorsUpTo(rgba, FEW_COLORS_THRESHOLD) <= FEW_COLORS_THRESHOLD);
	if (lossless && !resized) return null;

	const src = createCanvas(width, height);
	src.ctx.putImageData(new ImageData(rgba, width, height), 0, 0);
	const { canvas, ctx } = resized
		? drawScaled(src.canvas, target.width, target.height)
		: { canvas: src.canvas, ctx: src.ctx };

	if (lossless) {
		const scaled = ctx.getImageData(0, 0, target.width, target.height).data;
		return {
			contents: zlibSync(fromRgba(scaled, components), { level: 9 }),
			filter: 'FlateDecode',
			...target,
			colorSpace: 'keep'
		};
	}
	return {
		contents: await canvasToJpeg(canvas, options.quality),
		filter: 'DCTDecode',
		...target,
		colorSpace: components === 3 ? 'keep' : 'DeviceRGB'
	};
}

function mergePlacement(a: Placement | undefined, b: Placement): Placement {
	return a
		? { widthIn: Math.max(a.widthIn, b.widthIn), heightIn: Math.max(a.heightIn, b.heightIn) }
		: b;
}

/** 文書内の画像を再圧縮し、小さくなったものだけ置き換える。置き換え数を返す。onProgress には処理済み数と総数を渡す */
export async function recompressImages(
	doc: PDFDocument,
	options: ImageRecompressOptions,
	onProgress?: (done: number, total: number) => void
): Promise<number> {
	// 走査量が上限を超えた場合も含め、配置を特定できない画像は、ページの長辺いっぱいに描かれるものとみなす
	const placements = collectImagePlacements(doc) ?? new Map<PDFRef, Placement>();
	const pageSideIn = maxPageSidePt(doc) / 72;
	const fallback: Placement = { widthIn: pageSideIn, heightIn: pageSideIn };
	const placementOf = (ref: PDFRef) => placements.get(ref) ?? fallback;

	// 透明度マスク（SMask）は親画像と同じ位置に描かれる。/Matte 付きは親と同じ画素数が必要なため両方とも対象外
	const maskPlacements = new Map<PDFRef, Placement>();
	const skip = new Set<PDFRef>();
	for (const [ref, obj] of doc.context.enumerateIndirectObjects()) {
		if (!(obj instanceof PDFRawStream)) continue;
		const smask = obj.dict.get(N('SMask'));
		if (!(smask instanceof PDFRef)) continue;
		const mask = doc.context.lookup(smask);
		if (mask instanceof PDFRawStream && mask.dict.has(N('Matte'))) {
			skip.add(ref);
			skip.add(smask);
		} else {
			maskPlacements.set(smask, mergePlacement(maskPlacements.get(smask), placementOf(ref)));
		}
	}

	const targets = doc.context
		.enumerateIndirectObjects()
		.filter(
			(entry): entry is [PDFRef, PDFRawStream] =>
				entry[1] instanceof PDFRawStream &&
				!skip.has(entry[0]) &&
				entry[1].dict.lookup(N('Subtype')) === N('Image')
		);

	let count = 0;
	for (const [i, [ref, obj]] of targets.entries()) {
		onProgress?.(i, targets.length);
		const maskPlacement = maskPlacements.get(ref);
		let rep: Replacement | null;
		try {
			rep = await recompressImage(
				obj,
				maskPlacement ?? placementOf(ref),
				options,
				maskPlacement !== undefined
			);
		} catch {
			continue; // 復号できない画像は元のまま
		}
		if (!rep || rep.contents.length >= obj.getContentsSize()) continue;

		const dict = obj.dict.clone(doc.context);
		dict.set(N('Filter'), N(rep.filter));
		dict.delete(N('DecodeParms'));
		dict.set(N('Width'), PDFNumber.of(rep.width));
		dict.set(N('Height'), PDFNumber.of(rep.height));
		if (rep.colorSpace === 'DeviceRGB') dict.set(N('ColorSpace'), N('DeviceRGB'));
		dict.set(N('Length'), PDFNumber.of(rep.contents.length));
		doc.context.assign(ref, PDFRawStream.of(dict, rep.contents));
		count++;
	}
	onProgress?.(targets.length, targets.length);
	return count;
}

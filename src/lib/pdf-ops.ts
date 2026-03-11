/**
 * PDF操作ユーティリティ（pdf-lib使用）
 * 結合・分割・ページ編集・圧縮
 */
import {
	PDFDocument,
	PDFRawStream,
	PDFName,
	PDFNumber,
	PDFArray,
	PDFDict,
	decodePDFRawStream
} from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import { renderPageToJpegBytes } from './pdf-first-page-image';

if (typeof window !== 'undefined') {
	pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
}

const SAVE_OPTIONS = { useObjectStreams: true };

/** 複数PDFを1つに結合 */
export async function mergePdfs(files: File[]): Promise<Uint8Array> {
	const mergedPdf = await PDFDocument.create();

	for (const file of files) {
		const bytes = new Uint8Array(await file.arrayBuffer());
		const srcDoc = await PDFDocument.load(bytes);
		const pageCount = srcDoc.getPageCount();
		if (pageCount === 0) continue;

		const indices = Array.from({ length: pageCount }, (_, i) => i);
		const copiedPages = await mergedPdf.copyPages(srcDoc, indices);
		for (const page of copiedPages) {
			mergedPdf.addPage(page);
		}
	}

	return mergedPdf.save(SAVE_OPTIONS);
}

/** ページの順序変更・削除 */
export async function reorderOrRemovePages(
	file: File,
	pageOrder: number[] // 1-based、0は削除対象
): Promise<Uint8Array> {
	const bytes = new Uint8Array(await file.arrayBuffer());
	const pdfDoc = await PDFDocument.load(bytes);
	const pageCount = pdfDoc.getPageCount();

	// 1-based → 0-based、有効なページのみ
	const validIndices = pageOrder.filter((p) => p >= 1 && p <= pageCount).map((p) => p - 1);

	if (validIndices.length === 0) {
		throw new Error('有効なページが1つもありません');
	}

	// 新しいドキュメントにコピー
	const newDoc = await PDFDocument.create();
	const copiedPages = await newDoc.copyPages(pdfDoc, validIndices);
	for (const page of copiedPages) {
		newDoc.addPage(page);
	}

	return newDoc.save(SAVE_OPTIONS);
}

/** PDFをページ範囲で分割（各範囲を別PDFに） */
export async function splitPdf(
	file: File,
	ranges: { start: number; end: number }[] // 1-based、両端含む
): Promise<Uint8Array[]> {
	const bytes = new Uint8Array(await file.arrayBuffer());
	const srcDoc = await PDFDocument.load(bytes);
	const pageCount = srcDoc.getPageCount();
	const results: Uint8Array[] = [];

	for (const range of ranges) {
		const start = Math.max(1, Math.min(range.start, pageCount));
		const end = Math.max(start, Math.min(range.end, pageCount));
		const indices = Array.from({ length: end - start + 1 }, (_, i) => start - 1 + i);

		const newDoc = await PDFDocument.create();
		const copiedPages = await newDoc.copyPages(srcDoc, indices);
		for (const page of copiedPages) {
			newDoc.addPage(page);
		}
		results.push(await newDoc.save(SAVE_OPTIONS));
	}

	return results;
}

/** PDFを1ページずつ分割 */
export async function splitPdfByPage(file: File): Promise<Uint8Array[]> {
	const bytes = new Uint8Array(await file.arrayBuffer());
	const srcDoc = await PDFDocument.load(bytes);
	const pageCount = srcDoc.getPageCount();
	const results: Uint8Array[] = [];

	for (let i = 0; i < pageCount; i++) {
		const newDoc = await PDFDocument.create();
		const [page] = await newDoc.copyPages(srcDoc, [i]);
		newDoc.addPage(page);
		results.push(await newDoc.save(SAVE_OPTIONS));
	}

	return results;
}

/** PDFを最適化して軽量化（未使用オブジェクト削除・オブジェクトストリーム化） */
export async function compressPdf(file: File): Promise<Uint8Array> {
	const bytes = new Uint8Array(await file.arrayBuffer());
	const srcDoc = await PDFDocument.load(bytes);
	const pageCount = srcDoc.getPageCount();

	const newDoc = await PDFDocument.create();
	const indices = Array.from({ length: pageCount }, (_, i) => i);
	const copiedPages = await newDoc.copyPages(srcDoc, indices);
	for (const page of copiedPages) {
		newDoc.addPage(page);
	}

	return newDoc.save(SAVE_OPTIONS);
}

/** 画像再圧縮オプション */
export type ImageCompressOptions = {
	scale?: number; // 解像度スケール（1.0=72dpi相当、小さいほど軽量）
	quality?: number; // JPEG品質 0-1（小さいほど軽量、画質低下）
};

/** 埋め込み画像のみ圧縮するオプション（テキスト・ベクター維持） */
export type EmbeddedImageCompressOptions = {
	quality?: number; // JPEG品質 0-1（デフォルト0.85）
};

/** JPEG画像をCanvasで再エンコード（品質のみ、解像度維持でレイアウト不変） */
async function recompressJpegInBrowser(bytes: Uint8Array, quality: number): Promise<Uint8Array> {
	const blob = new Blob([bytes], { type: 'image/jpeg' });
	const url = URL.createObjectURL(blob);

	return new Promise((resolve, reject) => {
		const img = new Image();
		img.onload = () => {
			URL.revokeObjectURL(url);
			const canvas = document.createElement('canvas');
			canvas.width = img.width;
			canvas.height = img.height;
			const ctx = canvas.getContext('2d');
			if (!ctx) {
				reject(new Error('Canvas 2D context required'));
				return;
			}
			ctx.drawImage(img, 0, 0);
			canvas.toBlob(
				(b) => {
					if (!b) {
						reject(new Error('toBlob failed'));
						return;
					}
					const reader = new FileReader();
					reader.onloadend = () => {
						resolve(new Uint8Array(reader.result as ArrayBuffer));
					};
					reader.onerror = () => reject(reader.error);
					reader.readAsArrayBuffer(b);
				},
				'image/jpeg',
				quality
			);
		};
		img.onerror = () => {
			URL.revokeObjectURL(url);
			reject(new Error('Image load failed'));
		};
		img.src = url;
	});
}

/** FilterがDCTDecode（JPEG）か判定 */
function hasDctDecodeFilter(stream: PDFRawStream): boolean {
	const filter = stream.dict.get(PDFName.of('Filter'));
	if (!filter) return false;
	if (filter instanceof PDFName) return filter.asString() === '/DCTDecode';
	if (filter instanceof PDFArray) {
		for (let i = 0; i < filter.size(); i++) {
			const f = filter.lookup(i);
			if (f instanceof PDFName && f.asString() === '/DCTDecode') return true;
		}
	}
	return false;
}

/** FilterがFlateDecode（PNG相当）か判定 */
function hasFlateDecodeFilter(stream: PDFRawStream): boolean {
	const filter = stream.dict.get(PDFName.of('Filter'));
	if (!filter) return false;
	if (filter instanceof PDFName) return filter.asString() === '/FlateDecode';
	if (filter instanceof PDFArray) {
		for (let i = 0; i < filter.size(); i++) {
			const f = filter.lookup(i);
			if (f instanceof PDFName && f.asString() === '/FlateDecode') return true;
		}
	}
	return false;
}

/** PNG Predictor (15) の逆変換。filter byteを除いた生ピクセルデータを返す */
function reversePngPredictor(data: Uint8Array, columns: number, bpp: number): Uint8Array {
	const rowSize = 1 + columns;
	const out = new Uint8Array(columns * Math.floor(data.length / rowSize));
	const prevRow = new Uint8Array(columns);

	for (let row = 0; row * rowSize + rowSize <= data.length; row++) {
		const rowStart = row * rowSize;
		const filterType = data[rowStart];
		const src = data.subarray(rowStart + 1, rowStart + rowSize);
		const dst = out.subarray(row * columns, (row + 1) * columns);

		for (let i = 0; i < columns; i++) {
			const left = i >= bpp ? dst[i - bpp] : 0;
			const up = prevRow[i];
			const upLeft = i >= bpp ? prevRow[i - bpp] : 0;

			let v = src[i];
			if (filterType === 1) {
				v = (v + left) & 0xff;
			} else if (filterType === 2) {
				v = (v + up) & 0xff;
			} else if (filterType === 3) {
				v = (v + ((left + up) >>> 1)) & 0xff;
			} else if (filterType === 4) {
				const p = left + up - upLeft;
				const pa = Math.abs(p - left);
				const pb = Math.abs(p - up);
				const pc = Math.abs(p - upLeft);
				const pred = pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft;
				v = (v + pred) & 0xff;
			}
			dst[i] = v;
		}
		prevRow.set(dst);
	}
	return out;
}

/** FlateDecode画像をJPEGに変換（DeviceRGB/DeviceGray、8bpc、Predictor15対応） */
async function flateDecodeImageToJpeg(
	stream: PDFRawStream,
	quality: number
): Promise<Uint8Array | null> {
	const dict = stream.dict;
	const w = dict.lookupMaybe(PDFName.of('Width'), PDFNumber)?.asNumber();
	const h = dict.lookupMaybe(PDFName.of('Height'), PDFNumber)?.asNumber();
	const bpc = dict.lookupMaybe(PDFName.of('BitsPerComponent'), PDFNumber)?.asNumber() ?? 8;
	const colorSpace = dict.get(PDFName.of('ColorSpace'));
	const colorSpaceStr = colorSpace instanceof PDFName ? colorSpace.asString() : '';

	if (!w || !h || w < 1 || h < 1 || bpc !== 8) return null;
	if (colorSpaceStr !== '/DeviceRGB' && colorSpaceStr !== '/DeviceGray') return null;

	const components = colorSpaceStr === '/DeviceRGB' ? 3 : 1;
	const bpp = components;

	let rawBytes: Uint8Array;
	try {
		const decoded = decodePDFRawStream(stream);
		rawBytes = (decoded as { decode(): Uint8Array }).decode();
	} catch {
		return null;
	}

	const decodeParms = dict.get(PDFName.of('DecodeParms'));
	let params: { Columns?: number; Predictor?: number } | undefined;
	const lookupParams = (d: PDFDict) => {
		const cols = d.lookupMaybe(PDFName.of('Columns'), PDFNumber);
		const pred = d.lookupMaybe(PDFName.of('Predictor'), PDFNumber);
		return {
			Columns: cols?.asNumber(),
			Predictor: pred?.asNumber()
		};
	};
	if (decodeParms instanceof PDFArray && decodeParms.size() > 0) {
		const first = decodeParms.lookupMaybe(0, PDFDict);
		if (first) params = lookupParams(first);
	} else if (decodeParms instanceof PDFDict) {
		params = lookupParams(decodeParms);
	}

	let pixels: Uint8Array;
	if ((params?.Predictor === 15 || params?.Predictor === 2) && params.Columns) {
		pixels = reversePngPredictor(rawBytes, params.Columns, bpp);
	} else {
		pixels = rawBytes;
	}

	const expectedLen = w * h * bpp;
	if (pixels.length < expectedLen) return null;

	const canvas = document.createElement('canvas');
	canvas.width = w;
	canvas.height = h;
	const ctx = canvas.getContext('2d');
	if (!ctx) return null;

	const imageData = ctx.createImageData(w, h);
	const src = pixels;
	const dst = imageData.data;

	if (components === 3) {
		for (let i = 0; i < w * h; i++) {
			dst[i * 4] = src[i * 3];
			dst[i * 4 + 1] = src[i * 3 + 1];
			dst[i * 4 + 2] = src[i * 3 + 2];
			dst[i * 4 + 3] = 255;
		}
	} else {
		for (let i = 0; i < w * h; i++) {
			const g = src[i];
			dst[i * 4] = dst[i * 4 + 1] = dst[i * 4 + 2] = g;
			dst[i * 4 + 3] = 255;
		}
	}

	ctx.putImageData(imageData, 0, 0);

	return new Promise((resolve, reject) => {
		canvas.toBlob(
			(b) => {
				if (!b) {
					resolve(null);
					return;
				}
				const reader = new FileReader();
				reader.onloadend = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
				reader.onerror = () => reject(reader.error);
				reader.readAsArrayBuffer(b);
			},
			'image/jpeg',
			quality
		);
	});
}

/** 埋め込み画像のみ圧縮（テキスト・ベクター維持、JPEG/PNG相当対応） */
export async function compressPdfEmbeddedImagesOnly(
	file: File,
	options: EmbeddedImageCompressOptions = {}
): Promise<Uint8Array> {
	const { quality = 0.85 } = options;
	const bytes = new Uint8Array(await file.arrayBuffer());
	const srcDoc = await PDFDocument.load(bytes);
	const enumerated = srcDoc.context.enumerateIndirectObjects();

	for (const [, obj] of enumerated) {
		if (!(obj instanceof PDFRawStream)) continue;
		const dict = obj.dict;
		const subtype = dict.get(PDFName.of('Subtype'));
		if (!(subtype instanceof PDFName) || subtype.asString() !== '/Image') continue;

		try {
			if (hasDctDecodeFilter(obj)) {
				const contents = obj.getContents();
				const newBytes = await recompressJpegInBrowser(contents, quality);
				if (newBytes.length >= contents.length) continue;

				(obj as unknown as { contents: Uint8Array }).contents = newBytes;
				dict.set(PDFName.of('Length'), PDFNumber.of(newBytes.length));
			} else if (hasFlateDecodeFilter(obj)) {
				const newBytes = await flateDecodeImageToJpeg(obj, quality);
				if (!newBytes) continue;

				const origSize = obj.getContents().length;
				if (newBytes.length >= origSize) continue;

				(obj as unknown as { contents: Uint8Array }).contents = newBytes;
				dict.set(PDFName.of('Length'), PDFNumber.of(newBytes.length));
				dict.set(PDFName.of('Filter'), PDFName.of('DCTDecode'));
				dict.delete(PDFName.of('DecodeParms'));
			}
		} catch {
			// スキップ（デコード失敗など）
		}
	}

	return srcDoc.save(SAVE_OPTIONS);
}

/** PDFを画像として再エンコードして軽量化（全ページをJPEG化、画質・解像度で圧縮） */
export async function compressPdfWithImageRecompression(
	file: File,
	options: ImageCompressOptions = {}
): Promise<Uint8Array> {
	const { scale = 1.5, quality = 0.85 } = options;
	const arrayBuffer = await file.arrayBuffer();
	const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
	const pdf = await loadingTask.promise;
	const pageCount = pdf.numPages;

	const newDoc = await PDFDocument.create();

	for (let i = 1; i <= pageCount; i++) {
		const jpegBytes = await renderPageToJpegBytes(pdf, i, { scale, quality });
		const image = await newDoc.embedJpg(jpegBytes);
		const page = newDoc.addPage([image.width, image.height]);
		page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
	}

	return newDoc.save(SAVE_OPTIONS);
}

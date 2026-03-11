/**
 * PDFの1ページ目を画像（PNG）にレンダリング
 * pdfjs-dist を使用
 */
import * as pdfjsLib from 'pdfjs-dist';
import type { PDFDocumentProxy } from 'pdfjs-dist';

if (typeof window !== 'undefined') {
	pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
}

async function renderPageToImageUrl(pdf: PDFDocumentProxy, pageNum: number): Promise<string> {
	const page = await pdf.getPage(pageNum);
	const viewport = page.getViewport({ scale: 2 });
	const canvas = document.createElement('canvas');
	canvas.width = viewport.width;
	canvas.height = viewport.height;
	const ctx = canvas.getContext('2d');
	if (!ctx) throw new Error('Canvas context not available');

	await page.render({
		canvasContext: ctx,
		viewport
	}).promise;

	return new Promise((resolve, reject) => {
		canvas.toBlob(
			(blob) => {
				if (blob) {
					resolve(URL.createObjectURL(blob));
				} else {
					reject(new Error('Failed to create blob'));
				}
			},
			'image/png',
			0.92
		);
	});
}

/** PDFファイルの1ページ目を画像URL（blob）に変換 */
export async function pdfFirstPageToImageUrl(file: File): Promise<string> {
	const arrayBuffer = await file.arrayBuffer();
	const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
	const pdf = await loadingTask.promise;
	return renderPageToImageUrl(pdf, 1);
}

/** PDFファイルの指定ページを画像URL（blob）に変換（pageNumは1-based） */
export async function pdfPageToImageUrl(file: File, pageNum: number): Promise<string> {
	const arrayBuffer = await file.arrayBuffer();
	const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
	const pdf = await loadingTask.promise;
	return renderPageToImageUrl(pdf, pageNum);
}

/** PDFの指定ページをJPEGバイトでレンダリング（圧縮用、scaleとqualityでサイズ調整） */
export async function renderPageToJpegBytes(
	pdf: PDFDocumentProxy,
	pageNum: number,
	options: { scale?: number; quality?: number } = {}
): Promise<Uint8Array> {
	const { scale = 1.5, quality = 0.85 } = options;
	const page = await pdf.getPage(pageNum);
	const viewport = page.getViewport({ scale });
	const canvas = document.createElement('canvas');
	canvas.width = viewport.width;
	canvas.height = viewport.height;
	const ctx = canvas.getContext('2d');
	if (!ctx) throw new Error('Canvas context not available');
	ctx.fillStyle = 'white';
	ctx.fillRect(0, 0, canvas.width, canvas.height);
	await page.render({ canvasContext: ctx, viewport }).promise;

	return new Promise((resolve, reject) => {
		canvas.toBlob(
			(blob) => {
				if (blob) {
					blob.arrayBuffer().then((ab) => resolve(new Uint8Array(ab)));
				} else {
					reject(new Error('Failed to create blob'));
				}
			},
			'image/jpeg',
			quality
		);
	});
}

/** PDFを1回読み込み、複数ページの画像を効率的に取得するレンダラー */
export async function createPdfPageRenderer(file: File): Promise<{
	renderPage: (pageNum: number) => Promise<string>;
	pageCount: number;
}> {
	const arrayBuffer = await file.arrayBuffer();
	const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
	const pdf = await loadingTask.promise;
	const pageCount = pdf.numPages;
	const cache = new Map<number, string>();

	return {
		pageCount,
		async renderPage(pageNum: number): Promise<string> {
			if (cache.has(pageNum)) return cache.get(pageNum)!;
			const url = await renderPageToImageUrl(pdf, pageNum);
			cache.set(pageNum, url);
			return url;
		}
	};
}

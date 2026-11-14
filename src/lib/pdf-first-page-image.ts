/**
 * PDFのページを画像にレンダリング
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

/** PDFを1回読み込み、複数ページの画像を効率的に取得するレンダラー（使い終わったら destroy する） */
export async function createPdfPageRenderer(file: File): Promise<{
	renderPage: (pageNum: number) => Promise<string>;
	pageCount: number;
	destroy: () => Promise<void>;
}> {
	const arrayBuffer = await file.arrayBuffer();
	const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
	const pdf = await loadingTask.promise;

	return {
		pageCount: pdf.numPages,
		renderPage: (pageNum: number) => renderPageToImageUrl(pdf, pageNum),
		destroy: () => pdf.destroy()
	};
}

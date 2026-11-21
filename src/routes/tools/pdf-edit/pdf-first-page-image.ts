/**
 * PDFのページを画像にレンダリング
 * pdfjs-dist を使用
 */
import * as pdfjsLib from 'pdfjs-dist';
import type { PDFDocumentProxy } from 'pdfjs-dist';

if (typeof window !== 'undefined') {
	pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
}

/** 日本語など非埋め込みCIDフォントの描画に必要なCMap（未指定だと文字が空白になる） */
export const PDFJS_CMAP_OPTIONS = {
	cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/cmaps/`,
	cMapPacked: true
};

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

/** PDFを1回読み込み、複数ページの画像を効率的に取得するレンダラー（使い終わったら destroy する） */
export async function createPdfPageRenderer(file: File): Promise<{
	renderPage: (pageNum: number) => Promise<string>;
	pageCount: number;
	hasFormsOrSignatures: boolean;
	destroy: () => Promise<void>;
}> {
	const arrayBuffer = await file.arrayBuffer();
	const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer, ...PDFJS_CMAP_OPTIONS });
	try {
		const pdf = await loadingTask.promise;
		const { info } = await pdf.getMetadata();
		// PDF.js で表示できても、pdf-lib は暗号化PDFを書き出せない。
		if ('EncryptFilterName' in info && info.EncryptFilterName) {
			throw new Error('暗号化されたPDFは編集できません。');
		}
		return {
			pageCount: pdf.numPages,
			hasFormsOrSignatures:
				('IsAcroFormPresent' in info && info.IsAcroFormPresent === true) ||
				('IsXFAPresent' in info && info.IsXFAPresent === true) ||
				('IsSignaturesPresent' in info && info.IsSignaturesPresent === true),
			renderPage: (pageNum: number) => renderPageToImageUrl(pdf, pageNum),
			destroy: () => pdf.destroy()
		};
	} catch (error) {
		await loadingTask.destroy();
		if (error instanceof Error && error.name === 'PasswordException') {
			throw new Error('暗号化されたPDFは編集できません。', { cause: error });
		}
		throw error;
	}
}

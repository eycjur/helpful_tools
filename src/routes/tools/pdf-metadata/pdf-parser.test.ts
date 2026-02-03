import { describe, it, expect, vi } from 'vitest';

vi.mock('pdfjs-dist', () => ({
	GlobalWorkerOptions: { workerSrc: '' },
	version: '0.0.0',
	getDocument: vi.fn()
}));

import * as pdfjsLib from 'pdfjs-dist';
import { preview, safeInfoToDict, parsePDFNonRender, sha256Hex } from './pdf-parser';

describe('PDFメタデータ - ユーティリティ', () => {
	it('previewは改行を正規化して切り詰める', () => {
		const input = 'line1\r\nline2\r\nline3';
		expect(preview(input, 10)).toBe('line1\nline...');
	});

	it('previewは指定長以内ならそのまま返す', () => {
		expect(preview('short', 10)).toBe('short');
	});

	it('safeInfoToDictは非オブジェクトを空にする', () => {
		expect(safeInfoToDict(null)).toEqual({});
		expect(safeInfoToDict(123)).toEqual({});
	});

	it('safeInfoToDictはオブジェクトを浅くコピーする', () => {
		const input = { Title: 'Test', Pages: 1 };
		expect(safeInfoToDict(input)).toEqual(input);
	});

	it('sha256Hexは文字列のハッシュを返す', async () => {
		const hash = await sha256Hex('abc');
		expect(hash).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
	});

	it('parsePDFNonRenderは最小モックでレポートを生成できる', async () => {
		const getDocument = pdfjsLib.getDocument as unknown as ReturnType<typeof vi.fn>;
		const pdfMock = {
			numPages: 1,
			getMetadata: async () => ({
				info: { Title: 'Sample' },
				metadata: {
					getRaw: () => '<xmp></xmp>',
					getAll: () => ({ Title: 'Sample' })
				}
			}),
			getAttachments: async () => ({}),
			getJSActions: async () => ({}),
			getPageJSActions: async () => ({}),
			getPage: async () => ({
				getAnnotations: async () => []
			}),
			_transport: {
				xref: {
					trailer: {
						get: (key: string) => (key === 'ID' ? [new Uint8Array([1, 2, 3]), 'id2'] : null)
					}
				}
			},
			destroy: async () => {}
		};
		getDocument.mockReturnValue({ promise: Promise.resolve(pdfMock) });

		const buffer = new TextEncoder().encode('%PDF-1.7').buffer;
		const report = await parsePDFNonRender(buffer, 'sample.pdf', (r) => r.findings);

		expect(report.file.path).toBe('sample.pdf');
		expect(report.file.pages).toBe(1);
		expect(report.metadata.infoDict.Title).toBe('Sample');
		expect(report.metadata.documentIds?.length).toBe(2);
	});
});

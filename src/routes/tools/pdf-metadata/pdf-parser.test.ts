// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { PDFDocument, PDFHexString, PDFName, PDFString } from 'pdf-lib';
import { makeFindings } from './findings';
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

	it('圧縮された間接オブジェクトとPDF.jsのWorker転送を含むPDFからレポートを生成する', async () => {
		const doc = await PDFDocument.create();
		const page = doc.addPage();
		doc.setTitle('Sample');
		const ctx = doc.context;
		ctx.trailerInfo.ID = ctx.obj([PDFHexString.of('010203'), PDFHexString.of('010203')]);
		const uri = 'https://example.test/document';
		doc.catalog.set(
			PDFName.of('OpenAction'),
			ctx.register(ctx.obj({ S: 'URI', URI: PDFString.of(uri) }))
		);
		const field = doc.getForm().createTextField('reviewer');
		field.setText('sample');
		field.addToPage(page);
		await doc.attach(new Uint8Array([1, 2, 3]), 'notes.txt');

		const bytes = await doc.save({ useObjectStreams: true });
		const size = bytes.length;
		const hash = await sha256Hex(bytes);
		const report = await parsePDFNonRender(bytes.buffer as ArrayBuffer, 'sample.pdf', makeFindings);
		expect(report.file).toEqual({
			path: 'sample.pdf',
			pages: 1,
			size,
			version: '1.7',
			sha256: hash
		});
		expect(report.metadata.infoDict.Title).toBe('Sample');
		expect(report.metadata.documentIds).toEqual(['010203', '010203']);
		expect(report.active.openAction).toEqual({ type: 'URI', url: uri });
		expect(report.active.externalRefs).toMatchObject([
			{ kind: 'URI', where: 'OpenAction', url: uri }
		]);
		expect(report.embedded.files).toMatchObject([{ name: 'notes.txt', size: 3 }]);
		expect(report.forms).toEqual({
			acroFormPresent: true,
			xfaPresent: false,
			fieldCount: 1,
			hasCalcOrValidate: false
		});
		expect(report.security.encrypted).toBe(false);
		expect(report.findings.map((f) => f.code)).toEqual(['EMBEDDED_FILES', 'EXTERNAL_REFS']);
	});

	it('注釈辞書を解析できない場合は、読み込めた情報と解析範囲の警告を返す', async () => {
		const doc = await PDFDocument.create();
		// Annotsは注釈の配列であるべきだが、辞書になっているPDF。
		doc.addPage().node.set(PDFName.of('Annots'), doc.context.obj({}));
		doc.setTitle('部分的に読み込めるPDF');
		const bytes = await doc.save();
		const report = await parsePDFNonRender(
			bytes.buffer as ArrayBuffer,
			'partial.pdf',
			makeFindings
		);
		expect(report.file.pages).toBe(1);
		expect(report.metadata.infoDict.Title).toBe('部分的に読み込めるPDF');
		expect(report.findings).toContainEqual({
			severity: 'medium',
			code: 'INCOMPLETE_STRUCTURE',
			message: expect.stringContaining('PDFの構造の一部を解析できませんでした')
		});
	});
});

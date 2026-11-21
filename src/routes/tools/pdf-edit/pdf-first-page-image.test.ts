// @vitest-environment node
import { readFile } from 'node:fs/promises';
import { PDFDocument, PDFName, PDFString } from 'pdf-lib';
import { expect, it } from 'vitest';
import { createPdfPageRenderer } from './pdf-first-page-image';

it('パスワードなしで開ける暗号化PDFも編集前に拒否する', async () => {
	const bytes = await readFile(new URL('./fixtures/restricted.pdf', import.meta.url));
	const file = new File([new Uint8Array(bytes)], 'restricted.pdf');
	await expect(createPdfPageRenderer(file)).rejects.toThrow('暗号化されたPDFは編集できません');
});

it('署名フィールドのあるPDFで書き出し時の注意を表示するための情報を返す', async () => {
	const doc = await PDFDocument.create();
	doc.addPage();
	const field = doc.context.register(doc.context.obj({ FT: 'Sig', T: PDFString.of('Signature') }));
	doc.catalog.set(PDFName.of('AcroForm'), doc.context.obj({ SigFlags: 1, Fields: [field] }));
	const file = new File([new Uint8Array(await doc.save())], 'signature.pdf');
	const renderer = await createPdfPageRenderer(file);
	try {
		expect(renderer.hasFormsOrSignatures).toBe(true);
	} finally {
		await renderer.destroy();
	}
});

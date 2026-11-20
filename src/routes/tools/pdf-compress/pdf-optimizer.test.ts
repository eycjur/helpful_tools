// CompressionStream / Blob.stream を使うため Node 環境で実行
// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
	PDFDocument,
	PDFDict,
	PDFName,
	PDFRawStream,
	PDFRef,
	PDFString,
	decodePDFRawStream
} from 'pdf-lib';
import {
	analyzeSpace,
	dedupeStreams,
	deflateUncompressedStreams,
	removeExtras,
	removeUnreachable
} from './pdf-optimizer';
import { compressPdfFile } from './compress';

const N = (s: string) => PDFName.of(s);

/** 非圧縮の画像ストリームを登録して参照を返す */
function registerImage(doc: PDFDocument, fill: number, size = 4000): PDFRef {
	const dict = doc.context.obj({
		Type: 'XObject',
		Subtype: 'Image',
		Width: size / 4,
		Height: 4,
		BitsPerComponent: 8,
		ColorSpace: 'DeviceGray'
	});
	return doc.context.register(PDFRawStream.of(dict, new Uint8Array(size).fill(fill)));
}

/** ページのリソースに画像を登録 */
function usePageImage(doc: PDFDocument, pageIndex: number, ref: PDFRef) {
	const page = doc.getPage(pageIndex);
	page.node.setXObject(N('Im0'), ref);
}

function countStreams(doc: PDFDocument, subtype: string): number {
	return doc.context
		.enumerateIndirectObjects()
		.filter(
			([, o]) => o instanceof PDFRawStream && o.dict.get(N('Subtype')) === PDFName.of(subtype)
		).length;
}

describe('dedupeStreams', () => {
	it('辞書と中身が一致するストリームのみ統合する', async () => {
		const doc = await PDFDocument.create();
		doc.addPage();
		doc.addPage();
		doc.addPage();
		const a = registerImage(doc, 1);
		const b = registerImage(doc, 1);
		const c = registerImage(doc, 2);
		usePageImage(doc, 0, a);
		usePageImage(doc, 1, b);
		usePageImage(doc, 2, c);

		expect(dedupeStreams(doc)).toBe(1);
		expect(countStreams(doc, 'Image')).toBe(2);
		const xobj = (i: number) =>
			doc.getPage(i).node.Resources()!.lookup(N('XObject'), PDFDict).get(N('Im0'));
		expect(xobj(0)).toBe(xobj(1));
		expect(xobj(2)).not.toBe(xobj(0));
	});

	it('SMaskの統合後に親画像も一致すれば続けて統合する', async () => {
		const doc = await PDFDocument.create();
		doc.addPage();
		doc.addPage();
		const masks = [registerImage(doc, 9), registerImage(doc, 9)];
		const images = masks.map((m) => {
			const ref = registerImage(doc, 3);
			(doc.context.lookup(ref) as PDFRawStream).dict.set(N('SMask'), m);
			return ref;
		});
		usePageImage(doc, 0, images[0]);
		usePageImage(doc, 1, images[1]);

		expect(dedupeStreams(doc)).toBe(2);
		expect(countStreams(doc, 'Image')).toBe(2);
	});
});

describe('removeUnreachable / removeExtras', () => {
	it('参照されない画像は削除し、参照される画像は残す', async () => {
		const doc = await PDFDocument.create();
		doc.addPage();
		usePageImage(doc, 0, registerImage(doc, 1));
		registerImage(doc, 2);

		expect(removeUnreachable(doc)).toBe(1);
		expect(countStreams(doc, 'Image')).toBe(1);
	});

	it('サムネイル・PieceInfo・添付ファイルを削除できる', async () => {
		const doc = await PDFDocument.create();
		doc.addPage();
		const page = doc.getPage(0).node;
		page.set(N('Thumb'), registerImage(doc, 5));
		page.set(N('PieceInfo'), doc.context.obj({ Illustrator: { Private: 'x' } }));
		const file = doc.context.register(
			PDFRawStream.of(doc.context.obj({ Type: 'EmbeddedFile' }), new Uint8Array(10))
		);
		doc.catalog.set(
			N('Names'),
			doc.context.obj({
				EmbeddedFiles: { Names: [PDFString.of('a.txt'), { Type: 'Filespec', EF: { F: file } }] }
			})
		);

		removeExtras(doc, { removeThumbnails: true, removePieceInfo: true, removeAttachments: true });
		removeUnreachable(doc);

		expect(page.has(N('Thumb'))).toBe(false);
		expect(page.has(N('PieceInfo'))).toBe(false);
		expect(doc.context.lookup(file)).toBeUndefined();
		expect(countStreams(doc, 'Image')).toBe(0);
	});

	it('直接辞書の中にあるXMPメタデータ参照も削除する', async () => {
		const doc = await PDFDocument.create();
		doc.addPage();
		const xmp = doc.context.register(
			PDFRawStream.of(doc.context.obj({ Type: 'Metadata' }), new Uint8Array(10))
		);
		const inline = doc.context.obj({ Info: { Metadata: xmp } });
		doc.getPage(0).node.set(N('Extra'), inline);

		removeExtras(doc, { removeMetadata: true });
		removeUnreachable(doc);
		expect(doc.context.lookup(xmp)).toBeUndefined();
	});
});

describe('deflateUncompressedStreams', () => {
	it('Filterなしのストリームを可逆にFlate圧縮する', async () => {
		const doc = await PDFDocument.create();
		doc.addPage();
		const ref = registerImage(doc, 7);
		usePageImage(doc, 0, ref);

		expect(await deflateUncompressedStreams(doc)).toBe(1);
		const stream = doc.context.lookup(ref) as PDFRawStream;
		expect(stream.dict.get(N('Filter'))).toBe(PDFName.of('FlateDecode'));
		expect(stream.getContentsSize()).toBeLessThan(4000);
		const decoded = (decodePDFRawStream(stream) as { decode(): Uint8Array }).decode();
		expect(decoded).toEqual(new Uint8Array(4000).fill(7));
	});

	it('XMPメタデータは非圧縮のまま残す', async () => {
		const doc = await PDFDocument.create();
		const ref = doc.context.register(
			PDFRawStream.of(doc.context.obj({ Type: 'Metadata', Subtype: 'XML' }), new Uint8Array(500))
		);
		doc.catalog.set(N('Metadata'), ref);
		expect(await deflateUncompressedStreams(doc)).toBe(0);
	});
});

describe('analyzeSpace', () => {
	it('画像・サムネイルを分類し、署名を検出する', async () => {
		const doc = await PDFDocument.create();
		doc.addPage([720, 360]);
		usePageImage(doc, 0, registerImage(doc, 1, 8000)); // 2000×4px
		doc.getPage(0).node.set(N('Thumb'), registerImage(doc, 2, 400));
		doc.context.register(doc.context.obj({ Type: 'Sig', ByteRange: [0, 1, 2, 3] }));

		const report = analyzeSpace(doc, 12345);
		const bytesOf = (c: string) => report.categories.find((x) => x.category === c)?.bytes;
		expect(bytesOf('image')).toBe(8000);
		expect(bytesOf('thumbnail')).toBe(400);
		expect(report.images).toHaveLength(1);
		// 長辺2000px ÷ ページ長辺10インチ = 200ppi
		expect(report.images[0].ppiAtPageSize).toBe(200);
		expect(report.hasSignature).toBe(true);
	});
});

describe('compressPdfFile', () => {
	it('重複画像のあるPDFを小さくする', async () => {
		const doc = await PDFDocument.create();
		for (let i = 0; i < 3; i++) {
			doc.addPage();
			const dict = doc.context.obj({
				Type: 'XObject',
				Subtype: 'Image',
				Width: 100,
				Height: 100,
				BitsPerComponent: 8,
				ColorSpace: 'DeviceGray'
			});
			// 圧縮しにくいデータで、重複排除の効果だけを確かめる
			const data = new Uint8Array(10000).map((_, j) => (j * 2654435761) >>> 24);
			usePageImage(doc, i, doc.context.register(PDFRawStream.of(dict, data)));
		}
		const original = await doc.save({ useObjectStreams: false });

		const result = await compressPdfFile(original, { images: null });
		expect(result.keptOriginal).toBe(false);
		expect(result.stats.deduped).toBe(2);
		expect(result.bytes.length).toBeLessThan(original.length / 2);
		const reloaded = await PDFDocument.load(result.bytes);
		expect(reloaded.getPageCount()).toBe(3);
	});

	it('小さくならない場合は元のバイト列を返す', async () => {
		const doc = await PDFDocument.create();
		doc.addPage();
		const original = await doc.save();
		const result = await compressPdfFile(original, { images: null });
		expect(result.keptOriginal).toBe(true);
		expect(result.bytes).toBe(original);
	});
});

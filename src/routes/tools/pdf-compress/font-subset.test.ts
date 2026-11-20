// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import {
	PDFArray,
	PDFDocument,
	PDFDict,
	PDFName,
	PDFRawStream,
	PDFRef,
	decodePDFRawStream
} from 'pdf-lib';
import { addGlyphs, subsetFonts, type Subsetter } from './font-subset';
import { createSubsetter } from './hb-subset';

const N = (s: string) => PDFName.of(s);
const FONT = new Uint8Array(
	readFileSync('node_modules/pdfjs-dist/standard_fonts/LiberationSans-Regular.ttf')
);
let subsetter: Subsetter;
beforeAll(async () => {
	subsetter = await createSubsetter(
		readFileSync('node_modules/harfbuzzjs/dist/harfbuzz-subset.wasm')
	);
});

/** TrueType の各字形のデータ長（loca から求める） */
function glyphLengths(font: Uint8Array): number[] {
	const view = new DataView(font.buffer, font.byteOffset, font.byteLength);
	const tables = new Map<string, number>();
	for (let i = 0; i < view.getUint16(4); i++) {
		const rec = 12 + i * 16;
		tables.set(String.fromCharCode(...font.subarray(rec, rec + 4)), view.getUint32(rec + 8));
	}
	const longLoca = view.getInt16(tables.get('head')! + 50) === 1;
	const numGlyphs = view.getUint16(tables.get('maxp')! + 4);
	const loca = tables.get('loca')!;
	const offset = (i: number) =>
		longLoca ? view.getUint32(loca + i * 4) : view.getUint16(loca + i * 2) * 2;
	return Array.from({ length: numGlyphs }, (_, i) => offset(i + 1) - offset(i));
}

/** Type0 + CIDFontType2 + FontFile2（まるごと埋め込み）のフォントを作る */
function registerType0(doc: PDFDocument, baseFont = 'LiberationSans'): PDFRef {
	const fontFile = doc.context.register(
		PDFRawStream.of(doc.context.obj({ Length1: FONT.length }), FONT)
	);
	const descriptor = doc.context.obj({
		Type: 'FontDescriptor',
		FontName: baseFont,
		Flags: 32,
		FontFile2: fontFile
	});
	const cidFont = doc.context.obj({
		Type: 'Font',
		Subtype: 'CIDFontType2',
		BaseFont: baseFont,
		CIDSystemInfo: { Registry: 'Adobe', Ordering: 'Identity', Supplement: 0 },
		FontDescriptor: descriptor,
		CIDToGIDMap: 'Identity'
	});
	return doc.context.register(
		doc.context.obj({
			Type: 'Font',
			Subtype: 'Type0',
			BaseFont: baseFont,
			Encoding: 'Identity-H',
			DescendantFonts: [cidFont]
		})
	);
}

async function setup(content: string, baseFont?: string) {
	const doc = await PDFDocument.create();
	const page = doc.addPage();
	const font = registerType0(doc, baseFont);
	page.node.setFontDictionary(N('F1'), font);
	page.node.set(N('Contents'), doc.context.register(doc.context.flateStream(content)));
	return { doc, page, font };
}

function fontFileOf(doc: PDFDocument, font: PDFRef) {
	const type0 = doc.context.lookup(font) as PDFDict;
	const cid = type0.lookupMaybe(N('DescendantFonts'), PDFArray)!.lookup(0) as PDFDict;
	const descriptor = cid.lookupMaybe(N('FontDescriptor'), PDFDict)!;
	const stream = doc.context.lookup(descriptor.get(N('FontFile2'))) as PDFRawStream;
	const bytes = stream.dict.has(N('Filter'))
		? (decodePDFRawStream(stream) as { decode(): Uint8Array }).decode()
		: stream.getContents();
	return { type0, descriptor, bytes };
}

describe('addGlyphs', () => {
	it('2バイトのCIDをIdentityならそのまま、CIDToGIDMapがあれば変換してGIDにする', () => {
		const glyphs = new Set<number>();
		addGlyphs(glyphs, new Uint8Array([0, 0x24, 0x01, 0x02]), null);
		expect([...glyphs]).toEqual([0x24, 0x102]);
		const map = new Uint8Array([0, 0, 0, 7]); // CID 1 → GID 7
		const mapped = new Set<number>();
		addGlyphs(mapped, new Uint8Array([0, 1]), map);
		expect([...mapped]).toEqual([7]);
	});
});

describe('subsetFonts', () => {
	it('使われた字形だけを残し、字形番号は保ち、名前にサブセットの接頭辞を付ける', async () => {
		// GID 0x24, 0x25 を Tj、0x30 を TJ で描く
		const { doc, font } = await setup('BT /F1 12 Tf <00240025> Tj [<0030> -100] TJ ET');
		expect(subsetFonts(doc, subsetter)).toBe(1);
		const { type0, descriptor, bytes } = fontFileOf(doc, font);
		expect(bytes.length).toBeLessThan(FONT.length / 4);
		const lengths = glyphLengths(bytes);
		const original = glyphLengths(FONT);
		// 字形データは再シリアライズで末尾の詰め物（最大3バイト）が変わりうる
		for (const gid of [0x24, 0x25, 0x30]) {
			expect(lengths[gid]).toBeGreaterThan(0);
			expect(Math.abs(lengths[gid] - original[gid])).toBeLessThanOrEqual(3);
		}
		expect(original[0x26]).toBeGreaterThan(0);
		// .notdef（GID 0）の形は残す（NOTDEF_OUTLINE）
		expect(lengths[0]).toBeGreaterThan(0);
		expect(lengths[0x26] ?? 0).toBe(0);
		expect((descriptor.lookup(N('FontName')) as PDFName).decodeText()).toMatch(
			/^[A-Z]{6}\+LiberationSans$/
		);
		expect((type0.lookup(N('BaseFont')) as PDFName).decodeText()).toMatch(/^[A-Z]{6}\+/);
	});

	it('Formの中で引き継いだフォントで描かれた字形も残す', async () => {
		const { doc, page, font } = await setup('BT /F1 12 Tf /Fm0 Do ET');
		const form = doc.context.register(
			doc.context.flateStream('<0040> Tj', { Subtype: 'Form', BBox: [0, 0, 10, 10] })
		);
		page.node.setXObject(N('Fm0'), form);
		expect(subsetFonts(doc, subsetter)).toBe(1);
		const lengths = glyphLengths(fontFileOf(doc, font).bytes);
		expect(lengths[0x40]).toBeGreaterThan(0);
	});

	it('フォーム入力欄の既定リソース（/DR）から参照されるフォントは対象外', async () => {
		const { doc, font } = await setup('BT /F1 12 Tf <0024> Tj ET');
		doc.catalog.set(N('AcroForm'), doc.context.obj({ Fields: [], DR: { Font: { Helv: font } } }));
		expect(subsetFonts(doc, subsetter)).toBe(0);
	});

	it('ExtGState の /Font 配列で選ばれるフォントは対象外にし、例外にもしない', async () => {
		const { doc, page, font } = await setup('BT /F1 12 Tf <0024> Tj ET');
		page.node.set(
			N('Resources'),
			doc.context.obj({
				Font: { F1: font },
				ExtGState: { GS0: { Type: 'ExtGState', Font: [font, 12] } }
			})
		);
		expect(subsetFonts(doc, subsetter)).toBe(0);
	});

	it('候補外のフォント（CMap名のエンコーディング）と同じフォントファイルを共有していたら対象外', async () => {
		const { doc, font } = await setup('BT /F1 12 Tf <0024> Tj ET');
		const t0 = doc.context.lookup(font) as PDFDict;
		const cid = (t0.lookup(N('DescendantFonts')) as PDFArray).lookup(0) as PDFDict;
		const descriptor = cid.lookup(N('FontDescriptor')) as PDFDict;
		const other = doc.context.obj({
			Type: 'FontDescriptor',
			FontName: 'Other',
			FontFile2: descriptor.get(N('FontFile2'))
		});
		doc.context.register(
			doc.context.obj({
				Type: 'Font',
				Subtype: 'Type0',
				BaseFont: 'Other',
				Encoding: 'UniJIS-UCS2-H',
				DescendantFonts: [{ Type: 'Font', Subtype: 'CIDFontType2', FontDescriptor: other }]
			})
		);
		expect(subsetFonts(doc, subsetter)).toBe(0);
	});

	it('描画命令を復号できないページがあればサブセット化しない', async () => {
		const { doc, page } = await setup('BT /F1 12 Tf <0024> Tj ET');
		const broken = doc.context.register(
			PDFRawStream.of(doc.context.obj({ Filter: 'FlateDecode' }), new Uint8Array([1, 2, 3, 4]))
		);
		page.node.set(N('Contents'), doc.context.obj([page.node.get(N('Contents')), broken]));
		expect(subsetFonts(doc, subsetter)).toBe(0);
	});

	it('名前の #xx エスケープを復号してフォントを解決する', async () => {
		const { doc, font } = await setup('BT /F#31 12 Tf <0024> Tj ET');
		expect(subsetFonts(doc, subsetter)).toBe(1);
		expect(glyphLengths(fontFileOf(doc, font).bytes)[0x24]).toBeGreaterThan(0);
	});

	it('すでにサブセット（接頭辞付き）のフォントは対象外', async () => {
		const { doc } = await setup('BT /F1 12 Tf <0024> Tj ET', 'ABCDEF+LiberationSans');
		expect(subsetFonts(doc, subsetter)).toBe(0);
	});
});

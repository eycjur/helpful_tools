import { describe, it, expect } from 'vitest';
import { PDFDocument, PDFName, PDFRawStream, decodePDFRawStream } from 'pdf-lib';
import { digitsFor, formatNumber, roundContent, roundCoordinates } from './content-precision';

const enc = (s: string) => new TextEncoder().encode(s);
const dec = (r: { bytes: Uint8Array | null }) =>
	r.bytes ? new TextDecoder().decode(r.bytes) : null;
const fresh = () => ({
	ctm: [1, 0, 0, 1, 0, 0] as [number, number, number, number, number, number],
	stack: []
});

describe('digitsFor / formatNumber', () => {
	it('拡大率が大きいほど多くの桁を残す', () => {
		expect(digitsFor(1, 0.01)).toBe(2);
		expect(digitsFor(10, 0.01)).toBe(3);
		expect(digitsFor(0.01, 0.01)).toBe(0);
	});

	it('末尾と先頭の0を省いた最短表記にする', () => {
		expect(formatNumber(12.34567, 2)).toBe('12.35');
		expect(formatNumber(0.5001, 2)).toBe('.5');
		expect(formatNumber(-0.25, 2)).toBe('-.25');
		expect(formatNumber(-0.001, 2)).toBe('0');
		expect(formatNumber(3.0001, 2)).toBe('3');
	});
});

describe('roundContent', () => {
	it('パスの座標だけを丸め、cm・色・文字列・文字位置はそのまま残す', () => {
		const src =
			'q 0.123456 0 0 0.123456 10.123456 20.654321 cm 0.123456 g ' +
			'1.123456 2.987654 m 3.333333 4.444444 l S Q ' +
			'BT 1.234567 2.345678 Td (1.234567 2.345678 l) Tj ET 5.555555 6.666666 l';
		const out = dec(roundContent(enc(src), fresh(), 0.01));
		// cm の中は拡大率 0.123456 → 小数1桁で足りる。外は拡大率1 → 2桁
		expect(out).toBe(
			'q 0.123456 0 0 0.123456 10.123456 20.654321 cm 0.123456 g ' +
				'1.1 3 m 3.3 4.4 l S Q ' +
				'BT 1.234567 2.345678 Td (1.234567 2.345678 l) Tj ET 5.56 6.67 l'
		);
	});

	it('拡大された座標系では誤差が広がらないよう多くの桁を残す', () => {
		const out = dec(roundContent(enc('10 0 0 10 0 0 cm 1.234567 2.345678 m'), fresh(), 0.01));
		expect(out).toBe('10 0 0 10 0 0 cm 1.235 2.346 m');
	});

	it('インライン画像のデータは書き換えない', () => {
		const src = 'BI /W 1 /H 1 /CS /G /BPC 8 ID 1.234567 l EI 1.234567 2 l';
		expect(dec(roundContent(enc(src), fresh(), 0.01))).toBe(
			'BI /W 1 /H 1 /CS /G /BPC 8 ID 1.234567 l EI 1.23 2 l'
		);
	});

	it('丸める余地がなければ null', () => {
		expect(roundContent(enc('1 2 m 3.5 4 l'), fresh(), 0.01).bytes).toBeNull();
	});

	it('演算子のないオペランドが末尾に残れば dangling を返す', () => {
		expect(roundContent(enc('q 10 0 0 10 0'), fresh(), 0.01).dangling).toBe(true);
		expect(roundContent(enc('q 10 0 0 10 0 0 cm'), fresh(), 0.01).dangling).toBe(false);
	});
});

describe('roundCoordinates', () => {
	const N = (s: string) => PDFName.of(s);
	const text = (s: PDFRawStream) =>
		new TextDecoder().decode(
			s.dict.has(N('Filter'))
				? (decodePDFRawStream(s) as { decode(): Uint8Array }).decode()
				: s.getContents()
		);

	it('Formは配置の最大の拡大率を基準に丸め、パターン内で使われるFormは触らない', async () => {
		const doc = await PDFDocument.create();
		const page = doc.addPage();
		const form = doc.context.register(
			doc.context.flateStream('1.234567 2.345678 m', { Subtype: 'Form', BBox: [0, 0, 10, 10] })
		);
		const patternForm = doc.context.register(
			doc.context.flateStream('1.234567 2.345678 m', { Subtype: 'Form', BBox: [0, 0, 10, 10] })
		);
		doc.context.register(
			doc.context.flateStream('/P Do', {
				Type: 'Pattern',
				PatternType: 1,
				Resources: { XObject: { P: patternForm } }
			})
		);
		page.node.setXObject(N('Fm0'), form);
		page.node.setXObject(N('Fm1'), patternForm);
		// Fm0 は等倍と10倍で描かれる → 10倍を基準に3桁
		page.node.set(
			N('Contents'),
			doc.context.register(
				doc.context.flateStream('/Fm0 Do q 10 0 0 10 0 0 cm /Fm0 Do Q /Fm1 Do 9.87654 1 l')
			)
		);
		expect(roundCoordinates(doc)).toBe(2);
		expect(text(doc.context.lookup(form) as PDFRawStream)).toBe('1.235 2.346 m');
		expect(text(doc.context.lookup(patternForm) as PDFRawStream)).toBe('1.234567 2.345678 m');
		expect(text(doc.context.lookup(page.node.get(N('Contents'))) as PDFRawStream)).toContain(
			'9.88 1 l'
		);
	});

	it('Contents が演算子の途中で分割されていたら、それ以降のストリームは丸めない', async () => {
		const doc = await PDFDocument.create();
		const page = doc.addPage();
		const first = doc.context.register(doc.context.flateStream('1.234567 2 m q 10 0 0 10 0'));
		const second = doc.context.register(doc.context.flateStream('0 cm 1.234567 2.345678 m Q'));
		page.node.set(N('Contents'), doc.context.obj([first, second]));
		roundCoordinates(doc);
		expect(text(doc.context.lookup(first) as PDFRawStream)).toBe('1.23 2 m q 10 0 0 10 0');
		expect(text(doc.context.lookup(second) as PDFRawStream)).toBe('0 cm 1.234567 2.345678 m Q');
	});

	it('ソフトマスク（ExtGState の /SMask /G）として使われる Form は丸めない', async () => {
		const doc = await PDFDocument.create();
		const page = doc.addPage();
		const form = doc.context.register(
			doc.context.flateStream('1.234567 2.345678 m', {
				Subtype: 'Form',
				BBox: [0, 0, 10, 10],
				Group: { S: 'Transparency' }
			})
		);
		page.node.setXObject(N('Fm0'), form);
		page.node.set(
			N('Resources'),
			doc.context.obj({
				XObject: { Fm0: form },
				ExtGState: { GS0: { Type: 'ExtGState', SMask: { S: 'Luminosity', G: form } } }
			})
		);
		page.node.set(N('Contents'), doc.context.register(doc.context.flateStream('/Fm0 Do')));
		roundCoordinates(doc);
		expect(text(doc.context.lookup(form) as PDFRawStream)).toBe('1.234567 2.345678 m');
	});
});

import { describe, it, expect } from 'vitest';
import { PDFDocument, PDFName, PDFRawStream, PDFRef } from 'pdf-lib';
import {
	collectImagePlacements,
	MAX_DO_OPERATIONS,
	multiply,
	scanContent,
	type Matrix
} from './image-placement';

const N = (s: string) => PDFName.of(s);
const enc = (s: string) => new TextEncoder().encode(s);

function ops(content: string | Uint8Array) {
	const out: string[] = [];
	scanContent(typeof content === 'string' ? enc(content) : content, (op, operands) =>
		out.push(
			`${op}(${operands
				.map((o) =>
					o === null
						? '_'
						: typeof o === 'number'
							? o
							: 'name' in o
								? '/' + o.name
								: JSON.stringify(new TextDecoder('latin1').decode(o.bytes))
				)
				.join(' ')})`
		)
	);
	return out;
}

describe('multiply', () => {
	it('拡大してから平行移動した行列を合成する', () => {
		const scale: Matrix = [2, 0, 0, 3, 0, 0];
		const translate: Matrix = [1, 0, 0, 1, 10, 20];
		expect(multiply(scale, translate)).toEqual([2, 0, 0, 3, 10, 20]);
		expect(multiply(translate, scale)).toEqual([2, 0, 0, 3, 20, 60]);
	});
});

describe('scanContent', () => {
	it('数値・名前・文字列（エスケープを復号）を取り出し、文字列の中身は演算子として扱わない', () => {
		expect(ops('q 1 0 0 1 .5 -2 cm (a (Do) \\) cm) Tj [(x) 3] TJ /Im1 Do Q')).toEqual([
			'q()',
			'cm(1 0 0 1 0.5 -2)',
			'Tj("a (Do) ) cm")',
			'TJ("x" 3)',
			'Do(/Im1)',
			'Q()'
		]);
	});

	it('コメントを読み飛ばし、16進文字列を復号し、辞書の区切りは無視する', () => {
		expect(ops('% Do comment\n<48656c6c6f> Tj /P <</MCID 0>> BDC EMC')).toEqual([
			'Tj("Hello")',
			'BDC(/P /MCID 0)',
			'EMC()'
		]);
	});

	it('リテラル文字列の8進数エスケープと改行エスケープを復号する', () => {
		expect(ops('(\\101\\n\\\\) Tj')).toEqual(['Tj("A\\n\\\\")']);
	});

	it('インライン画像のバイナリに演算子らしい文字があっても読み飛ばす', () => {
		const head = enc('BI /W 2 /H 1 /CS /G /BPC 8 ID ');
		const tail = enc(' EI /Im0 Do');
		const data = new Uint8Array([...head, 0x44, 0x6f, 0x20, 0x63, 0x6d, ...tail]); // "Do cm"
		expect(ops(data)).toEqual(['BI()', 'Do(/Im0)']);
	});
});

describe('collectImagePlacements', () => {
	function setup(content: string) {
		return PDFDocument.create().then((doc) => {
			const page = doc.addPage([612, 792]);
			const image = doc.context.register(
				PDFRawStream.of(
					doc.context.obj({ Type: 'XObject', Subtype: 'Image', Width: 10, Height: 10 }),
					new Uint8Array(100)
				)
			);
			page.node.setXObject(N('Im0'), image);
			page.node.set(N('Contents'), doc.context.register(doc.context.flateStream(content)));
			return { doc, page, image };
		});
	}

	it('q/Qで行列を戻し、同じ画像は軸ごとに最も大きい描画サイズを記録する', async () => {
		const { doc, image } = await setup(
			'q 144 0 0 72 0 0 cm /Im0 Do Q q 72 0 0 216 0 0 cm /Im0 Do Q'
		);
		expect(collectImagePlacements(doc)!.get(image)).toEqual({ widthIn: 2, heightIn: 3 });
	});

	it('透明度マスクにも親画像と同じ配置を記録する', async () => {
		const { doc, image } = await setup('144 0 0 72 0 0 cm /Im0 Do');
		const mask = doc.context.register(
			PDFRawStream.of(
				doc.context.obj({ Subtype: 'Image', Width: 5, Height: 5 }),
				new Uint8Array(25)
			)
		);
		(doc.context.lookup(image) as PDFRawStream).dict.set(N('SMask'), mask);
		expect(collectImagePlacements(doc)!.get(mask)).toEqual({ widthIn: 2, heightIn: 1 });
	});

	it('回転していても描画サイズを正しく求める', async () => {
		const { doc, image } = await setup('0 144 -144 0 0 0 cm /Im0 Do');
		expect(collectImagePlacements(doc)!.get(image)).toEqual({ widthIn: 2, heightIn: 2 });
	});

	it('Form XObjectの/Matrixと独自の/Resourcesをたどる', async () => {
		const { doc, page, image } = await setup('2 0 0 2 0 0 cm /Fm0 Do');
		const form = doc.context.register(
			doc.context.flateStream('72 0 0 36 0 0 cm /X Do', {
				Type: 'XObject',
				Subtype: 'Form',
				BBox: [0, 0, 100, 100],
				Matrix: [1.5, 0, 0, 1.5, 0, 0],
				Resources: { XObject: { X: image } }
			})
		);
		page.node.setXObject(N('Fm0'), form);
		// 72pt × 1.5 × 2 = 216pt = 3インチ、36pt × 1.5 × 2 = 108pt = 1.5インチ
		expect(collectImagePlacements(doc)!.get(image)).toEqual({ widthIn: 3, heightIn: 1.5 });
	});

	it('自分自身を描くFormでも無限に再帰しない', async () => {
		const { doc, page } = await setup('/Fm0 Do');
		const formRef = doc.context.nextRef();
		doc.context.assign(
			formRef,
			doc.context.flateStream('/Fm0 Do', {
				Subtype: 'Form',
				BBox: [0, 0, 1, 1],
				Resources: { XObject: { Fm0: formRef } }
			})
		);
		page.node.setXObject(N('Fm0'), formRef as PDFRef);
		expect(collectImagePlacements(doc)!.size).toBe(0);
	});

	it('注釈の外観ストリームはBBoxをRectに合わせた大きさで記録する', async () => {
		const { doc, page, image } = await setup('');
		const ap = doc.context.register(
			doc.context.flateStream('100 0 0 100 0 0 cm /X Do', {
				Subtype: 'Form',
				BBox: [0, 0, 100, 100],
				Resources: { XObject: { X: image } }
			})
		);
		// 100×100 の外観を 144×72pt の Rect に配置 → 2インチ × 1インチ
		const annot = doc.context.obj({
			Type: 'Annot',
			Subtype: 'Stamp',
			Rect: [10, 10, 154, 82],
			AP: { N: ap }
		});
		page.node.set(N('Annots'), doc.context.obj([doc.context.register(annot)]));
		expect(collectImagePlacements(doc)!.get(image)).toEqual({ widthIn: 2, heightIn: 1 });
	});

	it('/UserUnit を描画サイズに反映する', async () => {
		const { doc, page, image } = await setup('72 0 0 72 0 0 cm /Im0 Do');
		page.node.set(N('UserUnit'), doc.context.obj(2));
		expect(collectImagePlacements(doc)!.get(image)).toEqual({ widthIn: 2, heightIn: 2 });
	});

	it('タイリングパターン内の画像は縮小対象外（無限大）として記録する', async () => {
		const { doc, image } = await setup('');
		doc.context.register(
			doc.context.flateStream('/P Do', {
				Type: 'Pattern',
				PatternType: 1,
				Resources: { XObject: { P: image } }
			})
		);
		expect(collectImagePlacements(doc)!.get(image)).toEqual({
			widthIn: Infinity,
			heightIn: Infinity
		});
	});

	it('Doの回数が上限を超えたら null を返す', async () => {
		const { doc } = await setup('/Im0 Do '.repeat(MAX_DO_OPERATIONS + 1));
		expect(collectImagePlacements(doc)).toBeNull();
	});
});

import { describe, it, expect } from 'vitest';
import { PDFDocument, PDFRawStream } from 'pdf-lib';
import {
	readPredictor,
	componentsOf,
	computeTargetSize,
	countColorsUpTo,
	fromRgba,
	reversePngPredictor,
	toRgba
} from './image-recompress';

describe('computeTargetSize', () => {
	it('どちらの軸も上限を下回らない範囲で、縦横比を保って縮小する', () => {
		// 3000×2000pxを幅10インチ×高さ5インチに描く → 横300ppi・縦400ppi。横を150ppiにすると縦は200ppi
		expect(computeTargetSize(3000, 2000, { widthIn: 10, heightIn: 5 }, 150)).toEqual({
			width: 1500,
			height: 1000
		});
	});

	it('上限以下・上限なしの場合は縮小しない', () => {
		expect(computeTargetSize(1000, 800, { widthIn: 8, heightIn: 6.4 }, 150)).toBeNull();
		expect(computeTargetSize(9000, 9000, { widthIn: 1, heightIn: 1 }, null)).toBeNull();
	});
});

describe('componentsOf', () => {
	it('DeviceRGB/DeviceGrayと成分数3/1のICCBasedを対象にし、CMYKは対象外', async () => {
		const doc = await PDFDocument.create();
		const icc = (n: number) =>
			doc.context.register(PDFRawStream.of(doc.context.obj({ N: n }), new Uint8Array()));
		const cs = (colorSpace: Parameters<typeof doc.context.obj>[0]) =>
			componentsOf(doc.context.obj({ ColorSpace: colorSpace }));
		expect(cs('DeviceRGB')).toBe(3);
		expect(cs('DeviceGray')).toBe(1);
		expect(cs(['ICCBased', icc(3)])).toBe(3);
		expect(cs(['ICCBased', icc(1)])).toBe(1);
		expect(cs(['ICCBased', icc(4)])).toBeNull();
		expect(cs('DeviceCMYK')).toBeNull();
	});
});

describe('countColorsUpTo', () => {
	it('色数を数え、上限を超えたら打ち切る', () => {
		const rgba = new Uint8ClampedArray([255, 0, 0, 255, 255, 0, 0, 255, 0, 0, 255, 255]);
		expect(countColorsUpTo(rgba, 10)).toBe(2);
		expect(countColorsUpTo(rgba, 1)).toBe(2);
	});
});

describe('reversePngPredictor', () => {
	it('RGB画像の行バイト数（画素数×3）で Sub/Up フィルタを復元する', () => {
		// 2px×2行のRGB。1行目: Sub、2行目: Up
		const encoded = new Uint8Array([
			1,
			10,
			20,
			30,
			5,
			5,
			5, // 元: 10,20,30, 15,25,35
			2,
			1,
			1,
			1,
			1,
			1,
			1 // 元: 11,21,31, 16,26,36
		]);
		expect(Array.from(reversePngPredictor(encoded, 6, 3))).toEqual([
			10, 20, 30, 15, 25, 35, 11, 21, 31, 16, 26, 36
		]);
	});
});

describe('toRgba / fromRgba', () => {
	it('RGB・Grayとも往復で元に戻る', () => {
		const rgb = new Uint8Array([1, 2, 3, 4, 5, 6]);
		expect(fromRgba(toRgba(rgb, 3, 2), 3)).toEqual(rgb);
		const gray = new Uint8Array([7, 8]);
		expect(fromRgba(toRgba(gray, 1, 2), 1)).toEqual(gray);
	});
});

type Parms = Record<string, number> | (Record<string, number> | null)[];

describe('readPredictor', () => {
	async function stream(decodeParms?: Parms) {
		const doc = await PDFDocument.create();
		const dict = doc.context.obj(
			decodeParms === undefined
				? { Filter: ['FlateDecode'] }
				: { Filter: ['FlateDecode'], DecodeParms: decodeParms }
		);
		return PDFRawStream.of(dict, new Uint8Array());
	}

	it('DecodeParmsが単一要素の配列でもPNG予測子を読む', async () => {
		const s = await stream([{ Predictor: 15, Colors: 3, Columns: 10 }]);
		expect(readPredictor(s, 10, 3)).toBe(15);
	});

	it('指定なし・nullなら予測子なし', async () => {
		expect(readPredictor(await stream(undefined), 10, 3)).toBe(1);
		expect(readPredictor(await stream([null]), 10, 3)).toBe(1);
	});

	it('Colors/Columnsが画像と一致しない・TIFF予測子なら対象外', async () => {
		expect(readPredictor(await stream({ Predictor: 15, Colors: 3, Columns: 9 }), 10, 3)).toBeNull();
		expect(readPredictor(await stream({ Predictor: 15, Columns: 10 }), 10, 3)).toBeNull();
		expect(readPredictor(await stream({ Predictor: 2, Colors: 3, Columns: 10 }), 10, 3)).toBeNull();
	});
});

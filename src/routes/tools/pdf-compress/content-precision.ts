/**
 * 描画命令のパス座標を、紙面上の誤差が許容値以内に収まる桁数に丸めて容量を減らす（非可逆だが見た目は変わらない程度）
 *
 * 対象はパス構築の演算子（m l c v y re）のオペランドだけ。cm（行列）・色・文字位置などは触らない。
 * 残す桁数は、その時点の変換行列の拡大率から決める（拡大されるほど多く残す）。
 * Form XObject は、すべての配置のうち最大の拡大率を基準にし、拡大率を追えないものは対象外にする。
 */
import {
	PDFArray,
	PDFDocument,
	PDFName,
	PDFNumber,
	PDFRawStream,
	PDFRef,
	decodePDFRawStream
} from 'pdf-lib';
import { collectPlacements, multiply, scanContent, scaleOf, type Matrix } from './image-placement';

const N = (name: string) => PDFName.of(name);
const PATH_OPERATORS = new Set(['m', 'l', 'c', 'v', 'y', 're']);
/** 紙面上の許容誤差（pt）。0.01pt ≒ 0.0035mm */
export const DEFAULT_TOLERANCE_PT = 0.01;
const MAX_DIGITS = 6;

/** 拡大率 scale のもとで、丸め誤差（最大 0.5×10^-k）が tolerance 以内に収まる最小の小数桁数 k */
export function digitsFor(scale: number, tolerance: number): number {
	if (!(scale > 0)) return MAX_DIGITS;
	const k = Math.ceil(Math.log10((0.5 * scale) / tolerance));
	return Math.min(MAX_DIGITS, Math.max(0, k));
}

/** 数値を k 桁に丸めて最短の表記にする（末尾の0と先頭の0を省く。PDFでは ".5" も有効） */
export function formatNumber(value: number, digits: number): string {
	let text = value.toFixed(digits);
	if (text.includes('.')) text = text.replace(/0+$/, '').replace(/\.$/, '');
	if (text === '-0') text = '0';
	return text.replace(/^(-?)0\./, '$1.');
}

type State = { ctm: Matrix; stack: Matrix[] };

/**
 * 1つの描画命令を丸めた新しいバイト列を返す（変化がなければ bytes は null）。state は複数のストリームにまたがって引き継ぐ。
 * dangling は、末尾に演算子のないオペランドが残ったか（次のストリームで演算子が来るため、それ以降の状態は追えない）
 */
export function roundContent(
	bytes: Uint8Array,
	state: State,
	tolerance: number
): { bytes: Uint8Array | null; dangling: boolean } {
	const edits: { start: number; end: number; text: string }[] = [];
	const leftover = scanContent(bytes, (op, operands, spans) => {
		if (op === 'q') state.stack.push(state.ctm);
		else if (op === 'Q') state.ctm = state.stack.pop() ?? state.ctm;
		else if (op === 'cm') {
			const m = operands.slice(-6);
			if (m.length === 6 && m.every((v) => typeof v === 'number'))
				state.ctm = multiply(m as Matrix, state.ctm);
		} else if (PATH_OPERATORS.has(op)) {
			const digits = digitsFor(scaleOf(state.ctm), tolerance);
			operands.forEach((v, i) => {
				// 極端に大きな値は toFixed が指数表記になり PDF の数値として不正になるため触らない
				if (typeof v !== 'number' || !(Math.abs(v) < 1e15)) return;
				const [start, end] = spans[i];
				const text = formatNumber(v, digits);
				if (text.length < end - start) edits.push({ start, end, text });
			});
		}
	});
	const dangling = leftover > 0;
	if (edits.length === 0) return { bytes: null, dangling };

	const encoder = new TextEncoder();
	const parts: Uint8Array[] = [];
	let cursor = 0;
	for (const e of edits) {
		parts.push(bytes.subarray(cursor, e.start), encoder.encode(e.text));
		cursor = e.end;
	}
	parts.push(bytes.subarray(cursor));
	const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
	let offset = 0;
	for (const p of parts) {
		out.set(p, offset);
		offset += p.length;
	}
	return { bytes: out, dangling };
}

function decode(stream: PDFRawStream): Uint8Array {
	return (decodePDFRawStream(stream) as { decode(): Uint8Array }).decode();
}

/** ページと Form XObject の描画命令を丸め、書き換えたストリーム数を返す */
export function roundCoordinates(doc: PDFDocument, tolerance = DEFAULT_TOLERANCE_PT): number {
	const { context } = doc;
	const placements = collectPlacements(doc);
	if (!placements) return 0; // 走査量の上限を超えた文書は拡大率が分からないため触らない

	const replace = (ref: PDFRef, stream: PDFRawStream, bytes: Uint8Array) => {
		const dict = stream.dict.clone(context);
		dict.delete(N('Filter'));
		dict.delete(N('DecodeParms'));
		dict.set(N('Length'), PDFNumber.of(bytes.length));
		// 圧縮は後段の recompressStreams で行う
		context.assign(ref, PDFRawStream.of(dict, bytes));
	};

	// 複数のページ・Formで共有されるストリームは、描かれ方が1通りに決まらないため対象外
	const useCount = new Map<PDFRef, number>();
	const pageStreams = doc.getPages().map((page) => {
		const contents = page.node.get(N('Contents'));
		const resolved = context.lookup(contents);
		const refs = resolved instanceof PDFArray ? resolved.asArray() : [contents];
		return {
			userUnit: page.node.lookupMaybe(N('UserUnit'), PDFNumber)?.asNumber() ?? 1,
			refs: refs.filter((r): r is PDFRef => r instanceof PDFRef)
		};
	});
	for (const { refs } of pageStreams)
		for (const r of refs) useCount.set(r, (useCount.get(r) ?? 0) + 1);
	for (const r of placements.forms.keys()) useCount.set(r, (useCount.get(r) ?? 0) + 1);

	let count = 0;
	for (const { userUnit, refs } of pageStreams) {
		// ページの Contents は連結して1つの描画命令になるため、q/cm の状態を次のストリームへ引き継ぐ
		const state: State = { ctm: [userUnit, 0, 0, userUnit, 0, 0], stack: [] };
		for (const ref of refs) {
			const stream = context.lookup(ref);
			if (!(stream instanceof PDFRawStream) || useCount.get(ref) !== 1) break;
			let bytes: Uint8Array;
			try {
				bytes = decode(stream);
			} catch {
				break; // 以降のストリームは状態が分からないため触らない
			}
			const rounded = roundContent(bytes, state, tolerance);
			if (rounded.bytes) {
				replace(ref, stream, rounded.bytes);
				count++;
			}
			if (rounded.dangling) break; // 演算子の途中で分割されている
		}
	}

	for (const [ref, scale] of placements.forms) {
		const stream = context.lookup(ref);
		if (!Number.isFinite(scale) || useCount.get(ref) !== 1 || !(stream instanceof PDFRawStream))
			continue;
		let bytes: Uint8Array;
		try {
			bytes = decode(stream);
		} catch {
			continue;
		}
		const rounded = roundContent(bytes, { ctm: [scale, 0, 0, scale, 0, 0], stack: [] }, tolerance);
		if (rounded.bytes) {
			replace(ref, stream, rounded.bytes);
			count++;
		}
	}
	return count;
}

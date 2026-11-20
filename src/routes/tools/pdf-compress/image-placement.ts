/**
 * ページの描画命令を読み、画像XObjectが紙面に描かれる大きさ（インチ）を求める
 * q/Q/cm で変換行列（CTM）を追い、Do で画像を描く時点の単位正方形の大きさを測る。
 * Form XObject は /Matrix を掛けて再帰的にたどり、注釈の外観（/AP /N）は /Rect に合わせて配置する。
 * 画像の /SMask にも親と同じ配置を記録する。パターン・Type3フォント内の画像は大きさを追わず、縮小対象から外す
 */
import {
	PDFArray,
	PDFDict,
	PDFDocument,
	PDFName,
	PDFNumber,
	PDFObject,
	PDFRawStream,
	PDFRef,
	decodePDFRawStream
} from 'pdf-lib';

/** [a b c d e f]（PDFの変換行列） */
export type Matrix = [number, number, number, number, number, number];

/** 画像が最も大きく描かれた幅・高さ（インチ、軸ごとの最大値） */
export type Placement = { widthIn: number; heightIn: number };

const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];
const MAX_FORM_DEPTH = 12;
const N = (name: string) => PDFName.of(name);

/** m × n（PDFの行列は行ベクトル規約。cm では CTM' = M × CTM） */
export function multiply(m: Matrix, n: Matrix): Matrix {
	return [
		m[0] * n[0] + m[1] * n[2],
		m[0] * n[1] + m[1] * n[3],
		m[2] * n[0] + m[3] * n[2],
		m[2] * n[1] + m[3] * n[3],
		m[4] * n[0] + m[5] * n[2] + n[4],
		m[4] * n[1] + m[5] * n[3] + n[5]
	];
}

/** 数値・名前・文字列（復号済みのバイト列）。配列・辞書の区切りや真偽値は null */
export type Operand = number | { name: string } | { bytes: Uint8Array } | null;

/** リテラル文字列 (...) の中身を復号する（エスケープ・8進数・行継続に対応） */
function decodeLiteral(raw: Uint8Array): Uint8Array {
	const out: number[] = [];
	for (let i = 0; i < raw.length; i++) {
		const c = raw[i];
		if (c === 13) {
			// エスケープされていない CR・CRLF は LF 1バイトとして扱う（PDF仕様）
			if (raw[i + 1] === 10) i++;
			out.push(10);
			continue;
		}
		if (c !== 0x5c) {
			out.push(c);
			continue;
		}
		const n = raw[++i];
		const simple: Record<number, number> = {
			0x6e: 10, // n
			0x72: 13, // r
			0x74: 9, // t
			0x62: 8, // b
			0x66: 12 // f
		};
		if (n in simple) out.push(simple[n]);
		else if (n >= 0x30 && n <= 0x37) {
			let v = n - 0x30;
			for (let k = 0; k < 2 && raw[i + 1] >= 0x30 && raw[i + 1] <= 0x37; k++)
				v = v * 8 + (raw[++i] - 0x30);
			out.push(v & 0xff);
		} else if (n === 13) {
			if (raw[i + 1] === 10) i++; // 行継続（\ + CRLF）
		} else if (n !== 10 && n !== undefined) out.push(n); // \( \) \\ など。\ + LF は行継続
	}
	return new Uint8Array(out);
}

/** 16進文字列 <...> の中身を復号する（空白は無視、奇数桁は末尾に0を補う） */
function decodeHex(raw: Uint8Array): Uint8Array {
	const digits = LATIN1.decode(raw).replace(/[^0-9a-fA-F]/g, '');
	const padded = digits.length % 2 ? digits + '0' : digits;
	const out = new Uint8Array(padded.length / 2);
	for (let k = 0; k < out.length; k++) out[k] = parseInt(padded.substr(k * 2, 2), 16);
	return out;
}

const WHITESPACE = new Set([0, 9, 10, 12, 13, 32]);
const DELIMITERS = new Set([...'()<>[]{}/%'].map((c) => c.charCodeAt(0)));
const LATIN1 = new TextDecoder('latin1');
const NUMBER_RE = /^[+-]?(\d+\.?\d*|\.\d+)$/;

/**
 * 描画命令を字句解析し、演算子ごとに onOp を呼ぶ
 * 文字列・配列・辞書の中身は演算に使わないため null として扱う。インライン画像（BI〜EI）のバイナリは読み飛ばす
 */
export function scanContent(
	bytes: Uint8Array,
	onOp: (op: string, operands: Operand[], spans: [number, number][]) => void
): number {
	let i = 0;
	let operands: Operand[] = [];
	/** 各オペランドの元データ上の位置 [開始, 終了)（座標の丸めで書き換えるため） */
	let spans: [number, number][] = [];
	const push = (operand: Operand, start: number, end: number) => {
		operands.push(operand);
		spans.push([start, end]);
	};
	const len = bytes.length;
	const readRegular = () => {
		const start = i;
		while (i < len && !WHITESPACE.has(bytes[i]) && !DELIMITERS.has(bytes[i])) i++;
		// 引数展開だと巨大なトークン（破損ストリーム等）で RangeError になるため TextDecoder を使う
		return LATIN1.decode(bytes.subarray(start, i));
	};

	while (i < len) {
		const b = bytes[i];
		if (WHITESPACE.has(b)) {
			i++;
		} else if (b === 0x25 /* % */) {
			while (i < len && bytes[i] !== 10 && bytes[i] !== 13) i++;
		} else if (b === 0x28 /* ( */) {
			const start = i + 1;
			let depth = 0;
			for (; i < len; i++) {
				if (bytes[i] === 0x5c /* \ */) i++;
				else if (bytes[i] === 0x28) depth++;
				else if (bytes[i] === 0x29 && --depth === 0) break;
			}
			push({ bytes: decodeLiteral(bytes.subarray(start, Math.min(i, len))) }, start - 1, i + 1);
			i++;
		} else if (b === 0x3c /* < */) {
			if (bytes[i + 1] === 0x3c) i += 2;
			else {
				const start = i + 1;
				while (i < len && bytes[i] !== 0x3e) i++;
				push({ bytes: decodeHex(bytes.subarray(start, i)) }, start - 1, i + 1);
				i++;
			}
		} else if (b === 0x3e /* > */ || b === 0x5b || b === 0x5d || b === 0x7b || b === 0x7d) {
			i++;
		} else if (b === 0x2f /* / */) {
			i++;
			// 名前の #xx エスケープは、照合時の PDFName.of が復号するため生のまま返す
			const start = i - 1;
			push({ name: readRegular() }, start, i);
		} else {
			const start = i;
			const token = readRegular();
			if (token === '') {
				i++; // 想定外の区切り文字
			} else if (NUMBER_RE.test(token)) {
				push(Number(token), start, i);
			} else if (token === 'true' || token === 'false' || token === 'null') {
				push(null, start, i);
			} else if (token === 'ID') {
				// インライン画像のデータ: 空白 + "EI" + 空白（または末尾）まで読み飛ばす
				i++;
				while (
					i < len &&
					!(
						WHITESPACE.has(bytes[i - 1]) &&
						bytes[i] === 0x45 &&
						bytes[i + 1] === 0x49 &&
						(i + 2 >= len || WHITESPACE.has(bytes[i + 2]))
					)
				)
					i++;
				i += 2;
				operands = [];
				spans = [];
			} else {
				onOp(token, operands, spans);
				operands = [];
				spans = [];
			}
		}
	}
	// 演算子に使われずに残ったオペランドの数（Contents が演算子の途中で分割されているかの判定用）
	return operands.length;
}

function decodeStream(stream: PDFRawStream): Uint8Array {
	return (decodePDFRawStream(stream) as { decode(): Uint8Array }).decode();
}

function readMatrix(dict: PDFDict): Matrix {
	const arr = dict.lookup(N('Matrix'));
	if (!(arr instanceof PDFArray) || arr.size() !== 6) return IDENTITY;
	const nums = arr.asArray().map((v) => (v instanceof PDFNumber ? v.asNumber() : NaN));
	return nums.some(isNaN) ? IDENTITY : (nums as Matrix);
}

/** 描画命令の走査量の上限（同じFormを大量に呼ぶ文書でUIが固まるのを防ぐ） */
export const MAX_DO_OPERATIONS = 200_000;

class BudgetExceeded extends Error {}

/** 縮小してはいけない画像（パターン・Type3フォント内など、描画サイズを追えない場所で使われる） */
const UNBOUNDED: Placement = { widthIn: Infinity, heightIn: Infinity };

/** 変換後のBBoxを注釈のRectに合わせる行列（PDF仕様の外観ストリームの配置手順） */
function appearanceMatrix(bbox: number[], matrix: Matrix, rect: number[]): Matrix | null {
	const corners = [
		[bbox[0], bbox[1]],
		[bbox[2], bbox[1]],
		[bbox[0], bbox[3]],
		[bbox[2], bbox[3]]
	].map(([x, y]) => [
		x * matrix[0] + y * matrix[2] + matrix[4],
		x * matrix[1] + y * matrix[3] + matrix[5]
	]);
	const xs = corners.map((c) => c[0]);
	const ys = corners.map((c) => c[1]);
	const w = Math.max(...xs) - Math.min(...xs);
	const h = Math.max(...ys) - Math.min(...ys);
	if (!(w > 0) || !(h > 0)) return null;
	const sx = Math.abs(rect[2] - rect[0]) / w;
	const sy = Math.abs(rect[3] - rect[1]) / h;
	return [
		sx,
		0,
		0,
		sy,
		Math.min(rect[0], rect[2]) - Math.min(...xs) * sx,
		Math.min(rect[1], rect[3]) - Math.min(...ys) * sy
	];
}

function numbers(arr: PDFObject | undefined, count: number): number[] | null {
	if (!(arr instanceof PDFArray) || arr.size() !== count) return null;
	const nums = arr.asArray().map((v) => (v instanceof PDFNumber ? v.asNumber() : NaN));
	return nums.some(isNaN) ? null : nums;
}

/**
 * 文書内の全ページ（注釈の外観を含む）を走査し、画像XObjectの参照ごとに最大の描画サイズを返す
 * 走査量が上限を超えた場合は null（呼び出し側は配置不明として扱う）
 */
export function collectImagePlacements(doc: PDFDocument): Map<PDFRef, Placement> | null {
	return collectPlacements(doc)?.images ?? null;
}

/** 変換行列の拡大率（2つの軸のうち大きいほう） */
export function scaleOf(m: Matrix): number {
	return Math.max(Math.hypot(m[0], m[1]), Math.hypot(m[2], m[3]));
}

/**
 * 画像の描画サイズに加え、Form XObject ごとの最大の拡大率（ページの基準座標に対する倍率）も集める
 * 拡大率を追えない Form（パターン・Type3 内、入れ子の深さ超過）は Infinity
 */
export function collectPlacements(
	doc: PDFDocument
): { images: Map<PDFRef, Placement>; forms: Map<PDFRef, number> } | null {
	const placements = new Map<PDFRef, Placement>();
	const forms = new Map<PDFRef, number>();
	const recordForm = (ref: PDFRef, scale: number) =>
		forms.set(ref, Math.max(forms.get(ref) ?? 0, scale));
	const formCache = new Map<PDFRef, Uint8Array | null>();
	let doCount = 0;

	const record = (ref: PDFRef, size: Placement) => {
		const prev = placements.get(ref);
		placements.set(ref, {
			widthIn: Math.max(prev?.widthIn ?? 0, size.widthIn),
			heightIn: Math.max(prev?.heightIn ?? 0, size.heightIn)
		});
	};
	const recordImage = (ref: PDFRef, image: PDFRawStream, size: Placement) => {
		record(ref, size);
		// 透明度マスクは親画像と同じ位置に描かれる
		const smask = image.dict.get(N('SMask'));
		if (smask instanceof PDFRef) record(smask, size);
	};
	const formContents = (ref: PDFRef, form: PDFRawStream) => {
		if (!formCache.has(ref)) {
			try {
				formCache.set(ref, decodeStream(form));
			} catch {
				formCache.set(ref, null);
			}
		}
		return formCache.get(ref)!;
	};

	const drawForm = (
		ref: PDFRef,
		form: PDFRawStream,
		ctm: Matrix,
		inherited: PDFDict | undefined,
		formStack: PDFRef[]
	) => {
		if (formStack.includes(ref)) return;
		if (formStack.length >= MAX_FORM_DEPTH) {
			recordForm(ref, Infinity);
			return;
		}
		const formCtm = multiply(readMatrix(form.dict), ctm);
		recordForm(ref, scaleOf(formCtm));
		const contents = formContents(ref, form);
		if (!contents) return;
		const resources = form.dict.lookupMaybe(N('Resources'), PDFDict) ?? inherited;
		run(contents, resources, formCtm, [...formStack, ref]);
	};

	const run = (
		contents: Uint8Array,
		resources: PDFDict | undefined,
		baseCtm: Matrix,
		formStack: PDFRef[]
	) => {
		let ctm = baseCtm;
		const stack: Matrix[] = [];
		scanContent(contents, (op, operands) => {
			if (op === 'q') stack.push(ctm);
			else if (op === 'Q') ctm = stack.pop() ?? ctm;
			else if (op === 'cm') {
				const m = operands.slice(-6);
				if (m.length === 6 && m.every((v) => typeof v === 'number'))
					ctm = multiply(m as Matrix, ctm);
			} else if (op === 'Do') {
				if (++doCount > MAX_DO_OPERATIONS) throw new BudgetExceeded();
				const name = operands[operands.length - 1];
				if (!name || typeof name !== 'object' || !('name' in name) || !resources) return;
				const xobjects = resources.lookupMaybe(N('XObject'), PDFDict);
				const ref = xobjects?.get(N(name.name));
				if (!(ref instanceof PDFRef)) return;
				const xobj = doc.context.lookup(ref);
				if (!(xobj instanceof PDFRawStream)) return;
				const subtype = xobj.dict.lookup(N('Subtype'));
				if (subtype === N('Image')) {
					recordImage(ref, xobj, {
						widthIn: Math.hypot(ctm[0], ctm[1]) / 72,
						heightIn: Math.hypot(ctm[2], ctm[3]) / 72
					});
				} else if (subtype === N('Form')) {
					drawForm(ref, xobj, ctm, resources, formStack);
				}
			}
		});
	};

	/** パターン・Type3フォントのリソース内の画像は縮小対象から外す */
	const markUnbounded = (resources: PDFDict | undefined, visited: Set<PDFRef>) => {
		const xobjects = resources?.lookupMaybe(N('XObject'), PDFDict);
		for (const [, ref] of xobjects?.entries() ?? []) {
			if (!(ref instanceof PDFRef) || visited.has(ref)) continue;
			visited.add(ref);
			const xobj = doc.context.lookup(ref);
			if (!(xobj instanceof PDFRawStream)) continue;
			const subtype = xobj.dict.lookup(N('Subtype'));
			if (subtype === N('Image')) recordImage(ref, xobj, UNBOUNDED);
			else if (subtype === N('Form')) {
				recordForm(ref, Infinity);
				markUnbounded(xobj.dict.lookupMaybe(N('Resources'), PDFDict), visited);
			}
		}
	};

	try {
		for (const page of doc.getPages()) {
			const userUnit = page.node.lookupMaybe(N('UserUnit'), PDFNumber)?.asNumber() ?? 1;
			const base: Matrix = [userUnit, 0, 0, userUnit, 0, 0];

			const contents = page.node.Contents();
			const streams =
				contents instanceof PDFArray
					? contents.asArray().map((r) => doc.context.lookup(r))
					: [contents];
			// 複数のContentsストリームは連結して1つの描画命令として解釈する（間に空白を挟む）
			const parts: Uint8Array[] = [];
			for (const s of streams) {
				if (!(s instanceof PDFRawStream)) continue;
				try {
					parts.push(decodeStream(s), new Uint8Array([10]));
				} catch {
					// 復号できないストリームは読み飛ばす
				}
			}
			const joined = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
			let offset = 0;
			for (const p of parts) {
				joined.set(p, offset);
				offset += p.length;
			}
			run(joined, page.node.Resources(), base, []);

			// 注釈の通常の外観（/AP /N）。状態ごとの辞書なら全状態をたどる
			for (const annot of page.node.Annots()?.asArray() ?? []) {
				const dict = doc.context.lookup(annot);
				if (!(dict instanceof PDFDict)) continue;
				const rect = numbers(dict.lookup(N('Rect')), 4);
				const normal = dict.lookupMaybe(N('AP'), PDFDict)?.get(N('N'));
				if (!rect || !normal) continue;
				const target = doc.context.lookup(normal);
				const refs =
					target instanceof PDFDict && !(target instanceof PDFRawStream)
						? target.entries().map(([, v]) => v)
						: [normal];
				for (const ref of refs) {
					const form = doc.context.lookup(ref);
					if (!(ref instanceof PDFRef) || !(form instanceof PDFRawStream)) continue;
					const bbox = numbers(form.dict.lookup(N('BBox')), 4);
					const toRect = bbox && appearanceMatrix(bbox, readMatrix(form.dict), rect);
					if (!toRect) continue;
					// drawForm が /Matrix を掛けるため、ここでは Rect への配置だけを渡す
					drawForm(ref, form, multiply(toRect, base), undefined, []);
				}
			}
		}
	} catch (e) {
		if (e instanceof BudgetExceeded) return null;
		throw e;
	}

	// 直接オブジェクトの中（ページのリソースに埋め込まれた Type3 フォントなど）までたどる
	const visited = new Set<PDFRef>();
	const scanUnbounded = (obj: PDFObject) => {
		const dict = obj instanceof PDFRawStream ? obj.dict : obj;
		if (dict instanceof PDFDict) {
			const patternType = dict.lookup(N('PatternType'));
			const isTilingPattern = patternType instanceof PDFNumber && patternType.asNumber() === 1;
			const isType3 = dict.lookup(N('Subtype')) === N('Type3');
			if (isTilingPattern || isType3) {
				const resources = dict.lookup(N('Resources'));
				if (resources instanceof PDFDict) markUnbounded(resources, visited);
			}
			// ExtGState のソフトマスク（/SMask の /G）は gs で使われ、描画サイズを追っていない
			const smask = dict.lookup(N('SMask'));
			const group = smask instanceof PDFDict ? smask.get(N('G')) : undefined;
			if (group instanceof PDFRef) {
				recordForm(group, Infinity);
				const form = doc.context.lookup(group);
				const resources =
					form instanceof PDFRawStream ? form.dict.lookup(N('Resources')) : undefined;
				if (resources instanceof PDFDict) markUnbounded(resources, visited);
			}
			for (const [, v] of dict.entries()) if (!(v instanceof PDFRef)) scanUnbounded(v);
		} else if (dict instanceof PDFArray) {
			for (const v of dict.asArray()) if (!(v instanceof PDFRef)) scanUnbounded(v);
		}
	};
	for (const [, obj] of doc.context.enumerateIndirectObjects()) scanUnbounded(obj);
	return { images: placements, forms };
}

/**
 * まるごと埋め込まれたフォントを、実際に使われている字形だけに減らす（サブセット化）
 *
 * 対象: Type0（/Identity-H・/Identity-V）+ CIDFontType2（TrueType, /FontFile2）で、名前にサブセットの接頭辞がないもの。
 * 字形番号（GID）を保ったまま（HarfBuzz の RETAIN_GIDS）削るため、描画命令の文字列は書き換えない。
 *
 * 使用字形は、ページ・Form XObject・注釈の外観・タイリングパターン・Type3フォントの描画命令から集める。
 * 走査しなかったリソース辞書（フォーム入力欄の既定リソース /DR など）から参照されるフォントは、
 * 後から別の文字が描かれうるため対象外にする。
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
	PDFStream,
	decodePDFRawStream
} from 'pdf-lib';
import { scanContent } from './image-placement';
import { CID_UNUSED_TABLES } from './hb-subset';

const N = (name: string) => PDFName.of(name);
const SUBSET_TAG = /^[A-Z]{6}\+/;

/** HarfBuzz のサブセット化（WASM）の最小インターフェース */
export type Subsetter = (
	font: Uint8Array,
	glyphIds: Iterable<number> | 'all',
	options?: { dropTables?: string[]; noHinting?: boolean }
) => Uint8Array | null;

/** サブセット化の候補（同じフォントファイルを共有する Type0 フォントはまとめる） */
type Candidate = {
	fontFileRef: PDFRef;
	type0Fonts: PDFDict[];
	cidFont: PDFDict;
	descriptor: PDFDict;
	/** CID→GID の対応。null なら Identity（CID = GID） */
	cidToGid: Uint8Array | null;
	glyphs: Set<number>;
};

function decode(stream: PDFRawStream): Uint8Array {
	return (decodePDFRawStream(stream) as { decode(): Uint8Array }).decode();
}

/** Type0 + Identity エンコーディング + CIDFontType2 + FontFile2 で、まだサブセットでないフォントか */
function asCandidate(
	doc: PDFDocument,
	type0: PDFDict
): Omit<Candidate, 'type0Fonts' | 'glyphs'> | null {
	if (type0.lookup(N('Subtype')) !== N('Type0')) return null;
	const encoding = type0.lookup(N('Encoding'));
	if (encoding !== N('Identity-H') && encoding !== N('Identity-V')) return null;
	const descendants = doc.context.lookup(type0.get(N('DescendantFonts')));
	const cidFont = descendants instanceof PDFArray ? descendants.lookup(0) : undefined;
	if (!(cidFont instanceof PDFDict) || cidFont.lookup(N('Subtype')) !== N('CIDFontType2'))
		return null;
	const descriptor = dictOf(cidFont, 'FontDescriptor');
	const fontFileRef = descriptor?.get(N('FontFile2'));
	if (!descriptor || !(fontFileRef instanceof PDFRef)) return null;
	if (!(doc.context.lookup(fontFileRef) instanceof PDFRawStream)) return null;
	const fontName = descriptor.lookup(N('FontName'));
	if (fontName instanceof PDFName && SUBSET_TAG.test(fontName.decodeText())) return null;

	const map = cidFont.lookup(N('CIDToGIDMap'));
	let cidToGid: Uint8Array | null = null;
	if (map instanceof PDFRawStream) {
		try {
			cidToGid = decode(map);
		} catch {
			return null;
		}
	} else if (map !== undefined && map !== N('Identity')) return null;
	return { fontFileRef, cidFont, descriptor, cidToGid };
}

/** key の値を辞書として取得する（型が違っても例外にしない） */
function dictOf(dict: PDFDict | undefined, key: string): PDFDict | undefined {
	const value = dict ? dict.context.lookup(dict.get(N(key))) : undefined;
	return value instanceof PDFDict && !(value instanceof PDFStream) ? value : undefined;
}

function sameMap(a: Uint8Array | null, b: Uint8Array | null): boolean {
	if (a === null || b === null) return a === b;
	return a.length === b.length && a.every((v, i) => v === b[i]);
}

/** Identity エンコーディングの文字列（2バイトのCID列）から GID を集める */
export function addGlyphs(glyphs: Set<number>, text: Uint8Array, cidToGid: Uint8Array | null) {
	for (let i = 0; i + 1 < text.length; i += 2) {
		const cid = (text[i] << 8) | text[i + 1];
		if (!cidToGid) glyphs.add(cid);
		else if (cid * 2 + 1 < cidToGid.length)
			glyphs.add((cidToGid[cid * 2] << 8) | cidToGid[cid * 2 + 1]);
	}
}

/** 6文字の大文字のサブセット接頭辞（内容から決まるので同じ入力なら同じ名前になる） */
function subsetTag(seed: Uint8Array): string {
	let h = 2166136261;
	for (let i = 0; i < seed.length; i += 97) h = Math.imul(h ^ seed[i], 16777619);
	let tag = '';
	for (let k = 0; k < 6; k++) {
		tag += String.fromCharCode(65 + ((h >>> 0) % 26));
		h = Math.imul(h ^ (k + 1), 16777619);
	}
	return tag;
}

function withTag(dict: PDFDict, key: string, tag: string) {
	const name = dict.lookup(N(key));
	if (name instanceof PDFName && !SUBSET_TAG.test(name.decodeText()))
		dict.set(N(key), N(`${tag}+${name.decodeText()}`));
}

export type FontOptions = { noHinting: boolean };

/** 文書内のすべての辞書（直接オブジェクトを含む）をたどる */
function forEachDict(doc: PDFDocument, visit: (dict: PDFDict) => void) {
	const walk = (obj: PDFObject) => {
		const dict = obj instanceof PDFStream ? obj.dict : obj;
		if (dict instanceof PDFDict) {
			visit(dict);
			for (const [, v] of dict.entries()) if (!(v instanceof PDFRef)) walk(v);
		} else if (dict instanceof PDFArray) {
			for (const v of dict.asArray()) if (!(v instanceof PDFRef)) walk(v);
		}
	};
	for (const [, obj] of doc.context.enumerateIndirectObjects()) walk(obj);
}

/**
 * CIDFontType2 だけが使う TrueType のフォントファイル（単純な TrueType フォントと共有するものは除く。
 * 単純な TrueType は cmap で文字を引くため表を削れない）
 */
function cidOnlyFontFiles(doc: PDFDocument): Set<PDFRef> {
	// CIDFontType2 のディスクリプタを先に集める（/Type の有無には依存しない）
	const cidDescriptors = new Set<PDFDict>();
	forEachDict(doc, (dict) => {
		if (dict.lookup(N('Subtype')) !== N('CIDFontType2')) return;
		const descriptor = dictOf(dict, 'FontDescriptor');
		if (descriptor) cidDescriptors.add(descriptor);
	});
	// /FontFile2 を持つ辞書のうち、CIDFontType2 のディスクリプタ以外から参照されるファイルは除く
	const cid = new Set<PDFRef>();
	const other = new Set<PDFRef>();
	forEachDict(doc, (dict) => {
		const ref = dict.get(N('FontFile2'));
		if (ref instanceof PDFRef) (cidDescriptors.has(dict) ? cid : other).add(ref);
	});
	for (const ref of other) cid.delete(ref);
	return cid;
}

/** フォント処理（WASM）が必要か：CIDFontType2 の TrueType フォントがあるか */
export function hasOptimizableFonts(doc: PDFDocument): boolean {
	return cidOnlyFontFiles(doc).size > 0;
}

function replaceFontFile(doc: PDFDocument, ref: PDFRef, stream: PDFRawStream, font: Uint8Array) {
	const dict = stream.dict.clone(doc.context);
	dict.delete(N('Filter'));
	dict.delete(N('DecodeParms'));
	dict.set(N('Length'), PDFNumber.of(font.length));
	dict.set(N('Length1'), PDFNumber.of(font.length));
	// 圧縮は後段の recompressStreams で行う
	doc.context.assign(ref, PDFRawStream.of(dict, font));
}

/**
 * CIDFontType2 のフォントファイルから、描画に使わない表（とヒンティング）を削る。字形はすべて残す
 * skip のファイル（subsetFonts で処理済み）は除く。置き換えた数を返す
 */
export function optimizeFontPrograms(
	doc: PDFDocument,
	subset: Subsetter,
	options: FontOptions,
	skip: Set<PDFRef>
): number {
	let count = 0;
	for (const ref of cidOnlyFontFiles(doc)) {
		if (skip.has(ref)) continue;
		const stream = doc.context.lookup(ref);
		if (!(stream instanceof PDFRawStream)) continue;
		let original: Uint8Array;
		try {
			original = decode(stream);
		} catch {
			continue;
		}
		const optimized = subset(original, 'all', {
			dropTables: CID_UNUSED_TABLES,
			noHinting: options.noHinting
		});
		if (!optimized || optimized.length >= original.length) continue;
		replaceFontFile(doc, ref, stream, optimized);
		count++;
	}
	return count;
}

/** 使用字形を集めてサブセット化し、置き換えたフォントファイルの参照を返す */
export function subsetFonts(
	doc: PDFDocument,
	subset: Subsetter,
	options: FontOptions
): Set<PDFRef> {
	const { context } = doc;
	const candidates = new Map<PDFRef, Candidate>(); // FontFile2 の参照ごと
	const byType0 = new Map<PDFDict, Candidate>();
	const excluded = new Set<Candidate>();
	const candidateDescriptors = new Set<PDFDict>();
	for (const [, obj] of context.enumerateIndirectObjects()) {
		if (!(obj instanceof PDFDict)) continue;
		const info = asCandidate(doc, obj);
		if (!info) continue;
		const existing = candidates.get(info.fontFileRef);
		const c = existing ?? { ...info, type0Fonts: [], glyphs: new Set<number>() };
		// 同じフォントファイルを共有していても CID→GID の対応が違えば、集めた GID が正しくならない
		if (existing && !sameMap(existing.cidToGid, info.cidToGid)) excluded.add(c);
		c.type0Fonts.push(obj);
		candidates.set(info.fontFileRef, c);
		byType0.set(obj, c);
		candidateDescriptors.add(info.descriptor);
	}
	if (candidates.size === 0) return new Set();
	// 候補外のフォント（CMap 名のエンコーディング、単純な TrueType など）と共有しているフォントファイルは、
	// その文字を集めていないため対象外（重複排除で別々のフォントが同じファイルを指すことがある）
	// ディスクリプタは直接オブジェクトのこともあるため、辞書・配列の中までたどる
	const checkShared = (obj: PDFObject) => {
		const dict = obj instanceof PDFStream ? obj.dict : obj;
		if (dict instanceof PDFDict) {
			if (!candidateDescriptors.has(dict)) {
				for (const key of ['FontFile', 'FontFile2', 'FontFile3']) {
					const ref = dict.get(N(key));
					const c = ref instanceof PDFRef ? candidates.get(ref) : undefined;
					if (c) excluded.add(c);
				}
			}
			for (const [, v] of dict.entries()) if (!(v instanceof PDFRef)) checkShared(v);
		} else if (dict instanceof PDFArray) {
			for (const v of dict.asArray()) if (!(v instanceof PDFRef)) checkShared(v);
		}
	};
	for (const [, obj] of context.enumerateIndirectObjects()) checkShared(obj);
	// 描画命令を1つでも復号できなければ、使用字形を集めきれないためサブセット化しない
	let incomplete = false;

	const scannedResources = new Set<PDFDict>();
	// 同じストリームでも、引き継ぐフォントが違えば描かれる字形が変わりうるため組で記録する
	const visited = new Set<string>();
	const ids = new Map<Candidate | undefined, number>();
	const idOf = (c: Candidate | undefined) => {
		if (!ids.has(c)) ids.set(c, ids.size);
		return ids.get(c)!;
	};
	const strings = (operands: unknown[]) =>
		operands.filter(
			(o): o is { bytes: Uint8Array } => !!o && typeof o === 'object' && 'bytes' in o
		);

	/** 描画命令を走査し、Tf で選ばれたフォントの使用字形を記録する（テキスト状態は Form にも引き継がれる） */
	const walkBytes = (
		contents: Uint8Array,
		resources: PDFDict | undefined,
		inherited: Candidate | undefined
	) => {
		if (resources) scannedResources.add(resources);
		const fonts = dictOf(resources, 'Font');
		const xobjects = dictOf(resources, 'XObject');
		let font = inherited;
		const stack: (Candidate | undefined)[] = [];

		scanContent(contents, (op, operands) => {
			if (op === 'q') stack.push(font);
			else if (op === 'Q') font = stack.pop();
			else if (op === 'Tf') {
				const name = operands[0];
				const dict =
					name && typeof name === 'object' && 'name' in name
						? fonts?.lookup(N(name.name))
						: undefined;
				font = dict instanceof PDFDict ? byType0.get(dict) : undefined;
			} else if (op === 'Tj' || op === "'" || op === '"' || op === 'TJ') {
				if (!font) return;
				// ' と " は最後の文字列、TJ は配列内のすべての文字列
				const texts = op === 'TJ' ? strings(operands) : strings(operands).slice(-1);
				for (const t of texts) addGlyphs(font.glyphs, t.bytes, font.cidToGid);
			} else if (op === 'Do') {
				const name = operands[operands.length - 1];
				if (!name || typeof name !== 'object' || !('name' in name)) return;
				const ref = xobjects?.get(N(name.name));
				if (!(ref instanceof PDFRef)) return;
				const form = context.lookup(ref);
				if (!(form instanceof PDFRawStream) || form.dict.lookup(N('Subtype')) !== N('Form')) return;
				walkStream(ref, form, resources, font);
			}
		});
	};
	const walkStream = (
		ref: PDFRef | undefined,
		stream: PDFRawStream,
		parentResources: PDFDict | undefined,
		inherited: Candidate | undefined
	) => {
		if (ref) {
			const key = `${ref.toString()}|${idOf(inherited)}`;
			if (visited.has(key)) return;
			visited.add(key);
		}
		let contents: Uint8Array;
		try {
			contents = decode(stream);
		} catch {
			incomplete = true;
			return;
		}
		walkBytes(contents, dictOf(stream.dict, 'Resources') ?? parentResources, inherited);
	};
	const walkRef = (ref: PDFObject | undefined, resources: PDFDict | undefined) => {
		const stream = context.lookup(ref);
		if (stream instanceof PDFRawStream)
			walkStream(ref instanceof PDFRef ? ref : undefined, stream, resources, undefined);
	};

	for (const page of doc.getPages()) {
		const contents = page.node.Contents();
		const parts =
			contents instanceof PDFArray ? contents.asArray() : [page.node.get(N('Contents'))];
		// 複数の Contents は連結して1つの描画命令として解釈する（Tf がストリームをまたいで引き継がれるため）
		const decoded: Uint8Array[] = [];
		for (const part of parts) {
			const s = context.lookup(part);
			if (!(s instanceof PDFRawStream)) continue;
			try {
				decoded.push(decode(s), new Uint8Array([10]));
			} catch {
				incomplete = true;
			}
		}
		const joined = new Uint8Array(decoded.reduce((n, d) => n + d.length, 0));
		let offset = 0;
		for (const d of decoded) {
			joined.set(d, offset);
			offset += d.length;
		}
		walkBytes(joined, page.node.Resources(), undefined);

		for (const annot of page.node.Annots()?.asArray() ?? []) {
			const ap = context.lookup(annot);
			const appearances = ap instanceof PDFDict ? dictOf(ap, 'AP') : undefined;
			for (const [, state] of appearances?.entries() ?? []) {
				const target = context.lookup(state);
				if (target instanceof PDFDict && !(target instanceof PDFStream)) {
					for (const [, s] of target.entries()) walkRef(s, undefined);
				} else walkRef(state, undefined);
			}
		}
	}
	// タイリングパターンと Type3 フォントの描画手続き
	for (const [ref, obj] of context.enumerateIndirectObjects()) {
		if (
			obj instanceof PDFRawStream &&
			obj.dict.lookup(N('PatternType')) instanceof PDFNumber &&
			(obj.dict.lookup(N('PatternType')) as PDFNumber).asNumber() === 1
		)
			walkRef(ref, undefined);
		if (obj instanceof PDFDict && obj.lookup(N('Subtype')) === N('Type3')) {
			const resources = dictOf(obj, 'Resources');
			for (const [, proc] of dictOf(obj, 'CharProcs')?.entries() ?? []) walkRef(proc, resources);
		}
	}

	if (incomplete) return new Set();

	// 走査していないリソース辞書から参照されるフォントは対象外
	const exclude = (font: PDFObject | undefined) => {
		const dict = context.lookup(font);
		const c = dict instanceof PDFDict ? byType0.get(dict) : undefined;
		if (c) excluded.add(c);
	};
	// フォーム入力欄の既定リソース（/DR）のフォントは、入力時に別の文字が描かれるため常に対象外
	const acroForm = dictOf(doc.catalog, 'AcroForm');
	for (const [, f] of dictOf(dictOf(acroForm, 'DR'), 'Font')?.entries() ?? []) exclude(f);

	const findFonts = (obj: PDFObject, isResources: boolean) => {
		const dict = obj instanceof PDFStream ? obj.dict : obj;
		if (dict instanceof PDFDict) {
			const fontEntry = context.lookup(dict.get(N('Font')));
			if (fontEntry instanceof PDFDict && !(isResources && scannedResources.has(dict))) {
				for (const [, f] of fontEntry.entries()) exclude(f);
			} else if (fontEntry instanceof PDFArray) {
				// ExtGState の /Font [フォント サイズ]（gs で選ばれ、Tf を通らない）
				exclude(fontEntry.get(0));
			}
			for (const [k, v] of dict.entries())
				if (!(v instanceof PDFRef)) findFonts(v, k === N('Resources'));
		} else if (dict instanceof PDFArray) {
			for (const v of dict.asArray()) if (!(v instanceof PDFRef)) findFonts(v, false);
		}
	};
	for (const [, obj] of context.enumerateIndirectObjects()) {
		const dict = obj instanceof PDFStream ? obj.dict : obj;
		// 間接オブジェクトのリソース辞書は、走査したものと同一インスタンスなら除外しない
		if (dict instanceof PDFDict && dict.has(N('Font')) && dict.lookup(N('Type')) !== N('Font'))
			findFonts(dict, true);
		else findFonts(obj, false);
	}

	const done = new Set<PDFRef>();
	const cidOnly = cidOnlyFontFiles(doc);
	for (const c of candidates.values()) {
		if (excluded.has(c)) continue;
		const stream = context.lookup(c.fontFileRef) as PDFRawStream;
		let original: Uint8Array;
		try {
			original = decode(stream);
		} catch {
			continue;
		}
		const subsetted = subset(original, [0, ...c.glyphs], {
			dropTables: cidOnly.has(c.fontFileRef) ? CID_UNUSED_TABLES : [],
			noHinting: options.noHinting
		});
		if (!subsetted || subsetted.length >= original.length) continue;
		replaceFontFile(doc, c.fontFileRef, stream, subsetted);

		// サブセットであることを示す接頭辞を付け、収録字形の一覧（/CIDSet）は実態と合わなくなるため削除する
		const tag = subsetTag(subsetted);
		withTag(c.descriptor, 'FontName', tag);
		withTag(c.cidFont, 'BaseFont', tag);
		for (const t0 of c.type0Fonts) withTag(t0, 'BaseFont', tag);
		c.descriptor.delete(N('CIDSet'));
		done.add(c.fontFileRef);
	}
	return done;
}

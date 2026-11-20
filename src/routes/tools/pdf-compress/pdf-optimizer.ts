/**
 * PDFの構造最適化と容量内訳の解析（pdf-lib使用、ブラウザAPI非依存）
 * - 内訳: ストリームを画像・フォント・ページ描画命令などに分類して容量を集計
 * - 最適化: 付加データ削除・同一ストリームの重複排除・到達不能オブジェクト削除・ストリームの最高レベルFlate再圧縮
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
	PDFNull,
	decodePDFRawStream
} from 'pdf-lib';
import { zlibSync } from 'fflate';
import { collectImagePlacements } from './image-placement';

export type SpaceCategory =
	| 'image'
	| 'font'
	| 'content'
	| 'form'
	| 'attachment'
	| 'metadata'
	| 'thumbnail'
	| 'other';

export const CATEGORY_LABELS: Record<SpaceCategory, string> = {
	image: '画像',
	font: 'フォント',
	content: 'ページの描画命令',
	form: '図・共通パーツ（Form XObject）',
	attachment: '添付ファイル',
	metadata: 'XMPメタデータ',
	thumbnail: 'ページのサムネイル',
	other: 'その他（辞書・注釈など）'
};

export type ImageInfo = {
	width: number;
	height: number;
	filter: string;
	colorSpace: string;
	bytes: number;
	/** 最も大きく描かれた箇所での実効解像度（ppi）。ページの描画命令から配置を特定できなければnull */
	effectivePpi: number | null;
};

export type SpaceReport = {
	fileSize: number;
	pageCount: number;
	categories: { category: SpaceCategory; bytes: number }[];
	images: ImageInfo[];
	fonts: { name: string; embedded: boolean; subset: boolean }[];
	hasSignature: boolean;
};

export type OptimizeOptions = {
	removeThumbnails?: boolean;
	removeMetadata?: boolean;
	removePieceInfo?: boolean;
	removeAttachments?: boolean;
};

const N = (name: string) => PDFName.of(name);

function nameOf(obj: PDFObject | undefined): string {
	return obj instanceof PDFName ? obj.decodeText() : '';
}

/** Filterの名前一覧（配列・単体の両方に対応） */
export function filterNames(dict: PDFDict): string[] {
	const filter = dict.lookup(N('Filter'));
	if (filter instanceof PDFName) return [filter.decodeText()];
	if (filter instanceof PDFArray)
		return filter.asArray().map((f) => nameOf(dict.context.lookup(f)));
	return [];
}

/** 参照・辞書・配列を再帰的にたどって、Root/Infoから到達可能な参照を集める */
function collectReachable(doc: PDFDocument): Set<PDFRef> {
	const { context } = doc;
	const reachable = new Set<PDFRef>();
	const stack: PDFObject[] = [];
	const { Root, Info } = context.trailerInfo;
	if (Root) stack.push(Root);
	if (Info) stack.push(Info);

	while (stack.length > 0) {
		const obj = stack.pop()!;
		if (obj instanceof PDFRef) {
			if (reachable.has(obj)) continue;
			reachable.add(obj);
			const target = context.lookup(obj);
			if (target) stack.push(target);
		} else if (obj instanceof PDFDict) {
			for (const [, v] of obj.entries()) stack.push(v);
		} else if (obj instanceof PDFArray) {
			stack.push(...obj.asArray());
		} else if (obj instanceof PDFStream) {
			stack.push(obj.dict);
		}
	}
	return reachable;
}

/** 到達不能なオブジェクトを削除し、削除数を返す */
export function removeUnreachable(doc: PDFDocument): number {
	const reachable = collectReachable(doc);
	let removed = 0;
	for (const [ref] of doc.context.enumerateIndirectObjects()) {
		if (!reachable.has(ref)) {
			doc.context.delete(ref);
			removed++;
		}
	}
	return removed;
}

/** 辞書・配列内の参照を置き換える */
function replaceRefs(obj: PDFObject, remap: Map<PDFRef, PDFRef>): void {
	const dict = obj instanceof PDFStream ? obj.dict : obj;
	if (dict instanceof PDFDict) {
		for (const [k, v] of dict.entries()) {
			if (v instanceof PDFRef) {
				const to = remap.get(v);
				if (to) dict.set(k, to);
			} else replaceRefs(v, remap);
		}
	} else if (dict instanceof PDFArray) {
		for (let i = 0; i < dict.size(); i++) {
			const v = dict.get(i);
			if (v instanceof PDFRef) {
				const to = remap.get(v);
				if (to) dict.set(i, to);
			} else replaceRefs(v, remap);
		}
	}
}

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
	if (a.length !== b.length) return false;
	for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
	return true;
}

/**
 * 辞書と中身が完全一致するストリームを1つにまとめ、統合数を返す
 * SMask等の参照先が統合されると親画像の辞書も一致するため、変化がなくなるまで繰り返す
 */
export function dedupeStreams(doc: PDFDocument): number {
	const { context } = doc;
	let total = 0;
	for (;;) {
		const buckets = new Map<string, { ref: PDFRef; contents: Uint8Array }[]>();
		const remap = new Map<PDFRef, PDFRef>();
		for (const [ref, obj] of context.enumerateIndirectObjects()) {
			if (!(obj instanceof PDFRawStream)) continue;
			const contents = obj.getContents();
			const key = `${obj.dict.toString()}#${contents.length}`;
			const bucket = buckets.get(key) ?? [];
			const same = bucket.find((b) => bytesEqual(b.contents, contents));
			if (same) remap.set(ref, same.ref);
			else bucket.push({ ref, contents });
			buckets.set(key, bucket);
		}
		if (remap.size === 0) return total;

		for (const [, obj] of context.enumerateIndirectObjects()) replaceRefs(obj, remap);
		const { Root, Info } = context.trailerInfo;
		if (Root instanceof PDFRef && remap.has(Root)) context.trailerInfo.Root = remap.get(Root);
		if (Info instanceof PDFRef && remap.has(Info)) context.trailerInfo.Info = remap.get(Info);
		for (const ref of remap.keys()) context.delete(ref);
		total += remap.size;
	}
}

/** 文書全体の辞書から指定キーを削除 */
function deleteKeyEverywhere(doc: PDFDocument, key: string): void {
	// 間接オブジェクト内の直接辞書（インラインの /Resources 等）までたどる
	const visit = (obj: PDFObject) => {
		const target = obj instanceof PDFStream ? obj.dict : obj;
		if (target instanceof PDFDict) {
			target.delete(N(key));
			for (const [, v] of target.entries()) visit(v);
		} else if (target instanceof PDFArray) {
			target.asArray().forEach(visit);
		}
	};
	for (const [, obj] of doc.context.enumerateIndirectObjects()) visit(obj);
}

/** 見た目に影響しない付加データを削除（参照が外れたオブジェクトは後段のGCで消える） */
export function removeExtras(doc: PDFDocument, options: OptimizeOptions): void {
	if (options.removeThumbnails) {
		for (const page of doc.getPages()) page.node.delete(N('Thumb'));
	}
	if (options.removeMetadata) deleteKeyEverywhere(doc, 'Metadata');
	if (options.removePieceInfo) deleteKeyEverywhere(doc, 'PieceInfo');
	if (options.removeAttachments) {
		const names = doc.catalog.lookupMaybe(N('Names'), PDFDict);
		names?.delete(N('EmbeddedFiles'));
	}
}

/** 復号して再符号化できる汎用フィルタ（画像専用のDCT/JPX/JBIG2/CCITTは除く） */
const GENERIC_FILTERS = new Set([
	'FlateDecode',
	'LZWDecode',
	'ASCIIHexDecode',
	'ASCII85Decode',
	'RunLengthDecode'
]);

function hasDecodeParms(dict: PDFDict): boolean {
	const parms = dict.lookup(N('DecodeParms'));
	if (parms === undefined || parms === PDFNull) return false;
	if (parms instanceof PDFArray)
		return parms.asArray().some((p) => dict.context.lookup(p) !== PDFNull);
	return true;
}

/**
 * 描画命令・フォント・図などのストリームを最高レベル（9）のFlateで圧縮し直し、小さくなったものだけ置き換える
 * - Filterなし、または汎用フィルタのみ（予測子なし）: 完全に復号してFlate 1段にする
 * - 予測子付きの単一FlateDecode: pdf-libは予測子を戻さないため、予測済みのデータを圧縮し直してDecodeParmsを保つ
 * - JPEG（単一DCTDecode）: 可逆のFlateを重ねる
 */
export function recompressStreams(
	doc: PDFDocument,
	onProgress?: (done: number, total: number) => void
): number {
	let count = 0;
	const streams = doc.context
		.enumerateIndirectObjects()
		.filter((entry): entry is [PDFRef, PDFRawStream] => entry[1] instanceof PDFRawStream);
	for (const [i, [ref, obj]] of streams.entries()) {
		if (i % 50 === 0) onProgress?.(i, streams.length);
		// XMPは非圧縮が推奨（PDF/Aでは必須）のため対象外
		if (nameOf(obj.dict.get(N('Type'))) === 'Metadata') continue;
		const filters = filterNames(obj.dict);
		if (filters.length === 1 && filters[0] === 'DCTDecode') {
			if (wrapJpegWithFlate(doc, ref, obj)) count++;
			continue;
		}
		if (!filters.every((f) => GENERIC_FILTERS.has(f))) continue;
		const keepParms = hasDecodeParms(obj.dict);
		if (keepParms && !(filters.length === 1 && filters[0] === 'FlateDecode')) continue;

		const original = obj.getContents();
		if (original.length < 64) continue;
		let compressed: Uint8Array;
		try {
			const decoded =
				filters.length === 0
					? original
					: (decodePDFRawStream(obj) as { decode(): Uint8Array }).decode();
			compressed = zlibSync(decoded, { level: 9 });
		} catch {
			continue; // 壊れたストリームは元のまま
		}
		if (compressed.length >= original.length) continue;

		const dict = obj.dict.clone(doc.context);
		dict.set(N('Filter'), N('FlateDecode'));
		if (keepParms) {
			// 単一フィルタなので DecodeParms も1要素に正規化する
			const parms = dict.lookup(N('DecodeParms'));
			if (parms instanceof PDFArray) dict.set(N('DecodeParms'), parms.get(0));
		} else dict.delete(N('DecodeParms'));
		dict.set(N('Length'), PDFNumber.of(compressed.length));
		doc.context.assign(ref, PDFRawStream.of(dict, compressed));
		count++;
	}
	onProgress?.(streams.length, streams.length);
	return count;
}

/**
 * JPEGの上に可逆のFlateを重ねる（[/FlateDecode /DCTDecode]）。JPEGのヘッダーや量子化後の係数に偏りがあると数％小さくなる
 * 小さくならない場合とDCTのDecodeParms付きは何もしない
 */
function wrapJpegWithFlate(doc: PDFDocument, ref: PDFRef, obj: PDFRawStream): boolean {
	if (hasDecodeParms(obj.dict)) return false;
	const original = obj.getContents();
	const compressed = zlibSync(original, { level: 9 });
	if (compressed.length >= original.length) return false;
	const dict = obj.dict.clone(doc.context);
	dict.set(N('Filter'), doc.context.obj(['FlateDecode', 'DCTDecode']));
	dict.delete(N('DecodeParms'));
	dict.set(N('Length'), PDFNumber.of(compressed.length));
	doc.context.assign(ref, PDFRawStream.of(dict, compressed));
	return true;
}

/** 電子署名（/ByteRange を持つ署名辞書）を含むか */
export function hasSignature(doc: PDFDocument): boolean {
	for (const [, obj] of doc.context.enumerateIndirectObjects()) {
		if (obj instanceof PDFDict && obj.has(N('ByteRange'))) return true;
	}
	return false;
}

/** 全ページの長辺の最大値（pt） */
export function maxPageSidePt(doc: PDFDocument): number {
	let max = 0;
	for (const page of doc.getPages()) {
		const { width, height } = page.getSize();
		max = Math.max(max, width, height);
	}
	return max;
}

function effectivePpi(
	width: number,
	height: number,
	placement: { widthIn: number; heightIn: number } | undefined
): number | null {
	if (!placement || !(placement.widthIn > 0) || !(placement.heightIn > 0)) return null;
	// 縮小対象外（パターン内など）の画像は大きさを追えないため表示しない
	if (!Number.isFinite(placement.widthIn) || !Number.isFinite(placement.heightIn)) return null;
	return Math.round(Math.min(width / placement.widthIn, height / placement.heightIn));
}

function isFontFile(dict: PDFDict): boolean {
	if (dict.has(N('Length1')) || dict.has(N('Length2')) || dict.has(N('Length3'))) return true;
	return ['Type1C', 'CIDFontType0C', 'OpenType'].includes(nameOf(dict.get(N('Subtype'))));
}

/** ストリームごとの容量を用途別に集計 */
export function analyzeSpace(doc: PDFDocument, fileSize: number): SpaceReport {
	const { context } = doc;
	const contentRefs = new Set<PDFRef>();
	const thumbRefs = new Set<PDFRef>();
	for (const page of doc.getPages()) {
		const contents = page.node.get(N('Contents'));
		if (contents instanceof PDFRef) contentRefs.add(contents);
		const arr = page.node.lookup(N('Contents'));
		if (arr instanceof PDFArray) {
			for (const r of arr.asArray()) if (r instanceof PDFRef) contentRefs.add(r);
		}
		const thumb = page.node.get(N('Thumb'));
		if (thumb instanceof PDFRef) thumbRefs.add(thumb);
	}

	const placements = collectImagePlacements(doc) ?? new Map();
	const totals = new Map<SpaceCategory, number>();
	const add = (c: SpaceCategory, n: number) => totals.set(c, (totals.get(c) ?? 0) + n);
	const images: ImageInfo[] = [];
	const fonts: SpaceReport['fonts'] = [];

	for (const [ref, obj] of context.enumerateIndirectObjects()) {
		if (obj instanceof PDFRawStream) {
			const dict = obj.dict;
			const bytes = obj.getContentsSize();
			const type = nameOf(dict.get(N('Type')));
			const subtype = nameOf(dict.get(N('Subtype')));
			if (thumbRefs.has(ref)) add('thumbnail', bytes);
			else if (subtype === 'Image') {
				add('image', bytes);
				const width = dict.lookupMaybe(N('Width'), PDFNumber)?.asNumber() ?? 0;
				const height = dict.lookupMaybe(N('Height'), PDFNumber)?.asNumber() ?? 0;
				const cs = dict.lookup(N('ColorSpace'));
				images.push({
					width,
					height,
					filter: filterNames(dict).join(', ') || 'なし',
					colorSpace:
						cs instanceof PDFName
							? cs.decodeText()
							: cs instanceof PDFArray
								? nameOf(cs.lookup(0))
								: '',
					bytes,
					effectivePpi: effectivePpi(width, height, placements.get(ref))
				});
			} else if (type === 'EmbeddedFile') add('attachment', bytes);
			else if (type === 'Metadata') add('metadata', bytes);
			else if (subtype === 'Form') add('form', bytes);
			else if (isFontFile(dict)) add('font', bytes);
			else if (contentRefs.has(ref)) add('content', bytes);
			else add('other', bytes);
		} else {
			if (obj instanceof PDFDict && nameOf(obj.get(N('Type'))) === 'Font') {
				const base = nameOf(obj.get(N('BaseFont')));
				const subtype = nameOf(obj.get(N('Subtype')));
				if (subtype !== 'Type0' && base) {
					const desc = obj.lookupMaybe(N('FontDescriptor'), PDFDict);
					const embedded =
						!!desc &&
						(desc.has(N('FontFile')) || desc.has(N('FontFile2')) || desc.has(N('FontFile3')));
					fonts.push({ name: base, embedded, subset: /^[A-Z]{6}\+/.test(base) });
				}
			}
			add('other', obj.sizeInBytes());
		}
	}

	const categories = [...totals.entries()]
		.map(([category, bytes]) => ({ category, bytes }))
		.sort((a, b) => b.bytes - a.bytes);
	images.sort((a, b) => b.bytes - a.bytes);

	return {
		fileSize,
		pageCount: doc.getPageCount(),
		categories,
		images,
		fonts,
		hasSignature: hasSignature(doc)
	};
}

export const SAVE_OPTIONS = { useObjectStreams: true };

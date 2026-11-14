/**
 * PDF編集ツールの状態操作（純粋関数）
 * ページは元ファイル（source）への参照として保持し、書き出し時にのみPDFを組み立てる
 */

export interface PageRef {
	id: number;
	srcId: number;
	/** 元ファイル内のページ番号（0-based） */
	pageIndex: number;
}

export interface Doc {
	id: number;
	name: string;
	pages: PageRef[];
	expanded: boolean;
}

/** 空になったドキュメントを除去 */
function dropEmpty(docs: Doc[]): Doc[] {
	return docs.filter((d) => d.pages.length > 0);
}

/** 選択ページを削除（ページが無くなったドキュメントも削除） */
export function removePages(docs: Doc[], pageIds: ReadonlySet<number>): Doc[] {
	return dropEmpty(docs.map((d) => ({ ...d, pages: d.pages.filter((p) => !pageIds.has(p.id)) })));
}

/**
 * ページ群を targetDocId の targetIndex（移動前の位置基準）へ移動
 * 移動するページは文書順（ドキュメント順→ページ順）を保つ
 */
export function movePages(
	docs: Doc[],
	pageIds: ReadonlySet<number>,
	targetDocId: number,
	targetIndex: number
): Doc[] {
	const target = docs.find((d) => d.id === targetDocId);
	if (!target || pageIds.size === 0) return docs;

	const moving = docs.flatMap((d) => d.pages.filter((p) => pageIds.has(p.id)));
	const movedBefore = target.pages.slice(0, targetIndex).filter((p) => pageIds.has(p.id)).length;
	const insertAt = targetIndex - movedBefore;

	const next = docs.map((d) => {
		const rest = d.pages.filter((p) => !pageIds.has(p.id));
		if (d.id !== targetDocId) return { ...d, pages: rest };
		return { ...d, pages: [...rest.slice(0, insertAt), ...moving, ...rest.slice(insertAt)] };
	});
	return dropEmpty(next);
}

/** 既存名と重複しない名前を生成 */
function uniqueName(base: string, docs: Doc[]): string {
	const names = new Set(docs.map((d) => d.name));
	let n = 2;
	while (names.has(`${base}_${n}`)) n++;
	return `${base}_${n}`;
}

/** ドキュメントを atIndex ページ目の直前で2つに分割 */
export function splitDoc(docs: Doc[], docId: number, atIndex: number, newDocId: number): Doc[] {
	const idx = docs.findIndex((d) => d.id === docId);
	if (idx < 0) return docs;
	const doc = docs[idx];
	if (atIndex <= 0 || atIndex >= doc.pages.length) return docs;

	const first: Doc = { ...doc, pages: doc.pages.slice(0, atIndex) };
	const second: Doc = {
		id: newDocId,
		name: uniqueName(doc.name, docs),
		pages: doc.pages.slice(atIndex),
		expanded: doc.expanded
	};
	return [...docs.slice(0, idx), first, second, ...docs.slice(idx + 1)];
}

/** index 番目と index+1 番目のドキュメントを結合（名前は前のものを引き継ぐ） */
export function mergeWithNext(docs: Doc[], index: number): Doc[] {
	if (index < 0 || index + 1 >= docs.length) return docs;
	const a = docs[index];
	const b = docs[index + 1];
	const merged: Doc = { ...a, pages: [...a.pages, ...b.pages], expanded: a.expanded || b.expanded };
	return [...docs.slice(0, index), merged, ...docs.slice(index + 2)];
}

/** ドキュメントの順序を変更 */
export function moveDoc(docs: Doc[], from: number, to: number): Doc[] {
	if (from === to || from < 0 || to < 0 || from >= docs.length || to >= docs.length) return docs;
	const arr = [...docs];
	const [item] = arr.splice(from, 1);
	arr.splice(to, 0, item);
	return arr;
}

export interface SelectionState {
	selected: Set<number>;
	anchor: number | null;
}

/**
 * ページクリック時の選択更新
 * - 通常クリック: そのページのみ選択
 * - Ctrl/Cmd: トグル
 * - Shift: アンカーから範囲選択（同一ドキュメント内のみ。Ctrl併用時は既存選択に追加）
 */
export function updateSelection(
	state: SelectionState,
	orderedIds: number[],
	clickedId: number,
	mod: { shift: boolean; toggle: boolean }
): SelectionState {
	if (mod.shift && state.anchor !== null) {
		const a = orderedIds.indexOf(state.anchor);
		const b = orderedIds.indexOf(clickedId);
		if (a >= 0 && b >= 0) {
			const range = orderedIds.slice(Math.min(a, b), Math.max(a, b) + 1);
			const selected = mod.toggle ? new Set([...state.selected, ...range]) : new Set(range);
			return { selected, anchor: state.anchor };
		}
	}
	if (mod.toggle) {
		const selected = new Set(state.selected);
		if (selected.has(clickedId)) selected.delete(clickedId);
		else selected.add(clickedId);
		return { selected, anchor: clickedId };
	}
	return { selected: new Set([clickedId]), anchor: clickedId };
}

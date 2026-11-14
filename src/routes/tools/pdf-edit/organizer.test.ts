import { describe, it, expect } from 'vitest';
import {
	movePages,
	removePages,
	splitDoc,
	mergeWithNext,
	moveDoc,
	updateSelection,
	type Doc
} from './organizer';

/** docs[i] に ids のページを持つドキュメントを作る（srcId=doc id, pageIndex=連番） */
function makeDocs(...pageIdLists: number[][]): Doc[] {
	return pageIdLists.map((ids, i) => ({
		id: 100 + i,
		name: `doc${i}`,
		expanded: true,
		pages: ids.map((id, j) => ({ id, srcId: i, pageIndex: j }))
	}));
}

const ids = (docs: Doc[]) => docs.map((d) => d.pages.map((p) => p.id));

describe('removePages', () => {
	it('選択ページを削除し、空のドキュメントは除去する', () => {
		const docs = makeDocs([1, 2, 3], [4]);
		expect(ids(removePages(docs, new Set([2, 4])))).toEqual([[1, 3]]);
	});
});

describe('movePages', () => {
	it('同一ドキュメント内で後ろへ移動する', () => {
		const docs = makeDocs([1, 2, 3, 4]);
		// 1 を 3 と 4 の間（移動前index=3）へ
		expect(ids(movePages(docs, new Set([1]), 100, 3))).toEqual([[2, 3, 1, 4]]);
	});

	it('同一ドキュメント内で前へ移動する', () => {
		const docs = makeDocs([1, 2, 3, 4]);
		expect(ids(movePages(docs, new Set([4]), 100, 0))).toEqual([[4, 1, 2, 3]]);
	});

	it('複数ページを文書順のまま移動する', () => {
		const docs = makeDocs([1, 2, 3, 4, 5]);
		expect(ids(movePages(docs, new Set([4, 1]), 100, 3))).toEqual([[2, 3, 1, 4, 5]]);
	});

	it('別ドキュメントへ移動し、空になった移動元は除去する', () => {
		const docs = makeDocs([1], [2, 3]);
		expect(ids(movePages(docs, new Set([1]), 101, 1))).toEqual([[2, 1, 3]]);
	});

	it('末尾へ移動できる', () => {
		const docs = makeDocs([1, 2, 3]);
		expect(ids(movePages(docs, new Set([1]), 100, 3))).toEqual([[2, 3, 1]]);
	});
});

describe('splitDoc', () => {
	it('指定位置で2つに分け、後半に重複しない名前を付ける', () => {
		const docs = makeDocs([1, 2, 3]);
		const result = splitDoc(docs, 100, 2, 999);
		expect(ids(result)).toEqual([[1, 2], [3]]);
		expect(result[1]).toMatchObject({ id: 999, name: 'doc0_2' });
		expect(splitDoc(result, 100, 1, 1000)[1].name).toBe('doc0_3');
	});

	it('端の位置では分割しない', () => {
		const docs = makeDocs([1, 2]);
		expect(splitDoc(docs, 100, 0, 999)).toBe(docs);
		expect(splitDoc(docs, 100, 2, 999)).toBe(docs);
	});
});

describe('mergeWithNext / moveDoc', () => {
	it('隣のドキュメントと結合し、前の名前を引き継ぐ', () => {
		const result = mergeWithNext(makeDocs([1], [2, 3], [4]), 0);
		expect(ids(result)).toEqual([[1, 2, 3], [4]]);
		expect(result[0].name).toBe('doc0');
	});

	it('ドキュメントの順序を入れ替える', () => {
		expect(ids(moveDoc(makeDocs([1], [2], [3]), 0, 2))).toEqual([[2], [3], [1]]);
	});
});

describe('updateSelection', () => {
	const order = [1, 2, 3, 4, 5];
	const empty = { selected: new Set<number>(), anchor: null };

	it('通常クリックで単一選択', () => {
		const s = updateSelection({ selected: new Set([1, 2]), anchor: 1 }, order, 3, {
			shift: false,
			toggle: false
		});
		expect([...s.selected]).toEqual([3]);
		expect(s.anchor).toBe(3);
	});

	it('Ctrlでトグル', () => {
		let s = updateSelection(empty, order, 2, { shift: false, toggle: true });
		s = updateSelection(s, order, 4, { shift: false, toggle: true });
		expect([...s.selected].sort()).toEqual([2, 4]);
		s = updateSelection(s, order, 2, { shift: false, toggle: true });
		expect([...s.selected]).toEqual([4]);
	});

	it('Shiftでアンカーから範囲選択（逆方向も可）', () => {
		const s = updateSelection({ selected: new Set([4]), anchor: 4 }, order, 2, {
			shift: true,
			toggle: false
		});
		expect([...s.selected].sort()).toEqual([2, 3, 4]);
		expect(s.anchor).toBe(4);
	});

	it('アンカーが別ドキュメントにある場合は単一選択', () => {
		const s = updateSelection({ selected: new Set([9]), anchor: 9 }, order, 2, {
			shift: true,
			toggle: false
		});
		expect([...s.selected]).toEqual([2]);
	});
});

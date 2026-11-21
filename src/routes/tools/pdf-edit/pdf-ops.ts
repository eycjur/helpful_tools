/**
 * PDF操作ユーティリティ（pdf-lib使用）
 * ページ組み立て（結合・分割・ページ編集）
 */
import { PDFDocument, PDFPage } from 'pdf-lib';

const SAVE_OPTIONS = { useObjectStreams: true };

/**
 * 複数PDFのページを指定順に並べて1つのPDFを作成（結合・分割・ページ編集の共通処理）
 * pages の srcId は sources のキー、pageIndex は0-based
 */
export async function assemblePdf(
	sources: ReadonlyMap<number, File>,
	pages: { srcId: number; pageIndex: number }[]
): Promise<Uint8Array> {
	// copyPages は呼び出し単位で共有リソース（フォント等）をコピーするため、元ファイルごとに1回にまとめる
	const indicesBySrc = new Map<number, number[]>();
	for (const { srcId, pageIndex } of pages) {
		const list = indicesBySrc.get(srcId) ?? [];
		list.push(pageIndex);
		indicesBySrc.set(srcId, list);
	}

	const newDoc = await PDFDocument.create();
	const copied = new Map<number, PDFPage[]>();
	for (const [srcId, indices] of indicesBySrc) {
		const file = sources.get(srcId);
		if (!file) throw new Error('元のPDFファイルが見つかりません');
		const srcDoc = await PDFDocument.load(new Uint8Array(await file.arrayBuffer()));
		copied.set(srcId, await newDoc.copyPages(srcDoc, indices));
	}

	const cursor = new Map<number, number>();
	for (const { srcId } of pages) {
		const i = cursor.get(srcId) ?? 0;
		newDoc.addPage(copied.get(srcId)![i]);
		cursor.set(srcId, i + 1);
	}

	return newDoc.save(SAVE_OPTIONS);
}

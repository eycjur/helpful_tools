/**
 * PDF圧縮の全体処理（参照元を保ったまま不要物を削り、必要なら画像を再圧縮）
 * 結果が元ファイル以上なら元ファイルを採用する
 */
import { PDFDocument } from 'pdf-lib';
import {
	dedupeStreams,
	removeExtras,
	recompressStreams,
	removeUnreachable,
	SAVE_OPTIONS
} from './pdf-optimizer';
import { recompressImages } from './image-recompress';
import type { CompressSettings } from './levels';

export type CompressResult = {
	bytes: Uint8Array;
	/** 圧縮結果が元ファイル以上だったため元ファイルを返した */
	keptOriginal: boolean;
	stats: { deduped: number; removed: number; recompressed: number; images: number };
};

/** 進捗の段階。done/total は件数が分かる段階（画像・ストリーム）のみ */
export type CompressStage = 'load' | 'optimize' | 'images' | 'streams' | 'save' | 'analyze';
export type CompressProgress = { stage: CompressStage; done?: number; total?: number };

export async function compressPdfFile(
	original: Uint8Array,
	options: CompressSettings,
	onProgress: (p: CompressProgress) => void = () => {}
): Promise<CompressResult> {
	onProgress({ stage: 'load' });
	const doc = await PDFDocument.load(original, { updateMetadata: false });
	onProgress({ stage: 'optimize' });
	removeExtras(doc, options);
	// 先に重複をまとめ、不要になったオブジェクトを捨てて、同じ画像の再符号化や無駄な処理を避ける
	const deduped = dedupeStreams(doc);
	const removed = removeUnreachable(doc);
	const images = options.images
		? await recompressImages(doc, options.images, (done, total) =>
				onProgress({ stage: 'images', done, total })
			)
		: 0;
	const recompressed = recompressStreams(doc, (done, total) =>
		onProgress({ stage: 'streams', done, total })
	);

	onProgress({ stage: 'save' });
	const saved = await doc.save(SAVE_OPTIONS);
	const keptOriginal = saved.length >= original.length;
	return {
		bytes: keptOriginal ? original : saved,
		keptOriginal,
		stats: { deduped, removed, recompressed, images }
	};
}

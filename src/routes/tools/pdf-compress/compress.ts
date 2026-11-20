/**
 * PDF圧縮の全体処理（参照元を保ったまま不要物を削り、必要なら画像を再圧縮）
 * 結果が元ファイル以上なら元ファイルを採用する
 */
import { PDFDocument } from 'pdf-lib';
import {
	dedupeStreams,
	deflateUncompressedStreams,
	removeExtras,
	removeUnreachable,
	SAVE_OPTIONS,
	type OptimizeOptions
} from './pdf-optimizer';
import { recompressImages, type ImageRecompressOptions } from './image-recompress';

export type CompressResult = {
	bytes: Uint8Array;
	/** 圧縮結果が元ファイル以上だったため元ファイルを返した */
	keptOriginal: boolean;
	stats: { deduped: number; removed: number; deflated: number; images: number };
};

export async function compressPdfFile(
	original: Uint8Array,
	options: OptimizeOptions & { images: ImageRecompressOptions | null }
): Promise<CompressResult> {
	const doc = await PDFDocument.load(original, { updateMetadata: false });
	removeExtras(doc, options);
	// 不要になったオブジェクトを先に捨て、無駄な画像の再符号化を避ける
	let removed = removeUnreachable(doc);
	const images = options.images ? await recompressImages(doc, options.images) : 0;
	const deduped = dedupeStreams(doc);
	removed += removeUnreachable(doc);
	const deflated = await deflateUncompressedStreams(doc);

	const saved = await doc.save(SAVE_OPTIONS);
	const keptOriginal = saved.length >= original.length;
	return {
		bytes: keptOriginal ? original : saved,
		keptOriginal,
		stats: { deduped, removed, deflated, images }
	};
}

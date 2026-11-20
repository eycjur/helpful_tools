/**
 * PDFの解析・圧縮を行う Web Worker（UIを固めず、進捗を通知し、terminate でキャンセルできるようにする）
 */
import { PDFDocument } from 'pdf-lib';
import { analyzeSpace, type SpaceReport } from './pdf-optimizer';
import { compressPdfFile, type CompressProgress, type CompressResult } from './compress';
import type { CompressSettings } from './levels';

export type WorkerRequest =
	| { type: 'analyze'; bytes: Uint8Array }
	| { type: 'compress'; bytes: Uint8Array; settings: CompressSettings };

export type WorkerResponse =
	| { type: 'progress'; progress: CompressProgress }
	| { type: 'analyzed'; report: SpaceReport }
	| { type: 'compressed'; result: CompressResult; report: SpaceReport | null }
	| { type: 'error'; message: string };

const post = (message: WorkerResponse, transfer: Transferable[] = []) =>
	self.postMessage(message, { transfer });

async function analyze(bytes: Uint8Array): Promise<SpaceReport> {
	const doc = await PDFDocument.load(bytes, { updateMetadata: false });
	return analyzeSpace(doc, bytes.length);
}

self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
	const req = e.data;
	try {
		if (req.type === 'analyze') {
			post({ type: 'analyzed', report: await analyze(req.bytes) });
		} else {
			const result = await compressPdfFile(req.bytes, req.settings, (progress) =>
				post({ type: 'progress', progress })
			);
			// 元ファイルを返す場合、圧縮後の内訳は圧縮前と同じなので呼び出し側の解析結果を使う
			let report: SpaceReport | null = null;
			if (!result.keptOriginal) {
				post({ type: 'progress', progress: { stage: 'analyze' } });
				report = await analyze(result.bytes);
			}
			post({ type: 'compressed', result, report }, [result.bytes.buffer]);
		}
	} catch (err) {
		post({ type: 'error', message: err instanceof Error ? err.message : String(err) });
	}
};

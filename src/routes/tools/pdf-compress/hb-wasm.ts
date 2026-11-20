/** ブラウザ・Worker から harfbuzz-subset.wasm を読み込む（必要になったときだけ取得する） */
import wasmUrl from 'harfbuzzjs/dist/harfbuzz-subset.wasm?url';

export async function loadSubsetWasm(): Promise<ArrayBuffer> {
	const res = await fetch(wasmUrl);
	if (!res.ok) throw new Error(`フォント処理用のWASMを読み込めませんでした（${res.status}）`);
	return res.arrayBuffer();
}

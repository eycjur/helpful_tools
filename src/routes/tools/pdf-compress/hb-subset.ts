/**
 * HarfBuzz のサブセット化（harfbuzzjs 同梱の harfbuzz-subset.wasm）を C API で直接呼ぶ薄いラッパー
 */
import type { Subsetter } from './font-subset';

/** hb_memory_mode_t: HB_MEMORY_MODE_READONLY */
const HB_MEMORY_MODE_READONLY = 1;
/** hb_subset_flags_t: HB_SUBSET_FLAGS_RETAIN_GIDS（字形番号を保つ。PDF内の文字コードをそのまま使えるようにする） */
const HB_SUBSET_FLAGS_RETAIN_GIDS = 0x2;
/** hb_subset_flags_t: HB_SUBSET_FLAGS_NOTDEF_OUTLINE（.notdef の形を残し、想定外の欠字を空白でなく豆腐で見せる） */
const HB_SUBSET_FLAGS_NOTDEF_OUTLINE = 0x40;

type HbExports = {
	memory: WebAssembly.Memory;
	malloc(size: number): number;
	free(ptr: number): void;
	hb_blob_create(
		data: number,
		length: number,
		mode: number,
		userData: number,
		destroy: number
	): number;
	hb_blob_destroy(blob: number): void;
	hb_blob_get_length(blob: number): number;
	hb_blob_get_data(blob: number, length: number): number;
	hb_face_create(blob: number, index: number): number;
	hb_face_destroy(face: number): void;
	hb_face_reference_blob(face: number): number;
	hb_set_add(set: number, codepoint: number): void;
	hb_subset_input_create_or_fail(): number;
	hb_subset_input_destroy(input: number): void;
	hb_subset_input_glyph_set(input: number): number;
	hb_subset_input_set_flags(input: number, flags: number): void;
	hb_subset_or_fail(face: number, input: number): number;
};

export async function createSubsetter(wasm: BufferSource): Promise<Subsetter> {
	const { instance } = await WebAssembly.instantiate(wasm, {});
	const hb = instance.exports as unknown as HbExports;

	return (font, glyphIds) => {
		const fontPtr = hb.malloc(font.length);
		let face = 0;
		let input = 0;
		let result: Uint8Array | null = null;
		try {
			new Uint8Array(hb.memory.buffer).set(font, fontPtr);
			const blob = hb.hb_blob_create(fontPtr, font.length, HB_MEMORY_MODE_READONLY, 0, 0);
			face = hb.hb_face_create(blob, 0);
			hb.hb_blob_destroy(blob);
			input = hb.hb_subset_input_create_or_fail();
			if (!input) return null;
			const set = hb.hb_subset_input_glyph_set(input);
			for (const gid of glyphIds) hb.hb_set_add(set, gid);
			hb.hb_subset_input_set_flags(
				input,
				HB_SUBSET_FLAGS_RETAIN_GIDS | HB_SUBSET_FLAGS_NOTDEF_OUTLINE
			);
			const subsetFace = hb.hb_subset_or_fail(face, input);
			if (subsetFace) {
				const out = hb.hb_face_reference_blob(subsetFace);
				const length = hb.hb_blob_get_length(out);
				const ptr = hb.hb_blob_get_data(out, 0);
				// WASMのメモリは後続の確保で移動しうるため、すぐにコピーする
				if (length > 0) result = new Uint8Array(hb.memory.buffer.slice(ptr, ptr + length));
				hb.hb_blob_destroy(out);
				hb.hb_face_destroy(subsetFace);
			}
		} finally {
			if (input) hb.hb_subset_input_destroy(input);
			if (face) hb.hb_face_destroy(face);
			hb.free(fontPtr);
		}
		return result;
	};
}

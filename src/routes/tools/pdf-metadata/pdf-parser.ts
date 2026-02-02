/**
 * PDFメタデータ解析 - PDF解析ユーティリティ
 */

import { SvelteSet, SvelteMap } from 'svelte/reactivity';
import * as pdfjsLib from 'pdfjs-dist';
import type { PDFReport, ParsedValue, RawObject } from './types';

// PDF.jsのWorkerを設定
if (typeof window !== 'undefined') {
	pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
}

type RawAction = {
	type: string;
	url?: string | null;
	file?: string | null;
	preview?: string | null;
	sha256?: string | null;
};

/**
 * テキストをプレビュー用に切り詰め
 */
export function preview(s: string, n = 400): string {
	const t = s.replace(/\r\n/g, '\n');
	return t.length <= n ? t : t.slice(0, n) + '...';
}

/**
 * ホワイトスペース文字かどうかを判定
 */
function isWhitespace(ch: string): boolean {
	return ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r' || ch === '\f' || ch === '\0';
}

/**
 * ホワイトスペースをスキップ
 */
function skipWhitespace(text: string, idx: number): number {
	let i = idx;
	while (i < text.length && isWhitespace(text[i])) i++;
	return i;
}

/**
 * リテラル文字列をパース
 */
function parseLiteralString(text: string, start: number): { value: string; end: number } | null {
	if (text[start] !== '(') return null;
	let i = start + 1;
	let depth = 1;
	let out = '';
	while (i < text.length) {
		const ch = text[i];
		if (ch === '\\') {
			const next = text[i + 1];
			if (next === '\n' || next === '\r') {
				i += next === '\r' && text[i + 2] === '\n' ? 3 : 2;
				continue;
			}
			if (next !== undefined) {
				out += next;
				i += 2;
				continue;
			}
		} else if (ch === '(') {
			depth++;
			out += ch;
			i++;
			continue;
		} else if (ch === ')') {
			depth--;
			if (depth === 0) return { value: out, end: i + 1 };
			out += ch;
			i++;
			continue;
		}
		out += ch;
		i++;
	}
	return null;
}

/**
 * 16進数文字列をパース
 */
function parseHexString(text: string, start: number): { value: Uint8Array; end: number } | null {
	if (text[start] !== '<' || text[start + 1] === '<') return null;
	let i = start + 1;
	let hex = '';
	while (i < text.length) {
		const ch = text[i];
		if (ch === '>') break;
		if (!isWhitespace(ch)) hex += ch;
		i++;
	}
	if (i >= text.length) return null;
	if (hex.length % 2 === 1) hex += '0';
	const bytes = new Uint8Array(hex.length / 2);
	for (let j = 0; j < hex.length; j += 2) {
		bytes[j / 2] = parseInt(hex.slice(j, j + 2), 16);
	}
	return { value: bytes, end: i + 1 };
}

/**
 * 辞書をパース
 */
function parseDict(text: string, start: number): { value: string; end: number } | null {
	if (text[start] !== '<' || text[start + 1] !== '<') return null;
	let i = start + 2;
	let depth = 1;
	while (i < text.length) {
		if (text[i] === '<' && text[i + 1] === '<') {
			depth++;
			i += 2;
			continue;
		}
		if (text[i] === '>' && text[i + 1] === '>') {
			depth--;
			i += 2;
			if (depth === 0) return { value: text.slice(start, i), end: i };
			continue;
		}
		i++;
	}
	return null;
}

/**
 * PDF値を読み取り
 */
function readPdfValue(text: string, start: number): ParsedValue | null {
	const i = skipWhitespace(text, start);
	if (i >= text.length) return null;
	const ch = text[i];
	if (ch === '(') {
		const s = parseLiteralString(text, i);
		return s ? { type: 'literal', value: s.value } : null;
	}
	if (ch === '<' && text[i + 1] === '<') {
		const d = parseDict(text, i);
		return d ? { type: 'dict', value: d.value } : null;
	}
	if (ch === '<') {
		const h = parseHexString(text, i);
		return h ? { type: 'hex', value: h.value } : null;
	}
	if (ch === '/') {
		let j = i + 1;
		while (j < text.length && !isWhitespace(text[j]) && !'[]<>/()'.includes(text[j])) j++;
		return { type: 'name', value: text.slice(i + 1, j) };
	}
	if (ch === '-' || (ch >= '0' && ch <= '9')) {
		let j = i;
		while (j < text.length && /[0-9.-]/.test(text[j])) j++;
		const first = text.slice(i, j);
		const k = skipWhitespace(text, j);
		let l = k;
		while (l < text.length && /[0-9.-]/.test(text[l])) l++;
		const second = text.slice(k, l);
		const m = skipWhitespace(text, l);
		if (second && text[m] === 'R') {
			return { type: 'number', value: parseFloat(first) };
		}
		return { type: 'number', value: parseFloat(first) };
	}
	return { type: 'unknown', value: ch };
}

/**
 * 配列値をパース
 */
function parseArrayValues(text: string, start: number): ParsedValue[] | null {
	if (text[start] !== '[') return null;
	let i = start + 1;
	const values: ParsedValue[] = [];
	while (i < text.length) {
		i = skipWhitespace(text, i);
		if (text[i] === ']') return values;
		const value = readPdfValue(text, i);
		if (!value) {
			i++;
			continue;
		}
		values.push(value);
		// Advance based on value type
		if (value.type === 'literal' && typeof value.value === 'string') {
			i += value.value.length + 2; // Account for parentheses
		} else if (value.type === 'dict' && typeof value.value === 'string') {
			i += value.value.length;
		} else if (value.type === 'name' && typeof value.value === 'string') {
			i += value.value.length + 1; // Account for /
		} else {
			i++;
		}
	}
	return null;
}

/**
 * キーに対応する配列を検索
 */
function findArrayForKey(text: string, key: string): ParsedValue[] | null {
	const needle = `/${key}`;
	let idx = text.indexOf(needle);
	while (idx !== -1) {
		const after = skipWhitespace(text, idx + needle.length);
		if (text[after] === '[') {
			const arr = parseArrayValues(text, after);
			if (arr) return arr;
		}
		idx = text.indexOf(needle, idx + needle.length);
	}
	return null;
}

/**
 * キーに対応する値を検索
 */
function findKeyValue(text: string, key: string): ParsedValue | null {
	const needle = `/${key}`;
	let idx = text.indexOf(needle);
	while (idx !== -1) {
		const value = readPdfValue(text, idx + needle.length);
		if (value) return value;
		idx = text.indexOf(needle, idx + needle.length);
	}
	return null;
}

/**
 * バイト配列を文字列にデコード
 */
function decodeBytesToString(bytes: Uint8Array): string {
	try {
		return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
	} catch {
		return new TextDecoder('latin1').decode(bytes);
	}
}

/**
 * PDFオブジェクトマップを構築
 */
function buildObjectMap(text: string): SvelteMap<string, RawObject> {
	const map = new SvelteMap<string, RawObject>();
	const re = /(\d+)\s+(\d+)\s+obj([\s\S]*?)endobj/g;
	let m: RegExpExecArray | null;
	while ((m = re.exec(text)) !== null) {
		const objNum = m[1];
		const genNum = m[2];
		const body = m[3] ?? '';
		map.set(`${objNum} ${genNum}`, { objNum: parseInt(objNum), genNum: parseInt(genNum), body });
	}
	return map;
}

/**
 * SHA-256ハッシュを計算
 */
export async function sha256Hex(data: ArrayBuffer | Uint8Array | string): Promise<string> {
	const enc =
		typeof data === 'string'
			? new TextEncoder().encode(data)
			: data instanceof Uint8Array
				? data
				: new Uint8Array(data);

	const digest = await crypto.subtle.digest('SHA-256', enc);
	const arr = Array.from(new Uint8Array(digest));
	return arr.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * 値からJavaScriptを抽出
 */
async function extractJsFromValue(value: ParsedValue): Promise<{
	script: string;
	sha256: string;
} | null> {
	if (value.type === 'literal') {
		const sha = await sha256Hex(value.value);
		return { script: value.value, sha256: sha };
	}
	if (value.type === 'hex') {
		const script = decodeBytesToString(value.value);
		const sha = await sha256Hex(value.value);
		return { script, sha256: sha };
	}
	// Handle reference type - need to look up in objects map
	// This is simplified; actual implementation would parse the reference
	return null;
}

/**
 * 値から辞書ボディを取得
 */
function getDictBodyFromValue(value: ParsedValue): string | null {
	if (value.type === 'dict') return value.value;
	// Handle reference type - need to look up in objects map
	return null;
}

/**
 * ボディからアクションをパース
 */
async function parseActionFromBody(
	body: string,
	objects: SvelteMap<string, RawObject>
): Promise<RawAction | null> {
	const actionType = findKeyValue(body, 'S');
	if (actionType?.type === 'name' && actionType.value === 'JavaScript') {
		const jsValue = findKeyValue(body, 'JS');
		if (!jsValue) return { type: 'JavaScript' };
		const js = await extractJsFromValue(jsValue, objects);
		return {
			type: 'JavaScript',
			preview: js ? preview(js.script, 800) : null,
			sha256: js?.sha256 ?? null
		};
	}
	if (actionType?.type === 'name' && actionType.value === 'URI') {
		const uriValue = findKeyValue(body, 'URI');
		const url =
			uriValue?.type === 'literal'
				? uriValue.value
				: uriValue?.type === 'hex'
					? decodeBytesToString(uriValue.value)
					: null;
		return { type: 'URI', url };
	}
	if (actionType?.type === 'name' && actionType.value === 'Launch') {
		const fileValue = findKeyValue(body, 'F');
		const file =
			fileValue?.type === 'literal'
				? fileValue.value
				: fileValue?.type === 'hex'
					? decodeBytesToString(fileValue.value)
					: null;
		return { type: 'Launch', file };
	}
	if (actionType?.type === 'name' && actionType.value === 'GoToR') {
		const fileValue = findKeyValue(body, 'F');
		const file =
			fileValue?.type === 'literal'
				? fileValue.value
				: fileValue?.type === 'hex'
					? decodeBytesToString(fileValue.value)
					: null;
		return { type: 'GoToR', file };
	}
	return null;
}

/**
 * 値を名前に変換
 */
function valueToName(value: ParsedValue): string | null {
	if (value.type === 'literal') return value.value;
	if (value.type === 'hex') return decodeBytesToString(value.value);
	if (value.type === 'name') return value.value;
	return null;
}

/**
 * 名前ツリーからJavaScriptを収集
 */
async function collectJavaScriptFromNameTree(
	dictBody: string,
	scope: string,
	objects: SvelteMap<string, RawObject>,
	javascript: Array<{ trigger: string; script: string; sha256: string }>
): Promise<void> {
	const namesArray = findArrayForKey(dictBody, 'Names');
	if (namesArray) {
		for (let i = 0; i < namesArray.length; i += 2) {
			const nameVal = namesArray[i];
			const actionVal = namesArray[i + 1];
			if (!nameVal || !actionVal) continue;
			const name = valueToName(nameVal) ?? `item_${i / 2}`;
			const actionBody = getDictBodyFromValue(actionVal, objects);
			if (!actionBody) continue;
			const action = await parseActionFromBody(actionBody, objects);
			if (action?.type === 'JavaScript') {
				const jsValue = findKeyValue(actionBody, 'JS');
				if (jsValue) {
					const js = await extractJsFromValue(jsValue, objects);
					if (js) {
						javascript.push({
							trigger: `${scope}/${name}`,
							script: js.script,
							sha256: js.sha256
						});
					}
				}
			}
		}
	}

	const kidsArray = findArrayForKey(dictBody, 'Kids');
	if (kidsArray) {
		for (const kidVal of kidsArray) {
			const kidBody = getDictBodyFromValue(kidVal, objects);
			if (!kidBody) continue;
			await collectJavaScriptFromNameTree(kidBody, scope, objects, javascript);
		}
	}
}

/**
 * 生のアクションを抽出
 */
async function extractRawActions(bytes: Uint8Array): Promise<{
	openAction: RawAction | null;
	additionalActions: Array<{ scope: string; action: RawAction }>;
	javascript: Array<{ trigger: string; script: string; sha256: string }>;
}> {
	const text = new TextDecoder('latin1').decode(bytes);
	const objects = buildObjectMap(text);

	let catalogBody: string | null = null;
	for (const obj of objects.values()) {
		if (obj.body.includes('/Type') && obj.body.includes('/Catalog')) {
			catalogBody = obj.body;
			break;
		}
	}

	const additionalActions: Array<{ scope: string; action: RawAction }> = [];
	const javascript: Array<{ trigger: string; script: string; sha256: string }> = [];
	let openAction: RawAction | null = null;

	if (catalogBody) {
		const namesRootVal = findKeyValue(catalogBody, 'Names');
		if (namesRootVal) {
			const namesRootBody = getDictBodyFromValue(namesRootVal, objects);
			if (namesRootBody) {
				const jsTreeVal = findKeyValue(namesRootBody, 'JavaScript');
				if (jsTreeVal) {
					const jsTreeBody = getDictBodyFromValue(jsTreeVal, objects);
					if (jsTreeBody) {
						await collectJavaScriptFromNameTree(
							jsTreeBody,
							'Names.JavaScript',
							objects,
							javascript
						);
					}
				}
			}
		}

		const openActionValue = findKeyValue(catalogBody, 'OpenAction');
		if (openActionValue) {
			const actionBody = openActionValue.type === 'dict' ? openActionValue.value : null;
			if (actionBody) {
				openAction = await parseActionFromBody(actionBody, objects);
				const jsValue = findKeyValue(actionBody, 'JS');
				if (jsValue) {
					const js = await extractJsFromValue(jsValue, objects);
					if (js) javascript.push({ trigger: 'OpenAction', script: js.script, sha256: js.sha256 });
				}
			}
		}

		const aaValue = findKeyValue(catalogBody, 'AA');
		if (aaValue?.type === 'dict') {
			let i = 0;
			while (i < aaValue.value.length) {
				i = skipWhitespace(aaValue.value, i);
				if (aaValue.value[i] !== '/') {
					i++;
					continue;
				}
				const keyVal = readPdfValue(aaValue.value, i);
				if (!keyVal || keyVal.type !== 'name') {
					i++;
					continue;
				}
				const key = keyVal.value;
				const actionVal = readPdfValue(aaValue.value, i + key.length + 1);
				if (!actionVal) {
					i++;
					continue;
				}
				const actionBody = actionVal.type === 'dict' ? actionVal.value : null;
				if (actionBody) {
					const action = await parseActionFromBody(actionBody, objects);
					if (action) additionalActions.push({ scope: `Catalog.AA/${key}`, action });
					const jsValue = findKeyValue(actionBody, 'JS');
					if (jsValue) {
						const js = await extractJsFromValue(jsValue, objects);
						if (js)
							javascript.push({
								trigger: `Catalog.AA/${key}`,
								script: js.script,
								sha256: js.sha256
							});
					}
				}
				i++;
			}
		}
	}

	for (const obj of objects.values()) {
		if (!obj.body.includes('/JavaScript')) continue;
		const jsValue = findKeyValue(obj.body, 'JS');
		if (!jsValue) continue;
		const js = await extractJsFromValue(jsValue, objects);
		if (js) {
			javascript.push({
				trigger: `obj:${obj.objNum} ${obj.genNum}`,
				script: js.script,
				sha256: js.sha256
			});
		}
	}

	return { openAction, additionalActions, javascript };
}

/**
 * infoオブジェクトを安全に辞書に変換
 */
export function safeInfoToDict(info: unknown): Record<string, unknown> {
	const out: Record<string, unknown> = {};
	if (!info || typeof info !== 'object') return out;
	for (const [k, v] of Object.entries(info)) {
		out[k] = v as unknown;
	}
	return out;
}

/**
 * ドキュメントIDを取得
 */
async function tryGetDocumentIds(pdf: unknown): Promise<string[] | null> {
	try {
		const trailer = (
			pdf as { _transport?: { xref?: { trailer?: { get?: (key: string) => unknown } } } }
		)._transport?.xref?.trailer;
		const idArr = trailer?.get?.('ID');
		if (Array.isArray(idArr) && idArr.length >= 2) {
			const a = idArr[0];
			const b = idArr[1];
			const ida = a instanceof Uint8Array ? await sha256Hex(a) : String(a);
			const idb = b instanceof Uint8Array ? await sha256Hex(b) : String(b);
			return [ida, idb];
		}
	} catch {
		// ignore
	}
	return null;
}

/**
 * PDFをレンダリングせずに解析
 */
export async function parsePDFNonRender(
	arrayBuffer: ArrayBuffer,
	fileName = 'unknown.pdf',
	makeFindings: (report: PDFReport) => PDFReport['findings']
): Promise<PDFReport> {
	const bytes = new Uint8Array(arrayBuffer);
	const fileHash = await sha256Hex(bytes);

	const loadingTask = pdfjsLib.getDocument({
		data: bytes
	});

	const pdf = await loadingTask.promise;

	const version: string | null =
		(pdf as { pdfInfo?: { PDFFormatVersion?: string } }).pdfInfo?.PDFFormatVersion ??
		(pdf as { _pdfInfo?: { PDFFormatVersion?: string } })._pdfInfo?.PDFFormatVersion ??
		null;

	let infoDict: Record<string, unknown> = {};
	let xmp: PDFReport['metadata']['xmp'] = null;

	try {
		const md = await pdf.getMetadata();
		infoDict = safeInfoToDict(md.info);
		if (md.metadata) {
			try {
				const raw = md.metadata.getRaw?.() ?? '';
				const rawSha256 = await sha256Hex(raw);
				xmp = {
					parseStatus: 'ok',
					rawSha256,
					summary: md.metadata.getAll?.() ?? undefined
				};
			} catch {
				xmp = { parseStatus: 'fail', rawSha256: await sha256Hex('') };
			}
		}
	} catch {
		// ignore
	}

	type AttachmentValue = {
		filename?: string;
		content?: Uint8Array;
		description?: string;
		contentType?: string;
	};

	const embeddedFiles: PDFReport['embedded']['files'] = [];
	try {
		const att = await (
			pdf as { getAttachments?: () => Promise<Record<string, unknown>> }
		).getAttachments?.();
		if (att && typeof att === 'object') {
			for (const [k, v] of Object.entries(att as Record<string, AttachmentValue>)) {
				const content: Uint8Array | undefined = v?.content;
				if (!content) continue;
				embeddedFiles.push({
					name: v.filename ?? k,
					size: content.length,
					sha256: await sha256Hex(content),
					description: v.description ?? null,
					mimetype: v.contentType ?? null
				});
			}
		}
	} catch {
		// ignore
	}

	const docJs: PDFReport['active']['javascript']['documentLevel'] = [];
	try {
		const jsActions =
			(await (
				pdf as { getJSActions?: () => Promise<Record<string, string[]>> }
			).getJSActions?.()) ?? null;
		if (jsActions) {
			for (const [key, list] of Object.entries(jsActions)) {
				for (const js of list) {
					docJs.push({
						name: `docjs_${docJs.length}`,
						trigger: `JSActions/${key}`,
						preview: preview(js, 800),
						sha256: await sha256Hex(js)
					});
				}
			}
		}
	} catch {
		// ignore
	}

	const actionJs: PDFReport['active']['javascript']['actions'] = [];
	const externalRefs: PDFReport['active']['externalRefs'] = [];

	type Annotation = {
		id?: string;
		url?: string;
		actions?: Record<string, unknown>;
		additionalActions?: Record<string, unknown>;
	};

	for (let p = 1; p <= pdf.numPages; p++) {
		try {
			const page = await pdf.getPage(p);
			const annots = await page.getAnnotations({ intent: 'display' });
			const pageJsActions =
				(await (
					pdf as { getPageJSActions?: (pageIndex: number) => Promise<Record<string, string[]>> }
				).getPageJSActions?.(p - 1)) ?? null;
			if (pageJsActions) {
				for (const [key, list] of Object.entries(pageJsActions)) {
					for (const js of list) {
						actionJs.push({
							name: `pagejs_${actionJs.length}`,
							trigger: `page:${p} JSActions/${key}`,
							preview: preview(js, 800),
							sha256: await sha256Hex(js)
						});
					}
				}
			}

			for (const a of annots as Annotation[]) {
				if (a?.url) {
					externalRefs.push({
						kind: 'URI',
						where: `page:${p} annot:${a.id ?? 'unknown'}`,
						url: String(a.url)
					});
				}

				const candidates: unknown[] = [];
				if (a?.actions && typeof a.actions === 'object') {
					candidates.push(...Object.values(a.actions));
				}
				if (a?.additionalActions && typeof a.additionalActions === 'object') {
					candidates.push(...Object.values(a.additionalActions));
				}

				for (const c of candidates) {
					if (typeof c === 'string' && c.trim().length > 0) {
						actionJs.push({
							name: `actionjs_page${p}`,
							trigger: `page:${p} annot:${a.id ?? 'unknown'}`,
							preview: preview(c, 800),
							sha256: await sha256Hex(c)
						});
					}
				}
			}
		} catch {
			// ignore
		}
	}

	let rawActions: Awaited<ReturnType<typeof extractRawActions>> | null = null;
	try {
		rawActions = await extractRawActions(bytes);
	} catch {
		rawActions = null;
	}

	let encrypted = false;
	try {
		if ('isEncrypted' in pdf) {
			encrypted = Boolean((pdf as { isEncrypted?: boolean }).isEncrypted);
		}
	} catch {
		// ignore
	}

	const report: PDFReport = {
		file: {
			path: fileName,
			size: bytes.length,
			sha256: fileHash,
			pages: pdf.numPages,
			version
		},
		metadata: {
			infoDict,
			xmp,
			documentIds: await tryGetDocumentIds(pdf)
		},
		embedded: {
			files: embeddedFiles
		},
		active: {
			openAction: rawActions?.openAction ?? null,
			additionalActions:
				rawActions?.additionalActions.map((a) => ({
					scope: a.scope,
					type: a.action.type,
					preview: a.action.preview ?? null,
					sha256: a.action.sha256 ?? null
				})) ?? [],
			javascript: {
				documentLevel: docJs,
				actions: actionJs
			},
			externalRefs
		},
		forms: {
			acroFormPresent: false,
			xfaPresent: false,
			fieldCount: 0,
			hasCalcOrValidate: false
		},
		security: {
			encrypted,
			encryptionFilter: null,
			signatures: [],
			permissions: null
		},
		findings: []
	};

	if (rawActions?.javascript?.length) {
		const seen = new SvelteSet(
			[...report.active.javascript.documentLevel, ...report.active.javascript.actions]
				.map((s) => s.sha256)
				.filter((s) => s && s.length > 0)
		);
		for (const js of rawActions.javascript) {
			if (seen.has(js.sha256)) continue;
			report.active.javascript.actions.push({
				name: `rawjs_${report.active.javascript.actions.length}`,
				trigger: js.trigger,
				preview: preview(js.script, 800),
				sha256: js.sha256
			});
			seen.add(js.sha256);
		}
	}

	report.findings = makeFindings(report);

	try {
		await pdf.destroy();
	} catch {
		// ignore
	}

	return report;
}

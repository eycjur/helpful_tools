<script lang="ts">
	import { tools } from '$lib/data/tools';
	import Icon from '@iconify/svelte';
	import { onDestroy } from 'svelte';
	import { SvelteSet, SvelteMap } from 'svelte/reactivity';
	import * as pdfjsLib from 'pdfjs-dist';
	import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

	pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

	type FindingSeverity = 'high' | 'medium' | 'low' | 'info';

	type Finding = {
		severity: FindingSeverity;
		code: string;
		message: string;
	};

	type PDFReport = {
		file: {
			path: string;
			size: number;
			sha256: string;
			pages: number;
			version: string | null;
		};
		metadata: {
			infoDict: Record<string, unknown>;
			xmp: null | {
				parseStatus: 'ok' | 'fail';
				rawSha256: string;
				summary?: Record<string, unknown>;
			};
			documentIds: string[] | null;
		};
		embedded: {
			files: Array<{
				name: string;
				size: number;
				sha256: string;
				mimetype?: string | null;
				description?: string | null;
			}>;
		};
		active: {
			openAction: null | {
				type: string;
				url?: string | null;
				file?: string | null;
				preview?: string | null;
				sha256?: string | null;
			};
			additionalActions: Array<{
				scope: string;
				type: string;
				preview?: string | null;
				sha256?: string | null;
			}>;
			javascript: {
				documentLevel: Array<{
					name: string;
					trigger?: string | null;
					preview: string;
					sha256: string;
				}>;
				actions: Array<{
					name: string;
					trigger?: string | null;
					preview: string;
					sha256: string;
				}>;
			};
			externalRefs: Array<{
				kind: 'URI' | 'Launch' | 'GoToR' | 'Unknown';
				where: string;
				url?: string | null;
				file?: string | null;
			}>;
		};
		forms: {
			acroFormPresent: boolean;
			xfaPresent: boolean;
			fieldCount: number;
			hasCalcOrValidate: boolean;
		};
		security: {
			encrypted: boolean;
			encryptionFilter?: string | null;
			signatures: Array<{ field: string; subfilter?: string | null; coversWholeDoc?: boolean }>;
			permissions?: {
				printing: boolean;
				modifyContents: boolean;
				copyText: boolean;
				modifyAnnotations: boolean;
				fillForms: boolean;
				extractText: boolean;
				assemble: boolean;
				printHighRes: boolean;
			} | null;
		};
		findings: Finding[];
	};

	function preview(s: string, n = 400): string {
		const t = s.replace(/\r\n/g, '\n');
		return t.length <= n ? t : t.slice(0, n) + '...';
	}

	function isWhitespace(ch: string): boolean {
		return ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r' || ch === '\f' || ch === '\0';
	}

	function skipWhitespace(text: string, idx: number): number {
		let i = idx;
		while (i < text.length && isWhitespace(text[i])) i++;
		return i;
	}

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

	type ParsedValue =
		| { type: 'string'; value: string; end: number }
		| { type: 'hex'; value: Uint8Array; end: number }
		| { type: 'ref'; value: string; end: number }
		| { type: 'name'; value: string; end: number }
		| { type: 'dict'; value: string; end: number }
		| { type: 'other'; value: string; end: number };

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

	function readPdfValue(text: string, start: number): ParsedValue | null {
		let i = skipWhitespace(text, start);
		if (i >= text.length) return null;
		const ch = text[i];
		if (ch === '(') {
			const s = parseLiteralString(text, i);
			return s ? { type: 'string', value: s.value, end: s.end } : null;
		}
		if (ch === '<' && text[i + 1] === '<') {
			const d = parseDict(text, i);
			return d ? { type: 'dict', value: d.value, end: d.end } : null;
		}
		if (ch === '<') {
			const h = parseHexString(text, i);
			return h ? { type: 'hex', value: h.value, end: h.end } : null;
		}
		if (ch === '/') {
			let j = i + 1;
			while (j < text.length && !isWhitespace(text[j]) && !'[]<>/()'.includes(text[j])) j++;
			return { type: 'name', value: text.slice(i + 1, j), end: j };
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
				return { type: 'ref', value: `${first} ${second}`, end: m + 1 };
			}
			return { type: 'other', value: first, end: j };
		}
		return { type: 'other', value: ch, end: i + 1 };
	}

	function parseArrayValues(
		text: string,
		start: number
	): { values: ParsedValue[]; end: number } | null {
		if (text[start] !== '[') return null;
		let i = start + 1;
		const values: ParsedValue[] = [];
		while (i < text.length) {
			i = skipWhitespace(text, i);
			if (text[i] === ']') return { values, end: i + 1 };
			const value = readPdfValue(text, i);
			if (!value) {
				i++;
				continue;
			}
			values.push(value);
			i = value.end;
		}
		return null;
	}

	function findArrayForKey(
		text: string,
		key: string
	): { values: ParsedValue[]; end: number } | null {
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

	function decodeBytesToString(bytes: Uint8Array): string {
		try {
			return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
		} catch {
			return new TextDecoder('latin1').decode(bytes);
		}
	}

	async function tryInflate(bytes: Uint8Array): Promise<Uint8Array | null> {
		if (typeof DecompressionStream === 'undefined') return null;
		try {
			const ds = new DecompressionStream('deflate');
			const stream = new Blob([bytes]).stream().pipeThrough(ds);
			const buf = await new Response(stream).arrayBuffer();
			return new Uint8Array(buf);
		} catch {
			return null;
		}
	}

	type RawObject = {
		id: string;
		body: string;
	};

	function buildObjectMap(text: string): SvelteMap<string, RawObject> {
		const map = new SvelteMap<string, RawObject>();
		const re = /(\d+)\s+(\d+)\s+obj([\s\S]*?)endobj/g;
		let m: RegExpExecArray | null;
		while ((m = re.exec(text)) !== null) {
			const objNum = m[1];
			const genNum = m[2];
			const body = m[3] ?? '';
			map.set(`${objNum} ${genNum}`, { id: `${objNum} ${genNum}`, body });
		}
		return map;
	}

	function extractStreamBody(objBody: string): { bytes: Uint8Array; hasFlate: boolean } | null {
		const streamMatch = /stream[\r\n]+([\s\S]*?)endstream/.exec(objBody);
		if (!streamMatch) return null;
		const raw = streamMatch[1];
		const bytes = new Uint8Array(raw.length);
		for (let i = 0; i < raw.length; i++) {
			bytes[i] = raw.charCodeAt(i) & 0xff;
		}
		const hasFlate = /\/Filter\s*(?:\/FlateDecode|\[.*?\/FlateDecode.*?\])/.test(objBody);
		return { bytes, hasFlate };
	}

	async function extractJsFromValue(
		value: ParsedValue,
		objects: SvelteMap<string, RawObject>
	): Promise<{ script: string; sha256: string } | null> {
		if (value.type === 'string') {
			const sha = await sha256Hex(value.value);
			return { script: value.value, sha256: sha };
		}
		if (value.type === 'hex') {
			const script = decodeBytesToString(value.value);
			const sha = await sha256Hex(value.value);
			return { script, sha256: sha };
		}
		if (value.type === 'ref') {
			const obj = objects.get(value.value);
			if (!obj) return null;
			const jsValue = findKeyValue(obj.body, 'JS');
			if (jsValue) return extractJsFromValue(jsValue, objects);
			const stream = extractStreamBody(obj.body);
			if (!stream) return null;
			let data = stream.bytes;
			if (stream.hasFlate) {
				const inflated = await tryInflate(stream.bytes);
				if (inflated) data = inflated;
			}
			const script = decodeBytesToString(data);
			const sha = await sha256Hex(data);
			return { script, sha256: sha };
		}
		return null;
	}

	function getDictBodyFromValue(
		value: ParsedValue,
		objects: SvelteMap<string, RawObject>
	): string | null {
		if (value.type === 'dict') return value.value;
		if (value.type === 'ref') return objects.get(value.value)?.body ?? null;
		return null;
	}

	type RawAction = {
		type: string;
		url?: string | null;
		file?: string | null;
		preview?: string | null;
		sha256?: string | null;
	};

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
				uriValue?.type === 'string'
					? uriValue.value
					: uriValue?.type === 'hex'
						? decodeBytesToString(uriValue.value)
						: null;
			return { type: 'URI', url };
		}
		if (actionType?.type === 'name' && actionType.value === 'Launch') {
			const fileValue = findKeyValue(body, 'F');
			const file =
				fileValue?.type === 'string'
					? fileValue.value
					: fileValue?.type === 'hex'
						? decodeBytesToString(fileValue.value)
						: null;
			return { type: 'Launch', file };
		}
		if (actionType?.type === 'name' && actionType.value === 'GoToR') {
			const fileValue = findKeyValue(body, 'F');
			const file =
				fileValue?.type === 'string'
					? fileValue.value
					: fileValue?.type === 'hex'
						? decodeBytesToString(fileValue.value)
						: null;
			return { type: 'GoToR', file };
		}
		return null;
	}

	function valueToName(value: ParsedValue): string | null {
		if (value.type === 'string') return value.value;
		if (value.type === 'hex') return decodeBytesToString(value.value);
		if (value.type === 'name') return value.value;
		return null;
	}

	async function collectJavaScriptFromNameTree(
		dictBody: string,
		scope: string,
		objects: SvelteMap<string, RawObject>,
		javascript: Array<{ trigger: string; script: string; sha256: string }>
	): Promise<void> {
		const namesArray = findArrayForKey(dictBody, 'Names');
		if (namesArray) {
			for (let i = 0; i < namesArray.values.length; i += 2) {
				const nameVal = namesArray.values[i];
				const actionVal = namesArray.values[i + 1];
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
			for (const kidVal of kidsArray.values) {
				const kidBody = getDictBodyFromValue(kidVal, objects);
				if (!kidBody) continue;
				await collectJavaScriptFromNameTree(kidBody, scope, objects, javascript);
			}
		}
	}

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
				const actionBody =
					openActionValue.type === 'dict'
						? openActionValue.value
						: openActionValue.type === 'ref'
							? (objects.get(openActionValue.value)?.body ?? null)
							: null;
				if (actionBody) {
					openAction = await parseActionFromBody(actionBody, objects);
					const jsValue = findKeyValue(actionBody, 'JS');
					if (jsValue) {
						const js = await extractJsFromValue(jsValue, objects);
						if (js)
							javascript.push({ trigger: 'OpenAction', script: js.script, sha256: js.sha256 });
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
					const actionVal = readPdfValue(aaValue.value, keyVal.end);
					if (!actionVal) {
						i = keyVal.end;
						continue;
					}
					const actionBody =
						actionVal.type === 'dict'
							? actionVal.value
							: actionVal.type === 'ref'
								? (objects.get(actionVal.value)?.body ?? null)
								: null;
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
					i = actionVal.end;
				}
			}
		}

		for (const obj of objects.values()) {
			if (!obj.body.includes('/JavaScript')) continue;
			const jsValue = findKeyValue(obj.body, 'JS');
			if (!jsValue) continue;
			const js = await extractJsFromValue(jsValue, objects);
			if (js) {
				javascript.push({ trigger: `obj:${obj.id}`, script: js.script, sha256: js.sha256 });
			}
		}

		return { openAction, additionalActions, javascript };
	}

	async function sha256Hex(data: ArrayBuffer | Uint8Array | string): Promise<string> {
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

	function safeInfoToDict(info: unknown): Record<string, unknown> {
		const out: Record<string, unknown> = {};
		if (!info || typeof info !== 'object') return out;
		for (const [k, v] of Object.entries(info)) {
			out[k] = v as unknown;
		}
		return out;
	}

	function makeFindings(report: PDFReport): Finding[] {
		const f: Finding[] = [];

		if (report.active.javascript.documentLevel.length > 0) {
			f.push({
				severity: 'high',
				code: 'DOC_JS',
				message: 'Document-level JavaScriptが埋め込まれています。'
			});
		}
		if (report.active.javascript.actions.length > 0) {
			f.push({
				severity: 'high',
				code: 'ACTION_JS',
				message: 'JavaScript Actionが検出されました（注釈等に紐付く可能性）。'
			});
		}
		if (report.embedded.files.length > 0) {
			f.push({
				severity: 'high',
				code: 'EMBEDDED_FILES',
				message: `埋め込みファイルが${report.embedded.files.length}件あります。`
			});
		}
		if (report.security.encrypted) {
			f.push({
				severity: 'medium',
				code: 'ENCRYPTED',
				message: 'PDFが暗号化されています。解析できない要素がある可能性があります。'
			});
		}
		if (report.active.externalRefs.length > 0) {
			f.push({
				severity: 'medium',
				code: 'EXTERNAL_REFS',
				message: `外部参照が${report.active.externalRefs.length}件あります。`
			});
		}

		return f;
	}

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

	async function parsePDFNonRender(
		arrayBuffer: ArrayBuffer,
		fileName = 'unknown.pdf'
	): Promise<PDFReport> {
		const bytes = new Uint8Array(arrayBuffer);
		console.log('parsePDFNonRender bytes.length', bytes.length);
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
			console.log('rawActions', {
				openAction: Boolean(rawActions.openAction),
				additionalActions: rawActions.additionalActions.length,
				javascript: rawActions.javascript.length
			});
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

	// ファイルサイズ警告しきい値（100MB以上で警告）
	const FILE_SIZE_WARNING_THRESHOLD = 100 * 1024 * 1024;

	const tool = tools.find((t) => t.name === 'pdf-metadata');

	let pdfUrl: string | null = null;
	let report: PDFReport | null = null;
	let isLoading = false;
	let dragOver = false;
	let warnings: Array<{ message: string; type: 'warning' | 'error' }> = [];

	function cleanup() {
		if (pdfUrl) {
			URL.revokeObjectURL(pdfUrl);
			pdfUrl = null;
		}
	}
	onDestroy(cleanup);

	function formatFileSize(bytes: number): string {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
		return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
	}

	function formatValue(value: unknown): string {
		if (value === null || value === undefined) return 'N/A';
		if (typeof value === 'boolean') return value ? 'Yes' : 'No';
		if (value instanceof Date) return value.toLocaleString('ja-JP');
		if (typeof value === 'number') return value.toLocaleString();
		if (typeof value === 'object' && !Array.isArray(value)) {
			return JSON.stringify(value, null, 2);
		}
		if (Array.isArray(value)) {
			return value.join(', ');
		}
		return String(value);
	}

	function formatKey(key: string): string {
		return key
			.replace(/([A-Z])/g, ' $1')
			.replace(/_/g, ' ')
			.trim()
			.replace(/\b\w/g, (c) => c.toUpperCase());
	}

	function getSeverityColor(severity: Finding['severity']): string {
		switch (severity) {
			case 'high':
				return 'text-red-600 bg-red-50 border-red-200';
			case 'medium':
				return 'text-yellow-600 bg-yellow-50 border-yellow-200';
			case 'low':
				return 'text-blue-600 bg-blue-50 border-blue-200';
			default:
				return 'text-gray-600 bg-gray-50 border-gray-200';
		}
	}

	function getSeverityIcon(severity: Finding['severity']): string {
		switch (severity) {
			case 'high':
				return 'mdi:alert-circle';
			case 'medium':
				return 'mdi:alert';
			case 'low':
				return 'mdi:information';
			default:
				return 'mdi:information-outline';
		}
	}

	async function processPDF(file: File) {
		cleanup();
		isLoading = true;
		report = null;
		warnings = [];
		console.log('file.size', file.size);

		// ファイルサイズの警告チェック
		if (file.size > FILE_SIZE_WARNING_THRESHOLD) {
			const sizeMB = Math.round(file.size / 1024 / 1024);
			warnings = [
				...warnings,
				{
					message: `ファイルサイズが大きいため（${sizeMB}MB）、処理に時間がかかる場合があります。`,
					type: 'warning'
				}
			];
		}

		try {
			// PDFのArrayBufferを取得
			const arrayBuffer = await file.arrayBuffer();
			console.log('arrayBuffer.byteLength', arrayBuffer.byteLength);

			// URLを生成（プレビュー用）
			const url = URL.createObjectURL(file);
			pdfUrl = url;

			// 新しいパーサーでPDF解析
			console.log('PDF解析開始...');
			report = await parsePDFNonRender(arrayBuffer, file.name);
			console.log('PDF解析結果:', report);

			// Findingから警告を生成
			for (const finding of report.findings) {
				if (finding.severity === 'high') {
					warnings = [
						...warnings,
						{
							message: `⚠️ ${finding.message}`,
							type: 'error'
						}
					];
				} else if (finding.severity === 'medium') {
					warnings = [
						...warnings,
						{
							message: `⚠️ ${finding.message}`,
							type: 'warning'
						}
					];
				}
			}

			console.log('PDF解析完了');
		} catch (err) {
			console.error('PDF処理エラー:', err);
			warnings = [
				...warnings,
				{
					message: err instanceof Error ? err.message : 'PDFの処理に失敗しました',
					type: 'error'
				}
			];
		} finally {
			isLoading = false;
		}
	}

	function onFileInput(e: Event) {
		const input = e.target as HTMLInputElement;
		if (input.files?.[0]) {
			processPDF(input.files[0]);
			input.value = '';
		}
	}

	function onDrop(e: DragEvent) {
		e.preventDefault();
		dragOver = false;
		const file = e.dataTransfer?.files?.[0];
		if (file && file.type === 'application/pdf') {
			processPDF(file);
		}
	}

	function clearAll() {
		cleanup();
		report = null;
		warnings = [];
	}
</script>

<div class="mx-auto max-w-4xl">
	<div class="mb-6 flex items-center">
		{#if tool?.icon}<Icon icon={tool.icon} class="mr-4 h-10 w-10" />{/if}
		<h1 class="text-3xl font-bold">{tool?.nameJa}</h1>
	</div>

	<p class="mb-6 text-gray-600">
		PDFファイルの見た目と無関係な要素（メタデータ、埋め込みファイル、アクティブ要素、セキュリティ設定など）を詳細に解析・表示します。
	</p>

	<!-- ファイル入力エリア -->
	<div
		role="button"
		tabindex="0"
		aria-label="PDFファイルをドラッグ&ドロップまたはクリックして選択"
		on:dragover|preventDefault={() => (dragOver = true)}
		on:dragleave={() => (dragOver = false)}
		on:drop={onDrop}
		on:click={() => document.getElementById('pdf-file-input')?.click()}
		on:keydown={(e) => {
			if (e.key === 'Enter' || e.key === ' ') {
				e.preventDefault();
				document.getElementById('pdf-file-input')?.click();
			}
		}}
		class="mb-4 flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 text-center transition-colors {dragOver
			? 'border-blue-400 bg-blue-50'
			: 'border-gray-300 bg-gray-50'}"
	>
		<Icon icon="mdi:cloud-upload" class="mb-2 h-12 w-12 text-gray-400" />
		<p class="mb-2 text-gray-700">PDFファイルをドラッグ＆ドロップ</p>
		<p class="mb-3 text-xs text-gray-500">または、クリックして選択</p>
		<input
			id="pdf-file-input"
			type="file"
			accept="application/pdf"
			on:change={onFileInput}
			class="hidden"
		/>
	</div>

	{#if isLoading}
		<div class="flex items-center justify-center p-8">
			<Icon icon="mdi:loading" class="h-8 w-8 animate-spin text-blue-500" />
			<span class="ml-2 text-gray-600">処理中...</span>
		</div>
	{/if}

	<!-- 警告・エラーメッセージ -->
	{#each warnings as warning (warning.message)}
		<div
			class="mb-4 rounded-lg border p-4 {warning.type === 'error'
				? 'border-red-200 bg-red-50'
				: 'border-yellow-200 bg-yellow-50'}"
		>
			<div class="flex items-start">
				<Icon
					icon={warning.type === 'error' ? 'mdi:alert-circle' : 'mdi:alert'}
					class="mr-2 h-5 w-5 flex-shrink-0 {warning.type === 'error'
						? 'text-red-600'
						: 'text-yellow-600'}"
				/>
				<p class={warning.type === 'error' ? 'text-red-800' : 'text-yellow-800'}>
					{warning.message}
				</p>
			</div>
		</div>
	{/each}

	{#if report && pdfUrl}
		<div class="mb-4 flex justify-end">
			<button on:click={clearAll} class="rounded bg-gray-500 px-4 py-2 text-white hover:bg-gray-600"
				>クリア</button
			>
		</div>

		<!-- PDFプレビュー -->
		<div class="mb-6 overflow-hidden rounded-lg border border-gray-200 bg-white">
			<embed src={pdfUrl} type="application/pdf" class="h-96 w-full" />
		</div>

		<!-- Findings（検出結果） -->
		{#if report.findings.length > 0}
			<div class="mb-6 overflow-hidden rounded-lg border border-gray-200 bg-white">
				<div class="border-b border-gray-200 bg-gray-50 px-4 py-3">
					<div class="flex items-center">
						<Icon icon="mdi:shield-alert" class="mr-2 h-5 w-5 text-red-600" />
						<h2 class="font-semibold text-gray-800">検出結果（Findings）</h2>
						<span
							class="ml-2 rounded-full bg-gray-200 px-2 py-1 text-xs font-semibold text-gray-700"
						>
							{report.findings.length}
						</span>
					</div>
				</div>
				<div class="p-4">
					<div class="space-y-3">
						{#each report.findings as finding (finding.code)}
							<div class="rounded-lg border p-3 {getSeverityColor(finding.severity)}">
								<div class="flex items-start">
									<Icon
										icon={getSeverityIcon(finding.severity)}
										class="mr-2 h-5 w-5 flex-shrink-0"
									/>
									<div class="flex-1">
										<div class="flex items-center justify-between">
											<span class="text-xs font-semibold uppercase">{finding.severity}</span>
											<span class="font-mono text-xs text-gray-600">{finding.code}</span>
										</div>
										<p class="mt-1 text-sm">{finding.message}</p>
									</div>
								</div>
							</div>
						{/each}
					</div>
				</div>
			</div>
		{/if}

		<!-- 基本情報 -->
		<div class="mb-6 overflow-hidden rounded-lg border border-gray-200 bg-white">
			<div class="border-b border-gray-200 bg-gray-50 px-4 py-3">
				<div class="flex items-center">
					<Icon icon="mdi:file-pdf-box" class="mr-2 h-5 w-5 text-blue-600" />
					<h2 class="font-semibold text-gray-800">基本情報</h2>
				</div>
			</div>
			<div class="p-4">
				<dl class="grid grid-cols-1 gap-3 md:grid-cols-2">
					<div>
						<dt class="text-sm font-medium text-gray-500">ファイル名</dt>
						<dd class="mt-1 text-sm break-all text-gray-900">{report.file.path}</dd>
					</div>
					<div>
						<dt class="text-sm font-medium text-gray-500">ファイルサイズ</dt>
						<dd class="mt-1 text-sm text-gray-900">{formatFileSize(report.file.size)}</dd>
					</div>
					<div>
						<dt class="text-sm font-medium text-gray-500">PDFバージョン</dt>
						<dd class="mt-1 text-sm text-gray-900">{report.file.version}</dd>
					</div>
					<div>
						<dt class="text-sm font-medium text-gray-500">ページ数</dt>
						<dd class="mt-1 text-sm text-gray-900">{report.file.pages}</dd>
					</div>
					<div class="md:col-span-2">
						<dt class="text-sm font-medium text-gray-500">SHA-256</dt>
						<dd class="mt-1 font-mono text-xs break-all text-gray-900">{report.file.sha256}</dd>
					</div>
				</dl>
			</div>
		</div>

		<!-- メタデータ -->
		{#if Object.keys(report.metadata.infoDict).length > 0 || report.metadata.xmp || report.metadata.documentIds}
			<div class="mb-6 overflow-hidden rounded-lg border border-gray-200 bg-white">
				<div class="border-b border-gray-200 bg-gray-50 px-4 py-3">
					<div class="flex items-center">
						<Icon icon="mdi:information-outline" class="mr-2 h-5 w-5 text-blue-600" />
						<h2 class="font-semibold text-gray-800">メタデータ</h2>
					</div>
				</div>
				<div class="p-4">
					{#if Object.keys(report.metadata.infoDict).length > 0}
						<div class="mb-4">
							<h3 class="mb-2 text-sm font-semibold text-gray-700">/Info辞書</h3>
							<dl class="space-y-2">
								{#each Object.entries(report.metadata.infoDict) as [key, value] (key)}
									<div class="border-b border-gray-100 pb-2 last:border-b-0">
										<dt class="text-sm font-medium text-gray-500">{formatKey(key)}</dt>
										<dd class="mt-1 text-sm text-gray-900">
											<span class="break-all whitespace-pre-wrap">{formatValue(value)}</span>
										</dd>
									</div>
								{/each}
							</dl>
						</div>
					{/if}

					{#if report.metadata.xmp}
						<div class="mb-4">
							<h3 class="mb-2 text-sm font-semibold text-gray-700">XMPメタデータ</h3>
							<dl class="space-y-2">
								<div>
									<dt class="text-sm font-medium text-gray-500">解析ステータス</dt>
									<dd class="mt-1 text-sm text-gray-900">
										<span
											class="rounded px-2 py-1 text-xs {report.metadata.xmp.parseStatus === 'ok'
												? 'bg-green-100 text-green-800'
												: 'bg-red-100 text-red-800'}"
										>
											{report.metadata.xmp.parseStatus === 'ok' ? 'OK' : '失敗'}
										</span>
									</dd>
								</div>
								<div>
									<dt class="text-sm font-medium text-gray-500">SHA-256</dt>
									<dd class="mt-1 font-mono text-xs break-all text-gray-900">
										{report.metadata.xmp.rawSha256}
									</dd>
								</div>
								{#if report.metadata.xmp.summary}
									<div>
										<dt class="text-sm font-medium text-gray-500">サマリー</dt>
										<dd class="mt-1 text-sm text-gray-900">
											<pre class="text-xs break-all whitespace-pre-wrap">{JSON.stringify(
													report.metadata.xmp.summary,
													null,
													2
												)}</pre>
										</dd>
									</div>
								{/if}
							</dl>
						</div>
					{/if}

					{#if report.metadata.documentIds && report.metadata.documentIds.length > 0}
						<div>
							<h3 class="mb-2 text-sm font-semibold text-gray-700">ドキュメントID</h3>
							<dl class="space-y-2">
								{#each report.metadata.documentIds as id (id)}
									<div>
										<dd class="font-mono text-xs break-all text-gray-900">{id}</dd>
									</div>
								{/each}
							</dl>
						</div>
					{/if}
				</div>
			</div>
		{/if}

		<!-- 埋め込みファイル -->
		{#if report.embedded.files.length > 0}
			<div class="mb-6 overflow-hidden rounded-lg border border-gray-200 bg-white">
				<div class="border-b border-gray-200 bg-gray-50 px-4 py-3">
					<div class="flex items-center">
						<Icon icon="mdi:paperclip" class="mr-2 h-5 w-5 text-blue-600" />
						<h2 class="font-semibold text-gray-800">埋め込みファイル</h2>
						<span
							class="ml-2 rounded-full bg-gray-200 px-2 py-1 text-xs font-semibold text-gray-700"
						>
							{report.embedded.files.length}
						</span>
					</div>
				</div>
				<div class="p-4">
					<div class="space-y-4">
						{#each report.embedded.files as file (file.sha256)}
							<div class="rounded-lg border border-gray-200 p-3">
								<div class="mb-2 flex items-center justify-between">
									<span class="font-semibold text-gray-900">{file.name}</span>
									{#if file.size !== undefined}
										<span class="text-xs text-gray-500">{formatFileSize(file.size)}</span>
									{/if}
								</div>
								{#if file.mimetype}
									<div class="mb-1 text-xs text-gray-600">MIME: {file.mimetype}</div>
								{/if}
								{#if file.description}
									<div class="mb-1 text-xs text-gray-600">{file.description}</div>
								{/if}
								<div class="mt-2 font-mono text-xs break-all text-gray-500">
									SHA-256: {file.sha256}
								</div>
							</div>
						{/each}
					</div>
				</div>
			</div>
		{/if}

		<!-- アクティブ要素 -->
		<div class="mb-6 overflow-hidden rounded-lg border border-gray-200 bg-white">
			<div class="border-b border-gray-200 bg-gray-50 px-4 py-3">
				<div class="flex items-center">
					<Icon icon="mdi:flash" class="mr-2 h-5 w-5 text-blue-600" />
					<h2 class="font-semibold text-gray-800">アクティブ要素</h2>
				</div>
			</div>
			<div class="p-4">
				<!-- OpenAction -->
				{#if report.active.openAction}
					<div class="mb-4">
						<h3 class="mb-2 text-sm font-semibold text-gray-700">OpenAction</h3>
						<div class="rounded-lg border border-gray-200 p-3">
							<div class="mb-2">
								<span class="rounded bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-800">
									{report.active.openAction.type}
								</span>
							</div>
							{#if report.active.openAction.url}
								<div class="mt-2">
									<dt class="text-xs font-medium text-gray-500">URL</dt>
									<dd class="mt-1 text-sm break-all text-gray-900">
										<a
											href={report.active.openAction.url}
											target="_blank"
											rel="noopener noreferrer"
											class="text-blue-600 hover:underline"
										>
											{report.active.openAction.url}
										</a>
									</dd>
								</div>
							{/if}
							{#if report.active.openAction.file}
								<div class="mt-2">
									<dt class="text-xs font-medium text-gray-500">ファイル</dt>
									<dd class="mt-1 text-sm break-all text-gray-900">
										{report.active.openAction.file}
									</dd>
								</div>
							{/if}
							{#if report.active.openAction.preview}
								<div class="mt-2">
									<dt class="text-xs font-medium text-gray-500">プレビュー</dt>
									<dd class="mt-1 font-mono text-xs break-all whitespace-pre-wrap text-gray-900">
										{report.active.openAction.preview}
									</dd>
								</div>
							{/if}
							{#if report.active.openAction.sha256}
								<div class="mt-2">
									<dt class="text-xs font-medium text-gray-500">SHA-256</dt>
									<dd class="mt-1 font-mono text-xs break-all text-gray-500">
										{report.active.openAction.sha256}
									</dd>
								</div>
							{/if}
						</div>
					</div>
				{/if}

				<!-- Additional Actions -->
				{#if report.active.additionalActions.length > 0}
					<div class="mb-4">
						<h3 class="mb-2 text-sm font-semibold text-gray-700">
							Additional Actions ({report.active.additionalActions.length})
						</h3>
						<div class="space-y-2">
							{#each report.active.additionalActions as action (action.scope)}
								<div class="rounded-lg border border-gray-200 p-3">
									<div class="mb-2 flex items-center justify-between">
										<span class="text-xs font-semibold text-gray-700">{action.scope}</span>
										<span class="rounded bg-gray-100 px-2 py-1 text-xs text-gray-700">
											{action.type}
										</span>
									</div>
									{#if action.preview}
										<div class="mt-2 font-mono text-xs break-all whitespace-pre-wrap text-gray-900">
											{action.preview}
										</div>
									{/if}
									{#if action.sha256}
										<div class="mt-2 font-mono text-xs break-all text-gray-500">
											SHA-256: {action.sha256}
										</div>
									{/if}
								</div>
							{/each}
						</div>
					</div>
				{/if}

				<!-- JavaScript -->
				{#if report.active.javascript.documentLevel.length > 0 || report.active.javascript.actions.length > 0}
					<div class="mb-4">
						<h3 class="mb-2 text-sm font-semibold text-gray-700">JavaScript</h3>
						{#if report.active.javascript.documentLevel.length > 0}
							<div class="mb-3">
								<h4 class="mb-2 text-xs font-medium text-gray-600">
									Document-level ({report.active.javascript.documentLevel.length})
								</h4>
								<div class="space-y-2">
									{#each report.active.javascript.documentLevel as script (script.sha256)}
										<div class="rounded-lg border border-red-200 bg-red-50 p-3">
											<div class="mb-2 flex items-center justify-between">
												<span class="text-xs font-semibold text-red-800">{script.name}</span>
												{#if script.trigger}
													<span class="rounded bg-red-100 px-2 py-1 text-xs text-red-800">
														{script.trigger}
													</span>
												{/if}
											</div>
											<div
												class="mb-2 font-mono text-xs break-all whitespace-pre-wrap text-red-900"
											>
												{script.preview}
											</div>
											<div class="font-mono text-xs break-all text-red-600">
												SHA-256: {script.sha256}
											</div>
										</div>
									{/each}
								</div>
							</div>
						{/if}
						{#if report.active.javascript.actions.length > 0}
							<div>
								<h4 class="mb-2 text-xs font-medium text-gray-600">
									Actions ({report.active.javascript.actions.length})
								</h4>
								<div class="space-y-2">
									{#each report.active.javascript.actions as script (script.sha256)}
										<div class="rounded-lg border border-red-200 bg-red-50 p-3">
											<div class="mb-2 flex items-center justify-between">
												<span class="text-xs font-semibold text-red-800">{script.name}</span>
												{#if script.trigger}
													<span class="rounded bg-red-100 px-2 py-1 text-xs text-red-800">
														{script.trigger}
													</span>
												{/if}
											</div>
											<div
												class="mb-2 font-mono text-xs break-all whitespace-pre-wrap text-red-900"
											>
												{script.preview}
											</div>
											<div class="font-mono text-xs break-all text-red-600">
												SHA-256: {script.sha256}
											</div>
										</div>
									{/each}
								</div>
							</div>
						{/if}
					</div>
				{/if}

				<!-- 外部参照 -->
				{#if report.active.externalRefs.length > 0}
					<div>
						<h3 class="mb-2 text-sm font-semibold text-gray-700">
							外部参照 ({report.active.externalRefs.length})
						</h3>
						<div class="space-y-2">
							{#each report.active.externalRefs as ref (ref.where)}
								<div class="rounded-lg border border-yellow-200 bg-yellow-50 p-3">
									<div class="mb-2 flex items-center justify-between">
										<span
											class="rounded bg-yellow-100 px-2 py-1 text-xs font-semibold text-yellow-800"
										>
											{ref.kind}
										</span>
										<span class="text-xs text-gray-600">{ref.where}</span>
									</div>
									{#if ref.url}
										<div class="mt-2 text-sm break-all text-gray-900">
											<a
												href={ref.url}
												target="_blank"
												rel="noopener noreferrer"
												class="text-blue-600 hover:underline"
											>
												{ref.url}
											</a>
										</div>
									{/if}
									{#if ref.file}
										<div class="mt-2 text-sm break-all text-gray-900">{ref.file}</div>
									{/if}
								</div>
							{/each}
						</div>
					</div>
				{/if}
			</div>
		</div>

		<!-- フォーム情報 -->
		{#if report.forms.acroFormPresent || report.forms.xfaPresent}
			<div class="mb-6 overflow-hidden rounded-lg border border-gray-200 bg-white">
				<div class="border-b border-gray-200 bg-gray-50 px-4 py-3">
					<div class="flex items-center">
						<Icon icon="mdi:form-select" class="mr-2 h-5 w-5 text-blue-600" />
						<h2 class="font-semibold text-gray-800">フォーム情報</h2>
					</div>
				</div>
				<div class="p-4">
					<dl class="grid grid-cols-1 gap-3 md:grid-cols-2">
						<div>
							<dt class="text-sm font-medium text-gray-500">AcroForm</dt>
							<dd class="mt-1 text-sm text-gray-900">
								{report.forms.acroFormPresent ? 'Yes' : 'No'}
							</dd>
						</div>
						<div>
							<dt class="text-sm font-medium text-gray-500">XFA</dt>
							<dd class="mt-1 text-sm text-gray-900">{report.forms.xfaPresent ? 'Yes' : 'No'}</dd>
						</div>
						<div>
							<dt class="text-sm font-medium text-gray-500">フィールド数</dt>
							<dd class="mt-1 text-sm text-gray-900">{report.forms.fieldCount}</dd>
						</div>
						<div>
							<dt class="text-sm font-medium text-gray-500">計算/検証</dt>
							<dd class="mt-1 text-sm text-gray-900">
								{report.forms.hasCalcOrValidate ? 'Yes' : 'No'}
							</dd>
						</div>
					</dl>
				</div>
			</div>
		{/if}

		<!-- セキュリティ情報 -->
		<div class="mb-6 overflow-hidden rounded-lg border border-gray-200 bg-white">
			<div class="border-b border-gray-200 bg-gray-50 px-4 py-3">
				<div class="flex items-center">
					<Icon icon="mdi:shield-lock" class="mr-2 h-5 w-5 text-blue-600" />
					<h2 class="font-semibold text-gray-800">セキュリティ情報</h2>
				</div>
			</div>
			<div class="p-4">
				<dl class="space-y-3">
					<div>
						<dt class="text-sm font-medium text-gray-500">暗号化</dt>
						<dd class="mt-1 text-sm text-gray-900">
							{#if report.security.encrypted}
								<span class="rounded bg-yellow-100 px-2 py-1 text-xs font-semibold text-yellow-800"
									>Yes</span
								>
							{:else}
								<span class="rounded bg-green-100 px-2 py-1 text-xs font-semibold text-green-800"
									>No</span
								>
							{/if}
						</dd>
					</div>
					{#if report.security.encryptionFilter}
						<div>
							<dt class="text-sm font-medium text-gray-500">暗号化フィルタ</dt>
							<dd class="mt-1 text-sm text-gray-900">{report.security.encryptionFilter}</dd>
						</div>
					{/if}
					{#if report.security.signatures.length > 0}
						<div>
							<dt class="text-sm font-medium text-gray-500">署名</dt>
							<dd class="mt-1">
								<div class="space-y-2">
									{#each report.security.signatures as sig (sig.field)}
										<div class="rounded-lg border border-gray-200 p-2">
											<div class="text-xs font-semibold text-gray-700">{sig.field}</div>
											<div class="text-xs text-gray-600">{sig.subfilter}</div>
											<div class="text-xs text-gray-600">
												全文書カバー: {sig.coversWholeDoc ? 'Yes' : 'No'}
											</div>
										</div>
									{/each}
								</div>
							</dd>
						</div>
					{/if}
					{#if report.security.permissions}
						<div>
							<dt class="text-sm font-medium text-gray-500">権限</dt>
							<dd class="mt-1">
								<div class="grid grid-cols-2 gap-2 text-xs">
									<div>印刷: {report.security.permissions.printing ? 'Yes' : 'No'}</div>
									<div>内容変更: {report.security.permissions.modifyContents ? 'Yes' : 'No'}</div>
									<div>テキストコピー: {report.security.permissions.copyText ? 'Yes' : 'No'}</div>
									<div>
										注釈変更: {report.security.permissions.modifyAnnotations ? 'Yes' : 'No'}
									</div>
									<div>フォーム入力: {report.security.permissions.fillForms ? 'Yes' : 'No'}</div>
									<div>テキスト抽出: {report.security.permissions.extractText ? 'Yes' : 'No'}</div>
									<div>組み立て: {report.security.permissions.assemble ? 'Yes' : 'No'}</div>
									<div>高解像度印刷: {report.security.permissions.printHighRes ? 'Yes' : 'No'}</div>
								</div>
							</dd>
						</div>
					{/if}
				</dl>
			</div>
		</div>
	{/if}
</div>

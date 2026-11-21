/**
 * PDFメタデータ解析 - PDF解析ユーティリティ
 */

import {
	PDFAcroSignature,
	PDFArray,
	PDFDict,
	PDFDocument,
	PDFHexString,
	PDFName,
	PDFNumber,
	PDFObject,
	PDFRawStream,
	PDFRef,
	PDFString,
	decodePDFRawStream,
	hasUtf16BOM,
	pdfDocEncodingDecode,
	utf16Decode
} from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import type { PDFReport } from './types';

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

function pdfText(value: PDFObject | undefined): string | null {
	if (value instanceof PDFString || value instanceof PDFHexString) return value.decodeText();
	return null;
}

async function readAction(value: PDFObject | undefined): Promise<RawAction | null> {
	if (!(value instanceof PDFDict)) return null;
	const kind = value.lookup(PDFName.of('S'));
	if (!(kind instanceof PDFName)) return null;
	const type = kind.decodeText();
	if (type === 'JavaScript') {
		const js = value.lookup(PDFName.of('JS'));
		let code = pdfText(js);
		if (js instanceof PDFRawStream) {
			try {
				const script = decodePDFRawStream(js).decode();
				code = hasUtf16BOM(script) ? utf16Decode(script) : pdfDocEncodingDecode(script);
			} catch {
				return { type };
			}
		}
		return code === null
			? { type }
			: { type, preview: preview(code, 800), sha256: await sha256Hex(code) };
	}
	if (type === 'URI') return { type, url: pdfText(value.lookup(PDFName.of('URI'))) };
	if (type === 'Launch' || type === 'GoToR') {
		const file = value.lookup(PDFName.of('F'));
		return {
			type,
			file:
				file instanceof PDFDict
					? (pdfText(file.lookup(PDFName.of('UF'))) ?? pdfText(file.lookup(PDFName.of('F'))))
					: pdfText(file)
		};
	}
	return { type };
}

/** PDF.js の表示用 API が省略する辞書を、間接参照とオブジェクトストリームを解決して読む。 */
async function readStructure(bytes: Uint8Array) {
	const doc = await PDFDocument.load(bytes, { updateMetadata: false, ignoreEncryption: true });
	const ids = doc.context.lookup(doc.context.trailerInfo.ID);
	const documentIds =
		ids instanceof PDFArray
			? ids
					.asArray()
					.map((id) => doc.context.lookup(id))
					.filter(
						(id): id is PDFString | PDFHexString =>
							id instanceof PDFString || id instanceof PDFHexString
					)
					.map((id) => Array.from(id.asBytes(), (b) => b.toString(16).padStart(2, '0')).join(''))
			: [];
	const signatures: PDFReport['security']['signatures'] = [];
	const additionalActions: PDFReport['active']['additionalActions'] = [];
	const externalRefs: PDFReport['active']['externalRefs'] = [];
	const scripts: PDFReport['active']['javascript']['actions'] = [];

	function recordAction(action: RawAction, where: string) {
		if (action.type === 'URI' || action.type === 'Launch' || action.type === 'GoToR') {
			externalRefs.push({ kind: action.type, where, url: action.url, file: action.file });
		}
		if (
			action.type === 'JavaScript' &&
			action.sha256 &&
			action.preview !== null &&
			action.preview !== undefined
		) {
			scripts.push({ name: where, trigger: where, preview: action.preview, sha256: action.sha256 });
		}
	}
	// 暗号化された文字列は PDF.js が復号して取得した情報のみ表示する。
	const openAction = doc.isEncrypted
		? null
		: await readAction(doc.catalog.lookup(PDFName.of('OpenAction')));
	if (openAction) recordAction(openAction, 'OpenAction');
	if (!doc.isEncrypted) {
		const aa = doc.catalog.lookup(PDFName.of('AA'));
		if (aa instanceof PDFDict)
			for (const key of aa.keys()) {
				const action = await readAction(aa.lookup(key));
				if (action) {
					const scope = `Catalog.AA/${key.decodeText()}`;
					additionalActions.push({ scope, ...action });
					recordAction(action, scope);
				}
			}
		for (const [pageIndex, page] of doc.getPages().entries()) {
			const annotations = page.node.Annots();
			if (!annotations) continue;
			for (const [i, ref] of annotations.asArray().entries()) {
				const annot = doc.context.lookup(ref);
				if (!(annot instanceof PDFDict)) continue;
				const action = await readAction(annot.lookup(PDFName.of('A')));
				if (action)
					recordAction(
						action,
						`page:${pageIndex + 1} annot:${ref instanceof PDFRef ? ref.objectNumber + 'R' + (ref.generationNumber || '') : i}`
					);
			}
		}
	}
	for (const [ref, obj] of doc.context.enumerateIndirectObjects()) {
		if (!(obj instanceof PDFDict)) continue;
		if (!doc.isEncrypted && obj.lookup(PDFName.of('S')) === PDFName.of('JavaScript')) {
			const action = await readAction(obj);
			if (action) recordAction(action, `obj:${ref.objectNumber} ${ref.generationNumber}`);
		}
	}
	for (const [field, ref] of doc.catalog.getAcroForm()?.getAllFields() ?? []) {
		if (!(field instanceof PDFAcroSignature)) continue;
		const sig = field.V();
		if (!(sig instanceof PDFDict)) continue;
		const sub = sig.lookup(PDFName.of('SubFilter'));
		const ranges = sig.lookup(PDFName.of('ByteRange'));
		const numbers =
			ranges instanceof PDFArray
				? ranges.asArray().map((v) => (v instanceof PDFNumber ? v.asNumber() : NaN))
				: [];
		signatures.push({
			field: (!doc.isEncrypted && field.getFullyQualifiedName()) || ref.toString(),
			subfilter: sub instanceof PDFName ? sub.decodeText() : null,
			coversWholeDoc:
				numbers.length === 4 &&
				numbers.every((n) => Number.isSafeInteger(n) && n >= 0) &&
				numbers[1] <= numbers[2]
					? numbers[0] === 0 && numbers[2] + numbers[3] === bytes.length
					: undefined
		});
	}
	return {
		openAction,
		additionalActions,
		externalRefs,
		scripts,
		documentIds: documentIds.length ? documentIds : null,
		signatures
	};
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
		// PDF.js はこのバッファを Worker に転送する。辞書解析用の原本は手元に残す。
		data: bytes.slice()
	});

	const pdf = await loadingTask.promise;

	let infoDict: Record<string, unknown> = {};
	let xmp: PDFReport['metadata']['xmp'] = null;

	try {
		const md = await pdf.getMetadata();
		infoDict = safeInfoToDict(md.info);
		if (md.metadata) {
			try {
				const raw = md.metadata.getRaw();
				const rawSha256 = await sha256Hex(raw);
				xmp = {
					parseStatus: 'ok',
					rawSha256,
					summary: md.metadata.getAll()
				};
			} catch {
				xmp = { parseStatus: 'fail', rawSha256: null };
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
		const att = await pdf.getAttachments();
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
		const jsActions = (await pdf.getJSActions()) as Record<string, string[]> | null;
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
			const pageJsActions = (await page.getJSActions()) as Record<string, string[]> | null;
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

				for (const c of candidates.flat()) {
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

	const structure = await readStructure(bytes).catch(() => null);
	const encryptionFilter =
		typeof infoDict.EncryptFilterName === 'string' ? infoDict.EncryptFilterName : null;
	const flags = await pdf.getPermissions().catch(() => null);
	const pf = pdfjsLib.PermissionFlag;
	const permissions = flags
		? {
				printing: flags.includes(pf.PRINT),
				modifyContents: flags.includes(pf.MODIFY_CONTENTS),
				copyText: flags.includes(pf.COPY),
				modifyAnnotations: flags.includes(pf.MODIFY_ANNOTATIONS),
				fillForms: flags.includes(pf.FILL_INTERACTIVE_FORMS),
				extractText: flags.includes(pf.COPY_FOR_ACCESSIBILITY),
				assemble: flags.includes(pf.ASSEMBLE),
				printHighRes: flags.includes(pf.PRINT_HIGH_QUALITY)
			}
		: null;
	const fieldObjects = await pdf.getFieldObjects().catch(() => null);
	const fields = Object.values(fieldObjects ?? {}) as {
		type?: string;
		actions?: Record<string, unknown>;
	}[][];
	const seen = new Set([...docJs, ...actionJs].map((js) => js.sha256));
	for (const js of structure?.scripts ?? []) {
		if (seen.has(js.sha256)) continue;
		seen.add(js.sha256);
		actionJs.push(js);
	}
	const rawRefs = structure?.externalRefs ?? [];
	const report: PDFReport = {
		file: {
			path: fileName,
			size: bytes.length,
			sha256: fileHash,
			pages: pdf.numPages,
			version: typeof infoDict.PDFFormatVersion === 'string' ? infoDict.PDFFormatVersion : null
		},
		metadata: {
			infoDict,
			xmp,
			documentIds: structure?.documentIds ?? null
		},
		embedded: {
			files: embeddedFiles
		},
		active: {
			openAction: structure?.openAction ?? null,
			additionalActions: structure?.additionalActions ?? [],
			javascript: {
				documentLevel: docJs,
				actions: actionJs
			},
			externalRefs: [
				...rawRefs,
				...externalRefs.filter((r) => !rawRefs.some((raw) => raw.where === r.where))
			]
		},
		forms: {
			acroFormPresent: infoDict.IsAcroFormPresent === true || fields.length > 0,
			xfaPresent: infoDict.IsXFAPresent === true,
			fieldCount: fields.filter((group) => group.some((f) => !!f.type)).length,
			hasCalcOrValidate: fields.some((group) =>
				group.some((f) => f.actions && ('Calculate' in f.actions || 'Validate' in f.actions))
			)
		},
		security: {
			encrypted: !!encryptionFilter,
			encryptionFilter,
			signatures: structure?.signatures ?? [],
			permissions
		},
		findings: []
	};

	report.findings = makeFindings(report);
	if (structure === null) {
		report.findings.push({
			severity: 'medium',
			code: 'INCOMPLETE_STRUCTURE',
			message:
				'PDFの構造の一部を解析できませんでした。外部参照や署名などの検出結果が不完全な可能性があります。'
		});
	}

	try {
		await pdf.destroy();
	} catch {
		// ignore
	}

	return report;
}

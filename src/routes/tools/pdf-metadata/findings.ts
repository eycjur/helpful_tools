/**
 * PDFメタデータ解析 - セキュリティFinding生成
 */

import type { PDFReport, Finding } from './types';

/**
 * PDFレポートからセキュリティFindingsを生成
 */
export function makeFindings(report: PDFReport): Finding[] {
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

import { describe, it, expect } from 'vitest';
import { makeFindings } from './findings';
import type { PDFReport } from './types';

function baseReport(): PDFReport {
	return {
		file: { path: 'sample.pdf', size: 1, sha256: 'hash', pages: 1, version: '1.7' },
		metadata: { infoDict: {}, xmp: null, documentIds: null },
		embedded: { files: [] },
		active: {
			openAction: null,
			additionalActions: [],
			javascript: { documentLevel: [], actions: [] },
			externalRefs: []
		},
		forms: { acroFormPresent: false, xfaPresent: false, fieldCount: 0, hasCalcOrValidate: false },
		security: { encrypted: false, signatures: [] },
		findings: []
	};
}

describe('PDFメタデータ - Findings', () => {
	it('危険要素がなければ空配列', () => {
		const report = baseReport();
		expect(makeFindings(report)).toEqual([]);
	});

	it('JavaScriptや埋め込みファイルを検出できる', () => {
		const report = baseReport();
		report.active.javascript.documentLevel.push({
			name: 'doc.js',
			preview: 'app.alert(1)',
			sha256: 'a'
		});
		report.active.javascript.actions.push({
			name: 'action.js',
			preview: 'app.launchURL()',
			sha256: 'b'
		});
		report.embedded.files.push({ name: 'payload.bin', size: 10, sha256: 'c' });
		report.security.encrypted = true;
		report.active.externalRefs.push({ kind: 'URI', where: 'annot', url: 'http://x' });

		const findings = makeFindings(report);
		const codes = findings.map((f) => f.code);
		expect(codes).toContain('DOC_JS');
		expect(codes).toContain('ACTION_JS');
		expect(codes).toContain('EMBEDDED_FILES');
		expect(codes).toContain('ENCRYPTED');
		expect(codes).toContain('EXTERNAL_REFS');
	});
});

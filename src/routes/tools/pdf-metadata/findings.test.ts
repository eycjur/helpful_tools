import { describe, it, expect } from 'vitest';
import { makeFindings } from './findings';
import type { PDFReport } from './types';

describe('PDF解析 - Findings生成', () => {
	// ベースとなる空のレポート
	const emptyReport: PDFReport = {
		file: {
			path: 'test.pdf',
			size: 1024,
			sha256: 'abc123',
			pages: 1,
			version: '1.4'
		},
		metadata: {
			infoDict: {},
			xmp: null,
			documentIds: null
		},
		embedded: {
			files: []
		},
		active: {
			openAction: null,
			additionalActions: [],
			javascript: {
				documentLevel: [],
				actions: []
			},
			externalRefs: []
		},
		security: {
			encrypted: false,
			hasSignatures: false,
			permissions: {}
		},
		form: null
	};

	it('Document-level JavaScriptが含まれる場合にhigh重要度を返す', () => {
		const report: PDFReport = {
			...emptyReport,
			active: {
				...emptyReport.active,
				javascript: {
					documentLevel: [{ code: 'app.alert("test")', sha256: 'abc123' }],
					actions: []
				}
			}
		};

		const findings = makeFindings(report);
		const jsFinding = findings.find((f) => f.code === 'DOC_JS');

		expect(jsFinding).toBeDefined();
		expect(jsFinding?.severity).toBe('high');
		expect(jsFinding?.message).toContain('Document-level JavaScript');
	});

	it('JavaScript Actionが含まれる場合にhigh重要度を返す', () => {
		const report: PDFReport = {
			...emptyReport,
			active: {
				...emptyReport.active,
				javascript: {
					documentLevel: [],
					actions: [{ scope: 'annotation', code: 'test', sha256: 'abc123' }]
				}
			}
		};

		const findings = makeFindings(report);
		const actionFinding = findings.find((f) => f.code === 'ACTION_JS');

		expect(actionFinding).toBeDefined();
		expect(actionFinding?.severity).toBe('high');
		expect(actionFinding?.message).toContain('JavaScript Action');
	});

	it('埋め込みファイルがある場合にhigh重要度を返す', () => {
		const report: PDFReport = {
			...emptyReport,
			embedded: {
				files: [
					{ name: 'file1.txt', size: 100, sha256: 'abc123' },
					{ name: 'file2.doc', size: 200, sha256: 'def456' }
				]
			}
		};

		const findings = makeFindings(report);
		const embeddedFinding = findings.find((f) => f.code === 'EMBEDDED_FILES');

		expect(embeddedFinding).toBeDefined();
		expect(embeddedFinding?.severity).toBe('high');
		expect(embeddedFinding?.message).toContain('2件');
	});

	it('暗号化されている場合にmedium重要度を返す', () => {
		const report: PDFReport = {
			...emptyReport,
			security: {
				...emptyReport.security,
				encrypted: true
			}
		};

		const findings = makeFindings(report);
		const encryptedFinding = findings.find((f) => f.code === 'ENCRYPTED');

		expect(encryptedFinding).toBeDefined();
		expect(encryptedFinding?.severity).toBe('medium');
		expect(encryptedFinding?.message).toContain('暗号化');
	});

	it('外部参照がある場合にmedium重要度を返す', () => {
		const report: PDFReport = {
			...emptyReport,
			active: {
				...emptyReport.active,
				externalRefs: [
					{ type: 'URI', uri: 'https://example.com' },
					{ type: 'Launch', file: 'malware.exe' }
				]
			}
		};

		const findings = makeFindings(report);
		const refsFinding = findings.find((f) => f.code === 'EXTERNAL_REFS');

		expect(refsFinding).toBeDefined();
		expect(refsFinding?.severity).toBe('medium');
		expect(refsFinding?.message).toContain('2件');
	});

	it('問題がない場合は空配列を返す', () => {
		const findings = makeFindings(emptyReport);
		expect(findings).toHaveLength(0);
	});

	it('複数の問題がある場合はすべてのFindingsを返す', () => {
		const report: PDFReport = {
			...emptyReport,
			active: {
				...emptyReport.active,
				javascript: {
					documentLevel: [{ code: 'test', sha256: 'abc' }],
					actions: [{ scope: 'annotation', code: 'test2', sha256: 'def' }]
				},
				externalRefs: [{ type: 'URI', uri: 'https://example.com' }]
			},
			embedded: {
				files: [{ name: 'file.txt', size: 100, sha256: 'ghi' }]
			},
			security: {
				...emptyReport.security,
				encrypted: true
			}
		};

		const findings = makeFindings(report);

		// 5つのFindingが生成されるはず
		expect(findings.length).toBe(5);
		expect(findings.some((f) => f.code === 'DOC_JS')).toBe(true);
		expect(findings.some((f) => f.code === 'ACTION_JS')).toBe(true);
		expect(findings.some((f) => f.code === 'EMBEDDED_FILES')).toBe(true);
		expect(findings.some((f) => f.code === 'ENCRYPTED')).toBe(true);
		expect(findings.some((f) => f.code === 'EXTERNAL_REFS')).toBe(true);
	});
});

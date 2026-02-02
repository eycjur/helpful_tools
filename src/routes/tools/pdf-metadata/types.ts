/**
 * PDF Metadata 型定義
 */

export type FindingSeverity = 'high' | 'medium' | 'low' | 'info';

export type Finding = {
	severity: FindingSeverity;
	code: string;
	message: string;
};

export type PDFReport = {
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

export type ParsedValue =
	| { type: 'literal'; value: string }
	| { type: 'hex'; value: Uint8Array }
	| { type: 'name'; value: string }
	| { type: 'number'; value: number }
	| { type: 'array'; value: string }
	| { type: 'dict'; value: string }
	| { type: 'null' }
	| { type: 'unknown'; value: string };

export type RawObject = {
	objNum: number;
	genNum: number;
	body: string;
};

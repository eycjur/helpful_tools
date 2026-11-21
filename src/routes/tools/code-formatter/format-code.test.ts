import { describe, expect, it } from 'vitest';
import { formatCode } from './format-code';

const options = {
	removeEmptyLineSpaces: true,
	removeTrailingSpaces: true,
	convertTabsToSpaces: true,
	tabSize: 4
};

describe('formatCode', () => {
	it('reports processed rows and preserves the original line endings', () => {
		expect(formatCode('\tx \r\n  \ny\r', options)).toEqual({
			output: '    x\r\n\ny\r',
			stats: {
				emptyLinesWithSpaces: 1,
				trailingSpacesRemoved: 1,
				tabsConverted: 1,
				totalSpacesRemoved: 3,
				linesProcessed: 4
			}
		});
	});

	it('keeps whitespace-only rows when their own option is off', () => {
		expect(formatCode('  \n\t', { ...options, removeEmptyLineSpaces: false }).output).toBe(
			'  \n    '
		);
		expect(formatCode('  \n\t', options).output).toBe('\n');
	});

	it.each([undefined, -1, 1, 2.5, 9])('keeps tabs while the tab size %s is invalid', (tabSize) => {
		expect(formatCode('\tx ', { ...options, tabSize }).output).toBe('\tx');
	});
});

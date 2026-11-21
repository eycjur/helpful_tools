const LATEX_ESCAPE: Record<string, string> = {
	'\\': '\\textbackslash{}',
	$: '\\$',
	'&': '\\&',
	'%': '\\%',
	'#': '\\#',
	'^': '\\textasciicircum{}',
	_: '\\_',
	'{': '\\{',
	'}': '\\}',
	'~': '\\textasciitilde{}'
};

export function escapeLatex(text: string): string {
	return text.replace(/[\\$&%#^_{}~]/g, (character) => LATEX_ESCAPE[character]);
}

export function formatLatexCell(text: string): string {
	const lines = text.split(/\r\n|\r|\n/);
	if (lines.length === 1) {
		const escaped = escapeLatex(text);
		// 行頭の [ や * を、直前の \\ の引数にしない。
		return /^[ \t]*(?:\[|\*)/.test(escaped) ? '{}' + escaped : escaped;
	}

	return (
		'\\shortstack[l]{' + lines.map((line) => '\\strut ' + escapeLatex(line)).join(' \\\\ ') + '}'
	);
}

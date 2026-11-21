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
	if (lines.length === 1) return escapeLatex(text);

	return (
		'\\shortstack[l]{' + lines.map((line) => '\\strut ' + escapeLatex(line)).join(' \\\\ ') + '}'
	);
}

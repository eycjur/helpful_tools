import TurndownService from 'turndown';

interface MarkdownOptions {
	newLineAsParagraph?: boolean;
	preserveLineBreaks?: boolean;
	ignoreBoldInHeader?: boolean;
}

export function getHtmlEditorSource(editor: HTMLElement): string {
	const text = editor.innerText;
	const hasHtmlTag = /<\/?[a-z][^>]*>/i.test(text);
	const hasRichText = editor.querySelector(':not(div, br), div[class], div[style]');
	return hasHtmlTag && !hasRichText ? text : editor.innerHTML;
}

export function convertHtmlToMarkdown(html: string, options: MarkdownOptions = {}): string {
	const source = document.createElement('template');
	source.innerHTML = html;

	for (const container of source.content.querySelectorAll('.ql-code-block-container')) {
		const pre = document.createElement('pre');
		const code = document.createElement('code');
		code.textContent = Array.from(container.children, (line) => line.textContent ?? '').join('\n');
		pre.append(code);
		container.replaceWith(pre);
	}

	const turndown = new TurndownService({
		headingStyle: 'atx',
		codeBlockStyle: 'fenced',
		hr: '---',
		bulletListMarker: '-'
	});

	turndown.remove(['script', 'style', 'title', 'template']);

	turndown.addRule('quillListItem', {
		filter: (node) => node.nodeName === 'LI' && node.hasAttribute('data-list'),
		replacement(content, node) {
			const indent = (node as HTMLElement).className.match(/(?:^|\s)ql-indent-(\d+)(?:\s|$)/);
			const prefix = (node as HTMLElement).getAttribute('data-list') === 'ordered' ? '1. ' : '- ';
			return '    '.repeat(Number(indent?.[1] ?? 0)) + prefix + content + '\n';
		}
	});

	turndown.addRule('table', {
		filter: ['table'],
		replacement(_content, node) {
			const rows = Array.from((node as HTMLTableElement).rows);
			const header = rows[0];
			if (!header?.cells.length) return '';

			const renderRow = (row: HTMLTableRowElement) =>
				'| ' +
				Array.from(row.cells, (cell) =>
					(cell.textContent ?? '')
						.trim()
						.replace(/\s*\n\s*/g, ' ')
						.replaceAll('|', '\\|')
				).join(' | ') +
				' |';
			const separator = '| --- '.repeat(header.cells.length) + '|';
			return (
				'\n\n' + [renderRow(header), separator, ...rows.slice(1).map(renderRow)].join('\n') + '\n\n'
			);
		}
	});

	if (options.ignoreBoldInHeader) {
		turndown.addRule('headingBold', {
			filter: (node) =>
				(node.nodeName === 'B' || node.nodeName === 'STRONG') &&
				node.closest('h1, h2, h3, h4, h5, h6') !== null,
			replacement: (content) => content
		});
	}

	if (options.newLineAsParagraph) {
		turndown.addRule('paragraphBreak', {
			filter: ['br'],
			replacement: () => '\n\n'
		});
	}

	let markdown = turndown.turndown(source.content);
	if (!options.preserveLineBreaks && !options.newLineAsParagraph) {
		// フェンス内の空行はコードの一部なので保持する。
		markdown = markdown.replace(/^(`{3,})[^\n]*\n[\s\S]*?^\1(?=\n|$)|\n{2,}/gm, (part, fence) =>
			fence ? part : '\n'
		);
	}
	return markdown;
}

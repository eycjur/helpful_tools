<script lang="ts">
	import { tools } from '$lib/data/tools';
	import Icon from '@iconify/svelte';
	import { escapeLatex } from './latex-escape';

	let inputData = '';
	let latexOutput = '';
	let delimiter = 'auto'; // 'auto', 'comma', 'tab'
	let headerRow = true;

	const tool = tools.find((t) => t.name === 'csv-to-latex');

	function detectDelimiter(text: string): string {
		const lines = text.trim().split('\n');
		if (lines.length === 0) return 'comma';

		const firstLine = lines[0];
		const commaCount = (firstLine.match(/,/g) || []).length;
		const tabCount = (firstLine.match(/\t/g) || []).length;

		// If there are tabs and more tabs than commas, assume tab-separated
		if (tabCount > 0 && tabCount >= commaCount) {
			return 'tab';
		}
		// Otherwise assume comma-separated
		return 'comma';
	}

	function parseCSV(text: string, delimiter: string): string[][] {
		if (!text.trim()) return [];

		const lines = text.trim().split('\n');
		const result: string[][] = [];
		const sep = delimiter === 'tab' ? '\t' : ',';

		for (const line of lines) {
			if (delimiter === 'comma') {
				// Simple CSV parsing - handles quoted fields
				const row: string[] = [];
				let current = '';
				let inQuotes = false;

				for (let i = 0; i < line.length; i++) {
					const char = line[i];

					if (char === '"') {
						if (inQuotes && line[i + 1] === '"') {
							// Escaped quote
							current += '"';
							i++; // Skip next quote
						} else {
							// Toggle quote state
							inQuotes = !inQuotes;
						}
					} else if (char === ',' && !inQuotes) {
						// End of field
						row.push(current.trim());
						current = '';
					} else {
						current += char;
					}
				}
				// Add the last field
				row.push(current.trim());
				result.push(row);
			} else {
				// Tab-separated - simple split
				result.push(line.split(sep).map((cell) => cell.trim()));
			}
		}

		return result;
	}

	function generateLatexTable(data: string[][]): string {
		if (data.length === 0) return '';

		const maxCols = Math.max(...data.map((row) => row.length));
		if (maxCols === 0) return '';

		// Column specification
		const colSpec = 'l'.repeat(maxCols);

		let latex = '\\begin{table}\n';
		latex += '\\begin{center}\n';
		latex += '\\caption{表のキャプション}\n';
		latex += '\\label{tab:label}\n';
		latex += `\\begin{tabular}{${colSpec}}\n`;
		latex += '\\hline\n';

		// Process rows
		for (let i = 0; i < data.length; i++) {
			const row = data[i];
			const paddedRow = [...row];

			// Pad row to max columns
			while (paddedRow.length < maxCols) {
				paddedRow.push('');
			}

			// Escape LaTeX special characters
			const escapedRow = paddedRow.map((cell) => escapeLatex(cell));

			// Join with & and add line ending
			latex += escapedRow.join(' & ') + ' \\\\\n';

			// Add horizontal line after header row or at the end
			if ((headerRow && i === 0) || i === data.length - 1) {
				latex += '\\hline\n';
			}
		}

		latex += '\\end{tabular}\n';
		latex += '\\end{center}\n';
		latex += '\\end{table}';

		return latex;
	}

	function convertToLatex() {
		if (!inputData.trim()) {
			latexOutput = '';
			return;
		}

		// Determine delimiter
		const actualDelimiter = delimiter === 'auto' ? detectDelimiter(inputData) : delimiter;

		// Parse CSV/TSV
		const data = parseCSV(inputData, actualDelimiter);

		// Generate LaTeX
		const latex = generateLatexTable(data);
		latexOutput = latex;

		// Auto-copy to clipboard
		if (latex.trim()) {
			navigator.clipboard.writeText(latex).catch((err) => {
				console.error('自動コピーに失敗しました: ', err);
			});
		}
	}

	function handleInput() {
		convertToLatex();
	}

	function clearInput() {
		inputData = '';
		latexOutput = '';
	}

	// Watch for changes in options
	$: if (inputData) convertToLatex();
</script>

<div class="mx-auto max-w-6xl">
	<div class="mb-6 flex items-center">
		{#if tool?.icon}<Icon icon={tool.icon} class="mr-4 h-10 w-10" />{/if}
		<h1 class="text-3xl font-bold">{tool?.nameJa}</h1>
	</div>

	<div class="mb-6 grid grid-cols-1 gap-6 md:grid-cols-2">
		<!-- 入力エリア -->
		<div class="flex flex-col">
			<div class="mb-2 flex items-center justify-between">
				<div class="text-sm font-medium text-gray-700">【入力】CSV/Excel データ</div>
				<button
					on:click={clearInput}
					class="rounded bg-gray-500 px-3 py-1 text-sm text-white transition-colors hover:bg-gray-600"
				>
					クリア
				</button>
			</div>
			<textarea
				bind:value={inputData}
				on:input={handleInput}
				rows="20"
				placeholder="CSV/TSVデータを入力してください..."
				class="min-h-96 flex-1 resize-none rounded-lg border border-gray-300 p-3 font-mono text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500 focus:outline-none"
			></textarea>
		</div>

		<!-- 出力エリア -->
		<div class="flex flex-col">
			<div class="mb-2">
				<div class="text-sm font-medium text-gray-700">【出力】LaTeX表形式（自動コピー）</div>
			</div>
			<pre
				class="min-h-96 flex-1 overflow-auto rounded-lg border border-gray-300 bg-gray-50 p-3 font-mono text-sm whitespace-pre-wrap">{latexOutput}</pre>
		</div>
	</div>

	<!-- 使用方法 -->
	<div class="rounded-lg bg-blue-50 p-4">
		<h2 class="mb-2 text-lg font-semibold">使用方法</h2>
		<ul class="space-y-1 text-sm text-gray-700">
			<li>• ExcelやGoogleスプレッドシートからデータをコピーして左側に貼り付けてください</li>
			<li>• CSV形式（カンマ区切り）またはTSV形式（タブ区切り）に対応しています</li>
			<li>• 自動的にLaTeX表形式に変換されて右側に表示されます</li>
			<li>• 変換されたLaTeXコードは自動的にクリップボードにコピーされます</li>
			<li>
				• LaTeX特殊文字（$, &amp;, %, #, ^, _, &#123;, &#125;, \\,
				&#126;）は自動的にエスケープされます
			</li>
		</ul>
	</div>
</div>

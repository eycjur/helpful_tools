<script lang="ts">
	import { parsePlainTable } from '../_shared/delimited-table';
	import { tools } from '$lib/data/tools';
	import Icon from '@iconify/svelte';
	import { formatLatexCell } from './latex-escape';

	let inputData = '';
	let latexOutput = '';

	const tool = tools.find((t) => t.name === 'csv-to-latex');

	function generateLatexTable(data: string[][]): string {
		if (data.length === 0) return '';

		const maxCols = data.reduce((max, row) => Math.max(max, row.length), 0);
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
			const escapedRow = paddedRow.map(formatLatexCell);

			// Join with & and add line ending
			latex += escapedRow.join(' & ') + ' \\\\\n';

			// Add horizontal line after header row or at the end
			if (i === 0 || i === data.length - 1) {
				latex += '\\hline\n';
			}
		}

		latex += '\\end{tabular}\n';
		latex += '\\end{center}\n';
		latex += '\\end{table}';

		return latex;
	}

	function convertToLatex(input: string) {
		latexOutput = generateLatexTable(parsePlainTable(input));
		if (latexOutput) {
			navigator.clipboard?.writeText(latexOutput).catch((err) => {
				console.error('自動コピーに失敗しました: ', err);
			});
		}
	}

	function clearInput() {
		inputData = '';
		latexOutput = '';
	}

	$: convertToLatex(inputData);
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

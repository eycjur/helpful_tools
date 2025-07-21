<script lang="ts">
	import { tools } from '$lib/data/tools';
	import { onMount } from 'svelte';
	import Quill from 'quill';
	import TurndownService from 'turndown';
	import 'quill/dist/quill.snow.css';

	let quillEditor: HTMLDivElement;
	let quill: Quill | null = null;
	let markdownOutput = '';
	let isNewLineAsParagraph = false;
	let isIgnoreBoldInHeader = true;
	let copyButtonText = 'コピー';
	let turndownService: TurndownService;

	const tool = tools.find((t) => t.name === 'richtext-to-markdown');

	function copyToClipboard() {
		navigator.clipboard
			.writeText(markdownOutput)
			.then(() => {
				copyButtonText = '成功！';
				setTimeout(() => {
					copyButtonText = 'コピー';
				}, 1000);
			})
			.catch((err) => {
				console.error('コピーに失敗しました: ', err);
				alert('コピーに失敗しました');
			});
	}

	function richtextToMarkdown() {
		if (!quill || !turndownService) return;

		const textHtml = quill.root.innerHTML;
		if (!textHtml.trim() || textHtml === '<p><br></p>') {
			markdownOutput = '';
			return;
		}

		// TurndownServiceを使ってHTML→Markdown変換
		let textMarkdown = turndownService.turndown(textHtml);

		// 改行処理
		if (!isNewLineAsParagraph) {
			textMarkdown = textMarkdown.replace(/\n\n/g, '\n');
		}

		// 見出し内の太字を無視
		if (isIgnoreBoldInHeader) {
			textMarkdown = textMarkdown.replace(/^(#+) \*\*(.+?)\*\*$/gm, '$1 $2');
		}

		markdownOutput = textMarkdown;
	}

	function clearEditor() {
		if (quill) {
			quill.setContents([]);
			markdownOutput = '';
		}
	}

	onMount(() => {
		if (!quillEditor) return;

		// Quillエディターの初期化
		quill = new Quill(quillEditor, {
			theme: 'snow',
			modules: {
				toolbar: [
					[{ header: [1, 2, 3, 4, 5, 6, false] }],
					['bold', 'italic', 'underline', 'strike'],
					[{ list: 'ordered' }, { list: 'bullet' }],
					[{ indent: '-1' }, { indent: '+1' }],
					['link', 'code', 'code-block'],
					['clean']
				]
			}
		});

		// TurndownServiceの初期化
		turndownService = new TurndownService({
			headingStyle: 'atx',
			codeBlockStyle: 'fenced',
			hr: '---',
			bulletListMarker: '-'
		});

		// カスタムルールの追加
		turndownService.addRule('list', {
			filter: ['li'],
			replacement: function (content, node) {
				const element = node as HTMLElement;
				let prefix = '';
				if (element.className === 'ql-indent-1') {
					prefix = '    ';
				} else if (element.className === 'ql-indent-2') {
					prefix = '        ';
				} else if (element.className === 'ql-indent-3') {
					prefix = '            ';
				}
				if (element.getAttribute('data-list') === 'ordered') {
					prefix += '1. ';
				} else {
					prefix += '- ';
				}
				return prefix + content + '\n';
			}
		});

		turndownService.addRule('codeBlock', {
			filter: function (node) {
				const element = node as HTMLElement;
				return element.className === 'ql-code-block-container';
			},
			replacement: function (content) {
				return '\n```\n' + content + '```\n\n';
			}
		});

		turndownService.addRule('table', {
			filter: ['table'],
			replacement: function (_content, node) {
				const table = node as HTMLTableElement;
				const header = table.querySelectorAll('tr')[0];
				let row = '';
				for (const th of header.querySelectorAll('td, th')) {
					row += '| ' + th.textContent + ' ';
				}
				let result = '\n' + row + '|\n';

				// ヘッダー行はカラム数がおかしい場合があるので、2行目のカラム数を参照する
				const numColumns =
					table.querySelectorAll('tr')[1]?.querySelectorAll('td, th').length ||
					header.querySelectorAll('td, th').length;
				result += '| --- '.repeat(numColumns) + '|\n';

				for (const tr of Array.from(table.querySelectorAll('tr')).slice(1)) {
					let row = '';
					for (const td of tr.querySelectorAll('td, th')) {
						row += '| ' + td.textContent + ' ';
					}
					result += row + '|\n';
				}
				return result + '\n';
			}
		});

		// テキスト変更の監視
		quill.on('text-change', () => {
			richtextToMarkdown();
		});

		// 初期変換
		richtextToMarkdown();
	});
</script>

<div class="mx-auto max-w-6xl">
	<div class="mb-6 flex items-center">
		<span class="mr-4 text-4xl">{tool?.icon}</span>
		<h1 class="text-3xl font-bold">{tool?.name}</h1>
	</div>

	<div class="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
		<!-- 入力エリア -->
		<div class="flex flex-col">
			<div class="mb-2 flex items-center justify-between">
				<div class="text-sm font-medium text-gray-700"> 【入力】RichText形式 </div>
				<button
					on:click={clearEditor}
					class="rounded bg-gray-500 px-3 py-1 text-sm text-white transition-colors hover:bg-gray-600"
				>
					クリア
				</button>
			</div>
			<div class="min-h-96 overflow-hidden rounded-lg border border-gray-300 bg-white">
				<div bind:this={quillEditor} class="h-96"></div>
			</div>
		</div>

		<!-- 出力エリア -->
		<div class="flex flex-col">
			<div class="mb-2 flex items-center justify-between">
				<div class="text-sm font-medium text-gray-700">【出力】Markdown形式</div>
				<button
					on:click={copyToClipboard}
					class="rounded bg-blue-500 px-3 py-1 text-sm text-white transition-colors hover:bg-blue-600"
					disabled={!markdownOutput}
				>
					{copyButtonText}
				</button>
			</div>
			<pre
				class="min-h-96 flex-1 overflow-auto rounded-lg border border-gray-300 bg-gray-50 p-3 text-sm whitespace-pre-wrap">{markdownOutput}</pre>
		</div>
	</div>

	<!-- オプション -->
	<div class="flex flex-wrap gap-4 rounded-lg bg-gray-50 p-4">
		<label class="flex items-center">
			<input
				type="checkbox"
				bind:checked={isNewLineAsParagraph}
				on:change={richtextToMarkdown}
				class="mr-2"
			/>
			<span class="text-sm text-gray-700">改行を段落区切りとして扱う</span>
		</label>

		<label class="flex items-center">
			<input
				type="checkbox"
				bind:checked={isIgnoreBoldInHeader}
				on:change={richtextToMarkdown}
				class="mr-2"
			/>
			<span class="text-sm text-gray-700">見出し内の太字を無視する</span>
		</label>
	</div>

	<!-- 使用方法 -->
	<div class="mt-8 rounded-lg bg-blue-50 p-4">
		<h2 class="mb-2 text-lg font-semibold">使用方法</h2>
		<ul class="space-y-1 text-sm text-gray-700">
			<li>• 左側のリッチテキストエディターでテキストを入力・編集してください</li>
			<li>• ツールバーを使って見出し、太字、斜体、リスト、リンクなどの書式を設定できます</li>
			<li>• リアルタイムでMarkdown形式に変換されて右側に表示されます</li>
			<li>• 「コピー」ボタンでMarkdownをクリップボードにコピーできます</li>
			<li>• オプションで改行や太字の処理方法を調整できます</li>
			<li>• 「クリア」ボタンでエディターの内容を空にできます</li>
		</ul>
	</div>
</div>

<style>
	/* Quillエディターのカスタムスタイル */
	:global(.ql-editor) {
		min-height: 20rem !important;
		font-size: 14px;
	}

	:global(.ql-toolbar) {
		border-top: 1px solid #ccc;
		border-left: 1px solid #ccc;
		border-right: 1px solid #ccc;
		border-bottom: none;
	}

	:global(.ql-container) {
		border-bottom: 1px solid #ccc;
		border-left: 1px solid #ccc;
		border-right: 1px solid #ccc;
		border-top: none;
	}
</style>

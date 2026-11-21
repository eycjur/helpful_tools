<script lang="ts">
	import { tools } from '$lib/data/tools';
	import { convertHtmlToMarkdown, getHtmlEditorSource } from '../_shared/html-to-markdown';
	import Icon from '@iconify/svelte';

	let HTMLEditor: HTMLDivElement;
	let markdownOutput = '';
	let isNewLineAsParagraph = false;
	let isPreserveLineBreaks = false;
	let isIgnoreBoldInHeader = true;

	const tool = tools.find((t) => t.name === 'html-to-markdown');

	function convertToMarkdown() {
		if (!HTMLEditor) return;

		markdownOutput = convertHtmlToMarkdown(getHtmlEditorSource(HTMLEditor), {
			newLineAsParagraph: isNewLineAsParagraph,
			preserveLineBreaks: isPreserveLineBreaks,
			ignoreBoldInHeader: isIgnoreBoldInHeader
		});

		if (markdownOutput) {
			navigator.clipboard?.writeText(markdownOutput).catch((err) => {
				console.error('自動コピーに失敗しました: ', err);
			});
		}
	}

	function handleInput() {
		convertToMarkdown();
	}

	function handlePaste() {
		// デフォルトのペースト動作を許可（クリップボードの中身がそのまま貼り付けられる）
		setTimeout(() => {
			convertToMarkdown();
		}, 10);
	}

	function clearEditor() {
		if (HTMLEditor) {
			// eslint-disable-next-line svelte/no-dom-manipulating
			HTMLEditor.innerHTML = '';
			markdownOutput = '';
		}
	}
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
				<div class="text-sm font-medium text-gray-700">【入力】HTML形式のテキスト</div>
				<button
					on:click={clearEditor}
					class="rounded bg-gray-500 px-3 py-1 text-sm text-white transition-colors hover:bg-gray-600"
				>
					クリア
				</button>
			</div>
			<div
				bind:this={HTMLEditor}
				contenteditable="true"
				on:input={handleInput}
				on:paste={handlePaste}
				class="min-h-96 flex-1 overflow-auto rounded-lg border border-gray-300 bg-white p-3 focus:border-transparent focus:ring-2 focus:ring-blue-500 focus:outline-none"
				style="white-space: pre-wrap;"
				data-placeholder="HTMLまたはリッチテキストを入力してください..."
			></div>
		</div>

		<!-- 出力エリア -->
		<div class="flex flex-col">
			<div class="mb-2">
				<div class="text-sm font-medium text-gray-700">【出力】Markdown形式（自動コピー）</div>
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
				on:change={convertToMarkdown}
				class="mr-2"
			/>
			<span class="text-sm text-gray-700">改行を段落区切りとして扱う</span>
		</label>

		<label class="flex items-center">
			<input
				type="checkbox"
				bind:checked={isPreserveLineBreaks}
				on:change={convertToMarkdown}
				class="mr-2"
			/>
			<span class="text-sm text-gray-700">元の改行を保持する</span>
		</label>

		<label class="flex items-center">
			<input
				type="checkbox"
				bind:checked={isIgnoreBoldInHeader}
				on:change={convertToMarkdown}
				class="mr-2"
			/>
			<span class="text-sm text-gray-700">見出し内の太字を無視する</span>
		</label>
	</div>

	<!-- 使用方法 -->
	<div class="mt-8 rounded-lg bg-blue-50 p-4">
		<h2 class="mb-2 text-lg font-semibold">使用方法</h2>
		<ul class="space-y-1 text-sm text-gray-700">
			<li>
				• HTMLコードまたはWebページからコピーしたリッチテキストを左側の編集エリアに入力してください
			</li>
			<li>• リッチテキスト（太字、斜体、リンク、見出しなど）の書式が保持されます</li>
			<li>• 自動的にMarkdown形式に変換されて右側に表示されます</li>
			<li>• 変換されたMarkdownは自動的にクリップボードにコピーされます</li>
			<li>• オプションで改行の保持・段落区切り・太字の処理方法を調整できます</li>
			<li>• 「クリア」ボタンで入力エリアを空にできます</li>
		</ul>
	</div>
</div>

<style>
	/* プレースホルダーのスタイル */
	[contenteditable='true']:empty:before {
		content: attr(data-placeholder);
		color: #9ca3af;
		pointer-events: none;
	}

	/* contentEditableエリア内のスタイル */
	[contenteditable='true'] {
		min-height: 24rem;
	}

	[contenteditable='true']:focus {
		outline: none;
	}
</style>

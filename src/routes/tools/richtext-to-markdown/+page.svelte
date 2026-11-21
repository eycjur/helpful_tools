<script lang="ts">
	import { tools } from '$lib/data/tools';
	import { convertHtmlToMarkdown } from '../_shared/html-to-markdown';
	import { onMount } from 'svelte';
	import Quill from 'quill';
	import Icon from '@iconify/svelte';
	import 'quill/dist/quill.snow.css';

	let quillEditor: HTMLDivElement;
	let quill: Quill | null = null;
	let markdownOutput = '';
	let isNewLineAsParagraph = false;
	let isPreserveLineBreaks = false;
	let isIgnoreBoldInHeader = true;

	const tool = tools.find((t) => t.name === 'richtext-to-markdown');

	function richtextToMarkdown() {
		if (!quill) return;

		markdownOutput = convertHtmlToMarkdown(quill.root.innerHTML, {
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
		{#if tool?.icon}<Icon icon={tool.icon} class="mr-4 h-10 w-10" />{/if}
		<h1 class="text-3xl font-bold">{tool?.nameJa}</h1>
	</div>

	<div class="mb-6 grid grid-cols-1 gap-6 md:grid-cols-2">
		<!-- 入力エリア -->
		<div class="flex flex-col">
			<div class="mb-2 flex items-center justify-between">
				<div class="text-sm font-medium text-gray-700">【入力】RichText形式</div>
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
				on:change={richtextToMarkdown}
				class="mr-2"
			/>
			<span class="text-sm text-gray-700">改行を段落区切りとして扱う</span>
		</label>

		<label class="flex items-center">
			<input
				type="checkbox"
				bind:checked={isPreserveLineBreaks}
				on:change={richtextToMarkdown}
				class="mr-2"
			/>
			<span class="text-sm text-gray-700">元の改行を保持する</span>
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
			<li>• 変換されたMarkdownは自動的にクリップボードにコピーされます</li>
			<li>• オプションで改行の保持・段落区切り・太字の処理方法を調整できます</li>
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

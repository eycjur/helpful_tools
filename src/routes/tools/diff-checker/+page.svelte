<script lang="ts">
	import { onMount } from 'svelte';
	import { tools } from '$lib/data/tools';
	import Icon from '@iconify/svelte';
	import diff_match_patch from 'diff-match-patch';
	import { escapeHtml } from './html-escape';

	const tool = tools.find((t) => t.name === 'diff-checker');

	// 入力テキスト
	let leftText = '';
	let rightText = '';

	// オプション
	let ignoreWhitespace = false;
	let ignoreCase = false;
	let viewMode: 'side-by-side' | 'unified' = 'side-by-side';
	let showCharacterDiff = true;

	// 差分結果
	let stats = { added: 0, removed: 0, modified: 0, unchanged: 0 };
	let hasDiff = false;
	let selectionSide: 'left' | 'right' | null = null;
	let leftSelectionContainer: HTMLDivElement | null = null;
	let rightSelectionContainer: HTMLDivElement | null = null;
	let lineDiffRows: Array<{
		leftHtml: string;
		rightHtml: string;
		leftText: string | null;
		rightText: string | null;
	}> = [];
	let lineDiffUnifiedHtml = '';

	const dmp = new diff_match_patch();
	const DIFF_DELETE = diff_match_patch.DIFF_DELETE;
	const DIFF_INSERT = diff_match_patch.DIFF_INSERT;

	function formatDiffSegment(text: string, op: number): string {
		const escaped = escapeHtml(text);
		if (op === DIFF_INSERT || op === DIFF_DELETE) {
			return escaped
				.replace(/ /g, '<span class="opacity-60">·</span>')
				.replace(/\t/g, '<span class="opacity-60">→</span>');
		}
		return escaped;
	}

	function wrapDiffSpan(text: string, kind: 'insert' | 'delete'): string {
		const classes = kind === 'insert' ? 'bg-green-300 text-green-900' : 'bg-red-300 text-red-900';
		return `<span class="${classes}">${text}</span>`;
	}

	function computeLineStatsFromRows(
		rows: Array<{ leftText: string | null; rightText: string | null }>
	) {
		let added = 0;
		let removed = 0;
		let unchanged = 0;
		let modified = 0;

		for (const row of rows) {
			const hasLeft = row.leftText !== null;
			const hasRight = row.rightText !== null;

			if (hasLeft && hasRight) {
				if (row.leftText === row.rightText) unchanged++;
				else modified++;
			} else if (hasLeft) {
				removed++;
			} else if (hasRight) {
				added++;
			}
		}

		return { added, removed, modified, unchanged };
	}

	function preprocessText(text: string): string[] {
		if (!text) return [];

		let processed = text;

		if (ignoreCase) {
			processed = processed.toLowerCase();
		}

		let lines = processed.split(/\r?\n/);

		if (ignoreWhitespace) {
			lines = lines.map((line) => line.trim());
		}

		return lines;
	}

	function computeDiff() {
		const leftStr = preprocessText(leftText).join('\n');
		const rightStr = preprocessText(rightText).join('\n');
		hasDiff = leftStr !== rightStr;
		lineDiffRows = buildLineDiffRows(leftStr, rightStr);
		stats = computeLineStatsFromRows(lineDiffRows);
		lineDiffUnifiedHtml = buildUnifiedLineDiffHtml(lineDiffRows);
	}

	onMount(() => {
		const handleMouseUp = () => {
			selectionSide = null;
		};
		const handleSelectionChange = () => {
			if (!selectionSide) return;
			const selection = window.getSelection();
			if (!selection || selection.rangeCount === 0) return;

			const anchorNode = selection.anchorNode;
			const focusNode = selection.focusNode;
			if (!anchorNode || !focusNode) return;

			const leftHasAnchor = isNodeIn(leftSelectionContainer, anchorNode);
			const rightHasAnchor = isNodeIn(rightSelectionContainer, anchorNode);
			const leftHasFocus = isNodeIn(leftSelectionContainer, focusNode);
			const rightHasFocus = isNodeIn(rightSelectionContainer, focusNode);

			if (selectionSide === 'left' && leftHasAnchor && rightHasFocus) {
				selection.collapse(anchorNode, selection.anchorOffset);
			} else if (selectionSide === 'right' && rightHasAnchor && leftHasFocus) {
				selection.collapse(anchorNode, selection.anchorOffset);
			}
		};

		window.addEventListener('mouseup', handleMouseUp);
		document.addEventListener('selectionchange', handleSelectionChange);
		return () => {
			window.removeEventListener('mouseup', handleMouseUp);
			document.removeEventListener('selectionchange', handleSelectionChange);
		};
	});

	function isNodeIn(container: HTMLElement | null, node: Node | null): boolean {
		if (!container || !node) return false;
		return container.contains(node);
	}

	// リアルタイム更新（設定変更時も再計算）
	$: if (
		leftText !== undefined ||
		rightText !== undefined ||
		ignoreWhitespace !== undefined ||
		ignoreCase !== undefined ||
		showCharacterDiff !== undefined
	) {
		computeDiff();
	}

	// クリップボードコピー
	async function copyToClipboard(text: string) {
		try {
			await navigator.clipboard.writeText(text);
		} catch (err) {
			console.error('クリップボードへのコピーに失敗:', err);
		}
	}

	// 統合diff形式で出力
	function getUnifiedDiffText(): string {
		let result = '--- Left Text\n+++ Right Text\n';
		for (const row of lineDiffRows) {
			const hasLeft = row.leftText !== null;
			const hasRight = row.rightText !== null;

			if (hasLeft && hasRight && row.leftText === row.rightText) {
				result += ` ${row.leftText}\n`;
				continue;
			}
			if (hasLeft) result += `-${row.leftText ?? ''}\n`;
			if (hasRight) result += `+${row.rightText ?? ''}\n`;
		}
		return result;
	}

	function buildLineDiffRows(leftStr: string, rightStr: string) {
		if (!leftStr && !rightStr) return [];

		const diffs = dmp.diff_main(leftStr, rightStr, false);
		dmp.diff_cleanupSemantic(diffs);

		const rows: Array<{
			leftHtml: string;
			rightHtml: string;
			leftText: string | null;
			rightText: string | null;
		}> = [];

		let currentLeftText = '';
		let currentRightText = '';
		let currentLeftHtml = '';
		let currentRightHtml = '';
		let leftPresent = false;
		let rightPresent = false;

		const appendSegment = (op: number, segment: string) => {
			const escaped = escapeHtml(segment);
			const formatted = formatDiffSegment(segment, op);

			if (op === DIFF_DELETE) {
				leftPresent = true;
				currentLeftText += segment;
				currentLeftHtml += showCharacterDiff ? wrapDiffSpan(formatted, 'delete') : escaped;
			} else if (op === DIFF_INSERT) {
				rightPresent = true;
				currentRightText += segment;
				currentRightHtml += showCharacterDiff ? wrapDiffSpan(formatted, 'insert') : escaped;
			} else {
				leftPresent = true;
				rightPresent = true;
				currentLeftText += segment;
				currentRightText += segment;
				currentLeftHtml += escaped;
				currentRightHtml += escaped;
			}
		};

		const pushLine = () => {
			if (!leftPresent && !rightPresent) return;
			rows.push({
				leftHtml: leftPresent ? currentLeftHtml : '',
				rightHtml: rightPresent ? currentRightHtml : '',
				leftText: leftPresent ? currentLeftText : null,
				rightText: rightPresent ? currentRightText : null
			});
			currentLeftText = '';
			currentRightText = '';
			currentLeftHtml = '';
			currentRightHtml = '';
			leftPresent = false;
			rightPresent = false;
		};

		for (const [op, value] of diffs) {
			const parts = value.split('\n');
			for (let i = 0; i < parts.length; i++) {
				const segment = parts[i];
				appendSegment(op, segment);
				if (i < parts.length - 1) {
					pushLine();
				}
			}
		}

		pushLine();
		return rows;
	}

	function buildUnifiedLineDiffHtml(
		rows: Array<{
			leftHtml: string;
			rightHtml: string;
			leftText: string | null;
			rightText: string | null;
		}>
	): string {
		let html = '';
		for (const row of rows) {
			const hasLeft = row.leftText !== null;
			const hasRight = row.rightText !== null;

			if (hasLeft && hasRight && row.leftText === row.rightText) {
				html += `<div><span class="mr-2 text-gray-500"> </span>${row.leftHtml}</div>`;
				continue;
			}

			if (hasLeft) {
				html += `<div class="bg-red-100"><span class="mr-2 text-red-700">-</span>${row.leftHtml}</div>`;
			}
			if (hasRight) {
				html += `<div class="bg-green-100"><span class="mr-2 text-green-700">+</span>${row.rightHtml}</div>`;
			}
		}
		return html;
	}

	// サンプルテキスト
	const sampleTexts = {
		left: `score: 0.5,
formatScore: 0.5,
absoluteQuality: 1.0,
passReached: 0.15,
reason: "品質（長さ・ルーブリック語彙・人間コメント整合）",
notes: ["format mismatch", "needs review"],
meta: { locale: "ja-JP", reviewer: "human" }`,
		right: `score: 1.0
passReached: 0.15
reason: "品質（長さ・ルーブリック語彙・人間コメント整合）",
notes: ["needs review"],
meta: { locale: "ja-JP" },
status: "experimental"`
	};

	function loadSample() {
		leftText = sampleTexts.left;
		rightText = sampleTexts.right;
	}

	function clear() {
		leftText = '';
		rightText = '';
	}
</script>

<div class="mx-auto max-w-7xl">
	<div class="mb-6 flex items-center justify-between">
		<div class="flex items-center">
			{#if tool?.icon}<Icon icon={tool.icon} class="mr-4 h-10 w-10" />{/if}
			<h1 class="text-3xl font-bold">{tool?.nameJa}</h1>
		</div>
		<div class="flex gap-3">
			<button
				on:click={loadSample}
				class="rounded bg-purple-600 px-4 py-2 text-white hover:bg-purple-700"
			>
				<Icon icon="mdi:file-document-outline" class="mr-2 inline h-4 w-4" />
				サンプル読み込み
			</button>
			<button on:click={clear} class="rounded bg-gray-500 px-4 py-2 text-white hover:bg-gray-600">
				<Icon icon="mdi:trash-can" class="mr-2 inline h-4 w-4" />
				クリア
			</button>
			<button
				on:click={() => copyToClipboard(leftText)}
				disabled={!leftText}
				class="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
			>
				<Icon icon="mdi:content-copy" class="mr-2 inline h-4 w-4" />
				左をコピー
			</button>
			<button
				on:click={() => copyToClipboard(getUnifiedDiffText())}
				disabled={!hasDiff}
				class="rounded bg-green-600 px-4 py-2 text-white hover:bg-green-700 disabled:opacity-50"
			>
				<Icon icon="mdi:content-copy" class="mr-2 inline h-4 w-4" />
				Diff結果コピー
			</button>
		</div>
	</div>

	<!-- オプション設定 -->
	<div class="mb-6 rounded-lg border border-gray-200 bg-white p-4">
		<div class="flex flex-wrap items-center gap-6">
			<div class="flex items-center gap-4">
				<label class="inline-flex items-center">
					<input type="checkbox" bind:checked={ignoreWhitespace} class="rounded" />
					<span class="ml-2 text-sm">空白を無視</span>
				</label>
				<label class="inline-flex items-center">
					<input type="checkbox" bind:checked={ignoreCase} class="rounded" />
					<span class="ml-2 text-sm">大文字小文字を無視</span>
				</label>
				<label class="inline-flex items-center">
					<input type="checkbox" bind:checked={showCharacterDiff} class="rounded" />
					<span class="ml-2 text-sm">文字レベル差分を表示</span>
				</label>
			</div>

			<div class="flex items-center gap-2">
				<span class="text-sm font-medium">表示モード:</span>
				<div class="flex rounded-lg bg-gray-100 p-1">
					<button
						on:click={() => (viewMode = 'side-by-side')}
						class="rounded px-3 py-1 text-sm transition-colors {viewMode === 'side-by-side'
							? 'bg-white text-gray-900 shadow-sm'
							: 'text-gray-600 hover:text-gray-900'}"
					>
						サイドバイサイド
					</button>
					<button
						on:click={() => (viewMode = 'unified')}
						class="rounded px-3 py-1 text-sm transition-colors {viewMode === 'unified'
							? 'bg-white text-gray-900 shadow-sm'
							: 'text-gray-600 hover:text-gray-900'}"
					>
						統合
					</button>
				</div>
			</div>

			<!-- 統計表示 -->
			{#if hasDiff}
				<div class="ml-auto flex items-center gap-4 text-sm">
					<span class="flex items-center">
						<div class="mr-1 h-3 w-3 rounded bg-green-500"></div>
						追加: {stats.added}
					</span>
					<span class="flex items-center">
						<div class="mr-1 h-3 w-3 rounded bg-red-500"></div>
						削除: {stats.removed}
					</span>
					<span class="flex items-center">
						<div class="mr-1 h-3 w-3 rounded bg-yellow-500"></div>
						変更: {stats.modified}
					</span>
					<span class="flex items-center">
						<div class="mr-1 h-3 w-3 rounded bg-gray-300"></div>
						未変更: {stats.unchanged}
					</span>
				</div>
			{/if}
		</div>
	</div>

	<!-- 入力エリア -->
	<div class="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
		<div class="rounded-lg border border-gray-200 bg-white p-4">
			<div class="mb-3 flex items-center justify-between">
				<h3 class="font-medium text-gray-900">左テキスト（比較元）</h3>
				<div class="text-xs text-gray-500">
					{leftText.split('\n').length} 行
				</div>
			</div>
			<textarea
				bind:value={leftText}
				placeholder="比較元のテキストを入力してください"
				class="h-64 w-full rounded border border-gray-300 p-3 font-mono text-sm"
			></textarea>
		</div>

		<div class="rounded-lg border border-gray-200 bg-white p-4">
			<div class="mb-3 flex items-center justify-between">
				<h3 class="font-medium text-gray-900">右テキスト（比較先）</h3>
				<div class="text-xs text-gray-500">
					{rightText.split('\n').length} 行
				</div>
			</div>
			<textarea
				bind:value={rightText}
				placeholder="比較先のテキストを入力してください"
				class="h-64 w-full rounded border border-gray-300 p-3 font-mono text-sm"
			></textarea>
		</div>
	</div>

	<!-- 差分結果表示 -->
	{#if hasDiff}
		<div class="rounded-lg border border-gray-200 bg-white p-4">
			<h3 class="mb-4 font-medium text-gray-900">差分結果</h3>

			{#if viewMode === 'side-by-side'}
				<div class="overflow-x-auto">
					<div
						bind:this={leftSelectionContainer}
						class="rounded bg-gray-50 p-3 font-mono text-sm break-all whitespace-pre-wrap"
					>
						<div class="mb-2 grid grid-cols-2 gap-4 text-sm font-medium text-gray-600">
							<div>左テキスト</div>
							<div>右テキスト</div>
						</div>
						{#each lineDiffRows as row, i (i)}
							<div class="grid grid-cols-2 gap-4">
								<div
									on:mousedown={() => (selectionSide = 'left')}
									role="presentation"
									class="min-h-[1.25em] {selectionSide === 'right'
										? 'select-none'
										: 'select-text'} {row.leftText !== null
										? row.rightText !== null && row.leftText !== row.rightText
											? 'bg-yellow-100'
											: row.leftText === row.rightText
												? ''
												: 'bg-red-100'
										: ''}"
								>
									{#if row.leftText !== null}
										<span class="mr-2 text-red-700">
											{row.leftText === row.rightText ? ' ' : '-'}
										</span>
										<!-- eslint-disable-next-line svelte/no-at-html-tags -->
										{@html row.leftHtml}
									{:else}
										<span>&nbsp;</span>
									{/if}
								</div>
								<div
									on:mousedown={() => (selectionSide = 'right')}
									role="presentation"
									class="min-h-[1.25em] {selectionSide === 'left'
										? 'select-none'
										: 'select-text'} {row.rightText !== null
										? row.leftText !== null && row.leftText !== row.rightText
											? 'bg-yellow-100'
											: row.leftText === row.rightText
												? ''
												: 'bg-green-100'
										: ''}"
								>
									{#if row.rightText !== null}
										<span class="mr-2 text-green-700">
											{row.leftText === row.rightText ? ' ' : '+'}
										</span>
										<!-- eslint-disable-next-line svelte/no-at-html-tags -->
										{@html row.rightHtml}
									{:else}
										<span>&nbsp;</span>
									{/if}
								</div>
							</div>
						{/each}
					</div>
				</div>
			{:else}
				<!-- 統合表示 -->
				<div class="overflow-x-auto">
					<div
						bind:this={rightSelectionContainer}
						class="rounded bg-gray-50 p-3 font-mono text-sm break-all whitespace-pre-wrap"
					>
						<!-- eslint-disable-next-line svelte/no-at-html-tags -->
						{@html lineDiffUnifiedHtml}
					</div>
				</div>
			{/if}
		</div>
	{:else}
		<div class="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center text-gray-500">
			<Icon icon="mdi:file-compare" class="mx-auto mb-3 h-12 w-12" />
			<p>テキストを入力すると差分が表示されます</p>
		</div>
	{/if}

	<!-- 説明 -->
	<div class="mt-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
		<div class="flex items-start">
			<Icon icon="mdi:information-outline" class="mt-0.5 mr-2 h-5 w-5 text-blue-600" />
			<div class="text-sm text-blue-800">
				<p class="mb-2 font-medium">使用方法</p>
				<ul class="space-y-1 text-xs">
					<li>• 左右のテキストエリアに比較したいテキストを入力してください</li>
					<li>• リアルタイムで差分が計算され、視覚的に表示されます</li>
					<li>
						• <span class="bg-red-200 px-1">赤色</span>は削除、<span class="bg-green-200 px-1"
							>緑色</span
						>は追加、<span class="bg-yellow-200 px-1">黄色</span>は変更を表します
					</li>
					<li>
						•
						「文字レベル差分を表示」をオンにすると、行内の具体的な文字の変更箇所がハイライトされます
					</li>
					<li>
						• 「Diff結果コピー」で統合diff形式（Unified
						Diff）のテキストをクリップボードにコピーできます
					</li>
				</ul>
			</div>
		</div>
	</div>
</div>

<script lang="ts">
	import { tools } from '$lib/data/tools';
	import Icon from '@iconify/svelte';
	import { diffLines, diffChars } from 'diff';
	import { SvelteSet } from 'svelte/reactivity';

	const tool = tools.find((t) => t.name === 'diff-checker');

	// 入力テキスト
	let leftText = '';
	let rightText = '';

	// オプション
	let ignoreWhitespace = false;
	let ignoreCase = false;
	let viewMode: 'side-by-side' | 'unified' = 'side-by-side';
	let showCharacterDiff = true;

	// 文字レベル差分結果
	interface CharacterDiff {
		type: 'equal' | 'insert' | 'delete';
		text: string;
	}

	// 差分結果
	interface DiffLine {
		type: 'equal' | 'insert' | 'delete' | 'replace';
		leftLine?: string;
		rightLine?: string;
		leftLineNumber?: number;
		rightLineNumber?: number;
		leftCharacterDiff?: CharacterDiff[];
		rightCharacterDiff?: CharacterDiff[];
	}

	let diffResult: DiffLine[] = [];
	let stats = { added: 0, removed: 0, modified: 0, unchanged: 0 };

	// 文字列の類似性を計算（0.0-1.0）
	function calculateSimilarity(str1: string, str2: string): number {
		if (!str1 || !str2) return 0;
		if (str1 === str2) return 1;

		// レーベンシュタイン距離を使った類似性計算
		const maxLength = Math.max(str1.length, str2.length);
		if (maxLength === 0) return 1;

		const distance = levenshteinDistance(str1, str2);
		return 1 - distance / maxLength;
	}

	// レーベンシュタイン距離を計算
	function levenshteinDistance(str1: string, str2: string): number {
		const matrix: number[][] = [];

		for (let i = 0; i <= str2.length; i++) {
			matrix[i] = [i];
		}

		for (let j = 0; j <= str1.length; j++) {
			matrix[0][j] = j;
		}

		for (let i = 1; i <= str2.length; i++) {
			for (let j = 1; j <= str1.length; j++) {
				if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
					matrix[i][j] = matrix[i - 1][j - 1];
				} else {
					matrix[i][j] = Math.min(
						matrix[i - 1][j - 1] + 1,
						matrix[i][j - 1] + 1,
						matrix[i - 1][j] + 1
					);
				}
			}
		}

		return matrix[str2.length][str1.length];
	}

	// 文字レベルの差分を計算（diffライブラリ使用）
	function computeCharacterDiff(
		leftStr: string,
		rightStr: string
	): { left: CharacterDiff[]; right: CharacterDiff[] } {
		const charDiffs = diffChars(leftStr, rightStr);

		const leftDiff: CharacterDiff[] = [];
		const rightDiff: CharacterDiff[] = [];

		for (const part of charDiffs) {
			if (part.added) {
				// 右側に追加された文字
				leftDiff.push({ type: 'insert', text: '' });
				rightDiff.push({ type: 'insert', text: part.value });
			} else if (part.removed) {
				// 左側から削除された文字
				leftDiff.push({ type: 'delete', text: part.value });
				rightDiff.push({ type: 'delete', text: '' });
			} else {
				// 共通部分
				leftDiff.push({ type: 'equal', text: part.value });
				rightDiff.push({ type: 'equal', text: part.value });
			}
		}

		return { left: leftDiff, right: rightDiff };
	}

	// diffライブラリを使った行レベル差分生成
	function generateDiff(): DiffLine[] {
		const leftLines = preprocessText(leftText);
		const rightLines = preprocessText(rightText);

		const leftStr = leftLines.join('\n');
		const rightStr = rightLines.join('\n');

		const lineDiffs = diffLines(leftStr, rightStr, {
			ignoreWhitespace: ignoreWhitespace
		});

		const result: DiffLine[] = [];
		let leftLineNumber = 1;
		let rightLineNumber = 1;

		for (const part of lineDiffs) {
			const lines = part.value.split('\n');
			// 最後の空行を除去（diffLinesの仕様）
			if (lines[lines.length - 1] === '') {
				lines.pop();
			}

			for (let i = 0; i < lines.length; i++) {
				const line = lines[i];

				if (part.added) {
					// 追加された行
					const diffLine: DiffLine = {
						type: 'insert',
						rightLine: line,
						rightLineNumber
					};
					result.push(diffLine);
					rightLineNumber++;
				} else if (part.removed) {
					// 削除された行
					const diffLine: DiffLine = {
						type: 'delete',
						leftLine: line,
						leftLineNumber
					};
					result.push(diffLine);
					leftLineNumber++;
				} else {
					// 未変更の行
					const diffLine: DiffLine = {
						type: 'equal',
						leftLine: line,
						rightLine: line,
						leftLineNumber,
						rightLineNumber
					};
					result.push(diffLine);
					leftLineNumber++;
					rightLineNumber++;
				}
			}
		}

		// より高度な変更検知: 削除・挿入ペアを類似性に基づいてマッチング
		const deleteLines: number[] = [];
		const insertLines: number[] = [];

		// 削除行と挿入行のインデックスを収集
		for (let i = 0; i < result.length; i++) {
			if (result[i].type === 'delete') deleteLines.push(i);
			if (result[i].type === 'insert') insertLines.push(i);
		}

		// 削除・挿入ペアをマッチング
		const used = new SvelteSet<number>();
		for (const deleteIdx of deleteLines) {
			if (used.has(deleteIdx)) continue;

			const deleteLine = result[deleteIdx];
			if (!deleteLine.leftLine) continue;

			// 最も類似性の高い挿入行を見つける
			let bestMatch = -1;
			let bestSimilarity = 0;

			for (const insertIdx of insertLines) {
				if (used.has(insertIdx)) continue;

				const insertLine = result[insertIdx];
				if (!insertLine.rightLine) continue;

				// 文字レベルの類似性を計算
				const similarity = calculateSimilarity(deleteLine.leftLine, insertLine.rightLine);

				// 隣接している場合は優遇（+0.1ボーナス）
				const isAdjacent = Math.abs(deleteIdx - insertIdx) <= 1;
				const finalSimilarity = similarity + (isAdjacent ? 0.1 : 0);

				if (finalSimilarity > bestSimilarity && finalSimilarity > 0.3) {
					// 30%以上の類似性
					bestSimilarity = finalSimilarity;
					bestMatch = insertIdx;
				}
			}

			// マッチが見つかった場合、文字レベル差分を計算
			if (bestMatch !== -1) {
				const insertLine = result[bestMatch];
				const charDiff = computeCharacterDiff(deleteLine.leftLine, insertLine.rightLine!);
				deleteLine.leftCharacterDiff = charDiff.left;
				insertLine.rightCharacterDiff = charDiff.right;

				used.add(deleteIdx);
				used.add(bestMatch);

				console.log('Matched change detected:', {
					deleteIdx,
					insertIdx: bestMatch,
					similarity: bestSimilarity,
					left: deleteLine.leftLine,
					right: insertLine.rightLine
				});
			}
		}

		return result;
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
		diffResult = generateDiff();

		// 統計を計算（文字レベル差分がある削除・挿入ペアを変更として計算）
		let modified = 0;
		for (let i = 0; i < diffResult.length; i++) {
			const line = diffResult[i];
			if (
				line.type === 'delete' &&
				line.leftCharacterDiff &&
				i + 1 < diffResult.length &&
				diffResult[i + 1].type === 'insert' &&
				diffResult[i + 1].rightCharacterDiff
			) {
				modified++;
				i++; // 次の挿入行もスキップ
			}
		}

		stats = {
			added: diffResult.filter((d) => d.type === 'insert' && !d.rightCharacterDiff).length,
			removed: diffResult.filter((d) => d.type === 'delete' && !d.leftCharacterDiff).length,
			modified: modified,
			unchanged: diffResult.filter((d) => d.type === 'equal').length
		};
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

		for (const line of diffResult) {
			switch (line.type) {
				case 'equal':
					result += ` ${line.leftLine || ''}\n`;
					break;
				case 'delete':
					result += `-${line.leftLine || ''}\n`;
					break;
				case 'insert':
					result += `+${line.rightLine || ''}\n`;
					break;
			}
		}

		return result;
	}

	// サンプルテキスト
	const sampleTexts = {
		left: `function hello() {
  console.log("Hello World");
  return true;
}`,
		right: `function hello(name) {
  console.log("Hello " + name);
  console.log("Welcome!");
  return true;
}`
	};

	function loadSample() {
		leftText = sampleTexts.left;
		rightText = sampleTexts.right;
	}

	function clear() {
		leftText = '';
		rightText = '';
	}

	function escapeHtml(text: string): string {
		return text.replace(/[&<>]/g, (match) => {
			return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[match] || match;
		});
	}

	// 文字レベル差分をHTMLで表示（スペース可視化付き）
	function renderCharacterDiff(charDiff: CharacterDiff[]): string {
		return charDiff
			.map((chunk) => {
				let processedText = escapeHtml(chunk.text);

				// スペース文字を可視化（差分部分のみ）
				if (chunk.type !== 'equal') {
					processedText = processedText
						.replace(/ /g, '<span class="opacity-60">·</span>') // スペースを中点で表示
						.replace(/\t/g, '<span class="opacity-60">→</span>'); // タブを矢印で表示
				}

				switch (chunk.type) {
					case 'equal':
						return processedText;
					case 'insert':
						return `<span class="bg-green-300 text-green-900 whitespace-pre-wrap">${processedText}</span>`;
					case 'delete':
						return `<span class="bg-red-300 text-red-900 whitespace-pre-wrap">${processedText}</span>`;
					default:
						return processedText;
				}
			})
			.join('');
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
				on:click={() => copyToClipboard(getUnifiedDiffText())}
				disabled={diffResult.length === 0}
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
			{#if diffResult.length > 0}
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
	{#if diffResult.length > 0}
		<div class="rounded-lg border border-gray-200 bg-white p-4">
			<h3 class="mb-4 font-medium text-gray-900">差分結果</h3>

			{#if viewMode === 'side-by-side'}
				<div class="overflow-x-auto">
					<div class="grid grid-cols-2 gap-4">
						<!-- 左側（比較元） -->
						<div>
							<h4 class="mb-2 text-sm font-medium text-gray-600">左テキスト</h4>
							<div class="rounded bg-gray-50 p-3 font-mono text-sm whitespace-pre-wrap">
								{#each diffResult as line, i (i)}
									<div
										class="flex {line.type === 'delete'
											? line.leftCharacterDiff
												? 'bg-yellow-100'
												: 'bg-red-100'
											: line.type === 'equal'
												? 'bg-white'
												: 'hidden'}"
									>
										<span class="mr-3 w-8 text-right text-xs text-gray-500">
											{line.leftLineNumber || ''}
										</span>
										<span class="flex-1">
											{#if line.type === 'delete'}
												{#if line.leftCharacterDiff}
													<span class="bg-yellow-200 text-yellow-800">~</span>
												{:else}
													<span class="bg-red-200 text-red-800">-</span>
												{/if}
											{:else}
												<span class="text-gray-600"> </span>
											{/if}
											{#if line.type === 'delete' && showCharacterDiff && line.leftCharacterDiff}
												<!-- eslint-disable-next-line svelte/no-at-html-tags -->
												{@html renderCharacterDiff(line.leftCharacterDiff)}
											{:else}
												{escapeHtml(line.leftLine || '')}
											{/if}
										</span>
									</div>
								{/each}
							</div>
						</div>

						<!-- 右側（比較先） -->
						<div>
							<h4 class="mb-2 text-sm font-medium text-gray-600">右テキスト</h4>
							<div class="rounded bg-gray-50 p-3 font-mono text-sm whitespace-pre-wrap">
								{#each diffResult as line, i (i)}
									<div
										class="flex {line.type === 'insert'
											? line.rightCharacterDiff
												? 'bg-yellow-100'
												: 'bg-green-100'
											: line.type === 'equal'
												? 'bg-white'
												: 'hidden'}"
									>
										<span class="mr-3 w-8 text-right text-xs text-gray-500">
											{line.rightLineNumber || ''}
										</span>
										<span class="flex-1">
											{#if line.type === 'insert'}
												{#if line.rightCharacterDiff}
													<span class="bg-yellow-200 text-yellow-800">~</span>
												{:else}
													<span class="bg-green-200 text-green-800">+</span>
												{/if}
											{:else}
												<span class="text-gray-600"> </span>
											{/if}
											{#if line.type === 'insert' && showCharacterDiff && line.rightCharacterDiff}
												<!-- eslint-disable-next-line svelte/no-at-html-tags -->
												{@html renderCharacterDiff(line.rightCharacterDiff)}
											{:else}
												{escapeHtml(line.rightLine || '')}
											{/if}
										</span>
									</div>
								{/each}
							</div>
						</div>
					</div>
				</div>
			{:else}
				<!-- 統合表示 -->
				<div class="overflow-x-auto">
					<div class="rounded bg-gray-50 p-3 font-mono text-sm whitespace-pre-wrap">
						{#each diffResult as line, i (i)}
							<div
								class="flex {line.type === 'delete'
									? line.leftCharacterDiff
										? 'bg-yellow-100'
										: 'bg-red-100'
									: line.type === 'insert'
										? line.rightCharacterDiff
											? 'bg-yellow-100'
											: 'bg-green-100'
										: 'bg-white'}"
							>
								<span class="mr-3 w-16 text-right text-xs text-gray-500">
									{line.leftLineNumber || ''},{line.rightLineNumber || ''}
								</span>
								<span class="flex-1">
									{#if line.type === 'delete'}
										{#if line.leftCharacterDiff}
											<span class="bg-yellow-200 text-yellow-800">~</span>
											{#if showCharacterDiff}
												<!-- eslint-disable-next-line svelte/no-at-html-tags -->
												{@html renderCharacterDiff(line.leftCharacterDiff)}
											{:else}
												{escapeHtml(line.leftLine || '')}
											{/if}
										{:else}
											<span class="bg-red-200 text-red-800">-</span>
											{escapeHtml(line.leftLine || '')}
										{/if}
									{:else if line.type === 'insert'}
										{#if line.rightCharacterDiff}
											<span class="bg-yellow-200 text-yellow-800">~</span>
											{#if showCharacterDiff}
												<!-- eslint-disable-next-line svelte/no-at-html-tags -->
												{@html renderCharacterDiff(line.rightCharacterDiff)}
											{:else}
												{escapeHtml(line.rightLine || '')}
											{/if}
										{:else}
											<span class="bg-green-200 text-green-800">+</span>
											{escapeHtml(line.rightLine || '')}
										{/if}
									{:else}
										<span class="text-gray-600"> </span>
										{escapeHtml(line.leftLine || '')}
									{/if}
								</span>
							</div>
						{/each}
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

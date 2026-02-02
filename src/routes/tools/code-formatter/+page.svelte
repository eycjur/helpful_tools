<script lang="ts">
	import { tools } from '$lib/data/tools';
	import Icon from '@iconify/svelte';

	const tool = tools.find((t) => t.name === 'code-formatter');

	let inputCode = '';
	let outputCode = '';
	let stats = {
		emptyLinesWithSpaces: 0,
		trailingSpacesRemoved: 0,
		tabsConverted: 0,
		totalSpacesRemoved: 0,
		linesProcessed: 0
	};

	// 設定オプション
	let removeEmptyLineSpaces = true;
	let removeTrailingSpaces = true;
	let convertTabsToSpaces = true;
	let tabSize = 4;

	function formatCode() {
		if (!inputCode.trim()) {
			outputCode = '';
			resetStats();
			return;
		}

		const lines = inputCode.split('\n');
		const processedLines: string[] = [];
		let emptyLinesCount = 0;
		let trailingSpacesCount = 0;
		let tabsConvertedCount = 0;
		let totalSpacesCount = 0;

		for (let i = 0; i < lines.length; i++) {
			let line = lines[i];

			// タブをスペースに変換
			if (convertTabsToSpaces && line.includes('\t')) {
				const tabCount = (line.match(/\t/g) || []).length;
				if (tabCount > 0) {
					tabsConvertedCount++;
					line = line.replace(/\t/g, ' '.repeat(tabSize));
				}
			}

			// 空白行の空白削除
			if (removeEmptyLineSpaces && line.trim() === '') {
				if (line.length > 0) {
					emptyLinesCount++;
					totalSpacesCount += line.length;
					line = '';
				}
			}
			// 行末尾空白削除（空白行でない場合）
			else if (removeTrailingSpaces) {
				const trimmedLine = line.replace(/\s+$/, '');
				const removedSpaces = line.length - trimmedLine.length;
				if (removedSpaces > 0) {
					trailingSpacesCount++;
					totalSpacesCount += removedSpaces;
					line = trimmedLine;
				}
			}

			processedLines.push(line);
		}

		outputCode = processedLines.join('\n');
		stats = {
			emptyLinesWithSpaces: emptyLinesCount,
			trailingSpacesRemoved: trailingSpacesCount,
			tabsConverted: tabsConvertedCount,
			totalSpacesRemoved: totalSpacesCount,
			linesProcessed: lines.length
		};

		// 自動コピー
		if (outputCode !== inputCode) {
			copyToClipboard(outputCode);
		}
	}

	function resetStats() {
		stats = {
			emptyLinesWithSpaces: 0,
			trailingSpacesRemoved: 0,
			tabsConverted: 0,
			totalSpacesRemoved: 0,
			linesProcessed: 0
		};
	}

	function clearAll() {
		inputCode = '';
		outputCode = '';
		resetStats();
	}

	async function copyToClipboard(text: string) {
		try {
			await navigator.clipboard.writeText(text);
		} catch (err) {
			console.error('クリップボードへのコピーに失敗:', err);
		}
	}

	function pasteFromClipboard() {
		navigator.clipboard
			.readText()
			.then((text) => {
				inputCode = text;
				formatCode();
			})
			.catch((err) => {
				console.error('クリップボードからの取得に失敗:', err);
			});
	}

	// 入力が変更されたときに自動実行
	$: if (inputCode !== undefined) {
		formatCode();
	}

	function getDiffPreview(): { added: string[]; removed: string[]; changed: number } {
		if (!inputCode || !outputCode) {
			return { added: [], removed: [], changed: 0 };
		}

		const inputLines = inputCode.split('\n');
		const outputLines = outputCode.split('\n');
		const removed: string[] = [];
		const added: string[] = [];
		let changed = 0;

		for (let i = 0; i < Math.max(inputLines.length, outputLines.length); i++) {
			const inputLine = inputLines[i] || '';
			const outputLine = outputLines[i] || '';

			if (inputLine !== outputLine) {
				changed++;
				// 文字レベルの差分を表示
				const diff = getCharDiff(inputLine, outputLine);
				if (inputLine) removed.push(`${i + 1}: ${diff.removed}`);
				if (outputLine) added.push(`${i + 1}: ${diff.added}`);
			}
		}

		return { added, removed, changed };
	}

	// 文字レベルの差分を取得（空白を可視化）
	function getCharDiff(oldLine: string, newLine: string): { removed: string; added: string } {
		// 行末の空白を可視化
		const visualizeSpaces = (str: string): string => {
			return str.replace(/\t/g, '→').replace(/ /g, '·').replace(/\r/g, '⏎').replace(/\n/g, '↵');
		};

		return {
			removed: visualizeSpaces(oldLine),
			added: visualizeSpaces(newLine)
		};
	}
</script>

<div class="mx-auto max-w-6xl">
	<div class="mb-6 flex items-center">
		{#if tool?.icon}<Icon icon={tool.icon} class="mr-4 h-10 w-10" />{/if}
		<h1 class="text-3xl font-bold">{tool?.nameJa}</h1>
	</div>

	<!-- 設定オプション -->
	<div class="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-4">
		<div class="rounded-lg border border-gray-200 bg-white p-4">
			<label class="flex items-center">
				<input type="checkbox" bind:checked={removeEmptyLineSpaces} class="mr-2" />
				<span class="text-sm font-medium text-gray-700">空白行の空白を削除</span>
			</label>
			<p class="mt-1 text-xs text-gray-500">完全に空白のみの行を空の行にします</p>
		</div>
		<div class="rounded-lg border border-gray-200 bg-white p-4">
			<label class="flex items-center">
				<input type="checkbox" bind:checked={removeTrailingSpaces} class="mr-2" />
				<span class="text-sm font-medium text-gray-700">行末尾空白を削除</span>
			</label>
			<p class="mt-1 text-xs text-gray-500">各行の最後の余分な空白を削除します</p>
		</div>
		<div class="rounded-lg border border-gray-200 bg-white p-4">
			<label class="flex items-center">
				<input type="checkbox" bind:checked={convertTabsToSpaces} class="mr-2" />
				<span class="text-sm font-medium text-gray-700">タブをスペースに変換</span>
			</label>
			<div class="mt-2 flex items-center">
				<label for="tab-size-input" class="mr-2 text-xs text-gray-500">サイズ:</label>
				<input
					id="tab-size-input"
					type="number"
					bind:value={tabSize}
					min="2"
					max="8"
					class="w-16 rounded border border-gray-300 px-2 py-1 text-xs"
				/>
			</div>
		</div>
		<div class="rounded-lg border border-gray-200 bg-white p-4">
			<div class="flex flex-col gap-2">
				<button
					on:click={pasteFromClipboard}
					class="rounded bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700"
				>
					<Icon icon="mdi:content-paste" class="mr-1 inline h-4 w-4" />
					貼り付け
				</button>
				<button
					on:click={clearAll}
					class="rounded bg-gray-500 px-3 py-2 text-sm text-white hover:bg-gray-600"
				>
					クリア
				</button>
			</div>
		</div>
	</div>

	<!-- 統計情報 -->
	{#if stats.linesProcessed > 0}
		<div class="mb-4 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
			<div class="rounded-lg border border-gray-200 bg-white p-3 text-center">
				<div class="text-lg font-semibold text-blue-600">{stats.linesProcessed}</div>
				<div class="text-xs text-gray-500">処理行数</div>
			</div>
			<div class="rounded-lg border border-gray-200 bg-white p-3 text-center">
				<div class="text-lg font-semibold text-green-600">{stats.emptyLinesWithSpaces}</div>
				<div class="text-xs text-gray-500">空白行の修正</div>
			</div>
			<div class="rounded-lg border border-gray-200 bg-white p-3 text-center">
				<div class="text-lg font-semibold text-orange-600">{stats.trailingSpacesRemoved}</div>
				<div class="text-xs text-gray-500">末尾空白のある行</div>
			</div>
			<div class="rounded-lg border border-gray-200 bg-white p-3 text-center">
				<div class="text-lg font-semibold text-purple-600">{stats.tabsConverted}</div>
				<div class="text-xs text-gray-500">タブ変換した行</div>
			</div>
			<div class="rounded-lg border border-gray-200 bg-white p-3 text-center">
				<div class="text-lg font-semibold text-red-600">{stats.totalSpacesRemoved}</div>
				<div class="text-xs text-gray-500">削除された空白数</div>
			</div>
		</div>
	{/if}

	<!-- メインコンテンツ -->
	<div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
		<!-- 入力エリア -->
		<div class="rounded-lg border border-gray-200 bg-white p-4">
			<div class="mb-3 flex items-center justify-between">
				<h3 class="font-medium text-gray-900">入力コード</h3>
				<div class="text-xs text-gray-500">
					{inputCode.length.toLocaleString()} 文字 / {inputCode.split('\n').length} 行
				</div>
			</div>
			<textarea
				bind:value={inputCode}
				class="h-80 w-full rounded border border-gray-300 p-3 font-mono text-sm"
				placeholder="プログラミングコードをここに貼り付けてください"
			></textarea>
		</div>

		<!-- 出力エリア -->
		<div class="rounded-lg border border-gray-200 bg-white p-4">
			<div class="mb-3 flex items-center justify-between">
				<h3 class="font-medium text-gray-900">整形済みコード</h3>
				<div class="flex items-center gap-2">
					<div class="text-xs text-gray-500">
						{outputCode.length.toLocaleString()} 文字 / {outputCode.split('\n').length} 行
					</div>
					{#if outputCode}
						<button
							on:click={() => copyToClipboard(outputCode)}
							class="rounded bg-green-600 px-3 py-1 text-sm text-white hover:bg-green-700"
						>
							<Icon icon="mdi:content-copy" class="mr-1 inline h-4 w-4" />
							コピー
						</button>
					{/if}
				</div>
			</div>
			<textarea
				bind:value={outputCode}
				readonly
				class="h-80 w-full rounded border border-gray-300 bg-gray-50 p-3 font-mono text-sm"
				placeholder="整形済みのコードがここに表示されます"
			></textarea>
		</div>
	</div>

	<!-- 変更差分プレビュー -->
	{#if inputCode && outputCode && inputCode !== outputCode}
		{@const diff = getDiffPreview()}
		<div class="mt-4 rounded-lg border border-gray-200 bg-white p-4">
			<h3 class="mb-3 font-medium text-gray-900">
				変更概要 ({diff.changed} 行が変更されました)
			</h3>
			<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
				{#if diff.removed.length > 0}
					<div>
						<h4 class="mb-2 text-sm font-medium text-red-600">削除された内容 (最初の5行)</h4>
						<div class="max-h-32 overflow-y-auto rounded bg-red-50 p-2 font-mono text-xs">
							{#each diff.removed.slice(0, 5) as line, i (i)}
								<div class="text-red-700">{line}</div>
							{/each}
						</div>
					</div>
				{/if}
				{#if diff.added.length > 0}
					<div>
						<h4 class="mb-2 text-sm font-medium text-green-600">追加された内容 (最初の5行)</h4>
						<div class="max-h-32 overflow-y-auto rounded bg-green-50 p-2 font-mono text-xs">
							{#each diff.added.slice(0, 5) as line, i (i)}
								<div class="text-green-700">{line}</div>
							{/each}
						</div>
					</div>
				{/if}
			</div>
		</div>
	{/if}

	<!-- 使用方法 -->
	<div class="mt-6 rounded-lg border border-gray-200 bg-gray-50 p-4">
		<h3 class="mb-2 font-medium text-gray-900">使用方法</h3>
		<ul class="space-y-1 text-sm text-gray-600">
			<li>• プログラミングコードを上の入力欄に貼り付けます</li>
			<li>• 自動的に不要な空白が削除され、右側に整形済みコードが表示されます</li>
			<li>• 整形済みコードは自動的にクリップボードにコピーされます</li>
			<li>• 設定オプションで以下の機能を個別に選択できます：</li>
			<li class="ml-4">- 空白行の空白削除</li>
			<li class="ml-4">- 行末尾空白の削除</li>
			<li class="ml-4">- タブをスペースに変換（2-8スペース設定可能）</li>
		</ul>
	</div>
</div>

<script lang="ts">
	import { tools } from '$lib/data/tools';
	import Icon from '@iconify/svelte';
	import { splitPdf } from '$lib/pdf-ops';
	import { createPdfPageRenderer } from '$lib/pdf-first-page-image';

	const tool = tools.find((t) => t.name === 'pdf-split');

	interface PageEntry {
		id: number;
		pageNum: number;
		previewUrl: string | null;
	}

	let nextId = 0;
	let splitFile: File | null = $state(null);
	let pageEntries = $state<PageEntry[]>([]);
	let pageRenderer: Awaited<ReturnType<typeof createPdfPageRenderer>> | null = null;
	let splitDragOver = $state(false);
	let isSplitting = $state(false);
	// dividers[i] = split between page i+1 and i+2 (0-based index, length = pageCount-1)
	let dividers = $state<boolean[]>([]);
	let draggedDividerIndex: number | null = $state(null);
	let dropTargetDividerIndex: number | null = $state(null);

	function downloadBlob(blob: Blob, name: string) {
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = name;
		a.click();
		URL.revokeObjectURL(url);
	}

	async function loadSplitFile(file: File) {
		for (const e of pageEntries) {
			if (e.previewUrl) URL.revokeObjectURL(e.previewUrl);
		}
		splitFile = file;
		pageEntries = [];
		pageRenderer = null;
		dividers = [];

		try {
			pageRenderer = await createPdfPageRenderer(file);
			pageEntries = Array.from({ length: pageRenderer.pageCount }, (_, i) => ({
				id: nextId++,
				pageNum: i + 1,
				previewUrl: null as string | null
			}));
			// デフォルト: 区切りなし（1つのPDFのまま）
			dividers = Array(pageRenderer.pageCount - 1).fill(false);

			for (const entry of pageEntries) {
				try {
					const url = await pageRenderer!.renderPage(entry.pageNum);
					pageEntries = pageEntries.map((e) => (e.id === entry.id ? { ...e, previewUrl: url } : e));
				} catch {
					// スキップ
				}
			}
		} catch {
			pageEntries = [];
		}
	}

	function handleSplitDrop(e: DragEvent) {
		e.preventDefault();
		splitDragOver = false;
		const file = e.dataTransfer?.files?.[0];
		if (file?.type === 'application/pdf') loadSplitFile(file);
	}

	function handleSplitFileSelect(e: Event) {
		const file = (e.target as HTMLInputElement).files?.[0];
		if (file?.type === 'application/pdf') loadSplitFile(file);
		(e.target as HTMLInputElement).value = '';
	}

	function toggleDivider(index: number) {
		dividers = dividers.map((v, i) => (i === index ? !v : v));
	}

	function moveDivider(fromIndex: number, toIndex: number) {
		if (fromIndex === toIndex) return;
		const arr = [...dividers];
		const val = arr[fromIndex];
		arr[fromIndex] = false;
		arr[toIndex] = val;
		dividers = arr;
	}

	function handleDividerDragStart(e: DragEvent, index: number) {
		if (!dividers[index]) return; // オフの区切りはドラッグ不可
		draggedDividerIndex = index;
		e.dataTransfer?.setData('text/plain', String(index));
		e.dataTransfer!.effectAllowed = 'move';
	}

	function handleDividerDragOver(e: DragEvent, index: number) {
		e.preventDefault();
		e.dataTransfer!.dropEffect = 'move';
		dropTargetDividerIndex = index;
	}

	function handleDividerDragLeave() {
		dropTargetDividerIndex = null;
	}

	function handleDividerDrop(e: DragEvent, toIndex: number) {
		e.preventDefault();
		dropTargetDividerIndex = null;
		if (draggedDividerIndex === null) return;
		moveDivider(draggedDividerIndex, toIndex);
		draggedDividerIndex = null;
	}

	function handleDividerDragEnd() {
		draggedDividerIndex = null;
		dropTargetDividerIndex = null;
	}

	function dividersToRanges(): { start: number; end: number }[] {
		const ranges: { start: number; end: number }[] = [];
		let start = 1;
		for (let i = 0; i < dividers.length; i++) {
			if (dividers[i]) {
				ranges.push({ start, end: i + 1 });
				start = i + 2;
			}
		}
		if (pageEntries.length > 0) {
			ranges.push({ start, end: pageEntries.length });
		}
		return ranges;
	}

	async function doSplitAndDownload() {
		if (!splitFile || pageEntries.length === 0) return;
		const ranges = dividersToRanges();
		if (ranges.length === 0) return;

		isSplitting = true;
		try {
			const results = await splitPdf(splitFile, ranges);
			const baseName = splitFile.name.replace(/\.pdf$/i, '');
			const blobs = results.map((r) => new Blob([r], { type: 'application/pdf' }));

			if ('showDirectoryPicker' in window) {
				try {
					const dirHandle = await (
						window as Window & { showDirectoryPicker: () => Promise<FileSystemDirectoryHandle> }
					).showDirectoryPicker();
					for (let i = 0; i < blobs.length; i++) {
						const fileHandle = await dirHandle.getFileHandle(`${baseName}_${i + 1}.pdf`, {
							create: true
						});
						const writable = await fileHandle.createWritable();
						await writable.write(blobs[i]);
						await writable.close();
					}
				} catch (e) {
					if ((e as Error).name !== 'AbortError') throw e;
				}
			} else {
				for (let i = 0; i < blobs.length; i++) {
					downloadBlob(blobs[i], `${baseName}_${i + 1}.pdf`);
				}
				await new Promise((r) => setTimeout(r, 400));
			}
		} catch (err) {
			alert('分割に失敗しました: ' + (err instanceof Error ? err.message : String(err)));
		} finally {
			isSplitting = false;
		}
	}

	function clearSplit() {
		for (const entry of pageEntries) {
			if (entry.previewUrl) URL.revokeObjectURL(entry.previewUrl);
		}
		splitFile = null;
		pageEntries = [];
		pageRenderer = null;
		dividers = [];
	}
</script>

<div class="mx-auto max-w-7xl">
	<div class="mb-6 flex items-center">
		{#if tool?.icon}<Icon icon={tool.icon} class="mr-4 h-10 w-10" />{/if}
		<h1 class="text-3xl font-bold">{tool?.nameJa}</h1>
	</div>

	<div class="space-y-4">
		<div
			class="rounded-lg border-2 border-dashed p-8 text-center transition-colors {splitDragOver
				? 'border-blue-400 bg-blue-50'
				: 'border-gray-300'}"
			ondragover={(e) => {
				e.preventDefault();
				splitDragOver = true;
			}}
			ondragleave={() => (splitDragOver = false)}
			ondrop={handleSplitDrop}
		>
			<input
				type="file"
				accept="application/pdf"
				class="hidden"
				id="split-input"
				onchange={handleSplitFileSelect}
			/>
			<label for="split-input" class="cursor-pointer">
				<Icon icon="mdi:file-pdf-box" class="mx-auto mb-2 h-12 w-12 text-gray-400" />
				<p class="text-gray-600">PDFファイルをドラッグ＆ドロップ または クリックして選択</p>
			</label>
		</div>
		{#if splitFile}
			<div class="rounded-lg border border-gray-200 bg-gray-50 p-4">
				<p class="mb-2 font-medium">{splitFile.name}（{pageEntries.length}ページ）</p>
				<p class="mb-4 text-xs text-gray-500">
					区切りをクリックでオン/オフ、オン時はドラッグで位置を移動できます。青=分割あり
				</p>
				<div class="mb-4 flex flex-wrap items-stretch gap-0 overflow-x-auto pb-2">
					{#each pageEntries as entry, i (entry.id)}
						<div class="flex items-center gap-0">
							<div
								class="flex max-w-[200px] min-w-[140px] flex-col rounded border border-gray-200 bg-white"
							>
								<div class="border-b border-gray-200 px-2 py-1 text-center text-sm font-medium">
									ページ {entry.pageNum}
								</div>
								<div
									class="flex min-h-[180px] items-center justify-center overflow-hidden bg-gray-100 p-2"
								>
									{#if entry.previewUrl}
										<img
											src={entry.previewUrl}
											alt={`ページ ${entry.pageNum}`}
											class="max-h-[35vh] max-w-full object-contain"
											draggable="false"
										/>
									{:else}
										<p class="text-xs text-gray-500">読み込み中...</p>
									{/if}
								</div>
							</div>
							{#if i < dividers.length}
								<div
									draggable={dividers[i]}
									role="button"
									tabindex="0"
									class="flex w-8 shrink-0 cursor-pointer flex-col items-center justify-center self-stretch transition-colors {dividers[
										i
									]
										? 'bg-blue-500 hover:bg-blue-600'
										: 'bg-gray-300 hover:bg-gray-400'} {draggedDividerIndex === i
										? 'opacity-50'
										: ''} {dropTargetDividerIndex === i && draggedDividerIndex !== i
										? 'ring-2 ring-blue-300'
										: ''}"
									title={dividers[i] ? 'クリックでオフ、ドラッグで移動' : 'クリックでオン'}
									ondragstart={(e) => handleDividerDragStart(e, i)}
									ondragover={(e) => handleDividerDragOver(e, i)}
									ondragleave={handleDividerDragLeave}
									ondrop={(e) => handleDividerDrop(e, i)}
									ondragend={handleDividerDragEnd}
									onclick={() => toggleDivider(i)}
								>
									{#if dividers[i]}
										<Icon icon="mdi:content-cut" class="h-5 w-5 text-white" />
									{:else}
										<span class="text-xs text-gray-600">|</span>
									{/if}
								</div>
							{/if}
						</div>
					{/each}
				</div>
				<div class="flex gap-2">
					<button
						type="button"
						onclick={doSplitAndDownload}
						disabled={pageEntries.length === 0 || isSplitting}
						class="flex items-center gap-2 rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
					>
						{#if isSplitting}
							<Icon icon="mdi:loading" class="h-5 w-5 animate-spin" />
							<span>処理中...</span>
						{:else}
							分割してダウンロード
						{/if}
					</button>
					<button
						type="button"
						onclick={clearSplit}
						class="rounded bg-gray-500 px-4 py-2 text-white hover:bg-gray-600"
					>
						クリア
					</button>
				</div>
			</div>
		{/if}
	</div>
</div>

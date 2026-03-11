<script lang="ts">
	import { tools } from '$lib/data/tools';
	import Icon from '@iconify/svelte';
	import { reorderOrRemovePages } from '$lib/pdf-ops';
	import { createPdfPageRenderer } from '$lib/pdf-first-page-image';

	const tool = tools.find((t) => t.name === 'pdf-edit');

	interface PageEntry {
		id: number;
		pageNum: number;
		previewUrl: string | null;
	}

	let nextId = 0;
	let reorderFile: File | null = $state(null);
	let pageEntries = $state<PageEntry[]>([]);
	let pageRenderer: Awaited<ReturnType<typeof createPdfPageRenderer>> | null = null;
	let reorderDragOver = $state(false);
	let isReordering = $state(false);
	let draggedIndex: number | null = $state(null);
	let dropTargetIndex: number | null = $state(null);

	function downloadBlob(blob: Blob, name: string) {
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = name;
		a.click();
		URL.revokeObjectURL(url);
	}

	async function loadReorderFile(file: File) {
		// 既存のプレビューURLを解放
		for (const e of pageEntries) {
			if (e.previewUrl) URL.revokeObjectURL(e.previewUrl);
		}
		reorderFile = file;
		pageEntries = [];
		pageRenderer = null;

		try {
			pageRenderer = await createPdfPageRenderer(file);
			pageEntries = Array.from({ length: pageRenderer.pageCount }, (_, i) => ({
				id: nextId++,
				pageNum: i + 1,
				previewUrl: null as string | null
			}));

			// 各ページのプレビューを非同期で読み込み
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

	function handleReorderDrop(e: DragEvent) {
		e.preventDefault();
		reorderDragOver = false;
		const file = e.dataTransfer?.files?.[0];
		if (file?.type === 'application/pdf') loadReorderFile(file);
	}

	function handleReorderFileSelect(e: Event) {
		const file = (e.target as HTMLInputElement).files?.[0];
		if (file?.type === 'application/pdf') loadReorderFile(file);
		(e.target as HTMLInputElement).value = '';
	}

	function movePage(fromIndex: number, toIndex: number) {
		if (fromIndex === toIndex) return;
		const arr = [...pageEntries];
		const [item] = arr.splice(fromIndex, 1);
		arr.splice(toIndex, 0, item);
		pageEntries = arr;
	}

	function handleItemDragStart(e: DragEvent, index: number) {
		draggedIndex = index;
		e.dataTransfer?.setData('text/plain', String(index));
		e.dataTransfer!.effectAllowed = 'move';
	}

	function handleItemDragOver(e: DragEvent, index: number) {
		e.preventDefault();
		e.dataTransfer!.dropEffect = 'move';
		dropTargetIndex = index;
	}

	function handleItemDragLeave() {
		dropTargetIndex = null;
	}

	function handleItemDrop(e: DragEvent, toIndex: number) {
		e.preventDefault();
		dropTargetIndex = null;
		if (draggedIndex === null) return;
		movePage(draggedIndex, toIndex);
		draggedIndex = null;
	}

	function handleItemDragEnd() {
		draggedIndex = null;
		dropTargetIndex = null;
	}

	function removePage(index: number) {
		const entry = pageEntries[index];
		if (entry.previewUrl) URL.revokeObjectURL(entry.previewUrl);
		pageEntries = pageEntries.filter((_, j) => j !== index);
	}

	async function doApplyAndDownload() {
		if (!reorderFile || pageEntries.length === 0) return;
		const order = pageEntries.map((e) => e.pageNum);
		isReordering = true;
		try {
			const result = await reorderOrRemovePages(reorderFile, order);
			const blob = new Blob([result], { type: 'application/pdf' });
			const fileName = reorderFile.name.replace('.pdf', '_edited.pdf');

			// File System Access API: 保存ダイアログの選択/キャンセルを検知できる
			if ('showSaveFilePicker' in window) {
				try {
					const handle = await (
						window as Window & { showSaveFilePicker: (o?: object) => Promise<FileSystemFileHandle> }
					).showSaveFilePicker({
						suggestedName: fileName,
						types: [{ description: 'PDF', accept: { 'application/pdf': ['.pdf'] } }]
					});
					const writable = await handle.createWritable();
					await writable.write(blob);
					await writable.close();
				} catch (e) {
					if ((e as Error).name !== 'AbortError') throw e;
				}
			} else {
				downloadBlob(blob, fileName);
				await new Promise((r) => setTimeout(r, 400));
			}
		} catch (err) {
			alert('編集に失敗しました: ' + (err instanceof Error ? err.message : String(err)));
		} finally {
			isReordering = false;
		}
	}

	function clearReorder() {
		for (const entry of pageEntries) {
			if (entry.previewUrl) URL.revokeObjectURL(entry.previewUrl);
		}
		reorderFile = null;
		pageEntries = [];
		pageRenderer = null;
	}
</script>

<div class="mx-auto max-w-7xl">
	<div class="mb-6 flex items-center">
		{#if tool?.icon}<Icon icon={tool.icon} class="mr-4 h-10 w-10" />{/if}
		<h1 class="text-3xl font-bold">{tool?.nameJa}</h1>
	</div>

	<div class="space-y-4">
		<div
			role="region"
			aria-label="PDFファイルをドロップするエリア"
			class="rounded-lg border-2 border-dashed p-8 text-center transition-colors {reorderDragOver
				? 'border-blue-400 bg-blue-50'
				: 'border-gray-300'}"
			ondragover={(e) => {
				e.preventDefault();
				reorderDragOver = true;
			}}
			ondragleave={() => (reorderDragOver = false)}
			ondrop={handleReorderDrop}
		>
			<input
				type="file"
				accept="application/pdf"
				class="hidden"
				id="reorder-input"
				onchange={handleReorderFileSelect}
			/>
			<label for="reorder-input" class="cursor-pointer">
				<Icon icon="mdi:file-pdf-box" class="mx-auto mb-2 h-12 w-12 text-gray-400" />
				<p class="text-gray-600">PDFファイルをドラッグ＆ドロップ または クリックして選択</p>
			</label>
		</div>
		{#if reorderFile}
			<div class="rounded-lg border border-gray-200 bg-gray-50 p-4">
				<p class="mb-2 font-medium">{reorderFile.name}（{pageEntries.length}ページ）</p>
				<p class="mb-4 text-xs text-gray-500">
					画像をドラッグして順序を変更、削除ボタンでページを削除できます
				</p>
				<div class="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
					{#each pageEntries as entry, i (entry.id)}
						<div
							class="flex flex-col rounded border bg-white transition-colors {dropTargetIndex ===
								i && draggedIndex !== i
								? 'border-blue-400 bg-blue-50 ring-2 ring-blue-200'
								: 'border-gray-200 hover:border-gray-300'} {draggedIndex === i ? 'opacity-50' : ''}"
						>
							<div class="flex items-center justify-between border-b border-gray-200 px-2 py-1.5">
								<span class="text-sm font-medium">ページ {entry.pageNum}</span>
								<button
									type="button"
									onclick={(e) => {
										e.stopPropagation();
										removePage(i);
									}}
									class="rounded p-1 text-red-600 hover:bg-red-50"
									title="削除"
								>
									<Icon icon="mdi:delete-outline" class="h-5 w-5" />
								</button>
							</div>
							<div
								draggable="true"
								role="button"
								tabindex="0"
								class="flex min-h-[200px] flex-1 cursor-grab items-center justify-center overflow-hidden bg-gray-100 active:cursor-grabbing"
								ondragstart={(e) => handleItemDragStart(e, i)}
								ondragover={(e) => handleItemDragOver(e, i)}
								ondragleave={handleItemDragLeave}
								ondrop={(e) => handleItemDrop(e, i)}
								ondragend={handleItemDragEnd}
							>
								{#if entry.previewUrl}
									<img
										src={entry.previewUrl}
										alt={`ページ ${entry.pageNum}`}
										class="max-h-[40vh] max-w-full object-contain"
										draggable="false"
									/>
								{:else}
									<p class="text-sm text-gray-500">読み込み中...</p>
								{/if}
							</div>
						</div>
					{/each}
				</div>
				<div class="flex gap-2">
					<button
						type="button"
						onclick={doApplyAndDownload}
						disabled={pageEntries.length === 0 || isReordering}
						class="flex items-center gap-2 rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
					>
						{#if isReordering}
							<Icon icon="mdi:loading" class="h-5 w-5 animate-spin" />
							<span>処理中...</span>
						{:else}
							適用してダウンロード
						{/if}
					</button>
					<button
						type="button"
						onclick={clearReorder}
						class="rounded bg-gray-500 px-4 py-2 text-white hover:bg-gray-600"
					>
						クリア
					</button>
				</div>
			</div>
		{/if}
	</div>
</div>

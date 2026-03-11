<script lang="ts">
	import { tools } from '$lib/data/tools';
	import Icon from '@iconify/svelte';
	import { mergePdfs } from '$lib/pdf-ops';
	import { pdfFirstPageToImageUrl } from '$lib/pdf-first-page-image';

	const tool = tools.find((t) => t.name === 'pdf-merge');

	interface FileEntry {
		id: number;
		file: File;
		previewUrl: string | null;
	}
	let nextId = 0;
	let mergeFiles = $state<FileEntry[]>([]);
	let mergeDragOver = $state(false);
	let isMerging = $state(false);
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

	async function addFilesWithPreview(files: File[]) {
		const entries: FileEntry[] = files.map((file) => ({
			id: nextId++,
			file,
			previewUrl: null as string | null
		}));
		mergeFiles = [...mergeFiles, ...entries];

		for (let i = 0; i < entries.length; i++) {
			const entry = entries[i];
			try {
				const url = await pdfFirstPageToImageUrl(entry.file);
				const idx = mergeFiles.findIndex((e) => e.id === entry.id);
				if (idx >= 0) {
					mergeFiles = mergeFiles.map((e) => (e.id === entry.id ? { ...e, previewUrl: url } : e));
				} else {
					URL.revokeObjectURL(url);
				}
			} catch {
				// プレビュー生成失敗時はスキップ（entry.previewUrl は null のまま）
			}
		}
	}

	function handleMergeDrop(e: DragEvent) {
		e.preventDefault();
		mergeDragOver = false;
		const files = Array.from(e.dataTransfer?.files ?? []).filter(
			(f) => f.type === 'application/pdf'
		);
		if (files.length) addFilesWithPreview(files);
	}

	function handleMergeFileSelect(e: Event) {
		const input = e.target as HTMLInputElement;
		const files = Array.from(input.files ?? []);
		if (files.length) addFilesWithPreview(files);
		(e.target as HTMLInputElement).value = '';
	}

	function moveFile(fromIndex: number, toIndex: number) {
		if (fromIndex === toIndex) return;
		const arr = [...mergeFiles];
		const [item] = arr.splice(fromIndex, 1);
		arr.splice(toIndex, 0, item);
		mergeFiles = arr;
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
		moveFile(draggedIndex, toIndex);
		draggedIndex = null;
	}

	function handleItemDragEnd() {
		draggedIndex = null;
		dropTargetIndex = null;
	}

	async function doMergeAndDownload() {
		if (mergeFiles.length < 2) {
			alert('2つ以上のPDFファイルを追加してください');
			return;
		}
		isMerging = true;
		try {
			const result = await mergePdfs(mergeFiles.map((e) => e.file));
			const blob = new Blob([result], { type: 'application/pdf' });

			// File System Access API: 保存ダイアログの選択/キャンセルを検知できる
			if ('showSaveFilePicker' in window) {
				try {
					const handle = await (
						window as Window & { showSaveFilePicker: (o?: object) => Promise<FileSystemFileHandle> }
					).showSaveFilePicker({
						suggestedName: 'merged.pdf',
						types: [{ description: 'PDF', accept: { 'application/pdf': ['.pdf'] } }]
					});
					const writable = await handle.createWritable();
					await writable.write(blob);
					await writable.close();
				} catch (e) {
					if ((e as Error).name !== 'AbortError') throw e;
					// ユーザーがキャンセルした場合はそのまま終了
				}
			} else {
				// フォールバック: 従来のダウンロード（ダイアログ表示の検知不可）
				downloadBlob(blob, 'merged.pdf');
				await new Promise((r) => setTimeout(r, 400));
			}
		} catch (err) {
			alert('結合に失敗しました: ' + (err instanceof Error ? err.message : String(err)));
		} finally {
			isMerging = false;
		}
	}

	function removeFile(index: number) {
		const entry = mergeFiles[index];
		if (entry.previewUrl) URL.revokeObjectURL(entry.previewUrl);
		mergeFiles = mergeFiles.filter((_, j) => j !== index);
	}

	function clearMerge() {
		for (const entry of mergeFiles) {
			if (entry.previewUrl) URL.revokeObjectURL(entry.previewUrl);
		}
		mergeFiles = [];
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
			class="rounded-lg border-2 border-dashed p-8 text-center transition-colors {mergeDragOver
				? 'border-blue-400 bg-blue-50'
				: 'border-gray-300'}"
			ondragover={(e) => {
				e.preventDefault();
				mergeDragOver = true;
			}}
			ondragleave={() => (mergeDragOver = false)}
			ondrop={handleMergeDrop}
		>
			<input
				type="file"
				accept="application/pdf"
				multiple
				class="hidden"
				id="merge-input"
				onchange={handleMergeFileSelect}
			/>
			<label for="merge-input" class="cursor-pointer">
				<Icon icon="mdi:file-pdf-box" class="mx-auto mb-2 h-12 w-12 text-gray-400" />
				<p class="text-gray-600">PDFファイルをドラッグ＆ドロップ または クリックして選択</p>
			</label>
		</div>
		{#if mergeFiles.length > 0}
			<div class="rounded-lg border border-gray-200 bg-gray-50 p-4">
				<p class="mb-2 font-medium">追加されたファイル（{mergeFiles.length}件）</p>
				<p class="mb-4 text-xs text-gray-500">画像部分をドラッグして順序を変更できます</p>
				<div class="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
					{#each mergeFiles as entry, i (entry.id)}
						<div
							class="flex flex-col rounded border bg-white transition-colors {dropTargetIndex ===
								i && draggedIndex !== i
								? 'border-blue-400 bg-blue-50 ring-2 ring-blue-200'
								: 'border-gray-200 hover:border-gray-300'} {draggedIndex === i ? 'opacity-50' : ''}"
						>
							<div class="flex items-center justify-between border-b border-gray-200 px-2 py-1.5">
								<span class="flex items-center gap-2 text-sm font-medium">
									{i + 1}. {entry.file.name}
								</span>
								<button
									type="button"
									onclick={(e) => {
										e.stopPropagation();
										removeFile(i);
									}}
									class="text-red-600 hover:underline"
								>
									削除
								</button>
							</div>
							<div
								draggable="true"
								role="button"
								tabindex="0"
								class="flex min-h-[300px] flex-1 cursor-grab items-center justify-center overflow-hidden bg-gray-100 active:cursor-grabbing"
								ondragstart={(e) => handleItemDragStart(e, i)}
								ondragover={(e) => handleItemDragOver(e, i)}
								ondragleave={handleItemDragLeave}
								ondrop={(e) => handleItemDrop(e, i)}
								ondragend={handleItemDragEnd}
							>
								{#if entry.previewUrl}
									<img
										src={entry.previewUrl}
										alt={`${entry.file.name} 1ページ目`}
										class="max-h-[50vh] max-w-full object-contain"
										draggable="false"
									/>
								{:else}
									<p class="text-sm text-gray-500">1ページ目を読み込み中...</p>
								{/if}
							</div>
						</div>
					{/each}
				</div>
				<div class="flex gap-2">
					<button
						type="button"
						onclick={doMergeAndDownload}
						disabled={mergeFiles.length < 2 || isMerging}
						class="flex items-center gap-2 rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
					>
						{#if isMerging}
							<Icon icon="mdi:loading" class="h-5 w-5 animate-spin" />
							<span>処理中...</span>
						{:else}
							結合してダウンロード
						{/if}
					</button>
					<button
						type="button"
						onclick={clearMerge}
						class="rounded bg-gray-500 px-4 py-2 text-white hover:bg-gray-600"
					>
						クリア
					</button>
				</div>
			</div>
		{/if}
	</div>
</div>

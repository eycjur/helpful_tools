<script lang="ts">
	import { onDestroy } from 'svelte';
	import { tools } from '$lib/data/tools';
	import Icon from '@iconify/svelte';
	import { assemblePdf } from './pdf-ops';
	import { createPdfPageRenderer } from './pdf-first-page-image';
	import {
		movePages,
		removePages,
		splitDoc,
		mergeWithNext,
		moveDoc,
		updateSelection,
		type Doc,
		type PageRef
	} from './organizer';

	const tool = tools.find((t) => t.name === 'pdf-edit');

	type Renderer = Awaited<ReturnType<typeof createPdfPageRenderer>>;

	let nextId = 0;
	let importGeneration = 0;
	// 元ファイルとレンダラー。画面表示は docs/thumbs で駆動するため意図的に非リアクティブにする
	/* eslint-disable svelte/prefer-svelte-reactivity */
	const sources = new Map<number, File>();
	const renderers = new Map<number, Renderer>();
	const rendering = new Set<string>();
	/* eslint-enable svelte/prefer-svelte-reactivity */

	let docs = $state<Doc[]>([]);
	let thumbs = $state<Record<string, string>>({});
	let selected = $state(new Set<number>());
	let anchor: number | null = null;
	let fileDragOver = $state(false);
	let busy = $state(false);
	let errorMessage = $state('');

	// ドラッグ中の対象（OSからのファイルドロップと区別する）
	let drag = $state<{ kind: 'pages' } | { kind: 'doc'; index: number } | null>(null);
	let pageDropTarget = $state<{ docId: number; index: number } | null>(null);
	let docDropIndex = $state<number | null>(null);

	const thumbKey = (p: PageRef) => `${p.srcId}:${p.pageIndex}`;

	/** 未生成のサムネイルを順次レンダリング */
	async function ensureThumbs(pages: PageRef[]) {
		for (const p of pages) {
			const key = thumbKey(p);
			if (thumbs[key] || rendering.has(key)) continue;
			const renderer = renderers.get(p.srcId);
			if (!renderer) continue;
			rendering.add(key);
			try {
				const url = await renderer.renderPage(p.pageIndex + 1);
				// レンダリング中に削除されたページ・ファイルのURLは即解放
				const stillUsed = docs.some((d) => d.pages.some((q) => thumbKey(q) === key));
				if (renderers.has(p.srcId) && stillUsed) thumbs[key] = url;
				else URL.revokeObjectURL(url);
			} catch {
				// プレビュー生成失敗時は「読み込み中」表示のまま
			} finally {
				rendering.delete(key);
			}
		}
	}

	async function addFiles(files: File[]) {
		const generation = importGeneration;
		errorMessage = '';
		for (const file of files) {
			const srcId = nextId++;
			try {
				const renderer = await createPdfPageRenderer(file);
				if (generation !== importGeneration) {
					await renderer.destroy();
					return;
				}
				if (renderer.pageCount === 0) {
					await renderer.destroy();
					throw new Error('ページがありません');
				}
				sources.set(srcId, file);
				renderers.set(srcId, renderer);
				const doc: Doc = {
					id: nextId++,
					name: file.name.replace(/\.pdf$/i, ''),
					expanded: false,
					pages: Array.from({ length: renderer.pageCount }, (_, i) => ({
						id: nextId++,
						srcId,
						pageIndex: i
					}))
				};
				docs = [...docs, doc];
				ensureThumbs(doc.pages.slice(0, 1));
			} catch (err) {
				if (generation !== importGeneration) return;
				errorMessage = `${file.name} を読み込めませんでした: ${err instanceof Error ? err.message : String(err)}`;
			}
		}
	}

	/** docs 更新後、参照されなくなった元ファイル・サムネイル・選択を破棄し、表示中のサムネイルを補完 */
	function commit(next: Doc[]) {
		docs = next;
		const pages = next.flatMap((d) => d.pages);
		const usedSrc = new Set(pages.map((p) => p.srcId));
		for (const [srcId, renderer] of [...renderers]) {
			if (usedSrc.has(srcId)) continue;
			sources.delete(srcId);
			renderers.delete(srcId);
			renderer.destroy().catch(() => {});
		}
		const usedThumbs = new Set(pages.map(thumbKey));
		for (const key of Object.keys(thumbs)) {
			if (usedThumbs.has(key)) continue;
			URL.revokeObjectURL(thumbs[key]);
			delete thumbs[key];
		}
		const alive = new Set(pages.map((p) => p.id));
		if ([...selected].some((id) => !alive.has(id))) {
			selected = new Set([...selected].filter((id) => alive.has(id)));
		}
		// 結合などで展開状態になったページのサムネイルを生成
		for (const d of next) ensureThumbs(d.expanded ? d.pages : d.pages.slice(0, 1));
	}

	onDestroy(clearAll);

	function toggleExpanded(doc: Doc) {
		doc.expanded = !doc.expanded;
		if (doc.expanded) {
			ensureThumbs(doc.pages);
		} else {
			// 非表示のページが Delete キーで消えないよう選択を外す
			const hidden = new Set(doc.pages.map((p) => p.id));
			selected = new Set([...selected].filter((id) => !hidden.has(id)));
			if (anchor !== null && hidden.has(anchor)) anchor = null;
		}
	}

	function handlePageClick(e: MouseEvent, doc: Doc, page: PageRef) {
		const state = updateSelection(
			{ selected, anchor },
			doc.pages.map((p) => p.id),
			page.id,
			{ shift: e.shiftKey, toggle: e.ctrlKey || e.metaKey }
		);
		selected = state.selected;
		anchor = state.anchor;
	}

	function deleteSelected() {
		if (selected.size === 0) return;
		commit(removePages(docs, selected));
		selected = new Set();
		anchor = null;
	}

	function handleKeydown(e: KeyboardEvent) {
		const target = e.target as HTMLElement;
		if (target.closest('input, textarea, [contenteditable="true"]')) return;
		if ((e.key === 'Delete' || e.key === 'Backspace') && selected.size > 0) {
			e.preventDefault();
			deleteSelected();
		} else if (e.key === 'Escape') {
			selected = new Set();
			anchor = null;
		}
	}

	// ---- ページのドラッグ＆ドロップ ----
	function handlePageDragStart(e: DragEvent, page: PageRef) {
		if (!selected.has(page.id)) {
			selected = new Set([page.id]);
			anchor = page.id;
		}
		drag = { kind: 'pages' };
		e.dataTransfer?.setData('text/plain', 'pages');
		if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
	}

	function handlePageDragOver(e: DragEvent, doc: Doc, index: number) {
		if (drag?.kind !== 'pages') return;
		e.preventDefault();
		e.stopPropagation();
		const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
		const after = e.clientX > rect.left + rect.width / 2;
		pageDropTarget = { docId: doc.id, index: after ? index + 1 : index };
	}

	// ---- ドキュメント（ファイル）単位のドラッグ＆ドロップ ----
	function handleDocDragOver(e: DragEvent, doc: Doc, index: number) {
		if (!drag) return;
		e.preventDefault();
		if (drag.kind === 'doc') {
			docDropIndex = index;
		} else if (!doc.expanded || pageDropTarget?.docId !== doc.id) {
			// 折りたたみ中（または別ファイルから入ってきた直後）は末尾に追加。
			// 展開中はページ間の隙間・分割ボタン上でも直前の挿入位置を保つ
			pageDropTarget = { docId: doc.id, index: doc.pages.length };
		}
	}

	function handleDrop(e: DragEvent) {
		if (!drag) return;
		e.preventDefault();
		e.stopPropagation();
		if (drag.kind === 'doc' && docDropIndex !== null) {
			commit(moveDoc(docs, drag.index, docDropIndex));
		} else if (drag.kind === 'pages' && pageDropTarget) {
			commit(movePages(docs, selected, pageDropTarget.docId, pageDropTarget.index));
		}
		endDrag();
	}

	function endDrag() {
		drag = null;
		pageDropTarget = null;
		docDropIndex = null;
	}

	// ---- OSからのファイル追加 ----
	function handleFileDrop(e: DragEvent) {
		e.preventDefault();
		fileDragOver = false;
		const files = Array.from(e.dataTransfer?.files ?? []).filter(
			(f) => f.type === 'application/pdf'
		);
		if (files.length) addFiles(files);
	}

	function handleFileSelect(e: Event) {
		const input = e.target as HTMLInputElement;
		const files = Array.from(input.files ?? []);
		input.value = '';
		if (files.length) addFiles(files);
	}

	// ---- 書き出し ----
	function downloadBlob(blob: Blob, name: string) {
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = name;
		a.click();
		// 連続ダウンロード時に保存前に失効しないよう遅らせて解放
		setTimeout(() => URL.revokeObjectURL(url), 1000);
	}

	async function buildBlob(doc: Doc): Promise<Blob> {
		const bytes = await assemblePdf(sources, doc.pages);
		return new Blob([bytes as BlobPart], { type: 'application/pdf' });
	}

	/** OSで使えない文字を置換し、同名ファイルの上書きを避けるため連番を付与 */
	function fileNames(list: Doc[]): string[] {
		const used: string[] = [];
		return list.map((d) => {
			// eslint-disable-next-line no-control-regex
			const base = d.name.replace(/[\\/:*?"<>|\x00-\x1f]/g, '_').trim() || 'document';
			let name = `${base}.pdf`;
			for (let n = 2; used.includes(name.toLowerCase()); n++) name = `${base} (${n}).pdf`;
			used.push(name.toLowerCase());
			return name;
		});
	}

	async function runExport(task: () => Promise<void>) {
		busy = true;
		errorMessage = '';
		try {
			await task();
		} catch (err) {
			if ((err as Error).name === 'AbortError') return; // 保存ダイアログのキャンセル
			errorMessage =
				'書き出しに失敗しました: ' + (err instanceof Error ? err.message : String(err));
		} finally {
			busy = false;
		}
	}

	function downloadDoc(doc: Doc) {
		return runExport(async () => {
			const [name] = fileNames([doc]);
			if ('showSaveFilePicker' in window) {
				// ユーザー操作の有効期限内に保存ダイアログを開くため、PDF組み立てより先に呼ぶ
				const handle = await (
					window as Window & { showSaveFilePicker: (o?: object) => Promise<FileSystemFileHandle> }
				).showSaveFilePicker({
					suggestedName: name,
					types: [{ description: 'PDF', accept: { 'application/pdf': ['.pdf'] } }]
				});
				let blob: Blob;
				try {
					blob = await buildBlob(doc);
				} catch (err) {
					// 保存ダイアログで確定した時点で空ファイルが作られている場合がある
					throw new Error(
						`${err instanceof Error ? err.message : String(err)}（保存先に空のファイルが作成されている場合は削除してください）`,
						{ cause: err }
					);
				}
				const writable = await handle.createWritable();
				await writable.write(blob);
				await writable.close();
			} else {
				downloadBlob(await buildBlob(doc), name);
			}
		});
	}

	function downloadAll() {
		if (docs.length === 1) return downloadDoc(docs[0]);
		return runExport(async () => {
			const names = fileNames(docs);
			if ('showDirectoryPicker' in window) {
				const dir = await (
					window as Window & { showDirectoryPicker: () => Promise<FileSystemDirectoryHandle> }
				).showDirectoryPicker();
				// 途中失敗で一部だけ書き出されないよう、先に全ファイルを組み立てる
				const blobs = [];
				for (const d of docs) blobs.push(await buildBlob(d));
				for (let i = 0; i < blobs.length; i++) {
					const blob = blobs[i];
					const handle = await dir.getFileHandle(names[i], { create: true });
					const writable = await handle.createWritable();
					await writable.write(blob);
					await writable.close();
				}
			} else {
				for (let i = 0; i < docs.length; i++) {
					downloadBlob(await buildBlob(docs[i]), names[i]);
				}
			}
		});
	}

	function clearAll() {
		importGeneration++;
		commit([]);
		selected = new Set();
		anchor = null;
		errorMessage = '';
	}

	const hasFormsOrSignatures = $derived(
		docs.some((doc) => doc.pages.some((p) => renderers.get(p.srcId)?.hasFormsOrSignatures))
	);

	const totalPages = $derived(docs.reduce((n, d) => n + d.pages.length, 0));
</script>

<!-- ドロップエリア外にファイルを落としてもブラウザがPDFを開かないようにする -->
<svelte:window
	onkeydown={handleKeydown}
	ondragover={(e) => {
		if (e.dataTransfer?.types.includes('Files')) e.preventDefault();
	}}
	ondrop={(e) => {
		if (e.dataTransfer?.types.includes('Files')) e.preventDefault();
	}}
/>

<div class="mx-auto max-w-7xl">
	<div class="mb-6 flex items-center">
		{#if tool?.icon}<Icon icon={tool.icon} class="mr-4 h-10 w-10" />{/if}
		<h1 class="text-3xl font-bold">{tool?.nameJa}</h1>
	</div>

	<div class="space-y-4">
		<div
			role="region"
			aria-label="PDFファイルをドロップするエリア"
			class="rounded-lg border-2 border-dashed p-6 text-center transition-colors {fileDragOver
				? 'border-blue-400 bg-blue-50'
				: 'border-gray-300'}"
			ondragover={(e) => {
				if (drag) return;
				e.preventDefault();
				fileDragOver = true;
			}}
			ondragleave={() => (fileDragOver = false)}
			ondrop={handleFileDrop}
		>
			<input
				type="file"
				accept="application/pdf"
				multiple
				class="hidden"
				id="pdf-input"
				onchange={handleFileSelect}
			/>
			<label for="pdf-input" class="cursor-pointer">
				<Icon icon="mdi:file-pdf-box" class="mx-auto mb-2 h-12 w-12 text-gray-400" />
				<p class="text-gray-600">
					PDFファイルをドラッグ＆ドロップ または クリックして選択（複数可）
				</p>
			</label>
		</div>

		{#if errorMessage}
			<p class="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{errorMessage}</p>
		{/if}

		{#if hasFormsOrSignatures}
			<p class="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
				フォームや電子署名を含むPDFがあります。書き出したPDFには、入力欄や検証可能な電子署名は引き継がれません。
			</p>
		{/if}

		{#if docs.length > 0}
			<div
				class="sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-white p-3 shadow-sm"
			>
				<span class="text-sm text-gray-700">{docs.length}ファイル / {totalPages}ページ</span>
				<button
					type="button"
					onclick={deleteSelected}
					disabled={selected.size === 0}
					class="rounded bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-700 disabled:opacity-40"
				>
					選択ページを削除（{selected.size}）
				</button>
				<div class="ml-auto flex gap-2">
					<button
						type="button"
						onclick={downloadAll}
						disabled={busy}
						class="flex items-center gap-2 rounded bg-blue-600 px-4 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
					>
						{#if busy}<Icon icon="mdi:loading" class="h-4 w-4 animate-spin" />{/if}
						すべてダウンロード
					</button>
					<button
						type="button"
						onclick={clearAll}
						class="rounded bg-gray-500 px-4 py-1.5 text-sm text-white hover:bg-gray-600"
					>
						クリア
					</button>
				</div>
			</div>
			<p class="text-xs text-gray-500">
				ページはクリックで選択（Shift: 範囲選択 / Ctrl・⌘:
				複数選択）、選択したページはまとめてドラッグで移動（別ファイルへも可）・Delete
				キーで削除できます。ページ間の
				<Icon icon="mdi:content-cut" class="inline h-3 w-3" /> で分割、ファイル間の「結合」で1つにまとめます。
			</p>

			<div>
				{#each docs as doc, di (doc.id)}
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<div
						class="rounded-lg border bg-gray-50 transition-colors {docDropIndex === di &&
						drag?.kind === 'doc' &&
						drag.index !== di
							? 'border-blue-400 ring-2 ring-blue-200'
							: 'border-gray-200'} {drag?.kind === 'doc' && drag.index === di ? 'opacity-50' : ''}"
						ondragover={(e) => handleDocDragOver(e, doc, di)}
						ondrop={handleDrop}
					>
						<div class="flex flex-wrap items-center gap-2 border-b border-gray-200 px-3 py-2">
							<span
								draggable="true"
								role="button"
								tabindex="-1"
								aria-label="ドラッグしてファイルの順序を変更"
								title="ドラッグしてファイルの順序を変更"
								class="cursor-grab text-gray-400 hover:text-gray-600 active:cursor-grabbing"
								ondragstart={(e) => {
									drag = { kind: 'doc', index: di };
									e.dataTransfer?.setData('text/plain', 'doc');
									if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
								}}
								ondragend={endDrag}
							>
								<Icon icon="mdi:drag-vertical" class="h-6 w-6" />
							</span>
							<button
								type="button"
								onclick={() => toggleExpanded(doc)}
								aria-expanded={doc.expanded}
								aria-label={doc.expanded ? 'ページを閉じる' : 'ページを表示'}
								class="rounded p-1 hover:bg-gray-200"
							>
								<Icon
									icon="mdi:chevron-right"
									class="h-5 w-5 transition-transform {doc.expanded ? 'rotate-90' : ''}"
								/>
							</button>
							<input
								type="text"
								bind:value={doc.name}
								aria-label="出力ファイル名"
								class="min-w-0 flex-1 rounded border border-transparent bg-transparent px-1 py-0.5 font-medium hover:border-gray-300 focus:border-blue-400 focus:bg-white focus:outline-none"
							/>
							<span class="text-sm text-gray-500">.pdf・{doc.pages.length}ページ</span>
							<div class="flex items-center gap-1">
								<button
									type="button"
									onclick={() => commit(moveDoc(docs, di, di - 1))}
									disabled={di === 0}
									aria-label="上へ移動"
									class="rounded p-1 hover:bg-gray-200 disabled:opacity-30"
								>
									<Icon icon="mdi:arrow-up" class="h-5 w-5" />
								</button>
								<button
									type="button"
									onclick={() => commit(moveDoc(docs, di, di + 1))}
									disabled={di === docs.length - 1}
									aria-label="下へ移動"
									class="rounded p-1 hover:bg-gray-200 disabled:opacity-30"
								>
									<Icon icon="mdi:arrow-down" class="h-5 w-5" />
								</button>
								<button
									type="button"
									onclick={() => downloadDoc(doc)}
									disabled={busy}
									aria-label="このファイルをダウンロード"
									title="このファイルをダウンロード"
									class="rounded p-1 text-blue-600 hover:bg-blue-50 disabled:opacity-30"
								>
									<Icon icon="mdi:download" class="h-5 w-5" />
								</button>
								<button
									type="button"
									onclick={() => commit(docs.filter((d) => d.id !== doc.id))}
									aria-label="このファイルを削除"
									title="このファイルを削除"
									class="rounded p-1 text-red-600 hover:bg-red-50"
								>
									<Icon icon="mdi:delete-outline" class="h-5 w-5" />
								</button>
							</div>
						</div>

						{#if doc.expanded}
							<div class="flex flex-wrap items-stretch gap-y-3 p-3 select-none">
								{#each doc.pages as page, pi (page.id)}
									{@const isSelected = selected.has(page.id)}
									<div class="flex items-stretch">
										<!-- svelte-ignore a11y_click_events_have_key_events -->
										<div
											draggable="true"
											role="option"
											tabindex="-1"
											aria-selected={isSelected}
											class="group relative flex w-36 cursor-pointer flex-col rounded border-2 bg-white transition-colors {isSelected
												? 'border-blue-500 bg-blue-50'
												: 'border-gray-200 hover:border-gray-400'}"
											onclick={(e) => handlePageClick(e, doc, page)}
											ondragstart={(e) => handlePageDragStart(e, page)}
											ondragover={(e) => handlePageDragOver(e, doc, pi)}
											ondrop={handleDrop}
											ondragend={endDrag}
										>
											<!-- 挿入位置バー（レイアウトをずらさないよう absolute で重ねる） -->
											{#if pageDropTarget?.docId === doc.id && pageDropTarget.index === pi}
												<div
													class="pointer-events-none absolute inset-y-0 -left-1.5 w-1 rounded bg-blue-500"
												></div>
											{/if}
											{#if pi === doc.pages.length - 1 && pageDropTarget?.docId === doc.id && pageDropTarget.index === doc.pages.length}
												<div
													class="pointer-events-none absolute inset-y-0 -right-1.5 w-1 rounded bg-blue-500"
												></div>
											{/if}
											<div
												class="flex h-44 items-center justify-center overflow-hidden bg-gray-100 p-1"
											>
												{#if thumbs[thumbKey(page)]}
													<img
														src={thumbs[thumbKey(page)]}
														alt={`ページ ${pi + 1}`}
														class="max-h-full max-w-full object-contain"
														draggable="false"
													/>
												{:else}
													<p class="text-xs text-gray-500">読み込み中...</p>
												{/if}
											</div>
											<div class="px-1 py-0.5 text-center text-xs text-gray-600">{pi + 1}</div>
											<button
												type="button"
												aria-label={`ページ ${pi + 1} を削除`}
												class="absolute top-1 right-1 hidden rounded-full bg-white/90 p-0.5 text-red-600 shadow group-hover:block"
												onclick={(e) => {
													e.stopPropagation();
													commit(removePages(docs, new Set([page.id])));
												}}
											>
												<Icon icon="mdi:close" class="h-4 w-4" />
											</button>
										</div>
										{#if pi < doc.pages.length - 1}
											<button
												type="button"
												onclick={() => commit(splitDoc(docs, doc.id, pi + 1, nextId++))}
												aria-label={`ページ ${pi + 1} と ${pi + 2} の間で分割`}
												title="ここで分割"
												class="mx-1 flex w-6 shrink-0 items-center justify-center rounded text-gray-300 hover:bg-orange-100 hover:text-orange-600"
											>
												<Icon icon="mdi:content-cut" class="h-4 w-4 rotate-90" />
											</button>
										{/if}
									</div>
								{/each}
							</div>
						{:else}
							<!-- svelte-ignore a11y_click_events_have_key_events -->
							<!-- svelte-ignore a11y_no_static_element_interactions -->
							<div
								class="flex cursor-pointer items-center gap-3 p-3 {pageDropTarget?.docId === doc.id
									? 'bg-blue-50'
									: ''}"
								onclick={() => toggleExpanded(doc)}
							>
								<div
									class="flex h-24 w-20 items-center justify-center overflow-hidden rounded border border-gray-200 bg-gray-100"
								>
									{#if doc.pages[0] && thumbs[thumbKey(doc.pages[0])]}
										<img
											src={thumbs[thumbKey(doc.pages[0])]}
											alt={`${doc.name} 1ページ目`}
											class="max-h-full max-w-full object-contain"
											draggable="false"
										/>
									{:else}
										<Icon icon="mdi:file-pdf-box" class="h-8 w-8 text-gray-400" />
									{/if}
								</div>
								<p class="text-sm text-gray-500">クリックでページを表示</p>
							</div>
						{/if}
					</div>

					{#if di < docs.length - 1}
						<div class="flex justify-center py-2">
							<button
								type="button"
								onclick={() => commit(mergeWithNext(docs, di))}
								class="flex items-center gap-1 rounded-full border border-gray-300 bg-white px-3 py-1 text-xs text-gray-600 hover:border-green-500 hover:bg-green-50 hover:text-green-700"
							>
								<Icon icon="mdi:merge" class="h-4 w-4" />
								結合
							</button>
						</div>
					{/if}
				{/each}
			</div>
		{/if}
	</div>
</div>

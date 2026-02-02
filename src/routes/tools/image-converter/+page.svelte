<script lang="ts">
	import { tools } from '$lib/data/tools';
	import Icon from '@iconify/svelte';
	import { onDestroy } from 'svelte';

	type LoadedItem = {
		id: number;
		file: File;
		name: string;
		type: string;
		src: string;
		width: number;
		height: number;
	};

	type ResultItem = {
		name: string;
		blob: Blob;
		url: string;
		mime: string;
		fallback?: boolean;
	};

	const tool = tools.find((t) => t.name === 'image-converter');

	let hiddenCanvas: HTMLCanvasElement; // DOM常駐（bind喪失防止）
	let items: LoadedItem[] = [];
	let results: ResultItem[] = [];
	let isConverting = false;
	let dragOver = false;

	// 設定
	let quality = 0.8; // 0..1（JPEG/WebPに適用）
	let bgColor = '#ffffff'; // JPEG透過合成用

	const mimeByFormat: Record<string, string> = {
		png: 'image/png',
		jpeg: 'image/jpeg',
		webp: 'image/webp'
	};

	function revokeAll() {
		for (const it of items) URL.revokeObjectURL(it.src);
		for (const r of results) URL.revokeObjectURL(r.url);
	}

	function revokeResultUrls() {
		for (const r of results) URL.revokeObjectURL(r.url);
	}
	onDestroy(revokeAll);

	function addFiles(fileList: FileList | File[]) {
		const arr = Array.from(fileList);
		// 画像ファイルの先頭1件のみ受け付ける
		const f = arr.find((x) => x.type.startsWith('image/'));
		if (!f) return;

		// ファイルサイズ制限（100MB）
		const FILE_SIZE_MAX_THRESHOLD = 100 * 1024 * 1024; // 100MB
		const FILE_SIZE_WARNING_THRESHOLD = 50 * 1024 * 1024; // 50MB

		if (f.size > FILE_SIZE_MAX_THRESHOLD) {
			alert(
				`ファイルサイズが大きすぎます（${(f.size / 1024 / 1024).toFixed(1)}MB）。${FILE_SIZE_MAX_THRESHOLD / 1024 / 1024}MB以下のファイルを選択してください。`
			);
			return;
		}

		if (f.size > FILE_SIZE_WARNING_THRESHOLD) {
			const sizeMB = (f.size / 1024 / 1024).toFixed(1);
			if (
				!confirm(
					`ファイルサイズが大きいため（${sizeMB}MB）、処理に時間がかかる場合があります。続行しますか？`
				)
			) {
				return;
			}
		}

		// 既存のアイテム／結果をクリア（URLも解放）
		clearAll();

		const src = URL.createObjectURL(f);
		const it: LoadedItem = {
			id: 1,
			file: f,
			name: f.name,
			type: f.type,
			src,
			width: 0,
			height: 0
		};
		items = [it];

		// 画像の寸法を非同期で取得
		const img = new Image();
		img.onload = () => {
			it.width = img.naturalWidth;
			it.height = img.naturalHeight;
		};
		img.src = it.src;

		// 取り込み後に自動変換
		queueMicrotask(() => {
			convertAll();
		});
	}

	function onFileInput(e: Event) {
		const input = e.target as HTMLInputElement;
		if (input.files && input.files.length) {
			addFiles(input.files);
			input.value = '';
		}
	}
	function onDrop(e: DragEvent) {
		e.preventDefault();
		dragOver = false;
		if (e.dataTransfer?.files?.length) addFiles(e.dataTransfer.files);
	}

	function clearAll() {
		revokeAll();
		items = [];
		results = [];
	}

	function drawToCanvas(
		img: ImageBitmap | HTMLImageElement,
		mime: string,
		size: { width: number; height: number }
	) {
		const canvas = hiddenCanvas; // DOM常駐Canvasを使う
		canvas.width = size.width;
		canvas.height = size.height;
		const ctx = canvas.getContext('2d');
		if (!ctx) throw new Error('CanvasContext取得に失敗');

		// JPEGへ出力する場合は背景色を先に塗る（透過合成）
		if (mime === 'image/jpeg') {
			ctx.save();
			ctx.fillStyle = bgColor;
			ctx.fillRect(0, 0, canvas.width, canvas.height);
			ctx.restore();
		}

		ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
		return canvas;
	}

	async function encodeCanvas(
		canvas: HTMLCanvasElement,
		mime: string,
		q: number
	): Promise<{ blob: Blob; mime: string; fallback?: boolean }> {
		const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, mime, q));
		if (blob) return { blob, mime };
		throw new Error('エンコードに失敗しました');
	}

	function extByMime(mime: string) {
		return mime === 'image/png'
			? 'png'
			: mime === 'image/jpeg'
				? 'jpg'
				: mime === 'image/webp'
					? 'webp'
					: 'bin';
	}

	async function convertAll() {
		if (!items.length || isConverting) return;
		isConverting = true;
		revokeResultUrls();
		results = [];
		const targetFormats: Array<'png' | 'jpeg' | 'webp'> = ['png', 'jpeg', 'webp'];
		try {
			for (const it of items) {
				// 画像の読み込み（描画元を用意）
				let bitmap: ImageBitmap | null = null;
				try {
					bitmap = await createImageBitmap(it.file);
				} catch {
					bitmap = null; // createImageBitmap非対応
				}
				let width = it.width || (bitmap ? bitmap.width : 0);
				let height = it.height || (bitmap ? bitmap.height : 0);
				let imgEl: HTMLImageElement | null = null;
				if (!width || !height || !bitmap) {
					// bitmapがない、または寸法が未取得ならImage経由で寸法・描画元を用意
					imgEl = new Image();
					await new Promise<void>((resolve, reject) => {
						imgEl!.onload = () => resolve();
						imgEl!.onerror = () => reject(new Error('画像の読み込みに失敗'));
						imgEl!.src = it.src;
					});
					width = imgEl.naturalWidth;
					height = imgEl.naturalHeight;
				}
				const size = { width, height };

				for (const fmt of targetFormats) {
					const mime = mimeByFormat[fmt];
					const canvas = drawToCanvas(bitmap ?? (imgEl as HTMLImageElement), mime, size);
					const { blob, mime: outMime, fallback } = await encodeCanvas(canvas, mime, quality);
					const ext = extByMime(outMime);
					const base = it.name.replace(/\.[^.]+$/, '');
					const outName = `${base}.${ext}`;
					const url = URL.createObjectURL(blob);
					results = [...results, { name: outName, blob, url, mime: outMime, fallback }];
				}

				bitmap?.close?.();
			}
		} catch (e) {
			console.error(e);
		} finally {
			isConverting = false;
		}
	}

	function download(item: ResultItem) {
		const a = document.createElement('a');
		a.href = item.url;
		a.download = item.name;
		a.click();
	}
</script>

<div class="mx-auto max-w-2xl">
	<div class="mb-6 flex items-center">
		{#if tool?.icon}<Icon icon={tool.icon} class="mr-4 h-10 w-10" />{/if}
		<h1 class="text-3xl font-bold">{tool?.nameJa}</h1>
	</div>

	<!-- 設定 -->
	<div class="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2">
		<div class="rounded-lg border border-gray-200 bg-white p-4">
			<label for="quality-range" class="block text-sm font-medium text-gray-700"
				>画質（JPEG/WebP）
				<span class="ml-1 text-xs text-gray-500">{Math.round(quality * 100)}%</span>
			</label>
			<input
				id="quality-range"
				type="range"
				min="0.1"
				max="1"
				step="0.01"
				bind:value={quality}
				class="mt-2 w-full"
			/>
		</div>
		<div class="rounded-lg border border-gray-200 bg-white p-4">
			<label for="bg-color-input" class="block text-sm font-medium text-gray-700"
				>JPEG背景色（透過の合成先）</label
			>
			<input
				id="bg-color-input"
				type="color"
				bind:value={bgColor}
				class="mt-1 h-10 w-16 rounded border-gray-300"
			/>
		</div>
	</div>

	<!-- 取り込み -->
	<div
		role="button"
		tabindex="0"
		aria-label="画像ファイルをドラッグ&ドロップまたはクリックして選択"
		on:dragover|preventDefault={() => (dragOver = true)}
		on:dragleave={() => (dragOver = false)}
		on:drop={onDrop}
		on:click={() => document.getElementById('image-file-input')?.click()}
		on:keydown={(e) => {
			if (e.key === 'Enter' || e.key === ' ') {
				e.preventDefault();
				document.getElementById('image-file-input')?.click();
			}
		}}
		class="mb-4 flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 text-center transition-colors {dragOver
			? 'border-blue-400 bg-blue-50'
			: 'border-gray-300 bg-gray-50'}"
	>
		<p class="mb-2 text-gray-700">画像ファイルをドラッグ＆ドロップ</p>
		<p class="mb-3 text-xs text-gray-500">PNG / JPEG / WebP</p>
		<input
			id="image-file-input"
			type="file"
			accept="image/*"
			on:change={onFileInput}
			class="block"
		/>
	</div>

	{#if items.length}
		<div class="mb-4 flex items-center justify-end gap-2">
			<button
				on:click={convertAll}
				class="rounded bg-blue-600 px-3 py-2 text-white disabled:opacity-50"
				disabled={isConverting}>再変換</button
			>
			<button on:click={clearAll} class="rounded bg-gray-500 px-3 py-2 text-white">クリア</button>
		</div>

		<ul class="mb-6 grid grid-cols-1 gap-3">
			{#each items as it (it.id)}
				<li class="overflow-hidden rounded-lg border border-gray-200 bg-white">
					<img src={it.src} alt="input preview" class="h-72 w-full bg-gray-50 object-contain" />
				</li>
			{/each}
		</ul>
	{/if}

	{#if results.length}
		<ul class="grid grid-cols-1 gap-3 md:grid-cols-3">
			{#each results as r, i (i)}
				<li class="relative overflow-hidden rounded-lg border border-gray-200 bg-white">
					<img src={r.url} alt="converted preview" class="h-56 w-full bg-gray-50 object-contain" />
					<div
						class="absolute inset-x-0 bottom-0 flex items-center justify-between bg-black/50 px-2 py-1 text-xs text-white"
					>
						<span class="uppercase">{extByMime(r.mime)}</span>
						<button on:click={() => download(r)} class="rounded bg-green-500 px-2 py-1 text-white"
							>DL</button
						>
					</div>
				</li>
			{/each}
		</ul>
	{/if}

	<!-- 常駐Canvas（bind維持のため表示しない） -->
	<canvas bind:this={hiddenCanvas} class="hidden"></canvas>
</div>

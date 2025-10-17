<script lang="ts">
	import { tools } from '$lib/data/tools';
	import Icon from '@iconify/svelte';
	import CryptoJS from 'crypto-js';

	type HashResult = {
		algorithm: string;
		hash: string;
	};

	const tool = tools.find((t) => t.name === 'hash-calculator');
	const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

	let inputMode = $state<'file' | 'text'>('file');
	let file = $state<File | null>(null);
	let textInput = $state('');
	let results = $state<HashResult[]>([]);
	let isCalculating = $state(false);
	let dragOver = $state(false);
	let copyFeedback = $state<{ [key: string]: boolean }>({});
	let debounceTimer: ReturnType<typeof setTimeout>;

	const algorithms = ['MD5', 'SHA-1', 'SHA-256', 'SHA-384', 'SHA-512'];

	// ArrayBufferをCryptoJS WordArrayに変換
	function arrayBufferToWordArray(ab: ArrayBuffer) {
		const i8a = new Uint8Array(ab);
		const words: number[] = [];
		for (let i = 0; i < i8a.length; i += 4) {
			words.push(
				((i8a[i] || 0) << 24) |
					((i8a[i + 1] || 0) << 16) |
					((i8a[i + 2] || 0) << 8) |
					(i8a[i + 3] || 0)
			);
		}
		return CryptoJS.lib.WordArray.create(words, i8a.length);
	}

	function onFileInput(e: Event) {
		const input = e.target as HTMLInputElement;
		if (input.files && input.files.length) {
			const selectedFile = input.files[0];
			if (selectedFile.size > MAX_FILE_SIZE) {
				alert(`ファイルサイズが大きすぎます（最大: ${formatFileSize(MAX_FILE_SIZE)}）`);
				input.value = '';
				return;
			}
			file = selectedFile;
			input.value = '';
			calculateHashes();
		}
	}

	function onTextInput() {
		clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => {
			calculateHashes();
		}, 300);
	}

	function onDrop(e: DragEvent) {
		e.preventDefault();
		dragOver = false;
		if (e.dataTransfer?.files?.length) {
			const selectedFile = e.dataTransfer.files[0];
			if (selectedFile.size > MAX_FILE_SIZE) {
				alert(`ファイルサイズが大きすぎます（最大: ${formatFileSize(MAX_FILE_SIZE)}）`);
				return;
			}
			file = selectedFile;
			calculateHashes();
		}
	}

	async function calculateHashes() {
		if (isCalculating) return;

		let data: ArrayBuffer | string;

		try {
			isCalculating = true;
			results = [];

			if (inputMode === 'file') {
				if (!file) return;
				data = await file.arrayBuffer();
			} else {
				if (!textInput.trim()) return;
				data = textInput;
			}

			const newResults: HashResult[] = [];

			for (const algo of algorithms) {
				let hash: string;

				if (inputMode === 'text') {
					// テキストの場合はcrypto-jsを使用
					const dataStr = data as string;
					switch (algo) {
						case 'MD5':
							hash = CryptoJS.MD5(dataStr).toString();
							break;
						case 'SHA-1':
							hash = CryptoJS.SHA1(dataStr).toString();
							break;
						case 'SHA-256':
							hash = CryptoJS.SHA256(dataStr).toString();
							break;
						case 'SHA-384':
							hash = CryptoJS.SHA384(dataStr).toString();
							break;
						case 'SHA-512':
							hash = CryptoJS.SHA512(dataStr).toString();
							break;
						default:
							continue;
					}
				} else {
					// ファイルの場合
					const buffer = data as ArrayBuffer;
					if (algo === 'MD5') {
						// MD5はcrypto-jsを使用（ArrayBufferを正しくWordArrayに変換）
						const wordArray = arrayBufferToWordArray(buffer);
						hash = CryptoJS.MD5(wordArray).toString();
					} else {
						// SHA系はWeb Crypto APIを使用
						if (!crypto.subtle) {
							throw new Error('Web Crypto APIが利用できません（HTTPS環境が必要です）');
						}
						const algoMap: { [key: string]: string } = {
							'SHA-1': 'SHA-1',
							'SHA-256': 'SHA-256',
							'SHA-384': 'SHA-384',
							'SHA-512': 'SHA-512'
						};
						const hashBuffer = await crypto.subtle.digest(algoMap[algo], buffer);
						hash = Array.from(new Uint8Array(hashBuffer))
							.map((b) => b.toString(16).padStart(2, '0'))
							.join('');
					}
				}

				newResults.push({ algorithm: algo, hash });
			}

			results = newResults;
		} catch (e) {
			console.error('ハッシュ計算エラー:', e);
			alert('ハッシュの計算に失敗しました');
		} finally {
			isCalculating = false;
		}
	}

	async function copyToClipboard(text: string, algorithm: string) {
		try {
			await navigator.clipboard.writeText(text);
			copyFeedback = { ...copyFeedback, [algorithm]: true };
			setTimeout(() => {
				copyFeedback = { ...copyFeedback, [algorithm]: false };
			}, 1500);
		} catch (e) {
			console.error('コピーエラー:', e);
			alert('クリップボードへのコピーに失敗しました');
		}
	}

	function clear() {
		file = null;
		textInput = '';
		results = [];
	}

	function formatFileSize(bytes: number): string {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
		if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
		return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
	}
</script>

<div class="mx-auto max-w-4xl">
	<div class="mb-6 flex items-center">
		{#if tool?.icon}<Icon icon={tool.icon} class="mr-4 h-10 w-10" />{/if}
		<h1 class="text-3xl font-bold">{tool?.nameJa}</h1>
	</div>

	<!-- モード切り替え -->
	<div class="mb-4 flex gap-2">
		<button
			onclick={() => {
				inputMode = 'file';
				clear();
			}}
			class="rounded px-4 py-2 font-medium transition-colors {inputMode === 'file'
				? 'bg-blue-600 text-white'
				: 'bg-gray-200 text-gray-700 hover:bg-gray-300'}"
		>
			ファイル
		</button>
		<button
			onclick={() => {
				inputMode = 'text';
				clear();
			}}
			class="rounded px-4 py-2 font-medium transition-colors {inputMode === 'text'
				? 'bg-blue-600 text-white'
				: 'bg-gray-200 text-gray-700 hover:bg-gray-300'}"
		>
			テキスト
		</button>
	</div>

	{#if inputMode === 'file'}
		<!-- ファイルアップロード -->
		<div
			role="button"
			tabindex="0"
			aria-label="ファイルをドラッグ&ドロップまたはクリックして選択"
			ondragover={(e) => {
				e.preventDefault();
				dragOver = true;
			}}
			ondragleave={() => (dragOver = false)}
			ondrop={onDrop}
			onclick={() => document.getElementById('hash-file-input')?.click()}
			onkeydown={(e) => {
				if (e.key === 'Enter' || e.key === ' ') {
					e.preventDefault();
					document.getElementById('hash-file-input')?.click();
				}
			}}
			class="mb-4 flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 text-center transition-colors {dragOver
				? 'border-blue-400 bg-blue-50'
				: 'border-gray-300 bg-gray-50'}"
		>
			<Icon icon="mdi:file-upload" class="mb-2 h-12 w-12 text-gray-400" />
			<p class="mb-2 text-gray-700">ファイルをドラッグ＆ドロップ</p>
			<p class="mb-3 text-xs text-gray-500">または、クリックしてファイルを選択</p>
			<input id="hash-file-input" type="file" onchange={onFileInput} class="hidden" />
		</div>

		{#if file}
			<div class="mb-4 rounded-lg border border-gray-200 bg-white p-4">
				<div class="flex items-center justify-between">
					<div class="flex items-center gap-3">
						<Icon icon="mdi:file-document" class="h-8 w-8 text-blue-500" />
						<div>
							<p class="font-medium text-gray-800">{file.name}</p>
							<p class="text-sm text-gray-500">{formatFileSize(file.size)}</p>
						</div>
					</div>
					<button onclick={clear} class="rounded bg-gray-500 px-3 py-1.5 text-sm text-white">
						クリア
					</button>
				</div>
			</div>
		{/if}
	{:else}
		<!-- テキスト入力 -->
		<div class="mb-4">
			<textarea
				bind:value={textInput}
				oninput={onTextInput}
				placeholder="ハッシュ値を計算したいテキストを入力してください"
				class="w-full rounded-lg border border-gray-300 p-4 font-mono text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
				rows="6"
			></textarea>
			{#if textInput}
				<div class="mt-2 flex justify-end">
					<button onclick={clear} class="rounded bg-gray-500 px-3 py-1.5 text-sm text-white">
						クリア
					</button>
				</div>
			{/if}
		</div>
	{/if}

	<!-- 結果表示 -->
	{#if results.length > 0}
		<div class="space-y-3">
			{#each results as result (result.algorithm)}
				<div class="rounded-lg border border-gray-200 bg-white p-4">
					<div class="mb-2 flex items-center justify-between">
						<h3 class="font-bold text-gray-800">{result.algorithm}</h3>
						<button
							onclick={() => copyToClipboard(result.hash, result.algorithm)}
							class="flex items-center gap-1 rounded bg-blue-600 px-3 py-1.5 text-sm text-white transition-colors hover:bg-blue-700"
						>
							{#if copyFeedback[result.algorithm]}
								<Icon icon="mdi:check" class="h-4 w-4" />
								<span>コピーしました</span>
							{:else}
								<Icon icon="mdi:content-copy" class="h-4 w-4" />
								<span>コピー</span>
							{/if}
						</button>
					</div>
					<p class="font-mono text-sm break-all text-gray-700">{result.hash}</p>
				</div>
			{/each}
		</div>
	{/if}

	{#if isCalculating}
		<div class="flex items-center justify-center py-8" role="status" aria-live="polite">
			<div
				class="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"
			></div>
			<p class="ml-3 text-gray-600">計算中...</p>
		</div>
	{/if}
</div>

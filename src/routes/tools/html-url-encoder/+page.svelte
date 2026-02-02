<script lang="ts">
	import { tools } from '$lib/data/tools';
	import Icon from '@iconify/svelte';

	const tool = tools.find((t) => t.name === 'html-url-encoder');

	// 変換タイプ
	type ConversionType = 'html' | 'url';
	let activeTab: ConversionType = 'html';

	// 入出力データ
	let inputText = '';
	let outputText = '';

	// HTML変換用のマッピング
	const htmlEntityMap: Record<string, string> = {
		'&': '&amp;',
		'<': '&lt;',
		'>': '&gt;',
		'"': '&quot;',
		"'": '&#39;',
		'/': '&#x2F;'
	};

	const htmlDecodeMap: Record<string, string> = {
		'&amp;': '&',
		'&lt;': '<',
		'&gt;': '>',
		'&quot;': '"',
		'&#39;': "'",
		'&#x27;': "'",
		'&#x2F;': '/',
		'&#x60;': '`',
		'&#x3D;': '='
	};

	// HTMLエンコード関数
	function encodeHtml(text: string): string {
		return text.replace(/[&<>"'/]/g, (match) => htmlEntityMap[match] || match);
	}

	// HTMLデコード関数
	function decodeHtml(text: string): string {
		// 数値文字参照のデコード
		let decoded = text.replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num, 10)));
		decoded = decoded.replace(/&#x([a-fA-F0-9]+);/g, (_, hex) =>
			String.fromCharCode(parseInt(hex, 16))
		);

		// 文字実体参照のデコード
		for (const [entity, char] of Object.entries(htmlDecodeMap)) {
			decoded = decoded.replace(new RegExp(entity, 'g'), char);
		}

		return decoded;
	}

	// URLエンコード関数
	function encodeUrl(text: string): string {
		try {
			return encodeURIComponent(text);
		} catch {
			throw new Error('URLエンコードに失敗しました');
		}
	}

	// URLデコード関数
	function decodeUrl(text: string): string {
		try {
			return decodeURIComponent(text);
		} catch {
			throw new Error('URLデコードに失敗しました: 不正な文字列が含まれています');
		}
	}

	// エンコード処理
	function encode() {
		try {
			if (activeTab === 'html') {
				outputText = encodeHtml(inputText);
			} else if (activeTab === 'url') {
				outputText = encodeUrl(inputText);
			}
			copyToClipboard(outputText);
		} catch (error) {
			alert((error as Error).message);
		}
	}

	// デコード処理
	function decode() {
		try {
			if (activeTab === 'html') {
				outputText = decodeHtml(inputText);
			} else if (activeTab === 'url') {
				outputText = decodeUrl(inputText);
			}
			copyToClipboard(outputText);
		} catch (error) {
			alert((error as Error).message);
		}
	}

	// 入力と出力を交換
	function swap() {
		const temp = inputText;
		inputText = outputText;
		outputText = temp;
	}

	// クリア
	function clear() {
		inputText = '';
		outputText = '';
	}

	// クリップボードコピー
	async function copyToClipboard(text: string) {
		if (!text) return;
		try {
			await navigator.clipboard.writeText(text);
		} catch (err) {
			console.error('クリップボードへのコピーに失敗:', err);
		}
	}

	// リアルタイム変換（エンコード）
	$: if (inputText !== undefined) {
		if (inputText) {
			// 入力サイズ制限（10MB）
			const MAX_INPUT_SIZE = 10 * 1024 * 1024; // 10MB
			if (inputText.length > MAX_INPUT_SIZE) {
				outputText = `エラー: 入力が大きすぎます（最大: ${MAX_INPUT_SIZE / 1024 / 1024}MB）`;
			} else {
				try {
					if (activeTab === 'html') {
						outputText = encodeHtml(inputText);
					} else if (activeTab === 'url') {
						outputText = encodeUrl(inputText);
					}
				} catch (error) {
					outputText = `エラー: ${(error as Error).message}`;
				}
			}
		} else {
			outputText = '';
		}
	}

	// サンプルテキスト
	const sampleTexts: Record<ConversionType, { input: string; description: string }> = {
		html: {
			input: '<div class="example">Hello & "World"!</div>',
			description: 'HTML特殊文字を含むサンプル'
		},
		url: {
			input: 'https://example.com/search?q=Hello World&type=all',
			description: 'URL文字列のサンプル'
		}
	};

	function loadSample() {
		const sample = sampleTexts[activeTab];
		inputText = sample.input;
	}
</script>

<div class="mx-auto max-w-6xl">
	<div class="mb-6 flex items-center">
		{#if tool?.icon}<Icon icon={tool.icon} class="mr-4 h-10 w-10" />{/if}
		<h1 class="text-3xl font-bold">{tool?.nameJa}</h1>
	</div>

	<!-- タブ選択 -->
	<div class="mb-6 flex rounded-lg bg-gray-100 p-1">
		<button
			on:click={() => {
				activeTab = 'html';
				clear();
			}}
			class="flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors {activeTab === 'html'
				? 'bg-white text-gray-900 shadow-sm'
				: 'text-gray-600 hover:text-gray-900'}"
		>
			<Icon icon="mdi:code-tags" class="mr-2 inline h-4 w-4" />
			HTML エンコード/デコード
		</button>
		<button
			on:click={() => {
				activeTab = 'url';
				clear();
			}}
			class="flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors {activeTab === 'url'
				? 'bg-white text-gray-900 shadow-sm'
				: 'text-gray-600 hover:text-gray-900'}"
		>
			<Icon icon="mdi:link" class="mr-2 inline h-4 w-4" />
			URL エンコード/デコード
		</button>
	</div>

	<!-- アクションボタン -->
	<div class="mb-4 flex items-center justify-center gap-3">
		<button
			on:click={loadSample}
			class="rounded bg-purple-600 px-4 py-2 text-white hover:bg-purple-700"
		>
			<Icon icon="mdi:file-document-outline" class="mr-2 inline h-4 w-4" />
			サンプル読み込み
		</button>
		<button
			on:click={encode}
			disabled={!inputText}
			class="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
		>
			<Icon icon="mdi:arrow-right" class="mr-2 inline h-4 w-4" />
			エンコード
		</button>
		<button
			on:click={decode}
			disabled={!inputText}
			class="rounded bg-green-600 px-4 py-2 text-white hover:bg-green-700 disabled:opacity-50"
		>
			<Icon icon="mdi:arrow-left" class="mr-2 inline h-4 w-4" />
			デコード
		</button>
		<button
			on:click={swap}
			disabled={!inputText && !outputText}
			class="rounded bg-orange-600 px-4 py-2 text-white hover:bg-orange-700 disabled:opacity-50"
		>
			<Icon icon="mdi:swap-horizontal" class="mr-2 inline h-4 w-4" />
			入出力交換
		</button>
		<button on:click={clear} class="rounded bg-gray-500 px-4 py-2 text-white hover:bg-gray-600">
			<Icon icon="mdi:trash-can" class="mr-2 inline h-4 w-4" />
			クリア
		</button>
	</div>

	<!-- メインコンテンツ -->
	<div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
		<!-- 入力エリア -->
		<div class="rounded-lg border border-gray-200 bg-white p-4">
			<div class="mb-3 flex items-center justify-between">
				<h3 class="font-medium text-gray-900">入力テキスト</h3>
				<div class="text-xs text-gray-500">
					{inputText.length.toLocaleString()} 文字
				</div>
			</div>
			<textarea
				bind:value={inputText}
				placeholder={activeTab === 'html'
					? 'HTML文字列を入力してください（例: <div class="test">Hello & "World"!</div>）'
					: 'URL文字列を入力してください（例: https://example.com/search?q=Hello World）'}
				class="h-64 w-full rounded border border-gray-300 p-3 font-mono text-sm"
			></textarea>
		</div>

		<!-- 出力エリア -->
		<div class="rounded-lg border border-gray-200 bg-white p-4">
			<div class="mb-3 flex items-center justify-between">
				<h3 class="font-medium text-gray-900">変換結果</h3>
				<div class="flex items-center gap-2">
					<div class="text-xs text-gray-500">
						{outputText.length.toLocaleString()} 文字
					</div>
					{#if outputText}
						<button
							on:click={() => copyToClipboard(outputText)}
							class="rounded bg-green-600 px-3 py-1 text-xs text-white hover:bg-green-700"
						>
							<Icon icon="mdi:content-copy" class="mr-1 inline h-3 w-3" />
							コピー
						</button>
					{/if}
				</div>
			</div>
			<textarea
				bind:value={outputText}
				readonly
				placeholder="変換結果がここに表示されます"
				class="h-64 w-full rounded border border-gray-300 bg-gray-50 p-3 font-mono text-sm"
			></textarea>
		</div>
	</div>

	<!-- 現在の変換タイプの説明 -->
	<div class="mt-6 rounded-lg border border-gray-200 bg-gray-50 p-4">
		<div class="mb-2 flex items-center">
			<Icon
				icon={activeTab === 'html' ? 'mdi:code-tags' : 'mdi:link'}
				class="mr-2 h-5 w-5 text-gray-600"
			/>
			<h3 class="font-medium text-gray-900">
				{activeTab === 'html' ? 'HTML エンコード/デコード' : 'URL エンコード/デコード'}について
			</h3>
		</div>
		{#if activeTab === 'html'}
			<div class="space-y-2 text-sm text-gray-600">
				<p>• HTML特殊文字（&lt;, &gt;, &amp;, &quot;, &#39;）をHTMLエンティティに変換</p>
				<p>• 文字実体参照と数値文字参照の両方をサポート</p>
				<p>• Webページに安全にテキストを表示するために使用</p>
				<p>• 自動でリアルタイム変換（エンコード方向）</p>
			</div>
		{:else}
			<div class="space-y-2 text-sm text-gray-600">
				<p>• URL内で安全に使用できない文字をパーセントエンコーディングで変換</p>
				<p>• スペース、日本語、特殊記号などをエンコード</p>
				<p>• Webアプリケーションのクエリパラメータに安全な文字列を生成</p>
				<p>• 自動でリアルタイム変換（エンコード方向）</p>
			</div>
		{/if}
	</div>

	<!-- サンプル情報 -->
	<div class="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3">
		<div class="flex items-center">
			<Icon icon="mdi:lightbulb-outline" class="mr-2 h-4 w-4 text-blue-600" />
			<span class="text-sm font-medium text-blue-900"
				>サンプル: {sampleTexts[activeTab].description}</span
			>
		</div>
	</div>
</div>

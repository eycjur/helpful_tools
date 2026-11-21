<script lang="ts">
	import { tools } from '$lib/data/tools';
	import Icon from '@iconify/svelte';
	import { onDestroy } from 'svelte';
	import type { DecryptGroup, DecryptResponse } from './types';

	const tool = tools.find((t) => t.name === 'ctf-cipher');

	// 状態管理
	let inputText = $state('');
	let decryptGroups = $state<DecryptGroup[]>([]);
	let errorMessage = $state('');
	let isAnalyzing = $state(false);
	let activeWorker: Worker | null = null;
	const MAX_INPUT_LENGTH = 1024 * 1024;
	const PREVIEW_LENGTH = 4096;

	function cancelAnalysis() {
		activeWorker?.terminate();
		activeWorker = null;
		isAnalyzing = false;
	}
	onDestroy(cancelAnalysis);

	function resetAnalysis() {
		cancelAnalysis();
		errorMessage = '';
		decryptGroups = [];
	}

	// 自動解読実行
	function performDecrypt() {
		resetAnalysis();

		if (!inputText.trim()) {
			errorMessage = '入力テキストを入力してください';
			return;
		}
		if (inputText.length > MAX_INPUT_LENGTH) {
			errorMessage = '入力が大きすぎます（上限: 1,048,576文字）';
			return;
		}

		try {
			const worker = new Worker(new URL('./cipher.worker.ts', import.meta.url), { type: 'module' });
			activeWorker = worker;
			isAnalyzing = true;
			worker.onmessage = ({ data }: MessageEvent<DecryptResponse>) => {
				if (activeWorker !== worker) return;
				cancelAnalysis();
				if ('error' in data) errorMessage = data.error;
				else if (data.groups.length === 0) errorMessage = '有効な復号結果が見つかりませんでした';
				else decryptGroups = data.groups;
			};
			worker.onerror = () => {
				if (activeWorker !== worker) return;
				cancelAnalysis();
				errorMessage = '解読に失敗しました';
			};
			worker.postMessage(inputText);
		} catch {
			cancelAnalysis();
			errorMessage = '解読に失敗しました';
		}
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

	// クリア
	function clear() {
		inputText = '';
		resetAnalysis();
	}

	// サンプルデータ
	const samples: Record<string, { input: string; description: string }> = {
		caesar: {
			input: 'ZHOFRPH WR WKH VKLIW VKRZFDVH. WKLV PHVVDJH KDV PXOWLSOH VZDSV DQG D ORQJHU OHQJWK.',
			description: 'Caesar cipher (Shift 3)'
		},
		rot13: {
			input:
				'Guvf vf n ybatre fgevat gb grfg grkg yriryvat. Jr jnag gb frr ubj gur frpher srryvat orunirf.',
			description: 'ROT13'
		},
		atbash: {
			input: 'GSRH RH Z OLMTVI HZNKOV NVHHZTV ULI ZGYZHS DRGS IVZO DLIWH.',
			description: 'Atbash cipher'
		},
		xor: {
			input:
				'\x39\x05\x04\x1e\x4d\x35\x22\x3f\x4d\x1e\x0c\x00\x1d\x01\x08\x4d\x1e\x05\x02\x18\x01\x09\x4d\x09\x08\x0e\x02\x09\x08\x4d\x04\x03\x19\x02\x4d\x1f\x08\x0c\x09\x0c\x0f\x01\x08\x4d\x28\x03\x0a\x01\x04\x1e\x05\x4d\x19\x08\x15\x19\x4d\x1a\x04\x19\x05\x4d\x0c\x4d\x0e\x01\x08\x0c\x1f\x4d\x00\x08\x0c\x03\x04\x03\x0a\x43',
			description: 'XOR (Key: 0x6D)'
		},
		base64: {
			input: 'U0dWc2JHOGdWMjl5YkdRPQ==',
			description: 'Base64（2回デコード）'
		},
		rail: {
			input: 'WECRLTEERDSOEEFEAOCAIVDEN',
			description: 'Rail Fence（レール数想定）'
		},
		reverse: {
			input: '.esrever ni nwod edispu eb dluow ti ,txet gnol a si sihT',
			description: 'Reverse'
		}
	};

	let sampleKey = $state('caesar');

	function loadSample() {
		inputText = samples[sampleKey].input;
		performDecrypt();
	}

	function totalResultsCount() {
		return decryptGroups.reduce((sum, group) => sum + group.results.length, 0);
	}
</script>

<div class="mx-auto max-w-6xl">
	<div class="mb-6 flex items-center">
		{#if tool?.icon}<Icon icon={tool.icon} class="mr-4 h-10 w-10" />{/if}
		<h1 class="text-3xl font-bold">{tool?.nameJa}</h1>
	</div>

	<!-- 説明 -->
	<div class="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
		<div class="mb-2 flex items-center">
			<Icon icon="mdi:information" class="mr-2 h-5 w-5 text-blue-600" />
			<h3 class="font-medium text-blue-900">このツールについて</h3>
		</div>
		<div class="space-y-1 text-sm text-blue-700">
			<p>簡易暗号を自動解読し、候補を可能性順に整理して表示します</p>
			<p>
				• 対応暗号: Caesar（全シフト）、ROT13/ROT47、Atbash、XOR、Base64多段、Reverse、Rail Fence
			</p>
			<p>• 一般的な指標で平文らしさを判定し、暗号方式ごとにまとめて表示</p>
		</div>
	</div>

	<!-- サンプル選択 -->
	<div class="mb-4 rounded-lg border border-gray-200 bg-white p-4">
		<div class="mb-3 flex items-center">
			<Icon icon="mdi:flask" class="mr-2 h-5 w-5 text-gray-600" />
			<h3 class="font-medium text-gray-900">サンプルデータ</h3>
		</div>
		<div class="flex gap-2">
			<select id="sample" bind:value={sampleKey} class="flex-1 rounded border border-gray-300 p-2">
				{#each Object.entries(samples) as [key, sample] (key)}
					<option value={key}>{sample.description}</option>
				{/each}
			</select>
			<button
				onclick={loadSample}
				class="rounded bg-purple-600 px-4 py-2 text-white hover:bg-purple-700"
			>
				<Icon icon="mdi:file-document-outline" class="mr-1 inline h-4 w-4" />
				読込
			</button>
		</div>
	</div>

	<!-- アクションボタン -->
	<div class="mb-4 flex items-center justify-center gap-3">
		<button
			onclick={performDecrypt}
			disabled={!inputText || isAnalyzing}
			class="rounded bg-blue-600 px-6 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
		>
			{#if isAnalyzing}
				<Icon icon="mdi:loading" class="mr-2 inline h-4 w-4 animate-spin" />
				解析中...
			{:else}
				<Icon icon="mdi:lock-open" class="mr-2 inline h-4 w-4" />
				自動解読
			{/if}
		</button>
		<button onclick={clear} class="rounded bg-gray-500 px-4 py-2 text-white hover:bg-gray-600">
			<Icon icon="mdi:trash-can" class="mr-2 inline h-4 w-4" />
			クリア
		</button>
	</div>

	<!-- 入力エリア -->
	<div class="mb-6 rounded-lg border border-gray-200 bg-white p-4">
		<div class="mb-3 flex items-center justify-between">
			<h3 class="font-medium text-gray-900">入力（暗号化されたテキスト）</h3>
			<div class="text-xs text-gray-500">
				{inputText.length.toLocaleString()} 文字
			</div>
		</div>
		<textarea
			bind:value={inputText}
			oninput={resetAnalysis}
			placeholder="暗号化されたテキストを入力してください..."
			class="h-32 w-full rounded border border-gray-300 p-3 font-mono text-sm"
		></textarea>
	</div>

	<!-- エラーメッセージ -->
	{#if errorMessage}
		<div class="mb-4 rounded-lg border border-red-200 bg-red-50 p-4">
			<div class="flex items-center">
				<Icon icon="mdi:alert-circle" class="mr-2 h-5 w-5 text-red-600" />
				<span class="font-medium text-red-900">エラー</span>
			</div>
			<p class="mt-1 text-sm text-red-700">{errorMessage}</p>
		</div>
	{/if}

	<!-- 解読結果 -->
	{#if decryptGroups.length > 0}
		<div class="space-y-6">
			<h3 class="text-lg font-medium text-gray-900">
				解読結果 ({totalResultsCount()}件 / {decryptGroups.length}方式)
			</h3>

			{#each decryptGroups as group, groupIndex (`${group.cipher}-${groupIndex}`)}
				<div class="rounded-lg border border-gray-200 bg-white p-4">
					<div class="mb-3 flex items-center gap-2">
						<Icon
							icon={groupIndex === 0 ? 'mdi:check-circle' : 'mdi:information'}
							class="h-5 w-5 {groupIndex === 0 ? 'text-green-600' : 'text-gray-600'}"
						/>
						<span class="font-medium text-gray-900">{group.cipher}</span>
						<span class="rounded bg-gray-200 px-2 py-1 text-xs font-medium text-gray-700"
							>最高信頼度: {group.maxConfidence}%</span
						>
						{#if groupIndex === 0}
							<span class="rounded bg-green-200 px-2 py-1 text-xs font-medium text-green-800"
								>最有力</span
							>
						{/if}
					</div>

					<div class="space-y-3">
						{#each group.results as result, index (`${group.cipher}-${result.detail}-${index}`)}
							<div class="rounded border border-gray-100 bg-gray-50 p-3">
								<div class="mb-2 flex items-center justify-between">
									<div class="flex items-center gap-2">
										{#if result.detail}
											<span class="text-xs text-gray-500">({result.detail})</span>
										{/if}
										<span class="rounded bg-gray-200 px-2 py-1 text-xs font-medium text-gray-700"
											>信頼度: {result.confidence}%</span
										>
									</div>
									<button
										onclick={() => copyToClipboard(result.result)}
										class="rounded bg-green-600 px-3 py-1 text-xs text-white hover:bg-green-700"
									>
										<Icon icon="mdi:content-copy" class="mr-1 inline h-3 w-3" />
										コピー
									</button>
								</div>
								<div class="rounded bg-white p-3">
									<pre class="font-mono text-sm break-all whitespace-pre-wrap">{result.result.slice(
											0,
											PREVIEW_LENGTH
										)}{result.result.length > PREVIEW_LENGTH ? '…' : ''}</pre>
									{#if result.result.length > PREVIEW_LENGTH}
										<p class="mt-2 text-xs text-gray-500">
											先頭4,096文字を表示しています。全文はコピーできます。
										</p>
									{/if}
								</div>
							</div>
						{/each}
					</div>
				</div>
			{/each}
		</div>
	{/if}

	<!-- 使い方ガイド -->
	<div class="mt-6 rounded-lg border border-gray-200 bg-gray-50 p-4">
		<div class="mb-2 flex items-center">
			<Icon icon="mdi:lightbulb-outline" class="mr-2 h-5 w-5 text-gray-600" />
			<h3 class="font-medium text-gray-900">使い方</h3>
		</div>
		<div class="space-y-2 text-sm text-gray-600">
			<p>• <strong>自動解読</strong>: すべての暗号方式を試行し、最も可能性の高い結果を表示</p>
			<p>
				• <strong>信頼度スコア</strong>:
				印字可能性・文字種の比率・エントロピーなどから、平文らしさを0-100で評価
			</p>
			<p>• <strong>複数候補</strong>: 暗号方式ごとに信頼度の高い順に候補を表示</p>
			<p>• <strong>方式対応</strong>: Caesar全シフト、XOR brute force、多段Base64に対応</p>
		</div>
	</div>

	<!-- 対応暗号一覧 -->
	<div class="mt-4 rounded-lg border border-purple-200 bg-purple-50 p-4">
		<div class="mb-2 flex items-center">
			<Icon icon="mdi:shield-key" class="mr-2 h-5 w-5 text-purple-600" />
			<h3 class="font-medium text-purple-900">対応暗号方式</h3>
		</div>
		<div class="grid gap-2 text-sm text-purple-700 md:grid-cols-2">
			<div>• Caesar cipher（全26シフトパターン）</div>
			<div>• ROT13 / ROT47</div>
			<div>• Atbash cipher</div>
			<div>• XOR single-byte（0x01〜0xFFを総当たり）</div>
			<div>• Base64多段デコード（最大10回）</div>
			<div>• Reverse（文字列反転）</div>
			<div>• Rail Fence cipher（2-5レール）</div>
		</div>
	</div>
</div>

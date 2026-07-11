<script lang="ts">
	import { tools } from '$lib/data/tools';
	import Icon from '@iconify/svelte';
	import { decodeJwt, isPlainObject, JWT_TIME_CLAIMS } from './jwt';

	const tool = tools.find((t) => t.name === 'jwt-decoder');

	let input = $state('');
	let headerJson = $state('');
	let payloadJson = $state('');
	let signature = $state('');
	let timeClaims = $state<{ key: string; value: string }[]>([]);
	let errorMessage = $state('');

	function formatClaimTime(value: unknown): string | null {
		if (typeof value !== 'number' || !Number.isFinite(value)) return null;
		const date = new Date(value * 1000);
		if (Number.isNaN(date.getTime())) return null;
		return date.toISOString();
	}

	function decode() {
		errorMessage = '';
		headerJson = '';
		payloadJson = '';
		signature = '';
		timeClaims = [];

		if (!input.trim()) return;

		try {
			const result = decodeJwt(input);
			headerJson = JSON.stringify(result.header, null, 2);
			payloadJson = JSON.stringify(result.payload, null, 2);
			signature = result.signature;

			if (isPlainObject(result.payload)) {
				timeClaims = Object.entries(result.payload)
					.filter(([key]) => JWT_TIME_CLAIMS.has(key))
					.map(([key, value]) => {
						const formatted = formatClaimTime(value);
						return { key, value: formatted ?? String(value) };
					});
			}
		} catch (e) {
			errorMessage = e instanceof Error ? e.message : 'デコードに失敗しました';
		}
	}

	function clear() {
		input = '';
		headerJson = '';
		payloadJson = '';
		signature = '';
		timeClaims = [];
		errorMessage = '';
	}
</script>

<div class="mx-auto max-w-3xl">
	<div class="mb-6 flex items-center">
		{#if tool?.icon}<Icon icon={tool.icon} class="mr-4 h-10 w-10" />{/if}
		<h1 class="text-3xl font-bold">{tool?.nameJa}</h1>
	</div>

	<label for="jwt-input" class="mb-2 block text-sm font-medium text-gray-700">JWT</label>
	<textarea
		id="jwt-input"
		bind:value={input}
		oninput={decode}
		placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9. ..."
		class="w-full rounded-lg border border-gray-300 p-4 font-mono text-sm break-all focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
		rows="4"
	></textarea>

	{#if input}
		<div class="mt-2 flex justify-end">
			<button onclick={clear} class="rounded bg-gray-500 px-3 py-1.5 text-sm text-white">
				クリア
			</button>
		</div>
	{/if}

	{#if errorMessage}
		<div class="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
			{errorMessage}
		</div>
	{/if}

	{#if headerJson}
		<div class="mt-4 space-y-3">
			<div class="rounded-lg border border-gray-200 bg-white p-4">
				<h3 class="mb-2 text-sm font-bold text-gray-500">Header</h3>
				<pre class="overflow-x-auto font-mono text-sm text-gray-800">{headerJson}</pre>
			</div>
			<div class="rounded-lg border border-gray-200 bg-white p-4">
				<h3 class="mb-2 text-sm font-bold text-gray-500">Payload</h3>
				<pre class="overflow-x-auto font-mono text-sm text-gray-800">{payloadJson}</pre>
			</div>

			{#if timeClaims.length > 0}
				<div class="rounded-lg border border-gray-200 bg-white p-4">
					<h3 class="mb-2 text-sm font-bold text-gray-500">日時クレーム（UTC）</h3>
					<ul class="space-y-1">
						{#each timeClaims as claim (claim.key)}
							<li class="font-mono text-sm text-gray-800">
								<span class="font-bold text-gray-500">{claim.key}</span>: {claim.value}
							</li>
						{/each}
					</ul>
				</div>
			{/if}

			<div class="rounded-lg border border-gray-200 bg-white p-4">
				<h3 class="mb-2 text-sm font-bold text-gray-500">Signature</h3>
				<p class="overflow-x-auto font-mono text-sm break-all text-gray-800">{signature}</p>
			</div>
		</div>
	{/if}

	<p class="mt-6 text-xs text-gray-500">
		このツールは署名の検証を行わず、デコードのみを行います。入力はブラウザ内でのみ処理され、外部には送信されません。
	</p>
</div>

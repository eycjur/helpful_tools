<script lang="ts">
	import { tools } from '$lib/data/tools';
	import Icon from '@iconify/svelte';
	import { decodeUlid } from './ulid';

	const tool = tools.find((t) => t.name === 'ulid-timestamp');

	let input = $state('');
	let timestampMs = $state<number | null>(null);
	let isoUtc = $state('');
	let jstText = $state('');
	let errorMessage = $state('');

	const jstFormatter = new Intl.DateTimeFormat('ja-JP', {
		timeZone: 'Asia/Tokyo',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
		fractionalSecondDigits: 3,
		hour12: false
	});

	function decode() {
		errorMessage = '';
		timestampMs = null;
		isoUtc = '';
		jstText = '';

		if (!input.trim()) return;

		try {
			const result = decodeUlid(input);
			timestampMs = result.timestampMs;
			isoUtc = result.date.toISOString();
			jstText = jstFormatter.format(result.date);
		} catch (e) {
			errorMessage = e instanceof Error ? e.message : 'デコードに失敗しました';
		}
	}

	function clear() {
		input = '';
		timestampMs = null;
		isoUtc = '';
		jstText = '';
		errorMessage = '';
	}
</script>

<div class="mx-auto max-w-2xl">
	<div class="mb-6 flex items-center">
		{#if tool?.icon}<Icon icon={tool.icon} class="mr-4 h-10 w-10" />{/if}
		<h1 class="text-3xl font-bold">{tool?.nameJa}</h1>
	</div>

	<label for="ulid-input" class="mb-2 block text-sm font-medium text-gray-700">ULID</label>
	<textarea
		id="ulid-input"
		bind:value={input}
		oninput={decode}
		placeholder="01ARZ3NDEKTSV4RRFFQ69G5FAV"
		class="w-full rounded-lg border border-gray-300 p-4 font-mono text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
		rows="2"
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

	{#if timestampMs !== null}
		<div class="mt-4 space-y-3">
			<div class="rounded-lg border border-gray-200 bg-white p-4">
				<h3 class="mb-1 text-sm font-bold text-gray-500">Unixtime（ミリ秒）</h3>
				<p class="font-mono text-sm break-all text-gray-800">{timestampMs}</p>
			</div>
			<div class="rounded-lg border border-gray-200 bg-white p-4">
				<h3 class="mb-1 text-sm font-bold text-gray-500">UTC</h3>
				<p class="font-mono text-sm break-all text-gray-800">{isoUtc}</p>
			</div>
			<div class="rounded-lg border border-gray-200 bg-white p-4">
				<h3 class="mb-1 text-sm font-bold text-gray-500">JST（日本標準時）</h3>
				<p class="font-mono text-sm break-all text-gray-800">{jstText}</p>
			</div>
		</div>
	{/if}

	<p class="mt-6 text-xs text-gray-500">
		ULIDは先頭10文字（Crockford's Base32）に48bitのミリ秒精度Unixtimeが埋め込まれています。
		入力はブラウザ内でのみ処理され、外部には送信されません。
	</p>
</div>

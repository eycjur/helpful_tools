<script lang="ts">
	import { tools } from '$lib/data/tools';
	import Icon from '@iconify/svelte';
	import {
		unixtimeToDate,
		dateToUnixtime,
		formatInTimeZone,
		TIMEZONE_OPTIONS,
		type UnixtimeUnit
	} from './unixtime';

	const tool = tools.find((t) => t.name === 'unixtime-converter');

	let unixtimeInput = $state('');
	let unit = $state<UnixtimeUnit>('seconds');
	let results = $state<{ label: string; value: string }[]>([]);
	let unixtimeError = $state('');

	let datetimeInput = $state('');
	let convertedUnixtime = $state<{ seconds: number; milliseconds: number } | null>(null);
	let datetimeError = $state('');

	function convertFromUnixtime() {
		unixtimeError = '';
		results = [];

		if (!unixtimeInput.trim()) return;

		const value = Number(unixtimeInput.trim());
		try {
			const date = unixtimeToDate(value, unit);
			results = TIMEZONE_OPTIONS.map((tz) => ({
				label: tz.label,
				value: formatInTimeZone(date, tz.timeZone)
			}));
		} catch (e) {
			unixtimeError = e instanceof Error ? e.message : '変換に失敗しました';
		}
	}

	function setNow() {
		unixtimeInput = String(unit === 'seconds' ? Math.floor(Date.now() / 1000) : Date.now());
		convertFromUnixtime();
	}

	function convertFromDatetime() {
		datetimeError = '';
		convertedUnixtime = null;

		if (!datetimeInput) return;

		// datetime-localの値はブラウザのローカルタイムゾーンとして解釈される
		const date = new Date(datetimeInput);
		if (Number.isNaN(date.getTime())) {
			datetimeError = '日時の形式が不正です';
			return;
		}

		convertedUnixtime = {
			seconds: dateToUnixtime(date, 'seconds'),
			milliseconds: dateToUnixtime(date, 'milliseconds')
		};
	}

	async function copyToClipboard(text: string) {
		try {
			await navigator.clipboard.writeText(text);
		} catch (e) {
			console.error('コピーエラー:', e);
		}
	}
</script>

<div class="mx-auto max-w-2xl">
	<div class="mb-6 flex items-center">
		{#if tool?.icon}<Icon icon={tool.icon} class="mr-4 h-10 w-10" />{/if}
		<h1 class="text-3xl font-bold">{tool?.nameJa}</h1>
	</div>

	<!-- Unixtime → 日時 -->
	<section class="mb-8">
		<h2 class="mb-3 text-lg font-bold text-gray-800">Unixtime → 日時</h2>
		<div class="flex flex-wrap items-end gap-3">
			<div class="flex-1">
				<label for="unixtime-input" class="mb-1 block text-sm font-medium text-gray-700">
					Unixtime
				</label>
				<input
					id="unixtime-input"
					type="text"
					inputmode="numeric"
					bind:value={unixtimeInput}
					oninput={convertFromUnixtime}
					placeholder="1609459200"
					class="w-full rounded-lg border border-gray-300 p-3 font-mono text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
				/>
			</div>
			<div>
				<label for="unit-select" class="mb-1 block text-sm font-medium text-gray-700">単位</label>
				<select
					id="unit-select"
					bind:value={unit}
					onchange={convertFromUnixtime}
					class="rounded-lg border border-gray-300 p-3 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
				>
					<option value="seconds">秒</option>
					<option value="milliseconds">ミリ秒</option>
				</select>
			</div>
			<button
				onclick={setNow}
				class="rounded-lg bg-blue-600 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-blue-700"
			>
				現在時刻
			</button>
		</div>

		{#if unixtimeError}
			<div class="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
				{unixtimeError}
			</div>
		{/if}

		{#if results.length > 0}
			<div class="mt-4 space-y-2">
				{#each results as result (result.label)}
					<div
						class="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-3"
					>
						<div>
							<span class="mr-3 text-sm font-bold text-gray-500">{result.label}</span>
							<span class="font-mono text-sm text-gray-800">{result.value}</span>
						</div>
						<button
							onclick={() => copyToClipboard(result.value)}
							class="rounded p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800"
							aria-label="コピー"
						>
							<Icon icon="mdi:content-copy" class="h-4 w-4" />
						</button>
					</div>
				{/each}
			</div>
		{/if}
	</section>

	<!-- 日時 → Unixtime -->
	<section>
		<h2 class="mb-3 text-lg font-bold text-gray-800">日時 → Unixtime</h2>
		<label for="datetime-input" class="mb-1 block text-sm font-medium text-gray-700">
			日時（ブラウザのローカルタイムゾーンで入力）
		</label>
		<input
			id="datetime-input"
			type="datetime-local"
			step="1"
			bind:value={datetimeInput}
			oninput={convertFromDatetime}
			class="w-full rounded-lg border border-gray-300 p-3 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
		/>

		{#if datetimeError}
			<div class="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
				{datetimeError}
			</div>
		{/if}

		{#if convertedUnixtime}
			<div class="mt-4 space-y-2">
				<div
					class="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-3"
				>
					<div>
						<span class="mr-3 text-sm font-bold text-gray-500">秒</span>
						<span class="font-mono text-sm text-gray-800">{convertedUnixtime.seconds}</span>
					</div>
					<button
						onclick={() => copyToClipboard(String(convertedUnixtime?.seconds))}
						class="rounded p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800"
						aria-label="コピー"
					>
						<Icon icon="mdi:content-copy" class="h-4 w-4" />
					</button>
				</div>
				<div
					class="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-3"
				>
					<div>
						<span class="mr-3 text-sm font-bold text-gray-500">ミリ秒</span>
						<span class="font-mono text-sm text-gray-800">{convertedUnixtime.milliseconds}</span>
					</div>
					<button
						onclick={() => copyToClipboard(String(convertedUnixtime?.milliseconds))}
						class="rounded p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800"
						aria-label="コピー"
					>
						<Icon icon="mdi:content-copy" class="h-4 w-4" />
					</button>
				</div>
			</div>
		{/if}
	</section>
</div>

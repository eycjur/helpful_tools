<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import Icon from '@iconify/svelte';

	export let output: string = '';
	export let inputRequired: boolean = false;
	export let inputPrompt: string = '';

	const dispatch = createEventDispatcher();

	let userInput = '';
	let inputElement: HTMLInputElement;

	// 入力送信
	function submitInput() {
		if (userInput.trim()) {
			dispatch('input', { value: userInput.trim() });
			userInput = '';
		}
	}

	// Enterキーで送信
	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			submitInput();
		}
	}

	// 入力がクリアされた時の処理
	export function clearInput() {
		userInput = '';
	}

	// 出力をクリア
	function clearOutput() {
		dispatch('clearOutput');
	}

	// 入力にフォーカス（外部から呼び出し可能）
	export function focusInput() {
		if (inputElement) {
			inputElement.focus();
		}
	}

	// 入力が必要になったときに自動フォーカス
	$: if (inputRequired && inputElement) {
		setTimeout(() => inputElement.focus(), 100);
	}
</script>

<div class="input-output-panel space-y-4">
	<h3 class="flex items-center text-lg font-semibold">
		<Icon icon="mdi:console" class="mr-2" />
		プログラム入出力
	</h3>

	<!-- 出力エリア -->
	<div class="output-area">
		<div class="mb-2 flex items-center justify-between">
			<h4 class="text-sm font-medium text-gray-700">出力</h4>
			<button
				class="text-xs text-gray-500 hover:text-gray-700"
				on:click={clearOutput}
				title="出力をクリア"
			>
				<Icon icon="mdi:close" class="h-4 w-4" />
			</button>
		</div>
		<div
			class="output-content max-h-[300px] min-h-[120px] overflow-y-auto rounded-md bg-black p-3 font-mono text-sm whitespace-pre-wrap text-green-400"
		>
			{#if output}
				{output}
			{:else}
				<span class="text-gray-500">出力はここに表示されます...</span>
			{/if}
		</div>
	</div>

	<!-- 入力エリア -->
	<div class="input-area">
		<h4 class="mb-2 text-sm font-medium text-gray-700">入力</h4>

		{#if inputRequired}
			<!-- 入力待ち状態 -->
			<div class="input-prompt mb-2 rounded-md border border-blue-200 bg-blue-50 p-3">
				<div class="mb-2 flex items-center text-blue-800">
					<Icon icon="mdi:help-circle" class="mr-2 h-4 w-4" />
					<span class="text-sm font-medium">{inputPrompt}</span>
				</div>

				<div class="flex space-x-2">
					<input
						bind:this={inputElement}
						bind:value={userInput}
						on:keydown={handleKeydown}
						type="text"
						placeholder="入力してください..."
						class="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
						disabled={!inputRequired}
					/>
					<button
						on:click={submitInput}
						disabled={!userInput.trim()}
						class="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
					>
						送信
					</button>
				</div>

				<div class="mt-1 text-xs text-gray-600">Enterキーでも送信できます</div>
			</div>
		{:else}
			<!-- 入力待ちでない状態 -->
			<div class="rounded-md bg-gray-50 p-3 text-center text-sm text-gray-500">
				プログラムが入力を要求するまでお待ちください
			</div>
		{/if}
	</div>

	<!-- 使用方法のヒント -->
	<div class="help-text rounded-md bg-gray-50 p-2 text-xs text-gray-500">
		<div class="mb-1 flex items-center">
			<Icon icon="mdi:information" class="mr-1 h-3 w-3" />
			<span class="font-medium">ヒント:</span>
		</div>
		<ul class="ml-4 list-inside list-disc space-y-1">
			<li>printf関数の出力は上の出力エリアに表示されます</li>
			<li>scanf関数が実行されると入力欄が表示されます</li>
			<li>文字列や数値など、プログラムが求める形式で入力してください</li>
		</ul>
	</div>
</div>

<style>
	.input-output-panel {
		border-radius: 0.5rem;
		border: 1px solid #d1d5db;
		padding: 1rem;
		background-color: white;
	}

	.output-content::-webkit-scrollbar {
		width: 6px;
	}

	.output-content::-webkit-scrollbar-track {
		background: #1f2937;
		border-radius: 3px;
	}

	.output-content::-webkit-scrollbar-thumb {
		background: #4b5563;
		border-radius: 3px;
	}

	.output-content::-webkit-scrollbar-thumb:hover {
		background: #6b7280;
	}
</style>

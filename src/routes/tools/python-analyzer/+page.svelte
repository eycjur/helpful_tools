<script lang="ts">
	import { tools } from '$lib/data/tools';
	import Icon from '@iconify/svelte';
	import { onMount } from 'svelte';
	import type { PythonRequest, PythonResponse } from './python-worker-messages';

	const tool = tools.find((t) => t.name === 'python-analyzer');

	let code = `# Pythonコード解析ツール
# AST、Bytecode、実行トレースを確認できます

def fibonacci(n):
    """フィボナッチ数列のn番目を計算"""
    if n <= 1:
        return n
    return fibonacci(n-1) + fibonacci(n-2)

# 実行例
for i in range(6):
    result = fibonacci(i)
    print(f"fibonacci({i}) = {result}")`;

	let astOutput = '';
	let bytecodeOutput = '';
	let runOutput = '';
	let error = '';
	let worker: Worker | null = null;
	let workerStatus: 'loading' | 'ready' | 'unavailable' = 'loading';
	let operation: PythonRequest['operation'] | null = null;
	let timeoutId: ReturnType<typeof setTimeout> | undefined;
	const EXEC_TIMEOUT_MS = 5000;
	const operationLabels = { analyze: 'コード解析', run: 'コード実行' };

	onMount(() => {
		startWorker();
		return stopWorker;
	});

	function startWorker() {
		workerStatus = 'loading';
		try {
			const currentWorker = new Worker(new URL('./python.worker.ts', import.meta.url));
			worker = currentWorker;
			currentWorker.onmessage = ({ data }: MessageEvent<PythonResponse>) => {
				if (worker !== currentWorker) return;
				if (data.type === 'ready') {
					workerStatus = 'ready';
					return;
				}
				if (data.type === 'error') {
					if (!operation) {
						error = data.message;
						stopWorker();
						return;
					}
					error = `${operationLabels[operation]}に失敗しました: ${data.message}`;
				} else if (data.type === 'analysis') {
					astOutput = data.ast;
					bytecodeOutput = data.bytecode;
				} else {
					runOutput = data.output;
				}
				finishOperation();
			};
			currentWorker.onerror = (event) => {
				if (worker !== currentWorker) return;
				const failedOperation = operation;
				const context = failedOperation ? operationLabels[failedOperation] : 'Python環境の読み込み';
				error = `${context}に失敗しました${event.message ? `: ${event.message}` : ''}`;
				stopWorker();
				if (failedOperation) startWorker();
			};
		} catch (e) {
			workerStatus = 'unavailable';
			error = 'Python環境の読み込みに失敗しました: ' + (e instanceof Error ? e.message : String(e));
		}
	}

	function finishOperation() {
		clearTimeout(timeoutId);
		operation = null;
	}

	function stopWorker() {
		worker?.terminate();
		worker = null;
		workerStatus = 'unavailable';
		finishOperation();
	}

	function startOperation(nextOperation: PythonRequest['operation']) {
		if (!worker || workerStatus !== 'ready' || operation) return;
		operation = nextOperation;
		error = '';
		runOutput = '';
		if (nextOperation === 'analyze') {
			astOutput = '';
			bytecodeOutput = '';
		}
		timeoutId = setTimeout(() => {
			error = `${operationLabels[nextOperation]}がタイムアウトしました（${EXEC_TIMEOUT_MS / 1000}秒）`;
			stopWorker();
			startWorker();
		}, EXEC_TIMEOUT_MS);
		worker.postMessage({ operation: nextOperation, code } satisfies PythonRequest);
	}
</script>

<div class="mx-auto max-w-7xl">
	<div class="mb-6 flex items-center">
		{#if tool?.icon}<Icon icon={tool.icon} class="mr-4 h-10 w-10" />{/if}
		<h1 class="text-3xl font-bold">{tool?.nameJa}</h1>
	</div>

	<div class="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
		<!-- 左カラム: コード入力・実行 -->
		<div class="flex flex-col gap-4">
			<div class="rounded-lg border border-gray-200 bg-white p-4">
				<div class="mb-2 text-sm font-medium text-gray-700">Pythonコード</div>
				<textarea
					bind:value={code}
					class="h-64 w-full resize-y rounded border-gray-300 p-3 font-mono text-sm"
					placeholder="Pythonコードを入力..."
				></textarea>
			</div>

			<div class="grid grid-cols-2 gap-3">
				<button
					on:click={() => startOperation('analyze')}
					disabled={workerStatus !== 'ready' || operation !== null}
					class="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
				>
					AST & Bytecode を生成
				</button>
				<button
					on:click={() => startOperation('run')}
					disabled={workerStatus !== 'ready' || operation !== null}
					class="rounded bg-green-600 px-4 py-2 text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
				>
					コードを実行
				</button>
			</div>

			{#if error}
				<div
					role="alert"
					class="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
				>
					{error}
				</div>
			{/if}
			{#if workerStatus === 'loading' || operation}
				<p role="status" class="text-sm text-gray-600">
					{operation ? operationLabels[operation] + '中...' : 'Pyodide を読み込み中...'}
				</p>
			{/if}

			<div class="rounded-lg border border-gray-200 bg-white p-4">
				<div class="mb-2 text-sm font-medium text-gray-700">実行出力</div>
				<pre
					class="min-h-32 rounded border border-gray-200 bg-gray-50 p-3 font-mono text-sm whitespace-pre-wrap text-gray-800">{runOutput ||
						'(実行結果がここに表示されます)'}</pre>
			</div>
		</div>

		<!-- 右カラム: AST・Bytecode -->
		<div class="flex flex-col gap-4">
			<div class="rounded-lg border border-gray-200 bg-white p-4">
				<div class="mb-2 text-sm font-medium text-gray-700">AST (ast.dump)</div>
				<pre
					class="h-96 overflow-auto rounded border border-gray-200 bg-gray-50 p-3 font-mono text-xs whitespace-pre-wrap text-gray-800">{astOutput ||
						'(AST構造がここに表示されます)'}</pre>
			</div>

			<div class="rounded-lg border border-gray-200 bg-white p-4">
				<div class="mb-2 text-sm font-medium text-gray-700">Bytecode (dis)</div>
				<pre
					class="h-96 overflow-auto rounded border border-gray-200 bg-gray-50 p-3 font-mono text-xs whitespace-pre-wrap text-gray-800">{bytecodeOutput ||
						'(Bytecodeがここに表示されます)'}</pre>
			</div>
		</div>
	</div>

	<div class="rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm text-gray-700">
		<strong>ヒント:</strong> このツールは、ブラウザ上でPythonを実行できる
		<a
			href="https://pyodide.org/"
			target="_blank"
			rel="noopener noreferrer"
			class="text-blue-600 hover:underline">Pyodide</a
		>
		を使用しています。PythonコードのAST（抽象構文木）とBytecodeを確認できます。
	</div>
</div>

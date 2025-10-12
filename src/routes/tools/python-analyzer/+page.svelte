<script lang="ts">
	import { tools } from '$lib/data/tools';
	import Icon from '@iconify/svelte';
	import { onMount } from 'svelte';

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

	interface PyodideInterface {
		runPythonAsync(code: string): Promise<[string, string] | string>;
		globals: {
			set(name: string, value: string): void;
			get(name: string): string;
		};
	}

	let pyodide: PyodideInterface | null = null;
	let isLoading = true;
	let error = '';

	onMount(() => {
		let script: HTMLScriptElement | null = null;

		try {
			// Pyodideスクリプトを動的に読み込む
			script = document.createElement('script');
			script.src = 'https://cdn.jsdelivr.net/pyodide/v0.25.0/full/pyodide.js';
			script.async = true;
			document.head.appendChild(script);

			script.onload = async () => {
				try {
					// @ts-expect-error - loadPyodide is loaded dynamically from CDN
					pyodide = await loadPyodide({
						indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.25.0/full/'
					});

					// Pythonユーティリティ関数を定義
					if (pyodide) {
						await pyodide.runPythonAsync(`
import sys, ast, dis, io, contextlib, textwrap

def analyze_code(src: str):
    # 正規化
    s = textwrap.dedent(src)
    # AST
    tree = ast.parse(s, mode="exec")
    ast_dump = ast.dump(tree, indent=2)
    # Bytecode（モジュールとしてコンパイル）
    codeobj = compile(tree, filename="<web>", mode="exec")
    bc_lines = []
    for instr in dis.Bytecode(codeobj):
        bc_lines.append(f"{instr.offset:>3}  {instr.opname:<24} arg={instr.arg!s:<4} argval={instr.argval!s}")
    return ast_dump, "\\n".join(bc_lines), codeobj
						`);

						isLoading = false;
					}
				} catch (e) {
					error = 'Pyodideの初期化に失敗しました: ' + (e instanceof Error ? e.message : String(e));
					isLoading = false;
				}
			};

			script.onerror = () => {
				error = 'Pyodideスクリプトの読み込みに失敗しました';
				isLoading = false;
			};
		} catch (e) {
			error = 'エラーが発生しました: ' + (e instanceof Error ? e.message : String(e));
			isLoading = false;
		}

		// クリーンアップ関数を返す
		return () => {
			if (script && script.parentNode) {
				document.head.removeChild(script);
			}
		};
	});

	async function analyze() {
		if (!pyodide) return;
		try {
			error = '';
			astOutput = '';
			bytecodeOutput = '';
			runOutput = '';

			// Pythonグローバル変数として安全に設定
			pyodide.globals.set('user_code', code);

			const result = (await pyodide.runPythonAsync(`
ast_dump, bc_text, _ = analyze_code(user_code)
(ast_dump, bc_text)
			`)) as [string, string];

			astOutput = result[0];
			bytecodeOutput = result[1];
		} catch (e) {
			error = 'コード解析に失敗しました: ' + (e instanceof Error ? e.message : String(e));
		}
	}

	async function runCode() {
		if (!pyodide) return;
		try {
			error = '';
			runOutput = '';

			// Pythonグローバル変数として安全に設定
			pyodide.globals.set('user_code', code);

			const result = (await pyodide.runPythonAsync(`
import io, contextlib

ast_dump, bc_text, codeobj = analyze_code(user_code)
buf = io.StringIO()
glb = {}
with contextlib.redirect_stdout(buf):
    exec(codeobj, glb, glb)
buf.getvalue()
			`)) as string;

			runOutput = result;
		} catch (e) {
			error = 'コード実行に失敗しました: ' + (e instanceof Error ? e.message : String(e));
		}
	}
</script>

<div class="mx-auto max-w-7xl">
	<div class="mb-6 flex items-center">
		{#if tool?.icon}<Icon icon={tool.icon} class="mr-4 h-10 w-10" />{/if}
		<h1 class="text-3xl font-bold">{tool?.nameJa}</h1>
	</div>

	{#if isLoading}
		<div class="flex items-center justify-center py-12">
			<div class="flex items-center gap-3">
				<div
					class="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600"
				></div>
				<span class="text-gray-600">Pyodide を読み込み中...</span>
			</div>
		</div>
	{:else}
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
						on:click={analyze}
						disabled={!pyodide}
						class="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
					>
						AST & Bytecode を生成
					</button>
					<button
						on:click={runCode}
						disabled={!pyodide}
						class="rounded bg-green-600 px-4 py-2 text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
					>
						コードを実行
					</button>
				</div>

				{#if error}
					<div class="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
						{error}
					</div>
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
	{/if}
</div>

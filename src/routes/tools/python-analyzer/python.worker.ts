import type { PythonRequest, PythonResponse } from './python-worker-messages';

interface Pyodide {
	runPythonAsync(code: string): Promise<unknown>;
	globals: {
		set(name: string, value: string): void;
		get(name: string): string;
	};
}

const scope = self as unknown as {
	importScripts(url: string): void;
	loadPyodide(options: { indexURL: string }): Promise<Pyodide>;
	onmessage: (event: MessageEvent<PythonRequest>) => void;
	postMessage(message: PythonResponse): void;
};

const indexURL = 'https://cdn.jsdelivr.net/pyodide/v0.25.0/full/';

async function initialize() {
	try {
		scope.importScripts(indexURL + 'pyodide.js');
	} catch {
		scope.postMessage({ type: 'error', message: 'Pyodideスクリプトの読み込みに失敗しました' });
		return;
	}

	try {
		const pyodide = await scope.loadPyodide({ indexURL });
		await pyodide.runPythonAsync(`
import ast, dis, io, contextlib, textwrap

def analyze_code(src: str):
    tree = ast.parse(textwrap.dedent(src), mode="exec")
    ast_dump = ast.dump(tree, indent=2)
    codeobj = compile(tree, filename="<web>", mode="exec")
    bc_lines = []
    for instr in dis.Bytecode(codeobj):
        bc_lines.append(f"{instr.offset:>3}  {instr.opname:<24} arg={instr.arg!s:<4} argval={instr.argval!s}")
    return ast_dump, "\\n".join(bc_lines), codeobj
		`);
		scope.onmessage = async ({ data }) => {
			try {
				pyodide.globals.set('user_code', data.code);
				if (data.operation === 'analyze') {
					await pyodide.runPythonAsync('ast_dump, bc_text, _ = analyze_code(user_code)');
					scope.postMessage({
						type: 'analysis',
						ast: pyodide.globals.get('ast_dump'),
						bytecode: pyodide.globals.get('bc_text')
					});
				} else {
					const output = (await pyodide.runPythonAsync(`
ast_dump, bc_text, codeobj = analyze_code(user_code)
buf = io.StringIO()
glb = {}
with contextlib.redirect_stdout(buf):
    exec(codeobj, glb, glb)
buf.getvalue()
					`)) as string;
					scope.postMessage({ type: 'execution', output });
				}
			} catch (e) {
				scope.postMessage({ type: 'error', message: e instanceof Error ? e.message : String(e) });
			}
		};
		scope.postMessage({ type: 'ready' });
	} catch (e) {
		scope.postMessage({
			type: 'error',
			message: 'Pyodideの初期化に失敗しました: ' + (e instanceof Error ? e.message : String(e))
		});
	}
}

void initialize();

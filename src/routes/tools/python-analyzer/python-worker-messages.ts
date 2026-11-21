export interface PythonRequest {
	operation: 'analyze' | 'run';
	code: string;
}

export type PythonResponse =
	| { type: 'ready' }
	| { type: 'analysis'; ast: string; bytecode: string }
	| { type: 'execution'; output: string }
	| { type: 'error'; message: string };

// アセンブリパーサー - objdump形式の解析

export interface RelocationInfo {
	address: string; // "0000000000000033"
	type: string; // "R_X86_64_PLT32"
	symbol: string; // "__isoc99_scanf"
	addend?: string; // "-0x4"
}

export interface AssemblyLine {
	address: string; // "0x1c"
	bytes: string; // "48 8d 45 d0"
	mnemonic: string; // "leaq"
	operands: string[]; // ["-0x30(%rbp)", "%rax"]
	comment?: string; // "# 0x2a <main+0x2a>"
	relocation?: RelocationInfo; // リロケーション情報
	originalLine: string; // 元の行全体
}

export interface ParsedAssembly {
	lines: AssemblyLine[];
	functionName?: string; // "main"
	startAddress: string; // "0000000000000000"
}

export interface ParseError {
	lineNumber: number;
	line: string;
	message: string;
}

export interface ParseResult {
	success: boolean;
	assembly?: ParsedAssembly;
	errors: ParseError[];
}

export class AssemblyParser {
	static parse(input: string): ParseResult {
		const errors: ParseError[] = [];
		const lines: AssemblyLine[] = [];
		let functionName: string | undefined;
		let startAddress = '0000000000000000';

		const inputLines = input.split('\n');

		for (let i = 0; i < inputLines.length; i++) {
			const line = inputLines[i].trim();
			const lineNumber = i + 1;

			// 空行をスキップ
			if (!line) continue;

			try {
				// radare2コメント行をスキップ (;-- で始まる行)
				if (line.startsWith(';--')) {
					continue;
				}

				// radare2の他のコメント行もスキップ
				if (line.startsWith('│ afv:') || line.startsWith('│ ') && line.includes(':') && !line.match(/0x[0-9a-f]+/i)) {
					continue;
				}

				// 関数定義行の検出 (例: "┌ 949: int sym.main (int argc, char **argv, char **envp);")
				const funcMatch = line.match(/^┌\s+\d+:\s+.*?\s+([^(]+)\s*\(/);
				if (funcMatch) {
					functionName = funcMatch[1].trim();
					continue;
				}

				// ヘッダー行をスキップ (例: "CrazyLazyProgram2/CLP2.o:    file format elf64-x86-64")
				if (line.includes('file format') || line.includes('Disassembly of section')) {
					continue;
				}

				// リロケーション行の検出 (例: "0000000000000033:  R_X86_64_PLT32    __isoc99_scanf-0x4")
				const relocationInfo = this.parseRelocationLine(line);
				if (relocationInfo) {
					// 直前のアセンブリ行にリロケーション情報を追加
					if (lines.length > 0) {
						lines[lines.length - 1].relocation = relocationInfo;
					}
					continue;
				}

				// アセンブリ行の解析
				const assemblyLine = this.parseAssemblyLine(line, lineNumber);
				if (assemblyLine) {
					lines.push(assemblyLine);
				} else {
					// デバッグ用: パースできなかった行をエラーとして記録
					console.warn(`Failed to parse line ${lineNumber}: ${line}`);
				}
			} catch (error) {
				errors.push({
					lineNumber,
					line,
					message: error instanceof Error ? error.message : 'Parse error'
				});
			}
		}

		if (errors.length > 0 && lines.length === 0) {
			return {
				success: false,
				errors
			};
		}

		return {
			success: true,
			assembly: {
				lines,
				functionName,
				startAddress
			},
			errors
		};
	}

	private static parseRelocationLine(line: string): RelocationInfo | null {
		// リロケーション行の形式をパース
		// 例: "        0000000000000033:  R_X86_64_PLT32    __isoc99_scanf-0x4"
		// 例: "        000000000000000b:  R_X86_64_PC32    .rodata-0x4"
		
		const relocationMatch = line.match(/^\s*([0-9a-f]{16}):\s*([A-Z_0-9]+)\s+([^\s]+)$/i);
		if (!relocationMatch) {
			return null;
		}

		const [, address, type, symbolAndAddend] = relocationMatch;
		
		// シンボルとaddendを分離 (例: "__isoc99_scanf-0x4" -> symbol: "__isoc99_scanf", addend: "-0x4")
		const symbolMatch = symbolAndAddend.match(/^([^+-]+)([+-][^+-]+)?$/);
		if (!symbolMatch) {
			return {
				address,
				type,
				symbol: symbolAndAddend
			};
		}

		const [, symbol, addend] = symbolMatch;
		
		return {
			address,
			type,
			symbol,
			addend: addend || undefined
		};
	}

	private static parseAssemblyLine(line: string, lineNumber: number): AssemblyLine | null {
		// radare2フォーマットとobjdumpフォーマットの両方に対応
		// radare2形式の例:
		// "│           0x08000040      pushq %rbp"
		// "│       ┌─< 0x0800008b      je 0x8000209"
		// "│     ╎││   0x0800009b      movl var_4h, %eax"

		// より広範囲のボックス描画文字とASCII記号をカバー
		const boxChars = '[│┌└├─┐┘┤╎┬┴┼<>╔╗╚╝║═╠╣╦╩╬┘┬┴┼╪╫╬░▒▓█▄▌▐▀■□▪▫◘◙◚◛◦◯●◐◑○◎●◇◆◈◉◊○●◐◑▪▫▬▭▮▯▰▱▲△▴▵▶▷▸▹►▻▼▽▾▿◀◁◂◃◄◅◆◇◈◉◊○●◐◑▪▫]';
		
		// radare2形式の解析 - ボックス文字、分岐記号、インデントスペースを含む柔軟なパターン
		const radare2Pattern = new RegExp(`^${boxChars}*\\s*(0x[0-9a-f]+)\\s+([a-z][a-z0-9]*)\\s+(.*?)(?:\\s*;.*)?$`, 'i');
		const radare2Match = line.match(radare2Pattern);
		
		if (radare2Match) {
			const [, fullAddress, mnemonic, operands] = radare2Match;
			// 0x08000040 -> 08000040 形式に変換
			const address = fullAddress.replace('0x', '').padStart(8, '0');
			
			// コメント部分を除去（; で始まる部分）
			const cleanOperands = operands.replace(/\s*;.*$/, '').trim();
			
			return this.buildAssemblyLine(address, '', mnemonic, cleanOperands, undefined, line);
		}

		// さらに包括的なパターン - 任意の非英数字の文字からアドレスまで
		const genericRadare2Match = line.match(/^[^\w]*\s*(0x[0-9a-f]+)\s+([a-z][a-z0-9]*)\s+(.*?)(?:\s*;.*)?$/i);
		if (genericRadare2Match) {
			const [, fullAddress, mnemonic, operands] = genericRadare2Match;
			const address = fullAddress.replace('0x', '').padStart(8, '0');
			const cleanOperands = operands.replace(/\s*;.*$/, '').trim();
			
			return this.buildAssemblyLine(address, '', mnemonic, cleanOperands, undefined, line);
		}

		// radare2形式の別パターン - ボックス文字なしでアドレスから開始
		const radare2SimpleMatch = line.match(/^\s*(0x[0-9a-f]+)\s+([a-z][a-z0-9]*)\s+(.*?)(?:\s*;.*)?$/i);
		if (radare2SimpleMatch) {
			const [, fullAddress, mnemonic, operands] = radare2SimpleMatch;
			const address = fullAddress.replace('0x', '').padStart(8, '0');
			const cleanOperands = operands.replace(/\s*;.*$/, '').trim();
			
			return this.buildAssemblyLine(address, '', mnemonic, cleanOperands, undefined, line);
		}

		// 従来のobjdump形式の解析（後方互換性のため）
		const addressMatch = line.match(/^\s*([0-9a-f]+):\s*/i);
		if (!addressMatch) {
			return null;
		}

		const address = addressMatch[1];
		const remainder = line.substring(addressMatch[0].length);

		// コメント部分（#で始まる）を先に除去
		const commentMatch = remainder.match(/^(.*?)\s*(#.*)$/);
		let workingLine = remainder;
		let comment: string | undefined;

		if (commentMatch) {
			workingLine = commentMatch[1];
			comment = commentMatch[2];
		}

		// 新旧両フォーマットに対応した解析
		const newFormatMatch = workingLine.match(/^\s*([a-z][a-z0-9]*)\s*(.*?)$/i);
		if (newFormatMatch && !workingLine.match(/^[0-9a-f\s]+\s{2,}/i)) {
			const [, mnemonic, operandsSection] = newFormatMatch;
			const operandsAndComment = operandsSection.trim();
			return this.buildAssemblyLine(address, '', mnemonic, operandsAndComment, comment, line);
		}

		// 旧形式: バイトコード部分の後に大きなスペースがあり、その後に命令がくる
		const oldFormatMatch = workingLine.match(/^(.+?)\s{2,}([a-z][a-z0-9]*)\s*(.*?)$/i);
		if (oldFormatMatch) {
			const [, bytesSection, mnemonic, operandsSection] = oldFormatMatch;
			const bytes = bytesSection.replace(/[^0-9a-f\s]/gi, '').trim();
			const operandsAndComment = operandsSection.trim();
			
			return this.buildAssemblyLine(address, bytes, mnemonic, operandsAndComment, comment, line);
		}

		return null;
	}

	private static buildAssemblyLine(
		address: string,
		bytes: string,
		mnemonic: string,
		operandsAndComment: string,
		comment: string | undefined,
		originalLine: string
	): AssemblyLine {
		// オペランドを解析（コメントは既に分離済み）
		let operandsStr = operandsAndComment;

		// オペランドを解析
		const operands = this.parseOperands(operandsStr);

		return {
			address: `0x${address}`,
			bytes: bytes.trim(),
			mnemonic: mnemonic.trim(),
			operands,
			comment,
			originalLine
		};
	}

	private static parseOperands(operandsStr: string): string[] {
		if (!operandsStr.trim()) {
			return [];
		}

		// カンマ区切りでオペランドを分割
		// ただし、括弧内のカンマは無視する
		const operands: string[] = [];
		let current = '';
		let parenCount = 0;

		for (let i = 0; i < operandsStr.length; i++) {
			const char = operandsStr[i];

			if (char === '(') {
				parenCount++;
			} else if (char === ')') {
				parenCount--;
			} else if (char === ',' && parenCount === 0) {
				if (current.trim()) {
					operands.push(current.trim());
				}
				current = '';
				continue;
			}

			current += char;
		}

		if (current.trim()) {
			operands.push(current.trim());
		}

		return operands;
	}

	// オペランドの種類を判定するヘルパーメソッド
	static getOperandType(operand: string): 'register' | 'immediate' | 'memory' | 'label' {
		operand = operand.trim();

		if (operand.startsWith('%')) {
			return 'register';
		} else if (operand.startsWith('$')) {
			return 'immediate';
		} else if (operand.includes('(') && operand.includes(')')) {
			return 'memory';
		} else if (operand.startsWith('var_') || operand.startsWith('arg_')) {
			// radare2のローカル変数参照
			return 'label';
		} else if (operand.match(/^[a-zA-Z_][a-zA-Z0-9_]*$/)) {
			// 通常のラベル (argv, main など)
			return 'label';
		} else if (operand.match(/^[+-]?(?:0x[0-9a-f]+|\d+)$/i)) {
			// 16進数または10進数の即値
			return 'immediate';
		} else {
			return 'label';
		}
	}

	// レジスタ名を正規化（%rax, %eax, %ax, %al等を統一）
	static normalizeRegisterName(register: string): string {
		// radare2のローカル変数記号 (var_4h など) はそのまま返す
		if (register.startsWith('var_') || register.startsWith('arg_')) {
			return register;
		}
		
		if (!register.startsWith('%')) {
			return register;
		}

		const name = register.slice(1).toLowerCase();

		// 64bit汎用レジスタへの正規化
		const registerMap: Record<string, string> = {
			// RAX系
			rax: 'rax',
			eax: 'rax',
			ax: 'rax',
			al: 'rax',
			ah: 'rax',
			// RBX系
			rbx: 'rbx',
			ebx: 'rbx',
			bx: 'rbx',
			bl: 'rbx',
			bh: 'rbx',
			// RCX系
			rcx: 'rcx',
			ecx: 'rcx',
			cx: 'rcx',
			cl: 'rcx',
			ch: 'rcx',
			// RDX系
			rdx: 'rdx',
			edx: 'rdx',
			dx: 'rdx',
			dl: 'rdx',
			dh: 'rdx',
			// その他
			rsi: 'rsi',
			esi: 'rsi',
			si: 'rsi',
			sil: 'rsi',
			rdi: 'rdi',
			edi: 'rdi',
			di: 'rdi',
			dil: 'rdi',
			rsp: 'rsp',
			esp: 'rsp',
			sp: 'rsp',
			spl: 'rsp',
			rbp: 'rbp',
			ebp: 'rbp',
			bp: 'rbp',
			bpl: 'rbp',
			// R8-R15
			r8: 'r8',
			r8d: 'r8',
			r8w: 'r8',
			r8b: 'r8',
			r9: 'r9',
			r9d: 'r9',
			r9w: 'r9',
			r9b: 'r9',
			r10: 'r10',
			r10d: 'r10',
			r10w: 'r10',
			r10b: 'r10',
			r11: 'r11',
			r11d: 'r11',
			r11w: 'r11',
			r11b: 'r11',
			r12: 'r12',
			r12d: 'r12',
			r12w: 'r12',
			r12b: 'r12',
			r13: 'r13',
			r13d: 'r13',
			r13w: 'r13',
			r13b: 'r13',
			r14: 'r14',
			r14d: 'r14',
			r14w: 'r14',
			r14b: 'r14',
			r15: 'r15',
			r15d: 'r15',
			r15w: 'r15',
			r15b: 'r15'
		};

		return registerMap[name] || name;
	}

	// 即値を数値に変換
	static parseImmediate(immediate: string): bigint {
		if (!immediate.startsWith('$')) {
			throw new Error(`Invalid immediate value: ${immediate}`);
		}

		const value = immediate.slice(1);

		if (value.startsWith('0x')) {
			return BigInt(value);
		} else {
			return BigInt(parseInt(value, 10));
		}
	}

	// メモリアドレッシングの解析
	static parseMemoryOperand(memory: string): {
		displacement?: number;
		base?: string;
		index?: string;
		scale?: number;
	} {
		// 例: "-0x30(%rbp,%rax)", "(%rip)", "-0x4(%rbp)"

		// より包括的なメモリオペランド形式に対応
		// x86-64のメモリアドレッシング形式：
		// displacement(base, index, scale)
		// 各部分は省略可能

		const patterns = [
			// パターン1: displacement(base, index, scale)
			/^([+-]?(?:0x[0-9a-f]+|\d+))\(([^,)]+),([^,)]+),([1248])\)$/i,
			// パターン2: displacement(base, index)
			/^([+-]?(?:0x[0-9a-f]+|\d+))\(([^,)]+),([^,)]+)\)$/i,
			// パターン3: displacement(base)
			/^([+-]?(?:0x[0-9a-f]+|\d+))\(([^,)]+)\)$/i,
			// パターン4: (base, index, scale)
			/^\(([^,)]+),([^,)]+),([1248])\)$/i,
			// パターン5: (base, index)
			/^\(([^,)]+),([^,)]+)\)$/i,
			// パターン6: (base)
			/^\(([^,)]+)\)$/i
		];

		let match: RegExpMatchArray | null = null;
		let patternIndex = -1;

		for (let i = 0; i < patterns.length; i++) {
			match = memory.match(patterns[i]);
			if (match) {
				patternIndex = i;
				break;
			}
		}

		if (!match) {
			throw new Error(`Invalid memory operand: ${memory}`);
		}

		// パターンに応じてマッチグループを解析
		const result: {
			displacement?: number;
			base?: string;
			index?: string;
			scale?: number;
		} = {};

		let displacementStr: string | undefined;
		let baseStr: string | undefined;
		let indexStr: string | undefined;
		let scaleStr: string | undefined;

		switch (patternIndex) {
			case 0: // displacement(base, index, scale)
				[, displacementStr, baseStr, indexStr, scaleStr] = match;
				break;
			case 1: // displacement(base, index)
				[, displacementStr, baseStr, indexStr] = match;
				break;
			case 2: // displacement(base)
				[, displacementStr, baseStr] = match;
				break;
			case 3: // (base, index, scale)
				[, baseStr, indexStr, scaleStr] = match;
				break;
			case 4: // (base, index)
				[, baseStr, indexStr] = match;
				break;
			case 5: // (base)
				[, baseStr] = match;
				break;
		}

		// ディスプレースメントの処理
		if (displacementStr) {
			if (
				displacementStr.startsWith('0x') ||
				displacementStr.startsWith('-0x') ||
				displacementStr.startsWith('+0x')
			) {
				result.displacement = parseInt(displacementStr, 16);
			} else {
				result.displacement = parseInt(displacementStr, 10);
			}
		}

		// ベースレジスタの処理
		if (baseStr && baseStr.startsWith('%')) {
			result.base = this.normalizeRegisterName(baseStr);
		}

		// インデックスレジスタの処理
		if (indexStr && indexStr.startsWith('%')) {
			result.index = this.normalizeRegisterName(indexStr);
		}

		// スケールファクターの処理
		if (scaleStr) {
			result.scale = parseInt(scaleStr, 10);
		}

		return result;
	}
}

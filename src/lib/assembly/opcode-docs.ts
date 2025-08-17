// x86-64 オペコード解説データ

export interface OpcodeDoc {
	name: string;
	description: string;
	syntax: string;
	operands: string;
	operation: string;
	flags: string;
	examples: string[];
}

export const OPCODE_DOCS: Record<string, OpcodeDoc> = {
	// データ移動命令
	movq: {
		name: 'MOVQ',
		description: '64ビット値を移動',
		syntax: 'movq src, dest',
		operands: 'src: ソース（レジスタ、メモリ、即値）\ndest: デスティネーション（レジスタ、メモリ）',
		operation: 'dest ← src\n\n64ビット値をソースからデスティネーションに複製します。',
		flags: 'フラグ変更なし',
		examples: [
			'movq %rax, %rbx   # RAXをRBXに複製',
			'movq $42, %rdi    # 即値42をRDIに設定',
			'movq %rsi, -8(%rsp)  # RSIをスタックに保存'
		]
	},

	movl: {
		name: 'MOVL',
		description: '32ビット値を移動（上位32ビットはクリア）',
		syntax: 'movl src, dest',
		operands: 'src: ソース（レジスタ、メモリ、即値）\ndest: デスティネーション（レジスタ、メモリ）',
		operation:
			'dest[31:0] ← src[31:0]\ndest[63:32] ← 0\n\n32ビット値を移動し、64ビットレジスタの上位32ビットを0にクリアします。',
		flags: 'フラグ変更なし',
		examples: [
			'movl %eax, %ebx   # EAXをEBXに複製（上位32ビットクリア）',
			'movl $100, %edi   # 即値100をEDIに設定',
			'movl (%rsi), %edx # メモリからEDXに32ビット読み込み'
		]
	},

	leaq: {
		name: 'LEAQ',
		description: '有効アドレスを計算（Load Effective Address Quadword）',
		syntax: 'leaq src, dest',
		operands: 'src: メモリオペランド形式\ndest: 64ビットレジスタ',
		operation:
			'dest ← アドレス計算結果\n\nメモリアクセスを行わずに、アドレス計算のみを実行します。',
		flags: 'フラグ変更なし',
		examples: [
			'leaq (%rdi,%rsi), %rax  # RDI+RSIのアドレスをRAXに',
			'leaq -16(%rbp), %rsp    # RBP-16をRSPに設定',
			'leaq 8(%rip), %rax      # RIP相対アドレス計算'
		]
	},

	// スタック操作命令
	pushq: {
		name: 'PUSHQ',
		description: '64ビット値をスタックにプッシュ',
		syntax: 'pushq src',
		operands: 'src: プッシュする値（レジスタ、メモリ、即値）',
		operation:
			'RSP ← RSP - 8\n[RSP] ← src\n\nスタックポインタを8減らしてから値をスタックに保存します。',
		flags: 'フラグ変更なし',
		examples: [
			'pushq %rbp        # RBPをスタックに保存',
			'pushq $0x42       # 即値0x42をスタックにプッシュ',
			'pushq -8(%rbp)    # メモリの値をスタックにプッシュ'
		]
	},

	popq: {
		name: 'POPQ',
		description: 'スタックから64ビット値をポップ',
		syntax: 'popq dest',
		operands: 'dest: ポップ先（レジスタまたはメモリ）',
		operation:
			'dest ← [RSP]\nRSP ← RSP + 8\n\nスタックから値を読み込んでからスタックポインタを8増やします。',
		flags: 'フラグ変更なし',
		examples: [
			'popq %rbp         # スタックからRBPに復元',
			'popq %rax         # スタックからRAXにポップ',
			'popq -16(%rbp)    # スタックからメモリにポップ'
		]
	},

	subq: {
		name: 'SUBQ',
		description: '64ビット減算',
		syntax: 'subq src, dest',
		operands: 'src: 減数（レジスタ、メモリ、即値）\ndest: 被減数・結果（レジスタまたはメモリ）',
		operation:
			'dest ← dest - src\n\nデスティネーションからソースを減算し、結果をデスティネーションに格納します。',
		flags: 'ZF, SF, CF, OF を更新',
		examples: [
			'subq $16, %rsp    # RSPから16を減算（スタック領域確保）',
			'subq %rbx, %rax   # RAXからRBXを減算',
			'subq $1, %rcx     # RCXを1減らす'
		]
	},

	addl: {
		name: 'ADDL',
		description: '32ビット加算',
		syntax: 'addl src, dest',
		operands: 'src: 加数（レジスタ、メモリ、即値）\ndest: 被加数・結果（レジスタまたはメモリ）',
		operation:
			'dest[31:0] ← dest[31:0] + src[31:0]\ndest[63:32] ← 0\n\n32ビット加算を実行し、64ビットレジスタの上位32ビットをクリアします。',
		flags: 'ZF, SF, CF, OF を更新',
		examples: [
			'addl $1, %eax     # EAXに1を加算',
			'addl %ebx, %ecx   # ECXにEBXを加算',
			'addl %edi, (%rsp) # スタックの値にEDIを加算'
		]
	},

	// 比較・論理命令
	cmpb: {
		name: 'CMPB',
		description: '8ビット比較（減算結果でフラグ設定）',
		syntax: 'cmpb src1, src2',
		operands: 'src1: 比較値1（レジスタ、メモリ、即値）\nsrc2: 比較値2（レジスタまたはメモリ）',
		operation:
			'temp ← src2 - src1\nフラグを更新（結果は破棄）\n\n8ビット値を比較し、結果に応じてフラグを設定します。',
		flags: 'ZF, SF, CF, OF を更新',
		examples: [
			'cmpb $0, %al      # ALを0と比較',
			'cmpb %bl, %cl     # CLをBLと比較',
			"cmpb $'\\n', (%rsi) # メモリの値を改行文字と比較"
		]
	},

	movzbl: {
		name: 'MOVZBL',
		description: '8ビット値を32ビットにゼロ拡張して移動',
		syntax: 'movzbl src, dest',
		operands:
			'src: 8ビットソース（レジスタまたはメモリ）\ndest: 32ビットデスティネーション（レジスタ）',
		operation:
			'dest[7:0] ← src[7:0]\ndest[31:8] ← 0\ndest[63:32] ← 0\n\n8ビット値を読み込み、上位ビットを0で埋めて32ビットレジスタに格納します。',
		flags: 'フラグ変更なし',
		examples: [
			'movzbl %al, %eax  # ALをゼロ拡張してEAXに',
			'movzbl (%rdi), %eax # メモリから8ビット読み込み、ゼロ拡張',
			'movzbl %cl, %edx  # CLをゼロ拡張してEDXに'
		]
	},

	cltq: {
		name: 'CLTQ',
		description: 'EAXを符号拡張してRAXに変換',
		syntax: 'cltq',
		operands: 'なし（EAX → RAX）',
		operation:
			'if EAX[31] = 0 then RAX[63:32] ← 0\nelse RAX[63:32] ← 0xFFFFFFFF\n\nEAXの32ビット値をRAXの64ビット値に符号拡張します。',
		flags: 'フラグ変更なし',
		examples: [
			'cltq              # EAXをRAXに符号拡張',
			'# 正数: EAX=0x12345678 → RAX=0x0000000012345678',
			'# 負数: EAX=0x80000000 → RAX=0xFFFFFFFF80000000'
		]
	},

	// 分岐命令
	jmp: {
		name: 'JMP',
		description: '無条件ジャンプ',
		syntax: 'jmp target',
		operands: 'target: ジャンプ先（ラベル、アドレス、レジスタ）',
		operation: 'RIP ← target\n\n指定されたアドレスに無条件でジャンプします。',
		flags: 'フラグ変更なし',
		examples: [
			'jmp loop_start    # loop_startラベルにジャンプ',
			'jmp *%rax         # RAXの値をアドレスとしてジャンプ',
			'jmp 0x401000      # 絶対アドレスにジャンプ'
		]
	},

	je: {
		name: 'JE',
		description: '等しい場合ジャンプ（ZF=1）',
		syntax: 'je target',
		operands: 'target: ジャンプ先（ラベル、アドレス）',
		operation:
			'if ZF = 1 then RIP ← target\n\nゼロフラグが設定されている場合（直前の比較で等しい）にジャンプします。',
		flags: 'フラグ変更なし',
		examples: [
			'cmp %rax, %rbx',
			'je equal_case     # RAX = RBXの場合ジャンプ',
			'test %eax, %eax',
			'je zero_case      # EAXが0の場合ジャンプ'
		]
	},

	jne: {
		name: 'JNE',
		description: '等しくない場合ジャンプ（ZF=0）',
		syntax: 'jne target',
		operands: 'target: ジャンプ先（ラベル、アドレス）',
		operation:
			'if ZF = 0 then RIP ← target\n\nゼロフラグがクリアされている場合（直前の比較で等しくない）にジャンプします。',
		flags: 'フラグ変更なし',
		examples: [
			'cmp $0, %rax',
			'jne not_zero      # RAXが0でない場合ジャンプ',
			'cmp %rbx, %rcx',
			'jne different     # RBX ≠ RCXの場合ジャンプ'
		]
	},

	// 関数呼び出し
	callq: {
		name: 'CALLQ',
		description: '関数呼び出し（戻りアドレスをスタックにプッシュ）',
		syntax: 'callq target',
		operands: 'target: 呼び出し先（ラベル、アドレス）',
		operation:
			'push next_instruction_address\nRIP ← target\n\n現在の次の命令アドレスをスタックに保存してから、指定されたアドレスにジャンプします。',
		flags: 'フラグ変更なし',
		examples: [
			'callq printf      # printf関数を呼び出し',
			'callq my_function # my_function関数を呼び出し',
			'callq *%rax       # RAXの値をアドレスとして間接呼び出し'
		]
	},

	retq: {
		name: 'RETQ',
		description: '関数から戻る（スタックから戻りアドレスをポップ）',
		syntax: 'retq',
		operands: 'なし',
		operation: 'RIP ← pop from stack\n\nスタックから戻りアドレスをポップして、その地点に戻ります。',
		flags: 'フラグ変更なし',
		examples: [
			'retq              # 呼び出し元に戻る',
			'# 通常は関数の最後で使用',
			'# callqとペアで使用'
		]
	},

	// その他
	nop: {
		name: 'NOP',
		description: '何も実行しない（No Operation）',
		syntax: 'nop',
		operands: 'なし',
		operation: '何も実行しない\n\n1バイトの時間を消費しますが、プロセッサの状態は変更しません。',
		flags: 'フラグ変更なし',
		examples: [
			'nop               # 何もしない',
			'# パディングやタイミング調整に使用',
			'# デバッグ時の一時的な命令無効化にも使用'
		]
	},

	leave: {
		name: 'LEAVE',
		description: 'スタックフレームを破棄（movq %rbp,%rsp; popq %rbp）',
		syntax: 'leave',
		operands: 'なし',
		operation: 'RSP ← RBP\nRBP ← pop from stack\n\n関数終了時にスタックフレームを解放します。',
		flags: 'フラグ変更なし',
		examples: [
			'leave             # スタックフレーム破棄',
			'retq              # 通常はretqと組み合わせて使用',
			'# 関数プロローグの逆操作'
		]
	}
};

// オペコードの短縮説明を取得
export function getShortDescription(opcode: string): string {
	const doc = OPCODE_DOCS[opcode.toLowerCase()];
	return doc ? doc.description : 'Unknown instruction';
}

// オペコードの詳細説明を取得
export function getFullDescription(opcode: string): OpcodeDoc | null {
	return OPCODE_DOCS[opcode.toLowerCase()] || null;
}

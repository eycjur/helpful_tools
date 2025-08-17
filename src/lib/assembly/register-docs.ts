// x86-64 レジスタ解説データ

export interface RegisterDoc {
	name: string;
	fullName: string;
	description: string;
	size: string;
	usage: string;
	aliases?: string[];
	examples: string[];
	notes?: string;
}

export const REGISTER_DOCS: Record<string, RegisterDoc> = {
	// 64ビット汎用レジスタ
	rax: {
		name: 'RAX',
		fullName: 'Register A Extended',
		description: 'アキュムレータレジスタ（64ビット）',
		size: '64ビット',
		usage: '算術演算、関数戻り値、システムコール番号',
		aliases: ['eax', 'ax', 'ah', 'al'],
		examples: [
			'movq $42, %rax     # RAXに42を設定',
			'addq %rbx, %rax    # RAX += RBX',
			'# 関数戻り値がRAXに格納される'
		],
		notes: 'x86-64の主要レジスタ。関数戻り値やシステムコール戻り値に使用。'
	},

	rbx: {
		name: 'RBX',
		fullName: 'Register B Extended',
		description: 'ベースレジスタ（64ビット）',
		size: '64ビット',
		usage: '汎用データストレージ、ベースアドレス',
		aliases: ['ebx', 'bx', 'bh', 'bl'],
		examples: [
			'movq %rax, %rbx    # RBXにRAXの値をコピー',
			'leaq (%rbx,%rcx), %rax  # RBXをベースアドレスとして使用'
		],
		notes: '呼び出し先保存レジスタ（callee-saved）'
	},

	rcx: {
		name: 'RCX',
		fullName: 'Register C Extended',
		description: 'カウンタレジスタ（64ビット）',
		size: '64ビット',
		usage: 'ループカウンタ、関数第4引数',
		aliases: ['ecx', 'cx', 'ch', 'cl'],
		examples: [
			'movq $10, %rcx     # ループカウンタを10に設定',
			'loop label          # RCXをデクリメントしてジャンプ'
		],
		notes: 'System V ABI: 関数の第4引数として使用'
	},

	rdx: {
		name: 'RDX',
		fullName: 'Register D Extended',
		description: 'データレジスタ（64ビット）',
		size: '64ビット',
		usage: 'データストレージ、関数第3引数、乗除算',
		aliases: ['edx', 'dx', 'dh', 'dl'],
		examples: [
			'mulq %rbx           # RAX * RBX → RDX:RAX',
			'divq %rcx           # RDX:RAX ÷ RCX → RAX余りRDX'
		],
		notes: 'System V ABI: 関数の第3引数として使用。乗除算で上位ビット格納。'
	},

	rsi: {
		name: 'RSI',
		fullName: 'Register Source Index',
		description: 'ソースインデックスレジスタ（64ビット）',
		size: '64ビット',
		usage: '文字列操作のソース、関数第2引数',
		aliases: ['esi', 'si', 'sil'],
		examples: [
			'movq %rsi, %rax    # 第2引数をRAXに',
			'lodsb               # [RSI]からALにロード、RSI++'
		],
		notes: 'System V ABI: 関数の第2引数として使用'
	},

	rdi: {
		name: 'RDI',
		fullName: 'Register Destination Index',
		description: 'デスティネーションインデックスレジスタ（64ビット）',
		size: '64ビット',
		usage: '文字列操作の宛先、関数第1引数',
		aliases: ['edi', 'di', 'dil'],
		examples: [
			'movq %rdi, %rax    # 第1引数をRAXに',
			'stosb               # ALを[RDI]にストア、RDI++'
		],
		notes: 'System V ABI: 関数の第1引数として使用'
	},

	rsp: {
		name: 'RSP',
		fullName: 'Register Stack Pointer',
		description: 'スタックポインタ（64ビット）',
		size: '64ビット',
		usage: 'スタックの最上位アドレスを指す',
		aliases: ['esp', 'sp', 'spl'],
		examples: [
			'pushq %rax         # RSPを8減らしてRAXをプッシュ',
			'popq %rbx          # スタックからポップしてRSPを8増やす',
			'subq $16, %rsp     # スタック領域を16バイト確保'
		],
		notes: 'スタック管理の中核。pushq/popq命令で自動更新される。'
	},

	rbp: {
		name: 'RBP',
		fullName: 'Register Base Pointer',
		description: 'ベースポインタ（64ビット）',
		size: '64ビット',
		usage: 'スタックフレームのベースアドレス',
		aliases: ['ebp', 'bp', 'bpl'],
		examples: [
			'pushq %rbp         # 古いRBPを保存',
			'movq %rsp, %rbp    # 新しいスタックフレーム設定',
			'movq -8(%rbp), %rax # ローカル変数アクセス'
		],
		notes: '関数プロローグ/エピローグでスタックフレーム管理に使用'
	},

	// 32ビット汎用レジスタ（64ビットレジスタの下位32ビット）
	eax: {
		name: 'EAX',
		fullName: 'Extended Accumulator',
		description: 'アキュムレータレジスタ（32ビット）',
		size: '32ビット',
		usage: 'RAXの下位32ビット。操作時に上位32ビットは0クリア',
		aliases: ['ax', 'ah', 'al'],
		examples: [
			'movl $42, %eax     # EAXに42、RAX上位32ビットは0',
			'addl %ebx, %eax    # 32ビット加算'
		],
		notes: '32ビット操作時、対応する64ビットレジスタの上位32ビットが自動的に0になる'
	},

	ebx: {
		name: 'EBX',
		fullName: 'Extended Base',
		description: 'ベースレジスタ（32ビット）',
		size: '32ビット',
		usage: 'RBXの下位32ビット',
		aliases: ['bx', 'bh', 'bl'],
		examples: ['movl %eax, %ebx    # EBXにEAXの値をコピー'],
		notes: 'RBXの下位32ビット部分'
	},

	ecx: {
		name: 'ECX',
		fullName: 'Extended Counter',
		description: 'カウンタレジスタ（32ビット）',
		size: '32ビット',
		usage: 'RCXの下位32ビット',
		aliases: ['cx', 'ch', 'cl'],
		examples: ['movl $10, %ecx     # ループカウンタ設定'],
		notes: 'RCXの下位32ビット部分'
	},

	edx: {
		name: 'EDX',
		fullName: 'Extended Data',
		description: 'データレジスタ（32ビット）',
		size: '32ビット',
		usage: 'RDXの下位32ビット',
		aliases: ['dx', 'dh', 'dl'],
		examples: ['movl %eax, %edx    # EDXにEAXをコピー'],
		notes: 'RDXの下位32ビット部分'
	},

	esi: {
		name: 'ESI',
		fullName: 'Extended Source Index',
		description: 'ソースインデックス（32ビット）',
		size: '32ビット',
		usage: 'RSIの下位32ビット',
		aliases: ['si', 'sil'],
		examples: ['movl (%esi), %eax  # ESIが指すメモリから読み込み'],
		notes: 'RSIの下位32ビット部分'
	},

	edi: {
		name: 'EDI',
		fullName: 'Extended Destination Index',
		description: 'デスティネーションインデックス（32ビット）',
		size: '32ビット',
		usage: 'RDIの下位32ビット',
		aliases: ['di', 'dil'],
		examples: ['movl %eax, (%edi)  # EAXをEDIが指すメモリに保存'],
		notes: 'RDIの下位32ビット部分'
	},

	esp: {
		name: 'ESP',
		fullName: 'Extended Stack Pointer',
		description: 'スタックポインタ（32ビット）',
		size: '32ビット',
		usage: 'RSPの下位32ビット',
		aliases: ['sp', 'spl'],
		examples: ['movl %esp, %ebp    # スタックフレーム設定'],
		notes: 'RSPの下位32ビット部分'
	},

	ebp: {
		name: 'EBP',
		fullName: 'Extended Base Pointer',
		description: 'ベースポインタ（32ビット）',
		size: '32ビット',
		usage: 'RBPの下位32ビット',
		aliases: ['bp', 'bpl'],
		examples: ['movl %esp, %ebp    # スタックフレーム初期化'],
		notes: 'RBPの下位32ビット部分'
	},

	// 16ビット汎用レジスタ
	ax: {
		name: 'AX',
		fullName: 'Accumulator',
		description: 'アキュムレータ（16ビット）',
		size: '16ビット',
		usage: 'RAXの下位16ビット',
		aliases: ['ah', 'al'],
		examples: ['movw $42, %ax      # AXに42を設定'],
		notes: 'RAXの下位16ビット（bits 15-0）'
	},

	bx: {
		name: 'BX',
		fullName: 'Base',
		description: 'ベース（16ビット）',
		size: '16ビット',
		usage: 'RBXの下位16ビット',
		aliases: ['bh', 'bl'],
		examples: ['movw %ax, %bx      # BXにAXをコピー'],
		notes: 'RBXの下位16ビット（bits 15-0）'
	},

	cx: {
		name: 'CX',
		fullName: 'Counter',
		description: 'カウンタ（16ビット）',
		size: '16ビット',
		usage: 'RCXの下位16ビット',
		aliases: ['ch', 'cl'],
		examples: ['movw $10, %cx      # カウンタ設定'],
		notes: 'RCXの下位16ビット（bits 15-0）'
	},

	dx: {
		name: 'DX',
		fullName: 'Data',
		description: 'データ（16ビット）',
		size: '16ビット',
		usage: 'RDXの下位16ビット',
		aliases: ['dh', 'dl'],
		examples: ['movw %ax, %dx      # DXにAXをコピー'],
		notes: 'RDXの下位16ビット（bits 15-0）'
	},

	si: {
		name: 'SI',
		fullName: 'Source Index',
		description: 'ソースインデックス（16ビット）',
		size: '16ビット',
		usage: 'RSIの下位16ビット',
		aliases: ['sil'],
		examples: ['movw (%si), %ax    # SIが指すメモリから読み込み'],
		notes: 'RSIの下位16ビット（bits 15-0）'
	},

	di: {
		name: 'DI',
		fullName: 'Destination Index',
		description: 'デスティネーションインデックス（16ビット）',
		size: '16ビット',
		usage: 'RDIの下位16ビット',
		aliases: ['dil'],
		examples: ['movw %ax, (%di)    # AXをDIが指すメモリに保存'],
		notes: 'RDIの下位16ビット（bits 15-0）'
	},

	sp: {
		name: 'SP',
		fullName: 'Stack Pointer',
		description: 'スタックポインタ（16ビット）',
		size: '16ビット',
		usage: 'RSPの下位16ビット',
		aliases: ['spl'],
		examples: ['movw %sp, %bp      # スタックポインタをコピー'],
		notes: 'RSPの下位16ビット（bits 15-0）'
	},

	bp: {
		name: 'BP',
		fullName: 'Base Pointer',
		description: 'ベースポインタ（16ビット）',
		size: '16ビット',
		usage: 'RBPの下位16ビット',
		aliases: ['bpl'],
		examples: ['movw %sp, %bp      # ベースポインタ設定'],
		notes: 'RBPの下位16ビット（bits 15-0）'
	},

	// 8ビットレジスタ（高位）
	ah: {
		name: 'AH',
		fullName: 'Accumulator High',
		description: 'アキュムレータ上位8ビット',
		size: '8ビット',
		usage: 'RAXのbits 15-8',
		examples: ['movb $0x42, %ah    # AHに0x42を設定'],
		notes: 'RAXの上位8ビット（bits 15-8）。ALと組み合わせてAXを構成。'
	},

	bh: {
		name: 'BH',
		fullName: 'Base High',
		description: 'ベース上位8ビット',
		size: '8ビット',
		usage: 'RBXのbits 15-8',
		examples: ['movb %al, %bh      # BHにALをコピー'],
		notes: 'RBXの上位8ビット（bits 15-8）'
	},

	ch: {
		name: 'CH',
		fullName: 'Counter High',
		description: 'カウンタ上位8ビット',
		size: '8ビット',
		usage: 'RCXのbits 15-8',
		examples: ['movb $10, %ch      # CHに10を設定'],
		notes: 'RCXの上位8ビット（bits 15-8）'
	},

	dh: {
		name: 'DH',
		fullName: 'Data High',
		description: 'データ上位8ビット',
		size: '8ビット',
		usage: 'RDXのbits 15-8',
		examples: ['movb %al, %dh      # DHにALをコピー'],
		notes: 'RDXの上位8ビット（bits 15-8）'
	},

	// 8ビットレジスタ（下位）
	al: {
		name: 'AL',
		fullName: 'Accumulator Low',
		description: 'アキュムレータ下位8ビット',
		size: '8ビット',
		usage: 'RAXのbits 7-0',
		examples: ['movb $42, %al      # ALに42を設定', 'cmpb $0, %al       # ALを0と比較'],
		notes: 'RAXの最下位8ビット。文字処理や小さな値の操作に使用。'
	},

	bl: {
		name: 'BL',
		fullName: 'Base Low',
		description: 'ベース下位8ビット',
		size: '8ビット',
		usage: 'RBXのbits 7-0',
		examples: ['movb %al, %bl      # BLにALをコピー'],
		notes: 'RBXの最下位8ビット'
	},

	cl: {
		name: 'CL',
		fullName: 'Counter Low',
		description: 'カウンタ下位8ビット',
		size: '8ビット',
		usage: 'RCXのbits 7-0、シフト回数',
		examples: [
			'movb $3, %cl       # シフト回数を3に設定',
			'shlq %cl, %rax     # RAXをCL回左シフト'
		],
		notes: 'RCXの最下位8ビット。シフト・ローテート命令の回数指定に使用。'
	},

	dl: {
		name: 'DL',
		fullName: 'Data Low',
		description: 'データ下位8ビット',
		size: '8ビット',
		usage: 'RDXのbits 7-0',
		examples: ['movb %al, %dl      # DLにALをコピー'],
		notes: 'RDXの最下位8ビット'
	},

	sil: {
		name: 'SIL',
		fullName: 'Source Index Low',
		description: 'ソースインデックス下位8ビット',
		size: '8ビット',
		usage: 'RSIのbits 7-0',
		examples: ['movb %al, %sil     # SILにALをコピー'],
		notes: 'RSIの最下位8ビット（x86-64で追加）'
	},

	dil: {
		name: 'DIL',
		fullName: 'Destination Index Low',
		description: 'デスティネーションインデックス下位8ビット',
		size: '8ビット',
		usage: 'RDIのbits 7-0',
		examples: ['movb %al, %dil     # DILにALをコピー'],
		notes: 'RDIの最下位8ビット（x86-64で追加）'
	},

	spl: {
		name: 'SPL',
		fullName: 'Stack Pointer Low',
		description: 'スタックポインタ下位8ビット',
		size: '8ビット',
		usage: 'RSPのbits 7-0',
		examples: ['movb %al, %spl     # SPLにALをコピー'],
		notes: 'RSPの最下位8ビット（x86-64で追加）'
	},

	bpl: {
		name: 'BPL',
		fullName: 'Base Pointer Low',
		description: 'ベースポインタ下位8ビット',
		size: '8ビット',
		usage: 'RBPのbits 7-0',
		examples: ['movb %al, %bpl     # BPLにALをコピー'],
		notes: 'RBPの最下位8ビット（x86-64で追加）'
	},

	// 拡張レジスタ（R8-R15）
	r8: {
		name: 'R8',
		fullName: 'General Purpose Register 8',
		description: '汎用レジスタ8（64ビット）',
		size: '64ビット',
		usage: '関数第5引数、汎用データストレージ',
		aliases: ['r8d', 'r8w', 'r8b'],
		examples: ['movq %rax, %r8     # R8にRAXをコピー', 'addq %r8, %r9      # R9にR8を加算'],
		notes: 'System V ABI: 関数の第5引数として使用'
	},

	r9: {
		name: 'R9',
		fullName: 'General Purpose Register 9',
		description: '汎用レジスタ9（64ビット）',
		size: '64ビット',
		usage: '関数第6引数、汎用データストレージ',
		aliases: ['r9d', 'r9w', 'r9b'],
		examples: ['movq $100, %r9     # R9に100を設定'],
		notes: 'System V ABI: 関数の第6引数として使用'
	},

	r10: {
		name: 'R10',
		fullName: 'General Purpose Register 10',
		description: '汎用レジスタ10（64ビット）',
		size: '64ビット',
		usage: '汎用データストレージ、スクラッチレジスタ',
		aliases: ['r10d', 'r10w', 'r10b'],
		examples: ['movq %rsi, %r10    # R10にRSIをコピー'],
		notes: '呼び出し先で自由に使用可能（caller-saved）'
	},

	r11: {
		name: 'R11',
		fullName: 'General Purpose Register 11',
		description: '汎用レジスタ11（64ビット）',
		size: '64ビット',
		usage: '汎用データストレージ、スクラッチレジスタ',
		aliases: ['r11d', 'r11w', 'r11b'],
		examples: ['leaq (%rax,%r11), %rdx  # R11をインデックスとして使用'],
		notes: '呼び出し先で自由に使用可能（caller-saved）'
	},

	r12: {
		name: 'R12',
		fullName: 'General Purpose Register 12',
		description: '汎用レジスタ12（64ビット）',
		size: '64ビット',
		usage: '汎用データストレージ',
		aliases: ['r12d', 'r12w', 'r12b'],
		examples: ['movq %rbx, %r12    # R12にRBXをコピー'],
		notes: '呼び出し先保存レジスタ（callee-saved）'
	},

	r13: {
		name: 'R13',
		fullName: 'General Purpose Register 13',
		description: '汎用レジスタ13（64ビット）',
		size: '64ビット',
		usage: '汎用データストレージ',
		aliases: ['r13d', 'r13w', 'r13b'],
		examples: ['movq %rcx, %r13    # R13にRCXをコピー'],
		notes: '呼び出し先保存レジスタ（callee-saved）'
	},

	r14: {
		name: 'R14',
		fullName: 'General Purpose Register 14',
		description: '汎用レジスタ14（64ビット）',
		size: '64ビット',
		usage: '汎用データストレージ',
		aliases: ['r14d', 'r14w', 'r14b'],
		examples: ['movq %rdx, %r14    # R14にRDXをコピー'],
		notes: '呼び出し先保存レジスタ（callee-saved）'
	},

	r15: {
		name: 'R15',
		fullName: 'General Purpose Register 15',
		description: '汎用レジスタ15（64ビット）',
		size: '64ビット',
		usage: '汎用データストレージ',
		aliases: ['r15d', 'r15w', 'r15b'],
		examples: ['movq %rdi, %r15    # R15にRDIをコピー'],
		notes: '呼び出し先保存レジスタ（callee-saved）'
	},

	// 拡張レジスタの32ビット部分
	r8d: {
		name: 'R8D',
		fullName: 'General Purpose Register 8 Double',
		description: 'R8の下位32ビット',
		size: '32ビット',
		usage: 'R8の下位32ビット',
		examples: ['movl %eax, %r8d    # R8DにEAXをコピー'],
		notes: 'R8の下位32ビット。操作時に上位32ビットは0クリア。'
	},

	r9d: {
		name: 'R9D',
		fullName: 'General Purpose Register 9 Double',
		description: 'R9の下位32ビット',
		size: '32ビット',
		usage: 'R9の下位32ビット',
		examples: ['movl $42, %r9d     # R9Dに42を設定'],
		notes: 'R9の下位32ビット。操作時に上位32ビットは0クリア。'
	},

	r10d: {
		name: 'R10D',
		fullName: 'General Purpose Register 10 Double',
		description: 'R10の下位32ビット',
		size: '32ビット',
		usage: 'R10の下位32ビット',
		examples: ['addl %eax, %r10d   # R10DにEAXを加算'],
		notes: 'R10の下位32ビット'
	},

	r11d: {
		name: 'R11D',
		fullName: 'General Purpose Register 11 Double',
		description: 'R11の下位32ビット',
		size: '32ビット',
		usage: 'R11の下位32ビット',
		examples: ['movl %ebx, %r11d   # R11DにEBXをコピー'],
		notes: 'R11の下位32ビット'
	},

	r12d: {
		name: 'R12D',
		fullName: 'General Purpose Register 12 Double',
		description: 'R12の下位32ビット',
		size: '32ビット',
		usage: 'R12の下位32ビット',
		examples: ['movl %ecx, %r12d   # R12DにECXをコピー'],
		notes: 'R12の下位32ビット'
	},

	r13d: {
		name: 'R13D',
		fullName: 'General Purpose Register 13 Double',
		description: 'R13の下位32ビット',
		size: '32ビット',
		usage: 'R13の下位32ビット',
		examples: ['movl %edx, %r13d   # R13DにEDXをコピー'],
		notes: 'R13の下位32ビット'
	},

	r14d: {
		name: 'R14D',
		fullName: 'General Purpose Register 14 Double',
		description: 'R14の下位32ビット',
		size: '32ビット',
		usage: 'R14の下位32ビット',
		examples: ['movl %esi, %r14d   # R14DにESIをコピー'],
		notes: 'R14の下位32ビット'
	},

	r15d: {
		name: 'R15D',
		fullName: 'General Purpose Register 15 Double',
		description: 'R15の下位32ビット',
		size: '32ビット',
		usage: 'R15の下位32ビット',
		examples: ['movl %edi, %r15d   # R15DにEDIをコピー'],
		notes: 'R15の下位32ビット'
	},

	// 拡張レジスタの16ビット部分
	r8w: {
		name: 'R8W',
		fullName: 'General Purpose Register 8 Word',
		description: 'R8の下位16ビット',
		size: '16ビット',
		usage: 'R8の下位16ビット',
		examples: ['movw %ax, %r8w     # R8WにAXをコピー'],
		notes: 'R8の下位16ビット'
	},

	r9w: {
		name: 'R9W',
		fullName: 'General Purpose Register 9 Word',
		description: 'R9の下位16ビット',
		size: '16ビット',
		usage: 'R9の下位16ビット',
		examples: ['movw $100, %r9w    # R9Wに100を設定'],
		notes: 'R9の下位16ビット'
	},

	r10w: {
		name: 'R10W',
		fullName: 'General Purpose Register 10 Word',
		description: 'R10の下位16ビット',
		size: '16ビット',
		usage: 'R10の下位16ビット',
		examples: ['addw %bx, %r10w    # R10WにBXを加算'],
		notes: 'R10の下位16ビット'
	},

	r11w: {
		name: 'R11W',
		fullName: 'General Purpose Register 11 Word',
		description: 'R11の下位16ビット',
		size: '16ビット',
		usage: 'R11の下位16ビット',
		examples: ['movw %cx, %r11w    # R11WにCXをコピー'],
		notes: 'R11の下位16ビット'
	},

	r12w: {
		name: 'R12W',
		fullName: 'General Purpose Register 12 Word',
		description: 'R12の下位16ビット',
		size: '16ビット',
		usage: 'R12の下位16ビット',
		examples: ['movw %dx, %r12w    # R12WにDXをコピー'],
		notes: 'R12の下位16ビット'
	},

	r13w: {
		name: 'R13W',
		fullName: 'General Purpose Register 13 Word',
		description: 'R13の下位16ビット',
		size: '16ビット',
		usage: 'R13の下位16ビット',
		examples: ['movw %si, %r13w    # R13WにSIをコピー'],
		notes: 'R13の下位16ビット'
	},

	r14w: {
		name: 'R14W',
		fullName: 'General Purpose Register 14 Word',
		description: 'R14の下位16ビット',
		size: '16ビット',
		usage: 'R14の下位16ビット',
		examples: ['movw %di, %r14w    # R14WにDIをコピー'],
		notes: 'R14の下位16ビット'
	},

	r15w: {
		name: 'R15W',
		fullName: 'General Purpose Register 15 Word',
		description: 'R15の下位16ビット',
		size: '16ビット',
		usage: 'R15の下位16ビット',
		examples: ['movw %sp, %r15w    # R15WにSPをコピー'],
		notes: 'R15の下位16ビット'
	},

	// 拡張レジスタの8ビット部分
	r8b: {
		name: 'R8B',
		fullName: 'General Purpose Register 8 Byte',
		description: 'R8の下位8ビット',
		size: '8ビット',
		usage: 'R8の下位8ビット',
		examples: ['movb %al, %r8b     # R8BにALをコピー'],
		notes: 'R8の最下位8ビット'
	},

	r9b: {
		name: 'R9B',
		fullName: 'General Purpose Register 9 Byte',
		description: 'R9の下位8ビット',
		size: '8ビット',
		usage: 'R9の下位8ビット',
		examples: ['movb $42, %r9b     # R9Bに42を設定'],
		notes: 'R9の最下位8ビット'
	},

	r10b: {
		name: 'R10B',
		fullName: 'General Purpose Register 10 Byte',
		description: 'R10の下位8ビット',
		size: '8ビット',
		usage: 'R10の下位8ビット',
		examples: ['cmpb $0, %r10b     # R10Bを0と比較'],
		notes: 'R10の最下位8ビット'
	},

	r11b: {
		name: 'R11B',
		fullName: 'General Purpose Register 11 Byte',
		description: 'R11の下位8ビット',
		size: '8ビット',
		usage: 'R11の下位8ビット',
		examples: ['movb %bl, %r11b    # R11BにBLをコピー'],
		notes: 'R11の最下位8ビット'
	},

	r12b: {
		name: 'R12B',
		fullName: 'General Purpose Register 12 Byte',
		description: 'R12の下位8ビット',
		size: '8ビット',
		usage: 'R12の下位8ビット',
		examples: ['movb %cl, %r12b    # R12BにCLをコピー'],
		notes: 'R12の最下位8ビット'
	},

	r13b: {
		name: 'R13B',
		fullName: 'General Purpose Register 13 Byte',
		description: 'R13の下位8ビット',
		size: '8ビット',
		usage: 'R13の下位8ビット',
		examples: ['movb %dl, %r13b    # R13BにDLをコピー'],
		notes: 'R13の最下位8ビット'
	},

	r14b: {
		name: 'R14B',
		fullName: 'General Purpose Register 14 Byte',
		description: 'R14の下位8ビット',
		size: '8ビット',
		usage: 'R14の下位8ビット',
		examples: ['movb %sil, %r14b   # R14BにSILをコピー'],
		notes: 'R14の最下位8ビット'
	},

	r15b: {
		name: 'R15B',
		fullName: 'General Purpose Register 15 Byte',
		description: 'R15の下位8ビット',
		size: '8ビット',
		usage: 'R15の下位8ビット',
		examples: ['movb %dil, %r15b   # R15BにDILをコピー'],
		notes: 'R15の最下位8ビット'
	},

	// 特殊レジスタ
	rip: {
		name: 'RIP',
		fullName: 'Instruction Pointer',
		description: '命令ポインタ（64ビット）',
		size: '64ビット',
		usage: '現在実行中の命令のアドレス',
		examples: [
			'leaq label(%rip), %rax  # RIP相対アドレシング',
			'jmp *%rip               # 現在位置にジャンプ（無限ループ）'
		],
		notes: '直接操作不可。jmp/call/ret命令で間接的に変更される。RIP相対アドレシングで参照可能。'
	},

	rflags: {
		name: 'RFLAGS',
		fullName: 'Flags Register',
		description: 'フラグレジスタ（64ビット）',
		size: '64ビット',
		usage: '演算結果や条件を示すフラグビット',
		examples: [
			'cmpq %rax, %rbx        # ZF, CF, SF, OF等を設定',
			'je equal_label         # ZF=1なら分岐'
		],
		notes: '個別フラグ: ZF(ゼロ), CF(キャリー), SF(符号), OF(オーバーフロー)等'
	}
};

// レジスタの短縮説明を取得
export function getRegisterShortDescription(register: string): string {
	// %記号を除去
	const cleanRegister = register.replace(/^%/, '');
	const doc = REGISTER_DOCS[cleanRegister.toLowerCase()];
	return doc ? doc.description : 'Unknown register';
}

// レジスタの詳細説明を取得
export function getRegisterFullDescription(register: string): RegisterDoc | null {
	// %記号を除去
	const cleanRegister = register.replace(/^%/, '');
	return REGISTER_DOCS[cleanRegister.toLowerCase()] || null;
}

// レジスタかどうかを判定
export function isRegister(operand: string): boolean {
	return operand.startsWith('%') && getRegisterFullDescription(operand) !== null;
}

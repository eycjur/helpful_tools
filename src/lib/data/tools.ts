export interface Tool {
	nameJa: string;
	name: string;
	description: string;
	icon: string;
}

export const tools: Tool[] = [
	{
		nameJa: 'HTML → Markdown',
		name: 'html-to-markdown',
		description: 'HTMLをMarkdown形式に変換します',
		icon: 'mdi:sync'
	},
	{
		nameJa: 'リッチテキスト → Markdown',
		name: 'richtext-to-markdown',
		description: 'リッチテキストをMarkdown形式に変換します',
		icon: 'mdi:file-document'
	},
	{
		nameJa: 'QRコードジェネレーター',
		name: 'qrcode-generator',
		description: 'テキストからQRコードを生成します',
		icon: 'mdi:qrcode'
	},
	{
		nameJa: 'X プロフィール QR',
		name: 'x-qrcode-generator',
		description: 'X（旧Twitter）プロフィール用のQRコードを生成します',
		icon: 'mdi:twitter'
	},
	{
		nameJa: '文字数カウンタ',
		name: 'character-counter',
		description: 'テキストの文字数をリアルタイムでカウントします',
		icon: 'mdi:numeric'
	},
	{
		nameJa: 'CSV/Excel → LaTeX表',
		name: 'csv-to-latex',
		description: 'CSV/ExcelデータをLaTeX表形式に変換します',
		icon: 'mdi:table-arrow-right'
	},
	{
		nameJa: 'Markdown → Notion',
		name: 'markdown-to-notion',
		description: 'MarkdownをNotion形式に変換します',
		icon: 'mdi:swap-horizontal'
	},
	{
		nameJa: 'x86-64 アセンブリインタプリタ',
		name: 'assembly-interpreter',
		description:
			'x86-64アセンブリコードをステップ実行してレジスタとメモリ状態を確認できるインタプリタです',
		icon: 'mdi:chip'
	}
];

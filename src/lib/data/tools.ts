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
		nameJa: 'クリップボードインスペクター',
		name: 'clipboard-inspector',
		description: 'クリップボードの中身を詳細に表示・検証します',
		icon: 'mdi:clipboard-text'
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
		nameJa: '構造化データビューアー',
		name: 'json-formatter',
		description: 'JSON・Pythonオブジェクトを解析して見やすいツリー形式で表示します',
		icon: 'mdi:file-tree'
	},
	{
		nameJa: '画像形式変換',
		name: 'image-converter',
		description: '画像をPNG/JPEG/WebPに変換',
		icon: 'mdi:image-sync'
	}
];;

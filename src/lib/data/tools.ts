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
		nameJa: '構造化データビューアー',
		name: 'json-formatter',
		description: 'JSON・Pythonオブジェクトを解析して見やすいツリー形式で表示します',
		icon: 'mdi:file-tree'
	},
	{
		nameJa: 'コード整形',
		name: 'code-formatter',
		description: 'プログラミングコードの不要な空白を削除します',
		icon: 'mdi:code-braces'
	},
	{
		nameJa: '画像形式変換',
		name: 'image-converter',
		description: '画像をPNG/JPEG/WebPに変換',
		icon: 'mdi:image-sync'
	},
	{
		nameJa: '正規表現テスター',
		name: 'regex-tester',
		description: 'JavaScript正規表現で一致箇所・グループを確認',
		icon: 'mdi:regex'
	},
	{
		nameJa: '文字数カウンタ',
		name: 'character-counter',
		description: 'テキストの文字数をリアルタイムでカウントします',
		icon: 'mdi:numeric'
	},
	{
		nameJa: 'X プロフィール QR',
		name: 'x-qrcode-generator',
		description: 'X（旧Twitter）プロフィール用のQRコードを生成します',
		icon: 'mdi:twitter'
	},
	{
		nameJa: 'QRコードジェネレーター',
		name: 'qrcode-generator',
		description: 'テキストからQRコードを生成します',
		icon: 'mdi:qrcode'
	},
	{
		nameJa: 'クリップボードインスペクター',
		name: 'clipboard-inspector',
		description: 'クリップボードの中身を詳細に表示・検証します',
		icon: 'mdi:clipboard-text'
	},
	{
		nameJa: 'Base64⇄画像変換',
		name: 'base64-converter',
		description: '画像とBase64文字列を相互に変換します',
		icon: 'mdi:swap-vertical'
	},
	{
		nameJa: 'Markdown → Notion',
		name: 'markdown-to-notion',
		description: 'MarkdownをNotion形式に変換します',
		icon: 'mdi:swap-horizontal'
	},
	{
		nameJa: 'CSV/Excel → LaTeX表',
		name: 'csv-to-latex',
		description: 'CSV/ExcelデータをLaTeX表形式に変換します',
		icon: 'mdi:table-arrow-right'
	},
	{
		nameJa: '動画圧縮',
		name: 'video-compressor',
		description: '動画ファイルのサイズを圧縮してファイルサイズを削減します',
		icon: 'mdi:video-box'
	}
];

export interface Tool {
	nameJa: string;
	name: string;
	description: string;
	icon: string;
	category: string;
}

export const tools: Tool[] = [
	{
		nameJa: 'HTML → Markdown',
		name: 'html-to-markdown',
		description: 'HTMLをMarkdown形式に変換します',
		icon: 'mdi:sync',
		category: '生成AI'
	},
	{
		nameJa: 'リッチテキスト → Markdown',
		name: 'richtext-to-markdown',
		description: 'リッチテキストをMarkdown形式に変換します',
		icon: 'mdi:file-document',
		category: '生成AI'
	},
	{
		nameJa: '構造化データビューアー',
		name: 'json-formatter',
		description: 'JSON・Pythonオブジェクトを解析して見やすいツリー形式で表示します',
		icon: 'mdi:file-tree',
		category: '開発・比較ツール'
	},
	{
		nameJa: 'コード整形',
		name: 'code-formatter',
		description: 'プログラミングコードの不要な空白を削除します',
		icon: 'mdi:code-braces',
		category: '開発・比較ツール'
	},
	{
		nameJa: 'Diffチェッカー',
		name: 'diff-checker',
		description: 'テキストの差分を視覚的に表示・比較します',
		icon: 'mdi:file-compare',
		category: '開発・比較ツール'
	},
	{
		nameJa: 'curlコマンドビルダー',
		name: 'curl-builder',
		description: 'HTTPリクエスト用のcurlコマンドを視覚的に構築します',
		icon: 'mdi:console-network',
		category: '開発・比較ツール'
	},
	{
		nameJa: 'クリップボードインスペクタ',
		name: 'clipboard-inspector',
		description: 'クリップボードの中身を詳細に表示・検証します',
		icon: 'mdi:clipboard-text',
		category: '開発・比較ツール'
	},
	{
		nameJa: 'Pythonコード解析',
		name: 'python-analyzer',
		description: 'PythonコードのAST・Bytecode・実行トレースを確認',
		icon: 'mdi:language-python',
		category: '開発・比較ツール'
	},
	{
		nameJa: 'ハッシュ値計算',
		name: 'hash-calculator',
		description: 'ファイルやテキストのハッシュ値を計算（MD5/SHA-1/SHA-256/SHA-384/SHA-512）',
		icon: 'mdi:fingerprint',
		category: '開発・比較ツール'
	},
	{
		nameJa: 'Hexダンプ',
		name: 'hex-dump',
		description: 'バイナリファイルを16進数ダンプ形式で表示',
		icon: 'mdi:file-code',
		category: '開発・比較ツール'
	},
	{
		nameJa: 'パスワード生成',
		name: 'password-generator',
		description: '安全なランダムパスワードを生成します',
		icon: 'mdi:lock-reset',
		category: '開発・比較ツール'
	},
	{
		nameJa: '正規表現テスター',
		name: 'regex-tester',
		description: 'JavaScript正規表現で一致箇所・グループを確認',
		icon: 'mdi:regex',
		category: '文字・テキスト処理'
	},
	{
		nameJa: '文字数カウンタ',
		name: 'character-counter',
		description: 'テキストの文字数をリアルタイムでカウントします',
		icon: 'mdi:numeric',
		category: '文字・テキスト処理'
	},
	{
		nameJa: 'HTML/URL エンコーダ',
		name: 'html-url-encoder',
		description: 'HTML特殊文字やURLの文字列をエンコード・デコードします',
		icon: 'mdi:code-tags',
		category: '文字・テキスト処理'
	},
	{
		nameJa: 'エンコード文字列デコーダ',
		name: 'string-decoder',
		description: '20種類以上のエンコード形式を自動検出・デコードします',
		icon: 'mdi:file-code-outline',
		category: '文字・テキスト処理'
	},
	{
		nameJa: '接続元情報表示',
		name: 'connection-info',
		description: 'IPアドレスやブラウザなどの接続元情報を詳細表示します',
		icon: 'mdi:ip-network',
		category: 'ネットワーク・情報'
	},
	{
		nameJa: 'Whois・ドメイン情報',
		name: 'whois-lookup',
		description: 'ドメイン・IPアドレスのWhois情報とDNSレコードを調査します',
		icon: 'mdi:dns',
		category: 'ネットワーク・情報'
	},
	{
		nameJa: '画像形式変換',
		name: 'image-converter',
		description: '画像をPNG/JPEG/WebPに変換',
		icon: 'mdi:image-sync',
		category: '画像・メディア'
	},
	{
		nameJa: 'Base64⇄画像変換',
		name: 'base64-converter',
		description: '画像とBase64文字列を相互に変換します',
		icon: 'mdi:swap-vertical',
		category: '画像・メディア'
	},
	{
		nameJa: '動画圧縮',
		name: 'video-compressor',
		description: '動画ファイルのサイズを圧縮してファイルサイズを削減します',
		icon: 'mdi:video-box',
		category: '画像・メディア'
	},
	{
		nameJa: 'X プロフィール QR',
		name: 'x-qrcode-generator',
		description: 'X（旧Twitter）プロフィール用のQRコードを生成します',
		icon: 'mdi:twitter',
		category: 'QRコード'
	},
	{
		nameJa: 'QRコードジェネレーター',
		name: 'qrcode-generator',
		description: 'テキストからQRコードを生成します',
		icon: 'mdi:qrcode',
		category: 'QRコード'
	},
	{
		nameJa: 'Markdown → Notion',
		name: 'markdown-to-notion',
		description: 'MarkdownをNotion形式に変換します',
		icon: 'mdi:swap-horizontal',
		category: 'データ変換'
	},
	{
		nameJa: 'CSV/Excel → LaTeX表',
		name: 'csv-to-latex',
		description: 'CSV/ExcelデータをLaTeX表形式に変換します',
		icon: 'mdi:table-arrow-right',
		category: 'データ変換'
	}
];

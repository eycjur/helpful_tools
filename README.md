# 困った時のツール集

SvelteKit + TypeScript + Tailwind CSSで構築された便利ツール集のWebアプリケーションです。

## 機能

### HTML/リッチテキスト → Markdown変換 (`/tools/html-to-markdown`)
- HTMLコードやWebページからコピーしたリッチテキストをMarkdown形式に変換
- クリップボードからの自動判定機能（HTML/リッチテキスト/プレーンテキスト）
- 「クリップボードから読み取り」ボタンと手動貼り付けの両方に対応
- Turndownライブラリによる高精度変換

### リッチテキストエディター → Markdown変換 (`/tools/richtext-to-markdown`)
- Quillエディターでリッチテキストを編集してMarkdown形式に変換
- リアルタイム変換機能
- 見出し、太字、斜体、リスト、リンク、コードブロックなどに対応
- カスタムTurndownルール適用

### QRコード生成 (`/tools/qrcode-generator`)
- テキストからQRコード生成
- ロゴオーバーレイ機能（オプション）
- ローディング表示とエラーハンドリング
- ロゴ画像の削除機能

### XプロフィールQRコード (`/tools/x-qrcode-generator`)
- X（旧Twitter）プロフィール専用QRコード
- Xアイコンのオーバーレイ機能（ON/OFF切り替え可能）
- ユーザー名の自動フォーマット（@マーク自動処理）

### 文字数カウンター (`/tools/character-counter`)
- リアルタイム文字数計測

## 開発

### 依存関係のインストール

```bash
npm install
```

### 開発サーバー起動

```bash
npm run dev

# ブラウザで自動的に開く場合
npm run dev -- --open
```

### その他のコマンド

```bash
# プロダクションビルド
npm run build

# プロダクションビルドのプレビュー
npm run preview

# TypeScript型チェック
npm run check

# 型チェック（監視モード）
npm run check:watch

# コードフォーマット
npm run format

# リンターチェック（Prettier + ESLint）
npm run lint
```

## 技術スタック

- **フレームワーク**: SvelteKit（Svelte 5）
- **言語**: TypeScript
- **スタイリング**: Tailwind CSS v4 + カスタムCSS
- **ビルドツール**: Vite
- **リンター**: ESLint + Prettier
- **フォント**: @fontsource (Noto Sans JP, Noto Serif JP, Fira Mono)
- **外部ライブラリ**: Quill（リッチテキストエディター）, Turndown（HTML→Markdown変換）
- **デプロイ**: 静的サイトジェネレーション（@sveltejs/adapter-static）

## アーキテクチャ

### ツール管理システム
- `src/lib/data/tools.ts` - 全ツールの中央定義
- ホームページで動的にツール一覧を表示
- ファイルベースルーティング（`src/routes/tools/[tool-name]/+page.svelte`）

### 新しいツールの追加方法

1. `src/lib/data/tools.ts`にツール情報を追加:
   ```typescript
   {
     nameJa: 'ツール名',
     name: 'tool-slug',
     description: '機能説明',
     icon: '📱'
   }
   ```

2. `src/routes/tools/[tool-slug]/+page.svelte`でツールページを作成

## 主な技術的特徴

- **Clipboard API活用**: `navigator.clipboard.read()`でHTMLとプレーンテキストを自動判定
- **ローディング状態管理**: 外部API呼び出し時の適切なUXフィードバック
- **レスポンシブデザイン**: 日本語UIに最適化されたモバイル対応
- **静的サイト生成**: GitHub Pages等での高速ホスティング対応

## デプロイメント

- ビルド出力: `build/` ディレクトリ
- 静的ホスティング対応（GitHub Pages、Netlify、Vercel等）
- SEO最適化済み（適切なメタタグ、セマンティックHTML）
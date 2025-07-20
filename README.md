# 困った時のツール集

SvelteKit + TypeScript + Tailwind CSSで構築された便利ツール集のWebアプリケーションです。

## 機能

### QRコードジェネレーター (`/tools/qr`)
- テキストからQRコード生成
- ロゴオーバーレイ機能（オプション）
- ローディング表示とエラーハンドリング
- ロゴ画像の削除機能

### XプロフィールQRジェネレーター (`/tools/x-qr`)
- X（旧Twitter）プロフィール専用QRコード
- Xアイコンのオーバーレイ機能（ON/OFF切り替え可能）
- ユーザー名の自動フォーマット（@マーク自動処理）

### 文字数カウンタ (`/tools/count`)
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
- **デプロイ**: 静的サイトジェネレーション（@sveltejs/adapter-static）

## アーキテクチャ

### ディレクトリ構造
- `src/routes/` - SvelteKitのファイルベースルーティング
  - `+page.svelte` - ホームページ（ツール一覧表示）
  - `+layout.svelte` - 共通レイアウト（ヘッダー・フッター）
  - `tools/[tool]/+page.svelte` - 各ツールページ
- `src/lib/` - 共有コンポーネントとデータ
  - `data/tools.ts` - ツール定義（名前、パス、説明）
  - `components/` - Svelteコンポーネント
- `src/app.css` - グローバルスタイル（Tailwind CSS + カスタムCSSプロパティ）

### 新しいツールの追加方法

1. `src/lib/data/tools.ts`にツール情報を追加
2. `src/routes/tools/[tool-name]/+page.svelte`でツールページを作成
3. 必要に応じて`src/lib/components/`に再利用可能なコンポーネントを作成

## デプロイメント

- ビルド出力: `build/` ディレクトリ
- 静的ホスティング対応（GitHub Pages、Netlify、Vercel等）
- SEO最適化済み（適切なメタタグ、セマンティックHTML）

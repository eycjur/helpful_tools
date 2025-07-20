# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

「困った時のツール集」は、SvelteKit + TypeScript + Tailwind CSSで構築された便利ツール集のWebアプリケーションです。現在QRコードジェネレーターと文字数カウンタの機能を提供しています。

## 開発コマンド

```bash
# 開発サーバー起動
npm run dev

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

### スタイリング

- Tailwind CSS v4を使用
- カスタムCSSプロパティで色・フォント定義（`src/app.css`の`:root`）
- Interフォント（本文）、Source Serif Pro（見出し）、Fira Mono（等幅）を使用
- 日本語UIに最適化されたレスポンシブデザイン

### 技術スタック

- **フレームワーク**: SvelteKit（Svelte 5）
- **言語**: TypeScript
- **スタイリング**: Tailwind CSS v4 + カスタムCSS
- **ビルドツール**: Vite
- **リンター**: ESLint + Prettier
- **フォント**: @fontsource (Inter, Source Serif Pro, Fira Mono)
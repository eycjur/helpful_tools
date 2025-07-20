# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

「困った時のツール集」は、SvelteKit + TypeScript + Tailwind CSSで構築された便利ツール集のWebアプリケーションです。QRコード生成、リッチテキスト→Markdown変換、文字数カウンターなどの実用的なツールを提供しています。

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

### ツール管理システム
- `src/lib/data/tools.ts` - 全ツールの定義ファイル（名前、パス、説明、アイコン）
- ホームページ（`src/routes/+page.svelte`）でtools配列から動的にツール一覧を表示
- 各ツールは`src/routes/tools/[tool-name]/+page.svelte`の形式でファイルベースルーティング

### 共通レイアウト
- `src/routes/+layout.svelte` - ヘッダー・フッターの共通レイアウト
- ヘッダーにはタイトルリンク（ホームに戻る）とGitHubリンクを配置
- レスポンシブデザインでモバイル対応

### 新しいツールの追加方法

1. `src/lib/data/tools.ts`にツール情報を追加:
   ```typescript
   {
     name: 'ツール名',
     path: '/tools/tool-slug',
     description: '説明文',
     icon: '📱'
   }
   ```

2. `src/routes/tools/[tool-slug]/+page.svelte`でツールページを作成:
   ```svelte
   <script lang="ts">
     import { tools } from '$lib/data/tools';
     const tool = tools.find(t => t.path === '/tools/tool-slug');
   </script>
   
   <div class="max-w-2xl mx-auto">
     <div class="flex items-center mb-6">
       <span class="text-4xl mr-4">{tool?.icon}</span>
       <h1 class="text-3xl font-bold">{tool?.name}</h1>
     </div>
     <!-- ツールの実装 -->
   </div>
   ```

### スタイリング規約

- Tailwind CSS v4使用
- 日本語フォント: Noto Sans JP（本文）、Noto Serif JP（見出し）、Fira Mono（等幅）
- `max-w-*xl mx-auto`でコンテンツ幅制限
- `text-4xl mr-4`でアイコン、`text-3xl font-bold`でタイトルの統一スタイル

### 現在利用可能なツール

1. **QRコード生成** (`/tools/qrcode-generator`)
   - テキストからQRコード生成、ロゴオーバーレイ機能
   - ローディング状態とエラーハンドリング実装済み

2. **XプロフィールQR** (`/tools/x-qrcode-generator`)
   - X（旧Twitter）プロフィール専用QRコード
   - Xアイコンオーバーレイ機能、ユーザー名自動フォーマット

3. **HTML → Markdown** (`/tools/html-to-markdown`)
   - HTMLコードやリッチテキストをMarkdown変換
   - Turndownライブラリで高精度変換

4. **リッチテキストエディター → Markdown** (`/tools/richtext-to-markdown`)
   - Quillエディターでリッチテキスト編集後Markdown変換
   - リアルタイム変換、カスタムTurndownルール適用

5. **文字数カウンター** (`/tools/character-counter`)
   - リアルタイム文字数計測

### 外部ライブラリ

- **Quill**: リッチテキストエディター（richtext-to-markdownで使用）
- **Turndown**: HTML→Markdown変換（両Markdownツールで使用）
- **QRServer API**: QRコード生成サービス（https://api.qrserver.com/）

### 技術的な注意点

- **canvasRef問題**: QRツールでcanvas要素のbindが失われないよう、条件付き表示でもcanvas要素は常にDOMに存在させる
- **ローディング状態**: 画像読み込み時は`isLoading`状態でスピナー表示
- **Clipboard API**: モダンブラウザのClipboard APIを使用、フォールバック対応済み
- **静的サイト生成**: @sveltejs/adapter-staticでGitHub Pages等にデプロイ可能
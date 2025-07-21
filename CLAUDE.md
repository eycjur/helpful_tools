# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

「困った時のツール集」は、SvelteKit + TypeScript + Tailwind CSSで構築された便利ツール集のWebアプリケーションです。HTML/Markdown変換、QRコード生成、文字数カウンターなどの実用的なツールを提供しています。

**主な特徴:**

- レスポンシブデザインのサイドバーナビゲーション
- 自動コピー機能搭載（HTML→Markdown、RichText→Markdownツール）
- Iconifyアイコンシステム採用
- モダンなUI/UXデザイン

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

中央集権型のツール管理システムを採用：

- `src/lib/data/tools.ts` - 全ツールの定義配列
- ホームページ（`src/routes/+page.svelte`）が`tools`配列をmapして動的にツール一覧を表示
- 各ツールは`src/routes/tools/[tool-name]/+page.svelte`のファイルベースルーティング
- ツール定義形式： `{ nameJa: '表示名', name: 'url-slug', description: '説明', icon: 'mdi:icon-name' }`

### 新しいツールの追加手順

1. `src/lib/data/tools.ts`に新ツールを追加:

   ```typescript
   {
     nameJa: 'ツール名',
     name: 'tool-slug',
     description: '機能説明',
     icon: 'mdi:icon-name'
   }
   ```

2. `src/routes/tools/[tool-slug]/+page.svelte`を作成:

   ```svelte
   <script lang="ts">
   	import { tools } from '$lib/data/tools';
   	import Icon from '@iconify/svelte';
   	const tool = tools.find((t) => t.name === 'tool-slug');
   </script>

   <div class="mx-auto max-w-2xl">
   	<div class="mb-6 flex items-center">
   		{#if tool?.icon}<Icon icon={tool.icon} class="mr-4 h-10 w-10" />{/if}
   		<h1 class="text-3xl font-bold">{tool?.nameJa}</h1>
   	</div>
   	<!-- ツール実装 -->
   </div>
   ```

### 技術スタック

- **SvelteKit** (Svelte 5) + TypeScript
- **Tailwind CSS v4** + カスタム日本語フォント（Noto Sans/Serif JP, Fira Mono）
- **静的サイト生成** (@sveltejs/adapter-static)
- **アイコンシステム**: @iconify/svelte + Material Design Icons (MDI)
- **外部API**: QRServer API (https://api.qrserver.com/)
- **ライブラリ**: Quill（リッチテキストエディター）, Turndown（HTML→Markdown変換）

### 現在のツール

1. **HTML → Markdown** (`html-to-markdown`)
   - HTMLコード・リッチテキストの自動判定変換
   - Clipboard API活用（`navigator.clipboard.read()`でHTMLとプレーンテキスト両方取得）
   - **自動コピー機能**: 変換されたMarkdownを自動的にクリップボードにコピー
   - 手動貼り付けとボタンクリックの両方対応

2. **リッチテキストエディター → Markdown** (`richtext-to-markdown`)
   - Quillエディターでのリアルタイム編集・変換
   - カスタムTurndownルール適用（リスト、コードブロック、テーブル対応）
   - **自動コピー機能**: 変換されたMarkdownを自動的にクリップボードにコピー

3. **QRコード生成** (`qrcode-generator`)
   - ロゴオーバーレイ機能、ローディング状態管理
   - Canvas要素のbind問題対策（常にDOMに存在させる）

4. **X QRコード** (`x-qrcode-generator`)
   - X（Twitter）プロフィール専用、アイコンオーバーレイ

5. **文字数カウンター** (`character-counter`)
   - リアルタイム計測

### レスポンシブサイドバー

プロジェクトには高機能なレスポンシブサイドバーを実装：

- **デスクトップ**: 常時表示（固定位置）
- **モバイル**: ハンバーガーメニューでオーバーレイ表示
- **機能**: 全ツールのナビゲーション、現在ページハイライト、キーボード操作対応（ESC）
- **実装**: `src/lib/components/Sidebar.svelte` + `src/routes/+layout.svelte`

### 重要な技術的注意点

- **Canvas要素管理**: QRツールでcanvas要素のbindが失われないよう、条件付き表示でも要素は常にDOMに配置
- **Clipboard API**: モダンブラウザの`navigator.clipboard.read()`でHTMLとプレーンテキスト両方取得、HTMLタグ自動判定で適切な処理分岐
- **自動コピー機能**: 変換ツールで結果を自動的にクリップボードにコピー（エラーハンドリング付き）
- **ローディング状態**: 外部API呼び出し時の`isLoading`状態とスピナー表示パターン
- **アイコン管理**: @iconify/svelteで型安全なアイコン表示、条件付きレンダリングでundefined対策
- **統一UIパターン**: Iconifyアイコン + `text-3xl font-bold`（タイトル）+ `max-w-*xl mx-auto`（コンテンツ幅）

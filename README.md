# 困った時のツール集

SvelteKit + TypeScript + Tailwind CSSで構築された便利ツール集のWebアプリケーションです。

## 🚀 今すぐ使う

**👉 https://eycjur.github.io/helpful_tools/ 👈**

日常的によく使うオンラインツールを一箇所にまとめ、快適なユーザー体験を提供します。ブックマークして日々の作業効率アップにお役立てください！

**主な特徴:**

- 📱 レスポンシブサイドバーナビゲーション
- ⚡ 自動コピー機能搭載（変換ツール）
- 🎨 Iconifyアイコンシステム採用
- 🌟 モダンなUI/UXデザイン

## 機能

利用可能なツール一覧は **https://eycjur.github.io/helpful_tools/** で確認できます。

主要機能：

- 📝 **テキスト変換**: HTML/リッチテキスト → Markdown、CSV/Excel → LaTeX表
- 📱 **QRコード生成**: 汎用QR、XプロフィールQR（ロゴオーバーレイ対応）
- 📊 **ユーティリティ**: 文字数カウンター
- ⚡ **自動コピー**: 変換結果を自動的にクリップボードにコピー

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
- **アイコン**: @iconify/svelte + Material Design Icons (MDI)
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

### レスポンシブサイドバー

高機能なサイドバーナビゲーションを実装：

- **デスクトップ**: 常時表示（固定位置）
- **モバイル**: ハンバーガーメニューでオーバーレイ表示
- **機能**: 全ツールのナビゲーション、現在ページハイライト、キーボード操作対応（ESC）

### 新しいツールの追加方法

1. `src/lib/data/tools.ts`にツール情報を追加:

   ```typescript
   {
     nameJa: 'ツール名',
     name: 'tool-slug',
     description: '機能説明',
     icon: 'mdi:icon-name'
   }
   ```

2. `src/routes/tools/[tool-slug]/+page.svelte`でツールページを作成:

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

## 主な技術的特徴

- **自動コピー機能**: 変換ツールで結果を自動的にクリップボードにコピー（エラーハンドリング付き）
- **Clipboard API活用**: `navigator.clipboard.read()`でHTMLとプレーンテキストを自動判定
- **アイコン管理**: @iconify/svelteで型安全なアイコン表示、条件付きレンダリングでundefined対策
- **ローディング状態管理**: 外部API呼び出し時の適切なUXフィードバック
- **レスポンシブデザイン**: 日本語UIに最適化されたモバイル対応
- **静的サイト生成**: GitHub Pages等での高速ホスティング対応

## デプロイメント

- ビルド出力: `build/` ディレクトリ
- 静的ホスティング対応（GitHub Pages、Netlify、Vercel等）
- SEO最適化済み（適切なメタタグ、セマンティックHTML）

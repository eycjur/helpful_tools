# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

「困った時のツール集」は、日常的に使える便利ツール集のWebアプリケーションです。

### 提供ツール（7カテゴリ、20ツール）

- **生成AI**: HTML/リッチテキスト → Markdown変換（AI活用）
- **文字・テキスト処理**: 正規表現テスター、文字数カウンタ、HTML/URLエンコーダ
- **データ変換**: JSON構造化表示、Base64変換、Notion/LaTeX変換
- **画像・メディア**: 画像形式変換、動画圧縮
- **QRコード**: 汎用QR、XプロフィールQR
- **開発・比較ツール**: コード整形、Diffチェッカー、curlビルダー、クリップボード検査、Pythonコード解析
- **ネットワーク・情報**: 接続元情報、Whois/ドメイン調査

### 主な特徴

- レスポンシブデザインのサイドバーナビゲーション
- カテゴリ別ツール分類表示（ホーム画面・サイドバー）
- 自動コピー機能搭載（変換ツール）
- 統一されたアイコンシステム
- モダンなUI/UXデザイン

## 技術スタック

### フロントエンド

- **SvelteKit** (Svelte 5) + TypeScript
- **Tailwind CSS v4** + カスタム日本語フォント（Noto Sans/Serif JP, Fira Mono）
- **静的サイト生成** (@sveltejs/adapter-static)

### 外部サービス・ライブラリ

- **アイコンシステム**: @iconify/svelte + Material Design Icons (MDI)
- **外部API**: QRServer API (https://api.qrserver.com/)
- **エディター**: Quill（リッチテキストエディター）
- **変換処理**: Turndown（HTML→Markdown変換）

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

## 代表的なフォルダ構成

```
helpful_tools/
├── static/                         # 静的ファイル
│   ├── favicon.svg
│   └── robots.txt
├── src/
│   ├── app.css                     # グローバルCSS
│   ├── app.d.ts                    # TypeScript型定義
│   ├── app.html                    # HTMLテンプレート
│   ├── lib/                        # 共通ライブラリ
│   │   ├── components/             # 再利用可能コンポーネント
│   │   │   └── Sidebar.svelte      # サイドバーナビゲーション
│   │   └── data/                   # データ定義
│   │       └── tools.ts           # ツール一覧定義
│   └── routes/                     # ページルーティング
│       ├── +layout.svelte         # 全体レイアウト
│       ├── +layout.ts             # レイアウト設定
│       ├── +page.svelte           # ホームページ
│       ├── +page.ts              # ホームページ設定
│       └── tools/                 # ツールページ
├── README.md
└── CLAUDE.md
```

## アーキテクチャ

### ツール管理システム

中央集権型のツール管理システムを採用：

- `src/lib/data/tools.ts` - 全ツールの定義配列
- ホームページ（`src/routes/+page.svelte`）が`tools`配列をmapして動的にツール一覧を表示
- 各ツールは`src/routes/tools/[tool-name]/+page.svelte`のファイルベースルーティング
- ツール定義形式： `{ nameJa: '表示名', name: 'url-slug', description: '説明', icon: 'mdi:icon-name', category: 'カテゴリ名' }`

### 新しいツールの追加手順

1. `src/lib/data/tools.ts`に新ツールを追加（**カテゴリ順序に沿って配置**）:

   **カテゴリ順序**:
   1. 生成AI
   2. 文字・テキスト処理
   3. データ変換
   4. 画像・メディア
   5. QRコード
   6. 開発・比較ツール
   7. ネットワーク・情報

   ```typescript
   {
     nameJa: 'ツール名',
     name: 'tool-slug',
     description: '機能説明',
     icon: 'mdi:icon-name',
     category: 'カテゴリ名'
   }
   ```

2. `src/routes/tools/[tool-slug]/+page.svelte`を作成:

3. **重要**: 新機能追加後は以下を更新:
   - `README.md` - 主要機能セクションのカテゴリ説明を更新（個別ツール記載不要）
   - `CLAUDE.md` - 技術的注意点セクションに新ツール固有の注意点のみ追加

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

### ツール一覧と技術的注意点

**基本情報**: 全ツールは`src/lib/data/tools.ts`で管理、ファイルベースルーティング採用

**共通機能**:

- 自動コピー機能（変換ツール）
- Iconifyアイコンシステム
- レスポンシブデザイン

**技術的注意点**:

- **Canvas要素管理**: QRツールでcanvas要素のbindが失われないよう、条件付き表示でも要素は常にDOMに配置
- **Clipboard API**: モダンブラウザの`navigator.clipboard.read()`でHTMLとプレーンテキスト両方取得、HTMLタグ自動判定で適切な処理分岐
- **自動コピー機能**: 変換ツールで結果を自動的にクリップボードにコピー（エラーハンドリング付き）
- **ローディング状態**: 外部API呼び出し時の`isLoading`状態とスピナー表示パターン
- **LaTeX特殊文字エスケープ**: CSV→LaTeXツールで特殊文字（$, &, %, #, ^, \_, {, }, \, ~）を適切にエスケープ

### レスポンシブサイドバー

プロジェクトには高機能なレスポンシブサイドバーを実装：

- **デスクトップ**: 常時表示（固定位置）
- **モバイル**: ハンバーガーメニューでオーバーレイ表示
- **機能**: カテゴリ別ツール表示、現在ページハイライト、キーボード操作対応（ESC）
- **表示形式**: カテゴリアイコン付きの階層構造
- **実装**: `src/lib/components/Sidebar.svelte` + `src/routes/+layout.svelte`

### 重要な技術的注意点

- **Canvas要素管理**: QRツールでcanvas要素のbindが失われないよう、条件付き表示でも要素は常にDOMに配置
- **Clipboard API**: モダンブラウザの`navigator.clipboard.read()`でHTMLとプレーンテキスト両方取得、HTMLタグ自動判定で適切な処理分岐
- **自動コピー機能**: 変換ツールで結果を自動的にクリップボードにコピー（エラーハンドリング付き）
- **ローディング状態**: 外部API呼び出し時の`isLoading`状態とスピナー表示パターン
- **アイコン管理**: @iconify/svelteで型安全なアイコン表示、条件付きレンダリングでundefined対策
- **統一UIパターン**: Iconifyアイコン + `text-3xl font-bold`（タイトル）+ `max-w-*xl mx-auto`（コンテンツ幅）
- **カテゴリ表示システム**: ホーム画面とサイドバーでカテゴリ別ツール分類、検索時は全ツール横断表示に自動切り替え

#### 正規表現テスター（新規）

- **正規表現エンジン**: ブラウザのJavaScript RegExpを使用（`u`フラグ既定ON）。
- **ゼロ幅一致対策**: `g`フラグ時、`m[0].length === 0` の場合に `lastIndex++` で無限ループ回避。
- **ハイライト**: 一致範囲のみ `<mark>` で着色。オーバーラップは未対応（先着順）。

#### 画像形式変換（新規ツール）

- **透過の扱い**: JPEG出力時は背景色で合成（ユーザー指定可）。
- **MVP形式**: PNG/JPEG/WebPに対応。
- **リソース解放**: `URL.createObjectURL`で作成したURLは使用後に`URL.revokeObjectURL`で解放。
- **バッチ処理**: 大量画像はUIブロック回避のため、段階的にWeb Worker + OffscreenCanvas導入を検討。

#### Pythonコード解析（新規ツール）

- **Pyodide使用**: ブラウザ上でPythonを実行できるPyodide (v0.25.0) をCDN経由で動的読み込み。
- **インジェクション対策**: ユーザーコードは`pyodide.globals.set()`で安全に渡す（`JSON.stringify()`によるインジェクションリスク回避）。
- **メモリリーク対策**: onMountで追加したスクリプトタグをクリーンアップ関数で削除。
- **型定義**: PyodideInterfaceインターフェースで`any`型を最小限に抑制。
- **エラーハンドリング**: `instanceof Error`で型安全なエラーメッセージ表示。
- **表示機能**: AST（抽象構文木）とBytecode（dis.Bytecode）の2つの視点でPythonコード解析、実行出力も確認可能。

#### ハッシュ値計算（新規ツール）

- **crypto-js使用**: MD5計算にcrypto-jsを使用（Web Crypto APIでMD5は未サポート）。Uint8Array経由でWordArrayに変換。
- **Web Crypto API**: SHA系のハッシュ計算に使用。HTTPS環境でのみ利用可能なため、利用可能性チェック実施。
- **ファイルサイズ制限**: 100MBまで。大きすぎるファイルはメモリ不足でブラウザクラッシュを防ぐため拒否。
- **デバウンス処理**: テキスト入力モードで300msのデバウンス処理により、パフォーマンス改善。
- **リアクティビティ**: Svelte 5の`$state`を使用して、オブジェクトのプロパティ変更を適切に検知。

#### Hexダンプ（新規ツール）

- **メモリ効率**: `file.slice()`で必要な部分のみ読み込み、大きなファイルでもメモリ効率良く処理。
- **表示制限**: デフォルト1MB、最大10MBまで表示。大量データでのDOM更新パフォーマンス考慮。
- **xxd形式**: オフセット（8桁16進数）、16進数表示（2バイトごとにスペース）、ASCII表示（印字可能文字のみ）の標準xxdコマンド形式。

## 開発時の注意点

### 開発の進め方

新機能追加や大きな変更を行う際は、以下の手順に従ってください：

- **計画を立てる**: 新機能追加前に、どのような実装が必要かを明確にする
- **ドキュメント化する**: 必要に応じて実装計画や設計をドキュメント化します
- **タスクを分割する**: 実装が必要な機能を小さなタスクに分割し、1つずつ実装する
- **計画の見直し**: 実装中は、各タスクが完了したら、毎回計画を見直す
- **難易度の高いタスク**: 難易度が高いタスクの場合は、`codex exec <prompt>`を使用して、codexと対話を行いながら実装を進める

### コードスタイルと品質

コードの品質を保つため、以下のガイドラインに従ってください

- **テストを書く**: 新機能追加時はユニットテストを作成する
- **実装前に大まかな設計を行う**: どのように実装するかを事前に考え、大まかなドメインモデルを作成する

### コードレビューとコミット

コードの生成が完了したら、必ず以下の手順でコードレビューとコミットを行ってください。

1. **コードレビュー**: CLAUDEの`code-reviewer`エージェントを使用して、生成されたコードの品質とセキュリティを確認します。この手順は、レビューの指摘がなくなるまで繰り返します。
2. **セキュリティチェック**: 生成されたコードにセキュリティ上の問題がありうる場合は、`/security-review`コマンドを使用して、セキュリティの脆弱性を確認します。セキュリティ上の問題が検出された場合は、修正を行います。
3. **ドキュメントの更新**: 生成されたコードに関連するドキュメント（README.mdやCLAUDE.mdなど）を必要に応じて更新します。特に、新しいツールを追加した場合は、`src/lib/data/tools.ts`の更新と合わせて、ドキュメントも更新してください。
4. **コミット**: レビューが完了したら、変更をGitにコミットします。git管理されていないリポジトリの場合は不要です。huskyを用いて、エラーが検出された場合は修正を行います。

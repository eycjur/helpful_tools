# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

「困った時のツール集」は、日常的に使える便利ツール集のWebアプリケーションです。

### 提供ツール（7カテゴリ、28ツール）

- **生成AI**: HTML/リッチテキスト → Markdown変換（AI活用）
- **文字・テキスト処理**: 正規表現テスター、文字数カウンタ、HTML/URLエンコーダ
- **データ変換**: JSON構造化表示、Base64変換、Notion/LaTeX変換
- **画像・メディア**: 画像形式変換、画像メタデータ表示、PDFメタデータ・セキュリティ情報、動画圧縮、動画→音声変換
- **QRコード**: 汎用QR、XプロフィールQR
- **開発・比較ツール**: コード整形、Diffチェッカー、curlビルダー、クリップボード検査、Pythonコード解析
- **ネットワーク・情報**: 接続元情報、Whois/ドメイン調査、Pcap解析

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

### コンポーネント分割とコードの整理

**コード配置の原則**:

1. **Colocation（関連コードを近くに配置）**: ツール専用のコードは `src/routes/tools/<tool-name>/` 内に配置
2. **分割の基準**:
   - `+page.svelte` が **800行以上** の場合は分割を検討
   - **1000行以上** の場合は分割を強く推奨
   - 重複コードがある場合は即座にコンポーネント化

**推奨ファイル構成**:

```
src/routes/tools/<tool-name>/
├── +page.svelte              # メインUI（なるべく簡潔に）
├── <ComponentName>.svelte    # UIコンポーネント（再利用可能な部品）
├── <module-name>.ts          # ビジネスロジック・パーサー・ユーティリティ
└── types.ts                  # 型定義（必要に応じて）
```

**分割例（Pcap解析ツール）**:

```
src/routes/tools/pcap-analyzer/
├── +page.svelte              # メインUI（1348行 → 分割推奨）
├── PacketFilterPanel.svelte  # フィルターUI
├── PacketDetailView.svelte   # パケット詳細表示
├── pcap-parser.ts            # Pcapファイル解析ロジック
└── (将来的に)
    └── pcap-parser.test.ts   # ユニットテスト
```

**分割の利点**:

- ✅ 可読性向上（1ファイル500行以下が理想）
- ✅ 保守性向上（関心の分離）
- ✅ テストしやすい（ロジックとUIの分離）
- ✅ 再利用しやすい（コンポーネント化）
- ✅ ツールごと削除・移動が容易

**`src/lib/` と `tools/<name>/` の使い分け**:

- **`src/lib/`**: 複数のツールで共有するコード（例: `tools.ts`）
- **`src/lib/components/`**: **全画面で共通のコンポーネントのみ**（例: `Sidebar.svelte`）
  - ⚠️ **重要**: 特定のツールでのみ使用するコンポーネントは `src/lib/components/` に置かないこと
  - 1つのツールでしか使わないコンポーネントは、そのツールのディレクトリに配置
- **`tools/<name>/`**: そのツール専用のコード（例: pcap-parser.ts, PacketFilterPanel.svelte, JsonViewer.svelte）
  - 将来的に他のツールでも使う可能性がある場合のみ `src/lib/` に移動

**大規模ツールのリファクタリング優先度**:

| ツール             | 行数 | 関数数 | 状態    | 推奨アクション                                                                              |
| ------------------ | ---- | ------ | ------- | ------------------------------------------------------------------------------------------- |
| **pdf-metadata**   | 1683 | 26     | ✅ 完了 | `types.ts`, `pdf-parser.ts`, `findings.ts`に分割済み（+page.svelte: 1683行→752行、55%削減） |
| **whois-lookup**   | 1341 | 15     | ✅ 完了 | `types.ts`, `whois-parser.ts`に分割済み（+page.svelte: 1341行→739行、45%削減）              |
| **pcap-analyzer**  | 1230 | -      | ✅ 完了 | `PacketFilterPanel.svelte`, `PacketDetailView.svelte`, `pcap-parser.ts`に分割済み           |
| **string-decoder** | 984  | 23     | ✅ 完了 | `types.ts`, `decoders.ts`, `auto-detect.ts`に分割済み（+page.svelte: 984行→475行、52%削減） |
| **ctf-cipher**     | 900  | 17     | ✅ 完了 | `types.ts`, `scoring.ts`, `cipher-tools.ts`に分割済み（+page.svelte: 900行→356行、60%削減） |
| **json-formatter** | -    | -      | ✅ 完了 | `JsonViewer.svelte`をツール内に配置済み                                                     |

**現在のコンポーネント分割状況**:

- ✅ **適切に管理されているツール**: json-formatter, pcap-analyzer, ctf-cipher, pdf-metadata, whois-lookup, string-decoder
- ❌ **分割が必要なツール**: なし（800行以上のツールはすべて分割完了）
- ℹ️ **800行未満で分割不要**: video-compressor (735行), diff-checker (671行), video-to-audio (654行), curl-builder (618行)

**ツール別分割推奨プラン**:

**pdf-metadata** ✅ 完了（1683行→752行、55%削減）:

```
src/routes/tools/pdf-metadata/
├── +page.svelte              # メインUI（752行、ファイルアップロード、結果表示）
├── types.ts                  # 型定義（112行、PDFReport, Finding等）
├── pdf-parser.ts             # PDF解析ロジック（849行、parsePDFNonRender等）
└── findings.ts               # Findings生成・分析ロジック（50行）
```

**whois-lookup** ✅ 完了（1341行→739行、45%削減）:

```
src/routes/tools/whois-lookup/
├── +page.svelte              # メインUI（739行、検索UI、結果表示）
├── types.ts                  # 型定義（59行、DNSRecord, IPGeoInfo等）
└── whois-parser.ts           # Whois解析ロジック（456行、performSearch等）
```

**string-decoder** ✅ 完了（984行→475行、52%削減）:

```
src/routes/tools/string-decoder/
├── +page.svelte              # メインUI（475行、デコードUI、結果表示）
├── types.ts                  # 型定義（34行、EncodingFormat, DecodeResult等）
├── decoders.ts               # 18種類のデコーダー関数（229行）
└── auto-detect.ts            # エンコード自動検出ロジック（289行）
```

**ctf-cipher** ✅ 完了（900行→356行、60%削減）:

```
src/routes/tools/ctf-cipher/
├── +page.svelte              # メインUI（356行）
├── types.ts                  # 型定義（DecryptResult, DecryptGroup）
├── cipher-tools.ts           # 暗号解読関数（Caesar, XOR, Rail Fence等、260行）
└── scoring.ts                # 信頼度評価システム（336行）
```

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

#### CTF暗号解読（新規ツール）

- **Brute forceアプローチ**: Caesar cipher（26パターン）、XOR single-byte（255パターン）など、全パターンを試行して信頼度順にソート
- **信頼度評価システム**: 印字可能文字の割合（30点）、英単語の出現（30点）、文字頻度分析（40点）で平文らしさを0-100で評価
- **XOR brute force**: `TextDecoder`の`fatal: true`オプションでUTF-8デコード失敗時に例外をスロー、印字可能文字（0x20-0x7E）のみをフィルタリング
- **Rail Fence cipher**: レール数2-5のパターンを試行。ジグザグパターンの復号化には、まず各レールに文字を配置し、その後ジグザグ順に読み取る2段階処理
- **Base64多段デコード**: 最大10回までBase64デコードを繰り返し、各段階の結果を保存。無限ループ防止のため、デコード結果が元と同じ場合は中断
- **文字頻度分析**: 英語の文字頻度（ETAOIN...）と比較して上位5文字の一致度を計算。英単語（the, be, to...）の出現も評価
- **パフォーマンス**: XOR brute forceで255パターン、Caesar cipherで26パターンを試行するため、入力サイズは1MBに制限

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
- **アクセシビリティ**: マウスイベントハンドラを持つ`<span>`要素に`role="button"`と`tabindex="0"`を追加して支援技術対応。

#### エンコード文字列デコーダ（新規ツール）

- **対応形式**: 20種類以上のエンコード形式をサポート（URL、HTML Entity、Base64、Unicode、16進数、8進数、Punycode、ROT13、Morse Code等）
- **自動検出機能**: 正規表現パターンマッチングで入力からエンコード形式を自動推定、信頼度スコア付きで複数候補を提示
- **入力サイズ制限**: DoS攻撃対策として10MBの入力サイズ制限を実施、超過時はエラーメッセージを表示
- **非推奨API回避**: `String.prototype.substr()`を`substring()`に置き換え、将来のブラウザ互換性を確保
- **エラーハンドリング**: `instanceof Error`による型安全なエラー処理、各デコード関数で適切な例外スロー
- **パフォーマンス**: `replaceAll()`を使用してRegExpオブジェクト生成を回避、HTMLエンティティデコードを高速化

#### 動画→音声変換（新規ツール）

- **FFmpeg.wasm使用**: WebAssembly版FFmpeg（@ffmpeg/ffmpeg）を使用。ブラウザ上で動画から音声を抽出。
- **CDN経由の動的読み込み**: FFmpegコア（ffmpeg-core.js, ffmpeg-core.wasm）はunpkg CDNから読み込み。初回ロードに時間がかかる。
- **対応出力形式**: MP3, AAC (M4A), WAV, OGG Vorbis, FLAC。形式ごとに適切なコーデックを使用。
- **コマンドインジェクション対策**: ビットレート・サンプルレート・出力形式をホワイトリストで検証してから使用。
- **ファイルサイズ警告**: 500MB以上のファイルは警告を表示（制限はなし）。大きなファイルはメモリ不足の可能性をユーザーに通知。
- **仮想ファイルシステムのクリーンアップ**: `ffmpeg.writeFile()`で書き込んだファイルは変換後に`ffmpeg.deleteFile()`で削除。
- **型安全性**: `@ffmpeg/ffmpeg`から`FFmpegType`をインポートして型安全に使用。`readFile`の戻り値は`Uint8Array`であることを検証。

#### 画像メタデータ表示（新規ツール）

- **exifr使用**: EXIF/GPS/IPTC/XMPメタデータの抽出に`exifr`ライブラリ（v7.1.3以降）を使用。`translateKeys: true`で数値キーを人間が読める名前に変換。
- **ファイルサイズ警告**: 50MB以上のファイルは警告を表示。大きな画像ファイルでのメモリ不足を防ぐ。
- **GPS警告**: GPS位置情報が含まれる場合、プライバシーリスクについて赤色の強調警告を表示。SNS投稿前のユーザー注意喚起。
- **複数警告の同時表示**: 警告を配列で管理（`warnings: Array<{ message: string; type: 'warning' | 'error' }>`）し、ファイルサイズとGPS警告を同時に表示可能。
- **バイナリデータフィルタリング**: `isBinaryData()`関数で複数の型付き配列（Uint8Array、ArrayBuffer、Int8Array等）を検出し、メタデータ表示から除外。
- **Svelteリアクティビティ**: 配列への追加は`push()`ではなくスプレッド演算子（`[...array, newItem]`）を使用してリアクティビティを確保。
- **型安全性**: `unknown`型を使用してメタデータの型安全性を確保。`formatValue()`関数で適切な型判定と文字列変換を実施。

#### PDFメタデータ・セキュリティ情報（改善版）

- **pdfjs-dist使用**: Mozilla開発の`pdfjs-dist`ライブラリ（v4.0.379以降）でPDF解析。WebWorkerを使用して非同期処理を実現。
- **見た目と無関係な要素にフォーカス**: レンダリング結果に影響しない要素（メタデータ、埋め込みファイル、アクティブ要素、セキュリティ、フォーム）を抽出。
- **包括的な解析**: `/Info`辞書、XMPメタデータ、ドキュメントID、埋め込みファイル（`/Names/EmbeddedFiles`）、OpenAction、Additional Actions、JavaScript、外部参照（URI/Launch/GoToR）、フォーム情報（AcroForm/XFA）、セキュリティ情報（暗号化/署名/権限）を網羅的に抽出。
- **Finding機能**: ルールベースで検出結果を重要度（high/medium/low）付きで分類。OpenActionのJavaScript/Launch、実行可能ファイルの埋め込み、JavaScript検出などを自動検出。
- **SHA-256ハッシュ計算**: Web Crypto APIの`crypto.subtle.digest()`を使用して、JavaScriptコードや埋め込みファイルのハッシュ値を計算。同一性確認や追跡に有用。
- **非同期処理**: `parsePDFNonRender()`は`async`関数で、pdfjs-distの非同期API（`getDocument()`, `getMetadata()`, `getAttachments()`など）を適切に処理。
- **型安全性**: `PDFReport`インターフェースで構造化されたレポート形式を定義。`Finding`型で検出結果の重要度とコードを管理。
- **後方互換性**: 既存の`parsePDF()`関数と`PDFInfo`型を維持し、レガシーコードとの互換性を確保。
- **ファイルサイズ警告**: 100MB以上のファイルは警告を表示。大きなPDFファイルでのメモリ不足を防ぐ。
- **型アサーション**: pdf.jsの内部プロパティ（`_pdfInfo`、`openAction`、`additionalActions`など）へのアクセスには型アサーション（`as unknown as`）を使用。
- **CDN経由Worker**: pdf.jsのWebWorkerはunpkg CDNから動的読み込み（`pdf.worker.min.mjs`）。バージョンは`pdfjsLib.version`で自動取得。

#### Pcap解析（新規ツール）

- **自作バイナリパーサー**: pcap/pcapngファイルのバイナリ解析を`DataView`で実装。マジックナンバー（0xa1b2c3d4）でエンディアン判定し、ビッグ/リトルエンディアン両対応。
- **階層的プロトコル解析**: Ethernet（14バイト）→ IPv4（可変長）→ TCP/UDP（可変長）と段階的にヘッダーをデコード。各層で必要なバイト数を検証して不完全パケットでもクラッシュしない設計。
- **統計情報の効率的集計**: パケット配列を1回走査でプロトコル分布・IPアドレス分布・ポート分布をすべて計算。`Record<string|number, number>`型でカウント集計。
- **パケットビューア機能**: タブ切り替えで統計表示とパケット一覧を切り替え。プロトコル・IP・ポート・ペイロード検索の柔軟なフィルタリング。
- **インタラクティブ詳細表示**: パケットクリックでEthernet→IPv4→TCP/UDPの階層構造を展開表示。TCPフラグ（SYN/ACK/FIN等）を人間が読める形式で表示。
- **16進ダンプ最適化**: 最大512バイトまで表示してDOM描画負荷を軽減。`xxd`コマンドと同じフォーマット（オフセット8桁、16進数、ASCII）で表示。
- **パフォーマンス最適化**: パケット一覧は最大1000パケットまで表示制限。大きなpcapファイル（100MB以上）は警告表示。
- **正規表現フォールバック**: ペイロード検索で正規表現エラー時は自動的に文字列検索にフォールバック。
- **A11y対応**: フィルター入力欄の`label`に`for`/`id`属性を追加してアクセシビリティ確保。

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

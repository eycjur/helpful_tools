# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

「困った時のツール集」は、日常的に使える便利ツール集のWebアプリケーションです。

### 提供ツール（8カテゴリ、37ツール）

- **生成AI**: HTML/リッチテキスト → Markdown変換（AI活用）
- **文字・テキスト処理**: 正規表現テスター、文字数カウンタ、HTML/URLエンコーダ、エンコード文字列デコーダ、記号検索
- **データ変換**: 構造化データビューアー、Base64⇄画像変換、表の転置、Notion/LaTeX変換
- **画像・メディア**: 画像形式変換、画像メタデータ表示、PDFメタデータ・セキュリティ情報、動画圧縮、動画→音声変換、動画逆再生
- **PDF操作**: PDF編集（結合・分割・ページ操作）、PDF圧縮
- **QRコード**: 汎用QR、XプロフィールQR
- **開発・比較ツール**: コード整形、Diffチェッカー、curlビルダー、クリップボード検査、Pythonコード解析、ULIDタイムスタンプ抽出、Unixtime変換、JWTデコーダ
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

# テスト実行（watch モード）
npm test

# テスト実行（1回のみ、CI用）
npm run test:run

# テスト実行（UIモード）
npm run test:ui
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
- **ライブラリ**: Quill（リッチテキストエディター）, Turndown（HTML→Markdown変換）, pdf-lib（PDF操作）, fflate（PDF圧縮での圧縮レベル指定付きFlate）, harfbuzzjs（PDF圧縮でのフォントのサブセット化、`harfbuzz-subset.wasm`）

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

- **`src/lib/`**: サイト全体で使うコード（例: ツール一覧の定義、サイドバー）。ツールの変換・解析処理は置かない。
- **`src/lib/components/`**: **全画面で共通のコンポーネントのみ**（例: `Sidebar.svelte`）
  - ⚠️ **重要**: 特定のツールでのみ使用するコンポーネントは `src/lib/components/` に置かないこと
  - 1つのツールでしか使わないコンポーネントは、そのツールのディレクトリに配置
- **`tools/<name>/`**: そのツール専用のコード（例: pcap-parser.ts, PacketFilterPanel.svelte, JsonViewer.svelte）
- **`tools/_shared/`**: 複数ツールが実際に使う変換・解析処理とそのテスト。将来の共用を見込んだ移動はしない。

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

#### 表の転置（新規ツール）

- **入力形式**: クリップボードの `text/plain`（TSV/CSV）または `text/html`（`<table>`）。Excel・スプレッドシートのコピー想定
- **転置**: 行の長さが異なる表は空セルで正規化してから転置。出力は TSV（タブ区切り）で Excel 等へ貼り付け可能
- **自動コピー**: 転置結果を `navigator.clipboard.writeText` で自動コピー

#### 暗号解読

- **Brute forceアプローチ**: Caesar cipher（26パターン）、XOR single-byte（255パターン）など、全パターンを試行して信頼度順にソート
- **信頼度評価システム**: 印字可能文字の割合（30点）、英単語の出現（30点）、文字頻度分析（40点）で平文らしさを0-100で評価
- **XOR brute force**: `TextDecoder`の`fatal: true`オプションでUTF-8デコード失敗時に例外をスロー、印字可能文字（0x20-0x7E）のみをフィルタリング
- **Rail Fence cipher**: レール数2-5のパターンを試行。ジグザグパターンの復号化には、まず各レールに文字を配置し、その後ジグザグ順に読み取る2段階処理
- **Base64多段デコード**: 最大10回までBase64デコードを繰り返し、各段階の結果を保存。無限ループ防止のため、デコード結果が元と同じ場合は中断
- **文字頻度分析**: 英語の文字頻度（ETAOIN...）と比較して上位5文字の一致度を計算。英単語（the, be, to...）の出現も評価
- **パフォーマンス**: XOR brute forceで255パターン、Caesar cipherで26パターンを試行するため、入力サイズは1MBに制限

#### Base64⇄画像変換

- **クリップボード入力**: 「クリップボードから画像を読み込む」ボタンは`navigator.clipboard.read()`で`image/*`を取得（権限必須）。加えて`<svelte:window on:paste>`でCtrl+V貼り付けにも対応（「画像 → Base64」タブ選択時かつ画像ファイルを含む場合のみ`preventDefault`し、テキスト貼り付けは妨げない）

#### ULIDタイムスタンプ抽出

- **自前デコード**: ULID仕様（Crockford's Base32）のデコードを自前実装。外部ライブラリは未使用。
- **タイムスタンプ抽出**: 先頭10文字（48bit、ミリ秒精度Unixtime）のみをデコード対象とし、残り16文字（ランダム性部分）は文字セット検証のみ行う。

#### Unixtime変換

- **双方向変換**: Unixtime→日時、日時→Unixtimeを独立したセクションとして提供（相互バインディングによる無限ループを回避するため、双方向の自動同期はしない）。
- **タイムゾーン表示**: `Intl.DateTimeFormat`の`timeZone`オプションでUTC/JST等を表示。`datetime-local`入力はブラウザのローカルタイムゾーンとして解釈される点に注意。

#### JWTデコーダ

- **自前デコード**: Base64URLデコード（`-`/`_`→`+`/`/`変換、パディング補完）とJSON.parseによる自前実装。外部ライブラリ（jwt-decode等）は未使用。
- **署名検証なし**: デコードのみでHeader/Payloadの署名検証は行わない旨をUI上に明記。
- **UTF-8対応**: `TextDecoder('utf-8', { fatal: true })`でマルチバイト文字を含むペイロードも正しくデコードし、不正なバイト列は例外として検出。
- **日時クレーム表示**: `exp`/`iat`/`nbf`クレームを検出した場合、Unixtime（秒）からUTC日時に変換して併記。

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
- **ゼロ幅一致対策**: `g`フラグ時は`matchAll()`を使い、`u`フラグ有効時もUnicodeの文字境界に従って次の一致へ進む。
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
- **デバウンス処理**: テキスト入力モードで300msのデバウンス処理により、パフォーマンス改善。
- **リアクティビティ**: Svelte 5の`$state`を使用して、オブジェクトのプロパティ変更を適切に検知。

#### Hexダンプ（新規ツール）

- **メモリ効率**: `file.slice()`で必要な部分のみ読み込み、大きなファイルでもメモリ効率良く処理。
- **表示制限**: デフォルト1MB、最大10MBまで表示。大量データでのDOM更新パフォーマンス考慮。
- **xxd形式**: オフセット（8桁16進数）、16進数表示（2バイトごとにスペース）、ASCII表示（印字可能文字のみ）の標準xxdコマンド形式。
- **アクセシビリティ**: マウスイベントハンドラを持つ`<span>`要素に`role="button"`と`tabindex="0"`を追加して支援技術対応。

#### エンコード文字列デコーダ（新規ツール）

- **対応形式**: 手動選択は19種類（URL、HTML Entity、Base64、Unicode、16進数、8進数、Punycode、ROT13、Morse Code等）。自動検出では対応形式の候補を提示する。
- **自動検出機能**: 正規表現パターンマッチングで入力からエンコード形式を自動推定、信頼度スコア付きで複数候補を提示
- **入力サイズ制限**: DoS攻撃対策として10MBの入力サイズ制限を実施、超過時はエラーメッセージを表示
- **非推奨API回避**: `String.prototype.substr()`を`substring()`に置き換え、将来のブラウザ互換性を確保
- **エラーハンドリング**: `instanceof Error`による型安全なエラー処理、各デコード関数で適切な例外スロー
- **HTML文字参照**: ブラウザのHTML解析を使い、文字参照を1段だけデコードする。HTML/URLエンコーダと共通の処理を使う。
- **Quoted-Printable**: UTF-8として復号し、形式名にも明記する。不正なバイト列はエラーにし、メールの文字セット指定は扱わない。

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
- **解析対象**: `/Info`辞書、XMP、文書ID、添付、OpenAction、Additional Actions、JavaScript、外部参照、フォーム、暗号化・署名・権限を表示。PDF.jsの公開APIと、pdf-libによる間接参照・オブジェクトストリームの解析を併用する。
- **Finding機能**: JavaScript・添付をhigh、暗号化・外部参照をmediumとして分類。署名の暗号学的検証は行わない。
- **SHA-256ハッシュ計算**: Web Crypto APIの`crypto.subtle.digest()`を使用して、JavaScriptコードや埋め込みファイルのハッシュ値を計算。同一性確認や追跡に有用。
- **非同期処理**: `parsePDFNonRender()`は`async`関数で、pdfjs-distの非同期API（`getDocument()`, `getMetadata()`, `getAttachments()`など）を適切に処理。
- **型安全性**: `PDFReport`インターフェースで構造化されたレポート形式を定義。`Finding`型で検出結果の重要度とコードを管理。
- **元データの保持**: PDF.jsのWorkerには`bytes.slice()`を渡し、解析元のバッファを保持する。ファイルサイズ・ハッシュ・pdf-libによる構造解析は元データを使う。
- **CDN経由Worker**: pdf.jsのWebWorkerはunpkg CDNから動的読み込み（`pdf.worker.min.mjs`）。バージョンは`pdfjsLib.version`で自動取得。
- **部分的な解析失敗**: 構造を解析できない場合は`INCOMPLETE_STRUCTURE`のFindingを追加し、検出結果が不完全な可能性を表示する。

#### PDF操作（新規ツール）

- **pdf-lib使用**: ブラウザ上でPDFの結合・分割・ページ編集・圧縮を実行。`PDFDocument.load()`/`copyPages()`/`addPage()`を使用。
- **PDF編集（pdf-edit）**: 結合・分割・ページ編集を1画面に統合。ページは元ファイルへの参照`{srcId, pageIndex}`として保持し、移動・削除・分割・結合は`organizer.ts`の純粋関数で配列操作のみ行う。PDFの組み立ては書き出し時の`assemblePdf()`1回だけ。
- **copyPagesのまとめ呼び出し**: `copyPages`は呼び出し単位で共有リソース（フォント等）をコピーするため、`assemblePdf()`では元ファイルごとに1回だけ呼び、出力サイズの肥大化を防ぐ。
- **ドラッグの種別判定**: ページ・ファイル並び替えのドラッグ中は`drag`状態を持ち、OSからのファイルドロップと区別する。
- **圧縮（pdf-compress）**: `copyPages`で新規文書に移さず、元の文書を直接最適化する（しおり・フォーム等を保つため）。処理順は `compress.ts` の `compressPdfFile()` を参照: 付加データ削除（サムネイル・PieceInfo・XMP・添付）→ 辞書と中身が一致するストリームの重複排除 → Root/Infoから到達不能なオブジェクトの削除 →（任意）画像再圧縮 → ストリームの再圧縮 → `useObjectStreams: true`で保存。結果が元以上なら元ファイルを返す。
- **ストリームの再圧縮**: `recompressStreams()`で描画命令・フォント・図などを`fflate`の`zlibSync`（level 9）で圧縮し直す（`CompressionStream`は圧縮レベルを指定できないため）。Filterなし・汎用フィルタ（Flate/LZW/ASCIIHex/ASCII85/RunLength）のみのストリームは完全に復号してFlate 1段にする。単一DCTDecodeのJPEGには、小さくなる場合だけ可逆のFlateを重ねる（`[/FlateDecode /DCTDecode]`）。予測子付きの単一FlateDecodeは、pdf-libが予測子を戻さないことを利用して予測済みのデータを圧縮し直し、`DecodeParms`を保つ。XMPメタデータは非圧縮推奨のため対象外。
- **画像の配置解析**: `image-placement.ts`の`collectImagePlacements()`がページの描画命令を字句解析し、`q`/`Q`/`cm`で変換行列を追って、`Do`で描かれる画像の紙面上の大きさ（インチ、軸ごとの最大値）を求める。Form XObjectは`/Matrix`を掛けて再帰（循環・深さ制限あり、復号結果はキャッシュ）、注釈の外観（`/AP /N`）は`/BBox`を`/Rect`に合わせて配置、`/UserUnit`も反映する。インライン画像のバイナリは読み飛ばす。画像の`/SMask`にも親と同じ配置を記録する。タイリングパターン・Type3フォント内の画像は大きさを追えないため無限大（縮小しない）として記録する。`Do`の総数が`MAX_DO_OPERATIONS`を超えたら`null`を返し、呼び出し側はページの長辺基準で扱う。
- **容量の内訳**: `analyzeSpace()`でストリームを画像・フォント・描画命令・Form XObject・添付・XMP・サムネイルに分類。画像の実効ppiは最も大きく描かれた箇所での値（配置不明なら「—」）。
- **画像再圧縮**: DeviceRGB/DeviceGray・成分数3/1のICCBased、8bpc、単一フィルタ（DCT/Flate）または`[/FlateDecode /DCTDecode]`のみ対象。`/ImageMask`・`/Mask`・`/Decode`付き、Canvasの面積上限（`MAX_CANVAS_PIXELS`）超えは除外。実効ppiが上限を超える画像を、どちらの軸も上限を下回らない範囲で縮小する（配置不明の画像はページの長辺いっぱいに描かれるものとみなす）。CanvasのJPEG出力は常に3成分のため、JPEG化はRGB系を基本とし、Grayは`jpegGray`有効時のDeviceGrayのみ（`/ColorSpace`を`DeviceRGB`に書き換え。ICC付きGrayは階調が変わるため常に除外）。SMaskは1成分である必要があるため常に可逆（Flate）で、親画像の配置に合わせて縮小し、`/Matte`付きは親・マスクとも対象外。色数256以下のFlate画像（スクリーンショット・図）は`jpegFewColors`無効時はJPEGにせず、縮小時のみFlateで再符号化。JPEGの復号は`createImageBitmap`に`imageOrientation: 'none'`・`colorSpaceConversion: 'none'`を指定（PDFビューアはEXIFの向き・ICCを使わないため）。
- **フォントのサブセット化**: `font-subset.ts`がまるごと埋め込まれた Type0（`/Identity-H`・`/Identity-V`）+ CIDFontType2（`/FontFile2`）を、使用字形だけに減らす。字形番号を保つ（HarfBuzz の`RETAIN_GIDS`）ため描画命令は書き換えない。使用字形はページ・Form・注釈の全外観・タイリングパターン・Type3の描画命令の`Tf`と`Tj`/`TJ`/`'`/`"`から集め、Formにはテキスト状態（現在のフォント）を引き継ぐ。走査しなかったリソース辞書（`/DR`など）から参照されるフォントは対象外。サブセット後は名前に6文字の接頭辞を付け、`/CIDSet`を削除する。`hb-subset.ts`は`harfbuzz-subset.wasm`のC APIを直接呼ぶ。WASM（約680KB）は対象フォントがある場合だけ`hb-wasm.ts`で取得する。
- **フォントの最適化**: `optimizeFontPrograms()`が CIDFontType2 だけが使う TrueType（`/FontFile2`）から、描画に使わない表（`CID_UNUSED_TABLES`：GSUB・GPOS・cmap・post など。OS/2・name は一部の印刷系が参照しうるため残す）を全字形を残したまま削る。PDF仕様で TrueType に必要なのは head hhea loca maxp cvt prep glyf hmtx fpgm で、cmap は単純な TrueType でのみ使うため、単純な TrueType と共有するファイル（`/Type` の有無によらず、CIDFontType2 以外のディスクリプタから参照されるもの）は対象外。`removeHinting`（強・最大）ではヒンティング（`NO_HINTING`）も削る。サブセット化（`subsetFonts()`）でも同じ表を削る。
- **座標の丸め**: `content-precision.ts`がパス構築の演算子（`m` `l` `c` `v` `y` `re`）のオペランドだけを、紙面上の誤差が`roundTolerancePt`以内になる桁数に丸める（`cm`・色・文字位置は触らない。強0.1pt・最大0.25pt）。桁数はその時点の変換行列の拡大率から決め、Form XObjectは`collectPlacements()`で集めた全配置の最大拡大率を基準にする。拡大率を追えないForm（パターン・Type3・ExtGStateのソフトマスク内、深さ超過は`Infinity`）・複数箇所で共有されるページのContents・走査量超過の文書は対象外。Contentsが演算子の途中で分割されていたら（`scanContent()`の戻り値が残ったオペランド数）、そのページの以降のストリームは触らない。字句解析が返すオペランドの位置（spans）で元データを部分的に書き換える。
- **圧縮レベル**: `levels.ts`の`LEVELS`（画質を維持・弱・中・強・最大。最大のみ添付ファイルも削除）で付加データの削除と画像設定を一式で定義する。カスタムは`customFrom()`で直前のレベルを初期値にし、`resolveSettings()`で処理用の設定に変換する（`<select>`の値は数値に揃える）。UIは`CompressOptions.svelte`（レベル・カスタム設定）と`SpaceBreakdown.svelte`（圧縮前後の内訳）に分割。
- **Web Worker**: 解析・圧縮は`compress.worker.ts`で実行し、`worker-client.ts`がジョブごとにWorkerを作って完了・失敗・キャンセル（`terminate()`）で破棄する。`compressPdfFile()`は進捗コールバックで段階（読み込み・整理・フォント・座標・画像・ストリーム・保存・解析）と件数を通知し、UIは1本の進捗バーで、各段階に均等な区間（1/8ずつ）を割り当て、その中を段階内の件数で埋める。画像の再圧縮では使い終えた`OffscreenCanvas`の幅・高さを0にして画素バッファをすぐ解放する。Workerには`document`がないため、画像の再圧縮は`OffscreenCanvas`（`convertToBlob`）を使う。設定は`$state.snapshot()`でProxyを外してから送る（Proxyは構造化クローンできない）。
- **メモリ使用量**: 結合・分割・編集・圧縮とも大きなファイルはメモリ使用量に注意。

#### Pcap解析（新規ツール）

- **自作バイナリパーサー**: pcap/pcapngファイルのバイナリ解析を`DataView`で実装。マジックナンバー（0xa1b2c3d4）でエンディアン判定し、ビッグ/リトルエンディアン両対応。
- **時刻とリンク層**: pcapのマイクロ秒・ナノ秒、pcapngのインターフェースごとの時刻単位とオフセットを扱う。時刻なしのパケットは不明として表示する。Windows LSOv2の全長0のTCPは、記録されたフレーム内で解析する。
- **階層的プロトコル解析**: Ethernet（14バイト）→ IPv4（可変長）→ TCP/UDP（可変長）と段階的にヘッダーをデコード。各層で必要なバイト数を検証して不完全パケットでもクラッシュしない設計。
- **統計情報の効率的集計**: パケット配列を1回走査でプロトコル分布・IPアドレス分布・ポート分布をすべて計算。`Record<string|number, number>`型でカウント集計。
- **パケットビューア機能**: タブ切り替えで統計表示とパケット一覧を切り替え。プロトコル・IP・ポート・ペイロード検索の柔軟なフィルタリング。
- **インタラクティブ詳細表示**: パケットクリックでEthernet→IPv4→TCP/UDPの階層構造を展開表示。TCPフラグ（SYN/ACK/FIN等）を人間が読める形式で表示。
- **16進ダンプ最適化**: 最大512バイトまで表示してDOM描画負荷を軽減。`xxd`コマンドと同じフォーマット（オフセット8桁、16進数、ASCII）で表示。
- **パフォーマンス最適化**: パケット一覧は最大1000パケットまで表示制限。
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

## CI/CD

### GitHub Actions

プロジェクトではGitHub Actionsを使用して、以下の自動チェックを実行しています：

**`.github/workflows/ci.yml`** - メインのCIパイプライン:

- **トリガー**: `main`ブランチへのpush、PRのopen/update
- **実行内容**:
  1. **Linter** (`npm run lint`): Prettier + ESLint
  2. **Type Check** (`npm run check`): TypeScript型チェック
  3. **Tests** (`npm run test:run`): Vitest による337個のユニットテスト

**テストカバレッジ**:

- ツールの純粋関数と、入力・設定変更・非同期処理を確かめるコンポーネントテストを配置。ツール間で共用する処理のテストは`tools/_shared/`に置く。
- コアロジックに絞った実用的なテスト戦略
- 外部依存やブラウザAPIに依存する部分は除外

**その他のワークフロー**:

- **`gh-pages.yml`**: GitHub Pagesへのデプロイ
- **`claude.yml`**: Claude Code統合（存在する場合）

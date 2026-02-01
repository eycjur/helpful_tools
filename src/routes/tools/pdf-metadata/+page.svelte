<script lang="ts">
	import { tools } from '$lib/data/tools';
	import Icon from '@iconify/svelte';
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';

	interface BasicInfo {
		fileName: string;
		fileSize: number;
		pageCount: number;
		pdfVersion: string;
		isEncrypted: boolean;
		isLinearized: boolean;
	}

	interface MetadataSection {
		title: string;
		icon: string;
		data: Record<string, unknown>;
	}

	const tool = tools.find((t) => t.name === 'pdf-metadata');

	let pdfUrl: string | null = null;
	let basicInfo: BasicInfo | null = null;
	let metadataSections: MetadataSection[] = [];
	let isLoading = false;
	let dragOver = false;
	let warnings: Array<{ message: string; type: 'warning' | 'error' }> = [];

	// PDFファイルサイズ警告しきい値（100MB）
	const FILE_SIZE_WARNING_THRESHOLD = 100 * 1024 * 1024;

	let pdfjsLib: typeof import('pdfjs-dist') | null = null;

	onMount(async () => {
		if (browser) {
			// pdf.jsを動的インポート
			const pdfjs = await import('pdfjs-dist');
			pdfjsLib = pdfjs;
			// ワーカーのパスを設定
			const pdfjsWorker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
			pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorker.default;
		}
	});

	function cleanup() {
		if (pdfUrl) {
			URL.revokeObjectURL(pdfUrl);
			pdfUrl = null;
		}
	}

	onDestroy(cleanup);

	function formatFileSize(bytes: number): string {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
		return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
	}

	function formatValue(value: unknown): string {
		if (value === null || value === undefined) return 'N/A';
		if (typeof value === 'boolean') return value ? 'Yes' : 'No';
		if (value instanceof Date) return value.toLocaleString('ja-JP');
		if (typeof value === 'number') return value.toLocaleString();
		if (typeof value === 'object' && !Array.isArray(value)) {
			return JSON.stringify(value, null, 2);
		}
		if (Array.isArray(value)) {
			return value.join(', ');
		}
		return String(value);
	}

	function formatKey(key: string): string {
		return key
			.replace(/([A-Z])/g, ' $1')
			.replace(/_/g, ' ')
			.trim()
			.replace(/\b\w/g, (c) => c.toUpperCase());
	}

	async function processPDF(file: File) {
		cleanup();
		isLoading = true;
		metadataSections = [];
		warnings = [];

		// ファイルサイズ警告
		if (file.size > FILE_SIZE_WARNING_THRESHOLD) {
			const sizeMB = Math.round(file.size / 1024 / 1024);
			warnings = [
				...warnings,
				{
					message: `ファイルサイズが大きいため（${sizeMB}MB）、処理に時間がかかる場合があります。`,
					type: 'warning'
				}
			];
		}

		try {
			if (!pdfjsLib) {
				throw new Error('PDF.jsライブラリの読み込みに失敗しました');
			}

			const arrayBuffer = await file.arrayBuffer();
			const url = URL.createObjectURL(file);
			pdfUrl = url;

			// PDFドキュメントをロード
			const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
			const pdf = await loadingTask.promise;

			// 基本情報（_pdfInfoを使用）
			const pdfInfo = (
				pdf as {
					_pdfInfo?: { PDFFormatVersion?: string; IsEncrypted?: boolean; IsLinearized?: boolean };
				}
			)._pdfInfo;
			basicInfo = {
				fileName: file.name,
				fileSize: file.size,
				pageCount: pdf.numPages,
				pdfVersion: `${pdfInfo?.PDFFormatVersion || 'Unknown'}`,
				isEncrypted: pdfInfo?.IsEncrypted || false,
				isLinearized: pdfInfo?.IsLinearized || false
			};

			// 暗号化の警告
			if (basicInfo.isEncrypted) {
				warnings = [
					...warnings,
					{
						message: 'このPDFは暗号化されています。一部の情報が取得できない可能性があります。',
						type: 'warning'
					}
				];
			}

			// メタデータ取得
			const metadata = await pdf.getMetadata();

			if (metadata.info) {
				const pdfMetadata: Record<string, unknown> = {};
				for (const [key, value] of Object.entries(metadata.info)) {
					if (value !== undefined && value !== null && value !== '') {
						pdfMetadata[key] = value;
					}
				}

				if (Object.keys(pdfMetadata).length > 0) {
					metadataSections = [
						...metadataSections,
						{
							title: 'PDFメタデータ',
							icon: 'mdi:information-outline',
							data: pdfMetadata
						}
					];
				}
			}

			// JavaScript取得（pdf.jsのバージョンによっては利用できない可能性があります）
			try {
				const pdfWithJS = pdf as { getJavaScript?: () => Promise<string[] | null> };
				if (pdfWithJS.getJavaScript) {
					const jsActions = await pdfWithJS.getJavaScript();
					if (jsActions && jsActions.length > 0) {
						warnings = [
							...warnings,
							{
								message: `⚠️ このPDFにはJavaScriptが${jsActions.length}個含まれています。悪意のあるコードの可能性があるため、信頼できるソースからのファイルか確認してください。`,
								type: 'error'
							}
						];

						const jsData: Record<string, unknown> = {};
						jsActions.forEach((js: string, index: number) => {
							jsData[`スクリプト ${index + 1}`] = js;
						});

						metadataSections = [
							...metadataSections,
							{
								title: 'JavaScript',
								icon: 'mdi:language-javascript',
								data: jsData
							}
						];
					}
				}
			} catch (err) {
				console.log('JavaScript取得エラー:', err);
			}

			// 添付ファイル取得
			try {
				const attachments = await pdf.getAttachments();
				if (attachments && Object.keys(attachments).length > 0) {
					const attachmentData: Record<string, unknown> = {};
					for (const [name, attachment] of Object.entries(attachments)) {
						const att = attachment as {
							filename?: string;
							content?: Uint8Array;
							description?: string;
						};
						attachmentData[name] = {
							ファイル名: att.filename || name,
							サイズ: formatFileSize(att.content?.length || 0),
							説明: att.description || 'N/A'
						};
					}

					metadataSections = [
						...metadataSections,
						{
							title: '添付ファイル',
							icon: 'mdi:paperclip',
							data: attachmentData
						}
					];
				}
			} catch (err) {
				console.log('添付ファイル取得エラー:', err);
			}

			// カタログ情報
			try {
				const catalog = await pdf.getDestinations();
				if (catalog && Object.keys(catalog).length > 0) {
					const catalogData: Record<string, unknown> = {
						宛先数: Object.keys(catalog).length
					};

					metadataSections = [
						...metadataSections,
						{
							title: '宛先（Destinations）',
							icon: 'mdi:map-marker',
							data: catalogData
						}
					];
				}
			} catch (err) {
				console.log('カタログ取得エラー:', err);
			}

			// アウトライン（目次）
			try {
				const outline = await pdf.getOutline();
				if (outline && outline.length > 0) {
					const outlineData: Record<string, unknown> = {
						アウトライン項目数: outline.length,
						最初の項目: outline[0].title || 'N/A'
					};

					metadataSections = [
						...metadataSections,
						{
							title: 'アウトライン（目次）',
							icon: 'mdi:format-list-bulleted',
							data: outlineData
						}
					];
				}
			} catch (err) {
				console.log('アウトライン取得エラー:', err);
			}

			// ページラベル
			try {
				const pageLabels = await pdf.getPageLabels();
				if (pageLabels && pageLabels.length > 0) {
					const labelData: Record<string, unknown> = {
						ページラベル数: pageLabels.length,
						最初のラベル: pageLabels[0] || 'N/A'
					};

					metadataSections = [
						...metadataSections,
						{
							title: 'ページラベル',
							icon: 'mdi:label',
							data: labelData
						}
					];
				}
			} catch (err) {
				console.log('ページラベル取得エラー:', err);
			}

			console.log('PDF解析完了:', { basicInfo, metadataSections, warnings });
		} catch (err) {
			console.error('PDF処理エラー:', err);
			warnings = [
				...warnings,
				{
					message: err instanceof Error ? err.message : 'PDFの処理に失敗しました',
					type: 'error'
				}
			];
		} finally {
			isLoading = false;
		}
	}

	function onFileInput(e: Event) {
		const input = e.target as HTMLInputElement;
		if (input.files?.[0]) {
			processPDF(input.files[0]);
			input.value = '';
		}
	}

	function onDrop(e: DragEvent) {
		e.preventDefault();
		dragOver = false;
		const file = e.dataTransfer?.files?.[0];
		if (file && file.type === 'application/pdf') {
			processPDF(file);
		} else if (file) {
			warnings = [
				{
					message: 'PDFファイルを選択してください',
					type: 'error'
				}
			];
		}
	}

	function clearAll() {
		cleanup();
		basicInfo = null;
		metadataSections = [];
		warnings = [];
	}
</script>

<div class="mx-auto max-w-4xl">
	<div class="mb-6 flex items-center">
		{#if tool?.icon}<Icon icon={tool.icon} class="mr-4 h-10 w-10" />{/if}
		<h1 class="text-3xl font-bold">{tool?.nameJa}</h1>
	</div>

	<p class="mb-6 text-gray-600">
		PDFファイルのメタデータ、埋め込みJavaScript、添付ファイル、セキュリティ設定などを詳細に表示します。
	</p>

	<!-- ファイル入力エリア -->
	<div
		role="button"
		tabindex="0"
		aria-label="PDFファイルをドラッグ&ドロップまたはクリックして選択"
		on:dragover|preventDefault={() => (dragOver = true)}
		on:dragleave={() => (dragOver = false)}
		on:drop={onDrop}
		on:click={() => document.getElementById('pdf-file-input')?.click()}
		on:keydown={(e) => {
			if (e.key === 'Enter' || e.key === ' ') {
				e.preventDefault();
				document.getElementById('pdf-file-input')?.click();
			}
		}}
		class="mb-4 flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 text-center transition-colors {dragOver
			? 'border-blue-400 bg-blue-50'
			: 'border-gray-300 bg-gray-50'}"
	>
		<Icon icon="mdi:cloud-upload" class="mb-2 h-12 w-12 text-gray-400" />
		<p class="mb-2 text-gray-700">PDFファイルをドラッグ＆ドロップ</p>
		<p class="mb-3 text-xs text-gray-500">または、クリックして選択</p>
		<input
			id="pdf-file-input"
			type="file"
			accept="application/pdf"
			on:change={onFileInput}
			class="hidden"
		/>
	</div>

	{#if isLoading}
		<div class="flex items-center justify-center p-8">
			<Icon icon="mdi:loading" class="h-8 w-8 animate-spin text-blue-500" />
			<span class="ml-2 text-gray-600">処理中...</span>
		</div>
	{/if}

	<!-- 警告・エラーメッセージ -->
	{#each warnings as warning (warning.message)}
		<div
			class="mb-4 rounded-lg border p-4 {warning.type === 'error'
				? 'border-red-200 bg-red-50'
				: 'border-yellow-200 bg-yellow-50'}"
		>
			<div class="flex items-start">
				<Icon
					icon={warning.type === 'error' ? 'mdi:alert-circle' : 'mdi:alert'}
					class="mr-2 h-5 w-5 flex-shrink-0 {warning.type === 'error'
						? 'text-red-600'
						: 'text-yellow-600'}"
				/>
				<p class={warning.type === 'error' ? 'text-red-800' : 'text-yellow-800'}>
					{warning.message}
				</p>
			</div>
		</div>
	{/each}

	{#if basicInfo}
		<div class="mb-4 flex justify-end">
			<button on:click={clearAll} class="rounded bg-gray-500 px-4 py-2 text-white hover:bg-gray-600"
				>クリア</button
			>
		</div>

		<!-- 基本情報 -->
		<div class="mb-6 overflow-hidden rounded-lg border border-gray-200 bg-white">
			<div class="border-b border-gray-200 bg-gray-50 px-4 py-3">
				<div class="flex items-center">
					<Icon icon="mdi:file-pdf-box" class="mr-2 h-5 w-5 text-red-600" />
					<h2 class="font-semibold text-gray-800">基本情報</h2>
				</div>
			</div>
			<div class="p-4">
				<dl class="grid grid-cols-1 gap-3 md:grid-cols-2">
					<div>
						<dt class="text-sm font-medium text-gray-500">ファイル名</dt>
						<dd class="mt-1 text-sm break-all text-gray-900">{basicInfo.fileName}</dd>
					</div>
					<div>
						<dt class="text-sm font-medium text-gray-500">ファイルサイズ</dt>
						<dd class="mt-1 text-sm text-gray-900">{formatFileSize(basicInfo.fileSize)}</dd>
					</div>
					<div>
						<dt class="text-sm font-medium text-gray-500">PDFバージョン</dt>
						<dd class="mt-1 text-sm text-gray-900">{basicInfo.pdfVersion}</dd>
					</div>
					<div>
						<dt class="text-sm font-medium text-gray-500">ページ数</dt>
						<dd class="mt-1 text-sm text-gray-900">{basicInfo.pageCount}</dd>
					</div>
					<div>
						<dt class="text-sm font-medium text-gray-500">暗号化</dt>
						<dd class="mt-1 text-sm text-gray-900">
							{basicInfo.isEncrypted ? 'あり' : 'なし'}
						</dd>
					</div>
					<div>
						<dt class="text-sm font-medium text-gray-500">最適化</dt>
						<dd class="mt-1 text-sm text-gray-900">
							{basicInfo.isLinearized ? 'あり（Fast Web View）' : 'なし'}
						</dd>
					</div>
				</dl>
			</div>
		</div>

		<!-- メタデータセクション -->
		{#each metadataSections as section (section.title)}
			<div class="mb-6 overflow-hidden rounded-lg border border-gray-200 bg-white">
				<div class="border-b border-gray-200 bg-gray-50 px-4 py-3">
					<div class="flex items-center">
						<Icon icon={section.icon} class="mr-2 h-5 w-5 text-blue-600" />
						<h2 class="font-semibold text-gray-800">{section.title}</h2>
					</div>
				</div>
				<div class="p-4">
					<dl class="space-y-3">
						{#each Object.entries(section.data) as [key, value] (key)}
							<div class="border-b border-gray-100 pb-2 last:border-b-0">
								<dt class="text-sm font-medium text-gray-500">{formatKey(key)}</dt>
								<dd class="mt-1 text-sm text-gray-900">
									<span class="break-all whitespace-pre-wrap">{formatValue(value)}</span>
								</dd>
							</div>
						{/each}
					</dl>
				</div>
			</div>
		{/each}
	{/if}
</div>

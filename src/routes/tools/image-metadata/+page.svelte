<script lang="ts">
	import { tools } from '$lib/data/tools';
	import Icon from '@iconify/svelte';
	import { onDestroy } from 'svelte';
	import * as exifr from 'exifr';
	import { loadC2paProvenance, getActionLabel, formatSoftwareAgent } from './ai-detector';
	import {
		removeC2paMetadata,
		removeAllMetadataViaCanvas,
		getCleanFileName
	} from './metadata-cleaner';
	import {
		C2PA_ASSERTION_LABELS,
		DIGITAL_SOURCE_TYPE_LABELS,
		AI_SOURCE_TYPE_URIS,
		type BasicInfo,
		type MetadataSection,
		type C2paProvenance
	} from './types';

	function isAiSourceType(uri: string): boolean {
		return AI_SOURCE_TYPE_URIS.some((key) => uri.includes(key));
	}

	const FILE_SIZE_WARNING_THRESHOLD = 50 * 1024 * 1024;
	const tool = tools.find((t) => t.name === 'image-metadata');

	let imageUrl: string | null = null;
	let currentFile: File | null = null;
	let basicInfo: BasicInfo | null = null;
	let metadataSections: MetadataSection[] = [];
	let provenance: C2paProvenance = { hasManifest: false, isAiGenerated: false };
	let provenanceAfterClean: C2paProvenance | null = null;
	let c2paError: string | null = null;
	let isLoading = false;
	let isC2paLoading = false;
	let isRemovingC2pa = false;
	let isRemovingAll = false;
	let dragOver = false;
	let activeTab: 'view' | 'clean' = 'view';
	let cleanedBlob: Blob | null = null;
	let cleanedMode: 'c2pa' | 'all' | null = null;
	let warnings: Array<{ message: string; type: 'warning' | 'error' }> = [];
	let processId = 0;

	function cleanup() {
		if (imageUrl) {
			URL.revokeObjectURL(imageUrl);
			imageUrl = null;
		}
	}
	onDestroy(cleanup);

	function formatFileSize(bytes: number): string {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
		return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
	}

	function isBinaryData(value: unknown): boolean {
		return (
			value instanceof Uint8Array ||
			value instanceof ArrayBuffer ||
			value instanceof Int8Array ||
			value instanceof Uint16Array ||
			value instanceof Int16Array ||
			value instanceof Uint32Array ||
			value instanceof Int32Array ||
			value instanceof Float32Array ||
			value instanceof Float64Array
		);
	}

	function formatValue(value: unknown): string {
		if (value === null || value === undefined) return 'N/A';
		if (typeof value === 'boolean') return value ? 'Yes' : 'No';
		if (value instanceof Date) return value.toLocaleString('ja-JP');
		if (typeof value === 'number') return value.toLocaleString();
		if (typeof value === 'object' && !Array.isArray(value)) return JSON.stringify(value, null, 2);
		if (Array.isArray(value)) return value.join(', ');
		return String(value);
	}

	function formatKey(key: string): string {
		return key
			.replace(/([A-Z])/g, ' $1')
			.replace(/_/g, ' ')
			.trim()
			.replace(/\b\w/g, (c) => c.toUpperCase());
	}

	function getValidationIcon(state?: string): string {
		switch (state) {
			case 'Trusted':
				return 'mdi:shield-check';
			case 'Valid':
				return 'mdi:check-circle';
			case 'Invalid':
				return 'mdi:shield-alert';
			default:
				return 'mdi:shield-outline';
		}
	}

	function getValidationColor(state?: string): string {
		switch (state) {
			case 'Trusted':
				return 'text-green-600';
			case 'Valid':
				return 'text-blue-600';
			case 'Invalid':
				return 'text-red-600';
			default:
				return 'text-gray-500';
		}
	}

	function getValidationLabel(state?: string): string {
		switch (state) {
			case 'Trusted':
				return '信頼済み';
			case 'Valid':
				return '有効';
			case 'Invalid':
				return '無効';
			default:
				return '未検証';
		}
	}

	async function processImage(file: File) {
		cleanup();
		isLoading = true;
		metadataSections = [];
		provenance = { hasManifest: false, isAiGenerated: false };
		provenanceAfterClean = null;
		cleanedBlob = null;
		cleanedMode = null;
		warnings = [];
		currentFile = file;
		const myId = ++processId;

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
			const url = URL.createObjectURL(file);
			imageUrl = url;

			const img = new Image();
			await new Promise<void>((resolve, reject) => {
				img.onload = () => resolve();
				img.onerror = () => reject(new Error('画像の読み込みに失敗しました'));
				img.src = url;
			});

			basicInfo = {
				fileName: file.name,
				fileSize: file.size,
				mimeType: file.type,
				width: img.naturalWidth,
				height: img.naturalHeight,
				lastModified: new Date(file.lastModified).toLocaleString('ja-JP')
			};

			// EXIF/XMP/GPS メタデータ取得
			try {
				const metadata = await exifr.parse(file, {
					tiff: true,
					exif: true,
					gps: true,
					iptc: true,
					xmp: true,
					icc: true,
					jfif: true,
					ihdr: true,
					translateKeys: true,
					translateValues: true,
					mergeOutput: true
				});

				if (metadata) {
					const gpsData = await exifr.gps(file);
					if (gpsData) {
						warnings = [
							...warnings,
							{
								message:
									'⚠️ この画像にはGPS位置情報が含まれています。SNSなどに投稿する際はプライバシーにご注意ください。',
								type: 'error'
							}
						];

						const gpsInfo: Record<string, unknown> = {
							緯度: gpsData.latitude,
							経度: gpsData.longitude
						};
						if (metadata.GPSAltitude !== undefined) gpsInfo['高度'] = `${metadata.GPSAltitude}m`;
						if (gpsData.latitude && gpsData.longitude) {
							gpsInfo['Google Maps'] =
								`https://www.google.com/maps?q=${gpsData.latitude},${gpsData.longitude}`;
						}
						metadataSections = [
							...metadataSections,
							{ title: 'GPS情報', icon: 'mdi:map-marker', data: gpsInfo }
						];
					}

					const gpsFields = new Set([
						'latitude',
						'longitude',
						'GPSLatitude',
						'GPSLongitude',
						'GPSLatitudeRef',
						'GPSLongitudeRef',
						'GPSAltitude',
						'GPSAltitudeRef',
						'GPSDateStamp',
						'GPSTimeStamp',
						'GPSVersionID',
						'GPSMapDatum',
						'GPSProcessingMethod',
						'GPSAreaInformation'
					]);

					const allMetadata: Record<string, unknown> = {};
					for (const [key, value] of Object.entries(metadata)) {
						if (!gpsFields.has(key) && value !== undefined && value !== null) {
							if (typeof value !== 'function' && !isBinaryData(value)) {
								allMetadata[key] = value;
							}
						}
					}

					if (Object.keys(allMetadata).length > 0) {
						metadataSections = [
							...metadataSections,
							{ title: 'EXIFメタデータ', icon: 'mdi:information-outline', data: allMetadata }
						];
					}
				} else {
					metadataSections = [
						...metadataSections,
						{
							title: 'メタデータ',
							icon: 'mdi:information-outline',
							data: { メッセージ: 'この画像にはメタデータが含まれていません' }
						}
					];
				}
			} catch (err) {
				console.error('メタデータ取得エラー:', err);
			}

			// C2PA来歴情報読み取り（並行・エラーはUIに表示）
			isC2paLoading = true;
			c2paError = null;
			loadC2paProvenance(file)
				.then((result) => {
					if (processId !== myId) return;
					provenance = result;
					isC2paLoading = false;
				})
				.catch((err) => {
					if (processId !== myId) return;
					c2paError = err instanceof Error ? err.message : 'C2PA情報の読み込みに失敗しました';
					isC2paLoading = false;
				});
		} catch (err) {
			console.error('画像処理エラー:', err);
			warnings = [
				...warnings,
				{
					message: err instanceof Error ? err.message : '画像の処理に失敗しました',
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
			processImage(input.files[0]);
			input.value = '';
		}
	}

	function onDrop(e: DragEvent) {
		e.preventDefault();
		dragOver = false;
		const file = e.dataTransfer?.files?.[0];
		if (file && file.type.startsWith('image/')) processImage(file);
	}

	function clearAll() {
		cleanup();
		basicInfo = null;
		currentFile = null;
		metadataSections = [];
		provenance = { hasManifest: false, isAiGenerated: false };
		provenanceAfterClean = null;
		c2paError = null;
		cleanedBlob = null;
		cleanedMode = null;
		warnings = [];
	}

	async function handleRemoveC2pa() {
		if (!currentFile) return;
		isRemovingC2pa = true;
		cleanedBlob = null;
		cleanedMode = null;
		provenanceAfterClean = null;
		try {
			const blob = await removeC2paMetadata(currentFile);
			cleanedBlob = blob;
			cleanedMode = 'c2pa';
			// 削除後の画像でC2PAを再確認
			const cleanedFile = new File([blob], currentFile.name, { type: currentFile.type });
			provenanceAfterClean = await loadC2paProvenance(cleanedFile);
		} catch (err) {
			warnings = [
				...warnings,
				{
					message: err instanceof Error ? err.message : 'C2PAメタデータの削除に失敗しました',
					type: 'error'
				}
			];
		} finally {
			isRemovingC2pa = false;
		}
	}

	async function handleRemoveAll() {
		if (!currentFile) return;
		isRemovingAll = true;
		cleanedBlob = null;
		cleanedMode = null;
		provenanceAfterClean = null;
		try {
			const blob = await removeAllMetadataViaCanvas(currentFile);
			cleanedBlob = blob;
			cleanedMode = 'all';
			// 削除後の画像でC2PAを再確認
			const ext = currentFile.name.split('.').pop() ?? 'jpg';
			const cleanedFile = new File([blob], `cleaned.${ext}`, { type: currentFile.type });
			provenanceAfterClean = await loadC2paProvenance(cleanedFile);
		} catch (err) {
			warnings = [
				...warnings,
				{
					message: err instanceof Error ? err.message : '全メタデータの削除に失敗しました',
					type: 'error'
				}
			];
		} finally {
			isRemovingAll = false;
		}
	}

	function downloadCleanedFile() {
		if (!cleanedBlob || !currentFile) return;
		const suffix = cleanedMode === 'c2pa' ? 'no_c2pa' : 'no_meta';
		const fileName = getCleanFileName(currentFile.name, suffix);
		const url = URL.createObjectURL(cleanedBlob);
		const a = document.createElement('a');
		a.href = url;
		a.download = fileName;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	}
</script>

<div class="mx-auto max-w-4xl">
	<div class="mb-6 flex items-center">
		{#if tool?.icon}<Icon icon={tool.icon} class="mr-4 h-10 w-10" />{/if}
		<h1 class="text-3xl font-bold">{tool?.nameJa}</h1>
	</div>

	<p class="mb-6 text-gray-600">
		画像ファイルのEXIF情報やC2PA来歴情報を表示します。C2PAマニフェストの削除や全メタデータ削除ができます。
	</p>

	<!-- ファイル入力エリア -->
	<div
		role="button"
		tabindex="0"
		aria-label="画像ファイルをドラッグ&ドロップまたはクリックして選択"
		on:dragover|preventDefault={() => (dragOver = true)}
		on:dragleave={() => (dragOver = false)}
		on:drop={onDrop}
		on:click={() => document.getElementById('metadata-file-input')?.click()}
		on:keydown={(e) => {
			if (e.key === 'Enter' || e.key === ' ') {
				e.preventDefault();
				document.getElementById('metadata-file-input')?.click();
			}
		}}
		class="mb-4 flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 text-center transition-colors {dragOver
			? 'border-blue-400 bg-blue-50'
			: 'border-gray-300 bg-gray-50'}"
	>
		<Icon icon="mdi:cloud-upload" class="mb-2 h-12 w-12 text-gray-400" />
		<p class="mb-2 text-gray-700">画像ファイルをドラッグ＆ドロップ</p>
		<p class="mb-3 text-xs text-gray-500">または、クリックして選択</p>
		<input
			id="metadata-file-input"
			type="file"
			accept="image/*"
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

	{#if basicInfo && imageUrl}
		<div class="mb-4 flex items-center justify-between">
			<div class="flex space-x-1 rounded-lg bg-gray-100 p-1">
				<button
					on:click={() => (activeTab = 'view')}
					class="rounded-md px-4 py-2 text-sm font-medium transition-colors {activeTab === 'view'
						? 'bg-white text-gray-900 shadow-sm'
						: 'text-gray-600 hover:text-gray-800'}"
				>
					<Icon icon="mdi:eye" class="mr-1 inline-block h-4 w-4" />
					メタデータ表示
				</button>
				<button
					on:click={() => (activeTab = 'clean')}
					class="rounded-md px-4 py-2 text-sm font-medium transition-colors {activeTab === 'clean'
						? 'bg-white text-gray-900 shadow-sm'
						: 'text-gray-600 hover:text-gray-800'}"
				>
					<Icon icon="mdi:eraser" class="mr-1 inline-block h-4 w-4" />
					メタデータ削除
				</button>
			</div>
			<button
				on:click={clearAll}
				class="rounded bg-gray-500 px-4 py-2 text-sm text-white hover:bg-gray-600"
			>
				クリア
			</button>
		</div>

		<!-- 画像プレビュー -->
		<div class="mb-6 overflow-hidden rounded-lg border border-gray-200 bg-white">
			<img src={imageUrl} alt="preview" class="mx-auto max-h-64 w-full object-contain" />
		</div>

		{#if activeTab === 'view'}
			<!-- C2PA来歴情報 -->
			{#if isC2paLoading}
				<div
					class="mb-4 flex items-center rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-500"
				>
					<Icon icon="mdi:loading" class="mr-2 h-4 w-4 animate-spin" />
					C2PA来歴情報を確認中...
				</div>
			{:else if c2paError}
				<div class="mb-4 rounded-lg border border-red-200 bg-red-50 p-4">
					<div class="flex items-start">
						<Icon icon="mdi:alert-circle" class="mr-2 h-5 w-5 flex-shrink-0 text-red-600" />
						<div>
							<p class="font-medium text-red-800">C2PA来歴情報の読み込みに失敗しました</p>
							<p class="mt-1 text-sm text-red-600">{c2paError}</p>
						</div>
					</div>
				</div>
			{:else if provenance.hasManifest}
				<!-- 全体ヘッダー -->
				<div
					class="mb-3 overflow-hidden rounded-lg border {provenance.isAiGenerated
						? 'border-orange-200'
						: 'border-purple-200'} bg-white"
				>
					<div
						class="flex items-center justify-between border-b px-4 py-3 {provenance.isAiGenerated
							? 'border-orange-200 bg-orange-50'
							: 'border-purple-200 bg-purple-50'}"
					>
						<div class="flex items-center">
							<Icon
								icon={provenance.isAiGenerated ? 'mdi:robot' : 'mdi:certificate'}
								class="mr-2 h-5 w-5 {provenance.isAiGenerated
									? 'text-orange-600'
									: 'text-purple-600'}"
							/>
							<h2
								class="font-semibold {provenance.isAiGenerated
									? 'text-orange-800'
									: 'text-purple-800'}"
							>
								{provenance.isAiGenerated ? 'AI生成コンテンツ（C2PA来歴あり）' : 'C2PA来歴情報あり'}
							</h2>
						</div>
						{#if provenance.validationState}
							<div class="flex items-center text-sm">
								<Icon
									icon={getValidationIcon(provenance.validationState)}
									class="mr-1 h-4 w-4 {getValidationColor(provenance.validationState)}"
								/>
								<span class={getValidationColor(provenance.validationState)}>
									{getValidationLabel(provenance.validationState)}
								</span>
							</div>
						{/if}
					</div>
				</div>

				<!-- マニフェストチェーン（アクティブ → 祖先） -->
				{#if provenance.manifestChain && provenance.manifestChain.length > 0}
					<div class="mb-6 space-y-3">
						{#each provenance.manifestChain as entry, idx (entry.label)}
							{@const borderColor = entry.isAiGenerated
								? 'border-orange-200'
								: entry.isActive
									? 'border-purple-200'
									: 'border-gray-200'}
							{@const bgColor = entry.isAiGenerated
								? 'bg-orange-50'
								: entry.isActive
									? 'bg-purple-50'
									: 'bg-gray-50'}
							<div class="overflow-hidden rounded-lg border {borderColor} bg-white">
								<!-- マニフェストヘッダー -->
								<div class="flex items-center gap-2 border-b {borderColor} {bgColor} px-3 py-2">
									<Icon
										icon={entry.isActive ? 'mdi:file-certificate' : 'mdi:history'}
										class="h-4 w-4 {entry.isAiGenerated
											? 'text-orange-600'
											: entry.isActive
												? 'text-purple-600'
												: 'text-gray-500'}"
									/>
									<span
										class="text-xs font-semibold {entry.isAiGenerated
											? 'text-orange-800'
											: entry.isActive
												? 'text-purple-800'
												: 'text-gray-700'}"
									>
										{entry.isActive ? '最新マニフェスト' : `素材マニフェスト ${idx}`}
									</span>
									{#if entry.isAiGenerated && entry.aiSourceTypeLabel}
										<span
											class="ml-auto rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700"
										>
											{entry.aiSourceTypeLabel}
										</span>
									{/if}
									{#if entry.claimGeneratorInfo && entry.claimGeneratorInfo.length > 0}
										<span
											class="{entry.isAiGenerated
												? ''
												: entry.isActive
													? ''
													: 'ml-auto'} truncate text-xs text-gray-500"
										>
											{entry.claimGeneratorInfo[0].name}
										</span>
									{/if}
								</div>

								<div class="p-3">
									<!-- アクション一覧 -->
									{#if entry.actions.length > 0}
										<ol class="space-y-1.5">
											{#each entry.actions as action, i (i)}
												{@const agentStr = formatSoftwareAgent(action.softwareAgent)}
												<li class="flex items-start gap-2 text-sm">
													<span
														class="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold {action.digitalSourceType &&
														isAiSourceType(action.digitalSourceType)
															? 'bg-orange-100 text-orange-700'
															: 'bg-gray-100 text-gray-600'}"
													>
														{i + 1}
													</span>
													<div class="min-w-0">
														<span class="font-medium text-gray-800">
															{getActionLabel(action.action)}
														</span>
														{#if action.digitalSourceType}
															{@const label =
																DIGITAL_SOURCE_TYPE_LABELS[action.digitalSourceType] ??
																action.digitalSourceType.split('/').pop()}
															<span
																class="ml-1 text-xs {isAiSourceType(action.digitalSourceType)
																	? 'font-medium text-orange-600'
																	: 'text-gray-500'}"
															>
																({label})
															</span>
														{/if}
														{#if agentStr}
															<span class="ml-1 text-xs text-gray-400">by {agentStr}</span>
														{/if}
														{#if action.when}
															<span class="ml-1 text-xs text-gray-400">
																{new Date(action.when).toLocaleString('ja-JP')}
															</span>
														{/if}
														{#if action.description}
															<p class="text-xs text-gray-500">{action.description}</p>
														{/if}
													</div>
												</li>
											{/each}
										</ol>
									{/if}

									<!-- 含まれるアサーションラベル -->
									{#if entry.assertionLabels.length > 0}
										<div class="mt-2 flex flex-wrap gap-1">
											{#each entry.assertionLabels as label (label)}
												<span
													class="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs text-gray-500"
													title={label}
												>
													{C2PA_ASSERTION_LABELS[label] ?? label}
												</span>
											{/each}
										</div>
									{/if}

									<!-- 署名情報 -->
									{#if entry.signatureIssuer || entry.signatureCommonName || entry.signatureTime}
										<div class="mt-2 border-t border-gray-100 pt-2 text-xs text-gray-500">
											{#if entry.signatureCommonName}
												<span class="font-medium">{entry.signatureCommonName}</span>
											{:else if entry.signatureIssuer}
												<span class="font-medium">{entry.signatureIssuer}</span>
											{/if}
											{#if entry.signatureTime}
												<span class="ml-2"
													>{new Date(entry.signatureTime).toLocaleString('ja-JP')}</span
												>
											{/if}
										</div>
									{/if}
								</div>
							</div>
						{/each}
					</div>
				{/if}
			{:else}
				<div class="mb-4 flex items-center rounded-lg border border-gray-200 bg-gray-50 p-4">
					<Icon icon="mdi:certificate-outline" class="mr-2 h-5 w-5 text-gray-400" />
					<p class="text-sm text-gray-500">C2PA来歴情報は含まれていません</p>
				</div>
			{/if}

			<!-- 基本情報 -->
			<div class="mb-6 overflow-hidden rounded-lg border border-gray-200 bg-white">
				<div class="border-b border-gray-200 bg-gray-50 px-4 py-3">
					<div class="flex items-center">
						<Icon icon="mdi:file-image" class="mr-2 h-5 w-5 text-blue-600" />
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
							<dt class="text-sm font-medium text-gray-500">形式</dt>
							<dd class="mt-1 text-sm text-gray-900">{basicInfo.mimeType}</dd>
						</div>
						<div>
							<dt class="text-sm font-medium text-gray-500">寸法</dt>
							<dd class="mt-1 text-sm text-gray-900">{basicInfo.width} × {basicInfo.height} px</dd>
						</div>
						<div class="md:col-span-2">
							<dt class="text-sm font-medium text-gray-500">最終更新日時</dt>
							<dd class="mt-1 text-sm text-gray-900">{basicInfo.lastModified}</dd>
						</div>
					</dl>
				</div>
			</div>

			<!-- EXIFメタデータ -->
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
										{#if typeof value === 'string' && value.startsWith('http')}
											<a
												href={value}
												target="_blank"
												rel="noopener noreferrer"
												class="text-blue-600 hover:underline">{value}</a
											>
										{:else}
											<span class="break-all whitespace-pre-wrap">{formatValue(value)}</span>
										{/if}
									</dd>
								</div>
							{/each}
						</dl>
					</div>
				</div>
			{/each}
		{:else}
			<!-- メタデータ削除タブ -->
			<div class="space-y-4">
				<!-- C2PA状況サマリー -->
				<div class="rounded-lg border border-gray-200 bg-white p-4">
					<h2 class="mb-3 flex items-center font-semibold text-gray-800">
						<Icon icon="mdi:certificate" class="mr-2 h-5 w-5 text-gray-600" />
						C2PA来歴情報の状況
					</h2>
					{#if isC2paLoading}
						<div class="flex items-center text-sm text-gray-500">
							<Icon icon="mdi:loading" class="mr-2 h-4 w-4 animate-spin" />
							確認中...
						</div>
					{:else if c2paError}
						<div class="text-sm text-red-600">
							<Icon icon="mdi:alert-circle" class="mr-1 inline-block h-4 w-4" />
							C2PA確認エラー: {c2paError}
						</div>
					{:else if provenance.hasManifest}
						<div class="flex items-center text-sm text-purple-700">
							<Icon icon="mdi:check-circle" class="mr-2 h-5 w-5" />
							<span
								>C2PAマニフェストが含まれています{provenance.isAiGenerated
									? '（AI生成コンテンツ）'
									: ''}</span
							>
						</div>
					{:else}
						<div class="flex items-center text-sm text-gray-500">
							<Icon icon="mdi:information-outline" class="mr-2 h-4 w-4" />
							<span>C2PAマニフェストは含まれていません</span>
						</div>
					{/if}
				</div>

				<!-- 削除オプション -->
				<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
					<div class="rounded-lg border border-purple-200 bg-purple-50 p-4">
						<h3 class="mb-2 flex items-center font-semibold text-purple-800">
							<Icon icon="mdi:certificate-outline" class="mr-2 h-5 w-5" />
							C2PAメタデータのみ削除
						</h3>
						<p class="mb-3 text-xs text-purple-700">
							C2PAマニフェスト（来歴情報）のみを削除します。EXIFや画素データはそのまま保持されます。画質劣化なし（バイナリ操作）。
						</p>
						<ul class="mb-3 space-y-0.5 text-xs text-purple-600">
							<li>• JPEG: APP11セグメント（JUMBF）を除去</li>
							<li>• PNG: caBXチャンクを除去</li>
							<li>• WebP等: Canvas再描画（全削除）</li>
						</ul>
						<button
							on:click={handleRemoveC2pa}
							disabled={isRemovingC2pa || isRemovingAll}
							class="w-full rounded bg-purple-600 px-4 py-2 text-sm text-white transition-colors hover:bg-purple-700 disabled:opacity-50"
						>
							{#if isRemovingC2pa}
								<Icon icon="mdi:loading" class="mr-1 inline-block h-4 w-4 animate-spin" />
								処理中...
							{:else}
								C2PAメタデータを削除
							{/if}
						</button>
					</div>

					<div class="rounded-lg border border-red-200 bg-red-50 p-4">
						<h3 class="mb-2 flex items-center font-semibold text-red-800">
							<Icon icon="mdi:delete-sweep" class="mr-2 h-5 w-5" />
							全メタデータを削除
						</h3>
						<p class="mb-3 text-xs text-red-700">
							EXIFやC2PAを含む全てのメタデータを削除します。Canvas再描画方式のため、JPEGは品質95%で再エンコードされます。
						</p>
						<ul class="mb-3 space-y-0.5 text-xs text-red-600">
							<li>• 全EXIF（GPS・カメラ情報を含む）</li>
							<li>• XMP / IPTC</li>
							<li>• C2PAマニフェスト</li>
						</ul>
						<button
							on:click={handleRemoveAll}
							disabled={isRemovingC2pa || isRemovingAll}
							class="w-full rounded bg-red-600 px-4 py-2 text-sm text-white transition-colors hover:bg-red-700 disabled:opacity-50"
						>
							{#if isRemovingAll}
								<Icon icon="mdi:loading" class="mr-1 inline-block h-4 w-4 animate-spin" />
								処理中...
							{:else}
								全メタデータを削除
							{/if}
						</button>
					</div>
				</div>

				<!-- 削除後の結果 -->
				{#if cleanedBlob}
					<div class="rounded-lg border border-green-200 bg-green-50 p-4">
						<div class="mb-3 flex items-center justify-between">
							<div class="flex items-center">
								<Icon icon="mdi:check-circle" class="mr-2 h-5 w-5 text-green-600" />
								<span class="text-sm font-medium text-green-800">
									{cleanedMode === 'c2pa' ? 'C2PAメタデータを削除' : '全メタデータを削除'}しました
									（{formatFileSize(cleanedBlob.size)}）
								</span>
							</div>
							<button
								on:click={downloadCleanedFile}
								class="flex items-center rounded bg-green-600 px-4 py-2 text-sm text-white hover:bg-green-700"
							>
								<Icon icon="mdi:download" class="mr-1 h-4 w-4" />
								ダウンロード
							</button>
						</div>

						<!-- 削除後のC2PA確認 -->
						{#if provenanceAfterClean !== null}
							<div class="mt-3 border-t border-green-200 pt-3">
								<h3 class="mb-2 flex items-center text-sm font-semibold text-green-800">
									<Icon icon="mdi:certificate" class="mr-1.5 h-4 w-4" />
									削除後のC2PA確認
								</h3>
								{#if provenanceAfterClean.hasManifest}
									<div class="flex items-center text-sm text-orange-700">
										<Icon icon="mdi:alert-circle" class="mr-1.5 h-4 w-4" />
										<span
											>C2PAマニフェストが残っています（バイナリ操作では除去できなかった可能性があります）</span
										>
									</div>
								{:else}
									<div class="flex items-center text-sm text-green-700">
										<Icon icon="mdi:check-circle" class="mr-1.5 h-4 w-4" />
										<span>C2PAマニフェストが正常に削除されました</span>
									</div>
								{/if}
							</div>
						{/if}
					</div>
				{/if}
			</div>
		{/if}
	{/if}
</div>

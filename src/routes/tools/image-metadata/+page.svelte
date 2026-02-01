<script lang="ts">
	import { tools } from '$lib/data/tools';
	import Icon from '@iconify/svelte';
	import { onDestroy } from 'svelte';
	import * as exifr from 'exifr';

	interface BasicInfo {
		fileName: string;
		fileSize: number;
		mimeType: string;
		width: number;
		height: number;
		lastModified: string;
	}

	interface MetadataSection {
		title: string;
		icon: string;
		data: Record<string, unknown>;
	}

	// ファイルサイズ警告しきい値（50MB以上で警告）
	const FILE_SIZE_WARNING_THRESHOLD = 50 * 1024 * 1024;

	const tool = tools.find((t) => t.name === 'image-metadata');

	let imageUrl: string | null = null;
	let basicInfo: BasicInfo | null = null;
	let metadataSections: MetadataSection[] = [];
	let isLoading = false;
	let dragOver = false;
	let warnings: Array<{ message: string; type: 'warning' | 'error' }> = [];

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
		if (typeof value === 'object' && !Array.isArray(value)) {
			return JSON.stringify(value, null, 2);
		}
		if (Array.isArray(value)) {
			return value.join(', ');
		}
		return String(value);
	}

	function formatKey(key: string): string {
		// キャメルケースやスネークケースを読みやすく変換
		return key
			.replace(/([A-Z])/g, ' $1')
			.replace(/_/g, ' ')
			.trim()
			.replace(/\b\w/g, (c) => c.toUpperCase());
	}

	async function processImage(file: File) {
		cleanup();
		isLoading = true;
		metadataSections = [];
		warnings = [];

		// ファイルサイズの警告チェック
		if (file.size > FILE_SIZE_WARNING_THRESHOLD) {
			const sizeMB = Math.round(file.size / 1024 / 1024);
			warnings.push({
				message: `ファイルサイズが大きいため（${sizeMB}MB）、処理に時間がかかる場合があります。`,
				type: 'warning'
			});
		}

		try {
			// 基本情報の取得
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

			// メタデータの取得
			try {
				const metadata = await exifr.parse(file, true);

				if (metadata) {
					// GPS情報
					const gpsData = await exifr.gps(file);
					if (gpsData) {
						warnings.push({
							message:
								'⚠️ この画像にはGPS位置情報が含まれています。SNSなどに投稿する際はプライバシーにご注意ください。',
							type: 'error'
						});

						const gpsInfo: Record<string, unknown> = {
							緯度: gpsData.latitude,
							経度: gpsData.longitude
						};
						if (metadata.GPSAltitude !== undefined) {
							gpsInfo['高度'] = `${metadata.GPSAltitude}m`;
						}
						if (metadata.GPSDateStamp || metadata.GPSTimeStamp) {
							gpsInfo['GPS日時'] =
								`${metadata.GPSDateStamp || ''} ${metadata.GPSTimeStamp || ''}`.trim();
						}

						// Google Maps リンク
						if (gpsData.latitude && gpsData.longitude) {
							gpsInfo['Google Maps'] =
								`https://www.google.com/maps?q=${gpsData.latitude},${gpsData.longitude}`;
						}

						metadataSections.push({
							title: 'GPS情報',
							icon: 'mdi:map-marker',
							data: gpsInfo
						});
					}

					// すべてのEXIFメタデータ
					const allMetadata: Record<string, unknown> = {};
					// GPS関連フィールドは除外（別セクションで表示済み）
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

					for (const [key, value] of Object.entries(metadata)) {
						if (!gpsFields.has(key) && value !== undefined && value !== null) {
							// バイナリデータや関数はスキップ
							if (typeof value !== 'function' && !isBinaryData(value)) {
								allMetadata[key] = value;
							}
						}
					}

					if (Object.keys(allMetadata).length > 0) {
						metadataSections.push({
							title: 'EXIFメタデータ',
							icon: 'mdi:information-outline',
							data: allMetadata
						});
					}
				} else {
					// メタデータが存在しない場合
					metadataSections.push({
						title: 'メタデータ',
						icon: 'mdi:information-outline',
						data: { メッセージ: 'この画像にはメタデータが含まれていません' }
					});
				}
			} catch (err) {
				console.error('メタデータ取得エラー:', err);
				metadataSections.push({
					title: 'エラー',
					icon: 'mdi:alert-circle',
					data: { エラー: 'メタデータの取得に失敗しました' }
				});
			}
		} catch (err) {
			console.error('画像処理エラー:', err);
			warnings.push({
				message: err instanceof Error ? err.message : '画像の処理に失敗しました',
				type: 'error'
			});
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
		if (file && file.type.startsWith('image/')) {
			processImage(file);
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
		画像ファイルのEXIF情報（カメラ設定、撮影日時、GPS位置情報など）を詳細に表示します。
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
		<div class="mb-4 flex justify-end">
			<button on:click={clearAll} class="rounded bg-gray-500 px-4 py-2 text-white hover:bg-gray-600"
				>クリア</button
			>
		</div>

		<!-- 画像プレビュー -->
		<div class="mb-6 overflow-hidden rounded-lg border border-gray-200 bg-white">
			<img src={imageUrl} alt="preview" class="mx-auto max-h-96 w-full object-contain" />
		</div>

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
						<dd class="mt-1 text-sm text-gray-900">
							{basicInfo.width} × {basicInfo.height} px
						</dd>
					</div>
					<div class="md:col-span-2">
						<dt class="text-sm font-medium text-gray-500">最終更新日時</dt>
						<dd class="mt-1 text-sm text-gray-900">{basicInfo.lastModified}</dd>
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
									{#if typeof value === 'string' && value.startsWith('http')}
										<a
											href={value}
											target="_blank"
											rel="noopener noreferrer"
											class="text-blue-600 hover:underline"
										>
											{value}
										</a>
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
	{/if}
</div>

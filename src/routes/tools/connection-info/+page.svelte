<script lang="ts">
	import { tools } from '$lib/data/tools';
	import Icon from '@iconify/svelte';
	import { onMount } from 'svelte';

	const tool = tools.find((t) => t.name === 'connection-info');

	// データ型定義
	interface IPInfo {
		ip: string;
		city: string;
		region: string;
		country: string;
		countryCode: string;
		timezone: string;
		latitude: number;
		longitude: number;
		org: string;
		postal: string;
	}

	interface BrowserInfo {
		userAgent: string;
		browserName: string;
		browserVersion: string;
		platform: string;
		language: string;
		languages: string[];
		cookieEnabled: boolean;
		onlineStatus: boolean;
		javaEnabled: boolean;
	}

	interface SystemInfo {
		screenWidth: number;
		screenHeight: number;
		availWidth: number;
		availHeight: number;
		colorDepth: number;
		pixelDepth: number;
		timezone: string;
		timezoneOffset: number;
		currentTime: string;
	}

	interface NetworkInfo {
		connectionType: string;
		downlink: number;
		effectiveType: string;
		rtt: number;
		saveData: boolean;
	}

	// 状態管理
	let ipInfo: IPInfo | null = null;
	let browserInfo: BrowserInfo | null = null;
	let systemInfo: SystemInfo | null = null;
	let networkInfo: NetworkInfo | null = null;
	let isLoading = false;
	let error = '';

	// Browser情報を解析
	function parseBrowserInfo(): BrowserInfo {
		const ua = navigator.userAgent;
		let browserName = 'Unknown';
		let browserVersion = 'Unknown';

		// ブラウザ名とバージョンを解析
		if (ua.includes('Chrome') && !ua.includes('Edg')) {
			browserName = 'Chrome';
			const match = ua.match(/Chrome\/([\d.]+)/);
			browserVersion = match ? match[1] : 'Unknown';
		} else if (ua.includes('Firefox')) {
			browserName = 'Firefox';
			const match = ua.match(/Firefox\/([\d.]+)/);
			browserVersion = match ? match[1] : 'Unknown';
		} else if (ua.includes('Safari') && !ua.includes('Chrome')) {
			browserName = 'Safari';
			const match = ua.match(/Version\/([\d.]+)/);
			browserVersion = match ? match[1] : 'Unknown';
		} else if (ua.includes('Edg')) {
			browserName = 'Edge';
			const match = ua.match(/Edg\/([\d.]+)/);
			browserVersion = match ? match[1] : 'Unknown';
		}

		return {
			userAgent: ua,
			browserName,
			browserVersion,
			platform: navigator.platform,
			language: navigator.language,
			languages: navigator.languages ? Array.from(navigator.languages) : [navigator.language],
			cookieEnabled: navigator.cookieEnabled,
			onlineStatus: navigator.onLine,
			javaEnabled: navigator.javaEnabled ? navigator.javaEnabled() : false
		};
	}

	// システム情報を取得
	function getSystemInfo(): SystemInfo {
		const now = new Date();
		const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

		return {
			screenWidth: screen.width,
			screenHeight: screen.height,
			availWidth: screen.availWidth,
			availHeight: screen.availHeight,
			colorDepth: screen.colorDepth,
			pixelDepth: screen.pixelDepth,
			timezone,
			timezoneOffset: now.getTimezoneOffset(),
			currentTime: now.toLocaleString()
		};
	}

	// ネットワーク情報を取得
	function getNetworkInfo(): NetworkInfo | null {
		const connection =
			// @ts-expect-error - navigator.connectionは実験的なAPI
			navigator.connection || navigator.mozConnection || navigator.webkitConnection;

		if (!connection) return null;

		return {
			connectionType: connection.type || connection.effectiveType || 'Unknown',
			downlink: connection.downlink || 0,
			effectiveType: connection.effectiveType || 'Unknown',
			rtt: connection.rtt || 0,
			saveData: connection.saveData || false
		};
	}

	// IP情報を外部APIから取得
	async function fetchIPInfo(): Promise<IPInfo | null> {
		try {
			const response = await fetch('https://ipapi.co/json/');
			if (!response.ok) throw new Error('IP情報の取得に失敗しました');
			const data = await response.json();

			return {
				ip: data.ip || 'Unknown',
				city: data.city || 'Unknown',
				region: data.region || 'Unknown',
				country: data.country_name || 'Unknown',
				countryCode: data.country_code || 'Unknown',
				timezone: data.timezone || 'Unknown',
				latitude: data.latitude || 0,
				longitude: data.longitude || 0,
				org: data.org || 'Unknown',
				postal: data.postal || 'Unknown'
			};
		} catch (err) {
			console.error('IP情報取得エラー:', err);
			return null;
		}
	}

	// すべての情報を取得
	async function loadAllInfo() {
		isLoading = true;
		error = '';

		try {
			// ローカル情報は即座に取得
			browserInfo = parseBrowserInfo();
			systemInfo = getSystemInfo();
			networkInfo = getNetworkInfo();

			// IP情報は外部APIから取得
			ipInfo = await fetchIPInfo();
		} catch (err) {
			error = (err as Error).message;
		} finally {
			isLoading = false;
		}
	}

	// コンポーネントマウント時に情報を取得
	onMount(() => {
		loadAllInfo();
	});

	// クリップボードにコピー
	async function copyToClipboard(text: string) {
		try {
			await navigator.clipboard.writeText(text);
		} catch (err) {
			console.error('クリップボードへのコピーに失敗:', err);
		}
	}

	// すべての情報をテキスト形式で取得
	function getAllInfoAsText(): string {
		let result = '=== 接続元情報 ===\n\n';

		if (ipInfo) {
			result += '【IP情報】\n';
			result += `IPアドレス: ${ipInfo.ip}\n`;
			result += `国/地域: ${ipInfo.country} (${ipInfo.countryCode})\n`;
			result += `州/県: ${ipInfo.region}\n`;
			result += `都市: ${ipInfo.city}\n`;
			result += `郵便番号: ${ipInfo.postal}\n`;
			result += `タイムゾーン: ${ipInfo.timezone}\n`;
			result += `緯度経度: ${ipInfo.latitude}, ${ipInfo.longitude}\n`;
			result += `プロバイダ: ${ipInfo.org}\n\n`;
		}

		if (browserInfo) {
			result += '【ブラウザ情報】\n';
			result += `ブラウザ: ${browserInfo.browserName} ${browserInfo.browserVersion}\n`;
			result += `プラットフォーム: ${browserInfo.platform}\n`;
			result += `言語: ${browserInfo.language}\n`;
			result += `対応言語: ${browserInfo.languages.join(', ')}\n`;
			result += `Cookie有効: ${browserInfo.cookieEnabled ? 'はい' : 'いいえ'}\n`;
			result += `オンライン状態: ${browserInfo.onlineStatus ? 'オンライン' : 'オフライン'}\n`;
			result += `User-Agent: ${browserInfo.userAgent}\n\n`;
		}

		if (systemInfo) {
			result += '【システム情報】\n';
			result += `画面解像度: ${systemInfo.screenWidth} x ${systemInfo.screenHeight}\n`;
			result += `利用可能解像度: ${systemInfo.availWidth} x ${systemInfo.availHeight}\n`;
			result += `色深度: ${systemInfo.colorDepth}bit\n`;
			result += `ピクセル深度: ${systemInfo.pixelDepth}bit\n`;
			result += `タイムゾーン: ${systemInfo.timezone}\n`;
			result += `UTC差分: ${systemInfo.timezoneOffset}分\n`;
			result += `現在時刻: ${systemInfo.currentTime}\n\n`;
		}

		if (networkInfo) {
			result += '【ネットワーク情報】\n';
			result += `接続タイプ: ${networkInfo.connectionType}\n`;
			result += `実効タイプ: ${networkInfo.effectiveType}\n`;
			result += `下り帯域: ${networkInfo.downlink} Mbps\n`;
			result += `往復遅延: ${networkInfo.rtt} ms\n`;
			result += `データセーバー: ${networkInfo.saveData ? 'オン' : 'オフ'}\n`;
		}

		return result;
	}

	function copyAllInfo() {
		const allInfo = getAllInfoAsText();
		copyToClipboard(allInfo);
	}
</script>

<div class="mx-auto max-w-6xl">
	<div class="mb-6 flex items-center justify-between">
		<div class="flex items-center">
			{#if tool?.icon}<Icon icon={tool.icon} class="mr-4 h-10 w-10" />{/if}
			<h1 class="text-3xl font-bold">{tool?.nameJa}</h1>
		</div>
		<div class="flex gap-3">
			<button
				on:click={loadAllInfo}
				disabled={isLoading}
				class="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
			>
				{#if isLoading}
					<div class="flex items-center">
						<div class="mr-2 h-4 w-4 animate-spin rounded-full border-b-2 border-white"></div>
						更新中...
					</div>
				{:else}
					<Icon icon="mdi:refresh" class="mr-2 inline h-4 w-4" />
					更新
				{/if}
			</button>
			<button
				on:click={copyAllInfo}
				class="rounded bg-green-600 px-4 py-2 text-white hover:bg-green-700"
			>
				<Icon icon="mdi:content-copy" class="mr-2 inline h-4 w-4" />
				すべてコピー
			</button>
		</div>
	</div>

	{#if error}
		<div class="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
			<Icon icon="mdi:alert-circle" class="mr-2 inline h-5 w-5" />
			エラー: {error}
		</div>
	{/if}

	<div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
		<!-- IP情報 -->
		<div class="rounded-lg border border-gray-200 bg-white p-6">
			<div class="mb-4 flex items-center justify-between">
				<div class="flex items-center">
					<Icon icon="mdi:ip" class="mr-2 h-6 w-6 text-blue-600" />
					<h2 class="text-xl font-semibold text-gray-900">IP情報</h2>
				</div>
				{#if ipInfo}
					<button
						on:click={() => copyToClipboard(JSON.stringify(ipInfo, null, 2))}
						class="rounded bg-gray-100 px-3 py-1 text-xs text-gray-600 hover:bg-gray-200"
					>
						<Icon icon="mdi:content-copy" class="inline h-3 w-3" />
					</button>
				{/if}
			</div>

			{#if isLoading}
				<div class="flex items-center justify-center py-8">
					<div class="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600"></div>
				</div>
			{:else if ipInfo}
				<div class="space-y-3">
					<div class="flex justify-between">
						<span class="font-medium text-gray-700">IPアドレス:</span>
						<span class="font-mono text-gray-900">{ipInfo.ip}</span>
					</div>
					<div class="flex justify-between">
						<span class="font-medium text-gray-700">国/地域:</span>
						<span class="text-gray-900">{ipInfo.country} ({ipInfo.countryCode})</span>
					</div>
					<div class="flex justify-between">
						<span class="font-medium text-gray-700">州/県:</span>
						<span class="text-gray-900">{ipInfo.region}</span>
					</div>
					<div class="flex justify-between">
						<span class="font-medium text-gray-700">都市:</span>
						<span class="text-gray-900">{ipInfo.city}</span>
					</div>
					<div class="flex justify-between">
						<span class="font-medium text-gray-700">郵便番号:</span>
						<span class="text-gray-900">{ipInfo.postal}</span>
					</div>
					<div class="flex justify-between">
						<span class="font-medium text-gray-700">タイムゾーン:</span>
						<span class="text-gray-900">{ipInfo.timezone}</span>
					</div>
					<div class="flex justify-between">
						<span class="font-medium text-gray-700">緯度経度:</span>
						<span class="font-mono text-gray-900">{ipInfo.latitude}, {ipInfo.longitude}</span>
					</div>
					<div class="flex justify-between">
						<span class="font-medium text-gray-700">プロバイダ:</span>
						<span class="text-sm text-gray-900">{ipInfo.org}</span>
					</div>
				</div>
			{:else}
				<div class="py-8 text-center text-gray-500">IP情報を取得できませんでした</div>
			{/if}
		</div>

		<!-- ブラウザ情報 -->
		<div class="rounded-lg border border-gray-200 bg-white p-6">
			<div class="mb-4 flex items-center justify-between">
				<div class="flex items-center">
					<Icon icon="mdi:web" class="mr-2 h-6 w-6 text-green-600" />
					<h2 class="text-xl font-semibold text-gray-900">ブラウザ情報</h2>
				</div>
				{#if browserInfo}
					<button
						on:click={() => copyToClipboard(JSON.stringify(browserInfo, null, 2))}
						class="rounded bg-gray-100 px-3 py-1 text-xs text-gray-600 hover:bg-gray-200"
					>
						<Icon icon="mdi:content-copy" class="inline h-3 w-3" />
					</button>
				{/if}
			</div>

			{#if browserInfo}
				<div class="space-y-3">
					<div class="flex justify-between">
						<span class="font-medium text-gray-700">ブラウザ:</span>
						<span class="text-gray-900">{browserInfo.browserName} {browserInfo.browserVersion}</span
						>
					</div>
					<div class="flex justify-between">
						<span class="font-medium text-gray-700">プラットフォーム:</span>
						<span class="text-gray-900">{browserInfo.platform}</span>
					</div>
					<div class="flex justify-between">
						<span class="font-medium text-gray-700">言語:</span>
						<span class="text-gray-900">{browserInfo.language}</span>
					</div>
					<div class="flex justify-between">
						<span class="font-medium text-gray-700">Cookie有効:</span>
						<span class="text-gray-900">{browserInfo.cookieEnabled ? 'はい' : 'いいえ'}</span>
					</div>
					<div class="flex justify-between">
						<span class="font-medium text-gray-700">オンライン:</span>
						<span class="text-gray-900"
							>{browserInfo.onlineStatus ? 'オンライン' : 'オフライン'}</span
						>
					</div>
					<div class="col-span-2">
						<span class="font-medium text-gray-700">User-Agent:</span>
						<p class="mt-1 font-mono text-xs break-all text-gray-600">{browserInfo.userAgent}</p>
					</div>
				</div>
			{/if}
		</div>

		<!-- システム情報 -->
		<div class="rounded-lg border border-gray-200 bg-white p-6">
			<div class="mb-4 flex items-center justify-between">
				<div class="flex items-center">
					<Icon icon="mdi:monitor" class="mr-2 h-6 w-6 text-purple-600" />
					<h2 class="text-xl font-semibold text-gray-900">システム情報</h2>
				</div>
				{#if systemInfo}
					<button
						on:click={() => copyToClipboard(JSON.stringify(systemInfo, null, 2))}
						class="rounded bg-gray-100 px-3 py-1 text-xs text-gray-600 hover:bg-gray-200"
					>
						<Icon icon="mdi:content-copy" class="inline h-3 w-3" />
					</button>
				{/if}
			</div>

			{#if systemInfo}
				<div class="space-y-3">
					<div class="flex justify-between">
						<span class="font-medium text-gray-700">画面解像度:</span>
						<span class="font-mono text-gray-900"
							>{systemInfo.screenWidth} × {systemInfo.screenHeight}</span
						>
					</div>
					<div class="flex justify-between">
						<span class="font-medium text-gray-700">利用可能解像度:</span>
						<span class="font-mono text-gray-900"
							>{systemInfo.availWidth} × {systemInfo.availHeight}</span
						>
					</div>
					<div class="flex justify-between">
						<span class="font-medium text-gray-700">色深度:</span>
						<span class="text-gray-900">{systemInfo.colorDepth}bit</span>
					</div>
					<div class="flex justify-between">
						<span class="font-medium text-gray-700">ピクセル深度:</span>
						<span class="text-gray-900">{systemInfo.pixelDepth}bit</span>
					</div>
					<div class="flex justify-between">
						<span class="font-medium text-gray-700">タイムゾーン:</span>
						<span class="text-gray-900">{systemInfo.timezone}</span>
					</div>
					<div class="flex justify-between">
						<span class="font-medium text-gray-700">UTC差分:</span>
						<span class="text-gray-900">{systemInfo.timezoneOffset}分</span>
					</div>
					<div class="flex justify-between">
						<span class="font-medium text-gray-700">現在時刻:</span>
						<span class="text-gray-900">{systemInfo.currentTime}</span>
					</div>
				</div>
			{/if}
		</div>

		<!-- ネットワーク情報 -->
		<div class="rounded-lg border border-gray-200 bg-white p-6">
			<div class="mb-4 flex items-center justify-between">
				<div class="flex items-center">
					<Icon icon="mdi:wifi" class="mr-2 h-6 w-6 text-orange-600" />
					<h2 class="text-xl font-semibold text-gray-900">ネットワーク情報</h2>
				</div>
				{#if networkInfo}
					<button
						on:click={() => copyToClipboard(JSON.stringify(networkInfo, null, 2))}
						class="rounded bg-gray-100 px-3 py-1 text-xs text-gray-600 hover:bg-gray-200"
					>
						<Icon icon="mdi:content-copy" class="inline h-3 w-3" />
					</button>
				{/if}
			</div>

			{#if networkInfo}
				<div class="space-y-3">
					<div class="flex justify-between">
						<span class="font-medium text-gray-700">接続タイプ:</span>
						<span class="text-gray-900">{networkInfo.connectionType}</span>
					</div>
					<div class="flex justify-between">
						<span class="font-medium text-gray-700">実効タイプ:</span>
						<span class="text-gray-900">{networkInfo.effectiveType}</span>
					</div>
					<div class="flex justify-between">
						<span class="font-medium text-gray-700">下り帯域:</span>
						<span class="text-gray-900">{networkInfo.downlink} Mbps</span>
					</div>
					<div class="flex justify-between">
						<span class="font-medium text-gray-700">往復遅延:</span>
						<span class="text-gray-900">{networkInfo.rtt} ms</span>
					</div>
					<div class="flex justify-between">
						<span class="font-medium text-gray-700">データセーバー:</span>
						<span class="text-gray-900">{networkInfo.saveData ? 'オン' : 'オフ'}</span>
					</div>
				</div>
			{:else}
				<div class="py-8 text-center text-gray-500">
					ネットワーク情報は利用できません<br />
					<span class="text-xs">(ブラウザが対応していません)</span>
				</div>
			{/if}
		</div>
	</div>

	<!-- 注意事項 -->
	<div class="mt-6 rounded-lg border border-yellow-200 bg-yellow-50 p-4">
		<div class="flex items-start">
			<Icon icon="mdi:information-outline" class="mt-0.5 mr-2 h-5 w-5 text-yellow-600" />
			<div class="text-sm text-yellow-800">
				<p class="mb-1 font-medium">プライバシーについて</p>
				<ul class="space-y-1 text-xs">
					<li>• IP情報は外部API（ipapi.co）から取得されます</li>
					<li>• ブラウザ・システム情報はローカルで取得され、外部に送信されません</li>
					<li>• ネットワーク情報は一部のブラウザでのみ利用可能です</li>
					<li>• 情報は定期的に更新されない場合があります</li>
				</ul>
			</div>
		</div>
	</div>
</div>

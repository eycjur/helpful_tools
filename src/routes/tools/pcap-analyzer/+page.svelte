<script lang="ts">
	import { tools } from '$lib/data/tools';
	import Icon from '@iconify/svelte';
	import { onDestroy } from 'svelte';
	import {
		parsePcapFile,
		getLinkTypeName,
		type PcapAnalysisResult,
		type ParsedPacket
	} from './pcap-parser';
	import PacketDetailView from './PacketDetailView.svelte';
	import PacketFilterPanel from './PacketFilterPanel.svelte';

	const tool = tools.find((t) => t.name === 'pcap-analyzer');

	// ファイルサイズ警告しきい値（100MB以上で警告）
	const FILE_SIZE_WARNING_THRESHOLD = 100 * 1024 * 1024;

	let result: PcapAnalysisResult | null = null;
	let isLoading = false;
	let dragOver = false;
	let warnings: Array<{ message: string; type: 'warning' | 'error' }> = [];
	let fileName = '';

	// パケットビューア用のstate
	let selectedTab: 'statistics' | 'packets' = 'statistics';
	let selectedPacketIndex: number | null = null;
	let filterProtocol = '';
	let filterSourceIp = '';
	let filterDestinationIp = '';
	let filterSourcePort = '';
	let filterDestinationPort = '';
	let searchQuery = '';
	let groupBy: 'none' | 'dns' | 'conversation' = 'none';
	let expandedGroups = new Set<string>();

	function formatFileSize(bytes: number): string {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
		return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
	}

	function formatDuration(seconds: number): string {
		if (seconds < 60) return `${seconds.toFixed(2)}秒`;
		const minutes = Math.floor(seconds / 60);
		const secs = seconds % 60;
		return `${minutes}分${secs.toFixed(2)}秒`;
	}

	function formatTimestamp(timestamp: number): string {
		const date = new Date(timestamp * 1000);
		return date.toLocaleString('ja-JP');
	}

	function calculateThroughput(totalBytes: number, durationSeconds: number): string {
		if (durationSeconds === 0) return 'N/A';
		const bytesPerSecond = totalBytes / durationSeconds;
		const bitsPerSecond = bytesPerSecond * 8;

		if (bitsPerSecond < 1000) return `${bitsPerSecond.toFixed(2)} bps`;
		if (bitsPerSecond < 1000000) return `${(bitsPerSecond / 1000).toFixed(2)} Kbps`;
		if (bitsPerSecond < 1000000000) return `${(bitsPerSecond / 1000000).toFixed(2)} Mbps`;
		return `${(bitsPerSecond / 1000000000).toFixed(2)} Gbps`;
	}

	function getTopEntries<T extends string | number>(
		obj: Record<T, number>,
		limit = 10
	): Array<[T, number]> {
		return Object.entries(obj)
			.map(([key, value]) => [key as T, value as number] as [T, number])
			.sort((a, b) => b[1] - a[1])
			.slice(0, limit);
	}

	async function processPcapFile(file: File) {
		isLoading = true;
		result = null;
		warnings = [];
		fileName = file.name;

		// ファイルサイズの警告チェック
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
			const arrayBuffer = await file.arrayBuffer();
			result = await parsePcapFile(arrayBuffer);
		} catch (err) {
			console.error('Pcap処理エラー:', err);
			warnings = [
				...warnings,
				{
					message: err instanceof Error ? err.message : 'Pcapファイルの処理に失敗しました',
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
			processPcapFile(input.files[0]);
			input.value = '';
		}
	}

	function onDrop(e: DragEvent) {
		e.preventDefault();
		dragOver = false;
		const file = e.dataTransfer?.files?.[0];
		if (file) {
			processPcapFile(file);
		}
	}

	function clearAll() {
		result = null;
		warnings = [];
		fileName = '';
		selectedTab = 'statistics';
		selectedPacketIndex = null;
		filterProtocol = '';
		filterSourceIp = '';
		filterDestinationIp = '';
		filterSourcePort = '';
		filterDestinationPort = '';
		searchQuery = '';
		groupBy = 'none';
		expandedGroups = new Set<string>();
	}

	function formatPacketTime(timestamp: number, baseTime: number): string {
		const relative = timestamp - baseTime;
		return relative.toFixed(6);
	}

	function getPacketInfo(packet: ParsedPacket): string {
		// DNS情報を優先表示（レスポンスを優先）
		if (packet.dns) {
			// レスポンスの場合（answersが存在する場合）
			if (packet.dns.answers && packet.dns.answers.length > 0) {
				const answer = packet.dns.answers[0];
				if (answer) {
					return `Response ${answer.data}`;
				}
			}
			// クエリの場合
			if (packet.dns.queryName) {
				const queryType = packet.dns.queryType === 1 ? 'A' : packet.dns.queryType === 28 ? 'AAAA' : packet.dns.queryType === 5 ? 'CNAME' : `Type${packet.dns.queryType}`;
				return `Query ${queryType} ${packet.dns.queryName}`;
			}
		}

		if (packet.tcp) {
			const flags = [];
			if (packet.tcp.flags & 0x02) flags.push('SYN');
			if (packet.tcp.flags & 0x10) flags.push('ACK');
			if (packet.tcp.flags & 0x01) flags.push('FIN');
			if (packet.tcp.flags & 0x04) flags.push('RST');
			if (packet.tcp.flags & 0x08) flags.push('PSH');
			return flags.length > 0 ? flags.join(',') : 'TCP';
		}
		if (packet.udp) {
			return `Len=${packet.udp.length}`;
		}
		return packet.protocol;
	}


	function filterPackets(packets: ParsedPacket[]): ParsedPacket[] {
		return packets.filter((packet) => {
			// プロトコルフィルター
			if (filterProtocol && packet.protocol !== filterProtocol) return false;

			// 送信元IPフィルター
			if (filterSourceIp && packet.ipv4?.sourceIp !== filterSourceIp) return false;

			// 宛先IPフィルター
			if (filterDestinationIp && packet.ipv4?.destinationIp !== filterDestinationIp) return false;

			// 送信元ポートフィルター
			if (filterSourcePort) {
				const port = parseInt(filterSourcePort, 10);
				if (
					(!packet.tcp || packet.tcp.sourcePort !== port) &&
					(!packet.udp || packet.udp.sourcePort !== port)
				)
					return false;
			}

			// 宛先ポートフィルター
			if (filterDestinationPort) {
				const port = parseInt(filterDestinationPort, 10);
				if (
					(!packet.tcp || packet.tcp.destinationPort !== port) &&
					(!packet.udp || packet.udp.destinationPort !== port)
				)
					return false;
			}

			// ペイロード検索
			if (searchQuery && packet.payload) {
				const text = new TextDecoder('utf-8', { fatal: false }).decode(packet.payload);

				// ReDoS攻撃対策: 危険な正規表現パターンを検出
				const dangerousPatterns = /(\.\*){2,}|(\+\*)|(\*\+)|(\{[0-9]{4,}\})/;
				if (dangerousPatterns.test(searchQuery)) {
					// 危険なパターンは文字列検索にフォールバック
					if (!text.toLowerCase().includes(searchQuery.toLowerCase())) return false;
				} else {
					try {
						const regex = new RegExp(searchQuery, 'i');
						if (!regex.test(text)) return false;
					} catch {
						// 正規表現エラーの場合は文字列検索にフォールバック
						if (!text.toLowerCase().includes(searchQuery.toLowerCase())) return false;
					}
				}
			}

			return true;
		});
	}

	type PacketGroup = {
		key: string;
		label: string;
		packets: ParsedPacket[];
		count: number;
	};

	function groupPackets(packets: ParsedPacket[]): PacketGroup[] {
		if (groupBy === 'none') {
			return [];
		}

		const groups = new Map<string, ParsedPacket[]>();

		for (const packet of packets) {
			let key: string;
			let label: string;

			if (groupBy === 'dns') {
				// DNSクエリ名でグループ化
				if (packet.dns?.queryName) {
					key = packet.dns.queryName;
					label = `DNS: ${packet.dns.queryName}`;
				} else {
					key = '_no_dns';
					label = 'Non-DNS or Unknown';
				}
			} else if (groupBy === 'conversation') {
				// 会話（送信元⇄宛先）でグループ化
				const srcIp = packet.ipv4?.sourceIp ?? 'unknown';
				const dstIp = packet.ipv4?.destinationIp ?? 'unknown';
				const srcPort = packet.tcp?.sourcePort ?? packet.udp?.sourcePort ?? 0;
				const dstPort = packet.tcp?.destinationPort ?? packet.udp?.destinationPort ?? 0;

				// 会話は双方向なので、IP:Portペアを正規化
				const conv1 = `${srcIp}:${srcPort} ⇄ ${dstIp}:${dstPort}`;
				const conv2 = `${dstIp}:${dstPort} ⇄ ${srcIp}:${srcPort}`;
				key = conv1 < conv2 ? conv1 : conv2;
				label = `${srcIp}:${srcPort} ⇄ ${dstIp}:${dstPort}`;
			} else {
				key = '_unknown';
				label = 'Unknown';
			}

			if (!groups.has(key)) {
				groups.set(key, []);
			}
			groups.get(key)!.push(packet);
		}

		// グループを配列に変換してソート
		return Array.from(groups.entries())
			.map(([key, packets]) => ({
				key,
				label: packets[0] ? (groupBy === 'dns' ? `DNS: ${packets[0].dns?.queryName ?? 'Unknown'}` :
					`${packets[0].ipv4?.sourceIp ?? '?'}:${packets[0].tcp?.sourcePort ?? packets[0].udp?.sourcePort ?? '?'} ⇄ ${packets[0].ipv4?.destinationIp ?? '?'}:${packets[0].tcp?.destinationPort ?? packets[0].udp?.destinationPort ?? '?'}`) : 'Unknown',
				packets,
				count: packets.length
			}))
			.sort((a, b) => b.count - a.count); // パケット数の多い順
	}

	function toggleGroup(key: string) {
		if (expandedGroups.has(key)) {
			expandedGroups.delete(key);
		} else {
			expandedGroups.add(key);
		}
		expandedGroups = expandedGroups; // Svelteリアクティビティのため再代入
	}

	onDestroy(() => {
		// 現時点でクリーンアップ不要
		// 将来的にWorker等を使用する場合はここでクリーンアップ
	});
</script>

<div class="mx-auto max-w-4xl">
	<div class="mb-6 flex items-center">
		{#if tool?.icon}<Icon icon={tool.icon} class="mr-4 h-10 w-10" />{/if}
		<h1 class="text-3xl font-bold">{tool?.nameJa}</h1>
	</div>

	<p class="mb-6 text-gray-600">
		Pcap/Pcapngファイルを解析し、基本情報、パケット統計、プロトコル分布、IPアドレス分布、ポート番号分布を表示します。
	</p>

	<!-- ファイル入力エリア -->
	<div
		role="button"
		tabindex="0"
		aria-label="Pcapファイルをドラッグ&ドロップまたはクリックして選択"
		on:dragover|preventDefault={() => (dragOver = true)}
		on:dragleave={() => (dragOver = false)}
		on:drop={onDrop}
		on:click={() => document.getElementById('pcap-file-input')?.click()}
		on:keydown={(e) => {
			if (e.key === 'Enter' || e.key === ' ') {
				e.preventDefault();
				document.getElementById('pcap-file-input')?.click();
			}
		}}
		class="mb-4 flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 text-center transition-colors {dragOver
			? 'border-blue-400 bg-blue-50'
			: 'border-gray-300 bg-gray-50'}"
	>
		<Icon icon="mdi:cloud-upload" class="mb-2 h-12 w-12 text-gray-400" />
		<p class="mb-2 text-gray-700">Pcap/Pcapngファイルをドラッグ＆ドロップ</p>
		<p class="mb-3 text-xs text-gray-500">または、クリックして選択</p>
		<input
			id="pcap-file-input"
			type="file"
			accept=".pcap,.pcapng,.cap"
			on:change={onFileInput}
			class="hidden"
		/>
	</div>

	{#if isLoading}
		<div class="flex items-center justify-center p-8">
			<Icon icon="mdi:loading" class="h-8 w-8 animate-spin text-blue-500" />
			<span class="ml-2 text-gray-600">解析中...</span>
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

	{#if result}
		<div class="mb-4 flex items-center justify-between">
			<!-- タブ切り替え -->
			<div class="flex space-x-2">
				<button
					on:click={() => (selectedTab = 'statistics')}
					class="rounded px-4 py-2 {selectedTab === 'statistics'
						? 'bg-blue-500 text-white'
						: 'bg-gray-200 text-gray-700 hover:bg-gray-300'}"
				>
					<Icon icon="mdi:chart-box-outline" class="mr-1 inline h-5 w-5" />
					統計
				</button>
				<button
					on:click={() => (selectedTab = 'packets')}
					class="rounded px-4 py-2 {selectedTab === 'packets'
						? 'bg-blue-500 text-white'
						: 'bg-gray-200 text-gray-700 hover:bg-gray-300'}"
				>
					<Icon icon="mdi:package-variant" class="mr-1 inline h-5 w-5" />
					パケット ({filterPackets(result.packets).length})
				</button>
			</div>

			<button on:click={clearAll} class="rounded bg-gray-500 px-4 py-2 text-white hover:bg-gray-600"
				>クリア</button
			>
		</div>

		{#if selectedTab === 'statistics'}
			<!-- ファイル情報 -->
			<div class="mb-6 overflow-hidden rounded-lg border border-gray-200 bg-white">
				<div class="border-b border-gray-200 bg-gray-50 px-4 py-3">
					<div class="flex items-center">
						<Icon icon="mdi:file-document-outline" class="mr-2 h-5 w-5 text-blue-600" />
						<h2 class="font-semibold text-gray-800">ファイル情報</h2>
					</div>
				</div>
				<div class="p-4">
					<dl class="grid grid-cols-1 gap-3 md:grid-cols-2">
						<div>
							<dt class="text-sm font-medium text-gray-500">ファイル名</dt>
							<dd class="mt-1 text-sm break-all text-gray-900">{fileName}</dd>
						</div>
						<div>
							<dt class="text-sm font-medium text-gray-500">Pcapバージョン</dt>
							<dd class="mt-1 text-sm text-gray-900">
								{result.globalHeader.versionMajor}.{result.globalHeader.versionMinor}
							</dd>
						</div>
						<div>
							<dt class="text-sm font-medium text-gray-500">リンク層タイプ</dt>
							<dd class="mt-1 text-sm text-gray-900">
								{getLinkTypeName(result.globalHeader.network)}
							</dd>
						</div>
						<div>
							<dt class="text-sm font-medium text-gray-500">スナップ長</dt>
							<dd class="mt-1 text-sm text-gray-900">{result.globalHeader.snapLen} bytes</dd>
						</div>
						<div>
							<dt class="text-sm font-medium text-gray-500">エンディアン</dt>
							<dd class="mt-1 text-sm text-gray-900">
								{result.globalHeader.isLittleEndian ? 'Little Endian' : 'Big Endian'}
							</dd>
						</div>
					</dl>
				</div>
			</div>

			<!-- パケット統計 -->
			<div class="mb-6 overflow-hidden rounded-lg border border-gray-200 bg-white">
				<div class="border-b border-gray-200 bg-gray-50 px-4 py-3">
					<div class="flex items-center">
						<Icon icon="mdi:chart-box-outline" class="mr-2 h-5 w-5 text-blue-600" />
						<h2 class="font-semibold text-gray-800">パケット統計</h2>
					</div>
				</div>
				<div class="p-4">
					<dl class="grid grid-cols-1 gap-3 md:grid-cols-2">
						<div>
							<dt class="text-sm font-medium text-gray-500">総パケット数</dt>
							<dd class="mt-1 text-sm text-gray-900">
								{result.statistics.totalPackets.toLocaleString()} パケット
							</dd>
						</div>
						<div>
							<dt class="text-sm font-medium text-gray-500">総データ量</dt>
							<dd class="mt-1 text-sm text-gray-900">
								{formatFileSize(result.statistics.totalBytes)}
							</dd>
						</div>
						<div>
							<dt class="text-sm font-medium text-gray-500">平均パケットサイズ</dt>
							<dd class="mt-1 text-sm text-gray-900">
								{result.statistics.averagePacketSize.toFixed(2)} bytes
							</dd>
						</div>
						<div>
							<dt class="text-sm font-medium text-gray-500">キャプチャ期間</dt>
							<dd class="mt-1 text-sm text-gray-900">
								{formatDuration(
									result.statistics.captureEndTime - result.statistics.captureStartTime
								)}
							</dd>
						</div>
						<div>
							<dt class="text-sm font-medium text-gray-500">開始時刻</dt>
							<dd class="mt-1 text-sm text-gray-900">
								{formatTimestamp(result.statistics.captureStartTime)}
							</dd>
						</div>
						<div>
							<dt class="text-sm font-medium text-gray-500">終了時刻</dt>
							<dd class="mt-1 text-sm text-gray-900">
								{formatTimestamp(result.statistics.captureEndTime)}
							</dd>
						</div>
						<div class="md:col-span-2">
							<dt class="text-sm font-medium text-gray-500">平均スループット</dt>
							<dd class="mt-1 text-sm text-gray-900">
								{calculateThroughput(
									result.statistics.totalBytes,
									result.statistics.captureEndTime - result.statistics.captureStartTime
								)}
							</dd>
						</div>
					</dl>
				</div>
			</div>

			<!-- プロトコル分布 -->
			<div class="mb-6 overflow-hidden rounded-lg border border-gray-200 bg-white">
				<div class="border-b border-gray-200 bg-gray-50 px-4 py-3">
					<div class="flex items-center">
						<Icon icon="mdi:network-outline" class="mr-2 h-5 w-5 text-blue-600" />
						<h2 class="font-semibold text-gray-800">プロトコル分布</h2>
					</div>
				</div>
				<div class="p-4">
					<div class="space-y-2">
						{#each Object.entries(result.statistics.protocolDistribution).sort((a, b) => b[1] - a[1]) as [protocol, count] (protocol)}
							<div class="flex items-center justify-between">
								<span class="text-sm font-medium text-gray-700">{protocol}</span>
								<div class="flex items-center">
									<span class="mr-2 text-sm text-gray-600">{count.toLocaleString()} パケット</span>
									<span class="text-xs text-gray-500">
										({((count / result.statistics.totalPackets) * 100).toFixed(1)}%)
									</span>
								</div>
							</div>
							<div class="h-2 w-full rounded-full bg-gray-200">
								<div
									class="h-2 rounded-full bg-blue-500"
									style="width: {(count / result.statistics.totalPackets) * 100}%"
								></div>
							</div>
						{/each}
					</div>
				</div>
			</div>

			<!-- IPアドレス分布 -->
			<div class="mb-6 grid grid-cols-1 gap-6 md:grid-cols-2">
				<!-- 送信元IPアドレス Top 10 -->
				<div class="overflow-hidden rounded-lg border border-gray-200 bg-white">
					<div class="border-b border-gray-200 bg-gray-50 px-4 py-3">
						<div class="flex items-center">
							<Icon icon="mdi:arrow-up-bold" class="mr-2 h-5 w-5 text-green-600" />
							<h2 class="font-semibold text-gray-800">送信元IPアドレス Top 10</h2>
						</div>
					</div>
					<div class="p-4">
						<div class="space-y-2">
							{#each getTopEntries(result.statistics.sourceIps) as [ip, count] (ip)}
								<div class="flex items-center justify-between border-b border-gray-100 pb-2">
									<span class="font-mono text-sm text-gray-700">{ip}</span>
									<span class="text-xs text-gray-600">{count.toLocaleString()}</span>
								</div>
							{/each}
						</div>
					</div>
				</div>

				<!-- 宛先IPアドレス Top 10 -->
				<div class="overflow-hidden rounded-lg border border-gray-200 bg-white">
					<div class="border-b border-gray-200 bg-gray-50 px-4 py-3">
						<div class="flex items-center">
							<Icon icon="mdi:arrow-down-bold" class="mr-2 h-5 w-5 text-red-600" />
							<h2 class="font-semibold text-gray-800">宛先IPアドレス Top 10</h2>
						</div>
					</div>
					<div class="p-4">
						<div class="space-y-2">
							{#each getTopEntries(result.statistics.destinationIps) as [ip, count] (ip)}
								<div class="flex items-center justify-between border-b border-gray-100 pb-2">
									<span class="font-mono text-sm text-gray-700">{ip}</span>
									<span class="text-xs text-gray-600">{count.toLocaleString()}</span>
								</div>
							{/each}
						</div>
					</div>
				</div>
			</div>

			<!-- ポート番号分布 -->
			<div class="mb-6 grid grid-cols-1 gap-6 md:grid-cols-2">
				<!-- 送信元ポート Top 10 -->
				<div class="overflow-hidden rounded-lg border border-gray-200 bg-white">
					<div class="border-b border-gray-200 bg-gray-50 px-4 py-3">
						<div class="flex items-center">
							<Icon icon="mdi:export-variant" class="mr-2 h-5 w-5 text-green-600" />
							<h2 class="font-semibold text-gray-800">送信元ポート Top 10</h2>
						</div>
					</div>
					<div class="p-4">
						<div class="space-y-2">
							{#each getTopEntries(result.statistics.sourcePorts) as [port, count] (port)}
								<div class="flex items-center justify-between border-b border-gray-100 pb-2">
									<span class="font-mono text-sm text-gray-700">{port}</span>
									<span class="text-xs text-gray-600">{count.toLocaleString()}</span>
								</div>
							{/each}
						</div>
					</div>
				</div>

				<!-- 宛先ポート Top 10 -->
				<div class="overflow-hidden rounded-lg border border-gray-200 bg-white">
					<div class="border-b border-gray-200 bg-gray-50 px-4 py-3">
						<div class="flex items-center">
							<Icon icon="mdi:import" class="mr-2 h-5 w-5 text-red-600" />
							<h2 class="font-semibold text-gray-800">宛先ポート Top 10</h2>
						</div>
					</div>
					<div class="p-4">
						<div class="space-y-2">
							{#each getTopEntries(result.statistics.destinationPorts) as [port, count] (port)}
								<div class="flex items-center justify-between border-b border-gray-100 pb-2">
									<span class="font-mono text-sm text-gray-700">{port}</span>
									<span class="text-xs text-gray-600">{count.toLocaleString()}</span>
								</div>
							{/each}
						</div>
					</div>
				</div>
			</div>
		{:else}
			<!-- パケットビューア -->
			<!-- フィルター -->
			<PacketFilterPanel
				bind:filterProtocol
				bind:filterSourceIp
				bind:filterDestinationIp
				bind:filterSourcePort
				bind:filterDestinationPort
				bind:searchQuery
				bind:groupBy
			/>

			<!-- パケット一覧 -->
			<div class="mb-4 overflow-hidden rounded-lg border border-gray-200 bg-white">
				<div class="border-b border-gray-200 bg-gray-50 px-4 py-3">
					<div class="flex items-center">
						<Icon icon="mdi:package-variant" class="mr-2 h-5 w-5 text-blue-600" />
						<h2 class="font-semibold text-gray-800">パケット一覧</h2>
						<span class="ml-2 text-xs text-gray-500">
							({filterPackets(result.packets).length} / {result.packets.length} パケット)
						</span>
					</div>
				</div>
				<div class="overflow-x-auto">
					<table class="min-w-full divide-y divide-gray-200">
						<thead class="bg-gray-50">
							<tr>
								<th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">No</th>
								<th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Time</th
								>
								<th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
									Source
								</th>
								<th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
									Destination
								</th>
								<th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
									Protocol
								</th>
								<th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
									Length
								</th>
								<th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Info</th
								>
							</tr>
						</thead>
						<tbody class="divide-y divide-gray-200 bg-white">
							{#if groupBy === 'none'}
								<!-- グループ化なし：通常表示 -->
								{#each filterPackets(result.packets).slice(0, 1000) as packet (packet.index)}
								<tr
									class="cursor-pointer hover:bg-gray-50 {selectedPacketIndex === packet.index
										? 'bg-blue-50'
										: ''}"
									on:click={() =>
										(selectedPacketIndex =
											selectedPacketIndex === packet.index ? null : packet.index)}
									on:keydown={(e) => {
										if (e.key === 'Enter' || e.key === ' ') {
											e.preventDefault();
											selectedPacketIndex =
												selectedPacketIndex === packet.index ? null : packet.index;
										}
									}}
									role="button"
									tabindex="0"
								>
									<td class="px-4 py-2 text-sm text-gray-900">{packet.index + 1}</td>
									<td class="px-4 py-2 font-mono text-xs text-gray-900">
										{formatPacketTime(packet.timestamp, result.statistics.captureStartTime)}
									</td>
									<td class="px-4 py-2 font-mono text-xs text-gray-900">
										{#if packet.ipv4}
											{packet.ipv4.sourceIp}{#if packet.tcp || packet.udp}:{packet.tcp
													?.sourcePort ?? packet.udp?.sourcePort}{/if}
										{:else}
											-
										{/if}
									</td>
									<td class="px-4 py-2 font-mono text-xs text-gray-900">
										{#if packet.ipv4}
											{packet.ipv4.destinationIp}{#if packet.tcp || packet.udp}:{packet.tcp
													?.destinationPort ?? packet.udp?.destinationPort}{/if}
										{:else}
											-
										{/if}
									</td>
									<td class="px-4 py-2 text-sm text-gray-900">{packet.protocol}</td>
									<td class="px-4 py-2 text-sm text-gray-900">{packet.capturedLength}</td>
									<td class="px-4 py-2 text-sm text-gray-600">{getPacketInfo(packet)}</td>
								</tr>
								{#if selectedPacketIndex === packet.index}
									<tr>
										<td colspan="7" class="bg-gray-50 px-4 py-4">
											<!-- パケット詳細 -->
											<div class="space-y-4">
												<!-- Ethernet -->
												{#if packet.ethernet}
													<div>
														<h4 class="mb-2 font-semibold text-gray-800">Ethernet</h4>
														<dl class="grid grid-cols-2 gap-2 text-sm">
															<div>
																<dt class="font-medium text-gray-600">Source MAC:</dt>
																<dd class="font-mono text-gray-900">{packet.ethernet.sourceMac}</dd>
															</div>
															<div>
																<dt class="font-medium text-gray-600">Destination MAC:</dt>
																<dd class="font-mono text-gray-900">
																	{packet.ethernet.destinationMac}
																</dd>
															</div>
															<div>
																<dt class="font-medium text-gray-600">EtherType:</dt>
																<dd class="font-mono text-gray-900">
																	0x{packet.ethernet.etherType.toString(16).padStart(4, '0')}
																</dd>
															</div>
														</dl>
													</div>
												{/if}

												<!-- IPv4 -->
												{#if packet.ipv4}
													<div>
														<h4 class="mb-2 font-semibold text-gray-800">IPv4</h4>
														<dl class="grid grid-cols-2 gap-2 text-sm">
															<div>
																<dt class="font-medium text-gray-600">Source IP:</dt>
																<dd class="font-mono text-gray-900">{packet.ipv4.sourceIp}</dd>
															</div>
															<div>
																<dt class="font-medium text-gray-600">Destination IP:</dt>
																<dd class="font-mono text-gray-900">{packet.ipv4.destinationIp}</dd>
															</div>
															<div>
																<dt class="font-medium text-gray-600">Protocol:</dt>
																<dd class="font-mono text-gray-900">{packet.ipv4.protocol}</dd>
															</div>
															<div>
																<dt class="font-medium text-gray-600">TTL:</dt>
																<dd class="font-mono text-gray-900">{packet.ipv4.ttl}</dd>
															</div>
															<div>
																<dt class="font-medium text-gray-600">Total Length:</dt>
																<dd class="font-mono text-gray-900">{packet.ipv4.totalLength}</dd>
															</div>
															<div>
																<dt class="font-medium text-gray-600">Identification:</dt>
																<dd class="font-mono text-gray-900">
																	{packet.ipv4.identification}
																</dd>
															</div>
														</dl>
													</div>
												{/if}

												<!-- TCP -->
												{#if packet.tcp}
													<div>
														<h4 class="mb-2 font-semibold text-gray-800">TCP</h4>
														<dl class="grid grid-cols-2 gap-2 text-sm">
															<div>
																<dt class="font-medium text-gray-600">Source Port:</dt>
																<dd class="font-mono text-gray-900">{packet.tcp.sourcePort}</dd>
															</div>
															<div>
																<dt class="font-medium text-gray-600">Destination Port:</dt>
																<dd class="font-mono text-gray-900">
																	{packet.tcp.destinationPort}
																</dd>
															</div>
															<div>
																<dt class="font-medium text-gray-600">Sequence Number:</dt>
																<dd class="font-mono text-gray-900">{packet.tcp.sequenceNumber}</dd>
															</div>
															<div>
																<dt class="font-medium text-gray-600">Acknowledgment:</dt>
																<dd class="font-mono text-gray-900">
																	{packet.tcp.acknowledgmentNumber}
																</dd>
															</div>
															<div>
																<dt class="font-medium text-gray-600">Flags:</dt>
																<dd class="font-mono text-gray-900">
																	0x{packet.tcp.flags.toString(16).padStart(2, '0')} ({getPacketInfo(
																		packet
																	)})
																</dd>
															</div>
															<div>
																<dt class="font-medium text-gray-600">Window Size:</dt>
																<dd class="font-mono text-gray-900">{packet.tcp.windowSize}</dd>
															</div>
														</dl>
													</div>
												{/if}

												<!-- UDP -->
												{#if packet.udp}
													<div>
														<h4 class="mb-2 font-semibold text-gray-800">UDP</h4>
														<dl class="grid grid-cols-2 gap-2 text-sm">
															<div>
																<dt class="font-medium text-gray-600">Source Port:</dt>
																<dd class="font-mono text-gray-900">{packet.udp.sourcePort}</dd>
															</div>
															<div>
																<dt class="font-medium text-gray-600">Destination Port:</dt>
																<dd class="font-mono text-gray-900">
																	{packet.udp.destinationPort}
																</dd>
															</div>
															<div>
																<dt class="font-medium text-gray-600">Length:</dt>
																<dd class="font-mono text-gray-900">{packet.udp.length}</dd>
															</div>
															<div>
																<dt class="font-medium text-gray-600">Checksum:</dt>
																<dd class="font-mono text-gray-900">
																	0x{packet.udp.checksum.toString(16).padStart(4, '0')}
																</dd>
															</div>
														</dl>
													</div>
												{/if}

												<!-- DNS -->
												{#if packet.dns}
													<div>
														<h4 class="mb-2 font-semibold text-gray-800">DNS</h4>
														<dl class="grid grid-cols-1 gap-2 text-sm">
															{#if packet.dns.queryName}
																<div>
																	<dt class="font-medium text-gray-600">Query Name:</dt>
																	<dd class="font-mono text-gray-900">{packet.dns.queryName}</dd>
																</div>
															{/if}
															{#if packet.dns.queryType}
																<div>
																	<dt class="font-medium text-gray-600">Query Type:</dt>
																	<dd class="font-mono text-gray-900">
																		{packet.dns.queryType === 1
																			? 'A (IPv4)'
																			: packet.dns.queryType === 28
																				? 'AAAA (IPv6)'
																				: packet.dns.queryType === 5
																					? 'CNAME'
																					: `Type ${packet.dns.queryType}`}
																	</dd>
																</div>
															{/if}
															{#if packet.dns.answers && packet.dns.answers.length > 0}
																<div>
																	<dt class="font-medium text-gray-600">Answers:</dt>
																	<dd class="space-y-1">
																		{#each packet.dns.answers as answer}
																			<div class="font-mono text-xs text-gray-900">
																				{answer.name} → {answer.data}
																			</div>
																		{/each}
																	</dd>
																</div>
															{/if}
														</dl>
													</div>
												{/if}

												<!-- Payload (Hex Dump) -->
												{#if packet.payload && packet.payload.length > 0}
													<div>
														<h4 class="mb-2 font-semibold text-gray-800">
															Payload ({packet.payload.length} bytes)
														</h4>
														<pre
															class="overflow-x-auto rounded bg-gray-900 p-4 font-mono text-xs text-green-400">{formatHexDump(
																packet.payload
															)}</pre>
													</div>
												{/if}
											</div>
										</td>
									</tr>
								{/if}
								{/each}
							{:else}
								<!-- グループ化あり：グループ表示 -->
								{@const groups = groupPackets(filterPackets(result.packets))}
								{#each groups as group (group.key)}
									<!-- グループヘッダー -->
									<tr
										class="cursor-pointer bg-blue-100 hover:bg-blue-200"
										on:click={() => toggleGroup(group.key)}
										on:keydown={(e) => {
											if (e.key === 'Enter' || e.key === ' ') {
												e.preventDefault();
												toggleGroup(group.key);
											}
										}}
										role="button"
										tabindex="0"
									>
										<td colspan="7" class="px-4 py-3">
											<div class="flex items-center justify-between">
												<div class="flex items-center">
													<Icon
														icon={expandedGroups.has(group.key)
															? 'mdi:chevron-down'
															: 'mdi:chevron-right'}
														class="mr-2 h-5 w-5 text-blue-700"
													/>
													<span class="font-semibold text-blue-900">{group.label}</span>
												</div>
												<span class="text-sm font-medium text-blue-700"
													>{group.count} パケット</span
												>
											</div>
										</td>
									</tr>

									<!-- グループ内のパケット（展開時のみ表示） -->
									{#if expandedGroups.has(group.key)}
										{#each group.packets.slice(0, 1000) as packet (packet.index)}
											<tr
												class="cursor-pointer hover:bg-gray-50 {selectedPacketIndex === packet.index
													? 'bg-blue-50'
													: ''}"
												on:click={() =>
													(selectedPacketIndex =
														selectedPacketIndex === packet.index ? null : packet.index)}
												on:keydown={(e) => {
													if (e.key === 'Enter' || e.key === ' ') {
														e.preventDefault();
														selectedPacketIndex =
															selectedPacketIndex === packet.index ? null : packet.index;
													}
												}}
												role="button"
												tabindex="0"
											>
												<td class="px-4 py-2 text-sm text-gray-900">{packet.index + 1}</td>
												<td class="px-4 py-2 font-mono text-xs text-gray-900">
													{formatPacketTime(packet.timestamp, result.statistics.captureStartTime)}
												</td>
												<td class="px-4 py-2 font-mono text-xs text-gray-900">
													{#if packet.ipv4}
														{packet.ipv4.sourceIp}{#if packet.tcp || packet.udp}:{packet.tcp
																?.sourcePort ?? packet.udp?.sourcePort}{/if}
													{:else}
														-
													{/if}
												</td>
												<td class="px-4 py-2 font-mono text-xs text-gray-900">
													{#if packet.ipv4}
														{packet.ipv4.destinationIp}{#if packet.tcp || packet.udp}:{packet.tcp
																?.destinationPort ?? packet.udp?.destinationPort}{/if}
													{:else}
														-
													{/if}
												</td>
												<td class="px-4 py-2 text-sm text-gray-900">{packet.protocol}</td>
												<td class="px-4 py-2 text-sm text-gray-900">{packet.capturedLength}</td>
												<td class="px-4 py-2 text-sm text-gray-600">{getPacketInfo(packet)}</td>
											</tr>
											{#if selectedPacketIndex === packet.index}
												<tr>
													<td colspan="7" class="bg-gray-50 px-4 py-4">
														<!-- パケット詳細（グループ化版） -->
														<div class="space-y-4">
															<!-- Ethernet -->
															{#if packet.ethernet}
																<div>
																	<h4 class="mb-2 font-semibold text-gray-800">Ethernet</h4>
																	<dl class="grid grid-cols-2 gap-2 text-sm">
																		<div>
																			<dt class="font-medium text-gray-600">Source MAC:</dt>
																			<dd class="font-mono text-gray-900">
																				{packet.ethernet.sourceMac}
																			</dd>
																		</div>
																		<div>
																			<dt class="font-medium text-gray-600">Destination MAC:</dt>
																			<dd class="font-mono text-gray-900">
																				{packet.ethernet.destinationMac}
																			</dd>
																		</div>
																		<div>
																			<dt class="font-medium text-gray-600">EtherType:</dt>
																			<dd class="font-mono text-gray-900">
																				0x{packet.ethernet.etherType.toString(16).padStart(4, '0')}
																			</dd>
																		</div>
																	</dl>
																</div>
															{/if}

															<!-- IPv4 -->
															{#if packet.ipv4}
																<div>
																	<h4 class="mb-2 font-semibold text-gray-800">IPv4</h4>
																	<dl class="grid grid-cols-2 gap-2 text-sm">
																		<div>
																			<dt class="font-medium text-gray-600">Source IP:</dt>
																			<dd class="font-mono text-gray-900">{packet.ipv4.sourceIp}</dd>
																		</div>
																		<div>
																			<dt class="font-medium text-gray-600">Destination IP:</dt>
																			<dd class="font-mono text-gray-900">
																				{packet.ipv4.destinationIp}
																			</dd>
																		</div>
																		<div>
																			<dt class="font-medium text-gray-600">Protocol:</dt>
																			<dd class="font-mono text-gray-900">{packet.ipv4.protocol}</dd>
																		</div>
																		<div>
																			<dt class="font-medium text-gray-600">TTL:</dt>
																			<dd class="font-mono text-gray-900">{packet.ipv4.ttl}</dd>
																		</div>
																		<div>
																			<dt class="font-medium text-gray-600">Total Length:</dt>
																			<dd class="font-mono text-gray-900">{packet.ipv4.totalLength}</dd>
																		</div>
																		<div>
																			<dt class="font-medium text-gray-600">Identification:</dt>
																			<dd class="font-mono text-gray-900">
																				{packet.ipv4.identification}
																			</dd>
																		</div>
																	</dl>
																</div>
															{/if}

															<!-- TCP -->
															{#if packet.tcp}
																<div>
																	<h4 class="mb-2 font-semibold text-gray-800">TCP</h4>
																	<dl class="grid grid-cols-2 gap-2 text-sm">
																		<div>
																			<dt class="font-medium text-gray-600">Source Port:</dt>
																			<dd class="font-mono text-gray-900">{packet.tcp.sourcePort}</dd>
																		</div>
																		<div>
																			<dt class="font-medium text-gray-600">Destination Port:</dt>
																			<dd class="font-mono text-gray-900">
																				{packet.tcp.destinationPort}
																			</dd>
																		</div>
																		<div>
																			<dt class="font-medium text-gray-600">Sequence Number:</dt>
																			<dd class="font-mono text-gray-900">
																				{packet.tcp.sequenceNumber}
																			</dd>
																		</div>
																		<div>
																			<dt class="font-medium text-gray-600">Acknowledgment:</dt>
																			<dd class="font-mono text-gray-900">
																				{packet.tcp.acknowledgmentNumber}
																			</dd>
																		</div>
																		<div>
																			<dt class="font-medium text-gray-600">Flags:</dt>
																			<dd class="font-mono text-gray-900">
																				0x{packet.tcp.flags.toString(16).padStart(2, '0')} ({getPacketInfo(
																					packet
																				)})
																			</dd>
																		</div>
																		<div>
																			<dt class="font-medium text-gray-600">Window Size:</dt>
																			<dd class="font-mono text-gray-900">{packet.tcp.windowSize}</dd>
																		</div>
																	</dl>
																</div>
															{/if}

															<!-- UDP -->
															{#if packet.udp}
																<div>
																	<h4 class="mb-2 font-semibold text-gray-800">UDP</h4>
																	<dl class="grid grid-cols-2 gap-2 text-sm">
																		<div>
																			<dt class="font-medium text-gray-600">Source Port:</dt>
																			<dd class="font-mono text-gray-900">{packet.udp.sourcePort}</dd>
																		</div>
																		<div>
																			<dt class="font-medium text-gray-600">Destination Port:</dt>
																			<dd class="font-mono text-gray-900">
																				{packet.udp.destinationPort}
																			</dd>
																		</div>
																		<div>
																			<dt class="font-medium text-gray-600">Length:</dt>
																			<dd class="font-mono text-gray-900">{packet.udp.length}</dd>
																		</div>
																		<div>
																			<dt class="font-medium text-gray-600">Checksum:</dt>
																			<dd class="font-mono text-gray-900">
																				0x{packet.udp.checksum.toString(16).padStart(4, '0')}
																			</dd>
																		</div>
																	</dl>
																</div>
															{/if}

															<!-- DNS -->
															{#if packet.dns}
																<div>
																	<h4 class="mb-2 font-semibold text-gray-800">DNS</h4>
																	<dl class="grid grid-cols-1 gap-2 text-sm">
																		{#if packet.dns.queryName}
																			<div>
																				<dt class="font-medium text-gray-600">Query Name:</dt>
																				<dd class="font-mono text-gray-900">{packet.dns.queryName}</dd>
																			</div>
																		{/if}
																		{#if packet.dns.queryType}
																			<div>
																				<dt class="font-medium text-gray-600">Query Type:</dt>
																				<dd class="font-mono text-gray-900">
																					{packet.dns.queryType === 1
																						? 'A (IPv4)'
																						: packet.dns.queryType === 28
																							? 'AAAA (IPv6)'
																							: packet.dns.queryType === 5
																								? 'CNAME'
																								: `Type ${packet.dns.queryType}`}
																				</dd>
																			</div>
																		{/if}
																		{#if packet.dns.answers && packet.dns.answers.length > 0}
																			<div>
																				<dt class="font-medium text-gray-600">Answers:</dt>
																				<dd class="space-y-1">
																					{#each packet.dns.answers as answer}
																						<div class="font-mono text-xs text-gray-900">
																							{answer.name} → {answer.data}
																						</div>
																					{/each}
																				</dd>
																			</div>
																		{/if}
																	</dl>
																</div>
															{/if}

															<!-- Payload (Hex Dump) -->
															{#if packet.payload && packet.payload.length > 0}
																<div>
																	<h4 class="mb-2 font-semibold text-gray-800">
																		Payload ({packet.payload.length} bytes)
																	</h4>
																	<pre
																		class="overflow-x-auto rounded bg-gray-900 p-4 font-mono text-xs text-green-400">{formatHexDump(
																			packet.payload
																		)}</pre>
																</div>
															{/if}
														</div>
													</td>
												</tr>
											{/if}
										{/each}
									{/if}
								{/each}
							{/if}
						</tbody>
					</table>
					{#if filterPackets(result.packets).length > 1000}
						<div
							class="border-t border-gray-200 bg-gray-50 px-4 py-3 text-center text-sm text-gray-600"
						>
							表示制限: 最初の1000パケットのみ表示しています（全{filterPackets(result.packets)
								.length}パケット）
						</div>
					{/if}
				</div>
			</div>
		{/if}
	{/if}
</div>

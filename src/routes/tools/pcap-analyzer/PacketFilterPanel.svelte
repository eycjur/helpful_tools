<script lang="ts">
	export let filterProtocol = '';
	export let filterSourceIp = '';
	export let filterDestinationIp = '';
	export let filterSourcePort = '';
	export let filterDestinationPort = '';
	export let searchQuery = '';
	export let groupBy: 'none' | 'dns' | 'conversation' | 'info' = 'none';

	function clearAllFilters() {
		filterProtocol = '';
		filterSourceIp = '';
		filterDestinationIp = '';
		filterSourcePort = '';
		filterDestinationPort = '';
		searchQuery = '';
		groupBy = 'none';
	}
</script>

<div class="mb-4 overflow-hidden rounded-lg border border-gray-200 bg-white p-4">
	<div class="mb-3 flex items-center justify-between">
		<h3 class="font-semibold text-gray-800">フィルター & グループ化</h3>
		<button on:click={clearAllFilters} class="text-sm text-blue-600 hover:text-blue-800">
			すべてクリア
		</button>
	</div>

	<!-- グループ化オプション -->
	<div class="mb-3">
		<label for="group-by" class="mb-1 block text-xs font-medium text-gray-600">グループ化</label>
		<select
			id="group-by"
			bind:value={groupBy}
			class="w-full rounded border border-gray-300 px-3 py-2 text-sm md:w-auto"
		>
			<option value="none">なし</option>
			<option value="dns">DNSクエリ別</option>
			<option value="conversation">会話（IP:Port）別</option>
			<option value="info">Info（パケット情報）別</option>
		</select>
	</div>

	<div class="grid grid-cols-1 gap-3 md:grid-cols-3">
		<div>
			<label for="filter-protocol" class="mb-1 block text-xs font-medium text-gray-600"
				>プロトコル</label
			>
			<select
				id="filter-protocol"
				bind:value={filterProtocol}
				class="w-full rounded border border-gray-300 px-3 py-2 text-sm"
			>
				<option value="">すべて</option>
				<option value="TCP">TCP</option>
				<option value="UDP">UDP</option>
				<option value="ICMP">ICMP</option>
				<option value="ARP">ARP</option>
				<option value="IPv6">IPv6</option>
				<option value="Other">Other</option>
			</select>
		</div>
		<div>
			<label for="filter-source-ip" class="mb-1 block text-xs font-medium text-gray-600"
				>送信元IP</label
			>
			<input
				id="filter-source-ip"
				type="text"
				bind:value={filterSourceIp}
				placeholder="例: 192.168.1.1"
				class="w-full rounded border border-gray-300 px-3 py-2 text-sm"
			/>
		</div>
		<div>
			<label for="filter-dest-ip" class="mb-1 block text-xs font-medium text-gray-600">宛先IP</label
			>
			<input
				id="filter-dest-ip"
				type="text"
				bind:value={filterDestinationIp}
				placeholder="例: 192.168.1.1"
				class="w-full rounded border border-gray-300 px-3 py-2 text-sm"
			/>
		</div>
		<div>
			<label for="filter-source-port" class="mb-1 block text-xs font-medium text-gray-600"
				>送信元ポート</label
			>
			<input
				id="filter-source-port"
				type="number"
				bind:value={filterSourcePort}
				placeholder="例: 80"
				class="w-full rounded border border-gray-300 px-3 py-2 text-sm"
			/>
		</div>
		<div>
			<label for="filter-dest-port" class="mb-1 block text-xs font-medium text-gray-600"
				>宛先ポート</label
			>
			<input
				id="filter-dest-port"
				type="number"
				bind:value={filterDestinationPort}
				placeholder="例: 443"
				class="w-full rounded border border-gray-300 px-3 py-2 text-sm"
			/>
		</div>
		<div>
			<label for="filter-search" class="mb-1 block text-xs font-medium text-gray-600"
				>ペイロード検索</label
			>
			<input
				id="filter-search"
				type="text"
				bind:value={searchQuery}
				placeholder="正規表現または文字列"
				class="w-full rounded border border-gray-300 px-3 py-2 text-sm"
			/>
		</div>
	</div>
</div>

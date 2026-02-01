
<script lang="ts">
	import Icon from '@iconify/svelte';

	// JSON値の型定義
	type JsonValue = string | number | boolean | null | JsonObject | JsonArray;
	type JsonObject = { [key: string]: JsonValue };
	type JsonArray = JsonValue[];

	// Pythonオブジェクトの型定義
	type PythonObject = { __class__: string; [key: string]: JsonValue };

	// 全体のデータ型
	type DataValue = JsonValue | PythonObject;

	export let data: DataValue;
	export let depth = 0;
	export let maxDepth = 50;
	export let keyName: string | number | undefined = undefined;
	export let isLastItem = true;
	export let path = '';

	let isExpanded = true; // デフォルトで全て展開
	let showKeyTooltip = false;
	let showClassTooltip = false;
	let showValueTooltip = false;

	function toggleExpanded() {
		isExpanded = !isExpanded;
	}

	function copyPath(tooltipType: 'key' | 'class' | 'value') {
		if (!path) return;

		// モダンブラウザのClipboard APIを優先使用
		if (navigator.clipboard && navigator.clipboard.writeText) {
			navigator.clipboard
				.writeText(path)
				.then(() => {
					hideTooltip(tooltipType);
				})
				.catch((err) => {
					console.error('パスのコピーに失敗しました: ', err);
					// フォールバック処理
					fallbackCopyToClipboard(path, tooltipType);
				});
		} else {
			// 古いブラウザ向けのフォールバック
			fallbackCopyToClipboard(path, tooltipType);
		}
	}

	function fallbackCopyToClipboard(text: string, tooltipType: 'key' | 'class' | 'value') {
		try {
			const textarea = document.createElement('textarea');
			textarea.value = text;
			textarea.style.position = 'fixed';
			textarea.style.opacity = '0';
			document.body.appendChild(textarea);
			textarea.select();
			textarea.setSelectionRange(0, 99999);
			const successful = document.execCommand('copy');
			document.body.removeChild(textarea);

			if (successful) {
				hideTooltip(tooltipType);
			} else {
				console.error('フォールバックコピーに失敗しました');
			}
		} catch (err) {
			console.error('クリップボードへのコピーに失敗しました: ', err);
		}
	}

	function hideTooltip(tooltipType: 'key' | 'class' | 'value') {
		switch (tooltipType) {
			case 'key':
				showKeyTooltip = false;
				break;
			case 'class':
				showClassTooltip = false;
				break;
			case 'value':
				showValueTooltip = false;
				break;
		}
	}

	function getType(value: DataValue): string {
		if (value === null) return 'null';
		if (Array.isArray(value)) return 'array';
		if (typeof value === 'object' && value !== null && '__class__' in value) return 'python-object';
		return typeof value;
	}

	function formatValue(value: DataValue): string {
		if (typeof value === 'string') return `"${value}"`;
		return String(value);
	}

	$: type = getType(data);
	$: isExpandable = type === 'object' || type === 'array' || type === 'python-object';
	$: itemCount = (() => {
		if (
			type === 'object' &&
			data &&
			typeof data === 'object' &&
			!Array.isArray(data) &&
			!('__class__' in data)
		) {
			return Object.keys(data).length;
		}
		if (type === 'array' && Array.isArray(data)) {
			return data.length;
		}
		if (type === 'python-object' && data && typeof data === 'object' && '__class__' in data) {
			return Object.keys(data).length - 1;
		}
		return 0;
	})();
</script>

{#if isExpandable}
	<div class="json-line" style="margin-left: {depth * 20}px;">
		<button
			on:click={toggleExpanded}
			class="expand-button"
			aria-label={isExpanded ? '折りたたむ' : '展開'}
		>
			<Icon icon={isExpanded ? 'mdi:chevron-down' : 'mdi:chevron-right'} class="h-4 w-4" />
		</button>

		{#if keyName !== undefined}
			<span
				class="key relative"
				on:mouseenter|stopPropagation={() => (showKeyTooltip = true)}
				on:mouseleave|stopPropagation={() => (showKeyTooltip = false)}
				role="button"
				tabindex="0"
			>
				"{keyName}":

				<!-- Tooltip for key -->
				{#if showKeyTooltip && path}
					<div
						class="tooltip absolute z-10 rounded bg-gray-800 px-2 py-1 text-xs whitespace-nowrap text-white"
						style="left: 0; top: -20px;"
						on:mouseenter={() => (showKeyTooltip = true)}
						on:mouseleave={() => (showKeyTooltip = false)}
						role="button"
						tabindex="0"
					>
						<button on:click={() => copyPath('key')} class="cursor-pointer hover:text-blue-300">
							{path}
							<Icon icon="mdi:content-copy" class="ml-1 inline h-3 w-3" />
						</button>
					</div>
				{/if}
			</span>
		{/if}

		{#if type === 'array'}
			<span class="bracket">[</span>
			{#if !isExpanded}
				<span class="collapsed-info">... {itemCount} items</span>
				<span class="bracket">]</span>
				{#if !isLastItem}
					<span class="comma">,</span>
				{/if}
			{/if}
		{:else if type === 'python-object'}
			<span
				class="python-class relative"
				on:mouseenter|stopPropagation={() => (showClassTooltip = true)}
				on:mouseleave|stopPropagation={() => (showClassTooltip = false)}
				role="button"
				tabindex="0"
			>
				{(data as PythonObject).__class__}

				<!-- Tooltip for Python class -->
				{#if showClassTooltip && path}
					<div
						class="tooltip absolute z-10 rounded bg-gray-800 px-2 py-1 text-xs whitespace-nowrap text-white"
						style="left: 0; top: -20px;"
						on:mouseenter={() => (showClassTooltip = true)}
						on:mouseleave={() => (showClassTooltip = false)}
						role="button"
						tabindex="0"
					>
						<button on:click={() => copyPath('class')} class="cursor-pointer hover:text-blue-300">
							{path}
							<Icon icon="mdi:content-copy" class="ml-1 inline h-3 w-3" />
						</button>
					</div>
				{/if}
			</span>
			<span class="bracket">(</span>
			{#if !isExpanded}
				<span class="collapsed-info">... {itemCount} args</span>
				<span class="bracket">)</span>
				{#if !isLastItem}
					<span class="comma">,</span>
				{/if}
			{/if}
		{:else}
			<span class="bracket">{'{'}</span>
			{#if !isExpanded}
				<span class="collapsed-info">... {itemCount} properties</span>
				<span class="bracket">}</span>
				{#if !isLastItem}
					<span class="comma">,</span>
				{/if}
			{/if}
		{/if}
	</div>

	{#if isExpanded}
		<div class="children">
			{#if depth < maxDepth}
				{#if type === 'array' && Array.isArray(data)}
					{#each data as item, index (index)}
						<svelte:self
							data={item}
							depth={depth + 1}
							{maxDepth}
							path={path ? `${path}[${index}]` : `[${index}]`}
							isLastItem={index === data.length - 1}
						/>
					{/each}
				{:else if type === 'python-object' && data && typeof data === 'object' && '__class__' in data}
					{#each Object.entries(data).filter(([key]) => key !== '__class__') as [key, value], index (key)}
						<svelte:self
							data={value}
							depth={depth + 1}
							{maxDepth}
							keyName={key}
							path={path ? `${path}.${key}` : key}
							isLastItem={index ===
								Object.entries(data).filter(([key]) => key !== '__class__').length - 1}
						/>
					{/each}
				{:else if type === 'object' && data && typeof data === 'object' && !Array.isArray(data) && !('__class__' in data)}
					{#each Object.entries(data) as [key, value], index (key)}
						<svelte:self
							data={value}
							depth={depth + 1}
							{maxDepth}
							keyName={key}
							path={path ? `${path}["${key}"]` : `["${key}"]`}
							isLastItem={index === Object.entries(data).length - 1}
						/>
					{/each}
				{/if}
			{:else}
				<div class="json-line" style="margin-left: {(depth + 1) * 20}px;">
					<span class="expand-placeholder"></span>
					<span class="text-sm text-red-500 italic">最大深度に到達しました (深度: {depth})</span>
				</div>
			{/if}
		</div>
		<div class="closing-bracket" style="margin-left: {depth * 20}px;">
			<span class="expand-placeholder"></span>
			<span class="bracket">{type === 'array' ? ']' : type === 'python-object' ? ')' : '}'}</span>
			{#if !isLastItem}
				<span class="comma">,</span>
			{/if}
		</div>
	{/if}
{:else}
	<div class="json-line relative" style="margin-left: {depth * 20}px;" role="button" tabindex="0">
		<span class="expand-placeholder"></span>
		{#if keyName !== undefined}
			<span
				class="key relative"
				on:mouseenter|stopPropagation={() => (showKeyTooltip = true)}
				on:mouseleave|stopPropagation={() => (showKeyTooltip = false)}
				role="button"
				tabindex="0"
			>
				"{keyName}":

				<!-- Tooltip for key -->
				{#if showKeyTooltip && path}
					<div
						class="tooltip absolute z-10 rounded bg-gray-800 px-2 py-1 text-xs whitespace-nowrap text-white"
						style="left: 0; top: -20px;"
						on:mouseenter={() => (showKeyTooltip = true)}
						on:mouseleave={() => (showKeyTooltip = false)}
						role="button"
						tabindex="0"
					>
						<button on:click={() => copyPath('key')} class="cursor-pointer hover:text-blue-300">
							{path}
							<Icon icon="mdi:content-copy" class="ml-1 inline h-3 w-3" />
						</button>
					</div>
				{/if}
			</span>
		{/if}
		<span
			class="value {type} relative"
			on:mouseenter|stopPropagation={() => (showValueTooltip = true)}
			on:mouseleave|stopPropagation={() => (showValueTooltip = false)}
			role="button"
			tabindex="0"
		>
			{formatValue(data)}

			<!-- Tooltip for value -->
			{#if showValueTooltip && path}
				<div
					class="tooltip absolute z-10 rounded bg-gray-800 px-2 py-1 text-xs whitespace-nowrap text-white"
					style="left: 0; top: -20px;"
					on:mouseenter={() => (showValueTooltip = true)}
					on:mouseleave={() => (showValueTooltip = false)}
					role="button"
					tabindex="0"
				>
					<button on:click={() => copyPath('value')} class="cursor-pointer hover:text-blue-300">
						{path}
						<Icon icon="mdi:content-copy" class="ml-1 inline h-3 w-3" />
					</button>
				</div>
			{/if}
		</span>
		{#if !isLastItem}
			<span class="comma">,</span>
		{/if}
	</div>
{/if}

<style>
	.json-viewer {
		font-family: 'Fira Mono', monospace;
		font-size: 0.875rem;
		line-height: 1.5;
	}

	.json-line {
		display: flex;
		align-items: center;
	}

	.expand-button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		background: none;
		border: none;
		cursor: pointer;
		padding: 0;
		margin-right: 4px;
		color: #666;
		transition: color 0.2s;
		width: 20px;
		height: 20px;
		flex-shrink: 0;
	}

	.expand-button:hover {
		color: #333;
	}

	.expand-placeholder {
		width: 20px;
		height: 20px;
		margin-right: 4px;
		flex-shrink: 0;
	}

	.key {
		color: #881391;
		font-weight: 500;
		margin-right: 4px;
	}

	.python-class {
		color: #0451a5;
		font-weight: 600;
	}

	.bracket {
		color: #666;
		font-weight: 500;
	}

	.comma {
		color: #666;
		margin-left: 1px;
	}

	.collapsed-info {
		color: #999;
		font-style: italic;
		font-size: 0.85em;
		margin: 0 4px;
	}

	.value {
		margin-left: 4px;
		white-space: nowrap;
	}

	.value.string {
		color: #22863a;
	}

	.value.number {
		color: #005cc5;
	}

	.value.boolean {
		color: #d73a49;
	}

	.value.null {
		color: #6f42c1;
	}

	.children {
		margin-top: 2px;
		margin-bottom: 2px;
	}

	.closing-bracket {
		display: flex;
		align-items: center;
	}

	.tooltip {
		animation: fadeIn 0.2s ease-in;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
			transform: translateY(-5px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
</style>

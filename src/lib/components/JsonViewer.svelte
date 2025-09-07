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
	export let keyName: string | number | undefined = undefined;
	export let isLastItem = true;

	let isExpanded = true; // デフォルトで全て展開

	function toggleExpanded() {
		isExpanded = !isExpanded;
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
	$: itemCount =
		type === 'object'
			? Object.keys(data as JsonObject).length
			: type === 'array'
				? (data as JsonArray).length
				: type === 'python-object'
					? Object.keys(data as PythonObject).length - 1
					: 0;
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
			<span class="key">"{keyName}": </span>
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
			<span class="python-class">{(data as PythonObject).__class__}</span>
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
			{#if type === 'array'}
				{#each data as JsonArray as item, index (index)}
					<svelte:self
						data={item}
						depth={depth + 1}
						isLastItem={index === (data as JsonArray).length - 1}
					/>
				{/each}
			{:else if type === 'python-object'}
				{#each Object.entries(data as PythonObject).filter(([key]) => key !== '__class__') as [key, value], index (key)}
					<svelte:self
						data={value}
						depth={depth + 1}
						keyName={key}
						isLastItem={index ===
							Object.entries(data as PythonObject).filter(([key]) => key !== '__class__').length -
								1}
					/>
				{/each}
			{:else}
				{#each Object.entries(data as JsonObject) as [key, value], index (key)}
					<svelte:self
						data={value}
						depth={depth + 1}
						keyName={key}
						isLastItem={index === Object.entries(data as JsonObject).length - 1}
					/>
				{/each}
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
	<div class="json-line" style="margin-left: {depth * 20}px;">
		<span class="expand-placeholder"></span>
		{#if keyName !== undefined}
			<span class="key">"{keyName}": </span>
		{/if}
		<span class="value {type}">
			{formatValue(data)}
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
</style>

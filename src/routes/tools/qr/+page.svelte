<script lang="ts">
  import { onMount } from 'svelte';
  let input = '';
  let qrUrl = '';

  $: qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(input)}`;
</script>

<h1>QRコードジェネレーター</h1>
<input bind:value={input} placeholder="テキストを入力" />
{#if input}
  <p>↓ 生成されたQRコード：</p>
  <img src={qrUrl} alt="QRコード" />
{/if}

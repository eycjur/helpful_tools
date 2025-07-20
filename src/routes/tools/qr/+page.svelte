<script lang="ts">
  import { tools } from '$lib/data/tools';
  import { onMount } from 'svelte';
  let input = '';
  let qrUrl = '';
  let logoFile: File | null = null;
  let logoDataUrl = '';
  let canvasRef: HTMLCanvasElement;

  $: qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=600x600&ecc=H&margin=6&data=${encodeURIComponent(input)}`;
  
  const tool = tools.find(t => t.path === '/tools/qr');

  function handleLogoUpload(event: Event) {
    const target = event.target as HTMLInputElement;
    if (target.files && target.files[0]) {
      logoFile = target.files[0];
      const reader = new FileReader();
      reader.onload = (e) => {
        logoDataUrl = e.target?.result as string;
      };
      reader.readAsDataURL(logoFile);
    }
  }

  function generateQRWithLogo() {
    if (!input || !logoDataUrl) return;
    
    const canvas = canvasRef;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const qrImg = new Image();
    qrImg.crossOrigin = 'anonymous';
    qrImg.onload = () => {
      canvas.width = 600;
      canvas.height = 600;
      
      // Draw QR code
      ctx.drawImage(qrImg, 0, 0, 600, 600);
      
      // Draw logo
      const logoImg = new Image();
      logoImg.onload = () => {
        const logoSize = 100;
        const x = (600 - logoSize) / 2;
        const y = (600 - logoSize) / 2;
        
        // Draw white background for logo
        ctx.fillStyle = 'white';
        ctx.fillRect(x - 5, y - 5, logoSize + 10, logoSize + 10);
        
        // Draw logo
        ctx.drawImage(logoImg, x, y, logoSize, logoSize);
      };
      logoImg.src = logoDataUrl;
    };
    qrImg.src = qrUrl;
  }

  $: if (input && logoDataUrl && canvasRef) {
    generateQRWithLogo();
  }
</script>

<div class="max-w-2xl mx-auto">
  <div class="flex items-center mb-6">
    <span class="text-4xl mr-4">{tool?.icon}</span>
    <h1 class="text-3xl font-bold">{tool?.name}</h1>
  </div>
  <input bind:value={input} placeholder="テキストを入力" class="w-full p-3 border border-gray-300 rounded-lg mb-4" />
  
  <div class="mb-4">
    <label for="logo" class="block text-sm font-medium text-gray-700 mb-2">ロゴ画像をアップロード（オプション）</label>
    <input type="file" id="logo" accept="image/*" on:change={handleLogoUpload} class="w-full p-2 border border-gray-300 rounded-lg" />
    {#if logoDataUrl}
      <p class="text-xs text-gray-500 mt-1">QRコード上に重ねることで、まれに誤読される可能性があります</p>
    {/if}
  </div>

  {#if input}
    <p class="mb-4 text-gray-700">↓ 生成されたQRコード：</p>
    <div class="flex justify-center">
      {#if logoDataUrl}
        <canvas bind:this={canvasRef} class="border border-gray-300 rounded-lg max-w-xs"></canvas>
      {:else}
        <img src={qrUrl} alt="QRコード" class="border border-gray-300 rounded-lg max-w-xs" />
      {/if}
    </div>
  {/if}
</div>

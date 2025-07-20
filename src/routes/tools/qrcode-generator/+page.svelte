<script lang="ts">
  import { tools } from '$lib/data/tools';
  import { onMount } from 'svelte';
  let input = '';
  let qrUrl = '';
  let logoFile: File | null = null;
  let logoDataUrl = '';
  let canvasRef: HTMLCanvasElement;
  let isLoading = false;

  $: qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=600x600&ecc=H&margin=6&data=${encodeURIComponent(input)}`;
  
  // Reset loading when input changes
  $: if (input) {
    isLoading = true;
  }

  // Handle QR generation when input changes
  $: if (input && !logoDataUrl) {
    // For non-logo QR codes, preload the image to detect when it's ready
    const img = new Image();
    img.onload = () => {
      isLoading = false;
    };
    img.onerror = () => {
      isLoading = false;
    };
    img.src = qrUrl;
  }

  const tool = tools.find(t => t.name === 'qrcode-generator');

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

  function removeLogo() {
    logoFile = null;
    logoDataUrl = '';
    // Reset file input
    const fileInput = document.getElementById('logo') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
  }

  function generateQRWithLogo() {
    if (!input || !logoDataUrl || !canvasRef) return;
    
    // isLoading is already set to true by the reactive statement above
    const canvas = canvasRef;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      isLoading = false;
      return;
    }

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
        isLoading = false;
      };
      logoImg.onerror = () => {
        isLoading = false;
      };
      logoImg.src = logoDataUrl;
    };
    qrImg.onerror = () => {
      isLoading = false;
    };
    qrImg.src = qrUrl;
  }

  $: if (input && logoDataUrl) {
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
    <div class="flex gap-2">
      <input type="file" id="logo" accept="image/*" on:change={handleLogoUpload} class="flex-1 p-2 border border-gray-300 rounded-lg" />
      {#if logoDataUrl}
        <button 
          on:click={removeLogo}
          class="px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
          type="button"
        >
          削除
        </button>
      {/if}
    </div>
    {#if logoDataUrl}
      <p class="text-xs text-gray-500 mt-1">QRコード上に重ねることで、まれに誤読される可能性があります</p>
    {/if}
  </div>

  {#if input}
    <p class="mb-4 text-gray-700">↓ 生成されたQRコード：</p>
    <div class="flex justify-center">
      <canvas bind:this={canvasRef} class="border border-gray-300 rounded-lg max-w-xs {logoDataUrl && !isLoading ? '' : 'hidden'}"></canvas>
      {#if isLoading}
        <div class="flex flex-col items-center justify-center p-8 border border-gray-300 rounded-lg">
          <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <p class="text-gray-600">QRコードを生成中...</p>
        </div>
      {:else if !logoDataUrl}
        <img 
          src={qrUrl} 
          alt="QRコード" 
          class="border border-gray-300 rounded-lg max-w-xs"
        />
      {/if}
    </div>
  {/if}
</div>

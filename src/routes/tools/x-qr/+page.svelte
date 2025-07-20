<script lang="ts">
  import { tools } from '$lib/data/tools';
  let username = '';
  let qrUrl = '';
  let canvasRef: HTMLCanvasElement;
  let showXIcon = true;

  $: {
    if (username) {
      // Remove @ if present
      const cleanUsername = username.startsWith('@') ? username.slice(1) : username;
      const profileUrl = `https://x.com/${cleanUsername}`;
      qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=600x600&ecc=H&margin=6&data=${encodeURIComponent(profileUrl)}`;
    }
  }
  
  const tool = tools.find(t => t.path === '/tools/x-qr');

  function generateXQR() {
    if (!username || !canvasRef) return;
    
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
      
      // Draw X logo only if enabled
      if (showXIcon) {
        const logoSize = 100;
        const padding = 15;
        const totalSize = logoSize + padding * 2;
        const x = (600 - totalSize) / 2;
        const y = (600 - totalSize) / 2;
        const radius = 8;
        
        // Draw white background with padding and rounded corners
        ctx.fillStyle = 'white';
        ctx.beginPath();
        ctx.roundRect(x, y, totalSize, totalSize, radius);
        ctx.fill();
        
        // Draw black rounded square for X logo
        ctx.fillStyle = 'black';
        ctx.beginPath();
        ctx.roundRect(x + padding, y + padding, logoSize, logoSize, radius);
        ctx.fill();
        
        // Draw white X logo
        ctx.fillStyle = 'white';
        ctx.font = 'bold 60px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('𝕏', 300, 300);
      }
    };
    qrImg.src = qrUrl;
  }

  $: if (username && qrUrl && canvasRef) {
    generateXQR();
  }
</script>

<div class="max-w-2xl mx-auto">
  <div class="flex items-center mb-6">
    <span class="text-4xl mr-4">{tool?.icon}</span>
    <h1 class="text-3xl font-bold">{tool?.name}</h1>
  </div>
  
  <div class="mb-4">
    <label for="username" class="block text-sm font-medium text-gray-700 mb-2">Xユーザー名</label>
    <input 
      id="username" 
      bind:value={username} 
      placeholder="例: username または @username" 
      class="w-full p-3 border border-gray-300 rounded-lg"
    />
  </div>

  <div class="mb-4">
    <label class="flex items-center">
      <input type="checkbox" bind:checked={showXIcon} class="mr-2" />
      <span class="text-sm text-gray-700">中央にXアイコンを表示（誤ったユーザーになる場合は非表示にしてください）</span>
    </label>
  </div>

  {#if username}
    {@const cleanUsername = username.startsWith('@') ? username.slice(1) : username}
    <div class="mb-4 p-3 bg-gray-50 rounded-lg">
      <p class="text-sm text-gray-600">プロフィールURL: <span class="font-mono">https://x.com/{cleanUsername}</span></p>
    </div>
    
    <p class="mb-4 text-gray-700">↓ 生成されたQRコード：</p>
    <div class="flex justify-center">
      {#if showXIcon}
        <canvas bind:this={canvasRef} class="border border-gray-300 rounded-lg max-w-xs"></canvas>
      {:else}
        <img src={qrUrl} alt="QRコード" class="border border-gray-300 rounded-lg max-w-xs" />
      {/if}
    </div>
  {/if}
</div>
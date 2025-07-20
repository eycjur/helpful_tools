<script lang="ts">
  import { tools } from '$lib/data/tools';
  let text = '';

  const tool = tools.find(t => t.name === 'character-counter');
</script>

<div class="max-w-2xl mx-auto">
  <div class="flex items-center mb-6">
    <span class="text-4xl mr-4">{tool?.icon}</span>
    <h1 class="text-3xl font-bold">{tool?.name}</h1>
  </div>
  <textarea bind:value={text} rows="6" placeholder="テキストを入力してください" class="w-full p-3 border border-gray-300 rounded-lg mb-4 resize-none"></textarea>
  <p class="text-lg font-semibold text-gray-700">文字数: {text.length}</p>
</div>

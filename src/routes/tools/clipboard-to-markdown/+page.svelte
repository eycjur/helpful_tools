<script lang="ts">
  import { tools } from '$lib/data/tools';
  import { onMount } from 'svelte';
  import TurndownService from 'turndown';
  
  let HTMLEditor: HTMLDivElement;
  let markdownOutput = '';
  let isNewLineAsParagraph = false;
  let isIgnoreBoldInHeader = true;
  let copyButtonText = 'コピー';
  let turndownService: TurndownService;

  const tool = tools.find(t => t.path === '/tools/clipboard-to-markdown');

  function copyToClipboard() {
    navigator.clipboard.writeText(markdownOutput)
      .then(() => {
        copyButtonText = '成功！';
        setTimeout(() => {
          copyButtonText = 'コピー';
        }, 1000);
      })
      .catch(err => {
        console.error('コピーに失敗しました: ', err);
        alert('コピーに失敗しました');
      });
  }

  function convertToMarkdown() {
    if (!HTMLEditor || !turndownService) return;
    
    const htmlContent = HTMLEditor.innerHTML;
    if (!htmlContent.trim() || htmlContent === '<div><br></div>' || htmlContent === '<br>') {
      markdownOutput = '';
      return;
    }

    // TurndownServiceを使ってHTML→Markdown変換
    let markdown = turndownService.turndown(htmlContent);

    // 改行処理
    if (!isNewLineAsParagraph) {
      markdown = markdown.replace(/\n\n+/g, '\n');
    }

    // 見出し内の太字を無視
    if (isIgnoreBoldInHeader) {
      markdown = markdown.replace(/^(#+) \*\*(.+?)\*\*$/gm, '$1 $2');
    }

    // 余分な空行を削除
    markdown = markdown.replace(/\n{3,}/g, '\n\n').trim();

    markdownOutput = markdown;
  }

  function handleInput() {
    convertToMarkdown();
  }

  function handlePaste(event: ClipboardEvent) {
    // デフォルトのペースト動作を許可（クリップボードの中身がそのまま貼り付けられる）
    setTimeout(() => {
      convertToMarkdown();
    }, 10);
  }

  function clearEditor() {
    if (HTMLEditor) {
      HTMLEditor.innerHTML = '';
      markdownOutput = '';
    }
  }

  onMount(() => {
    // TurndownServiceの初期化
    turndownService = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced',
      hr: '---',
      bulletListMarker: '-',
    });

    // カスタムルールの追加
    turndownService.addRule('list', {
      filter: ['li'],
      replacement: function(content, node) {
        const element = node as HTMLElement;
        let prefix = '';
        if (element.className === 'ql-indent-1') {
          prefix = '    ';
        } else if (element.className === 'ql-indent-2') {
          prefix = '        ';
        } else if (element.className === 'ql-indent-3') {
          prefix = '            ';
        }
        if (element.getAttribute('data-list') === 'ordered') {
          prefix += '1. ';
        } else {
          prefix += '- ';
        }
        return prefix + content + '\n';
      }
    });

    turndownService.addRule('codeBlock', {
      filter: function(node) {
        const element = node as HTMLElement;
        return element.className === 'ql-code-block-container';
      },
      replacement: function(content) {
        return '\n```\n' + content + '```\n\n';
      }
    });

    turndownService.addRule('table', {
      filter: ['table'],
      replacement: function(_content, node) {
        const table = node as HTMLTableElement;
        const header = table.querySelectorAll('tr')[0];
        let row = '';
        for (const th of header.querySelectorAll('td, th')) {
          row += '| ' + th.textContent + ' ';
        }
        let result = '\n' + row + '|\n';
        
        // ヘッダー行はカラム数がおかしい場合があるので、2行目のカラム数を参照する
        const numColumns = table.querySelectorAll('tr')[1]?.querySelectorAll('td, th').length || header.querySelectorAll('td, th').length;
        result += '| --- '.repeat(numColumns) + '|\n';

        for (const tr of Array.from(table.querySelectorAll('tr')).slice(1)) {
          let row = '';
          for (const td of tr.querySelectorAll('td, th')) {
            row += '| ' + td.textContent + ' ';
          }
          result += row + '|\n';
        }
        return result + '\n';
      }
    });

    convertToMarkdown();
  });
</script>

<div class="max-w-6xl mx-auto">
  <div class="flex items-center mb-6">
    <span class="text-4xl mr-4">{tool?.icon}</span>
    <h1 class="text-3xl font-bold">{tool?.name}</h1>
  </div>

  <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
    <!-- 入力エリア -->
    <div class="flex flex-col">
      <div class="flex items-center justify-between mb-2">
        <label class="text-sm font-medium text-gray-700">
          【入力】Clipboardからのテキスト
        </label>
        <button
          on:click={clearEditor}
          class="px-3 py-1 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors text-sm"
        >
          クリア
        </button>
      </div>
      <div
        bind:this={HTMLEditor}
        contenteditable="true"
        on:input={handleInput}
        on:paste={handlePaste}
        class="flex-1 p-3 border border-gray-300 rounded-lg min-h-96 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent overflow-auto"
        style="white-space: pre-wrap;"
        data-placeholder="クリップボードを貼り付けてください..."
      ></div>
    </div>

    <!-- 出力エリア -->
    <div class="flex flex-col">
      <div class="flex items-center justify-between mb-2">
        <label class="text-sm font-medium text-gray-700">【出力】Markdown形式</label>
        <button
          on:click={copyToClipboard}
          class="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors text-sm"
          disabled={!markdownOutput}
        >
          {copyButtonText}
        </button>
      </div>
      <pre class="flex-1 p-3 border border-gray-300 rounded-lg bg-gray-50 text-sm overflow-auto min-h-96 whitespace-pre-wrap">{markdownOutput}</pre>
    </div>
  </div>

  <!-- オプション -->
  <div class="flex flex-wrap gap-4 p-4 bg-gray-50 rounded-lg">
    <label class="flex items-center">
      <input
        type="checkbox"
        bind:checked={isNewLineAsParagraph}
        class="mr-2"
      />
      <span class="text-sm text-gray-700">改行を段落区切りとして扱う</span>
    </label>
    
    <label class="flex items-center">
      <input
        type="checkbox"
        bind:checked={isIgnoreBoldInHeader}
        class="mr-2"
      />
      <span class="text-sm text-gray-700">見出し内の太字を無視する</span>
    </label>
  </div>

  <!-- 使用方法 -->
  <div class="mt-8 p-4 bg-blue-50 rounded-lg">
    <h2 class="text-lg font-semibold mb-2">使用方法</h2>
    <ul class="text-sm text-gray-700 space-y-1">
      <li>• Webページからコピーしたクリップボードの中身を左側の編集エリアに貼り付けてください</li>
      <li>• クリップボードの中身（太字、斜体、リンク、見出しなど）がそのまま保持されます</li>
      <li>• 自動的にMarkdown形式に変換されて右側に表示されます</li>
      <li>• 「コピー」ボタンでMarkdownをクリップボードにコピーできます</li>
      <li>• オプションで改行や太字の処理方法を調整できます</li>
      <li>• 「クリア」ボタンで入力エリアを空にできます</li>
    </ul>
  </div>
</div>

<style>
  /* プレースホルダーのスタイル */
  [contenteditable="true"]:empty:before {
    content: attr(data-placeholder);
    color: #9ca3af;
    pointer-events: none;
  }
  
  /* contentEditableエリア内のスタイル */
  [contenteditable="true"] {
    min-height: 24rem;
  }
  
  [contenteditable="true"]:focus {
    outline: none;
  }
</style>
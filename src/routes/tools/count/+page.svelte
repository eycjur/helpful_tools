<script lang="ts">
  let text = '';
</script>

<h1>文字数カウンタ</h1>
<textarea bind:value={text} rows="6" cols="50" placeholder="テキストを入力してください"></textarea>
<p>文字数: {text.length}</p>

<script>
  export let data;
</script>

<div class="flex flex-col min-h-screen font-sans">
  <header class="bg-gray-100 p-4 text-center">
    <nav>
      <a href="/" class="text-blue-500 font-bold hover:underline">困った時のツール集</a>
    </nav>
  </header>

  <main class="flex-1 p-8">
    <slot />
  </main>

  <footer class="bg-gray-100 p-4 text-center">
    <p>&copy; {new Date().getFullYear()} 困った時のツール集</p>
  </footer>
</div>

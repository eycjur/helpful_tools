<script>
  export let data;
  import '../app.css';
</script>

<div class="flex flex-col h-screen">
  <header class="bg-gray-100 p-4">
    <nav>
      <a href="/" class="text-blue-500 font-bold hover:underline">困った時のツール集</a>
    </nav>
  </header>

  <main class="flex-1 p-8">
    <slot />
  </main>

  <footer class="bg-gray-100 p-4 text-center mt-auto">
    <p>&copy; {new Date().getFullYear()} 困った時のツール集</p>
  </footer>
</div>

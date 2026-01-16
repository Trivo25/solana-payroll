<template>
  <div class="app">
    <NuxtRouteAnnouncer />
    <NuxtPage />
  </div>
</template>

<style>
/* The Vault Palette */
:root {
  --primary: #0F172A;      /* Deep Navy */
  --secondary: #10B981;    /* Emerald Green */
  --background: #F8FAFC;   /* Slate White */
  --text-primary: #0F172A;
  --text-secondary: #475569;
  --text-muted: #94A3B8;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  background-color: var(--background);
  color: var(--text-primary);
  min-height: 100vh;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

.app {
  min-height: 100vh;
}

/* Mono font for addresses, hashes, etc */
.mono {
  font-family: 'JetBrains Mono', 'Roboto Mono', monospace;
}
</style>

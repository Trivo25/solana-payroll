// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  app: {
    head: {
      title: 'Veil - Pay Privately. Prove Instantly.',
      meta: [
        { name: 'description', content: 'Private payroll and invoicing on Solana with confidential transfers and zero-knowledge receipts.' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      ],
      link: [
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap'
        }
      ]
    }
  },

  vite: {
    define: {
      'process.env.BROWSER': true,
    },
    resolve: {
      alias: {
        // Ensure React is resolved for wallet adapter dependencies
        'react': 'react',
        'react-dom': 'react-dom',
      }
    },
    optimizeDeps: {
      include: ['react', 'react-dom'],
      esbuildOptions: {
        define: {
          global: 'globalThis'
        }
      }
    }
  }
})

import wasm from 'vite-plugin-wasm'
import topLevelAwait from 'vite-plugin-top-level-await'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  runtimeConfig: {
    public: {
      supabaseUrl: process.env.SUPABASE_URL || '',
      supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
    },
  },

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
    plugins: [
      wasm(),
      topLevelAwait(),
    ],
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
      exclude: ['@solana/zk-sdk'],
      esbuildOptions: {
        define: {
          global: 'globalThis'
        }
      }
    }
  }
})

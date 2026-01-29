import wasm from 'vite-plugin-wasm'
import topLevelAwait from 'vite-plugin-top-level-await'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  devtools: { enabled: true },

  // Use app/ directory structure (Nuxt 4 style)
  srcDir: 'app/',

  // SSR configuration - disable SSR for pages that use Solana
  // This avoids Buffer issues during server-side rendering
  ssr: true,

  // Configure Nitro (server engine) to handle Node.js polyfills
  nitro: {
    // Don't try to bundle these for SSR - use Node.js native
    externals: {
      inline: ['buffer']
    }
  },

  // Route rules - disable SSR for pages that use Solana
  routeRules: {
    '/dashboard': { ssr: false },
    '/connect': { ssr: false },
  },

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
      nodePolyfills({
        // Enable Buffer polyfill
        include: ['buffer'],
        globals: {
          Buffer: true,
          global: true,
          process: true,
        },
      }),
    ],
    server: {
      watch: {
        ignored: ['**/test-ledger/**'],
      },
    },
    define: {
      'process.env.BROWSER': true,
    },
    resolve: {
      alias: {
        'react': 'react',
        'react-dom': 'react-dom',
        'abort-controller': resolve(__dirname, 'node_modules/unenv/runtime/mock/empty.mjs'),
      }
    },
    optimizeDeps: {
      include: ['react', 'react-dom', 'solana-wallets-vue', '@solana/wallet-adapter-wallets', 'buffer'],
      exclude: ['@solana/zk-sdk'],
      esbuildOptions: {
        define: {
          global: 'globalThis'
        }
      }
    }
  }
})

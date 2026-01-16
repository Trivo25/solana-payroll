import { defineNuxtPlugin } from '#app'
import { initWallet } from 'solana-wallets-vue'
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
  CoinbaseWalletAdapter,
} from '@solana/wallet-adapter-wallets'

// Import the styles
import 'solana-wallets-vue/styles.css'

export default defineNuxtPlugin(() => {
  const walletOptions = {
    wallets: [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
      new CoinbaseWalletAdapter(),
    ],
    autoConnect: true,
  }

  initWallet(walletOptions)
})

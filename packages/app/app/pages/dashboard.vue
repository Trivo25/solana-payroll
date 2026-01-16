<template>
  <div class="dashboard">
    <!-- Background -->
    <div class="background">
      <div class="gradient-orb orb-1"></div>
      <div class="grid-pattern"></div>
    </div>

    <!-- Content -->
    <main class="content">
      <div class="container">
        <header class="header">
          <div class="logo">
            <span class="logo-text">Veil</span>
          </div>
          <div class="wallet-info">
            <ClientOnly>
              <template v-if="connected">
                <span class="wallet-address mono">{{ shortenAddress(publicKey?.toBase58() || '') }}</span>
                <button class="btn btn-disconnect" @click="disconnect">
                  Disconnect
                </button>
              </template>
              <template v-else>
                <NuxtLink to="/connect" class="btn btn-connect">
                  Connect Wallet
                </NuxtLink>
              </template>
            </ClientOnly>
          </div>
        </header>

        <div class="welcome-section">
          <h1>Welcome to Veil</h1>
          <p class="subtitle">Your private payment dashboard</p>
        </div>

      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'

const connected = ref(false)
const publicKey = ref<any>(null)
let walletDisconnect: () => Promise<void> = async () => {}

onMounted(async () => {
  try {
    // dynamic import to avoid ssr issues
    const { initWallet, useWallet } = await import('solana-wallets-vue')

    // check if wallet is already initialized
    let wallet
    let needsInit = false
    try {
      wallet = useWallet()
    } catch {
      needsInit = true
    }

    // only import adapters and initialize if needed
    if (needsInit) {
      const {
        PhantomWalletAdapter,
        SolflareWalletAdapter,
        CoinbaseWalletAdapter,
      } = await import('@solana/wallet-adapter-wallets')

      initWallet({
        wallets: [
          new PhantomWalletAdapter(),
          new SolflareWalletAdapter(),
          new CoinbaseWalletAdapter(),
        ],
        autoConnect: true,
      })
      wallet = useWallet()
    }

    connected.value = wallet.connected.value
    publicKey.value = wallet.publicKey.value

    watch(() => wallet.connected.value, (val) => { connected.value = val })
    watch(() => wallet.publicKey.value, (val) => { publicKey.value = val })

    walletDisconnect = wallet.disconnect

    // redirect to connect if not connected (give time for auto-connect)
    setTimeout(() => {
      if (!wallet.connected.value) {
        navigateTo('/connect')
      }
    }, 1000)
  } catch (e) {
    console.error('failed to initialize wallet:', e)
    navigateTo('/connect')
  }
})

function disconnect() {
  walletDisconnect()
}

function shortenAddress(address: string): string {
  if (!address) return ''
  return `${address.slice(0, 4)}...${address.slice(-4)}`
}
</script>

<style scoped>
.dashboard {
  min-height: 100vh;
  position: relative;
}

/* Background */
.background {
  position: fixed;
  inset: 0;
  z-index: 0;
  overflow: hidden;
}

.gradient-orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(100px);
  opacity: 0.4;
}

.orb-1 {
  width: 600px;
  height: 600px;
  background: linear-gradient(135deg, var(--secondary) 0%, rgba(16, 185, 129, 0.2) 100%);
  top: -200px;
  right: -200px;
}

.grid-pattern {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(15, 23, 42, 0.02) 1px, transparent 1px),
    linear-gradient(90deg, rgba(15, 23, 42, 0.02) 1px, transparent 1px);
  background-size: 60px 60px;
}

/* Content */
.content {
  position: relative;
  z-index: 1;
  min-height: 100vh;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

/* Header */
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 3rem;
}

.logo-text {
  font-size: 1.5rem;
  font-weight: 700;
  background: linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.wallet-info {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.wallet-address {
  padding: 0.5rem 1rem;
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(15, 23, 42, 0.1);
  border-radius: 8px;
  font-size: 0.875rem;
  color: var(--text-secondary);
}

.btn {
  padding: 0.75rem 1.5rem;
  font-size: 0.875rem;
  font-weight: 600;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  border: none;
  font-family: inherit;
  text-decoration: none;
}

.btn-disconnect {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

.btn-disconnect:hover {
  background: rgba(239, 68, 68, 0.2);
}

.btn-connect {
  background: var(--primary);
  color: white;
}

/* Welcome */
.welcome-section {
  margin-bottom: 3rem;
}

.welcome-section h1 {
  font-size: 2.5rem;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 0.5rem;
}

.subtitle {
  font-size: 1.125rem;
  color: var(--text-secondary);
}

</style>

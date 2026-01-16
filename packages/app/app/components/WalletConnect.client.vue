<template>
  <div class="wallet-connect">
    <!-- Loading state -->
    <div v-if="!isReady" class="loading">
      <p>Loading wallets...</p>
    </div>

    <!-- Not connected: show wallet options -->
    <div v-else-if="!connected" class="wallet-list">
      <button
        v-for="wallet in wallets"
        :key="wallet.adapter.name"
        class="wallet-btn"
        @click="selectWallet(wallet.adapter.name)"
      >
        <img
          v-if="wallet.adapter.icon"
          :src="wallet.adapter.icon"
          :alt="wallet.adapter.name"
          class="wallet-icon"
        />
        <span>{{ wallet.adapter.name }}</span>
        <span v-if="wallet.readyState === 'Installed'" class="installed-badge">Installed</span>
      </button>

      <p v-if="wallets.length === 0" class="no-wallets">
        No wallets found. Please install a Solana wallet.
      </p>
    </div>

    <!-- Connected state -->
    <div v-else class="connected-state">
      <div class="connected-badge">
        <span class="status-dot"></span>
        <span>Connected</span>
      </div>
      <p class="wallet-address mono">
        {{ shortenAddress(publicKey?.toBase58() || '') }}
      </p>
      <NuxtLink to="/dashboard" class="btn btn-primary">
        Go to Dashboard
      </NuxtLink>
      <button class="btn btn-disconnect" @click="handleDisconnect">
        Disconnect
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'

const isReady = ref(false)
const connected = ref(false)
const publicKey = ref<any>(null)
const wallets = ref<any[]>([])

let walletSelect: (name: string) => void = () => {}
let walletConnect: () => Promise<void> = async () => {}
let walletDisconnect: () => Promise<void> = async () => {}

onMounted(async () => {
  // dynamic import to avoid ssr issues
  const { initWallet, useWallet } = await import('solana-wallets-vue')
  const {
    PhantomWalletAdapter,
    SolflareWalletAdapter,
    CoinbaseWalletAdapter,
  } = await import('@solana/wallet-adapter-wallets')
  await import('solana-wallets-vue/styles.css')

  // initialize wallet if not already done
  try {
    useWallet()
  } catch {
    initWallet({
      wallets: [
        new PhantomWalletAdapter(),
        new SolflareWalletAdapter(),
        new CoinbaseWalletAdapter(),
      ],
      autoConnect: true,
    })
  }

  try {
    const wallet = useWallet()

    // set up reactive bindings
    connected.value = wallet.connected.value
    publicKey.value = wallet.publicKey.value
    wallets.value = wallet.wallets.value

    // watch for changes
    watch(() => wallet.connected.value, (val) => { connected.value = val })
    watch(() => wallet.publicKey.value, (val) => { publicKey.value = val })
    watch(() => wallet.wallets.value, (val) => { wallets.value = val })

    // store functions
    walletSelect = wallet.select
    walletConnect = wallet.connect
    walletDisconnect = wallet.disconnect

    isReady.value = true
  } catch (e) {
    console.error('failed to initialize wallet:', e)
    isReady.value = true
  }
})

async function selectWallet(walletName: string) {
  try {
    walletSelect(walletName)
    await walletConnect()
  } catch (error) {
    console.error('Failed to connect wallet:', error)
  }
}

async function handleDisconnect() {
  await walletDisconnect()
}

function shortenAddress(address: string): string {
  if (!address) return ''
  return `${address.slice(0, 4)}...${address.slice(-4)}`
}
</script>

<style scoped>
.loading {
  text-align: center;
  padding: 2rem;
  color: var(--text-secondary);
}

.wallet-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.wallet-btn {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  padding: 1rem 1.25rem;
  background: var(--primary);
  color: white;
  border: none;
  border-radius: 12px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  font-family: inherit;
}

.wallet-btn:hover {
  background: #1e293b;
  transform: translateY(-2px);
  box-shadow: 0 10px 40px rgba(15, 23, 42, 0.3);
}

.wallet-icon {
  width: 24px;
  height: 24px;
  border-radius: 6px;
}

.installed-badge {
  margin-left: auto;
  font-size: 0.75rem;
  font-weight: 500;
  padding: 0.25rem 0.5rem;
  background: rgba(16, 185, 129, 0.2);
  color: var(--secondary);
  border-radius: 4px;
}

.no-wallets {
  text-align: center;
  color: var(--text-muted);
  padding: 1rem;
}

.connected-state {
  text-align: center;
}

.connected-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: rgba(16, 185, 129, 0.1);
  border-radius: 100px;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--secondary);
  margin-bottom: 1rem;
}

.status-dot {
  width: 8px;
  height: 8px;
  background: var(--secondary);
  border-radius: 50%;
  animation: pulse-dot 2s infinite;
}

@keyframes pulse-dot {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.wallet-address {
  font-size: 1rem;
  color: var(--text-primary);
  margin-bottom: 1.5rem;
  padding: 0.75rem 1rem;
  background: rgba(15, 23, 42, 0.05);
  border-radius: 8px;
}

.btn {
  display: inline-block;
  padding: 1rem 2rem;
  font-size: 1rem;
  font-weight: 600;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  border: none;
  text-decoration: none;
  font-family: inherit;
}

.btn-primary {
  background: var(--primary);
  color: white;
  margin-bottom: 0.75rem;
}

.btn-primary:hover {
  background: #1e293b;
  transform: translateY(-2px);
  box-shadow: 0 10px 40px rgba(15, 23, 42, 0.3);
}

.btn-disconnect {
  display: block;
  width: 100%;
  background: transparent;
  color: var(--text-muted);
  font-size: 0.875rem;
  padding: 0.5rem;
}

.btn-disconnect:hover {
  color: #ef4444;
}
</style>

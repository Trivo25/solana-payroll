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
          <ClientOnly>
            <template v-if="accountLoading">
              <h1>Loading...</h1>
            </template>
            <template v-else-if="account">
              <h1>Welcome, {{ account.name }}</h1>
              <p class="subtitle">
                <span class="account-badge" :class="account.account_type">
                  {{ account.account_type === 'employer' ? 'Employer / Business' : 'Employee / Freelancer' }}
                </span>
              </p>
            </template>
            <template v-else>
              <h1>Welcome to Veil</h1>
              <p class="subtitle">Your private payment dashboard</p>
            </template>
          </ClientOnly>
        </div>

        <!-- balance cards -->
        <ClientOnly>
          <div v-if="connected" class="balance-cards">
            <!-- regular balance -->
            <div class="balance-card">
              <div class="balance-header">
                <div class="balance-label">Public Balance</div>
                <span class="balance-icon">&#x1F4B0;</span>
              </div>
              <div class="balance-value">
                <span v-if="balanceLoading" class="loading-text">Loading...</span>
                <span v-else class="mono">{{ formatBalance(balance) }} SOL</span>
              </div>
              <div class="balance-footer">Visible on-chain</div>
            </div>

            <!-- confidential balance -->
            <div class="balance-card confidential">
              <div class="balance-header">
                <div class="balance-label">Confidential Balance</div>
                <span class="balance-icon">&#x1F6E1;</span>
              </div>
              <div class="balance-value">
                <span v-if="confidentialLoading" class="loading-text">Loading...</span>
                <template v-else-if="confidentialBalance !== null">
                  <span class="mono blur-hover">{{ formatBalance(confidentialBalance) }} USDC</span>
                </template>
                <template v-else>
                  <span class="not-setup">Not configured</span>
                </template>
              </div>
              <div class="balance-footer">
                <span v-if="confidentialBalance !== null">Encrypted on-chain</span>
                <button v-else class="setup-link" @click="setupConfidential">Set up confidential account</button>
              </div>
            </div>
          </div>
        </ClientOnly>

      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useSupabase, type UserAccount } from '~/composables/useSupabase'

const connected = ref(false)
const publicKey = ref<any>(null)
const balance = ref<number | null>(null)
const balanceLoading = ref(false)
const confidentialBalance = ref<number | null>(null)
const confidentialLoading = ref(false)
const account = ref<UserAccount | null>(null)
const accountLoading = ref(true)
let walletDisconnect: () => Promise<void> = async () => {}

const { getAccount } = useSupabase()

// fetch sol balance for a public key
async function fetchBalance(pubkey: any) {
  if (!pubkey) return
  balanceLoading.value = true
  try {
    const { Connection, clusterApiUrl, LAMPORTS_PER_SOL } = await import('@solana/web3.js')
    const connection = new Connection(clusterApiUrl('devnet'))
    const lamports = await connection.getBalance(pubkey)
    balance.value = lamports / LAMPORTS_PER_SOL
  } catch (e) {
    console.error('failed to fetch balance:', e)
    balance.value = null
  } finally {
    balanceLoading.value = false
  }
}

function formatBalance(bal: number | null): string {
  if (bal === null) return '—'
  return bal.toFixed(4)
}

// fetch confidential token balance
// note: this is a placeholder - full implementation requires token-2022 confidential transfer extension
async function fetchConfidentialBalance(pubkey: any) {
  if (!pubkey) return
  confidentialLoading.value = true
  try {
    // todo: implement actual confidential balance fetching
    // this requires:
    // 1. finding the user's confidential token account (token-2022 with ct extension)
    // 2. fetching the encrypted balance
    // 3. decrypting with user's elgamal keypair

    // for now, set to null to indicate not configured
    confidentialBalance.value = null
  } catch (e) {
    console.error('failed to fetch confidential balance:', e)
    confidentialBalance.value = null
  } finally {
    confidentialLoading.value = false
  }
}

// placeholder for setting up confidential account
function setupConfidential() {
  // todo: implement confidential account setup flow
  // this would:
  // 1. create/derive elgamal keypair
  // 2. create token-2022 account with confidential transfer extension
  // 3. configure the account for confidential transfers
  alert('Confidential account setup coming soon!')
}

// check if user has an account, redirect to onboarding if not
async function checkAccount(walletAddress: string) {
  accountLoading.value = true
  try {
    const existingAccount = await getAccount(walletAddress)
    if (!existingAccount) {
      // no account found, redirect to onboarding
      navigateTo('/onboarding')
      return
    }
    account.value = existingAccount
  } catch (e) {
    console.error('failed to check account:', e)
  } finally {
    accountLoading.value = false
  }
}

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

    // fetch balances and check account if already connected
    if (wallet.publicKey.value) {
      const address = wallet.publicKey.value.toBase58()
      fetchBalance(wallet.publicKey.value)
      fetchConfidentialBalance(wallet.publicKey.value)
      checkAccount(address)
    }

    watch(() => wallet.connected.value, (val) => { connected.value = val })
    watch(() => wallet.publicKey.value, (val) => {
      publicKey.value = val
      if (val) {
        const address = val.toBase58()
        fetchBalance(val)
        fetchConfidentialBalance(val)
        checkAccount(address)
      }
    })

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

.account-badge {
  display: inline-block;
  padding: 0.375rem 0.75rem;
  border-radius: 100px;
  font-size: 0.875rem;
  font-weight: 500;
}

.account-badge.employer {
  background: rgba(16, 185, 129, 0.1);
  color: var(--secondary);
}

.account-badge.employee {
  background: rgba(59, 130, 246, 0.1);
  color: #3b82f6;
}

/* balance cards */
.balance-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1.5rem;
  max-width: 800px;
}

.balance-card {
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 20px;
  padding: 1.5rem;
}

.balance-card.confidential {
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.9) 0%, rgba(16, 185, 129, 0.05) 100%);
  border-color: rgba(16, 185, 129, 0.2);
}

.balance-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1rem;
}

.balance-label {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-secondary);
}

.balance-icon {
  font-size: 1.5rem;
}

.balance-value {
  font-size: 2rem;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 0.5rem;
}

.balance-footer {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.loading-text {
  color: var(--text-muted);
  font-size: 1.25rem;
  font-weight: 500;
}

.not-setup {
  color: var(--text-muted);
  font-size: 1.25rem;
  font-style: italic;
}

.setup-link {
  background: none;
  border: none;
  padding: 0;
  font-size: 0.75rem;
  color: var(--secondary);
  cursor: pointer;
  text-decoration: underline;
  font-family: inherit;
}

.setup-link:hover {
  color: #059669;
}

/* blur effect for confidential balance - hover to reveal */
.blur-hover {
  filter: blur(6px);
  transition: filter 0.3s ease;
  cursor: pointer;
}

.balance-card:hover .blur-hover {
  filter: blur(0);
}

</style>

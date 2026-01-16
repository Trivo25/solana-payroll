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

        <div class="cards-grid">
          <!-- Placeholder cards -->
          <div class="card">
            <div class="card-icon">&#x1F4B0;</div>
            <h3>Confidential Balance</h3>
            <p class="card-value blur-reveal">••••••</p>
            <p class="card-label">Hover to reveal</p>
          </div>

          <div class="card">
            <div class="card-icon">&#x1F4E4;</div>
            <h3>Send Payment</h3>
            <p class="card-description">Send private payments to any Solana address</p>
            <button class="btn btn-card" disabled>Coming Soon</button>
          </div>

          <div class="card">
            <div class="card-icon">&#x1F4DC;</div>
            <h3>ZK Receipts</h3>
            <p class="card-description">Generate zero-knowledge proofs for your payments</p>
            <button class="btn btn-card" disabled>Coming Soon</button>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { useWallet } from 'solana-wallets-vue'

const { connected, publicKey, disconnect } = useWallet()

function shortenAddress(address: string): string {
  if (!address) return ''
  return `${address.slice(0, 4)}...${address.slice(-4)}`
}

// Redirect to connect if not connected
onMounted(() => {
  if (!connected.value) {
    // Give some time for wallet to auto-connect
    setTimeout(() => {
      if (!connected.value) {
        navigateTo('/connect')
      }
    }, 1000)
  }
})
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

/* Cards */
.cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1.5rem;
}

.card {
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 20px;
  padding: 2rem;
  transition: all 0.2s ease;
}

.card:hover {
  transform: translateY(-4px);
  box-shadow: 0 20px 40px rgba(15, 23, 42, 0.1);
}

.card-icon {
  font-size: 2rem;
  margin-bottom: 1rem;
}

.card h3 {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 0.5rem;
}

.card-value {
  font-size: 2rem;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 0.25rem;
}

.card-label {
  font-size: 0.875rem;
  color: var(--text-muted);
}

.card-description {
  font-size: 0.95rem;
  color: var(--text-secondary);
  margin-bottom: 1.5rem;
  line-height: 1.5;
}

.btn-card {
  width: 100%;
  padding: 1rem;
  background: var(--primary);
  color: white;
  border-radius: 12px;
}

.btn-card:disabled {
  background: rgba(15, 23, 42, 0.1);
  color: var(--text-muted);
  cursor: not-allowed;
}

/* Blur reveal effect */
.blur-reveal {
  filter: blur(8px);
  transition: filter 0.3s ease;
  cursor: pointer;
}

.card:hover .blur-reveal {
  filter: blur(0);
}
</style>

<template>
  <div class="wallet-connect">
    <!-- Wallet button -->
    <div class="wallet-list">
      <WalletMultiButton />
    </div>

    <!-- Connected state -->
    <div v-if="connected" class="connected-state">
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
    </div>
  </div>
</template>

<script setup lang="ts">
import { useWallet, WalletMultiButton } from 'solana-wallets-vue'

const { connected, publicKey } = useWallet()

function shortenAddress(address: string): string {
  if (!address) return ''
  return `${address.slice(0, 4)}...${address.slice(-4)}`
}
</script>

<style scoped>
.wallet-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.connected-state {
  margin-top: 1.5rem;
  padding-top: 1.5rem;
  border-top: 1px solid rgba(15, 23, 42, 0.08);
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
}

.btn-primary:hover {
  background: #1e293b;
  transform: translateY(-2px);
  box-shadow: 0 10px 40px rgba(15, 23, 42, 0.3);
}

/* Override solana-wallets-vue button styles */
:deep(.swv-button) {
  width: 100% !important;
  height: auto !important;
  padding: 1rem 1.5rem !important;
  font-size: 1rem !important;
  font-weight: 600 !important;
  border-radius: 12px !important;
  background: var(--primary) !important;
  color: white !important;
  border: none !important;
  justify-content: center !important;
}

:deep(.swv-button:hover) {
  background: #1e293b !important;
}
</style>

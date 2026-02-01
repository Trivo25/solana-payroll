<template>
  <div class="onboarding-page">
    <!-- Animated background -->
    <div class="background">
      <div class="gradient-mesh"></div>
      <div class="aurora aurora-1"></div>
      <div class="aurora aurora-2"></div>
      <div class="noise"></div>
      <div class="grid-pattern"></div>
      <div class="particles">
        <div v-for="i in 10" :key="i" class="particle" :style="getParticleStyle(i)"></div>
      </div>
    </div>

    <!-- Content -->
    <main class="content">
      <div class="onboarding-card">
        <div class="card-shine"></div>

        <div class="card-header">
          <NuxtLink to="/connect" class="back-link">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M10 12L6 8L10 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <span>Back</span>
          </NuxtLink>
        </div>

        <div class="card-body">
          <div class="icon-wrapper">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <path d="M16 4C9.373 4 4 9.373 4 16s5.373 12 12 12 12-5.373 12-12S22.627 4 16 4z" stroke="white" stroke-width="2"/>
              <path d="M12 16l3 3 5-6" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>

          <h1 class="title">Create Your Account</h1>
          <p class="subtitle">
            Set up your profile to start using private payments with zero-knowledge proofs
          </p>

          <form @submit.prevent="handleSubmit" class="form">
            <!-- Name input -->
            <div class="form-group">
              <label for="name" class="label">Display Name</label>
              <div class="input-wrapper">
                <input
                  id="name"
                  v-model="name"
                  type="text"
                  class="input"
                  placeholder="Enter your name or business name"
                  required
                />
              </div>
            </div>

            <!-- Account type selection -->
            <div class="form-group">
              <label class="label">Account Type</label>
              <div class="account-type-options">
                <button
                  type="button"
                  class="type-option"
                  :class="{ active: accountType === 'employer' }"
                  @click="accountType = 'employer'"
                >
                  <div class="type-icon-wrapper">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                      <rect x="3" y="7" width="18" height="14" rx="2" stroke="currentColor" stroke-width="2"/>
                      <path d="M8 7V5a4 4 0 018 0v2" stroke="currentColor" stroke-width="2"/>
                      <circle cx="12" cy="14" r="2" fill="currentColor"/>
                    </svg>
                  </div>
                  <div class="type-content">
                    <span class="type-label">Employer / Business</span>
                    <span class="type-description">Send private payments to employees or contractors</span>
                  </div>
                  <div class="type-check">
                    <svg v-if="accountType === 'employer'" width="20" height="20" viewBox="0 0 20 20" fill="none">
                      <circle cx="10" cy="10" r="10" fill="currentColor"/>
                      <path d="M6 10l3 3 5-6" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                  </div>
                </button>

                <button
                  type="button"
                  class="type-option"
                  :class="{ active: accountType === 'employee' }"
                  @click="accountType = 'employee'"
                >
                  <div class="type-icon-wrapper">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                      <path d="M12 2L2 7l10 5 10-5-10-5z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
                      <path d="M2 17l10 5 10-5" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
                      <path d="M2 12l10 5 10-5" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
                    </svg>
                  </div>
                  <div class="type-content">
                    <span class="type-label">Employee / Freelancer</span>
                    <span class="type-description">Receive private payments from employers</span>
                  </div>
                  <div class="type-check">
                    <svg v-if="accountType === 'employee'" width="20" height="20" viewBox="0 0 20 20" fill="none">
                      <circle cx="10" cy="10" r="10" fill="currentColor"/>
                      <path d="M6 10l3 3 5-6" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                  </div>
                </button>
              </div>
            </div>

            <!-- Wallet address (readonly) -->
            <div class="form-group">
              <label class="label">Connected Wallet</label>
              <div class="wallet-display">
                <div class="wallet-icon">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <rect x="2" y="4" width="12" height="10" rx="2" stroke="currentColor" stroke-width="1.5"/>
                    <path d="M11 9.5a1 1 0 100-2 1 1 0 000 2z" fill="currentColor"/>
                    <path d="M4 4V3a2 2 0 012-2h4a2 2 0 012 2v1" stroke="currentColor" stroke-width="1.5"/>
                  </svg>
                </div>
                <span class="wallet-address mono">{{ walletAddress || 'Not connected' }}</span>
                <div v-if="walletAddress" class="wallet-status">
                  <span class="status-dot"></span>
                  <span>Connected</span>
                </div>
              </div>
            </div>

            <!-- Submit button -->
            <button
              type="submit"
              class="submit-btn"
              :disabled="!canSubmit || isSubmitting"
            >
              <span v-if="isSubmitting" class="btn-content">
                <div class="spinner"></div>
                <span>Creating account...</span>
              </span>
              <span v-else class="btn-content">
                <span>Create Account</span>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </span>
            </button>

            <p v-if="error" class="error-message">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <circle cx="7" cy="7" r="6" stroke="currentColor" stroke-width="1.5"/>
                <path d="M7 4v3M7 9v1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              </svg>
              {{ error }}
            </p>
          </form>
        </div>

        <div class="card-footer">
          <div class="security-note">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 1L2 3.5V6.5C2 9.5 4 12 7 13C10 12 12 9.5 12 6.5V3.5L7 1Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <span>Your keys never leave your device</span>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useSupabase, type AccountType } from '~/composables/useSupabase'

const name = ref('')
const accountType = ref<AccountType | null>(null)
const walletAddress = ref('')
const isSubmitting = ref(false)
const error = ref('')

const { createAccount } = useSupabase()

const canSubmit = computed(() => {
  return name.value.trim() && accountType.value && walletAddress.value
})

function getParticleStyle(i: number) {
  const size = 2 + Math.random() * 3;
  return {
    width: `${size}px`,
    height: `${size}px`,
    left: `${Math.random() * 100}%`,
    top: `${Math.random() * 100}%`,
    animationDelay: `${Math.random() * 15}s`,
    animationDuration: `${12 + Math.random() * 15}s`,
  };
}

onMounted(async () => {
  try {
    const { initWallet, useWallet } = await import('solana-wallets-vue')

    let wallet
    try {
      wallet = useWallet()
    } catch {
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

    if (wallet.publicKey.value) {
      walletAddress.value = wallet.publicKey.value.toBase58()
    } else {
      const unwatch = watch(
        () => wallet.publicKey.value,
        (pk) => {
          if (pk) {
            walletAddress.value = pk.toBase58()
            unwatch()
          }
        }
      )

      setTimeout(() => {
        if (!wallet.connected.value) {
          navigateTo('/connect')
        }
      }, 2000)
    }
  } catch (e) {
    console.error('failed to get wallet:', e)
    navigateTo('/connect')
  }
})

async function handleSubmit() {
  if (!canSubmit.value) return

  isSubmitting.value = true
  error.value = ''

  try {
    const account = await createAccount(
      walletAddress.value,
      name.value.trim(),
      accountType.value!
    )

    if (account) {
      navigateTo('/dashboard')
    } else {
      error.value = 'Failed to create account. Please try again.'
    }
  } catch (e) {
    console.error('failed to create account:', e)
    error.value = 'An error occurred. Please try again.'
  } finally {
    isSubmitting.value = false
  }
}
</script>

<style scoped>
.onboarding-page {
  min-height: 100vh;
  position: relative;
  overflow: hidden;
}

/* Animated Background */
.background {
  position: fixed;
  inset: 0;
  z-index: 0;
  overflow: hidden;
}

.gradient-mesh {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(at 30% 20%, rgba(16, 185, 129, 0.1) 0px, transparent 50%),
    radial-gradient(at 70% 80%, rgba(6, 182, 212, 0.08) 0px, transparent 50%),
    radial-gradient(at 0% 50%, rgba(16, 185, 129, 0.06) 0px, transparent 50%);
}

.aurora {
  position: absolute;
  filter: blur(100px);
  opacity: 0.4;
}

.aurora-1 {
  width: 50vw;
  height: 50vh;
  background: linear-gradient(180deg, rgba(16, 185, 129, 0.4) 0%, rgba(16, 185, 129, 0) 100%);
  top: -15%;
  right: -10%;
  animation: aurora1 18s ease-in-out infinite;
}

.aurora-2 {
  width: 40vw;
  height: 40vh;
  background: linear-gradient(180deg, rgba(6, 182, 212, 0.3) 0%, rgba(6, 182, 212, 0) 100%);
  bottom: -10%;
  left: -10%;
  animation: aurora2 22s ease-in-out infinite;
}

@keyframes aurora1 {
  0%, 100% { transform: translateY(0) rotate(0deg) scale(1); }
  50% { transform: translateY(-20px) rotate(3deg) scale(1.05); }
}

@keyframes aurora2 {
  0%, 100% { transform: translateX(0) rotate(0deg); }
  50% { transform: translateX(30px) rotate(-3deg); }
}

.noise {
  position: absolute;
  inset: 0;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
  opacity: 0.015;
  pointer-events: none;
}

.grid-pattern {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(15, 23, 42, 0.015) 1px, transparent 1px),
    linear-gradient(90deg, rgba(15, 23, 42, 0.015) 1px, transparent 1px);
  background-size: 60px 60px;
}

.particles {
  position: absolute;
  inset: 0;
  overflow: hidden;
}

.particle {
  position: absolute;
  background: rgba(16, 185, 129, 0.5);
  border-radius: 50%;
  animation: float-particle linear infinite;
}

@keyframes float-particle {
  0% { transform: translateY(100vh) rotate(0deg); opacity: 0; }
  10% { opacity: 1; }
  90% { opacity: 1; }
  100% { transform: translateY(-100vh) rotate(720deg); opacity: 0; }
}

/* Content */
.content {
  position: relative;
  z-index: 1;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
}

/* Card */
.onboarding-card {
  position: relative;
  width: 100%;
  max-width: 480px;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(15, 23, 42, 0.06);
  border-radius: 24px;
  overflow: hidden;
  box-shadow:
    0 25px 50px -12px rgba(0, 0, 0, 0.08),
    0 0 0 1px rgba(255, 255, 255, 0.5) inset;
  animation: card-appear 0.5s cubic-bezier(0.4, 0, 0.2, 1);
}

@keyframes card-appear {
  from {
    opacity: 0;
    transform: translateY(20px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.card-shine {
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent);
  animation: card-shine 4s ease-in-out infinite;
}

@keyframes card-shine {
  0% { left: -100%; }
  50%, 100% { left: 100%; }
}

.card-header {
  padding: 1.5rem 1.5rem 0;
}

.back-link {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--text-secondary);
  text-decoration: none;
  font-size: 0.875rem;
  font-weight: 500;
  transition: all 0.2s ease;
  padding: 0.5rem 0.75rem;
  margin: -0.5rem -0.75rem;
  border-radius: 8px;
}

.back-link:hover {
  color: var(--text-primary);
  background: rgba(15, 23, 42, 0.03);
}

.back-link svg {
  transition: transform 0.2s ease;
}

.back-link:hover svg {
  transform: translateX(-2px);
}

.card-body {
  padding: 2rem;
}

.icon-wrapper {
  width: 64px;
  height: 64px;
  margin: 0 auto 1.5rem;
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: icon-float 3s ease-in-out infinite;
  box-shadow: 0 8px 24px rgba(16, 185, 129, 0.3);
}

@keyframes icon-float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-5px); }
}

.title {
  font-size: 1.75rem;
  font-weight: 800;
  color: var(--text-primary);
  margin-bottom: 0.5rem;
  text-align: center;
  letter-spacing: -0.02em;
}

.subtitle {
  font-size: 1rem;
  color: var(--text-secondary);
  margin-bottom: 2rem;
  text-align: center;
  line-height: 1.6;
}

/* Form */
.form {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.label {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 0;
}

.input-wrapper {
  position: relative;
}

.input {
  width: 100%;
  padding: 0.875rem 1rem;
  border: 1.5px solid rgba(15, 23, 42, 0.1);
  border-radius: 12px;
  font-size: 1rem;
  font-family: inherit;
  background: white;
  transition: all 0.2s ease;
}

.input:focus {
  outline: none;
  border-color: var(--secondary);
  box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1);
}

.input::placeholder {
  color: var(--text-muted);
}

/* Account type options */
.account-type-options {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.type-option {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem 1.25rem;
  border: 1.5px solid rgba(15, 23, 42, 0.1);
  border-radius: 14px;
  background: white;
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: left;
  font-family: inherit;
}

.type-option:hover {
  border-color: rgba(15, 23, 42, 0.2);
  background: rgba(15, 23, 42, 0.02);
}

.type-option.active {
  border-color: var(--secondary);
  background: rgba(16, 185, 129, 0.05);
}

.type-icon-wrapper {
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(15, 23, 42, 0.05);
  border-radius: 10px;
  color: var(--text-secondary);
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.type-option.active .type-icon-wrapper {
  background: rgba(16, 185, 129, 0.15);
  color: var(--secondary);
}

.type-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.type-label {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--text-primary);
}

.type-description {
  font-size: 0.8rem;
  color: var(--text-secondary);
  line-height: 1.4;
}

.type-check {
  width: 20px;
  height: 20px;
  color: var(--secondary);
  flex-shrink: 0;
}

/* Wallet display */
.wallet-display {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.875rem 1rem;
  background: rgba(15, 23, 42, 0.03);
  border: 1.5px solid rgba(15, 23, 42, 0.06);
  border-radius: 12px;
}

.wallet-icon {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: white;
  border-radius: 8px;
  color: var(--text-secondary);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.wallet-address {
  flex: 1;
  font-size: 0.8rem;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.wallet-status {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--secondary);
}

.status-dot {
  width: 6px;
  height: 6px;
  background: var(--secondary);
  border-radius: 50%;
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

/* Submit button */
.submit-btn {
  width: 100%;
  padding: 1rem 1.5rem;
  background: linear-gradient(135deg, var(--primary) 0%, #1e293b 100%);
  color: white;
  font-size: 1rem;
  font-weight: 600;
  font-family: inherit;
  border: none;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.submit-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 12px 40px rgba(15, 23, 42, 0.25);
}

.submit-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-content {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.spinner {
  width: 18px;
  height: 18px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* Error message */
.error-message {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  color: var(--error);
  font-size: 0.875rem;
  text-align: center;
  padding: 0.75rem;
  background: rgba(239, 68, 68, 0.08);
  border-radius: 8px;
}

/* Card footer */
.card-footer {
  padding: 1rem 2rem 1.5rem;
  text-align: center;
}

.security-note {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8rem;
  color: var(--text-muted);
}

.security-note svg {
  color: var(--secondary);
}
</style>

<template>
  <div class="onboarding-page">
    <!-- background -->
    <div class="background">
      <div class="gradient-orb orb-1"></div>
      <div class="gradient-orb orb-2"></div>
      <div class="grid-pattern"></div>
    </div>

    <!-- content -->
    <main class="content">
      <div class="onboarding-card">
        <div class="card-header">
          <NuxtLink to="/connect" class="back-link">
            <span class="arrow">&larr;</span>
            <span>Back</span>
          </NuxtLink>
        </div>

        <div class="card-body">
          <div class="icon-wrapper">
            <span class="icon">&#x1F44B;</span>
          </div>

          <h1 class="title">Create Your Account</h1>
          <p class="subtitle">
            Set up your profile to get started with private payments
          </p>

          <form @submit.prevent="handleSubmit" class="form">
            <!-- name input -->
            <div class="form-group">
              <label for="name" class="label">Display Name</label>
              <input
                id="name"
                v-model="name"
                type="text"
                class="input"
                placeholder="Enter your name or business name"
                required
              />
            </div>

            <!-- account type selection -->
            <div class="form-group">
              <label class="label">Account Type</label>
              <div class="account-type-options">
                <button
                  type="button"
                  class="type-option"
                  :class="{ active: accountType === 'employer' }"
                  @click="accountType = 'employer'"
                >
                  <span class="type-icon">&#x1F4BC;</span>
                  <span class="type-label">Employer / Business</span>
                  <span class="type-description">Send payments to employees or contractors</span>
                </button>

                <button
                  type="button"
                  class="type-option"
                  :class="{ active: accountType === 'employee' }"
                  @click="accountType = 'employee'"
                >
                  <span class="type-icon">&#x1F4B8;</span>
                  <span class="type-label">Employee / Freelancer</span>
                  <span class="type-description">Receive payments from employers</span>
                </button>
              </div>
            </div>

            <!-- wallet address (readonly) -->
            <div class="form-group">
              <label class="label">Wallet Address</label>
              <div class="wallet-display mono">
                {{ walletAddress || 'Not connected' }}
              </div>
            </div>

            <!-- submit button -->
            <button
              type="submit"
              class="btn btn-primary"
              :disabled="!canSubmit || isSubmitting"
            >
              <span v-if="isSubmitting">Creating account...</span>
              <span v-else>Create Account</span>
            </button>

            <p v-if="error" class="error-message">{{ error }}</p>
          </form>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
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

onMounted(async () => {
  // get wallet address
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
      // wait for wallet to connect
      const unwatch = watch(
        () => wallet.publicKey.value,
        (pk) => {
          if (pk) {
            walletAddress.value = pk.toBase58()
            unwatch()
          }
        }
      )

      // redirect if not connected after timeout
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

/* background */
.background {
  position: absolute;
  inset: 0;
  z-index: 0;
  overflow: hidden;
}

.gradient-orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
  opacity: 0.5;
}

.orb-1 {
  width: 500px;
  height: 500px;
  background: linear-gradient(135deg, var(--secondary) 0%, rgba(16, 185, 129, 0.3) 100%);
  top: -150px;
  right: -100px;
}

.orb-2 {
  width: 400px;
  height: 400px;
  background: linear-gradient(135deg, var(--primary) 0%, rgba(15, 23, 42, 0.4) 100%);
  bottom: -100px;
  left: -100px;
}

.grid-pattern {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(15, 23, 42, 0.03) 1px, transparent 1px),
    linear-gradient(90deg, rgba(15, 23, 42, 0.03) 1px, transparent 1px);
  background-size: 60px 60px;
}

/* content */
.content {
  position: relative;
  z-index: 1;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
}

/* card */
.onboarding-card {
  width: 100%;
  max-width: 500px;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 24px;
  overflow: hidden;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.1);
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
  transition: color 0.2s;
}

.back-link:hover {
  color: var(--text-primary);
}

.arrow {
  font-size: 1.25rem;
}

.card-body {
  padding: 2rem;
}

.icon-wrapper {
  width: 64px;
  height: 64px;
  margin: 0 auto 1.5rem;
  background: linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%);
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.icon {
  font-size: 2rem;
}

.title {
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 0.5rem;
  text-align: center;
}

.subtitle {
  font-size: 1rem;
  color: var(--text-secondary);
  margin-bottom: 2rem;
  text-align: center;
}

/* form */
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
}

.input {
  padding: 0.875rem 1rem;
  border: 1px solid rgba(15, 23, 42, 0.1);
  border-radius: 12px;
  font-size: 1rem;
  font-family: inherit;
  background: white;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.input:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 3px rgba(15, 23, 42, 0.1);
}

.input::placeholder {
  color: var(--text-muted);
}

/* account type options */
.account-type-options {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.type-option {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding: 1rem 1.25rem;
  border: 2px solid rgba(15, 23, 42, 0.1);
  border-radius: 12px;
  background: white;
  cursor: pointer;
  transition: all 0.2s;
  text-align: left;
  font-family: inherit;
}

.type-option:hover {
  border-color: rgba(15, 23, 42, 0.2);
}

.type-option.active {
  border-color: var(--secondary);
  background: rgba(16, 185, 129, 0.05);
}

.type-icon {
  font-size: 1.5rem;
  margin-bottom: 0.5rem;
}

.type-label {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
}

.type-description {
  font-size: 0.875rem;
  color: var(--text-secondary);
  margin-top: 0.25rem;
}

/* wallet display */
.wallet-display {
  padding: 0.875rem 1rem;
  background: rgba(15, 23, 42, 0.05);
  border-radius: 12px;
  font-size: 0.875rem;
  color: var(--text-secondary);
  word-break: break-all;
}

/* button */
.btn {
  padding: 1rem 2rem;
  font-size: 1rem;
  font-weight: 600;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  border: none;
  font-family: inherit;
}

.btn-primary {
  background: var(--primary);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #1e293b;
  transform: translateY(-2px);
  box-shadow: 0 10px 40px rgba(15, 23, 42, 0.3);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* error */
.error-message {
  color: #ef4444;
  font-size: 0.875rem;
  text-align: center;
}
</style>

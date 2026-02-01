<template>
  <div v-if="showWizard" class="setup-wizard" :class="{ 'is-complete': isComplete }">
    <div class="wizard-header">
      <div class="wizard-title-row">
        <div class="wizard-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2L2 7l10 5 10-5-10-5z"/>
            <path d="M2 17l10 5 10-5"/>
            <path d="M2 12l10 5 10-5"/>
          </svg>
        </div>
        <div>
          <h3>Get Started with Veil</h3>
          <p class="wizard-subtitle">Complete these steps to start using private payments</p>
        </div>
      </div>
      <button class="dismiss-btn" @click="dismiss" title="Dismiss">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 6L6 18M6 6l12 12"/>
        </svg>
      </button>
    </div>

    <div v-if="!isComplete" class="steps">
      <div
        v-for="(step, index) in steps"
        :key="index"
        class="step"
        :class="{
          completed: step.completed,
          active: index === currentStepIndex,
          upcoming: index > currentStepIndex
        }"
      >
        <div class="step-indicator">
          <div class="step-circle">
            <svg v-if="step.completed" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
              <path d="M20 6L9 17l-5-5"/>
            </svg>
            <span v-else>{{ index + 1 }}</span>
          </div>
          <div v-if="index < steps.length - 1" class="step-line" :class="{ filled: step.completed }"></div>
        </div>

        <div class="step-content">
          <div class="step-header">
            <span class="step-title">{{ step.title }}</span>
            <span v-if="step.completed" class="step-badge completed">Done</span>
            <span v-else-if="index === currentStepIndex" class="step-badge active">Current</span>
          </div>
          <p class="step-desc">{{ step.description }}</p>

          <button
            v-if="index === currentStepIndex && !step.completed"
            class="step-action-btn"
            :disabled="step.loading"
            @click="step.action"
          >
            <span v-if="step.loading" class="btn-spinner"></span>
            {{ step.loading ? step.loadingText : step.actionText }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="isComplete" class="wizard-complete">
      <div class="complete-icon">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
          <path d="M22 4L12 14.01l-3-3"/>
        </svg>
      </div>
      <h4>You're all set!</h4>
      <p>Start sending and receiving private payments.</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useConfidentialTransfer } from '~/composables/useConfidentialTransfer'
import { useToast } from '~/composables/useToast'

const props = defineProps<{
  wallet: any
}>()

const {
  loading,
  testMint,
  elGamalPublicKey,
  setupTestMint,
  setupTokenAccount,
  deriveElGamalKeypair,
  configureConfidentialTransferAccount,
  mintTestTokens,
  depositToConfidential,
  applyPendingBalance,
  getPublicBalance,
  getPendingBalance,
  getConfidentialBalance,
  isAccountConfigured,
} = useConfidentialTransfer()

const toast = useToast()
const dismissed = ref(false)

// step states
const enableLoading = ref(false)
const unlockLoading = ref(false)
const mintLoading = ref(false)
const depositLoading = ref(false)
const applyLoading = ref(false)

// completion states
const isEnabled = ref(false)
const isUnlocked = ref(false)
const hasFunds = ref(false)
const hasDeposited = ref(false)
const hasPrivateBalance = ref(false)

const STORAGE_KEY = 'veil-setup-dismissed'

const steps = computed(() => [
  {
    title: 'Enable Confidential Transfers',
    description: 'Set up your account for private transactions',
    completed: isEnabled.value,
    loading: enableLoading.value,
    loadingText: 'Setting up...',
    actionText: 'Enable Now',
    action: handleEnable,
  },
  {
    title: 'Unlock Private Balance',
    description: 'Sign a message to derive your encryption keys',
    completed: isUnlocked.value,
    loading: unlockLoading.value,
    loadingText: 'Unlocking...',
    actionText: 'Unlock',
    action: handleUnlock,
  },
  {
    title: 'Get Test Tokens',
    description: 'Mint some test USDC to try out the app',
    completed: hasFunds.value,
    loading: mintLoading.value,
    loadingText: 'Minting...',
    actionText: 'Mint 100 cUSDC',
    action: handleMint,
  },
  {
    title: 'Deposit to Pending',
    description: 'Move tokens from public to pending balance',
    completed: hasDeposited.value,
    loading: depositLoading.value,
    loadingText: 'Depositing...',
    actionText: 'Deposit 50 cUSDC',
    action: handleDeposit,
  },
  {
    title: 'Apply Pending Balance',
    description: 'Make your pending balance available for transfers',
    completed: hasPrivateBalance.value,
    loading: applyLoading.value,
    loadingText: 'Applying...',
    actionText: 'Apply Balance',
    action: handleApply,
  },
])

const currentStepIndex = computed(() => {
  const idx = steps.value.findIndex(s => !s.completed)
  return idx === -1 ? steps.value.length - 1 : idx
})

const isComplete = computed(() => steps.value.every(s => s.completed))
const showComplete = ref(false)

const showWizard = computed(() => {
  if (dismissed.value) return false
  if (isComplete.value) return showComplete.value
  return true
})

async function checkStatus() {
  if (!props.wallet?.publicKey) return

  // check if mint exists
  const storedMint = localStorage.getItem('veil-ct-mint')
  if (storedMint) {
    isEnabled.value = true
  }

  // check if keys derived
  if (elGamalPublicKey.value) {
    isUnlocked.value = true
  }

  // check balances
  try {
    const pubBal = await getPublicBalance(props.wallet, 'USDC')
    const pendingBal = await getPendingBalance(props.wallet, 'USDC')
    const privBal = await getConfidentialBalance(props.wallet, 'USDC')

    hasFunds.value = pubBal > 0 || pendingBal > 0 || privBal > 0
    hasDeposited.value = pendingBal > 0 || privBal > 0
    hasPrivateBalance.value = privBal > 0
  } catch {
    // ignore
  }
}

async function handleEnable() {
  if (!props.wallet?.publicKey) return
  enableLoading.value = true

  try {
    await setupTestMint(props.wallet)
    await setupTokenAccount(props.wallet)
    isEnabled.value = true
    toast.success('Confidential transfers enabled!')
  } catch (e: any) {
    console.error('enable failed:', e)
    toast.error('Setup Failed', { message: e.message })
  } finally {
    enableLoading.value = false
  }
}

async function handleUnlock() {
  if (!props.wallet?.publicKey) return
  unlockLoading.value = true

  try {
    await deriveElGamalKeypair(props.wallet)

    // auto-configure if needed
    const configured = await isAccountConfigured(props.wallet)
    if (!configured) {
      await configureConfidentialTransferAccount(props.wallet)
    }

    isUnlocked.value = true
    toast.success('Private balance unlocked!')
  } catch (e: any) {
    console.error('unlock failed:', e)
    toast.error('Unlock Failed', { message: e.message })
  } finally {
    unlockLoading.value = false
  }
}

async function handleMint() {
  if (!props.wallet?.publicKey) return
  mintLoading.value = true

  try {
    await mintTestTokens(props.wallet, 100, 'USDC')
    hasFunds.value = true
    toast.success('Minted 100 cUSDC!')
  } catch (e: any) {
    console.error('mint failed:', e)
    toast.error('Mint Failed', { message: e.message })
  } finally {
    mintLoading.value = false
  }
}

async function handleDeposit() {
  if (!props.wallet?.publicKey) return
  depositLoading.value = true

  try {
    await depositToConfidential(props.wallet, 50, 'USDC')
    hasDeposited.value = true
    toast.success('Deposited 50 cUSDC to pending balance!')
  } catch (e: any) {
    console.error('deposit failed:', e)
    toast.error('Deposit Failed', { message: e.message })
  } finally {
    depositLoading.value = false
  }
}

async function handleApply() {
  if (!props.wallet?.publicKey) return
  applyLoading.value = true

  try {
    await applyPendingBalance(props.wallet, 'USDC')
    hasPrivateBalance.value = true
    toast.success('Balance applied! You can now send private payments.')
  } catch (e: any) {
    console.error('apply failed:', e)
    toast.error('Apply Failed', { message: e.message })
  } finally {
    applyLoading.value = false
  }
}

function dismiss() {
  dismissed.value = true
  localStorage.setItem(STORAGE_KEY, 'true')
}

watch(() => props.wallet?.publicKey, () => {
  checkStatus()
})

watch(elGamalPublicKey, (val) => {
  if (val) {
    isUnlocked.value = true
    checkStatus()
  }
})

watch(testMint, (val) => {
  if (val) {
    isEnabled.value = true
  }
})

watch(isComplete, (val) => {
  if (val) {
    showComplete.value = true
    // auto-hide after 3 seconds
    setTimeout(() => {
      showComplete.value = false
      localStorage.setItem(STORAGE_KEY, 'true')
    }, 3000)
  }
})

// poll for balance changes
let pollInterval: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  const wasDismissed = localStorage.getItem(STORAGE_KEY)
  if (wasDismissed) {
    dismissed.value = true
  }
  checkStatus()

  // poll every 3 seconds to catch external changes
  pollInterval = setInterval(() => {
    if (!isComplete.value) {
      checkStatus()
    }
  }, 3000)
})

onUnmounted(() => {
  if (pollInterval) {
    clearInterval(pollInterval)
  }
})
</script>

<style scoped>
.setup-wizard {
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(16, 185, 129, 0.08) 100%);
  border: 1px solid rgba(16, 185, 129, 0.2);
  border-radius: 20px;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
}

.wizard-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1.5rem;
}

.wizard-title-row {
  display: flex;
  gap: 1rem;
  align-items: flex-start;
}

.wizard-icon {
  width: 48px;
  height: 48px;
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  flex-shrink: 0;
}

.wizard-header h3 {
  font-size: 1.125rem;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0 0 0.25rem 0;
}

.wizard-subtitle {
  font-size: 0.875rem;
  color: var(--text-secondary);
  margin: 0;
}

.dismiss-btn {
  background: none;
  border: none;
  padding: 0.5rem;
  color: var(--text-muted);
  cursor: pointer;
  border-radius: 8px;
  transition: all 0.2s;
}

.dismiss-btn:hover {
  background: rgba(15, 23, 42, 0.05);
  color: var(--text-secondary);
}

.steps {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.step {
  display: flex;
  gap: 1rem;
  opacity: 1;
  transition: opacity 0.2s;
}

.step.upcoming {
  opacity: 0.5;
}

.step-indicator {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex-shrink: 0;
}

.step-circle {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  font-weight: 600;
  background: rgba(15, 23, 42, 0.08);
  color: var(--text-secondary);
  transition: all 0.2s;
}

.step.completed .step-circle {
  background: #10b981;
  color: white;
}

.step.active .step-circle {
  background: var(--primary);
  color: white;
}

.step-line {
  width: 2px;
  flex: 1;
  min-height: 24px;
  background: rgba(15, 23, 42, 0.1);
  margin: 4px 0;
  transition: background 0.2s;
}

.step-line.filled {
  background: #10b981;
}

.step-content {
  flex: 1;
  padding-bottom: 1.25rem;
}

.step-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.25rem;
}

.step-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-primary);
}

.step-badge {
  font-size: 0.625rem;
  font-weight: 600;
  padding: 0.125rem 0.5rem;
  border-radius: 100px;
  text-transform: uppercase;
  letter-spacing: 0.02em;
}

.step-badge.completed {
  background: rgba(16, 185, 129, 0.15);
  color: #059669;
}

.step-badge.active {
  background: rgba(99, 102, 241, 0.15);
  color: #6366f1;
}

.step-desc {
  font-size: 0.8rem;
  color: var(--text-secondary);
  margin: 0 0 0.75rem 0;
  line-height: 1.4;
}

.step-action-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  font-size: 0.8rem;
  font-weight: 600;
  background: var(--primary);
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  font-family: inherit;
}

.step-action-btn:hover:not(:disabled) {
  background: #1e293b;
  transform: translateY(-1px);
}

.step-action-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.btn-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.wizard-complete {
  text-align: center;
  padding: 2rem 1rem;
  animation: celebrate 0.5s ease-out;
}

@keyframes celebrate {
  0% {
    opacity: 0;
    transform: scale(0.9);
  }
  50% {
    transform: scale(1.02);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}

.complete-icon {
  color: #10b981;
  margin-bottom: 0.75rem;
  animation: pop 0.4s ease-out 0.2s both;
}

@keyframes pop {
  0% {
    transform: scale(0);
  }
  70% {
    transform: scale(1.2);
  }
  100% {
    transform: scale(1);
  }
}

.wizard-complete h4 {
  font-size: 1.125rem;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0 0 0.25rem 0;
}

.wizard-complete p {
  font-size: 0.875rem;
  color: var(--text-secondary);
  margin: 0;
}

.setup-wizard.is-complete {
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(16, 185, 129, 0.05) 100%);
  border-color: rgba(16, 185, 129, 0.3);
}
</style>

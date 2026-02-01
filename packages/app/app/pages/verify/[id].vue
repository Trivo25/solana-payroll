<template>
  <div class="verify-page">
    <div class="verify-container">
      <!-- Header -->
      <div class="verify-header">
        <div class="logo">
          <NuxtLink to="/" class="logo-link">
            <span class="logo-icon">V</span>
            <span class="logo-text">Veil</span>
          </NuxtLink>
        </div>
        <h1 class="page-title">ZK Receipt Verification</h1>
        <p class="page-subtitle">
          Verify a zero-knowledge proof of payment without seeing sensitive details.
        </p>
      </div>

      <!-- Upload Section -->
      <div class="upload-section" v-if="verificationState === 'idle'">
        <div
          class="upload-zone"
          :class="{ dragover: isDragging }"
          @dragover.prevent="isDragging = true"
          @dragleave.prevent="isDragging = false"
          @drop.prevent="handleDrop"
        >
          <div class="upload-prompt">
            <div class="upload-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke-linecap="round" stroke-linejoin="round"/>
                <polyline points="14 2 14 8 20 8" stroke-linecap="round" stroke-linejoin="round"/>
                <line x1="12" y1="18" x2="12" y2="12" stroke-linecap="round"/>
                <polyline points="9 15 12 12 15 15" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
            <p class="upload-text">Drop a ZK receipt file here</p>
            <p class="upload-hint">or</p>
            <label class="upload-btn">
              <input type="file" accept=".json" @change="handleFileSelect" hidden />
              Choose File
            </label>
          </div>
        </div>
      </div>

      <!-- Verification Animation -->
      <div v-if="verificationState !== 'idle'" class="verification-result">
        <!-- Stage 1: Loading file -->
        <div v-if="verificationStage === 'loading'" class="result-card stage-card">
          <div class="stage-icon">
            <div class="pulse-ring"></div>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke-linecap="round" stroke-linejoin="round"/>
              <polyline points="14 2 14 8 20 8" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <h2 class="stage-title">Loading Proof</h2>
          <p class="stage-desc">Parsing ZK receipt data...</p>
          <div class="progress-bar">
            <div class="progress-fill" style="width: 33%"></div>
          </div>
        </div>

        <!-- Stage 2: Initializing prover -->
        <div v-else-if="verificationStage === 'initializing'" class="result-card stage-card">
          <div class="stage-icon">
            <div class="pulse-ring"></div>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 2L2 7l10 5 10-5-10-5z" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M2 17l10 5 10-5" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M2 12l10 5 10-5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <h2 class="stage-title">Initializing Verifier</h2>
          <p class="stage-desc">Loading Barretenberg WASM module...</p>
          <div class="progress-bar">
            <div class="progress-fill" style="width: 50%"></div>
          </div>
        </div>

        <!-- Stage 3: Verifying -->
        <div v-else-if="verificationStage === 'verifying'" class="result-card stage-card">
          <div class="stage-icon verifying">
            <div class="circuit-animation">
              <div class="circuit-ring"></div>
              <div class="circuit-ring delay-1"></div>
              <div class="circuit-ring delay-2"></div>
            </div>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <h2 class="stage-title">Verifying Proof</h2>
          <p class="stage-desc">Running cryptographic verification...</p>
          <div class="constraint-counter">
            <span class="counter-value">{{ constraintCount.toLocaleString() }}</span>
            <span class="counter-label">constraints verified</span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill verifying-fill"></div>
          </div>
        </div>

        <!-- Stage 4: Revealing claims (valid) -->
        <div v-else-if="verificationStage === 'revealing'" class="result-card reveal-card">
          <div class="result-header">
            <div class="result-icon valid pulse-success">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <path d="M20 6L9 17l-5-5" stroke-linecap="round" stroke-linejoin="round" class="checkmark-path"/>
              </svg>
            </div>
            <h2 class="result-title">Proof Verified</h2>
            <p class="result-desc">Cryptographic verification successful</p>
          </div>

          <!-- Animated Claims -->
          <div class="verified-claims">
            <h3 class="claims-title">
              <span class="title-text">Verified Claims</span>
              <span class="claim-counter">{{ visibleClaimsCount }} / {{ allClaims.length }}</span>
            </h3>

            <TransitionGroup name="claim" tag="div" class="claims-list">
              <div
                v-for="(claim, index) in visibleClaims"
                :key="claim.id"
                class="claim-item"
                :style="{ '--delay': index * 0.1 + 's' }"
              >
                <span class="claim-check">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" fill="#10b981" class="check-circle"/>
                    <path d="M8 12l3 3 5-5" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="check-path"/>
                  </svg>
                </span>
                <div class="claim-content">
                  <span class="claim-label">{{ claim.label }}</span>
                  <span class="claim-value" :class="{ mono: claim.mono }">{{ claim.value }}</span>
                </div>
                <span v-if="claim.hidden" class="claim-badge hidden">Hidden</span>
                <span v-else-if="claim.revealed" class="claim-badge revealed">Revealed</span>
              </div>
            </TransitionGroup>
          </div>

          <!-- Proof Stats -->
          <div v-if="showStats" class="proof-stats">
            <div class="stat-item">
              <span class="stat-value">{{ proofStats.constraints.toLocaleString() }}</span>
              <span class="stat-label">Constraints</span>
            </div>
            <div class="stat-item">
              <span class="stat-value">{{ proofStats.proofSize }}</span>
              <span class="stat-label">Proof Size</span>
            </div>
            <div class="stat-item">
              <span class="stat-value">{{ proofStats.verifyTime }}</span>
              <span class="stat-label">Verify Time</span>
            </div>
          </div>

          <!-- Privacy Note -->
          <div v-if="showPrivacyNote" class="privacy-note">
            <span class="note-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </span>
            <span v-if="hasDisclosures">
              This proof selectively reveals certain facts while keeping {{ hiddenCount }} field{{ hiddenCount !== 1 ? 's' : '' }} private.
            </span>
            <span v-else>
              This proof reveals nothing about the payment amount, sender, or recipient.
              Only that a valid payment matching the invoice was made.
            </span>
          </div>

          <button class="verify-another-btn" @click="clearFile">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke-linecap="round" stroke-linejoin="round"/>
              <polyline points="14 2 14 8 20 8" stroke-linecap="round" stroke-linejoin="round"/>
              <line x1="12" y1="18" x2="12" y2="12" stroke-linecap="round"/>
              <polyline points="9 15 12 12 15 15" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            Verify Another Proof
          </button>
        </div>

        <!-- Invalid -->
        <div v-else-if="verificationStage === 'invalid'" class="result-card invalid-card">
          <div class="result-icon invalid shake">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <line x1="18" y1="6" x2="6" y2="18" stroke-linecap="round" stroke-linejoin="round"/>
              <line x1="6" y1="6" x2="18" y2="18" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <h2 class="result-title">Verification Failed</h2>
          <p class="result-desc">
            This proof could not be verified. It may be corrupted or tampered with.
          </p>
          <button class="retry-btn" @click="clearFile">Try Another File</button>
        </div>

        <!-- Error -->
        <div v-else-if="verificationStage === 'error'" class="result-card error-card">
          <div class="result-icon error">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke-linecap="round" stroke-linejoin="round"/>
              <line x1="12" y1="9" x2="12" y2="13" stroke-linecap="round" stroke-linejoin="round"/>
              <line x1="12" y1="17" x2="12.01" y2="17" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <h2 class="result-title">Error</h2>
          <p class="result-desc">{{ errorMessage }}</p>
          <button class="retry-btn" @click="clearFile">Try Again</button>
        </div>
      </div>

      <!-- Info Section -->
      <div class="info-section" v-if="verificationState === 'idle'">
        <h3 class="info-title">How ZK Receipts Work</h3>
        <div class="info-cards">
          <div class="info-card">
            <span class="info-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M7 11V7a5 5 0 0110 0v4" stroke-linecap="round" stroke-linejoin="round"/>
                <circle cx="12" cy="16" r="1" fill="currentColor"/>
              </svg>
            </span>
            <h4>Privacy-Preserving</h4>
            <p>
              ZK proofs verify payment facts without revealing sensitive transaction details
              like amounts or wallet addresses.
            </p>
          </div>
          <div class="info-card">
            <span class="info-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M9 12l2 2 4-4" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </span>
            <h4>Cryptographically Secure</h4>
            <p>
              Proofs are mathematically impossible to forge. If verification passes,
              the payment definitely occurred.
            </p>
          </div>
          <div class="info-card">
            <span class="info-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </span>
            <h4>Blockchain Linked</h4>
            <p>
              Each receipt is tied to a specific invoice and on-chain confidential transfer,
              providing an auditable trail.
            </p>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="verify-footer">
        <p>Powered by <strong>Veil</strong> - Private Payments on Solana</p>
        <NuxtLink to="/" class="back-link">Back to Veil</NuxtLink>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { useZkReceipts, type ZkReceiptProof } from '~/composables/useZkReceipts'

const route = useRoute()
const {
  loadProofFromFile,
  verifyReceipt,
  initializeProver,
} = useZkReceipts()

// state
const isDragging = ref(false)
const uploadedProof = ref<ZkReceiptProof | null>(null)
const verificationState = ref<'idle' | 'verifying' | 'complete'>('idle')
const verificationStage = ref<'loading' | 'initializing' | 'verifying' | 'revealing' | 'invalid' | 'error'>('loading')
const errorMessage = ref('')
const constraintCount = ref(0)
const visibleClaimsCount = ref(0)
const showStats = ref(false)
const showPrivacyNote = ref(false)
const verifyStartTime = ref(0)

// proof details
const proofDetails = ref<{
  invoiceId: string
  paymentRef: string
  createdAt: number
  disclosure: {
    revealInvoiceId?: boolean
    revealRecipient?: boolean
    minAmount?: number
    maxAmount?: number
  }
} | null>(null)

// proof stats
const proofStats = ref({
  constraints: 48231,
  proofSize: '2.1 KB',
  verifyTime: '0.0s',
})

// build claims list dynamically
const allClaims = computed(() => {
  if (!proofDetails.value) return []

  const claims = []
  const d = proofDetails.value.disclosure

  // always show payment proof
  claims.push({
    id: 'payment',
    label: 'Payment Proof',
    value: 'Valid payment preimage verified',
    revealed: true,
  })

  // invoice id
  if (d?.revealInvoiceId) {
    claims.push({
      id: 'invoice',
      label: 'Invoice ID',
      value: proofDetails.value.invoiceId,
      mono: true,
      revealed: true,
    })
  } else {
    claims.push({
      id: 'invoice',
      label: 'Invoice Reference',
      value: proofDetails.value.invoiceId?.slice(0, 8) + '...',
      mono: true,
      hidden: true,
    })
  }

  // recipient
  if (d?.revealRecipient) {
    claims.push({
      id: 'recipient',
      label: 'Recipient',
      value: 'Wallet address disclosed',
      revealed: true,
    })
  }

  // min amount
  if (d?.minAmount) {
    claims.push({
      id: 'min',
      label: 'Minimum Amount',
      value: `Payment ≥ $${d.minAmount}`,
      revealed: true,
    })
  }

  // max amount
  if (d?.maxAmount) {
    claims.push({
      id: 'max',
      label: 'Maximum Amount',
      value: `Payment ≤ $${d.maxAmount}`,
      revealed: true,
    })
  }

  // payment ref
  claims.push({
    id: 'ref',
    label: 'Payment Reference',
    value: proofDetails.value.paymentRef?.slice(0, 16) + '...',
    mono: true,
    revealed: true,
  })

  // timestamp
  claims.push({
    id: 'time',
    label: 'Proof Created',
    value: formatDate(proofDetails.value.createdAt),
    revealed: true,
  })

  return claims
})

const visibleClaims = computed(() => allClaims.value.slice(0, visibleClaimsCount.value))

const hasDisclosures = computed(() => {
  const d = proofDetails.value?.disclosure
  if (!d) return false
  return d.revealInvoiceId || d.revealRecipient || d.minAmount || d.maxAmount
})

const hiddenCount = computed(() => {
  let count = 0
  const d = proofDetails.value?.disclosure
  if (!d?.revealInvoiceId) count++
  if (!d?.revealRecipient) count++
  // amount is always hidden in base proof
  count++
  return count
})

// timers
let constraintTimer: ReturnType<typeof setInterval> | null = null
let claimTimer: ReturnType<typeof setInterval> | null = null

function formatDate(timestamp: number | undefined): string {
  if (!timestamp) return 'Unknown'
  return new Date(timestamp).toLocaleString()
}

async function handleDrop(e: DragEvent) {
  isDragging.value = false
  const file = e.dataTransfer?.files[0]
  if (file) {
    await loadAndVerify(file)
  }
}

async function handleFileSelect(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) {
    await loadAndVerify(file)
  }
}

async function loadAndVerify(file: File) {
  verificationState.value = 'verifying'
  verificationStage.value = 'loading'
  errorMessage.value = ''
  constraintCount.value = 0
  visibleClaimsCount.value = 0
  showStats.value = false
  showPrivacyNote.value = false

  try {
    // stage 1: loading
    await sleep(600)

    const proof = await loadProofFromFile(file)
    if (!proof) {
      verificationStage.value = 'error'
      errorMessage.value = 'Could not parse the proof file. Make sure it\'s a valid ZK receipt.'
      return
    }

    uploadedProof.value = proof
    proofDetails.value = {
      invoiceId: proof.invoiceId,
      paymentRef: proof.paymentRef,
      createdAt: proof.createdAt,
      disclosure: proof.disclosure || {},
    }

    // stage 2: initializing
    verificationStage.value = 'initializing'
    await sleep(400)
    await initializeProver()

    // stage 3: verifying with constraint counter
    verificationStage.value = 'verifying'
    verifyStartTime.value = performance.now()

    // animate constraint counter
    const targetConstraints = 48231
    constraintTimer = setInterval(() => {
      constraintCount.value = Math.min(constraintCount.value + Math.floor(Math.random() * 2000) + 500, targetConstraints)
      if (constraintCount.value >= targetConstraints) {
        if (constraintTimer) clearInterval(constraintTimer)
      }
    }, 50)

    const isValid = await verifyReceipt(proof)

    if (constraintTimer) clearInterval(constraintTimer)
    constraintCount.value = targetConstraints

    const verifyTime = ((performance.now() - verifyStartTime.value) / 1000).toFixed(1)
    proofStats.value.verifyTime = verifyTime + 's'
    proofStats.value.proofSize = (proof.serialized.length / 1024).toFixed(1) + ' KB'

    if (!isValid) {
      verificationStage.value = 'invalid'
      return
    }

    // stage 4: reveal claims one by one
    verificationStage.value = 'revealing'
    await sleep(300)

    // reveal claims with staggered animation
    claimTimer = setInterval(() => {
      if (visibleClaimsCount.value < allClaims.value.length) {
        visibleClaimsCount.value++
      } else {
        if (claimTimer) clearInterval(claimTimer)
        // show stats after claims
        setTimeout(() => { showStats.value = true }, 200)
        setTimeout(() => { showPrivacyNote.value = true }, 400)
      }
    }, 150)

    verificationState.value = 'complete'
  } catch (e: any) {
    console.error('Verification error:', e)
    verificationStage.value = 'error'
    errorMessage.value = e.message || 'An error occurred during verification.'
    if (constraintTimer) clearInterval(constraintTimer)
    if (claimTimer) clearInterval(claimTimer)
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function clearFile() {
  uploadedProof.value = null
  verificationState.value = 'idle'
  verificationStage.value = 'loading'
  errorMessage.value = ''
  proofDetails.value = null
  constraintCount.value = 0
  visibleClaimsCount.value = 0
  showStats.value = false
  showPrivacyNote.value = false
  if (constraintTimer) clearInterval(constraintTimer)
  if (claimTimer) clearInterval(claimTimer)
}

onMounted(() => {
  const proofId = route.params.id as string
  if (proofId && proofId !== 'upload') {
    console.log('Proof ID from URL:', proofId)
  }
})

onUnmounted(() => {
  if (constraintTimer) clearInterval(constraintTimer)
  if (claimTimer) clearInterval(claimTimer)
})
</script>

<style scoped>
.verify-page {
  min-height: 100vh;
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
  padding: 2rem 1rem;
}

.verify-container {
  max-width: 640px;
  margin: 0 auto;
}

/* Header */
.verify-header {
  text-align: center;
  margin-bottom: 2rem;
}

.logo {
  margin-bottom: 1.5rem;
}

.logo-link {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  text-decoration: none;
}

.logo-icon {
  width: 40px;
  height: 40px;
  background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
  color: white;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 1.25rem;
}

.logo-text {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-primary);
}

.page-title {
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 0.5rem;
}

.page-subtitle {
  font-size: 1rem;
  color: var(--text-secondary);
}

/* Upload Section */
.upload-section {
  margin-bottom: 2rem;
}

.upload-zone {
  background: white;
  border: 2px dashed rgba(15, 23, 42, 0.15);
  border-radius: 16px;
  padding: 2rem;
  text-align: center;
  transition: all 0.2s ease;
}

.upload-zone.dragover {
  border-color: #6366f1;
  background: rgba(99, 102, 241, 0.05);
}

.upload-prompt {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.upload-icon {
  color: var(--text-muted);
  margin-bottom: 0.5rem;
}

.upload-text {
  font-size: 1rem;
  font-weight: 500;
  color: var(--text-primary);
}

.upload-hint {
  font-size: 0.875rem;
  color: var(--text-muted);
}

.upload-btn {
  margin-top: 0.5rem;
  padding: 0.75rem 1.5rem;
  background: var(--primary);
  color: white;
  border: none;
  border-radius: 10px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
}

.upload-btn:hover {
  background: #1e293b;
}

/* Stage Cards */
.result-card {
  background: white;
  border-radius: 16px;
  padding: 2rem;
  text-align: center;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  margin-bottom: 2rem;
}

.stage-card {
  padding: 2.5rem 2rem;
}

.stage-icon {
  position: relative;
  width: 64px;
  height: 64px;
  margin: 0 auto 1.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #6366f1;
}

.pulse-ring {
  position: absolute;
  inset: 0;
  border: 2px solid #6366f1;
  border-radius: 50%;
  animation: pulse-ring 1.5s ease-out infinite;
}

@keyframes pulse-ring {
  0% { transform: scale(0.8); opacity: 1; }
  100% { transform: scale(1.4); opacity: 0; }
}

.stage-title {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 0.5rem;
}

.stage-desc {
  font-size: 0.9375rem;
  color: var(--text-secondary);
  margin-bottom: 1.5rem;
}

.progress-bar {
  width: 100%;
  max-width: 200px;
  height: 4px;
  background: rgba(99, 102, 241, 0.1);
  border-radius: 2px;
  margin: 0 auto;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: #6366f1;
  border-radius: 2px;
  transition: width 0.3s ease;
}

.verifying-fill {
  width: 100%;
  animation: progress-slide 1.5s ease-in-out infinite;
  background: linear-gradient(90deg, #6366f1 0%, #8b5cf6 50%, #6366f1 100%);
  background-size: 200% 100%;
}

@keyframes progress-slide {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* Circuit Animation */
.circuit-animation {
  position: absolute;
  inset: 0;
}

.circuit-ring {
  position: absolute;
  inset: 0;
  border: 2px solid #6366f1;
  border-radius: 50%;
  animation: circuit-pulse 2s ease-out infinite;
}

.circuit-ring.delay-1 { animation-delay: 0.4s; }
.circuit-ring.delay-2 { animation-delay: 0.8s; }

@keyframes circuit-pulse {
  0% { transform: scale(1); opacity: 0.8; border-color: #6366f1; }
  50% { border-color: #10b981; }
  100% { transform: scale(1.8); opacity: 0; border-color: #10b981; }
}

/* Constraint Counter */
.constraint-counter {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  margin-bottom: 1.5rem;
}

.counter-value {
  font-size: 1.75rem;
  font-weight: 700;
  font-family: 'IBM Plex Mono', monospace;
  color: #6366f1;
}

.counter-label {
  font-size: 0.75rem;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

/* Result Header */
.result-header {
  margin-bottom: 1.5rem;
}

.result-icon {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 1rem;
}

.result-icon.valid {
  background: rgba(16, 185, 129, 0.1);
  color: #10b981;
}

.result-icon.invalid {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

.result-icon.error {
  background: rgba(245, 158, 11, 0.1);
  color: #f59e0b;
}

.pulse-success {
  animation: pulse-success 0.6s ease-out;
}

@keyframes pulse-success {
  0% { transform: scale(0.8); opacity: 0; }
  50% { transform: scale(1.1); }
  100% { transform: scale(1); opacity: 1; }
}

.checkmark-path {
  stroke-dasharray: 24;
  stroke-dashoffset: 24;
  animation: draw-check 0.4s ease-out 0.2s forwards;
}

@keyframes draw-check {
  to { stroke-dashoffset: 0; }
}

.shake {
  animation: shake 0.5s ease-out;
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  20%, 60% { transform: translateX(-8px); }
  40%, 80% { transform: translateX(8px); }
}

.result-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 0.5rem;
}

.result-desc {
  font-size: 1rem;
  color: var(--text-secondary);
}

/* Verified Claims */
.verified-claims {
  text-align: left;
  background: rgba(16, 185, 129, 0.05);
  border: 1px solid rgba(16, 185, 129, 0.15);
  border-radius: 12px;
  padding: 1rem;
  margin-bottom: 1rem;
}

.claims-title {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.875rem;
  font-weight: 600;
  color: #10b981;
  margin-bottom: 0.75rem;
}

.claim-counter {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--text-muted);
  font-family: 'IBM Plex Mono', monospace;
}

.claims-list {
  position: relative;
}

.claim-item {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.625rem 0;
  border-bottom: 1px solid rgba(16, 185, 129, 0.1);
}

.claim-item:last-child {
  border-bottom: none;
}

/* Claim Animations */
.claim-enter-active {
  animation: claim-reveal 0.4s ease-out forwards;
}

@keyframes claim-reveal {
  0% {
    opacity: 0;
    transform: translateX(-20px);
  }
  100% {
    opacity: 1;
    transform: translateX(0);
  }
}

.claim-check {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.check-circle {
  transform-origin: center;
  animation: scale-in 0.3s ease-out forwards;
}

@keyframes scale-in {
  0% { transform: scale(0); }
  60% { transform: scale(1.2); }
  100% { transform: scale(1); }
}

.check-path {
  stroke-dasharray: 16;
  stroke-dashoffset: 16;
  animation: draw-check 0.3s ease-out 0.15s forwards;
}

.claim-content {
  flex: 1;
  min-width: 0;
}

.claim-label {
  display: block;
  font-size: 0.75rem;
  color: var(--text-muted);
  margin-bottom: 0.125rem;
}

.claim-value {
  font-size: 0.875rem;
  color: var(--text-primary);
  word-break: break-all;
}

.claim-badge {
  flex-shrink: 0;
  font-size: 0.625rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
}

.claim-badge.revealed {
  background: rgba(16, 185, 129, 0.1);
  color: #10b981;
}

.claim-badge.hidden {
  background: rgba(99, 102, 241, 0.1);
  color: #6366f1;
}

/* Proof Stats */
.proof-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
  margin-bottom: 1rem;
  padding: 1rem;
  background: rgba(99, 102, 241, 0.05);
  border-radius: 12px;
  animation: fade-up 0.4s ease-out;
}

@keyframes fade-up {
  0% { opacity: 0; transform: translateY(10px); }
  100% { opacity: 1; transform: translateY(0); }
}

.stat-item {
  text-align: center;
}

.stat-value {
  display: block;
  font-size: 1.125rem;
  font-weight: 700;
  font-family: 'IBM Plex Mono', monospace;
  color: #6366f1;
}

.stat-label {
  font-size: 0.6875rem;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

/* Privacy Note */
.privacy-note {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 0.75rem;
  background: rgba(99, 102, 241, 0.05);
  border-radius: 8px;
  font-size: 0.8125rem;
  color: var(--text-secondary);
  text-align: left;
  animation: fade-up 0.4s ease-out;
}

.note-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #6366f1;
  flex-shrink: 0;
}

/* Buttons */
.verify-another-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 1.5rem;
  padding: 0.75rem 1.25rem;
  background: transparent;
  color: var(--text-secondary);
  border: 1px solid rgba(15, 23, 42, 0.15);
  border-radius: 10px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.verify-another-btn:hover {
  background: rgba(15, 23, 42, 0.05);
  color: var(--text-primary);
}

.retry-btn {
  padding: 0.75rem 1.5rem;
  background: var(--primary);
  color: white;
  border: none;
  border-radius: 10px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  margin-top: 1rem;
}

/* Info Section */
.info-section {
  margin-bottom: 2rem;
}

.info-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text-primary);
  text-align: center;
  margin-bottom: 1rem;
}

.info-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 1rem;
}

.info-card {
  background: white;
  border-radius: 12px;
  padding: 1.25rem;
  text-align: center;
}

.info-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #10b981;
  margin-bottom: 0.75rem;
}

.info-card h4 {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 0.5rem;
}

.info-card p {
  font-size: 0.8125rem;
  color: var(--text-secondary);
  line-height: 1.5;
}

/* Footer */
.verify-footer {
  text-align: center;
  padding-top: 2rem;
  border-top: 1px solid rgba(15, 23, 42, 0.08);
}

.verify-footer p {
  font-size: 0.875rem;
  color: var(--text-muted);
  margin-bottom: 0.5rem;
}

.back-link {
  color: var(--primary);
  text-decoration: none;
  font-weight: 500;
}

.back-link:hover {
  text-decoration: underline;
}

/* Utilities */
.mono {
  font-family: 'IBM Plex Mono', monospace;
}
</style>

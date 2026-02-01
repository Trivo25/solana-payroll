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
      <div class="upload-section">
        <div
          class="upload-zone"
          :class="{ dragover: isDragging, hasFile: uploadedProof }"
          @dragover.prevent="isDragging = true"
          @dragleave.prevent="isDragging = false"
          @drop.prevent="handleDrop"
        >
          <div v-if="!uploadedProof" class="upload-prompt">
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

          <div v-else class="file-info">
            <div class="file-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke-linecap="round" stroke-linejoin="round"/>
                <polyline points="14 2 14 8 20 8" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M9 15l2 2 4-4" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
            <div class="file-details">
              <span class="file-name">{{ fileName }}</span>
              <span class="file-size">ZK Receipt</span>
            </div>
            <button class="remove-file" @click="clearFile">&times;</button>
          </div>
        </div>
      </div>

      <!-- Verification Result -->
      <div v-if="verificationState !== 'idle'" class="verification-result">
        <!-- Verifying -->
        <div v-if="verificationState === 'verifying'" class="result-card verifying">
          <div class="result-icon">
            <span class="spinner-large"></span>
          </div>
          <h2 class="result-title">Verifying Proof...</h2>
          <p class="result-desc">Running cryptographic verification</p>
        </div>

        <!-- Valid -->
        <div v-else-if="verificationState === 'valid'" class="result-card valid">
          <div class="result-icon valid">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="M20 6L9 17l-5-5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <h2 class="result-title">Proof Verified</h2>
          <p class="result-desc">
            This ZK receipt cryptographically proves that a payment was made.
          </p>

          <!-- Verified Claims -->
          <div class="verified-claims">
            <h3 class="claims-title">Verified Claims</h3>

            <div class="claim-item">
              <span class="claim-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M20 6L9 17l-5-5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </span>
              <div class="claim-content">
                <span class="claim-label">Payment Proof</span>
                <span class="claim-value">Prover knows the valid payment preimage</span>
              </div>
            </div>

            <div class="claim-item" v-if="proofDetails?.disclosure?.revealInvoiceId">
              <span class="claim-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke-linecap="round" stroke-linejoin="round"/>
                  <polyline points="14 2 14 8 20 8" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </span>
              <div class="claim-content">
                <span class="claim-label">Invoice ID (Revealed)</span>
                <span class="claim-value mono">{{ proofDetails?.invoiceId }}</span>
              </div>
            </div>

            <div class="claim-item" v-else>
              <span class="claim-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" stroke-linecap="round" stroke-linejoin="round"/>
                  <path d="M7 11V7a5 5 0 0110 0v4" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </span>
              <div class="claim-content">
                <span class="claim-label">Invoice Reference (Hidden)</span>
                <span class="claim-value mono">{{ proofDetails?.invoiceId?.slice(0, 8) }}...</span>
              </div>
            </div>

            <div class="claim-item" v-if="proofDetails?.disclosure?.revealRecipient">
              <span class="claim-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" stroke-linecap="round" stroke-linejoin="round"/>
                  <circle cx="12" cy="7" r="4" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </span>
              <div class="claim-content">
                <span class="claim-label">Recipient (Revealed)</span>
                <span class="claim-value mono">Wallet address disclosed in proof</span>
              </div>
            </div>

            <div class="claim-item" v-if="proofDetails?.disclosure?.minAmount">
              <span class="claim-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="12" y1="1" x2="12" y2="23" stroke-linecap="round"/>
                  <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </span>
              <div class="claim-content">
                <span class="claim-label">Minimum Amount</span>
                <span class="claim-value">Payment &ge; ${{ proofDetails.disclosure.minAmount }}</span>
              </div>
            </div>

            <div class="claim-item" v-if="proofDetails?.disclosure?.maxAmount">
              <span class="claim-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="12" y1="1" x2="12" y2="23" stroke-linecap="round"/>
                  <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </span>
              <div class="claim-content">
                <span class="claim-label">Maximum Amount</span>
                <span class="claim-value">Payment &le; ${{ proofDetails.disclosure.maxAmount }}</span>
              </div>
            </div>

            <div class="claim-item">
              <span class="claim-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M4 7V4a2 2 0 012-2h8.5L20 7.5V20a2 2 0 01-2 2H6a2 2 0 01-2-2v-3" stroke-linecap="round" stroke-linejoin="round"/>
                  <polyline points="14 2 14 8 20 8" stroke-linecap="round" stroke-linejoin="round"/>
                  <line x1="2" y1="12" x2="12" y2="12" stroke-linecap="round"/>
                  <polyline points="6 9 2 12 6 15" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </span>
              <div class="claim-content">
                <span class="claim-label">Payment Reference</span>
                <span class="claim-value mono">{{ proofDetails?.paymentRef?.slice(0, 16) }}...</span>
              </div>
            </div>

            <div class="claim-item">
              <span class="claim-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10" stroke-linecap="round" stroke-linejoin="round"/>
                  <polyline points="12 6 12 12 16 14" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </span>
              <div class="claim-content">
                <span class="claim-label">Proof Created</span>
                <span class="claim-value">{{ formatDate(proofDetails?.createdAt) }}</span>
              </div>
            </div>
          </div>

          <div class="privacy-note">
            <span class="note-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </span>
            <span v-if="hasDisclosures">
              This proof selectively reveals certain facts about the payment while keeping other details private.
            </span>
            <span v-else>
              This proof reveals nothing about the payment amount, sender, or recipient addresses.
              Only that a valid payment matching the invoice was made.
            </span>
          </div>
        </div>

        <!-- Invalid -->
        <div v-else-if="verificationState === 'invalid'" class="result-card invalid">
          <div class="result-icon invalid">
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
        <div v-else-if="verificationState === 'error'" class="result-card error">
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
      <div class="info-section">
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
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useZkReceipts, type ZkReceiptProof } from '~/composables/useZkReceipts'

const route = useRoute()
const {
  loadProofFromFile,
  verifyReceipt,
  initializeProver,
} = useZkReceipts()

// State
const isDragging = ref(false)
const uploadedProof = ref<ZkReceiptProof | null>(null)
const fileName = ref('')
const verificationState = ref<'idle' | 'verifying' | 'valid' | 'invalid' | 'error'>('idle')
const errorMessage = ref('')
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

// check if proof has any disclosures
const hasDisclosures = computed(() => {
  const d = proofDetails.value?.disclosure
  if (!d) return false
  return d.revealInvoiceId || d.revealRecipient || d.minAmount || d.maxAmount
})

// format date helper
function formatDate(timestamp: number | undefined): string {
  if (!timestamp) return 'Unknown'
  return new Date(timestamp).toLocaleString()
}

// Handle file drop
async function handleDrop(e: DragEvent) {
  isDragging.value = false
  const file = e.dataTransfer?.files[0]
  if (file) {
    await loadAndVerify(file)
  }
}

// Handle file selection
async function handleFileSelect(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) {
    await loadAndVerify(file)
  }
}

// Load and verify proof
async function loadAndVerify(file: File) {
  fileName.value = file.name
  verificationState.value = 'verifying'
  errorMessage.value = ''

  try {
    // Load the proof from file
    const proof = await loadProofFromFile(file)

    if (!proof) {
      verificationState.value = 'error'
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

    // Initialize prover if needed
    await initializeProver()

    // Verify the proof
    const isValid = await verifyReceipt(proof)

    verificationState.value = isValid ? 'valid' : 'invalid'
  } catch (e: any) {
    console.error('Verification error:', e)
    verificationState.value = 'error'
    errorMessage.value = e.message || 'An error occurred during verification.'
  }
}

// Clear uploaded file
function clearFile() {
  uploadedProof.value = null
  fileName.value = ''
  verificationState.value = 'idle'
  errorMessage.value = ''
  proofDetails.value = null
}

// Check if we have a proof ID in the URL (for future backend integration)
onMounted(() => {
  const proofId = route.params.id as string
  if (proofId && proofId !== 'upload') {
    // In the future, fetch proof from backend by ID
    console.log('Proof ID from URL:', proofId)
  }
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

.upload-zone.hasFile {
  border-style: solid;
  border-color: #10b981;
  background: rgba(16, 185, 129, 0.05);
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

/* File Info */
.file-info {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.file-icon {
  color: #10b981;
  display: flex;
  align-items: center;
  justify-content: center;
}

.file-details {
  flex: 1;
  text-align: left;
}

.file-name {
  display: block;
  font-weight: 500;
  color: var(--text-primary);
}

.file-size {
  font-size: 0.875rem;
  color: var(--text-muted);
}

.remove-file {
  width: 32px;
  height: 32px;
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
  border: none;
  border-radius: 8px;
  font-size: 1.25rem;
  cursor: pointer;
}

/* Verification Result */
.result-card {
  background: white;
  border-radius: 16px;
  padding: 2rem;
  text-align: center;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  margin-bottom: 2rem;
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

.spinner-large {
  width: 40px;
  height: 40px;
  border: 3px solid rgba(99, 102, 241, 0.2);
  border-top-color: #6366f1;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
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
  margin-bottom: 1.5rem;
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
  font-size: 0.875rem;
  font-weight: 600;
  color: #10b981;
  margin-bottom: 0.75rem;
}

.claim-item {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.5rem 0;
  border-bottom: 1px solid rgba(16, 185, 129, 0.1);
}

.claim-item:last-child {
  border-bottom: none;
}

.claim-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  color: #10b981;
  flex-shrink: 0;
}

.claim-content {
  flex: 1;
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
}

.note-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #6366f1;
  flex-shrink: 0;
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

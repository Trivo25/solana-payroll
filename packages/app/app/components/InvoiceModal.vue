<template>
  <Teleport to="body">
    <div v-if="isOpen" class="modal-overlay" @click.self="close">
      <div class="modal-content">
        <!-- header -->
        <div class="modal-header">
          <h2 class="modal-title">Invoice Details</h2>
          <button class="close-btn" @click="close">&times;</button>
        </div>

        <!-- body -->
        <div class="modal-body">
          <!-- status banner -->
          <div class="status-banner" :class="invoice.status">
            <span class="status-icon">
              {{ invoice.status === 'paid' ? '&#x2713;' : invoice.status === 'overdue' ? '&#x26A0;' : '&#x23F3;' }}
            </span>
            <span class="status-text">{{ getStatusText(invoice.status) }}</span>
          </div>

          <!-- amount -->
          <div class="amount-section">
            <span class="amount-label">Amount</span>
            <div class="amount-display">
              <span class="amount-value">${{ invoice.amount.toLocaleString() }}</span>
              <span class="amount-token">USDC</span>
            </div>
          </div>

          <!-- details -->
          <div class="details-grid">
            <div class="detail-item">
              <span class="detail-label">Title</span>
              <span class="detail-value">{{ invoice.title }}</span>
            </div>

            <div v-if="invoice.description" class="detail-item full-width">
              <span class="detail-label">Description</span>
              <span class="detail-value">{{ invoice.description }}</span>
            </div>

            <div class="detail-item">
              <span class="detail-label">From</span>
              <span class="detail-value mono">{{ shortenAddress(invoice.sender) }}</span>
            </div>

            <div class="detail-item">
              <span class="detail-label">To</span>
              <span class="detail-value mono">{{ shortenAddress(invoice.recipient) }}</span>
            </div>

            <div class="detail-item">
              <span class="detail-label">Created</span>
              <span class="detail-value">{{ formatDate(invoice.createdAt) }}</span>
            </div>

            <div v-if="invoice.dueDate" class="detail-item">
              <span class="detail-label">Due Date</span>
              <span class="detail-value" :class="{ overdue: invoice.status === 'overdue' }">
                {{ formatDate(invoice.dueDate) }}
              </span>
            </div>

            <div v-if="invoice.paidAt" class="detail-item">
              <span class="detail-label">Paid On</span>
              <span class="detail-value">{{ formatDate(invoice.paidAt) }}</span>
            </div>

            <div v-if="invoice.category" class="detail-item">
              <span class="detail-label">Category</span>
              <span class="detail-value">{{ invoice.category }}</span>
            </div>
          </div>

          <!-- transaction info (if paid) -->
          <div v-if="invoice.txSignature" class="tx-section">
            <span class="detail-label">Transaction</span>
            <div class="tx-hash mono">
              {{ invoice.txSignature }}
              <button class="copy-btn-small" @click="copyTx">
                {{ copiedTx ? '&#x2713;' : '&#x1F4CB;' }}
              </button>
            </div>
          </div>

          <!-- zk receipt section -->
          <div v-if="invoice.status === 'paid'" class="zk-section">
            <h3 class="section-title">ZK Receipt & Selective Disclosure</h3>

            <div v-if="invoice.proofAvailable" class="proof-available">
              <div class="proof-badge-large">
                <span class="proof-icon">&#x1F6E1;</span>
                <span>Zero-Knowledge Receipt Available</span>
              </div>

              <p class="proof-description">
                Generate privacy-preserving proofs about this payment without revealing sensitive details.
              </p>

              <!-- disclosure options -->
              <div class="disclosure-options">
                <h4 class="options-title">What would you like to prove?</h4>

                <label class="disclosure-option">
                  <input type="checkbox" v-model="disclosureOptions.amountRange" />
                  <span class="option-content">
                    <span class="option-title">Amount Range</span>
                    <span class="option-desc">Prove payment was within a certain range (e.g., > $1000)</span>
                  </span>
                </label>

                <label class="disclosure-option">
                  <input type="checkbox" v-model="disclosureOptions.paymentDate" />
                  <span class="option-content">
                    <span class="option-title">Payment Date</span>
                    <span class="option-desc">Prove payment was made before/after a specific date</span>
                  </span>
                </label>

                <label class="disclosure-option">
                  <input type="checkbox" v-model="disclosureOptions.senderVerified" />
                  <span class="option-content">
                    <span class="option-title">Sender Verification</span>
                    <span class="option-desc">Prove payment came from a verified business</span>
                  </span>
                </label>

                <label class="disclosure-option">
                  <input type="checkbox" v-model="disclosureOptions.recipientOwnership" />
                  <span class="option-content">
                    <span class="option-title">Recipient Ownership</span>
                    <span class="option-desc">Prove you are the recipient without revealing address</span>
                  </span>
                </label>
              </div>

              <button
                class="generate-proof-btn"
                :disabled="!hasSelectedOptions || generatingProof"
                @click="generateProof"
              >
                <span v-if="generatingProof">Generating Proof...</span>
                <span v-else>Generate ZK Proof</span>
              </button>

              <!-- proof result -->
              <div v-if="proofGenerated" class="proof-result">
                <div class="proof-success">
                  <span class="success-icon">&#x2713;</span>
                  <span>Proof Generated Successfully</span>
                </div>
                <div class="proof-hash mono">{{ proofHash }}</div>
                <div class="proof-actions">
                  <button class="action-btn" @click="copyProof">
                    {{ copiedProof ? 'Copied!' : 'Copy Proof' }}
                  </button>
                  <button class="action-btn secondary" @click="shareProof">
                    Share Proof
                  </button>
                </div>
              </div>
            </div>

            <div v-else class="proof-pending">
              <p>ZK receipt will be available after payment confirmation.</p>
            </div>
          </div>
        </div>

        <!-- footer actions -->
        <div class="modal-footer">
          <!-- pay button (for recipient when pending) -->
          <button
            v-if="canPay"
            class="action-btn primary large"
            :disabled="paying"
            @click="handlePay"
          >
            <span v-if="paying">Processing Payment...</span>
            <span v-else>Pay ${{ invoice.amount.toLocaleString() }}</span>
          </button>

          <!-- check status button (for sender) -->
          <button
            v-if="isSender && invoice.status !== 'paid'"
            class="action-btn secondary large"
            @click="checkStatus"
          >
            Check Payment Status
          </button>

          <!-- view on explorer (if paid) -->
          <button
            v-if="invoice.txSignature"
            class="action-btn secondary large"
            @click="viewOnExplorer"
          >
            View on Explorer
          </button>

          <button class="action-btn tertiary large" @click="close">
            Close
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { type Invoice, type PayInvoiceInput, formatDate, useInvoices } from '~/composables/useInvoices'
import { useToast } from '~/composables/useToast'

const props = defineProps<{
  invoice: Invoice
  walletAddress: string
  isOpen: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'paid', invoiceId: string, payment: PayInvoiceInput): void
}>()

const { payInvoice } = useInvoices()
const toast = useToast()

const paying = ref(false)
const copiedTx = ref(false)
const copiedProof = ref(false)
const generatingProof = ref(false)
const proofGenerated = ref(false)
const proofHash = ref('')

const disclosureOptions = ref({
  amountRange: false,
  paymentDate: false,
  senderVerified: false,
  recipientOwnership: false,
})

// check if user is the sender (business checking on payments)
const isSender = computed(() => props.invoice.sender === props.walletAddress)

// check if user can pay this invoice
const canPay = computed(() => {
  return props.invoice.recipient === props.walletAddress && props.invoice.status === 'pending'
})

// check if any disclosure options are selected
const hasSelectedOptions = computed(() => {
  return Object.values(disclosureOptions.value).some(v => v)
})

function close() {
  emit('close')
}

function getStatusText(status: string): string {
  switch (status) {
    case 'paid': return 'Payment Completed'
    case 'pending': return 'Payment Pending'
    case 'overdue': return 'Payment Overdue'
    case 'cancelled': return 'Invoice Cancelled'
    default: return status
  }
}

function shortenAddress(address: string): string {
  if (!address) return ''
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

async function handlePay() {
  paying.value = true
  try {
    // For now, create a mock payment - later this will integrate with CT
    const mockTxSignature = 'mock_tx_' + Math.random().toString(36).substring(2, 15)
    const payment: PayInvoiceInput = {
      txSignature: mockTxSignature,
      paymentMethod: 'public', // Will be 'confidential' when CT is integrated
    }

    const success = await payInvoice(props.invoice.id, payment)
    if (success) {
      emit('paid', props.invoice.id, payment)
      toast.success('Payment Successful', {
        message: `Paid $${props.invoice.amount} - ZK receipt is now available`,
      })
    } else {
      toast.error('Payment Failed', {
        message: 'Please try again',
      })
    }
  } catch (e) {
    console.error('payment error:', e)
    toast.error('Payment Failed', {
      message: 'An error occurred. Please try again.',
    })
  } finally {
    paying.value = false
  }
}

function checkStatus() {
  // todo: implement actual status check from blockchain
  alert(`Invoice Status: ${props.invoice.status.toUpperCase()}\n\nThis would check the on-chain status in production.`)
}

function viewOnExplorer() {
  // open solana explorer (local validator)
  const url = `https://explorer.solana.com/tx/${props.invoice.txSignature}?cluster=custom&customUrl=http://127.0.0.1:8899`
  window.open(url, '_blank')
}

async function copyTx() {
  if (props.invoice.txSignature) {
    await navigator.clipboard.writeText(props.invoice.txSignature)
    copiedTx.value = true
    setTimeout(() => { copiedTx.value = false }, 2000)
  }
}

async function generateProof() {
  generatingProof.value = true
  // simulate proof generation
  await new Promise(resolve => setTimeout(resolve, 2000))

  // generate dummy proof hash
  proofHash.value = '0x' + Array.from({ length: 64 }, () =>
    Math.floor(Math.random() * 16).toString(16)
  ).join('')

  proofGenerated.value = true
  generatingProof.value = false
}

async function copyProof() {
  await navigator.clipboard.writeText(proofHash.value)
  copiedProof.value = true
  setTimeout(() => { copiedProof.value = false }, 2000)
}

function shareProof() {
  // todo: implement proof sharing (could open a share modal or generate a link)
  alert(`Share this proof hash:\n\n${proofHash.value}\n\nSharing functionality coming soon!`)
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

.modal-content {
  background: white;
  border-radius: 20px;
  width: 100%;
  max-width: 560px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid rgba(15, 23, 42, 0.08);
}

.modal-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--text-primary);
}

.close-btn {
  width: 32px;
  height: 32px;
  border: none;
  background: rgba(15, 23, 42, 0.05);
  border-radius: 8px;
  font-size: 1.5rem;
  color: var(--text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}

.close-btn:hover {
  background: rgba(15, 23, 42, 0.1);
}

.modal-body {
  padding: 1.5rem;
}

/* status banner */
.status-banner {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  border-radius: 12px;
  margin-bottom: 1.5rem;
}

.status-banner.paid {
  background: rgba(16, 185, 129, 0.1);
  color: #10b981;
}

.status-banner.pending {
  background: rgba(245, 158, 11, 0.1);
  color: #f59e0b;
}

.status-banner.overdue {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

.status-icon {
  font-size: 1.25rem;
}

.status-text {
  font-weight: 500;
}

/* amount section */
.amount-section {
  text-align: center;
  padding: 1rem 0;
  margin-bottom: 1.5rem;
}

.amount-label {
  font-size: 0.875rem;
  color: var(--text-muted);
  display: block;
  margin-bottom: 0.25rem;
}

.amount-display {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 0.5rem;
}

.amount-value {
  font-size: 2.5rem;
  font-weight: 700;
  color: var(--text-primary);
}

.amount-token {
  font-size: 1rem;
  color: var(--text-muted);
}

/* details grid */
.details-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.detail-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.detail-item.full-width {
  grid-column: span 2;
}

.detail-label {
  font-size: 0.75rem;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.detail-value {
  font-size: 0.875rem;
  color: var(--text-primary);
}

.detail-value.overdue {
  color: #ef4444;
}

/* tx section */
.tx-section {
  margin-bottom: 1.5rem;
}

.tx-hash {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.75rem;
  color: var(--text-secondary);
  background: rgba(15, 23, 42, 0.05);
  padding: 0.5rem 0.75rem;
  border-radius: 8px;
  margin-top: 0.25rem;
  word-break: break-all;
}

.copy-btn-small {
  background: none;
  border: none;
  cursor: pointer;
  padding: 0.25rem;
  font-size: 0.875rem;
  flex-shrink: 0;
}

/* zk section */
.zk-section {
  background: rgba(15, 23, 42, 0.02);
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 12px;
  padding: 1.25rem;
  margin-bottom: 1rem;
}

.section-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 1rem;
}

.proof-available {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.proof-badge-large {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--secondary);
  font-weight: 500;
}

.proof-badge-large .proof-icon {
  font-size: 1.25rem;
}

.proof-description {
  font-size: 0.875rem;
  color: var(--text-secondary);
  line-height: 1.5;
}

/* disclosure options */
.disclosure-options {
  background: white;
  border-radius: 10px;
  padding: 1rem;
}

.options-title {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-primary);
  margin-bottom: 0.75rem;
}

.disclosure-option {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.75rem;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s;
}

.disclosure-option:hover {
  background: rgba(15, 23, 42, 0.03);
}

.disclosure-option input {
  margin-top: 0.125rem;
  accent-color: var(--secondary);
}

.option-content {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.option-title {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-primary);
}

.option-desc {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.generate-proof-btn {
  width: 100%;
  padding: 0.875rem;
  background: var(--secondary);
  color: white;
  border: none;
  border-radius: 10px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  font-family: inherit;
}

.generate-proof-btn:hover:not(:disabled) {
  background: #059669;
}

.generate-proof-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* proof result */
.proof-result {
  background: rgba(16, 185, 129, 0.05);
  border: 1px solid rgba(16, 185, 129, 0.2);
  border-radius: 10px;
  padding: 1rem;
}

.proof-success {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--secondary);
  font-weight: 500;
  margin-bottom: 0.75rem;
}

.success-icon {
  font-size: 1rem;
}

.proof-hash {
  font-size: 0.75rem;
  color: var(--text-secondary);
  word-break: break-all;
  background: white;
  padding: 0.5rem;
  border-radius: 6px;
  margin-bottom: 0.75rem;
}

.proof-actions {
  display: flex;
  gap: 0.5rem;
}

.proof-pending {
  font-size: 0.875rem;
  color: var(--text-muted);
  font-style: italic;
}

/* footer */
.modal-footer {
  padding: 1.5rem;
  border-top: 1px solid rgba(15, 23, 42, 0.08);
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.action-btn {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 10px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  font-family: inherit;
}

.action-btn.large {
  padding: 1rem 1.5rem;
  font-size: 1rem;
}

.action-btn.primary {
  background: var(--primary);
  color: white;
}

.action-btn.primary:hover:not(:disabled) {
  background: #1e293b;
}

.action-btn.primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.action-btn.secondary {
  background: rgba(15, 23, 42, 0.1);
  color: var(--text-primary);
}

.action-btn.secondary:hover {
  background: rgba(15, 23, 42, 0.15);
}

.action-btn.tertiary {
  background: transparent;
  color: var(--text-muted);
}

.action-btn.tertiary:hover {
  color: var(--text-primary);
}
</style>

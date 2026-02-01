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

        <!-- Payment Section (for payer when pending) -->
        <div v-if="canPay" class="payment-section">
          <h3 class="section-title">Pay This Invoice</h3>

          <!-- Payment method selection -->
          <div class="payment-methods">
            <label
              class="payment-method"
              :class="{ selected: paymentMethod === 'confidential', disabled: !canPayConfidential }"
            >
              <input
                type="radio"
                v-model="paymentMethod"
                value="confidential"
                :disabled="!canPayConfidential"
              />
              <div class="method-content">
                <div class="method-header">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path d="M12 3L4 7v6c0 5.25 3.4 10.15 8 11 4.6-.85 8-5.75 8-11V7l-8-4z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M9 12l2 2 4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                  <span class="method-title">Pay Privately</span>
                  <span class="method-badge">Recommended</span>
                </div>
                <p class="method-desc">Amount stays hidden using zero-knowledge proofs</p>
                <div class="method-balance">
                  <span>Private Balance:</span>
                  <span class="mono">{{ formatBalance(ctBalance) }} cUSDC</span>
                </div>
                <div v-if="!canPayConfidential && ctCheckDone" class="method-warning">
                  <span v-if="ctBalance < invoice.amount">Insufficient private balance</span>
                  <span v-else-if="!recipientHasCT">Recipient hasn't enabled private transfers</span>
                  <span v-else>Enable confidential transfers first</span>
                </div>
              </div>
            </label>

            <label class="payment-method" :class="{ selected: paymentMethod === 'public' }">
              <input type="radio" v-model="paymentMethod" value="public" />
              <div class="method-content">
                <div class="method-header">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/>
                    <path d="M12 7v5l3 3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                  </svg>
                  <span class="method-title">Pay Publicly</span>
                </div>
                <p class="method-desc">Standard transfer visible on blockchain</p>
                <div class="method-balance">
                  <span>Public Balance:</span>
                  <span class="mono">{{ formatBalance(publicBalance) }} cUSDC</span>
                </div>
              </div>
            </label>
          </div>

          <!-- Payment progress -->
          <div v-if="paymentProgress" class="payment-progress">
            <div class="progress-header">
              <span class="progress-title">Processing Payment</span>
              <span class="progress-step">Step {{ paymentProgress.step }}/{{ paymentProgress.totalSteps }}</span>
            </div>
            <div class="progress-bar">
              <div class="progress-fill" :style="{ width: `${(paymentProgress.step / paymentProgress.totalSteps) * 100}%` }"></div>
            </div>
            <div class="progress-status">{{ paymentProgress.currentStep }}</div>
          </div>

          <!-- Pay button -->
          <button
            class="pay-btn"
            :class="paymentMethod"
            :disabled="paying || !canExecutePayment"
            @click="handlePay"
          >
            <span v-if="paying" class="btn-loading">
              <span class="spinner"></span>
              Processing...
            </span>
            <span v-else>
              Pay ${{ invoice.amount.toLocaleString() }} {{ paymentMethod === 'confidential' ? 'Privately' : '' }}
            </span>
          </button>
        </div>

        <!-- footer actions -->
        <div class="modal-footer">
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
import { ref, computed, watch } from 'vue'
import { type Invoice, type PayInvoiceInput, formatDate, useInvoices, generatePaymentRef } from '~/composables/useInvoices'
import { useConfidentialTransfer } from '~/composables/useConfidentialTransfer'
import { useToast } from '~/composables/useToast'

const props = defineProps<{
  invoice: Invoice
  walletAddress: string
  wallet: any // Wallet adapter for signing
  isOpen: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'paid', invoiceId: string, payment: PayInvoiceInput): void
}>()

const { payInvoice } = useInvoices()
const {
  transferConfidential,
  getConfidentialBalance,
  getPublicBalance,
  checkRecipientHasCT,
  withdrawProgress,
} = useConfidentialTransfer()
const toast = useToast()

// Payment state
const paying = ref(false)
const paymentMethod = ref<'public' | 'confidential'>('confidential')
const ctBalance = ref(0)
const publicBalance = ref(0)
const recipientHasCT = ref(false)
const ctCheckDone = ref(false)

// UI state
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

// Payment progress (reuse withdrawProgress from CT composable)
const paymentProgress = computed(() => {
  if (!paying.value) return null
  return withdrawProgress.value
})

// check if user is the sender (business checking on payments)
const isSender = computed(() => props.invoice.sender === props.walletAddress)

// check if user can pay this invoice
const canPay = computed(() => {
  return props.invoice.recipient === props.walletAddress && props.invoice.status === 'pending'
})

// Check if can pay with confidential transfer
const canPayConfidential = computed(() => {
  return ctBalance.value >= props.invoice.amount && recipientHasCT.value
})

// Check if payment can be executed
const canExecutePayment = computed(() => {
  if (paymentMethod.value === 'confidential') {
    return canPayConfidential.value
  }
  return publicBalance.value >= props.invoice.amount
})

// check if any disclosure options are selected
const hasSelectedOptions = computed(() => {
  return Object.values(disclosureOptions.value).some(v => v)
})

// Format balance helper
function formatBalance(bal: number): string {
  return bal.toFixed(2)
}

// Check balances and recipient CT status when modal opens
async function checkPaymentCapabilities() {
  if (!props.wallet || !canPay.value) return

  ctCheckDone.value = false

  try {
    // Check our balances
    const [ctBal, pubBal] = await Promise.all([
      getConfidentialBalance(props.wallet, 'USDC'),
      getPublicBalance(props.wallet, 'USDC'),
    ])
    ctBalance.value = ctBal
    publicBalance.value = pubBal

    // Check if recipient (invoice sender) has CT configured
    recipientHasCT.value = await checkRecipientHasCT(props.invoice.sender)
    console.log('[Invoice] Recipient has CT:', recipientHasCT.value)
  } catch (e) {
    console.error('Failed to check payment capabilities:', e)
    recipientHasCT.value = false
  } finally {
    ctCheckDone.value = true
  }

  // Default to public if CT not available
  if (!canPayConfidential.value) {
    paymentMethod.value = 'public'
  }
}

// Watch for modal open
watch(() => props.isOpen, (isOpen) => {
  if (isOpen && canPay.value) {
    checkPaymentCapabilities()
  }
}, { immediate: true })

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
  if (!props.wallet) {
    toast.error('Wallet Not Connected', { message: 'Please connect your wallet' })
    return
  }

  paying.value = true

  try {
    let txSignature: string
    let paymentNonce: string | undefined
    let paymentRefHash: string | undefined

    if (paymentMethod.value === 'confidential') {
      // Generate payment reference for linking
      paymentNonce = crypto.randomUUID()
      paymentRefHash = await generatePaymentRef(
        props.invoice.id,
        props.invoice.sender,
        props.invoice.recipient,
        props.invoice.amount,
        paymentNonce
      )

      console.log('[Invoice] ============ PAYMENT DEBUG ============')
      console.log('[Invoice] Payer (me):', props.walletAddress)
      console.log('[Invoice] Payee (invoice.sender):', props.invoice.sender)
      console.log('[Invoice] Invoice.recipient:', props.invoice.recipient)
      console.log('[Invoice] Amount:', props.invoice.amount)
      console.log('[Invoice] Payment ref:', paymentRefHash)
      console.log('[Invoice] ========================================')

      // Execute confidential transfer with payment ref as memo
      txSignature = await transferConfidential(
        props.wallet,
        props.invoice.sender, // Send to invoice creator
        props.invoice.amount,
        paymentRefHash // Include payment reference as memo
      )

      console.log('[Invoice] CT payment successful:', txSignature)
    } else {
      // Public transfer (mock for now - would use regular SPL transfer)
      console.log('[Invoice] Paying with public transfer')
      txSignature = 'public_tx_' + Math.random().toString(36).substring(2, 15)

      // TODO: Implement actual public SPL transfer
      // For hackathon demo, we'll focus on CT payments
      await new Promise(resolve => setTimeout(resolve, 1500))
    }

    // Update invoice in database
    const payment: PayInvoiceInput = {
      txSignature,
      paymentMethod: paymentMethod.value,
      paymentNonce,
      paymentRef: paymentRefHash,
    }

    const success = await payInvoice(props.invoice.id, payment)

    if (success) {
      emit('paid', props.invoice.id, payment)
      toast.success(
        paymentMethod.value === 'confidential' ? 'Private Payment Successful' : 'Payment Successful',
        {
          message: `Paid $${props.invoice.amount}${paymentMethod.value === 'confidential' ? ' privately' : ''} - ZK receipt available`,
          link: `https://explorer.solana.com/tx/${txSignature}?cluster=custom&customUrl=http://127.0.0.1:8899`,
          linkText: 'View on Explorer',
        }
      )
    } else {
      toast.error('Failed to Update Invoice', {
        message: 'Payment was sent but invoice status could not be updated',
      })
    }
  } catch (e: any) {
    console.error('Payment error:', e)
    toast.error('Payment Failed', {
      message: e.message || 'An error occurred. Please try again.',
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

/* Payment Section */
.payment-section {
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.05) 0%, rgba(99, 102, 241, 0.05) 100%);
  border: 1px solid rgba(16, 185, 129, 0.15);
  border-radius: 16px;
  padding: 1.25rem;
  margin-bottom: 1rem;
}

.payment-section .section-title {
  margin-bottom: 1rem;
}

/* Payment Methods */
.payment-methods {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.payment-method {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 1rem;
  background: white;
  border: 2px solid rgba(15, 23, 42, 0.08);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.payment-method:hover:not(.disabled) {
  border-color: rgba(15, 23, 42, 0.15);
}

.payment-method.selected {
  border-color: #10b981;
  background: rgba(16, 185, 129, 0.03);
}

.payment-method.disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.payment-method input[type="radio"] {
  margin-top: 0.25rem;
  accent-color: #10b981;
}

.method-content {
  flex: 1;
}

.method-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.25rem;
}

.method-header svg {
  color: var(--text-secondary);
}

.payment-method.selected .method-header svg {
  color: #10b981;
}

.method-title {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--text-primary);
}

.method-badge {
  font-size: 0.625rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 0.125rem 0.375rem;
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;
  border-radius: 4px;
}

.method-desc {
  font-size: 0.8125rem;
  color: var(--text-muted);
  margin-bottom: 0.5rem;
}

.method-balance {
  display: flex;
  justify-content: space-between;
  font-size: 0.8125rem;
  color: var(--text-secondary);
  padding: 0.5rem;
  background: rgba(15, 23, 42, 0.03);
  border-radius: 6px;
}

.method-warning {
  margin-top: 0.5rem;
  font-size: 0.75rem;
  color: #f59e0b;
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

/* Payment Progress */
.payment-progress {
  margin-bottom: 1rem;
  padding: 0.75rem;
  background: rgba(99, 102, 241, 0.1);
  border-radius: 8px;
}

.payment-progress .progress-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.payment-progress .progress-title {
  font-size: 0.8125rem;
  font-weight: 600;
  color: #6366f1;
}

.payment-progress .progress-step {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.payment-progress .progress-bar {
  height: 4px;
  background: rgba(99, 102, 241, 0.2);
  border-radius: 2px;
  overflow: hidden;
  margin-bottom: 0.5rem;
}

.payment-progress .progress-fill {
  height: 100%;
  background: #6366f1;
  border-radius: 2px;
  transition: width 0.3s ease;
}

.payment-progress .progress-status {
  font-size: 0.75rem;
  color: var(--text-secondary);
  text-align: center;
}

/* Pay Button */
.pay-btn {
  width: 100%;
  padding: 1rem 1.5rem;
  border: none;
  border-radius: 12px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  font-family: inherit;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.pay-btn.confidential {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;
}

.pay-btn.confidential:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
}

.pay-btn.public {
  background: var(--primary);
  color: white;
}

.pay-btn.public:hover:not(:disabled) {
  background: #1e293b;
}

.pay-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.pay-btn .btn-loading {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.pay-btn .spinner {
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
</style>

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

          <!-- payment proof data (if confidential payment) -->
          <div v-if="invoice.paymentMethod === 'confidential' && invoice.paymentNonce" class="proof-data-section">
            <h4 class="section-subtitle">Payment Proof Data</h4>
            <p class="proof-data-desc">
              This data is used to generate ZK proofs about this payment. Keep the nonce private - only you can derive it.
            </p>

            <div class="proof-data-grid">
              <div class="proof-data-item">
                <span class="detail-label">Payment Nonce</span>
                <div class="proof-data-value mono">
                  {{ invoice.paymentNonce.slice(0, 16) }}...{{ invoice.paymentNonce.slice(-8) }}
                  <button class="copy-btn-small" @click="copyNonce">
                    {{ copiedNonce ? '&#x2713;' : '&#x1F4CB;' }}
                  </button>
                </div>
              </div>

              <div v-if="invoice.paymentRef" class="proof-data-item">
                <span class="detail-label">Payment Reference</span>
                <div class="proof-data-value mono">
                  {{ invoice.paymentRef }}
                  <button class="copy-btn-small" @click="copyPaymentRef">
                    {{ copiedPaymentRef ? '&#x2713;' : '&#x1F4CB;' }}
                  </button>
                </div>
              </div>
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
                  <input type="checkbox" v-model="disclosureOptions.revealInvoiceId" />
                  <span class="option-content">
                    <span class="option-title">Reveal Invoice ID</span>
                    <span class="option-desc">Include invoice identifier in the proof (verifiers can see which invoice)</span>
                  </span>
                </label>

                <label class="disclosure-option">
                  <input type="checkbox" v-model="disclosureOptions.revealRecipient" />
                  <span class="option-content">
                    <span class="option-title">Reveal Recipient</span>
                    <span class="option-desc">Include recipient wallet in the proof</span>
                  </span>
                </label>

                <label class="disclosure-option">
                  <input type="checkbox" v-model="disclosureOptions.proveMinAmount" />
                  <span class="option-content">
                    <span class="option-title">Prove Minimum Amount</span>
                    <span class="option-desc">Prove payment was at least a certain amount</span>
                  </span>
                </label>

                <div v-if="disclosureOptions.proveMinAmount" class="amount-input-row">
                  <label class="amount-label-inline">Min: $</label>
                  <input
                    type="number"
                    v-model.number="disclosureOptions.minAmount"
                    :max="invoice.amount"
                    min="0"
                    class="amount-input"
                    placeholder="0"
                  />
                </div>

                <label class="disclosure-option">
                  <input type="checkbox" v-model="disclosureOptions.proveMaxAmount" />
                  <span class="option-content">
                    <span class="option-title">Prove Maximum Amount</span>
                    <span class="option-desc">Prove payment was at most a certain amount</span>
                  </span>
                </label>

                <div v-if="disclosureOptions.proveMaxAmount" class="amount-input-row">
                  <label class="amount-label-inline">Max: $</label>
                  <input
                    type="number"
                    v-model.number="disclosureOptions.maxAmount"
                    :min="invoice.amount"
                    class="amount-input"
                    placeholder="0"
                  />
                </div>
              </div>

              <button
                class="generate-proof-btn"
                :disabled="!hasSelectedOptions || generatingProof"
                @click="generateProof"
              >
                <span v-if="generatingProof" class="btn-loading">
                  <span class="spinner"></span>
                  {{ zkProgress.message || 'Generating...' }}
                </span>
                <span v-else>Generate ZK Proof</span>
              </button>

              <!-- proof progress -->
              <div v-if="generatingProof && zkProgress.step !== 'idle'" class="zk-progress">
                <div class="zk-progress-step">{{ zkProgress.message }}</div>
                <div class="zk-progress-hint">This may take 10-30 seconds...</div>
              </div>

              <!-- proof result -->
              <div v-if="proofGenerated && generatedReceipt" class="proof-result">
                <div class="proof-success">
                  <span class="success-icon">&#x2713;</span>
                  <span>ZK Receipt Generated</span>
                </div>
                <div class="proof-info">
                  <div class="proof-info-item">
                    <span class="info-label">Invoice</span>
                    <span class="info-value mono">{{ generatedReceipt.invoiceId.slice(0, 8) }}...</span>
                  </div>
                  <div class="proof-info-item">
                    <span class="info-label">Payment Ref</span>
                    <span class="info-value mono">{{ generatedReceipt.paymentRef.slice(0, 16) }}...</span>
                  </div>
                  <div class="proof-info-item">
                    <span class="info-label">Created</span>
                    <span class="info-value">{{ new Date(generatedReceipt.createdAt).toLocaleString() }}</span>
                  </div>
                </div>

                <!-- disclosed claims -->
                <div class="disclosed-claims">
                  <span class="claims-title">Verifiable claims:</span>
                  <div class="claims-list">
                    <span class="claim-badge" v-if="generatedReceipt.disclosure.revealInvoiceId">Invoice ID revealed</span>
                    <span class="claim-badge" v-if="generatedReceipt.disclosure.revealRecipient">Recipient revealed</span>
                    <span class="claim-badge" v-if="generatedReceipt.disclosure.minAmount">Amount &ge; ${{ generatedReceipt.disclosure.minAmount }}</span>
                    <span class="claim-badge" v-if="generatedReceipt.disclosure.maxAmount">Amount &le; ${{ generatedReceipt.disclosure.maxAmount }}</span>
                    <span class="claim-badge default">Valid payment proof</span>
                  </div>
                </div>

                <div class="proof-actions">
                  <button class="action-btn primary" @click="handleDownloadProof">
                    Download Receipt
                  </button>
                  <button class="action-btn" @click="copyProof">
                    {{ copiedProof ? 'Copied!' : 'Copy Proof' }}
                  </button>
                  <button class="action-btn secondary" @click="shareProof">
                    Share Link
                  </button>
                </div>
              </div>
            </div>

            <div v-else class="proof-pending">
              <p>ZK receipt will be available after payment confirmation.</p>
            </div>
          </div>
        </div>

        <!-- Payment Link Section (for sender when pending) -->
        <div v-if="isSender && invoice.status === 'pending'" class="payment-link-section">
          <h3 class="section-title">Share Payment Link</h3>
          <p class="link-description">
            Share this link with the payer to request payment.
          </p>

          <div class="qr-container">
            <canvas ref="qrCanvas" class="qr-code"></canvas>
          </div>

          <div class="link-input-row">
            <input
              type="text"
              :value="paymentLink"
              readonly
              class="link-input mono"
              @click="($event.target as HTMLInputElement).select()"
            />
            <button class="copy-link-btn" @click="copyPaymentLink">
              <svg v-if="!copiedLink" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
              </svg>
              <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </button>
          </div>

          <div class="share-buttons">
            <button class="share-btn" @click="shareViaEmail">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                <polyline points="22,6 12,13 2,6"/>
              </svg>
              Email
            </button>
            <button class="share-btn" @click="shareNative" v-if="canShare">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="18" cy="5" r="3"/>
                <circle cx="6" cy="12" r="3"/>
                <circle cx="18" cy="19" r="3"/>
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
              </svg>
              Share
            </button>
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
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import QRCode from 'qrcode'
import { type Invoice, type PayInvoiceInput, formatDate, useInvoices, generatePaymentRef, derivePaymentNonce } from '~/composables/useInvoices'
import { useConfidentialTransfer } from '~/composables/useConfidentialTransfer'
import { useToast } from '~/composables/useToast'
import { useZkReceipts, type ZkReceiptProof } from '~/composables/useZkReceipts'

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
const {
  generateReceipt,
  verifyReceipt,
  downloadProof,
  progress: zkProgress,
  loading: zkLoading,
  error: zkError,
} = useZkReceipts()

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
const copiedNonce = ref(false)
const copiedPaymentRef = ref(false)
const copiedLink = ref(false)
const generatedReceipt = ref<ZkReceiptProof | null>(null)
const qrCanvas = ref<HTMLCanvasElement | null>(null)

// Computed from ZK composable
const generatingProof = computed(() => zkLoading.value)
const proofGenerated = computed(() => generatedReceipt.value !== null)

const disclosureOptions = ref({
  revealInvoiceId: false,
  revealRecipient: false,
  proveMinAmount: false,
  proveMaxAmount: false,
  minAmount: 0,
  maxAmount: 0,
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

// payment link
const paymentLink = computed(() => {
  if (typeof window === 'undefined') return ''
  return `${window.location.origin}/pay/${props.invoice.id}`
})

// can use native share API
const canShare = computed(() => {
  return typeof navigator !== 'undefined' && !!navigator.share
})

// check if any disclosure options are selected
const hasSelectedOptions = computed(() => {
  const opts = disclosureOptions.value
  return opts.revealInvoiceId ||
    opts.revealRecipient ||
    opts.proveMinAmount ||
    opts.proveMaxAmount
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
  if (isOpen) {
    // generate QR code for payment link (if sender)
    generateQR()
    // check payment capabilities (if payer)
    if (canPay.value) {
      checkPaymentCapabilities()
    }
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
      // Derive deterministic payment nonce from wallet signature
      // This ensures: same wallet + same invoice = same nonce (reproducible)
      paymentNonce = await derivePaymentNonce(props.wallet, props.invoice.id)
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
      console.log('[Invoice] Nonce (deterministic):', paymentNonce.slice(0, 16) + '...')
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

async function copyNonce() {
  if (props.invoice.paymentNonce) {
    await navigator.clipboard.writeText(props.invoice.paymentNonce)
    copiedNonce.value = true
    setTimeout(() => { copiedNonce.value = false }, 2000)
  }
}

async function copyPaymentRef() {
  if (props.invoice.paymentRef) {
    await navigator.clipboard.writeText(props.invoice.paymentRef)
    copiedPaymentRef.value = true
    setTimeout(() => { copiedPaymentRef.value = false }, 2000)
  }
}

async function copyPaymentLink() {
  await navigator.clipboard.writeText(paymentLink.value)
  copiedLink.value = true
  toast.success('Link Copied', { message: 'Payment link copied to clipboard.' })
  setTimeout(() => { copiedLink.value = false }, 2000)
}

function shareViaEmail() {
  const subject = encodeURIComponent(`Payment Request: ${props.invoice.title}`)
  const body = encodeURIComponent(
    `You have a payment request for $${props.invoice.amount} USDC.\n\n` +
    `Pay securely here: ${paymentLink.value}\n\n` +
    `Powered by Veil - Private Payments on Solana`
  )
  window.open(`mailto:?subject=${subject}&body=${body}`, '_blank')
}

async function shareNative() {
  if (navigator.share) {
    try {
      await navigator.share({
        title: `Payment Request: ${props.invoice.title}`,
        text: `Pay $${props.invoice.amount} USDC securely`,
        url: paymentLink.value,
      })
    } catch (e) {
      // user cancelled or share failed
      console.log('Share cancelled')
    }
  }
}

// generate QR code when modal opens
async function generateQR() {
  await nextTick()
  if (qrCanvas.value && props.invoice.status === 'pending' && props.invoice.sender === props.walletAddress) {
    try {
      await QRCode.toCanvas(qrCanvas.value, paymentLink.value, {
        width: 180,
        margin: 2,
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
      })
    } catch (e) {
      console.error('QR generation failed:', e)
    }
  }
}

async function generateProof() {
  // build disclosure options for the circuit
  const opts = disclosureOptions.value
  const disclosure = {
    revealInvoiceId: opts.revealInvoiceId,
    revealRecipient: opts.revealRecipient,
    minAmount: opts.proveMinAmount ? opts.minAmount : undefined,
    maxAmount: opts.proveMaxAmount ? opts.maxAmount : undefined,
  }

  // generate real ZK proof using NoirJS
  const receipt = await generateReceipt(props.invoice, disclosure)

  if (receipt) {
    generatedReceipt.value = receipt
    toast.success('ZK Proof Generated', {
      message: 'Your privacy-preserving receipt is ready to download or share.',
    })
  } else {
    toast.error('Proof Generation Failed', {
      message: zkError.value || 'Could not generate ZK proof. Please try again.',
    })
  }
}

async function copyProof() {
  if (generatedReceipt.value) {
    await navigator.clipboard.writeText(generatedReceipt.value.serialized)
    copiedProof.value = true
    toast.success('Proof Copied', { message: 'Proof data copied to clipboard.' })
    setTimeout(() => { copiedProof.value = false }, 2000)
  }
}

function handleDownloadProof() {
  if (generatedReceipt.value) {
    downloadProof(generatedReceipt.value)
    toast.success('Proof Downloaded', { message: 'ZK receipt saved as JSON file.' })
  }
}

function shareProof() {
  if (generatedReceipt.value) {
    // Generate a shareable link (would normally save to DB and create URL)
    const proofId = generatedReceipt.value.invoiceId.slice(0, 8)
    const shareUrl = `${window.location.origin}/verify/${proofId}`

    // For now, copy to clipboard since we don't have backend storage yet
    navigator.clipboard.writeText(shareUrl)
    toast.success('Share Link Copied', {
      message: 'Verification link copied. Note: Full sharing requires backend integration.',
    })
  }
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

/* Proof data section */
.proof-data-section {
  margin-bottom: 1.5rem;
  padding: 1rem;
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.05) 0%, rgba(16, 185, 129, 0.05) 100%);
  border: 1px solid rgba(99, 102, 241, 0.15);
  border-radius: 12px;
}

.section-subtitle {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 0.5rem 0;
}

.proof-data-desc {
  font-size: 0.75rem;
  color: var(--text-muted);
  margin: 0 0 1rem 0;
  line-height: 1.5;
}

.proof-data-grid {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.proof-data-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.proof-data-value {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.7rem;
  color: #6366f1;
  background: rgba(99, 102, 241, 0.1);
  padding: 0.5rem 0.75rem;
  border-radius: 6px;
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

.amount-input-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-left: 1.75rem;
  margin-bottom: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: rgba(15, 23, 42, 0.03);
  border-radius: 8px;
}

.amount-label-inline {
  font-size: 0.875rem;
  color: var(--text-secondary);
  font-weight: 500;
}

.amount-input {
  width: 120px;
  padding: 0.5rem 0.75rem;
  border: 1px solid rgba(15, 23, 42, 0.15);
  border-radius: 6px;
  font-size: 0.875rem;
  font-family: inherit;
}

.amount-input:focus {
  outline: none;
  border-color: var(--secondary);
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

.generate-proof-btn .btn-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.generate-proof-btn .spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

/* ZK Progress */
.zk-progress {
  text-align: center;
  padding: 0.75rem;
  background: rgba(99, 102, 241, 0.1);
  border-radius: 8px;
}

.zk-progress-step {
  font-size: 0.875rem;
  font-weight: 500;
  color: #6366f1;
  margin-bottom: 0.25rem;
}

.zk-progress-hint {
  font-size: 0.75rem;
  color: var(--text-muted);
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

.proof-info {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  background: white;
  padding: 0.75rem;
  border-radius: 8px;
  margin-bottom: 0.75rem;
}

.proof-info-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.proof-info-item .info-label {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.proof-info-item .info-value {
  font-size: 0.75rem;
  color: var(--text-primary);
}

.disclosed-claims {
  margin-bottom: 0.75rem;
}

.claims-title {
  font-size: 0.75rem;
  color: var(--text-muted);
  display: block;
  margin-bottom: 0.5rem;
}

.claims-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
}

.claim-badge {
  font-size: 0.6875rem;
  font-weight: 500;
  padding: 0.25rem 0.5rem;
  background: rgba(16, 185, 129, 0.15);
  color: #059669;
  border-radius: 4px;
}

.claim-badge.default {
  background: rgba(99, 102, 241, 0.15);
  color: #6366f1;
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

/* Payment Link Section */
.payment-link-section {
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.05) 0%, rgba(6, 182, 212, 0.05) 100%);
  border: 1px solid rgba(99, 102, 241, 0.15);
  border-radius: 16px;
  padding: 1.25rem;
  margin-bottom: 1rem;
}

.payment-link-section .section-title {
  margin-bottom: 0.5rem;
}

.link-description {
  font-size: 0.875rem;
  color: var(--text-muted);
  margin-bottom: 1rem;
}

.qr-container {
  display: flex;
  justify-content: center;
  margin-bottom: 1rem;
}

.qr-code {
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.link-input-row {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.link-input {
  flex: 1;
  padding: 0.625rem 0.875rem;
  background: white;
  border: 1px solid rgba(15, 23, 42, 0.1);
  border-radius: 8px;
  font-size: 0.8125rem;
  color: var(--text-primary);
  cursor: pointer;
}

.link-input:focus {
  outline: none;
  border-color: #6366f1;
}

.copy-link-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  background: #6366f1;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s;
}

.copy-link-btn:hover {
  background: #4f46e5;
}

.share-buttons {
  display: flex;
  gap: 0.5rem;
}

.share-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.625rem 1rem;
  background: white;
  border: 1px solid rgba(15, 23, 42, 0.1);
  border-radius: 8px;
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--text-primary);
  cursor: pointer;
  transition: all 0.2s;
  font-family: inherit;
}

.share-btn:hover {
  background: rgba(15, 23, 42, 0.03);
  border-color: rgba(15, 23, 42, 0.15);
}

.share-btn svg {
  color: var(--text-secondary);
}
</style>

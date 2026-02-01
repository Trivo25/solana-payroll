<template>
  <div class="pay-page">
    <div class="pay-container">
      <!-- Header -->
      <div class="pay-header">
        <NuxtLink to="/" class="logo-link">
          <div class="logo-icon">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <rect width="32" height="32" rx="8" fill="url(#logo-grad)" />
              <path
                d="M16 6L22 12L16 18L10 12L16 6Z"
                fill="white"
                fill-opacity="0.9"
              />
              <path
                d="M16 14L22 20L16 26L10 20L16 14Z"
                fill="white"
                fill-opacity="0.6"
              />
              <defs>
                <linearGradient id="logo-grad" x1="0" y1="0" x2="32" y2="32">
                  <stop stop-color="#10b981" />
                  <stop offset="1" stop-color="#059669" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <span class="logo-text">Veil</span>
        </NuxtLink>
      </div>

      <!-- Loading State -->
      <div v-if="loading" class="loading-state">
        <div class="spinner-large"></div>
        <p>Loading invoice...</p>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="error-state">
        <div class="error-icon">
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <h2>Invoice Not Found</h2>
        <p>{{ error }}</p>
        <NuxtLink to="/" class="btn btn-primary">Go to Home</NuxtLink>
      </div>

      <!-- Invoice Found -->
      <div v-else-if="invoice" class="invoice-card">
        <!-- Already Paid -->
        <div v-if="invoice.status === 'paid'" class="paid-state">
          <div class="paid-icon">
            <svg
              width="64"
              height="64"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>
          <h2>Already Paid</h2>
          <p>
            This invoice was paid on
            {{ invoice.paidAt ? formatDate(invoice.paidAt) : 'Unknown' }}
          </p>
          <div class="paid-details">
            <div class="detail-row">
              <span class="detail-label">Amount</span>
              <span class="detail-value"
                >${{ invoice.amount.toLocaleString() }} USDC</span
              >
            </div>
            <div v-if="invoice.txSignature" class="detail-row">
              <span class="detail-label">Transaction</span>
              <a :href="explorerUrl" target="_blank" class="tx-link mono">
                {{ invoice.txSignature.slice(0, 8) }}...{{
                  invoice.txSignature.slice(-8)
                }}
              </a>
            </div>
          </div>
        </div>

        <!-- Payment Form -->
        <div v-else class="payment-form">
          <!-- Invoice Info -->
          <div class="invoice-info">
            <div class="invoice-badge">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path
                  d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"
                />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              <span>Invoice</span>
            </div>
            <h1 class="invoice-title">{{ invoice.title }}</h1>
            <p v-if="invoice.description" class="invoice-desc">
              {{ invoice.description }}
            </p>
          </div>

          <!-- Amount -->
          <div class="amount-display">
            <span class="amount-label">Amount Due</span>
            <div class="amount-value">
              <span class="currency">$</span>
              <span class="number">{{ invoice.amount.toLocaleString() }}</span>
              <span class="token">USDC</span>
            </div>
          </div>

          <!-- Recipient Info -->
          <div class="recipient-info">
            <span class="recipient-label">Pay to</span>
            <span class="recipient-address mono">{{
              shortenAddress(invoice.sender)
            }}</span>
          </div>

          <!-- Due Date -->
          <div
            v-if="invoice.dueDate"
            class="due-date"
            :class="{ overdue: isOverdue }"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <span v-if="isOverdue"
              >Overdue since {{ formatDate(invoice.dueDate) }}</span
            >
            <span v-else>Due {{ formatDate(invoice.dueDate) }}</span>
          </div>

          <!-- Connect Wallet Section -->
          <div v-if="!connected" class="connect-section">
            <p class="connect-hint">Connect your wallet to pay this invoice</p>
            <button
              v-if="walletReady"
              class="btn btn-primary btn-lg"
              @click="openWalletModal"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <path d="M22 10H2" />
                <path d="M6 16h4" />
              </svg>
              Connect Wallet
            </button>
            <div v-else class="wallet-loading">
              <div class="spinner"></div>
              <span>Loading wallets...</span>
            </div>
          </div>

          <!-- Payment Options -->
          <div v-else class="payment-options">
            <!-- Payment Method -->
            <div class="method-selection">
              <label
                class="method-option"
                :class="{
                  selected: paymentMethod === 'confidential',
                  disabled: !canPayConfidential,
                }"
              >
                <input
                  type="radio"
                  v-model="paymentMethod"
                  value="confidential"
                  :disabled="!canPayConfidential"
                />
                <div class="method-content">
                  <div class="method-header">
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    </svg>
                    <span class="method-title">Pay Privately</span>
                    <span class="method-badge">Recommended</span>
                  </div>
                  <p class="method-desc">
                    Amount hidden using confidential transfers
                  </p>
                  <div class="method-balance">
                    Balance:
                    <span class="mono"
                      >{{ formatBalance(ctBalance) }} cUSDC</span
                    >
                  </div>
                </div>
              </label>

              <label
                class="method-option"
                :class="{ selected: paymentMethod === 'public' }"
              >
                <input type="radio" v-model="paymentMethod" value="public" />
                <div class="method-content">
                  <div class="method-header">
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                    <span class="method-title">Pay Publicly</span>
                  </div>
                  <p class="method-desc">Standard transfer visible on chain</p>
                  <div class="method-balance">
                    Balance:
                    <span class="mono"
                      >{{ formatBalance(publicBalance) }} USDC</span
                    >
                  </div>
                </div>
              </label>
            </div>

            <!-- Payment Progress -->
            <div v-if="paymentProgress" class="payment-progress">
              <div class="progress-header">
                <span>Processing Payment</span>
                <span class="progress-step"
                  >{{ paymentProgress.step }}/{{
                    paymentProgress.totalSteps
                  }}</span
                >
              </div>
              <div class="progress-bar">
                <div
                  class="progress-fill"
                  :style="{
                    width: `${(paymentProgress.step / paymentProgress.totalSteps) * 100}%`,
                  }"
                ></div>
              </div>
              <div class="progress-status">
                {{ paymentProgress.currentStep }}
              </div>
            </div>

            <!-- Pay Button -->
            <button
              class="btn btn-pay"
              :class="paymentMethod"
              :disabled="paying || !canPay"
              @click="handlePay"
            >
              <span v-if="paying" class="btn-loading">
                <span class="spinner"></span>
                Processing...
              </span>
              <span v-else>
                Pay ${{ invoice.amount.toLocaleString() }}
                {{ paymentMethod === 'confidential' ? 'Privately' : '' }}
              </span>
            </button>

            <p v-if="!canPay && !paying" class="insufficient-hint">
              Insufficient
              {{
                paymentMethod === 'confidential' ? 'private' : 'public'
              }}
              balance
            </p>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="pay-footer">
        <p>Powered by <strong>Veil</strong></p>
        <p class="footer-hint">Private payments on Solana</p>
      </div>
    </div>

    <!-- Success Modal -->
    <Teleport to="body">
      <div
        v-if="showSuccess"
        class="success-overlay"
        @click.self="closeSuccess"
      >
        <div class="success-modal">
          <div class="success-icon">
            <svg
              width="64"
              height="64"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>
          <h2>Payment Successful!</h2>
          <p>
            Your {{ paymentMethod === 'confidential' ? 'private ' : '' }}payment
            has been sent.
          </p>
          <div class="success-details">
            <div class="detail-row">
              <span>Amount</span>
              <span class="mono"
                >${{ invoice?.amount.toLocaleString() }} USDC</span
              >
            </div>
            <div v-if="txSignature" class="detail-row">
              <span>Transaction</span>
              <a
                :href="successExplorerUrl"
                target="_blank"
                class="tx-link mono"
              >
                {{ txSignature.slice(0, 8) }}...{{ txSignature.slice(-8) }}
              </a>
            </div>
          </div>
          <div class="success-actions">
            <a
              :href="successExplorerUrl"
              target="_blank"
              class="btn btn-secondary"
            >
              View on Explorer
            </a>
            <NuxtLink to="/dashboard" class="btn btn-primary">
              Go to Dashboard
            </NuxtLink>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Wallet List Modal -->
    <Teleport to="body">
      <div
        v-if="showWalletList"
        class="wallet-overlay"
        @click.self="showWalletList = false"
      >
        <div class="wallet-modal">
          <div class="wallet-modal-header">
            <h3>Connect Wallet</h3>
            <button class="close-btn" @click="showWalletList = false">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
          <div class="wallet-modal-list">
            <button
              v-for="wallet in walletList"
              :key="wallet.name"
              class="wallet-option"
              @click="selectWallet(wallet.name)"
            >
              <img
                v-if="wallet.icon"
                :src="wallet.icon"
                :alt="wallet.name"
                class="wallet-icon"
              />
              <span class="wallet-name">{{ wallet.name }}</span>
              <span
                v-if="wallet.readyState === 'Installed'"
                class="installed-badge"
                >Installed</span
              >
            </button>
            <p v-if="walletList.length === 0" class="no-wallets">
              No wallets found. Please install a Solana wallet.
            </p>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import {
  useInvoices,
  formatDate,
  type Invoice,
  type PayInvoiceInput,
  generatePaymentRef,
  derivePaymentNonce,
} from '~/composables/useInvoices';
import { useConfidentialTransfer } from '~/composables/useConfidentialTransfer';
import { useToast } from '~/composables/useToast';

const route = useRoute();
const { fetchInvoiceById, payInvoice, loading, error } = useInvoices();
const {
  initializeMint,
  deriveElGamalKeypair,
  transferConfidential,
  getConfidentialBalance,
  getPublicBalance,
  withdrawProgress,
} = useConfidentialTransfer();
const toast = useToast();

// wallet state
const walletReady = ref(false);
const connected = ref(false);
const publicKey = ref<any>(null);
let walletComposable: any = null;
let walletSelect: (name: string) => void = () => {};
let walletConnect: () => Promise<void> = async () => {};
let walletDisconnect: () => Promise<void> = async () => {};

function getWalletAdapter() {
  return walletComposable?.wallet?.value?.adapter || null;
}

const invoice = ref<Invoice | null>(null);
const paymentMethod = ref<'public' | 'confidential'>('confidential');
const ctBalance = ref(0);
const publicBalance = ref(0);
const paying = ref(false);
const showSuccess = ref(false);
const txSignature = ref('');
const showWalletList = ref(false);
const walletList = ref<
  Array<{ name: string; icon: string; readyState: string }>
>([]);

const walletAddress = computed(() => publicKey.value?.toBase58() || '');

const isOverdue = computed(() => {
  if (!invoice.value?.dueDate) return false;
  return invoice.value.dueDate < Date.now();
});

const canPayConfidential = computed(() => {
  if (!invoice.value) return false;
  return ctBalance.value >= invoice.value.amount;
});

const canPay = computed(() => {
  if (!invoice.value) return false;
  if (paymentMethod.value === 'confidential') {
    return ctBalance.value >= invoice.value.amount;
  }
  return publicBalance.value >= invoice.value.amount;
});

const paymentProgress = computed(() => {
  if (!paying.value) return null;
  return withdrawProgress.value;
});

const explorerUrl = computed(() => {
  if (!invoice.value?.txSignature) return '';
  return `https://explorer.solana.com/tx/${invoice.value.txSignature}?cluster=custom&customUrl=https://zk-edge.surfnet.dev:8899`;
});

const successExplorerUrl = computed(() => {
  if (!txSignature.value) return '';
  return `https://explorer.solana.com/tx/${txSignature.value}?cluster=custom&customUrl=https://zk-edge.surfnet.dev:8899`;
});

function shortenAddress(addr: string): string {
  if (!addr) return '';
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function formatBalance(bal: number): string {
  return bal.toFixed(2);
}

function openWalletModal() {
  showWalletList.value = true;
}

async function selectWallet(walletName: string) {
  try {
    walletSelect(walletName);
    await walletConnect();
    showWalletList.value = false;
  } catch (e) {
    console.error('Failed to connect:', e);
  }
}

async function loadBalances() {
  const adapter = getWalletAdapter();
  if (!connected.value || !adapter) return;

  try {
    initializeMint();
    await deriveElGamalKeypair(adapter);

    const [ct, pub] = await Promise.all([
      getConfidentialBalance(adapter, 'USDC'),
      getPublicBalance(adapter, 'USDC'),
    ]);
    ctBalance.value = ct;
    publicBalance.value = pub;

    if (
      !canPayConfidential.value &&
      publicBalance.value >= (invoice.value?.amount || 0)
    ) {
      paymentMethod.value = 'public';
    }
  } catch (e: any) {
    console.error('failed to load balances:', e);
    toast.error('Failed to load balances', {
      message: e.message || 'Please try reconnecting your wallet',
    });
  }
}

async function handlePay() {
  const adapter = getWalletAdapter();
  if (!invoice.value || !adapter) return;

  paying.value = true;

  try {
    let sig: string;
    let paymentNonce: string | undefined;
    let paymentRefHash: string | undefined;

    if (paymentMethod.value === 'confidential') {
      paymentNonce = await derivePaymentNonce(adapter, invoice.value.id);
      paymentRefHash = await generatePaymentRef(
        invoice.value.id,
        invoice.value.sender,
        invoice.value.recipient,
        invoice.value.amount,
        paymentNonce,
      );
      sig = await transferConfidential(
        adapter,
        invoice.value.sender,
        invoice.value.amount,
        paymentRefHash,
      );
    } else {
      // mock public transfer
      sig = 'public_' + Math.random().toString(36).substring(2, 15);
      await new Promise((r) => setTimeout(r, 1500));
    }

    const payment: PayInvoiceInput = {
      txSignature: sig,
      paymentMethod: paymentMethod.value,
      paymentNonce,
      paymentRef: paymentRefHash,
    };

    const success = await payInvoice(invoice.value.id, payment);

    if (success) {
      txSignature.value = sig;
      showSuccess.value = true;
      invoice.value = await fetchInvoiceById(invoice.value.id);
    } else {
      toast.error('Payment recorded but invoice update failed');
    }
  } catch (e: any) {
    console.error('payment error:', e);
    toast.error('Payment Failed', { message: e.message || 'Please try again' });
  } finally {
    paying.value = false;
  }
}

function closeSuccess() {
  showSuccess.value = false;
}

onMounted(async () => {
  const invoiceId = route.params.id as string;
  if (invoiceId) {
    invoice.value = await fetchInvoiceById(invoiceId);
  }

  // dynamic import to avoid ssr issues
  try {
    const { initWallet, useWallet } = await import('solana-wallets-vue');

    let wallet;
    let needsInit = false;
    try {
      wallet = useWallet();
    } catch {
      needsInit = true;
    }

    if (needsInit) {
      const {
        PhantomWalletAdapter,
        SolflareWalletAdapter,
        CoinbaseWalletAdapter,
      } = await import('@solana/wallet-adapter-wallets');

      initWallet({
        wallets: [
          new PhantomWalletAdapter(),
          new SolflareWalletAdapter(),
          new CoinbaseWalletAdapter(),
        ],
        autoConnect: false,
      });
      wallet = useWallet();
    }

    const mapWallets = (rawWallets: any[]) =>
      rawWallets.map((w) => ({
        name: w.adapter.name,
        icon: w.adapter.icon,
        readyState: w.readyState,
      }));

    walletComposable = wallet;
    connected.value = wallet.connected.value;
    publicKey.value = wallet.publicKey.value;
    walletList.value = mapWallets(wallet.wallets.value || []);

    watch(
      () => wallet.connected.value,
      (val) => {
        connected.value = val;
        if (val) loadBalances();
      },
    );
    watch(
      () => wallet.publicKey.value,
      (val) => {
        publicKey.value = val;
      },
    );
    watch(
      () => wallet.wallets.value,
      (val) => {
        walletList.value = mapWallets(val || []);
      },
    );

    walletSelect = wallet.select;
    walletConnect = wallet.connect;
    walletDisconnect = wallet.disconnect;

    if (wallet.connected.value) {
      await loadBalances();
    }
  } catch (e) {
    console.error('failed to initialize wallet:', e);
  } finally {
    walletReady.value = true;
  }
});
</script>

<style scoped>
.pay-page {
  min-height: 100vh;
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
  padding: 2rem 1rem;
}

.pay-container {
  max-width: 480px;
  margin: 0 auto;
}

/* Header */
.pay-header {
  text-align: center;
  margin-bottom: 2rem;
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
}

.logo-text {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-primary);
}

/* Loading */
.loading-state {
  text-align: center;
  padding: 4rem 2rem;
}

.spinner-large {
  width: 48px;
  height: 48px;
  border: 3px solid rgba(16, 185, 129, 0.2);
  border-top-color: #10b981;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin: 0 auto 1rem;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.loading-state p {
  color: var(--text-muted);
}

/* Error */
.error-state {
  text-align: center;
  padding: 3rem 2rem;
  background: white;
  border-radius: 20px;
}

.error-icon {
  color: var(--text-muted);
  margin-bottom: 1rem;
}

.error-state h2 {
  font-size: 1.25rem;
  margin-bottom: 0.5rem;
}

.error-state p {
  color: var(--text-muted);
  margin-bottom: 1.5rem;
}

/* Invoice Card */
.invoice-card {
  background: white;
  border-radius: 24px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);
  overflow: hidden;
}

/* Paid State */
.paid-state {
  padding: 3rem 2rem;
  text-align: center;
}

.paid-icon {
  color: #10b981;
  margin-bottom: 1rem;
}

.paid-state h2 {
  font-size: 1.5rem;
  margin-bottom: 0.5rem;
  color: #10b981;
}

.paid-state > p {
  color: var(--text-muted);
  margin-bottom: 1.5rem;
}

.paid-details {
  background: rgba(16, 185, 129, 0.05);
  border-radius: 12px;
  padding: 1rem;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  padding: 0.5rem 0;
}

.detail-row:not(:last-child) {
  border-bottom: 1px solid rgba(16, 185, 129, 0.1);
}

.detail-label {
  color: var(--text-muted);
  font-size: 0.875rem;
}

.detail-value {
  font-weight: 600;
}

.tx-link {
  color: #6366f1;
  text-decoration: none;
  font-size: 0.875rem;
}

.tx-link:hover {
  text-decoration: underline;
}

/* Payment Form */
.payment-form {
  padding: 2rem;
}

.invoice-info {
  margin-bottom: 1.5rem;
}

.invoice-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.25rem 0.75rem;
  background: rgba(99, 102, 241, 0.1);
  color: #6366f1;
  border-radius: 100px;
  font-size: 0.75rem;
  font-weight: 600;
  margin-bottom: 0.75rem;
}

.invoice-title {
  font-size: 1.25rem;
  font-weight: 700;
  margin-bottom: 0.25rem;
}

.invoice-desc {
  color: var(--text-muted);
  font-size: 0.875rem;
}

/* Amount */
.amount-display {
  text-align: center;
  padding: 1.5rem;
  background: linear-gradient(
    135deg,
    rgba(16, 185, 129, 0.05) 0%,
    rgba(6, 182, 212, 0.05) 100%
  );
  border-radius: 16px;
  margin-bottom: 1.5rem;
}

.amount-label {
  font-size: 0.75rem;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.amount-value {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 0.25rem;
  margin-top: 0.5rem;
}

.amount-value .currency {
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--text-secondary);
}

.amount-value .number {
  font-size: 3rem;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1;
}

.amount-value .token {
  font-size: 1rem;
  color: var(--text-muted);
  margin-left: 0.25rem;
}

/* Recipient */
.recipient-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  background: rgba(15, 23, 42, 0.03);
  border-radius: 10px;
  margin-bottom: 1rem;
}

.recipient-label {
  font-size: 0.875rem;
  color: var(--text-muted);
}

.recipient-address {
  font-size: 0.875rem;
  color: var(--text-primary);
}

/* Due Date */
.due-date {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.5rem;
  font-size: 0.875rem;
  color: var(--text-muted);
  margin-bottom: 1.5rem;
}

.due-date.overdue {
  color: #ef4444;
}

/* Connect Section */
.connect-section {
  text-align: center;
  padding: 1rem 0;
}

.connect-hint {
  color: var(--text-muted);
  margin-bottom: 1rem;
}

.wallet-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  color: var(--text-muted);
  font-size: 0.875rem;
}

/* Payment Options */
.payment-options {
  margin-top: 1rem;
}

.method-selection {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
}

.method-option {
  display: flex;
  align-items: flex-start;
  gap: 0.875rem;
  padding: 1rem;
  background: rgba(15, 23, 42, 0.02);
  border: 2px solid transparent;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.method-option:hover:not(.disabled) {
  background: rgba(15, 23, 42, 0.04);
}

.method-option.selected {
  border-color: #10b981;
  background: rgba(16, 185, 129, 0.05);
}

.method-option.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.method-option input[type='radio'] {
  appearance: none;
  -webkit-appearance: none;
  box-sizing: border-box;
  width: 14px;
  height: 14px;
  min-width: 14px;
  max-width: 14px;
  border: 1.5px solid #d1d5db;
  border-radius: 50%;
  margin: 3px 0 0 0;
  padding: 0;
  flex-shrink: 0;
  flex-grow: 0;
  cursor: pointer;
  position: relative;
  transition: all 0.15s;
}

.method-option input[type='radio']:checked {
  border-color: #10b981;
  background: #10b981;
}

.method-option input[type='radio']:checked::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 5px;
  height: 5px;
  background: white;
  border-radius: 50%;
}

.method-option input[type='radio']:disabled {
  border-color: #e5e7eb;
  cursor: not-allowed;
}

.method-content {
  flex: 1;
  min-width: 0;
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

.method-option.selected .method-header svg {
  color: #10b981;
}

.method-title {
  font-weight: 600;
  font-size: 0.9375rem;
}

.method-badge {
  font-size: 0.625rem;
  font-weight: 600;
  text-transform: uppercase;
  padding: 0.125rem 0.375rem;
  background: linear-gradient(135deg, #10b981, #059669);
  color: white;
  border-radius: 4px;
}

.method-desc {
  font-size: 0.8125rem;
  color: var(--text-muted);
  margin-bottom: 0.5rem;
}

.method-balance {
  font-size: 0.8125rem;
  color: var(--text-secondary);
}

/* Payment Progress */
.payment-progress {
  padding: 1rem;
  background: rgba(99, 102, 241, 0.1);
  border-radius: 10px;
  margin-bottom: 1rem;
}

.progress-header {
  display: flex;
  justify-content: space-between;
  font-size: 0.875rem;
  font-weight: 500;
  color: #6366f1;
  margin-bottom: 0.5rem;
}

.progress-step {
  color: var(--text-muted);
}

.progress-bar {
  height: 4px;
  background: rgba(99, 102, 241, 0.2);
  border-radius: 2px;
  margin-bottom: 0.5rem;
}

.progress-fill {
  height: 100%;
  background: #6366f1;
  border-radius: 2px;
  transition: width 0.3s;
}

.progress-status {
  font-size: 0.75rem;
  color: var(--text-secondary);
  text-align: center;
}

/* Pay Button */
.btn-pay {
  width: 100%;
  padding: 1rem;
  font-size: 1rem;
  font-weight: 600;
  border: none;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.btn-pay.confidential {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;
}

.btn-pay.confidential:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
}

.btn-pay.public {
  background: var(--primary);
  color: white;
}

.btn-pay.public:hover:not(:disabled) {
  background: #1e293b;
}

.btn-pay:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.btn-loading {
  display: flex;
  align-items: center;
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

.insufficient-hint {
  text-align: center;
  font-size: 0.8125rem;
  color: #f59e0b;
  margin-top: 0.75rem;
}

/* Footer */
.pay-footer {
  text-align: center;
  padding: 2rem 0;
  color: var(--text-muted);
}

.pay-footer p {
  font-size: 0.875rem;
}

.pay-footer strong {
  color: var(--text-primary);
}

.footer-hint {
  font-size: 0.75rem;
  margin-top: 0.25rem;
}

/* Success Modal */
.success-overlay {
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

.success-modal {
  background: white;
  border-radius: 24px;
  padding: 2.5rem;
  max-width: 400px;
  width: 100%;
  text-align: center;
}

.success-icon {
  color: #10b981;
  margin-bottom: 1rem;
}

.success-modal h2 {
  font-size: 1.5rem;
  margin-bottom: 0.5rem;
}

.success-modal > p {
  color: var(--text-muted);
  margin-bottom: 1.5rem;
}

.success-details {
  background: rgba(16, 185, 129, 0.05);
  border-radius: 12px;
  padding: 1rem;
  margin-bottom: 1.5rem;
  text-align: left;
}

.success-details .detail-row {
  display: flex;
  justify-content: space-between;
  padding: 0.5rem 0;
  font-size: 0.875rem;
}

.success-actions {
  display: flex;
  gap: 0.75rem;
}

.success-actions .btn {
  flex: 1;
  padding: 0.75rem;
  font-size: 0.875rem;
}

/* Buttons */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  font-size: 0.9rem;
  font-weight: 600;
  border-radius: 10px;
  border: none;
  cursor: pointer;
  text-decoration: none;
  transition: all 0.2s;
  font-family: inherit;
}

.btn-primary {
  background: var(--primary);
  color: white;
}

.btn-primary:hover {
  background: #1e293b;
}

.btn-secondary {
  background: rgba(15, 23, 42, 0.1);
  color: var(--text-primary);
}

.btn-secondary:hover {
  background: rgba(15, 23, 42, 0.15);
}

.btn-lg {
  padding: 1rem 2rem;
  font-size: 1rem;
}

/* Utils */
.mono {
  font-family: 'IBM Plex Mono', monospace;
}

/* Wallet Modal */
.wallet-overlay {
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

.wallet-modal {
  background: white;
  border-radius: 20px;
  max-width: 400px;
  width: 100%;
  overflow: hidden;
}

.wallet-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid rgba(15, 23, 42, 0.08);
}

.wallet-modal-header h3 {
  font-size: 1.125rem;
  font-weight: 600;
  margin: 0;
}

.close-btn {
  background: none;
  border: none;
  padding: 0.25rem;
  cursor: pointer;
  color: var(--text-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  transition: all 0.2s;
}

.close-btn:hover {
  background: rgba(15, 23, 42, 0.05);
  color: var(--text-primary);
}

.wallet-modal-list {
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.wallet-option {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  padding: 0.875rem 1rem;
  background: rgba(15, 23, 42, 0.03);
  border: 1px solid transparent;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s;
  font-family: inherit;
}

.wallet-option:hover {
  background: rgba(15, 23, 42, 0.06);
  border-color: rgba(15, 23, 42, 0.1);
}

.wallet-icon {
  width: 32px;
  height: 32px;
  border-radius: 8px;
}

.wallet-name {
  font-weight: 500;
  color: var(--text-primary);
}

.installed-badge {
  margin-left: auto;
  font-size: 0.75rem;
  font-weight: 500;
  padding: 0.25rem 0.5rem;
  background: rgba(16, 185, 129, 0.1);
  color: #10b981;
  border-radius: 4px;
}

.no-wallets {
  text-align: center;
  color: var(--text-muted);
  padding: 1rem;
  font-size: 0.875rem;
}
</style>

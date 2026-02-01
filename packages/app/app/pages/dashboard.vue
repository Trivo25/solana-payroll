<template>
  <div class="dashboard">
    <!-- Animated Background -->
    <div class="background">
      <div class="gradient-mesh"></div>
      <div class="aurora aurora-1"></div>
      <div class="aurora aurora-2"></div>
      <div class="noise"></div>
      <div class="grid-pattern"></div>
    </div>

    <!-- Content -->
    <main class="content">
      <div class="container">
        <!-- Header -->
        <header class="header">
          <div class="logo">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <rect width="32" height="32" rx="8" fill="url(#logo-grad)"/>
              <path d="M16 6L22 12L16 18L10 12L16 6Z" fill="white" fill-opacity="0.9"/>
              <path d="M16 14L22 20L16 26L10 20L16 14Z" fill="white" fill-opacity="0.6"/>
              <defs>
                <linearGradient id="logo-grad" x1="0" y1="0" x2="32" y2="32">
                  <stop stop-color="#10b981"/>
                  <stop offset="1" stop-color="#059669"/>
                </linearGradient>
              </defs>
            </svg>
            <span class="logo-text">Veil</span>
          </div>
          <div class="wallet-info">
            <ClientOnly>
              <template v-if="connected">
                <div class="wallet-address">
                  <span class="address-dot"></span>
                  <span class="mono">{{ shortenAddress(publicKey?.toBase58() || '') }}</span>
                </div>
                <button class="btn btn-danger btn-sm" @click="disconnect">
                  Disconnect
                </button>
              </template>
              <template v-else>
                <NuxtLink to="/connect" class="btn btn-primary btn-sm">
                  Connect Wallet
                </NuxtLink>
              </template>
            </ClientOnly>
          </div>
        </header>

        <!-- Welcome Section -->
        <div class="welcome-section">
          <ClientOnly>
            <template v-if="accountLoading">
              <div class="welcome-skeleton">
                <div class="skeleton skeleton-avatar"></div>
                <div class="skeleton skeleton-text"></div>
              </div>
            </template>
            <template v-else-if="account">
              <div class="welcome-content">
                <div class="profile-picture-wrapper" @click="triggerFileInput">
                  <img
                    v-if="account.profile_picture_url"
                    :src="account.profile_picture_url"
                    alt="Profile picture"
                    class="profile-picture"
                  />
                  <div v-else class="profile-picture-placeholder">
                    {{ getInitials(account.name) }}
                  </div>
                  <div class="profile-picture-overlay">
                    <span v-if="uploadingPicture" class="spinner"></span>
                    <svg v-else width="20" height="20" viewBox="0 0 20 20" fill="none">
                      <path d="M4 16L16 16" stroke="white" stroke-width="2" stroke-linecap="round"/>
                      <path d="M10 12V4M10 4L7 7M10 4L13 7" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                  </div>
                  <input
                    ref="fileInput"
                    type="file"
                    accept="image/*"
                    class="file-input"
                    @change="handleFileChange"
                  />
                </div>
                <div class="welcome-text">
                  <div class="welcome-header-row">
                    <h1>Welcome, {{ account.name }}</h1>
                    <div
                      v-if="connected"
                      class="qr-compact"
                      @click="showQRModal = true"
                    >
                      <img
                        v-if="qrCodeUrl"
                        :src="qrCodeUrl"
                        alt="Your QR Code"
                        class="qr-mini"
                      />
                      <div v-else class="qr-mini-loading"></div>
                      <div class="qr-shine"></div>
                    </div>
                  </div>
                  <div class="account-badge" :class="account.account_type">
                    <span class="badge-dot"></span>
                    {{ account.account_type === 'employer' ? 'Employer / Business' : 'Employee / Freelancer' }}
                  </div>
                </div>
              </div>
            </template>
            <template v-else>
              <h1 class="welcome-title">Welcome to Veil</h1>
              <p class="welcome-subtitle">Your private payment dashboard</p>
            </template>
          </ClientOnly>
        </div>

        <!-- QR Modal -->
        <Teleport to="body">
          <div
            v-if="showQRModal"
            class="modal-overlay"
            @click.self="showQRModal = false"
          >
            <div class="modal-content">
              <button class="modal-close" @click="showQRModal = false">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M15 5L5 15M5 5L15 15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>
              </button>
              <QRConnect
                :wallet-address="publicKey?.toBase58() || ''"
                @connect="handleQRConnect"
              />
            </div>
          </div>
        </Teleport>

        <!-- Balance Cards -->
        <ClientOnly>
          <div v-if="connected" class="balance-cards">
            <!-- Wallet Balance Card -->
            <div class="balance-card">
              <div class="card-header">
                <span class="card-label">Wallet Balance</span>
                <div class="card-icon">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <rect x="2" y="4" width="16" height="12" rx="2" stroke="currentColor" stroke-width="1.5"/>
                    <path d="M14 10H14.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                  </svg>
                </div>
              </div>
              <div class="balance-rows">
                <div class="balance-row">
                  <div class="token-icon sol">
                    <span>◎</span>
                  </div>
                  <div class="balance-info">
                    <span v-if="balanceLoading" class="skeleton skeleton-inline"></span>
                    <span v-else class="balance-amount mono">{{ formatBalance(balance) }}</span>
                    <span class="token-label">SOL</span>
                  </div>
                </div>
                <div class="balance-row">
                  <div class="token-icon usdc">
                    <span>$</span>
                  </div>
                  <div class="balance-info">
                    <span v-if="usdcLoading" class="skeleton skeleton-inline"></span>
                    <span v-else class="balance-amount mono">{{ formatUsdcBalance(usdcBalance) }}</span>
                    <span class="token-label">USDC</span>
                  </div>
                </div>
              </div>
              <div class="card-footer">
                <span class="footer-label">Native & stablecoin</span>
              </div>
            </div>

            <!-- Confidential Balance Component -->
            <ConfidentialBalance :wallet="walletAdapter" />

            <!-- Transaction History -->
            <TransactionHistory />
          </div>
        </ClientOnly>

        <!-- Invoices Section -->
        <ClientOnly>
          <div v-if="connected" class="invoices-section">
            <div class="section-header">
              <div class="section-header-left">
                <h2 class="section-title">Invoices</h2>
                <button class="btn btn-create-invoice" @click="showCreateInvoiceModal = true">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M8 3v10M3 8h10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                  </svg>
                  Create Invoice
                </button>
              </div>
              <div class="invoice-tabs">
                <button
                  class="invoice-tab"
                  :class="{ active: invoiceTab === 'all' }"
                  @click="invoiceTab = 'all'"
                >
                  All
                </button>
                <button
                  class="invoice-tab"
                  :class="{ active: invoiceTab === 'payable' }"
                  @click="invoiceTab = 'payable'"
                >
                  To Pay
                </button>
                <button
                  class="invoice-tab"
                  :class="{ active: invoiceTab === 'receivable' }"
                  @click="invoiceTab = 'receivable'"
                >
                  To Receive
                </button>
              </div>
            </div>

            <div v-if="filteredInvoices.length > 0" class="invoices-grid">
              <InvoiceCard
                v-for="invoice in filteredInvoices"
                :key="invoice.id"
                :invoice="invoice"
                :wallet-address="publicKey?.toBase58() || ''"
                @click="openInvoice"
              />
            </div>

            <div v-else class="empty-state">
              <div class="empty-icon">
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                  <rect x="8" y="6" width="32" height="40" rx="4" stroke="currentColor" stroke-width="2"/>
                  <path d="M16 18H32M16 26H28M16 34H24" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>
              </div>
              <p>No invoices yet</p>
              <button class="btn btn-create-invoice-empty" @click="showCreateInvoiceModal = true">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M8 3v10M3 8h10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>
                Create your first invoice
              </button>
            </div>
          </div>
        </ClientOnly>

        <!-- Invoice Modal -->
        <InvoiceModal
          v-if="selectedInvoice"
          :invoice="selectedInvoice"
          :wallet-address="publicKey?.toBase58() || ''"
          :is-open="showInvoiceModal"
          @close="closeInvoice"
          @paid="handleInvoicePaid"
        />

        <!-- Create Invoice Modal -->
        <CreateInvoiceModal
          :show="showCreateInvoiceModal"
          :sender-wallet="publicKey?.toBase58() || ''"
          :mint="testMint || 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'"
          @close="showCreateInvoiceModal = false"
          @created="handleInvoiceCreated"
        />

        <!-- Onboarding Tour (shows on first visit) -->
        <OnboardingTour />
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useSupabase, type UserAccount } from '~/composables/useSupabase';
import { useInvoices, type Invoice, type PayInvoiceInput } from '~/composables/useInvoices';
import { useConfidentialTransfer } from '~/composables/useConfidentialTransfer';

const connected = ref(false);
const publicKey = ref<any>(null);
const walletAdapter = ref<any>(null);
const balance = ref<number | null>(null);
const balanceLoading = ref(false);
const usdcBalance = ref<number | null>(null);
const usdcLoading = ref(false);

const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const confidentialBalance = ref<number | null>(null);
const confidentialLoading = ref(false);
const account = ref<UserAccount | null>(null);
const accountLoading = ref(true);
const uploadingPicture = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);
let walletDisconnect: () => Promise<void> = async () => {};
const RPC_URL = 'http://127.0.0.1:8899';

const showQRModal = ref(false);
const qrCodeUrl = ref('');

async function generateMiniQRCode() {
  const address = publicKey.value?.toBase58();
  if (!address) return;

  try {
    const QRCode = (await import('qrcode')).default;
    qrCodeUrl.value = await QRCode.toDataURL(address, {
      width: 80,
      margin: 1,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    });
  } catch (e) {
    console.error('failed to generate qr code:', e);
  }
}

const { getAccount, uploadProfilePicture } = useSupabase();
const {
  invoices,
  fetchInvoices,
  getInvoicesForWallet,
  getPayableInvoices,
  getReceivableInvoices,
  payInvoice,
} = useInvoices();
const { testMint } = useConfidentialTransfer();

const invoiceTab = ref<'all' | 'payable' | 'receivable'>('all');
const selectedInvoice = ref<Invoice | null>(null);
const showInvoiceModal = ref(false);
const showCreateInvoiceModal = ref(false);

const filteredInvoices = computed(() => {
  const walletAddress = publicKey.value?.toBase58() || '';
  if (!walletAddress) return [];

  switch (invoiceTab.value) {
    case 'payable':
      return getPayableInvoices(walletAddress);
    case 'receivable':
      return getReceivableInvoices(walletAddress);
    default:
      return getInvoicesForWallet(walletAddress);
  }
});

function openInvoice(invoice: Invoice) {
  selectedInvoice.value = invoice;
  showInvoiceModal.value = true;
}

function closeInvoice() {
  showInvoiceModal.value = false;
  selectedInvoice.value = null;
}

async function handleInvoicePaid(invoiceId: string, payment: PayInvoiceInput) {
  const success = await payInvoice(invoiceId, payment);
  if (success) {
    const updated = invoices.value.find((inv) => inv.id === invoiceId);
    if (updated) {
      selectedInvoice.value = { ...updated };
    }
  }
}

async function handleInvoiceCreated() {
  // Refresh invoices after creation
  const walletAddress = publicKey.value?.toBase58();
  if (walletAddress) {
    await fetchInvoices(walletAddress);
  }
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((word) => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function triggerFileInput() {
  fileInput.value?.click();
}

async function handleFileChange(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file || !publicKey.value) return;

  if (!file.type.startsWith('image/')) {
    alert('Please select an image file');
    return;
  }

  if (file.size > 2 * 1024 * 1024) {
    alert('Image must be less than 2MB');
    return;
  }

  uploadingPicture.value = true;
  try {
    const walletAddress = publicKey.value.toBase58();
    const newUrl = await uploadProfilePicture(walletAddress, file);
    if (newUrl && account.value) {
      account.value = { ...account.value, profile_picture_url: newUrl };
    }
  } catch (e) {
    console.error('failed to upload picture:', e);
    alert('Failed to upload picture. Please try again.');
  } finally {
    uploadingPicture.value = false;
    input.value = '';
  }
}

async function fetchBalance(pubkey: any, silent = false) {
  if (!pubkey) return;
  if (!silent) balanceLoading.value = true;
  try {
    const { Connection, LAMPORTS_PER_SOL } = await import('@solana/web3.js');
    const connection = new Connection(RPC_URL);
    const lamports = await connection.getBalance(pubkey);
    balance.value = lamports / LAMPORTS_PER_SOL;
  } catch (e) {
    if (!silent) console.error('failed to fetch balance:', e);
    if (!silent) balance.value = null;
  } finally {
    if (!silent) balanceLoading.value = false;
  }
}

const BALANCE_POLL_INTERVAL = 10000;
let balancePollId: ReturnType<typeof setInterval> | null = null;

function startBalancePolling() {
  if (balancePollId) return;
  balancePollId = setInterval(async () => {
    if (publicKey.value) {
      await fetchBalance(publicKey.value, true);
    }
  }, BALANCE_POLL_INTERVAL);
}

function stopBalancePolling() {
  if (balancePollId) {
    clearInterval(balancePollId);
    balancePollId = null;
  }
}

async function fetchUsdcBalance(pubkey: any) {
  if (!pubkey) return;
  usdcLoading.value = true;
  try {
    const { Connection, PublicKey } = await import('@solana/web3.js');
    const { getAssociatedTokenAddress, getAccount } = await import('@solana/spl-token');
    const connection = new Connection(RPC_URL);
    const mintPubkey = new PublicKey(USDC_MINT);
    const ataAddress = await getAssociatedTokenAddress(mintPubkey, pubkey);

    try {
      const tokenAccount = await getAccount(connection, ataAddress);
      usdcBalance.value = Number(tokenAccount.amount) / 1_000_000;
    } catch (e: any) {
      if (e.name === 'TokenAccountNotFoundError') {
        usdcBalance.value = 0;
      } else {
        throw e;
      }
    }
  } catch (e) {
    console.error('failed to fetch USDC balance:', e);
    usdcBalance.value = null;
  } finally {
    usdcLoading.value = false;
  }
}

function formatBalance(bal: number | null): string {
  if (bal === null) return '—';
  return bal.toFixed(4);
}

function formatUsdcBalance(bal: number | null): string {
  if (bal === null) return '—';
  return bal.toFixed(2);
}

async function fetchConfidentialBalance(pubkey: any) {
  if (!pubkey) return;
  confidentialLoading.value = true;
  try {
    confidentialBalance.value = null;
  } catch (e) {
    console.error('failed to fetch confidential balance:', e);
    confidentialBalance.value = null;
  } finally {
    confidentialLoading.value = false;
  }
}

async function handleQRConnect(scannedAddress: string) {
  console.log('connecting to:', scannedAddress);
  alert(`Ready to connect with: ${scannedAddress}\n\nConnection feature coming soon!`);
}

async function checkAccount(walletAddress: string) {
  accountLoading.value = true;
  try {
    const existingAccount = await getAccount(walletAddress);
    if (!existingAccount) {
      navigateTo('/onboarding');
      return;
    }
    account.value = existingAccount;
  } catch (e) {
    console.error('failed to check account:', e);
  } finally {
    accountLoading.value = false;
  }
}

onMounted(async () => {
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
        autoConnect: true,
      });
      wallet = useWallet();
    }

    connected.value = wallet.connected.value;
    publicKey.value = wallet.publicKey.value;
    walletAdapter.value = wallet;

    if (wallet.publicKey.value) {
      const address = wallet.publicKey.value.toBase58();
      fetchBalance(wallet.publicKey.value);
      fetchUsdcBalance(wallet.publicKey.value);
      fetchConfidentialBalance(wallet.publicKey.value);
      fetchInvoices(address);
      checkAccount(address);
      generateMiniQRCode();
      startBalancePolling();
    }

    watch(
      () => wallet.connected.value,
      (val) => {
        connected.value = val;
      },
    );
    watch(
      () => wallet.publicKey.value,
      (val) => {
        publicKey.value = val;
        if (val) {
          const address = val.toBase58();
          fetchBalance(val);
          fetchUsdcBalance(val);
          fetchConfidentialBalance(val);
          fetchInvoices(address);
          checkAccount(address);
          generateMiniQRCode();
          startBalancePolling();
        } else {
          stopBalancePolling();
        }
      },
    );

    walletDisconnect = wallet.disconnect;

    setTimeout(() => {
      if (!wallet.connected.value) {
        navigateTo('/connect');
      }
    }, 1000);
  } catch (e) {
    console.error('failed to initialize wallet:', e);
    navigateTo('/connect');
  }
});

onUnmounted(() => {
  stopBalancePolling();
});

function disconnect() {
  walletDisconnect();
  navigateTo('/');
}

function shortenAddress(address: string): string {
  if (!address) return '';
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}
</script>

<style scoped>
.dashboard {
  min-height: 100vh;
  position: relative;
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
    radial-gradient(at 20% 20%, rgba(16, 185, 129, 0.08) 0px, transparent 50%),
    radial-gradient(at 80% 80%, rgba(6, 182, 212, 0.06) 0px, transparent 50%),
    radial-gradient(at 50% 50%, rgba(99, 102, 241, 0.03) 0px, transparent 50%);
}

.aurora {
  position: absolute;
  filter: blur(120px);
  opacity: 0.3;
}

.aurora-1 {
  width: 50vw;
  height: 50vh;
  background: linear-gradient(180deg, rgba(16, 185, 129, 0.4) 0%, transparent 100%);
  top: -20%;
  right: -10%;
  animation: aurora1 25s ease-in-out infinite;
}

.aurora-2 {
  width: 40vw;
  height: 40vh;
  background: linear-gradient(180deg, rgba(6, 182, 212, 0.3) 0%, transparent 100%);
  bottom: -15%;
  left: -10%;
  animation: aurora2 30s ease-in-out infinite;
}

@keyframes aurora1 {
  0%, 100% { transform: translateY(0) rotate(0deg) scale(1); }
  50% { transform: translateY(-30px) rotate(3deg) scale(1.05); }
}

@keyframes aurora2 {
  0%, 100% { transform: translateX(0) rotate(0deg); }
  50% { transform: translateX(40px) rotate(-3deg); }
}

.noise {
  position: absolute;
  inset: 0;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
  opacity: 0.012;
  pointer-events: none;
}

.grid-pattern {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(15, 23, 42, 0.012) 1px, transparent 1px),
    linear-gradient(90deg, rgba(15, 23, 42, 0.012) 1px, transparent 1px);
  background-size: 60px 60px;
}

/* Content */
.content {
  position: relative;
  z-index: 1;
  min-height: 100vh;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 1.5rem 2rem 3rem;
}

/* Header */
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2.5rem;
  padding: 1rem 1.25rem;
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(20px);
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
}

.logo {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.logo-text {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: -0.02em;
}

.wallet-info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.wallet-address {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: rgba(16, 185, 129, 0.08);
  border: 1px solid rgba(16, 185, 129, 0.15);
  border-radius: var(--radius-md);
  font-size: 0.8rem;
  color: var(--text-secondary);
}

.address-dot {
  width: 8px;
  height: 8px;
  background: var(--secondary);
  border-radius: 50%;
  animation: pulse 2s ease-in-out infinite;
}

/* Welcome Section */
.welcome-section {
  margin-bottom: 2rem;
}

.welcome-skeleton {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.skeleton {
  background: linear-gradient(90deg, rgba(15, 23, 42, 0.05) 0%, rgba(15, 23, 42, 0.1) 50%, rgba(15, 23, 42, 0.05) 100%);
  background-size: 200% 100%;
  animation: skeleton-shimmer 1.5s ease-in-out infinite;
  border-radius: 8px;
}

.skeleton-avatar {
  width: 72px;
  height: 72px;
  border-radius: 50%;
}

.skeleton-text {
  width: 200px;
  height: 32px;
}

.skeleton-inline {
  display: inline-block;
  width: 60px;
  height: 24px;
}

@keyframes skeleton-shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.welcome-content {
  display: flex;
  align-items: center;
  gap: 1.25rem;
}

.welcome-title {
  font-size: 2rem;
  font-weight: 800;
  color: var(--text-primary);
  letter-spacing: -0.02em;
}

.welcome-subtitle {
  font-size: 1rem;
  color: var(--text-secondary);
}

.welcome-text h1 {
  font-size: 2rem;
  font-weight: 800;
  color: var(--text-primary);
  letter-spacing: -0.02em;
  margin-bottom: 0.5rem;
}

.welcome-header-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

/* Profile Picture */
.profile-picture-wrapper {
  position: relative;
  width: 72px;
  height: 72px;
  border-radius: 50%;
  cursor: pointer;
  flex-shrink: 0;
  transition: transform 0.2s ease;
}

.profile-picture-wrapper:hover {
  transform: scale(1.05);
}

.profile-picture {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
  border: 3px solid white;
  box-shadow: var(--shadow-md);
}

.profile-picture-placeholder {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
  font-weight: 700;
  color: white;
  border: 3px solid white;
  box-shadow: var(--shadow-md);
}

.profile-picture-overlay {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.profile-picture-wrapper:hover .profile-picture-overlay {
  opacity: 1;
}

.file-input {
  display: none;
}

/* Account Badge */
.account-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.375rem 0.875rem;
  border-radius: 100px;
  font-size: 0.8rem;
  font-weight: 500;
}

.account-badge.employer {
  background: rgba(16, 185, 129, 0.1);
  color: #059669;
}

.account-badge.employee {
  background: rgba(59, 130, 246, 0.1);
  color: #3b82f6;
}

.badge-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}

/* QR Compact */
.qr-compact {
  position: relative;
  width: 44px;
  height: 44px;
  background: white;
  border-radius: 10px;
  padding: 4px;
  cursor: pointer;
  box-shadow: var(--shadow-sm);
  border: 1px solid var(--border);
  transition: all 0.2s ease;
  overflow: hidden;
}

.qr-compact:hover {
  transform: scale(1.1);
  box-shadow: var(--shadow-md);
  border-color: var(--border-hover);
}

.qr-mini {
  display: block;
  width: 100%;
  height: 100%;
  border-radius: 4px;
}

.qr-mini-loading {
  width: 100%;
  height: 100%;
  background: var(--border);
  border-radius: 4px;
  animation: pulse 1.5s ease-in-out infinite;
}

.qr-shine {
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, transparent 40%, rgba(255, 255, 255, 0.4) 50%, transparent 60%);
  opacity: 0;
  transition: opacity 0.2s;
}

.qr-compact:hover .qr-shine {
  opacity: 1;
}

/* Modal */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.6);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: fadeIn 0.2s ease;
}

.modal-content {
  position: relative;
  animation: slideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.modal-close {
  position: absolute;
  top: -12px;
  right: -12px;
  width: 32px;
  height: 32px;
  background: var(--primary);
  color: white;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: var(--shadow-md);
  z-index: 1;
  transition: all 0.2s ease;
}

.modal-close:hover {
  transform: scale(1.1);
  background: #1e293b;
}

/* Balance Cards */
.balance-cards {
  display: grid;
  grid-template-columns: 260px 1fr 280px;
  gap: 1rem;
  margin-bottom: 2rem;
}

@media (max-width: 1024px) {
  .balance-cards {
    grid-template-columns: 1fr 1fr;
  }
  .balance-cards > *:nth-child(3) {
    grid-column: span 2;
  }
}

@media (max-width: 640px) {
  .balance-cards {
    grid-template-columns: 1fr;
  }
  .balance-cards > *:nth-child(3) {
    grid-column: span 1;
  }
}

.balance-card {
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(20px);
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
  padding: 1.25rem;
  transition: all 0.3s ease;
}

.balance-card:hover {
  border-color: var(--border-hover);
  box-shadow: var(--shadow-glow);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.card-label {
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--text-secondary);
}

.card-icon {
  color: var(--text-muted);
}

.balance-rows {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

.balance-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.token-icon {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
  font-weight: 700;
  color: white;
  flex-shrink: 0;
}

.token-icon.sol {
  background: linear-gradient(135deg, #9945ff 0%, #14f195 100%);
}

.token-icon.usdc {
  background: linear-gradient(135deg, #2775ca 0%, #3b93dc 100%);
}

.balance-info {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
}

.balance-amount {
  font-size: 1.375rem;
  font-weight: 700;
  color: var(--text-primary);
}

.token-label {
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--text-secondary);
}

.card-footer {
  padding-top: 0.5rem;
  border-top: 1px solid var(--border);
}

.footer-label {
  font-size: 0.7rem;
  color: var(--text-muted);
}

/* Invoices Section */
.invoices-section {
  margin-top: 2rem;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.25rem;
  flex-wrap: wrap;
  gap: 1rem;
}

.section-header-left {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.section-title {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: -0.01em;
}

.btn-create-invoice {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: linear-gradient(135deg, var(--secondary) 0%, #059669 100%);
  color: white;
  border: none;
  border-radius: var(--radius-md);
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  font-family: inherit;
}

.btn-create-invoice:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
}

.btn-create-invoice:active {
  transform: translateY(0);
}

.invoice-tabs {
  display: flex;
  gap: 0.375rem;
  background: rgba(15, 23, 42, 0.03);
  padding: 0.25rem;
  border-radius: var(--radius-md);
}

.invoice-tab {
  padding: 0.5rem 1rem;
  background: transparent;
  border: none;
  border-radius: var(--radius-sm);
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
  font-family: inherit;
}

.invoice-tab.active {
  background: white;
  color: var(--text-primary);
  box-shadow: var(--shadow-sm);
}

.invoice-tab:hover:not(.active) {
  color: var(--text-primary);
}

.invoices-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1rem;
}

.empty-state {
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(20px);
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
  padding: 4rem 2rem;
  text-align: center;
}

.empty-icon {
  color: var(--text-muted);
  margin-bottom: 1rem;
  opacity: 0.5;
}

.empty-state p {
  color: var(--text-muted);
  font-size: 0.9rem;
  margin-bottom: 1rem;
}

.btn-create-invoice-empty {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 1.25rem;
  background: var(--primary);
  color: white;
  border: none;
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  font-family: inherit;
}

.btn-create-invoice-empty:hover {
  background: #1e293b;
  transform: translateY(-1px);
}
</style>

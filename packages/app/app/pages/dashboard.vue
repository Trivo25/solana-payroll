<template>
  <div class="dashboard">
    <!-- Background -->
    <div class="background">
      <div class="gradient-orb orb-1"></div>
      <div class="grid-pattern"></div>
    </div>

    <!-- Content -->
    <main class="content">
      <div class="container">
        <header class="header">
          <div class="logo">
            <span class="logo-text">Veil</span>
          </div>
          <div class="wallet-info">
            <ClientOnly>
              <template v-if="connected">
                <span class="wallet-address mono">{{
                  shortenAddress(publicKey?.toBase58() || '')
                }}</span>
                <button class="btn btn-disconnect" @click="disconnect">
                  Disconnect
                </button>
              </template>
              <template v-else>
                <NuxtLink to="/connect" class="btn btn-connect">
                  Connect Wallet
                </NuxtLink>
              </template>
            </ClientOnly>
          </div>
        </header>

        <div class="welcome-section">
          <ClientOnly>
            <template v-if="accountLoading">
              <h1>Loading...</h1>
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
                    <span v-if="uploadingPicture" class="upload-spinner"
                      >...</span
                    >
                    <span v-else class="upload-icon">&#x1F4F7;</span>
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
                  <h1>Welcome, {{ account.name }}</h1>
                  <p class="subtitle">
                    <span class="account-badge" :class="account.account_type">
                      {{
                        account.account_type === 'employer'
                          ? 'Employer / Business'
                          : 'Employee / Freelancer'
                      }}
                    </span>
                  </p>
                </div>
              </div>
            </template>
            <template v-else>
              <h1>Welcome to Veil</h1>
              <p class="subtitle">Your private payment dashboard</p>
            </template>
          </ClientOnly>
        </div>

        <!-- balance cards -->
        <ClientOnly>
          <div v-if="connected" class="balance-cards">
            <!-- regular SOL balance -->
            <div class="balance-card">
              <div class="balance-header">
                <div class="balance-label">SOL Balance</div>
                <span class="balance-icon">&#x1F4B0;</span>
              </div>
              <div class="balance-value">
                <span v-if="balanceLoading" class="loading-text"
                  >Loading...</span
                >
                <span v-else class="mono"
                  >{{ formatBalance(balance) }} SOL</span
                >
              </div>
              <div class="balance-footer">Native token</div>
            </div>

            <!-- confidential balance component -->
            <ConfidentialBalance :wallet="walletAdapter" />
          </div>
        </ClientOnly>

        <!-- invoices section -->
        <ClientOnly>
          <div v-if="connected" class="invoices-section">
            <div class="section-header">
              <h2 class="section-title">Invoices</h2>
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

            <div v-else class="no-invoices">
              <span class="no-invoices-icon">&#x1F4C4;</span>
              <p>No invoices found</p>
            </div>
          </div>
        </ClientOnly>

        <!-- qr connect section -->
        <ClientOnly>
          <div v-if="connected" class="qr-section">
            <h2 class="section-title">Connect with Others</h2>
            <QRConnect
              :wallet-address="publicKey?.toBase58() || ''"
              @connect="handleQRConnect"
            />
          </div>
        </ClientOnly>

        <!-- invoice modal -->
        <InvoiceModal
          v-if="selectedInvoice"
          :invoice="selectedInvoice"
          :wallet-address="publicKey?.toBase58() || ''"
          :is-open="showInvoiceModal"
          @close="closeInvoice"
          @paid="handleInvoicePaid"
        />
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useSupabase, type UserAccount } from '~/composables/useSupabase';
import { useInvoices, type Invoice } from '~/composables/useInvoices';

const connected = ref(false);
const publicKey = ref<any>(null);
const walletAdapter = ref<any>(null);
const balance = ref<number | null>(null);
const balanceLoading = ref(false);
const confidentialBalance = ref<number | null>(null);
const confidentialLoading = ref(false);
const account = ref<UserAccount | null>(null);
const accountLoading = ref(true);
const uploadingPicture = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);
let walletDisconnect: () => Promise<void> = async () => {};
const RPC_URL = 'https://zk-edge.surfnet.dev:8899';

const { getAccount, uploadProfilePicture } = useSupabase();
const {
  invoices,
  getInvoicesForWallet,
  getPayableInvoices,
  getReceivableInvoices,
  payInvoice,
} = useInvoices();

// invoice state
const invoiceTab = ref<'all' | 'payable' | 'receivable'>('all');
const selectedInvoice = ref<Invoice | null>(null);
const showInvoiceModal = ref(false);

// filtered invoices based on selected tab
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

// open invoice detail modal
function openInvoice(invoice: Invoice) {
  selectedInvoice.value = invoice;
  showInvoiceModal.value = true;
}

// close invoice modal
function closeInvoice() {
  showInvoiceModal.value = false;
  selectedInvoice.value = null;
}

// handle invoice paid event from modal
async function handleInvoicePaid(invoiceId: string) {
  const success = await payInvoice(invoiceId);
  if (success) {
    // refresh the selected invoice to show updated status
    const updated = invoices.value.find((inv) => inv.id === invoiceId);
    if (updated) {
      selectedInvoice.value = { ...updated };
    }
  }
}

// get initials from name for placeholder
function getInitials(name: string): string {
  return name
    .split(' ')
    .map((word) => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

// trigger file input click
function triggerFileInput() {
  fileInput.value?.click();
}

// handle file selection
async function handleFileChange(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file || !publicKey.value) return;

  // validate file type
  if (!file.type.startsWith('image/')) {
    alert('Please select an image file');
    return;
  }

  // validate file size (max 2mb)
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
    // reset input
    input.value = '';
  }
}

// fetch sol balance for a public key
async function fetchBalance(pubkey: any) {
  if (!pubkey) return;
  balanceLoading.value = true;
  try {
    const { Connection, clusterApiUrl, LAMPORTS_PER_SOL } =
      await import('@solana/web3.js');
    const connection = new Connection(RPC_URL);
    const lamports = await connection.getBalance(pubkey);
    balance.value = lamports / LAMPORTS_PER_SOL;
  } catch (e) {
    console.error('failed to fetch balance:', e);
    balance.value = null;
  } finally {
    balanceLoading.value = false;
  }
}

function formatBalance(bal: number | null): string {
  if (bal === null) return '—';
  return bal.toFixed(4);
}

// fetch confidential token balance
// note: this is a placeholder - full implementation requires token-2022 confidential transfer extension
async function fetchConfidentialBalance(pubkey: any) {
  if (!pubkey) return;
  confidentialLoading.value = true;
  try {
    // todo: implement actual confidential balance fetching
    // this requires:
    // 1. finding the user's confidential token account (token-2022 with ct extension)
    // 2. fetching the encrypted balance
    // 3. decrypting with user's elgamal keypair

    // for now, set to null to indicate not configured
    confidentialBalance.value = null;
  } catch (e) {
    console.error('failed to fetch confidential balance:', e);
    confidentialBalance.value = null;
  } finally {
    confidentialLoading.value = false;
  }
}

// placeholder for setting up confidential account
function setupConfidential() {
  // todo: implement confidential account setup flow
  // this would:
  // 1. create/derive elgamal keypair
  // 2. create token-2022 account with confidential transfer extension
  // 3. configure the account for confidential transfers
  alert('Confidential account setup coming soon!');
}

// handle qr code scan result
async function handleQRConnect(scannedAddress: string) {
  // todo: implement connection logic
  // this could:
  // 1. look up the scanned address in our database
  // 2. create a connection/contact record
  // 3. navigate to send payment page with recipient pre-filled
  console.log('connecting to:', scannedAddress);
  alert(
    `Ready to connect with: ${scannedAddress}\n\nConnection feature coming soon!`,
  );
}

// check if user has an account, redirect to onboarding if not
async function checkAccount(walletAddress: string) {
  accountLoading.value = true;
  try {
    const existingAccount = await getAccount(walletAddress);
    if (!existingAccount) {
      // no account found, redirect to onboarding
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
    // dynamic import to avoid ssr issues
    const { initWallet, useWallet } = await import('solana-wallets-vue');

    // check if wallet is already initialized
    let wallet;
    let needsInit = false;
    try {
      wallet = useWallet();
    } catch {
      needsInit = true;
    }

    // only import adapters and initialize if needed
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

    // fetch balances and check account if already connected
    if (wallet.publicKey.value) {
      const address = wallet.publicKey.value.toBase58();
      fetchBalance(wallet.publicKey.value);
      fetchConfidentialBalance(wallet.publicKey.value);
      checkAccount(address);
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
          fetchConfidentialBalance(val);
          checkAccount(address);
        }
      },
    );

    walletDisconnect = wallet.disconnect;

    // redirect to connect if not connected (give time for auto-connect)
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

function disconnect() {
  walletDisconnect();
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

/* Background */
.background {
  position: fixed;
  inset: 0;
  z-index: 0;
  overflow: hidden;
}

.gradient-orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(100px);
  opacity: 0.4;
}

.orb-1 {
  width: 600px;
  height: 600px;
  background: linear-gradient(
    135deg,
    var(--secondary) 0%,
    rgba(16, 185, 129, 0.2) 100%
  );
  top: -200px;
  right: -200px;
}

.grid-pattern {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(15, 23, 42, 0.02) 1px, transparent 1px),
    linear-gradient(90deg, rgba(15, 23, 42, 0.02) 1px, transparent 1px);
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
  padding: 2rem;
}

/* Header */
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 3rem;
}

.logo-text {
  font-size: 1.5rem;
  font-weight: 700;
  background: linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.wallet-info {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.wallet-address {
  padding: 0.5rem 1rem;
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(15, 23, 42, 0.1);
  border-radius: 8px;
  font-size: 0.875rem;
  color: var(--text-secondary);
}

.btn {
  padding: 0.75rem 1.5rem;
  font-size: 0.875rem;
  font-weight: 600;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  border: none;
  font-family: inherit;
  text-decoration: none;
}

.btn-disconnect {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

.btn-disconnect:hover {
  background: rgba(239, 68, 68, 0.2);
}

.btn-connect {
  background: var(--primary);
  color: white;
}

/* Welcome */
.welcome-section {
  margin-bottom: 3rem;
}

.welcome-content {
  display: flex;
  align-items: center;
  gap: 1.5rem;
}

.welcome-text h1 {
  font-size: 2.5rem;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 0.5rem;
}

.welcome-section h1 {
  font-size: 2.5rem;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 0.5rem;
}

.subtitle {
  font-size: 1.125rem;
  color: var(--text-secondary);
}

/* profile picture */
.profile-picture-wrapper {
  position: relative;
  width: 80px;
  height: 80px;
  border-radius: 50%;
  cursor: pointer;
  flex-shrink: 0;
}

.profile-picture {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
  border: 3px solid white;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.profile-picture-placeholder {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  font-weight: 700;
  color: white;
  border: 3px solid white;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
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

.upload-icon {
  font-size: 1.5rem;
}

.upload-spinner {
  font-size: 1.25rem;
  color: white;
  animation: pulse 1s infinite;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

.file-input {
  display: none;
}

.account-badge {
  display: inline-block;
  padding: 0.375rem 0.75rem;
  border-radius: 100px;
  font-size: 0.875rem;
  font-weight: 500;
}

.account-badge.employer {
  background: rgba(16, 185, 129, 0.1);
  color: var(--secondary);
}

.account-badge.employee {
  background: rgba(59, 130, 246, 0.1);
  color: #3b82f6;
}

/* balance cards */
.balance-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1.5rem;
  max-width: 800px;
}

.balance-card {
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 20px;
  padding: 1.5rem;
}

.balance-card.confidential {
  background: linear-gradient(
    135deg,
    rgba(255, 255, 255, 0.9) 0%,
    rgba(16, 185, 129, 0.05) 100%
  );
  border-color: rgba(16, 185, 129, 0.2);
}

.balance-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1rem;
}

.balance-label {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-secondary);
}

.balance-icon {
  font-size: 1.5rem;
}

.balance-value {
  font-size: 2rem;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 0.5rem;
}

.balance-footer {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.loading-text {
  color: var(--text-muted);
  font-size: 1.25rem;
  font-weight: 500;
}

.not-setup {
  color: var(--text-muted);
  font-size: 1.25rem;
  font-style: italic;
}

.setup-link {
  background: none;
  border: none;
  padding: 0;
  font-size: 0.75rem;
  color: var(--secondary);
  cursor: pointer;
  text-decoration: underline;
  font-family: inherit;
}

.setup-link:hover {
  color: #059669;
}

/* blur effect for confidential balance - hover to reveal */
.blur-hover {
  filter: blur(6px);
  transition: filter 0.3s ease;
  cursor: pointer;
}

.balance-card:hover .blur-hover {
  filter: blur(0);
}

/* qr section */
.qr-section {
  margin-top: 2rem;
}

.section-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 1rem;
}

/* invoices section */
.invoices-section {
  margin-top: 2rem;
  margin-bottom: 2rem;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
  gap: 1rem;
}

.invoice-tabs {
  display: flex;
  gap: 0.5rem;
}

.invoice-tab {
  padding: 0.5rem 1rem;
  background: rgba(15, 23, 42, 0.05);
  border: none;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
  font-family: inherit;
}

.invoice-tab.active {
  background: var(--primary);
  color: white;
}

.invoice-tab:hover:not(.active) {
  background: rgba(15, 23, 42, 0.1);
}

.invoices-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1rem;
}

.no-invoices {
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 16px;
  padding: 3rem 2rem;
  text-align: center;
}

.no-invoices-icon {
  font-size: 3rem;
  display: block;
  margin-bottom: 1rem;
  opacity: 0.5;
}

.no-invoices p {
  color: var(--text-muted);
  font-size: 1rem;
}
</style>

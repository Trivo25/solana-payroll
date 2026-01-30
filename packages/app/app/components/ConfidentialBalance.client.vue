<template>
  <div class="confidential-balance">
    <div class="balance-header">
      <div class="balance-label">Confidential Balance</div>
      <span class="balance-icon">&#x1F6E1;</span>
    </div>

    <!-- not setup state -->
    <div v-if="!isSetup" class="setup-section">
      <p class="setup-text">
        Set up confidential transfers to hide your balance and transaction
        amounts.
      </p>
      <button class="btn btn-primary" :disabled="loading" @click="handleSetup">
        {{ loading ? 'Setting up...' : 'Enable Confidential Transfers' }}
      </button>
    </div>

    <!-- setup complete -->
    <div v-else class="balance-section">
      <!-- token groups with optional overlay -->
      <div class="token-groups-container">
        <!-- unlock overlay when elgamal key not derived -->
        <div v-if="!elGamalPublicKey" class="unlock-overlay">
          <div class="unlock-content">
            <div class="unlock-icon">&#x1F512;</div>
            <p class="unlock-text">Private balances are encrypted</p>
            <button
              class="btn btn-unlock"
              :disabled="derivingKey"
              @click="handleDeriveKey"
            >
              {{ derivingKey ? 'Unlocking...' : 'Unlock Private Balance' }}
            </button>
          </div>
        </div>

        <div class="token-groups">
          <!-- cUSDC balances -->
          <div class="token-group">
            <div class="token-header">
              <span class="token-icon usdc">$</span>
              <span class="token-name">cUSDC</span>
            </div>
            <div class="token-balances">
              <div class="balance-row">
                <span class="balance-type">Public</span>
                <span class="balance-value mono">{{
                  formatBalance(usdcPublicBalance, 2)
                }}</span>
              </div>
              <div class="balance-row pending">
                <span class="balance-type">
                  Pending
                  <span
                    class="info-icon"
                    data-tooltip="Pending balance needs to be applied before it can be used"
                    >!</span
                  >
                </span>
                <template v-if="elGamalPublicKey">
                  <span class="balance-value mono">{{
                    formatBalance(usdcPendingBalance, 2)
                  }}</span>
                  <button
                    v-if="usdcPendingBalance > 0"
                    class="btn btn-tiny btn-apply"
                    :disabled="loading"
                    @click="handleApplyPending('USDC')"
                  >
                    Apply
                  </button>
                </template>
                <span v-else class="balance-value locked">
                  <span class="lock-icon">&#x1F512;</span>
                </span>
              </div>
              <div class="balance-row confidential">
                <span class="balance-type">
                  Private
                  <span
                    class="info-icon"
                    data-tooltip="Private balances are only visible to you by default"
                    >!</span
                  >
                </span>
                <template v-if="elGamalPublicKey">
                  <span class="balance-value mono blur-hover">{{
                    formatBalance(usdcConfidentialBalance, 2)
                  }}</span>
                </template>
                <span v-else class="balance-value locked">
                  <span class="lock-icon">&#x1F512;</span>
                </span>
              </div>
            </div>
            <div class="token-actions">
              <button
                class="btn btn-small"
                :disabled="
                  loading || usdcPublicBalance <= 0 || !isUsdcAccountConfigured
                "
                :title="
                  !isUsdcAccountConfigured ? 'Configure account first' : ''
                "
                @click="openDepositModal('USDC')"
              >
                Deposit →
              </button>
              <button
                class="btn btn-small btn-secondary"
                :disabled="
                  loading ||
                  usdcConfidentialBalance <= 0 ||
                  !isUsdcAccountConfigured
                "
                :title="
                  !isUsdcAccountConfigured ? 'Configure account first' : ''
                "
                @click="openWithdrawModal('USDC')"
              >
                ← Withdraw
              </button>
              <button
                class="btn btn-small btn-transfer"
                :disabled="
                  loading ||
                  usdcConfidentialBalance <= 0 ||
                  !isUsdcAccountConfigured
                "
                :title="
                  !isUsdcAccountConfigured
                    ? 'Configure account first'
                    : 'Send privately to another wallet'
                "
                @click="openTransferModal"
              >
                Transfer
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- mint test tokens (dev only) -->
      <div v-if="isDev" class="dev-actions">
        <span class="dev-label">Dev Tools</span>
        <div class="dev-buttons">
          <button
            class="btn btn-dev"
            :disabled="loading"
            @click="handleMintTokens('USDC')"
          >
            {{ loading ? 'Minting...' : 'Mint 100 cUSDC' }}
          </button>
        </div>
      </div>
    </div>

    <!-- error message -->
    <div v-if="error" class="error-message">
      {{ error }}
    </div>

    <!-- deposit modal -->
    <div
      v-if="showDepositModal"
      class="modal-overlay"
      @click.self="closeDepositModal"
    >
      <div class="modal">
        <h3>Deposit to c{{ selectedToken }}</h3>
        <p class="modal-desc">
          Move USDC from public to private balance. Once deposited, your balance
          will be encrypted.
        </p>

        <div class="modal-token-info">
          <span class="token-icon usdc">$</span>
          <span class="token-label">cUSDC</span>
          <span class="available-balance mono">
            Available: {{ formatBalance(usdcPublicBalance, 2) }}
          </span>
        </div>

        <div class="input-group">
          <label>Amount</label>
          <input
            v-model.number="depositAmount"
            type="number"
            :max="usdcPublicBalance"
            min="0"
            step="0.01"
            placeholder="0.00"
          />
          <button class="max-btn" @click="depositAmount = usdcPublicBalance">
            MAX
          </button>
        </div>

        <div class="modal-actions">
          <button class="btn btn-secondary" @click="closeDepositModal">
            Cancel
          </button>
          <button
            class="btn btn-primary"
            :disabled="
              loading || depositAmount <= 0 || depositAmount > usdcPublicBalance
            "
            @click="handleDeposit"
          >
            {{ loading ? 'Depositing...' : 'Deposit' }}
          </button>
        </div>
      </div>
    </div>

    <!-- withdraw modal -->
    <div
      v-if="showWithdrawModal"
      class="modal-overlay"
      @click.self="closeWithdrawModal"
    >
      <div class="modal">
        <h3>Withdraw from cUSDC</h3>
        <p class="modal-desc">
          Move USDC from private to public balance. This requires generating a
          ZK proof.
        </p>

        <div class="modal-token-info">
          <span class="token-icon usdc">$</span>
          <span class="token-label">cUSDC</span>
          <span class="available-balance mono">
            Available: {{ formatBalance(usdcConfidentialBalance, 2) }}
          </span>
        </div>

        <div class="input-group">
          <label>Amount</label>
          <input
            v-model.number="withdrawAmount"
            type="number"
            :max="usdcConfidentialBalance"
            min="0"
            step="0.01"
            placeholder="0.00"
          />
          <button
            class="max-btn"
            @click="withdrawAmount = usdcConfidentialBalance"
          >
            MAX
          </button>
        </div>

        <!-- Withdraw progress indicator -->
        <div v-if="withdrawProgress" class="withdraw-progress">
          <div class="progress-header">
            <span class="progress-title">Processing Withdrawal</span>
            <span class="progress-step"
              >Step {{ withdrawProgress.step }}/{{
                withdrawProgress.totalSteps
              }}</span
            >
          </div>
          <div class="progress-bar">
            <div
              class="progress-fill"
              :style="{
                width: `${(withdrawProgress.step / withdrawProgress.totalSteps) * 100}%`,
              }"
            ></div>
          </div>
          <div class="progress-status">{{ withdrawProgress.currentStep }}</div>
        </div>

        <div class="modal-actions">
          <button
            class="btn btn-secondary"
            @click="closeWithdrawModal"
            :disabled="loading"
          >
            Cancel
          </button>
          <button
            class="btn btn-primary"
            :disabled="
              loading ||
              withdrawAmount <= 0 ||
              withdrawAmount > usdcConfidentialBalance
            "
            @click="handleWithdraw"
          >
            {{
              withdrawProgress
                ? withdrawProgress.currentStep
                : loading
                  ? 'Withdrawing...'
                  : 'Withdraw'
            }}
          </button>
        </div>
      </div>
    </div>

    <!-- transfer modal -->
    <div
      v-if="showTransferModal"
      class="modal-overlay"
      @click.self="closeTransferModal"
    >
      <div class="modal">
        <h3>Transfer Privately</h3>
        <p class="modal-desc">
          Send cUSDC privately to another wallet. The amount will be encrypted
          and only visible to sender and recipient.
        </p>

        <div class="modal-token-info">
          <span class="token-icon usdc">$</span>
          <span class="token-label">cUSDC</span>
          <span class="available-balance mono">
            Available: {{ formatBalance(usdcConfidentialBalance, 2) }}
          </span>
        </div>

        <div class="input-group">
          <label>Recipient Address</label>
          <input
            v-model="transferRecipient"
            type="text"
            placeholder="Enter Solana wallet address"
            class="recipient-input"
          />
        </div>

        <div class="input-group">
          <label>Amount</label>
          <input
            v-model.number="transferAmount"
            type="number"
            :max="usdcConfidentialBalance"
            min="0"
            step="0.01"
            placeholder="0.00"
          />
          <button
            class="max-btn"
            @click="transferAmount = usdcConfidentialBalance"
          >
            MAX
          </button>
        </div>

        <div class="modal-actions">
          <button
            class="btn btn-secondary"
            @click="closeTransferModal"
            :disabled="loading"
          >
            Cancel
          </button>
          <button
            class="btn btn-primary btn-transfer-confirm"
            :disabled="
              loading ||
              transferAmount <= 0 ||
              transferAmount > usdcConfidentialBalance ||
              !transferRecipient
            "
            @click="handleTransfer"
          >
            {{ loading ? 'Transferring...' : 'Transfer Privately' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue';
import { useConfidentialTransfer } from '~/composables/useConfidentialTransfer';

const props = defineProps<{
  wallet: any;
}>();

const {
  loading,
  error,
  testMint,
  elGamalPublicKey,
  withdrawProgress,
  transactions,
  deriveElGamalKeypair,
  configureConfidentialTransferAccount,
  setupTestMint,
  setupTokenAccount,
  mintTestTokens,
  getPublicBalance,
  getPendingBalance,
  getConfidentialBalance,
  depositToConfidential,
  applyPendingBalance,
  withdrawFromConfidential,
  transferConfidential,
  isAccountConfigured,
  fetchTransactionHistory,
} = useConfidentialTransfer();

// Token type
type TokenType = 'USDC';

const isSetup = ref(false);

// USDC balances
const usdcPublicBalance = ref(0);
const usdcPendingBalance = ref(0);
const usdcConfidentialBalance = ref(0);
const isUsdcAccountConfigured = ref(false);

// Modal state
const showDepositModal = ref(false);
const showWithdrawModal = ref(false);
const showTransferModal = ref(false);
const selectedToken = ref<TokenType>('USDC');
const depositAmount = ref(0);
const withdrawAmount = ref(0);
const transferAmount = ref(0);
const transferRecipient = ref('');

const isDev = ref(true); // always true for local dev
const derivingKey = ref(false);
const configuringAccount = ref(false);

// format balance with configurable decimals
function formatBalance(balance: number, decimals: number = 2): string {
  return balance.toFixed(decimals);
}

// open deposit modal for specific token
function openDepositModal(token: TokenType) {
  selectedToken.value = token;
  depositAmount.value = 0;
  showDepositModal.value = true;
}

// open withdraw modal for specific token
function openWithdrawModal(token: TokenType) {
  selectedToken.value = token;
  withdrawAmount.value = 0;
  showWithdrawModal.value = true;
}

// close modals
function closeDepositModal() {
  showDepositModal.value = false;
  depositAmount.value = 0;
}

function closeWithdrawModal() {
  showWithdrawModal.value = false;
  withdrawAmount.value = 0;
}

// open transfer modal
function openTransferModal() {
  transferAmount.value = 0;
  transferRecipient.value = '';
  showTransferModal.value = true;
}

// close transfer modal
function closeTransferModal() {
  showTransferModal.value = false;
  transferAmount.value = 0;
  transferRecipient.value = '';
}

// check if already setup
async function checkSetup() {
  if (!props.wallet?.publicKey) return;

  // Check if mint exists (real implementation uses 'veil-ct-mint')
  const storedMint = localStorage.getItem('veil-ct-mint');

  if (storedMint) {
    // Load the mint into the composable state
    await setupTestMint(props.wallet);
    isSetup.value = true;
    await refreshBalances();
    await checkAccountConfiguredStatus();
    // Fetch transaction history from blockchain
    await fetchTransactionHistory(props.wallet);
  }
}

// check if the account is configured for confidential transfers
async function checkAccountConfiguredStatus() {
  if (!props.wallet?.publicKey) return;

  const configured = await isAccountConfigured(props.wallet);
  isUsdcAccountConfigured.value = configured;

  if (configured) {
    console.log('[CT] Account is configured for confidential transfers');
  }
}

// refresh USDC balances
async function refreshBalances() {
  if (!props.wallet?.publicKey) return;

  // Fetch public balance (always available)
  usdcPublicBalance.value = await getPublicBalance(props.wallet, 'USDC');

  // Only fetch pending/confidential balances if ElGamal key is derived
  // (these require decryption)
  if (elGamalPublicKey.value) {
    usdcPendingBalance.value = await getPendingBalance(props.wallet, 'USDC');
    usdcConfidentialBalance.value = await getConfidentialBalance(
      props.wallet,
      'USDC',
    );
  }
}

// setup confidential transfers
async function handleSetup() {
  if (!props.wallet?.publicKey) return;

  try {
    // Setup USDC mint with CT extension
    await setupTestMint(props.wallet);
    await setupTokenAccount(props.wallet);
    isSetup.value = true;
    await refreshBalances();
  } catch (e) {
    console.error('setup failed:', e);
  }
}

// mint test tokens for specific token type
async function handleMintTokens(token: TokenType) {
  if (!props.wallet?.publicKey) return;

  try {
    await mintTestTokens(props.wallet, 100, token);
    await refreshBalances();
    // Also check account configuration status
    await checkAccountConfiguredStatus();
  } catch (e) {
    console.error(`${token} mint failed:`, e);
  }
}

// derive elgamal keypair and configure account
async function handleDeriveKey() {
  if (!props.wallet?.publicKey) return;

  derivingKey.value = true;
  try {
    await deriveElGamalKeypair(props.wallet);

    // Check if account needs to be configured
    const configured = await isAccountConfigured(props.wallet);
    if (!configured) {
      // Automatically configure the account for confidential transfers
      console.log('[CT] Account not configured, configuring now...');
      await configureConfidentialTransferAccount(props.wallet);
      isUsdcAccountConfigured.value = true;
    } else {
      isUsdcAccountConfigured.value = true;
    }

    // Refresh balances now that we can decrypt them
    await refreshBalances();
  } catch (e) {
    console.error('key derivation failed:', e);
  } finally {
    derivingKey.value = false;
  }
}

// configure account for confidential transfers (stores ElGamal key on-chain)
async function handleConfigureAccount() {
  if (!props.wallet?.publicKey) return;

  configuringAccount.value = true;
  try {
    await configureConfidentialTransferAccount(props.wallet);
    isUsdcAccountConfigured.value = true;
  } catch (e) {
    console.error('configure account failed:', e);
  } finally {
    configuringAccount.value = false;
  }
}

// deposit to confidential balance for selected token
async function handleDeposit() {
  if (!props.wallet?.publicKey || depositAmount.value <= 0) return;

  try {
    console.log(
      `Depositing ${depositAmount.value} ${selectedToken.value} to pending balance...`,
    );

    // Deposit moves public → pending (user must apply separately to move pending → available)
    const txid = await depositToConfidential(
      props.wallet,
      depositAmount.value,
      selectedToken.value,
    );
    if (txid) {
      console.log('deposit to pending successful:', txid);
      closeDepositModal();
      await refreshBalances();
    }
  } catch (e) {
    console.error(`${selectedToken.value} deposit failed:`, e);
  }
}

// apply pending balance for a specific token
async function handleApplyPending(token: TokenType) {
  if (!props.wallet?.publicKey) return;

  try {
    console.log(`Applying pending ${token} balance...`);
    const txid = await applyPendingBalance(props.wallet, token);
    if (txid) {
      console.log('pending balance applied:', txid);
      await refreshBalances();
    }
  } catch (e) {
    console.error(`${token} apply pending failed:`, e);
  }
}

// withdraw from confidential balance for selected token
async function handleWithdraw() {
  if (!props.wallet?.publicKey || withdrawAmount.value <= 0) return;

  try {
    console.log(
      `Withdrawing ${withdrawAmount.value} ${selectedToken.value} from confidential balance...`,
    );

    const txid = await withdrawFromConfidential(
      props.wallet,
      withdrawAmount.value,
      selectedToken.value,
    );
    if (txid) {
      closeWithdrawModal();
      await refreshBalances();
    }
  } catch (e) {
    console.error(`${selectedToken.value} withdraw failed:`, e);
  }
}

// transfer confidential balance to another wallet
async function handleTransfer() {
  if (
    !props.wallet?.publicKey ||
    transferAmount.value <= 0 ||
    !transferRecipient.value
  )
    return;

  try {
    console.log(
      `Transferring ${transferAmount.value} cUSDC privately to ${transferRecipient.value}...`,
    );

    const txid = await transferConfidential(
      props.wallet,
      transferRecipient.value,
      transferAmount.value,
    );
    if (txid) {
      console.log('confidential transfer successful:', txid);
      closeTransferModal();
      await refreshBalances();
    }
  } catch (e) {
    console.error('confidential transfer failed:', e);
  }
}

// Background polling interval (5 seconds)
const POLL_INTERVAL = 10000;
let pollIntervalId: ReturnType<typeof setInterval> | null = null;

// Background refresh function (silent, no loading state)
async function backgroundRefresh() {
  if (!props.wallet?.publicKey || !isSetup.value || loading.value) return;

  try {
    // Refresh balances silently
    usdcPublicBalance.value = await getPublicBalance(props.wallet, 'USDC');

    if (elGamalPublicKey.value) {
      usdcPendingBalance.value = await getPendingBalance(props.wallet, 'USDC');
      usdcConfidentialBalance.value = await getConfidentialBalance(
        props.wallet,
        'USDC',
      );
    }

    // Fetch latest transactions
    await fetchTransactionHistory(props.wallet);
  } catch (e) {
    // Silent fail for background polling
    console.debug('[CT] Background refresh error:', e);
  }
}

// Start background polling
function startPolling() {
  if (pollIntervalId) return;
  pollIntervalId = setInterval(backgroundRefresh, POLL_INTERVAL);
}

// Stop background polling
function stopPolling() {
  if (pollIntervalId) {
    clearInterval(pollIntervalId);
    pollIntervalId = null;
  }
}

// watch for wallet changes
watch(
  () => props.wallet?.publicKey,
  (newVal) => {
    checkSetup();
    if (newVal) {
      startPolling();
    } else {
      stopPolling();
    }
  },
);

onMounted(() => {
  checkSetup();
  if (props.wallet?.publicKey) {
    startPolling();
  }
});

onUnmounted(() => {
  stopPolling();
});
</script>

<style scoped>
.confidential-balance {
  background: linear-gradient(
    135deg,
    rgba(255, 255, 255, 0.9) 0%,
    rgba(16, 185, 129, 0.05) 100%
  );
  backdrop-filter: blur(20px);
  border: 1px solid rgba(16, 185, 129, 0.2);
  border-radius: 20px;
  padding: 1.25rem;
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

/* setup section */
.setup-section {
  text-align: center;
  padding: 1rem 0;
}

.setup-text {
  font-size: 0.875rem;
  color: var(--text-secondary);
  margin-bottom: 1rem;
  line-height: 1.5;
}

/* balance section */
.balance-section {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.token-groups {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

/* token group */
.token-group {
  background: rgba(255, 255, 255, 0.5);
  border-radius: 10px;
  padding: 0.625rem;
  min-width: 0; /* prevent overflow */
}

.token-header {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  margin-bottom: 0.375rem;
  padding-bottom: 0.375rem;
  border-bottom: 1px solid rgba(15, 23, 42, 0.08);
}

.token-icon {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  font-weight: 700;
  color: white;
  flex-shrink: 0;
}

.token-icon.usdc {
  background: linear-gradient(135deg, #2775ca 0%, #3b93dc 100%);
}

.token-name {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-primary);
}

.token-balances {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  margin-bottom: 0.375rem;
}

.token-actions {
  display: flex;
  gap: 0.375rem;
}

.balance-row {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.5rem;
  background: rgba(255, 255, 255, 0.6);
  border-radius: 6px;
}

.balance-row.pending {
  background: rgba(245, 158, 11, 0.1);
}

.balance-row.confidential {
  background: rgba(16, 185, 129, 0.1);
}

.btn-tiny {
  padding: 0.125rem 0.3rem;
  font-size: 0.5rem;
  border-radius: 3px;
  flex-shrink: 0;
  line-height: 1;
}

.btn-apply {
  background: rgba(245, 158, 11, 0.15);
  color: #d97706;
  border: none;
  font-weight: 500;
}

.btn-apply:hover:not(:disabled) {
  background: rgba(245, 158, 11, 0.3);
}

.balance-type {
  font-size: 0.5rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted);
  width: 50px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.info-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: rgba(99, 102, 241, 0.2);
  color: #6366f1;
  font-size: 0.5rem;
  font-weight: 700;
  font-style: normal;
  cursor: help;
  position: relative;
}

.info-icon::after {
  content: attr(data-tooltip);
  position: absolute;
  bottom: calc(100% + 6px);
  left: 50%;
  transform: translateX(-50%);
  padding: 0.5rem 0.75rem;
  background: var(--text-primary, #0f172a);
  color: white;
  font-size: 0.625rem;
  font-weight: 500;
  text-transform: none;
  letter-spacing: normal;
  white-space: nowrap;
  border-radius: 6px;
  opacity: 0;
  visibility: hidden;
  transition:
    opacity 0.2s,
    visibility 0.2s;
  z-index: 100;
  pointer-events: none;
}

.info-icon::before {
  content: '';
  position: absolute;
  bottom: calc(100% + 2px);
  left: 50%;
  transform: translateX(-50%);
  border: 4px solid transparent;
  border-top-color: var(--text-primary, #0f172a);
  opacity: 0;
  visibility: hidden;
  transition:
    opacity 0.2s,
    visibility 0.2s;
  z-index: 100;
}

.info-icon:hover::after,
.info-icon:hover::before {
  opacity: 1;
  visibility: visible;
}

.balance-value {
  font-size: 0.875rem;
  font-weight: 700;
  color: var(--text-primary);
  flex: 1;
  text-align: right;
  overflow: hidden;
  text-overflow: ellipsis;
}

.balance-token {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.blur-hover {
  filter: blur(6px);
  transition: filter 0.3s ease;
  cursor: pointer;
}

.confidential-balance:hover .blur-hover {
  filter: blur(0);
}

/* locked balance state */
.balance-value.locked {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  color: var(--text-muted);
}

.lock-icon {
  font-size: 0.875rem;
  opacity: 0.6;
}

/* token groups container with overlay support */
.token-groups-container {
  position: relative;
}

/* unlock overlay */
.unlock-overlay {
  position: absolute;
  inset: 0;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(4px);
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
}

.unlock-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 1rem;
}

.unlock-content .unlock-icon {
  font-size: 2rem;
  margin-bottom: 0.5rem;
}

.unlock-text {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-secondary);
  margin-bottom: 0.75rem;
}

.btn-unlock {
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  color: white;
  padding: 0.625rem 1.25rem;
  font-size: 0.8rem;
  font-weight: 600;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition:
    transform 0.2s,
    box-shadow 0.2s;
}

.btn-unlock:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
}

.btn-unlock:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* actions */
.balance-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.5rem;
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
}

.btn-small {
  padding: 0.375rem 0.5rem;
  font-size: 0.625rem;
  flex: 1;
  white-space: nowrap;
}

.btn-primary {
  background: var(--primary);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #1e293b;
}

.btn-secondary {
  background: rgba(15, 23, 42, 0.1);
  color: var(--text-secondary);
}

.btn-secondary:hover:not(:disabled) {
  background: rgba(15, 23, 42, 0.2);
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* dev actions */
.dev-actions {
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px dashed rgba(15, 23, 42, 0.1);
}

.dev-label {
  display: block;
  font-size: 0.625rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted);
  margin-bottom: 0.5rem;
}

.dev-buttons {
  display: flex;
  gap: 0.5rem;
}

.btn-dev {
  flex: 1;
  background: rgba(245, 158, 11, 0.1);
  color: #f59e0b;
  font-size: 0.75rem;
  padding: 0.5rem;
}

.btn-dev:hover:not(:disabled) {
  background: rgba(245, 158, 11, 0.2);
}

/* error message */
.error-message {
  margin-top: 0.75rem;
  padding: 0.75rem;
  background: rgba(239, 68, 68, 0.1);
  border-radius: 8px;
  font-size: 0.75rem;
  color: #ef4444;
}

/* modal */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  background: white;
  border-radius: 20px;
  padding: 1.5rem;
  max-width: 400px;
  width: 90%;
}

.modal h3 {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 0.5rem;
}

.modal-desc {
  font-size: 0.875rem;
  color: var(--text-secondary);
  margin-bottom: 1rem;
  line-height: 1.5;
}

.modal-token-info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  background: rgba(15, 23, 42, 0.03);
  border-radius: 10px;
  margin-bottom: 1rem;
}

.modal-token-info .token-icon {
  width: 32px;
  height: 32px;
}

.token-label {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
}

.available-balance {
  margin-left: auto;
  font-size: 0.75rem;
  color: var(--text-muted);
}

.input-group {
  margin-bottom: 1.5rem;
  position: relative;
}

.input-group label {
  display: block;
  font-size: 0.75rem;
  color: var(--text-muted);
  margin-bottom: 0.5rem;
}

.input-group input {
  width: 100%;
  padding: 0.75rem;
  padding-right: 60px;
  border: 1px solid rgba(15, 23, 42, 0.1);
  border-radius: 8px;
  font-size: 1rem;
  font-family: var(--font-mono);
}

.input-group input:focus {
  outline: none;
  border-color: var(--primary);
}

.max-btn {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  margin-top: 10px;
  padding: 0.25rem 0.5rem;
  font-size: 0.625rem;
  font-weight: 600;
  background: rgba(15, 23, 42, 0.1);
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.modal-actions {
  display: flex;
  gap: 0.5rem;
}

.modal-actions .btn {
  flex: 1;
}

/* withdraw progress */
.withdraw-progress {
  margin-bottom: 1rem;
  padding: 0.75rem;
  background: rgba(99, 102, 241, 0.1);
  border-radius: 8px;
}

.progress-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.progress-title {
  font-size: 0.75rem;
  font-weight: 600;
  color: #6366f1;
}

.progress-step {
  font-size: 0.625rem;
  color: var(--text-muted);
}

.progress-bar {
  height: 4px;
  background: rgba(99, 102, 241, 0.2);
  border-radius: 2px;
  overflow: hidden;
  margin-bottom: 0.5rem;
}

.progress-fill {
  height: 100%;
  background: #6366f1;
  border-radius: 2px;
  transition: width 0.3s ease;
}

.progress-status {
  font-size: 0.625rem;
  color: var(--text-secondary);
  text-align: center;
}

/* transfer button */
.btn-transfer {
  background: linear-gradient(
    135deg,
    rgba(16, 185, 129, 0.15) 0%,
    rgba(99, 102, 241, 0.15) 100%
  );
  color: #10b981;
  border: none;
}

.btn-transfer:hover:not(:disabled) {
  background: linear-gradient(
    135deg,
    rgba(16, 185, 129, 0.25) 0%,
    rgba(99, 102, 241, 0.25) 100%
  );
}

.btn-transfer-confirm {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
}

.btn-transfer-confirm:hover:not(:disabled) {
  background: linear-gradient(135deg, #059669 0%, #047857 100%);
}

/* recipient input */
.recipient-input {
  padding-right: 0.75rem !important;
  font-size: 0.875rem !important;
}
</style>

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
      <div class="token-groups">
        <!-- cSOL balances -->
        <div class="token-group">
          <div class="token-header">
            <span class="token-icon sol">◎</span>
            <span class="token-name">cSOL</span>
          </div>
          <div class="token-balances">
            <div class="balance-row">
              <span class="balance-type">Public</span>
              <span class="balance-value mono">{{ formatBalance(solPublicBalance, 4) }}</span>
            </div>
            <div class="balance-row confidential">
              <span class="balance-type">
                Private
                <span class="info-icon" data-tooltip="Private balances are only visible to you by default">!</span>
              </span>
              <span class="balance-value mono blur-hover">{{ formatBalance(solConfidentialBalance, 4) }}</span>
            </div>
          </div>
          <div class="token-actions">
            <button
              class="btn btn-small"
              :disabled="loading || solPublicBalance <= 0 || !isSolAccountConfigured"
              :title="!isSolAccountConfigured ? 'Configure account first' : ''"
              @click="openDepositModal('SOL')"
            >
              Deposit →
            </button>
            <button
              class="btn btn-small btn-secondary"
              :disabled="loading || solConfidentialBalance <= 0 || !isSolAccountConfigured"
              :title="!isSolAccountConfigured ? 'Configure account first' : ''"
              @click="openWithdrawModal('SOL')"
            >
              ← Withdraw
            </button>
          </div>
        </div>

        <!-- cUSDC balances -->
        <div class="token-group">
          <div class="token-header">
            <span class="token-icon usdc">$</span>
            <span class="token-name">cUSDC</span>
          </div>
          <div class="token-balances">
            <div class="balance-row">
              <span class="balance-type">Public</span>
              <span class="balance-value mono">{{ formatBalance(usdcPublicBalance, 2) }}</span>
            </div>
            <div class="balance-row confidential">
              <span class="balance-type">
                Private
                <span class="info-icon" data-tooltip="Private balances are only visible to you by default">!</span>
              </span>
              <span class="balance-value mono blur-hover">{{ formatBalance(usdcConfidentialBalance, 2) }}</span>
            </div>
          </div>
          <div class="token-actions">
            <button
              class="btn btn-small"
              :disabled="loading || usdcPublicBalance <= 0 || !isUsdcAccountConfigured"
              :title="!isUsdcAccountConfigured ? 'Configure account first' : ''"
              @click="openDepositModal('USDC')"
            >
              Deposit →
            </button>
            <button
              class="btn btn-small btn-secondary"
              :disabled="loading || usdcConfidentialBalance <= 0 || !isUsdcAccountConfigured"
              :title="!isUsdcAccountConfigured ? 'Configure account first' : ''"
              @click="openWithdrawModal('USDC')"
            >
              ← Withdraw
            </button>
          </div>
        </div>
      </div>

      <!-- setup required notice -->
      <div v-if="elGamalPublicKey && (!isSolAccountConfigured || !isUsdcAccountConfigured)" class="setup-notice">
        ⚠️ Click "Store On-Chain" below to enable deposits & withdrawals
      </div>

      <!-- elgamal public key -->
      <div class="elgamal-section">
        <div class="elgamal-header">
          <span class="elgamal-label">ElGamal Public Key</span>
          <span class="elgamal-icon">&#x1F511;</span>
        </div>
        <div v-if="elGamalPublicKey" class="elgamal-key-section">
          <div class="elgamal-key">
            <span class="key-value mono" :title="elGamalPublicKey">{{
              shortenKey(elGamalPublicKey)
            }}</span>
            <button
              class="copy-btn"
              @click="navigator.clipboard.writeText(elGamalPublicKey)"
            >
              Copy
            </button>
          </div>
          <div v-if="!isSolAccountConfigured || !isUsdcAccountConfigured" class="elgamal-configure">
            <button
              class="btn btn-small btn-primary"
              :disabled="configuringAccount"
              @click="handleConfigureAccount"
            >
              {{ configuringAccount ? 'Configuring...' : 'Store On-Chain' }}
            </button>
          </div>
          <div v-else class="elgamal-configured">
            <span class="configured-badge">✓ Stored On-Chain</span>
          </div>
        </div>
        <div v-else class="elgamal-derive">
          <p class="derive-text">
            Derive your encryption key to enable private transfers
          </p>
          <button
            class="btn btn-small btn-outline"
            :disabled="derivingKey"
            @click="handleDeriveKey"
          >
            {{ derivingKey ? 'Signing...' : 'Derive Key' }}
          </button>
        </div>
      </div>

      <!-- mint test tokens (dev only) -->
      <div v-if="isDev" class="dev-actions">
        <span class="dev-label">Dev Tools</span>
        <div class="dev-buttons">
          <button
            class="btn btn-dev"
            :disabled="loading"
            @click="handleMintTokens('SOL')"
          >
            {{ loading ? 'Minting...' : 'Mint 100 cSOL' }}
          </button>
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
          Move {{ selectedToken }} from public to private balance. Once deposited, your
          balance will be encrypted.
        </p>

        <div class="modal-token-info">
          <span class="token-icon" :class="selectedToken === 'SOL' ? 'sol' : 'usdc'">
            {{ selectedToken === 'SOL' ? '◎' : '$' }}
          </span>
          <span class="token-label">c{{ selectedToken }}</span>
          <span class="available-balance mono">
            Available: {{ formatBalance(selectedToken === 'SOL' ? solPublicBalance : usdcPublicBalance, selectedToken === 'SOL' ? 4 : 2) }}
          </span>
        </div>

        <div class="input-group">
          <label>Amount</label>
          <input
            v-model.number="depositAmount"
            type="number"
            :max="selectedToken === 'SOL' ? solPublicBalance : usdcPublicBalance"
            min="0"
            :step="selectedToken === 'SOL' ? '0.0001' : '0.01'"
            placeholder="0.00"
          />
          <button class="max-btn" @click="depositAmount = selectedToken === 'SOL' ? solPublicBalance : usdcPublicBalance">
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
              loading || depositAmount <= 0 || depositAmount > (selectedToken === 'SOL' ? solPublicBalance : usdcPublicBalance)
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
        <h3>Withdraw from c{{ selectedToken }}</h3>
        <p class="modal-desc">
          Move {{ selectedToken }} from private to public balance. This requires generating a
          ZK proof.
        </p>

        <div class="modal-token-info">
          <span class="token-icon" :class="selectedToken === 'SOL' ? 'sol' : 'usdc'">
            {{ selectedToken === 'SOL' ? '◎' : '$' }}
          </span>
          <span class="token-label">c{{ selectedToken }}</span>
          <span class="available-balance mono">
            Available: {{ formatBalance(selectedToken === 'SOL' ? solConfidentialBalance : usdcConfidentialBalance, selectedToken === 'SOL' ? 4 : 2) }}
          </span>
        </div>

        <div class="input-group">
          <label>Amount</label>
          <input
            v-model.number="withdrawAmount"
            type="number"
            :max="selectedToken === 'SOL' ? solConfidentialBalance : usdcConfidentialBalance"
            min="0"
            :step="selectedToken === 'SOL' ? '0.0001' : '0.01'"
            placeholder="0.00"
          />
          <button class="max-btn" @click="withdrawAmount = selectedToken === 'SOL' ? solConfidentialBalance : usdcConfidentialBalance">
            MAX
          </button>
        </div>

        <div class="modal-actions">
          <button class="btn btn-secondary" @click="closeWithdrawModal">
            Cancel
          </button>
          <button
            class="btn btn-primary"
            :disabled="
              loading ||
              withdrawAmount <= 0 ||
              withdrawAmount > (selectedToken === 'SOL' ? solConfidentialBalance : usdcConfidentialBalance)
            "
            @click="handleWithdraw"
          >
            {{ loading ? 'Withdrawing...' : 'Withdraw' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { useConfidentialTransferKit } from '~/composables/useConfidentialTransferKit';

const props = defineProps<{
  wallet: any;
}>();

const {
  loading,
  error,
  testMint,
  elGamalPublicKey,
  deriveElGamalKeypair,
  configureConfidentialTransferAccount,
  setupTestMint,
  setupTokenAccount,
  mintTestTokens,
  getPublicBalance,
  getConfidentialBalance,
  depositToConfidential,
  applyPendingBalance,
  withdrawFromConfidential,
} = useConfidentialTransferKit();

// Token type
type TokenType = 'SOL' | 'USDC';

// Mint addresses
const SOL_MINT = 'So11111111111111111111111111111111111111112'; // Wrapped SOL
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'; // USDC mainnet

const isSetup = ref(false);

// SOL balances
const solPublicBalance = ref(0);
const solConfidentialBalance = ref(0);
const isSolAccountConfigured = ref(false);

// USDC balances
const usdcPublicBalance = ref(0);
const usdcConfidentialBalance = ref(0);
const isUsdcAccountConfigured = ref(false);

// Modal state
const showDepositModal = ref(false);
const showWithdrawModal = ref(false);
const selectedToken = ref<TokenType>('SOL');
const depositAmount = ref(0);
const withdrawAmount = ref(0);

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

// check if already setup
async function checkSetup() {
  // check both old and new localStorage keys for either mint
  const storedSolMint = localStorage.getItem('veil-sol-mint-kit');
  const storedUsdcMint = localStorage.getItem('veil-usdc-mint-kit');
  const legacyMint = localStorage.getItem('veil-test-mint-kit') || localStorage.getItem('veil-test-mint');

  if ((storedSolMint || storedUsdcMint || legacyMint) && props.wallet?.publicKey) {
    isSetup.value = true;
    await refreshBalances();
    await checkAccountConfigured('SOL');
    await checkAccountConfigured('USDC');
  }
}

// check if the token account has ConfidentialTransferAccount extension configured
async function checkAccountConfigured(token: TokenType) {
  if (!props.wallet?.publicKey) return;

  try {
    const mintKey = token === 'SOL' ? 'veil-sol-mint-kit' : 'veil-usdc-mint-kit';
    const storedMint = localStorage.getItem(mintKey) || localStorage.getItem('veil-test-mint-kit');
    if (!storedMint) return;

    const { Connection, PublicKey } = await import('@solana/web3.js');
    const splToken = await import('@solana/spl-token');

    const RPC_URL = 'https://zk-edge.surfnet.dev:8899';

    const connection = new Connection(RPC_URL, 'confirmed');
    const mintPubkey = new PublicKey(storedMint);
    const walletPubkey = props.wallet.publicKey;
    const token2022ProgramId = new PublicKey(
      'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb',
    );

    const ata = await splToken.getAssociatedTokenAddress(
      mintPubkey,
      walletPubkey,
      false,
      token2022ProgramId,
    );

    const accountInfo = await connection.getAccountInfo(ata);
    if (!accountInfo) return;

    // check for ConfidentialTransferAccount extension (type 10)
    const data = accountInfo.data;
    const baseAccountSize = 165;
    let offset = baseAccountSize;

    while (offset < data.length - 4) {
      const extensionType = data.readUInt16LE(offset);
      const extensionLength = data.readUInt16LE(offset + 2);

      if (extensionType === 10) {
        // found ConfidentialTransferAccount extension
        if (token === 'SOL') {
          isSolAccountConfigured.value = true;
        } else {
          isUsdcAccountConfigured.value = true;
        }
        console.log(`${token} account already configured for confidential transfers`);
        return;
      }

      offset += 4 + extensionLength;
    }
  } catch (e) {
    console.error(`failed to check ${token} account configuration:`, e);
  }
}

// refresh balances for both tokens
async function refreshBalances() {
  if (!props.wallet?.publicKey) return;

  // For now, use the existing composable which handles a single mint
  // In production, this would fetch balances for both SOL and USDC mints
  const publicBal = await getPublicBalance(props.wallet);
  const confidentialBal = await getConfidentialBalance(props.wallet);

  // Assign to SOL by default (legacy behavior)
  // TODO: Extend composable to handle multiple mints
  solPublicBalance.value = publicBal;
  solConfidentialBalance.value = confidentialBal;

  // USDC balances would be fetched similarly with USDC mint
  // For now, set to 0 as placeholder
  usdcPublicBalance.value = 0;
  usdcConfidentialBalance.value = 0;
}

// setup confidential transfers
async function handleSetup() {
  if (!props.wallet?.publicKey) return;

  try {
    // Setup both SOL and USDC mints with CT extension
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
    // For now, use the existing mint function
    // TODO: Extend to handle SOL vs USDC mints separately
    await mintTestTokens(props.wallet, 100);
    await refreshBalances();
  } catch (e) {
    console.error(`${token} mint failed:`, e);
  }
}

// derive elgamal keypair
async function handleDeriveKey() {
  if (!props.wallet?.publicKey) return;

  derivingKey.value = true;
  try {
    await deriveElGamalKeypair(props.wallet);
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
    // Configure account for the current mint (handles both tokens)
    await configureConfidentialTransferAccount(props.wallet);
    // Mark both as configured since they share the same ElGamal key
    isSolAccountConfigured.value = true;
    isUsdcAccountConfigured.value = true;
  } catch (e) {
    console.error('configure account failed:', e);
  } finally {
    configuringAccount.value = false;
  }
}

// shorten a hex key for display
function shortenKey(key: string): string {
  if (!key || key.length < 16) return key;
  return `${key.slice(0, 8)}...${key.slice(-8)}`;
}

// deposit to confidential balance for selected token
async function handleDeposit() {
  if (!props.wallet?.publicKey || depositAmount.value <= 0) return;

  try {
    // TODO: Pass selected token to composable for multi-mint support
    // For now, uses the default mint
    console.log(`Depositing ${depositAmount.value} ${selectedToken.value} to confidential balance...`);

    // step 1: deposit to pending balance
    const txid = await depositToConfidential(props.wallet, depositAmount.value);
    if (txid) {
      console.log('deposit successful, now applying pending balance...');
      // step 2: apply pending balance to make it available
      const applyTxid = await applyPendingBalance(props.wallet);
      if (applyTxid) {
        console.log('pending balance applied:', applyTxid);
      }
      closeDepositModal();
      await refreshBalances();
    }
  } catch (e) {
    console.error(`${selectedToken.value} deposit failed:`, e);
  }
}

// withdraw from confidential balance for selected token
async function handleWithdraw() {
  if (!props.wallet?.publicKey || withdrawAmount.value <= 0) return;

  try {
    // TODO: Pass selected token to composable for multi-mint support
    console.log(`Withdrawing ${withdrawAmount.value} ${selectedToken.value} from confidential balance...`);

    const txid = await withdrawFromConfidential(
      props.wallet,
      withdrawAmount.value,
    );
    if (txid) {
      closeWithdrawModal();
      await refreshBalances();
    }
  } catch (e) {
    console.error(`${selectedToken.value} withdraw failed:`, e);
  }
}

// watch for wallet changes
watch(
  () => props.wallet?.publicKey,
  () => {
    checkSetup();
  },
);

onMounted(() => {
  checkSetup();
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
  overflow: hidden;
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
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
}

@media (max-width: 500px) {
  .token-groups {
    grid-template-columns: 1fr;
  }
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

.token-icon.sol {
  background: linear-gradient(135deg, #9945ff 0%, #14f195 100%);
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

.balance-row.confidential {
  background: rgba(16, 185, 129, 0.1);
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
  transition: opacity 0.2s, visibility 0.2s;
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
  transition: opacity 0.2s, visibility 0.2s;
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

/* elgamal section */
.elgamal-section {
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid rgba(15, 23, 42, 0.08);
}

.elgamal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.elgamal-label {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--text-muted);
}

.elgamal-icon {
  font-size: 1rem;
}

.elgamal-key-section {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.elgamal-key {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: rgba(99, 102, 241, 0.1);
  border-radius: 8px;
}

.elgamal-configure {
  display: flex;
  justify-content: flex-end;
}

.elgamal-configured {
  display: flex;
  justify-content: flex-end;
}

.configured-badge {
  font-size: 0.75rem;
  color: #10b981;
  font-weight: 500;
}

.key-value {
  font-size: 0.75rem;
  color: #6366f1;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
}

.copy-btn {
  padding: 0.25rem 0.5rem;
  font-size: 0.625rem;
  font-weight: 600;
  background: rgba(99, 102, 241, 0.2);
  color: #6366f1;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.2s;
}

.copy-btn:hover {
  background: rgba(99, 102, 241, 0.3);
}

.elgamal-derive {
  text-align: center;
}

.derive-text {
  font-size: 0.75rem;
  color: var(--text-muted);
  margin-bottom: 0.5rem;
}

.btn-outline {
  background: transparent;
  border: 1px solid rgba(15, 23, 42, 0.2);
  color: var(--text-secondary);
}

.btn-outline:hover:not(:disabled) {
  background: rgba(15, 23, 42, 0.05);
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

/* setup notice */
.setup-notice {
  margin-top: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: rgba(245, 158, 11, 0.1);
  border: 1px solid rgba(245, 158, 11, 0.2);
  border-radius: 8px;
  font-size: 0.75rem;
  color: #d97706;
  text-align: center;
}
</style>

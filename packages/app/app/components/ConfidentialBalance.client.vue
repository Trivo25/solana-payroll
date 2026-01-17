<template>
  <div class="confidential-balance">
    <div class="balance-header">
      <div class="balance-label">Confidential Balance</div>
      <span class="balance-icon">&#x1F6E1;</span>
    </div>

    <!-- not setup state -->
    <div v-if="!isSetup" class="setup-section">
      <p class="setup-text">Set up confidential transfers to hide your balance and transaction amounts.</p>
      <button class="btn btn-primary" :disabled="loading" @click="handleSetup">
        {{ loading ? 'Setting up...' : 'Enable Confidential Transfers' }}
      </button>
    </div>

    <!-- setup complete -->
    <div v-else class="balance-section">
      <!-- public balance (visible on chain) -->
      <div class="balance-row">
        <span class="balance-type">Public</span>
        <span class="balance-value mono">{{ formatBalance(publicBalance) }}</span>
        <span class="balance-token">VEIL</span>
      </div>

      <!-- confidential balance (encrypted) -->
      <div class="balance-row confidential">
        <span class="balance-type">Private</span>
        <span class="balance-value mono blur-hover">{{ formatBalance(confidentialBalance) }}</span>
        <span class="balance-token">VEIL</span>
      </div>

      <!-- actions -->
      <div class="balance-actions">
        <button
          class="btn btn-small"
          :disabled="loading || publicBalance <= 0"
          @click="showDepositModal = true"
        >
          Deposit &#x2192;
        </button>
        <button
          class="btn btn-small btn-secondary"
          :disabled="loading || confidentialBalance <= 0"
          @click="showWithdrawModal = true"
        >
          &#x2190; Withdraw
        </button>
      </div>

      <!-- elgamal public key -->
      <div class="elgamal-section">
        <div class="elgamal-header">
          <span class="elgamal-label">ElGamal Public Key</span>
          <span class="elgamal-icon">&#x1F511;</span>
        </div>
        <div v-if="elGamalPublicKey" class="elgamal-key-section">
          <div class="elgamal-key">
            <span class="key-value mono" :title="elGamalPublicKey">{{ shortenKey(elGamalPublicKey) }}</span>
            <button class="copy-btn" @click="navigator.clipboard.writeText(elGamalPublicKey)">Copy</button>
          </div>
          <div v-if="!isAccountConfigured" class="elgamal-configure">
            <button
              class="btn btn-small btn-primary"
              :disabled="configuringAccount"
              @click="handleConfigureAccount"
            >
              {{ configuringAccount ? 'Configuring...' : 'Store On-Chain' }}
            </button>
          </div>
          <div v-else class="elgamal-configured">
            <span class="configured-badge">&#x2713; Stored On-Chain</span>
          </div>
        </div>
        <div v-else class="elgamal-derive">
          <p class="derive-text">Derive your encryption key to enable private transfers</p>
          <button class="btn btn-small btn-outline" :disabled="derivingKey" @click="handleDeriveKey">
            {{ derivingKey ? 'Signing...' : 'Derive Key' }}
          </button>
        </div>
      </div>

      <!-- mint test tokens (dev only) -->
      <div v-if="isDev" class="dev-actions">
        <button class="btn btn-dev" :disabled="loading" @click="handleMintTokens">
          {{ loading ? 'Minting...' : 'Mint 100 Test Tokens' }}
        </button>
      </div>
    </div>

    <!-- error message -->
    <div v-if="error" class="error-message">
      {{ error }}
    </div>

    <!-- deposit modal -->
    <div v-if="showDepositModal" class="modal-overlay" @click.self="showDepositModal = false">
      <div class="modal">
        <h3>Deposit to Confidential Balance</h3>
        <p class="modal-desc">Move tokens from public to private balance. Once deposited, your balance will be encrypted.</p>

        <div class="input-group">
          <label>Amount</label>
          <input
            v-model.number="depositAmount"
            type="number"
            :max="publicBalance"
            min="0"
            step="0.01"
            placeholder="0.00"
          />
          <button class="max-btn" @click="depositAmount = publicBalance">MAX</button>
        </div>

        <div class="modal-actions">
          <button class="btn btn-secondary" @click="showDepositModal = false">Cancel</button>
          <button
            class="btn btn-primary"
            :disabled="loading || depositAmount <= 0 || depositAmount > publicBalance"
            @click="handleDeposit"
          >
            {{ loading ? 'Depositing...' : 'Deposit' }}
          </button>
        </div>
      </div>
    </div>

    <!-- withdraw modal -->
    <div v-if="showWithdrawModal" class="modal-overlay" @click.self="showWithdrawModal = false">
      <div class="modal">
        <h3>Withdraw from Confidential Balance</h3>
        <p class="modal-desc">Move tokens from private to public balance. This requires generating a ZK proof.</p>

        <div class="input-group">
          <label>Amount</label>
          <input
            v-model.number="withdrawAmount"
            type="number"
            :max="confidentialBalance"
            min="0"
            step="0.01"
            placeholder="0.00"
          />
          <button class="max-btn" @click="withdrawAmount = confidentialBalance">MAX</button>
        </div>

        <div class="modal-actions">
          <button class="btn btn-secondary" @click="showWithdrawModal = false">Cancel</button>
          <button
            class="btn btn-primary"
            :disabled="loading || withdrawAmount <= 0 || withdrawAmount > confidentialBalance"
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
import { ref, onMounted, watch } from 'vue'
import { useConfidentialTransferKit } from '~/composables/useConfidentialTransferKit'

const props = defineProps<{
  wallet: any
}>()

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
  withdrawFromConfidential,
} = useConfidentialTransferKit()

const isSetup = ref(false)
const publicBalance = ref(0)
const confidentialBalance = ref(0)
const showDepositModal = ref(false)
const showWithdrawModal = ref(false)
const depositAmount = ref(0)
const withdrawAmount = ref(0)
const isDev = ref(true) // always true for local dev
const derivingKey = ref(false)
const configuringAccount = ref(false)
const isAccountConfigured = ref(false)

// format balance with 2 decimals
function formatBalance(balance: number): string {
  return balance.toFixed(2)
}

// check if already setup
async function checkSetup() {
  // check both old and new localStorage keys
  const storedMint = localStorage.getItem('veil-test-mint-kit') || localStorage.getItem('veil-test-mint')
  if (storedMint && props.wallet?.publicKey) {
    isSetup.value = true
    await refreshBalances()
  }
}

// refresh balances
async function refreshBalances() {
  if (!props.wallet?.publicKey) return

  publicBalance.value = await getPublicBalance(props.wallet)
  confidentialBalance.value = await getConfidentialBalance(props.wallet)
}

// setup confidential transfers
async function handleSetup() {
  if (!props.wallet?.publicKey) return

  try {
    await setupTestMint(props.wallet)
    await setupTokenAccount(props.wallet)
    isSetup.value = true
    await refreshBalances()
  } catch (e) {
    console.error('setup failed:', e)
  }
}

// mint test tokens
async function handleMintTokens() {
  if (!props.wallet?.publicKey) return

  try {
    await mintTestTokens(props.wallet, 100)
    await refreshBalances()
  } catch (e) {
    console.error('mint failed:', e)
  }
}

// derive elgamal keypair
async function handleDeriveKey() {
  if (!props.wallet?.publicKey) return

  derivingKey.value = true
  try {
    await deriveElGamalKeypair(props.wallet)
  } catch (e) {
    console.error('key derivation failed:', e)
  } finally {
    derivingKey.value = false
  }
}

// configure account for confidential transfers (stores ElGamal key on-chain)
async function handleConfigureAccount() {
  if (!props.wallet?.publicKey) return

  configuringAccount.value = true
  try {
    await configureConfidentialTransferAccount(props.wallet)
    isAccountConfigured.value = true
  } catch (e) {
    console.error('configure account failed:', e)
  } finally {
    configuringAccount.value = false
  }
}

// shorten a hex key for display
function shortenKey(key: string): string {
  if (!key || key.length < 16) return key
  return `${key.slice(0, 8)}...${key.slice(-8)}`
}

// deposit to confidential
async function handleDeposit() {
  if (!props.wallet?.publicKey || depositAmount.value <= 0) return

  try {
    const txid = await depositToConfidential(props.wallet, depositAmount.value)
    if (txid) {
      showDepositModal.value = false
      depositAmount.value = 0
      await refreshBalances()
    }
  } catch (e) {
    console.error('deposit failed:', e)
  }
}

// withdraw from confidential
async function handleWithdraw() {
  if (!props.wallet?.publicKey || withdrawAmount.value <= 0) return

  try {
    const txid = await withdrawFromConfidential(props.wallet, withdrawAmount.value)
    if (txid) {
      showWithdrawModal.value = false
      withdrawAmount.value = 0
      await refreshBalances()
    }
  } catch (e) {
    console.error('withdraw failed:', e)
  }
}

// watch for wallet changes
watch(() => props.wallet?.publicKey, () => {
  checkSetup()
})

onMounted(() => {
  checkSetup()
})
</script>

<style scoped>
.confidential-balance {
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.9) 0%, rgba(16, 185, 129, 0.05) 100%);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(16, 185, 129, 0.2);
  border-radius: 20px;
  padding: 1.5rem;
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
  gap: 0.75rem;
}

.balance-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem;
  background: rgba(255, 255, 255, 0.5);
  border-radius: 12px;
}

.balance-row.confidential {
  background: rgba(16, 185, 129, 0.1);
}

.balance-type {
  font-size: 0.75rem;
  color: var(--text-muted);
  width: 50px;
}

.balance-value {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text-primary);
  flex: 1;
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
  padding: 0.5rem 1rem;
  font-size: 0.75rem;
  flex: 1;
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

.btn-dev {
  width: 100%;
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
  margin-bottom: 1.5rem;
  line-height: 1.5;
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
</style>

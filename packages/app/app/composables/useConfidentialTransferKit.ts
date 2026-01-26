/**
 * MOCKED Confidential Transfer Kit
 *
 * This is a mocked version of the confidential transfer composable.
 * All interactions are simulated with dummy data.
 * TODO: Replace with real implementations
 */

import { ref } from 'vue';

// ============================================
// MOCK STATE
// ============================================

const loading = ref(false);
const error = ref<string | null>(null);

// Mock ElGamal public key (displayed in UI)
const elGamalPublicKey = ref<string | null>(null);

// Mock mint address
const testMint = ref<string | null>(null);

// Mock balances (stored in localStorage for persistence)
const STORAGE_KEYS = {
  elgamalPubkey: (wallet: string) => `veil-mock-elgamal-${wallet}`,
  solPublicBalance: (wallet: string) => `veil-mock-sol-public-${wallet}`,
  solPrivateBalance: (wallet: string) => `veil-mock-sol-private-${wallet}`,
  usdcPublicBalance: (wallet: string) => `veil-mock-usdc-public-${wallet}`,
  usdcPrivateBalance: (wallet: string) => `veil-mock-usdc-private-${wallet}`,
  isConfigured: (wallet: string) => `veil-mock-configured-${wallet}`,
  mintAddress: 'veil-mock-mint',
};

// ============================================
// HELPER FUNCTIONS
// ============================================

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function generateMockPublicKey(): string {
  // Generate a random hex string that looks like an ElGamal public key
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function generateMockTxSignature(): string {
  // Generate a random base58-like string for transaction signature
  const chars =
    '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let result = '';
  for (let i = 0; i < 88; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function getWalletAddress(wallet: any): string | null {
  if (!wallet?.publicKey) return null;
  return typeof wallet.publicKey === 'string'
    ? wallet.publicKey
    : wallet.publicKey.toBase58?.() || wallet.publicKey.toString();
}

// ============================================
// MOCKED COMPOSABLE
// ============================================

export function useConfidentialTransferKit() {
  /**
   * MOCK: Derive ElGamal Keypair
   * Simulates deriving an encryption keypair from the wallet
   */
  async function deriveElGamalKeypair(wallet: any): Promise<void> {
    const walletAddress = getWalletAddress(wallet);
    if (!walletAddress) {
      throw new Error('Wallet not connected');
    }

    loading.value = true;
    error.value = null;

    try {
      // Simulate derivation delay
      await delay(500);

      // Check if we already have a stored pubkey
      const storedPubkey = localStorage.getItem(
        STORAGE_KEYS.elgamalPubkey(walletAddress)
      );

      if (storedPubkey) {
        elGamalPublicKey.value = storedPubkey;
        console.log('[MOCK] Restored ElGamal pubkey:', storedPubkey.slice(0, 16) + '...');
      } else {
        // Generate new mock pubkey
        const newPubkey = generateMockPublicKey();
        localStorage.setItem(
          STORAGE_KEYS.elgamalPubkey(walletAddress),
          newPubkey
        );
        elGamalPublicKey.value = newPubkey;
        console.log('[MOCK] Generated new ElGamal pubkey:', newPubkey.slice(0, 16) + '...');
      }
    } catch (e: any) {
      error.value = e.message || 'Failed to derive keypair';
      throw e;
    } finally {
      loading.value = false;
    }
  }

  /**
   * MOCK: Setup Test Mint
   * Simulates creating a Token-2022 mint with confidential transfer extension
   */
  async function setupTestMint(wallet: any): Promise<string> {
    const walletAddress = getWalletAddress(wallet);
    if (!walletAddress) {
      throw new Error('Wallet not connected');
    }

    loading.value = true;
    error.value = null;

    try {
      // Simulate transaction delay
      await delay(1000);

      // Check if mint already exists
      let mintAddress = localStorage.getItem(STORAGE_KEYS.mintAddress);

      if (!mintAddress) {
        // Generate mock mint address
        mintAddress = generateMockTxSignature().slice(0, 44);
        localStorage.setItem(STORAGE_KEYS.mintAddress, mintAddress);
      }

      testMint.value = mintAddress;
      console.log('[MOCK] Test mint setup:', mintAddress);

      // Initialize mock balances if not exist
      if (!localStorage.getItem(STORAGE_KEYS.solPublicBalance(walletAddress))) {
        localStorage.setItem(STORAGE_KEYS.solPublicBalance(walletAddress), '0');
      }
      if (!localStorage.getItem(STORAGE_KEYS.solPrivateBalance(walletAddress))) {
        localStorage.setItem(STORAGE_KEYS.solPrivateBalance(walletAddress), '0');
      }
      if (!localStorage.getItem(STORAGE_KEYS.usdcPublicBalance(walletAddress))) {
        localStorage.setItem(STORAGE_KEYS.usdcPublicBalance(walletAddress), '0');
      }
      if (!localStorage.getItem(STORAGE_KEYS.usdcPrivateBalance(walletAddress))) {
        localStorage.setItem(STORAGE_KEYS.usdcPrivateBalance(walletAddress), '0');
      }

      return mintAddress;
    } catch (e: any) {
      error.value = e.message || 'Failed to setup mint';
      throw e;
    } finally {
      loading.value = false;
    }
  }

  /**
   * MOCK: Setup Token Account
   * Simulates creating an Associated Token Account
   */
  async function setupTokenAccount(wallet: any): Promise<string> {
    const walletAddress = getWalletAddress(wallet);
    if (!walletAddress) {
      throw new Error('Wallet not connected');
    }

    loading.value = true;
    error.value = null;

    try {
      // Simulate transaction delay
      await delay(800);

      // Generate mock ATA address
      const ataAddress = generateMockTxSignature().slice(0, 44);
      console.log('[MOCK] Token account setup:', ataAddress);

      return ataAddress;
    } catch (e: any) {
      error.value = e.message || 'Failed to setup token account';
      throw e;
    } finally {
      loading.value = false;
    }
  }

  /**
   * MOCK: Configure Confidential Transfer Account
   * Simulates storing ElGamal public key on-chain
   */
  async function configureConfidentialTransferAccount(
    wallet: any
  ): Promise<string> {
    const walletAddress = getWalletAddress(wallet);
    if (!walletAddress) {
      throw new Error('Wallet not connected');
    }

    if (!elGamalPublicKey.value) {
      throw new Error('ElGamal keypair not derived. Call deriveElGamalKeypair first.');
    }

    loading.value = true;
    error.value = null;

    try {
      // Simulate transaction delay
      await delay(1200);

      // Mark account as configured
      localStorage.setItem(STORAGE_KEYS.isConfigured(walletAddress), 'true');

      const txSignature = generateMockTxSignature();
      console.log('[MOCK] Account configured, tx:', txSignature.slice(0, 16) + '...');

      return txSignature;
    } catch (e: any) {
      error.value = e.message || 'Failed to configure account';
      throw e;
    } finally {
      loading.value = false;
    }
  }

  /**
   * MOCK: Mint Test Tokens
   * Simulates minting tokens to the public balance
   */
  async function mintTestTokens(
    wallet: any,
    amount: number,
    token: 'SOL' | 'USDC' = 'SOL'
  ): Promise<string> {
    const walletAddress = getWalletAddress(wallet);
    if (!walletAddress) {
      throw new Error('Wallet not connected');
    }

    loading.value = true;
    error.value = null;

    try {
      // Simulate transaction delay
      await delay(800);

      // Get current balance and add minted amount
      const storageKey =
        token === 'SOL'
          ? STORAGE_KEYS.solPublicBalance(walletAddress)
          : STORAGE_KEYS.usdcPublicBalance(walletAddress);

      const currentBalance = parseFloat(localStorage.getItem(storageKey) || '0');
      const newBalance = currentBalance + amount;
      localStorage.setItem(storageKey, newBalance.toString());

      const txSignature = generateMockTxSignature();
      console.log(`[MOCK] Minted ${amount} ${token}, new balance: ${newBalance}, tx:`, txSignature.slice(0, 16) + '...');

      return txSignature;
    } catch (e: any) {
      error.value = e.message || 'Failed to mint tokens';
      throw e;
    } finally {
      loading.value = false;
    }
  }

  /**
   * MOCK: Get Public Balance
   * Returns the simulated public (non-confidential) token balance
   */
  async function getPublicBalance(
    wallet: any,
    token: 'SOL' | 'USDC' = 'SOL'
  ): Promise<number> {
    const walletAddress = getWalletAddress(wallet);
    if (!walletAddress) return 0;

    const storageKey =
      token === 'SOL'
        ? STORAGE_KEYS.solPublicBalance(walletAddress)
        : STORAGE_KEYS.usdcPublicBalance(walletAddress);

    return parseFloat(localStorage.getItem(storageKey) || '0');
  }

  /**
   * MOCK: Get Confidential Balance
   * Returns the simulated private (encrypted) token balance
   */
  async function getConfidentialBalance(
    wallet: any,
    token: 'SOL' | 'USDC' = 'SOL'
  ): Promise<number> {
    const walletAddress = getWalletAddress(wallet);
    if (!walletAddress) return 0;

    const storageKey =
      token === 'SOL'
        ? STORAGE_KEYS.solPrivateBalance(walletAddress)
        : STORAGE_KEYS.usdcPrivateBalance(walletAddress);

    return parseFloat(localStorage.getItem(storageKey) || '0');
  }

  /**
   * MOCK: Deposit to Confidential Balance
   * Simulates moving tokens from public to private balance
   */
  async function depositToConfidential(
    wallet: any,
    amount: number,
    token: 'SOL' | 'USDC' = 'SOL'
  ): Promise<string> {
    const walletAddress = getWalletAddress(wallet);
    if (!walletAddress) {
      throw new Error('Wallet not connected');
    }

    loading.value = true;
    error.value = null;

    try {
      // Simulate transaction delay
      await delay(1000);

      const publicKey =
        token === 'SOL'
          ? STORAGE_KEYS.solPublicBalance(walletAddress)
          : STORAGE_KEYS.usdcPublicBalance(walletAddress);
      const privateKey =
        token === 'SOL'
          ? STORAGE_KEYS.solPrivateBalance(walletAddress)
          : STORAGE_KEYS.usdcPrivateBalance(walletAddress);

      const publicBalance = parseFloat(localStorage.getItem(publicKey) || '0');
      const privateBalance = parseFloat(localStorage.getItem(privateKey) || '0');

      if (amount > publicBalance) {
        throw new Error('Insufficient public balance');
      }

      // Move from public to private
      localStorage.setItem(publicKey, (publicBalance - amount).toString());
      localStorage.setItem(privateKey, (privateBalance + amount).toString());

      const txSignature = generateMockTxSignature();
      console.log(`[MOCK] Deposited ${amount} ${token} to confidential, tx:`, txSignature.slice(0, 16) + '...');

      return txSignature;
    } catch (e: any) {
      error.value = e.message || 'Failed to deposit';
      throw e;
    } finally {
      loading.value = false;
    }
  }

  /**
   * MOCK: Apply Pending Balance
   * In a real implementation, this moves pending → available encrypted balance
   * For mock, this is a no-op since we directly update balances
   */
  async function applyPendingBalance(wallet: any): Promise<string> {
    const walletAddress = getWalletAddress(wallet);
    if (!walletAddress) {
      throw new Error('Wallet not connected');
    }

    loading.value = true;
    error.value = null;

    try {
      // Simulate transaction delay
      await delay(600);

      const txSignature = generateMockTxSignature();
      console.log('[MOCK] Applied pending balance, tx:', txSignature.slice(0, 16) + '...');

      return txSignature;
    } catch (e: any) {
      error.value = e.message || 'Failed to apply pending balance';
      throw e;
    } finally {
      loading.value = false;
    }
  }

  /**
   * MOCK: Withdraw from Confidential Balance
   * Simulates moving tokens from private to public balance
   */
  async function withdrawFromConfidential(
    wallet: any,
    amount: number,
    token: 'SOL' | 'USDC' = 'SOL'
  ): Promise<string> {
    const walletAddress = getWalletAddress(wallet);
    if (!walletAddress) {
      throw new Error('Wallet not connected');
    }

    loading.value = true;
    error.value = null;

    try {
      // Simulate transaction delay (longer for ZK proof generation)
      await delay(1500);

      const publicKey =
        token === 'SOL'
          ? STORAGE_KEYS.solPublicBalance(walletAddress)
          : STORAGE_KEYS.usdcPublicBalance(walletAddress);
      const privateKey =
        token === 'SOL'
          ? STORAGE_KEYS.solPrivateBalance(walletAddress)
          : STORAGE_KEYS.usdcPrivateBalance(walletAddress);

      const publicBalance = parseFloat(localStorage.getItem(publicKey) || '0');
      const privateBalance = parseFloat(localStorage.getItem(privateKey) || '0');

      if (amount > privateBalance) {
        throw new Error('Insufficient confidential balance');
      }

      // Move from private to public
      localStorage.setItem(privateKey, (privateBalance - amount).toString());
      localStorage.setItem(publicKey, (publicBalance + amount).toString());

      const txSignature = generateMockTxSignature();
      console.log(`[MOCK] Withdrew ${amount} ${token} from confidential, tx:`, txSignature.slice(0, 16) + '...');

      return txSignature;
    } catch (e: any) {
      error.value = e.message || 'Failed to withdraw';
      throw e;
    } finally {
      loading.value = false;
    }
  }

  /**
   * MOCK: Check if account is configured for confidential transfers
   */
  async function isAccountConfigured(wallet: any): Promise<boolean> {
    const walletAddress = getWalletAddress(wallet);
    if (!walletAddress) return false;

    return localStorage.getItem(STORAGE_KEYS.isConfigured(walletAddress)) === 'true';
  }

  /**
   * MOCK: Reset all mock data for a wallet (useful for testing)
   */
  function resetMockData(wallet: any): void {
    const walletAddress = getWalletAddress(wallet);
    if (!walletAddress) return;

    localStorage.removeItem(STORAGE_KEYS.elgamalPubkey(walletAddress));
    localStorage.removeItem(STORAGE_KEYS.solPublicBalance(walletAddress));
    localStorage.removeItem(STORAGE_KEYS.solPrivateBalance(walletAddress));
    localStorage.removeItem(STORAGE_KEYS.usdcPublicBalance(walletAddress));
    localStorage.removeItem(STORAGE_KEYS.usdcPrivateBalance(walletAddress));
    localStorage.removeItem(STORAGE_KEYS.isConfigured(walletAddress));
    localStorage.removeItem(STORAGE_KEYS.mintAddress);

    elGamalPublicKey.value = null;
    testMint.value = null;

    console.log('[MOCK] Reset all mock data for wallet:', walletAddress);
  }

  return {
    // State
    loading,
    error,
    elGamalPublicKey,
    testMint,

    // Functions
    deriveElGamalKeypair,
    setupTestMint,
    setupTokenAccount,
    configureConfidentialTransferAccount,
    mintTestTokens,
    getPublicBalance,
    getConfidentialBalance,
    depositToConfidential,
    applyPendingBalance,
    withdrawFromConfidential,
    isAccountConfigured,
    resetMockData,
  };
}

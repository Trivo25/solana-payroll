/**
 * Confidential Transfer Composable
 *
 * Real implementation of confidential transfers using Token-2022
 * with ZK proofs for privacy.
 *
 * Maintains the same API as the mock for drop-in replacement.
 */

import { ref, type Ref } from 'vue';
import { Connection, PublicKey, Transaction, Keypair, SystemProgram } from '@solana/web3.js';
import { sha256 } from '@noble/hashes/sha256';
import {
  TOKEN_2022_PROGRAM_ID,
  ExtensionType,
  getMintLen,
  createInitializeMintInstruction,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  createMintToInstruction,
} from '@solana/spl-token';
import type { WalletAdapter } from '@solana/wallet-adapter-base';

// Services
import { loadZkSdk, type ZkSdkModule } from '~/services/zkSdk';
import {
  deriveKeys,
  getElGamalPublicKeyHex,
  getElGamalKeypair,
  getAeKey,
  hasKeys,
  isKeysDerivedFor,
} from '~/services/elGamalKeyManager';
import {
  createInitializeConfidentialTransferMintInstruction,
  createReallocateInstruction,
  createConfigureAccountInstruction,
  createDepositInstruction,
  createApplyPendingBalanceInstruction,
  createWithdrawInstruction,
  createConfidentialTransferInstruction,
  createVerifyPubkeyValidityInstruction,
  createVerifyCiphertextCommitmentEqualityInstruction,
  createVerifyBatchedRangeProofU64Instruction,
  createVerifyBatchedGroupedCiphertext3HandlesValidityInstruction,
  readPendingBalanceCreditCounter,
  readPendingBalanceCiphertexts,
  readDecryptableAvailableBalance,
  readAvailableBalanceCiphertext,
  hasConfidentialTransferExtension,
  getContextStateAccountSize,
  ZK_ELGAMAL_PROOF_PROGRAM_ID,
  TOKEN_ACCOUNT_SIZE,
} from '~/services/confidentialInstructions';
import {
  combineLowHighCiphertexts,
  subtractCiphertexts,
} from '~/services/confidentialCrypto';
import {
  signAndSendTransaction,
  buildAndSendTransaction,
} from '~/services/walletSigner';

// ============================================
// Configuration
// ============================================

const RPC_URL = 'http://127.0.0.1:8899';
const DECIMALS = 9;

// Module-level state (shared across components)
const loading = ref(false);
const error = ref<string | null>(null);
const elGamalPublicKey = ref<string | null>(null);
const testMint = ref<string | null>(null);

// Withdrawal progress tracking
export interface WithdrawProgress {
  step: number;
  totalSteps: number;
  currentStep: string;
}
const withdrawProgress = ref<WithdrawProgress | null>(null);

// Transaction history (fetched from RPC, not stored locally)
export interface CTTransaction {
  id: string;
  type: 'deposit' | 'apply' | 'withdraw' | 'transfer' | 'mint';
  amount: number;
  signature: string;
  timestamp: number;
  status: 'success' | 'failed';
}
const transactions = ref<CTTransaction[]>([]);

// Clear transaction history (just clears the in-memory list)
function clearTransactionHistory(): void {
  transactions.value = [];
  console.log('[CT] Transaction history cleared');
}

// Token mint address (stored in localStorage for persistence)
const MINT_STORAGE_KEY = 'veil-ct-mint';

// Deterministic mint seed - generates the same mint address across all browsers
const MINT_SEED = 'veil-confidential-usdc-mint-v1';

/**
 * Generate a deterministic keypair from a seed string
 * This ensures the same mint address across all browsers/sessions
 */
function getMintKeypair(): Keypair {
  const seed = sha256(new TextEncoder().encode(MINT_SEED));
  return Keypair.fromSeed(seed);
}

// Auditor keypair (generated once per mint)
let auditorKeypair: InstanceType<ZkSdkModule['ElGamalKeypair']> | null = null;

// ============================================
// Helper Functions
// ============================================

function getWalletAddress(wallet: any): string | null {
  if (!wallet?.publicKey) return null;
  return typeof wallet.publicKey === 'string'
    ? wallet.publicKey
    : wallet.publicKey.toBase58?.() || wallet.publicKey.toString();
}

function getConnection(): Connection {
  return new Connection(RPC_URL, { commitment: 'confirmed' });
}

// ============================================
// Composable
// ============================================

export function useConfidentialTransfer() {
  /**
   * Derive ElGamal Keypair from wallet signature
   */
  async function deriveElGamalKeypair(wallet: any): Promise<void> {
    const walletAddress = getWalletAddress(wallet);
    if (!walletAddress) {
      throw new Error('Wallet not connected');
    }

    loading.value = true;
    error.value = null;

    try {
      // Check if already derived for this wallet
      if (isKeysDerivedFor(walletAddress)) {
        elGamalPublicKey.value = getElGamalPublicKeyHex();
        console.log('[CT] Keys already derived for wallet');
        return;
      }

      // Derive keys from wallet signature
      await deriveKeys(wallet as WalletAdapter);
      elGamalPublicKey.value = getElGamalPublicKeyHex();
      console.log('[CT] ElGamal keypair derived:', elGamalPublicKey.value?.slice(0, 16) + '...');
    } catch (e: any) {
      error.value = e.message || 'Failed to derive keypair';
      throw e;
    } finally {
      loading.value = false;
    }
  }

  /**
   * Setup Test Mint with confidential transfer extension
   */
  async function setupTestMint(wallet: any): Promise<string> {
    const walletAddress = getWalletAddress(wallet);
    if (!walletAddress) {
      throw new Error('Wallet not connected');
    }

    loading.value = true;
    error.value = null;

    try {
      const connection = getConnection();

      // Use deterministic mint keypair - same address across all browsers
      const mint = getMintKeypair();
      const mintAddress = mint.publicKey.toBase58();

      // Check if mint already exists on-chain (may have been created by another browser)
      const mintInfo = await connection.getAccountInfo(mint.publicKey);
      if (mintInfo) {
        testMint.value = mintAddress;
        localStorage.setItem(MINT_STORAGE_KEY, mintAddress);
        console.log('[CT] Using existing deterministic mint:', mintAddress);
        return mintAddress;
      }

      console.log('[CT] Creating new deterministic mint:', mintAddress);
      const zkSdk = await loadZkSdk();
      const mintLen = getMintLen([ExtensionType.ConfidentialTransferMint]);
      const mintRent = await connection.getMinimumBalanceForRentExemption(mintLen);

      // Generate auditor ElGamal keypair
      auditorKeypair = new zkSdk.ElGamalKeypair();
      const auditorPubkeyBytes = auditorKeypair.pubkey().toBytes();

      // Create mint account
      const createAccountIx = SystemProgram.createAccount({
        fromPubkey: wallet.publicKey,
        newAccountPubkey: mint.publicKey,
        space: mintLen,
        lamports: mintRent,
        programId: TOKEN_2022_PROGRAM_ID,
      });

      // Initialize confidential transfer mint extension
      const initConfidentialIx = createInitializeConfidentialTransferMintInstruction(
        mint.publicKey,
        wallet.publicKey,
        true, // auto-approve new accounts
        auditorPubkeyBytes,
      );

      // Initialize mint
      const initMintIx = createInitializeMintInstruction(
        mint.publicKey,
        DECIMALS,
        wallet.publicKey,
        null,
        TOKEN_2022_PROGRAM_ID,
      );

      const transaction = new Transaction().add(
        createAccountIx,
        initConfidentialIx,
        initMintIx,
      );

      const sig = await signAndSendTransaction(connection, wallet as WalletAdapter, transaction, {
        additionalSigners: [mint],
        description: 'create confidential mint',
      });

      localStorage.setItem(MINT_STORAGE_KEY, mintAddress);
      testMint.value = mintAddress;

      console.log('[CT] Created confidential mint:', mintAddress, 'tx:', sig);
      return mintAddress;
    } catch (e: any) {
      error.value = e.message || 'Failed to setup mint';
      throw e;
    } finally {
      loading.value = false;
    }
  }

  /**
   * Setup Token Account (ATA)
   */
  async function setupTokenAccount(wallet: any): Promise<string> {
    const walletAddress = getWalletAddress(wallet);
    if (!walletAddress || !testMint.value) {
      throw new Error('Wallet not connected or mint not setup');
    }

    loading.value = true;
    error.value = null;

    try {
      const connection = getConnection();
      const mintPubkey = new PublicKey(testMint.value);
      const walletPubkey = new PublicKey(walletAddress);

      const ata = getAssociatedTokenAddressSync(
        mintPubkey,
        walletPubkey,
        false,
        TOKEN_2022_PROGRAM_ID,
      );

      // Check if ATA already exists
      const ataInfo = await connection.getAccountInfo(ata);
      if (ataInfo) {
        console.log('[CT] ATA already exists:', ata.toBase58());
        return ata.toBase58();
      }

      // Create ATA
      const createAtaIx = createAssociatedTokenAccountInstruction(
        walletPubkey,
        ata,
        walletPubkey,
        mintPubkey,
        TOKEN_2022_PROGRAM_ID,
      );

      const sig = await buildAndSendTransaction(
        connection,
        wallet as WalletAdapter,
        [createAtaIx],
        { description: 'create token account' },
      );

      console.log('[CT] Created ATA:', ata.toBase58(), 'tx:', sig);
      return ata.toBase58();
    } catch (e: any) {
      error.value = e.message || 'Failed to setup token account';
      throw e;
    } finally {
      loading.value = false;
    }
  }

  /**
   * Configure account for confidential transfers
   * Stores ElGamal public key on-chain
   */
  async function configureConfidentialTransferAccount(wallet: any): Promise<string> {
    const walletAddress = getWalletAddress(wallet);
    if (!walletAddress) {
      throw new Error('Wallet not connected');
    }

    if (!hasKeys()) {
      throw new Error('ElGamal keypair not derived. Call deriveElGamalKeypair first.');
    }

    if (!testMint.value) {
      throw new Error('Mint not setup. Call setupTestMint first.');
    }

    loading.value = true;
    error.value = null;

    try {
      const connection = getConnection();
      const zkSdk = await loadZkSdk();
      const walletPubkey = new PublicKey(walletAddress);
      const mintPubkey = new PublicKey(testMint.value);

      const ata = getAssociatedTokenAddressSync(
        mintPubkey,
        walletPubkey,
        false,
        TOKEN_2022_PROGRAM_ID,
      );

      // Check if already configured
      const accountInfo = await connection.getAccountInfo(ata);
      if (accountInfo && hasConfidentialTransferExtension(accountInfo.data)) {
        console.log('[CT] Account already configured for confidential transfers');
        return 'already-configured';
      }

      const elGamal = getElGamalKeypair();
      const aeKey = getAeKey();

      // Generate pubkey validity proof
      const proofData = new zkSdk.PubkeyValidityProofData(elGamal);
      const proofBytes = proofData.toBytes();
      proofData.verify();
      console.log('[CT] Pubkey validity proof generated and verified');

      // Encrypt zero balance
      const zeroBalanceCiphertext = aeKey.encrypt(0n);
      const zeroBalanceBytes = zeroBalanceCiphertext.toBytes();

      // Build transaction
      const reallocateIx = createReallocateInstruction(
        ata,
        walletPubkey,
        walletPubkey,
        [ExtensionType.ConfidentialTransferAccount],
      );

      const verifyProofIx = createVerifyPubkeyValidityInstruction(proofBytes);

      const configureIx = createConfigureAccountInstruction(
        ata,
        mintPubkey,
        walletPubkey,
        zeroBalanceBytes,
        65536n, // max pending balance credit counter
        -1, // proof instruction offset (previous instruction)
      );

      const sig = await buildAndSendTransaction(
        connection,
        wallet as WalletAdapter,
        [reallocateIx, verifyProofIx, configureIx],
        { description: 'configure confidential account' },
      );

      console.log('[CT] Account configured for confidential transfers, tx:', sig);
      return sig;
    } catch (e: any) {
      error.value = e.message || 'Failed to configure account';
      throw e;
    } finally {
      loading.value = false;
    }
  }

  /**
   * Mint test tokens (dev only)
   */
  async function mintTestTokens(
    wallet: any,
    amount: number,
    _token: 'SOL' | 'USDC' = 'USDC',
  ): Promise<string> {
    const walletAddress = getWalletAddress(wallet);
    if (!walletAddress || !testMint.value) {
      throw new Error('Wallet not connected or mint not setup');
    }

    loading.value = true;
    error.value = null;

    try {
      const connection = getConnection();
      const walletPubkey = new PublicKey(walletAddress);
      const mintPubkey = new PublicKey(testMint.value);

      const ata = getAssociatedTokenAddressSync(
        mintPubkey,
        walletPubkey,
        false,
        TOKEN_2022_PROGRAM_ID,
      );

      // Check if ATA exists, create if needed
      const ataInfo = await connection.getAccountInfo(ata);
      const instructions = [];

      if (!ataInfo) {
        console.log('[CT] ATA does not exist, creating...');
        const createAtaIx = createAssociatedTokenAccountInstruction(
          walletPubkey,
          ata,
          walletPubkey,
          mintPubkey,
          TOKEN_2022_PROGRAM_ID,
        );
        instructions.push(createAtaIx);
      }

      // Convert to token amount (with decimals)
      const tokenAmount = BigInt(Math.floor(amount * Math.pow(10, DECIMALS)));

      const mintToIx = createMintToInstruction(
        mintPubkey,
        ata,
        walletPubkey,
        tokenAmount,
        [],
        TOKEN_2022_PROGRAM_ID,
      );
      instructions.push(mintToIx);

      const sig = await buildAndSendTransaction(
        connection,
        wallet as WalletAdapter,
        instructions,
        { description: 'mint test tokens' },
      );

      console.log(`[CT] Minted ${amount} tokens, tx:`, sig);
      return sig;
    } catch (e: any) {
      error.value = e.message || 'Failed to mint tokens';
      throw e;
    } finally {
      loading.value = false;
    }
  }

  /**
   * Get public (non-confidential) token balance
   */
  async function getPublicBalance(
    wallet: any,
    _token: 'SOL' | 'USDC' = 'USDC',
  ): Promise<number> {
    const walletAddress = getWalletAddress(wallet);
    if (!walletAddress || !testMint.value) return 0;

    try {
      const connection = getConnection();
      const walletPubkey = new PublicKey(walletAddress);
      const mintPubkey = new PublicKey(testMint.value);

      const ata = getAssociatedTokenAddressSync(
        mintPubkey,
        walletPubkey,
        false,
        TOKEN_2022_PROGRAM_ID,
      );

      const accountInfo = await connection.getAccountInfo(ata);
      if (!accountInfo) return 0;

      // Public balance is at offset 64 in the token account data (8 bytes)
      const publicBalance = accountInfo.data.readBigUInt64LE(64);
      return Number(publicBalance) / Math.pow(10, DECIMALS);
    } catch (e) {
      console.error('[CT] Error getting public balance:', e);
      return 0;
    }
  }

  /**
   * Get pending (deposited but not applied) balance
   * Requires ElGamal keypair to decrypt the ciphertexts
   */
  async function getPendingBalance(
    wallet: any,
    _token: 'SOL' | 'USDC' = 'USDC',
  ): Promise<number> {
    const walletAddress = getWalletAddress(wallet);
    if (!walletAddress || !testMint.value || !hasKeys()) return 0;

    try {
      const connection = getConnection();
      const zkSdk = await loadZkSdk();
      const walletPubkey = new PublicKey(walletAddress);
      const mintPubkey = new PublicKey(testMint.value);
      const elGamal = getElGamalKeypair();

      const ata = getAssociatedTokenAddressSync(
        mintPubkey,
        walletPubkey,
        false,
        TOKEN_2022_PROGRAM_ID,
      );

      const accountInfo = await connection.getAccountInfo(ata);
      if (!accountInfo) return 0;

      // Read pending balance ciphertexts
      const pendingCiphertexts = readPendingBalanceCiphertexts(accountInfo.data);
      if (!pendingCiphertexts) return 0;

      // Parse ciphertexts
      const loCiphertext = zkSdk.ElGamalCiphertext.fromBytes(pendingCiphertexts.lo);
      const hiCiphertext = zkSdk.ElGamalCiphertext.fromBytes(pendingCiphertexts.hi);

      if (!loCiphertext || !hiCiphertext) return 0;

      // Decrypt using ElGamal secret key
      const secretKey = elGamal.secret();
      const loAmount = secretKey.decrypt(loCiphertext);
      const hiAmount = secretKey.decrypt(hiCiphertext);

      // Combine lo and hi (hi is shifted by 16 bits for u48 values, or 32 bits for larger)
      // For Token-2022 CT, pending balance uses 48-bit amounts split into two 24-bit parts
      // lo contains lower 16 bits, hi contains upper 32 bits
      const combined = loAmount + (hiAmount << 16n);

      return Number(combined) / Math.pow(10, DECIMALS);
    } catch (e) {
      console.error('[CT] Error getting pending balance:', e);
      return 0;
    }
  }

  /**
   * Get confidential (available/private) balance
   */
  async function getConfidentialBalance(
    wallet: any,
    _token: 'SOL' | 'USDC' = 'USDC',
  ): Promise<number> {
    const walletAddress = getWalletAddress(wallet);
    if (!walletAddress || !testMint.value || !hasKeys()) return 0;

    try {
      const connection = getConnection();
      const zkSdk = await loadZkSdk();
      const walletPubkey = new PublicKey(walletAddress);
      const mintPubkey = new PublicKey(testMint.value);

      const ata = getAssociatedTokenAddressSync(
        mintPubkey,
        walletPubkey,
        false,
        TOKEN_2022_PROGRAM_ID,
      );

      const accountInfo = await connection.getAccountInfo(ata);
      if (!accountInfo) return 0;

      // Read the decryptable_available_balance from the extension
      const decryptableBytes = readDecryptableAvailableBalance(accountInfo.data);
      if (!decryptableBytes) return 0;

      // Decrypt using AE key
      const aeKey = getAeKey();
      const ciphertext = zkSdk.AeCiphertext.fromBytes(decryptableBytes);
      if (!ciphertext) return 0;

      const decrypted = ciphertext.decrypt(aeKey);
      if (decrypted === undefined) return 0;

      return Number(decrypted) / Math.pow(10, DECIMALS);
    } catch (e) {
      console.error('[CT] Error getting confidential balance:', e);
      return 0;
    }
  }

  /**
   * Deposit tokens to confidential balance (public -> pending)
   */
  async function depositToConfidential(
    wallet: any,
    amount: number,
    _token: 'SOL' | 'USDC' = 'USDC',
  ): Promise<string> {
    const walletAddress = getWalletAddress(wallet);
    if (!walletAddress || !testMint.value) {
      throw new Error('Wallet not connected or mint not setup');
    }

    loading.value = true;
    error.value = null;

    try {
      const connection = getConnection();
      const walletPubkey = new PublicKey(walletAddress);
      const mintPubkey = new PublicKey(testMint.value);

      const ata = getAssociatedTokenAddressSync(
        mintPubkey,
        walletPubkey,
        false,
        TOKEN_2022_PROGRAM_ID,
      );

      // Convert to token amount
      const tokenAmount = BigInt(Math.floor(amount * Math.pow(10, DECIMALS)));

      const depositIx = createDepositInstruction(
        ata,
        mintPubkey,
        walletPubkey,
        tokenAmount,
        DECIMALS,
      );

      const sig = await buildAndSendTransaction(
        connection,
        wallet as WalletAdapter,
        [depositIx],
        { description: 'deposit to confidential' },
      );

      console.log(`[CT] Deposited ${amount} tokens to pending, tx:`, sig);
      return sig;
    } catch (e: any) {
      error.value = e.message || 'Failed to deposit';
      throw e;
    } finally {
      loading.value = false;
    }
  }

  /**
   * Apply pending balance (pending -> available)
   */
  async function applyPendingBalance(
    wallet: any,
    _token: 'SOL' | 'USDC' = 'USDC',
  ): Promise<string> {
    const walletAddress = getWalletAddress(wallet);
    if (!walletAddress || !testMint.value || !hasKeys()) {
      throw new Error('Wallet not connected, mint not setup, or keys not derived');
    }

    loading.value = true;
    error.value = null;

    try {
      const connection = getConnection();
      const zkSdk = await loadZkSdk();
      const walletPubkey = new PublicKey(walletAddress);
      const mintPubkey = new PublicKey(testMint.value);
      const aeKey = getAeKey();

      const ata = getAssociatedTokenAddressSync(
        mintPubkey,
        walletPubkey,
        false,
        TOKEN_2022_PROGRAM_ID,
      );

      // Read current account state
      const accountInfo = await connection.getAccountInfo(ata);
      if (!accountInfo) {
        throw new Error('Token account not found');
      }

      // Get the pending balance credit counter
      const counter = readPendingBalanceCreditCounter(accountInfo.data);
      console.log('[CT] Pending balance credit counter:', counter.toString());

      // Read current available balance
      const decryptableBytes = readDecryptableAvailableBalance(accountInfo.data);
      let currentAvailable = 0n;
      if (decryptableBytes) {
        const ciphertext = zkSdk.AeCiphertext.fromBytes(decryptableBytes);
        if (ciphertext) {
          const decrypted = ciphertext.decrypt(aeKey);
          if (decrypted !== undefined) {
            currentAvailable = decrypted;
          }
        }
      }
      console.log('[CT] Current available balance:', currentAvailable.toString());

      // Read and decrypt pending balance
      const elGamal = getElGamalKeypair();
      const pendingCiphertexts = readPendingBalanceCiphertexts(accountInfo.data);
      let pendingAmount = 0n;
      if (pendingCiphertexts) {
        const loCiphertext = zkSdk.ElGamalCiphertext.fromBytes(pendingCiphertexts.lo);
        const hiCiphertext = zkSdk.ElGamalCiphertext.fromBytes(pendingCiphertexts.hi);
        if (loCiphertext && hiCiphertext) {
          const secretKey = elGamal.secret();
          const loAmount = secretKey.decrypt(loCiphertext);
          const hiAmount = secretKey.decrypt(hiCiphertext);
          pendingAmount = loAmount + (hiAmount << 16n);
        }
      }
      console.log('[CT] Pending amount:', pendingAmount.toString());

      // Calculate new available balance = current + pending
      const newAvailableBalance = currentAvailable + pendingAmount;
      console.log('[CT] New available balance:', newAvailableBalance.toString());

      // Encrypt the new balance for the decryptable_available_balance field
      const newDecryptableBalance = aeKey.encrypt(newAvailableBalance);
      const newDecryptableBytes = newDecryptableBalance.toBytes();

      const applyIx = createApplyPendingBalanceInstruction(
        ata,
        walletPubkey,
        counter,
        newDecryptableBytes,
      );

      const sig = await buildAndSendTransaction(
        connection,
        wallet as WalletAdapter,
        [applyIx],
        { description: 'apply pending balance' },
      );

      console.log('[CT] Applied pending balance, tx:', sig);
      return sig;
    } catch (e: any) {
      error.value = e.message || 'Failed to apply pending balance';
      throw e;
    } finally {
      loading.value = false;
    }
  }

  /**
   * Withdraw from confidential balance (private -> public)
   * This is the most complex operation requiring ZK proofs
   */
  async function withdrawFromConfidential(
    wallet: any,
    amount: number,
    _token: 'SOL' | 'USDC' = 'USDC',
  ): Promise<string> {
    const walletAddress = getWalletAddress(wallet);
    if (!walletAddress || !testMint.value || !hasKeys()) {
      throw new Error('Wallet not connected, mint not setup, or keys not derived');
    }

    loading.value = true;
    error.value = null;
    withdrawProgress.value = { step: 0, totalSteps: 6, currentStep: 'Preparing...' };

    try {
      const connection = getConnection();
      const zkSdk = await loadZkSdk();
      const walletPubkey = new PublicKey(walletAddress);
      const mintPubkey = new PublicKey(testMint.value);
      const elGamal = getElGamalKeypair();
      const aeKey = getAeKey();

      const ata = getAssociatedTokenAddressSync(
        mintPubkey,
        walletPubkey,
        false,
        TOKEN_2022_PROGRAM_ID,
      );

      const tokenAmount = BigInt(Math.floor(amount * Math.pow(10, DECIMALS)));

      // Step 1: Read current balance and generate proofs
      withdrawProgress.value = { step: 1, totalSteps: 6, currentStep: 'Generating ZK proofs...' };

      const accountInfo = await connection.getAccountInfo(ata);
      if (!accountInfo) {
        throw new Error('Token account not found');
      }

      // Get current available balance
      const decryptableBytes = readDecryptableAvailableBalance(accountInfo.data);
      let currentBalance = 0n;
      if (decryptableBytes) {
        const ciphertext = zkSdk.AeCiphertext.fromBytes(decryptableBytes);
        if (ciphertext) {
          const decrypted = ciphertext.decrypt(aeKey);
          if (decrypted !== undefined) {
            currentBalance = decrypted;
          }
        }
      }

      if (tokenAmount > currentBalance) {
        throw new Error(`Insufficient confidential balance. Have ${currentBalance}, need ${tokenAmount}`);
      }

      const newBalance = currentBalance - tokenAmount;
      console.log(`[CT] Withdrawing ${tokenAmount}, current: ${currentBalance}, new: ${newBalance}`);

      // Get current balance ciphertext for proof generation
      const currentCiphertextBytes = readAvailableBalanceCiphertext(accountInfo.data);
      if (!currentCiphertextBytes) {
        throw new Error('Could not read available balance ciphertext');
      }

      // Create ciphertext for withdraw amount using ElGamal
      const withdrawCiphertext = elGamal.pubkey().encryptU64(tokenAmount);
      const withdrawCiphertextBytes = withdrawCiphertext.toBytes();

      // Compute new balance ciphertext (homomorphic subtraction)
      const newBalanceCiphertextBytes = subtractCiphertexts(
        currentCiphertextBytes,
        withdrawCiphertextBytes,
      );

      const newBalanceCiphertext = zkSdk.ElGamalCiphertext.fromBytes(newBalanceCiphertextBytes);
      if (!newBalanceCiphertext) {
        throw new Error('Failed to parse new balance ciphertext');
      }

      // Generate equality proof
      const { PedersenOpening, PedersenCommitment, CiphertextCommitmentEqualityProofData, BatchedRangeProofU64Data } = zkSdk;

      const newBalanceOpening = new PedersenOpening();
      const newBalanceCommitment = PedersenCommitment.from(newBalance, newBalanceOpening);

      const equalityProof = new CiphertextCommitmentEqualityProofData(
        elGamal,
        newBalanceCiphertext,
        newBalanceCommitment,
        newBalanceOpening,
        newBalance,
      );
      const equalityProofBytes = equalityProof.toBytes();
      equalityProof.verify();
      console.log('[CT] Equality proof generated and verified');

      // Generate range proof (prove new balance >= 0 and <= 2^64)
      withdrawProgress.value = { step: 2, totalSteps: 6, currentStep: 'Creating proof accounts...' };

      const rangeProof = new BatchedRangeProofU64Data(
        [newBalanceCommitment],
        new BigUint64Array([newBalance]),
        new Uint8Array([64]),
        [newBalanceOpening],
      );
      const rangeProofBytes = rangeProof.toBytes();
      rangeProof.verify();
      console.log('[CT] Range proof generated and verified');

      // Step 2: Create context state accounts
      const equalityContextAccount = Keypair.generate();
      const rangeContextAccount = Keypair.generate();

      const equalityAccountSize = getContextStateAccountSize('equality');
      const rangeAccountSize = getContextStateAccountSize('range');

      const equalityRent = await connection.getMinimumBalanceForRentExemption(equalityAccountSize);
      const rangeRent = await connection.getMinimumBalanceForRentExemption(rangeAccountSize);

      // Create equality context account
      withdrawProgress.value = { step: 3, totalSteps: 6, currentStep: 'Creating equality context...' };

      const createEqualityCtxIx = SystemProgram.createAccount({
        fromPubkey: walletPubkey,
        newAccountPubkey: equalityContextAccount.publicKey,
        space: equalityAccountSize,
        lamports: equalityRent,
        programId: ZK_ELGAMAL_PROOF_PROGRAM_ID,
      });

      await signAndSendTransaction(
        connection,
        wallet as WalletAdapter,
        new Transaction().add(createEqualityCtxIx),
        {
          additionalSigners: [equalityContextAccount],
          skipPreflight: true,
          description: 'create equality context',
        },
      );

      // Verify equality proof
      withdrawProgress.value = { step: 4, totalSteps: 6, currentStep: 'Verifying equality proof...' };

      const verifyEqualityIx = createVerifyCiphertextCommitmentEqualityInstruction(
        equalityProofBytes,
        equalityContextAccount.publicKey,
        walletPubkey,
      );

      await buildAndSendTransaction(
        connection,
        wallet as WalletAdapter,
        [verifyEqualityIx],
        { skipPreflight: true, description: 'verify equality proof' },
      );

      // Create range context account
      withdrawProgress.value = { step: 5, totalSteps: 6, currentStep: 'Verifying range proof...' };

      const createRangeCtxIx = SystemProgram.createAccount({
        fromPubkey: walletPubkey,
        newAccountPubkey: rangeContextAccount.publicKey,
        space: rangeAccountSize,
        lamports: rangeRent,
        programId: ZK_ELGAMAL_PROOF_PROGRAM_ID,
      });

      await signAndSendTransaction(
        connection,
        wallet as WalletAdapter,
        new Transaction().add(createRangeCtxIx),
        {
          additionalSigners: [rangeContextAccount],
          skipPreflight: true,
          description: 'create range context',
        },
      );

      // Verify range proof
      const verifyRangeIx = createVerifyBatchedRangeProofU64Instruction(
        rangeProofBytes,
        rangeContextAccount.publicKey,
        walletPubkey,
      );

      await buildAndSendTransaction(
        connection,
        wallet as WalletAdapter,
        [verifyRangeIx],
        { skipPreflight: true, description: 'verify range proof' },
      );

      // Step 6: Execute withdrawal
      withdrawProgress.value = { step: 6, totalSteps: 6, currentStep: 'Executing withdrawal...' };

      // Encrypt new balance for storage
      const newDecryptableBalance = aeKey.encrypt(newBalance);
      const newDecryptableBytes = newDecryptableBalance.toBytes();

      const withdrawIx = createWithdrawInstruction(
        ata,
        mintPubkey,
        walletPubkey,
        tokenAmount,
        DECIMALS,
        newDecryptableBytes,
        equalityContextAccount.publicKey,
        rangeContextAccount.publicKey,
      );

      const sig = await buildAndSendTransaction(
        connection,
        wallet as WalletAdapter,
        [withdrawIx],
        { skipPreflight: true, description: 'execute withdrawal' },
      );

      console.log(`[CT] Withdrew ${amount} tokens from confidential, tx:`, sig);
      return sig;
    } catch (e: any) {
      error.value = e.message || 'Failed to withdraw';
      throw e;
    } finally {
      loading.value = false;
      withdrawProgress.value = null;
    }
  }

  /**
   * Transfer tokens confidentially to another address
   * This is a peer-to-peer confidential transfer
   */
  async function transferConfidential(
    wallet: any,
    recipientAddress: string,
    amount: number,
  ): Promise<string> {
    const walletAddress = getWalletAddress(wallet);
    if (!walletAddress || !testMint.value || !hasKeys()) {
      throw new Error('Wallet not connected, mint not setup, or keys not derived');
    }

    loading.value = true;
    error.value = null;
    withdrawProgress.value = { step: 0, totalSteps: 7, currentStep: 'Preparing transfer...' };

    try {
      const connection = getConnection();
      const zkSdk = await loadZkSdk();
      const walletPubkey = new PublicKey(walletAddress);
      const recipientPubkey = new PublicKey(recipientAddress);
      const mintPubkey = new PublicKey(testMint.value);
      const elGamal = getElGamalKeypair();
      const aeKey = getAeKey();

      // Get source ATA (sender)
      const sourceAta = getAssociatedTokenAddressSync(
        mintPubkey,
        walletPubkey,
        false,
        TOKEN_2022_PROGRAM_ID,
      );

      // Get destination ATA (recipient)
      const destAta = getAssociatedTokenAddressSync(
        mintPubkey,
        recipientPubkey,
        false,
        TOKEN_2022_PROGRAM_ID,
      );

      const tokenAmount = BigInt(Math.floor(amount * Math.pow(10, DECIMALS)));

      // Step 1: Read current balance and generate proofs
      withdrawProgress.value = { step: 1, totalSteps: 7, currentStep: 'Reading balances...' };

      const accountInfo = await connection.getAccountInfo(sourceAta);
      if (!accountInfo) {
        throw new Error('Source token account not found');
      }

      // Check destination account exists and is configured
      const destAccountInfo = await connection.getAccountInfo(destAta);
      if (!destAccountInfo) {
        throw new Error('Recipient does not have a token account for this mint');
      }
      if (!hasConfidentialTransferExtension(destAccountInfo.data)) {
        throw new Error('Recipient account is not configured for confidential transfers');
      }

      // Get current available balance
      const decryptableBytes = readDecryptableAvailableBalance(accountInfo.data);
      let currentBalance = 0n;
      if (decryptableBytes) {
        const ciphertext = zkSdk.AeCiphertext.fromBytes(decryptableBytes);
        if (ciphertext) {
          const decrypted = ciphertext.decrypt(aeKey);
          if (decrypted !== undefined) {
            currentBalance = decrypted;
          }
        }
      }

      if (tokenAmount > currentBalance) {
        throw new Error(`Insufficient confidential balance. Have ${currentBalance}, need ${tokenAmount}`);
      }

      const newBalance = currentBalance - tokenAmount;
      console.log(`[CT] Transferring ${tokenAmount}, current: ${currentBalance}, new: ${newBalance}`);

      // Step 2: Generate ZK proofs
      withdrawProgress.value = { step: 2, totalSteps: 7, currentStep: 'Generating ZK proofs...' };

      // Get current balance ciphertext
      const currentCiphertextBytes = readAvailableBalanceCiphertext(accountInfo.data);
      if (!currentCiphertextBytes) {
        throw new Error('Could not read available balance ciphertext');
      }

      // Create ciphertext for transfer amount
      const transferCiphertext = elGamal.pubkey().encryptU64(tokenAmount);
      const transferCiphertextBytes = transferCiphertext.toBytes();

      // Compute new balance ciphertext (homomorphic subtraction)
      const newBalanceCiphertextBytes = subtractCiphertexts(
        currentCiphertextBytes,
        transferCiphertextBytes,
      );

      const newBalanceCiphertext = zkSdk.ElGamalCiphertext.fromBytes(newBalanceCiphertextBytes);
      if (!newBalanceCiphertext) {
        throw new Error('Failed to parse new balance ciphertext');
      }

      // Generate equality proof
      const { PedersenOpening, PedersenCommitment, CiphertextCommitmentEqualityProofData, BatchedRangeProofU64Data } = zkSdk;

      const newBalanceOpening = new PedersenOpening();
      const newBalanceCommitment = PedersenCommitment.from(newBalance, newBalanceOpening);

      const equalityProof = new CiphertextCommitmentEqualityProofData(
        elGamal,
        newBalanceCiphertext,
        newBalanceCommitment,
        newBalanceOpening,
        newBalance,
      );
      const equalityProofBytes = equalityProof.toBytes();
      equalityProof.verify();
      console.log('[CT] Equality proof generated');

      // Generate range proof
      const rangeProof = new BatchedRangeProofU64Data(
        [newBalanceCommitment],
        new BigUint64Array([newBalance]),
        new Uint8Array([64]),
        [newBalanceOpening],
      );
      const rangeProofBytes = rangeProof.toBytes();
      rangeProof.verify();
      console.log('[CT] Range proof generated');

      // Step 3: Create context accounts
      withdrawProgress.value = { step: 3, totalSteps: 7, currentStep: 'Creating proof accounts...' };

      const equalityContextAccount = Keypair.generate();
      const rangeContextAccount = Keypair.generate();

      const equalityAccountSize = getContextStateAccountSize('equality');
      const rangeAccountSize = getContextStateAccountSize('range');

      const equalityRent = await connection.getMinimumBalanceForRentExemption(equalityAccountSize);
      const rangeRent = await connection.getMinimumBalanceForRentExemption(rangeAccountSize);

      // Create equality context account
      withdrawProgress.value = { step: 4, totalSteps: 7, currentStep: 'Creating equality context...' };

      const createEqualityCtxIx = SystemProgram.createAccount({
        fromPubkey: walletPubkey,
        newAccountPubkey: equalityContextAccount.publicKey,
        space: equalityAccountSize,
        lamports: equalityRent,
        programId: ZK_ELGAMAL_PROOF_PROGRAM_ID,
      });

      await signAndSendTransaction(
        connection,
        wallet as WalletAdapter,
        new Transaction().add(createEqualityCtxIx),
        {
          additionalSigners: [equalityContextAccount],
          skipPreflight: true,
          description: 'create equality context',
        },
      );

      // Verify equality proof
      withdrawProgress.value = { step: 5, totalSteps: 7, currentStep: 'Verifying proofs...' };

      const verifyEqualityIx = createVerifyCiphertextCommitmentEqualityInstruction(
        equalityProofBytes,
        equalityContextAccount.publicKey,
        walletPubkey,
      );

      await buildAndSendTransaction(
        connection,
        wallet as WalletAdapter,
        [verifyEqualityIx],
        { skipPreflight: true, description: 'verify equality proof' },
      );

      // Create range context account
      const createRangeCtxIx = SystemProgram.createAccount({
        fromPubkey: walletPubkey,
        newAccountPubkey: rangeContextAccount.publicKey,
        space: rangeAccountSize,
        lamports: rangeRent,
        programId: ZK_ELGAMAL_PROOF_PROGRAM_ID,
      });

      await signAndSendTransaction(
        connection,
        wallet as WalletAdapter,
        new Transaction().add(createRangeCtxIx),
        {
          additionalSigners: [rangeContextAccount],
          skipPreflight: true,
          description: 'create range context',
        },
      );

      // Verify range proof
      withdrawProgress.value = { step: 6, totalSteps: 7, currentStep: 'Verifying range proof...' };

      const verifyRangeIx = createVerifyBatchedRangeProofU64Instruction(
        rangeProofBytes,
        rangeContextAccount.publicKey,
        walletPubkey,
      );

      await buildAndSendTransaction(
        connection,
        wallet as WalletAdapter,
        [verifyRangeIx],
        { skipPreflight: true, description: 'verify range proof' },
      );

      // Step 7: Execute transfer
      withdrawProgress.value = { step: 7, totalSteps: 7, currentStep: 'Executing transfer...' };

      // Encrypt new balance for storage
      const newDecryptableBalance = aeKey.encrypt(newBalance);
      const newDecryptableBytes = newDecryptableBalance.toBytes();

      // For auditor ciphertext, we'll use zeros for now (no auditor)
      const auditorCiphertextLo = new Uint8Array(64);
      const auditorCiphertextHi = new Uint8Array(64);

      const transferIx = createConfidentialTransferInstruction(
        sourceAta,
        mintPubkey,
        destAta,
        equalityContextAccount.publicKey,
        equalityContextAccount.publicKey, // Using same for validity (simplified)
        rangeContextAccount.publicKey,
        walletPubkey,
        newDecryptableBytes,
        auditorCiphertextLo,
        auditorCiphertextHi,
      );

      const sig = await buildAndSendTransaction(
        connection,
        wallet as WalletAdapter,
        [transferIx],
        { skipPreflight: true, description: 'execute confidential transfer' },
      );

      console.log(`[CT] Transferred ${amount} tokens confidentially, tx:`, sig);
      return sig;
    } catch (e: any) {
      error.value = e.message || 'Failed to transfer';
      throw e;
    } finally {
      loading.value = false;
      withdrawProgress.value = null;
    }
  }

  /**
   * Check if account is configured for confidential transfers
   */
  async function isAccountConfigured(wallet: any): Promise<boolean> {
    const walletAddress = getWalletAddress(wallet);
    if (!walletAddress || !testMint.value) return false;

    try {
      const connection = getConnection();
      const walletPubkey = new PublicKey(walletAddress);
      const mintPubkey = new PublicKey(testMint.value);

      const ata = getAssociatedTokenAddressSync(
        mintPubkey,
        walletPubkey,
        false,
        TOKEN_2022_PROGRAM_ID,
      );

      const accountInfo = await connection.getAccountInfo(ata);
      if (!accountInfo) return false;

      return hasConfidentialTransferExtension(accountInfo.data);
    } catch (e) {
      return false;
    }
  }

  /**
   * Fetch transaction history from the blockchain
   * Detects CT operations by analyzing token balance changes
   * Always fetches fresh from RPC - no local storage
   */
  async function fetchTransactionHistory(wallet: any): Promise<void> {
    const walletAddress = getWalletAddress(wallet);
    if (!walletAddress || !testMint.value) return;

    try {
      const connection = getConnection();
      const walletPubkey = new PublicKey(walletAddress);
      const mintPubkey = new PublicKey(testMint.value);

      const ata = getAssociatedTokenAddressSync(
        mintPubkey,
        walletPubkey,
        false,
        TOKEN_2022_PROGRAM_ID,
      );

      // Get recent transaction signatures for the token account
      const signatures = await connection.getSignaturesForAddress(ata, { limit: 30 });

      // Build fresh transaction list from RPC
      const freshTransactions: CTTransaction[] = [];
      const seenSignatures = new Set<string>();

      // Fetch and parse each transaction
      for (const sigInfo of signatures) {
        // Skip failed transactions or duplicates
        if (sigInfo.err) continue;
        if (seenSignatures.has(sigInfo.signature)) continue;
        seenSignatures.add(sigInfo.signature);

        try {
          const tx = await connection.getTransaction(sigInfo.signature, {
            maxSupportedTransactionVersion: 0,
          });

          if (!tx || !tx.meta) continue;

          // Find the token account index in the account keys
          const accountKeys = tx.transaction.message.staticAccountKeys ||
            (tx.transaction.message as any).accountKeys || [];
          const ataIndex = accountKeys.findIndex((key: PublicKey) => key.equals(ata));

          if (ataIndex === -1) continue;

          // Get pre and post token balances
          const preBalances = tx.meta.preTokenBalances || [];
          const postBalances = tx.meta.postTokenBalances || [];

          const preBalance = preBalances.find(b => b.accountIndex === ataIndex);
          const postBalance = postBalances.find(b => b.accountIndex === ataIndex);

          const prePubAmount = preBalance?.uiTokenAmount?.uiAmount || 0;
          const postPubAmount = postBalance?.uiTokenAmount?.uiAmount || 0;

          // Check log messages for CT operations
          const logs = tx.meta.logMessages || [];
          const logStr = logs.join(' ').toLowerCase();

          // Detect transaction type based on log messages (most reliable)
          let txType: CTTransaction['type'] | null = null;
          let amount = 0;

          // Skip mint transactions - they have "MintTo" in logs
          if (logStr.includes('mintto') || logStr.includes('mint_to')) {
            continue;
          }

          // Check for specific CT operations in logs
          if (logStr.includes('confidentialtransferdeposit') ||
              (logStr.includes('deposit') && !logStr.includes('withdraw'))) {
            txType = 'deposit';
            amount = prePubAmount - postPubAmount; // Public decreases on deposit
          } else if (logStr.includes('applypendingbalance') ||
                     logStr.includes('apply_pending')) {
            txType = 'apply';
            amount = 0; // Apply doesn't change public balance
          } else if (logStr.includes('confidentialtransferwithdraw') ||
                     (logStr.includes('withdraw') && logStr.includes('confidential'))) {
            txType = 'withdraw';
            amount = postPubAmount - prePubAmount; // Public increases on withdraw
          } else if (logStr.includes('confidentialtransfer') && !logStr.includes('mint')) {
            // Generic confidential transfer (could be peer-to-peer)
            txType = 'transfer';
            amount = 0; // Amount is encrypted
          } else if (prePubAmount > postPubAmount && Math.abs(prePubAmount - postPubAmount) > 0.0001) {
            // Public balance decreased without mint - likely a deposit
            txType = 'deposit';
            amount = prePubAmount - postPubAmount;
          }

          if (txType && (amount > 0 || txType === 'apply' || txType === 'transfer')) {
            freshTransactions.push({
              id: sigInfo.signature.slice(0, 16),
              type: txType,
              amount: Math.abs(amount),
              signature: sigInfo.signature,
              timestamp: sigInfo.blockTime ? sigInfo.blockTime * 1000 : Date.now(),
              status: 'success',
            });
          }
        } catch (txError) {
          console.debug('[CT] Failed to parse transaction:', sigInfo.signature.slice(0, 8));
        }
      }

      // Sort by timestamp (newest first) and update the ref
      freshTransactions.sort((a, b) => b.timestamp - a.timestamp);
      transactions.value = freshTransactions.slice(0, 50);

      console.log(`[CT] Fetched ${transactions.value.length} transactions from RPC`);
    } catch (e) {
      console.error('[CT] Failed to fetch transaction history:', e);
    }
  }

  return {
    // State
    loading,
    error,
    elGamalPublicKey,
    testMint,
    withdrawProgress,
    transactions,

    // Functions
    deriveElGamalKeypair,
    setupTestMint,
    setupTokenAccount,
    configureConfidentialTransferAccount,
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
    clearTransactionHistory,
  };
}

/**
 * Confidential Transfer End-to-End Example
 *
 * This script replicates the Rust example from:
 * https://github.com/gitteri/confidential-balances-exploration/blob/main/examples/run_transfer.rs
 *
 * It demonstrates the full confidential transfer flow using the ZK-Edge cluster
 * which has the ZK ElGamal Proof program enabled.
 *
 * Usage:
 *   npx tsx scripts/run-confidential-transfer.ts
 */

import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL,
  SYSVAR_INSTRUCTIONS_PUBKEY,
} from '@solana/web3.js';
import {
  TOKEN_2022_PROGRAM_ID,
  ExtensionType,
  getMintLen,
  createInitializeMintInstruction,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddressSync,
  createMintToInstruction,
  getAccount,
} from '@solana/spl-token';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { RistrettoPoint } from '@noble/curves/ed25519';

// ============================================
// CONFIGURATION - ZK-Edge Cluster
// ============================================

const RPC_URL = 'https://zk-edge.surfnet.dev:8899';
const WS_URL = 'wss://zk-edge.surfnet.dev:8900';

const DECIMALS = 9;
const MINT_AMOUNT = 1_000_000_000n; // 1 token with 9 decimals
const DEPOSIT_AMOUNT = 800_000_000n; // 0.8 tokens
const TRANSFER_AMOUNT = 100_000_000n; // 0.1 tokens

// Test mode: only test proof generation without submitting transactions
const TEST_PROOFS_ONLY = process.argv.includes('--test-proofs');

// ZK ElGamal Proof Program ID
const ZK_ELGAMAL_PROOF_PROGRAM_ID = new PublicKey(
  'ZkE1Gama1Proof11111111111111111111111111111',
);

// ============================================
// ZK SDK Types (loaded dynamically)
// ============================================

// Import types from the ZK SDK package for proper IntelliSense
type ZkSdkModule = typeof import('@solana/zk-sdk/node');

let zkSdk: ZkSdkModule;

// ============================================
// HELPER FUNCTIONS
// ============================================

function loadKeypair(filepath?: string): Keypair {
  const defaultPath = path.join(os.homedir(), '.config', 'solana', 'id.json');
  const keypairPath = filepath || process.env.PAYER_KEYPAIR || defaultPath;

  try {
    const keypairData = JSON.parse(fs.readFileSync(keypairPath, 'utf-8'));
    return Keypair.fromSecretKey(Uint8Array.from(keypairData));
  } catch (error) {
    console.error(`Failed to load keypair from ${keypairPath}:`, error);
    throw error;
  }
}

function formatBalance(amount: bigint | number, decimals: number): string {
  const value = typeof amount === 'bigint' ? Number(amount) : amount;
  return (value / Math.pow(10, decimals)).toFixed(decimals);
}

// ============================================
// RISTRETTO POINT ARITHMETIC FOR HOMOMORPHIC OPERATIONS
// ============================================

/**
 * ElGamal ciphertext structure:
 * - 32 bytes: Pedersen commitment (Ristretto point)
 * - 32 bytes: Decrypt handle (Ristretto point)
 */
interface CiphertextComponents {
  commitment: Uint8Array;
  handle: Uint8Array;
}

/**
 * Parse an ElGamal ciphertext into its commitment and handle components
 */
function parseCiphertext(ciphertextBytes: Uint8Array): CiphertextComponents {
  if (ciphertextBytes.length !== 64) {
    throw new Error(
      `Invalid ciphertext length: ${ciphertextBytes.length}, expected 64`,
    );
  }
  return {
    commitment: ciphertextBytes.slice(0, 32),
    handle: ciphertextBytes.slice(32, 64),
  };
}

/**
 * Combine commitment and handle back into ciphertext bytes
 */
function combineCiphertext(components: CiphertextComponents): Uint8Array {
  const result = new Uint8Array(64);
  result.set(components.commitment, 0);
  result.set(components.handle, 32);
  return result;
}

/**
 * Subtract two Ristretto points (P1 - P2)
 */
function subtractPoints(p1Bytes: Uint8Array, p2Bytes: Uint8Array): Uint8Array {
  try {
    const p1 = RistrettoPoint.fromBytes(p1Bytes);
    const p2 = RistrettoPoint.fromBytes(p2Bytes);
    const result = p1.subtract(p2);
    return result.toBytes();
  } catch (e: any) {
    console.error('subtractPoints failed:');
    console.error('  p1Bytes:', Buffer.from(p1Bytes).toString('hex'));
    console.error('  p2Bytes:', Buffer.from(p2Bytes).toString('hex'));
    throw new Error(`subtractPoints failed: ${e.message || e}`);
  }
}

/**
 * Add two Ristretto points (P1 + P2)
 */
function addPoints(p1Bytes: Uint8Array, p2Bytes: Uint8Array): Uint8Array {
  try {
    const p1 = RistrettoPoint.fromBytes(p1Bytes);
    const p2 = RistrettoPoint.fromBytes(p2Bytes);
    const result = p1.add(p2);
    return result.toBytes();
  } catch (e: any) {
    console.error('addPoints failed:');
    console.error('  p1Bytes:', Buffer.from(p1Bytes).toString('hex'));
    console.error('  p2Bytes:', Buffer.from(p2Bytes).toString('hex'));
    throw new Error(`addPoints failed: ${e.message || e}`);
  }
}

/**
 * Scalar multiply a Ristretto point (scalar * P)
 */
function scalarMultiply(pointBytes: Uint8Array, scalar: bigint): Uint8Array {
  try {
    const point = RistrettoPoint.fromBytes(pointBytes);
    const result = point.multiply(scalar);
    return result.toBytes();
  } catch (e: any) {
    console.error('scalarMultiply failed:');
    console.error('  pointBytes:', Buffer.from(pointBytes).toString('hex'));
    console.error('  scalar:', scalar.toString());
    throw new Error(`scalarMultiply failed: ${e.message || e}`);
  }
}

/**
 * Homomorphic subtraction of ElGamal ciphertexts: C1 - C2
 * For ElGamal: (commitment1 - commitment2, handle1 - handle2)
 */
function subtractCiphertexts(
  c1Bytes: Uint8Array,
  c2Bytes: Uint8Array,
): Uint8Array {
  const c1 = parseCiphertext(c1Bytes);
  const c2 = parseCiphertext(c2Bytes);

  return combineCiphertext({
    commitment: subtractPoints(c1.commitment, c2.commitment),
    handle: subtractPoints(c1.handle, c2.handle),
  });
}

/**
 * Homomorphic addition of ElGamal ciphertexts: C1 + C2
 */
function addCiphertexts(c1Bytes: Uint8Array, c2Bytes: Uint8Array): Uint8Array {
  const c1 = parseCiphertext(c1Bytes);
  const c2 = parseCiphertext(c2Bytes);

  return combineCiphertext({
    commitment: addPoints(c1.commitment, c2.commitment),
    handle: addPoints(c1.handle, c2.handle),
  });
}

/**
 * Scalar multiply a ciphertext: scalar * C
 */
function scalarMultiplyCiphertext(
  ciphertextBytes: Uint8Array,
  scalar: bigint,
): Uint8Array {
  const c = parseCiphertext(ciphertextBytes);

  return combineCiphertext({
    commitment: scalarMultiply(c.commitment, scalar),
    handle: scalarMultiply(c.handle, scalar),
  });
}

/**
 * Combine lo and hi ciphertexts: lo + (hi << shift_bits)
 * This replicates try_combine_lo_hi_ciphertexts from Rust
 */
function combineLowHighCiphertexts(
  loBytes: Uint8Array,
  hiBytes: Uint8Array,
  shiftBits: number,
): Uint8Array {
  // hi_scaled = hi * 2^shiftBits
  const hiScaled = scalarMultiplyCiphertext(
    hiBytes,
    BigInt(1) << BigInt(shiftBits),
  );
  // combined = lo + hi_scaled
  return addCiphertexts(loBytes, hiScaled);
}

async function sendTransaction(
  connection: Connection,
  transaction: Transaction,
  signers: Keypair[],
  options: { skipPreflight?: boolean; maxRetries?: number } = {},
): Promise<string> {
  const maxAttempts = 10;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      // Wait a bit before getting blockhash to let the cluster sync
      if (attempt > 1) {
        await new Promise((resolve) => setTimeout(resolve, 3000 * attempt));
      }

      // Get fresh blockhash with confirmed commitment (less strict than finalized)
      const { blockhash, lastValidBlockHeight } =
        await connection.getLatestBlockhash('confirmed');

      // Create a fresh transaction instance for each attempt
      const tx = new Transaction();
      tx.add(...transaction.instructions);
      tx.recentBlockhash = blockhash;
      tx.feePayer = signers[0].publicKey;

      // Sign the transaction
      tx.sign(...signers);

      // Send raw transaction for more control
      const signature = await connection.sendRawTransaction(tx.serialize(), {
        skipPreflight: options.skipPreflight ?? false,
        maxRetries: options.maxRetries ?? 5,
        preflightCommitment: 'confirmed',
      });

      // Wait a bit before confirming
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Confirm with timeout - use a simple polling approach
      let confirmed = false;
      let txError: any = null;
      for (let i = 0; i < 30; i++) {
        try {
          const status = await connection.getSignatureStatus(signature);

          // Check for transaction error first
          if (status?.value?.err) {
            txError = status.value.err;
            // Transaction was included but failed - don't retry, throw immediately
            throw new Error(
              `Transaction failed on-chain: ${JSON.stringify(status.value.err)}`,
            );
          }

          if (
            status?.value?.confirmationStatus === 'confirmed' ||
            status?.value?.confirmationStatus === 'finalized'
          ) {
            confirmed = true;
            break;
          }
        } catch (e: any) {
          // Re-throw transaction errors, only ignore network polling errors
          if (e.message?.includes('Transaction failed on-chain')) {
            throw e;
          }
          // Ignore other polling errors (network issues, etc.)
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      if (!confirmed) {
        // Try one more confirmation check
        const finalStatus = await connection.getSignatureStatus(signature);

        // Check for error in final status
        if (finalStatus?.value?.err) {
          throw new Error(
            `Transaction failed on-chain: ${JSON.stringify(finalStatus.value.err)}`,
          );
        }

        if (
          finalStatus?.value?.confirmationStatus === 'confirmed' ||
          finalStatus?.value?.confirmationStatus === 'finalized'
        ) {
          confirmed = true;
        }
      }

      if (confirmed) {
        return signature;
      }

      throw new Error('Transaction confirmation timeout');
    } catch (error: any) {
      // Don't retry on account-related errors (account already exists, etc.)
      const isAccountError =
        error.message?.includes('already in use') ||
        error.message?.includes('AccountInUse') ||
        error.message?.includes('custom program error: 0x0');

      if (isAccountError) {
        throw error; // Don't retry - account state changed
      }

      const isBlockhashError =
        error.message?.includes('Blockhash not found') ||
        error.message?.includes('block height exceeded') ||
        error.message?.includes('confirmation timeout');

      if (isBlockhashError && attempt < maxAttempts) {
        console.log(
          `      Retry ${attempt}/${maxAttempts} due to blockhash/confirmation issue...`,
        );
        continue;
      }
      throw error;
    }
  }

  throw new Error('Max retries exceeded');
}

// ============================================
// CONFIDENTIAL TRANSFER INSTRUCTIONS
// ============================================

/**
 * Create instruction to initialize ConfidentialTransferMint extension
 *
 * Data format (from spl-token-2022):
 * - 1 byte: TokenInstruction discriminator (27 = ConfidentialTransferExtension)
 * - 1 byte: ConfidentialTransferInstruction discriminator (0 = InitializeMint)
 * - 32 bytes: OptionalNonZeroPubkey authority (all zeros = None)
 * - 1 byte: auto_approve_new_accounts (PodBool: 0=false, 1=true)
 * - 32 bytes: OptionalNonZeroElGamalPubkey auditor (all zeros = None)
 *
 * Total: 2 + 32 + 1 + 32 = 67 bytes
 */
function createInitializeConfidentialTransferMintInstruction(
  mint: PublicKey,
  authority: PublicKey | null,
  autoApproveNewAccounts: boolean,
  auditorElGamalPubkey: Uint8Array | null,
  programId: PublicKey = TOKEN_2022_PROGRAM_ID,
): TransactionInstruction {
  // Data size: 2 (discriminators) + 32 (authority) + 1 (auto_approve) + 32 (auditor) = 67
  const data = Buffer.alloc(67);
  let offset = 0;

  // TokenInstruction::ConfidentialTransferExtension = 27
  data.writeUInt8(27, offset);
  offset += 1;

  // ConfidentialTransferInstruction::InitializeMint = 0
  data.writeUInt8(0, offset);
  offset += 1;

  // Authority (OptionalNonZeroPubkey): 32 bytes, all zeros = None
  if (authority) {
    authority.toBuffer().copy(data, offset);
  }
  // else: leave as zeros (already initialized to 0)
  offset += 32;

  // Auto-approve new accounts (PodBool: u8)
  data.writeUInt8(autoApproveNewAccounts ? 1 : 0, offset);
  offset += 1;

  // Auditor ElGamal pubkey (OptionalNonZeroElGamalPubkey): 32 bytes, all zeros = None
  if (auditorElGamalPubkey && auditorElGamalPubkey.length === 32) {
    Buffer.from(auditorElGamalPubkey).copy(data, offset);
  }
  // else: leave as zeros

  return new TransactionInstruction({
    keys: [{ pubkey: mint, isSigner: false, isWritable: true }],
    programId,
    data,
  });
}

/**
 * Create instruction to reallocate account for new extension
 *
 * TokenInstruction::Reallocate = 29
 */
function createReallocateInstruction(
  account: PublicKey,
  payer: PublicKey,
  owner: PublicKey,
  extensionTypes: ExtensionType[],
  programId: PublicKey = TOKEN_2022_PROGRAM_ID,
): TransactionInstruction {
  // Data: 1 byte discriminator + 2 bytes per extension type
  const data = Buffer.alloc(1 + extensionTypes.length * 2);
  data.writeUInt8(29, 0); // Reallocate discriminator

  extensionTypes.forEach((ext, i) => {
    data.writeUInt16LE(ext, 1 + i * 2);
  });

  return new TransactionInstruction({
    keys: [
      { pubkey: account, isSigner: false, isWritable: true },
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: owner, isSigner: true, isWritable: false },
    ],
    programId,
    data,
  });
}

/**
 * Create instruction to configure account for confidential transfers
 *
 * ConfidentialTransferInstruction::ConfigureAccount = 2
 *
 * Accounts:
 * 0. [writable] The SPL Token account
 * 1. [] The corresponding SPL Token mint
 * 2. [] Instructions sysvar (if proof is in same transaction)
 * 3. [signer] The single account owner
 *
 * Data:
 * - discriminator (2 bytes)
 * - decryptable_zero_balance (36 bytes AeCiphertext)
 * - max_pending_balance_credit_counter (8 bytes)
 * - proof_instruction_offset (1 byte signed i8)
 */
function createConfigureAccountInstruction(
  account: PublicKey,
  mint: PublicKey,
  authority: PublicKey,
  decryptableZeroBalance: Uint8Array, // AES-encrypted zero (36 bytes)
  maxPendingBalanceCreditCounter: bigint,
  proofInstructionOffset: number,
  programId: PublicKey = TOKEN_2022_PROGRAM_ID,
): TransactionInstruction {
  const data = Buffer.alloc(2 + 36 + 8 + 1);
  let offset = 0;

  data.writeUInt8(27, offset); // ConfidentialTransferExtension
  offset += 1;

  data.writeUInt8(2, offset); // ConfigureAccount = 2
  offset += 1;

  // Decryptable zero balance (36 bytes for AeCiphertext)
  Buffer.from(decryptableZeroBalance).copy(data, offset, 0, 36);
  offset += 36;

  // Max pending balance credit counter (u64)
  const counterBuf = Buffer.alloc(8);
  counterBuf.writeBigUInt64LE(maxPendingBalanceCreditCounter);
  counterBuf.copy(data, offset);
  offset += 8;

  // Proof instruction offset (i8)
  data.writeInt8(proofInstructionOffset, offset);

  return new TransactionInstruction({
    keys: [
      { pubkey: account, isSigner: false, isWritable: true },
      { pubkey: mint, isSigner: false, isWritable: false },
      {
        pubkey: SYSVAR_INSTRUCTIONS_PUBKEY,
        isSigner: false,
        isWritable: false,
      },
      { pubkey: authority, isSigner: true, isWritable: false },
    ],
    programId,
    data,
  });
}

/**
 * Create instruction to verify pubkey validity proof
 *
 * ZK ElGamal Proof Program instruction discriminators:
 * - CloseContextState = 0
 * - VerifyZeroCiphertext = 1
 * - VerifyCiphertextCiphertextEquality = 2
 * - VerifyCiphertextCommitmentEquality = 3
 * - VerifyPubkeyValidity = 4
 * - VerifyPercentageWithCap = 5
 * - VerifyBatchedRangeProofU64 = 6
 * - etc.
 */
function createVerifyPubkeyValidityInstruction(
  proofData: Uint8Array,
): TransactionInstruction {
  // The proof is submitted to the ZK ElGamal Proof program
  // Discriminator for VerifyPubkeyValidity = 4

  const data = Buffer.alloc(1 + proofData.length);
  data.writeUInt8(4, 0); // VerifyPubkeyValidity = 4
  Buffer.from(proofData).copy(data, 1);

  return new TransactionInstruction({
    keys: [],
    programId: ZK_ELGAMAL_PROOF_PROGRAM_ID,
    data,
  });
}

/**
 * Create instruction to deposit tokens to confidential balance
 *
 * ConfidentialTransferInstruction::Deposit = 2
 */
function createDepositInstruction(
  account: PublicKey,
  mint: PublicKey,
  owner: PublicKey,
  amount: bigint,
  decimals: number,
  programId: PublicKey = TOKEN_2022_PROGRAM_ID,
): TransactionInstruction {
  const data = Buffer.alloc(2 + 8 + 1);
  let offset = 0;

  data.writeUInt8(27, offset); // ConfidentialTransferExtension
  offset += 1;

  data.writeUInt8(5, offset); // Deposit = 5
  offset += 1;

  // Amount (u64)
  const amountBuf = Buffer.alloc(8);
  amountBuf.writeBigUInt64LE(amount);
  amountBuf.copy(data, offset);
  offset += 8;

  // Decimals (u8)
  data.writeUInt8(decimals, offset);

  return new TransactionInstruction({
    keys: [
      { pubkey: account, isSigner: false, isWritable: true },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: owner, isSigner: true, isWritable: false },
    ],
    programId,
    data,
  });
}

/**
 * Create instruction to apply pending balance
 *
 * ConfidentialTransferInstruction::ApplyPendingBalance = 8
 *
 * Accounts:
 * 0. [writable] The SPL Token account
 * 1. [signer] The single account owner
 *
 * Data:
 * - expected_pending_balance_credit_counter: u64 (8 bytes)
 * - new_decryptable_available_balance: DecryptableBalance (36 bytes)
 */
function createApplyPendingBalanceInstruction(
  account: PublicKey,
  owner: PublicKey,
  expectedPendingBalanceCreditCounter: bigint,
  newDecryptableAvailableBalance: Uint8Array, // 36 bytes AeCiphertext
  programId: PublicKey = TOKEN_2022_PROGRAM_ID,
): TransactionInstruction {
  const data = Buffer.alloc(2 + 8 + 36);
  let offset = 0;

  data.writeUInt8(27, offset); // ConfidentialTransferExtension
  offset += 1;

  data.writeUInt8(8, offset); // ApplyPendingBalance = 8
  offset += 1;

  // Expected pending balance credit counter (u64)
  const counterBuf = Buffer.alloc(8);
  counterBuf.writeBigUInt64LE(expectedPendingBalanceCreditCounter);
  counterBuf.copy(data, offset);
  offset += 8;

  // New decryptable available balance (36 bytes)
  Buffer.from(newDecryptableAvailableBalance).copy(data, offset, 0, 36);

  return new TransactionInstruction({
    keys: [
      { pubkey: account, isSigner: false, isWritable: true },
      { pubkey: owner, isSigner: true, isWritable: false },
    ],
    programId,
    data,
  });
}

// ============================================
// CONTEXT STATE ACCOUNT INSTRUCTIONS
// ============================================

/**
 * Context state accounts are used to store ZK proofs that are too large
 * to fit in a single transaction. The flow is:
 * 1. Create context state account
 * 2. Write proof to it (via verify instruction with context authority)
 * 3. Reference it in the transfer instruction
 * 4. Close it to reclaim rent
 */

/**
 * Calculate the size needed for a context state account
 * Based on the proof type being stored
 */
function getContextStateAccountSize(
  proofType: 'equality' | 'validity' | 'range',
): number {
  // Context state account layout:
  // - 1 byte: is_initialized
  // - 32 bytes: context_state_authority
  // - Variable bytes: proof context data
  //
  // Proof context sizes (from ZK SDK structs):
  // - CiphertextCommitmentEqualityProofContext (used for transfers):
  //   - source_pubkey (32) + source_ciphertext (64) + destination_commitment (32) = 128 bytes
  // - BatchedGroupedCiphertext3HandlesValidityProofContext:
  //   - 3 pubkeys (96) + 2 grouped ciphertexts (128 each = 256) = 352 bytes
  // - BatchedRangeProofContext: 8×32 + 8 = 264 bytes

  const headerSize = 1 + 32;

  switch (proofType) {
    case 'equality':
      // CiphertextCommitmentEqualityProofContext: 32 + 64 + 32 = 128 bytes
      return headerSize + 128; // 161 bytes total
    case 'validity':
      return headerSize + 352; // 385 bytes total
    case 'range':
      // BatchedRangeProofContext (same for U64, U128, U256):
      // - MAX_COMMITMENTS (8) × 32 bytes for PedersenCommitments = 256 bytes
      // - MAX_COMMITMENTS (8) × 1 byte for bit_lengths = 8 bytes
      // Total context: 264 bytes
      // Note: Confidential transfers use U128 (discriminator 7), not U64
      return headerSize + 264; // 297 bytes total
    default:
      return headerSize + 256; // Default padding
  }
}

/**
 * Create instruction to verify ciphertext-ciphertext equality proof
 * and store result in a context state account
 *
 * ZK Proof instruction discriminators:
 * - VerifyCiphertextCiphertextEquality = 2
 *
 * When context_state_account is provided, the proof is verified and
 * the result is stored in the context state account for later reference.
 */
function createVerifyCiphertextCiphertextEqualityInstruction(
  proofData: Uint8Array,
  contextStateAccount?: PublicKey,
  contextStateAuthority?: PublicKey,
): TransactionInstruction {
  const data = Buffer.alloc(1 + proofData.length);
  data.writeUInt8(2, 0); // VerifyCiphertextCiphertextEquality = 2
  Buffer.from(proofData).copy(data, 1);

  const keys: { pubkey: PublicKey; isSigner: boolean; isWritable: boolean }[] =
    [];

  if (contextStateAccount && contextStateAuthority) {
    keys.push(
      { pubkey: contextStateAccount, isSigner: false, isWritable: true },
      { pubkey: contextStateAuthority, isSigner: false, isWritable: false },
    );
  }

  return new TransactionInstruction({
    keys,
    programId: ZK_ELGAMAL_PROOF_PROGRAM_ID,
    data,
  });
}

/**
 * Create instruction to verify ciphertext-commitment equality proof
 * and store result in a context state account
 *
 * ZK Proof instruction discriminators:
 * - VerifyCiphertextCommitmentEquality = 3
 *
 * This proof type is used for confidential transfers to prove that
 * the new balance ciphertext (computed homomorphically) equals
 * the commitment used in the range proof.
 */
function createVerifyCiphertextCommitmentEqualityInstruction(
  proofData: Uint8Array,
  contextStateAccount?: PublicKey,
  contextStateAuthority?: PublicKey,
): TransactionInstruction {
  const data = Buffer.alloc(1 + proofData.length);
  data.writeUInt8(3, 0); // VerifyCiphertextCommitmentEquality = 3
  Buffer.from(proofData).copy(data, 1);

  const keys: { pubkey: PublicKey; isSigner: boolean; isWritable: boolean }[] =
    [];

  if (contextStateAccount && contextStateAuthority) {
    keys.push(
      { pubkey: contextStateAccount, isSigner: false, isWritable: true },
      { pubkey: contextStateAuthority, isSigner: false, isWritable: false },
    );
  }

  return new TransactionInstruction({
    keys,
    programId: ZK_ELGAMAL_PROOF_PROGRAM_ID,
    data,
  });
}

/**
 * Create instruction to verify batched grouped ciphertext validity proof (3 handles)
 *
 * ZK Proof instruction discriminators (from agave zk-sdk):
 * - CloseContextState = 0
 * - VerifyZeroCiphertext = 1
 * - VerifyCiphertextCiphertextEquality = 2
 * - VerifyCiphertextCommitmentEquality = 3
 * - VerifyPubkeyValidity = 4
 * - VerifyPercentageWithCap = 5
 * - VerifyBatchedRangeProofU64 = 6
 * - VerifyBatchedRangeProofU128 = 7
 * - VerifyBatchedRangeProofU256 = 8
 * - VerifyGroupedCiphertext2HandlesValidity = 9
 * - VerifyBatchedGroupedCiphertext2HandlesValidity = 10
 * - VerifyGroupedCiphertext3HandlesValidity = 11
 * - VerifyBatchedGroupedCiphertext3HandlesValidity = 12
 */
function createVerifyBatchedGroupedCiphertext3HandlesValidityInstruction(
  proofData: Uint8Array,
  contextStateAccount?: PublicKey,
  contextStateAuthority?: PublicKey,
): TransactionInstruction {
  const data = Buffer.alloc(1 + proofData.length);
  data.writeUInt8(12, 0); // VerifyBatchedGroupedCiphertext3HandlesValidity = 12
  Buffer.from(proofData).copy(data, 1);

  const keys: { pubkey: PublicKey; isSigner: boolean; isWritable: boolean }[] =
    [];

  if (contextStateAccount && contextStateAuthority) {
    keys.push(
      { pubkey: contextStateAccount, isSigner: false, isWritable: true },
      { pubkey: contextStateAuthority, isSigner: false, isWritable: false },
    );
  }

  return new TransactionInstruction({
    keys,
    programId: ZK_ELGAMAL_PROOF_PROGRAM_ID,
    data,
  });
}

/**
 * Create instruction to verify batched range proof U64
 *
 * ZK Proof instruction discriminators:
 * - VerifyBatchedRangeProofU64 = 6
 */
function createVerifyBatchedRangeProofU64Instruction(
  proofData: Uint8Array,
  contextStateAccount?: PublicKey,
  contextStateAuthority?: PublicKey,
): TransactionInstruction {
  const data = Buffer.alloc(1 + proofData.length);
  data.writeUInt8(6, 0); // VerifyBatchedRangeProofU64 = 6
  Buffer.from(proofData).copy(data, 1);

  const keys: { pubkey: PublicKey; isSigner: boolean; isWritable: boolean }[] =
    [];

  if (contextStateAccount && contextStateAuthority) {
    keys.push(
      { pubkey: contextStateAccount, isSigner: false, isWritable: true },
      { pubkey: contextStateAuthority, isSigner: false, isWritable: false },
    );
  }

  return new TransactionInstruction({
    keys,
    programId: ZK_ELGAMAL_PROOF_PROGRAM_ID,
    data,
  });
}

/**
 * Create instruction to verify batched range proof U128
 *
 * ZK Proof instruction discriminators:
 * - VerifyBatchedRangeProofU128 = 7
 *
 * Confidential transfers use U128 range proofs with 4 commitments:
 * - new_available_balance (64 bits)
 * - transfer_amount_lo (16 bits)
 * - transfer_amount_hi (32 bits)
 * - padding (16 bits)
 */
function createVerifyBatchedRangeProofU128Instruction(
  proofData: Uint8Array,
  contextStateAccount?: PublicKey,
  contextStateAuthority?: PublicKey,
): TransactionInstruction {
  const data = Buffer.alloc(1 + proofData.length);
  data.writeUInt8(7, 0); // VerifyBatchedRangeProofU128 = 7
  Buffer.from(proofData).copy(data, 1);

  const keys: { pubkey: PublicKey; isSigner: boolean; isWritable: boolean }[] =
    [];

  if (contextStateAccount && contextStateAuthority) {
    keys.push(
      { pubkey: contextStateAccount, isSigner: false, isWritable: true },
      { pubkey: contextStateAuthority, isSigner: false, isWritable: false },
    );
  }

  return new TransactionInstruction({
    keys,
    programId: ZK_ELGAMAL_PROOF_PROGRAM_ID,
    data,
  });
}

/**
 * Create instruction to close a context state account
 *
 * ZK Proof instruction discriminators:
 * - CloseContextState = 0
 */
function createCloseContextStateInstruction(
  contextStateAccount: PublicKey,
  destination: PublicKey,
  contextStateAuthority: PublicKey,
): TransactionInstruction {
  const data = Buffer.alloc(1);
  data.writeUInt8(0, 0); // CloseContextState = 0

  return new TransactionInstruction({
    keys: [
      { pubkey: contextStateAccount, isSigner: false, isWritable: true },
      { pubkey: destination, isSigner: false, isWritable: true },
      { pubkey: contextStateAuthority, isSigner: true, isWritable: false },
    ],
    programId: ZK_ELGAMAL_PROOF_PROGRAM_ID,
    data,
  });
}

// ============================================
// CONFIDENTIAL TRANSFER INSTRUCTION
// ============================================

/**
 * Create instruction to transfer tokens confidentially
 *
 * ConfidentialTransferInstruction::Transfer = 7
 *
 * The transfer instruction references the three proof context state accounts
 * that contain the pre-verified proofs.
 *
 * Accounts for Transfer with context state accounts (when all offsets = 0):
 * 0. [writable] Source token account
 * 1. [] Token mint
 * 2. [writable] Destination token account
 * 3. [] Equality proof context state account
 * 4. [] Ciphertext validity proof context state account
 * 5. [] Range proof context state account
 * 6. [signer] Source account owner
 *
 * Note: Instructions sysvar is NOT needed when using context state accounts.
 *
 * TransferInstructionData format:
 * - new_source_decryptable_available_balance: 36 bytes (AeCiphertext)
 * - transfer_amount_auditor_ciphertext_lo: 64 bytes (ElGamalCiphertext)
 * - transfer_amount_auditor_ciphertext_hi: 64 bytes (ElGamalCiphertext)
 * - equality_proof_instruction_offset: 1 byte (i8) - 0 when using context accounts
 * - ciphertext_validity_proof_instruction_offset: 1 byte (i8)
 * - range_proof_instruction_offset: 1 byte (i8)
 */
function createConfidentialTransferInstruction(
  sourceAccount: PublicKey,
  mint: PublicKey,
  destinationAccount: PublicKey,
  equalityProofContext: PublicKey,
  validityProofContext: PublicKey,
  rangeProofContext: PublicKey,
  owner: PublicKey,
  newSourceDecryptableBalance: Uint8Array, // 36 bytes (AeCiphertext)
  auditorCiphertextLo: Uint8Array, // 64 bytes (ElGamalCiphertext) - for auditor
  auditorCiphertextHi: Uint8Array, // 64 bytes (ElGamalCiphertext) - for auditor
  programId: PublicKey = TOKEN_2022_PROGRAM_ID,
): TransactionInstruction {
  // Data size: 2 (discriminators) + 36 + 64 + 64 + 1 + 1 + 1 = 169 bytes
  const data = Buffer.alloc(169);
  let offset = 0;

  // TokenInstruction discriminator
  data.writeUInt8(27, offset); // ConfidentialTransferExtension = 27
  offset += 1;

  // ConfidentialTransferInstruction discriminator
  data.writeUInt8(7, offset); // Transfer = 7
  offset += 1;

  // new_source_decryptable_available_balance (36 bytes)
  Buffer.from(newSourceDecryptableBalance).copy(data, offset, 0, 36);
  offset += 36;

  // transfer_amount_auditor_ciphertext_lo (64 bytes)
  Buffer.from(auditorCiphertextLo).copy(data, offset, 0, 64);
  offset += 64;

  // transfer_amount_auditor_ciphertext_hi (64 bytes)
  Buffer.from(auditorCiphertextHi).copy(data, offset, 0, 64);
  offset += 64;

  // Proof instruction offsets (0 = use context state account from accounts list)
  data.writeInt8(0, offset); // equality_proof_instruction_offset
  offset += 1;
  data.writeInt8(0, offset); // ciphertext_validity_proof_instruction_offset
  offset += 1;
  data.writeInt8(0, offset); // range_proof_instruction_offset

  // When using context state accounts (offset = 0), instructions sysvar is NOT needed
  // Account layout for Transfer with context state accounts:
  // 0. Source token account
  // 1. Mint
  // 2. Destination token account
  // 3. Equality proof context state account
  // 4. Ciphertext validity proof context state account
  // 5. Range proof context state account
  // 6. Source account owner
  return new TransactionInstruction({
    keys: [
      { pubkey: sourceAccount, isSigner: false, isWritable: true },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: destinationAccount, isSigner: false, isWritable: true },
      { pubkey: equalityProofContext, isSigner: false, isWritable: false },
      { pubkey: validityProofContext, isSigner: false, isWritable: false },
      { pubkey: rangeProofContext, isSigner: false, isWritable: false },
      { pubkey: owner, isSigner: true, isWritable: false },
    ],
    programId,
    data,
  });
}

// ============================================
// HELPER: Read pending balance credit counter
// ============================================

/**
 * Read the pending_balance_credit_counter from a token account's
 * ConfidentialTransferAccount extension.
 *
 * Extension layout:
 * - approved: 1 byte (offset 0)
 * - elgamal_pubkey: 32 bytes (offset 1)
 * - pending_balance_lo: 64 bytes (offset 33)
 * - pending_balance_hi: 64 bytes (offset 97)
 * - available_balance: 64 bytes (offset 161)
 * - decryptable_available_balance: 36 bytes (offset 225)
 * - allow_confidential_credits: 1 byte (offset 261)
 * - allow_non_confidential_credits: 1 byte (offset 262)
 * - pending_balance_credit_counter: 8 bytes (offset 263)
 */
function readPendingBalanceCreditCounter(accountData: Buffer): bigint {
  // Find the ConfidentialTransferAccount extension (type 5)
  let offset = 166; // Start after base account + account type byte

  while (offset + 4 < accountData.length) {
    const extType = accountData.readUInt16LE(offset);
    const extLength = accountData.readUInt16LE(offset + 2);

    if (extType === 5) {
      // ConfidentialTransferAccount = 5
      // pending_balance_credit_counter is at offset 263 within extension data
      const extDataStart = offset + 4; // Skip header
      const counterOffset = extDataStart + 263;

      if (counterOffset + 8 <= accountData.length) {
        return accountData.readBigUInt64LE(counterOffset);
      }
    }

    // Move to next extension
    offset += 4 + extLength;
  }

  throw new Error('ConfidentialTransferAccount extension not found');
}

// ============================================
// BALANCE DISPLAY
// ============================================

async function displayBalances(
  connection: Connection,
  accountName: string,
  tokenAccount: PublicKey,
  elGamalKeypair: any | null,
  aeKey: any | null,
) {
  console.log(`\n📊 ${accountName} Balance:`);

  try {
    const accountInfo = await connection.getAccountInfo(tokenAccount);
    if (!accountInfo) {
      console.log(`   Account not found`);
      return;
    }

    const data = accountInfo.data;

    // Token-2022 Account Layout:
    // - Base Account (165 bytes)
    //   - mint: 32 bytes (offset 0)
    //   - owner: 32 bytes (offset 32)
    //   - amount: 8 bytes (offset 64)
    //   - delegate: 36 bytes (offset 72) - OptionalNonZeroPubkey
    //   - state: 1 byte (offset 108)
    //   - is_native: 12 bytes (offset 109) - COption<u64>
    //   - delegated_amount: 8 bytes (offset 121)
    //   - close_authority: 36 bytes (offset 129) - OptionalNonZeroPubkey
    // - Account Type (1 byte at offset 165): 2 = Account
    // - Extensions follow after offset 166

    const publicBalance = data.readBigUInt64LE(64);
    console.log(
      `   Public:    ${formatBalance(publicBalance, DECIMALS)} tokens`,
    );

    // Try to parse ConfidentialTransferAccount extension
    // Extension header: 2 bytes type + 2 bytes length
    // ConfidentialTransferAccount extension type = 10
    let pendingBalance: bigint | null = null;
    let availableBalance: bigint | null = null;

    // Debug: show account data size and extensions found
    const DEBUG_BALANCES = process.env.DEBUG_BALANCES === '1';

    if (elGamalKeypair && aeKey && data.length > 166) {
      try {
        // Find the ConfidentialTransferAccount extension
        // Search for extension type 10 (ConfidentialTransferAccount)
        let offset = 166;
        if (DEBUG_BALANCES) {
          console.log(`   [DEBUG] Account data length: ${data.length}`);
          console.log(
            `   [DEBUG] Searching for extensions starting at offset ${offset}`,
          );
        }

        while (offset + 4 < data.length) {
          const extType = data.readUInt16LE(offset);
          const extLength = data.readUInt16LE(offset + 2);

          if (DEBUG_BALANCES) {
            console.log(
              `   [DEBUG] Found extension type ${extType}, length ${extLength} at offset ${offset}`,
            );
          }

          if (extType === 5) {
            // ConfidentialTransferAccount = 5
            // Found ConfidentialTransferAccount extension
            // Layout (from SPL Token):
            // - approved: 1 byte
            // - elgamal_pubkey: 32 bytes
            // - pending_balance_lo: 64 bytes (ElGamalCiphertext)
            // - pending_balance_hi: 64 bytes (ElGamalCiphertext)
            // - available_balance: 64 bytes (ElGamalCiphertext)
            // - decryptable_available_balance: 36 bytes (AeCiphertext)
            // - allow_confidential_credits: 1 byte
            // - allow_non_confidential_credits: 1 byte
            // - pending_balance_credit_counter: 8 bytes
            // - maximum_pending_balance_credit_counter: 8 bytes
            // - expected_pending_balance_credit_counter: 8 bytes
            // - actual_pending_balance_credit_counter: 8 bytes

            const extStart = offset + 4;

            // Skip approved (1 byte) and elgamal_pubkey (32 bytes)
            const pendingLoOffset = extStart + 1 + 32;
            const pendingHiOffset = pendingLoOffset + 64;
            const availableOffset = pendingHiOffset + 64;
            const decryptableAvailableOffset = availableOffset + 64;

            if (DEBUG_BALANCES) {
              console.log(
                `   [DEBUG] Found ConfidentialTransferAccount extension!`,
              );
              console.log(
                `   [DEBUG] extStart=${extStart}, pendingLoOffset=${pendingLoOffset}`,
              );
              console.log(
                `   [DEBUG] decryptableAvailableOffset=${decryptableAvailableOffset}`,
              );
            }

            // Decrypt available balance using AES (most efficient)
            const decryptableAvailableBytes = data.slice(
              decryptableAvailableOffset,
              decryptableAvailableOffset + 36,
            );
            if (DEBUG_BALANCES) {
              console.log(
                `   [DEBUG] decryptableAvailableBytes (first 16): ${Buffer.from(decryptableAvailableBytes.slice(0, 16)).toString('hex')}`,
              );
            }
            try {
              const { AeCiphertext } = zkSdk;
              const aeCiphertext = AeCiphertext.fromBytes(
                new Uint8Array(decryptableAvailableBytes),
              );
              if (aeCiphertext) {
                availableBalance = aeKey.decrypt(aeCiphertext);
                if (DEBUG_BALANCES) {
                  console.log(
                    `   [DEBUG] AES decrypted available balance: ${availableBalance}`,
                  );
                }
              }
            } catch (e: any) {
              if (DEBUG_BALANCES) {
                console.log(`   [DEBUG] AES decryption failed: ${e.message}`);
              }
            }

            // Decrypt pending balance using ElGamal (lo + hi)
            // Note: ElGamal decryption is computationally expensive
            // The pending balance is split into lo (16 bits) and hi (48 bits)
            try {
              const { ElGamalCiphertext } = zkSdk;
              const pendingLoBytes = data.slice(
                pendingLoOffset,
                pendingLoOffset + 64,
              );
              const pendingHiBytes = data.slice(
                pendingHiOffset,
                pendingHiOffset + 64,
              );

              // Check if the ciphertext is all zeros (indicating zero balance)
              const isLoZero = pendingLoBytes.every((b: number) => b === 0);
              const isHiZero = pendingHiBytes.every((b: number) => b === 0);

              if (isLoZero && isHiZero) {
                pendingBalance = 0n;
              } else {
                const pendingLoCiphertext = ElGamalCiphertext.fromBytes(
                  new Uint8Array(pendingLoBytes),
                );
                const pendingHiCiphertext = ElGamalCiphertext.fromBytes(
                  new Uint8Array(pendingHiBytes),
                );

                if (pendingLoCiphertext && pendingHiCiphertext) {
                  const secretKey = elGamalKeypair.secret();
                  // Use decrypt() method
                  const pendingLo = secretKey.decrypt(pendingLoCiphertext);
                  const pendingHi = secretKey.decrypt(pendingHiCiphertext);

                  // Combine: lo is lower 16 bits, hi is upper bits shifted by 16
                  pendingBalance = pendingLo + (pendingHi << 16n);
                }
              }
            } catch (e: any) {
              // Decryption failed
            }

            break;
          }

          offset += 4 + extLength;
        }
      } catch (e) {
        // Extension parsing failed
      }
    }

    if (pendingBalance !== null) {
      console.log(
        `   Pending:   ${formatBalance(pendingBalance, DECIMALS)} tokens`,
      );
    } else if (elGamalKeypair && aeKey) {
      console.log(`   Pending:   [decryption failed or zero]`);
    } else {
      console.log(`   Pending:   [no decryption keys]`);
    }

    if (availableBalance !== null) {
      console.log(
        `   Available: ${formatBalance(availableBalance, DECIMALS)} tokens`,
      );
    } else if (elGamalKeypair && aeKey) {
      console.log(`   Available: [decryption failed or zero]`);
    } else {
      console.log(`   Available: [no decryption keys]`);
    }

    console.log(`   ─────────────────────────────`);
    const total =
      publicBalance + (availableBalance ?? 0n) + (pendingBalance ?? 0n);
    console.log(`   Total:     ${formatBalance(total, DECIMALS)} tokens`);
  } catch (error: any) {
    console.log(`   Error: ${error.message}`);
  }
}

// ============================================
// MAIN FUNCTION
// ============================================

async function main() {
  console.log('🚀 Confidential Transfer End-to-End Example');
  console.log('   Using ZK-Edge Cluster with ZK ElGamal Proof Program\n');

  // Load ZK SDK
  console.log('📦 Loading ZK SDK WASM module...');
  try {
    zkSdk = await import('@solana/zk-sdk/node');
    console.log('   ✅ ZK SDK loaded successfully');

    // List key exports
    const keyExports = [
      'ElGamalKeypair',
      'ElGamalPubkey',
      'ElGamalCiphertext',
      'AeKey',
      'AeCiphertext',
      'PubkeyValidityProofData',
      'CiphertextCommitmentEqualityProofData',
      'BatchedGroupedCiphertext3HandlesValidityProofData',
      'BatchedRangeProofU64Data',
      'BatchedRangeProofU128Data',
    ];
    const available = keyExports.filter((k) => k in zkSdk);
    console.log(`   Available: ${available.join(', ')}`);

    // Verify transfer proof types are available
    if (!('CiphertextCommitmentEqualityProofData' in zkSdk)) {
      console.log(
        '   ⚠️  CiphertextCommitmentEqualityProofData not available - Step 7 may not work',
      );
    }
    if (!('BatchedGroupedCiphertext3HandlesValidityProofData' in zkSdk)) {
      console.log(
        '   ⚠️  BatchedGroupedCiphertext3HandlesValidityProofData not available - Step 7 may not work',
      );
    }
    if (!('BatchedRangeProofU128Data' in zkSdk)) {
      console.log(
        '   ⚠️  BatchedRangeProofU128Data not available - Step 7 may not work',
      );
    }
  } catch (error) {
    console.error('   ❌ Failed to load ZK SDK:', error);
    process.exit(1);
  }

  // Connect to ZK-Edge cluster
  console.log(`\n🔗 Connecting to: ${RPC_URL}`);

  const connection = new Connection(RPC_URL, {
    commitment: 'confirmed',
    wsEndpoint: WS_URL,
  });

  try {
    const version = await connection.getVersion();
    console.log(`   ✅ Connected to Solana ${version['solana-core']}`);
  } catch (error: any) {
    console.error(`   ❌ Failed to connect: ${error.message}`);
    process.exit(1);
  }

  // Load payer
  const payer = loadKeypair();
  console.log(`\n💰 Payer: ${payer.publicKey.toBase58()}`);

  const balance = await connection.getBalance(payer.publicKey);
  console.log(`💳 Balance: ${balance / LAMPORTS_PER_SOL} SOL`);

  if (balance < 0.1 * LAMPORTS_PER_SOL) {
    console.log('\n⚠️  Balance too low! You need SOL on the ZK-Edge cluster.');
    console.log('   Request an airdrop or transfer SOL to your wallet.');
    process.exit(1);
  }

  // Create accounts
  const sender = payer;
  const recipient = Keypair.generate();

  console.log('\n📋 Setting up accounts...');
  console.log(`   Sender: ${sender.publicKey.toBase58()}`);
  console.log(`   Recipient: ${recipient.publicKey.toBase58()}`);

  // ============================================
  // STEP 1: Create Confidential Mint
  // ============================================
  console.log('\n🏭 Step 1: Creating confidential mint...');

  const mint = Keypair.generate();
  const mintLen = getMintLen([ExtensionType.ConfidentialTransferMint]);
  console.log(`   Mint account size: ${mintLen} bytes`);

  const mintRent = await connection.getMinimumBalanceForRentExemption(mintLen);

  // Generate auditor ElGamal keypair (optional)
  const { ElGamalKeypair } = zkSdk;
  const auditorKeypair = new ElGamalKeypair();
  const auditorPubkeyBytes = auditorKeypair.pubkey().toBytes();
  console.log(
    `   Auditor ElGamal pubkey: ${Buffer.from(auditorPubkeyBytes).toString('hex').slice(0, 16)}...`,
  );

  // Create mint account
  const createMintAccountIx = SystemProgram.createAccount({
    fromPubkey: payer.publicKey,
    newAccountPubkey: mint.publicKey,
    space: mintLen,
    lamports: mintRent,
    programId: TOKEN_2022_PROGRAM_ID,
  });

  // Initialize ConfidentialTransferMint FIRST
  const initConfidentialMintIx =
    createInitializeConfidentialTransferMintInstruction(
      mint.publicKey,
      payer.publicKey, // authority
      true, // auto_approve_new_accounts
      auditorPubkeyBytes, // auditor pubkey
    );

  // Initialize mint SECOND
  const initMintIx = createInitializeMintInstruction(
    mint.publicKey,
    DECIMALS,
    payer.publicKey,
    null,
    TOKEN_2022_PROGRAM_ID,
  );

  const createMintTx = new Transaction().add(
    createMintAccountIx,
    initConfidentialMintIx,
    initMintIx,
  );

  try {
    const sig = await sendTransaction(connection, createMintTx, [payer, mint]);
    console.log(`   ✅ Mint created: ${mint.publicKey.toBase58()}`);
    console.log(`   Transaction: ${sig}`);
  } catch (error: any) {
    console.error(`   ❌ Failed to create mint: ${error.message}`);
    if (error.logs) {
      console.log('   Logs:', error.logs.slice(-10));
    }
    process.exit(1);
  }

  // ============================================
  // STEP 2: Create Token Accounts
  // ============================================
  console.log('\n🎫 Step 2: Creating token accounts...');

  const senderTokenAccount = getAssociatedTokenAddressSync(
    mint.publicKey,
    sender.publicKey,
    false,
    TOKEN_2022_PROGRAM_ID,
  );

  const recipientTokenAccount = getAssociatedTokenAddressSync(
    mint.publicKey,
    recipient.publicKey,
    false,
    TOKEN_2022_PROGRAM_ID,
  );

  const createSenderAtaIx = createAssociatedTokenAccountInstruction(
    payer.publicKey,
    senderTokenAccount,
    sender.publicKey,
    mint.publicKey,
    TOKEN_2022_PROGRAM_ID,
  );

  const createRecipientAtaIx = createAssociatedTokenAccountInstruction(
    payer.publicKey,
    recipientTokenAccount,
    recipient.publicKey,
    mint.publicKey,
    TOKEN_2022_PROGRAM_ID,
  );

  const createAtasTx = new Transaction().add(
    createSenderAtaIx,
    createRecipientAtaIx,
  );

  try {
    const sig = await sendTransaction(connection, createAtasTx, [payer]);
    console.log(`   ✅ Sender ATA: ${senderTokenAccount.toBase58()}`);
    console.log(`   ✅ Recipient ATA: ${recipientTokenAccount.toBase58()}`);
    console.log(`   Transaction: ${sig}`);
  } catch (error: any) {
    console.error(`   ❌ Failed to create ATAs: ${error.message}`);
    process.exit(1);
  }

  // ============================================
  // STEP 3: Configure Accounts for Confidential Transfers
  // ============================================
  console.log(
    '\n⚙️  Step 3: Configuring accounts for confidential transfers...',
  );

  const { AeKey, PubkeyValidityProofData } = zkSdk;

  // Generate sender's encryption keys
  const senderElGamal = new ElGamalKeypair();
  const senderAeKey = new AeKey();

  console.log(
    `   Sender ElGamal pubkey: ${Buffer.from(senderElGamal.pubkey().toBytes()).toString('hex').slice(0, 16)}...`,
  );

  // Generate pubkey validity proof
  const senderProof = new PubkeyValidityProofData(senderElGamal);
  const senderProofBytes = senderProof.toBytes();
  console.log(`   Sender proof size: ${senderProofBytes.length} bytes`);

  // Verify proof locally
  try {
    senderProof.verify();
    console.log(`   ✅ Sender proof verified locally`);
  } catch (e) {
    console.log(`   ⚠️  Local verification failed (might still work on-chain)`);
  }

  // Encrypt zero balance with AES
  const zeroBalance = senderAeKey.encrypt(BigInt(0));
  const zeroBalanceBytes = zeroBalance.toBytes();
  console.log(
    `   Zero balance ciphertext size: ${zeroBalanceBytes.length} bytes`,
  );

  // Reallocate sender account to add ConfidentialTransferAccount extension
  const reallocateSenderIx = createReallocateInstruction(
    senderTokenAccount,
    payer.publicKey,
    sender.publicKey,
    [ExtensionType.ConfidentialTransferAccount],
  );

  // Configure sender account
  const configureSenderIx = createConfigureAccountInstruction(
    senderTokenAccount,
    mint.publicKey,
    sender.publicKey,
    zeroBalanceBytes,
    65536n, // max pending balance credit counter
    1, // proof is in next instruction
  );

  // Verify proof instruction
  const verifySenderProofIx =
    createVerifyPubkeyValidityInstruction(senderProofBytes);

  const configureSenderTx = new Transaction().add(
    reallocateSenderIx,
    configureSenderIx,
    verifySenderProofIx,
  );

  try {
    const sig = await sendTransaction(
      connection,
      configureSenderTx,
      [payer, sender],
      {
        skipPreflight: true, // Skip preflight since ZK proof program might not simulate correctly
      },
    );
    console.log(`   ✅ Sender account configured`);
    console.log(`   Transaction: ${sig}`);
  } catch (error: any) {
    console.error(`   ❌ Failed to configure sender: ${error.message}`);
    if (error.logs) {
      console.log('   Logs:', error.logs.slice(-15));
    }
    // Continue anyway to see what else might work
  }

  // Configure recipient account similarly
  const recipientElGamal = new ElGamalKeypair();
  const recipientAeKey = new AeKey();
  const recipientProof = new PubkeyValidityProofData(recipientElGamal);
  const recipientProofBytes = recipientProof.toBytes();
  const recipientZeroBalance = recipientAeKey.encrypt(BigInt(0));

  const reallocateRecipientIx = createReallocateInstruction(
    recipientTokenAccount,
    payer.publicKey,
    recipient.publicKey,
    [ExtensionType.ConfidentialTransferAccount],
  );

  const configureRecipientIx = createConfigureAccountInstruction(
    recipientTokenAccount,
    mint.publicKey,
    recipient.publicKey,
    recipientZeroBalance.toBytes(),
    65536n,
    1,
  );

  const verifyRecipientProofIx =
    createVerifyPubkeyValidityInstruction(recipientProofBytes);

  const configureRecipientTx = new Transaction().add(
    reallocateRecipientIx,
    configureRecipientIx,
    verifyRecipientProofIx,
  );

  try {
    const sig = await sendTransaction(
      connection,
      configureRecipientTx,
      [payer, recipient],
      {
        skipPreflight: true,
      },
    );
    console.log(`   ✅ Recipient account configured`);
    console.log(`   Transaction: ${sig}`);
  } catch (error: any) {
    console.error(`   ❌ Failed to configure recipient: ${error.message}`);
    if (error.logs) {
      console.log('   Logs:', error.logs.slice(-15));
    }
  }

  // ============================================
  // STEP 4: Mint Tokens to Sender
  // ============================================
  console.log('\n🪙 Step 4: Minting tokens to sender...');

  const mintToIx = createMintToInstruction(
    mint.publicKey,
    senderTokenAccount,
    payer.publicKey,
    MINT_AMOUNT,
    [],
    TOKEN_2022_PROGRAM_ID,
  );

  try {
    const sig = await sendTransaction(
      connection,
      new Transaction().add(mintToIx),
      [payer],
    );
    console.log(`   ✅ Minted ${formatBalance(MINT_AMOUNT, DECIMALS)} tokens`);
    console.log(`   Transaction: ${sig}`);
  } catch (error: any) {
    console.error(`   ❌ Failed to mint: ${error.message}`);
    process.exit(1);
  }

  // Display balances
  await displayBalances(
    connection,
    'Sender (after mint)',
    senderTokenAccount,
    senderElGamal,
    senderAeKey,
  );
  await displayBalances(
    connection,
    'Recipient (initial)',
    recipientTokenAccount,
    recipientElGamal,
    recipientAeKey,
  );

  // ============================================
  // STEP 5: Deposit to Confidential Balance
  // ============================================
  console.log('\n💰 Step 5: Depositing to confidential balance...');

  const depositIx = createDepositInstruction(
    senderTokenAccount,
    mint.publicKey,
    sender.publicKey,
    DEPOSIT_AMOUNT,
    DECIMALS,
  );

  // Debug: print instruction data
  console.log(
    `   Deposit instruction data (${depositIx.data.length} bytes): ${Buffer.from(depositIx.data).toString('hex')}`,
  );
  console.log(
    `   Expected format: 1b (27=ConfidentialTransferExtension), 05 (Deposit), amount (8 bytes LE), decimals (1 byte)`,
  );

  try {
    const sig = await sendTransaction(
      connection,
      new Transaction().add(depositIx),
      [payer, sender],
    );
    console.log(
      `   ✅ Deposited ${formatBalance(DEPOSIT_AMOUNT, DECIMALS)} tokens to pending`,
    );
    console.log(`   Transaction: ${sig}`);
  } catch (error: any) {
    console.error(`   ❌ Failed to deposit: ${error.message}`);
    if (error.logs) {
      console.log('   Logs:', error.logs.slice(-10));
    }
  }

  await displayBalances(
    connection,
    'Sender (after deposit)',
    senderTokenAccount,
    senderElGamal,
    senderAeKey,
  );

  // ============================================
  // STEP 6: Apply Pending Balance
  // ============================================
  console.log('\n🔄 Step 6: Applying pending balance...');

  // Read the current pending balance credit counter from the account
  const senderAccountInfo6 =
    await connection.getAccountInfo(senderTokenAccount);
  if (!senderAccountInfo6) {
    throw new Error('Sender account not found');
  }
  const senderPendingCounter = readPendingBalanceCreditCounter(
    senderAccountInfo6.data,
  );
  console.log(`   Pending balance credit counter: ${senderPendingCounter}`);

  // Encrypt the new available balance
  const newAvailableBalance = senderAeKey.encrypt(DEPOSIT_AMOUNT);

  const applyPendingIx = createApplyPendingBalanceInstruction(
    senderTokenAccount,
    sender.publicKey,
    senderPendingCounter, // Read from account, not hardcoded
    newAvailableBalance.toBytes(),
  );

  try {
    const sig = await sendTransaction(
      connection,
      new Transaction().add(applyPendingIx),
      [payer, sender],
    );
    console.log(`   ✅ Applied pending balance`);
    console.log(`   Transaction: ${sig}`);
  } catch (error: any) {
    console.error(`   ❌ Failed to apply pending: ${error.message}`);
    if (error.logs) {
      console.log('   Logs:', error.logs.slice(-10));
    }
    throw Error('Apply pending balance failed');
  }

  await displayBalances(
    connection,
    'Sender (after apply)',
    senderTokenAccount,
    senderElGamal,
    senderAeKey,
  );

  // ============================================
  // STEP 7: Confidential Transfer
  // ============================================
  console.log('\n🔐 Step 7: Performing confidential transfer...');
  console.log(
    `   Transfer amount: ${formatBalance(TRANSFER_AMOUNT, DECIMALS)} tokens`,
  );

  // Check if the required proof types are available in the SDK
  const {
    CiphertextCommitmentEqualityProofData,
    BatchedGroupedCiphertext3HandlesValidityProofData,
    PedersenOpening,
    PedersenCommitment,
    GroupedElGamalCiphertext3Handles,
    ElGamalCiphertext,
  } = zkSdk;

  const { BatchedRangeProofU128Data } = zkSdk;

  if (
    !CiphertextCommitmentEqualityProofData ||
    !BatchedGroupedCiphertext3HandlesValidityProofData ||
    !BatchedRangeProofU128Data
  ) {
    console.log('   ⚠️  Required proof types not available in ZK SDK');
    console.log(
      '   Missing: CiphertextCommitmentEqualityProofData =',
      !!CiphertextCommitmentEqualityProofData,
    );
    console.log('   Skipping Step 7...');
  } else {
    try {
      // Step 7a: Calculate the new balances
      const currentAvailableBalance = DEPOSIT_AMOUNT;
      const newSenderBalance = currentAvailableBalance - TRANSFER_AMOUNT;

      console.log(
        `   Current sender balance: ${formatBalance(currentAvailableBalance, DECIMALS)} tokens`,
      );
      console.log(
        `   After transfer: ${formatBalance(newSenderBalance, DECIMALS)} tokens`,
      );

      console.log('\n   Generating ZK proofs...');

      // Get the recipient's ElGamal pubkey for encryption
      const recipientElGamalPubkey = recipientElGamal.pubkey();
      const senderElGamalPubkey = senderElGamal.pubkey();
      const auditorElGamalPubkey = auditorKeypair.pubkey();

      // ============================================
      // Step 7b: First, generate the validity proof (needs to come before equality)
      // ============================================
      // BatchedGroupedCiphertext3HandlesValidityProofData proves grouped ciphertexts are well-formed.
      // The 3 handles are: source (sender), destination (recipient), and auditor
      // Constructor: (first_pubkey, second_pubkey, third_pubkey, grouped_lo, grouped_hi, amount_lo, amount_hi, opening_lo, opening_hi)
      console.log(
        '   - Generating ciphertext validity proof (3 handles: source, destination, auditor)...',
      );

      // For batched validity, we split the amount into lo (16 bits) and hi (32 bits) parts
      // The SPL confidential transfer uses this split for range proof efficiency
      // Lo holds lower 16 bits (max 65535), Hi holds upper bits
      const amountLo = TRANSFER_AMOUNT & BigInt(0xffff); // Lower 16 bits
      const amountHi = TRANSFER_AMOUNT >> BigInt(16); // Upper bits (shifted right by 16)

      console.log(
        `     Amount split: lo=${amountLo} (${amountLo.toString(16)}h), hi=${amountHi} (${amountHi.toString(16)}h)`,
      );

      const openingLo = new PedersenOpening();
      const openingHi = new PedersenOpening();

      // Create grouped ciphertexts with 3 handles: source, destination, auditor
      const groupedCiphertextLo = GroupedElGamalCiphertext3Handles.encryptWith(
        senderElGamalPubkey, // first_pubkey (source)
        recipientElGamalPubkey, // second_pubkey (destination)
        auditorElGamalPubkey, // third_pubkey (auditor)
        amountLo,
        openingLo,
      );

      const groupedCiphertextHi = GroupedElGamalCiphertext3Handles.encryptWith(
        senderElGamalPubkey,
        recipientElGamalPubkey,
        auditorElGamalPubkey,
        amountHi,
        openingHi,
      );

      const validityProof =
        new BatchedGroupedCiphertext3HandlesValidityProofData(
          senderElGamalPubkey, // first_pubkey (source)
          recipientElGamalPubkey, // second_pubkey (destination)
          auditorElGamalPubkey, // third_pubkey (auditor)
          groupedCiphertextLo, // grouped_lo
          groupedCiphertextHi, // grouped_hi
          amountLo, // amount_lo
          amountHi, // amount_hi
          openingLo, // opening_lo
          openingHi, // opening_hi
        );

      const validityProofBytes = validityProof.toBytes();
      console.log(`     Size: ${validityProofBytes.length} bytes`);
      validityProof.verify();
      console.log('     ✅ Verified locally');

      // ============================================
      // Step 7d: Prepare for range and equality proofs
      // ============================================
      // We need to compute the new balance ciphertext FIRST, then create both
      // the range proof and equality proof while the Pedersen opening is still alive.
      // (WASM objects may be freed after use, so we can't serialize/deserialize the opening)

      console.log('   - Preparing new balance ciphertext for proofs...');

      // Step 1: Get the current available balance ciphertext from the sender's token account
      console.log('     Reading current balance ciphertext from account...');
      const senderAccountInfo =
        await connection.getAccountInfo(senderTokenAccount);
      if (!senderAccountInfo) {
        throw new Error('Sender token account not found');
      }

      // Token-2022 account structure:
      // - Token account base: 165 bytes
      // - Extension type discriminator (2 bytes)
      // - Extension length (2 bytes)
      // - Extension data: ConfidentialTransferAccount
      //   - approved (1 byte)
      //   - elgamal_pubkey (32 bytes)
      //   - pending_balance_lo (64 bytes ElGamalCiphertext)
      //   - pending_balance_hi (64 bytes)
      //   - available_balance (64 bytes) <-- offset 161 from extension start
      //   - decryptable_available_balance (36 bytes AeCiphertext)

      const accountData = senderAccountInfo.data;
      const TOKEN_ACCOUNT_SIZE = 165;
      let offset = TOKEN_ACCOUNT_SIZE;

      // Skip account type byte if present (first extension indicator)
      if (accountData.length > TOKEN_ACCOUNT_SIZE) {
        offset += 1; // Account type byte
      }

      // Search for ConfidentialTransferAccount extension (type = 5)
      let currentBalanceCiphertextBytes: Uint8Array | null = null;
      while (offset + 4 <= accountData.length) {
        const extensionType = accountData.readUInt16LE(offset);
        const extensionLength = accountData.readUInt16LE(offset + 2);
        console.log(
          `     Extension at ${offset}: type=${extensionType}, length=${extensionLength}`,
        );

        if (extensionType === 5) {
          // ConfidentialTransferAccount
          offset += 4; // Skip type and length
          // available_balance is at offset: 1 (approved) + 32 (pubkey) + 64 (pending_lo) + 64 (pending_hi) = 161
          const availableBalanceOffset = offset + 1 + 32 + 64 + 64;
          currentBalanceCiphertextBytes = accountData.slice(
            availableBalanceOffset,
            availableBalanceOffset + 64,
          );
          console.log(
            `     Found available_balance at offset ${availableBalanceOffset}`,
          );
          console.log(
            `     Current balance ciphertext: ${currentBalanceCiphertextBytes.length} bytes`,
          );
          break;
        }
        offset += 4 + extensionLength;
      }

      if (!currentBalanceCiphertextBytes) {
        throw new Error(
          'ConfidentialTransferAccount extension not found in account data',
        );
      }

      // Step 2: Extract source ciphertexts from the grouped ciphertexts
      // A grouped ciphertext (3 handles) is: Commitment (32) + Handle1 (32) + Handle2 (32) + Handle3 (32) = 128 bytes
      // The source ElGamal ciphertext is: Commitment (32) + Handle1 (32) = first 64 bytes
      console.log(
        `     Extracting source ciphertexts from grouped ciphertexts...`,
      );

      const groupedLoBytes = groupedCiphertextLo.toBytes();
      const groupedHiBytes = groupedCiphertextHi.toBytes();
      const sourceCiphertextLoBytes = groupedLoBytes.slice(0, 64);
      const sourceCiphertextHiBytes = groupedHiBytes.slice(0, 64);

      // Step 3: Combine lo + hi ciphertexts into a single transfer amount ciphertext
      // combined = lo + (hi * 2^16)
      const transferAmountCiphertextBytes = combineLowHighCiphertexts(
        sourceCiphertextLoBytes,
        sourceCiphertextHiBytes,
        16, // TRANSFER_AMOUNT_LO_BITS
      );
      console.log(
        `     Combined transfer ciphertext: ${transferAmountCiphertextBytes.length} bytes`,
      );

      // Step 4: Compute new_balance_ciphertext = current_balance - transfer_amount (homomorphic)
      const newBalanceCiphertextBytes = subtractCiphertexts(
        currentBalanceCiphertextBytes,
        transferAmountCiphertextBytes,
      );
      console.log(
        `     Computed new balance ciphertext: ${newBalanceCiphertextBytes.length} bytes`,
      );

      // Convert to SDK type
      const newBalanceCiphertext = ElGamalCiphertext.fromBytes(
        newBalanceCiphertextBytes,
      );
      if (!newBalanceCiphertext) {
        throw new Error('Failed to parse new balance ciphertext');
      }
      console.log(`     ✓ Created ElGamalCiphertext for new balance`);

      // ============================================
      // Step 7e: Generate equality and range proofs
      // ============================================
      // We must create BOTH proofs using the same Pedersen commitment/opening.
      // WASM objects may be consumed by constructors (Rust ownership semantics),
      // so we create the equality proof FIRST while the opening is fresh.

      console.log('   - Creating Pedersen commitment for new balance...');

      // Create Pedersen commitment for new available balance
      const newAvailableBalanceOpening = new PedersenOpening();
      const newAvailableBalanceCommitment = PedersenCommitment.from(
        newSenderBalance,
        newAvailableBalanceOpening,
      );

      // Note: The WASM objects remain valid after being passed to proof constructors,
      // so we can reuse them for both the equality and range proofs.

      // ============================================
      // Step 7f: Generate the equality proof FIRST
      // ============================================
      // CiphertextCommitmentEqualityProofData proves that a ciphertext encrypts the same value
      // as a commitment commits to. This links the homomorphically computed new balance ciphertext
      // to the commitment used in the range proof.
      console.log('   - Generating equality proof (ciphertext-commitment)...');

      let equalityProofBytes: Uint8Array;
      try {
        const equalityProof = new CiphertextCommitmentEqualityProofData(
          senderElGamal, // keypair (need secret key to prove decryption)
          newBalanceCiphertext, // ciphertext (the homomorphic result)
          newAvailableBalanceCommitment, // commitment
          newAvailableBalanceOpening, // opening
          newSenderBalance, // amount (the plaintext new balance)
        );

        equalityProofBytes = equalityProof.toBytes();
        console.log(`     Size: ${equalityProofBytes.length} bytes`);

        try {
          equalityProof.verify();
          console.log('     ✅ Verified locally');
        } catch (verifyError: any) {
          console.error(
            `     ❌ Local verification failed: ${verifyError.message || verifyError}`,
          );
          throw new Error(
            `Equality proof local verification failed: ${verifyError.message || verifyError}`,
          );
        }
      } catch (e: any) {
        console.error(
          `     ❌ Failed to create equality proof: ${e.message || e}`,
        );
        throw e;
      }

      // ============================================
      // Step 7g: Generate the range proof (U128)
      // ============================================
      // BatchedRangeProofU128Data proves values are within valid range.
      // We try to reuse the same commitment/opening as the equality proof.
      console.log('   - Generating range proof (U128)...');

      // Try to reuse the original commitment/opening
      // If the equality proof didn't consume them, they should still be valid
      const rangeBalanceCommitment = newAvailableBalanceCommitment;
      const rangeBalanceOpening = newAvailableBalanceOpening;

      // Create commitments for transfer_lo and transfer_hi
      // These must match the openings used in the grouped ciphertexts
      const transferLoCommitment = PedersenCommitment.from(amountLo, openingLo);
      const transferHiCommitment = PedersenCommitment.from(amountHi, openingHi);

      // Create padding commitment (commitment to zero)
      const paddingOpening = new PedersenOpening();
      const paddingCommitment = PedersenCommitment.from(
        BigInt(0),
        paddingOpening,
      );

      // Use BigUint64Array for amounts and Uint8Array for bit lengths
      // Bit lengths: [64, 16, 32, 16] = 128 total
      const amounts = new BigUint64Array([
        newSenderBalance, // 64 bits for new available balance
        amountLo, // 16 bits for transfer_lo
        amountHi, // 32 bits for transfer_hi
        BigInt(0), // 16 bits for padding
      ]);
      const bitLengths = new Uint8Array([64, 16, 32, 16]); // Must sum to 128

      const rangeProof = new BatchedRangeProofU128Data(
        [
          rangeBalanceCommitment,
          transferLoCommitment,
          transferHiCommitment,
          paddingCommitment,
        ],
        amounts,
        bitLengths,
        [rangeBalanceOpening, openingLo, openingHi, paddingOpening],
      );

      const rangeProofBytes = rangeProof.toBytes();
      console.log(`     Size: ${rangeProofBytes.length} bytes`);

      // Debug: show the values being proven
      console.log(`     Proving ranges for:`);
      console.log(`       - newSenderBalance: ${newSenderBalance} (64 bits)`);
      console.log(`       - amountLo: ${amountLo} (16 bits)`);
      console.log(`       - amountHi: ${amountHi} (32 bits)`);
      console.log(`       - padding: 0 (16 bits)`);

      try {
        rangeProof.verify();
        console.log('     ✅ Verified locally');
      } catch (verifyError: any) {
        console.error(
          `     ❌ Local verification failed: ${verifyError.message || verifyError}`,
        );
        throw new Error(
          `Range proof local verification failed: ${verifyError.message || verifyError}`,
        );
      }

      // Step 7f: Create context state accounts to store the proofs
      console.log('\n   Creating proof context state accounts...');

      const equalityContextAccount = Keypair.generate();
      const validityContextAccount = Keypair.generate();
      const rangeContextAccount = Keypair.generate();

      // Calculate rent for each context account
      const equalityAccountSize = getContextStateAccountSize('equality');
      const validityAccountSize = getContextStateAccountSize('validity');
      const rangeAccountSize = getContextStateAccountSize('range');

      const equalityRent =
        await connection.getMinimumBalanceForRentExemption(equalityAccountSize);
      const validityRent =
        await connection.getMinimumBalanceForRentExemption(validityAccountSize);
      const rangeRent =
        await connection.getMinimumBalanceForRentExemption(rangeAccountSize);

      console.log(
        `   - Equality context: ${equalityAccountSize} bytes, ${equalityRent / LAMPORTS_PER_SOL} SOL`,
      );
      console.log(
        `   - Validity context: ${validityAccountSize} bytes, ${validityRent / LAMPORTS_PER_SOL} SOL`,
      );
      console.log(
        `   - Range context: ${rangeAccountSize} bytes, ${rangeRent / LAMPORTS_PER_SOL} SOL`,
      );

      // Create all three context accounts
      const createEqualityCtxIx = SystemProgram.createAccount({
        fromPubkey: payer.publicKey,
        newAccountPubkey: equalityContextAccount.publicKey,
        space: equalityAccountSize,
        lamports: equalityRent,
        programId: ZK_ELGAMAL_PROOF_PROGRAM_ID,
      });

      const createValidityCtxIx = SystemProgram.createAccount({
        fromPubkey: payer.publicKey,
        newAccountPubkey: validityContextAccount.publicKey,
        space: validityAccountSize,
        lamports: validityRent,
        programId: ZK_ELGAMAL_PROOF_PROGRAM_ID,
      });

      const createRangeCtxIx = SystemProgram.createAccount({
        fromPubkey: payer.publicKey,
        newAccountPubkey: rangeContextAccount.publicKey,
        space: rangeAccountSize,
        lamports: rangeRent,
        programId: ZK_ELGAMAL_PROOF_PROGRAM_ID,
      });

      // Step 7g: Create and send context accounts + verify proofs
      // Split each into 2 transactions to avoid size limits

      console.log(
        '\n   Submitting equality proof (split into 2 transactions)...',
      );
      console.log(
        `     Equality proof size: ${equalityProofBytes.length} bytes`,
      );

      // Transaction 1: Create equality context account
      const createEqualityCtxTx = new Transaction().add(createEqualityCtxIx);
      try {
        const sig = await sendTransaction(
          connection,
          createEqualityCtxTx,
          [payer, equalityContextAccount],
          { skipPreflight: true },
        );
        console.log(`     ✅ Equality context account created: ${sig}`);
      } catch (error: any) {
        console.error(
          `   ❌ Failed to create equality context account: ${error.message}`,
        );
        if (error.logs) {
          console.log('   Logs:', error.logs.slice(-10));
        }
        throw error;
      }

      // Transaction 2: Verify equality proof (CiphertextCommitmentEquality)
      const verifyEqualityIx =
        createVerifyCiphertextCommitmentEqualityInstruction(
          equalityProofBytes,
          equalityContextAccount.publicKey,
          sender.publicKey,
        );

      const verifyEqualityTx = new Transaction().add(verifyEqualityIx);
      try {
        const sig = await sendTransaction(
          connection,
          verifyEqualityTx,
          [payer],
          { skipPreflight: true },
        );
        console.log(`     ✅ Equality proof verified: ${sig}`);
      } catch (error: any) {
        console.error(
          `   ❌ Failed to verify equality proof: ${error.message}`,
        );
        if (error.logs) {
          console.log('   Logs:', error.logs.slice(-10));
        }
        throw error;
      }

      console.log(
        '   Submitting validity proof (split into 2 transactions)...',
      );
      console.log(
        `     Validity proof size: ${validityProofBytes.length} bytes`,
      );

      // Transaction 1: Create validity context account
      const createValidityCtxTx = new Transaction().add(createValidityCtxIx);
      try {
        const sig = await sendTransaction(
          connection,
          createValidityCtxTx,
          [payer, validityContextAccount],
          { skipPreflight: true },
        );
        console.log(`     ✅ Validity context account created: ${sig}`);
      } catch (error: any) {
        console.error(
          `   ❌ Failed to create validity context account: ${error.message}`,
        );
        if (error.logs) {
          console.log('   Logs:', error.logs.slice(-10));
        }
        throw error;
      }

      // Transaction 2: Verify validity proof
      const verifyValidityIx =
        createVerifyBatchedGroupedCiphertext3HandlesValidityInstruction(
          validityProofBytes,
          validityContextAccount.publicKey,
          sender.publicKey,
        );

      const verifyValidityTx = new Transaction().add(verifyValidityIx);
      try {
        const sig = await sendTransaction(
          connection,
          verifyValidityTx,
          [payer],
          { skipPreflight: true },
        );
        console.log(`     ✅ Validity proof verified: ${sig}`);
      } catch (error: any) {
        console.error(
          `   ❌ Failed to verify validity proof: ${error.message}`,
        );
        if (error.logs) {
          console.log('   Logs:', error.logs.slice(-10));
        }
        throw error;
      }

      // Range proof is too large to fit in a single transaction with createAccount
      // Split into two transactions: 1) create account, 2) verify proof
      console.log(
        '   Submitting range proof (split into 2 transactions due to size)...',
      );
      console.log(`     Range proof size: ${rangeProofBytes.length} bytes`);

      // Transaction 1: Create the context state account
      const createRangeCtxTx = new Transaction().add(createRangeCtxIx);
      try {
        const sig = await sendTransaction(
          connection,
          createRangeCtxTx,
          [payer, rangeContextAccount],
          {
            skipPreflight: true,
          },
        );
        console.log(`     ✅ Range context account created: ${sig}`);
      } catch (error: any) {
        console.error(
          `   ❌ Failed to create range context account: ${error.message}`,
        );
        if (error.logs) {
          console.log('   Logs:', error.logs.slice(-10));
        }
        throw error;
      }

      // Transaction 2: Verify the range proof U128 (writes to existing account)
      const verifyRangeIx = createVerifyBatchedRangeProofU128Instruction(
        rangeProofBytes,
        rangeContextAccount.publicKey,
        sender.publicKey,
      );

      const verifyRangeTx = new Transaction().add(verifyRangeIx);
      try {
        const sig = await sendTransaction(connection, verifyRangeTx, [payer], {
          skipPreflight: true,
        });
        console.log(`     ✅ Range proof verified: ${sig}`);
      } catch (error: any) {
        console.error(`   ❌ Failed to verify range proof: ${error.message}`);
        if (error.logs) {
          console.log('   Logs:', error.logs.slice(-10));
        }
        throw error;
      }

      // Step 7h: Execute the confidential transfer
      console.log('\n   Executing confidential transfer...');

      // Verify context accounts are properly initialized
      console.log('   Verifying context state accounts...');
      const eqCtxInfo = await connection.getAccountInfo(
        equalityContextAccount.publicKey,
      );
      const valCtxInfo = await connection.getAccountInfo(
        validityContextAccount.publicKey,
      );
      const rangeCtxInfo = await connection.getAccountInfo(
        rangeContextAccount.publicKey,
      );

      console.log(
        `   - Equality context owner: ${eqCtxInfo?.owner.toBase58()}`,
      );
      console.log(
        `   - Validity context owner: ${valCtxInfo?.owner.toBase58()}`,
      );
      console.log(
        `   - Range context owner: ${rangeCtxInfo?.owner.toBase58()}`,
      );
      console.log(
        `   - Expected ZK program: ${ZK_ELGAMAL_PROOF_PROGRAM_ID.toBase58()}`,
      );
      console.log(
        `   - Equality context data length: ${eqCtxInfo?.data.length}`,
      );
      console.log(
        `   - Validity context data length: ${valCtxInfo?.data.length}`,
      );
      console.log(
        `   - Range context data length: ${rangeCtxInfo?.data.length}`,
      );

      // Encrypt the new sender balance with AES for decryptable_available_balance
      const newSenderDecryptableBalance = senderAeKey.encrypt(newSenderBalance);

      // Extract auditor ciphertext handles from the grouped ciphertexts
      // GroupedElGamalCiphertext3Handles layout: commitment (32 bytes) + handle1 (32) + handle2 (32) + handle3 (32)
      // ElGamalCiphertext = commitment (32) + handle (32) = 64 bytes
      // The auditor is the third handle (index 2)
      // Note: groupedLoBytes and groupedHiBytes were already extracted earlier for the equality proof
      console.log(
        `   GroupedCiphertext Lo size: ${groupedLoBytes.length} bytes`,
      );
      console.log(
        `   GroupedCiphertext Hi size: ${groupedHiBytes.length} bytes`,
      );

      // Extract auditor ciphertext: commitment (bytes 0-32) + auditor handle (bytes 96-128)
      const auditorCiphertextLo = new Uint8Array(64);
      auditorCiphertextLo.set(groupedLoBytes.slice(0, 32), 0); // commitment
      auditorCiphertextLo.set(groupedLoBytes.slice(96, 128), 32); // auditor handle (third handle)

      const auditorCiphertextHi = new Uint8Array(64);
      auditorCiphertextHi.set(groupedHiBytes.slice(0, 32), 0); // commitment
      auditorCiphertextHi.set(groupedHiBytes.slice(96, 128), 32); // auditor handle (third handle)

      console.log(
        `   Auditor ciphertext Lo size: ${auditorCiphertextLo.length} bytes`,
      );
      console.log(
        `   Auditor ciphertext Hi size: ${auditorCiphertextHi.length} bytes`,
      );

      const transferIx = createConfidentialTransferInstruction(
        senderTokenAccount,
        mint.publicKey,
        recipientTokenAccount,
        equalityContextAccount.publicKey,
        validityContextAccount.publicKey,
        rangeContextAccount.publicKey,
        sender.publicKey,
        newSenderDecryptableBalance.toBytes(),
        auditorCiphertextLo,
        auditorCiphertextHi,
      );

      const transferTx = new Transaction().add(transferIx);

      try {
        const sig = await sendTransaction(
          connection,
          transferTx,
          [payer, sender],
          {
            skipPreflight: true,
          },
        );
        console.log(`   ✅ Confidential transfer executed: ${sig}`);
      } catch (error: any) {
        console.error(`   ❌ Failed to execute transfer: ${error.message}`);
        if (error.logs) {
          console.log('   Logs:', error.logs.slice(-15));
        }
      }

      // Context accounts are automatically closed by the transfer instruction
      // (closeSplitContextOnExecution = true)

      // Display balances after transfer (before recipient applies pending)
      await displayBalances(
        connection,
        'Sender (after transfer)',
        senderTokenAccount,
        senderElGamal,
        senderAeKey,
      );
      await displayBalances(
        connection,
        'Recipient (after transfer, pending)',
        recipientTokenAccount,
        recipientElGamal,
        recipientAeKey,
      );
    } catch (error: any) {
      console.error(`   ❌ Step 7 failed: ${error}`);
      throw Error('Confidential transfer failed');
    }
  }

  // ============================================
  // STEP 8: Recipient Applies Pending Balance
  // ============================================
  console.log('\n🔄 Step 8: Recipient applying pending balance...');

  try {
    // Read the pending balance credit counter from the recipient's account
    const recipientAccountInfo8 = await connection.getAccountInfo(
      recipientTokenAccount,
    );
    if (!recipientAccountInfo8) {
      throw new Error('Recipient account not found');
    }

    const pendingBalanceCreditCounter = readPendingBalanceCreditCounter(
      recipientAccountInfo8.data,
    );
    console.log(
      `   Pending balance credit counter: ${pendingBalanceCreditCounter}`,
    );

    // The recipient's new available balance = current available (0) + pending (TRANSFER_AMOUNT)
    // Since this is the first transfer to recipient, their available was 0
    const recipientNewAvailableBalance =
      recipientAeKey.encrypt(TRANSFER_AMOUNT);

    const recipientApplyPendingIx = createApplyPendingBalanceInstruction(
      recipientTokenAccount,
      recipient.publicKey,
      pendingBalanceCreditCounter,
      recipientNewAvailableBalance.toBytes(),
    );

    const sig = await sendTransaction(
      connection,
      new Transaction().add(recipientApplyPendingIx),
      [payer, recipient],
    );
    console.log(`   ✅ Recipient applied pending balance`);
    console.log(`   Transaction: ${sig}`);
  } catch (error: any) {
    console.error(`   ❌ Failed to apply recipient pending: ${error.message}`);
    if (error.logs) {
      console.log('   Logs:', error.logs.slice(-10));
    }
    throw Error('Recipient apply pending balance failed');
  }
  // Display final balances
  console.log('\n📊 Final Balances:');
  await displayBalances(
    connection,
    'Sender (final)',
    senderTokenAccount,
    senderElGamal,
    senderAeKey,
  );
  await displayBalances(
    connection,
    'Recipient (final)',
    recipientTokenAccount,
    recipientElGamal,
    recipientAeKey,
  );

  // ============================================
  // Summary
  // ============================================
  console.log('\n' + '='.repeat(60));
  console.log('📋 Summary');
  console.log('='.repeat(60));
  console.log(`Mint:                    ${mint.publicKey.toBase58()}`);
  console.log(`Sender token account:    ${senderTokenAccount.toBase58()}`);
  console.log(`Recipient token account: ${recipientTokenAccount.toBase58()}`);
  console.log('');
  console.log('Confidential Transfer Flow Completed:');
  console.log('  ✅ Step 1: Created confidential mint');
  console.log('  ✅ Step 2: Created token accounts');
  console.log('  ✅ Step 3: Configured accounts for confidential transfers');
  console.log('  ✅ Step 4: Minted tokens');
  console.log('  ✅ Step 5: Deposited to confidential balance');
  console.log('  ✅ Step 6: Applied pending balance (sender)');
  console.log('  ✅ Step 7: Executed confidential transfer');
  console.log('  ✅ Step 8: Applied pending balance (recipient)');
  console.log('');
  console.log(`🔗 View on explorer:`);
  console.log(
    `   https://explorer.solana.com/address/${mint.publicKey.toBase58()}?cluster=custom&customUrl=${encodeURIComponent(RPC_URL)}`,
  );
}

// Test proof generation only
async function testProofGeneration() {
  console.log('🧪 Testing ZK Proof Generation Only');
  console.log('   (No transactions will be submitted)\n');

  // Load ZK SDK
  console.log('📦 Loading ZK SDK WASM module...');
  let sdk: any;
  try {
    sdk = await import('@solana/zk-sdk/node');
    console.log('   ✅ ZK SDK loaded successfully');
  } catch (error) {
    console.error('   ❌ Failed to load ZK SDK:', error);
    process.exit(1);
  }

  // List all exports to find the right types
  console.log('\n📋 All ZK SDK exports:');
  const allExports = Object.keys(sdk).sort();
  for (const key of allExports) {
    const type = typeof sdk[key];
    if (type === 'function') {
      console.log(`   ${key}: ${type}`);
    }
  }

  const {
    ElGamalKeypair,
    ElGamalCiphertext,
    ElGamalPubkey,
    AeKey,
    PubkeyValidityProofData,
    CiphertextCiphertextEqualityProofData,
    BatchedGroupedCiphertext2HandlesValidityProofData,
    BatchedRangeProofU64Data,
    BatchedRangeProofU128Data,
    GroupedElGamalCiphertext2Handles,
    PedersenCommitment,
    PedersenOpening,
  } = sdk;

  // Check available exports
  console.log('\n📋 Key ZK SDK exports...');
  console.log(`   ElGamalKeypair: ${typeof ElGamalKeypair}`);
  console.log(`   ElGamalCiphertext: ${typeof ElGamalCiphertext}`);
  console.log(`   ElGamalPubkey: ${typeof ElGamalPubkey}`);
  console.log(`   AeKey: ${typeof AeKey}`);
  console.log(`   PubkeyValidityProofData: ${typeof PubkeyValidityProofData}`);
  console.log(
    `   CiphertextCiphertextEqualityProofData: ${typeof CiphertextCiphertextEqualityProofData}`,
  );
  console.log(
    `   BatchedGroupedCiphertext2HandlesValidityProofData: ${typeof BatchedGroupedCiphertext2HandlesValidityProofData}`,
  );
  console.log(
    `   BatchedRangeProofU64Data: ${typeof BatchedRangeProofU64Data}`,
  );
  console.log(
    `   BatchedRangeProofU128Data: ${typeof BatchedRangeProofU128Data}`,
  );
  console.log(
    `   GroupedElGamalCiphertext2Handles: ${typeof GroupedElGamalCiphertext2Handles}`,
  );
  console.log(`   PedersenCommitment: ${typeof PedersenCommitment}`);
  console.log(`   PedersenOpening: ${typeof PedersenOpening}`);

  // Generate keypairs
  console.log('\n🔑 Generating ElGamal keypairs...');
  const senderKeypair = new ElGamalKeypair();
  const recipientKeypair = new ElGamalKeypair();
  const auditorKeypair = new ElGamalKeypair();
  console.log('   ✅ Generated 3 ElGamal keypairs');

  // Test PubkeyValidityProof
  console.log('\n🔐 Testing PubkeyValidityProofData...');
  try {
    const pubkeyProof = new PubkeyValidityProofData(senderKeypair);
    const pubkeyProofBytes = pubkeyProof.toBytes();
    console.log(
      `   ✅ Generated pubkey validity proof: ${pubkeyProofBytes.length} bytes`,
    );
    pubkeyProof.verify();
    console.log('   ✅ Proof verified locally');
  } catch (e: any) {
    console.log(`   ❌ Failed: ${e.message}`);
  }

  // Test CiphertextCiphertextEqualityProofData
  console.log('\n🔐 Testing CiphertextCiphertextEqualityProofData...');
  const testAmount = 50000000n;

  // Check what methods are available on the keypair and pubkey
  console.log(
    '\n   ElGamalKeypair methods:',
    Object.getOwnPropertyNames(Object.getPrototypeOf(senderKeypair)),
  );
  console.log(
    '   ElGamalPubkey methods:',
    Object.getOwnPropertyNames(Object.getPrototypeOf(senderKeypair.pubkey())),
  );

  // Try to find how to create ciphertexts
  if (ElGamalCiphertext) {
    console.log('   ElGamalCiphertext available');
    console.log(
      '   ElGamalCiphertext static methods:',
      Object.getOwnPropertyNames(ElGamalCiphertext),
    );
  }

  // Try pubkey.encryptWith which returns ciphertext + opening
  let ciphertext: any = null;
  let opening: any = null;
  const senderPubkey = senderKeypair.pubkey();
  const recipientPubkey = recipientKeypair.pubkey();

  // First try encryptWith to get opening too
  try {
    console.log('   Trying senderPubkey.encryptWith...');
    opening = new PedersenOpening();
    ciphertext = senderPubkey.encryptWith(testAmount, opening);
    console.log(`   ✅ Created ciphertext via pubkey.encryptWith`);
    console.log(`   Ciphertext type: ${ciphertext?.constructor?.name}`);
    console.log(`   Opening type: ${opening?.constructor?.name}`);
  } catch (e: any) {
    console.log(`   ❌ pubkey.encryptWith failed: ${e.message}`);

    // Fallback to encryptU64
    try {
      console.log('   Trying senderPubkey.encryptU64...');
      ciphertext = senderPubkey.encryptU64(testAmount);
      console.log(`   ✅ Created ciphertext via pubkey.encryptU64`);
    } catch (e2: any) {
      console.log(`   ❌ pubkey.encryptU64 failed: ${e2.message}`);
    }
  }

  if (ciphertext) {
    // List all possible constructor argument combinations
    const proofConstructorSignatures = [
      // Most likely based on Rust API
      {
        args: [senderKeypair, recipientPubkey, ciphertext, opening, testAmount],
        desc: 'keypair, pubkey, ciphertext, opening, amount',
      },
      {
        args: [senderKeypair, ciphertext, recipientPubkey, testAmount],
        desc: 'keypair, ciphertext, pubkey, amount',
      },
      {
        args: [senderKeypair, ciphertext, opening, recipientPubkey, testAmount],
        desc: 'keypair, ciphertext, opening, pubkey, amount',
      },
      {
        args: [ciphertext, senderKeypair, recipientPubkey, testAmount],
        desc: 'ciphertext, keypair, pubkey, amount',
      },
      {
        args: [ciphertext, opening, senderKeypair, recipientPubkey, testAmount],
        desc: 'ciphertext, opening, keypair, pubkey, amount',
      },
    ].filter((sig) => sig.args.every((a) => a !== null && a !== undefined));

    for (const sig of proofConstructorSignatures) {
      try {
        console.log(`   Trying: ${sig.desc}...`);
        const equalityProof = new CiphertextCiphertextEqualityProofData(
          ...sig.args,
        );
        const equalityProofBytes = equalityProof.toBytes();
        console.log(
          `   ✅ Generated equality proof: ${equalityProofBytes.length} bytes`,
        );
        break;
      } catch (e: any) {
        console.log(`   ❌ Failed: ${e.message.slice(0, 50)}`);
      }
    }
  } else {
    console.log('   ❌ Could not create ciphertext for equality proof');
  }

  // Test BatchedGroupedCiphertext2HandlesValidityProofData
  console.log(
    '\n🔐 Testing BatchedGroupedCiphertext2HandlesValidityProofData...',
  );

  // Check if GroupedElGamalCiphertext2Handles is available
  if (GroupedElGamalCiphertext2Handles) {
    console.log('   GroupedElGamalCiphertext2Handles available');
    console.log(
      '   Static methods:',
      Object.getOwnPropertyNames(GroupedElGamalCiphertext2Handles),
    );

    // Try different ways to create the grouped ciphertext and proof
    let groupedCiphertext: any = null;
    let groupedOpening: any = null;

    // Try encryptWith first to get the opening
    try {
      groupedOpening = new PedersenOpening();
      groupedCiphertext = GroupedElGamalCiphertext2Handles.encryptWith(
        recipientPubkey,
        auditorKeypair.pubkey(),
        testAmount,
        groupedOpening,
      );
      console.log('   ✅ Created grouped ciphertext via encryptWith');
    } catch (e: any) {
      console.log(`   ❌ encryptWith failed: ${e.message}`);

      // Fallback to encrypt
      try {
        groupedCiphertext = GroupedElGamalCiphertext2Handles.encrypt(
          recipientPubkey,
          auditorKeypair.pubkey(),
          testAmount,
        );
        console.log('   ✅ Created grouped ciphertext via encrypt');
      } catch (e2: any) {
        console.log(`   ❌ encrypt failed: ${e2.message}`);
      }
    }

    if (groupedCiphertext) {
      // Try various constructor signatures
      const validitySignatures = [
        {
          args: [groupedCiphertext, groupedOpening],
          desc: 'ciphertext, opening',
        },
        {
          args: [
            recipientPubkey,
            auditorKeypair.pubkey(),
            groupedCiphertext,
            groupedOpening,
            testAmount,
          ],
          desc: 'pubkey1, pubkey2, ciphertext, opening, amount',
        },
        {
          args: [
            groupedCiphertext,
            recipientPubkey,
            auditorKeypair.pubkey(),
            testAmount,
          ],
          desc: 'ciphertext, pubkey1, pubkey2, amount',
        },
        {
          args: [
            groupedCiphertext,
            groupedOpening,
            recipientPubkey,
            auditorKeypair.pubkey(),
            testAmount,
          ],
          desc: 'ciphertext, opening, pubkey1, pubkey2, amount',
        },
      ].filter((sig) => sig.args.every((a) => a !== null && a !== undefined));

      for (const sig of validitySignatures) {
        try {
          console.log(`   Trying: ${sig.desc}...`);
          const validityProof =
            new BatchedGroupedCiphertext2HandlesValidityProofData(...sig.args);
          const validityProofBytes = validityProof.toBytes();
          console.log(
            `   ✅ Generated validity proof: ${validityProofBytes.length} bytes`,
          );
          break;
        } catch (e: any) {
          console.log(`   ❌ Failed: ${e.message.slice(0, 50)}`);
        }
      }
    }
  } else {
    console.log('   ❌ GroupedElGamalCiphertext2Handles not available');
  }

  // Test BatchedRangeProofU64Data
  console.log('\n🔐 Testing BatchedRangeProofU64Data...');
  const remainingBalance = 750000000n;

  // Check if PedersenCommitment and PedersenOpening are available
  if (PedersenCommitment && PedersenOpening) {
    console.log('   PedersenCommitment available');
    console.log(
      '   PedersenCommitment static methods:',
      Object.getOwnPropertyNames(PedersenCommitment),
    );
    console.log('   PedersenOpening available');
    console.log(
      '   PedersenOpening static methods:',
      Object.getOwnPropertyNames(PedersenOpening),
    );

    try {
      // Create commitments and openings for the amounts
      const opening1 = new PedersenOpening();
      const opening2 = new PedersenOpening();

      console.log('   ✅ Created PedersenOpenings');

      // Try to create range proof with commitments
      const rangeProof = new BatchedRangeProofU64Data(
        [testAmount, remainingBalance],
        [opening1, opening2],
        [16, 48],
      );
      const rangeProofBytes = rangeProof.toBytes();
      console.log(
        `   ✅ Generated range proof: ${rangeProofBytes.length} bytes`,
      );
    } catch (e: any) {
      console.log(`   ❌ Failed with openings: ${e.message}`);

      // Try simpler constructor
      try {
        const rangeProof = new BatchedRangeProofU64Data(testAmount, 32);
        const rangeProofBytes = rangeProof.toBytes();
        console.log(
          `   ✅ Generated range proof (simple): ${rangeProofBytes.length} bytes`,
        );
      } catch (e2: any) {
        console.log(`   ❌ Simple constructor failed: ${e2.message}`);
      }
    }
  } else {
    console.log('   ❌ PedersenCommitment/Opening not available');
  }

  // Test AeKey encryption
  console.log('\n🔐 Testing AeKey encryption...');
  try {
    const aeKey = new AeKey();
    const encrypted = aeKey.encrypt(testAmount);
    const encryptedBytes = encrypted.toBytes();
    console.log(`   ✅ AES encrypted: ${encryptedBytes.length} bytes`);

    // Test decryption
    const decrypted = aeKey.decrypt(encrypted);
    console.log(`   ✅ Decrypted: ${decrypted}`);
    if (decrypted === testAmount) {
      console.log('   ✅ Decryption matches original!');
    }
  } catch (e: any) {
    console.log(`   ❌ Failed: ${e.message}`);
  }

  console.log('\n' + '='.repeat(50));
  console.log('Proof generation test complete!');
  console.log('='.repeat(50));
}

// Run main or test mode
if (TEST_PROOFS_ONLY) {
  testProofGeneration().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
} else {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

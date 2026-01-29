/**
 * Wallet Signer Service
 *
 * Handles transaction signing with wallet adapter,
 * including support for additional signers (context state accounts).
 */

import type { WalletAdapter } from '@solana/wallet-adapter-base';
import {
  Connection,
  Transaction,
  VersionedTransaction,
  Keypair,
  TransactionMessage,
  TransactionInstruction,
  PublicKey,
} from '@solana/web3.js';

export interface SendTransactionOptions {
  /** Additional keypairs to sign the transaction (e.g., context state accounts) */
  additionalSigners?: Keypair[];
  /** Skip preflight check (useful for ZK proof instructions) */
  skipPreflight?: boolean;
  /** Maximum number of retry attempts */
  maxRetries?: number;
  /** Description for logging */
  description?: string;
}

/**
 * Sign and send a transaction using the wallet adapter
 *
 * Handles:
 * - Partial signing with additional keypairs (for generated accounts)
 * - Wallet adapter signing
 * - Retry logic for blockhash issues
 */
export async function signAndSendTransaction(
  connection: Connection,
  wallet: WalletAdapter,
  transaction: Transaction,
  options: SendTransactionOptions = {},
): Promise<string> {
  const {
    additionalSigners = [],
    skipPreflight = false,
    maxRetries = 3,
    description = 'transaction',
  } = options;

  if (!wallet.publicKey) {
    throw new Error('Wallet not connected');
  }

  if (!wallet.signTransaction) {
    throw new Error('Wallet does not support transaction signing');
  }

  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Get fresh blockhash
      const { blockhash, lastValidBlockHeight } =
        await connection.getLatestBlockhash('confirmed');

      // Set transaction metadata
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = wallet.publicKey;

      // Partial sign with additional signers first
      if (additionalSigners.length > 0) {
        transaction.partialSign(...additionalSigners);
      }

      // Sign with wallet adapter
      const signedTx = await wallet.signTransaction(transaction);

      // Send the raw transaction
      const signature = await connection.sendRawTransaction(
        signedTx.serialize(),
        { skipPreflight },
      );

      // Wait for confirmation
      let confirmed = false;
      for (let i = 0; i < 30; i++) {
        const status = await connection.getSignatureStatus(signature);
        if (
          status?.value?.confirmationStatus === 'confirmed' ||
          status?.value?.confirmationStatus === 'finalized'
        ) {
          confirmed = true;
          break;
        }
        if (status?.value?.err) {
          throw new Error(
            `Transaction failed on-chain: ${JSON.stringify(status.value.err)}`,
          );
        }
        await sleep(1000);
      }

      if (!confirmed) {
        throw new Error('Transaction confirmation timeout');
      }

      console.log(`[Wallet] ${description} confirmed: ${signature.slice(0, 8)}...`);
      return signature;
    } catch (error: any) {
      lastError = error;
      const isBlockhashError =
        error.message?.includes('Blockhash not found') ||
        error.message?.includes('block height exceeded');

      if (isBlockhashError && attempt < maxRetries) {
        console.log(`[Wallet] Retry ${attempt}/${maxRetries} for ${description}...`);
        await sleep(1000 * attempt);
        continue;
      }

      throw error;
    }
  }

  throw lastError || new Error(`Failed to send ${description}`);
}

/**
 * Build and send a transaction with instructions
 */
export async function buildAndSendTransaction(
  connection: Connection,
  wallet: WalletAdapter,
  instructions: TransactionInstruction[],
  options: SendTransactionOptions = {},
): Promise<string> {
  const transaction = new Transaction().add(...instructions);
  return signAndSendTransaction(connection, wallet, transaction, options);
}

/**
 * Send multiple transactions sequentially
 * Returns array of signatures
 */
export async function sendTransactionsSequentially(
  connection: Connection,
  wallet: WalletAdapter,
  transactions: {
    instructions: TransactionInstruction[];
    additionalSigners?: Keypair[];
    description?: string;
  }[],
  options: Omit<SendTransactionOptions, 'additionalSigners' | 'description'> = {},
): Promise<string[]> {
  const signatures: string[] = [];

  for (let i = 0; i < transactions.length; i++) {
    const { instructions, additionalSigners, description } = transactions[i];
    const sig = await buildAndSendTransaction(connection, wallet, instructions, {
      ...options,
      additionalSigners,
      description: description || `transaction ${i + 1}/${transactions.length}`,
    });
    signatures.push(sig);
  }

  return signatures;
}

/**
 * Helper: sleep for ms milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

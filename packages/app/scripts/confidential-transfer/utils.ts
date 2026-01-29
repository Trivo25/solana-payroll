/**
 * utility functions for confidential transfer operations
 */

import { Connection, Keypair, Transaction, LAMPORTS_PER_SOL } from '@solana/web3.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { DECIMALS, TOKEN_ACCOUNT_SIZE } from './config';
import type { ConfidentialBalance, ZkSdkModule } from './types';

/**
 * load a Solana keypair from a file
 */
export function loadKeypair(filepath?: string): Keypair {
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

/**
 * format a token balance for display
 */
export function formatBalance(
  amount: bigint | number,
  decimals: number = DECIMALS,
): string {
  const value = typeof amount === 'bigint' ? Number(amount) : amount;
  return (value / Math.pow(10, decimals)).toFixed(decimals);
}

/**
 * print a confidential balance breakdown
 */
export function printBalance(
  label: string,
  balance: ConfidentialBalance,
  decimals: number = DECIMALS,
): void {
  console.log(`\n📊 ${label} Balance:`);
  console.log(`   Public:    ${formatBalance(balance.publicBalance, decimals)} tokens`);
  console.log(`   Pending:   ${formatBalance(balance.pendingBalance, decimals)} tokens`);
  console.log(`   Available: ${formatBalance(balance.availableBalance, decimals)} tokens`);
  console.log(`   ─────────────────────────────`);
  console.log(`   Total:     ${formatBalance(balance.totalBalance, decimals)} tokens`);
}

/**
 * send a transaction and wait for confirmation with retry logic
 */
export async function sendAndConfirmTransactionWithRetry(
  connection: Connection,
  transaction: Transaction,
  signers: Keypair[],
  options: {
    maxRetries?: number;
    skipPreflight?: boolean;
    description?: string;
  } = {},
): Promise<string> {
  const { maxRetries = 3, skipPreflight = false, description = 'transaction' } = options;

  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const { blockhash, lastValidBlockHeight } =
        await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = signers[0].publicKey;

      transaction.sign(...signers);

      const signature = await connection.sendRawTransaction(
        transaction.serialize(),
        { skipPreflight },
      );

      await connection.confirmTransaction(
        { signature, blockhash, lastValidBlockHeight },
        'confirmed',
      );

      return signature;
    } catch (error: any) {
      lastError = error;
      if (attempt < maxRetries) {
        console.log(
          `   Retry ${attempt}/${maxRetries} for ${description}: ${error.message}`,
        );
        await sleep(1000 * attempt);
      }
    }
  }

  throw lastError || new Error(`Failed to send ${description}`);
}

/**
 * sleep for a specified number of milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * get the confidential balance from a token account
 */
export async function getConfidentialBalance(
  connection: Connection,
  tokenAccount: import('@solana/web3.js').PublicKey,
  aeKey: InstanceType<ZkSdkModule['AeKey']>,
  zkSdk: ZkSdkModule,
): Promise<ConfidentialBalance> {
  const accountInfo = await connection.getAccountInfo(tokenAccount);
  if (!accountInfo) {
    throw new Error('Token account not found');
  }

  const data = accountInfo.data;

  // get public balance from base token account (offset 64, 8 bytes)
  const publicBalance = data.readBigUInt64LE(64);

  // parse extensions to find ConfidentialTransferAccount
  let pendingBalance = 0n;
  let availableBalance = 0n;

  let offset = TOKEN_ACCOUNT_SIZE;
  if (data.length > TOKEN_ACCOUNT_SIZE) {
    offset += 1; // account type byte
  }

  while (offset + 4 <= data.length) {
    const extensionType = data.readUInt16LE(offset);
    const extensionLength = data.readUInt16LE(offset + 2);

    if (extensionType === 5) {
      // confidentialTransferAccount
      const extensionStart = offset + 4;

      // pending_balance_lo at offset 33, pending_balance_hi at offset 97
      const pendingLoOffset = extensionStart + 1 + 32; // after approved + pubkey
      const pendingHiOffset = pendingLoOffset + 64;

      // available_balance at offset 161
      const availableOffset = pendingHiOffset + 64;

      // decryptable_available_balance at offset 225
      const decryptableOffset = availableOffset + 64;

      // decrypt available balance using AE key
      const decryptableBytes = Uint8Array.from(
        data.subarray(decryptableOffset, decryptableOffset + 36),
      );
      const decryptableCiphertext = zkSdk.AeCiphertext.fromBytes(decryptableBytes);
      if (decryptableCiphertext) {
        const decrypted = decryptableCiphertext.decrypt(aeKey);
        if (decrypted !== undefined) {
          availableBalance = decrypted;
        }
      }

      // for pending, try to decrypt pending_balance_lo and pending_balance_hi
      // this is more complex as they're ElGamal ciphertexts, skip for now
      // and use the pending_balance_credit_counter as an indicator

      break;
    }

    offset += 4 + extensionLength;
  }

  return {
    publicBalance,
    pendingBalance,
    availableBalance,
    totalBalance: publicBalance + pendingBalance + availableBalance,
  };
}

/**
 * load the ZK SDK WASM module
 */
export async function loadZkSdk(): Promise<ZkSdkModule> {
  console.log('📦 Loading ZK SDK WASM module...');
  try {
    const sdk = await import('@solana/zk-sdk/node');
    console.log('   ✅ ZK SDK loaded successfully');

    // list key exports for debugging
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
    const available = keyExports.filter((e) => e in sdk);
    console.log(`   Available: ${available.join(', ')}`);

    return sdk as ZkSdkModule;
  } catch (error) {
    console.error('   ❌ Failed to load ZK SDK:', error);
    throw error;
  }
}

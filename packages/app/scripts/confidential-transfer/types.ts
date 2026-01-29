/**
 * types and interfaces for confidential transfer operations
 */

import { Connection, Keypair, PublicKey } from '@solana/web3.js';

// import types from the ZK SDK package for proper IntelliSense
export type ZkSdkModule = typeof import('@solana/zk-sdk/node');

/**
 * ElGamal ciphertext structure:
 * - 32 bytes: Pedersen commitment (Ristretto point)
 * - 32 bytes: decrypt handle (Ristretto point)
 */
export interface CiphertextComponents {
  commitment: Uint8Array;
  handle: Uint8Array;
}

/**
 * confidential balance breakdown for a token account
 */
export interface ConfidentialBalance {
  publicBalance: bigint;
  pendingBalance: bigint;
  availableBalance: bigint;
  totalBalance: bigint;
}

/**
 * context for the confidential transfer flow
 */
export interface TransferContext {
  connection: Connection;
  payer: Keypair;
  sender: Keypair;
  recipient: Keypair;
  mint: Keypair;
  senderTokenAccount: PublicKey;
  recipientTokenAccount: PublicKey;
  auditorKeypair: InstanceType<ZkSdkModule['ElGamalKeypair']>;
  senderElGamal: InstanceType<ZkSdkModule['ElGamalKeypair']>;
  senderAeKey: InstanceType<ZkSdkModule['AeKey']>;
  recipientElGamal: InstanceType<ZkSdkModule['ElGamalKeypair']>;
  recipientAeKey: InstanceType<ZkSdkModule['AeKey']>;
  zkSdk: ZkSdkModule;
}

/**
 * result of generating transfer proofs
 */
export interface TransferProofs {
  equalityProofBytes: Uint8Array;
  validityProofBytes: Uint8Array;
  rangeProofBytes: Uint8Array;
  groupedCiphertextLo: InstanceType<ZkSdkModule['GroupedElGamalCiphertext3Handles']>;
  groupedCiphertextHi: InstanceType<ZkSdkModule['GroupedElGamalCiphertext3Handles']>;
  newSenderBalance: bigint;
}

/**
 * proof context accounts for the transfer instruction
 */
export interface ProofContextAccounts {
  equalityContextAccount: Keypair;
  validityContextAccount: Keypair;
  rangeContextAccount: Keypair;
}

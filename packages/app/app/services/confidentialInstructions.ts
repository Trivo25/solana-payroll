/**
 * Instruction builders for confidential transfer operations
 *
 * Ported from scripts/confidential-transfer/instructions.ts
 * for use in the browser with wallet adapter
 */

import {
  PublicKey,
  TransactionInstruction,
  SystemProgram,
  SYSVAR_INSTRUCTIONS_PUBKEY,
} from '@solana/web3.js';
import { TOKEN_2022_PROGRAM_ID, ExtensionType } from '@solana/spl-token';

// ZK ElGamal Proof Program ID
export const ZK_ELGAMAL_PROOF_PROGRAM_ID = new PublicKey(
  'ZkE1Gama1Proof11111111111111111111111111111',
);

// Token account base size (without extensions)
export const TOKEN_ACCOUNT_SIZE = 165;

// ============================================
// Context State Account Sizes
// ============================================

export function getContextStateAccountSize(
  proofType: 'pubkey' | 'equality' | 'validity' | 'range',
): number {
  const baseSize = 32 + 1; // authority + proof_type

  switch (proofType) {
    case 'pubkey':
      return baseSize + 32;
    case 'equality':
      return baseSize + 32 + 64 + 32; // = 161
    case 'validity':
      return baseSize + 32 + 32 + 32 + 128 + 128; // = 385
    case 'range':
      return baseSize + 128 + 8 + 128; // ~297 bytes with padding
    default:
      throw new Error(`Unknown proof type: ${proofType}`);
  }
}

// ============================================
// Token Extension Instructions
// ============================================

/**
 * Create instruction to initialize ConfidentialTransferMint extension
 */
export function createInitializeConfidentialTransferMintInstruction(
  mint: PublicKey,
  authority: PublicKey | null,
  autoApproveNewAccounts: boolean,
  auditorElGamalPubkey: Uint8Array | null,
  programId: PublicKey = TOKEN_2022_PROGRAM_ID,
): TransactionInstruction {
  const data = Buffer.alloc(67);
  let offset = 0;

  data.writeUInt8(27, offset); // ConfidentialTransferExtension
  offset += 1;
  data.writeUInt8(0, offset); // InitializeMint = 0
  offset += 1;

  if (authority) {
    authority.toBuffer().copy(data, offset);
  }
  offset += 32;

  data.writeUInt8(autoApproveNewAccounts ? 1 : 0, offset);
  offset += 1;

  if (auditorElGamalPubkey && auditorElGamalPubkey.length === 32) {
    Buffer.from(auditorElGamalPubkey).copy(data, offset);
  }

  return new TransactionInstruction({
    keys: [{ pubkey: mint, isSigner: false, isWritable: true }],
    programId,
    data,
  });
}

/**
 * Create instruction to reallocate account for new extension
 */
export function createReallocateInstruction(
  account: PublicKey,
  payer: PublicKey,
  owner: PublicKey,
  extensionTypes: ExtensionType[],
  programId: PublicKey = TOKEN_2022_PROGRAM_ID,
): TransactionInstruction {
  const data = Buffer.alloc(1 + extensionTypes.length * 2);
  data.writeUInt8(29, 0);

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
 */
export function createConfigureAccountInstruction(
  account: PublicKey,
  mint: PublicKey,
  authority: PublicKey,
  decryptableZeroBalance: Uint8Array,
  maxPendingBalanceCreditCounter: bigint,
  proofInstructionOffset: number,
  programId: PublicKey = TOKEN_2022_PROGRAM_ID,
): TransactionInstruction {
  const data = Buffer.alloc(2 + 36 + 8 + 1);
  let offset = 0;

  data.writeUInt8(27, offset);
  offset += 1;
  data.writeUInt8(2, offset); // ConfigureAccount = 2
  offset += 1;

  Buffer.from(decryptableZeroBalance).copy(data, offset, 0, 36);
  offset += 36;

  const counterBuf = Buffer.alloc(8);
  counterBuf.writeBigUInt64LE(maxPendingBalanceCreditCounter);
  counterBuf.copy(data, offset);
  offset += 8;

  data.writeInt8(proofInstructionOffset, offset);

  return new TransactionInstruction({
    keys: [
      { pubkey: account, isSigner: false, isWritable: true },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_INSTRUCTIONS_PUBKEY, isSigner: false, isWritable: false },
      { pubkey: authority, isSigner: true, isWritable: false },
    ],
    programId,
    data,
  });
}

/**
 * Create instruction to deposit tokens to confidential balance
 */
export function createDepositInstruction(
  account: PublicKey,
  mint: PublicKey,
  owner: PublicKey,
  amount: bigint,
  decimals: number,
  programId: PublicKey = TOKEN_2022_PROGRAM_ID,
): TransactionInstruction {
  const data = Buffer.alloc(2 + 8 + 1);
  let offset = 0;

  data.writeUInt8(27, offset);
  offset += 1;
  data.writeUInt8(5, offset); // Deposit = 5
  offset += 1;

  const amountBuf = Buffer.alloc(8);
  amountBuf.writeBigUInt64LE(amount);
  amountBuf.copy(data, offset);
  offset += 8;

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
 */
export function createApplyPendingBalanceInstruction(
  account: PublicKey,
  owner: PublicKey,
  expectedPendingBalanceCreditCounter: bigint,
  newDecryptableAvailableBalance: Uint8Array,
  programId: PublicKey = TOKEN_2022_PROGRAM_ID,
): TransactionInstruction {
  const data = Buffer.alloc(2 + 8 + 36);
  let offset = 0;

  data.writeUInt8(27, offset);
  offset += 1;
  data.writeUInt8(8, offset); // ApplyPendingBalance = 8
  offset += 1;

  const counterBuf = Buffer.alloc(8);
  counterBuf.writeBigUInt64LE(expectedPendingBalanceCreditCounter);
  counterBuf.copy(data, offset);
  offset += 8;

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

/**
 * Create instruction to withdraw from confidential balance
 */
export function createWithdrawInstruction(
  account: PublicKey,
  mint: PublicKey,
  owner: PublicKey,
  amount: bigint,
  decimals: number,
  newDecryptableAvailableBalance: Uint8Array,
  equalityProofContext: PublicKey,
  rangeProofContext: PublicKey,
  programId: PublicKey = TOKEN_2022_PROGRAM_ID,
): TransactionInstruction {
  const data = Buffer.alloc(2 + 8 + 1 + 36 + 1 + 1);
  let offset = 0;

  data.writeUInt8(27, offset);
  offset += 1;
  data.writeUInt8(6, offset); // Withdraw = 6
  offset += 1;

  const amountBuf = Buffer.alloc(8);
  amountBuf.writeBigUInt64LE(amount);
  amountBuf.copy(data, offset);
  offset += 8;

  data.writeUInt8(decimals, offset);
  offset += 1;

  Buffer.from(newDecryptableAvailableBalance).copy(data, offset, 0, 36);
  offset += 36;

  // Proof instruction offsets (0 = use context state account)
  data.writeInt8(0, offset);
  offset += 1;
  data.writeInt8(0, offset);

  return new TransactionInstruction({
    keys: [
      { pubkey: account, isSigner: false, isWritable: true },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: equalityProofContext, isSigner: false, isWritable: false },
      { pubkey: rangeProofContext, isSigner: false, isWritable: false },
      { pubkey: owner, isSigner: true, isWritable: false },
    ],
    programId,
    data,
  });
}

/**
 * Create instruction to transfer tokens confidentially
 */
export function createConfidentialTransferInstruction(
  sourceAccount: PublicKey,
  mint: PublicKey,
  destinationAccount: PublicKey,
  equalityProofContext: PublicKey,
  validityProofContext: PublicKey,
  rangeProofContext: PublicKey,
  owner: PublicKey,
  newSourceDecryptableBalance: Uint8Array,
  auditorCiphertextLo: Uint8Array,
  auditorCiphertextHi: Uint8Array,
  programId: PublicKey = TOKEN_2022_PROGRAM_ID,
): TransactionInstruction {
  const data = Buffer.alloc(169);
  let offset = 0;

  data.writeUInt8(27, offset);
  offset += 1;
  data.writeUInt8(7, offset); // Transfer = 7
  offset += 1;

  Buffer.from(newSourceDecryptableBalance).copy(data, offset, 0, 36);
  offset += 36;

  Buffer.from(auditorCiphertextLo).copy(data, offset, 0, 64);
  offset += 64;

  Buffer.from(auditorCiphertextHi).copy(data, offset, 0, 64);
  offset += 64;

  // Proof instruction offsets (0 = use context state account)
  data.writeInt8(0, offset);
  offset += 1;
  data.writeInt8(0, offset);
  offset += 1;
  data.writeInt8(0, offset);

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
// ZK Proof Instructions
// ============================================

/**
 * Create instruction to verify pubkey validity proof
 */
export function createVerifyPubkeyValidityInstruction(
  proofData: Uint8Array,
): TransactionInstruction {
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
 * Create instruction to verify ciphertext-commitment equality proof
 */
export function createVerifyCiphertextCommitmentEqualityInstruction(
  proofData: Uint8Array,
  contextStateAccount?: PublicKey,
  contextStateAuthority?: PublicKey,
): TransactionInstruction {
  const data = Buffer.alloc(1 + proofData.length);
  data.writeUInt8(3, 0); // VerifyCiphertextCommitmentEquality = 3
  Buffer.from(proofData).copy(data, 1);

  const keys: { pubkey: PublicKey; isSigner: boolean; isWritable: boolean }[] = [];

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
 */
export function createVerifyBatchedGroupedCiphertext3HandlesValidityInstruction(
  proofData: Uint8Array,
  contextStateAccount?: PublicKey,
  contextStateAuthority?: PublicKey,
): TransactionInstruction {
  const data = Buffer.alloc(1 + proofData.length);
  data.writeUInt8(12, 0); // VerifyBatchedGroupedCiphertext3HandlesValidity = 12
  Buffer.from(proofData).copy(data, 1);

  const keys: { pubkey: PublicKey; isSigner: boolean; isWritable: boolean }[] = [];

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
 */
export function createVerifyBatchedRangeProofU64Instruction(
  proofData: Uint8Array,
  contextStateAccount?: PublicKey,
  contextStateAuthority?: PublicKey,
): TransactionInstruction {
  const data = Buffer.alloc(1 + proofData.length);
  data.writeUInt8(6, 0); // VerifyBatchedRangeProofU64 = 6
  Buffer.from(proofData).copy(data, 1);

  const keys: { pubkey: PublicKey; isSigner: boolean; isWritable: boolean }[] = [];

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
 */
export function createVerifyBatchedRangeProofU128Instruction(
  proofData: Uint8Array,
  contextStateAccount?: PublicKey,
  contextStateAuthority?: PublicKey,
): TransactionInstruction {
  const data = Buffer.alloc(1 + proofData.length);
  data.writeUInt8(7, 0); // VerifyBatchedRangeProofU128 = 7
  Buffer.from(proofData).copy(data, 1);

  const keys: { pubkey: PublicKey; isSigner: boolean; isWritable: boolean }[] = [];

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
 */
export function createCloseContextStateInstruction(
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
// Helper Functions
// ============================================

/**
 * Read the pending_balance_credit_counter from a token account
 */
export function readPendingBalanceCreditCounter(accountData: Buffer): bigint {
  let offset = 166; // Start after base account + account type byte

  while (offset + 4 < accountData.length) {
    const extType = accountData.readUInt16LE(offset);
    const extLength = accountData.readUInt16LE(offset + 2);

    if (extType === 5) {
      // ConfidentialTransferAccount = 5
      const extDataStart = offset + 4;
      const counterOffset = extDataStart + 263;

      if (counterOffset + 8 <= accountData.length) {
        return accountData.readBigUInt64LE(counterOffset);
      }
    }
    offset += 4 + extLength;
  }

  return 0n;
}

/**
 * Read the decryptable_available_balance from a token account
 */
export function readDecryptableAvailableBalance(
  accountData: Buffer,
): Uint8Array | null {
  let offset = TOKEN_ACCOUNT_SIZE;
  if (accountData.length > TOKEN_ACCOUNT_SIZE) {
    offset += 1; // account type byte
  }

  while (offset + 4 <= accountData.length) {
    const extensionType = accountData.readUInt16LE(offset);
    const extensionLength = accountData.readUInt16LE(offset + 2);

    if (extensionType === 5) {
      // ConfidentialTransferAccount
      const extensionStart = offset + 4;
      // decryptable_available_balance is at offset 225 within the extension
      const decryptableOffset = extensionStart + 225;

      if (decryptableOffset + 36 <= accountData.length) {
        return Uint8Array.from(
          accountData.subarray(decryptableOffset, decryptableOffset + 36),
        );
      }
    }
    offset += 4 + extensionLength;
  }

  return null;
}

/**
 * Read the ElGamal public key from a token account's ConfidentialTransferAccount extension
 */
export function readElGamalPubkey(accountData: Buffer): Uint8Array | null {
  let offset = TOKEN_ACCOUNT_SIZE;
  if (accountData.length > TOKEN_ACCOUNT_SIZE) {
    offset += 1; // account type byte
  }

  while (offset + 4 <= accountData.length) {
    const extensionType = accountData.readUInt16LE(offset);
    const extensionLength = accountData.readUInt16LE(offset + 2);

    if (extensionType === 5) {
      // ConfidentialTransferAccount
      const extensionStart = offset + 4;
      // elgamal_pubkey is at offset 1 within the extension (after approved bool)
      const pubkeyOffset = extensionStart + 1;

      if (pubkeyOffset + 32 <= accountData.length) {
        return Uint8Array.from(accountData.subarray(pubkeyOffset, pubkeyOffset + 32));
      }
    }
    offset += 4 + extensionLength;
  }

  return null;
}

/**
 * Read the pending_balance ciphertexts (lo and hi) from a token account
 */
export function readPendingBalanceCiphertexts(
  accountData: Buffer,
): { lo: Uint8Array; hi: Uint8Array } | null {
  let offset = TOKEN_ACCOUNT_SIZE;
  if (accountData.length > TOKEN_ACCOUNT_SIZE) {
    offset += 1; // account type byte
  }

  while (offset + 4 <= accountData.length) {
    const extensionType = accountData.readUInt16LE(offset);
    const extensionLength = accountData.readUInt16LE(offset + 2);

    if (extensionType === 5) {
      // ConfidentialTransferAccount
      const extensionStart = offset + 4;
      // pending_balance_lo is at offset 33 within the extension (after approved bool + elgamal_pubkey)
      // pending_balance_hi is at offset 97 (33 + 64)
      const loOffset = extensionStart + 33;
      const hiOffset = extensionStart + 97;

      if (hiOffset + 64 <= accountData.length) {
        return {
          lo: Uint8Array.from(accountData.subarray(loOffset, loOffset + 64)),
          hi: Uint8Array.from(accountData.subarray(hiOffset, hiOffset + 64)),
        };
      }
    }
    offset += 4 + extensionLength;
  }

  return null;
}

/**
 * Read the available_balance ciphertext from a token account
 */
export function readAvailableBalanceCiphertext(
  accountData: Buffer,
): Uint8Array | null {
  let offset = TOKEN_ACCOUNT_SIZE;
  if (accountData.length > TOKEN_ACCOUNT_SIZE) {
    offset += 1; // account type byte
  }

  while (offset + 4 <= accountData.length) {
    const extensionType = accountData.readUInt16LE(offset);
    const extensionLength = accountData.readUInt16LE(offset + 2);

    if (extensionType === 5) {
      // ConfidentialTransferAccount
      const extensionStart = offset + 4;
      // available_balance is at offset 161 within the extension
      const availableOffset = extensionStart + 161;

      if (availableOffset + 64 <= accountData.length) {
        return Uint8Array.from(
          accountData.subarray(availableOffset, availableOffset + 64),
        );
      }
    }
    offset += 4 + extensionLength;
  }

  return null;
}

/**
 * Check if a token account has the ConfidentialTransferAccount extension
 */
export function hasConfidentialTransferExtension(accountData: Buffer): boolean {
  let offset = TOKEN_ACCOUNT_SIZE;
  if (accountData.length > TOKEN_ACCOUNT_SIZE) {
    offset += 1; // account type byte
  }

  while (offset + 4 <= accountData.length) {
    const extensionType = accountData.readUInt16LE(offset);
    const extensionLength = accountData.readUInt16LE(offset + 2);

    if (extensionType === 5) {
      // ConfidentialTransferAccount
      return true;
    }
    offset += 4 + extensionLength;
  }

  return false;
}

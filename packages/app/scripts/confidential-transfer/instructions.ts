/**
 * instruction builders for confidential transfer operations
 */

import {
  PublicKey,
  TransactionInstruction,
  SystemProgram,
  SYSVAR_INSTRUCTIONS_PUBKEY,
} from '@solana/web3.js';
import { TOKEN_2022_PROGRAM_ID, ExtensionType } from '@solana/spl-token';
import { ZK_ELGAMAL_PROOF_PROGRAM_ID, getContextStateAccountSize } from './config';

// re-export for convenience
export { getContextStateAccountSize };

// ============================================
// token extension instructions
// ============================================

/**
 * create instruction to initialize ConfidentialTransferMint extension
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
 * create instruction to reallocate account for new extension
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
 * create instruction to configure account for confidential transfers
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
 * create instruction to deposit tokens to confidential balance
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
 * create instruction to apply pending balance
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
 * create instruction to transfer tokens confidentially
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

  // proof instruction offsets (0 = use context state account)
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
// zk proof instructions
// ============================================

/**
 * create instruction to verify pubkey validity proof
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
 * create instruction to verify ciphertext-commitment equality proof
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
 * create instruction to verify batched grouped ciphertext validity proof (3 handles)
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
 * create instruction to verify batched range proof U128
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
 * create instruction to close a context state account
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
// helper functions
// ============================================

/**
 * read the pending_balance_credit_counter from a token account
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

/**
 * configuration constants for confidential transfer operations
 */

import { PublicKey } from '@solana/web3.js';

// rpc configuration
export const RPC_URL = 'https://zk-edge.surfnet.dev:8899';
export const WS_URL = 'wss://zk-edge.surfnet.dev:8900';

// token configuration
export const DECIMALS = 9;
export const MINT_AMOUNT = 1_000_000_000n; // 1 token with 9 decimals
export const DEPOSIT_AMOUNT = 800_000_000n; // 0.8 tokens
export const TRANSFER_AMOUNT = 100_000_000n; // 0.1 tokens

// zk elgamal proof program id
export const ZK_ELGAMAL_PROOF_PROGRAM_ID = new PublicKey(
  'ZkE1Gama1Proof11111111111111111111111111111',
);

// token account base size (without extensions)
export const TOKEN_ACCOUNT_SIZE = 165;

// proof instruction discriminators for zk elgamal proof program
export const ProofInstructionDiscriminator = {
  VerifyPubkeyValidity: 0,
  VerifyZeroCiphertext: 1,
  VerifyCiphertextCiphertextEquality: 2,
  VerifyCiphertextCommitmentEquality: 3,
  VerifyGroupedCiphertext2HandlesValidity: 4,
  VerifyBatchedGroupedCiphertext2HandlesValidity: 5,
  VerifyGroupedCiphertext3HandlesValidity: 6,
  VerifyBatchedGroupedCiphertext3HandlesValidity: 7,
  VerifyBatchedRangeProofU64: 8,
  VerifyBatchedRangeProofU128: 9,
  VerifyBatchedRangeProofU256: 10,
  CloseContextState: 11,
} as const;

// context state account sizes (based on SPL Token 2022 specs)
export function getContextStateAccountSize(
  proofType: 'pubkey' | 'equality' | 'validity' | 'range',
): number {
  // proofContextState structure:
  // - context_state_authority: Pubkey (32 bytes)
  // - proof_type: u8 (1 byte)
  // - proof_context: variable size depending on proof type
  const baseSize = 32 + 1; // authority + proof_type

  switch (proofType) {
    case 'pubkey':
      // pubkeyValidityProofContext: pubkey (32 bytes)
      return baseSize + 32;
    case 'equality':
      // ciphertextCommitmentEqualityProofContext:
      // - pubkey (32 bytes)
      // - ciphertext (64 bytes)
      // - commitment (32 bytes)
      return baseSize + 32 + 64 + 32; // = 161
    case 'validity':
      // batchedGroupedCiphertext3HandlesValidityProofContext:
      // - first_pubkey (32 bytes)
      // - second_pubkey (32 bytes)
      // - third_pubkey (32 bytes)
      // - grouped_ciphertext_lo (128 bytes)
      // - grouped_ciphertext_hi (128 bytes)
      return baseSize + 32 + 32 + 32 + 128 + 128; // = 385
    case 'range':
      // batchedRangeProofContext (U128):
      // - commitments: 4 * PodPedersenCommitment (4 * 32 = 128 bytes)
      // - bit_lengths: 4 * u8 (4 bytes) padded to 8 bytes
      // plus the context state base
      return baseSize + 128 + 8 + 128; // ~297 bytes with padding
    default:
      throw new Error(`Unknown proof type: ${proofType}`);
  }
}

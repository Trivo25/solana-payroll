/**
 * Isolated ZK Proof Generation Test
 *
 * This script tests the exact constructor signatures from the TypeScript definitions.
 *
 * Usage: npx tsx scripts/test-zk-proofs.ts
 */

import * as SDK from '@solana/zk-sdk/node';

async function main() {
  console.log('='.repeat(60));
  console.log('ZK Proof Generation Test (Using Exact TypeScript Signatures)');
  console.log('='.repeat(60));

  // Load the SDK
  console.log('\n1. Loading @solana/zk-sdk...');
  console.log('   Loaded successfully\n');

  const {
    ElGamalKeypair,
    ElGamalPubkey,
    ElGamalCiphertext,
    PedersenOpening,
    PedersenCommitment,
    GroupedElGamalCiphertext2Handles,
    PubkeyValidityProofData,
    CiphertextCiphertextEqualityProofData,
    GroupedCiphertext2HandlesValidityProofData,
    BatchedGroupedCiphertext2HandlesValidityProofData,
    BatchedRangeProofU64Data,
  } = SDK;

  const amount = BigInt(50_000_000);

  // ============================================
  // TEST 1: PubkeyValidityProofData (works)
  // ============================================
  console.log('='.repeat(60));
  console.log('TEST 1: PubkeyValidityProofData');
  console.log('Signature: constructor(keypair: ElGamalKeypair)');
  console.log('='.repeat(60));

  try {
    const keypair = new ElGamalKeypair();
    const proof = new PubkeyValidityProofData(keypair);

    console.log(`✅ Created proof: ${proof.toBytes().length} bytes`);
    proof.verify();
    console.log('✅ Verified locally');
  } catch (e: any) {
    console.log(`❌ Failed: ${e.message}`);
  }

  // ============================================
  // TEST 2: CiphertextCiphertextEqualityProofData
  // ============================================
  console.log('\n' + '='.repeat(60));
  console.log('TEST 2: CiphertextCiphertextEqualityProofData');
  console.log(
    'Signature: constructor(first_keypair, second_pubkey, first_ciphertext, second_ciphertext, second_opening, amount)',
  );
  console.log('='.repeat(60));

  try {
    // Create fresh objects for each parameter
    const firstKeypair = new ElGamalKeypair();
    const secondKeypair = new ElGamalKeypair();
    const secondPubkey = secondKeypair.pubkey();

    // Create first ciphertext (encrypted under first keypair's pubkey)
    const firstPubkey = firstKeypair.pubkey();
    const firstCiphertext = firstPubkey.encryptU64(amount);

    // Create second ciphertext (encrypted under second pubkey) with opening
    const secondOpening = new PedersenOpening();
    const secondCiphertext = secondPubkey.encryptWith(amount, secondOpening);

    console.log('   Created all parameters:');
    console.log(`   - firstKeypair: ${firstKeypair.constructor.name}`);
    console.log(`   - secondPubkey: ${secondPubkey.constructor.name}`);
    console.log(`   - firstCiphertext: ${firstCiphertext.constructor.name}`);
    console.log(`   - secondCiphertext: ${secondCiphertext.constructor.name}`);
    console.log(`   - secondOpening: ${secondOpening.constructor.name}`);
    console.log(`   - amount: ${amount}`);

    const proof = new CiphertextCiphertextEqualityProofData(
      firstKeypair,
      secondPubkey,
      firstCiphertext,
      secondCiphertext,
      secondOpening,
      amount,
    );
    console.log(`✅ Created proof: ${proof.toBytes().length} bytes`);

    proof.verify();
    console.log('✅ Verified locally');
  } catch (e: any) {
    console.log(`❌ Failed: ${e.message}`);
  }

  // ============================================
  // TEST 3: GroupedCiphertext2HandlesValidityProofData (non-batched)
  // ============================================
  console.log('\n' + '='.repeat(60));
  console.log(
    'TEST 3: GroupedCiphertext2HandlesValidityProofData (non-batched)',
  );
  console.log(
    'Signature: constructor(first_pubkey, second_pubkey, grouped_ciphertext, amount, opening)',
  );
  console.log('='.repeat(60));

  try {
    const firstKeypair = new ElGamalKeypair();
    const secondKeypair = new ElGamalKeypair();
    const firstPubkey = firstKeypair.pubkey();
    const secondPubkey = secondKeypair.pubkey();

    // Create grouped ciphertext with opening
    const opening = new PedersenOpening();
    const groupedCiphertext = GroupedElGamalCiphertext2Handles.encryptWith(
      firstPubkey,
      secondPubkey,
      amount,
      opening,
    );

    console.log('   Created all parameters:');
    console.log(`   - firstPubkey: ${firstPubkey.constructor.name}`);
    console.log(`   - secondPubkey: ${secondPubkey.constructor.name}`);
    console.log(
      `   - groupedCiphertext: ${groupedCiphertext.constructor.name}`,
    );
    console.log(`   - amount: ${amount}`);
    console.log(`   - opening: ${opening.constructor.name}`);

    const proof = new GroupedCiphertext2HandlesValidityProofData(
      firstPubkey,
      secondPubkey,
      groupedCiphertext,
      amount,
      opening,
    );
    console.log(`✅ Created proof: ${proof.toBytes().length} bytes`);

    proof.verify();
    console.log('✅ Verified locally');
  } catch (e: any) {
    console.log(`❌ Failed: ${e.message}`);
  }

  // ============================================
  // TEST 4: BatchedGroupedCiphertext2HandlesValidityProofData
  // ============================================
  console.log('\n' + '='.repeat(60));
  console.log('TEST 4: BatchedGroupedCiphertext2HandlesValidityProofData');
  console.log(
    'Signature: constructor(first_pubkey, second_pubkey, grouped_lo, grouped_hi, amount_lo, amount_hi, opening_lo, opening_hi)',
  );
  console.log('='.repeat(60));

  try {
    const firstKeypair = new ElGamalKeypair();
    const secondKeypair = new ElGamalKeypair();
    const firstPubkey = firstKeypair.pubkey();
    const secondPubkey = secondKeypair.pubkey();

    // For batched, we need lo and hi parts (typically for amounts > 48 bits)
    const amountLo = BigInt(50_000_000); // Lower 16 bits worth
    const amountHi = BigInt(0); // Upper bits

    const openingLo = new PedersenOpening();
    const openingHi = new PedersenOpening();

    const groupedCiphertextLo = GroupedElGamalCiphertext2Handles.encryptWith(
      firstPubkey,
      secondPubkey,
      amountLo,
      openingLo,
    );

    const groupedCiphertextHi = GroupedElGamalCiphertext2Handles.encryptWith(
      firstPubkey,
      secondPubkey,
      amountHi,
      openingHi,
    );

    console.log('   Created all parameters for batched proof');

    const proof = new BatchedGroupedCiphertext2HandlesValidityProofData(
      firstPubkey,
      secondPubkey,
      groupedCiphertextLo,
      groupedCiphertextHi,
      amountLo,
      amountHi,
      openingLo,
      openingHi,
    );
    console.log(`✅ Created proof: ${proof.toBytes().length} bytes`);

    proof.verify();
    console.log('✅ Verified locally');
  } catch (e: any) {
    console.log(`❌ Failed: ${e.message}`);
  }

  // ============================================
  // TEST 5: BatchedRangeProofU64Data
  // ============================================
  console.log('\n' + '='.repeat(60));
  console.log('TEST 5: BatchedRangeProofU64Data');
  console.log(
    'Signature: constructor(commitments: PedersenCommitment[], amounts: BigUint64Array, bit_lengths: Uint8Array, openings: PedersenOpening[])',
  );
  console.log('='.repeat(60));

  try {
    // For 64-bit range proof, bit lengths must sum to 64
    // Common split: 16 + 32 + 16 = 64, or 32 + 32 = 64
    const amount1 = BigInt(50_000_000); // Fits in 32 bits
    const amount2 = BigInt(750_000_000); // Fits in 32 bits

    const opening1 = new PedersenOpening();
    const opening2 = new PedersenOpening();

    const commitment1 = PedersenCommitment.from(amount1, opening1);
    const commitment2 = PedersenCommitment.from(amount2, opening2);

    // Use BigUint64Array for amounts
    const amounts = new BigUint64Array([amount1, amount2]);

    // Bit lengths must sum to 64 and be powers of 2
    const bitLengths = new Uint8Array([32, 32]);

    console.log('   Created all parameters:');
    console.log(
      `   - commitments: [${commitment1.constructor.name}, ${commitment2.constructor.name}]`,
    );
    console.log(`   - amounts: BigUint64Array[${amount1}, ${amount2}]`);
    console.log(`   - bit_lengths: Uint8Array[32, 32]`);
    console.log(
      `   - openings: [${opening1.constructor.name}, ${opening2.constructor.name}]`,
    );

    const proof = new BatchedRangeProofU64Data(
      [commitment1, commitment2],
      amounts,
      bitLengths,
      [opening1, opening2],
    );
    console.log(`✅ Created proof: ${proof.toBytes().length} bytes`);

    proof.verify();
    console.log('✅ Verified locally');
  } catch (e: any) {
    console.log(`❌ Failed: ${e.message}`);
  }

  // ============================================
  // TEST 6: BatchedGroupedCiphertext3HandlesValidityProofData
  // ============================================
  console.log('\n' + '='.repeat(60));
  console.log('TEST 6: BatchedGroupedCiphertext3HandlesValidityProofData');
  console.log(
    'Signature: constructor(first_pubkey, second_pubkey, third_pubkey, grouped_lo, grouped_hi, amount_lo, amount_hi, opening_lo, opening_hi)',
  );
  console.log(
    'This is for confidential transfers with 3 handles: source, destination, auditor',
  );
  console.log('='.repeat(60));

  try {
    const {
      BatchedGroupedCiphertext3HandlesValidityProofData,
      GroupedElGamalCiphertext3Handles,
    } = SDK;

    const sourceKeypair = new ElGamalKeypair();
    const destKeypair = new ElGamalKeypair();
    const auditorKeypair = new ElGamalKeypair();
    const sourcePubkey = sourceKeypair.pubkey();
    const destPubkey = destKeypair.pubkey();
    const auditorPubkey = auditorKeypair.pubkey();

    // For batched, we need lo and hi parts
    const amountLo = BigInt(50_000_000);
    const amountHi = BigInt(0);

    const openingLo = new PedersenOpening();
    const openingHi = new PedersenOpening();

    const groupedCiphertextLo = GroupedElGamalCiphertext3Handles.encryptWith(
      sourcePubkey,
      destPubkey,
      auditorPubkey,
      amountLo,
      openingLo,
    );

    const groupedCiphertextHi = GroupedElGamalCiphertext3Handles.encryptWith(
      sourcePubkey,
      destPubkey,
      auditorPubkey,
      amountHi,
      openingHi,
    );

    console.log('   Created all parameters for 3-handles batched proof');

    const proof = new BatchedGroupedCiphertext3HandlesValidityProofData(
      sourcePubkey,
      destPubkey,
      auditorPubkey,
      groupedCiphertextLo,
      groupedCiphertextHi,
      amountLo,
      amountHi,
      openingLo,
      openingHi,
    );
    console.log(`✅ Created proof: ${proof.toBytes().length} bytes`);

    proof.verify();
    console.log('✅ Verified locally');
  } catch (e: any) {
    console.log(`❌ Failed: ${e.message}`);
  }

  // ============================================
  // Summary
  // ============================================
  console.log('\n' + '='.repeat(60));
  console.log('Summary');
  console.log('='.repeat(60));
  console.log('If all tests pass, we have working ZK proof generation!');
}

main().catch(console.error);

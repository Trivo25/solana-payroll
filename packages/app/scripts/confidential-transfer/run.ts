/**
 * confidential transfer end-to-end example
 *
 * this script demonstrates the full confidential transfer flow using
 * the ZK-Edge cluster with ZK ElGamal Proof program.
 *
 * usage:
 *   npx tsx scripts/confidential-transfer/run.ts
 */

import { Connection, Keypair, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { TOKEN_2022_PROGRAM_ID, ExtensionType, getMintLen, createInitializeMintInstruction, getAssociatedTokenAddressSync, createAssociatedTokenAccountInstruction, createMintToInstruction } from '@solana/spl-token';

import {
  // config
  RPC_URL,
  WS_URL,
  DECIMALS,
  MINT_AMOUNT,
  DEPOSIT_AMOUNT,
  TRANSFER_AMOUNT,
  TOKEN_ACCOUNT_SIZE,
  ZK_ELGAMAL_PROOF_PROGRAM_ID,
  // types
  ZkSdkModule,
  TransferContext,
  // utils
  loadKeypair,
  formatBalance,
  printBalance,
  loadZkSdk,
  getConfidentialBalance,
  // crypto
  combineLowHighCiphertexts,
  subtractCiphertexts,
  // instructions
  createInitializeConfidentialTransferMintInstruction,
  createReallocateInstruction,
  createConfigureAccountInstruction,
  createDepositInstruction,
  createApplyPendingBalanceInstruction,
  createConfidentialTransferInstruction,
  createVerifyPubkeyValidityInstruction,
  createVerifyCiphertextCommitmentEqualityInstruction,
  createVerifyBatchedGroupedCiphertext3HandlesValidityInstruction,
  createVerifyBatchedRangeProofU128Instruction,
  createCloseContextStateInstruction,
  getContextStateAccountSize,
  readPendingBalanceCreditCounter,
} from './index';

// ============================================
// transaction helper
// ============================================

async function sendTransaction(
  connection: Connection,
  transaction: Transaction,
  signers: Keypair[],
  options: { skipPreflight?: boolean } = {},
): Promise<string> {
  const maxAttempts = 10;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      if (attempt > 1) {
        await new Promise((resolve) => setTimeout(resolve, 3000 * attempt));
      }

      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = signers[0].publicKey;
      transaction.sign(...signers);

      const signature = await connection.sendRawTransaction(
        transaction.serialize(),
        { skipPreflight: options.skipPreflight ?? false },
      );

      // wait for confirmation
      let confirmed = false;
      for (let i = 0; i < 30; i++) {
        const status = await connection.getSignatureStatus(signature);
        if (status?.value?.confirmationStatus === 'confirmed' || status?.value?.confirmationStatus === 'finalized') {
          confirmed = true;
          break;
        }
        if (status?.value?.err) {
          throw new Error(`Transaction failed on-chain: ${JSON.stringify(status.value.err)}`);
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      if (confirmed) {
        return signature;
      }

      throw new Error('Transaction confirmation timeout');
    } catch (error: any) {
      const isBlockhashError = error.message?.includes('Blockhash not found') || error.message?.includes('block height exceeded');
      if (isBlockhashError && attempt < maxAttempts) {
        console.log(`      Retry ${attempt}/${maxAttempts} due to blockhash issue...`);
        continue;
      }
      throw error;
    }
  }

  throw new Error('Max retries exceeded');
}

// ============================================
// step 1: create confidential mint
// ============================================

async function step1CreateMint(
  connection: Connection,
  payer: Keypair,
  zkSdk: ZkSdkModule,
): Promise<{ mint: Keypair; auditorKeypair: InstanceType<ZkSdkModule['ElGamalKeypair']> }> {
  console.log('\n🏭 Step 1: Creating confidential mint...');

  const mint = Keypair.generate();
  const mintLen = getMintLen([ExtensionType.ConfidentialTransferMint]);
  console.log(`   Mint account size: ${mintLen} bytes`);

  const mintRent = await connection.getMinimumBalanceForRentExemption(mintLen);

  // generate auditor ElGamal keypair
  const auditorKeypair = new zkSdk.ElGamalKeypair();
  const auditorPubkeyBytes = auditorKeypair.pubkey().toBytes();
  console.log(`   Auditor ElGamal pubkey: ${Buffer.from(auditorPubkeyBytes).toString('hex').slice(0, 16)}...`);

  const createAccountIx = SystemProgram.createAccount({
    fromPubkey: payer.publicKey,
    newAccountPubkey: mint.publicKey,
    space: mintLen,
    lamports: mintRent,
    programId: TOKEN_2022_PROGRAM_ID,
  });

  const initConfidentialIx = createInitializeConfidentialTransferMintInstruction(
    mint.publicKey,
    payer.publicKey,
    true,
    auditorPubkeyBytes,
  );

  const initMintIx = createInitializeMintInstruction(
    mint.publicKey,
    DECIMALS,
    payer.publicKey,
    null,
    TOKEN_2022_PROGRAM_ID,
  );

  const tx = new Transaction().add(createAccountIx, initConfidentialIx, initMintIx);
  const sig = await sendTransaction(connection, tx, [payer, mint]);

  console.log(`   ✅ Mint created: ${mint.publicKey.toBase58()}`);
  console.log(`   Transaction: ${sig}`);

  return { mint, auditorKeypair };
}

// ============================================
// step 2: create token accounts
// ============================================

async function step2CreateTokenAccounts(
  connection: Connection,
  payer: Keypair,
  mint: Keypair,
  sender: Keypair,
  recipient: Keypair,
): Promise<{ senderTokenAccount: import('@solana/web3.js').PublicKey; recipientTokenAccount: import('@solana/web3.js').PublicKey }> {
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

  const tx = new Transaction().add(createSenderAtaIx, createRecipientAtaIx);
  const sig = await sendTransaction(connection, tx, [payer]);

  console.log(`   ✅ Sender ATA: ${senderTokenAccount.toBase58()}`);
  console.log(`   ✅ Recipient ATA: ${recipientTokenAccount.toBase58()}`);
  console.log(`   Transaction: ${sig}`);

  return { senderTokenAccount, recipientTokenAccount };
}

// ============================================
// step 3: configure accounts for confidential transfers
// ============================================

async function step3ConfigureAccounts(
  connection: Connection,
  payer: Keypair,
  mint: Keypair,
  sender: Keypair,
  recipient: Keypair,
  senderTokenAccount: import('@solana/web3.js').PublicKey,
  recipientTokenAccount: import('@solana/web3.js').PublicKey,
  zkSdk: ZkSdkModule,
): Promise<{
  senderElGamal: InstanceType<ZkSdkModule['ElGamalKeypair']>;
  senderAeKey: InstanceType<ZkSdkModule['AeKey']>;
  recipientElGamal: InstanceType<ZkSdkModule['ElGamalKeypair']>;
  recipientAeKey: InstanceType<ZkSdkModule['AeKey']>;
}> {
  console.log('\n⚙️  Step 3: Configuring accounts for confidential transfers...');

  // configure sender account
  const senderElGamal = new zkSdk.ElGamalKeypair();
  const senderAeKey = new zkSdk.AeKey();
  const senderElGamalPubkey = senderElGamal.pubkey();
  console.log(`   Sender ElGamal pubkey: ${Buffer.from(senderElGamalPubkey.toBytes()).toString('hex').slice(0, 16)}...`);

  const senderProof = new zkSdk.PubkeyValidityProofData(senderElGamal);
  const senderProofBytes = senderProof.toBytes();
  console.log(`   Sender proof size: ${senderProofBytes.length} bytes`);
  senderProof.verify();
  console.log('   ✅ Sender proof verified locally');

  const zeroBalanceCiphertext = senderAeKey.encrypt(0n);
  const zeroBalanceBytes = zeroBalanceCiphertext.toBytes();
  console.log(`   Zero balance ciphertext size: ${zeroBalanceBytes.length} bytes`);

  // reallocate and configure sender
  const senderReallocIx = createReallocateInstruction(
    senderTokenAccount,
    payer.publicKey,
    sender.publicKey,
    [ExtensionType.ConfidentialTransferAccount],
  );

  const senderVerifyIx = createVerifyPubkeyValidityInstruction(senderProofBytes);

  const senderConfigureIx = createConfigureAccountInstruction(
    senderTokenAccount,
    mint.publicKey,
    sender.publicKey,
    zeroBalanceBytes,
    65536n,
    -1,
  );

  const senderTx = new Transaction().add(senderReallocIx, senderVerifyIx, senderConfigureIx);
  const senderSig = await sendTransaction(connection, senderTx, [payer, sender]);
  console.log(`   ✅ Sender account configured`);
  console.log(`   Transaction: ${senderSig}`);

  // configure recipient account
  const recipientElGamal = new zkSdk.ElGamalKeypair();
  const recipientAeKey = new zkSdk.AeKey();

  const recipientProof = new zkSdk.PubkeyValidityProofData(recipientElGamal);
  const recipientProofBytes = recipientProof.toBytes();

  const recipientZeroBalance = recipientAeKey.encrypt(0n);
  const recipientZeroBytes = recipientZeroBalance.toBytes();

  const recipientReallocIx = createReallocateInstruction(
    recipientTokenAccount,
    payer.publicKey,
    recipient.publicKey,
    [ExtensionType.ConfidentialTransferAccount],
  );

  const recipientVerifyIx = createVerifyPubkeyValidityInstruction(recipientProofBytes);

  const recipientConfigureIx = createConfigureAccountInstruction(
    recipientTokenAccount,
    mint.publicKey,
    recipient.publicKey,
    recipientZeroBytes,
    65536n,
    -1,
  );

  const recipientTx = new Transaction().add(recipientReallocIx, recipientVerifyIx, recipientConfigureIx);
  const recipientSig = await sendTransaction(connection, recipientTx, [payer, recipient]);
  console.log(`   ✅ Recipient account configured`);
  console.log(`   Transaction: ${recipientSig}`);

  return { senderElGamal, senderAeKey, recipientElGamal, recipientAeKey };
}

// ============================================
// step 4: mint tokens
// ============================================

async function step4MintTokens(
  connection: Connection,
  payer: Keypair,
  mint: Keypair,
  senderTokenAccount: import('@solana/web3.js').PublicKey,
): Promise<void> {
  console.log('\n🪙 Step 4: Minting tokens to sender...');

  const mintToIx = createMintToInstruction(
    mint.publicKey,
    senderTokenAccount,
    payer.publicKey,
    MINT_AMOUNT,
    [],
    TOKEN_2022_PROGRAM_ID,
  );

  const tx = new Transaction().add(mintToIx);
  const sig = await sendTransaction(connection, tx, [payer]);

  console.log(`   ✅ Minted ${formatBalance(MINT_AMOUNT)} tokens`);
  console.log(`   Transaction: ${sig}`);
}

// ============================================
// step 5: deposit to confidential balance
// ============================================

async function step5Deposit(
  connection: Connection,
  payer: Keypair,
  mint: Keypair,
  sender: Keypair,
  senderTokenAccount: import('@solana/web3.js').PublicKey,
): Promise<void> {
  console.log('\n💰 Step 5: Depositing to confidential balance...');

  const depositIx = createDepositInstruction(
    senderTokenAccount,
    mint.publicKey,
    sender.publicKey,
    DEPOSIT_AMOUNT,
    DECIMALS,
  );

  const tx = new Transaction().add(depositIx);
  const sig = await sendTransaction(connection, tx, [payer, sender]);

  console.log(`   ✅ Deposited ${formatBalance(DEPOSIT_AMOUNT)} tokens to pending`);
  console.log(`   Transaction: ${sig}`);
}

// ============================================
// step 6: apply pending balance (sender)
// ============================================

async function step6ApplyPendingBalance(
  connection: Connection,
  payer: Keypair,
  sender: Keypair,
  senderTokenAccount: import('@solana/web3.js').PublicKey,
  senderAeKey: InstanceType<ZkSdkModule['AeKey']>,
): Promise<void> {
  console.log('\n🔄 Step 6: Applying pending balance...');

  // read the pending balance credit counter
  const accountInfo = await connection.getAccountInfo(senderTokenAccount);
  if (!accountInfo) throw new Error('Account not found');

  const counter = readPendingBalanceCreditCounter(accountInfo.data);
  console.log(`   Pending balance credit counter: ${counter}`);

  // encrypt the new balance
  const newDecryptableBalance = senderAeKey.encrypt(DEPOSIT_AMOUNT);
  const newDecryptableBytes = newDecryptableBalance.toBytes();

  const applyIx = createApplyPendingBalanceInstruction(
    senderTokenAccount,
    sender.publicKey,
    counter,
    newDecryptableBytes,
  );

  const tx = new Transaction().add(applyIx);
  const sig = await sendTransaction(connection, tx, [payer, sender]);

  console.log(`   ✅ Applied pending balance`);
  console.log(`   Transaction: ${sig}`);
}

// ============================================
// step 7: confidential transfer
// ============================================

async function step7ConfidentialTransfer(
  connection: Connection,
  payer: Keypair,
  mint: Keypair,
  sender: Keypair,
  senderTokenAccount: import('@solana/web3.js').PublicKey,
  recipientTokenAccount: import('@solana/web3.js').PublicKey,
  senderElGamal: InstanceType<ZkSdkModule['ElGamalKeypair']>,
  senderAeKey: InstanceType<ZkSdkModule['AeKey']>,
  recipientElGamal: InstanceType<ZkSdkModule['ElGamalKeypair']>,
  auditorKeypair: InstanceType<ZkSdkModule['ElGamalKeypair']>,
  zkSdk: ZkSdkModule,
): Promise<void> {
  console.log('\n🔐 Step 7: Performing confidential transfer...');
  console.log(`   Transfer amount: ${formatBalance(TRANSFER_AMOUNT)} tokens`);

  // extract required SDK types
  const {
    CiphertextCommitmentEqualityProofData,
    BatchedGroupedCiphertext3HandlesValidityProofData,
    BatchedRangeProofU128Data,
    PedersenOpening,
    PedersenCommitment,
    GroupedElGamalCiphertext3Handles,
    ElGamalCiphertext,
  } = zkSdk;

  if (!CiphertextCommitmentEqualityProofData || !BatchedGroupedCiphertext3HandlesValidityProofData || !BatchedRangeProofU128Data) {
    throw new Error('Required proof types not available in ZK SDK');
  }

  // step 7a: calculate new balances
  const currentAvailableBalance = DEPOSIT_AMOUNT;
  const newSenderBalance = currentAvailableBalance - TRANSFER_AMOUNT;

  console.log(`   Current sender balance: ${formatBalance(currentAvailableBalance)} tokens`);
  console.log(`   After transfer: ${formatBalance(newSenderBalance)} tokens`);
  console.log('\n   Generating ZK proofs...');

  // get ElGamal pubkeys
  const recipientElGamalPubkey = recipientElGamal.pubkey();
  const senderElGamalPubkey = senderElGamal.pubkey();
  const auditorElGamalPubkey = auditorKeypair.pubkey();

  // step 7b: generate validity proof
  // split amount into lo (16 bits) and hi (32 bits)
  const amountLo = TRANSFER_AMOUNT & BigInt(0xffff);
  const amountHi = TRANSFER_AMOUNT >> BigInt(16);

  console.log(`   - Generating ciphertext validity proof (3 handles)...`);
  console.log(`     Amount split: lo=${amountLo}, hi=${amountHi}`);

  const openingLo = new PedersenOpening();
  const openingHi = new PedersenOpening();

  // create grouped ciphertexts with 3 handles: source, destination, auditor
  const groupedCiphertextLo = GroupedElGamalCiphertext3Handles.encryptWith(
    senderElGamalPubkey,
    recipientElGamalPubkey,
    auditorElGamalPubkey,
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

  const validityProof = new BatchedGroupedCiphertext3HandlesValidityProofData(
    senderElGamalPubkey,
    recipientElGamalPubkey,
    auditorElGamalPubkey,
    groupedCiphertextLo,
    groupedCiphertextHi,
    amountLo,
    amountHi,
    openingLo,
    openingHi,
  );

  const validityProofBytes = validityProof.toBytes();
  console.log(`     Size: ${validityProofBytes.length} bytes`);
  validityProof.verify();
  console.log('     ✅ Verified locally');

  // step 7c: prepare for equality and range proofs
  console.log('   - Preparing new balance ciphertext for proofs...');

  // read current balance ciphertext from account
  const senderAccountInfo = await connection.getAccountInfo(senderTokenAccount);
  if (!senderAccountInfo) {
    throw new Error('Sender token account not found');
  }

  const accountData = senderAccountInfo.data;
  let offset = TOKEN_ACCOUNT_SIZE;
  if (accountData.length > TOKEN_ACCOUNT_SIZE) {
    offset += 1; // account type byte
  }

  // find ConfidentialTransferAccount extension (type = 5)
  let currentBalanceCiphertextBytes: Uint8Array | null = null;
  while (offset + 4 <= accountData.length) {
    const extensionType = accountData.readUInt16LE(offset);
    const extensionLength = accountData.readUInt16LE(offset + 2);

    if (extensionType === 5) {
      offset += 4;
      const availableBalanceOffset = offset + 1 + 32 + 64 + 64;
      currentBalanceCiphertextBytes = accountData.slice(availableBalanceOffset, availableBalanceOffset + 64);
      break;
    }
    offset += 4 + extensionLength;
  }

  if (!currentBalanceCiphertextBytes) {
    throw new Error('ConfidentialTransferAccount extension not found');
  }

  // extract source ciphertexts from grouped ciphertexts
  const groupedLoBytes = groupedCiphertextLo.toBytes();
  const groupedHiBytes = groupedCiphertextHi.toBytes();
  const sourceCiphertextLoBytes = groupedLoBytes.slice(0, 64);
  const sourceCiphertextHiBytes = groupedHiBytes.slice(0, 64);

  // combine lo + hi ciphertexts
  const transferAmountCiphertextBytes = combineLowHighCiphertexts(
    sourceCiphertextLoBytes,
    sourceCiphertextHiBytes,
    16,
  );

  // compute new_balance = current_balance - transfer_amount (homomorphic)
  const newBalanceCiphertextBytes = subtractCiphertexts(
    currentBalanceCiphertextBytes,
    transferAmountCiphertextBytes,
  );

  const newBalanceCiphertext = ElGamalCiphertext.fromBytes(newBalanceCiphertextBytes);
  if (!newBalanceCiphertext) {
    throw new Error('Failed to parse new balance ciphertext');
  }

  // step 7d: create Pedersen commitment for new balance
  console.log('   - Creating Pedersen commitment for new balance...');
  const newAvailableBalanceOpening = new PedersenOpening();
  const newAvailableBalanceCommitment = PedersenCommitment.from(newSenderBalance, newAvailableBalanceOpening);

  // step 7e: generate equality proof FIRST (WASM lifetime fix)
  console.log('   - Generating equality proof (ciphertext-commitment)...');

  const equalityProof = new CiphertextCommitmentEqualityProofData(
    senderElGamal,
    newBalanceCiphertext,
    newAvailableBalanceCommitment,
    newAvailableBalanceOpening,
    newSenderBalance,
  );

  const equalityProofBytes = equalityProof.toBytes();
  console.log(`     Size: ${equalityProofBytes.length} bytes`);
  equalityProof.verify();
  console.log('     ✅ Verified locally');

  // step 7f: generate range proof (U128)
  console.log('   - Generating range proof (U128)...');

  // create commitments for transfer_lo, transfer_hi, and padding
  const transferLoCommitment = PedersenCommitment.from(amountLo, openingLo);
  const transferHiCommitment = PedersenCommitment.from(amountHi, openingHi);
  const paddingOpening = new PedersenOpening();
  const paddingCommitment = PedersenCommitment.from(BigInt(0), paddingOpening);

  const amounts = new BigUint64Array([newSenderBalance, amountLo, amountHi, BigInt(0)]);
  const bitLengths = new Uint8Array([64, 16, 32, 16]); // must sum to 128

  const rangeProof = new BatchedRangeProofU128Data(
    [newAvailableBalanceCommitment, transferLoCommitment, transferHiCommitment, paddingCommitment],
    amounts,
    bitLengths,
    [newAvailableBalanceOpening, openingLo, openingHi, paddingOpening],
  );

  const rangeProofBytes = rangeProof.toBytes();
  console.log(`     Size: ${rangeProofBytes.length} bytes`);
  rangeProof.verify();
  console.log('     ✅ Verified locally');

  // step 7g: create context state accounts
  console.log('\n   Creating proof context state accounts...');

  const equalityContextAccount = Keypair.generate();
  const validityContextAccount = Keypair.generate();
  const rangeContextAccount = Keypair.generate();

  const equalityAccountSize = getContextStateAccountSize('equality');
  const validityAccountSize = getContextStateAccountSize('validity');
  const rangeAccountSize = getContextStateAccountSize('range');

  const equalityRent = await connection.getMinimumBalanceForRentExemption(equalityAccountSize);
  const validityRent = await connection.getMinimumBalanceForRentExemption(validityAccountSize);
  const rangeRent = await connection.getMinimumBalanceForRentExemption(rangeAccountSize);

  console.log(`   - Equality context: ${equalityAccountSize} bytes`);
  console.log(`   - Validity context: ${validityAccountSize} bytes`);
  console.log(`   - Range context: ${rangeAccountSize} bytes`);

  // create and verify equality proof
  console.log('\n   Submitting equality proof...');
  const createEqualityCtxIx = SystemProgram.createAccount({
    fromPubkey: payer.publicKey,
    newAccountPubkey: equalityContextAccount.publicKey,
    space: equalityAccountSize,
    lamports: equalityRent,
    programId: ZK_ELGAMAL_PROOF_PROGRAM_ID,
  });

  const createEqualityCtxTx = new Transaction().add(createEqualityCtxIx);
  await sendTransaction(connection, createEqualityCtxTx, [payer, equalityContextAccount], { skipPreflight: true });
  console.log('     ✅ Equality context account created');

  const verifyEqualityIx = createVerifyCiphertextCommitmentEqualityInstruction(
    equalityProofBytes,
    equalityContextAccount.publicKey,
    sender.publicKey,
  );
  const verifyEqualityTx = new Transaction().add(verifyEqualityIx);
  await sendTransaction(connection, verifyEqualityTx, [payer], { skipPreflight: true });
  console.log('     ✅ Equality proof verified');

  // create and verify validity proof
  console.log('   Submitting validity proof...');
  const createValidityCtxIx = SystemProgram.createAccount({
    fromPubkey: payer.publicKey,
    newAccountPubkey: validityContextAccount.publicKey,
    space: validityAccountSize,
    lamports: validityRent,
    programId: ZK_ELGAMAL_PROOF_PROGRAM_ID,
  });

  const createValidityCtxTx = new Transaction().add(createValidityCtxIx);
  await sendTransaction(connection, createValidityCtxTx, [payer, validityContextAccount], { skipPreflight: true });
  console.log('     ✅ Validity context account created');

  const verifyValidityIx = createVerifyBatchedGroupedCiphertext3HandlesValidityInstruction(
    validityProofBytes,
    validityContextAccount.publicKey,
    sender.publicKey,
  );
  const verifyValidityTx = new Transaction().add(verifyValidityIx);
  await sendTransaction(connection, verifyValidityTx, [payer], { skipPreflight: true });
  console.log('     ✅ Validity proof verified');

  // create and verify range proof
  console.log('   Submitting range proof...');
  const createRangeCtxIx = SystemProgram.createAccount({
    fromPubkey: payer.publicKey,
    newAccountPubkey: rangeContextAccount.publicKey,
    space: rangeAccountSize,
    lamports: rangeRent,
    programId: ZK_ELGAMAL_PROOF_PROGRAM_ID,
  });

  const createRangeCtxTx = new Transaction().add(createRangeCtxIx);
  await sendTransaction(connection, createRangeCtxTx, [payer, rangeContextAccount], { skipPreflight: true });
  console.log('     ✅ Range context account created');

  const verifyRangeIx = createVerifyBatchedRangeProofU128Instruction(
    rangeProofBytes,
    rangeContextAccount.publicKey,
    sender.publicKey,
  );
  const verifyRangeTx = new Transaction().add(verifyRangeIx);
  await sendTransaction(connection, verifyRangeTx, [payer], { skipPreflight: true });
  console.log('     ✅ Range proof verified');

  // step 7h: execute the confidential transfer
  console.log('\n   Executing confidential transfer...');

  // encrypt new sender balance with AES
  const newSenderDecryptableBalance = senderAeKey.encrypt(newSenderBalance);

  // extract auditor ciphertext handles from grouped ciphertexts
  const auditorCiphertextLo = new Uint8Array(64);
  auditorCiphertextLo.set(groupedLoBytes.slice(0, 32), 0); // commitment
  auditorCiphertextLo.set(groupedLoBytes.slice(96, 128), 32); // auditor handle (third)

  const auditorCiphertextHi = new Uint8Array(64);
  auditorCiphertextHi.set(groupedHiBytes.slice(0, 32), 0); // commitment
  auditorCiphertextHi.set(groupedHiBytes.slice(96, 128), 32); // auditor handle (third)

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
  const sig = await sendTransaction(connection, transferTx, [payer, sender], { skipPreflight: true });
  console.log(`   ✅ Confidential transfer executed: ${sig}`);
}

// ============================================
// step 8: apply pending balance (recipient)
// ============================================

async function step8ApplyRecipientPendingBalance(
  connection: Connection,
  payer: Keypair,
  recipient: Keypair,
  recipientTokenAccount: import('@solana/web3.js').PublicKey,
  recipientAeKey: InstanceType<ZkSdkModule['AeKey']>,
): Promise<void> {
  console.log('\n🔄 Step 8: Recipient applying pending balance...');

  const accountInfo = await connection.getAccountInfo(recipientTokenAccount);
  if (!accountInfo) throw new Error('Account not found');

  const counter = readPendingBalanceCreditCounter(accountInfo.data);
  console.log(`   Pending balance credit counter: ${counter}`);

  const newDecryptableBalance = recipientAeKey.encrypt(TRANSFER_AMOUNT);
  const newDecryptableBytes = newDecryptableBalance.toBytes();

  const applyIx = createApplyPendingBalanceInstruction(
    recipientTokenAccount,
    recipient.publicKey,
    counter,
    newDecryptableBytes,
  );

  const tx = new Transaction().add(applyIx);
  const sig = await sendTransaction(connection, tx, [payer, recipient]);

  console.log(`   ✅ Recipient applied pending balance`);
  console.log(`   Transaction: ${sig}`);
}

// ============================================
// main function
// ============================================

async function main() {
  console.log('🚀 Confidential Transfer End-to-End Example');
  console.log('   Using ZK-Edge Cluster with ZK ElGamal Proof Program\n');

  // load ZK SDK
  const zkSdk = await loadZkSdk();

  // connect to cluster
  console.log(`\n🔗 Connecting to: ${RPC_URL}`);
  const connection = new Connection(RPC_URL, { commitment: 'confirmed', wsEndpoint: WS_URL });

  try {
    const version = await connection.getVersion();
    console.log(`   ✅ Connected to Solana ${version['solana-core']}`);
  } catch (error: any) {
    console.error(`   ❌ Failed to connect: ${error.message}`);
    process.exit(1);
  }

  // load payer
  const payer = loadKeypair();
  console.log(`\n💰 Payer: ${payer.publicKey.toBase58()}`);

  const balance = await connection.getBalance(payer.publicKey);
  console.log(`💳 Balance: ${balance / LAMPORTS_PER_SOL} SOL`);

  if (balance < 0.1 * LAMPORTS_PER_SOL) {
    console.log('\n⚠️  Balance too low! You need SOL on the ZK-Edge cluster.');
    process.exit(1);
  }

  // setup accounts
  const sender = payer;
  const recipient = Keypair.generate();
  console.log('\n📋 Setting up accounts...');
  console.log(`   Sender: ${sender.publicKey.toBase58()}`);
  console.log(`   Recipient: ${recipient.publicKey.toBase58()}`);

  try {
    // step 1: create mint
    const { mint, auditorKeypair } = await step1CreateMint(connection, payer, zkSdk);

    // step 2: create token accounts
    const { senderTokenAccount, recipientTokenAccount } = await step2CreateTokenAccounts(
      connection, payer, mint, sender, recipient,
    );

    // step 3: configure accounts
    const { senderElGamal, senderAeKey, recipientElGamal, recipientAeKey } = await step3ConfigureAccounts(
      connection, payer, mint, sender, recipient, senderTokenAccount, recipientTokenAccount, zkSdk,
    );

    // step 4: mint tokens
    await step4MintTokens(connection, payer, mint, senderTokenAccount);

    // print balance after mint
    const balanceAfterMint = await getConfidentialBalance(connection, senderTokenAccount, senderAeKey, zkSdk);
    printBalance('Sender (after mint)', balanceAfterMint);

    // step 5: deposit
    await step5Deposit(connection, payer, mint, sender, senderTokenAccount);

    // print balance after deposit
    const balanceAfterDeposit = await getConfidentialBalance(connection, senderTokenAccount, senderAeKey, zkSdk);
    printBalance('Sender (after deposit)', balanceAfterDeposit);

    // step 6: apply pending balance
    await step6ApplyPendingBalance(connection, payer, sender, senderTokenAccount, senderAeKey);

    // print balance after apply
    const balanceAfterApply = await getConfidentialBalance(connection, senderTokenAccount, senderAeKey, zkSdk);
    printBalance('Sender (after apply)', balanceAfterApply);

    // step 7: confidential transfer
    await step7ConfidentialTransfer(
      connection,
      payer,
      mint,
      sender,
      senderTokenAccount,
      recipientTokenAccount,
      senderElGamal,
      senderAeKey,
      recipientElGamal,
      auditorKeypair,
      zkSdk,
    );

    // print balance after transfer
    const balanceAfterTransfer = await getConfidentialBalance(connection, senderTokenAccount, senderAeKey, zkSdk);
    printBalance('Sender (after transfer)', balanceAfterTransfer);

    // step 8: apply recipient pending balance
    await step8ApplyRecipientPendingBalance(connection, payer, recipient, recipientTokenAccount, recipientAeKey);

    // print final balances
    const senderFinal = await getConfidentialBalance(connection, senderTokenAccount, senderAeKey, zkSdk);
    const recipientFinal = await getConfidentialBalance(connection, recipientTokenAccount, recipientAeKey, zkSdk);
    printBalance('Sender (final)', senderFinal);
    printBalance('Recipient (final)', recipientFinal);

    // print summary
    console.log('\n============================================================');
    console.log('📋 Summary');
    console.log('============================================================');
    console.log(`Mint:                    ${mint.publicKey.toBase58()}`);
    console.log(`Sender token account:    ${senderTokenAccount.toBase58()}`);
    console.log(`Recipient token account: ${recipientTokenAccount.toBase58()}`);

  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    if (error.logs) {
      console.log('Logs:', error.logs.slice(-10));
    }
    throw error;
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

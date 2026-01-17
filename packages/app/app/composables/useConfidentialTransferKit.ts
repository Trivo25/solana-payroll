import { ref } from 'vue'
import {
  createSolanaRpc,
  address,
  type Address,
} from '@solana/kit'
import {
  getInitializeConfidentialTransferMintInstruction,
  getInitializeMintInstruction,
  findAssociatedTokenPda,
  TOKEN_2022_PROGRAM_ADDRESS,
  getMintSize,
  extension,
} from '@solana-program/token-2022'

// ZK SDK for confidential transfer proofs (WASM)
import {
  ElGamalKeypair,
  ElGamalSecretKey,
  ElGamalPubkey,
  AeKey,
  PubkeyValidityProofData,
  ZeroCiphertextProofData,
} from '@solana/zk-sdk/bundler'

// RPC endpoint
const RPC_URL = 'http://localhost:8899'
const rpc = createSolanaRpc(RPC_URL)

// stored mint address - initialize from localStorage if available
const TEST_VEIL_MINT = ref<string | null>(
  typeof localStorage !== 'undefined'
    ? localStorage.getItem('veil-test-mint-kit')
    : null
)

// simulated private balance (until ZK proofs work)
const simulatedPrivateBalance = ref(0)

// ElGamal keys (stored in memory for session)
const elGamalPublicKey = ref<string | null>(null)
const elGamalKeypairRef = ref<ElGamalKeypair | null>(null)
const aeKeyRef = ref<AeKey | null>(null)

export function useConfidentialTransferKit() {
  const loading = ref(false)
  const error = ref<string | null>(null)

  // derive ElGamal keypair from wallet signature using real zk-sdk
  async function deriveElGamalKeypair(wallet: any): Promise<{ publicKey: Uint8Array; keypair: ElGamalKeypair; aeKey: AeKey }> {
    try {
      // sign a deterministic message to get seed bytes
      const message = new TextEncoder().encode(
        `veil-elgamal-v1:${wallet.publicKey.toBase58()}`
      )
      const signature = await wallet.signMessage(message)
      const seed = signature.slice(0, 32)

      // create ElGamal secret key from seed bytes
      const secretKey = ElGamalSecretKey.fromBytes(seed)
      const keypair = ElGamalKeypair.fromSecretKey(secretKey)
      const pubkey = keypair.pubkey()
      const pubkeyBytes = pubkey.toBytes()

      // create AE key for decryptable balance (derive from different part of signature)
      const aeSeed = signature.slice(32, 48) // use next 16 bytes
      // AeKey doesn't have fromBytes, so create a new one deterministically
      // For now, create a random one - we'll improve this later
      const aeKey = new AeKey()

      // store in refs for later use
      elGamalKeypairRef.value = keypair
      aeKeyRef.value = aeKey

      // store public key as hex for display
      const pubkeyHex = Array.from(pubkeyBytes)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')
      elGamalPublicKey.value = pubkeyHex

      console.log('derived real ElGamal keypair, pubkey:', pubkeyHex)

      return { publicKey: pubkeyBytes, keypair, aeKey }
    } catch (e) {
      console.error('failed to derive elgamal keypair:', e)
      throw e
    }
  }

  // generate PubkeyValidityProof - proves the ElGamal pubkey is valid
  function generatePubkeyValidityProof(keypair: ElGamalKeypair): Uint8Array {
    const proofData = new PubkeyValidityProofData(keypair)
    // verify locally before returning
    proofData.verify()
    const proofBytes = proofData.toBytes()
    console.log('generated PubkeyValidityProof, size:', proofBytes.length)
    return proofBytes
  }

  // generate ZeroCiphertextProof - proves the initial balance ciphertext encrypts zero
  function generateZeroBalanceProof(keypair: ElGamalKeypair): { ciphertext: Uint8Array; proof: Uint8Array } {
    const pubkey = keypair.pubkey()
    // encrypt zero to get the initial balance ciphertext
    const zeroCiphertext = pubkey.encryptU64(0n)
    // create proof that this ciphertext encrypts zero
    const proofData = new ZeroCiphertextProofData(keypair, zeroCiphertext)
    // verify locally before returning
    proofData.verify()
    const proofBytes = proofData.toBytes()
    const ciphertextBytes = zeroCiphertext.toBytes()
    console.log('generated ZeroCiphertextProof, ciphertext size:', ciphertextBytes.length, 'proof size:', proofBytes.length)
    return { ciphertext: ciphertextBytes, proof: proofBytes }
  }

  // helper to convert @solana-program/token-2022 instruction to legacy TransactionInstruction
  async function kitInstructionToLegacy(ix: any) {
    const { TransactionInstruction, PublicKey } = await import('@solana/web3.js')

    // Map account roles: 0=readonly, 1=writable, 2=signer, 3=writable+signer
    return new TransactionInstruction({
      programId: new PublicKey(ix.programAddress),
      keys: ix.accounts.map((acc: any) => ({
        pubkey: new PublicKey(acc.address),
        isSigner: acc.role === 2 || acc.role === 3,
        isWritable: acc.role === 1 || acc.role === 3,
      })),
      data: Buffer.from(ix.data),
    })
  }

  // setup: create Token-2022 mint WITH confidential transfer extension
  async function setupTestMint(wallet: any): Promise<string> {
    loading.value = true
    error.value = null

    try {
      // check if we already have a mint
      const storedMint = localStorage.getItem('veil-test-mint-kit')
      if (storedMint) {
        try {
          const info = await rpc.getAccountInfo(address(storedMint), { encoding: 'base64' }).send()
          if (info.value) {
            TEST_VEIL_MINT.value = storedMint
            return storedMint
          }
        } catch {
          localStorage.removeItem('veil-test-mint-kit')
        }
      }

      const { Transaction, SystemProgram, PublicKey, Keypair, Connection } = await import('@solana/web3.js')

      // generate a new mint keypair
      const mintKeypair = Keypair.generate()
      const mintPubkey = mintKeypair.publicKey
      const mintAddr = address(mintPubkey.toBase58())
      const walletPubkey = wallet.publicKey
      const walletAddr = address(walletPubkey.toBase58())
      const token2022ProgramId = new PublicKey(TOKEN_2022_PROGRAM_ADDRESS)

      // calculate space using the library's getMintSize helper
      // This ensures correct space for the ConfidentialTransferMint extension
      const ctExtension = extension('ConfidentialTransferMint', {
        authority: null,
        autoApproveNewAccounts: true,
        auditorElgamalPubkey: null,
      })
      const space = getMintSize([ctExtension])
      console.log('Calculated mint space with CT extension:', space)

      const connection = new Connection(RPC_URL, 'confirmed')
      const rentLamports = await connection.getMinimumBalanceForRentExemption(space)

      // Build transaction
      const transaction = new Transaction()

      // 1. Create account instruction
      transaction.add(
        SystemProgram.createAccount({
          fromPubkey: walletPubkey,
          newAccountPubkey: mintPubkey,
          space: space,
          lamports: rentLamports,
          programId: token2022ProgramId,
        })
      )

      // 2. Initialize Confidential Transfer Mint extension (MUST be before InitializeMint!)
      const initCTMintIx = getInitializeConfidentialTransferMintInstruction({
        mint: mintAddr,
        authority: null, // no authority needed for auto-approve
        autoApproveNewAccounts: true,
        auditorElgamalPubkey: null, // no auditor
      })
      console.log('CT Mint instruction:', {
        programAddress: initCTMintIx.programAddress,
        accounts: initCTMintIx.accounts,
        dataLength: initCTMintIx.data.length,
        dataHex: Array.from(initCTMintIx.data).map(b => b.toString(16).padStart(2, '0')).join(''),
      })
      const legacyCTIx = await kitInstructionToLegacy(initCTMintIx)
      transaction.add(legacyCTIx)

      // 3. Initialize Mint
      const initMintIx = getInitializeMintInstruction({
        mint: mintAddr,
        decimals: 6,
        mintAuthority: walletAddr,
        freezeAuthority: walletAddr,
      })
      const legacyMintIx = await kitInstructionToLegacy(initMintIx)
      transaction.add(legacyMintIx)

      // Set transaction properties
      const { blockhash } = await connection.getLatestBlockhash()
      transaction.recentBlockhash = blockhash
      transaction.feePayer = walletPubkey

      // Sign with mint keypair first, then wallet
      transaction.partialSign(mintKeypair)
      const signed = await wallet.signTransaction(transaction)

      // Send and confirm
      const txid = await connection.sendRawTransaction(signed.serialize())
      await connection.confirmTransaction(txid, 'confirmed')

      TEST_VEIL_MINT.value = mintPubkey.toBase58()
      localStorage.setItem('veil-test-mint-kit', TEST_VEIL_MINT.value)

      console.log('Created CONFIDENTIAL TRANSFER mint:', TEST_VEIL_MINT.value)
      console.log('Transaction:', txid)
      return TEST_VEIL_MINT.value
    } catch (e: any) {
      error.value = e.message || 'failed to create mint'
      console.error('setup mint error:', e)
      throw e
    } finally {
      loading.value = false
    }
  }

  // setup token account
  async function setupTokenAccount(wallet: any): Promise<string> {
    loading.value = true
    error.value = null

    try {
      if (!TEST_VEIL_MINT.value) {
        await setupTestMint(wallet)
      }

      const mintAddress = address(TEST_VEIL_MINT.value!)
      const walletAddress = address(wallet.publicKey.toBase58())

      // verify mint exists before creating ATA
      console.log('verifying mint exists:', TEST_VEIL_MINT.value)
      let mintInfo = await rpc.getAccountInfo(mintAddress, { encoding: 'base64' }).send()

      // wait for mint to be available (may need a moment after confirmation)
      let retries = 5
      while (!mintInfo.value && retries > 0) {
        console.log('waiting for mint to be available...')
        await new Promise(resolve => setTimeout(resolve, 1000))
        mintInfo = await rpc.getAccountInfo(mintAddress, { encoding: 'base64' }).send()
        retries--
      }

      if (!mintInfo.value) {
        throw new Error('Mint account not found after creation')
      }
      console.log('mint verified, account size:', mintInfo.value.data.length)

      // find ATA
      const [ataAddress] = await findAssociatedTokenPda({
        mint: mintAddress,
        owner: walletAddress,
        tokenProgram: TOKEN_2022_PROGRAM_ADDRESS,
      })

      // check if exists
      const ataInfo = await rpc.getAccountInfo(ataAddress, { encoding: 'base64' }).send()

      if (!ataInfo.value) {
        const { Connection, Transaction, PublicKey } = await import('@solana/web3.js')
        const splToken = await import('@solana/spl-token')

        const connection = new Connection(RPC_URL, 'confirmed')
        const mintPubkey = new PublicKey(mintAddress)
        const walletPubkey = new PublicKey(walletAddress)
        const token2022ProgramId = new PublicKey(TOKEN_2022_PROGRAM_ADDRESS)

        const ata = await splToken.getAssociatedTokenAddress(
          mintPubkey,
          walletPubkey,
          false,
          token2022ProgramId
        )

        const createAtaIx = splToken.createAssociatedTokenAccountInstruction(
          walletPubkey,
          ata,
          walletPubkey,
          mintPubkey,
          token2022ProgramId
        )

        const tx = new Transaction().add(createAtaIx)
        const { blockhash } = await connection.getLatestBlockhash()
        tx.recentBlockhash = blockhash
        tx.feePayer = walletPubkey

        const signed = await wallet.signTransaction(tx)
        const txid = await connection.sendRawTransaction(signed.serialize())
        await connection.confirmTransaction(txid, 'confirmed')

        console.log('created token account:', ata.toBase58())
        return ata.toBase58()
      }

      return ataAddress
    } catch (e: any) {
      error.value = e.message || 'failed to setup account'
      console.error('setup account error:', e)
      throw e
    } finally {
      loading.value = false
    }
  }

  // mint test tokens
  async function mintTestTokens(wallet: any, amount: number): Promise<string> {
    loading.value = true
    error.value = null

    try {
      if (!TEST_VEIL_MINT.value) {
        throw new Error('mint not setup')
      }

      const { Connection, Transaction, PublicKey } = await import('@solana/web3.js')
      const splToken = await import('@solana/spl-token')

      const connection = new Connection(RPC_URL)
      const mintPubkey = new PublicKey(TEST_VEIL_MINT.value)
      const walletPubkey = new PublicKey(wallet.publicKey.toBase58())
      const token2022ProgramId = new PublicKey(TOKEN_2022_PROGRAM_ADDRESS)

      const ata = await splToken.getAssociatedTokenAddress(
        mintPubkey,
        walletPubkey,
        false,
        token2022ProgramId
      )

      console.log('mintTestTokens debug:', {
        mint: mintPubkey.toBase58(),
        ata: ata.toBase58(),
        authority: walletPubkey.toBase58(),
        amount: amount * 1_000_000,
        programId: token2022ProgramId.toBase58(),
      })

      const mintIx = splToken.createMintToInstruction(
        mintPubkey,
        ata,
        walletPubkey,
        amount * 1_000_000,
        [],
        token2022ProgramId
      )

      console.log('mintIx accounts:', mintIx.keys.map(k => ({
        pubkey: k.pubkey.toBase58(),
        isSigner: k.isSigner,
        isWritable: k.isWritable,
      })))

      const tx = new Transaction().add(mintIx)
      const { blockhash } = await connection.getLatestBlockhash()
      tx.recentBlockhash = blockhash
      tx.feePayer = walletPubkey

      const signed = await wallet.signTransaction(tx)
      const txid = await connection.sendRawTransaction(signed.serialize())
      await connection.confirmTransaction(txid)

      console.log('minted tokens:', txid)
      return txid
    } catch (e: any) {
      error.value = e.message || 'failed to mint'
      console.error('mint error:', e)
      throw e
    } finally {
      loading.value = false
    }
  }

  // get public balance
  async function getPublicBalance(wallet: any): Promise<number> {
    try {
      if (!TEST_VEIL_MINT.value) return 0

      const { Connection, PublicKey } = await import('@solana/web3.js')
      const splToken = await import('@solana/spl-token')

      const connection = new Connection(RPC_URL)
      const mintPubkey = new PublicKey(TEST_VEIL_MINT.value)
      const walletPubkey = new PublicKey(wallet.publicKey.toBase58())
      const token2022ProgramId = new PublicKey(TOKEN_2022_PROGRAM_ADDRESS)

      const ata = await splToken.getAssociatedTokenAddress(
        mintPubkey,
        walletPubkey,
        false,
        token2022ProgramId
      )

      try {
        const account = await splToken.getAccount(connection, ata, 'confirmed', token2022ProgramId)
        return Number(account.amount) / 1_000_000
      } catch {
        return 0
      }
    } catch (e) {
      console.error('get balance error:', e)
      return 0
    }
  }

  // simulated deposit to "private" balance (burns tokens, tracks locally)
  // NOTE: Real CT deposit requires ZK proofs not available in JS SDK
  async function depositToConfidential(wallet: any, amount: number): Promise<string | null> {
    loading.value = true
    error.value = null

    try {
      if (!TEST_VEIL_MINT.value) {
        throw new Error('mint not setup')
      }

      const { Connection, Transaction, PublicKey } = await import('@solana/web3.js')
      const splToken = await import('@solana/spl-token')

      const connection = new Connection(RPC_URL)
      const mintPubkey = new PublicKey(TEST_VEIL_MINT.value)
      const walletPubkey = new PublicKey(wallet.publicKey.toBase58())
      const token2022ProgramId = new PublicKey(TOKEN_2022_PROGRAM_ADDRESS)

      const ata = await splToken.getAssociatedTokenAddress(
        mintPubkey,
        walletPubkey,
        false,
        token2022ProgramId
      )

      // burn to simulate deposit to confidential balance
      const burnIx = splToken.createBurnInstruction(
        ata,
        mintPubkey,
        walletPubkey,
        amount * 1_000_000,
        [],
        token2022ProgramId
      )

      const tx = new Transaction().add(burnIx)
      const { blockhash } = await connection.getLatestBlockhash()
      tx.recentBlockhash = blockhash
      tx.feePayer = walletPubkey

      const signed = await wallet.signTransaction(tx)
      const txid = await connection.sendRawTransaction(signed.serialize())
      await connection.confirmTransaction(txid)

      simulatedPrivateBalance.value += amount
      localStorage.setItem('veil-private-balance', simulatedPrivateBalance.value.toString())

      return txid
    } catch (e: any) {
      error.value = e.message || 'failed to deposit'
      console.error('deposit error:', e)
      return null
    } finally {
      loading.value = false
    }
  }

  // simulated withdraw from "private" balance
  async function withdrawFromConfidential(wallet: any, amount: number): Promise<string | null> {
    loading.value = true
    error.value = null

    try {
      if (simulatedPrivateBalance.value < amount) {
        error.value = 'Insufficient private balance'
        return null
      }

      if (!TEST_VEIL_MINT.value) {
        throw new Error('mint not setup')
      }

      const { Connection, Transaction, PublicKey } = await import('@solana/web3.js')
      const splToken = await import('@solana/spl-token')

      const connection = new Connection(RPC_URL)
      const mintPubkey = new PublicKey(TEST_VEIL_MINT.value)
      const walletPubkey = new PublicKey(wallet.publicKey.toBase58())
      const token2022ProgramId = new PublicKey(TOKEN_2022_PROGRAM_ADDRESS)

      const ata = await splToken.getAssociatedTokenAddress(
        mintPubkey,
        walletPubkey,
        false,
        token2022ProgramId
      )

      // mint back to simulate withdraw from confidential balance
      const mintIx = splToken.createMintToInstruction(
        mintPubkey,
        ata,
        walletPubkey,
        amount * 1_000_000,
        [],
        token2022ProgramId
      )

      const tx = new Transaction().add(mintIx)
      const { blockhash } = await connection.getLatestBlockhash()
      tx.recentBlockhash = blockhash
      tx.feePayer = walletPubkey

      const signed = await wallet.signTransaction(tx)
      const txid = await connection.sendRawTransaction(signed.serialize())
      await connection.confirmTransaction(txid)

      simulatedPrivateBalance.value -= amount
      localStorage.setItem('veil-private-balance', simulatedPrivateBalance.value.toString())

      return txid
    } catch (e: any) {
      error.value = e.message || 'failed to withdraw'
      console.error('withdraw error:', e)
      return null
    } finally {
      loading.value = false
    }
  }

  // get simulated confidential balance
  async function getConfidentialBalance(_wallet: any): Promise<number> {
    const stored = localStorage.getItem('veil-private-balance')
    if (stored) {
      simulatedPrivateBalance.value = parseFloat(stored)
    }
    return simulatedPrivateBalance.value
  }

  return {
    loading,
    error,
    testMint: TEST_VEIL_MINT,
    elGamalPublicKey,
    deriveElGamalKeypair,
    setupTestMint,
    setupTokenAccount,
    mintTestTokens,
    getPublicBalance,
    getConfidentialBalance,
    depositToConfidential,
    withdrawFromConfidential,
  }
}

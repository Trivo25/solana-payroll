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
} from '@solana-program/token-2022'

// RPC endpoint
const RPC_URL = 'http://localhost:8899'
const rpc = createSolanaRpc(RPC_URL)

// stored mint address
const TEST_VEIL_MINT = ref<string | null>(null)

// simulated private balance (until ZK proofs work)
const simulatedPrivateBalance = ref(0)

// ElGamal public key
const elGamalPublicKey = ref<string | null>(null)

export function useConfidentialTransferKit() {
  const loading = ref(false)
  const error = ref<string | null>(null)

  // derive ElGamal keypair from wallet signature
  async function deriveElGamalKeypair(wallet: any): Promise<{ publicKey: string; privateKey: Uint8Array }> {
    try {
      const message = new TextEncoder().encode(
        `veil-elgamal-v1:${wallet.publicKey.toBase58()}`
      )
      const signature = await wallet.signMessage(message)
      const privateKey = signature.slice(0, 32)

      // hash to get public key
      const hashBuffer = await crypto.subtle.digest('SHA-256', privateKey)
      const publicKeyBytes = new Uint8Array(hashBuffer)
      const publicKeyHex = Array.from(publicKeyBytes)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')

      elGamalPublicKey.value = publicKeyHex
      return { publicKey: publicKeyHex, privateKey }
    } catch (e) {
      console.error('failed to derive elgamal keypair:', e)
      throw e
    }
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

      // calculate space needed for mint with confidential transfer extension
      // Mint base: 82 bytes
      // Account type: 1 byte
      // Extension type header: 2 bytes (type) + 2 bytes (length) = 4 bytes
      // ConfidentialTransferMint data:
      //   - authority: 33 bytes (1 option + 32 pubkey)
      //   - auto_approve: 1 byte
      //   - auditor: 33 bytes (1 option + 32 pubkey)
      // Total CT data: 67 bytes
      const space = 82 + 1 + 4 + 67  // = 154 bytes

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

        const connection = new Connection(RPC_URL)
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
        await connection.confirmTransaction(txid)

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

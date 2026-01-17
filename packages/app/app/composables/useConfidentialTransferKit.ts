import { ref } from 'vue'
import {
  createSolanaRpc,
  address,
  createTransactionMessage,
  setTransactionMessageLifetimeUsingBlockhash,
  setTransactionMessageFeePayerSigner,
  appendTransactionMessageInstructions,
  signTransactionMessageWithSigners,
  getSignatureFromTransaction,
  pipe,
  type Address,
  type TransactionSigner,
  createKeyPairSignerFromBytes,
  generateKeyPairSigner,
} from '@solana/kit'
import {
  getInitializeConfidentialTransferMintInstruction,
  getInitializeMintInstruction,
  getCreateAssociatedTokenInstruction,
  getMintToInstruction,
  getBurnInstruction,
  findAssociatedTokenPda,
  TOKEN_2022_PROGRAM_ADDRESS,
  ASSOCIATED_TOKEN_PROGRAM_ADDRESS,
} from '@solana-program/token-2022'
import { getCreateAccountInstruction } from '@solana-program/system'

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

  // create a signer adapter from wallet-adapter
  function createWalletSigner(wallet: any): TransactionSigner {
    const pubkeyStr = wallet.publicKey.toBase58()
    return {
      address: address(pubkeyStr),
      signTransactions: async (txs: any[]) => {
        // the wallet adapter expects legacy Transaction objects
        // we need to serialize and sign differently
        const signed = []
        for (const tx of txs) {
          // sign with wallet adapter
          const signedTx = await wallet.signTransaction(tx)
          signed.push(signedTx)
        }
        return signed
      },
    } as TransactionSigner
  }

  // setup: create Token-2022 mint with confidential transfer extension
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

      // generate a new mint keypair
      const mintKeypair = await generateKeyPairSigner()
      const mintAddress = mintKeypair.address
      const walletAddress = address(wallet.publicKey.toBase58())

      // calculate space needed for mint with confidential transfer extension
      // Mint: 82 bytes base + extension header + CT extension data
      const MINT_SIZE = 82
      const EXTENSION_TYPE_SIZE = 2
      const EXTENSION_LENGTH_SIZE = 2
      const CT_MINT_EXTENSION_SIZE = 97 // authority (32 + 1 option) + auto_approve (1) + auditor (32 + 1 option)
      const space = MINT_SIZE + EXTENSION_TYPE_SIZE + EXTENSION_LENGTH_SIZE + CT_MINT_EXTENSION_SIZE

      // get rent
      const rentLamports = await rpc.getMinimumBalanceForRentExemption(BigInt(space)).send()

      // build instructions
      const createAccountIx = getCreateAccountInstruction({
        payer: walletAddress,
        newAccount: mintAddress,
        lamports: rentLamports,
        space: space,
        programAddress: TOKEN_2022_PROGRAM_ADDRESS,
      })

      // initialize confidential transfer mint extension (must be before initializeMint)
      const initCTMintIx = getInitializeConfidentialTransferMintInstruction({
        mint: mintAddress,
        authority: null, // no authority needed for auto-approve
        autoApproveNewAccounts: true,
        auditorElgamalPubkey: null, // no auditor
      })

      // initialize mint
      const initMintIx = getInitializeMintInstruction({
        mint: mintAddress,
        decimals: 6,
        mintAuthority: walletAddress,
        freezeAuthority: walletAddress,
      })

      // get latest blockhash
      const { value: latestBlockhash } = await rpc.getLatestBlockhash().send()

      // build transaction using @solana/kit patterns
      // Note: wallet-adapter uses legacy Transaction, so we need to build differently
      const { Transaction, SystemProgram, PublicKey } = await import('@solana/web3.js')
      const { createInitializeMintInstruction, createInitializeConfidentialTransferMintInstruction } = await import('@solana/spl-token')

      // fallback to web3.js for now since wallet adapter expects legacy tx
      const transaction = new Transaction()

      const mintPubkey = new PublicKey(mintAddress)
      const walletPubkey = new PublicKey(walletAddress)
      const token2022ProgramId = new PublicKey(TOKEN_2022_PROGRAM_ADDRESS)

      // create account
      transaction.add(
        SystemProgram.createAccount({
          fromPubkey: walletPubkey,
          newAccountPubkey: mintPubkey,
          space: space,
          lamports: Number(rentLamports),
          programId: token2022ProgramId,
        })
      )

      // NOTE: createInitializeConfidentialTransferMintInstruction doesn't exist in @solana/spl-token
      // We need to build it manually using the new SDK's instruction builder

      // For now, create a basic mint without CT extension as fallback
      // The CT extension requires manual instruction building
      const splToken = await import('@solana/spl-token')
      transaction.add(
        splToken.createInitializeMintInstruction(
          mintPubkey,
          6,
          walletPubkey,
          walletPubkey,
          token2022ProgramId
        )
      )

      transaction.recentBlockhash = latestBlockhash.blockhash
      transaction.feePayer = walletPubkey

      // need to sign with both wallet and mint keypair
      // extract the keypair bytes to create a legacy Keypair
      const { Keypair } = await import('@solana/web3.js')
      const mintLegacyKeypair = Keypair.fromSecretKey(
        new Uint8Array(await crypto.subtle.exportKey('raw', mintKeypair.keyPair.privateKey))
      )

      transaction.partialSign(mintLegacyKeypair)
      const signed = await wallet.signTransaction(transaction)
      const txid = await (await import('@solana/web3.js')).Connection.prototype.sendRawTransaction.call(
        new (await import('@solana/web3.js')).Connection(RPC_URL),
        signed.serialize()
      )

      // wait for confirmation
      const connection = new (await import('@solana/web3.js')).Connection(RPC_URL)
      await connection.confirmTransaction(txid)

      TEST_VEIL_MINT.value = mintAddress
      localStorage.setItem('veil-test-mint-kit', mintAddress)

      console.log('created mint:', mintAddress)
      return mintAddress
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
        // create ATA using legacy web3.js (wallet adapter compatibility)
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

  // simulated deposit to "private" balance
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

      // burn to simulate deposit
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

      // mint back to simulate withdraw
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

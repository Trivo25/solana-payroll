import { ref } from 'vue'
import {
  createSolanaRpc,
  createSolanaRpcSubscriptions,
  address,
  lamports,
  type Address,
  type Lamports,
} from '@solana/kit'

// RPC endpoint
const RPC_URL = 'http://localhost:8899'
const WS_URL = 'ws://localhost:8900'

// create RPC client
const rpc = createSolanaRpc(RPC_URL)
const rpcSubscriptions = createSolanaRpcSubscriptions(WS_URL)

export function useSolanaKit() {
  const loading = ref(false)
  const error = ref<string | null>(null)

  // get SOL balance for an address
  async function getBalance(addr: string): Promise<number> {
    try {
      const balance = await rpc.getBalance(address(addr)).send()
      // balance.value is in lamports (bigint)
      return Number(balance.value) / 1_000_000_000
    } catch (e: any) {
      console.error('getBalance error:', e)
      return 0
    }
  }

  // get account info
  async function getAccountInfo(addr: string) {
    try {
      const info = await rpc.getAccountInfo(address(addr), { encoding: 'base64' }).send()
      return info.value
    } catch (e: any) {
      console.error('getAccountInfo error:', e)
      return null
    }
  }

  // request airdrop (for local/devnet)
  async function requestAirdrop(addr: string, amount: number): Promise<string | null> {
    loading.value = true
    error.value = null

    try {
      const signature = await rpc
        .requestAirdrop(address(addr), lamports(BigInt(amount * 1_000_000_000)))
        .send()
      return signature
    } catch (e: any) {
      error.value = e.message || 'airdrop failed'
      console.error('airdrop error:', e)
      return null
    } finally {
      loading.value = false
    }
  }

  // get latest blockhash
  async function getLatestBlockhash() {
    const { value } = await rpc.getLatestBlockhash().send()
    return value
  }

  // send and confirm transaction
  async function sendAndConfirmTransaction(signedTx: Uint8Array): Promise<string> {
    const signature = await rpc.sendTransaction(signedTx, { encoding: 'base64' }).send()
    // wait for confirmation
    await rpc
      .confirmTransaction(signature, { commitment: 'confirmed' })
      .send()
    return signature
  }

  return {
    rpc,
    rpcSubscriptions,
    loading,
    error,
    getBalance,
    getAccountInfo,
    requestAirdrop,
    getLatestBlockhash,
    sendAndConfirmTransaction,
  }
}

// helper to convert old web3.js PublicKey to @solana/kit address
export function toKitAddress(publicKey: any): Address {
  if (typeof publicKey === 'string') {
    return address(publicKey)
  }
  // assume it's a web3.js PublicKey with toBase58()
  return address(publicKey.toBase58())
}

/**
 * ElGamal Key Manager
 *
 * Derives ElGamal keypair and AES key DETERMINISTICALLY from wallet signature.
 * The same wallet will always produce the same keys.
 *
 * How it works:
 * 1. Wallet signs a fixed message
 * 2. Signature is hashed with SHA-512 to get 64 bytes of entropy
 * 3. For ElGamal: We ensure the 32 bytes form a valid Ristretto scalar (< curve order)
 * 4. For AES: We take 16 bytes directly
 */

import type { WalletAdapter } from '@solana/wallet-adapter-base';
import { sha512 } from '@noble/hashes/sha512';
import { loadZkSdk, type ZkSdkModule } from './zkSdk';

// Fixed derivation message - changing this would change all derived keys!
const DERIVATION_MESSAGE = 'Veil ElGamal Key Derivation v1';

// Module-level key storage
let elGamalKeypair: InstanceType<ZkSdkModule['ElGamalKeypair']> | null = null;
let aeKey: InstanceType<ZkSdkModule['AeKey']> | null = null;
let derivedForWallet: string | null = null;

/**
 * Ensure bytes form a valid Ristretto scalar (< curve order ~2^252)
 * We do this by clearing the top bits to guarantee the value is small enough.
 */
function clampToValidScalar(bytes: Uint8Array): Uint8Array {
  const clamped = new Uint8Array(bytes);
  // Clear top 4 bits of last byte to ensure < 2^252 (curve order is ~2^252)
  clamped[31] = clamped[31]! & 0x0f;
  return clamped;
}

/**
 * Derive ElGamal keypair and AES key deterministically from wallet signature.
 * The same wallet signing the same message will always produce the same keys.
 */
export async function deriveKeys(
  wallet: WalletAdapter,
): Promise<{
  elGamalKeypair: InstanceType<ZkSdkModule['ElGamalKeypair']>;
  aeKey: InstanceType<ZkSdkModule['AeKey']>;
}> {
  if (!wallet.publicKey) {
    throw new Error('Wallet not connected');
  }

  if (!wallet.signMessage) {
    throw new Error('Wallet does not support message signing');
  }

  const walletAddress = wallet.publicKey.toBase58();

  // Return cached keys if already derived for this wallet
  if (elGamalKeypair && aeKey && derivedForWallet === walletAddress) {
    console.log('[Key Manager] Returning cached keys for', walletAddress.slice(0, 8));
    return { elGamalKeypair, aeKey };
  }

  console.log('[Key Manager] Deriving keys for', walletAddress.slice(0, 8));

  // Load ZK SDK
  const zkSdk = await loadZkSdk();

  // Sign the fixed derivation message
  const messageBytes = new TextEncoder().encode(DERIVATION_MESSAGE);
  console.log('[Key Manager] Requesting wallet signature...');
  const signature = await wallet.signMessage(messageBytes);
  console.log('[Key Manager] Signature obtained, length:', signature.length);

  // Hash signature with SHA-512 to get 64 bytes of uniform entropy
  const hash = sha512.create().update(signature).digest();
  console.log('[Key Manager] Signature hashed');

  // For ElGamal: Take first 32 bytes and clamp to valid scalar
  const elGamalSeed = clampToValidScalar(new Uint8Array(hash.slice(0, 32)));

  try {
    // Create secret key from the clamped bytes
    const secretKey = zkSdk.ElGamalSecretKey.fromBytes(elGamalSeed);
    elGamalKeypair = zkSdk.ElGamalKeypair.fromSecretKey(secretKey);

    const pubkeyHex = Array.from(elGamalKeypair.pubkey().toBytes())
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    console.log('[Key Manager] ElGamal keypair derived deterministically');
    console.log('[Key Manager] ElGamal pubkey:', pubkeyHex.slice(0, 32) + '...');
  } catch (e) {
    console.error('[Key Manager] Failed to derive ElGamal keypair:', e);
    throw new Error('Failed to derive ElGamal keypair from wallet signature');
  }

  // For AES: Take bytes 32-48 (16 bytes for AES-128)
  const aeSeed = new Uint8Array(hash.slice(32, 48));
  try {
    aeKey = zkSdk.AeKey.fromBytes(aeSeed);
    console.log('[Key Manager] AES key derived deterministically');
  } catch (e) {
    console.error('[Key Manager] Failed to derive AES key:', e);
    throw new Error('Failed to derive AES key from wallet signature');
  }

  // Cache the wallet address
  derivedForWallet = walletAddress;

  return { elGamalKeypair, aeKey };
}

/**
 * Get the ElGamal public key as hex string (for display)
 */
export function getElGamalPublicKeyHex(): string | null {
  if (!elGamalKeypair) {
    return null;
  }
  const pubkeyBytes = elGamalKeypair.pubkey().toBytes();
  return Array.from(pubkeyBytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Get the ElGamal keypair (throws if not derived)
 */
export function getElGamalKeypair(): InstanceType<ZkSdkModule['ElGamalKeypair']> {
  if (!elGamalKeypair) {
    throw new Error('ElGamal keypair not derived. Call deriveKeys() first.');
  }
  return elGamalKeypair;
}

/**
 * Get the AES key (throws if not derived)
 */
export function getAeKey(): InstanceType<ZkSdkModule['AeKey']> {
  if (!aeKey) {
    throw new Error('AES key not derived. Call deriveKeys() first.');
  }
  return aeKey;
}

/**
 * Check if keys have been derived
 */
export function hasKeys(): boolean {
  return elGamalKeypair !== null && aeKey !== null;
}

/**
 * Check if keys are derived for a specific wallet
 */
export function isKeysDerivedFor(walletAddress: string): boolean {
  return derivedForWallet === walletAddress && hasKeys();
}

/**
 * Clear cached keys (e.g., on wallet disconnect)
 * Keys will be re-derived on next use (same signature = same keys)
 */
export function clearKeys(): void {
  elGamalKeypair = null;
  aeKey = null;
  derivedForWallet = null;
  console.log('[Key Manager] Keys cleared from memory');
}

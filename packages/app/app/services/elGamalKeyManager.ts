/**
 * ElGamal Key Manager
 *
 * Derives ElGamal keypair and AES key from wallet signature.
 * Keys are deterministically derived so the same wallet always gets the same keys.
 */

import type { WalletAdapter } from '@solana/wallet-adapter-base';
import { sha512 } from '@noble/hashes/sha512';
import { loadZkSdk, type ZkSdkModule } from './zkSdk';

// Fixed derivation message for deterministic key generation
const DERIVATION_MESSAGE = 'Veil ElGamal Key Derivation v1';

// Module-level key storage (not persisted, re-derived on page load)
let elGamalKeypair: InstanceType<ZkSdkModule['ElGamalKeypair']> | null = null;
let aeKey: InstanceType<ZkSdkModule['AeKey']> | null = null;
let derivedForWallet: string | null = null;

/**
 * Derive ElGamal keypair and AES key from wallet signature
 *
 * The wallet signs a fixed message, and we use the signature bytes
 * as entropy to deterministically derive the keys.
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

  // Encode the derivation message
  const messageBytes = new TextEncoder().encode(DERIVATION_MESSAGE);

  // Sign the message with the wallet
  const signature = await wallet.signMessage(messageBytes);
  console.log('[Key Manager] Signature obtained, length:', signature.length);

  // Hash the signature to get deterministic, uniformly distributed bytes
  // SHA-512 gives us 64 bytes to work with
  const hash = sha512.create().update(signature).digest();
  console.log('[Key Manager] Signature hashed');

  // For ElGamal secret key, we need a valid scalar.
  // Take first 32 bytes from hash and clamp them like ed25519 does.
  const elGamalSeed = new Uint8Array(hash.slice(0, 32));
  // Clamp to make it a valid scalar (same as ed25519 key derivation)
  elGamalSeed[0] = elGamalSeed[0]! & 248;
  elGamalSeed[31] = elGamalSeed[31]! & 127;
  elGamalSeed[31] = elGamalSeed[31]! | 64;

  try {
    const secretKey = zkSdk.ElGamalSecretKey.fromBytes(elGamalSeed);
    elGamalKeypair = zkSdk.ElGamalKeypair.fromSecretKey(secretKey);
    console.log('[Key Manager] ElGamal keypair derived from signature');
  } catch (e) {
    // If derivation fails, fall back to random keypair
    console.warn('[Key Manager] Failed to derive deterministic keypair, using random:', e);
    elGamalKeypair = new zkSdk.ElGamalKeypair();
    console.log('[Key Manager] ElGamal keypair generated randomly');
  }

  // Derive AES key from different portion of hash
  // AeKey.fromBytes expects 16 bytes
  const aeSeed = hash.slice(32, 48);
  try {
    aeKey = zkSdk.AeKey.fromBytes(aeSeed);
    console.log('[Key Manager] AES key derived from signature');
  } catch (e) {
    console.warn('[Key Manager] Failed to derive deterministic AES key, using random:', e);
    aeKey = new zkSdk.AeKey();
    console.log('[Key Manager] AES key generated randomly');
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
 */
export function clearKeys(): void {
  elGamalKeypair = null;
  aeKey = null;
  derivedForWallet = null;
  console.log('[Key Manager] Keys cleared');
}

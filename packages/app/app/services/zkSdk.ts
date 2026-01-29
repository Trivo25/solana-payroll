/**
 * ZK SDK Loader
 *
 * Singleton pattern for loading the WASM ZK SDK module.
 * This must only be used client-side (no SSR).
 *
 * The SDK has different exports:
 * - @solana/zk-sdk/node - for Node.js
 * - @solana/zk-sdk/web - for browser (manual WASM loading)
 * - @solana/zk-sdk/bundler - for bundlers like Vite/Webpack
 */

// Define the ZK SDK module type based on what we use from @solana/zk-sdk
// Using bundler export for Vite/Nuxt
export type ZkSdkModule = typeof import('@solana/zk-sdk/bundler');

// Singleton instance
let zkSdkInstance: ZkSdkModule | null = null;
let loadingPromise: Promise<ZkSdkModule> | null = null;

/**
 * Load the ZK SDK WASM module (singleton)
 * Uses lazy loading on first call
 */
export async function loadZkSdk(): Promise<ZkSdkModule> {
  // Return cached instance if already loaded
  if (zkSdkInstance) {
    return zkSdkInstance;
  }

  // Return existing promise if currently loading
  if (loadingPromise) {
    return loadingPromise;
  }

  // Start loading
  loadingPromise = (async () => {
    console.log('[ZK SDK] Loading WASM module...');
    try {
      // Dynamic import for client-side only
      // Use bundler export for Vite/Nuxt
      const sdk = await import('@solana/zk-sdk/bundler');
      zkSdkInstance = sdk;

      // Log available exports for debugging
      const keyExports = [
        'ElGamalKeypair',
        'ElGamalPubkey',
        'ElGamalCiphertext',
        'AeKey',
        'AeCiphertext',
        'PubkeyValidityProofData',
        'CiphertextCommitmentEqualityProofData',
        'BatchedGroupedCiphertext3HandlesValidityProofData',
        'BatchedRangeProofU64Data',
        'BatchedRangeProofU128Data',
        'PedersenOpening',
        'PedersenCommitment',
        'GroupedElGamalCiphertext3Handles',
      ];
      const available = keyExports.filter((e) => e in sdk);
      console.log(`[ZK SDK] Loaded successfully. Available: ${available.join(', ')}`);

      return sdk;
    } catch (error) {
      console.error('[ZK SDK] Failed to load:', error);
      loadingPromise = null; // Reset so we can retry
      throw error;
    }
  })();

  return loadingPromise;
}

/**
 * Check if ZK SDK is loaded
 */
export function isZkSdkLoaded(): boolean {
  return zkSdkInstance !== null;
}

/**
 * Get the loaded ZK SDK instance (throws if not loaded)
 */
export function getZkSdk(): ZkSdkModule {
  if (!zkSdkInstance) {
    throw new Error('ZK SDK not loaded. Call loadZkSdk() first.');
  }
  return zkSdkInstance;
}

/**
 * NoirJS Prover Service
 *
 * Handles ZK proof generation and verification in the browser using NoirJS + Barretenberg.
 * The circuit proves knowledge of invoice payment data (preimage) that hashes to payment_ref.
 */

import { Noir } from '@noir-lang/noir_js';
import { UltraHonkBackend } from '@aztec/bb.js';

// Import the compiled circuit artifact
// @ts-ignore - JSON import
import circuit from '../../circuits/zk_receipts/target/zk_receipts.json';

// Types for the circuit inputs
export interface ProofInputs {
  preimage: number[]; // 256 bytes (padded)
  payment_ref: number[]; // 32 bytes (SHA256 hash)
  [key: string]: number[]; // Index signature for InputMap compatibility
}

export interface GeneratedProof {
  proof: Uint8Array;
  publicInputs: string[];
}

// Singleton instances
let noir: Noir | null = null;
let backend: UltraHonkBackend | null = null;
let initPromise: Promise<void> | null = null;

/**
 * Initialize the Noir prover (lazy, singleton)
 * Call this before generating proofs
 */
export async function initProver(): Promise<void> {
  // Return existing initialization if in progress
  if (initPromise) {
    return initPromise;
  }

  // Already initialized
  if (noir && backend) {
    return;
  }

  initPromise = (async () => {
    console.log('[NoirProver] Initializing...');
    const startTime = performance.now();

    try {
      // Initialize Noir with the circuit
      // @ts-ignore - circuit type
      noir = new Noir(circuit);

      // Initialize the Barretenberg backend
      // @ts-ignore - circuit type
      backend = new UltraHonkBackend(circuit.bytecode);

      const elapsed = Math.round(performance.now() - startTime);
      console.log(`[NoirProver] Initialized in ${elapsed}ms`);
    } catch (error) {
      console.error('[NoirProver] Initialization failed:', error);
      noir = null;
      backend = null;
      throw error;
    }
  })();

  return initPromise;
}

/**
 * Check if prover is ready
 */
export function isProverReady(): boolean {
  return noir !== null && backend !== null;
}

/**
 * Generate a ZK proof
 *
 * @param inputs - The circuit inputs (preimage and payment_ref)
 * @returns The generated proof and public inputs
 */
export async function generateProof(inputs: ProofInputs): Promise<GeneratedProof> {
  if (!noir || !backend) {
    throw new Error('Prover not initialized. Call initProver() first.');
  }

  console.log('[NoirProver] Generating proof...');
  const startTime = performance.now();

  try {
    // Execute the circuit to get the witness
    const { witness } = await noir.execute(inputs);

    // Generate the proof using Barretenberg
    const proof = await backend.generateProof(witness);

    const elapsed = Math.round(performance.now() - startTime);
    console.log(`[NoirProver] Proof generated in ${elapsed}ms`);

    return {
      proof: proof.proof,
      publicInputs: proof.publicInputs,
    };
  } catch (error) {
    console.error('[NoirProver] Proof generation failed:', error);
    throw error;
  }
}

/**
 * Verify a ZK proof
 *
 * @param proof - The proof to verify
 * @param publicInputs - The public inputs
 * @returns true if valid, false otherwise
 */
export async function verifyProof(
  proof: Uint8Array,
  publicInputs: string[]
): Promise<boolean> {
  if (!backend) {
    throw new Error('Prover not initialized. Call initProver() first.');
  }

  console.log('[NoirProver] Verifying proof...');
  const startTime = performance.now();

  try {
    const isValid = await backend.verifyProof({
      proof,
      publicInputs,
    });

    const elapsed = Math.round(performance.now() - startTime);
    console.log(`[NoirProver] Verification completed in ${elapsed}ms: ${isValid ? 'VALID' : 'INVALID'}`);

    return isValid;
  } catch (error) {
    console.error('[NoirProver] Verification failed:', error);
    throw error;
  }
}

/**
 * Clean up resources
 */
export async function destroyProver(): Promise<void> {
  if (backend) {
    await backend.destroy();
  }
  noir = null;
  backend = null;
  initPromise = null;
  console.log('[NoirProver] Destroyed');
}

/**
 * Convert proof to base64 for storage/transmission
 */
export function proofToBase64(proof: Uint8Array): string {
  return btoa(String.fromCharCode(...proof));
}

/**
 * Convert base64 back to proof bytes
 */
export function base64ToProof(base64: string): Uint8Array {
  return new Uint8Array(atob(base64).split('').map(c => c.charCodeAt(0)));
}

/**
 * Serialize proof for JSON storage
 */
export function serializeProof(generated: GeneratedProof): string {
  return JSON.stringify({
    proof: proofToBase64(generated.proof),
    publicInputs: generated.publicInputs,
  });
}

/**
 * Deserialize proof from JSON
 */
export function deserializeProof(json: string): GeneratedProof {
  const data = JSON.parse(json);
  return {
    proof: base64ToProof(data.proof),
    publicInputs: data.publicInputs,
  };
}

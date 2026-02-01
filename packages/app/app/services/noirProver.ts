// noir prover service - handles zk proof generation via noirjs + barretenberg

import { Noir } from '@noir-lang/noir_js';
import { UltraHonkBackend } from '@aztec/bb.js';

// @ts-ignore
import circuit from '../../circuits/zk_receipts/target/zk_receipts.json';

// circuit input types
export interface ProofInputs {
  // private inputs
  invoice_id: number[];
  sender: number[];
  recipient: number[];
  amount: string;
  nonce: number[];

  // public inputs
  payment_ref: number[];
  public_invoice_id: number[];
  public_recipient: number[];
  min_amount: string;
  max_amount: string;

  [key: string]: number[] | string;
}

// selective disclosure options
export interface DisclosureOptions {
  revealInvoiceId?: boolean;
  revealRecipient?: boolean;
  minAmount?: number;
  maxAmount?: number;
}

export interface GeneratedProof {
  proof: Uint8Array;
  publicInputs: string[];
}

let noir: Noir | null = null;
let backend: UltraHonkBackend | null = null;
let initPromise: Promise<void> | null = null;

export async function initProver(): Promise<void> {
  if (initPromise) return initPromise;
  if (noir && backend) return;

  initPromise = (async () => {
    console.log('[noir] init');
    const start = performance.now();

    try {
      // @ts-ignore
      noir = new Noir(circuit);
      // @ts-ignore
      backend = new UltraHonkBackend(circuit.bytecode);
      console.log(`[noir] ready in ${Math.round(performance.now() - start)}ms`);
    } catch (e) {
      console.error('[noir] init failed:', e);
      noir = null;
      backend = null;
      throw e;
    }
  })();

  return initPromise;
}

export function isProverReady(): boolean {
  return noir !== null && backend !== null;
}

export async function generateProof(inputs: ProofInputs): Promise<GeneratedProof> {
  if (!noir || !backend) throw new Error('prover not initialized');

  console.log('[noir] generating proof...');
  const start = performance.now();

  try {
    const { witness } = await noir.execute(inputs);
    const proof = await backend.generateProof(witness);
    console.log(`[noir] proof generated in ${Math.round(performance.now() - start)}ms`);

    return { proof: proof.proof, publicInputs: proof.publicInputs };
  } catch (e) {
    console.error('[noir] proof failed:', e);
    throw e;
  }
}

export async function verifyProof(proof: Uint8Array, publicInputs: string[]): Promise<boolean> {
  if (!backend) throw new Error('prover not initialized');

  console.log('[noir] verifying...');
  const start = performance.now();

  try {
    const valid = await backend.verifyProof({ proof, publicInputs });
    console.log(`[noir] verified in ${Math.round(performance.now() - start)}ms: ${valid}`);
    return valid;
  } catch (e) {
    console.error('[noir] verify failed:', e);
    throw e;
  }
}

export async function destroyProver(): Promise<void> {
  if (backend) await backend.destroy();
  noir = null;
  backend = null;
  initPromise = null;
}

export function proofToBase64(proof: Uint8Array): string {
  return btoa(String.fromCharCode(...proof));
}

export function base64ToProof(base64: string): Uint8Array {
  return new Uint8Array(atob(base64).split('').map(c => c.charCodeAt(0)));
}

export function serializeProof(generated: GeneratedProof): string {
  return JSON.stringify({
    proof: proofToBase64(generated.proof),
    publicInputs: generated.publicInputs,
  });
}

export function deserializeProof(json: string): GeneratedProof {
  const data = JSON.parse(json);
  return {
    proof: base64ToProof(data.proof),
    publicInputs: data.publicInputs,
  };
}

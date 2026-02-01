/**
 * ZK Receipts Composable
 *
 * Provides ZK proof generation and verification for invoice payments.
 * Uses NoirJS to generate proofs in the browser that demonstrate
 * knowledge of payment data without revealing it.
 */

import { ref, computed } from 'vue';
import type { Invoice } from './useInvoices';
import {
  getPaymentPreimage,
  hexToBytes,
  generatePaymentRef,
} from './useInvoices';
import {
  initProver,
  isProverReady,
  generateProof as noirGenerateProof,
  verifyProof as noirVerifyProof,
  serializeProof,
  deserializeProof,
  destroyProver,
  type ProofInputs,
  type GeneratedProof,
} from '../services/noirProver';

// Proof metadata stored alongside the proof
export interface ZkReceiptProof {
  // The actual proof data
  proof: GeneratedProof;

  // Metadata
  invoiceId: string;
  paymentRef: string;
  createdAt: number;

  // Serialized version for storage
  serialized: string;
}

// Progress tracking
export interface ProofProgress {
  step: 'idle' | 'initializing' | 'preparing' | 'generating' | 'complete' | 'error';
  message: string;
}

export function useZkReceipts() {
  // State
  const loading = ref(false);
  const error = ref<string | null>(null);
  const progress = ref<ProofProgress>({ step: 'idle', message: '' });
  const proverReady = ref(false);

  // Check prover status
  const checkProverStatus = () => {
    proverReady.value = isProverReady();
    return proverReady.value;
  };

  /**
   * Initialize the prover (loads WASM, ~2-5 seconds first time)
   */
  async function initializeProver(): Promise<boolean> {
    if (checkProverStatus()) {
      return true;
    }

    loading.value = true;
    error.value = null;
    progress.value = { step: 'initializing', message: 'Loading ZK prover...' };

    try {
      await initProver();
      proverReady.value = true;
      progress.value = { step: 'idle', message: '' };
      return true;
    } catch (e: any) {
      const errorMsg = e.message || 'Failed to initialize prover';
      error.value = errorMsg;
      progress.value = { step: 'error', message: errorMsg };
      return false;
    } finally {
      loading.value = false;
    }
  }

  /**
   * Generate a ZK receipt proof for an invoice
   *
   * Requirements:
   * - Invoice must be paid (have paymentNonce and paymentRef)
   * - Prover must be initialized
   *
   * @param invoice - The paid invoice to generate proof for
   * @returns The generated proof or null on error
   */
  async function generateReceipt(invoice: Invoice): Promise<ZkReceiptProof | null> {
    // Validate invoice
    if (!invoice.paymentNonce || !invoice.paymentRef) {
      error.value = 'Invoice missing payment data (nonce or payment_ref)';
      return null;
    }

    if (invoice.status !== 'paid') {
      error.value = 'Can only generate receipts for paid invoices';
      return null;
    }

    loading.value = true;
    error.value = null;

    try {
      // Step 1: Initialize prover if needed
      if (!checkProverStatus()) {
        progress.value = { step: 'initializing', message: 'Loading ZK prover...' };
        await initProver();
        proverReady.value = true;
      }

      // Step 2: Prepare inputs
      progress.value = { step: 'preparing', message: 'Preparing proof inputs...' };

      // Build the preimage from invoice data
      const preimage = getPaymentPreimage(
        invoice.id,
        invoice.sender,
        invoice.recipient,
        invoice.amount,
        invoice.paymentNonce
      );

      // Get the payment_ref as bytes
      // Note: paymentRef in DB might be truncated, we need full hash
      const fullPaymentRef = await generatePaymentRef(
        invoice.id,
        invoice.sender,
        invoice.recipient,
        invoice.amount,
        invoice.paymentNonce
      );
      const paymentRefBytes = hexToBytes(fullPaymentRef);

      // Prepare circuit inputs
      const inputs: ProofInputs = {
        preimage: Array.from(preimage),
        payment_ref: Array.from(paymentRefBytes),
      };

      // Step 3: Generate proof
      progress.value = { step: 'generating', message: 'Generating ZK proof... (this may take 10-30 seconds)' };

      const proof = await noirGenerateProof(inputs);

      // Step 4: Package result
      progress.value = { step: 'complete', message: 'Proof generated successfully!' };

      const zkReceipt: ZkReceiptProof = {
        proof,
        invoiceId: invoice.id,
        paymentRef: fullPaymentRef,
        createdAt: Date.now(),
        serialized: serializeProof(proof),
      };

      return zkReceipt;
    } catch (e: any) {
      const errorMsg = e.message || 'Failed to generate proof';
      error.value = errorMsg;
      progress.value = { step: 'error', message: errorMsg };
      console.error('[useZkReceipts] Error:', e);
      return null;
    } finally {
      loading.value = false;
    }
  }

  /**
   * Verify a ZK receipt proof
   *
   * @param receipt - The proof to verify
   * @returns true if valid
   */
  async function verifyReceipt(receipt: ZkReceiptProof): Promise<boolean> {
    loading.value = true;
    error.value = null;

    try {
      // Initialize prover if needed
      if (!checkProverStatus()) {
        await initProver();
        proverReady.value = true;
      }

      const isValid = await noirVerifyProof(
        receipt.proof.proof,
        receipt.proof.publicInputs
      );

      return isValid;
    } catch (e: any) {
      error.value = e.message || 'Failed to verify proof';
      console.error('[useZkReceipts] Verification error:', e);
      return false;
    } finally {
      loading.value = false;
    }
  }

  /**
   * Verify a serialized proof (from JSON string)
   */
  async function verifySerializedProof(serialized: string): Promise<boolean> {
    try {
      const proof = deserializeProof(serialized);
      loading.value = true;
      error.value = null;

      if (!checkProverStatus()) {
        await initProver();
        proverReady.value = true;
      }

      return await noirVerifyProof(proof.proof, proof.publicInputs);
    } catch (e: any) {
      error.value = e.message || 'Failed to verify proof';
      return false;
    } finally {
      loading.value = false;
    }
  }

  /**
   * Export proof as downloadable JSON file
   */
  function downloadProof(receipt: ZkReceiptProof, filename?: string): void {
    const data = {
      type: 'zk-receipt',
      version: 1,
      invoiceId: receipt.invoiceId,
      paymentRef: receipt.paymentRef,
      createdAt: receipt.createdAt,
      proof: receipt.serialized,
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || `zk-receipt-${receipt.invoiceId.slice(0, 8)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Load proof from uploaded file
   */
  async function loadProofFromFile(file: File): Promise<ZkReceiptProof | null> {
    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (data.type !== 'zk-receipt') {
        throw new Error('Invalid file format');
      }

      const proof = deserializeProof(data.proof);

      return {
        proof,
        invoiceId: data.invoiceId,
        paymentRef: data.paymentRef,
        createdAt: data.createdAt,
        serialized: data.proof,
      };
    } catch (e: any) {
      error.value = e.message || 'Failed to load proof file';
      return null;
    }
  }

  /**
   * Clean up prover resources
   */
  async function cleanup(): Promise<void> {
    await destroyProver();
    proverReady.value = false;
  }

  /**
   * Clear error state
   */
  function clearError(): void {
    error.value = null;
    if (progress.value.step === 'error') {
      progress.value = { step: 'idle', message: '' };
    }
  }

  return {
    // State
    loading,
    error,
    progress,
    proverReady: computed(() => proverReady.value),

    // Actions
    initializeProver,
    generateReceipt,
    verifyReceipt,
    verifySerializedProof,
    downloadProof,
    loadProofFromFile,
    cleanup,
    clearError,
  };
}

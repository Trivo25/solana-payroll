// zk receipts composable - generates selective disclosure proofs for invoice payments

import { ref, computed } from 'vue';
import type { Invoice } from './useInvoices';
import { hexToBytes, generatePaymentRef } from './useInvoices';
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
  type DisclosureOptions,
} from '../services/noirProver';

export interface ZkReceiptProof {
  proof: GeneratedProof;
  invoiceId: string;
  paymentRef: string;
  createdAt: number;
  serialized: string;
  disclosure: DisclosureOptions;
}

export interface ProofProgress {
  step: 'idle' | 'initializing' | 'preparing' | 'generating' | 'complete' | 'error';
  message: string;
}

// convert string to byte array
function stringToBytes(str: string): number[] {
  return Array.from(new TextEncoder().encode(str));
}

// pad array to fixed length
function padArray(arr: number[], len: number): number[] {
  const result = new Array(len).fill(0);
  for (let i = 0; i < Math.min(arr.length, len); i++) {
    result[i] = arr[i];
  }
  return result;
}

// build circuit inputs from invoice data
function buildProofInputs(
  invoice: Invoice,
  nonce: string,
  paymentRefBytes: number[],
  disclosure: DisclosureOptions = {}
): ProofInputs {
  const invoiceIdBytes = stringToBytes(invoice.id);
  const senderBytes = stringToBytes(invoice.sender);
  const recipientBytes = stringToBytes(invoice.recipient);
  const nonceBytes = stringToBytes(nonce);

  // zeros = not disclosed
  const zeroInvoiceId = new Array(36).fill(0);
  const zeroRecipient = new Array(44).fill(0);

  return {
    // private inputs
    invoice_id: padArray(invoiceIdBytes, 36),
    sender: padArray(senderBytes, 44),
    recipient: padArray(recipientBytes, 44),
    amount: invoice.amount.toString(),
    nonce: padArray(nonceBytes, 64),

    // public inputs
    payment_ref: paymentRefBytes,
    public_invoice_id: disclosure.revealInvoiceId ? padArray(invoiceIdBytes, 36) : zeroInvoiceId,
    public_recipient: disclosure.revealRecipient ? padArray(recipientBytes, 44) : zeroRecipient,
    min_amount: (disclosure.minAmount || 0).toString(),
    max_amount: (disclosure.maxAmount || 0).toString(),
  };
}

export function useZkReceipts() {
  const loading = ref(false);
  const error = ref<string | null>(null);
  const progress = ref<ProofProgress>({ step: 'idle', message: '' });
  const proverReady = ref(false);

  const checkProverStatus = () => {
    proverReady.value = isProverReady();
    return proverReady.value;
  };

  async function initializeProver(): Promise<boolean> {
    if (checkProverStatus()) return true;

    loading.value = true;
    error.value = null;
    progress.value = { step: 'initializing', message: 'loading zk prover...' };

    try {
      await initProver();
      proverReady.value = true;
      progress.value = { step: 'idle', message: '' };
      return true;
    } catch (e: any) {
      const msg = e.message || 'failed to initialize prover';
      error.value = msg;
      progress.value = { step: 'error', message: msg };
      return false;
    } finally {
      loading.value = false;
    }
  }

  async function generateReceipt(
    invoice: Invoice,
    disclosure: DisclosureOptions = {}
  ): Promise<ZkReceiptProof | null> {
    if (!invoice.paymentNonce || !invoice.paymentRef) {
      error.value = 'invoice missing payment data';
      return null;
    }

    if (invoice.status !== 'paid') {
      error.value = 'invoice not paid';
      return null;
    }

    loading.value = true;
    error.value = null;

    try {
      if (!checkProverStatus()) {
        progress.value = { step: 'initializing', message: 'loading zk prover...' };
        await initProver();
        proverReady.value = true;
      }

      progress.value = { step: 'preparing', message: 'preparing inputs...' };

      const fullPaymentRef = await generatePaymentRef(
        invoice.id,
        invoice.sender,
        invoice.recipient,
        invoice.amount,
        invoice.paymentNonce
      );
      const paymentRefBytes = Array.from(hexToBytes(fullPaymentRef));

      const inputs = buildProofInputs(invoice, invoice.paymentNonce, paymentRefBytes, disclosure);

      progress.value = { step: 'generating', message: 'generating proof... (10-30s)' };

      const proof = await noirGenerateProof(inputs);

      progress.value = { step: 'complete', message: 'done' };

      return {
        proof,
        invoiceId: invoice.id,
        paymentRef: fullPaymentRef,
        createdAt: Date.now(),
        serialized: serializeProof(proof),
        disclosure,
      };
    } catch (e: any) {
      const msg = e.message || 'proof generation failed';
      error.value = msg;
      progress.value = { step: 'error', message: msg };
      console.error('[zk] error:', e);
      return null;
    } finally {
      loading.value = false;
    }
  }

  async function verifyReceipt(receipt: ZkReceiptProof): Promise<boolean> {
    loading.value = true;
    error.value = null;

    try {
      if (!checkProverStatus()) {
        await initProver();
        proverReady.value = true;
      }

      return await noirVerifyProof(receipt.proof.proof, receipt.proof.publicInputs);
    } catch (e: any) {
      error.value = e.message || 'verification failed';
      console.error('[zk] verify error:', e);
      return false;
    } finally {
      loading.value = false;
    }
  }

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
      error.value = e.message || 'verification failed';
      return false;
    } finally {
      loading.value = false;
    }
  }

  function downloadProof(receipt: ZkReceiptProof, filename?: string): void {
    const data = {
      type: 'zk-receipt',
      version: 2,
      invoiceId: receipt.invoiceId,
      paymentRef: receipt.paymentRef,
      createdAt: receipt.createdAt,
      disclosure: receipt.disclosure,
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

  async function loadProofFromFile(file: File): Promise<ZkReceiptProof | null> {
    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (data.type !== 'zk-receipt') {
        throw new Error('invalid file format');
      }

      const proof = deserializeProof(data.proof);

      return {
        proof,
        invoiceId: data.invoiceId,
        paymentRef: data.paymentRef,
        createdAt: data.createdAt,
        serialized: data.proof,
        disclosure: data.disclosure || {},
      };
    } catch (e: any) {
      error.value = e.message || 'failed to load file';
      return null;
    }
  }

  async function cleanup(): Promise<void> {
    await destroyProver();
    proverReady.value = false;
  }

  function clearError(): void {
    error.value = null;
    if (progress.value.step === 'error') {
      progress.value = { step: 'idle', message: '' };
    }
  }

  return {
    loading,
    error,
    progress,
    proverReady: computed(() => proverReady.value),

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

export type { DisclosureOptions };

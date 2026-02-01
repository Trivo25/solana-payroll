import { ref } from 'vue';
import { useSupabase } from './useSupabase';

export type InvoiceStatus = 'pending' | 'paid' | 'overdue' | 'cancelled';
export type PaymentMethod = 'public' | 'confidential';

export interface Invoice {
  // database id
  id: string;

  // parties (wallet addresses)
  sender: string;      // who created the invoice (will receive payment)
  recipient: string;   // who needs to pay

  // payment details
  amount: number;
  mint: string;        // token mint address
  status: InvoiceStatus;

  // metadata
  title: string;
  description?: string;
  dueDate?: number;    // unix timestamp
  category?: string;

  // payment info
  paidAt?: number;     // unix timestamp
  txSignature?: string;
  paymentMethod?: PaymentMethod;

  // payment reference (for CT linking)
  paymentNonce?: string;
  paymentRef?: string;

  // zk receipt data
  receiptHash?: string;
  proofAvailable?: boolean;

  // timestamps
  createdAt: number;   // unix timestamp
  updatedAt: number;   // unix timestamp
}

// Database row type (snake_case from Supabase)
interface InvoiceRow {
  id: string;
  sender_wallet: string;
  recipient_wallet: string;
  amount: number;
  mint: string;
  status: InvoiceStatus;
  title: string;
  description: string | null;
  due_date: string | null;
  category: string | null;
  paid_at: string | null;
  tx_signature: string | null;
  payment_method: PaymentMethod | null;
  payment_nonce: string | null;
  payment_ref: string | null;
  receipt_hash: string | null;
  proof_available: boolean;
  created_at: string;
  updated_at: string;
}

// Convert database row to Invoice interface
function rowToInvoice(row: InvoiceRow): Invoice {
  return {
    id: row.id,
    sender: row.sender_wallet,
    recipient: row.recipient_wallet,
    amount: Number(row.amount),
    mint: row.mint,
    status: row.status,
    title: row.title,
    description: row.description ?? undefined,
    dueDate: row.due_date ? new Date(row.due_date).getTime() : undefined,
    category: row.category ?? undefined,
    paidAt: row.paid_at ? new Date(row.paid_at).getTime() : undefined,
    txSignature: row.tx_signature ?? undefined,
    paymentMethod: row.payment_method ?? undefined,
    paymentNonce: row.payment_nonce ?? undefined,
    paymentRef: row.payment_ref ?? undefined,
    receiptHash: row.receipt_hash ?? undefined,
    proofAvailable: row.proof_available,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
  };
}

// Input for creating a new invoice
export interface CreateInvoiceInput {
  recipient: string;   // wallet address of who needs to pay
  amount: number;
  mint: string;
  title: string;
  description?: string;
  dueDate?: Date;
  category?: string;
}

// Input for updating invoice payment status
export interface PayInvoiceInput {
  txSignature: string;
  paymentMethod: PaymentMethod;
  paymentNonce?: string;
  paymentRef?: string;
}

export function useInvoices() {
  const { supabase } = useSupabase();
  const invoices = ref<Invoice[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  // Fetch all invoices for a wallet
  async function fetchInvoices(walletAddress: string): Promise<void> {
    if (!supabase) {
      error.value = 'Supabase not initialized';
      return;
    }

    loading.value = true;
    error.value = null;

    try {
      const { data, error: fetchError } = await supabase
        .from('invoices')
        .select('*')
        .or(`sender_wallet.eq.${walletAddress},recipient_wallet.eq.${walletAddress}`)
        .order('created_at', { ascending: false });

      if (fetchError) {
        console.error('[Invoices] Fetch error:', fetchError);
        error.value = fetchError.message;
        return;
      }

      invoices.value = (data as InvoiceRow[]).map(rowToInvoice);
      console.log(`[Invoices] Fetched ${invoices.value.length} invoices`);
    } catch (e: any) {
      error.value = e.message || 'Failed to fetch invoices';
      console.error('[Invoices] Error:', e);
    } finally {
      loading.value = false;
    }
  }

  // Create a new invoice
  async function createInvoice(
    senderWallet: string,
    input: CreateInvoiceInput
  ): Promise<Invoice | null> {
    if (!supabase) {
      error.value = 'Supabase not initialized';
      return null;
    }

    loading.value = true;
    error.value = null;

    try {
      const { data, error: insertError } = await supabase
        .from('invoices')
        .insert({
          sender_wallet: senderWallet,
          recipient_wallet: input.recipient,
          amount: input.amount,
          mint: input.mint,
          title: input.title,
          description: input.description || null,
          due_date: input.dueDate?.toISOString() || null,
          category: input.category || null,
          status: 'pending',
          proof_available: false,
        })
        .select()
        .single();

      if (insertError) {
        console.error('[Invoices] Create error:', insertError);
        error.value = insertError.message;
        return null;
      }

      const invoice = rowToInvoice(data as InvoiceRow);
      invoices.value.unshift(invoice); // Add to beginning of list
      console.log('[Invoices] Created invoice:', invoice.id);
      return invoice;
    } catch (e: any) {
      error.value = e.message || 'Failed to create invoice';
      console.error('[Invoices] Error:', e);
      return null;
    } finally {
      loading.value = false;
    }
  }

  // Pay an invoice (update status)
  async function payInvoice(
    invoiceId: string,
    payment: PayInvoiceInput
  ): Promise<boolean> {
    if (!supabase) {
      error.value = 'Supabase not initialized';
      return false;
    }

    loading.value = true;
    error.value = null;

    try {
      const { data, error: updateError } = await supabase
        .from('invoices')
        .update({
          status: 'paid',
          paid_at: new Date().toISOString(),
          tx_signature: payment.txSignature,
          payment_method: payment.paymentMethod,
          payment_nonce: payment.paymentNonce || null,
          payment_ref: payment.paymentRef || null,
          proof_available: true,
          receipt_hash: `0x${Array.from(crypto.getRandomValues(new Uint8Array(32))).map(b => b.toString(16).padStart(2, '0')).join('')}`,
        })
        .eq('id', invoiceId)
        .select()
        .single();

      if (updateError) {
        console.error('[Invoices] Pay error:', updateError);
        error.value = updateError.message;
        return false;
      }

      // Update local state
      const updatedInvoice = rowToInvoice(data as InvoiceRow);
      const index = invoices.value.findIndex(inv => inv.id === invoiceId);
      if (index !== -1) {
        invoices.value[index] = updatedInvoice;
      }

      console.log('[Invoices] Paid invoice:', invoiceId);
      return true;
    } catch (e: any) {
      error.value = e.message || 'Failed to pay invoice';
      console.error('[Invoices] Error:', e);
      return false;
    } finally {
      loading.value = false;
    }
  }

  // Cancel an invoice
  async function cancelInvoice(invoiceId: string): Promise<boolean> {
    if (!supabase) {
      error.value = 'Supabase not initialized';
      return false;
    }

    loading.value = true;
    error.value = null;

    try {
      const { error: updateError } = await supabase
        .from('invoices')
        .update({ status: 'cancelled' })
        .eq('id', invoiceId);

      if (updateError) {
        console.error('[Invoices] Cancel error:', updateError);
        error.value = updateError.message;
        return false;
      }

      // Update local state
      const index = invoices.value.findIndex(inv => inv.id === invoiceId);
      if (index !== -1) {
        invoices.value[index].status = 'cancelled';
      }

      console.log('[Invoices] Cancelled invoice:', invoiceId);
      return true;
    } catch (e: any) {
      error.value = e.message || 'Failed to cancel invoice';
      console.error('[Invoices] Error:', e);
      return false;
    } finally {
      loading.value = false;
    }
  }

  // Get invoices for a wallet (from local state)
  function getInvoicesForWallet(walletAddress: string): Invoice[] {
    return invoices.value.filter(
      (inv) => inv.sender === walletAddress || inv.recipient === walletAddress
    );
  }

  // Get invoices where wallet needs to pay (recipient of invoice)
  function getPayableInvoices(walletAddress: string): Invoice[] {
    return invoices.value.filter(
      (inv) => inv.recipient === walletAddress && inv.status === 'pending'
    );
  }

  // Get invoices where wallet is owed money (sender of invoice)
  function getReceivableInvoices(walletAddress: string): Invoice[] {
    return invoices.value.filter(
      (inv) =>
        inv.sender === walletAddress &&
        (inv.status === 'pending' || inv.status === 'overdue')
    );
  }

  // Get single invoice by ID
  function getInvoiceById(id: string): Invoice | undefined {
    return invoices.value.find((inv) => inv.id === id);
  }

  // Clear error
  function clearError(): void {
    error.value = null;
  }

  return {
    invoices,
    loading,
    error,
    fetchInvoices,
    createInvoice,
    payInvoice,
    cancelInvoice,
    getInvoicesForWallet,
    getPayableInvoices,
    getReceivableInvoices,
    getInvoiceById,
    clearError,
  };
}

// Helper to format date
export function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

// Helper to get status color
export function getStatusColor(status: InvoiceStatus): string {
  switch (status) {
    case 'paid':
      return '#10b981';
    case 'pending':
      return '#f59e0b';
    case 'overdue':
      return '#ef4444';
    case 'cancelled':
      return '#6b7280';
    default:
      return '#6b7280';
  }
}

// Helper to generate payment reference hash
export async function generatePaymentRef(
  invoiceId: string,
  sender: string,
  recipient: string,
  amount: number,
  nonce: string
): Promise<string> {
  const data = `${invoiceId}:${sender}:${recipient}:${amount}:${nonce}`;
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

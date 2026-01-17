import { ref } from 'vue';

export type InvoiceStatus = 'pending' | 'paid' | 'overdue' | 'cancelled';

export interface Invoice {
  // on-chain data
  id: string; // unique invoice id (would be pda address on-chain)
  sender: string; // wallet address of sender/business
  recipient: string; // wallet address of recipient/employee
  amount: number; // payment amount
  mint: string; // token mint address
  status: InvoiceStatus; // payment status
  createdAt: number; // unix timestamp
  paidAt?: number; // unix timestamp when paid
  txSignature?: string; // transaction signature if paid

  // off-chain metadata (stored in supabase or ipfs)
  title: string; // invoice title/description
  description?: string; // detailed description
  dueDate?: number; // unix timestamp
  category?: string; // expense category
  attachmentUrl?: string; // receipt/document url

  // zk receipt data (would be generated after payment)
  receiptHash?: string; // hash of the zk receipt
  proofAvailable?: boolean; // whether a zk proof can be generated
}

// dummy invoices for development
const dummyInvoices: Invoice[] = [
  {
    id: 'inv_005',
    sender: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
    recipient: '418TYLVz6HopERHb9hPeyzaUXVnvqmNfxMPaidQ3HJVz',
    amount: 750,
    mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    status: 'pending',
    createdAt: Date.now() - 86400000 * 3,
    title: 'Consulting Services - Q1',
    description: 'Strategic consulting for product roadmap',
    dueDate: Date.now() + 86400000 * 7,
    category: 'Consulting',
    proofAvailable: false,
  },
  {
    id: 'inv_006',
    sender: '418TYLVz6HopERHb9hPeyzaUXVnvqmNfxMPaidQ3HJVz',
    recipient: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
    amount: 1200,
    mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    status: 'pending',
    createdAt: Date.now() - 86400000 * 1,
    title: 'Development Work - Smart Contracts',
    description: 'Solana program development for payroll system',
    dueDate: Date.now() + 86400000 * 14,
    category: 'Development',
    proofAvailable: false,
  },
  {
    id: 'inv_001',
    sender: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
    recipient: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
    amount: 1500,
    mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
    status: 'pending',
    createdAt: Date.now() - 86400000 * 2, // 2 days ago
    title: 'January Salary',
    description: 'Monthly salary payment for January 2025',
    dueDate: Date.now() + 86400000 * 5, // 5 days from now
    category: 'Salary',
    proofAvailable: false,
  },
  {
    id: 'inv_002',
    sender: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
    recipient: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
    amount: 500,
    mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    status: 'paid',
    createdAt: Date.now() - 86400000 * 10,
    paidAt: Date.now() - 86400000 * 8,
    txSignature:
      '5UfDuX7x8H3kL9mN2pQ4rS6tV8wY1zA3bC5dE7fG9hJ2kL4mN6pQ8rS1tV3wY5zA7bC9dE1fG3hJ5kL7mN9pQ',
    title: 'December Bonus',
    description: 'Year-end performance bonus',
    category: 'Bonus',
    receiptHash:
      '0x7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069',
    proofAvailable: true,
  },
  {
    id: 'inv_003',
    sender: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
    recipient: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
    amount: 250,
    mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    status: 'overdue',
    createdAt: Date.now() - 86400000 * 15,
    dueDate: Date.now() - 86400000 * 5, // 5 days ago
    title: 'Freelance Project - Website Design',
    description: 'Landing page design and development',
    category: 'Contract Work',
    proofAvailable: false,
  },
  {
    id: 'inv_004',
    sender: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
    recipient: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
    amount: 2000,
    mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    status: 'paid',
    createdAt: Date.now() - 86400000 * 30,
    paidAt: Date.now() - 86400000 * 28,
    txSignature:
      '3TfDuX7x8H3kL9mN2pQ4rS6tV8wY1zA3bC5dE7fG9hJ2kL4mN6pQ8rS1tV3wY5zA7bC9dE1fG3hJ5kL7mN9pQ',
    title: 'November Salary',
    description: 'Monthly salary payment for November 2024',
    category: 'Salary',
    receiptHash:
      '0x8f94c2768ff2fd64c93ed29259b2e76efd3e5c2gb4e788395beef311237ea17a',
    proofAvailable: true,
  },
];

export function useInvoices() {
  const invoices = ref<Invoice[]>(dummyInvoices);
  const loading = ref(false);

  // get invoices for a wallet (as sender or recipient)
  function getInvoicesForWallet(walletAddress: string): Invoice[] {
    return invoices.value.filter(
      (inv) => inv.sender === walletAddress || inv.recipient === walletAddress
    );
  }

  // get invoices where wallet is the payer (recipient of invoice = they owe money)
  function getPayableInvoices(walletAddress: string): Invoice[] {
    return invoices.value.filter(
      (inv) => inv.recipient === walletAddress && inv.status === 'pending'
    );
  }

  // get invoices where wallet is the receiver (sender of invoice = they are owed money)
  function getReceivableInvoices(walletAddress: string): Invoice[] {
    return invoices.value.filter(
      (inv) =>
        inv.sender === walletAddress &&
        (inv.status === 'pending' || inv.status === 'overdue')
    );
  }

  // simulate paying an invoice
  async function payInvoice(invoiceId: string): Promise<boolean> {
    loading.value = true;
    // simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const invoice = invoices.value.find((inv) => inv.id === invoiceId);
    if (invoice && invoice.status === 'pending') {
      invoice.status = 'paid';
      invoice.paidAt = Date.now();
      invoice.txSignature =
        'simulated_tx_' + Math.random().toString(36).substring(7);
      invoice.proofAvailable = true;
      invoice.receiptHash = '0x' + Math.random().toString(16).substring(2, 66);
      loading.value = false;
      return true;
    }

    loading.value = false;
    return false;
  }

  // get invoice by id
  function getInvoiceById(id: string): Invoice | undefined {
    return invoices.value.find((inv) => inv.id === id);
  }

  return {
    invoices,
    loading,
    getInvoicesForWallet,
    getPayableInvoices,
    getReceivableInvoices,
    payInvoice,
    getInvoiceById,
  };
}

// helper to format date
export function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

// helper to get status color
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

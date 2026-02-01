# Veil - Private Transactions on Solana

Veil is your private financial layer on Solana. Send, receive, and automate transactions with full confidentiality using Token-2022 confidential transfers and zero-knowledge proofs - like Wise, but on-chain and truly private.

## Features

- **Private Transfers** - Send and receive tokens without revealing amounts
- **Confidential Balances** - Your balances are encrypted on-chain
- **Private Invoicing** - Create and pay invoices with confidential amounts
- **Selective Disclosure** - Prove payments without revealing everything
- **Programmable Privacy** - Schedule and automate private transactions

## Invoice ↔ Transaction Linking

Invoices are cryptographically linked to on-chain confidential transfers using a **payment reference hash**.

### How it works

```
┌─────────────────────────────────────────────────────────────┐
│  1. GENERATE PAYMENT REFERENCE                              │
│     paymentRef = SHA256(invoiceId + sender + recipient +    │
│                        amount + nonce).slice(0, 32)         │
├─────────────────────────────────────────────────────────────┤
│  2. EXECUTE CONFIDENTIAL TRANSFER                           │
│     → Transfer encrypted amount to recipient                │
│     → Include paymentRef as SPL Memo instruction            │
├─────────────────────────────────────────────────────────────┤
│  3. STORE LINK IN DATABASE                                  │
│     invoices.update({                                       │
│       tx_signature: "5abc...xyz",                           │
│       payment_ref: "a1b2c3...",                             │
│       payment_nonce: "uuid-v4"                              │
│     })                                                      │
├─────────────────────────────────────────────────────────────┤
│  4. VERIFICATION                                            │
│     → Fetch tx from chain, extract memo                     │
│     → Recompute hash with stored nonce                      │
│     → Verify: memo === recomputed_hash                      │
└─────────────────────────────────────────────────────────────┘
```

### Why this approach?

| Benefit | Explanation |
|---------|-------------|
| **Privacy** | Invoice ID not exposed on-chain (only hash) |
| **Verifiable** | Anyone with the nonce can prove payment was for specific invoice |
| **Tamper-proof** | Hash includes amount, so payment must match invoice exactly |

### Code reference

```typescript
// Generate payment reference (useInvoices.ts)
const paymentRef = await generatePaymentRef(
  invoice.id,
  invoice.sender,
  invoice.recipient,
  invoice.amount,
  crypto.randomUUID()  // nonce
);

// Include in CT transfer as memo (InvoiceModal.vue)
await transferConfidential(wallet, recipient, amount, paymentRef);
```

---

## Setup

Look at the [Nuxt documentation](https://nuxt.com/docs/getting-started/introduction) to learn more.

## Setup

Make sure to install dependencies:

```bash
# npm
npm install

# pnpm
pnpm install

# yarn
yarn install

# bun
bun install
```

## Development Server

Start the development server on `http://localhost:3000`:

```bash
# npm
npm run dev

# pnpm
pnpm dev

# yarn
yarn dev

# bun
bun run dev
```

## Production

Build the application for production:

```bash
# npm
npm run build

# pnpm
pnpm build

# yarn
yarn build

# bun
bun run build
```

Locally preview production build:

```bash
# npm
npm run preview

# pnpm
pnpm preview

# yarn
yarn preview

# bun
bun run preview
```

Check out the [deployment documentation](https://nuxt.com/docs/getting-started/deployment) for more information.

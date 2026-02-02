# Veil - Private Transactions on Solana

** It is hightly recommended to set up a sandbox environment/a dummy Phantom wallet and try it our yourself for the full experience**

The project is deployed to: https://solana-payroll-app.vercel.app

It uses the `https://zk-edge.surfnet.dev/` network since CT are not enabled on mainnet or devnet.

Here's one CT done on zk-edge-surfnet through Veil: https://explorer.solana.com/tx/2gqvJi7VD6PVbLuRQDW1pd7y1qvdxMdGTmsvbg1ist4KuucKrewZ44YayBgNFiYJ2rLb4adyLTsHz5EgAWaioejr?cluster=custom&customUrl=https://zk-edge.surfnet.dev:8899

And here' sthe token Mint: https://explorer.solana.com/address/Dbz8dLkGA6PErb4VxRFr8GDdk27J9YLVbFCmhq7bdtPH?cluster=custom&customUrl=https%3A%2F%2Fzk-edge.surfnet.dev%3A8899

Keep in mind to ONLY use a dummy private key - never your real private keys. It is recommended to connect via Phantom.

> Your private financial layer on Solana. Like Wise, but on-chain and truly private.

This project enables private transactions, payroll, and invoicing on Solana by combining Confidential Transfers for hidden payments with Noir-based zero-knowledge receipts for selective, verifiable disclosure.

### TypeScript Example

I put together a TypeScript example that goes through the Confidential Transfer in TypeScript only which is accessible here: https://github.com/Trivo25/solana-confidential-transfer-typescript

JavaScript/TypeScript examples are pretty bad, hence I opened this PR as well.

## Problem

In todays world, most if not all on-chain payments are publicly visible and let's be honest, who the heck wants everyone to know all your bank transfer details, the invoices you pay and how much salary you earn?

Similarly, the same applies to businesses. One of the main hurdles of using blockchains for payroll is that amounts and recipients are transparent. On top of all of that, running a business is already complex enough but accounting and tax laws make it even harder. So, the problem is:

Most on-chain payments are fully transparent by default. Anyone can see:

- Payment amounts and recipients
- Salaries and contractor payments
- Company revenue and cash flow
- Business relationships and payment patterns

This makes blockchains unsuitable (or very annoying) for:

- Personal transfers
- Payroll
- Invoices
- Subscriptions
- B2B payments
- Any financial activity requiring privacy

For real businesses, this is not a nice to have - it's an actual blocker. But at the same time businesses need to inherit to tax laws and auditability from various parties. Businesses need:

- Auditability (accounting, tax, compliance, ..)
- Verifiable receipts
- Selective disclosure (share only what is really required, with whom it’s required)

Currently, the only sultion are to either use public blockchains or private but unverifiable web3 banking solutions.

The goal of this submission is to: `Transact privately, but prove facts about payments when needed.`

## Proposed Solution

Private transactions with cryptographic selective disclosure on Solana!

Veil is a privacy-first financial layer built on two primitives:

- Solana Confidential Transfers
- Zero-knowledge receipts using Noir

Together they enable:

- Private transactions by default
- Auditability & verifiable disclosures
- Programmable privacy

without trusted intermediaries

### Private Transactions

Transactions are done using SPL Token-2022's Confidential Transfer extension to ensure transfer amounts are encrypted and account balances are hidden, while the network can still verify correctness of transfers. From the outside, observers (consensus, nodes, auditors, ..) can see that a transfer did happen. But they cannot see payment amounts, salaries, revenue and more.

That way, we can have a system in which personal transfers, payroll, invoices, etc are done on-chain in a verifiable way without leaking any sensitive private data.

### Selective disclosure

_(I know that CT support a auditor key to decode all transactions - but this avoids the need to force-decrypt all balances and token and only discloses exactly that what must be disclosed in a permissionless way. This project builds on top of the auditor idea in a pemrissionless, trustless and less disruptive way allowing selective disclosure to multiple parties)_

As mentioned before privacy is not enough since payments must still be "provable" and "audible".

Reipients can generate zk receipts using Noir that allows them to selectively disclose facts aobut a private payment, e.g. "I received 500$ for invoice 123" or "I paid my invoice 9164 on date 7/7/7777".

These proofs are generates locally on the "clients" machine and can be verified either on-chain or off-chain (e.g. by an accountant or tax auditor). They do not reveal any balances, business relationsihps or anything else.

The recipient chooses what to reveal and what not!

## ZK Receipts (Selective Disclosure Proofs)

Prove you made a payment without revealing sensitive details. ZK receipts use Noir circuits to generate cryptographic proofs that can selectively disclose facts about a transaction.

### What can you prove?

| Proof Type       | What it proves                      | What stays hidden           |
| ---------------- | ----------------------------------- | --------------------------- |
| **Payment Made** | Valid payment exists for invoice    | Amount, sender, recipient   |
| **Invoice Link** | Payment was for specific invoice ID | Amount, sender              |
| **Recipient**    | Payment went to specific wallet     | Amount, sender              |
| **Amount Range** | Payment was >= $X or ≤ $Y           | Exact amount, other parties |

# Private Payroll

> This project enables private payroll and invoicing on Solana by combining Confidential Transfers for hidden payments with Noir based zero-knowledge receipts for selective, verifiable disclosure.

## Problem

In todays world, most if not all on-chain payments are publicly visible and let's be honest, who the heck wants everyone to know all your bank transfer details, the invoices you pay and how much salary you earn?

Similarly, the same applies to businesses. One of the main hurdles of using blockchains for payroll is that amounts and recipients are transparent. On top of all of that, running a business is already complex enough but accounting and tax laws make it even harder. So, the problem is:

Most on-chain payments are fully transparent by default. Anyone can see:

- Salaries and contractor payments
- Company revenue and cash flow
- Business relationships and payment patterns

This makes blockchains unsuable (or very annoying) for:

- Payroll
- Invoices
- Subscriptions
- B2B payments
- ..

For real businesses, this is not a nice to have - it's an actual blocker. But at the same time businesses need to inherit to tax laws and auditability from various parties. Businesses need:

- Auditability (accounting, tax, compliance, ..)
- Verifiable receipts
- Selective disclosure (share only what is really required, with whom it’s required)

Currently, the only sultion are to either use public blockchains or private but unverifiable web3 banking solutions.

The goal of this submission is to: `Pay privately, but prove facts about the payment when needed.`

## Proposed Solution

Private payments with cryptographic selective disclosure on Solana!

I propose a privacy-first payroll and invoicing system built on two primitives:

- Solana Confidential Transfers
- Zero-knowledge receipts using Noir

Together they enable:

- Private payments by default
- Auditablility & verifiable disclosures

without trusted intermediaries

### Private payments

Payments are done using the SPL in order to ensure transfer amounts are encrypted, account balances are hidden but the network can still verify correctness of transfers. From the outside howver, observers (consensus, nodes, auditors, ..) can see that a transfer did indeed happen. But they cannot see payment amounts, salaries, revenue and more.

That way, we can have a system in which payroll, invoices, etc are done on-chain in a verifable way without leaking any sensitive private data.

### Selective disclosure

As mentioned before privacy is not enough since payments must still be "provable" and "audible".

Reipients can generate zk receipts using Noir that allows them to selectively disclose facts aobut a private payment, e.g. "I received 500$ for invoice 123" or "I paid my invoice 9164 on date 7/7/7777".

These proofs are generates locally on the "clients" machine and can be verified either on-chain or off-chain (e.g. by an accountant or tax auditor). They do not reveal any balances, business relationsihps or anything else.

The recipient chooses what to reveal and what not!

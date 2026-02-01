<template>
  <div class="invoice-card" :class="[invoice.status, { outgoing: isOutgoing, incoming: !isOutgoing }]" @click="$emit('click', invoice)">
    <!-- Direction indicator -->
    <div class="direction-badge" :class="{ outgoing: isOutgoing, incoming: !isOutgoing }">
      <svg v-if="isOutgoing" width="14" height="14" viewBox="0 0 24 24" fill="none">
        <path d="M7 17L17 7M17 7H7M17 7V17" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none">
        <path d="M17 7L7 17M7 17H17M7 17V7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      {{ isOutgoing ? 'Outgoing' : 'Incoming' }}
    </div>

    <div class="invoice-header">
      <span class="invoice-title">{{ invoice.title }}</span>
      <span class="invoice-status" :style="{ backgroundColor: getStatusColor(invoice.status) + '20', color: getStatusColor(invoice.status) }">
        {{ invoice.status }}
      </span>
    </div>

    <div class="invoice-amount" :class="{ outgoing: isOutgoing, incoming: !isOutgoing }">
      <span class="amount-sign">{{ isOutgoing ? '+' : '-' }}</span>
      <span class="amount-value">${{ invoice.amount.toLocaleString() }}</span>
      <span class="amount-token">USDC</span>
    </div>

    <div class="invoice-meta">
      <div class="meta-item">
        <span class="meta-label">{{ isOutgoing ? 'From' : 'To' }}</span>
        <span class="meta-value mono">{{ shortenAddress(isOutgoing ? invoice.recipient : invoice.sender) }}</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">{{ invoice.status === 'paid' ? 'Paid' : 'Due' }}</span>
        <span class="meta-value">{{ formatDate(invoice.status === 'paid' ? invoice.paidAt! : (invoice.dueDate || invoice.createdAt)) }}</span>
      </div>
    </div>

    <div v-if="invoice.category" class="invoice-category">
      {{ invoice.category }}
    </div>

    <div class="invoice-badges">
      <div v-if="invoice.paymentMethod" class="payment-method-badge" :class="invoice.paymentMethod">
        <svg v-if="invoice.paymentMethod === 'confidential'" width="12" height="12" viewBox="0 0 24 24" fill="none">
          <path d="M12 3L4 7v6c0 5.25 3.4 10.15 8 11 4.6-.85 8-5.75 8-11V7l-8-4z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <svg v-else width="12" height="12" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/>
          <path d="M12 7v5l3 3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
        {{ invoice.paymentMethod === 'confidential' ? 'Private' : 'Public' }}
      </div>
      <div v-if="invoice.proofAvailable" class="proof-badge">
        <span class="proof-icon">&#x2713;</span>
        ZK Receipt
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { type Invoice, formatDate, getStatusColor } from '~/composables/useInvoices'

const props = defineProps<{
  invoice: Invoice
  walletAddress: string
}>()

defineEmits<{
  (e: 'click', invoice: Invoice): void
}>()

// Outgoing = you created the invoice, waiting to receive payment
// Incoming = someone sent you an invoice, you need to pay
const isOutgoing = computed(() => props.invoice.sender === props.walletAddress)

function shortenAddress(address: string): string {
  if (!address) return ''
  return `${address.slice(0, 4)}...${address.slice(-4)}`
}
</script>

<style scoped>
.invoice-card {
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 0 16px 16px 0;
  padding: 1.25rem;
  padding-left: 1.5rem;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
  overflow: hidden;
}

.invoice-card::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 4px;
  background: var(--text-muted);
  transition: background 0.2s ease;
}

.invoice-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.1);
}

.invoice-card.overdue {
  border-color: rgba(239, 68, 68, 0.3);
}

.invoice-card.outgoing::before {
  background: linear-gradient(180deg, #10b981 0%, #059669 100%);
}

.invoice-card.incoming::before {
  background: linear-gradient(180deg, #f59e0b 0%, #d97706 100%);
}

/* Direction badge */
.direction-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.625rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  margin-bottom: 0.75rem;
}

.direction-badge.outgoing {
  background: rgba(16, 185, 129, 0.1);
  color: #10b981;
}

.direction-badge.incoming {
  background: rgba(245, 158, 11, 0.1);
  color: #f59e0b;
}

.invoice-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.invoice-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
  flex: 1;
}

.invoice-status {
  font-size: 0.75rem;
  font-weight: 500;
  padding: 0.25rem 0.5rem;
  border-radius: 6px;
  text-transform: capitalize;
}

.invoice-amount {
  display: flex;
  align-items: baseline;
  gap: 0.25rem;
  margin-bottom: 1rem;
}

.invoice-amount.outgoing .amount-sign,
.invoice-amount.outgoing .amount-value {
  color: #10b981;
}

.invoice-amount.incoming .amount-sign,
.invoice-amount.incoming .amount-value {
  color: #f59e0b;
}

.amount-sign {
  font-size: 1.25rem;
  font-weight: 700;
}

.amount-value {
  font-size: 1.5rem;
  font-weight: 700;
}

.amount-token {
  font-size: 0.875rem;
  color: var(--text-muted);
  margin-left: 0.125rem;
}

.invoice-meta {
  display: flex;
  gap: 1.5rem;
  margin-bottom: 0.75rem;
}

.meta-item {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.meta-label {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.meta-value {
  font-size: 0.875rem;
  color: var(--text-secondary);
}

.invoice-category {
  display: inline-block;
  font-size: 0.75rem;
  color: var(--text-secondary);
  background: rgba(15, 23, 42, 0.05);
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
}

.invoice-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.75rem;
}

.payment-method-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.75rem;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
}

.payment-method-badge.confidential {
  color: #6366f1;
  background: rgba(99, 102, 241, 0.1);
}

.payment-method-badge.public {
  color: var(--text-secondary);
  background: rgba(15, 23, 42, 0.05);
}

.proof-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.75rem;
  color: var(--secondary);
  background: rgba(16, 185, 129, 0.1);
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
}

.proof-icon {
  font-size: 0.625rem;
}
</style>

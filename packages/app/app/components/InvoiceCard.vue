<template>
  <div class="invoice-card" :class="invoice.status" @click="$emit('click', invoice)">
    <div class="invoice-header">
      <span class="invoice-title">{{ invoice.title }}</span>
      <span class="invoice-status" :style="{ backgroundColor: getStatusColor(invoice.status) + '20', color: getStatusColor(invoice.status) }">
        {{ invoice.status }}
      </span>
    </div>

    <div class="invoice-amount">
      <span class="amount-value">${{ invoice.amount.toLocaleString() }}</span>
      <span class="amount-token">USDC</span>
    </div>

    <div class="invoice-meta">
      <div class="meta-item">
        <span class="meta-label">{{ isReceivable ? 'From' : 'To' }}</span>
        <span class="meta-value mono">{{ shortenAddress(isReceivable ? invoice.recipient : invoice.sender) }}</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">{{ invoice.status === 'paid' ? 'Paid' : 'Due' }}</span>
        <span class="meta-value">{{ formatDate(invoice.status === 'paid' ? invoice.paidAt! : (invoice.dueDate || invoice.createdAt)) }}</span>
      </div>
    </div>

    <div v-if="invoice.category" class="invoice-category">
      {{ invoice.category }}
    </div>

    <div v-if="invoice.proofAvailable" class="proof-badge">
      <span class="proof-icon">&#x2713;</span>
      ZK Receipt
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

// check if this is a receivable (user sent the invoice, waiting for payment)
const isReceivable = computed(() => props.invoice.sender === props.walletAddress)

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
  border-radius: 16px;
  padding: 1.25rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.invoice-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.1);
}

.invoice-card.overdue {
  border-color: rgba(239, 68, 68, 0.3);
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
  gap: 0.375rem;
  margin-bottom: 1rem;
}

.amount-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-primary);
}

.amount-token {
  font-size: 0.875rem;
  color: var(--text-muted);
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

.proof-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.75rem;
  color: var(--secondary);
  background: rgba(16, 185, 129, 0.1);
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  margin-left: 0.5rem;
}

.proof-icon {
  font-size: 0.625rem;
}
</style>

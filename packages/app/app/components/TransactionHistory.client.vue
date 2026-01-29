<template>
  <div class="transaction-history">
    <div class="history-header">
      <div class="history-label">Recent Activity</div>
      <button
        v-if="transactions.length > 0"
        class="clear-btn"
        @click="clearHistory"
        title="Clear history"
      >
        &#x1F5D1;
      </button>
    </div>

    <div v-if="transactions.length === 0" class="empty-state">
      <span class="empty-icon">&#x1F4AD;</span>
      <p>No transactions yet</p>
    </div>

    <div v-else class="transaction-list">
      <div
        v-for="tx in transactions.slice(0, 10)"
        :key="tx.id"
        class="transaction-item"
        :class="tx.type"
      >
        <div class="tx-icon">
          <span v-if="tx.type === 'deposit'">&#x2B07;</span>
          <span v-else-if="tx.type === 'apply'">&#x2705;</span>
          <span v-else-if="tx.type === 'withdraw'">&#x2B06;</span>
          <span v-else>&#x1F4B0;</span>
        </div>
        <div class="tx-details">
          <div class="tx-type">{{ formatType(tx.type) }}</div>
          <div class="tx-time">{{ formatTime(tx.timestamp) }}</div>
        </div>
        <div class="tx-amount" :class="tx.type">
          {{ formatAmount(tx.type, tx.amount) }}
        </div>
        <a
          :href="`https://explorer.solana.com/tx/${tx.signature}?cluster=custom&customUrl=http://127.0.0.1:8899`"
          target="_blank"
          class="tx-link"
          title="View on Explorer"
        >
          &#x1F517;
        </a>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useConfidentialTransfer, type CTTransaction } from '~/composables/useConfidentialTransfer';

const { transactions, clearTransactionHistory } = useConfidentialTransfer();

function clearHistory() {
  if (confirm('Clear transaction history?')) {
    clearTransactionHistory();
  }
}

function formatType(type: CTTransaction['type']): string {
  switch (type) {
    case 'deposit': return 'Deposit to Pending';
    case 'apply': return 'Applied to Private';
    case 'withdraw': return 'Withdraw to Public';
    case 'mint': return 'Minted Tokens';
    default: return type;
  }
}

function formatAmount(type: CTTransaction['type'], amount: number): string {
  if (type === 'apply') {
    return amount > 0 ? `+${amount.toFixed(2)}` : '---';
  }
  const formatted = amount.toFixed(2);
  if (type === 'deposit') {
    return `+${formatted}`;
  } else if (type === 'withdraw') {
    return `-${formatted}`;
  }
  return formatted;
}

function formatTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  if (diff < 60000) {
    return 'Just now';
  } else if (diff < 3600000) {
    const mins = Math.floor(diff / 60000);
    return `${mins}m ago`;
  } else if (diff < 86400000) {
    const hours = Math.floor(diff / 3600000);
    return `${hours}h ago`;
  } else {
    const days = Math.floor(diff / 86400000);
    return `${days}d ago`;
  }
}
</script>

<style scoped>
.transaction-history {
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 20px;
  padding: 1.25rem;
  min-width: 280px;
}

.history-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.history-label {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-secondary);
}

.clear-btn {
  background: none;
  border: none;
  font-size: 0.875rem;
  cursor: pointer;
  opacity: 0.4;
  padding: 0.25rem;
  transition: opacity 0.2s;
}

.clear-btn:hover {
  opacity: 1;
}

.empty-state {
  text-align: center;
  padding: 1.5rem 0;
  color: var(--text-muted);
}

.empty-icon {
  font-size: 2rem;
  display: block;
  margin-bottom: 0.5rem;
  opacity: 0.5;
}

.empty-state p {
  font-size: 0.75rem;
}

.transaction-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  max-height: 300px;
  overflow-y: auto;
}

.transaction-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
  background: rgba(255, 255, 255, 0.6);
  border-radius: 8px;
  transition: background 0.2s;
}

.transaction-item:hover {
  background: rgba(255, 255, 255, 0.9);
}

.transaction-item.deposit {
  border-left: 2px solid #f59e0b;
}

.transaction-item.apply {
  border-left: 2px solid #10b981;
}

.transaction-item.withdraw {
  border-left: 2px solid #6366f1;
}

.tx-icon {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.875rem;
  flex-shrink: 0;
}

.tx-details {
  flex: 1;
  min-width: 0;
}

.tx-type {
  font-size: 0.7rem;
  font-weight: 500;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tx-time {
  font-size: 0.6rem;
  color: var(--text-muted);
}

.tx-amount {
  font-size: 0.75rem;
  font-weight: 600;
  font-family: var(--font-mono, monospace);
  flex-shrink: 0;
}

.tx-amount.deposit,
.tx-amount.apply {
  color: #10b981;
}

.tx-amount.withdraw {
  color: #6366f1;
}

.tx-link {
  font-size: 0.75rem;
  opacity: 0.5;
  text-decoration: none;
  flex-shrink: 0;
  transition: opacity 0.2s;
}

.tx-link:hover {
  opacity: 1;
}
</style>

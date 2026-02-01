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
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path
            d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14z"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          <path
            d="M10 11v6M14 11v6"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
          />
        </svg>
      </button>
    </div>

    <div v-if="transactions.length === 0" class="empty-state">
      <div class="empty-icon">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
          <circle
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            stroke-width="1.5"
          />
          <path
            d="M12 6v6l4 2"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
          />
        </svg>
      </div>
      <p class="empty-title">No activity yet</p>
      <p class="empty-hint">Your transactions will appear here</p>
    </div>

    <div v-else class="transaction-list">
      <div
        v-for="tx in transactions.slice(0, 10)"
        :key="tx.id"
        class="transaction-item"
        :class="tx.type"
      >
        <div class="tx-icon" :class="tx.type">
          <svg
            v-if="tx.type === 'deposit'"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
          >
            <path
              d="M12 5v14M5 12l7 7 7-7"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
          <svg
            v-else-if="tx.type === 'apply'"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              stroke-width="2"
            />
            <path
              d="M8 12l3 3 5-6"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
          <svg
            v-else-if="tx.type === 'withdraw'"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
          >
            <path
              d="M12 19V5M5 12l7-7 7 7"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
          <svg
            v-else-if="tx.type === 'transfer'"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
          >
            <rect
              x="5"
              y="11"
              width="14"
              height="10"
              rx="2"
              stroke="currentColor"
              stroke-width="2"
            />
            <path
              d="M8 11V7a4 4 0 018 0v4"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            />
          </svg>
          <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none">
            <circle
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              stroke-width="2"
            />
            <path
              d="M12 6v6l4 2"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            />
          </svg>
        </div>
        <div class="tx-details">
          <div class="tx-type">{{ formatType(tx.type) }}</div>
          <div class="tx-time">{{ formatTime(tx.timestamp) }}</div>
        </div>
        <div class="tx-amount" :class="tx.type">
          {{ formatAmount(tx.type, tx.amount) }}
        </div>
        <a
          :href="`https://explorer.solana.com/tx/${tx.signature}?cluster=custom&customUrl=https://zk-edge.surfnet.dev:8899`"
          target="_blank"
          class="tx-link"
          title="View on Explorer"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path
              d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <path
              d="M15 3h6v6M10 14L21 3"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </a>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  useConfidentialTransfer,
  type CTTransaction,
} from '~/composables/useConfidentialTransfer';

const { transactions, clearTransactionHistory } = useConfidentialTransfer();

function clearHistory() {
  if (confirm('Clear transaction history?')) {
    clearTransactionHistory();
  }
}

function formatType(type: CTTransaction['type']): string {
  switch (type) {
    case 'deposit':
      return 'Deposit to Pending';
    case 'apply':
      return 'Applied to Private';
    case 'withdraw':
      return 'Withdraw to Public';
    case 'transfer':
      return 'Private Transfer';
    case 'mint':
      return 'Minted Tokens';
    default:
      return type;
  }
}

function formatAmount(type: CTTransaction['type'], amount: number): string {
  if (type === 'apply') {
    return amount > 0 ? `+${amount.toFixed(2)}` : '---';
  }
  const formatted = amount.toFixed(2);
  if (type === 'deposit') {
    return `+${formatted}`;
  } else if (type === 'withdraw' || type === 'transfer') {
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
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: none;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  color: var(--text-muted);
  transition: all 0.2s ease;
}

.clear-btn:hover {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

.empty-state {
  text-align: center;
  padding: 1.5rem 0;
  color: var(--text-muted);
}

.empty-icon {
  display: flex;
  justify-content: center;
  margin-bottom: 0.5rem;
  color: var(--text-muted);
  opacity: 0.5;
}

.empty-title {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-secondary);
  margin-bottom: 0.25rem;
}

.empty-hint {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.transaction-list {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  max-height: 300px;
  overflow-y: auto;
}

.transaction-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
  background: white;
  border: 1px solid rgba(15, 23, 42, 0.06);
  border-radius: 8px;
  transition: all 0.2s ease;
}

.transaction-item:hover {
  border-color: rgba(15, 23, 42, 0.12);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.tx-icon {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border-radius: 6px;
  background: rgba(15, 23, 42, 0.05);
  color: var(--text-secondary);
}

.tx-icon svg {
  width: 14px;
  height: 14px;
}

.tx-icon.deposit {
  background: rgba(245, 158, 11, 0.12);
  color: #f59e0b;
}

.tx-icon.apply {
  background: rgba(16, 185, 129, 0.12);
  color: #10b981;
}

.tx-icon.withdraw {
  background: rgba(99, 102, 241, 0.12);
  color: #6366f1;
}

.tx-icon.transfer {
  background: rgba(16, 185, 129, 0.12);
  color: #10b981;
}

.tx-icon.mint {
  background: rgba(245, 158, 11, 0.12);
  color: #f59e0b;
}

.tx-details {
  flex: 1;
  min-width: 0;
}

.tx-type {
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tx-time {
  font-size: 0.625rem;
  color: var(--text-muted);
}

.tx-amount {
  font-size: 0.75rem;
  font-weight: 600;
  font-family: 'IBM Plex Mono', monospace;
  flex-shrink: 0;
}

.tx-amount.deposit,
.tx-amount.apply,
.tx-amount.mint {
  color: #10b981;
}

.tx-amount.withdraw {
  color: #6366f1;
}

.tx-amount.transfer {
  color: #10b981;
}

.tx-link {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 4px;
  color: var(--text-muted);
  text-decoration: none;
  flex-shrink: 0;
  transition: all 0.15s ease;
}

.tx-link svg {
  width: 12px;
  height: 12px;
}

.tx-link:hover {
  background: rgba(15, 23, 42, 0.06);
  color: var(--text-secondary);
}
</style>

<template>
  <Teleport to="body">
    <div v-if="show" class="modal-overlay" @click.self="!loading && $emit('close')">
      <div class="modal">
        <div class="modal-header">
          <h3>Create Invoice</h3>
          <button class="modal-close" @click="$emit('close')" :disabled="loading">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </button>
        </div>
        <p class="modal-desc">
          Request payment from another wallet. They'll be able to pay publicly or privately.
        </p>

        <form @submit.prevent="handleCreate">
          <!-- Recipient Address -->
          <div class="input-group">
            <label>Payer Wallet Address <span class="required">*</span></label>
            <input
              v-model="form.recipient"
              type="text"
              placeholder="Enter Solana wallet address"
              :disabled="loading"
              required
            />
          </div>

          <!-- Amount -->
          <div class="input-row">
            <div class="input-group flex-1">
              <label>Amount <span class="required">*</span></label>
              <input
                v-model.number="form.amount"
                type="number"
                min="0.01"
                step="0.01"
                placeholder="0.00"
                :disabled="loading"
                required
              />
            </div>
            <div class="input-group token-select">
              <label>Token</label>
              <div class="token-badge">
                <span class="token-icon">$</span>
                cUSDC
              </div>
            </div>
          </div>

          <!-- Title -->
          <div class="input-group">
            <label>Title <span class="required">*</span></label>
            <input
              v-model="form.title"
              type="text"
              placeholder="e.g., January Salary, Consulting Fee"
              maxlength="100"
              :disabled="loading"
              required
            />
          </div>

          <!-- Description -->
          <div class="input-group">
            <label>Description <span class="optional">(optional)</span></label>
            <textarea
              v-model="form.description"
              placeholder="Add details about this invoice..."
              rows="2"
              maxlength="500"
              :disabled="loading"
            ></textarea>
          </div>

          <!-- Due Date & Category -->
          <div class="input-row">
            <div class="input-group flex-1">
              <label>Due Date <span class="optional">(optional)</span></label>
              <input
                v-model="form.dueDate"
                type="date"
                :min="minDate"
                :disabled="loading"
              />
            </div>
            <div class="input-group flex-1">
              <label>Category <span class="optional">(optional)</span></label>
              <select v-model="form.category" :disabled="loading">
                <option value="">Select category</option>
                <option value="Salary">Salary</option>
                <option value="Bonus">Bonus</option>
                <option value="Consulting">Consulting</option>
                <option value="Development">Development</option>
                <option value="Design">Design</option>
                <option value="Contract Work">Contract Work</option>
                <option value="Reimbursement">Reimbursement</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          <!-- Error -->
          <div v-if="error" class="error-message">
            {{ error }}
          </div>

          <!-- Actions -->
          <div class="modal-actions">
            <button
              type="button"
              class="btn btn-secondary"
              @click="$emit('close')"
              :disabled="loading"
            >
              Cancel
            </button>
            <button
              type="submit"
              class="btn btn-primary"
              :disabled="loading || !isValid"
            >
              <span v-if="loading" class="btn-loading">
                <span class="spinner-small"></span>
                Creating...
              </span>
              <span v-else>Create Invoice</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useInvoices, type CreateInvoiceInput } from '~/composables/useInvoices';
import { useToast } from '~/composables/useToast';

const props = defineProps<{
  show: boolean;
  senderWallet: string;
  mint: string;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'created'): void;
}>();

const { createInvoice, loading, error } = useInvoices();
const toast = useToast();

const form = ref({
  recipient: '',
  amount: null as number | null,
  title: '',
  description: '',
  dueDate: '',
  category: '',
});

// Minimum date is today
const minDate = computed(() => {
  return new Date().toISOString().split('T')[0];
});

// Form validation
const isValid = computed(() => {
  return (
    form.value.recipient.length >= 32 &&
    form.value.amount && form.value.amount > 0 &&
    form.value.title.trim().length > 0
  );
});

async function handleCreate() {
  if (!isValid.value) return;

  const input: CreateInvoiceInput = {
    recipient: form.value.recipient.trim(),
    amount: form.value.amount!,
    mint: props.mint,
    title: form.value.title.trim(),
    description: form.value.description.trim() || undefined,
    dueDate: form.value.dueDate ? new Date(form.value.dueDate) : undefined,
    category: form.value.category || undefined,
  };

  const invoice = await createInvoice(props.senderWallet, input);

  if (invoice) {
    toast.success('Invoice Created', {
      message: `Invoice for ${input.amount} cUSDC sent to ${input.recipient.slice(0, 8)}...`,
    });
    resetForm();
    emit('created');
    emit('close');
  }
}

function resetForm() {
  form.value = {
    recipient: '',
    amount: null,
    title: '',
    description: '',
    dueDate: '',
    category: '',
  };
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: fade-in 0.15s ease-out;
}

@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

.modal {
  background: white;
  border-radius: 20px;
  padding: 1.5rem;
  max-width: 480px;
  width: 90%;
  max-height: 90vh;
  overflow-y: auto;
  animation: modal-in 0.2s ease-out;
}

@keyframes modal-in {
  from {
    opacity: 0;
    transform: scale(0.95) translateY(10px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.5rem;
}

.modal-header h3 {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.modal-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  background: none;
  border-radius: 8px;
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.15s ease;
}

.modal-close:hover:not(:disabled) {
  background: rgba(15, 23, 42, 0.05);
  color: var(--text-secondary);
}

.modal-close:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.modal-desc {
  font-size: 0.875rem;
  color: var(--text-secondary);
  margin-bottom: 1.25rem;
  line-height: 1.5;
}

.input-group {
  margin-bottom: 1rem;
}

.input-row {
  display: flex;
  gap: 1rem;
}

.flex-1 {
  flex: 1;
}

.input-group label {
  display: block;
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--text-secondary);
  margin-bottom: 0.375rem;
}

.required {
  color: #ef4444;
}

.optional {
  color: var(--text-muted);
  font-weight: 400;
}

.input-group input,
.input-group textarea,
.input-group select {
  width: 100%;
  padding: 0.625rem 0.75rem;
  border: 1px solid rgba(15, 23, 42, 0.1);
  border-radius: 8px;
  font-size: 0.875rem;
  font-family: inherit;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.input-group input:focus,
.input-group textarea:focus,
.input-group select:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 3px rgba(15, 23, 42, 0.05);
}

.input-group input:disabled,
.input-group textarea:disabled,
.input-group select:disabled {
  background: rgba(15, 23, 42, 0.03);
  cursor: not-allowed;
}

.input-group textarea {
  resize: vertical;
  min-height: 60px;
}

.input-group select {
  cursor: pointer;
}

.token-select {
  width: 100px;
  flex-shrink: 0;
}

.token-badge {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.625rem 0.75rem;
  background: rgba(39, 117, 202, 0.1);
  border: 1px solid rgba(39, 117, 202, 0.2);
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 500;
  color: #2775ca;
}

.token-icon {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: linear-gradient(135deg, #2775ca 0%, #3b93dc 100%);
  color: white;
  font-size: 0.625rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}

.error-message {
  padding: 0.75rem;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.2);
  border-radius: 8px;
  color: #dc2626;
  font-size: 0.8125rem;
  margin-bottom: 1rem;
}

.modal-actions {
  display: flex;
  gap: 0.75rem;
  margin-top: 1.5rem;
}

.btn {
  flex: 1;
  padding: 0.75rem 1.25rem;
  font-size: 0.875rem;
  font-weight: 600;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  border: none;
  font-family: inherit;
}

.btn-primary {
  background: var(--primary);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #1e293b;
}

.btn-secondary {
  background: rgba(15, 23, 42, 0.05);
  color: var(--text-secondary);
}

.btn-secondary:hover:not(:disabled) {
  background: rgba(15, 23, 42, 0.1);
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.spinner-small {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>

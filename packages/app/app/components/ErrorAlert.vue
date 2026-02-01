<template>
  <Transition name="slide-fade">
    <div v-if="visible" class="error-alert" :class="type">
      <div class="alert-icon">
        <svg v-if="type === 'error'" width="18" height="18" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
          <path d="M12 8v4M12 16v.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
        <svg v-else-if="type === 'warning'" width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path d="M12 9v4M12 17v.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="currentColor" stroke-width="2"/>
        </svg>
        <svg v-else-if="type === 'success'" width="18" height="18" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
          <path d="M8 12l3 3 5-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
      <div class="alert-content">
        <div class="alert-title">{{ title }}</div>
        <div v-if="message" class="alert-message">{{ message }}</div>
        <div v-if="hint" class="alert-hint">{{ hint }}</div>
      </div>
      <button class="alert-close" @click="dismiss" aria-label="Dismiss">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </button>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue';

const props = withDefaults(defineProps<{
  title: string;
  message?: string;
  hint?: string;
  type?: 'error' | 'warning' | 'success';
  autoDismiss?: boolean;
  autoDismissDelay?: number;
}>(), {
  type: 'error',
  autoDismiss: true,
  autoDismissDelay: 8000,
});

const emit = defineEmits<{
  dismiss: [];
}>();

const visible = ref(true);
let dismissTimer: ReturnType<typeof setTimeout> | null = null;

function dismiss() {
  visible.value = false;
  setTimeout(() => emit('dismiss'), 200);
}

function startAutoDismiss() {
  if (props.autoDismiss && props.autoDismissDelay > 0) {
    dismissTimer = setTimeout(dismiss, props.autoDismissDelay);
  }
}

function clearAutoDismiss() {
  if (dismissTimer) {
    clearTimeout(dismissTimer);
    dismissTimer = null;
  }
}

watch(() => props.title, () => {
  visible.value = true;
  clearAutoDismiss();
  startAutoDismiss();
});

onMounted(startAutoDismiss);
onUnmounted(clearAutoDismiss);
</script>

<style scoped>
.error-alert {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.875rem 1rem;
  border-radius: 10px;
  animation: shake 0.4s ease-out;
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  20% { transform: translateX(-4px); }
  40% { transform: translateX(4px); }
  60% { transform: translateX(-2px); }
  80% { transform: translateX(2px); }
}

.error-alert.error {
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.2);
}

.error-alert.warning {
  background: rgba(245, 158, 11, 0.1);
  border: 1px solid rgba(245, 158, 11, 0.2);
}

.error-alert.success {
  background: rgba(16, 185, 129, 0.1);
  border: 1px solid rgba(16, 185, 129, 0.2);
}

.alert-icon {
  flex-shrink: 0;
  margin-top: 1px;
}

.error-alert.error .alert-icon {
  color: #ef4444;
}

.error-alert.warning .alert-icon {
  color: #f59e0b;
}

.error-alert.success .alert-icon {
  color: #10b981;
}

.alert-content {
  flex: 1;
  min-width: 0;
}

.alert-title {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text-primary);
}

.alert-message {
  font-size: 0.75rem;
  color: var(--text-secondary);
  margin-top: 0.125rem;
  line-height: 1.4;
}

.alert-hint {
  font-size: 0.7rem;
  color: var(--text-muted);
  margin-top: 0.375rem;
  font-style: italic;
}

.alert-close {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  background: none;
  border-radius: 4px;
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.15s ease;
  margin: -0.25rem -0.25rem -0.25rem 0;
}

.alert-close:hover {
  background: rgba(0, 0, 0, 0.05);
  color: var(--text-secondary);
}

/* Transition */
.slide-fade-enter-active {
  transition: all 0.2s ease-out;
}

.slide-fade-leave-active {
  transition: all 0.15s ease-in;
}

.slide-fade-enter-from {
  opacity: 0;
  transform: translateY(-8px);
}

.slide-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>

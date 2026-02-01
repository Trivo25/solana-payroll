<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="showTour" class="onboarding-overlay">
        <div class="onboarding-card">
          <div class="card-progress">
            <div
              v-for="i in totalSteps"
              :key="i"
              class="progress-dot"
              :class="{ active: i === currentStep, completed: i < currentStep }"
            ></div>
          </div>

          <!-- Step 1: Welcome -->
          <div v-if="currentStep === 1" class="step-content">
            <div class="step-icon welcome">
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                <rect width="48" height="48" rx="12" fill="url(#welcome-grad)"/>
                <path d="M24 10L34 18L24 26L14 18L24 10Z" fill="white" fill-opacity="0.9"/>
                <path d="M24 22L34 30L24 38L14 30L24 22Z" fill="white" fill-opacity="0.6"/>
                <defs>
                  <linearGradient id="welcome-grad" x1="0" y1="0" x2="48" y2="48">
                    <stop stop-color="#10b981"/>
                    <stop offset="1" stop-color="#059669"/>
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <h2>Welcome to Veil</h2>
            <p>
              Veil is a private payment app built on Solana. Send and receive payments
              without revealing your balance or transaction amounts.
            </p>
          </div>

          <!-- Step 2: Confidential Transfers -->
          <div v-if="currentStep === 2" class="step-content">
            <div class="step-icon privacy">
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                <rect width="48" height="48" rx="12" fill="#6366f1"/>
                <path d="M24 10L12 16V24C12 32 17.1 39.4 24 42C30.9 39.4 36 32 36 24V16L24 10Z"
                  stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M18 24L22 28L30 20" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
            <h2>Private Balances</h2>
            <p>
              Your confidential balance is encrypted using zero-knowledge proofs.
              Only you can see your private balance - it's hidden from everyone else,
              including blockchain explorers.
            </p>
          </div>

          <!-- Step 3: How it works -->
          <div v-if="currentStep === 3" class="step-content">
            <div class="step-icon flow">
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                <rect width="48" height="48" rx="12" fill="#f59e0b"/>
                <circle cx="16" cy="24" r="4" stroke="white" stroke-width="2"/>
                <circle cx="32" cy="24" r="4" stroke="white" stroke-width="2"/>
                <path d="M20 24H28" stroke="white" stroke-width="2" stroke-linecap="round"/>
                <path d="M25 21L28 24L25 27" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
            <h2>How It Works</h2>
            <p>
              <strong>1. Deposit</strong> - Move tokens from public to private balance<br/>
              <strong>2. Transfer</strong> - Send privately to any wallet<br/>
              <strong>3. Withdraw</strong> - Move back to public when needed
            </p>
          </div>

          <!-- Step 4: Get Started -->
          <div v-if="currentStep === 4" class="step-content">
            <div class="step-icon start">
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                <rect width="48" height="48" rx="12" fill="#10b981"/>
                <path d="M20 16L32 24L20 32V16Z" fill="white"/>
              </svg>
            </div>
            <h2>Ready to Go!</h2>
            <p>
              Click "Enable Confidential Transfers" in the Confidential Balance card
              to get started. You'll need to sign a message to generate your encryption keys.
            </p>
          </div>

          <div class="card-actions">
            <button v-if="currentStep > 1" class="btn-back" @click="prevStep">
              Back
            </button>
            <button v-if="currentStep < totalSteps" class="btn-next" @click="nextStep">
              Next
            </button>
            <button v-else class="btn-finish" @click="finish">
              Get Started
            </button>
          </div>

          <button class="skip-btn" @click="skip">
            Skip tour
          </button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';

const STORAGE_KEY = 'veil-has-onboarded';

const showTour = ref(false);
const currentStep = ref(1);
const totalSteps = 4;

function nextStep() {
  if (currentStep.value < totalSteps) {
    currentStep.value++;
  }
}

function prevStep() {
  if (currentStep.value > 1) {
    currentStep.value--;
  }
}

function finish() {
  localStorage.setItem(STORAGE_KEY, 'true');
  showTour.value = false;
}

function skip() {
  localStorage.setItem(STORAGE_KEY, 'true');
  showTour.value = false;
}

onMounted(() => {
  const hasOnboarded = localStorage.getItem(STORAGE_KEY);
  if (!hasOnboarded) {
    // Small delay to let the page render first
    setTimeout(() => {
      showTour.value = true;
    }, 500);
  }
});
</script>

<style scoped>
.onboarding-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  padding: 1rem;
}

.onboarding-card {
  background: white;
  border-radius: 24px;
  padding: 2rem;
  max-width: 420px;
  width: 100%;
  text-align: center;
  box-shadow: 0 25px 80px rgba(0, 0, 0, 0.25);
  animation: card-appear 0.3s ease-out;
}

@keyframes card-appear {
  from {
    opacity: 0;
    transform: scale(0.95) translateY(20px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.card-progress {
  display: flex;
  justify-content: center;
  gap: 0.5rem;
  margin-bottom: 2rem;
}

.progress-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: rgba(15, 23, 42, 0.15);
  transition: all 0.3s ease;
}

.progress-dot.active {
  background: var(--secondary);
  transform: scale(1.25);
}

.progress-dot.completed {
  background: var(--secondary);
}

.step-content {
  margin-bottom: 2rem;
}

.step-icon {
  display: inline-flex;
  margin-bottom: 1.5rem;
}

.step-content h2 {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 0.75rem;
  letter-spacing: -0.02em;
}

.step-content p {
  font-size: 0.95rem;
  color: var(--text-secondary);
  line-height: 1.6;
}

.step-content p strong {
  color: var(--text-primary);
}

.card-actions {
  display: flex;
  gap: 0.75rem;
  justify-content: center;
  margin-bottom: 1rem;
}

.btn-back,
.btn-next,
.btn-finish {
  padding: 0.875rem 2rem;
  font-size: 0.95rem;
  font-weight: 600;
  border-radius: 12px;
  border: none;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.2s ease;
}

.btn-back {
  background: rgba(15, 23, 42, 0.08);
  color: var(--text-secondary);
}

.btn-back:hover {
  background: rgba(15, 23, 42, 0.15);
}

.btn-next {
  background: var(--primary);
  color: white;
}

.btn-next:hover {
  background: #1e293b;
  transform: translateY(-1px);
}

.btn-finish {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;
  padding: 0.875rem 2.5rem;
}

.btn-finish:hover {
  transform: translateY(-1px);
  box-shadow: 0 8px 24px rgba(16, 185, 129, 0.3);
}

.skip-btn {
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 0.8rem;
  cursor: pointer;
  font-family: inherit;
  padding: 0.5rem;
  transition: color 0.2s;
}

.skip-btn:hover {
  color: var(--text-secondary);
}

/* Fade transition */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>

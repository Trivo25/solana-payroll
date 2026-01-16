<template>
  <div class="qr-connect">
    <!-- tab switcher -->
    <div class="tab-switcher">
      <button
        class="tab-btn"
        :class="{ active: activeTab === 'show' }"
        @click="activeTab = 'show'"
      >
        My QR Code
      </button>
      <button
        class="tab-btn"
        :class="{ active: activeTab === 'scan' }"
        @click="activeTab = 'scan'"
      >
        Scan QR Code
      </button>
    </div>

    <!-- show qr code -->
    <div v-if="activeTab === 'show'" class="qr-display">
      <div class="qr-image-wrapper">
        <img v-if="qrCodeUrl" :src="qrCodeUrl" alt="Your QR Code" class="qr-image" />
        <div v-else class="qr-loading">Generating...</div>
      </div>
      <p class="qr-hint">Share this QR code to let others connect with you</p>
      <div class="wallet-address-display mono">
        {{ walletAddress }}
      </div>
      <button class="copy-btn" @click="copyAddress">
        {{ copied ? 'Copied!' : 'Copy Address' }}
      </button>
    </div>

    <!-- scan qr code -->
    <div v-if="activeTab === 'scan'" class="qr-scanner">
      <div v-if="!scanning" class="scanner-placeholder">
        <button class="scan-btn" @click="startScanning">
          <span class="scan-icon">&#x1F4F7;</span>
          <span>Start Camera</span>
        </button>
        <p class="scanner-hint">Scan another user's QR code to connect</p>
      </div>

      <div v-else class="scanner-active">
        <div id="qr-reader" class="qr-reader"></div>
        <button class="stop-btn" @click="stopScanning">Stop Scanning</button>
      </div>

      <!-- scan result -->
      <div v-if="scannedAddress" class="scan-result">
        <p class="result-label">Scanned Address:</p>
        <p class="result-address mono">{{ scannedAddress }}</p>
        <div class="result-actions">
          <button class="action-btn primary" @click="handleConnect">
            Connect
          </button>
          <button class="action-btn secondary" @click="scannedAddress = ''">
            Clear
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'

const props = defineProps<{
  walletAddress: string
}>()

const emit = defineEmits<{
  (e: 'connect', address: string): void
}>()

const activeTab = ref<'show' | 'scan'>('show')
const qrCodeUrl = ref('')
const scanning = ref(false)
const scannedAddress = ref('')
const copied = ref(false)

let html5QrCode: any = null

// generate qr code
async function generateQRCode() {
  if (!props.walletAddress) return

  try {
    const QRCode = (await import('qrcode')).default
    qrCodeUrl.value = await QRCode.toDataURL(props.walletAddress, {
      width: 200,
      margin: 2,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    })
  } catch (e) {
    console.error('failed to generate qr code:', e)
  }
}

// copy address to clipboard
async function copyAddress() {
  try {
    await navigator.clipboard.writeText(props.walletAddress)
    copied.value = true
    setTimeout(() => {
      copied.value = false
    }, 2000)
  } catch (e) {
    console.error('failed to copy:', e)
  }
}

// start scanning
async function startScanning() {
  try {
    const { Html5Qrcode } = await import('html5-qrcode')
    html5QrCode = new Html5Qrcode('qr-reader')
    scanning.value = true

    // wait for dom to update
    await new Promise(resolve => setTimeout(resolve, 100))

    await html5QrCode.start(
      { facingMode: 'environment' },
      {
        fps: 10,
        qrbox: { width: 200, height: 200 },
      },
      (decodedText: string) => {
        // validate it looks like a solana address (base58, 32-44 chars)
        if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(decodedText)) {
          scannedAddress.value = decodedText
          stopScanning()
        }
      },
      () => {
        // ignore errors during scanning
      }
    )
  } catch (e) {
    console.error('failed to start scanner:', e)
    scanning.value = false
    alert('Could not access camera. Please check permissions.')
  }
}

// stop scanning
async function stopScanning() {
  if (html5QrCode) {
    try {
      await html5QrCode.stop()
    } catch (e) {
      // ignore
    }
    html5QrCode = null
  }
  scanning.value = false
}

// handle connect action
function handleConnect() {
  if (scannedAddress.value) {
    emit('connect', scannedAddress.value)
  }
}

// watch for wallet address changes
watch(() => props.walletAddress, () => {
  generateQRCode()
}, { immediate: true })

// cleanup on unmount
onUnmounted(() => {
  stopScanning()
})
</script>

<style scoped>
.qr-connect {
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 20px;
  padding: 1.5rem;
  max-width: 350px;
}

/* tab switcher */
.tab-switcher {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
}

.tab-btn {
  flex: 1;
  padding: 0.75rem 1rem;
  background: rgba(15, 23, 42, 0.05);
  border: none;
  border-radius: 10px;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
  font-family: inherit;
}

.tab-btn.active {
  background: var(--primary);
  color: white;
}

.tab-btn:hover:not(.active) {
  background: rgba(15, 23, 42, 0.1);
}

/* qr display */
.qr-display {
  text-align: center;
}

.qr-image-wrapper {
  background: white;
  border-radius: 16px;
  padding: 1rem;
  display: inline-block;
  margin-bottom: 1rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}

.qr-image {
  display: block;
  width: 200px;
  height: 200px;
}

.qr-loading {
  width: 200px;
  height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
}

.qr-hint {
  font-size: 0.875rem;
  color: var(--text-secondary);
  margin-bottom: 1rem;
}

.wallet-address-display {
  font-size: 0.75rem;
  color: var(--text-muted);
  background: rgba(15, 23, 42, 0.05);
  padding: 0.5rem 0.75rem;
  border-radius: 8px;
  word-break: break-all;
  margin-bottom: 1rem;
}

.copy-btn {
  padding: 0.5rem 1rem;
  background: var(--primary);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  font-family: inherit;
}

.copy-btn:hover {
  background: #1e293b;
}

/* qr scanner */
.qr-scanner {
  text-align: center;
}

.scanner-placeholder {
  padding: 2rem 1rem;
}

.scan-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  padding: 2rem;
  background: rgba(15, 23, 42, 0.05);
  border: 2px dashed rgba(15, 23, 42, 0.2);
  border-radius: 16px;
  cursor: pointer;
  transition: all 0.2s;
  font-family: inherit;
}

.scan-btn:hover {
  background: rgba(15, 23, 42, 0.1);
  border-color: var(--primary);
}

.scan-icon {
  font-size: 2rem;
}

.scan-btn span:last-child {
  font-size: 1rem;
  font-weight: 500;
  color: var(--text-primary);
}

.scanner-hint {
  font-size: 0.875rem;
  color: var(--text-secondary);
  margin-top: 1rem;
}

.scanner-active {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.qr-reader {
  width: 100%;
  border-radius: 12px;
  overflow: hidden;
}

.stop-btn {
  padding: 0.75rem 1.5rem;
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
  border: none;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  font-family: inherit;
}

.stop-btn:hover {
  background: rgba(239, 68, 68, 0.2);
}

/* scan result */
.scan-result {
  margin-top: 1.5rem;
  padding: 1rem;
  background: rgba(16, 185, 129, 0.1);
  border-radius: 12px;
}

.result-label {
  font-size: 0.75rem;
  color: var(--text-secondary);
  margin-bottom: 0.5rem;
}

.result-address {
  font-size: 0.875rem;
  color: var(--text-primary);
  word-break: break-all;
  margin-bottom: 1rem;
}

.result-actions {
  display: flex;
  gap: 0.5rem;
}

.action-btn {
  flex: 1;
  padding: 0.75rem;
  border: none;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.2s;
}

.action-btn.primary {
  background: var(--secondary);
  color: white;
}

.action-btn.primary:hover {
  background: #059669;
}

.action-btn.secondary {
  background: rgba(15, 23, 42, 0.1);
  color: var(--text-secondary);
}

.action-btn.secondary:hover {
  background: rgba(15, 23, 42, 0.2);
}
</style>

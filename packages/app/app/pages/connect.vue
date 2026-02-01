<template>
  <div class="connect-page">
    <!-- Animated background -->
    <div class="background">
      <div class="gradient-mesh"></div>
      <div class="aurora aurora-1"></div>
      <div class="aurora aurora-2"></div>
      <div class="noise"></div>
      <div class="grid-pattern"></div>
      <div class="particles">
        <div v-for="i in 12" :key="i" class="particle" :style="getParticleStyle(i)"></div>
      </div>
    </div>

    <!-- Content -->
    <main class="content">
      <div class="connect-card">
        <div class="card-shine"></div>

        <div class="card-header">
          <NuxtLink to="/" class="back-link">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M10 12L6 8L10 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <span>Back to Home</span>
          </NuxtLink>
        </div>

        <div class="card-body">
          <div class="icon-wrapper">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <rect width="32" height="32" rx="8" fill="url(#icon-gradient)"/>
              <path d="M16 6L22 12L16 18L10 12L16 6Z" fill="white" fill-opacity="0.9"/>
              <path d="M16 14L22 20L16 26L10 20L16 14Z" fill="white" fill-opacity="0.6"/>
              <defs>
                <linearGradient id="icon-gradient" x1="0" y1="0" x2="32" y2="32">
                  <stop stop-color="#10b981"/>
                  <stop offset="1" stop-color="#059669"/>
                </linearGradient>
              </defs>
            </svg>
          </div>

          <h1 class="title">Connect Wallet</h1>
          <p class="subtitle">
            Connect your Solana wallet to start paying privately with zero-knowledge proofs
          </p>

          <!-- Wallet connect - client only component -->
          <WalletConnect />
        </div>

        <div class="card-footer">
          <div class="security-badges">
            <div class="security-badge">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M7 1L2 3.5V6.5C2 9.5 4 12 7 13C10 12 12 9.5 12 6.5V3.5L7 1Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M5 7L6.5 8.5L9 5.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              <span>Non-Custodial</span>
            </div>
            <div class="security-badge">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <rect x="2" y="6" width="10" height="7" rx="1.5" stroke="currentColor" stroke-width="1.5"/>
                <path d="M4 6V4C4 2.34 5.34 1 7 1C8.66 1 10 2.34 10 4V6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              </svg>
              <span>End-to-End Encrypted</span>
            </div>
          </div>
          <p class="footer-text">
            By connecting, you agree to our Terms of Service
          </p>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
function getParticleStyle(i: number) {
  const size = 2 + Math.random() * 3;
  return {
    width: `${size}px`,
    height: `${size}px`,
    left: `${Math.random() * 100}%`,
    top: `${Math.random() * 100}%`,
    animationDelay: `${Math.random() * 15}s`,
    animationDuration: `${12 + Math.random() * 15}s`,
  };
}
</script>

<style scoped>
.connect-page {
  min-height: 100vh;
  position: relative;
  overflow: hidden;
}

/* Animated Background */
.background {
  position: fixed;
  inset: 0;
  z-index: 0;
  overflow: hidden;
}

.gradient-mesh {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(at 30% 20%, rgba(16, 185, 129, 0.1) 0px, transparent 50%),
    radial-gradient(at 70% 80%, rgba(6, 182, 212, 0.08) 0px, transparent 50%),
    radial-gradient(at 0% 50%, rgba(16, 185, 129, 0.06) 0px, transparent 50%);
}

.aurora {
  position: absolute;
  filter: blur(100px);
  opacity: 0.4;
}

.aurora-1 {
  width: 50vw;
  height: 50vh;
  background: linear-gradient(180deg, rgba(16, 185, 129, 0.4) 0%, rgba(16, 185, 129, 0) 100%);
  top: -15%;
  right: -10%;
  animation: aurora1 18s ease-in-out infinite;
}

.aurora-2 {
  width: 40vw;
  height: 40vh;
  background: linear-gradient(180deg, rgba(6, 182, 212, 0.3) 0%, rgba(6, 182, 212, 0) 100%);
  bottom: -10%;
  left: -10%;
  animation: aurora2 22s ease-in-out infinite;
}

@keyframes aurora1 {
  0%, 100% { transform: translateY(0) rotate(0deg) scale(1); }
  50% { transform: translateY(-20px) rotate(3deg) scale(1.05); }
}

@keyframes aurora2 {
  0%, 100% { transform: translateX(0) rotate(0deg); }
  50% { transform: translateX(30px) rotate(-3deg); }
}

.noise {
  position: absolute;
  inset: 0;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
  opacity: 0.015;
  pointer-events: none;
}

.grid-pattern {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(15, 23, 42, 0.015) 1px, transparent 1px),
    linear-gradient(90deg, rgba(15, 23, 42, 0.015) 1px, transparent 1px);
  background-size: 60px 60px;
}

.particles {
  position: absolute;
  inset: 0;
  overflow: hidden;
}

.particle {
  position: absolute;
  background: rgba(16, 185, 129, 0.5);
  border-radius: 50%;
  animation: float-particle linear infinite;
}

@keyframes float-particle {
  0% { transform: translateY(100vh) rotate(0deg); opacity: 0; }
  10% { opacity: 1; }
  90% { opacity: 1; }
  100% { transform: translateY(-100vh) rotate(720deg); opacity: 0; }
}

/* Content */
.content {
  position: relative;
  z-index: 1;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
}

/* Card */
.connect-card {
  position: relative;
  width: 100%;
  max-width: 440px;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(15, 23, 42, 0.06);
  border-radius: 24px;
  overflow: hidden;
  box-shadow:
    0 25px 50px -12px rgba(0, 0, 0, 0.08),
    0 0 0 1px rgba(255, 255, 255, 0.5) inset;
  animation: card-appear 0.5s cubic-bezier(0.4, 0, 0.2, 1);
}

@keyframes card-appear {
  from {
    opacity: 0;
    transform: translateY(20px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.card-shine {
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent);
  animation: card-shine 4s ease-in-out infinite;
}

@keyframes card-shine {
  0% { left: -100%; }
  50%, 100% { left: 100%; }
}

.card-header {
  padding: 1.5rem 1.5rem 0;
}

.back-link {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--text-secondary);
  text-decoration: none;
  font-size: 0.875rem;
  font-weight: 500;
  transition: all 0.2s ease;
  padding: 0.5rem 0.75rem;
  margin: -0.5rem -0.75rem;
  border-radius: 8px;
}

.back-link:hover {
  color: var(--text-primary);
  background: rgba(15, 23, 42, 0.03);
}

.back-link svg {
  transition: transform 0.2s ease;
}

.back-link:hover svg {
  transform: translateX(-2px);
}

.card-body {
  padding: 2rem 2rem 1.5rem;
  text-align: center;
}

.icon-wrapper {
  width: 64px;
  height: 64px;
  margin: 0 auto 1.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: icon-float 3s ease-in-out infinite;
}

@keyframes icon-float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-5px); }
}

.icon-wrapper svg {
  width: 56px;
  height: 56px;
}

.title {
  font-size: 1.75rem;
  font-weight: 800;
  color: var(--text-primary);
  margin-bottom: 0.5rem;
  letter-spacing: -0.02em;
}

.subtitle {
  font-size: 1rem;
  color: var(--text-secondary);
  margin-bottom: 2rem;
  line-height: 1.6;
}

/* Footer */
.card-footer {
  padding: 1rem 2rem 1.75rem;
  text-align: center;
}

.security-badges {
  display: flex;
  justify-content: center;
  gap: 1rem;
  margin-bottom: 1rem;
  flex-wrap: wrap;
}

.security-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.75rem;
  background: rgba(16, 185, 129, 0.08);
  border: 1px solid rgba(16, 185, 129, 0.15);
  border-radius: 100px;
  font-size: 0.7rem;
  font-weight: 500;
  color: #059669;
}

.footer-text {
  font-size: 0.75rem;
  color: var(--text-muted);
}
</style>

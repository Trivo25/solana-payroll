<template>
  <div class="connect-page">
    <!-- Background -->
    <div class="background">
      <div class="gradient-orb orb-1"></div>
      <div class="gradient-orb orb-2"></div>
      <div class="grid-pattern"></div>
    </div>

    <!-- Content -->
    <main class="content">
      <div class="connect-card">
        <div class="card-header">
          <NuxtLink to="/" class="back-link">
            <span class="arrow">&larr;</span>
            <span>Back</span>
          </NuxtLink>
        </div>

        <div class="card-body">
          <div class="icon-wrapper">
            <span class="shield-icon">&#x1F6E1;</span>
          </div>

          <h1 class="title">Connect Wallet</h1>
          <p class="subtitle">
            Connect your Solana wallet to start paying privately
          </p>

          <!-- Wallet connect - client only component -->
          <WalletConnect />
        </div>

        <div class="card-footer">
          <p class="footer-text">
            By connecting, you agree to our Terms of Service
          </p>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
// No wallet code here - it's all in the client component
</script>

<style scoped>
.connect-page {
  min-height: 100vh;
  position: relative;
  overflow: hidden;
}

/* Background */
.background {
  position: absolute;
  inset: 0;
  z-index: 0;
  overflow: hidden;
}

.gradient-orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
  opacity: 0.5;
}

.orb-1 {
  width: 500px;
  height: 500px;
  background: linear-gradient(135deg, var(--secondary) 0%, rgba(16, 185, 129, 0.3) 100%);
  top: -150px;
  right: -100px;
}

.orb-2 {
  width: 400px;
  height: 400px;
  background: linear-gradient(135deg, var(--primary) 0%, rgba(15, 23, 42, 0.4) 100%);
  bottom: -100px;
  left: -100px;
}

.grid-pattern {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(15, 23, 42, 0.03) 1px, transparent 1px),
    linear-gradient(90deg, rgba(15, 23, 42, 0.03) 1px, transparent 1px);
  background-size: 60px 60px;
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
  width: 100%;
  max-width: 440px;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 24px;
  overflow: hidden;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.1);
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
  transition: color 0.2s;
}

.back-link:hover {
  color: var(--text-primary);
}

.arrow {
  font-size: 1.25rem;
}

.card-body {
  padding: 2rem 2rem 1.5rem;
  text-align: center;
}

.icon-wrapper {
  width: 64px;
  height: 64px;
  margin: 0 auto 1.5rem;
  background: linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%);
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.shield-icon {
  font-size: 2rem;
  filter: grayscale(1) brightness(10);
}

.title {
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 0.5rem;
}

.subtitle {
  font-size: 1rem;
  color: var(--text-secondary);
  margin-bottom: 2rem;
}

/* Footer */
.card-footer {
  padding: 1rem 2rem 1.5rem;
  text-align: center;
}

.footer-text {
  font-size: 0.75rem;
  color: var(--text-muted);
}
</style>

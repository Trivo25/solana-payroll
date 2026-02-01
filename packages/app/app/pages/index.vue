<template>
  <div class="landing">
    <!-- Animated background -->
    <div class="background">
      <div class="gradient-mesh"></div>
      <div class="aurora aurora-1"></div>
      <div class="aurora aurora-2"></div>
      <div class="aurora aurora-3"></div>
      <div class="noise"></div>
      <div class="grid-pattern"></div>

      <!-- Floating particles -->
      <div class="particles">
        <div v-for="i in 20" :key="i" class="particle" :style="getParticleStyle(i)"></div>
      </div>
    </div>

    <!-- Navigation -->
    <nav class="nav" :class="{ scrolled: isScrolled }">
      <div class="nav-brand">
        <div class="brand-logo">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <rect width="32" height="32" rx="8" fill="url(#logo-gradient)"/>
            <path d="M16 6L22 12L16 18L10 12L16 6Z" fill="white" fill-opacity="0.9"/>
            <path d="M16 14L22 20L16 26L10 20L16 14Z" fill="white" fill-opacity="0.6"/>
            <defs>
              <linearGradient id="logo-gradient" x1="0" y1="0" x2="32" y2="32">
                <stop stop-color="#10b981"/>
                <stop offset="1" stop-color="#059669"/>
              </linearGradient>
            </defs>
          </svg>
        </div>
        <span class="brand-text">Veil</span>
      </div>
      <div class="nav-links">
        <a href="#features">Features</a>
        <a href="#how-it-works">How it Works</a>
        <a href="#tech">Technology</a>
      </div>
      <NuxtLink to="/connect" class="nav-cta">
        <span>Launch App</span>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M6 3L11 8L6 13" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </NuxtLink>
    </nav>

    <!-- Hero Section -->
    <main class="content">
      <section class="hero">
        <div class="hero-badge" @mouseenter="badgeHover = true" @mouseleave="badgeHover = false">
          <span class="badge-glow"></span>
          <span class="badge-icon">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="7" cy="7" r="6" stroke="currentColor" stroke-width="1.5"/>
              <path d="M7 4V7L9 9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
          </span>
          <span class="badge-text">Built on Solana Token-2022</span>
          <span class="badge-live">
            <span class="live-dot"></span>
            Live
          </span>
        </div>

        <h1 class="title">
          <span class="title-line">
            <span class="word" v-for="(word, i) in ['Private', 'Transactions.']" :key="i" :style="{ animationDelay: `${i * 0.1}s` }">{{ word }}&nbsp;</span>
          </span>
          <span class="title-line title-line-2">
            <span class="word" v-for="(word, i) in ['Programmable', 'Privacy.']" :key="i" :style="{ animationDelay: `${0.2 + i * 0.1}s` }">{{ word }}&nbsp;</span>
          </span>
        </h1>

        <p class="description">
          Your private financial layer on Solana. Send, receive, and automate transactions
          with full confidentiality - like Wise, but on-chain and truly private.
        </p>

        <div class="cta-group">
          <NuxtLink to="/connect" class="btn btn-primary">
            <span class="btn-bg"></span>
            <span class="btn-content">
              <span>Get Started</span>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M7 4L13 10L7 16" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </span>
          </NuxtLink>
          <a href="#how-it-works" class="btn btn-ghost">
            <span>See How It Works</span>
          </a>
        </div>

        <div class="hero-stats">
          <div class="stat" v-for="(stat, i) in stats" :key="i">
            <div class="stat-value">
              <span class="stat-number">{{ stat.value }}</span>
            </div>
            <div class="stat-label">{{ stat.label }}</div>
          </div>
        </div>

        <!-- Scroll indicator -->
        <div class="scroll-indicator">
          <div class="scroll-line"></div>
        </div>
      </section>
    </main>

    <!-- Features Section -->
    <section id="features" class="features-section">
      <div class="section-container">
        <div class="section-header">
          <span class="section-eyebrow">Core Features</span>
          <h2 class="section-title">Your Private Financial Layer</h2>
          <p class="section-subtitle">
            From simple transfers to automated payments - all with full confidentiality and programmable privacy controls.
          </p>
        </div>

        <div class="features-grid">
          <div class="feature-card" v-for="(feature, i) in features" :key="i">
            <div class="feature-icon-wrap">
              <div class="feature-icon" v-html="feature.icon"></div>
            </div>
            <h3>{{ feature.title }}</h3>
            <p>{{ feature.description }}</p>
            <div class="feature-shine"></div>
          </div>
        </div>
      </div>
    </section>

    <!-- How It Works Section -->
    <section id="how-it-works" class="how-section">
      <div class="section-container">
        <div class="section-header">
          <span class="section-eyebrow">How It Works</span>
          <h2 class="section-title">Privacy in Three Steps</h2>
        </div>

        <div class="steps">
          <div class="steps-line"></div>
          <div class="step" v-for="(step, i) in steps" :key="i">
            <div class="step-number">
              <span>{{ i + 1 }}</span>
            </div>
            <div class="step-content">
              <h3>{{ step.title }}</h3>
              <p>{{ step.description }}</p>
              <div class="step-code">
                <code>{{ step.code }}</code>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Technology Section -->
    <section id="tech" class="tech-section">
      <div class="section-container">
        <div class="section-header">
          <span class="section-eyebrow">Technology</span>
          <h2 class="section-title">Real Cryptography. Not Theater.</h2>
          <p class="section-subtitle">
            Built on Solana's Token-2022 confidential transfer extension with production-grade ZK proofs.
          </p>
        </div>

        <div class="tech-grid">
          <div class="tech-card" v-for="(tech, i) in techStack" :key="i">
            <div class="tech-icon" v-html="tech.icon"></div>
            <h4>{{ tech.title }}</h4>
            <p>{{ tech.description }}</p>
          </div>
        </div>

        <div class="proof-showcase">
          <div class="proof-header">
            <h4>ZK Proofs We Generate</h4>
            <div class="proof-badge">Verified On-Chain</div>
          </div>
          <div class="proof-list">
            <div class="proof-item" v-for="proof in proofs" :key="proof">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="7" stroke="currentColor" stroke-width="1.5"/>
                <path d="M5 8L7 10L11 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              <span>{{ proof }}</span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- CTA Section -->
    <section class="cta-section">
      <div class="section-container">
        <div class="cta-card">
          <div class="cta-bg">
            <div class="cta-orb cta-orb-1"></div>
            <div class="cta-orb cta-orb-2"></div>
          </div>
          <div class="cta-content">
            <h2>Ready for Private Finance?</h2>
            <p>Connect your wallet and take control of your financial privacy on Solana.</p>
            <NuxtLink to="/connect" class="btn btn-glow">
              <span class="btn-content">
                <span>Launch Veil</span>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M7 4L13 10L7 16" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </span>
            </NuxtLink>
          </div>
        </div>
      </div>
    </section>

    <!-- Footer -->
    <footer class="footer">
      <div class="footer-content">
        <div class="footer-brand">
          <svg width="24" height="24" viewBox="0 0 32 32" fill="none">
            <rect width="32" height="32" rx="8" fill="url(#logo-gradient-footer)"/>
            <path d="M16 6L22 12L16 18L10 12L16 6Z" fill="white" fill-opacity="0.9"/>
            <path d="M16 14L22 20L16 26L10 20L16 14Z" fill="white" fill-opacity="0.6"/>
            <defs>
              <linearGradient id="logo-gradient-footer" x1="0" y1="0" x2="32" y2="32">
                <stop stop-color="#10b981"/>
                <stop offset="1" stop-color="#059669"/>
              </linearGradient>
            </defs>
          </svg>
          <span>Veil</span>
        </div>
        <div class="footer-links">
          <a href="https://github.com" target="_blank" class="footer-link">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
            </svg>
            GitHub
          </a>
          <span class="footer-divider"></span>
          <span class="footer-built">Built for Solana Hackathon 2025</span>
        </div>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';

const isScrolled = ref(false);
const badgeHover = ref(false);

const stats = [
  { value: '100%', label: 'On-Chain Privacy' },
  { value: '5', label: 'ZK Proofs per Transfer' },
  { value: '<3s', label: 'Proof Generation' },
];

const features = [
  {
    icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>`,
    title: 'Private Transfers',
    description: 'Send and receive tokens without revealing amounts. Your financial activity stays invisible to the public.',
  },
  {
    icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>`,
    title: 'Confidential Balances',
    description: 'Your token balances are encrypted on-chain using ElGamal encryption. Only you can see your true balance.',
  },
  {
    icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`,
    title: 'Private Invoicing',
    description: 'Create and pay invoices with confidential amounts. Link payments to invoices with cryptographic proofs.',
  },
  {
    icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
    title: 'Selective Disclosure',
    description: 'Prove you paid someone, verify amounts are in range, or confirm dates - without revealing everything.',
  },
  {
    icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
    title: 'Programmable Privacy',
    description: 'Schedule recurring payments, set up automated transfers, and build private financial workflows.',
  },
  {
    icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
    title: 'Instant Settlement',
    description: 'Transactions settle in seconds on Solana. No waiting, no intermediaries, no banks.',
  },
];

const steps = [
  {
    title: 'Connect & Enable Privacy',
    description: 'Connect your Solana wallet and enable confidential transfers. We derive encryption keys from your wallet signature - no new keys to manage.',
    code: 'ElGamal keypair derived from wallet.signMessage()',
  },
  {
    title: 'Deposit & Shield',
    description: 'Move tokens from your public balance to your private balance. The amount becomes encrypted and invisible to everyone except you.',
    code: 'Public → Pending → Encrypted Available',
  },
  {
    title: 'Transfer Privately',
    description: 'Send to any address. We generate ZK proofs that verify the transfer is valid without revealing the amount.',
    code: 'Equality + Validity + Range proofs → On-chain verification',
  },
];

const techStack = [
  {
    icon: `<svg width="32" height="32" viewBox="0 0 32 32"><defs><linearGradient id="sol-grad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#00FFA3"/><stop offset="100%" style="stop-color:#DC1FFF"/></linearGradient></defs><circle cx="16" cy="16" r="14" fill="url(#sol-grad)"/><path d="M10 20h12M10 16h12M10 12h12" stroke="white" stroke-width="2" stroke-linecap="round"/></svg>`,
    title: 'Solana Token-2022',
    description: 'Native confidential transfer extension',
  },
  {
    icon: `<svg width="32" height="32" viewBox="0 0 32 32" fill="none"><circle cx="16" cy="16" r="14" stroke="#10b981" stroke-width="2"/><circle cx="16" cy="16" r="6" fill="#10b981"/><path d="M16 2v6M16 24v6M2 16h6M24 16h6" stroke="#10b981" stroke-width="2"/></svg>`,
    title: 'ElGamal Encryption',
    description: 'Additively homomorphic encryption',
  },
  {
    icon: `<svg width="32" height="32" viewBox="0 0 32 32" fill="none"><polygon points="16,4 28,24 4,24" stroke="#10b981" stroke-width="2" fill="none"/><circle cx="16" cy="18" r="4" fill="#10b981"/></svg>`,
    title: 'Pedersen Commitments',
    description: 'Hiding commitments for ZK proofs',
  },
  {
    icon: `<svg width="32" height="32" viewBox="0 0 32 32" fill="none"><rect x="4" y="4" width="24" height="24" rx="4" stroke="#10b981" stroke-width="2"/><path d="M10 16h12M16 10v12" stroke="#10b981" stroke-width="2" stroke-linecap="round"/></svg>`,
    title: 'Sigma Protocols',
    description: 'Bulletproofs-style range proofs',
  },
];

const proofs = [
  'PubkeyValidityProof',
  'CiphertextCommitmentEqualityProof',
  'BatchedGroupedCiphertext3HandlesValidityProof',
  'BatchedRangeProofU64',
  'BatchedRangeProofU128',
];

function getParticleStyle(i: number) {
  const size = 2 + Math.random() * 4;
  return {
    width: `${size}px`,
    height: `${size}px`,
    left: `${Math.random() * 100}%`,
    top: `${Math.random() * 100}%`,
    animationDelay: `${Math.random() * 20}s`,
    animationDuration: `${15 + Math.random() * 20}s`,
  };
}

function handleScroll() {
  isScrolled.value = window.scrollY > 50;
}

onMounted(() => {
  window.addEventListener('scroll', handleScroll);

  // Smooth scroll for anchor links
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const anchor = target.closest('a');
    if (anchor?.getAttribute('href')?.startsWith('#')) {
      e.preventDefault();
      const id = anchor.getAttribute('href')?.slice(1);
      if (id) {
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
      }
    }
  });
});

onUnmounted(() => {
  window.removeEventListener('scroll', handleScroll);
});
</script>

<style scoped>
.landing {
  min-height: 100vh;
  position: relative;
  overflow-x: hidden;
  font-family: 'Satoshi', -apple-system, BlinkMacSystemFont, sans-serif;
  background: #fafafa;
}

/* ============================================
   ANIMATED BACKGROUND
   ============================================ */
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
    radial-gradient(at 40% 20%, rgba(16, 185, 129, 0.08) 0px, transparent 50%),
    radial-gradient(at 80% 0%, rgba(6, 182, 212, 0.06) 0px, transparent 50%),
    radial-gradient(at 0% 50%, rgba(16, 185, 129, 0.05) 0px, transparent 50%),
    radial-gradient(at 80% 50%, rgba(99, 102, 241, 0.04) 0px, transparent 50%),
    radial-gradient(at 0% 100%, rgba(16, 185, 129, 0.06) 0px, transparent 50%);
}

.aurora {
  position: absolute;
  filter: blur(120px);
  opacity: 0.4;
  mix-blend-mode: normal;
}

.aurora-1 {
  width: 60vw;
  height: 60vh;
  background: linear-gradient(180deg, rgba(16, 185, 129, 0.4) 0%, rgba(16, 185, 129, 0) 100%);
  top: -20%;
  right: -10%;
  animation: aurora1 20s ease-in-out infinite;
}

.aurora-2 {
  width: 50vw;
  height: 50vh;
  background: linear-gradient(180deg, rgba(6, 182, 212, 0.3) 0%, rgba(6, 182, 212, 0) 100%);
  top: 30%;
  left: -15%;
  animation: aurora2 25s ease-in-out infinite;
}

.aurora-3 {
  width: 40vw;
  height: 40vh;
  background: linear-gradient(180deg, rgba(99, 102, 241, 0.2) 0%, rgba(99, 102, 241, 0) 100%);
  bottom: -10%;
  right: 20%;
  animation: aurora3 22s ease-in-out infinite;
}

@keyframes aurora1 {
  0%, 100% { transform: translateY(0) rotate(0deg) scale(1); }
  33% { transform: translateY(-30px) rotate(5deg) scale(1.05); }
  66% { transform: translateY(20px) rotate(-3deg) scale(0.95); }
}

@keyframes aurora2 {
  0%, 100% { transform: translateX(0) rotate(0deg); }
  50% { transform: translateX(50px) rotate(-5deg); }
}

@keyframes aurora3 {
  0%, 100% { transform: translate(0, 0) scale(1); }
  50% { transform: translate(-30px, -20px) scale(1.1); }
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
  background: rgba(16, 185, 129, 0.4);
  border-radius: 50%;
  animation: float-particle linear infinite;
}

@keyframes float-particle {
  0% { transform: translateY(100vh) rotate(0deg); opacity: 0; }
  10% { opacity: 1; }
  90% { opacity: 1; }
  100% { transform: translateY(-100vh) rotate(720deg); opacity: 0; }
}

/* ============================================
   NAVIGATION
   ============================================ */
.nav {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 2rem;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.nav.scrolled {
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(20px) saturate(180%);
  border-bottom: 1px solid rgba(15, 23, 42, 0.06);
  padding: 0.75rem 2rem;
}

.nav-brand {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.brand-logo {
  display: flex;
  transition: transform 0.3s ease;
}

.nav-brand:hover .brand-logo {
  transform: rotate(-5deg) scale(1.05);
}

.brand-text {
  font-weight: 700;
  font-size: 1.25rem;
  letter-spacing: -0.02em;
}

.nav-links {
  display: flex;
  gap: 2.5rem;
}

.nav-links a {
  color: #64748b;
  text-decoration: none;
  font-weight: 500;
  font-size: 0.9rem;
  transition: color 0.2s;
  position: relative;
}

.nav-links a::after {
  content: '';
  position: absolute;
  bottom: -4px;
  left: 0;
  width: 0;
  height: 2px;
  background: #10b981;
  transition: width 0.2s ease;
}

.nav-links a:hover {
  color: #0f172a;
}

.nav-links a:hover::after {
  width: 100%;
}

.nav-cta {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 1.25rem;
  background: #0f172a;
  color: white;
  border-radius: 10px;
  text-decoration: none;
  font-weight: 600;
  font-size: 0.875rem;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.nav-cta:hover {
  background: #1e293b;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.15);
}

.nav-cta svg {
  transition: transform 0.2s ease;
}

.nav-cta:hover svg {
  transform: translateX(2px);
}

/* ============================================
   HERO SECTION
   ============================================ */
.content {
  position: relative;
  z-index: 1;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8rem 2rem 6rem;
}

.hero {
  text-align: center;
  max-width: 1000px;
}

.hero-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 0.625rem 0.5rem 1rem;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(16, 185, 129, 0.15);
  border-radius: 100px;
  font-size: 0.8rem;
  font-weight: 500;
  color: #0f172a;
  margin-bottom: 2.5rem;
  position: relative;
  overflow: hidden;
  cursor: default;
  transition: all 0.3s ease;
}

.hero-badge:hover {
  border-color: rgba(16, 185, 129, 0.3);
  transform: translateY(-1px);
}

.badge-glow {
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, transparent, rgba(16, 185, 129, 0.1), transparent);
  transform: translateX(-100%);
  animation: badge-shine 3s ease-in-out infinite;
}

@keyframes badge-shine {
  0% { transform: translateX(-100%); }
  50%, 100% { transform: translateX(100%); }
}

.badge-icon {
  display: flex;
  color: #10b981;
}

.badge-live {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.25rem 0.625rem;
  background: rgba(16, 185, 129, 0.1);
  border-radius: 100px;
  font-size: 0.7rem;
  font-weight: 600;
  color: #059669;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.live-dot {
  width: 6px;
  height: 6px;
  background: #10b981;
  border-radius: 50%;
  animation: pulse-dot 2s ease-in-out infinite;
}

@keyframes pulse-dot {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(0.8); }
}

.title {
  font-size: clamp(3rem, 9vw, 5.5rem);
  font-weight: 800;
  letter-spacing: -0.04em;
  line-height: 1.05;
  margin-bottom: 1.75rem;
}

.title-line {
  display: block;
}

.title-line-2 {
  color: #64748b;
}

.word {
  display: inline-block;
  animation: word-reveal 0.6s cubic-bezier(0.4, 0, 0.2, 1) forwards;
  opacity: 0;
  transform: translateY(20px);
}

@keyframes word-reveal {
  to { opacity: 1; transform: translateY(0); }
}

.description {
  font-size: 1.25rem;
  color: #64748b;
  line-height: 1.7;
  max-width: 640px;
  margin: 0 auto 3rem;
  animation: fade-up 0.6s 0.4s cubic-bezier(0.4, 0, 0.2, 1) forwards;
  opacity: 0;
}

@keyframes fade-up {
  to { opacity: 1; }
}

.cta-group {
  display: flex;
  gap: 1rem;
  justify-content: center;
  flex-wrap: wrap;
  margin-bottom: 4rem;
  animation: fade-up 0.6s 0.5s cubic-bezier(0.4, 0, 0.2, 1) forwards;
  opacity: 0;
}

.btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
  font-weight: 600;
  border-radius: 14px;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  border: none;
  font-family: inherit;
  text-decoration: none;
  overflow: hidden;
}

.btn-primary {
  padding: 0;
  background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
  color: white;
}

.btn-primary .btn-bg {
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  opacity: 0;
  transition: opacity 0.3s ease;
}

.btn-primary:hover .btn-bg {
  opacity: 1;
}

.btn-content {
  position: relative;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 1.125rem 1.75rem;
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 20px 40px rgba(15, 23, 42, 0.2);
}

.btn-primary svg {
  transition: transform 0.2s ease;
}

.btn-primary:hover svg {
  transform: translateX(3px);
}

.btn-ghost {
  padding: 1.125rem 1.75rem;
  background: transparent;
  color: #0f172a;
  border: 1.5px solid rgba(15, 23, 42, 0.15);
}

.btn-ghost:hover {
  background: rgba(15, 23, 42, 0.03);
  border-color: rgba(15, 23, 42, 0.25);
  transform: translateY(-2px);
}

/* Hero Stats */
.hero-stats {
  display: inline-flex;
  align-items: center;
  gap: 3rem;
  padding: 1.5rem 2.5rem;
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(15, 23, 42, 0.06);
  border-radius: 20px;
  animation: fade-up 0.6s 0.6s cubic-bezier(0.4, 0, 0.2, 1) forwards;
  opacity: 0;
}

.stat {
  text-align: center;
}

.stat-value {
  font-size: 2rem;
  font-weight: 800;
  background: linear-gradient(135deg, #0f172a 0%, #10b981 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  letter-spacing: -0.02em;
}

.stat-label {
  font-size: 0.75rem;
  color: #64748b;
  margin-top: 0.25rem;
  font-weight: 500;
}

/* Scroll Indicator */
.scroll-indicator {
  position: absolute;
  bottom: 2rem;
  left: 50%;
  transform: translateX(-50%);
  animation: fade-up 0.6s 0.8s cubic-bezier(0.4, 0, 0.2, 1) forwards;
  opacity: 0;
}

.scroll-line {
  width: 1px;
  height: 60px;
  background: linear-gradient(to bottom, #10b981, transparent);
  animation: scroll-pulse 2s ease-in-out infinite;
}

@keyframes scroll-pulse {
  0%, 100% { opacity: 0.3; transform: scaleY(0.7); }
  50% { opacity: 1; transform: scaleY(1); }
}

/* ============================================
   SECTIONS
   ============================================ */
.section-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 2rem;
}

.section-header {
  text-align: center;
  margin-bottom: 4rem;
}

.section-eyebrow {
  display: inline-block;
  padding: 0.375rem 1rem;
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(6, 182, 212, 0.1) 100%);
  border: 1px solid rgba(16, 185, 129, 0.15);
  border-radius: 100px;
  font-size: 0.75rem;
  font-weight: 600;
  color: #059669;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: 1.25rem;
}

.section-title {
  font-size: clamp(2rem, 5vw, 3.25rem);
  font-weight: 800;
  color: #0f172a;
  letter-spacing: -0.03em;
  margin-bottom: 1rem;
}

.section-subtitle {
  font-size: 1.125rem;
  color: #64748b;
  max-width: 560px;
  margin: 0 auto;
  line-height: 1.7;
}

/* ============================================
   FEATURES SECTION
   ============================================ */
.features-section {
  position: relative;
  z-index: 1;
  padding: 8rem 0;
}

.features-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
  gap: 1.25rem;
}

.feature-card {
  position: relative;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(15, 23, 42, 0.06);
  border-radius: 20px;
  padding: 2rem;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
}

.feature-card::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.03) 0%, rgba(6, 182, 212, 0.02) 100%);
  opacity: 0;
  transition: opacity 0.4s ease;
}

.feature-card:hover::before {
  opacity: 1;
}

.feature-card:hover {
  transform: translateY(-4px);
  border-color: rgba(16, 185, 129, 0.2);
  box-shadow:
    0 20px 40px rgba(16, 185, 129, 0.08),
    0 0 0 1px rgba(16, 185, 129, 0.1);
}

.feature-shine {
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.4), transparent);
  transition: left 0.6s ease;
}

.feature-card:hover .feature-shine {
  left: 100%;
}

.feature-icon-wrap {
  width: 48px;
  height: 48px;
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(6, 182, 212, 0.1) 100%);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 1.25rem;
  color: #10b981;
  position: relative;
  z-index: 1;
}

.feature-card h3 {
  font-size: 1.125rem;
  font-weight: 700;
  margin-bottom: 0.625rem;
  color: #0f172a;
  letter-spacing: -0.01em;
  position: relative;
  z-index: 1;
}

.feature-card p {
  color: #64748b;
  line-height: 1.65;
  font-size: 0.925rem;
  position: relative;
  z-index: 1;
}

/* ============================================
   HOW IT WORKS SECTION
   ============================================ */
.how-section {
  position: relative;
  z-index: 1;
  padding: 8rem 0;
  background: linear-gradient(180deg, transparent 0%, rgba(16, 185, 129, 0.02) 50%, transparent 100%);
}

.steps {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  max-width: 720px;
  margin: 0 auto;
}

.steps-line {
  position: absolute;
  left: 28px;
  top: 60px;
  bottom: 60px;
  width: 2px;
  background: linear-gradient(to bottom, #10b981, rgba(16, 185, 129, 0.2));
  border-radius: 1px;
}

.step {
  display: flex;
  gap: 1.75rem;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(15, 23, 42, 0.06);
  border-radius: 20px;
  padding: 2rem;
  transition: all 0.3s ease;
}

.step:hover {
  border-color: rgba(16, 185, 129, 0.2);
  box-shadow: 0 10px 40px rgba(16, 185, 129, 0.06);
}

.step-number {
  width: 56px;
  height: 56px;
  background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
  color: white;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
  font-weight: 700;
  flex-shrink: 0;
  position: relative;
  z-index: 1;
}

.step-content h3 {
  font-size: 1.25rem;
  font-weight: 700;
  margin-bottom: 0.5rem;
  color: #0f172a;
  letter-spacing: -0.01em;
}

.step-content p {
  color: #64748b;
  line-height: 1.65;
  margin-bottom: 1rem;
}

.step-code {
  display: inline-block;
  background: linear-gradient(135deg, rgba(15, 23, 42, 0.04) 0%, rgba(16, 185, 129, 0.04) 100%);
  border: 1px solid rgba(15, 23, 42, 0.06);
  border-radius: 10px;
  padding: 0.75rem 1rem;
}

.step-code code {
  font-family: 'IBM Plex Mono', monospace;
  font-size: 0.8rem;
  color: #059669;
}

/* ============================================
   TECHNOLOGY SECTION
   ============================================ */
.tech-section {
  position: relative;
  z-index: 1;
  padding: 8rem 0;
}

.tech-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1.25rem;
  margin-bottom: 2.5rem;
}

.tech-card {
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(15, 23, 42, 0.06);
  border-radius: 16px;
  padding: 1.75rem;
  text-align: center;
  transition: all 0.3s ease;
}

.tech-card:hover {
  border-color: rgba(16, 185, 129, 0.2);
  transform: translateY(-2px);
}

.tech-icon {
  width: 48px;
  height: 48px;
  margin: 0 auto 1rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.tech-card h4 {
  font-size: 1rem;
  font-weight: 700;
  margin-bottom: 0.375rem;
  color: #0f172a;
}

.tech-card p {
  font-size: 0.85rem;
  color: #64748b;
}

.proof-showcase {
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(15, 23, 42, 0.06);
  border-radius: 24px;
  padding: 2.5rem;
}

.proof-header {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  margin-bottom: 2rem;
  flex-wrap: wrap;
}

.proof-header h4 {
  font-size: 1.125rem;
  font-weight: 700;
  color: #0f172a;
}

.proof-badge {
  padding: 0.375rem 0.875rem;
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  border-radius: 100px;
  font-size: 0.7rem;
  font-weight: 600;
  color: white;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.proof-list {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.625rem;
}

.proof-item {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 1rem;
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(6, 182, 212, 0.05) 100%);
  border: 1px solid rgba(16, 185, 129, 0.12);
  border-radius: 100px;
  font-family: 'IBM Plex Mono', monospace;
  font-size: 0.75rem;
  color: #059669;
  font-weight: 500;
}

.proof-item svg {
  flex-shrink: 0;
}

/* ============================================
   CTA SECTION
   ============================================ */
.cta-section {
  position: relative;
  z-index: 1;
  padding: 6rem 0 8rem;
}

.cta-card {
  position: relative;
  border-radius: 32px;
  padding: 5rem 3rem;
  text-align: center;
  overflow: hidden;
  background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
}

.cta-bg {
  position: absolute;
  inset: 0;
  overflow: hidden;
}

.cta-orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
}

.cta-orb-1 {
  width: 400px;
  height: 400px;
  background: rgba(16, 185, 129, 0.3);
  top: -100px;
  right: -50px;
  animation: cta-float 15s ease-in-out infinite;
}

.cta-orb-2 {
  width: 300px;
  height: 300px;
  background: rgba(6, 182, 212, 0.2);
  bottom: -50px;
  left: -50px;
  animation: cta-float 18s ease-in-out infinite reverse;
}

@keyframes cta-float {
  0%, 100% { transform: translate(0, 0) scale(1); }
  50% { transform: translate(30px, -20px) scale(1.1); }
}

.cta-content {
  position: relative;
  z-index: 1;
}

.cta-card h2 {
  font-size: clamp(2rem, 5vw, 3rem);
  font-weight: 800;
  color: white;
  margin-bottom: 1rem;
  letter-spacing: -0.02em;
}

.cta-card p {
  font-size: 1.125rem;
  color: rgba(255, 255, 255, 0.7);
  margin-bottom: 2.5rem;
  max-width: 500px;
  margin-left: auto;
  margin-right: auto;
}

.btn-glow {
  display: inline-flex;
  padding: 0;
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;
  border-radius: 14px;
  position: relative;
}

.btn-glow::before {
  content: '';
  position: absolute;
  inset: -2px;
  background: linear-gradient(135deg, #10b981 0%, #06b6d4 100%);
  border-radius: 16px;
  z-index: -1;
  opacity: 0.5;
  filter: blur(12px);
  transition: opacity 0.3s ease;
}

.btn-glow:hover::before {
  opacity: 0.8;
}

.btn-glow .btn-content {
  padding: 1.25rem 2.5rem;
}

.btn-glow:hover {
  transform: translateY(-2px);
}

.btn-glow svg {
  transition: transform 0.2s ease;
}

.btn-glow:hover svg {
  transform: translateX(3px);
}

/* ============================================
   FOOTER
   ============================================ */
.footer {
  position: relative;
  z-index: 1;
  padding: 2rem;
  border-top: 1px solid rgba(15, 23, 42, 0.06);
}

.footer-content {
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 1.5rem;
}

.footer-brand {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  font-weight: 700;
  font-size: 1.1rem;
  color: #0f172a;
}

.footer-brand svg {
  width: 28px;
  height: 28px;
}

.footer-links {
  display: flex;
  align-items: center;
  gap: 1.25rem;
  font-size: 0.875rem;
  color: #64748b;
}

.footer-link {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  color: #64748b;
  text-decoration: none;
  transition: color 0.2s;
}

.footer-link:hover {
  color: #0f172a;
}

.footer-divider {
  width: 1px;
  height: 16px;
  background: rgba(15, 23, 42, 0.1);
}

.footer-built {
  color: #94a3b8;
}

/* ============================================
   RESPONSIVE
   ============================================ */
@media (max-width: 768px) {
  .nav-links {
    display: none;
  }

  .hero-stats {
    flex-direction: column;
    gap: 1.5rem;
    padding: 1.5rem;
  }

  .steps-line {
    display: none;
  }

  .step {
    flex-direction: column;
    gap: 1.25rem;
  }

  .features-grid {
    grid-template-columns: 1fr;
  }

  .cta-card {
    padding: 3rem 1.5rem;
  }

  .footer-content {
    flex-direction: column;
    text-align: center;
  }
}
</style>

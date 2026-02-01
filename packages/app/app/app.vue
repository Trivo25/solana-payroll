<template>
  <div class="app">
    <NuxtRouteAnnouncer />
    <NuxtPage />
  </div>
</template>

<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');

/* Modern Veil Palette */
:root {
  --primary: #0f172a;
  --secondary: #10b981;
  --accent: #06b6d4;
  --background: #fafafa;
  --surface: rgba(255, 255, 255, 0.9);
  --surface-hover: rgba(255, 255, 255, 1);
  --border: rgba(15, 23, 42, 0.06);
  --border-hover: rgba(16, 185, 129, 0.2);
  --text-primary: #0f172a;
  --text-secondary: #64748b;
  --text-muted: #94a3b8;
  --success: #10b981;
  --warning: #f59e0b;
  --error: #ef4444;
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-xl: 20px;
  --radius-2xl: 24px;
  --shadow-sm: 0 1px 2px rgba(15, 23, 42, 0.04);
  --shadow-md: 0 4px 12px rgba(15, 23, 42, 0.08);
  --shadow-lg: 0 12px 40px rgba(15, 23, 42, 0.12);
  --shadow-glow: 0 0 40px rgba(16, 185, 129, 0.15);
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  background-color: var(--background);
  color: var(--text-primary);
  min-height: 100vh;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  font-feature-settings: 'cv02', 'cv03', 'cv04', 'cv11';
}

.app {
  min-height: 100vh;
}

/* Mono font for addresses, hashes, etc */
.mono {
  font-family: 'JetBrains Mono', 'Roboto Mono', monospace;
}

/* Common button styles */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  font-size: 0.9rem;
  font-weight: 600;
  font-family: inherit;
  border-radius: var(--radius-md);
  border: none;
  cursor: pointer;
  text-decoration: none;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background: linear-gradient(135deg, var(--primary) 0%, #1e293b 100%);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: var(--shadow-lg);
}

.btn-secondary {
  background: var(--secondary);
  color: white;
}

.btn-secondary:hover:not(:disabled) {
  background: #059669;
  transform: translateY(-1px);
}

.btn-ghost {
  background: transparent;
  color: var(--text-primary);
  border: 1.5px solid var(--border);
}

.btn-ghost:hover:not(:disabled) {
  background: rgba(15, 23, 42, 0.03);
  border-color: rgba(15, 23, 42, 0.15);
}

.btn-danger {
  background: rgba(239, 68, 68, 0.1);
  color: var(--error);
}

.btn-danger:hover:not(:disabled) {
  background: rgba(239, 68, 68, 0.15);
}

.btn-sm {
  padding: 0.5rem 1rem;
  font-size: 0.8rem;
}

.btn-lg {
  padding: 1rem 2rem;
  font-size: 1rem;
}

.btn-tiny {
  padding: 0.25rem 0.5rem !important;
  font-size: 0.7rem !important;
  border-radius: 6px !important;
}

/* Common card styles */
.card {
  background: var(--surface);
  backdrop-filter: blur(20px);
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.card:hover {
  border-color: var(--border-hover);
  box-shadow: var(--shadow-md);
}

/* Form inputs */
input, textarea, select {
  font-family: inherit;
  font-size: 1rem;
  padding: 0.75rem 1rem;
  background: white;
  border: 1.5px solid var(--border);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  transition: all 0.2s ease;
  width: 100%;
}

input:focus, textarea:focus, select:focus {
  outline: none;
  border-color: var(--secondary);
  box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1);
}

input::placeholder, textarea::placeholder {
  color: var(--text-muted);
}

/* Labels */
label {
  display: block;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-secondary);
  margin-bottom: 0.5rem;
}

/* Scrollbar styling */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: rgba(15, 23, 42, 0.15);
  border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
  background: rgba(15, 23, 42, 0.25);
}

/* Selection */
::selection {
  background: rgba(16, 185, 129, 0.2);
  color: var(--text-primary);
}

/* Animations */
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideUp {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.animate-fade-in {
  animation: fadeIn 0.3s ease forwards;
}

.animate-slide-up {
  animation: slideUp 0.4s cubic-bezier(0.4, 0, 0.2, 1) forwards;
}

/* Loading spinner */
.spinner {
  width: 20px;
  height: 20px;
  border: 2px solid var(--border);
  border-top-color: var(--secondary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

/* Badge styles */
.badge {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.25rem 0.75rem;
  font-size: 0.75rem;
  font-weight: 600;
  border-radius: 100px;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.badge-success {
  background: rgba(16, 185, 129, 0.1);
  color: var(--success);
}

.badge-warning {
  background: rgba(245, 158, 11, 0.1);
  color: var(--warning);
}

.badge-error {
  background: rgba(239, 68, 68, 0.1);
  color: var(--error);
}

.badge-neutral {
  background: rgba(15, 23, 42, 0.05);
  color: var(--text-secondary);
}
</style>

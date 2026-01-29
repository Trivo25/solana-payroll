/**
 * Buffer polyfill for SSR
 *
 * Ensures Buffer is available during server-side rendering.
 * Node.js has Buffer natively, but we ensure globalThis.Buffer is set.
 */

import { Buffer } from 'buffer'

export default defineNuxtPlugin(() => {
  // Ensure Buffer is available globally during SSR
  if (typeof globalThis.Buffer === 'undefined') {
    globalThis.Buffer = Buffer
  }
})

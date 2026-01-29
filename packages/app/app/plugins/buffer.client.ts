/**
 * Buffer polyfill for browser
 *
 * Many Solana libraries use Node.js Buffer which doesn't exist in browsers.
 * This plugin provides a global Buffer polyfill.
 */

import { Buffer } from 'buffer'

export default defineNuxtPlugin(() => {
  // Make Buffer available globally on client
  window.Buffer = Buffer
  globalThis.Buffer = Buffer
})

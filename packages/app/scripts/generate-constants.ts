/**
 * Generate Constants Script
 *
 * This script generates all the cryptographic constants needed for
 * confidential transfers and outputs them in a format ready to paste
 * into the app config.
 *
 * Run: npx tsx scripts/generate-constants.ts
 */

import { Keypair } from '@solana/web3.js';
import * as zkSdk from '@solana/zk-sdk/node';

async function main() {
  console.log('Generating constants using ZK SDK...');
  console.log('\n=== GENERATED CONSTANTS ===\n');

  // 1. Generate a random mint keypair (for mint authority)
  const mintKeypair = Keypair.generate();
  console.log('// Mint Keypair (use as mint authority)');
  console.log('// Public Key:', mintKeypair.publicKey.toBase58());
  console.log('const MINT_SECRET_KEY = new Uint8Array([');
  console.log('  ' + Array.from(mintKeypair.secretKey).join(', '));
  console.log(']);');
  console.log('');

  // 2. Generate auditor ElGamal keypair using the SDK
  const auditorKeypair = new zkSdk.ElGamalKeypair();
  const auditorPubkey = auditorKeypair.pubkey();
  const auditorPubkeyBytes = auditorPubkey.toBytes();
  const auditorSecretBytes = auditorKeypair.secret().toBytes();

  console.log('// Auditor ElGamal Public Key (32 bytes)');
  console.log('// This is a valid Ristretto curve point');
  console.log('const AUDITOR_ELGAMAL_PUBKEY = new Uint8Array([');
  const pubkeyHex = Array.from(auditorPubkeyBytes).map(b => '0x' + b.toString(16).padStart(2, '0'));
  // Format in rows of 8
  for (let i = 0; i < pubkeyHex.length; i += 8) {
    const row = pubkeyHex.slice(i, i + 8).join(', ');
    console.log('  ' + row + (i + 8 < pubkeyHex.length ? ',' : ''));
  }
  console.log(']);');
  console.log('');

  console.log('// Auditor ElGamal Secret Key (32 bytes) - KEEP SECRET, only needed for auditing');
  console.log('const AUDITOR_ELGAMAL_SECRET = new Uint8Array([');
  const secretHex = Array.from(auditorSecretBytes).map(b => '0x' + b.toString(16).padStart(2, '0'));
  for (let i = 0; i < secretHex.length; i += 8) {
    const row = secretHex.slice(i, i + 8).join(', ');
    console.log('  ' + row + (i + 8 < secretHex.length ? ',' : ''));
  }
  console.log(']);');
  console.log('');

  // Verify the pubkey can be parsed back
  console.log('// Verification:');
  const parsed = zkSdk.ElGamalPubkey.fromBytes(auditorPubkeyBytes);
  if (parsed) {
    console.log('// ✓ Auditor pubkey bytes can be parsed back successfully');
  } else {
    console.log('// ✗ ERROR: Auditor pubkey bytes failed to parse!');
  }

  console.log('\n=== COPY THE ABOVE INTO YOUR CONFIG ===\n');

  // Also output a simple JSON for reference
  console.log('JSON format (for reference):');
  console.log(JSON.stringify({
    mintPublicKey: mintKeypair.publicKey.toBase58(),
    mintSecretKey: Array.from(mintKeypair.secretKey),
    auditorPubkey: Array.from(auditorPubkeyBytes),
    auditorSecret: Array.from(auditorSecretBytes),
  }, null, 2));
}

main().catch(console.error);

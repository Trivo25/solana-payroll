/**
 * Ristretto point arithmetic for homomorphic ElGamal operations
 *
 * Ported from scripts/confidential-transfer/crypto.ts
 *
 * ElGamal ciphertext structure:
 * - 32 bytes: Pedersen commitment (Ristretto point)
 * - 32 bytes: decrypt handle (Ristretto point)
 */

import { RistrettoPoint } from '@noble/curves/ed25519';

/**
 * Ciphertext components (commitment + handle)
 */
export interface CiphertextComponents {
  commitment: Uint8Array;
  handle: Uint8Array;
}

/**
 * Parse an ElGamal ciphertext into its commitment and handle components
 */
export function parseCiphertext(ciphertextBytes: Uint8Array): CiphertextComponents {
  if (ciphertextBytes.length !== 64) {
    throw new Error(
      `Invalid ciphertext length: ${ciphertextBytes.length}, expected 64`,
    );
  }
  return {
    commitment: ciphertextBytes.slice(0, 32),
    handle: ciphertextBytes.slice(32, 64),
  };
}

/**
 * Combine commitment and handle back into ciphertext bytes
 */
export function combineCiphertext(components: CiphertextComponents): Uint8Array {
  const result = new Uint8Array(64);
  result.set(components.commitment, 0);
  result.set(components.handle, 32);
  return result;
}

/**
 * Subtract two Ristretto points (P1 - P2)
 */
export function subtractPoints(
  p1Bytes: Uint8Array,
  p2Bytes: Uint8Array,
): Uint8Array {
  const p1 = RistrettoPoint.fromBytes(p1Bytes);
  const p2 = RistrettoPoint.fromBytes(p2Bytes);
  const result = p1.subtract(p2);
  return result.toBytes();
}

/**
 * Add two Ristretto points (P1 + P2)
 */
export function addPoints(p1Bytes: Uint8Array, p2Bytes: Uint8Array): Uint8Array {
  const p1 = RistrettoPoint.fromBytes(p1Bytes);
  const p2 = RistrettoPoint.fromBytes(p2Bytes);
  const result = p1.add(p2);
  return result.toBytes();
}

/**
 * Scalar multiply a Ristretto point (scalar * P)
 */
export function scalarMultiply(pointBytes: Uint8Array, scalar: bigint): Uint8Array {
  const point = RistrettoPoint.fromBytes(pointBytes);
  const result = point.multiply(scalar);
  return result.toBytes();
}

/**
 * Homomorphic subtraction of ElGamal ciphertexts: C1 - C2
 * For ElGamal: (commitment1 - commitment2, handle1 - handle2)
 */
export function subtractCiphertexts(
  c1Bytes: Uint8Array,
  c2Bytes: Uint8Array,
): Uint8Array {
  const c1 = parseCiphertext(c1Bytes);
  const c2 = parseCiphertext(c2Bytes);

  return combineCiphertext({
    commitment: subtractPoints(c1.commitment, c2.commitment),
    handle: subtractPoints(c1.handle, c2.handle),
  });
}

/**
 * Homomorphic addition of ElGamal ciphertexts: C1 + C2
 */
export function addCiphertexts(
  c1Bytes: Uint8Array,
  c2Bytes: Uint8Array,
): Uint8Array {
  const c1 = parseCiphertext(c1Bytes);
  const c2 = parseCiphertext(c2Bytes);

  return combineCiphertext({
    commitment: addPoints(c1.commitment, c2.commitment),
    handle: addPoints(c1.handle, c2.handle),
  });
}

/**
 * Scalar multiply a ciphertext: scalar * C
 */
export function scalarMultiplyCiphertext(
  ciphertextBytes: Uint8Array,
  scalar: bigint,
): Uint8Array {
  const c = parseCiphertext(ciphertextBytes);

  return combineCiphertext({
    commitment: scalarMultiply(c.commitment, scalar),
    handle: scalarMultiply(c.handle, scalar),
  });
}

/**
 * Combine lo and hi ciphertexts: lo + (hi << shift_bits)
 * This replicates try_combine_lo_hi_ciphertexts from Rust
 */
export function combineLowHighCiphertexts(
  loBytes: Uint8Array,
  hiBytes: Uint8Array,
  shiftBits: number,
): Uint8Array {
  // hi_scaled = hi * 2^shiftBits
  const hiScaled = scalarMultiplyCiphertext(
    hiBytes,
    BigInt(1) << BigInt(shiftBits),
  );
  // combined = lo + hi_scaled
  return addCiphertexts(loBytes, hiScaled);
}

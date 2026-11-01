/**
 * Universal Crypto Utilities for Browser & Node environments.
 * Uses `@noble/hashes` (0-dependency, pure JS, audited) for SHA-256 and HMAC-SHA256,
 * and Web Crypto API / window.crypto for CSPRNG random generation.
 * This guarantees 100% interoperability between Node.js test runner and browser/Electron renderer
 * without invoking Node's native `require('crypto')` in browser bundles.
 */

import { sha256 as nobleSha256 } from '@noble/hashes/sha2.js';
import { hmac as nobleHmac } from '@noble/hashes/hmac.js';
import { bytesToHex, utf8ToBytes, randomBytes as nobleRandomBytes } from '@noble/hashes/utils.js';

export function cryptoSha256Hex(data: string): string {
  return bytesToHex(nobleSha256(utf8ToBytes(data)));
}

export function cryptoHmacSha256Hex(secret: string, payload: string): string {
  return bytesToHex(nobleHmac(nobleSha256, utf8ToBytes(secret), utf8ToBytes(payload)));
}

export function cryptoRandomHex(byteCount: number): string {
  return bytesToHex(nobleRandomBytes(byteCount));
}

export function cryptoRandomInt(min: number, max: number): number {
  if (typeof window !== 'undefined' && window.crypto && typeof window.crypto.getRandomValues === 'function') {
    const arr = new Uint32Array(1);
    window.crypto.getRandomValues(arr);
    const range = max - min;
    return min + (arr[0] % range);
  }
  const bytes = nobleRandomBytes(4);
  const val = (bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3];
  const positiveVal = val >>> 0;
  return min + (positiveVal % (max - min));
}

export function cryptoConstantTimeEqual(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;

  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

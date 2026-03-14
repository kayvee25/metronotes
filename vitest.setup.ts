import '@testing-library/jest-dom/vitest';
import { webcrypto } from 'crypto';

// jsdom's crypto.subtle has compatibility issues with ArrayBuffer.
// Use Node's webcrypto implementation instead.
if (!globalThis.crypto?.subtle) {
  Object.defineProperty(globalThis, 'crypto', {
    value: webcrypto,
  });
} else if (!globalThis.crypto.subtle.digest) {
  Object.defineProperty(globalThis.crypto, 'subtle', {
    value: webcrypto.subtle,
  });
}

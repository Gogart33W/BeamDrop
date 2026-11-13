import { describe, it, expect } from 'vitest';
import {
  encodeBinaryChunk,
  decodeBinaryChunk,
  CHUNK_SIZE
} from '../../client/src/utils/chunker.js';

describe('Chunker binary protocol', () => {
  it('correctly encodes and decodes a binary chunk', () => {
    const transferId = '550e8400-e29b-41d4-a716-446655440000';
    const chunkIndex = 42;
    const testPayload = new TextEncoder().encode('Hello P2P World! 🚀').buffer;

    const encoded = encodeBinaryChunk(transferId, chunkIndex, testPayload);
    expect(encoded.byteLength).toBe(40 + testPayload.byteLength);

    const decoded = decodeBinaryChunk(encoded);
    expect(decoded).not.toBeNull();
    expect(decoded!.transferId).toBe(transferId);
    expect(decoded!.chunkIndex).toBe(chunkIndex);

    const decodedText = new TextDecoder().decode(decoded!.payload);
    expect(decodedText).toBe('Hello P2P World! 🚀');
  });

  it('handles short transferIds by padding safely', () => {
    const shortId = 'abc-123';
    const payload = new Uint8Array([1, 2, 3, 4, 5]).buffer;

    const encoded = encodeBinaryChunk(shortId, 0, payload);
    const decoded = decodeBinaryChunk(encoded);

    expect(decoded?.transferId).toBe(shortId);
    expect(decoded?.chunkIndex).toBe(0);
    expect(new Uint8Array(decoded!.payload)).toEqual(new Uint8Array([1, 2, 3, 4, 5]));
  });

  it('rejects buffers shorter than minimum header (40 bytes)', () => {
    const tooShort = new ArrayBuffer(20);
    const decoded = decodeBinaryChunk(tooShort);
    expect(decoded).toBeNull();
  });

  it('supports max chunk size (64 KB)', () => {
    const transferId = 'test-transfer-id-12345';
    const largeBuffer = new ArrayBuffer(CHUNK_SIZE);
    const view = new Uint8Array(largeBuffer);
    view[0] = 0xAA;
    view[CHUNK_SIZE - 1] = 0xBB;

    const encoded = encodeBinaryChunk(transferId, 999, largeBuffer);
    const decoded = decodeBinaryChunk(encoded);

    expect(decoded).not.toBeNull();
    expect(decoded!.chunkIndex).toBe(999);
    expect(decoded!.payload.byteLength).toBe(CHUNK_SIZE);

    const decodedView = new Uint8Array(decoded!.payload);
    expect(decodedView[0]).toBe(0xAA);
    expect(decodedView[CHUNK_SIZE - 1]).toBe(0xBB);
  });
});

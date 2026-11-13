import { describe, it, expect } from 'vitest';
import { FileAssembler } from '../../client/src/utils/fileAssembler.js';
import { encodeBinaryChunk, FileMetaMessage } from '../../client/src/utils/chunker.js';

describe('FileAssembler', () => {
  it('correctly collects chunks out-of-order and reassembles a file', async () => {
    const assembler = new FileAssembler();
    const transferId = 'transfer-test-1';

    const part1 = new TextEncoder().encode('Part 1: Hello ');
    const part2 = new TextEncoder().encode('Part 2: Streamed ');
    const part3 = new TextEncoder().encode('Part 3: Chunks!');

    const fullExpected = 'Part 1: Hello Part 2: Streamed Part 3: Chunks!';
    const totalSize = part1.byteLength + part2.byteLength + part3.byteLength;

    const meta: FileMetaMessage = {
      type: 'file-meta',
      transferId,
      name: 'hello.txt',
      size: totalSize,
      mimeType: 'text/plain',
      totalChunks: 3,
      chunkSize: 64
    };

    assembler.registerTransfer(meta);

    // Ingest chunks in non-sequential order (chunk 2, chunk 0, chunk 1)
    let progressUpdates: number[] = [];
    const onProgress = (_id: string, _received: number, _spd: number, _eta: number, progress: number) => {
      progressUpdates.push(progress);
    };

    const chunk2 = encodeBinaryChunk(transferId, 2, part3.buffer);
    const chunk0 = encodeBinaryChunk(transferId, 0, part1.buffer);
    const chunk1 = encodeBinaryChunk(transferId, 1, part2.buffer);

    assembler.processChunk(chunk2, onProgress);
    assembler.processChunk(chunk0, onProgress);
    assembler.processChunk(chunk1, onProgress);

    const finalized = assembler.finalizeTransfer(transferId);
    expect(finalized).not.toBeNull();
    expect(finalized!.meta.name).toBe('hello.txt');

    const resultBuffer = await finalized!.blob.arrayBuffer();
    const resultText = new TextDecoder().decode(resultBuffer);
    expect(resultText).toBe(fullExpected);
  });

  it('safely handles cancellations', () => {
    const assembler = new FileAssembler();
    const transferId = 'cancel-id';

    assembler.registerTransfer({
      type: 'file-meta',
      transferId,
      name: 'cancelled.bin',
      size: 1000,
      mimeType: 'application/octet-stream',
      totalChunks: 10,
      chunkSize: 100
    });

    assembler.cancelTransfer(transferId);
    const result = assembler.finalizeTransfer(transferId);
    expect(result).toBeNull();
  });
});

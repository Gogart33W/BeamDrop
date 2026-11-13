export const CHUNK_SIZE = 64 * 1024; // 64 KB per chunk
export const BUFFER_THRESHOLD = 1024 * 1024; // 1 MB backpressure threshold
export const MAX_BUFFER_AMOUNT = 2 * 1024 * 1024; // 2 MB maximum queued buffer

export interface FileMetaMessage {
  type: 'file-meta';
  transferId: string;
  name: string;
  size: number;
  mimeType: string;
  totalChunks: number;
  chunkSize: number;
}

export interface FileChunkHeader {
  transferId: string;
  chunkIndex: number;
  data: ArrayBuffer;
}

export interface FileCancelMessage {
  type: 'file-cancel';
  transferId: string;
  reason?: string;
}

export interface FileCompleteMessage {
  type: 'file-complete';
  transferId: string;
}

/**
 * Creates a binary packet: [36 bytes UUID][4 bytes chunkIndex (Uint32)][payload bytes]
 */
export function encodeBinaryChunk(transferId: string, chunkIndex: number, payload: ArrayBuffer): ArrayBuffer {
  const enc = new TextEncoder();
  const idBytes = enc.encode(transferId.padEnd(36, ' ').slice(0, 36));

  const buffer = new ArrayBuffer(40 + payload.byteLength);
  const uint8 = new Uint8Array(buffer);
  const dataView = new DataView(buffer);

  // 0..35: Transfer ID
  uint8.set(idBytes, 0);
  // 36..39: Chunk Index (Big Endian uint32)
  dataView.setUint32(36, chunkIndex, false);
  // 40..end: Chunk payload
  uint8.set(new Uint8Array(payload), 40);

  return buffer;
}

/**
 * Decodes a binary packet into header and payload.
 */
export function decodeBinaryChunk(buffer: ArrayBuffer): { transferId: string; chunkIndex: number; payload: ArrayBuffer } | null {
  if (buffer.byteLength < 40) return null;

  const dataView = new DataView(buffer);
  const dec = new TextDecoder();
  const idBytes = new Uint8Array(buffer, 0, 36);
  const transferId = dec.decode(idBytes).trim();
  const chunkIndex = dataView.getUint32(36, false);
  const payload = buffer.slice(40);

  return { transferId, chunkIndex, payload };
}

export interface ChunkSenderOptions {
  file: File;
  transferId: string;
  sendSignal: (msg: FileMetaMessage | FileCompleteMessage | FileCancelMessage) => void;
  sendData: (data: ArrayBuffer) => void;
  getBufferedAmount: () => number;
  waitForBufferDrain: () => Promise<void>;
  onProgress: (transferredBytes: number, speed: number, eta: number) => void;
  onComplete: () => void;
  onError: (err: Error) => void;
  abortSignal?: AbortSignal;
}

/**
 * Streams a file in small 64KB chunks directly using Blob.slice without loading
 * the entire file into RAM, ensuring support for 5GB+ files.
 */
export async function streamFileChunks(options: ChunkSenderOptions): Promise<void> {
  const {
    file,
    transferId,
    sendSignal,
    sendData,
    getBufferedAmount,
    waitForBufferDrain,
    onProgress,
    onComplete,
    onError,
    abortSignal
  } = options;

  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

  // 1. Send metadata announcement
  sendSignal({
    type: 'file-meta',
    transferId,
    name: file.name,
    size: file.size,
    mimeType: file.type || 'application/octet-stream',
    totalChunks,
    chunkSize: CHUNK_SIZE
  });

  if (file.size === 0) {
    sendSignal({ type: 'file-complete', transferId });
    onProgress(0, 0, 0);
    onComplete();
    return;
  }

  let chunkIndex = 0;
  let offset = 0;
  let transferredBytes = 0;
  const startTime = performance.now();
  let lastSpeedCalcTime = startTime;
  let lastSpeedCalcBytes = 0;
  let currentSpeed = 0;

  try {
    while (offset < file.size) {
      if (abortSignal?.aborted) {
        sendSignal({ type: 'file-cancel', transferId, reason: 'Скасовано користувачем' });
        return;
      }

      // 2. Backpressure control: wait if buffer exceeds high watermark
      if (getBufferedAmount() > MAX_BUFFER_AMOUNT) {
        await waitForBufferDrain();
      }

      // 3. Read single slice (Blob.slice does not consume memory of whole file)
      const slice = file.slice(offset, offset + CHUNK_SIZE);
      const arrayBuffer = await slice.arrayBuffer();

      // 4. Encode & send binary packet
      const packet = encodeBinaryChunk(transferId, chunkIndex, arrayBuffer);
      sendData(packet);

      transferredBytes += slice.size;
      offset += slice.size;
      chunkIndex++;

      // 5. Calculate speed & ETA smoothed over 250ms windows
      const now = performance.now();
      const elapsedSinceLastCalc = now - lastSpeedCalcTime;
      if (elapsedSinceLastCalc >= 250 || offset >= file.size) {
        const bytesDelta = transferredBytes - lastSpeedCalcBytes;
        currentSpeed = (bytesDelta / elapsedSinceLastCalc) * 1000; // bytes/sec
        lastSpeedCalcTime = now;
        lastSpeedCalcBytes = transferredBytes;

        const remainingBytes = file.size - transferredBytes;
        const eta = currentSpeed > 0 ? remainingBytes / currentSpeed : 0;
        onProgress(transferredBytes, currentSpeed, eta);
      }
    }

    // 6. Complete signal
    sendSignal({ type: 'file-complete', transferId });
    onComplete();
  } catch (err: any) {
    sendSignal({ type: 'file-cancel', transferId, reason: err?.message || 'Помилка передачі файлу' });
    onError(err);
  }
}

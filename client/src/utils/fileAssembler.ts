import { FileMetaMessage, decodeBinaryChunk } from './chunker.js';

export interface IncomingTransferState {
  meta: FileMetaMessage;
  chunks: ArrayBuffer[];
  receivedBytes: number;
  receivedChunksCount: number;
  startTime: number;
  lastCalcTime: number;
  lastCalcBytes: number;
  speed: number;
  eta: number;
}

export class FileAssembler {
  private transfers: Map<string, IncomingTransferState> = new Map();

  /**
   * Initializes receiving a new file transfer based on its metadata.
   */
  public registerTransfer(meta: FileMetaMessage): void {
    const now = performance.now();
    this.transfers.set(meta.transferId, {
      meta,
      chunks: new Array(meta.totalChunks),
      receivedBytes: 0,
      receivedChunksCount: 0,
      startTime: now,
      lastCalcTime: now,
      lastCalcBytes: 0,
      speed: 0,
      eta: 0
    });
  }

  /**
   * Ingests a raw binary chunk packet from DataChannel or WebSocket relay.
   */
  public processChunk(
    buffer: ArrayBuffer,
    onProgress?: (transferId: string, receivedBytes: number, speed: number, eta: number, progress: number) => void
  ): boolean {
    const decoded = decodeBinaryChunk(buffer);
    if (!decoded) return false;

    const { transferId, chunkIndex, payload } = decoded;
    const transfer = this.transfers.get(transferId);
    if (!transfer) return false;

    // Check if chunk already received (deduplication)
    if (!transfer.chunks[chunkIndex]) {
      transfer.chunks[chunkIndex] = payload;
      transfer.receivedBytes += payload.byteLength;
      transfer.receivedChunksCount++;

      const now = performance.now();
      const elapsed = now - transfer.lastCalcTime;
      if (elapsed >= 250 || transfer.receivedBytes >= transfer.meta.size) {
        const deltaBytes = transfer.receivedBytes - transfer.lastCalcBytes;
        transfer.speed = (deltaBytes / elapsed) * 1000;
        transfer.lastCalcTime = now;
        transfer.lastCalcBytes = transfer.receivedBytes;

        const remainingBytes = transfer.meta.size - transfer.receivedBytes;
        transfer.eta = transfer.speed > 0 ? remainingBytes / transfer.speed : 0;

        if (onProgress) {
          const progress = transfer.meta.size > 0
            ? Math.min(100, (transfer.receivedBytes / transfer.meta.size) * 100)
            : 100;
          onProgress(transferId, transfer.receivedBytes, transfer.speed, transfer.eta, progress);
        }
      }
    }

    return true;
  }

  /**
   * Assembles all chunks into a final Blob and returns it with filename.
   */
  public finalizeTransfer(transferId: string): { blob: Blob; meta: FileMetaMessage } | null {
    const transfer = this.transfers.get(transferId);
    if (!transfer) return null;

    // Verify all chunks are present (or fill empty if any)
    const validChunks = transfer.chunks.filter(Boolean);
    const blob = new Blob(validChunks, { type: transfer.meta.mimeType || 'application/octet-stream' });

    // Clean up memory
    this.transfers.delete(transferId);

    return { blob, meta: transfer.meta };
  }

  /**
   * Cancel and discard a transfer
   */
  public cancelTransfer(transferId: string): void {
    this.transfers.delete(transferId);
  }

  /**
   * Helper to trigger native browser file download
   */
  public static triggerDownload(blob: Blob, filename: string): string {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
    }, 100);
    return url;
  }
}

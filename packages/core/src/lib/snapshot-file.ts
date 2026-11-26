import { AppError } from "./app-error.ts";
import { parseBackup } from "./portability.ts";
import type { SeedData } from "./types.ts";

// Bound both stored and expanded input before JSON parsing, including gzip bombs.
export const MAX_BACKUP_BYTES = 100 * 1024 * 1024;

function checkSize(bytes: number) {
  if (bytes > MAX_BACKUP_BYTES) {
    throw new AppError("error.backupTooLarge", "Full backups must be at most 100 MiB before and after compression.");
  }
}

async function collect(stream: ReadableStream<Uint8Array>, type: string): Promise<Blob> {
  const reader = stream.getReader();
  const chunks: ArrayBuffer[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      checkSize(size);
      chunks.push(new Uint8Array(value).buffer);
    }
    return new Blob(chunks, { type });
  } catch (reason) {
    await reader.cancel().catch(() => undefined);
    throw reason;
  } finally {
    reader.releaseLock();
  }
}

export async function createBackupFile(backup: SeedData): Promise<{ blob: Blob; extension: ".json" | ".json.gz" }> {
  const json = new Blob([JSON.stringify(backup)], { type: "application/json" });
  checkSize(json.size);
  // Unsupported browsers retain the existing, fully restorable JSON export.
  if (typeof CompressionStream === "undefined" || typeof DecompressionStream === "undefined") {
    return { blob: json, extension: ".json" };
  }
  const blob = await collect(json.stream().pipeThrough(new CompressionStream("gzip")), "application/gzip");
  return { blob, extension: ".json.gz" };
}

export async function parseBackupFile(file: Blob): Promise<SeedData> {
  checkSize(file.size);
  const header = new Uint8Array(await file.slice(0, 2).arrayBuffer());
  let json = file;
  // Content identifies the format; names and MIME types are only chooser hints.
  if (header[0] === 0x1f && header[1] === 0x8b) {
    if (typeof DecompressionStream === "undefined") {
      throw new AppError("error.backupCompressionUnsupported", "This browser cannot open gzip. Extract the JSON file or use an updated browser.");
    }
    try {
      json = await collect(file.stream().pipeThrough(new DecompressionStream("gzip")), "application/json");
    } catch (reason) {
      if (reason instanceof AppError) throw reason;
      throw new AppError("error.invalidBackup", "The compressed full backup is damaged or incomplete.");
    }
  }
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(await json.arrayBuffer());
  } catch {
    throw new AppError("error.invalidBackup", "This full backup is not valid UTF-8 JSON.");
  }
  return parseBackup(text);
}

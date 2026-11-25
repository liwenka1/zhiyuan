import { Readable, Writable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import { createBrotliDecompress, createGunzip, createInflate } from "node:zlib";
import { fetchSafeRemoteHttp } from "../security/remote-url";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const IMAGE_TIMEOUT_MS = 8_000;
const decompressors = new Map([
  ["gzip", createGunzip],
  ["x-gzip", createGunzip],
  ["deflate", createInflate],
  ["br", createBrotliDecompress]
]);

export async function downloadExportImage(url: string, signal: AbortSignal): Promise<string | null> {
  if (signal.aborted) return null;
  const requestSignal = AbortSignal.any([signal, AbortSignal.timeout(IMAGE_TIMEOUT_MS)]);
  let onAbort = () => {};
  const aborted = new Promise<null>((resolve) => {
    onAbort = () => resolve(null);
    requestSignal.addEventListener("abort", onAbort, { once: true });
  });
  try {
    return await Promise.race([readExportImage(url, requestSignal), aborted]);
  } finally {
    requestSignal.removeEventListener("abort", onAbort);
  }
}

async function readExportImage(url: string, signal: AbortSignal): Promise<string | null> {
  try {
    const { response } = await fetchSafeRemoteHttp(
      url,
      {
        headers: { accept: "image/*", "accept-encoding": "gzip, deflate, br" },
        signal
      },
      { httpsOnly: true }
    );
    const { body, headers } = response;
    const mime = headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
    const encodings = (headers.get("content-encoding") ?? "")
      .toLowerCase()
      .split(",")
      .map((value) => value.trim())
      .filter((value) => value && value !== "identity");
    if (
      !response.ok ||
      !mime ||
      !/^image\/[a-z0-9.+-]+$/.test(mime) ||
      !body ||
      encodings.some((encoding) => !decompressors.has(encoding)) ||
      (!encodings.length && Number(headers.get("content-length")) > MAX_IMAGE_BYTES)
    ) {
      await body?.cancel();
      return null;
    }

    // The pinned HTTP client supplies wire bytes. Undo codings in reverse order and cap the decoded image.
    const decoders = encodings.reverse().map((encoding) => decompressors.get(encoding)!());
    const source = Readable.fromWeb(body as unknown as NodeReadableStream<Uint8Array>);
    const chunks: Uint8Array[] = [];
    let received = 0;
    const destination = new Writable({
      write(chunk: Buffer, _encoding, callback) {
        received += chunk.byteLength;
        if (received > MAX_IMAGE_BYTES) {
          callback(new Error("Decoded export image exceeds the size limit"));
          return;
        }
        chunks.push(chunk);
        callback();
      }
    });
    await pipeline([source, ...decoders, destination], { signal });
    return received ? `data:${mime};base64,${Buffer.concat(chunks).toString("base64")}` : null;
  } catch {
    return null;
  }
}

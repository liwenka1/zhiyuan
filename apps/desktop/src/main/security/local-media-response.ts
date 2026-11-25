import { constants } from "node:fs";
import { open } from "node:fs/promises";
import { Readable } from "node:stream";
import { getLocalMediaType } from "./local-file";

function resolveByteRange(value: string, size: number): { start: number; end: number } | null {
  const match = /^bytes=(\d*)-(\d*)$/i.exec(value.trim());
  if (!match || (!match[1] && !match[2]) || !size) return null;

  const start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
  const end = match[1] && match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
  return start <= end ? { start, end } : null;
}

export async function createLocalMediaResponse(
  request: Request,
  media: { filePath: string; mimeType?: string }
): Promise<Response> {
  const file = await open(
    media.filePath,
    constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0)
  );
  let streamOwnsFile = false;
  try {
    const stat = await file.stat();
    if (!stat.isFile()) return new Response(null, { status: 404 });
    const { size } = stat;
    const headers = new Headers({
      "accept-ranges": "bytes",
      "content-type": media.mimeType ?? getLocalMediaType(media.filePath) ?? "application/octet-stream"
    });
    if (media.mimeType) {
      headers.set("x-content-type-options", "nosniff");
      headers.set("content-security-policy", "default-src 'none'; sandbox");
    }

    const rangeHeader = request.method === "GET" ? request.headers.get("range") : null;
    const range = rangeHeader ? resolveByteRange(rangeHeader, size) : null;
    if (rangeHeader && !range) {
      headers.set("content-range", `bytes */${size}`);
      return new Response(null, { status: 416, headers });
    }
    const status = range ? 206 : 200;
    const length = range ? range.end - range.start + 1 : size;
    headers.set("content-length", String(length));
    if (range) headers.set("content-range", `bytes ${range.start}-${range.end}/${size}`);
    if (request.method === "HEAD" || !length) return new Response(null, { status, headers });

    const stream = file.createReadStream({ ...range, signal: request.signal });
    streamOwnsFile = true;
    const body = Readable.toWeb(stream) as ReadableStream<Uint8Array>;
    return new Response(body, { status, headers });
  } finally {
    if (!streamOwnsFile) await file.close();
  }
}

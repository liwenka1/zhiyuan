import { lookup } from "node:dns/promises";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { isIP } from "node:net";
import { Readable } from "node:stream";
import type { IncomingHttpHeaders, IncomingMessage } from "node:http";

const MAX_REDIRECTS = 5;
const REQUEST_TIMEOUT_MS = 30_000;

interface ResolvedRemoteTarget {
  url: URL;
  address: string;
  family: 4 | 6;
}

function isPrivateIpv4(address: string): boolean {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  return (
    parts[0] === 0 ||
    parts[0] === 10 ||
    parts[0] === 127 ||
    (parts[0] === 169 && parts[1] === 254) ||
    (parts[0] === 192 && parts[1] === 168) ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31)
  );
}

function parseIpv6Hextets(address: string): number[] | null {
  let normalized = address.toLowerCase().replace(/^\[|\]$/g, "");
  if (normalized.includes(".")) {
    const lastColon = normalized.lastIndexOf(":");
    if (lastColon < 0) return null;
    const ipv4 = normalized.slice(lastColon + 1);
    const parts = ipv4.split(".").map(Number);
    if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return null;
    const mapped = `${((parts[0] << 8) | parts[1]).toString(16)}:${((parts[2] << 8) | parts[3]).toString(16)}`;
    normalized = `${normalized.slice(0, lastColon + 1)}${mapped}`;
  }

  const doubleColon = normalized.indexOf("::");
  if (doubleColon !== normalized.lastIndexOf("::")) return null;

  const parsePart = (part: string): number[] | null => {
    if (!part) return [];
    const values = part.split(":").map((value) => Number.parseInt(value, 16));
    if (values.some((value) => !Number.isInteger(value) || value < 0 || value > 0xffff)) return null;
    return values;
  };

  if (doubleColon >= 0) {
    const left = parsePart(normalized.slice(0, doubleColon));
    const right = parsePart(normalized.slice(doubleColon + 2));
    if (!left || !right || left.length + right.length >= 8) return null;
    return [...left, ...Array.from({ length: 8 - left.length - right.length }, () => 0), ...right];
  }

  const values = parsePart(normalized);
  return values?.length === 8 ? values : null;
}

function mappedIpv4FromIpv6(address: string): string | null {
  const hextets = parseIpv6Hextets(address);
  if (!hextets || !hextets.slice(0, 5).every((value) => value === 0) || hextets[5] !== 0xffff) {
    return null;
  }
  return [hextets[6] >> 8, hextets[6] & 0xff, hextets[7] >> 8, hextets[7] & 0xff].join(".");
}

function isPrivateIpAddress(address: string): boolean {
  const normalized = address.toLowerCase().replace(/^\[|\]$/g, "");
  if (isIP(normalized) === 4) return isPrivateIpv4(normalized);
  if (isIP(normalized) !== 6) return false;

  const mappedIpv4 = mappedIpv4FromIpv6(normalized);
  if (mappedIpv4) return isPrivateIpv4(mappedIpv4);

  // Reject loopback, unspecified, link-local, and ULA IPv6 ranges.
  if (normalized === "::" || normalized === "::1") return true;
  const hextets = parseIpv6Hextets(normalized);
  if (!hextets) return false;
  return (hextets[0] & 0xffc0) === 0xfe80 || (hextets[0] & 0xff00) === 0xfc00;
}

async function resolveSafeRemoteTarget(input: string | URL): Promise<ResolvedRemoteTarget> {
  const url = typeof input === "string" ? new URL(input) : input;
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only HTTP and HTTPS URLs are supported");
  }

  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname === "0.0.0.0") {
    throw new Error("Private network URLs are not supported");
  }

  const literalFamily = isIP(hostname);
  if (literalFamily === 4 || literalFamily === 6) {
    if (isPrivateIpAddress(hostname)) throw new Error("Private network URLs are not supported");
    return { url, address: hostname, family: literalFamily };
  }

  const addresses = await lookup(hostname, { all: true, verbatim: true });
  if (addresses.length === 0 || addresses.some((entry) => isPrivateIpAddress(entry.address))) {
    throw new Error("Private network URLs are not supported");
  }

  const selected = addresses[0];
  return { url, address: selected.address, family: selected.family as 4 | 6 };
}

export async function assertSafeRemoteHttpUrl(input: string | URL): Promise<URL> {
  return (await resolveSafeRemoteTarget(input)).url;
}

function headersToRecord(headers: HeadersInit | undefined): Record<string, string> {
  const result: Record<string, string> = {};
  if (!headers) return result;
  new Headers(headers).forEach((value, key) => {
    result[key] = value;
  });
  return result;
}

function incomingHeadersToHeaders(headers: IncomingHttpHeaders): Headers {
  const result = new Headers();
  for (const [name, value] of Object.entries(headers)) {
    if (value === undefined) continue;
    result.set(name, Array.isArray(value) ? value.join(", ") : value);
  }
  return result;
}

function requestPinnedTarget(target: ResolvedRemoteTarget, init: RequestInit): Promise<Response> {
  return new Promise((resolve, reject) => {
    const url = target.url;
    const requester = url.protocol === "https:" ? httpsRequest : httpRequest;
    const headers = headersToRecord(init.headers);
    headers.host = url.host;
    if (!headers["accept-encoding"]) headers["accept-encoding"] = "identity";
    const requestOptions = {
      protocol: url.protocol,
      hostname: target.address,
      port: url.port || undefined,
      method: init.method || "GET",
      path: `${url.pathname}${url.search}`,
      headers,
      family: target.family,
      lookup: (
        _hostname: string,
        _options: unknown,
        callback: (error: Error | null, address: string, family: number) => void
      ) => callback(null, target.address, target.family),
      ...(url.protocol === "https:" ? { servername: url.hostname.replace(/^\[|\]$/g, "") } : {})
    };

    const request = requester(requestOptions, (incoming: IncomingMessage) => {
      const body = Readable.toWeb(incoming) as ReadableStream<Uint8Array>;
      resolve(
        new Response(body, {
          status: incoming.statusCode ?? 502,
          statusText: incoming.statusMessage,
          headers: incomingHeadersToHeaders(incoming.headers)
        })
      );
    });

    const abort = () => request.destroy(new Error("Remote request aborted"));
    if (init.signal?.aborted) {
      abort();
      return;
    }
    init.signal?.addEventListener("abort", abort, { once: true });
    request.setTimeout(REQUEST_TIMEOUT_MS, () => request.destroy(new Error("Remote request timed out")));
    request.once("error", reject);

    if (init.body) {
      request.destroy(new Error("Only bodyless remote GET requests are supported"));
      return;
    }
    request.end();
  });
}

export async function fetchSafeRemoteHttp(
  input: string | URL,
  init: RequestInit = {}
): Promise<{ response: Response; finalUrl: URL }> {
  let currentUrl = typeof input === "string" ? new URL(input) : input;

  for (let attempt = 0; attempt <= MAX_REDIRECTS; attempt += 1) {
    const target = await resolveSafeRemoteTarget(currentUrl);
    const response = await requestPinnedTarget(target, init);

    if (response.status >= 300 && response.status < 400) {
      if (attempt === MAX_REDIRECTS) throw new Error("Too many redirects");
      const location = response.headers.get("location");
      await response.body?.cancel();
      if (!location) throw new Error("Redirect response is missing a location");
      currentUrl = new URL(location, currentUrl);
      continue;
    }

    return { response, finalUrl: currentUrl };
  }

  throw new Error("Too many redirects");
}

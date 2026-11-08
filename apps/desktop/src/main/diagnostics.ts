import { app } from "electron";
import { appendFile, mkdir, stat, writeFile } from "fs/promises";
import path from "path";

const MAX_LOG_BYTES = 5 * 1024 * 1024;
const MAX_FIELD_LENGTH = 4_000;

let logFilePath: string | null = null;
let writeQueue = Promise.resolve();

function truncate(value: string): string {
  return value.length > MAX_FIELD_LENGTH ? `${value.slice(0, MAX_FIELD_LENGTH)}…` : value;
}

function stringifyUnknown(value: unknown): string {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}

function getLogFilePath(): string | null {
  if (logFilePath) return logFilePath;

  try {
    logFilePath = path.join(app.getPath("logs"), "zhiyuan.log");
    return logFilePath;
  } catch {
    return null;
  }
}

function serializeError(error: unknown): { name: string; message: string; stack?: string } {
  if (error instanceof Error) {
    return {
      name: truncate(error.name),
      message: truncate(error.message),
      ...(error.stack ? { stack: truncate(error.stack) } : {})
    };
  }

  return {
    name: "UnknownError",
    message: truncate(stringifyUnknown(error))
  };
}

function sanitizeMetadata(metadata?: Record<string, unknown>): Record<string, string | number | boolean | null> {
  if (!metadata) return {};

  const sanitized: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (value === null || typeof value === "number" || typeof value === "boolean") {
      sanitized[truncate(key)] = value;
    } else if (typeof value === "string") {
      sanitized[truncate(key)] = truncate(value);
    }
  }
  return sanitized;
}

/** 记录不包含笔记正文或凭据的运行时诊断信息。 */
export function recordDiagnostic(scope: string, error: unknown, metadata?: Record<string, unknown>): void {
  const payload = `${JSON.stringify({
    timestamp: new Date().toISOString(),
    scope: truncate(scope),
    error: serializeError(error),
    metadata: sanitizeMetadata(metadata)
  })}\n`;

  console.error(`[${scope}]`, error);

  const filePath = getLogFilePath();
  if (!filePath) return;

  writeQueue = writeQueue
    .then(async () => {
      try {
        await mkdir(path.dirname(filePath), { recursive: true });
        const currentSize = await stat(filePath)
          .then((result) => result.size)
          .catch(() => 0);
        if (currentSize + Buffer.byteLength(payload, "utf8") > MAX_LOG_BYTES) {
          await writeFile(filePath, payload, "utf8");
        } else {
          await appendFile(filePath, payload, "utf8");
        }
      } catch {
        // 诊断记录不能影响正常业务流程。
      }
    })
    .catch(() => undefined);
}

export function initializeDiagnostics(): void {
  getLogFilePath();
}

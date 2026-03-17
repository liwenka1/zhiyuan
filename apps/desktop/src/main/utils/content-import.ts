const INVALID_NAME_CHARS = /[\\/:*?"<>|]/g;

export function sanitizeName(name: string): string {
  return name.replace(INVALID_NAME_CHARS, "-").replace(/\s+/g, " ").trim();
}

export function formatDate(dateValue?: string): string | null {
  const date = dateValue ? new Date(dateValue) : new Date();
  if (Number.isNaN(date.getTime())) return null;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

type MetadataValue = string | number | boolean | null | undefined;

function escapeCommentValue(value: string): string {
  return value.replace(/\r?\n/g, " ").replace(/-->/g, "--\\>");
}

export function buildCommentMetadata(data: Record<string, MetadataValue>): string {
  const lines = Object.entries(data)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([key, value]) => `<!-- ${key}: ${escapeCommentValue(String(value))} -->`);

  if (lines.length === 0) return "";
  return `${lines.join("\n")}\n\n`;
}

const INVALID_FILE_NAME_CHARS = /[\\/:*?"<>|]/;
const WINDOWS_RESERVED_NAMES = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i;

export function isValidFileNameSegment(value: string): boolean {
  const name = value.trim();
  if (!name || name === "." || name === "..") return false;
  if (INVALID_FILE_NAME_CHARS.test(name)) return false;
  if ([...name].some((char) => char.charCodeAt(0) < 32)) return false;
  if (name.endsWith(".") || name.endsWith(" ")) return false;
  if (WINDOWS_RESERVED_NAMES.test(name)) return false;
  return true;
}

export function normalizeFileNameSegment(value: string): string {
  return [...value.trim()]
    .filter((char) => char.charCodeAt(0) >= 32)
    .join("")
    .replace(INVALID_FILE_NAME_CHARS, "-")
    .replace(/[. ]+$/g, "")
    .trim();
}

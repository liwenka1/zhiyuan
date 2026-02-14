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

export function escapeYamlValue(value: string): string {
  return value.replace(/"/g, '\\"');
}

export function buildFrontmatter(data: {
  title?: string;
  link?: string;
  guid?: string;
  published?: string;
  source?: string;
  url?: string;
  fetchedAt?: string;
  hidden?: boolean;
}): string {
  const lines: string[] = ["---"];

  if (data.hidden) lines.push("hidden: true");
  if (data.title) lines.push(`title: "${escapeYamlValue(data.title)}"`);
  if (data.link) lines.push(`link: "${escapeYamlValue(data.link)}"`);
  if (data.guid) lines.push(`guid: "${escapeYamlValue(data.guid)}"`);
  if (data.published) lines.push(`published: "${data.published}"`);
  if (data.source) lines.push(`source: "${escapeYamlValue(data.source)}"`);
  if (data.url) lines.push(`url: "${escapeYamlValue(data.url)}"`);
  if (data.fetchedAt) lines.push(`fetched: "${data.fetchedAt}"`);

  lines.push("---", "");
  return lines.join("\n");
}

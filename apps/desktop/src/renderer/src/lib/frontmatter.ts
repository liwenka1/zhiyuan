export function stripHiddenFrontmatter(markdown: string): string {
  if (!markdown.startsWith("---")) return markdown;
  const match = markdown.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!match) return markdown;
  const frontmatter = match[1] || "";
  const isHidden = /^hidden:\s*true\s*$/m.test(frontmatter);
  if (!isHidden) return markdown;
  return markdown.slice(match[0].length);
}

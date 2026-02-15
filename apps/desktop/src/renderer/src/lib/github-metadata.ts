const ISSUE_NUMBER_REGEX = /<!--\s*github-issue-number:\s*(\d+)\s*-->/i;
const ISSUE_URL_REGEX = /<!--\s*github-issue-url:\s*([^\s]+)\s*-->/i;
const FRONTMATTER_REGEX = /^---\n[\s\S]*?\n---\n?/;

export function parseGitHubMetadata(markdown: string): { issueNumber?: number; issueUrl?: string } {
  const issueNumberMatch = markdown.match(ISSUE_NUMBER_REGEX);
  const issueUrlMatch = markdown.match(ISSUE_URL_REGEX);
  const issueNumber = issueNumberMatch ? Number(issueNumberMatch[1]) : undefined;
  const issueUrl = issueUrlMatch ? issueUrlMatch[1] : undefined;

  return {
    issueNumber: Number.isFinite(issueNumber) ? issueNumber : undefined,
    issueUrl: issueUrl || undefined
  };
}

function stripGitHubMetadata(markdown: string): string {
  const lines = markdown.split("\n");
  const filtered = lines.filter((line) => !ISSUE_NUMBER_REGEX.test(line) && !ISSUE_URL_REGEX.test(line));
  return filtered.join("\n");
}

export function upsertGitHubMetadata(markdown: string, metadata: { issueNumber: number; issueUrl: string }): string {
  const cleaned = stripGitHubMetadata(markdown);
  const metaBlock = `<!-- github-issue-number: ${metadata.issueNumber} -->\n<!-- github-issue-url: ${metadata.issueUrl} -->\n`;

  if (FRONTMATTER_REGEX.test(cleaned)) {
    return cleaned.replace(FRONTMATTER_REGEX, (match) => `${match}${metaBlock}`);
  }

  return `${metaBlock}${cleaned}`;
}

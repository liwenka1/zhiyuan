import { parseGitHubMetadata as parseSharedGitHubMetadata, type GitHubMetadata } from "@shared";

const ISSUE_NUMBER_REGEX = /<!--\s*github-issue-number:\s*(\d+)\s*-->/i;
const ISSUE_URL_REGEX = /<!--\s*github-issue-url:\s*([^\s]+)\s*-->/i;

export function parseGitHubMetadata(markdown: string): GitHubMetadata {
  return parseSharedGitHubMetadata(markdown);
}

function stripGitHubMetadata(markdown: string): string {
  const lines = markdown.split("\n");
  const filtered = lines.filter((line) => !ISSUE_NUMBER_REGEX.test(line) && !ISSUE_URL_REGEX.test(line));
  return filtered.join("\n");
}

export function upsertGitHubMetadata(markdown: string, metadata: { issueNumber: number; issueUrl: string }): string {
  const cleaned = stripGitHubMetadata(markdown);
  const metaBlock = `<!-- github-issue-number: ${metadata.issueNumber} -->\n<!-- github-issue-url: ${metadata.issueUrl} -->\n`;
  return `${metaBlock}${cleaned}`;
}

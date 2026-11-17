import { parseGitHubMetadata as parseSharedGitHubMetadata, type GitHubMetadata } from "@shared";

export function parseGitHubMetadata(markdown: string): GitHubMetadata {
  return parseSharedGitHubMetadata(markdown);
}

export { getGitHubIssueNumberForRepository } from "@shared";

export function stripGitHubMetadata(markdown: string): string {
  const comment = "<!--\\s*github-issue-(?:number:\\s*\\d+|url:\\s*[^\\s]+)\\s*-->";
  return markdown
    .replace(new RegExp(`^[\\t ]*${comment}[\\t ]*(?:\\r?\\n|$)`, "gim"), "")
    .replace(new RegExp(comment, "gi"), "");
}

export function upsertGitHubMetadata(markdown: string, metadata: { issueNumber: number; issueUrl: string }): string {
  const cleaned = stripGitHubMetadata(markdown);
  const metaBlock = `<!-- github-issue-number: ${metadata.issueNumber} -->\n<!-- github-issue-url: ${metadata.issueUrl} -->\n`;
  return `${metaBlock}${cleaned}`;
}

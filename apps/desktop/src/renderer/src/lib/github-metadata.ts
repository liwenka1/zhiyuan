import { parseGitHubMetadata as parseSharedGitHubMetadata, type GitHubMetadata } from "@shared";

export function parseGitHubMetadata(markdown: string): GitHubMetadata {
  return parseSharedGitHubMetadata(markdown);
}

/** 只有已记录的 issue 属于当前仓库时才允许更新，防止切换项目后误改同号 issue。 */
export function getGitHubIssueNumberForRepository(
  metadata: GitHubMetadata | undefined,
  owner: string,
  repo: string
): number | undefined {
  if (!metadata?.issueNumber || !metadata.issueUrl) return undefined;
  try {
    const url = new URL(metadata.issueUrl);
    const match = /^\/([^/]+)\/([^/]+)\/issues\/(\d+)\/?$/.exec(url.pathname);
    if (
      url.protocol !== "https:" ||
      url.hostname !== "github.com" ||
      !match ||
      match[1].toLowerCase() !== owner.trim().toLowerCase() ||
      match[2].toLowerCase() !== repo.trim().toLowerCase() ||
      Number(match[3]) !== metadata.issueNumber
    ) {
      return undefined;
    }
    return metadata.issueNumber;
  } catch {
    return undefined;
  }
}

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

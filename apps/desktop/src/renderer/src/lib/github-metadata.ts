import { parseGitHubMetadata as parseSharedGitHubMetadata, type GitHubMetadata } from "@shared";

const ISSUE_NUMBER_REGEX = /<!--\s*github-issue-number:\s*(\d+)\s*-->/i;
const ISSUE_URL_REGEX = /<!--\s*github-issue-url:\s*([^\s]+)\s*-->/i;

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

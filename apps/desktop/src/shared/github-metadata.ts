export interface GitHubMetadata {
  issueNumber?: number;
  issueUrl?: string;
}

const ISSUE_NUMBER_REGEX = /<!--\s*github-issue-number:\s*(\d+)\s*-->/i;
const ISSUE_URL_REGEX = /<!--\s*github-issue-url:\s*([^\s]+)\s*-->/i;

export function parseGitHubMetadata(markdown: string): GitHubMetadata {
  const issueNumberMatch = markdown.match(ISSUE_NUMBER_REGEX);
  const issueUrlMatch = markdown.match(ISSUE_URL_REGEX);
  const issueNumber = issueNumberMatch ? Number(issueNumberMatch[1]) : undefined;
  const issueUrl = issueUrlMatch ? issueUrlMatch[1] : undefined;

  return {
    issueNumber: Number.isFinite(issueNumber) ? issueNumber : undefined,
    issueUrl: issueUrl || undefined
  };
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

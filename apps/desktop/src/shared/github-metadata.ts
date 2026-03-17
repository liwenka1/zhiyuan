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

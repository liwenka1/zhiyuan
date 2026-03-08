export interface GitHubConfig {
  owner: string;
  repo: string;
  token: string;
}

export const DEFAULT_GITHUB_PROJECT_KEY = "__default__";

export type GitHubProjectConfigMap = Record<string, GitHubConfig>;

export interface GitHubIssuePushRequest {
  owner: string;
  repo: string;
  token: string;
  title: string;
  body: string;
  issueNumber?: number;
}

export interface GitHubIssuePushResult {
  issueNumber: number;
  issueUrl: string;
  isNew: boolean;
}

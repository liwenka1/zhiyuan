export interface GitHubConfig {
  owner: string;
  repo: string;
  token: string;
}

export type GitHubProjectConfigMap = Record<string, GitHubConfig>;

export interface GitHubIssuePushRequest {
  projectKey?: string;
  owner: string;
  repo: string;
  token: string;
  title: string;
  body: string;
  sourcePath: string;
  issueNumber?: number;
}

export interface GitHubIssuePushResult {
  issueNumber: number;
  issueUrl: string;
  isNew: boolean;
  publicationId: string;
}

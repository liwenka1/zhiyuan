const GITHUB_API_BASE = "https://api.github.com";

function encodeRepositoryPath(value: string): string {
  return value
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

class GitHubHttpError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = "GitHubHttpError";
  }
}

async function requestGitHub<T>(url: string, options: RequestInit & { token: string }): Promise<T> {
  const { token, ...init } = options;
  const response = await fetch(url, {
    ...init,
    signal: init.signal ?? AbortSignal.timeout(30000),
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `token ${token}`,
      "User-Agent": "xx-note",
      "Content-Type": "application/json",
      ...(init.headers ?? {})
    }
  });

  if (!response.ok) {
    let message = `${response.status} ${response.statusText}`;
    try {
      const data = (await response.json()) as { message?: string };
      if (data?.message) {
        message = data.message;
      }
    } catch {
      // ignore json parse errors
    }
    throw new GitHubHttpError(message, response.status);
  }

  return (await response.json()) as T;
}

export async function createIssue(params: {
  owner: string;
  repo: string;
  token: string;
  title: string;
  body: string;
}): Promise<{ number: number; html_url: string }> {
  const url = `${GITHUB_API_BASE}/repos/${params.owner}/${params.repo}/issues`;
  return requestGitHub(url, {
    method: "POST",
    token: params.token,
    body: JSON.stringify({ title: params.title, body: params.body })
  });
}

export async function getRepositoryDefaultBranch(params: {
  owner: string;
  repo: string;
  token: string;
}): Promise<string> {
  const url = `${GITHUB_API_BASE}/repos/${params.owner}/${params.repo}`;
  const data = await requestGitHub<{ default_branch?: string }>(url, {
    method: "GET",
    token: params.token
  });
  if (!data.default_branch) throw new Error("GitHub repository has no default branch");
  return data.default_branch;
}

export async function createIssueComment(params: {
  owner: string;
  repo: string;
  token: string;
  issueNumber: number;
  body: string;
}): Promise<{ html_url: string }> {
  const url = `${GITHUB_API_BASE}/repos/${params.owner}/${params.repo}/issues/${params.issueNumber}/comments`;
  return requestGitHub(url, {
    method: "POST",
    token: params.token,
    body: JSON.stringify({ body: params.body })
  });
}

export async function updateIssue(params: {
  owner: string;
  repo: string;
  token: string;
  issueNumber: number;
  title: string;
  body: string;
}): Promise<{ html_url: string }> {
  const url = `${GITHUB_API_BASE}/repos/${params.owner}/${params.repo}/issues/${params.issueNumber}`;
  return requestGitHub(url, {
    method: "PATCH",
    token: params.token,
    body: JSON.stringify({ title: params.title, body: params.body })
  });
}

export async function getContentSha(params: {
  owner: string;
  repo: string;
  token: string;
  path: string;
  ref?: string;
}): Promise<string | null> {
  const refQuery = params.ref ? `?ref=${encodeURIComponent(params.ref)}` : "";
  const url = `${GITHUB_API_BASE}/repos/${params.owner}/${params.repo}/contents/${encodeRepositoryPath(params.path)}${refQuery}`;
  try {
    const data = await requestGitHub<{ sha?: string }>(url, {
      method: "GET",
      token: params.token
    });
    return data.sha ?? null;
  } catch (error) {
    if (error instanceof GitHubHttpError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

export async function uploadContent(params: {
  owner: string;
  repo: string;
  token: string;
  path: string;
  contentBase64: string;
  message: string;
  branch?: string;
  sha?: string;
}): Promise<{ content?: { sha?: string } }> {
  const url = `${GITHUB_API_BASE}/repos/${params.owner}/${params.repo}/contents/${encodeRepositoryPath(params.path)}`;
  return requestGitHub(url, {
    method: "PUT",
    token: params.token,
    body: JSON.stringify({
      message: params.message,
      content: params.contentBase64,
      branch: params.branch,
      sha: params.sha
    })
  });
}

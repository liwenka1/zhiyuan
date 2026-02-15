const GITHUB_API_BASE = "https://api.github.com";

async function requestGitHub<T>(url: string, options: RequestInit & { token: string }): Promise<T> {
  const { token, ...init } = options;
  const response = await fetch(url, {
    ...init,
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
    throw new Error(message);
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

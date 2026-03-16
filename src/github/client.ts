import fs from "node:fs";
import path from "node:path";

interface GitHubSecretsResponse {
  total_count: number;
  secrets: Array<{ name: string }>;
}

export async function getRepoSecrets(
  owner: string,
  repo: string,
  token: string
): Promise<string[]> {
  const url = `https://api.github.com/repos/${owner}/${repo}/actions/secrets`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  if (res.status === 401) {
    throw new Error("Invalid or expired GITHUB_TOKEN");
  }
  if (res.status === 404) {
    throw new Error("Repository not found or token lacks access");
  }
  if (!res.ok) {
    throw new Error(`GitHub API error: ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as GitHubSecretsResponse;
  return data.secrets.map((s) => s.name);
}

export function detectRepoFromGit(
  repoPath: string
): { owner: string; repo: string } | null {
  const gitConfigPath = path.join(repoPath, ".git", "config");

  let configContent: string;
  try {
    configContent = fs.readFileSync(gitConfigPath, "utf-8");
  } catch {
    return null;
  }

  // Find [remote "origin"] section and extract url
  const remoteMatch = configContent.match(
    /\[remote\s+"origin"\]\s*\n(?:\s+\w+\s*=[^\n]*\n)*?\s*url\s*=\s*(.+)/
  );
  if (!remoteMatch) return null;

  const url = remoteMatch[1].trim();
  return parseGitUrl(url);
}

function parseGitUrl(url: string): { owner: string; repo: string } | null {
  // HTTPS: https://github.com/owner/repo.git
  const httpsMatch = url.match(
    /https?:\/\/github\.com\/([^/]+)\/([^/\s]+?)(?:\.git)?$/
  );
  if (httpsMatch) {
    return { owner: httpsMatch[1], repo: httpsMatch[2] };
  }

  // SSH: git@github.com:owner/repo.git
  const sshMatch = url.match(
    /git@github\.com:([^/]+)\/([^/\s]+?)(?:\.git)?$/
  );
  if (sshMatch) {
    return { owner: sshMatch[1], repo: sshMatch[2] };
  }

  return null;
}

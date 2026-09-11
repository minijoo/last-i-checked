// Powers the About page's Changelog — a thin read of this repo's GitHub
// Production deployments, each joined to its commit for the full message.
// Public repo, no auth needed. Always fetched fresh (no caching): every load
// hits GitHub live, so the list is never stale — see the `cache: "no-store"`
// below.

const OWNER = "minijoo";
const REPO = "last-i-checked";
const GITHUB_HEADERS = { Accept: "application/vnd.github+json" };

export interface ChangelogEntry {
  sha: string;
  htmlUrl: string; // https://github.com/OWNER/REPO/commit/SHA
  date: number; // epoch ms — the deployment's created_at
  message: string; // full commit message (subject + body + trailers)
}

interface GitHubDeployment {
  sha: string;
  created_at: string;
  environment: string;
}

interface GitHubCommit {
  sha: string;
  html_url: string;
  commit: { message: string };
}

/**
 * Every Production deployment, newest first, with its commit's full message.
 * Two calls: the deployments list (has the real deploy timestamp, not the
 * commit message) and the commit list on main (has the message, not tied to
 * deploys) — joined locally by sha. A redeploy of the same commit is
 * collapsed to its most recent deployment. Returns [] on any failure — the
 * About page treats that as "nothing to show" rather than erroring the page.
 */
export async function getChangelog(): Promise<ChangelogEntry[]> {
  try {
    const [deploysRes, commitsRes] = await Promise.all([
      fetch(
        `https://api.github.com/repos/${OWNER}/${REPO}/deployments?environment=production&per_page=100`,
        { headers: GITHUB_HEADERS, cache: "no-store" },
      ),
      fetch(
        `https://api.github.com/repos/${OWNER}/${REPO}/commits?sha=main&per_page=100`,
        { headers: GITHUB_HEADERS, cache: "no-store" },
      ),
    ]);
    if (!deploysRes.ok || !commitsRes.ok) return [];

    const deployments: GitHubDeployment[] = await deploysRes.json();
    const commits: GitHubCommit[] = await commitsRes.json();
    const commitBySha = new Map(commits.map((c) => [c.sha, c]));

    const sorted = [...deployments].sort(
      (a, b) => Date.parse(b.created_at) - Date.parse(a.created_at),
    );
    const seen = new Set<string>();
    const entries: ChangelogEntry[] = [];
    for (const d of sorted) {
      if (seen.has(d.sha)) continue; // redeploy of the same commit — keep the newest
      const commit = commitBySha.get(d.sha);
      if (!commit) continue; // deployed sha fell outside the fetched commit window
      seen.add(d.sha);
      entries.push({
        sha: d.sha,
        htmlUrl: commit.html_url,
        date: Date.parse(d.created_at),
        message: commit.commit.message,
      });
    }
    return entries;
  } catch {
    return [];
  }
}

type GithubContent = {
  content: string;
  encoding: string;
  sha: string;
};

type CommitFile = {
  path: string;
  content: string;
  encoding?: 'utf-8' | 'base64';
};

const apiBase = 'https://api.github.com';

const getConfig = () => {
  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;
  const branch = process.env.GITHUB_BRANCH || 'main';

  if (!token) throw new Error('Falta GITHUB_TOKEN.');
  if (!owner) throw new Error('Falta GITHUB_OWNER.');
  if (!repo) throw new Error('Falta GITHUB_REPO.');

  return { token, owner, repo, branch };
};

const githubFetch = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
  const { token } = getConfig();
  const response = await fetch(`${apiBase}${path}`, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...init.headers
    },
    cache: 'no-store'
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GitHub API ${response.status}: ${text}`);
  }

  return response.json() as Promise<T>;
};

const encodePath = (path: string) => path.split('/').map(encodeURIComponent).join('/');

export const readFile = async (path: string) => {
  const { owner, repo, branch } = getConfig();
  const file = await githubFetch<GithubContent>(
    `/repos/${owner}/${repo}/contents/${encodePath(path)}?ref=${branch}`
  );

  if (file.encoding !== 'base64') throw new Error(`Encoding no soportado para ${path}.`);
  return Buffer.from(file.content, 'base64').toString('utf8');
};

export const readJson = async <T>(path: string, fallback: T): Promise<T> => {
  try {
    return JSON.parse(await readFile(path)) as T;
  } catch (error) {
    if (String(error).includes('GitHub API 404')) return fallback;
    throw error;
  }
};

export const commitFiles = async (files: CommitFile[], message: string) => {
  const { owner, repo, branch } = getConfig();
  const ref = await githubFetch<{ object: { sha: string } }>(
    `/repos/${owner}/${repo}/git/ref/heads/${branch}`
  );
  const baseCommitSha = ref.object.sha;
  const baseCommit = await githubFetch<{ tree: { sha: string } }>(
    `/repos/${owner}/${repo}/git/commits/${baseCommitSha}`
  );

  const treeItems = await Promise.all(files.map(async file => {
    const blob = await githubFetch<{ sha: string }>(`/repos/${owner}/${repo}/git/blobs`, {
      method: 'POST',
      body: JSON.stringify({
        content: file.content,
        encoding: file.encoding === 'base64' ? 'base64' : 'utf-8'
      })
    });

    return {
      path: file.path,
      mode: '100644',
      type: 'blob',
      sha: blob.sha
    };
  }));

  const tree = await githubFetch<{ sha: string }>(`/repos/${owner}/${repo}/git/trees`, {
    method: 'POST',
    body: JSON.stringify({
      base_tree: baseCommit.tree.sha,
      tree: treeItems
    })
  });

  const commit = await githubFetch<{ sha: string; html_url: string }>(`/repos/${owner}/${repo}/git/commits`, {
    method: 'POST',
    body: JSON.stringify({
      message,
      tree: tree.sha,
      parents: [baseCommitSha]
    })
  });

  await githubFetch(`/repos/${owner}/${repo}/git/refs/heads/${branch}`, {
    method: 'PATCH',
    body: JSON.stringify({ sha: commit.sha })
  });

  return commit;
};

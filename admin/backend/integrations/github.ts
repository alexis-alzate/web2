type GithubContent = {
  content: string;
  encoding: string;
  sha: string;
};

export type CommitFile = {
  path: string;
  content: string;
  encoding?: 'utf-8' | 'base64';
};

type CommitOptions = {
  // Rutas que deben desaparecer del repo en el mismo commit (paginas de
  // artistas borrados, etc.). Si una ruta ya no existe se ignora.
  deletes?: string[];
};

export class GithubApiError extends Error {
  constructor(public status: number, body: string) {
    super(`GitHub API ${status}: ${body}`);
    this.name = 'GithubApiError';
  }
}

const apiBase = 'https://api.github.com';
const MAX_COMMIT_ATTEMPTS = 3;

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
    throw new GithubApiError(response.status, await response.text());
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

const fileExists = async (path: string) => {
  const { owner, repo, branch } = getConfig();
  try {
    await githubFetch(`/repos/${owner}/${repo}/contents/${encodePath(path)}?ref=${branch}`);
    return true;
  } catch (error) {
    if (error instanceof GithubApiError && error.status === 404) return false;
    throw error;
  }
};

// Mover la rama solo "hacia adelante" es lo que protege de pisar un commit
// ajeno: si alguien publico entre que leimos la rama y la movimos, GitHub
// responde 422. Como cada archivo que generamos es completo (no un parche),
// es seguro reconstruir el commit sobre la punta nueva y reintentar.
const isNotFastForward = (error: unknown) =>
  error instanceof GithubApiError && error.status === 422 && /fast.?forward/i.test(error.message);

export const commitFiles = async (files: CommitFile[], message: string, options: CommitOptions = {}) => {
  const { owner, repo, branch } = getConfig();

  const writtenPaths = new Set(files.map(file => file.path));
  const deletePaths = Array.from(new Set(options.deletes ?? []))
    .filter(path => !writtenPaths.has(path));
  const existingDeletes = (await Promise.all(
    deletePaths.map(async path => ((await fileExists(path)) ? path : null))
  )).filter((path): path is string => path !== null);

  // Los blobs no dependen de la punta de la rama: se suben una sola vez.
  const blobItems = await Promise.all(files.map(async file => {
    const blob = await githubFetch<{ sha: string }>(`/repos/${owner}/${repo}/git/blobs`, {
      method: 'POST',
      body: JSON.stringify({
        content: file.content,
        encoding: file.encoding === 'base64' ? 'base64' : 'utf-8'
      })
    });

    return { path: file.path, mode: '100644', type: 'blob', sha: blob.sha as string | null };
  }));

  // sha: null le dice a la API de GitHub que borre esa ruta del arbol.
  const deleteItems = existingDeletes.map(path => ({
    path,
    mode: '100644',
    type: 'blob',
    sha: null as string | null
  }));
  const treeItems = [...blobItems, ...deleteItems];

  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_COMMIT_ATTEMPTS; attempt += 1) {
    const ref = await githubFetch<{ object: { sha: string } }>(
      `/repos/${owner}/${repo}/git/ref/heads/${branch}`
    );
    const baseCommitSha = ref.object.sha;
    const baseCommit = await githubFetch<{ tree: { sha: string } }>(
      `/repos/${owner}/${repo}/git/commits/${baseCommitSha}`
    );

    const tree = await githubFetch<{ sha: string }>(`/repos/${owner}/${repo}/git/trees`, {
      method: 'POST',
      body: JSON.stringify({ base_tree: baseCommit.tree.sha, tree: treeItems })
    });

    const commit = await githubFetch<{ sha: string; html_url: string }>(`/repos/${owner}/${repo}/git/commits`, {
      method: 'POST',
      body: JSON.stringify({ message, tree: tree.sha, parents: [baseCommitSha] })
    });

    try {
      await githubFetch(`/repos/${owner}/${repo}/git/refs/heads/${branch}`, {
        method: 'PATCH',
        body: JSON.stringify({ sha: commit.sha })
      });
      return commit;
    } catch (error) {
      if (!isNotFastForward(error)) throw error;
      lastError = error;
    }
  }

  throw new Error(
    `Otro cambio se publico al mismo tiempo y no pude reintentar con exito. Vuelve a guardar. (${String(lastError)})`
  );
};

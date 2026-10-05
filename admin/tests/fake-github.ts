// Simulador minimo de la API de GitHub sobre `fetch`, para probar commitFiles
// y los lectores sin red. Guarda cada peticion que recibe.

export type GithubRequest = { method: string; path: string; headers: Record<string, string>; body: unknown };

export type FakeGithubOptions = {
  // Rutas que "existen" en el repo (para borrar y para readFile).
  existing?: Record<string, { content: string; encoding?: string }>;
  // Respuestas sucesivas al PATCH que mueve la rama (200 = exito). Si se acaban, 200.
  patchStatuses?: number[];
  patchBody?: string;
  // Punta de la rama en cada lectura; la ultima se repite.
  heads?: string[];
  // Fuerza un estado en una ruta concreta (ej. 'POST /git/blobs').
  forced?: Record<string, { status: number; body?: string }>;
};

const json = (status: number, body: unknown) =>
  new Response(typeof body === 'string' ? body : JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' }
  });

export const fakeGithub = (options: FakeGithubOptions = {}) => {
  const requests: GithubRequest[] = [];
  const patchStatuses = [...(options.patchStatuses ?? [])];
  const heads = options.heads ?? ['head-1'];
  let headReads = 0;
  let counter = 0;

  const handler = async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(String(input));
    const method = (init.method ?? 'GET').toUpperCase();
    const path = url.pathname.replace(/^\/repos\/[^/]+\/[^/]+/, '');
    const body = typeof init.body === 'string' ? JSON.parse(init.body) : undefined;
    requests.push({ method, path: path + url.search, headers: { ...(init.headers as Record<string, string>) }, body });

    const forced = options.forced?.[`${method} ${path}`];
    if (forced) return json(forced.status, forced.body ?? 'forced');

    if (method === 'GET' && path.startsWith('/contents/')) {
      const file = options.existing?.[decodeURIComponent(path.slice('/contents/'.length))];
      if (!file) return json(404, '{"message":"Not Found"}');
      return json(200, {
        content: Buffer.from(file.content).toString('base64'),
        encoding: file.encoding ?? 'base64',
        sha: 'sha-existente'
      });
    }
    if (method === 'POST' && path === '/git/blobs') return json(201, { sha: `blob-${++counter}` });
    if (method === 'GET' && path.startsWith('/git/ref/heads/')) {
      const sha = heads[Math.min(headReads, heads.length - 1)];
      headReads += 1;
      return json(200, { object: { sha } });
    }
    if (method === 'GET' && path.startsWith('/git/commits/')) return json(200, { tree: { sha: 'tree-base' } });
    if (method === 'POST' && path === '/git/trees') return json(201, { sha: `tree-${++counter}` });
    if (method === 'POST' && path === '/git/commits') {
      return json(201, { sha: `commit-${++counter}`, html_url: 'https://github.com/o/r/commit/x' });
    }
    if (method === 'PATCH' && path.startsWith('/git/refs/heads/')) {
      const status = patchStatuses.shift() ?? 200;
      if (status === 422) return json(422, options.patchBody ?? '{"message":"Update is not a fast forward"}');
      return status === 200 ? json(200, {}) : json(status, '{"message":"error"}');
    }

    return json(500, `ruta no simulada: ${method} ${path}`);
  };

  return {
    handler,
    requests,
    // Peticiones filtradas por metodo y ruta.
    of: (method: string, prefix: string) =>
      requests.filter(request => request.method === method && request.path.startsWith(prefix))
  };
};

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GithubApiError, commitFiles, readFile, readJson } from '@/lib/github';
import { fakeGithub, type FakeGithubOptions } from './fake-github';

const useGithub = (options?: FakeGithubOptions) => {
  const github = fakeGithub(options);
  vi.stubGlobal('fetch', vi.fn(github.handler));
  return github;
};

beforeEach(() => {
  vi.stubEnv('GITHUB_TOKEN', 'token-de-prueba');
  vi.stubEnv('GITHUB_OWNER', 'dueno');
  vi.stubEnv('GITHUB_REPO', 'repo');
  vi.stubEnv('GITHUB_BRANCH', '');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('commitFiles: el commit', () => {
  it('sube un blob por archivo, arma el arbol sobre la punta, crea el commit y mueve la rama', async () => {
    const github = useGithub({ heads: ['punta-actual'] });

    const commit = await commitFiles(
      [{ path: 'a.html', content: '<a>' }, { path: 'b.json', content: '{}' }],
      'Mi mensaje'
    );

    expect(github.of('POST', '/git/blobs')).toHaveLength(2);
    const tree = github.of('POST', '/git/trees')[0].body as { base_tree: string; tree: Array<{ path: string; sha: string }> };
    expect(tree.base_tree).toBe('tree-base');
    expect(tree.tree.map(item => item.path)).toEqual(['a.html', 'b.json']);
    const created = github.of('POST', '/git/commits')[0].body as { message: string; parents: string[] };
    expect(created.message).toBe('Mi mensaje');
    expect(created.parents).toEqual(['punta-actual']);
    expect(github.of('PATCH', '/git/refs/heads/main')).toHaveLength(1);
    expect(commit.sha).toMatch(/^commit-/);
  });

  it('usa la rama "main" por defecto y respeta GITHUB_BRANCH', async () => {
    const porDefecto = useGithub();
    await commitFiles([{ path: 'a', content: 'x' }], 'm');
    expect(porDefecto.of('PATCH', '/git/refs/heads/main')).toHaveLength(1);

    vi.stubEnv('GITHUB_BRANCH', 'produccion');
    const otra = useGithub();
    await commitFiles([{ path: 'a', content: 'x' }], 'm');
    expect(otra.of('PATCH', '/git/refs/heads/produccion')).toHaveLength(1);
  });

  it('manda el token como Bearer y la version de la API', async () => {
    const github = useGithub();

    await commitFiles([{ path: 'a', content: 'x' }], 'm');

    const headers = github.requests[0].headers;
    expect(headers.Authorization).toBe('Bearer token-de-prueba');
    expect(headers['X-GitHub-Api-Version']).toBe('2022-11-28');
  });

  it('el contenido va como utf-8 salvo que el archivo diga base64', async () => {
    const github = useGithub();

    await commitFiles([
      { path: 'texto.html', content: 'hola' },
      { path: 'foto.png', content: 'AAAA', encoding: 'base64' }
    ], 'm');

    const bodies = github.of('POST', '/git/blobs').map(request => request.body);
    expect(bodies).toEqual([
      { content: 'hola', encoding: 'utf-8' },
      { content: 'AAAA', encoding: 'base64' }
    ]);
  });

  it('no se puede hacer un commit sin credenciales', async () => {
    useGithub();

    vi.stubEnv('GITHUB_TOKEN', '');
    await expect(commitFiles([{ path: 'a', content: 'x' }], 'm')).rejects.toThrow('Falta GITHUB_TOKEN.');
    vi.stubEnv('GITHUB_TOKEN', 't');
    vi.stubEnv('GITHUB_OWNER', '');
    await expect(commitFiles([{ path: 'a', content: 'x' }], 'm')).rejects.toThrow('Falta GITHUB_OWNER.');
    vi.stubEnv('GITHUB_OWNER', 'o');
    vi.stubEnv('GITHUB_REPO', '');
    await expect(commitFiles([{ path: 'a', content: 'x' }], 'm')).rejects.toThrow('Falta GITHUB_REPO.');
  });
});

describe('commitFiles: borrado', () => {
  const treeOf = (github: ReturnType<typeof fakeGithub>) =>
    (github.of('POST', '/git/trees')[0].body as { tree: Array<{ path: string; sha: string | null }> }).tree;

  it('una ruta que existe se borra con sha null (asi GitHub la quita del arbol)', async () => {
    const github = useGithub({ existing: { 'artistas/ana/index.html': { content: '<html>' } } });

    await commitFiles([{ path: 'sitemap.xml', content: 'x' }], 'm', { deletes: ['artistas/ana/index.html'] });

    expect(treeOf(github)).toContainEqual({ path: 'artistas/ana/index.html', mode: '100644', type: 'blob', sha: null });
  });

  it('una ruta que ya no existe se ignora (no rompe el commit)', async () => {
    const github = useGithub();

    await commitFiles([{ path: 'sitemap.xml', content: 'x' }], 'm', { deletes: ['artistas/fantasma/index.html'] });

    expect(treeOf(github).map(item => item.path)).toEqual(['sitemap.xml']);
  });

  it('si la misma ruta se escribe y se borra, gana escribirla y ni se consulta', async () => {
    const github = useGithub({ existing: { 'a.html': { content: 'viejo' } } });

    await commitFiles([{ path: 'a.html', content: 'nuevo' }], 'm', { deletes: ['a.html'] });

    expect(treeOf(github)).toEqual([expect.objectContaining({ path: 'a.html', sha: expect.stringMatching(/^blob-/) })]);
    expect(github.of('GET', '/contents/')).toHaveLength(0);
  });

  it('rutas repetidas en deletes se borran una sola vez', async () => {
    const github = useGithub({ existing: { 'x.html': { content: 'x' } } });

    await commitFiles([], 'm', { deletes: ['x.html', 'x.html'] });

    expect(treeOf(github).filter(item => item.path === 'x.html')).toHaveLength(1);
    expect(github.of('GET', '/contents/x.html')).toHaveLength(1);
  });

  it('las rutas con espacios u otros caracteres se codifican en la consulta', async () => {
    const github = useGithub();

    await commitFiles([], 'm', { deletes: ['estados/mi cancion/index.html'] });

    expect(github.of('GET', '/contents/')[0].path).toContain('estados/mi%20cancion/index.html');
  });
});

describe('commitFiles: otro commit entra al mismo tiempo (422 "not a fast forward")', () => {
  it('reintenta reconstruyendo el commit sobre la punta NUEVA, sin volver a subir los blobs', async () => {
    const github = useGithub({ patchStatuses: [422, 200], heads: ['punta-vieja', 'punta-nueva'] });

    await commitFiles([{ path: 'a.html', content: 'x' }], 'm');

    expect(github.of('POST', '/git/blobs')).toHaveLength(1);
    const commits = github.of('POST', '/git/commits').map(request => (request.body as { parents: string[] }).parents);
    expect(commits).toEqual([['punta-vieja'], ['punta-nueva']]);
    expect(github.of('PATCH', '/git/refs/heads/main')).toHaveLength(2);
  });

  it('tambien reintenta si el mensaje dice "fast-forward" con guion', async () => {
    const github = useGithub({ patchStatuses: [422, 200], patchBody: '{"message":"Update is not a fast-forward"}' });

    await commitFiles([{ path: 'a', content: 'x' }], 'm');

    expect(github.of('PATCH', '/git/refs/heads/main')).toHaveLength(2);
  });

  it('se rinde a los 3 intentos con un mensaje claro para volver a guardar', async () => {
    const github = useGithub({ patchStatuses: [422, 422, 422, 422] });

    const error = await commitFiles([{ path: 'a', content: 'x' }], 'm').catch(e => e);

    expect(error).toBeInstanceOf(Error);
    expect(error.message).toMatch(/Otro cambio se publico al mismo tiempo/);
    expect(error.message).toMatch(/Vuelve a guardar/);
    expect(github.of('PATCH', '/git/refs/heads/main')).toHaveLength(3);
  });

  it('un 422 que NO es de fast-forward no se reintenta: se propaga', async () => {
    const github = useGithub({ patchStatuses: [422], patchBody: '{"message":"Reference does not exist"}' });

    const error = await commitFiles([{ path: 'a', content: 'x' }], 'm').catch(e => e);

    expect(error).toBeInstanceOf(GithubApiError);
    expect(error.status).toBe(422);
    expect(github.of('PATCH', '/git/refs/heads/main')).toHaveLength(1);
  });

  it('otros errores (500, 403) no se reintentan y conservan el estado', async () => {
    const github = useGithub({ patchStatuses: [500] });

    const error = await commitFiles([{ path: 'a', content: 'x' }], 'm').catch(e => e);

    expect(error).toBeInstanceOf(GithubApiError);
    expect(error.status).toBe(500);
    expect(github.of('PATCH', '/git/refs/heads/main')).toHaveLength(1);
  });

  it('si GitHub rechaza subir un blob, el commit ni siquiera se crea', async () => {
    const github = useGithub({ forced: { 'POST /git/blobs': { status: 403, body: 'sin permiso' } } });

    const error = await commitFiles([{ path: 'a', content: 'x' }], 'm').catch(e => e);

    expect(error).toBeInstanceOf(GithubApiError);
    expect(error.status).toBe(403);
    expect(github.of('POST', '/git/commits')).toHaveLength(0);
    expect(github.of('PATCH', '/git/refs/')).toHaveLength(0);
  });
});

describe('readFile y readJson', () => {
  it('readFile decodifica el contenido base64 como utf-8 (con tildes)', async () => {
    useGithub({ existing: { 'casa-catalog.json': { content: '{"nombre":"canción"}' } } });

    expect(await readFile('casa-catalog.json')).toBe('{"nombre":"canción"}');
  });

  it('readFile rechaza un encoding que no entiende', async () => {
    useGithub({ existing: { 'raro.txt': { content: 'x', encoding: 'none' } } });

    await expect(readFile('raro.txt')).rejects.toThrow(/Encoding no soportado/);
  });

  it('readJson parsea el archivo', async () => {
    useGithub({ existing: { 'a.json': { content: '{"ok":true}' } } });

    expect(await readJson('a.json', { ok: false })).toEqual({ ok: true });
  });

  it('readJson devuelve el valor por defecto si el archivo no existe (404)', async () => {
    useGithub();

    expect(await readJson('no-existe.json', { releases: [] })).toEqual({ releases: [] });
  });

  it('readJson NO esconde otros errores (un 500 se propaga)', async () => {
    useGithub({ forced: { 'GET /contents/a.json': { status: 500, body: 'caido' } } });

    await expect(readJson('a.json', {})).rejects.toBeInstanceOf(GithubApiError);
  });

  it('readJson NO esconde un JSON roto', async () => {
    useGithub({ existing: { 'roto.json': { content: '{no es json' } } });

    await expect(readJson('roto.json', {})).rejects.toThrow(SyntaxError);
  });
});

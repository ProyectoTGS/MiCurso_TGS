import { test, expect, type BrowserContext } from '@playwright/test';
import nextEnv from '@next/env';

nextEnv.loadEnvConfig(process.cwd());
const authOrigin = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const storageKey = `sb-${new URL(authOrigin).hostname.split('.')[0]}-auth-token`;
const classId = '00000000-0000-4000-8000-000000000010';
const classCode = 'ABCDEF123456';
const className = 'Historia de prueba';
const ids = {
  student: '00000000-0000-4000-8000-000000000001',
  teacher: '00000000-0000-4000-8000-000000000002',
  admin: '00000000-0000-4000-8000-000000000003',
};
type Kind = keyof typeof ids;
function user(kind: Kind) {
  return { id: ids[kind], email: `${kind}@example.test`, aud: 'authenticated', role: 'authenticated', app_metadata: { provider: 'google' }, user_metadata: {}, created_at: new Date().toISOString() };
}
function session(kind: Kind) {
  const payload = Buffer.from(JSON.stringify({ sub: ids[kind], exp: Math.floor(Date.now() / 1000) + 3600, role: 'authenticated' })).toString('base64url');
  return { access_token: `eyJhbGciOiJIUzI1NiJ9.${payload}.test-only`, refresh_token: 'test-only', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user: user(kind) };
}
function profile(kind: Kind) {
  return { id: ids[kind], username: kind, role: kind === 'admin' ? 'admin' : 'alumno', activo: true, es_profesor: kind === 'teacher', curso_id: null as string | null, created_at: new Date().toISOString() };
}
async function fixture(context: BrowserContext, initial: Kind | null, missingProfile = false) {
  const profiles: Record<string, ReturnType<typeof profile>> = {};
  for (const kind of ['student', 'teacher', 'admin'] as const) profiles[ids[kind]] = profile(kind);
  if (initial && missingProfile) delete profiles[ids[initial]];
  const rpcCalls: string[] = [];
  let holdAdmin: Promise<void> | null = null;
  // All backend requests are intercepted; these sessions never reach Supabase.
  await context.route(`${authOrigin}/**`, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const token = req.headers()['authorization']?.replace('Bearer ', '');
    let currentId: string | undefined;
    try { currentId = JSON.parse(Buffer.from(token?.split('.')[1] ?? '', 'base64url').toString()).sub; } catch {}
    const kind = (Object.keys(ids) as Kind[]).find(k => ids[k] === currentId);
    const reply = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (url.pathname.endsWith('/settings')) return reply({ external: { google: true } });
    if (url.pathname.endsWith('/user')) return reply(kind ? user(kind) : { message: 'no session' }, kind ? 200 : 401);
    if (url.pathname.endsWith('/logout')) return reply({});
    if (url.pathname.endsWith('/authorize')) return route.fulfill({ contentType: 'text/html', body: 'Google test redirect' });
    if (url.pathname === '/rest/v1/profiles') {
      if (req.method() === 'POST') {
        const body = req.postDataJSON();
        profiles[body.id] = { ...profile(body.es_profesor ? 'teacher' : 'student'), ...body };
        return reply(null, 201);
      }
      const id = url.searchParams.get('id')?.replace('eq.', '');
      const result = id ? (profiles[id] ? [profiles[id]] : []) : Object.values(profiles);
      if (id === ids.admin && holdAdmin) await holdAdmin;
      return reply(result);
    }
    if (url.pathname === '/rest/v1/cursos') return reply(url.searchParams.has('id') ? { id: classId, nombre: className } : []);
    if (url.pathname.includes('/rpc/')) {
      const name = url.pathname.split('/').pop()!;
      rpcCalls.push(name);
      if (name === 'mi_codigo_clase') return reply(classCode);
      if (name === 'crear_clase' || name === 'unirse_clase') {
        if (name === 'unirse_clase' && req.postDataJSON().codigo_clase !== classCode) return reply({ message: 'El código de clase no es válido.', code: 'P0001' }, 400);
        profiles[currentId!].curso_id = classId;
        return reply(classId);
      }
    }
    if (url.pathname === '/rest/v1/publicaciones' || url.pathname === '/rest/v1/historial') return reply([]);
    throw new Error(`Unexpected backend request: ${req.method()} ${url.pathname}`);
  });
  await context.route('**/*plasmic.app/**', route => route.abort());
  await context.addInitScript(({ key, value }) => {
    if (!sessionStorage.getItem('test-initialized')) {
      if (value) localStorage.setItem(key, JSON.stringify(value));
      sessionStorage.setItem('test-initialized', 'yes');
    }
  }, { key: storageKey, value: initial ? session(initial) : null });
  return {
    rpcCalls,
    holdAdminUntil: (promise: Promise<void>) => { holdAdmin = promise; },
  };
}
async function changeSession(context: BrowserContext, kind: Kind | null) {
  await context.pages()[0].evaluate(({ key, value }) => {
    if (value) localStorage.setItem(key, JSON.stringify(value)); else localStorage.removeItem(key);
    const channel = new BroadcastChannel(key);
    channel.postMessage({ event: value ? 'SIGNED_IN' : 'SIGNED_OUT', session: value });
    channel.close();
  }, { key: storageKey, value: kind ? session(kind) : null });
}

test('new Google student chooses account type and joins only with a valid code', async ({ context, page }) => {
  const f = await fixture(context, 'student', true);
  await page.goto('/');
  await page.getByLabel('Nombre de usuario').fill('alumno-nuevo');
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Entrar a una clase' })).toBeVisible();
  await expect(page.getByText('student@example.test')).toBeVisible();
  await expect(page.getByLabel('Nombre de la clase')).toHaveCount(0);
  await page.getByLabel('Código de clase').fill('000000000000');
  await page.getByRole('button', { name: 'Entrar a la clase', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('no es válido');
  await page.getByLabel('Código de clase').fill(classCode.toLowerCase());
  await page.getByRole('button', { name: 'Entrar a la clase', exact: true }).click();
  await expect(page.getByRole('heading', { name: className })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Administración', exact: true })).toHaveCount(0);
  expect(f.rpcCalls).toEqual(['unirse_clase', 'unirse_clase']);
});

test('new Google professor creates a class and receives the code without admin access', async ({ context, page }) => {
  const f = await fixture(context, 'teacher', true);
  await page.goto('/');
  await page.getByLabel('Nombre de usuario').fill('profesor-nuevo');
  await page.getByLabel('Tipo de cuenta').selectOption('profesor');
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Crear una clase' })).toBeVisible();
  await expect(page.getByLabel('Código de clase')).toHaveCount(0);
  await page.getByLabel('Nombre de la clase').fill(className);
  await page.getByRole('button', { name: 'Crear una clase', exact: true }).click();
  await expect(page.getByRole('heading', { name: className })).toBeVisible();
  await expect(page.getByText(classCode, { exact: true })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Administración', exact: true })).toHaveCount(0);
  expect(f.rpcCalls).toContain('crear_clase');
});

for (const kind of ['student', 'teacher', null] as const) {
  test(`${kind ?? 'anonymous'} cannot open /admin directly`, async ({ context, page }) => {
    await fixture(context, kind);
    await page.goto('/admin');
    await expect(page).toHaveURL('http://127.0.0.1:3101/');
    await expect(page.getByRole('heading', { name: kind === 'student' ? 'Entrar a una clase' : kind === 'teacher' ? 'Crear una clase' : 'Iniciar sesión' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Administración', exact: true })).toHaveCount(0);
  });
}

test('open admin tab is cleared when another tab changes to a student session', async ({ context, page }) => {
  await fixture(context, 'admin');
  await page.goto('/admin');
  await expect(page.getByRole('navigation', { name: 'Administración', exact: true })).toBeVisible();
  await changeSession(context, 'student');
  await expect(page.getByRole('heading', { name: 'Entrar a una clase' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Administración', exact: true })).toHaveCount(0);
});

test('a late admin response cannot restore admin UI after logout', async ({ context, page }) => {
  const f = await fixture(context, 'admin');
  let release!: () => void;
  f.holdAdminUntil(new Promise<void>(resolve => { release = resolve; }));
  const profileRequest = page.waitForRequest(req => req.url().includes(`/profiles?`) && req.url().includes(ids.admin));
  await page.goto('/admin');
  await profileRequest;
  await changeSession(context, null);
  release();
  await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Administración', exact: true })).toHaveCount(0);
});

test('Google login explicitly asks for account selection', async ({ context, page }) => {
  await fixture(context, null);
  await page.goto('/');
  await page.getByRole('button', { name: 'Continuar con Google' }).click();
  await expect(page).toHaveURL(/prompt=select_account/);
});

test.describe('installed app offline behavior', () => {
  test.use({ serviceWorkers: 'allow' });
  test('an admin page is never reused as the homepage when offline', async ({ context, page }) => {
    await fixture(context, 'admin');
    await page.goto('/admin');
    await expect(page.getByRole('navigation', { name: 'Administración', exact: true })).toBeVisible();
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
      if (!navigator.serviceWorker.controller) await new Promise<void>(resolve => navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true }));
    });
    await context.setOffline(true);
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Necesitás conexión' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Administración', exact: true })).toHaveCount(0);
  });
});

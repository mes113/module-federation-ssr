import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const host = 'http://127.0.0.1:3005';
const remote = 'http://127.0.0.1:3004';

test('SSR markup, CSS and concurrent host requests', async () => {
  const responses = await Promise.all(Array.from({ length: 4 }, () => fetch(host)));
  for (const response of responses) {
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.match(html, /data-remote="catalog"/);
    assert.match(html, /data-remote="cart"/);
    assert.match(html, /http:\/\/127.0.0.1:3006\/[^" ]+\.css/);
    assert.match(html, /Rendered on the server/);
    assert.match(html, /SSR server function:/);
    assert.match(html, /http:\/\/127.0.0.1:3004\/[^" ]+\.css/);
  }
  const manifest = await fetch(`${remote}/mf-manifest.json`).then(r => r.json());
  assert.ok(JSON.stringify(manifest).includes('remoteEntry.ssr.cjs'));
});

test('hydration, shared context, host RPC and native remote RPC ownership', async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(host);
    const card = page.locator('[data-remote="catalog"]');
    await card.getByText('Hydrated on the host', { exact: true }).waitFor();
    assert.match(await card.locator('.host-name').innerText(), /Rsbuild SSR host/);
    await card.getByRole('button', { name: 'Remote count 0', exact: true }).click();
    await card.getByRole('button', { name: 'Remote count 1', exact: true }).waitFor();
    const rpc = page.waitForResponse(r => r.url().includes('_serverFn/') && r.request().method() === 'POST');
    await card.getByRole('button', { name: 'Call host server function', exact: true }).click();
    const response = await rpc;
    assert.equal(new URL(response.url()).origin, host);
    assert.equal(response.status(), 200);
    await card.getByText('Host server function OK', { exact: true }).waitFor();
    await card.getByRole('button', { name: 'Remote count 2', exact: true }).waitFor();
    assert.deepEqual(errors, []);

    const native = page.waitForResponse(r => r.url().includes('_serverFn/') && r.request().method() === 'POST');
    await card.getByRole('button', { name: 'Call remote native server function', exact: true }).click();
    const nativeResponse = await native;
    console.log('Native remote RPC through host:', nativeResponse.status(), nativeResponse.url());
    await page.waitForFunction(() => document.querySelector('[data-remote="catalog"] [data-testid="remote-rpc"]').textContent !== 'Not called');
    const nativeResult = await card.getByTestId('remote-rpc').innerText();
    console.log('Native result:', nativeResult);
    assert.equal(JSON.parse(nativeResult).owner, 'remote');
    assert.equal(new URL(nativeResponse.url()).origin, host);
    assert.equal(nativeResponse.status(), 200);
    assert.ok(nativeResponse.url().includes('/_federation/catalog/_serverFn/'));
    const ssrText = await page.getByTestId('catalog-ssr').innerText();
    const pids = ssrText.match(/pid (\d+).*host pid (\d+)/);
    assert.ok(pids);
    assert.notEqual(pids[1], pids[2], 'SSR RPC must execute on remote backend');

    await page.goto(remote);
    await page.getByText('Hydrated on the host', { exact: true }).waitFor();
    await card.getByRole('button', { name: 'Call remote native server function', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('[data-remote="catalog"] [data-testid="remote-rpc"]').textContent.includes('"owner":"remote"'));
    console.log('Standalone remote RPC:', await card.getByTestId('remote-rpc').innerText());
  } finally { await browser.close(); }
});

// Build first: this checks that the executable backend handler is absent from public assets.
test('public browser and SSR federation assets exclude backend handler implementation', async () => {
  for (const app of ['remote', 'remote-cart']) {
  const root = new URL(`../apps/${app}/dist/client/`, import.meta.url);
  const files = await readdir(root, { recursive: true });
  let checked = 0;
  for (const file of files.filter(file => /\.(?:js|cjs)$/.test(file))) {
    const source = await readFile(new URL(file, root), 'utf8');
    assert.ok(!/REMOTE_BACKEND_HANDLER_MARKER|CART_BACKEND_HANDLER_MARKER/.test(source), `Backend implementation leaked into ${file}`);
    checked++;
  }
  assert.ok(checked > 0, 'Build remote first');
  }
});

test('parallel browser RPCs remain isolated between catalog and cart', async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(host);
    const pids = [];
    for (const name of ['catalog', 'cart']) {
      const card = page.locator(`[data-remote="${name}"]`);
      await card.getByText('Hydrated on the host', { exact: true }).waitFor();
      const text = await page.getByTestId(`${name}-ssr`).innerText();
      const match = text.match(/pid (\d+).*host pid (\d+)/);
      assert.ok(match);
      assert.notEqual(match[1], match[2]);
      pids.push(match[1]);
    }
    assert.notEqual(pids[0], pids[1]);
    for (let round = 0; round < 3; round++) {
      const responses = ['catalog', 'cart'].map(name => page.waitForResponse(r => r.url().includes(`/_federation/${name}/_serverFn/`) && r.request().method() === 'POST'));
      await page.getByRole('button', { name: 'Call remote native server function', exact: true }).evaluateAll(buttons => buttons.forEach(button => button.click()));
      for (const response of await Promise.all(responses)) assert.equal(response.status(), 200);
      await page.waitForFunction(() => ['catalog', 'cart'].every(name => document.querySelector(`[data-remote="${name}"] [data-testid="remote-rpc"]`).textContent.includes('"owner"')));
      for (const [index, name] of ['catalog', 'cart'].entries()) {
        const data = JSON.parse(await page.locator(`[data-remote="${name}"]`).getByTestId('remote-rpc').innerText());
        assert.equal(data.owner, name === 'catalog' ? 'remote' : 'cart');
        assert.equal(String(data.pid), pids[index]);
      }
    }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

/**
 * O teste autoritativo do requisito que a documentacao do projeto afirma quatro vezes:
 * "O programa nao acessa a internet."
 *
 * Como ele e feito, e por que assim:
 *
 *   `page.route('**')` aborta TODA requisicao cujo destino nao seja o servidor local. Se o
 *   programa depender de um CDN, de uma fonte do Google ou de um transcodificador remoto, ele
 *   quebra aqui e nao na entrega.
 *
 *   `serviceWorkers: 'block'` (em playwright.config.ts) nao e zelo. Sem ele, requisicoes feitas
 *   de dentro de um service worker escapam do `page.route`, e este teste passaria verde com o
 *   programa baixando coisa pelas costas.
 *
 * Um lint de string procurando "https://" em dist/ foi descartado como regra principal: todo SVG
 * embute o namespace `www.w3.org` e o teste daria falso positivo garantido no primeiro dia — e
 * teste que nasce vermelho e o primeiro a ser desligado.
 */
import { expect, test } from '@playwright/test';
import { abrir } from './preparar.ts';

const LOCAL = 'http://127.0.0.1:8731';

test.beforeEach(async ({ page }) => {
  await page.route('**', (rota) => {
    const url = rota.request().url();
    if (url.startsWith(LOCAL) || url.startsWith('data:') || url.startsWith('blob:')) {
      return rota.continue();
    }
    return rota.abort();
  });
});

test('a pagina abre com todo acesso externo bloqueado', async ({ page }) => {
  const problemas: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') problemas.push(msg.text());
  });
  page.on('pageerror', (erro) => problemas.push(erro.message));

  await abrir(page);
  // Nao basta a pagina carregar: o programa tem de chegar ate o ponto em que a
  // fisica ja rodou e a interface ja mostra um numero saido dela. Uma pagina
  // que abre e fica em branco passaria numa verificacao mais fraca.
  await expect(page.getByRole('banner')).toBeVisible();
  await expect(page.getByRole('listbox', { name: /corpos/i })).toBeVisible();
  await expect(page.getByRole('option', { name: 'Netuno' })).toBeVisible();
  expect(problemas).toEqual([]);
});

test('nenhuma requisicao sai para fora do servidor local', async ({ page }) => {
  const fugas: string[] = [];
  page.on('request', (req) => {
    const url = req.url();
    if (!url.startsWith(LOCAL) && !url.startsWith('data:') && !url.startsWith('blob:')) {
      fugas.push(url);
    }
  });

  await abrir(page);
  await page.waitForLoadState('networkidle');
  expect(fugas).toEqual([]);
});

test('o servidor envia os cabecalhos de isolamento de origem', async ({ page }) => {
  const resposta = await page.goto('/');
  const cabecalhos = resposta?.headers() ?? {};
  expect(cabecalhos['cross-origin-opener-policy']).toBe('same-origin');
  expect(cabecalhos['cross-origin-embedder-policy']).toBe('require-corp');
  expect(cabecalhos['x-content-type-options']).toBe('nosniff');
});

test('as preferencias vao e voltam pelo arquivo, nao pelo navegador', async ({ request }) => {
  const marca = { fase: 'F0', escalaTexto: 1.25 };

  const gravacao = await request.put(`${LOCAL}/preferencias.json`, { data: marca });
  expect(gravacao.status()).toBe(204);

  const leitura = await request.get(`${LOCAL}/preferencias.json`);
  expect(leitura.status()).toBe(200);
  expect(await leitura.json()).toEqual(marca);

  // Cada um destes deixaria o carregador de preferencias recebendo algo que nao e um objeto na
  // proxima abertura. Os tres ultimos sao JSON PERFEITAMENTE VALIDO, e foi assim que a primeira
  // versao deste teste passou verde com o servidor aceitando gravar `42` no arquivo:
  // `data` em string o Playwright codifica como JSON, entao 'nao sou json' chegava como
  // `"nao sou json"`, que e uma string JSON valida. Daqui em diante o corpo vai como bytes.
  const lixos = ['nao sou json', '"so uma string"', '42', '[1, 2, 3]', 'null'];
  for (const lixo of lixos) {
    const recusa = await request.put(`${LOCAL}/preferencias.json`, {
      headers: { 'content-type': 'application/json' },
      data: Buffer.from(lixo, 'utf8'),
    });
    expect(recusa.status(), `deveria recusar: ${lixo}`).toBe(400);
  }

  // e o conteudo bom continua la, intacto
  expect(await (await request.get(`${LOCAL}/preferencias.json`)).json()).toEqual(marca);
});

test('nao da para subir de pasta pelo caminho da URL', async ({ request }) => {
  for (const tentativa of ['/../package.json', '/..%2fpackage.json', '/%2e%2e/servidor.mjs']) {
    const resposta = await request.get(`${LOCAL}${tentativa}`, { maxRedirects: 0 });
    expect(resposta.status(), tentativa).toBeGreaterThanOrEqual(400);
  }
});

test('a batida mantem o servidor de pe', async ({ request }) => {
  const resposta = await request.get(`${LOCAL}/_batida`);
  expect(resposta.status()).toBe(204);
});

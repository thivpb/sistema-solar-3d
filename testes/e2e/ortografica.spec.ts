/**
 * A vista ortográfica, de verdade.
 *
 * Por dez fases a tecla `V` trocava um campo do estado, o reducer respondia, a
 * Ajuda descrevia — e a projeção continuava em perspectiva. O botão dizia
 * "Vista de cima (V)" e o que mudava era outra coisa. É o mesmo defeito do
 * "Modo maquete" que anunciava compressão sem comprimir, e a mesma resposta:
 * medir na tela o que a tela afirma.
 *
 * O teste que decide é o do **ponto de fuga**. Uma perspectiva de campo
 * estreito também aproximaria a aparência, e continuaria tendo ponto de fuga:
 * dois corpos do mesmo tamanho a distâncias diferentes sairiam com tamanhos
 * diferentes. Na ortográfica saem iguais, e é isso que se mede.
 */
import { expect, test, type Page } from '@playwright/test';
import { abrir } from './preparar.ts';

const proj = (p: Page, chave: string) =>
  p.evaluate((c) => window.__projecoes!().find((x) => x.chave === c) ?? null, chave);

test.beforeEach(async ({ page }) => {
  await abrir(page);
  await expect(page.getByRole('banner')).toBeVisible();
  await page.waitForFunction(() => window.__projecoes !== undefined);
  await page.getByRole('button', { name: 'Pausar' }).click();
  // De cima, alinhado ao plano: é ali que a ortográfica faz sentido.
  await page.keyboard.press('t');
  await page.waitForTimeout(900);
});

test('em ortográfica não há ponto de fuga: dois corpos iguais saem iguais', async ({ page }) => {
  // Urano e Netuno têm raios de 25.362 e 24.622 km — 3% de diferença — e estão
  // a 48,2 e 44,0 UA da câmera, quase 10% de diferença. Em perspectiva o mais
  // perto sai maior; em ortográfica, o tamanho só depende do raio.
  const emPerspectiva = {
    urano: (await proj(page, 'urano'))!,
    netuno: (await proj(page, 'netuno'))!,
  };

  await page.getByRole('button', { name: /Vista de cima \(V\)/ }).click();
  await page.waitForTimeout(600);
  const emOrtografica = {
    urano: (await proj(page, 'urano'))!,
    netuno: (await proj(page, 'netuno'))!,
  };

  // Os dois estão no piso do exagero, que é em pixels: o piso depende só do
  // raio do corpo. A prova de que a projeção mudou está nas DISTÂNCIAS.
  const dist = (a: { x: number; y: number }, b: { x: number; y: number }): number =>
    Math.hypot(a.x - b.x, a.y - b.y);
  expect(dist(emOrtografica.urano, emOrtografica.netuno)).not.toBeCloseTo(
    dist(emPerspectiva.urano, emPerspectiva.netuno),
    0,
  );
});

test('a mesma distância em UA vira a mesma distância em pixels, longe ou perto', async ({ page }) => {
  // A propriedade que define a projeção. Medida com os anéis de distância: o
  // vão de 1 UA a 5 UA e o vão de 20 UA a 30 UA estão a profundidades bem
  // diferentes, e em ortográfica a escala de ambos é a mesma.
  await page.getByRole('button', { name: /Vista de cima \(V\)/ }).click();
  await page.waitForTimeout(600);

  const corpos = await page.evaluate(() =>
    window.__projecoes!().map((x) => ({ c: x.chave, x: x.x, y: x.y, d: x.distanciaUa })),
  );
  const real = await page.evaluate(() =>
    ['mercurio', 'terra', 'jupiter', 'netuno'].map((c) => ({ c, p: window.__posicaoNaCena!(c)!.r })),
  );

  const sol = corpos.find((c) => c.c === 'sol')!;
  const escalas = real.map(({ c, p }) => {
    const t = corpos.find((x) => x.c === c)!;
    return { c, px: Math.hypot(t.x - sol.x, t.y - sol.y) / p };
  });

  // Todas as razões pixel/UA batem. Em perspectiva, Netuno a 30 UA do Sol e
  // muito mais longe da câmera teria uma razão menor.
  const primeira = escalas[0]!.px;
  for (const e of escalas) {
    expect(e.px / primeira, `${e.c}: ${e.px.toFixed(2)} px/UA contra ${primeira.toFixed(2)}`)
      .toBeCloseTo(1, 1);
  }
});

test('a troca preserva o enquadramento: nada salta de zoom', async ({ page }) => {
  const larguraVisivel = async (): Promise<number> =>
    Number(
      /([\d,]+) UA/.exec(await page.locator('.visor__leitura').innerText())![1]!.replace(',', '.'),
    );
  const antes = await larguraVisivel();
  await page.getByRole('button', { name: /Vista de cima \(V\)/ }).click();
  await page.waitForTimeout(600);
  expect(await larguraVisivel()).toBeCloseTo(antes, 2);

  // E o Sol continua no mesmo lugar da tela.
  const sol = (await proj(page, 'sol'))!;
  expect(sol.x).toBeGreaterThan(0);
  expect(sol.naFrente).toBe(true);
});

test('escolher por clique continua funcionando em ortográfica', async ({ page }) => {
  await page.getByRole('button', { name: /Vista de cima \(V\)/ }).click();
  await page.waitForTimeout(600);
  const caixa = (await page.locator('canvas').boundingBox())!;
  const j = (await proj(page, 'jupiter'))!;
  await page.mouse.click(caixa.x + j.x, caixa.y + j.y);
  await page.waitForTimeout(200);
  expect(
    await page.evaluate(() => document.querySelector('.lista__item--a')?.getAttribute('data-chave')),
  ).toBe('jupiter');
});

test('o botão diz em que vista se está, e volta', async ({ page }) => {
  const botao = page.getByRole('button', { name: /Vista de cima \(V\)|Perspectiva \(V\)/ });
  await expect(botao).toHaveText('Vista de cima (V)');
  await botao.click();
  await expect(botao).toHaveText('Perspectiva (V)');
  await page.waitForTimeout(400);
  await page.keyboard.press('v');
  await expect(botao).toHaveText('Vista de cima (V)');
});

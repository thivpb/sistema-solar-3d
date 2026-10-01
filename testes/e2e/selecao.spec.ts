/**
 * Escolher um corpo clicando nele, e aproximar ancorado no cursor.
 *
 * Os dois itens do contrato que dependiam da mesma peça ausente — saber que
 * corpo está sob um pixel. Por dez fases a única forma de escolher um corpo
 * era a lista lateral, e a única forma de aproximar era o centro da tela.
 */
import { expect, test, type Page } from '@playwright/test';
import { abrir } from './preparar.ts';

const selecionado = (p: Page): Promise<string | null> =>
  p.evaluate(() => document.querySelector('.lista__item--a')?.getAttribute('data-chave') ?? null);

/** Onde um corpo caiu na tela, em pixels CSS, segundo a própria cena. */
async function naTela(p: Page, chave: string): Promise<{ x: number; y: number; r: number } | null> {
  return p.evaluate((c) => {
    const proj = window.__projecoes?.();
    const a = proj?.find((x) => x.chave === c);
    return a && a.naFrente ? { x: a.x, y: a.y, r: a.raioPx } : null;
  }, chave);
}

test.beforeEach(async ({ page }) => {
  await abrir(page);
  await expect(page.getByRole('banner')).toBeVisible();
  await page.waitForFunction(() => window.__projecoes !== undefined);
  await page.getByRole('button', { name: 'Pausar' }).click();
  await page.waitForTimeout(400);
});

test('clicar num planeta o escolhe', async ({ page }) => {
  const caixa = (await page.locator('canvas').boundingBox())!;
  // Corpos soltos no quadro. A Terra fica de fora de proposito: na data de
  // partida ela está ATRÁS do disco desenhado do Sol — a 32,35 UA contra
  // 31,49 —, e não se clica no que está escondido. É a consequência honesta
  // do exagero de tamanho, e o teste da oclusão logo abaixo é quem a cobre.
  for (const corpo of ['jupiter', 'saturno', 'urano']) {
    const onde = await naTela(page, corpo);
    expect(onde, `${corpo} não está na tela`).not.toBeNull();
    await page.mouse.click(caixa.x + onde!.x, caixa.y + onde!.y);
    await page.waitForTimeout(150);
    expect(await selecionado(page), `cliquei em ${corpo}`).toBe(corpo);
  }
});

test('clicar no vazio não desfaz a escolha', async ({ page }) => {
  const caixa = (await page.locator('canvas').boundingBox())!;
  const onde = (await naTela(page, 'jupiter'))!;
  await page.mouse.click(caixa.x + onde.x, caixa.y + onde.y);
  await page.waitForTimeout(150);
  expect(await selecionado(page)).toBe('jupiter');

  // Um canto vazio. Apagar a escolha por um clique errado seria pior que
  // ignorar: a ficha some e a pessoa não sabe o que fez.
  await page.mouse.click(caixa.x + 20, caixa.y + caixa.height - 20);
  await page.waitForTimeout(150);
  expect(await selecionado(page)).toBe('jupiter');
});

test('um corpo pequeno continua clicável: o alvo tem 24 px', async ({ page }) => {
  // Marte na visão geral tem uns quatro pixels de disco. Sem o piso de alvo,
  // escolhê-lo com o ponteiro exigiria precisão de cirurgião, e a regra "todo
  // gesto de ponteiro tem caminho por teclado" viraria "só o teclado funciona".
  const caixa = (await page.locator('canvas').boundingBox())!;
  const onde = (await naTela(page, 'marte'))!;
  expect(onde.r, 'Marte deveria ser pequeno na visão geral').toBeLessThan(8);
  // Para baixo e para a direita: o lado onde Marte não tem vizinho perto.
  await page.mouse.click(caixa.x + onde.x + 6, caixa.y + onde.y + 7);
  await page.waitForTimeout(150);
  expect(await selecionado(page)).toBe('marte');
});

test('não se clica no que está atrás de outro corpo', async ({ page }) => {
  // **Qual corpo está escondido é PROCURADO, e não escrito aqui.**
  //
  // Era a Terra, atrás do disco desenhado do Sol na data de partida. Mas quem
  // fica atrás de quem depende do enquadramento, e o enquadramento depende da
  // proporção do canvas: mudar a altura da barra de cima foi o bastante para a
  // Terra sair de trás do Sol, e o teste passou a falhar sem que nada do que
  // ele mede tivesse mudado. Um teste que depende de uma coincidência
  // geométrica é um teste que reprova por motivo errado.
  //
  // O que se afirma é a propriedade: no pixel de um corpo ocluído, quem se
  // escolhe é quem está na FRENTE.
  const caixa = (await page.locator('canvas').boundingBox())!;
  const procurar = (): Promise<{ chave: string; x: number; y: number; naFrente: string | null } | null> =>
    page.evaluate(() => {
      const p = window.__projecoes!().find((x) => x.ocluido && x.naFrente);
      if (!p) return null;
      return { chave: p.chave, x: p.x, y: p.y, naFrente: window.__corpoEm!(p.x, p.y) };
    });

  // A cena de partida não tem oclusão nenhuma com esta proporção de canvas, e
  // é por isso que o tempo ANDA aqui: um passo de cada vez, pausado, até algum
  // corpo passar atrás de outro. Medido, acontece em menos de cem passos — na
  // prática Mercúrio passa atrás do disco desenhado do Sol.
  let atras = await procurar();
  for (let k = 0; atras === null && k < 20; k++) {
    for (let i = 0; i < 10; i++) await page.keyboard.press('.');
    await page.waitForTimeout(60);
    atras = await procurar();
  }
  expect(atras, 'nenhum corpo passou atrás de outro em 200 passos: a cena mudou')
    .not.toBeNull();
  // A guarda que impede o caso trivial: se o próprio corpo escondido fosse o
  // que está sob o pixel, não haveria oclusão nenhuma para medir.
  expect(atras!.naFrente, `${atras!.chave} está "ocluído" por si mesmo`).not.toBe(atras!.chave);

  await page.mouse.click(caixa.x + atras!.x, caixa.y + atras!.y);
  await page.waitForTimeout(150);
  expect(await selecionado(page), `cliquei no pixel de ${atras!.chave}`).toBe(atras!.naFrente);
});

test('duplo clique acompanha o corpo', async ({ page }) => {
  const caixa = (await page.locator('canvas').boundingBox())!;
  const onde = (await naTela(page, 'marte'))!;
  await page.mouse.dblclick(caixa.x + onde.x, caixa.y + onde.y);
  await page.waitForTimeout(800);
  expect(await selecionado(page)).toBe('marte');
  await expect(page.getByRole('button', { name: 'Soltar', exact: true })).toBeVisible();
});

test('a roda aproxima mantendo fixo o que está sob o cursor', async ({ page }) => {
  // A propriedade inteira, medida na tela: onde Júpiter estava sob o cursor,
  // ali ele continua depois de três voltas de roda.
  const caixa = (await page.locator('canvas').boundingBox())!;
  const antes = (await naTela(page, 'jupiter'))!;
  await page.mouse.move(caixa.x + antes.x, caixa.y + antes.y);
  for (let k = 0; k < 3; k++) {
    await page.mouse.wheel(0, -240);
    await page.waitForTimeout(120);
  }
  const depois = (await naTela(page, 'jupiter'))!;
  const andou = Math.hypot(depois.x - antes.x, depois.y - antes.y);
  expect(andou, `Júpiter andou ${andou.toFixed(1)} px sob o cursor`).toBeLessThan(12);

  // E aproximou mesmo. O que se mede é o RAIO DA CÂMERA, e não o disco: na
  // visão geral o desenho de Júpiter está no piso do exagero — 12,4 px — e
  // continua no piso depois de três voltas de roda. Medir o disco aqui seria
  // medir o piso, que não se mexe.
  const raio = await page.evaluate(() => window.__camera!.raio);
  expect(raio, `raio ${raio}`).toBeLessThan(31.5 / 2);
});

test('a roda no centro continua funcionando como antes', async ({ page }) => {
  const caixa = (await page.locator('canvas').boundingBox())!;
  const raio = (): Promise<number> => page.evaluate(() => window.__camera!.raio);
  const antes = await raio();
  await page.mouse.move(caixa.x + caixa.width / 2, caixa.y + caixa.height / 2);
  await page.mouse.wheel(0, -240);
  await page.waitForTimeout(150);
  expect(await raio()).toBeLessThan(antes);
});

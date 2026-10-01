/**
 * O duplo clique leva a camera ate o corpo, e o resto do sistema recua.
 *
 * Antes desta feature, escolher um corpo nao levava a lugar nenhum: o clique
 * mostrava os numeros e a camera ficava onde estava. O programa carregava uma
 * textura de 4K, desenhava o terminador com penumbra e as duas sombras do anel,
 * e nada disso era visto porque nunca se chegava perto — o duplo clique
 * enquadrava a ÓRBITA, afelio x 1,25, e nao o corpo.
 *
 * O que se mede aqui e o gesto inteiro: o voo chega onde deveria, funciona
 * tambem para as luas, a roda do mouse continua viva durante e depois dele, e o
 * esmaecimento e reversivel — porque a promessa e "ao ir tirando o zoom vamos
 * vendo o resto voltar", e uma atenuacao que nao volta seria um modo
 * disfarcado de escalar.
 */
import { expect, test, type Page } from '@playwright/test';
import { abrir } from './preparar.ts';

const UA_KM = 149597870.7;

/** A opacidade base de uma fita, de `linhas/fitas.ts`. */
const OPACIDADE_DA_FITA = 0.85;

const camera = (p: Page): Promise<{ raio: number; pivo: number[] }> =>
  p.evaluate(() => ({ raio: window.__camera!.raio, pivo: [...window.__camera!.pivo] }));

/** Onde um corpo caiu na tela, segundo a propria cena. */
function naTela(p: Page, chave: string): Promise<{ x: number; y: number } | null> {
  return p.evaluate((c) => {
    const a = (window.__projecoes?.() ?? []).find((x) => x.chave === c);
    return a && a.naFrente ? { x: a.x, y: a.y } : null;
  }, chave);
}

interface EstadoDaFita {
  opacidadeDaOrbita: number;
  opacidadeDoRastro: number;
  orbitaVisivel: boolean;
  rastroVisivel: boolean;
}

async function fita(p: Page, chave: string): Promise<EstadoDaFita> {
  const e = await p.evaluate((c) => window.__fita?.(c) ?? null, chave);
  expect(e, `${chave} não tem fita`).not.toBeNull();
  return e as EstadoDaFita;
}

/** Escolhe um corpo na lista e pede "chegar perto" pela tecla escrita na Ajuda. */
async function irAte(p: Page, nome: string | RegExp): Promise<void> {
  await p.getByRole('option', { name: nome }).click();
  await p.keyboard.press('4');
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 820 });
  await abrir(page);
  await expect(page.getByRole('banner')).toBeVisible();
  await page.waitForFunction(() => window.__fita !== undefined);
  // Pausado: a posicao dos corpos deixa de depender de quanto tempo cada
  // asserção levou para chegar.
  await page.getByRole('button', { name: 'Pausar' }).click();
  await page.waitForTimeout(400);
});

test('duplo clique num planeta leva a camera a tres raios dele', async ({ page }) => {
  const caixa = (await page.locator('canvas').boundingBox())!;
  const onde = await naTela(page, 'jupiter');
  expect(onde, 'Júpiter não está na tela').not.toBeNull();

  await page.mouse.dblclick(caixa.x + onde!.x, caixa.y + onde!.y);
  await page.waitForTimeout(900);

  // Tres raios de Júpiter: o enquadramento 'perto' ja existia, o que faltava
  // era um gesto que levasse ate ele.
  expect((await camera(page)).raio).toBeCloseTo((3 * 69911) / UA_KM, 9);
  // O botão fica na ficha do corpo, e diz só "Soltar": o nome já está no
  // título da ficha logo acima, e repeti-lo no botão era a barra tentando
  // explicar sozinha uma escolha que não era dela.
  await expect(page.getByRole('button', { name: 'Soltar', exact: true })).toBeVisible();
});

test('o voo ate uma LUA vai ate a lua, e nao ate o Sol', async ({ page }) => {
  // O defeito que este teste fecha: `indiceDe` devolve −1 para as treze luas, e
  // a transicao decidia o destino por `i >= 0`. Voar ate Io levava a camera ao
  // SOL — onde ela ja estava — por 0,45 s, e so entao ela saltava para Io num
  // quadro so. O salto e invisivel numa foto e obvio em movimento.
  await page.getByRole('radio', { name: 'Só elas' }).click();
  await irAte(page, 'Io, lua');

  const caminho: number[][] = [];
  for (let k = 0; k < 14; k++) {
    await page.waitForTimeout(40);
    caminho.push((await camera(page)).pivo);
  }
  await page.waitForTimeout(700);
  const fim = (await camera(page)).pivo;

  const dist = (p: number[]): number =>
    Math.hypot(p[0]! - fim[0]!, p[1]! - fim[1]!, p[2]! - fim[2]!);
  const distancias = caminho.map(dist);
  const maior = Math.max(...distancias);
  expect(maior, 'a camera já estava em Io antes de voar').toBeGreaterThan(1);

  // A prova: o pivô foi VISTO no meio do caminho. Com o destino errado ele
  // ficava parado no Sol e depois saltava — todas as amostras a 100% ou a 0%,
  // nenhuma no meio.
  const noMeio = distancias.filter((d) => d > 0.1 * maior && d < 0.9 * maior);
  expect(noMeio.length, `amostras: ${distancias.map((d) => (d / maior).toFixed(2)).join(' ')}`)
    .toBeGreaterThan(0);

  expect((await camera(page)).raio).toBeCloseTo((3 * 1821.49) / UA_KM, 12);
});

test('as fitas dos outros corpos somem ao chegar perto, e VOLTAM ao afastar', async ({ page }) => {
  const longe = await fita(page, 'saturno');
  expect(longe.opacidadeDaOrbita, 'sem foco, a opacidade é a de sempre')
    .toBeCloseTo(OPACIDADE_DA_FITA, 6);
  expect(longe.orbitaVisivel).toBe(true);

  await irAte(page, /^Marte/);
  await page.waitForTimeout(900);

  const perto = await fita(page, 'saturno');
  expect(perto.opacidadeDaOrbita, 'de perto, a órbita de Saturno deveria sumir').toBe(0);
  // Escondida, e nao desenhada transparente: um fantasma custa o mesmo passe
  // de desenho e nao mostra nada.
  expect(perto.orbitaVisivel).toBe(false);

  // E volta. Este e o "ao ir tirando o zoom vamos vendo o resto voltar".
  await page.evaluate(() => {
    window.__camera!.raio = 31.5;
  });
  await page.waitForTimeout(300);
  const devolta = await fita(page, 'saturno');
  expect(devolta.opacidadeDaOrbita).toBeCloseTo(OPACIDADE_DA_FITA, 6);
  expect(devolta.orbitaVisivel).toBe(true);
});

test('o rastro do corpo em foco NAO some — e ele que mostra o movimento', async ({ page }) => {
  await irAte(page, /^Marte/);
  await page.waitForTimeout(900);

  const doFoco = await fita(page, 'marte');
  const deOutro = await fita(page, 'saturno');
  expect(doFoco.opacidadeDoRastro, 'o rastro de Marte deveria continuar cheio')
    .toBeCloseTo(OPACIDADE_DA_FITA, 6);
  expect(doFoco.rastroVisivel).toBe(true);
  expect(deOutro.opacidadeDoRastro, 'o rastro de Saturno deveria sumir').toBe(0);
  // A órbita do proprio corpo em foco atenua junto com as outras: a elipse
  // inteira nao cabe na tela quando se esta a tres raios dela.
  expect(doFoco.opacidadeDaOrbita).toBe(0);
});

test('o esmaecimento MULTIPLICA: nao liga o que foi desligado', async ({ page }) => {
  // Quem desligou "Caminhos previstos" nao pode ve-los voltar por ter se
  // aproximado de um planeta.
  await page.locator('summary', { hasText: 'Mais opções' }).click();
  const caixa = page.getByRole('checkbox', { name: /Caminhos previstos/ });
  await caixa.click();
  await expect(caixa).not.toBeChecked();
  await page.waitForTimeout(200); // a cena aplica a opcao no proximo quadro
  expect((await fita(page, 'saturno')).orbitaVisivel, 'a órbita deveria estar desligada')
    .toBe(false);

  await irAte(page, /^Marte/);
  await page.waitForTimeout(900);
  await page.evaluate(() => {
    window.__camera!.raio = 31.5;
  });
  await page.waitForTimeout(300);

  expect((await fita(page, 'saturno')).orbitaVisivel, 'a órbita voltou sozinha depois do foco')
    .toBe(false);
});

test('a roda do mouse continua viva DURANTE o voo', async ({ page }) => {
  // `ajustar-zoom` era o unico efeito de camera que nao cancelava a transicao:
  // a roda ficava morta por meio segundo e o raio saltava no prazo fixo.
  await irAte(page, /^Júpiter/);
  await page.waitForTimeout(120); // no meio da transicao de 0,45 s

  const caixa = (await page.locator('canvas').boundingBox())!;
  await page.mouse.move(caixa.x + caixa.width / 2, caixa.y + caixa.height / 2);
  await page.mouse.wheel(0, 400); // afastar
  await page.waitForTimeout(250);
  const depoisDaRoda = (await camera(page)).raio;

  const perto = (3 * 69911) / UA_KM;
  expect(depoisDaRoda, 'a roda não afastou nada').toBeGreaterThan(perto);

  // E o prazo fixo da transicao nao volta para reivindicar o raio depois.
  await page.waitForTimeout(600);
  expect((await camera(page)).raio, 'a transição sobrescreveu a roda')
    .toBeCloseTo(depoisDaRoda, 9);
});

test('sem corpo acompanhado, NADA muda', async ({ page }) => {
  // A propriedade que mantem intacto o estado padrao de toda a suite: sem
  // ninguem em foco, o programa desenha o que sempre desenhou.
  expect(await page.evaluate(() => window.__foco?.() ?? -1)).toBe(0);
  expect((await fita(page, 'netuno')).opacidadeDaOrbita).toBeCloseTo(OPACIDADE_DA_FITA, 6);

  // Escolher sem acompanhar e ato de leitura: nao move a camera nem atenua.
  const antes = (await camera(page)).raio;
  await page.getByRole('option', { name: /^Netuno/ }).click();
  await page.waitForTimeout(250);
  expect((await camera(page)).raio).toBeCloseTo(antes, 12);
  expect(await page.evaluate(() => window.__foco?.() ?? -1)).toBe(0);
});

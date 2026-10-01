/**
 * O lado noturno de um corpo aparece — e continua sendo noite.
 *
 * ## O defeito, como ele foi visto
 *
 * Marte a três raios, com o Sol atrás dele: **o disco inteiro saía preto**, e o
 * único desenho que sobrava era o arco fino da atmosfera no limbo. Um programa
 * que carrega um mapa de 8K, orienta o eixo pelo polo da IAU e deriva o
 * meridiano entregava, para quem se aproximasse pelo lado errado, um buraco
 * preto do tamanho da tela. A metade que se via era metade; a outra metade não
 * existia para quem estava olhando.
 *
 * A causa estava escrita com todas as letras em `modeloDeLuz.ts`: a cor é
 * `dia × luz × irradiância`, e `luz` é exatamente zero na noite.
 *
 * ## As DUAS metades da regra, e por que precisam das duas
 *
 * Um teste que só pedisse "a noite aparece" seria satisfeito por luz ambiente
 * chapada, que apaga o terminador e tira do corpo qualquer volume — o remédio
 * clássico, pior que a doença. Um teste que só pedisse "a noite é escura"
 * estaria verde com o defeito original. Então são três afirmações:
 *
 *   1. a noite APARECE: o lado escuro tem brilho acima do preto;
 *   2. a noite tem RELEVO: há variação de luminância dentro dela, ou seja, é a
 *      textura do corpo e não uma chapa cinza;
 *   3. a noite continua NOITE: é claramente mais escura que o lado de dia.
 *
 * As três juntas prendem o valor de `PISO_DO_LADO_NOTURNO` por cima e por
 * baixo. Provado: com o piso removido, (1) e (2) reprovam; com o piso em 1,
 * reprova (3).
 */
import { expect, test, type Page } from '@playwright/test';
import { PNG } from 'pngjs';
import { abrir } from './preparar.ts';

/** Luminância relativa, a mesma fórmula do resto da suíte. */
function luminancia(r: number, g: number, b: number): number {
  const canal = (c: number): number => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
}

interface Disco {
  /** Média das luminâncias dentro do disco. */
  media: number;
  /** Desvio padrão — é ele que diz se há TEXTURA ou uma chapa. */
  relevo: number;
  pixels: number;
}

/**
 * Mede o disco do corpo na tela.
 *
 * Amostra um quadrado inscrito no disco, com 70% do raio: assim nenhuma
 * amostra pega o limbo, onde moram o halo da atmosfera e o serrilhado da
 * borda — os dois acenderiam o "a noite aparece" sem que a superfície
 * aparecesse, que é justamente o defeito.
 */
async function medirDisco(pagina: Page, chave: string): Promise<Disco> {
  const onde = await pagina.evaluate(
    (c) => (window.__projecoes?.() ?? []).find((x) => x.chave === c) ?? null,
    chave,
  );
  expect(onde, `${chave} não está na tela`).not.toBeNull();
  expect(onde!.raioPx, `${chave} está pequeno demais para medir`).toBeGreaterThan(60);

  const png = PNG.sync.read(await pagina.locator('canvas').screenshot({ animations: 'disabled' }));
  const lado = Math.floor(onde!.raioPx * 0.7);
  const luminancias: number[] = [];
  for (let y = Math.round(onde!.y) - lado; y <= Math.round(onde!.y) + lado; y += 2) {
    for (let x = Math.round(onde!.x) - lado; x <= Math.round(onde!.x) + lado; x += 2) {
      if (x < 0 || y < 0 || x >= png.width || y >= png.height) continue;
      const i = 4 * (y * png.width + x);
      luminancias.push(luminancia(png.data[i]!, png.data[i + 1]!, png.data[i + 2]!));
    }
  }
  expect(luminancias.length, `o disco de ${chave} saiu vazio`).toBeGreaterThan(400);

  const media = luminancias.reduce((a, b) => a + b, 0) / luminancias.length;
  const variancia =
    luminancias.reduce((a, b) => a + (b - media) ** 2, 0) / luminancias.length;
  return { media, relevo: Math.sqrt(variancia), pixels: luminancias.length };
}

/** Leva a câmera a três raios do corpo, com a simulação parada. */
async function chegarPerto(pagina: Page, nome: RegExp): Promise<void> {
  await pagina.getByRole('option', { name: nome }).click();
  await pagina.keyboard.press('4');
  await pagina.waitForTimeout(900);
  await pagina.waitForFunction(() => window.__assentou?.() === true, undefined, { timeout: 15000 });
}

const CORPOS = [
  // Marte: superfície nua, é o caso que produziu a queixa.
  { chave: 'marte', nome: /^Marte/ },
  // Júpiter: sem superfície sólida, com faixas — o relevo aqui é o contraste
  // entre as bandas, e é o que sumia por completo.
  { chave: 'jupiter', nome: /^Júpiter/ },
  // Saturno: o único com sombra de anel sobre o corpo. O piso entra DEPOIS
  // dessa sombra, então a faixa do anel também deixa de ser um vazio preto.
  { chave: 'saturno', nome: /^Saturno/ },
];

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 860 });
  await abrir(page);
  await expect(page.getByRole('banner')).toBeVisible();
  await page.waitForFunction(() => window.__camera !== undefined);
  await page.getByRole('button', { name: 'Pausar' }).click();
  await page.waitForTimeout(400);
});

for (const corpo of CORPOS) {
  test(`o lado noturno de ${corpo.chave} aparece, com relevo, e continua mais escuro`, async ({
    page,
  }) => {
    await chegarPerto(page, corpo.nome);

    // O lado de dia, para ter contra o que comparar.
    await page.evaluate(() => window.__ladoIluminado?.());
    await page.waitForTimeout(700);
    const dia = await medirDisco(page, corpo.chave);
    expect(dia.media, 'o lado de dia saiu preto: a medida não mede nada')
      .toBeGreaterThan(0.02);

    // E o lado noturno: meia volta a partir da direção do Sol.
    await page.evaluate(() => window.__ladoIluminado?.(0.6 + Math.PI));
    await page.waitForTimeout(700);
    const noite = await medirDisco(page, corpo.chave);

    // 1. APARECE.
    expect(noite.media, `o lado noturno de ${corpo.chave} saiu preto`).toBeGreaterThan(0.004);

    // 2. TEM RELEVO — é a textura do corpo, e não uma chapa cinza. Uma chapa
    //    daria desvio padrão praticamente zero.
    expect(noite.relevo, `o lado noturno de ${corpo.chave} é uma chapa sem textura`)
      .toBeGreaterThan(0.0015);

    // 3. CONTINUA NOITE. Sem este limite, "aparecer" seria satisfeito por
    //    apagar o terminador, que é o remédio pior que a doença.
    expect(noite.media, `o lado noturno de ${corpo.chave} está claro demais`)
      .toBeLessThan(dia.media * 0.55);
  });
}

test('de longe, com nada em foco, o programa desenha o que sempre desenhou', async ({ page }) => {
  // A outra metade da promessa: o piso é sobre o lado noturno de um corpo que
  // se está olhando, e não uma luz ambiente ligada na cena inteira. Na vista
  // geral os corpos têm poucos pixels e o fundo continua sendo o espaço.
  const fundo = await page.evaluate(() => {
    const c = document.querySelector('canvas') as HTMLCanvasElement;
    return { largura: c.clientWidth, altura: c.clientHeight };
  });
  const png = PNG.sync.read(await page.locator('canvas').screenshot({ animations: 'disabled' }));
  // Um canto, longe do Sol e de qualquer órbita.
  let maior = 0;
  let amostras = 0;
  for (let y = 4; y < Math.min(60, png.height); y += 2) {
    for (let x = 4; x < Math.min(60, png.width); x += 2) {
      const i = 4 * (y * png.width + x);
      maior = Math.max(maior, luminancia(png.data[i]!, png.data[i + 1]!, png.data[i + 2]!));
      amostras++;
    }
  }
  expect(amostras, 'não há canto para medir').toBeGreaterThan(100);
  expect(fundo.largura).toBeGreaterThan(200);
  // O céu tem estrelas e a Via Láctea; o que não pode haver é um véu cinza
  // uniforme por cima de tudo, que é o que uma AmbientLight faria.
  expect(maior, 'o espaço vazio ficou cinza').toBeLessThan(0.05);
});

test('a sombra do anel lê o mesmo mapa que o anel desenha', async ({ page }) => {
  /**
   * O defeito, e por que ele é invisível até alguém perguntar.
   *
   * O nó que amostra o anel para calcular a SOMBRA dele sobre Saturno era
   * criado com o objeto `Texture` do instante em que o material é montado — ou
   * seja, o marcador de 1×1 na cor média, porque nenhuma imagem chegou ainda.
   * `trocarMapa('anel', …)` escrevia no nó do ANEL e nunca alcançava este.
   *
   * O resultado na tela: o anel desenhava as faixas e a Divisão de Cassini, e
   * a sombra dele sobre o planeta era uma tira de profundidade óptica
   * constante — chapada, sem a Divisão, sem faixa nenhuma. Dois desenhos do
   * mesmo anel, lado a lado, discordando; e o comentário do código dizia que
   * os dois liam "o MESMO mapa".
   */
  await page.getByRole('option', { name: /^Saturno/ }).click();
  await page.keyboard.press('4');
  await page.waitForFunction(() => window.__assentou?.() === true, undefined, { timeout: 20000 });

  const largura = await page.evaluate(() => window.__larguraDoMapaDaSombra?.() ?? 0);
  expect(largura, 'a sombra do anel ficou presa no marcador de 1×1').toBeGreaterThan(1);

  // E é a imagem do anel mesmo, que é uma faixa larga e de uma linha de altura.
  expect(largura, `a sombra está lendo uma imagem de ${largura} px`).toBeGreaterThan(1000);
});

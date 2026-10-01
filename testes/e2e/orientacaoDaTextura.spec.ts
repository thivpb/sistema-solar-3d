/**
 * A textura cai no lugar certo da esfera — medido num corpo cuja resposta se sabe.
 *
 * ## Por que este arquivo existe
 *
 * `SphereGeometry` do three.js constrói os polos em ±Y, e todo o resto do
 * programa trata +Z como polo: a construção da IAU, o achatamento, o plano dos
 * anéis. A malha ficou **noventa graus fora de tudo o mais** por doze fases, e
 * nenhum teste pegou. Vale entender por quê, porque o mesmo buraco existe para
 * qualquer erro de orientação:
 *
 *   - `cena/orientacao.test.ts` mede a MATRIZ, que sempre esteve certa;
 *   - `cena/esfera.test.ts` (escrito junto com o conserto) mede a GEOMETRIA;
 *   - as imagens douradas foram gravadas **já com o defeito dentro** — elas
 *     travavam o erro em vez de acusá-lo.
 *
 * Faltava o teste de ponta a ponta: a matriz, a geometria, o meridiano derivado
 * e a convenção do mapa, juntos, produzindo a imagem certa. É o que está aqui.
 *
 * ## Por que a Lua
 *
 * Porque a resposta é conhecida sem precisar de fotografia de referência: a Lua
 * é travada por maré, e da Terra vê-se sempre a **face próxima** — a dos
 * grandes mares escuros. A face oculta não tem mares; é crosta clara saturada
 * de crateras. Medido: 30,9% de mar na face próxima contra 8,0% na oculta.
 *
 * ## O que este teste NÃO pega, dito com todas as letras
 *
 * Ele **não** distingue o erro de noventa graus no polo. Medido: com a esfera
 * torta ele dá 34,2% contra 13,0%, e passa. E faz sentido que passe — girar a
 * esfera noventa graus troca qual hemisfério encara a Terra, mas os mares da
 * Lua continuam concentrados de um lado, então um dos dois recortes continua
 * sendo o rico em mar.
 *
 * O que ele prende é o MERIDIANO — qual longitude fica de frente —, e nele
 * entram três coisas: o `W` da IAU com os termos E1 da ficha da Lua em
 * `dados/corposVisuais.ts`, a origem de `u` na geometria, e a convenção de
 * longitude do mapa do Solar System Scope.
 *
 * Não entra o `meridianoQueEncaraOPai`, e vale registrar porque é fácil supor
 * que sim: a Lua é a única das treze que tem ficha própria, com os termos
 * publicados. As outras doze é que têm o meridiano derivado, e nenhuma delas
 * tem um "onde deveria estar" conhecido sem fotografia de referência — é por
 * isso que a licença do meridiano arbitrário está declarada no bloco de
 * honestidade em vez de testada.
 *
 * O polo quem prende é `cena/esfera.test.ts`, que pergunta diretamente onde
 * `uv.y = 1` cai na geometria — e esse reprova.
 */
import { expect, test, type Page } from '@playwright/test';
import { PNG } from 'pngjs';
import { abrir } from './preparar.ts';

const cinza = (r: number, g: number, b: number): number => (r * 299 + g * 587 + b * 114) / 1000;

/**
 * O ESPALHAMENTO de tons dentro do disco: `(p90 − p10) / média`.
 *
 * Relativo, e não absoluto: a Lua recebe a luz que recebe e a exposição
 * automática mexe no brilho, então o que separa mar de terra alta é o
 * contraste entre os dois, nunca um valor de cinza.
 *
 * **E espalhamento, e não "fração escura".** A primeira versão contava pixels
 * abaixo de 78% da média, e isso separava mal: medido, 8,1% na face próxima
 * contra 6,0% na oculta — tão perto que um limiar entre os dois seria sorteio,
 * e o teste de fato reprovou sozinho na primeira execução em que a composição
 * mudou de caminho. O espalhamento separa 0,53 contra 0,29, porque é a
 * grandeza certa: a face próxima tem mares escuros E terras altas claras no
 * mesmo disco, e a oculta é quase toda de um tom só.
 */
const RAIO_AMOSTRADO = 0.86;

/**
 * Que fração da parte ILUMINADA do disco é mar.
 *
 * Mar é basalto escuro e terra alta é anortosito claro: a razão entre os dois
 * é de quase dois para um, e é ela que se mede. Tudo é relativo ao percentil 95
 * do próprio disco, e só a parte iluminada entra — assim a medida não depende
 * da fase da Lua, da distância nem da exposição automática.
 *
 * Contar pixels escuros no disco INTEIRO não serve, e a primeira versão deste
 * arquivo tentou: o gradiente do terminador domina o histograma e engole a
 * diferença de albedo. Medido assim, face próxima 8,1% contra oculta 6,0% —
 * perto demais para separar. Restrito à parte iluminada: 30,9% contra 8,0%.
 */
async function fracaoDeMar(pagina: Page, chave: string): Promise<number> {
  const onde = await pagina.evaluate(
    (c) => (window.__projecoes?.() ?? []).find((x) => x.chave === c) ?? null,
    chave,
  );
  expect(onde, `${chave} não está na tela`).not.toBeNull();
  expect(onde!.raioPx).toBeGreaterThan(80);

  const png = PNG.sync.read(await pagina.locator('canvas').screenshot({ animations: 'disabled' }));
  const r = onde!.raioPx * RAIO_AMOSTRADO;
  const valores: number[] = [];
  for (let y = Math.round(onde!.y - r); y <= Math.round(onde!.y + r); y += 2) {
    for (let x = Math.round(onde!.x - r); x <= Math.round(onde!.x + r); x += 2) {
      if ((x - onde!.x) ** 2 + (y - onde!.y) ** 2 > r * r) continue;
      if (x < 0 || y < 0 || x >= png.width || y >= png.height) continue;
      const i = 4 * (y * png.width + x);
      valores.push(cinza(png.data[i]!, png.data[i + 1]!, png.data[i + 2]!));
    }
  }
  expect(valores.length, 'o disco saiu vazio').toBeGreaterThan(2000);
  const media = valores.reduce((a, b) => a + b, 0) / valores.length;
  expect(media, 'o disco saiu preto: a medida não mede nada').toBeGreaterThan(20);
  valores.sort((a, b) => a - b);
  const p = (q: number): number => valores[Math.floor(q * (valores.length - 1))]!;
  const claro = p(0.95);
  const iluminados = valores.filter((v) => v > claro * 0.25);
  const escuros = iluminados.filter((v) => v < claro * 0.6).length;
  expect(iluminados.length, `${chave} está quase todo na sombra: nada a medir`)
    .toBeGreaterThan(valores.length * 0.3);
  return escuros / Math.max(1, iluminados.length);
}

/** Põe a câmera na direção de `de`, olhando para `alvo`. */
async function olharDe(pagina: Page, alvo: string, de: string): Promise<void> {
  await pagina.evaluate(
    ([a, d]) => {
      const pa = window.__posicaoNaCena!(a as string)!;
      const pd = window.__posicaoNaCena!(d as string)!;
      const v = [pd.x - pa.x, pd.y - pa.y, pd.z - pa.z];
      const n = Math.hypot(v[0]!, v[1]!, v[2]!);
      window.__camera!.azimute = Math.atan2(v[1]!, v[0]!);
      window.__camera!.elevacao = Math.asin(Math.max(-1, Math.min(1, v[2]! / n)));
    },
    [alvo, de],
  );
  await pagina.waitForTimeout(900);
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 900 });
  await abrir(page);
  await expect(page.getByRole('banner')).toBeVisible();
  await page.waitForFunction(() => window.__camera !== undefined);
  await page.getByRole('button', { name: 'Pausar' }).click();
  await page.waitForTimeout(400);
  await page.getByRole('radio', { name: 'Só elas' }).click();
  await page.getByRole('option', { name: /^Lua/ }).click();
  await page.keyboard.press('4');
  await page.waitForFunction(() => window.__assentou?.() === true, undefined, { timeout: 20000 });
  await page.getByRole('button', { name: 'Esconder painel' }).click();
  await page.waitForTimeout(300);
});

test('da Terra vê-se a face PRÓXIMA da Lua, e do outro lado a oculta', async ({ page }) => {
  // Da Terra: os mares. Eles cobrem cerca de um terço da face próxima.
  await olharDe(page, 'lua', 'terra');
  await page.waitForTimeout(1200);
  const proxima = await fracaoDeMar(page, 'lua');

  // Do lado oposto: a face oculta, que quase não tem mar.
  await page.evaluate(() => {
    window.__camera!.azimute += Math.PI;
    window.__camera!.elevacao *= -1;
  });
  await page.waitForTimeout(1500);
  const oculta = await fracaoDeMar(page, 'lua');

  // Medido: 0,53 na face próxima e 0,29 na oculta. O limiar fica no meio, com
  // margem para os dois lados, e a razão é o que de fato discrimina.
  // Medido: 30,9% de mar na face próxima contra 8,0% na oculta — quase quatro
  // vezes. Os limiares ficam no meio, com margem para os dois lados.
  expect(
    proxima,
    `a face virada para a Terra tem ${(proxima * 100).toFixed(1)}% de mar, e a oculta ${(oculta * 100).toFixed(1)}%`,
  ).toBeGreaterThan(0.2);
  expect(
    proxima / Math.max(oculta, 0.001),
    `próxima ${(proxima * 100).toFixed(1)}% contra oculta ${(oculta * 100).toFixed(1)}%`,
  ).toBeGreaterThan(2.2);
});

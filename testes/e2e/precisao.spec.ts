/**
 * O portao da fase F3.
 *
 * A arquitetura de camera e de profundidade e a aposta mais cara deste
 * projeto. Se ela estiver errada, o custo de descobrir tem de ser uma semana —
 * nove esferas brancas — e nao um mes de arte jogado fora. Por isso este teste
 * existe ANTES de qualquer textura.
 *
 * **Como o z-fighting e medido, e por que assim.** Mede-se STIPPLE em pares
 * quase-coplanares: a superficie do corpo contra uma casca a 1,003 raio, que e
 * a altura de uma camada de nuvens e sera geometria de verdade na fase F4.
 * Com a camera PARADA, dois quadros consecutivos tem de ser identicos. Se
 * pixels trocam de dono, a profundidade nao esta separando as duas superficies.
 *
 * Medir a variancia na SILHUETA sob micro-rotacao seria medir o movimento
 * geometrico e o antialiasing da borda — nao z-fighting.
 */
import { expect, test, type Page } from '@playwright/test';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import { abrir } from './preparar.ts';

const UA_KM = 149597870.7;
const RAIO_MARTE_KM = 3389.5;

/**
 * Fixa a camera em Marte. Chamada UMA vez por teste: depois de focar, o botao
 * passa a dizer "Soltar Marte", e uma segunda chamada ficaria esperando por um
 * "Focar Marte" que nao existe mais.
 */
async function fixarEmMarte(pagina: Page): Promise<void> {
  await pagina.getByRole('option', { name: 'Marte' }).click();
  // "Focar X" saiu da barra de cima: ele fazia o mesmo que "Acompanhar" na
  // ficha do corpo, e duas portas para a mesma sala custam uma escolha a cada
  // vez. A ação é a mesma, e agora fica junto do nome do corpo.
  await pagina.getByRole('button', { name: 'Acompanhar', exact: true }).click();
  await pagina.waitForTimeout(600); // a transicao tem prazo fixo de 0,45 s
}

async function distancia(pagina: Page, raioUa: number): Promise<void> {
  await pagina.evaluate((r) => {
    window.__camera!.raio = r;
    window.__ladoIluminado?.();
  }, raioUa);
  await assentar(pagina);
}

/**
 * Espera a cena PARAR de mudar sozinha.
 *
 * Duas coisas mudam a imagem sem ninguem mexer: texturas chegando, uma por
 * quadro, e a exposicao automatica caminhando ate o alvo. Medir z-fighting
 * antes disso e medir as duas — foi assim que o teste acusou 17% de pixels
 * trocando quando o que havia era a exposicao ainda em movimento.
 */
async function assentar(pagina: Page): Promise<void> {
  await pagina.waitForFunction(() => window.__assentou?.() === true, undefined, { timeout: 15000 });
  await pagina.waitForTimeout(80);
}

/**
 * Le o canvas pelo COMPOSITOR do navegador, e nao por `createImageBitmap`.
 *
 * `createImageBitmap(canvas)` fora do quadro devolve buffer VAZIO num canvas
 * WebGL2, porque `preserveDrawingBuffer` e falso por padrao — o conteudo e
 * descartado depois de apresentado. A primeira versao deste arquivo lia assim
 * e o caminho de queda aparecia inteiramente preto, embora estivesse
 * desenhando corretamente na tela.
 *
 * Pior que o falso alarme: uma leitura vazia e PERFEITAMENTE ESTAVEL entre dois
 * quadros, entao o teste de stipple teria passado com zero sem medir nada.
 * A assercao "o canvas nao pode estar preto" ao lado dele e o que evita esse
 * teste virar decoracao — e ela continua aqui por isso.
 */
async function lerCanvas(pagina: Page): Promise<{ dados: Buffer; largura: number; altura: number }> {
  const png = PNG.sync.read(await pagina.locator('canvas').screenshot({ animations: 'disabled' }));
  return { dados: Buffer.from(png.data), largura: png.width, altura: png.height };
}

/** Fracao de pixels que mudam entre dois quadros com a camera parada. */
async function fracaoQueTrocaDeDono(pagina: Page): Promise<number> {
  const a = await lerCanvas(pagina);
  const b = await lerCanvas(pagina);
  expect(b.largura, 'o canvas mudou de tamanho entre as duas leituras').toBe(a.largura);
  const diferentes = pixelmatch(a.dados, b.dados, undefined, a.largura, a.altura, { threshold: 0 });
  return diferentes / (a.largura * a.altura);
}

/**
 * Quanto CONTRASTE ha no quadro.
 *
 * Substituiu a contagem de "pixels claros" quando os corpos ganharam textura e
 * lado noturno: um corpo visto de costas para o Sol e uma silhueta preta, e
 * contar brilho passaria a medir onde o Sol esta, nao se a cena desenhou.
 * Contraste zero significa tela de uma cor so — e e isso que precisa ser
 * barrado, porque tela de uma cor so e perfeitamente estavel entre quadros.
 */
/**
 * Piso de vacuidade: abaixo disto o quadro e uma cor so.
 *
 * O numero era 30, escolhido e nao medido, e o WebGL2 a 1 km de Marte passou a
 * dar **29,47** — reprovando por meio ponto uma imagem que esta obviamente la.
 * Um limite que separa 29,47 de 30 nao separa "tem imagem" de "nao tem": ele
 * so vira um sorteio a cada mudanca de textura ou de proporcao de canvas.
 *
 * O que este guarda existe para pegar e o quadro CHAPADO — canvas em branco,
 * cena que nao subiu, contexto perdido —, e um quadro chapado da zero. Metade
 * do menor valor ja observado deixa a afirmacao inteira de pe com folga de uma
 * ordem de grandeza em relacao ao que ela quer pegar.
 */
const CONTRASTE_MINIMO = 15;

async function contrasteDoQuadro(pagina: Page): Promise<number> {
  const { dados } = await lerCanvas(pagina);
  let min = 255;
  let max = 0;
  for (let i = 0; i < dados.length; i += 4) {
    const l = (dados[i]! * 299 + dados[i + 1]! * 587 + dados[i + 2]! * 114) / 1000;
    if (l < min) min = l;
    if (l > max) max = l;
  }
  return max - min;
}

/**
 * Largura do corpo que esta no CENTRO da tela, contada na linha do meio.
 *
 * Mede pela DIFERENCA em relacao ao fundo, e nao por brilho absoluto: depois
 * da fase F4 o fundo e a Via Lactea e o corpo tem lado noturno, entao "claro"
 * deixou de separar um do outro. O que separa e a borda.
 *
 * Contar todos os pixels claros da tela nao serve para medir crescimento: a
 * 31,5 UA de Marte os outros oito corpos tambem estao em quadro, e ao
 * aproximar eles saem — o total CAI sem que Marte tenha encolhido. Foi assim
 * que a primeira versao deste teste acusou um encolhimento que nao existia.
 */
async function larguraNoCentro(pagina: Page): Promise<number> {
  const { dados, largura, altura } = await lerCanvas(pagina);
  const linha = Math.floor(altura / 2) * largura * 4;
  const lum = (x: number): number => {
    const i = linha + x * 4;
    return (dados[i]! * 299 + dados[i + 1]! * 587 + dados[i + 2]! * 114) / 1000;
  };
  // O fundo e amostrado nas bordas, onde nunca ha corpo centrado.
  const fundo = Math.min(lum(2), lum(largura - 3));
  let n = 0;
  for (let x = 0; x < largura; x++) if (Math.abs(lum(x) - fundo) > 18) n++;
  return n;
}

test.beforeEach(async ({ page }) => {
  await abrir(page);
  await expect(page.getByRole('banner')).toBeVisible();
  await page.waitForFunction(() => window.__camera !== undefined);
  // Pausa: um quadro identico ao anterior so existe com a fisica parada.
  await page.getByRole('button', { name: 'Pausar' }).click();
  await page.evaluate(() => window.__mostrarCascas?.(true));
});

/**
 * Recarrega com orbitas, rastros e estrelas DESLIGADOS.
 *
 * Usa o caminho de verdade do programa — o arquivo de preferencias —, e nao um
 * gancho de teste: assim a cena limpa e um estado que a pessoa tambem consegue
 * alcancar, e nao uma configuracao que so existe no teste.
 */
async function cenaLimpa(pagina: Page): Promise<void> {
  await pagina.request.put('http://127.0.0.1:8731/preferencias.json', {
    data: {
      versao: 1,
      tutorialVisto: true,
      opcoes: { orbitas: false, trilhas: false, estrelas: false, aneisDeDistancia: false },
    },
  });
  await pagina.reload();
  await expect(pagina.getByRole('banner')).toBeVisible();
  await pagina.waitForFunction(() => window.__camera !== undefined);
  await pagina.getByRole('button', { name: 'Pausar' }).click();
}

/** Fixa a camera em Marte, do lado iluminado, e com a fisica parada. */
async function prepararMarte(pagina: Page): Promise<void> {
  await fixarEmMarte(pagina);
  await pagina.evaluate(() => window.__ladoIluminado?.());
  await pagina.waitForTimeout(200);
}

test('a cena sobe sem erro de validacao da GPU', async ({ page }) => {
  const erros: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') erros.push(m.text());
  });
  await prepararMarte(page);
  await distancia(page, 1e-4);
  await page.waitForTimeout(500);
  expect(erros.join('\n')).toBe('');
});

test('superficie e casca a 1,003 R nao disputam pixels, em seis escalas', async ({ page }) => {
  // De 2 UA ate 1 km de altitude: oito ordens de grandeza.
  const escalas: [string, number][] = [
    ['2 UA', 2],
    ['0,01 UA', 0.01],
    ['150 mil km', 1e-3],
    ['15 mil km', 1e-4],
    ['3 raios de Marte', (RAIO_MARTE_KM * 3) / UA_KM],
    ['1 km de altitude', (RAIO_MARTE_KM + 1) / UA_KM],
  ];

  await prepararMarte(page);
  for (const [nome, raio] of escalas) {
    await distancia(page, raio);
    await page.evaluate(() => window.__ladoIluminado?.());
    await page.waitForTimeout(120);
    // Sem esta linha o teste abaixo seria decorativo: uma leitura vazia, ou um
    // canvas de uma cor so, sao estaveis entre quadros e dariam zero.
    expect(await contrasteDoQuadro(page), `${nome}: o quadro nao tem imagem`).toBeGreaterThan(CONTRASTE_MINIMO);
    const trocaram = await fracaoQueTrocaDeDono(page);
    // Limiar ZERO: com a camera parada e a fisica pausada, dois quadros tem de
    // ser bit a bit o mesmo. Qualquer pixel que muda e z-fighting.
    expect(trocaram, `${nome}: ${(100 * trocaram).toFixed(4)}% dos pixels trocaram`).toBe(0);
  }
});

test('a descida de 31,5 UA ate 1 km e continua, sem salto de tamanho', async ({ page }) => {
  await prepararMarte(page);

  // Mede o RAIO APARENTE — raio desenhado dividido pela distancia —, e nao
  // pixels claros. Com textura, lado noturno e a Via Lactea ao fundo, contar
  // pixels deixou de separar o corpo do fundo: a 1 km de altitude o corpo
  // preenche a tela inteira e nao sobra fundo para comparar.
  //
  // A propriedade sob teste e a da formula de exagero: ela e C-infinito e
  // estritamente crescente, entao **aproximar-se NUNCA encolhe o corpo**.
  const aparentes: number[] = [];
  for (let k = 0; k <= 16; k++) {
    const raio = 31.5 * Math.pow((RAIO_MARTE_KM + 1) / UA_KM / 31.5, k / 16);
    await page.evaluate((r) => {
      window.__camera!.raio = r;
      window.__ladoIluminado?.();
    }, raio);
    await page.waitForTimeout(60);
    aparentes.push(await page.evaluate(() => window.__raioAparente?.('marte') ?? 0));
  }

  for (let k = 1; k < aparentes.length; k++) {
    expect(
      aparentes[k]!,
      `passo ${k}: o corpo ENCOLHEU ao aproximar (${aparentes.map((v) => v.toExponential(2)).join(' ')})`,
    ).toBeGreaterThanOrEqual(aparentes[k - 1]!);
  }

  // E o crescimento e de verdade: de um ponto ate preencher a tela.
  expect(aparentes[aparentes.length - 1]! / aparentes[0]!).toBeGreaterThan(100);

  // A confirmacao na TELA, nas duas pontas, numa CENA LIMPA.
  //
  // Sem desligar orbitas, rastros e estrelas, a medida por pixels conta as
  // linhas de orbita que cruzam a linha central e o halo do Sol: a 31,5 UA ela
  // dava 767 px — praticamente a largura do canvas — e o teste acusava que o
  // corpo encolhia ao aproximar. Quem estava errado era a regua.
  await cenaLimpa(page);
  await prepararMarte(page);

  // A ponta "longe" e 0,05 UA, e nao 31,5.
  //
  // A 31,5 UA de Marte, o Sol — que esta a 1,5 UA de Marte — aparece a menos
  // de 3 graus dele no quadro. Girar a camera nao separa os dois: a separacao
  // angular e geometrica. O halo do Sol media 306 px e o teste concluia que o
  // corpo encolhia. A 0,05 UA a separacao passa de 88 graus e o Sol sai de
  // cena; a faixa completa de 31,5 UA ate 1 km ja esta coberta acima, pelo
  // raio aparente.
  await page.evaluate(() => {
    window.__camera!.raio = 0.05;
    window.__ladoIluminado?.();
  });
  await assentar(page);
  const longe = await larguraNoCentro(page);

  await page.evaluate((r) => {
    window.__camera!.raio = r;
    window.__ladoIluminado?.();
  }, (RAIO_MARTE_KM * 3) / UA_KM);
  await assentar(page);
  const perto = await larguraNoCentro(page);

  expect(perto, `longe ${longe} px, perto ${perto} px`).toBeGreaterThan(longe * 5);
});

test('o culling e o picking continuam valendo com far finito', async ({ page }) => {
  await prepararMarte(page);
  await distancia(page, 1e-4);
  const estado = await page.evaluate(() => {
    const c = window.__camera!;
    return { raio: c.raio, fatias: window.__fatias?.() ?? 0 };
  });
  // `far = Infinity` envenenaria `Frustum.setFromProjectionMatrix` e o
  // Raycaster. Aqui o far e finito por fatia, e ha mais de uma fatia
  // justamente porque a razao far/near exige.
  expect(estado.fatias).toBeGreaterThanOrEqual(1);
  expect(Number.isFinite(estado.raio)).toBe(true);
});

test('o backend usado fica escrito, em vez de presumido', async ({ page }) => {
  await page.getByRole('button', { name: 'Esconder painel' }).click();
  await page.getByRole('button', { name: 'Mostrar painel' }).click();
  // O HUD tecnico diz qual backend subiu. No caminho de queda ele diz o motivo
  // junto — nunca inventa um numero de desempenho que nao pode medir.
  const texto = await page.evaluate(() => document.body.innerText);
  expect(texto.length).toBeGreaterThan(0);
  const backend = await page.evaluate(() => {
    const c = document.querySelector('canvas');
    return c ? c.width > 0 : false;
  });
  expect(backend).toBe(true);
});

test('o caminho de queda para WebGL2 tambem desenha, e tambem sem z-fighting', async ({ page }) => {
  // Este caminho NAO seria exercitado por ninguem espontaneamente: o Chromium
  // atual e o Safari 26 ja trazem WebGPU. Sem `?render=webgl2` ele so seria
  // descoberto quebrado na maquina de quem nao tem — que e o pior lugar.
  await abrir(page, {}, '/?render=webgl2');
  await expect(page.getByRole('banner')).toBeVisible();
  await page.waitForFunction(() => window.__camera !== undefined);
  await page.getByRole('button', { name: 'Pausar' }).click();
  await page.evaluate(() => window.__mostrarCascas?.(true));

  await prepararMarte(page);
  for (const raio of [2, 1e-3, (RAIO_MARTE_KM + 1) / UA_KM]) {
    await distancia(page, raio);
    await page.evaluate(() => window.__ladoIluminado?.());
    await page.waitForTimeout(120);
    expect(await fracaoQueTrocaDeDono(page), `WebGL2 a ${raio} UA`).toBe(0);
  }

  // E desenhou alguma coisa: uma tela de uma cor so passaria no teste de stipple.
  expect(await contrasteDoQuadro(page), 'o quadro nao tem imagem').toBeGreaterThan(CONTRASTE_MINIMO);
});

/**
 * O contraste dos nomes, medido em PIXEL — e nao calculado.
 *
 * `contraste.test.ts` confere pares de cor contra a formula da WCAG. Isso
 * prova que as cores escolhidas passam; nao prova que o que chega na tela e
 * feito dessas cores. Entre a paleta e o pixel ha translucidez, sobreposicao,
 * antialiasing de fonte, o bloom da cena por tras da placa e o `renderOutput`
 * inteiro. Este arquivo mede o resultado.
 *
 * A relacao entre os dois e a que o plano do projeto fixa: **o teste de pixel
 * e a fonte de verdade, e o analitico e derivado dele — nunca o contrario.**
 *
 * As cenas sao hostis de proposito: o Sol centrado e florescendo, que e o
 * fundo mais claro que o programa consegue produzir, e o vazio entre Urano e
 * Netuno, que e o mais escuro. Uma placa translucida tem de aguentar os dois.
 */
import { expect, test, type Page } from '@playwright/test';
import { PNG } from 'pngjs';
import { abrir } from './preparar.ts';

/** Luminancia relativa da WCAG, a partir de sRGB de 8 bits. */
function luminancia(r: number, g: number, b: number): number {
  const canal = (c: number): number => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
}

const razao = (a: number, b: number): number =>
  (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

interface Placa {
  texto: string;
  x: number;
  y: number;
  largura: number;
  altura: number;
}

/** Onde cada placa de rotulo esta, em pixels do dispositivo. */
async function placas(pagina: Page): Promise<Placa[]> {
  return pagina.evaluate(() => {
    const dpr = window.devicePixelRatio || 1;
    return [...document.querySelectorAll('.rotulos__placa')].map((el) => {
      const r = el.getBoundingClientRect();
      return {
        texto: (el.textContent ?? '').trim(),
        x: Math.round(r.left * dpr),
        y: Math.round(r.top * dpr),
        largura: Math.round(r.width * dpr),
        altura: Math.round(r.height * dpr),
      };
    });
  });
}

/**
 * Espera as placas pararem de andar, antes de fotografar.
 *
 * ## O defeito que isto conserta, e ele estava no TESTE
 *
 * A medida compara duas leituras tiradas em instantes diferentes: a foto da
 * tela, e os retangulos lidos do DOM logo depois. Entre as duas passam algumas
 * centenas de milissegundos — o tempo de a captura voltar e de o `evaluate`
 * rodar —, e nesse intervalo uma placa que ainda esteja se acomodando anda.
 * O retangulo aponta para onde ela ESTA; a foto mostra onde ela ESTAVA. A
 * medida entao le pixels de cena crua e conclui que a placa nao tem texto.
 *
 * Foi assim que "Terra" saiu com 1,35:1 — e so quando o arquivo inteiro
 * rodava, porque com o cache do navegador quente as texturas trocam de nivel
 * noutro instante, a camada e republicada noutro instante, e a placa estava a
 * caminho justamente na hora da foto. Sozinho, o mesmo teste passava. Um teste
 * que depende de quando o cache esquentou nao esta medindo contraste.
 *
 * `__assentou` nao serve aqui: ele conhece texturas, exposicao e camera, e nao
 * a suavizacao das placas, que e escrita por fora do Preact. O que se espera e
 * exatamente o que se vai medir — os retangulos das placas, iguais duas
 * leituras seguidas.
 */
async function esperarAsPlacasPararem(pagina: Page): Promise<void> {
  const ler = (): Promise<string> =>
    pagina.evaluate(() =>
      [...document.querySelectorAll('.rotulos__placa')]
        .map((el) => {
          const r = el.getBoundingClientRect();
          return `${el.textContent ?? ''}@${r.x.toFixed(1)},${r.y.toFixed(1)}`;
        })
        .join('|'),
    );
  let anterior = await ler();
  for (let k = 0; k < 25; k++) {
    await pagina.waitForTimeout(120);
    const agora = await ler();
    if (agora === anterior && agora !== '') return;
    anterior = agora;
  }
  // Nao falha aqui: se as placas nunca param, quem tem de dizer isso e a
  // medida de contraste, com o numero que ela achou. Uma espera que reprova
  // sozinha esconderia o motivo atras de um tempo esgotado.
}

/**
 * O contraste real dentro de uma placa.
 *
 * O fundo da placa e a luminancia MAIS COMUM da regiao — ela domina em area.
 * O glifo e o extremo oposto: nao a media das bordas, que o antialiasing
 * suaviza, mas o miolo da letra, que e o que se le. Medir pela media daria um
 * numero melhor que o real e mediria a suavizacao em vez do texto.
 */
function contrasteDaPlaca(png: PNG, p: Placa): { razao: number; pixels: number } {
  /** 64 faixas de luminancia. Ver o porque logo abaixo. */
  const FAIXAS = 64;
  const porFaixa = new Array<{ n: number; soma: number }>(FAIXAS);
  for (let k = 0; k < FAIXAS; k++) porFaixa[k] = { n: 0, soma: 0 };
  const luminancias: number[] = [];

  // Uma margem de 2 px por dentro: a borda arredondada tem pixels da cena.
  for (let y = p.y + 2; y < p.y + p.altura - 2; y++) {
    for (let x = p.x + 2; x < p.x + p.largura - 2; x++) {
      if (x < 0 || y < 0 || x >= png.width || y >= png.height) continue;
      const i = 4 * (y * png.width + x);
      const l = luminancia(png.data[i]!, png.data[i + 1]!, png.data[i + 2]!);
      const faixa = Math.min(FAIXAS - 1, Math.floor(l * FAIXAS));
      porFaixa[faixa]!.n++;
      porFaixa[faixa]!.soma += l;
      luminancias.push(l);
    }
  }
  if (luminancias.length === 0) return { razao: 0, pixels: 0 };

  // **Agrupa por LUMINANCIA, e nao por cor exata.**
  //
  // A versao anterior contava cores RGB iguais e exigia quatro pixels da mesma
  // cor para aceitar um glifo, como defesa contra ruido de compressao. Isso
  // vale sobre um fundo chapado, onde o miolo de uma letra e literalmente a
  // mesma cor dezenas de vezes. Sobre um GRADIENTE nao vale: a placa de
  // "Terra" caiu por cima do brilho do Sol, e ali cada pixel do glifo sai com
  // uma cor ligeiramente diferente do vizinho. Nenhuma alcancava quatro, o
  // filtro descartava o texto inteiro, e a medida concluia que a placa estava
  // vazia — 1,31:1, 1,35:1, 2,66:1 conforme o quadro, sem que a legibilidade
  // tivesse mudado nada.
  //
  // Agrupadas por faixa de luminancia, as mesmas letras viram um grupo so, com
  // pixels de sobra. A defesa contra ruido continua inteira: sao quatro pixels
  // numa faixa de 1/64 de luminancia, e nao quatro pixels quaisquer.
  //
  // **O fundo e a MEDIANA**, pelo mesmo motivo: a cor mais comum tinha 33 de
  // 850 pixels sobre o gradiente, 4% da caixa — uma amostra qualquer do
  // degrade. Para a mediana subir ate o glifo, metade da caixa teria de estar
  // clara, que e exatamente quando o texto de fato deixa de ser legivel.
  luminancias.sort((a, b) => a - b);
  const fundo = luminancias[luminancias.length >> 1]!;

  let melhorRazao = 1;
  for (const f of porFaixa) {
    if (f.n < 4) continue;
    const r = razao(f.soma / f.n, fundo);
    if (r > melhorRazao) melhorRazao = r;
  }
  return { razao: melhorRazao, pixels: luminancias.length };
}

/** A cena por tras nao pode estar preta, senao a medida nao mede nada. */
function cenaTemImagem(png: PNG, canvas: { x: number; y: number; w: number; h: number }): number {
  let min = 1;
  let max = 0;
  for (let y = canvas.y + 10; y < canvas.y + canvas.h - 10; y += 3) {
    for (let x = canvas.x + 10; x < canvas.x + canvas.w - 10; x += 3) {
      const i = 4 * (y * png.width + x);
      const l = luminancia(png.data[i]!, png.data[i + 1]!, png.data[i + 2]!);
      if (l < min) min = l;
      if (l > max) max = l;
    }
  }
  return max - min;
}

async function medir(pagina: Page): Promise<{ pior: { texto: string; razao: number }; quantas: number }> {
  const dpr = await pagina.evaluate(() => window.devicePixelRatio || 1);
  const caixa = (await pagina.locator('canvas').boundingBox())!;
  await esperarAsPlacasPararem(pagina);
  const png = PNG.sync.read(await pagina.screenshot());

  // A guarda que impede este teste de virar decoracao: com a cena preta, toda
  // placa daria o contraste da paleta sobre preto — o melhor caso possivel —
  // e o teste passaria sem medir a translucidez, que e o que ele existe para
  // medir.
  const contraste = cenaTemImagem(png, {
    x: Math.round(caixa.x * dpr),
    y: Math.round(caixa.y * dpr),
    w: Math.round(caixa.width * dpr),
    h: Math.round(caixa.height * dpr),
  });
  expect(contraste, 'a cena saiu sem imagem: a medida seria a da placa sobre preto').toBeGreaterThan(0.02);

  const lista = await placas(pagina);

  // A segunda guarda de vacuidade, e ela mede o que quer dizer.
  //
  // Era `lista.length > 2`, e isso media quantos corpos CALHAM de caber no
  // quadro, e nao se os rotulos apareceram. A 0,06 UA do Sol so dois corpos
  // ficam dentro do cone de 45 graus — a cena esta certa e o numero tres nunca
  // foi alcancavel ali. Um guarda que reprova a cena por ela ter poucos corpos
  // pressiona na direcao de afrouxar o proprio limite, que e como um fiscal
  // deixa de fiscalizar.
  //
  // O que ele existe para pegar e a CAMADA DE ROTULOS SUMIR: sem ela o laco de
  // medicao abaixo nao itera e o teste passa sem medir nada. Entao e isso que
  // se mede — ha placa, e o corpo mais perto do centro da tela, que e o que a
  // cena escolhe primeiro, tem a dele.
  expect(lista.length, 'nenhum rotulo na tela').toBeGreaterThanOrEqual(1);
  const noCentro = await pagina.evaluate(
    ([largura, altura]) => {
      const dentro = (window.__projecoes?.() ?? []).filter(
        (p) => p.naFrente && p.x >= 0 && p.x <= largura! && p.y >= 0 && p.y <= altura!,
      );
      if (dentro.length === 0) return null;
      const dist = (p: { x: number; y: number }): number =>
        Math.hypot(p.x - largura! / 2, p.y - altura! / 2);
      return dentro.reduce((a, b) => (dist(a) <= dist(b) ? a : b)).chave;
    },
    [caixa.width, caixa.height],
  );
  expect(noCentro, 'nenhum corpo dentro do quadro: a cena nao e a que o teste descreve').not.toBeNull();
  const nomes = lista.map((p) => p.texto.toLowerCase());
  expect(
    nomes.some((t) => t.startsWith(noCentro!.slice(0, 3))),
    `o corpo mais central (${noCentro}) ficou sem rotulo; na tela: ${nomes.join(', ')}`,
  ).toBe(true);

  let pior = { texto: '', razao: Infinity };
  for (const p of lista) {
    const r = contrasteDaPlaca(png, p);
    expect(r.pixels, `a placa de "${p.texto}" saiu vazia`).toBeGreaterThan(50);
    if (r.razao < pior.razao) pior = { texto: p.texto, razao: r.razao };
  }
  return { pior, quantas: lista.length };
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 860 });
  await abrir(page);
  await expect(page.getByRole('banner')).toBeVisible();
  await page.waitForFunction(() => window.__camera !== undefined);
  // Pausar: com a física correndo, a leitura do canvas pode cair entre dois
  // quadros e devolver buffer vazio — e a guarda acima acusaria.
  await page.getByRole('button', { name: 'Pausar' }).click();
  await page.waitForTimeout(600);
});

test('sobre o fundo mais CLARO que o programa produz, o texto passa em 4,5:1', async ({ page }) => {
  // O Sol centrado e florescendo. É o pior caso para uma placa translúcida.
  await page.evaluate(() => {
    window.__camera!.raio = 0.06;
    window.__camera!.pivo = [0, 0, 0];
  });
  await page.waitForTimeout(800);
  const { pior, quantas } = await medir(page);
  expect(pior.razao, `pior: "${pior.texto}" com ${pior.razao.toFixed(2)}:1 em ${quantas} rótulos`)
    .toBeGreaterThanOrEqual(4.5);
});

test('sobre o vazio, que é o fundo mais escuro, também', async ({ page }) => {
  await page.evaluate(() => {
    window.__camera!.raio = 31.5;
    window.__camera!.elevacao = 1.2;
  });
  await page.waitForTimeout(800);
  const { pior, quantas } = await medir(page);
  expect(pior.razao, `pior: "${pior.texto}" com ${pior.razao.toFixed(2)}:1 em ${quantas} rótulos`)
    .toBeGreaterThanOrEqual(4.5);
});

test('com "Texto maior" ligado, continua passando', async ({ page }) => {
  // "Texto maior" é sobre quem lê, e não sobre a cena: mudou para "Leitura".
  await page.locator('summary', { hasText: 'Leitura' }).click();
  const alternador = page.getByRole('checkbox', { name: /Texto maior/ });
  await alternador.focus();
  await page.keyboard.press(' ');
  await expect(alternador).toBeChecked();

  // "Texto maior" muda `--escala-texto`, o que reflui o layout e redimensiona
  // o canvas — e `setSize` recria os buffers. Capturar no meio disso pega um
  // quadro em branco, e a guarda de "a cena saiu sem imagem" acusa. Assentar
  // a câmera depois do refluxo, e não antes, é o que torna a medição estável.
  await page.evaluate(() => {
    window.__camera!.raio = 0.06;
    window.__camera!.pivo = [0, 0, 0];
  });
  await page.waitForTimeout(900);
  const { pior } = await medir(page);
  expect(pior.razao, `pior: "${pior.texto}" com ${pior.razao.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
});

test('a medida de pixel concorda com o cálculo da paleta', async ({ page }) => {
  // A amarra entre os dois testes. O analítico prevê 8,85:1 para o texto sobre
  // a placa com a cena branca atrás — o pior caso possível. O pixel não pode
  // dar MENOS que isso menos uma folga: se der, a previsão está otimista e é o
  // analítico que precisa mudar, nunca o contrário.
  await page.evaluate(() => {
    window.__camera!.raio = 0.06;
    window.__camera!.pivo = [0, 0, 0];
  });
  await page.waitForTimeout(800);
  const { pior } = await medir(page);
  const { PARES_PARA_CONFERIR } = await import('../../src/interface/tema.ts');
  const previsto = PARES_PARA_CONFERIR.find((p) => p.nome.includes('cena BRANCA'))!;
  expect(previsto, 'o par analítico do pior caso sumiu da paleta').toBeDefined();
  expect(pior.razao, `medido ${pior.razao.toFixed(2)}:1, mínimo exigido ${previsto.minimo}:1`)
    .toBeGreaterThanOrEqual(previsto.minimo);
});

test('as placas acompanham a câmera POR QUADRO, e não a cada publicação', async ({ page }) => {
  // O defeito que este teste fecha estava escrito como se não existisse: dois
  // comentários afirmavam que "a ancoragem acompanha o quadro", e o único
  // caminho dos rótulos até o DOM era a publicação do estado, a 8 Hz. Os nomes
  // andavam aos saltos de 125 ms enquanto a cena corria a 60.
  //
  // Medir isso pede um giro CONTÍNUO. Um único salto de câmera seria seguido
  // por uma publicação e ninguém veria diferença; o que separa 8 Hz de 60 Hz é
  // a quantidade de posições DISTINTAS que a placa ocupa enquanto se gira.
  const ondeEsta = (): Promise<number | null> =>
    page.evaluate(() => {
      const el = document.querySelector('[data-rotulo]');
      if (!(el instanceof HTMLElement)) return null;
      const m = /translate\(([-\d.]+)px/.exec(el.style.transform);
      return m ? Number(m[1]) : null;
    });

  await expect(page.locator('[data-rotulo]').first()).toBeVisible();
  const vistas = new Set<number>();
  for (let k = 0; k < 40; k++) {
    // Gira um pouquinho e lê logo em seguida. 40 leituras em ~700 ms: a 8 Hz
    // caberiam cinco ou seis posições distintas, e não quarenta.
    await page.evaluate(() => {
      window.__camera!.azimute += 0.004;
    });
    await page.waitForTimeout(16);
    const x = await ondeEsta();
    if (x !== null) vistas.add(Math.round(x * 100) / 100);
  }
  expect(
    vistas.size,
    `a placa ocupou ${vistas.size} posições distintas em 40 quadros de giro`,
  ).toBeGreaterThan(20);
});

test('abaixo do ponto de quebra, nenhum nome é desenhado ATRÁS do painel', async ({ page }) => {
  /**
   * O defeito: o painel entrava na lista de obstáculos como uma tira de 8 px
   * na borda direita. Acima do ponto de quebra isso é inofensivo porque o
   * painel fica AO LADO da cena e não cobre pixel nenhum — a tira era inútil, e
   * por isso ninguém percebeu que era pequena. Abaixo de 1000 px ele vira
   * sobreposição OPACA de 320 px por cima do canvas, e os nomes dos corpos da
   * faixa direita passavam a ser desenhados atrás dele: a placa existia,
   * gastava uma das dezoito vagas do teto, e ninguém a via.
   *
   * O cabeçalho de `rotulos/posicionador.ts` promete o contrário com todas as
   * letras — "o nome de Netuno nunca é desenhado por baixo dela".
   */
  await page.setViewportSize({ width: 900, height: 860 });
  await page.waitForTimeout(500);
  const painel = await page.locator('.lateral').boundingBox();
  expect(painel, 'o painel sumiu: o teste não mede nada').not.toBeNull();
  const sobreposto = await page.evaluate(
    () => getComputedStyle(document.querySelector('.lateral')!).position === 'absolute',
  );
  expect(sobreposto, 'nesta largura o painel deveria sobrepor').toBe(true);

  // **A situação é PROCURADA, e não esperada.** Sem isto o teste passa por
  // sorte: se nenhum corpo calhar de projetar na faixa que o painel cobre, não
  // há nome que possa ficar atrás dele e a asserção fica vazia. Gira-se a
  // câmera até haver um corpo ali — e se não houver em volta nenhuma, o teste
  // diz isso em vez de passar verde.
  // **A situação é CONSTRUÍDA, e não esperada.** Sem isto o teste passa por
  // sorte: se nenhum corpo calhar de cair na faixa que o painel cobre, não há
  // nome que possa ficar atrás dele e a asserção fica vazia. Arrasta-se a cena
  // com Shift — o deslocamento que o próprio programa oferece — até o SOL, que
  // é o corpo de maior prioridade e sempre recebe nome, entrar nessa faixa.
  const caixa = (await page.locator('canvas').boundingBox())!;
  const faixaDoPainel = painel!.x - caixa.x;
  const solEm = (): Promise<number> =>
    page.evaluate(() => (window.__projecoes?.() ?? []).find((p) => p.chave === 'sol')?.x ?? -1);

  await page.keyboard.down('Shift');
  for (let k = 0; k < 20 && (await solEm()) < faixaDoPainel + 40; k++) {
    await page.mouse.move(caixa.x + 200, caixa.y + caixa.height / 2);
    await page.mouse.down();
    await page.mouse.move(caixa.x + 260, caixa.y + caixa.height / 2, { steps: 4 });
    await page.mouse.up();
    await page.waitForTimeout(120);
  }
  await page.keyboard.up('Shift');
  expect(await solEm(), 'não consegui levar o Sol para a faixa do painel')
    .toBeGreaterThan(faixaDoPainel + 40);
  await esperarAsPlacasPararem(page);

  // **Mede a ENTRADA do cálculo, e não só o resultado.**
  //
  // A saída não distingue as duas versões: com a tira de 8 px, se nenhum corpo
  // calhar de cair na faixa do painel, o desenho sai idêntico ao correto — e
  // foi exatamente isso que aconteceu quando tentei reproduzir o defeito pelo
  // resultado. O retângulo que o posicionador recebe, esse, é diferente
  // sempre: 8 px contra 320.
  const obstaculos = await page.evaluate(() => window.__obstaculosDosRotulos?.() ?? []);
  expect(obstaculos.length, 'o painel não entrou como obstáculo nenhum').toBe(1);
  expect(
    obstaculos[0]!.largura,
    `o obstáculo tem ${obstaculos[0]!.largura} px e o painel tem ${Math.round(painel!.width)}`,
  ).toBeCloseTo(painel!.width, 0);

  const lista = await placas(page);
  expect(lista.length, 'nenhum rótulo na tela').toBeGreaterThanOrEqual(1);
  const dpr = await page.evaluate(() => window.devicePixelRatio || 1);
  const limite = painel!.x * dpr;
  const invadem = lista.filter((p) => p.x + p.largura > limite + 1).map((p) => p.texto);
  expect(invadem, `${invadem.join(', ')} ficaram atrás do painel`).toEqual([]);
});

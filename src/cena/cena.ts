/**
 * A cena: corpos texturizados, iluminados por uma luz so, sobre a Via Lactea.
 *
 * O que ela NAO faz, e de proposito: nao conhece o simulador, nao conhece o
 * reducer, e nao tem como pedir que a fisica ande. Ela recebe um `Instantaneo`
 * e desenha. A regra e verificada pelo dependency-cruiser.
 *
 * As fatias de profundidade da fase F3 continuam aqui inteiras: sao elas que
 * permitem ir de 31,5 UA ate 1 km de altitude sem z-fighting, e o teste de
 * precisao continua medindo isso a cada build.
 */
import { corDoCorpo } from '../dados/cores.ts';
import { MAXIMO_DE_CORPOS_CRIADOS } from '../nucleo/guardas.ts';
import { EMRAT, EPOCA_DAS_LUAS_JD, LUAS } from '../dados/luas.ts';
import { deslocamentoDoCentroDaTerra, posicaoDaLua } from '../nucleo/luas.ts';
import { comprimirBuffer } from './escala/escalaVisual.ts';
import { atenuacaoDasLinhas, foco as calcularFoco } from './escala/foco.ts';
import {
  Color,
  NoToneMapping,
  EquirectangularReflectionMapping,
  Euler,
  type Group,
  type Mesh,
  OrthographicCamera,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  TextureLoader,
  Vector3,
  type Object3D,
} from 'three';
import type { WebGPURenderer } from 'three/webgpu';
import { corpoSobOPonto } from './selecao.ts';
import { fatiasDeProfundidade } from './camera/planoProximo.ts';
import { alturaVisivelUa, posicaoDaCamera, type EstadoCamera } from './camera/cameraOrbital.ts';
import { aplicarOrigem, distancias } from './origemFlutuante.ts';
import { fatorDeProjecao, raioDesenhadoUa } from './escala/exageroDeTamanho.ts';
import { montarCoroa, montarCorpo, montarCascaDeProva, type CorpoMontado } from './corpos/fabrica.ts';
import { Texturas } from './texturas/carregador.ts';
import { CORPOS_VISUAIS, OBLIQUIDADE_DA_ECLIPTICA, mapaDe } from '../dados/corposVisuais.ts';
import { criarComposicao } from './pos/composicao.ts';
import { criarAneisDeDistancia, criarFitas, criarPrevisao } from './linhas/fitas.ts';
import type { EstadoDaFita } from './linhas/fitas.ts';
import { estaOcluido } from '../rotulos/oclusao.ts';
import { carregarEstrelas, type Estrelas } from './ceu/estrelas.ts';
import { TEMA_GRADE } from '../dados/cores.ts';

const UA_KM = 149597870.7;

/** Cor media de cada corpo, para o 1x1 que ocupa o lugar da textura ate ela chegar. */
const COR_INICIAL: Record<string, [number, number, number]> = {
  sol: [255, 220, 120],
  mercurio: [150, 140, 125],
  venus: [200, 165, 110],
  terra: [70, 110, 160],
  marte: [165, 95, 65],
  jupiter: [190, 160, 130],
  saturno: [200, 180, 140],
  urano: [140, 190, 200],
  netuno: [80, 110, 180],
  lua: [130, 128, 124],
};

export interface CorpoNaCena {
  chave: string;
  raioKm: number;
  montado: CorpoMontado;
  casca: Object3D;
}

export interface Cena {
  cena: Scene;
  /** A que esta desenhando: perspectiva ou ortografica. */
  camera: PerspectiveCamera | OrthographicCamera;
  corpos: CorpoNaCena[];
  desenhar(
    /** Posicoes REAIS em UA. A compressao do modo maquete acontece aqui dentro. */
    posUa: Float64Array,
    jd: number,
    estadoCamera: EstadoCamera,
    opcoes: OpcoesDaCena,
    /** Indice do corpo que se esta olhando. Define a exposicao. -1 = visao geral. */
    sujeito: number,
  ): void;
  /**
   * Onde cada corpo caiu na tela, para a camada de rotulos.
   * Calculada DEPOIS de desenhar, com as mesmas matrizes que desenharam — se
   * usasse outras, o nome ficaria um quadro atras do corpo.
   */
  projetar(larguraPx: number, alturaPx: number): ProjecaoDeCorpo[];
  /** O estado completo, so para a fita de rastro, que acumula por tempo simulado. */
  limparTrilhas(): void;
  definirEstado(estado: { pos: Float64Array; n: number; tDias: number }): void;
  redimensionar(largura: number, altura: number): void;
  readonly fatiasNoUltimoQuadro: number;
  /** Fator da exposicao automatica. Vai ESCRITO na tela: e um recurso visual. */
  readonly exposicao: number;
  /** Verdadeiro quando nada mais esta carregando e a imagem parou de mudar sozinha. */
  readonly assentou: boolean;
  /**
   * O foco do quadro, de 0 a 1. Ver `escala/foco.ts`.
   *
   * Calculado aqui, dentro do laco que ja conhece `dists[i]` e `c.raioKm`, e
   * lido de fora por quem precisa — os rotulos. Recalcula-lo em `principal.ts`
   * criaria a segunda copia que atrasa, que e o padrao que este projeto ja
   * pagou caro em quatro lugares diferentes.
   */
  readonly foco: number;
  /** O estado visual das linhas de um corpo. Ver `linhas/fitas.ts`. */
  estadoDaFita(chave: string): EstadoDaFita | null;
  /**
   * Zera o atraso que o teto de giro acumulou em todos os corpos.
   *
   * Chamada por "Voltar ao início", que e o gesto que promete devolver o
   * programa ao estado de partida — e o meridiano desenhado faz parte dele.
   * Ver `corpos/giroVisivel.ts`.
   */
  zerarGiro(): void;
  mostrarCascas(ligado: boolean): void;
  /**
   * Poe a cena em dia com a lista de corpos, que o sandbox muda.
   *
   * Compara por CHAVE, e nao por indice. `removerCorpo` do nucleo desloca
   * todos os indices seguintes — de proposito, para nao embaralhar a ordem de
   * somatorio das forcas — e qualquer coisa que guarde indice precisa se
   * deslocar junto. Comparar por chave faz a cena se corrigir sozinha, sem
   * precisar saber o que mudou nem em que ordem.
   */
  sincronizarCorpos(): void;
  /** A órbita que o corpo do rascunho teria. Vazio esconde a linha. */
  mostrarPrevisao(pontos: Float64Array): void;
  /**
   * Que corpo está sob este pixel, ou nulo.
   *
   * Usa as MESMAS projeções que colocaram os rótulos, ou seja as matrizes que
   * desenharam o quadro. Um raio lançado contra as esferas erraria: os corpos
   * são desenhados com o raio exagerado, e o que se clica é o disco desenhado.
   */
  corpoEm(xCss: number, yCss: number, larguraCss: number, alturaCss: number): string | null;
  /**
   * A direcao, no espaco da cena, do raio que sai da camera por aquele pixel.
   *
   * O inverso de `projetar`, e com as MESMAS matrizes: se usasse outras, o
   * ponto colocado cairia num lugar diferente de onde a pessoa clicou —
   * pouco, e sempre.
   *
   * Os eixos da cena e os eixos em UA sao os mesmos: a origem flutuante so
   * TRANSLADA. Entao esta direcao serve direto para interseccao em UA.
   */
  direcaoNaTela(xCss: number, yCss: number, larguraCss: number, alturaCss: number): [number, number, number];
}

/**
 * A exposicao automatica, e por que ela precisa aparecer escrita.
 *
 * A luz que chega a um corpo cai com `1/d²`, e isso fica na fisica: Saturno, a
 * 9,5 UA, recebe 1/90 do que a Terra recebe, e essa razao e real. Mas uma tela
 * nao tem 90 vezes de faixa dinamica sobrando — mantendo a exposicao fixa em
 * "1 UA", Urano e Netuno viram pixels pretos.
 *
 * Entao o brilho RELATIVO entre os corpos continua fisico e a CENA INTEIRA e
 * multiplicada por um fator so, como a exposicao de uma camera. E o mesmo que
 * um fotografo faz ao abrir o diafragma, e como todo recurso visual deste
 * programa, ele aparece escrito: "exposição ×90".
 *
 * O limite superior existe porque, perto de Netuno, a exposicao necessaria
 * levantaria tambem o ruido do fundo.
 */
const EXPOSICAO_MAXIMA = 400;
const EXPOSICAO_MINIMA = 0.02;

export interface ProjecaoDeCorpo {
  chave: string;
  /** Pixels CSS. */
  x: number;
  y: number;
  raioPx: number;
  /** Falso quando esta atras da camera. */
  naFrente: boolean;
  ocluido: boolean;
  distanciaUa: number;
}

export interface OpcoesDaCena {
  tamanhoReal: boolean;
  estrelas: boolean;
  orbitas: boolean;
  trilhas: boolean;
  aneisDeDistancia: boolean;
  /** Desenhar as luas. Elas somem tambem quando a orbita nao se distingue. */
  luas: boolean;
  /** 'ortografica' troca a matriz de projecao, e nao so o rotulo do botao. */
  vista: 'perspectiva' | 'ortografica';
  /**
   * Distancias comprimidas pela raiz quadrada, em torno do Sol.
   *
   * Afeta SO onde os corpos sao desenhados. A luz que cada um recebe e a
   * exposicao da camera continuam medindo a distancia real — senao Netuno,
   * desenhado a 5,5 UA, apareceria trinta vezes mais iluminado do que e, e a
   * compressao estaria mudando um resultado fisico visivel.
   */
  maquete: boolean;
  /**
   * A chave do corpo que a camera esta encarando, ou `null`.
   *
   * Dirige o FOCO — ver `escala/foco.ts`. NAO e o mesmo que `sujeito`, e a
   * diferenca e deliberada: acompanhando Io, o sujeito da exposicao e Jupiter,
   * porque a luz que chega na lua e a que chega no planeta; quem a camera
   * encara e Io.
   */
  alvoDaCamera: string | null;
}

export function criarCena(
  renderizador: WebGPURenderer,
  corpos: readonly { chave: string; nome: string; raioKm: number }[],
  periodosDias: readonly (number | null)[],
): Cena {
  const cena = new Scene();
  cena.background = new Color(0x05060b);
  // A luz e uma so e esta no Sol; `environment` fica nulo para o lado noturno
  // ser preto de verdade.
  cena.environment = null;

  const texturas = new Texturas(renderizador);
  /** A coroa do Sol. Criada junto com o corpo dele, logo abaixo. */
  let coroa: Mesh | null = null;

  const naCena: CorpoNaCena[] = corpos.map((c) => {
    const cor = COR_INICIAL[c.chave] ?? [160, 160, 160];
    const montado = montarCorpo(
      c.chave,
      {
        albedo: texturas.obter(c.chave, 'albedo', cor),
        ...(texturas.temMapa(c.chave, 'noite') ? { noite: texturas.obter(c.chave, 'noite', [0, 0, 0]) } : {}),
        ...(texturas.temMapa(c.chave, 'nuvens') ? { nuvens: texturas.obter(c.chave, 'nuvens', [0, 0, 0]) } : {}),
        ...(texturas.temMapa(c.chave, 'anel') ? { anel: texturas.obter(c.chave, 'anel', [180, 170, 150]) } : {}),
      },
      c.chave === 'sol',
    );
    cena.add(montado.grupo);

    const casca = montarCascaDeProva();
    montado.grupo.add(casca);

    // A coroa vai no grupo do Sol, entao ela acompanha a origem flutuante sem
    // nenhuma conta propria. Ela e um disco virado para a camera, e quem o vira
    // e o laco de desenho — um `Sprite` faria isso sozinho, mas com escala em
    // PIXELS, e aqui a coroa mede em unidades de cena como todo o resto.
    if (c.chave === 'sol') {
      coroa = montarCoroa();
      montado.grupo.add(coroa);
    }

    return { chave: c.chave, raioKm: c.raioKm, montado, casca };
  });

  /**
   * As luas, montadas DEPOIS dos nove e na mesma lista.
   *
   * Ficarem na mesma `naCena` nao e economia: e o que faz oclusao, rotulo,
   * escolha de fatia de profundidade e projecao valerem para elas sem uma
   * linha a mais. Uma lista separada precisaria repetir as quatro coisas, e
   * repetir e onde a segunda copia se atrasa.
   *
   * O indice delas comeca em `corpos.length`, e e por isso que `sujeito`, que
   * indexa os nove, continua valendo.
   */
  const indiceDoPai = new Map(corpos.map((c, i) => [c.chave, i]));
  const luasNaCena = LUAS.map((l) => {
    const cor = COR_INICIAL[l.chave] ?? [150, 148, 142];
    const montado = montarCorpo(
      l.chave,
      { albedo: texturas.obter(l.chave, 'albedo', cor) },
      false,
    );
    cena.add(montado.grupo);
    const casca = montarCascaDeProva();
    montado.grupo.add(casca);
    naCena.push({ chave: l.chave, raioKm: l.raioMedioKm, montado, casca });
    return { lua: l, iPai: indiceDoPai.get(l.pai) ?? -1 };
  });
  const iTerra = indiceDoPai.get('terra') ?? -1;
  const iLua = LUAS.findIndex((l) => l.chave === 'lua');

  texturas.aoTrocar = (chave, t) => {
    const [corpo, papel] = chave.split('/');
    naCena.find((c) => c.chave === corpo)?.montado.trocarMapa(papel!, t);
  };

  // A Via Lactea como fundo equirretangular. `backgroundRotation` a leva do
  // equatorial do panorama para a ecliptica da cena — sem isso o plano da
  // galaxia apareceria inclinado 23° a mais.
  const viaLactea = mapaDe('ceu', 'viaLactea');
  if (viaLactea?.niveis['2k']) {
    new TextureLoader().load(viaLactea.niveis['2k'], (t) => {
      t.mapping = EquirectangularReflectionMapping;
      t.colorSpace = SRGBColorSpace;
      cena.background = t;
      cena.backgroundIntensity = 0.32;
      cena.backgroundRotation = new Euler(-OBLIQUIDADE_DA_ECLIPTICA * (Math.PI / 180), 0, 0);
    });
  }

  // O catalogo entra quando chega. Sem ele o programa abre igual, com o
  // panorama da Via Lactea ao fundo e nada mais.
  let estrelas: Estrelas | null = null;
  void carregarEstrelas().then((e) => {
    if (!e) return;
    estrelas = e;
    e.mostrar(comEstrelas);
    cena.add(e.pontos);
  });

  /** Ver o cache em `projetar`. */
  let quadrosDesenhados = 0;
  let projecaoEmCache: {
    quadro: number;
    largura: number;
    altura: number;
    saida: ProjecaoDeCorpo[];
  } | null = null;

  const fitas = criarFitas(corpos, periodosDias, corpos.length + MAXIMO_DE_CORPOS_CRIADOS);
  cena.add(fitas.grupo);
  const aneisDeDistancia = criarAneisDeDistancia(TEMA_GRADE);
  cena.add(aneisDeDistancia.grupo);
  const previsao = criarPrevisao();
  cena.add(previsao.linha);

  const camera = new PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(0, 0, 0);
  camera.up.set(0, 0, 1);

  /**
   * A ortografica de verdade, e nao uma perspectiva de fov minusculo.
   *
   * Por dez fases a tecla `V` trocava um campo do estado e a projecao
   * continuava em perspectiva: o botao dizia "Vista de cima" e o que mudava
   * era outra coisa. Uma perspectiva de fov estreito tambem nao serve — ela
   * continua tendo ponto de fuga, e o que a ortografica entrega e justamente a
   * ausencia dele: duas orbitas do mesmo raio saem do mesmo tamanho na tela,
   * esteja uma na frente e outra atras.
   *
   * As duas compartilham posicao, orientacao e `up`. O que muda e so a matriz
   * de projecao — e a altura visivel no plano do pivo, que e a mesma nas duas,
   * e o que faz a troca nao dar um salto de zoom.
   */
  const ortografica = new OrthographicCamera(-1, 1, 1, -1, 0.001, 200);
  ortografica.position.set(0, 0, 0);
  ortografica.up.set(0, 0, 1);
  /** A que esta desenhando agora. Tudo o mais le daqui. */
  let ativa: PerspectiveCamera | OrthographicCamera = camera;

  const grupos: Group[] = naCena.map((c) => c.montado.grupo);
  // Dimensionado pelo TETO, e nao pela contagem de agora: o sandbox
  // acrescenta corpos durante o uso, e um array realocado no meio do quadro
  // deixaria `grupos`, `dists` e as posicoes com tamanhos diferentes por um
  // quadro — que e o bastante para um `RangeError` ou, pior, para um corpo
  // desenhado na posicao de outro.
  /**
   * Separacao minima, em pixels, para uma lua valer a pena.
   *
   * Doze e o alvo de ponteiro do criterio 2.5.8 da WCAG; abaixo disso a lua e
   * o planeta nao sao dois alvos, sao um. Dezoito da folga para o rotulo.
   */
  const SEPARACAO_MINIMA_DA_LUA_PX = 18;

  const nTotal = corpos.length + MAXIMO_DE_CORPOS_CRIADOS + LUAS.length;
  const dists = new Float64Array(nTotal);
  // Alocado uma vez: o modo maquete recalcula estas posicoes por quadro, e
  // alocar 3N doubles a 60 Hz e exatamente o tipo de lixo que faz o coletor
  // aparecer como engasgo.
  const comprimidas = new Float64Array(3 * nTotal);
  /** Posicoes REAIS de todos, luas inclusive. Alimenta a luz e a exposicao. */
  const reais = new Float64Array(3 * nTotal);
  const deslocamento: [number, number, number] = [0, 0, 0];
  const posDoSolNaCena = new Vector3();
  const auxiliar = new Vector3();
  const _lateral = new Vector3();
  const _borda = new Vector3();
  const _centro = new Vector3();
  let alturaPx = 600;
  let fatias = 2;
  let estadoParaTrilhas: { pos: Float64Array; n: number; tDias: number } | null = null;
  let comEstrelas = true;
  let exposicao = 1;
  let exposicaoSuave = 1;
  let focoDoQuadro = 0;
  let pixelRatio = 1;
  // A previsao e desenhada FORA do quadro, quando o rascunho muda, e precisa
  // da mesma camera que o ultimo quadro usou — senao a linha nasce deslocada
  // pela origem flutuante e so se conserta no quadro seguinte.
  let ultimaCamera: EstadoCamera = { pivo: [0, 0, 0], raio: 31.5, azimute: 0, elevacao: 0, fovGraus: 45 };

  // A cena e desenhada em HDR, SEM tonemap: quem faz o tonemap e a composicao,
  // depois do bloom. Tonemapear aqui comprimiria tudo para [0,1] e nao
  // sobraria faixa alta para florescer.
  renderizador.toneMapping = NoToneMapping;
  const composicao = criarComposicao(renderizador);

  return {
    cena,
    get camera() {
      return ativa;
    },
    corpos: naCena,
    get fatiasNoUltimoQuadro() {
      return fatias;
    },
    get exposicao() {
      return exposicao;
    },
    get foco() {
      return focoDoQuadro;
    },

    get assentou() {
      return (
        texturas.pendentes === 0 &&
        texturas.baixando === 0 &&
        Math.abs(exposicaoSuave - exposicao) < exposicao * 0.003
      );
    },

    estadoDaFita(chave) {
      return fitas.estadoDaFita(chave);
    },

    zerarGiro() {
      for (const c of naCena) c.montado.zerarGiro();
    },

    mostrarCascas(ligado) {
      for (const c of naCena) c.casca.visible = ligado;
    },

    corpoEm(xCss, yCss, larguraCss, alturaCss) {
      return corpoSobOPonto(this.projetar(larguraCss, alturaCss), xCss, yCss);
    },

    mostrarPrevisao(pontos) {
      if (pontos.length === 0) previsao.esconder();
      else previsao.mostrar(pontos, posicaoDaCamera(ultimaCamera));
    },

    direcaoNaTela(xCss, yCss, larguraCss, alturaCss) {
      auxiliar.set((xCss / larguraCss) * 2 - 1, 1 - (yCss / alturaCss) * 2, 0.5);
      auxiliar.unproject(ativa);
      auxiliar.normalize();
      return [auxiliar.x, auxiliar.y, auxiliar.z];
    },

    sincronizarCorpos() {
      // Os corpos da fisica ocupam as primeiras `corpos.length` posicoes de
      // `naCena`; as luas vem depois. Este laco mexe so na primeira parte.
      const fisicos = naCena.slice(0, naCena.length - LUAS.length);
      const chavesAgora = corpos.map((c) => c.chave);
      if (fisicos.length === corpos.length && fisicos.every((c, i) => c.chave === chavesAgora[i])) {
        return;
      }

      const porChave = new Map(fisicos.map((c) => [c.chave, c]));
      const novos: CorpoNaCena[] = [];
      for (const c of corpos) {
        const existente = porChave.get(c.chave);
        if (existente) {
          novos.push(existente);
          porChave.delete(c.chave);
          continue;
        }
        const montado = montarCorpo(
          c.chave,
          { albedo: texturas.obter(c.chave, 'albedo', [...corDoCorpo(c.chave)] as [number, number, number]) },
          false,
        );
        cena.add(montado.grupo);
        const casca = montarCascaDeProva();
        montado.grupo.add(casca);
        novos.push({ chave: c.chave, raioKm: c.raioKm, montado, casca });
      }

      // O que sobrou no mapa foi apagado. Tirar da cena E liberar a malha: um
      // grupo solto continua consumindo memoria de GPU e continua aparecendo
      // na lista de rotulos.
      for (const morto of porChave.values()) {
        cena.remove(morto.montado.grupo);
        morto.montado.descartar();
      }

      const luas = naCena.slice(naCena.length - LUAS.length);
      naCena.length = 0;
      naCena.push(...novos, ...luas);
      grupos.length = 0;
      grupos.push(...naCena.map((c) => c.montado.grupo));
    },

    redimensionar(largura, altura) {
      alturaPx = Math.max(1, altura);
      camera.aspect = largura / alturaPx;
      // `setSize` recria o buffer de PROFUNDIDADE junto com o de cor. Mexer em
      // `canvas.width` na mao deixa os dois com tamanhos diferentes, e o
      // WebGPU recusa o passe inteiro.
      renderizador.setSize(largura, alturaPx, false);
      pixelRatio = renderizador.getPixelRatio();
      composicao.redimensionar(largura, alturaPx, pixelRatio);
    },

    projetar(larguraPx, alturaCss) {
      // **Uma projecao por quadro, e nao uma por quem pergunta.**
      //
      // `projetar` roda a oclusao, que e O(n2) sobre os corpos na cena, e aloca
      // a lista de saida. Ela era chamada pela ancoragem dos rotulos a cada
      // quadro, pelo calculo dos rotulos a cada publicacao do estado, e de novo
      // por `corpoEm` a cada clique — sempre com a mesma camera, no mesmo
      // instante, dando sempre o mesmo resultado.
      //
      // O cache vale por QUADRO desenhado e pelo tamanho pedido: `desenhar`
      // incrementa o contador, e qualquer pergunta feita depois disso recalcula.
      // Sem o tamanho na chave, uma pergunta em pixels de CSS devolveria a
      // resposta em pixels de dispositivo, que e o tipo de erro que aparece so
      // em tela retina.
      if (
        projecaoEmCache !== null &&
        projecaoEmCache.quadro === quadrosDesenhados &&
        projecaoEmCache.largura === larguraPx &&
        projecaoEmCache.altura === alturaCss
      ) {
        return projecaoEmCache.saida;
      }

      /** Raio aparente, medido projetando um ponto a um raio de distancia. */
      const raioEmPixels = (centro: Vector3, raioUa: number, lPx: number, aPx: number): number => {
        const direita = _lateral.set(1, 0, 0).applyQuaternion(ativa.quaternion).multiplyScalar(raioUa);
        _borda.copy(centro).add(direita).project(ativa);
        _centro.copy(centro).project(ativa);
        return Math.hypot(((_borda.x - _centro.x) * lPx) / 2, ((_borda.y - _centro.y) * aPx) / 2);
      };

      const saida: ProjecaoDeCorpo[] = [];
      // Raio ZERO para o que nao esta desenhado, em vez de tirar da lista: o
      // indice `i` do laco abaixo indexa esta mesma lista, e filtrar aqui
      // faria cada corpo ser comparado com a esfera de outro.
      const esferas = naCena.map((c) => ({
        centro: [
          c.montado.grupo.position.x,
          c.montado.grupo.position.y,
          c.montado.grupo.position.z,
        ] as [number, number, number],
        raio: c.montado.grupo.visible ? c.montado.malha.scale.x : 0,
      }));

      for (let i = 0; i < naCena.length; i++) {
        const c = naCena[i]!;
        // O que nao esta desenhado nao e clicavel nem rotulavel. Sem isto, uma
        // lua escondida continuaria roubando o clique do planeta.
        if (!c.montado.grupo.visible) continue;
        const p = c.montado.grupo.position;
        auxiliar.copy(p).project(ativa);
        // `w <= 0` e o corpo ATRAS da camera. Em ortografica isso nao existia;
        // ignorar aqui faria o nome aparecer espelhado do outro lado da tela.
        const naFrente = auxiliar.z < 1 && p.dot(direcaoDaCamera(ativa)) > 0;
        // O raio em pixels sai da PROJECAO, e nao de uma conta de fov: projeta
        // um segundo ponto deslocado de um raio na horizontal da tela e mede a
        // diferenca. Vale igual nas duas camaras, e nao precisa saber qual e.
        const raioPx = raioEmPixels(p, c.montado.malha.scale.x, larguraPx, alturaCss);
        saida.push({
          chave: c.chave,
          x: ((auxiliar.x + 1) / 2) * larguraPx,
          y: ((1 - auxiliar.y) / 2) * alturaCss,
          raioPx: Math.max(3, raioPx),
          naFrente,
          ocluido: estaOcluido([p.x, p.y, p.z], esferas, i),
          distanciaUa: p.length(),
        });
      }
      projecaoEmCache = { quadro: quadrosDesenhados, largura: larguraPx, altura: alturaCss, saida };
      return saida;
    },

    limparTrilhas() {
      fitas.limparTrilhas();
    },

    definirEstado(e) {
      estadoParaTrilhas = e;
    },

    desenhar(posUa, jd, estadoCamera, opcoes, sujeito) {
      // O contador de quadros e a chave do cache de `projetar`. Incrementa-lo
      // aqui, ANTES de qualquer coisa mudar de lugar, e o que garante que
      // nenhuma resposta do quadro anterior sobreviva a este.
      quadrosDesenhados++;
      projecaoEmCache = null;
      const { tamanhoReal, estrelas: mostrarEstrelas, maquete, luas: mostrarLuas } = opcoes;
      const ehOrtografica = opcoes.vista === 'ortografica';
      const camUa = posicaoDaCamera(estadoCamera);
      ultimaCamera = estadoCamera;

      // `posDesenho` e o unico buffer que vira coordenada de cena; `posUa`
      // continua real e alimenta tudo que e fisico daqui para baixo. Ter os
      // dois nomes a vista, no mesmo escopo, e o que torna dificil usar o
      // errado sem perceber.
      // -- as posicoes de todos, reais e desenhadas -------------------------
      //
      // `posUa` traz os nove corpos integrados. As treze luas entram aqui: a
      // posicao delas e o centro do planeta MAIS o vetor que Kepler devolve.
      //
      // O vetor da lua NAO e comprimido, e a razao e a mesma que exclui o
      // enquadramento "chegar perto": a compressao e uma funcao da distancia
      // ao SOL, e aplicar a raiz quadrada a 384.400 km — 0,00257 UA — daria
      // 0,0507 UA, vinte vezes mais. A Lua sairia da orbita da Terra e iria
      // parar perto de Vênus. Comprime-se o sistema, nunca o que esta dentro
      // de um planeta.
      const diasDasLuas = jd - EPOCA_DAS_LUAS_JD;
      reais.set(posUa.subarray(0, 3 * corpos.length));
      for (let k = 0; k < luasNaCena.length; k++) {
        const { lua, iPai } = luasNaCena[k]!;
        const destino = 3 * (corpos.length + k);
        posicaoDaLua(lua, lua.base, diasDasLuas, deslocamento);
        reais[destino] = posUa[3 * iPai]! + deslocamento[0];
        reais[destino + 1] = posUa[3 * iPai + 1]! + deslocamento[1];
        reais[destino + 2] = posUa[3 * iPai + 2]! + deslocamento[2];
      }

      // O corpo 'terra' que o integrador move e o BARICENTRO Terra-Lua. O
      // planeta desenhado fica a 4.671 km dele, do lado oposto ao da Lua — e
      // sem isso a Lua orbitaria um ponto que nao e o centro do planeta, e a
      // sombra dela cairia no lugar errado.
      if (iTerra >= 0 && iLua >= 0) {
        const lua = luasNaCena[iLua]!.lua;
        posicaoDaLua(lua, lua.base, diasDasLuas, deslocamento);
        deslocamentoDoCentroDaTerra(deslocamento, EMRAT, deslocamento);
        reais[3 * iTerra] = posUa[3 * iTerra]! + deslocamento[0];
        reais[3 * iTerra + 1] = posUa[3 * iTerra + 1]! + deslocamento[1];
        reais[3 * iTerra + 2] = posUa[3 * iTerra + 2]! + deslocamento[2];
      }

      // A compressao age sobre o sistema, e as luas acompanham o planeta: o
      // vetor lua-planeta e preservado, e so o planeta se move.
      let posDesenho = reais;
      if (maquete) {
        comprimirBuffer(reais, corpos.length, comprimidas);
        for (let k = 0; k < luasNaCena.length; k++) {
          const { iPai } = luasNaCena[k]!;
          const d = 3 * (corpos.length + k);
          comprimidas[d] = comprimidas[3 * iPai]! + (reais[d]! - reais[3 * iPai]!);
          comprimidas[d + 1] = comprimidas[3 * iPai + 1]! + (reais[d + 1]! - reais[3 * iPai + 1]!);
          comprimidas[d + 2] = comprimidas[3 * iPai + 2]! + (reais[d + 2]! - reais[3 * iPai + 2]!);
        }
        posDesenho = comprimidas;
      }

      aplicarOrigem(posDesenho, camUa, grupos);
      distancias(posDesenho, naCena.length, camUa, dists);

      // -- a projecao ---------------------------------------------------
      //
      // A altura visivel no plano do pivo e a MESMA nas duas: e ela que faz a
      // troca nao dar salto de zoom. Na perspectiva ela sai do fov; na
      // ortografica ela E a definicao da camara.
      const alturaVisivel = alturaVisivelUa(estadoCamera);
      ativa = ehOrtografica ? ortografica : camera;
      if (ehOrtografica) {
        const meiaAltura = alturaVisivel / 2;
        const meiaLargura = meiaAltura * (camera.aspect || 1);
        ortografica.left = -meiaLargura;
        ortografica.right = meiaLargura;
        ortografica.top = meiaAltura;
        ortografica.bottom = -meiaAltura;
        ortografica.updateProjectionMatrix();
      } else {
        camera.fov = estadoCamera.fovGraus;
      }
      ativa.lookAt(
        estadoCamera.pivo[0] - camUa[0],
        estadoCamera.pivo[1] - camUa[1],
        estadoCamera.pivo[2] - camUa[2],
      );

      // O Sol e o centro da compressao, entao ele nao se move entre as duas —
      // mas ler de `posDesenho` deixa isso valendo por construcao, e nao por
      // uma propriedade que alguem precisaria lembrar.
      // -- a lua so aparece quando da para distingui-la do planeta ----------
      //
      // O exagero de tamanho tem um PISO em pixels, para que um corpo pequeno
      // nao suma. Isso funciona bem para um planeta solto no vazio e produz um
      // absurdo numa lua: medido, Ganimedes na visao geral e desenhado com 3,5
      // px, o que a 36 UA equivale a 25 milhoes de quilometros — vinte e tres
      // vezes o raio da propria orbita. A lua engole Jupiter. Quatro delas
      // engolem Jupiter e umas as outras, e um clique no meio do planeta
      // acerta a lua que estiver por cima.
      //
      // O criterio nao e o tamanho da lua: e a SEPARACAO. Enquanto a orbita
      // inteira couber dentro do disco do planeta mais um alvo de ponteiro,
      // desenhar a lua nao acrescenta informacao nenhuma — acrescenta ruido
      // que rouba clique e rotulo. Aproxime-se e elas aparecem sozinhas.
      const alturaUtil = Math.max(1, alturaPx);
      const pxPorRad = fatorDeProjecao(camera.fov, alturaUtil);
      /** Pixels por UA a uma dada distancia. Constante na ortografica. */
      const pixelsPorUa = (d: number): number =>
        ehOrtografica ? alturaUtil / Math.max(alturaVisivel, 1e-12) : pxPorRad / Math.max(d, 1e-12);
      for (let k = 0; k < luasNaCena.length; k++) {
        const { lua, iPai } = luasNaCena[k]!;
        const iCena = corpos.length + k;
        const dPai = dists[iPai]!;
        const orbitaPx = dPai > 0 ? (lua.aKm / UA_KM) * pixelsPorUa(dPai) : 0;
        const visivel = mostrarLuas && orbitaPx >= SEPARACAO_MINIMA_DA_LUA_PX;
        naCena[iCena]!.montado.grupo.visible = visivel;
      }

      if (mostrarEstrelas !== comEstrelas) {
        comEstrelas = mostrarEstrelas;
        estrelas?.mostrar(mostrarEstrelas);
      }

      // O panorama da Via Lactea fica com BRILHO CONSTANTE na tela, em vez de
      // acompanhar a exposicao automatica.
      //
      // Nao e capricho: ele e uma imagem de 8 bits por canal, e a exposicao
      // chega a 27 acompanhando Jupiter e a 900 em Netuno. Multiplicar oito
      // bits por 27 mostra os degraus da quantizacao — o ceu vira um mosaico
      // de manchas retangulares, que e estrutura inventada pelo formato do
      // arquivo e nao pelo ceu. As ESTRELAS, essas, continuam passando pela
      // exposicao: elas vem de um catalogo com magnitude medida, entao tem
      // faixa dinamica de verdade para dar.
      cena.backgroundIntensity = mostrarEstrelas ? 0.32 / Math.max(exposicaoSuave, 1e-3) : 0;
      estrelas?.acompanhar();

      posDoSolNaCena.set(
        posDesenho[0]! - camUa[0],
        posDesenho[1]! - camUa[1],
        posDesenho[2]! - camUa[2],
      );

      let maisProximo = Infinity;
      let maisDistante = 0;
      for (let i = 0; i < naCena.length; i++) {
        const c = naCena[i]!;
        const raioRealUa = c.raioKm / UA_KM;
        // **A unica conta que difere entre as duas projecoes.** Em
        // perspectiva os pixels por UA caem com a distancia; em ortografica
        // sao constantes, e e essa constancia que define a projecao. Todo o
        // resto — o exagero de tamanho, o raio aparente, a escolha por clique —
        // fala em pixels e nao precisa saber qual das duas esta ligada.
        const raio = raioDesenhadoUa(raioRealUa, pixelsPorUa(dists[i]!), tamanhoReal, c.chave === 'sol');
        c.montado.definirRaioDesenhado(raio);
        c.casca.scale.setScalar(1.003);

        // A coroa acompanha o disco e fica sempre de frente para a camera.
        // Tres raios de extensao: alem disso ela vira um vidro fosco sobre o
        // sistema inteiro, e o que se quer e que o Sol continue tendo halo
        // quando o disco cabe num pixel.
        if (c.chave === 'sol' && coroa) {
          coroa.scale.setScalar(Math.max(raio, 1e-9) * 6);
          coroa.quaternion.copy(ativa.quaternion);
        }

        // Distancia REAL ao Sol, e nao a desenhada: e ela que define a
        // penumbra do terminador e quanta luz chega.
        const dSol = Math.hypot(reais[3 * i]! - reais[0]!, reais[3 * i + 1]! - reais[1]!, reais[3 * i + 2]! - reais[2]!);
        // O raio APARENTE, em pixels: e ele que decide se o giro cabe no
        // quadro. `raio` ja e o raio desenhado em UA, com o exagero aplicado —
        // e o mesmo numero que o picking e os rotulos usam, entao o teto de
        // giro acende exatamente quando o corpo fica grande o bastante para
        // alguem ver a textura dele.
        c.montado.atualizar(
          jd,
          posDoSolNaCena,
          Math.max(dSol, raioRealUa),
          raio * pixelsPorUa(dists[i]!),
        );

        // Pede o nivel de textura que a distancia justifica, medida em raios
        // do proprio corpo — e o que faz "perto" significar a mesma coisa para
        // Jupiter e para Mercurio.
        const emRaios = dists[i]! / Math.max(raio, 1e-12);
        texturas.pedir(c.chave, 'albedo', emRaios);
        if (CORPOS_VISUAIS[c.chave]) {
          texturas.pedir(c.chave, 'noite', emRaios);
          texturas.pedir(c.chave, 'nuvens', emRaios);
          texturas.pedir(c.chave, 'anel', emRaios);
        }

        const aSuperficie = Math.max(0, dists[i]! - raio);
        if (aSuperficie < maisProximo) maisProximo = aSuperficie;
        if (dists[i]! + raio > maisDistante) maisDistante = dists[i]! + raio;
      }

      // Exposicao pela distancia do SUJEITO ao Sol — o corpo escolhido, e nao
      // o pivo da camera. Na visao geral o pivo E o Sol, e medir dali dava
      // distancia zero: a cena inteira saia dez vezes mais escura do que
      // deveria, com "exposicao x0,1" escrito na tela.
      //
      // Sem corpo escolhido, a referencia e 1 UA: a Terra bem exposta, que e o
      // que uma pessoa espera ver ao abrir o programa.
      const dSujeito =
        sujeito > 0 && sujeito < naCena.length
          ? Math.hypot(
              reais[3 * sujeito]! - reais[0]!,
              reais[3 * sujeito + 1]! - reais[1]!,
              reais[3 * sujeito + 2]! - reais[2]!,
            )
          : 1;
      const querida = Math.max(dSujeito, 0.3) ** 2;
      exposicao = Math.min(EXPOSICAO_MAXIMA, Math.max(EXPOSICAO_MINIMA, querida));
      // Suaviza: mudar a exposicao de um quadro para o outro pisca a tela.
      //
      // **E ENCOSTA no fim.** Uma aproximacao exponencial pura nunca chega ao
      // alvo, entao a imagem nunca para de mudar — nem com a camera parada e a
      // fisica pausada. Era essa a causa de 17% dos pixels trocarem de valor
      // entre dois quadros identicos, que o teste de z-fighting acusava como
      // se fosse disputa de profundidade. Dentro de 0,2% a exposicao assume o
      // valor final, e o quadro fica.
      exposicaoSuave =
        Math.abs(exposicao - exposicaoSuave) < exposicao * 0.002
          ? exposicao
          : exposicaoSuave + (exposicao - exposicaoSuave) * 0.08;

      // **O foco.** Calculado aqui porque e aqui que `dists[i]` e `c.raioKm`
      // ja existem, e em RAIOS REAIS — ver `escala/foco.ts` para por que o raio
      // desenhado seria a escolha obvia e errada.
      focoDoQuadro = 0;
      if (opcoes.alvoDaCamera) {
        const k = naCena.findIndex((c) => c.chave === opcoes.alvoDaCamera);
        if (k >= 0) focoDoQuadro = calcularFoco(dists[k]!, naCena[k]!.raioKm / UA_KM);
      }
      const atenuacao = atenuacaoDasLinhas(focoDoQuadro);

      // As fitas vivem num grupo ancorado no SOL: assim a geometria so muda
      // quando a orbita muda, e nao a cada quadro por causa da origem flutuante.
      fitas.mostrarOrbitas(opcoes.orbitas);
      fitas.mostrarTrilhas(opcoes.trilhas);
      fitas.atenuar(atenuacao, opcoes.alvoDaCamera);
      aneisDeDistancia.atenuar(atenuacao);
      aneisDeDistancia.mostrar(opcoes.aneisDeDistancia);
      aneisDeDistancia.definirEscala(maquete);
      aneisDeDistancia.posicionar([posDesenho[0]!, posDesenho[1]!, posDesenho[2]!], camUa);
      if (estadoParaTrilhas) {
        fitas.atualizar(estadoParaTrilhas as never, camUa, estadoParaTrilhas.tDias, maquete);
      }

      // **A ortografica nao precisa de fatias.** A profundidade dela e linear
      // em z, entao a precisao e uniforme em toda a faixa — as fatias existem
      // para o 1/z da perspectiva, que gasta metade dos bits no primeiro por
      // cento do alcance.
      const janelas = ehOrtografica
        ? [{ near: 1e-4, far: Math.max(maisDistante * 1.2, 1) }]
        : fatiasDeProfundidade(maisProximo, maisDistante, 2);
      fatias = janelas.length;

      // Todas as fatias escrevem no MESMO alvo HDR; o bloom le o alvo pronto,
      // uma vez so. Limpar a cor entre fatias apagaria a de tras.
      renderizador.setRenderTarget(composicao.alvo);
      for (let k = 0; k < janelas.length; k++) {
        const j = janelas[k]!;
        ativa.near = j.near;
        ativa.far = j.far;
        ativa.updateProjectionMatrix();
        if (k === 0) {
          renderizador.autoClear = true;
        } else {
          renderizador.autoClear = false;
          renderizador.clearDepth();
        }
        renderizador.render(cena, ativa);
      }
      renderizador.autoClear = true;
      renderizador.setRenderTarget(null);
      composicao.apresentar(exposicaoSuave);

      // No maximo uma textura entra em uso por quadro: subir um 4K custa
      // dezenas de milissegundos, e distribuir e a diferenca entre uma
      // transicao e um engasgo.
      texturas.aplicarUmaPorQuadro();
    },
  };
}

/** Para onde a camera olha, no espaco dela. Reutiliza um vetor por quadro. */
function direcaoDaCamera(camera: PerspectiveCamera | OrthographicCamera): Vector3 {
  return _frenteDaCamera.set(0, 0, -1).applyQuaternion(camera.quaternion);
}
const _frenteDaCamera = new Vector3();

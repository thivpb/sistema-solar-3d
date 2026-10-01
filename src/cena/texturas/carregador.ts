/**
 * Carrega as texturas por demanda, e sem engasgar o quadro.
 *
 * Dois cuidados que nao sao zelo:
 *
 * 1. **Nunca ha corpo sem textura, nem por um quadro.** Antes de qualquer
 *    imagem chegar, cada material recebe um 1x1 na cor media do corpo. Sem
 *    isso o primeiro quadro mostra nove esferas brancas piscando para a cor
 *    certa, que parece defeito.
 * 2. **No maximo uma textura entra em uso por quadro.** Subir um 4K para a GPU
 *    custa dezenas de milissegundos; distribuir e a diferenca entre uma
 *    transicao e um engasgo.
 *
 * O nivel e escolhido pela distancia, com HISTERESE: sobe para 4K abaixo de 20
 * raios e so volta para 2K acima de 40. Sem a folga, um corpo parado na
 * fronteira ficaria trocando de textura a cada quadro.
 *
 * ## O 8K, e por que ele so existe abaixo de 6 raios
 *
 * O enquadramento 'perto' poe a camera a **3 raios** do corpo, e ali o corpo
 * ocupa 80% da altura da tela: um texel de 4K em Marte vale 5,2 km, e a essa
 * distancia cada pixel da tela cobre menos que isso. E a unica situacao em que
 * o 4K fica devendo, e ela so acontece com UM corpo de cada vez — o que se
 * escolheu olhar.
 *
 * Dai o limiar de 6 raios, e nao de 20: ele e o dobro do enquadramento
 * 'perto', o que da folga para chegar e sair sem trocar duas vezes, e continua
 * longe o bastante de 20 para que nenhum vizinho no quadro peca 8K junto. Na
 * pratica, um corpo por vez sobe a 8K.
 */
import { DataTexture, RGBAFormat, SRGBColorSpace, TextureLoader, type Texture } from 'three';
import type { WebGPURenderer } from 'three/webgpu';
import { mapaDe } from '../../dados/corposVisuais.ts';

const carregador = new TextureLoader();

export type Nivel = '2k' | '4k' | '8k';

const SOBE_ABAIXO_DE_8K = 6; // raios do corpo — so o corpo em foco chega aqui
const DESCE_ACIMA_DE_8K = 12;
const SOBE_ABAIXO_DE = 20;
const DESCE_ACIMA_DE = 40;

/** Do mais alto para o mais baixo. `melhorDisponivel` desce por esta ordem. */
const DO_ALTO_PARA_O_BAIXO: readonly Nivel[] = ['8k', '4k', '2k'];

/**
 * O nivel mais alto que existe no mapa, comecando pelo pedido e descendo.
 *
 * Devolve `null` quando o mapa nao tem nivel nenhum — o que seria defeito de
 * dados, e nao um caso a tratar desenhando errado.
 */
export function melhorDisponivel(
  pedido: Nivel,
  disponiveis: Partial<Record<string, string>>,
): Nivel | null {
  const comeco = DO_ALTO_PARA_O_BAIXO.indexOf(pedido);
  for (let i = comeco; i < DO_ALTO_PARA_O_BAIXO.length; i++) {
    const n = DO_ALTO_PARA_O_BAIXO[i]!;
    if (disponiveis[n]) return n;
  }
  return null;
}

/**
 * Que nivel a distancia justifica, dado o nivel de agora.
 *
 * Separada da funcao que carrega porque e a unica parte com regra: duas faixas
 * de histerese encaixadas, e a resposta "fique como esta" no meio de cada uma.
 * Como funcao pura ela cabe num teste, e `texturas.test.ts` e quem afirma que
 * nenhum par de distancias adjacentes produz troca de ida e volta.
 */
export function nivelPara(distanciaEmRaios: number, agora: Nivel | null): Nivel {
  const atual = agora ?? '2k';
  if (distanciaEmRaios < SOBE_ABAIXO_DE_8K) return '8k';
  if (distanciaEmRaios < SOBE_ABAIXO_DE) return atual === '8k' && distanciaEmRaios <= DESCE_ACIMA_DE_8K ? '8k' : '4k';
  if (distanciaEmRaios <= DESCE_ACIMA_DE) return atual === '2k' ? '2k' : '4k';
  return '2k';
}

interface Entrada {
  textura: Texture;
  nivel: Nivel | null;
  carregando: Nivel | null;
}

/**
 * Um pixel na cor dada. Ocupa o lugar da textura ate ela chegar.
 *
 * **`DataTexture`, e nao `Texture` com um objeto de imagem montado a mao.** Um
 * `Texture` comum espera uma imagem de verdade — `HTMLImageElement`,
 * `ImageBitmap` — e um `{ data, width, height }` improvisado nao sobe para a
 * GPU: o amostrador le zero, inclusive no alfa. Foi assim que o anel de
 * Saturno ficou com opacidade zero enquanto tudo o mais indicava que ele
 * estava certo.
 */
function corSolida(r: number, g: number, b: number): Texture {
  const t = new DataTexture(new Uint8Array([r, g, b, 255]), 1, 1, RGBAFormat);
  t.colorSpace = SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

export class Texturas {
  private readonly entradas = new Map<string, Entrada>();
  private readonly fila: (() => void)[] = [];

  constructor(private readonly renderizador: WebGPURenderer) {}

  /** A textura em uso agora. Sempre devolve algo desenhavel. */
  obter(corpo: string, papel: string, corInicial: [number, number, number]): Texture {
    const chave = `${corpo}/${papel}`;
    let e = this.entradas.get(chave);
    if (!e) {
      e = { textura: corSolida(...corInicial), nivel: null, carregando: null };
      this.entradas.set(chave, e);
    }
    return e.textura;
  }

  /** Existe mapa para este papel? Nem todo corpo tem nuvens ou luzes de cidade. */
  temMapa(corpo: string, papel: string): boolean {
    return mapaDe(corpo, papel) !== undefined;
  }

  /**
   * Pede o nivel que a distancia justifica. Nao bloqueia e nao troca a textura
   * na hora: a troca acontece em `aplicarUmaPorQuadro`.
   */
  pedir(corpo: string, papel: string, distanciaEmRaios: number): void {
    const chave = `${corpo}/${papel}`;
    const e = this.entradas.get(chave);
    const mapa = mapaDe(corpo, papel);
    if (!e || !mapa) return;

    // **Pede o nivel que a distancia justifica, entrega o melhor que EXISTE.**
    //
    // Nem todo mapa tem 8K: ele so e gerado quando a fonte tem 8192 pixels de
    // verdade, porque uma copia ampliada custaria dez megabytes para nao
    // mostrar nada. Urano e Netuno nem 4K tem na fonte.
    //
    // A comparacao com `e.nivel` acontece depois de resolver, e nao antes, e e
    // isso que impede o laco: pedindo 8K num mapa que so tem ate 4K, o
    // resolvido e '4k', e se o corpo ja esta em '4k' nao ha o que fazer. A
    // versao anterior desistia quando o nivel pedido nao existia, e o efeito
    // era pior que o laco — Marte chegava a orbita baixa ainda em 2K, porque o
    // pedido de 8K era descartado em vez de virar o 4K que existia.
    const efetivo = melhorDisponivel(nivelPara(distanciaEmRaios, e.nivel), mapa.niveis);
    if (efetivo === null || e.nivel === efetivo || e.carregando === efetivo) return;
    const querido = efetivo;
    const caminho = mapa.niveis[querido]!;
    e.carregando = querido;
    carregador.load(
      caminho,
      (t) => {
        t.colorSpace = papel === 'albedo' || papel === 'noite' || papel === 'viaLactea' ? SRGBColorSpace : t.colorSpace;
        t.anisotropy = 8;
        // A troca entra na fila em vez de acontecer aqui: subir um 4K custa
        // dezenas de milissegundos, e o carregamento termina no meio de um quadro.
        this.fila.push(() => {
          const antiga = e.textura;
          e.textura = t;
          e.nivel = querido;
          e.carregando = null;
          this.renderizador.initTexture(t);
          // Descarta o marcador de 1 pixel; uma textura de verdade fica.
        if ((antiga.image as { width?: number } | undefined)?.width === 1) antiga.dispose();
          this.aoTrocar?.(chave, t);
        });
      },
      undefined,
      () => {
        e.carregando = null;
      },
    );
  }

  /** Avisa quem precisa religar a textura no material. */
  aoTrocar?: (chave: string, textura: Texture) => void;

  /** Uma por quadro. Chamada no fim do laco, depois de desenhar. */
  aplicarUmaPorQuadro(): void {
    const proxima = this.fila.shift();
    if (proxima) proxima();
  }

  get pendentes(): number {
    return this.fila.length;
  }

  /** Quantas ainda estao sendo baixadas. Com zero, a cena parou de mudar sozinha. */
  get baixando(): number {
    let n = 0;
    for (const e of this.entradas.values()) if (e.carregando) n++;
    return n;
  }
}

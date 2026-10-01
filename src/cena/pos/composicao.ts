/**
 * A composicao final: HDR, bloom, tonemapping, e so entao a tela.
 *
 * ## A ordem, e por que ela nao e negociavel
 *
 *     cena (HDR, sem tonemap) -> bloom -> ACES -> sRGB -> tela -> a interface por cima
 *
 * Bloom DEPOIS do tonemapping nao e bloom: o tonemap ja comprimiu tudo para
 * [0,1], entao nao sobra a faixa alta que produz o halo. O Sol, que na cena
 * chega a valores de 6 e mais, viraria branco liso e o brilho em volta dele
 * simplesmente nao existiria.
 *
 * E a INTERFACE vem depois de tudo, no DOM — e nao dentro do canvas. Assim
 * nenhum bloom pode lavar o texto, e os 4,5:1 de contraste que o projeto
 * promete continuam valendo por construcao, e nao por sorte.
 *
 * ## As fatias de profundidade continuam
 *
 * A cena e desenhada em duas ou mais passadas, com a profundidade limpa entre
 * elas — e isso que permite ir de 31,5 UA a 1 km de altitude. Todas escrevem
 * no MESMO alvo HDR; o bloom le o alvo pronto, uma vez so.
 */
import { HalfFloatType, RenderTarget, SRGBColorSpace, ACESFilmicToneMapping } from 'three';
import { RenderPipeline, type WebGPURenderer } from 'three/webgpu';
import { renderOutput, texture, uniform } from 'three/tsl';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';

export interface Composicao {
  /** O alvo HDR onde as fatias sao desenhadas. */
  alvo: RenderTarget;
  redimensionar(largura: number, altura: number, pixelRatio: number): void;
  /** Leva o alvo para a tela, com bloom e tonemapping. */
  apresentar(exposicao: number): void;
  definirForcaDoBloom(forca: number): void;
}

/**
 * Limiar do bloom: so floresce o que passa de 1,0 em luz linear.
 *
 * Com o limiar em zero, TUDO ganha halo e a cena fica leitosa. Com ele em 1,0,
 * florescem o Sol e as estrelas mais brilhantes — que e o que floresce numa
 * optica de verdade.
 */
const LIMIAR = 1.0;
const RAIO = 0.55;

export function criarComposicao(renderizador: WebGPURenderer): Composicao {
  function novoAlvo(l: number, a: number): RenderTarget {
    return new RenderTarget(l, a, {
      type: HalfFloatType, // HDR: sem isto o valor 6 do Sol seria cortado em 1
      depthBuffer: true,
      samples: 4,
    });
  }

  let alvo = novoAlvo(1, 1);

  const forca = uniform(0.7);
  const exposicaoNo = uniform(1);

  /**
   * O grafo de composicao, refeito a cada redimensionamento.
   *
   * **`RenderTarget.setSize` quebra o pipeline que le o alvo.** O grafo era
   * montado uma vez, na abertura, e depois de qualquer mudanca de tamanho o
   * passe de composicao passava a ler um recurso que nao existia mais: a tela
   * ficava PRETA. Medido, com a cena de partida: brilho medio 5,9 antes de
   * esconder o painel e 0,76 depois — e nao voltava ao mostrar o painel de
   * novo. Re-apontar `cor.value` para `alvo.texture` nao bastava, porque o
   * objeto `Texture` e o mesmo; quem ficou para tras foi o pipeline.
   *
   * Um clique em "Esconder painel" redimensiona o canvas, entao bastava esse
   * botao — que fica na barra de cima, ao lado da Ajuda — para apagar o
   * programa inteiro. Nenhum teste via: `e2e/precisao.spec.ts` esconde e
   * mostra o painel, mas mede `__projecoes`, que vem da CPU e continua certa
   * com a tela preta.
   *
   * Refazer custa uma recompilacao de shader, e redimensionar e raro: acontece
   * quando a janela muda de tamanho ou o painel abre e fecha, e nunca por
   * quadro. O `if` de igualdade em `redimensionar` garante isso.
   */
  function montarPipeline(): RenderPipeline {
    const cor = texture(alvo.texture);
    const comBloom = cor.add(bloom(cor, forca, RAIO, LIMIAR));
    // A exposicao entra ANTES do tonemap, como numa camera: e o diafragma, e
    // nao um ajuste de brilho depois da foto pronta.
    return new RenderPipeline(
      renderizador,
      renderOutput(comBloom.mul(exposicaoNo), ACESFilmicToneMapping, SRGBColorSpace),
    );
  }

  let pipeline = montarPipeline();

  return {
    get alvo() {
      return alvo;
    },
    redimensionar(largura, altura, pixelRatio) {
      const l = Math.max(1, Math.round(largura * pixelRatio));
      const a = Math.max(1, Math.round(altura * pixelRatio));
      if (l === alvo.width && a === alvo.height) return;
      // **Um alvo NOVO, e nao `setSize` no antigo.** Ver `montarPipeline`.
      const velho = alvo;
      alvo = novoAlvo(l, a);
      velho.dispose();
      // O grafo inteiro e refeito: ver `montarPipeline`.
      pipeline = montarPipeline();
    },
    apresentar(exposicao) {
      exposicaoNo.value = exposicao;
      pipeline.render();
    },
    definirForcaDoBloom(f) {
      forca.value = f;
    },
  };
}

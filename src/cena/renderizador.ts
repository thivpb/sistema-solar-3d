/**
 * O renderizador, e a queda para WebGL2 quando o WebGPU nao esta la.
 *
 * `WebGPU.isAvailable()` so testa a presenca de `navigator.gpu`. Isso NAO
 * garante que ha adaptador: `requestAdapter()` ainda pode devolver null — num
 * navegador com a flag ligada e driver sem suporte, numa maquina virtual, ou
 * com a GPU em economia de energia. Por isso o `init()` vai dentro de
 * try/catch e, na falha, o renderizador e RECRIADO com `forceWebGL: true` —
 * essa opcao e decidida no construtor e nao da para ligar depois.
 *
 * `?render=webgl2` na URL forca o caminho de queda. Sem isso ele nao seria
 * exercitado por ninguem: o Safari 26 e o Chromium atual ja trazem WebGPU.
 */
import { WebGPURenderer } from 'three/webgpu';
import type WebGPUBackend from 'three/src/renderers/webgpu/WebGPUBackend.js';

export type TipoDeBackend = 'webgpu' | 'webgl2';

/**
 * O Three.js pode cair para WebGL2 por dentro, sem lancar. A unica forma de
 * saber qual backend ficou de pe e perguntar ao backend — e o tipo publico de
 * `renderer.backend` e a classe base, que nao carrega o discriminador. O
 * `isWebGPUBackend` existe em tempo de execucao; aqui so se afirma isso ao
 * compilador, em um lugar so.
 */
function ehWebGPU(r: WebGPURenderer): boolean {
  return (r.backend as Partial<WebGPUBackend> | undefined)?.isWebGPUBackend === true;
}

export interface Renderizacao {
  renderizador: WebGPURenderer;
  backend: TipoDeBackend;
  /** Por que caiu para WebGL2, quando caiu. Vai escrito no HUD tecnico. */
  motivoDaQueda: string | null;
}

export async function criarRenderizador(canvas: HTMLCanvasElement): Promise<Renderizacao> {
  const forcado = new URLSearchParams(location.search).get('render') === 'webgl2';

  if (!forcado) {
    try {
      const r = new WebGPURenderer({ canvas, antialias: true, alpha: false });
      await r.init();
      if (ehWebGPU(r)) {
        return { renderizador: r, backend: 'webgpu', motivoDaQueda: null };
      }
      // O proprio Three.js ja caiu para WebGL2 por dentro. Nao e erro, mas o
      // HUD precisa dizer, porque o orcamento de GPU deixa de ser medivel.
      return { renderizador: r, backend: 'webgl2', motivoDaQueda: 'o navegador nao entregou um adaptador WebGPU' };
    } catch (erro) {
      const motivo = erro instanceof Error ? erro.message : String(erro);
      const r = new WebGPURenderer({ canvas, antialias: true, alpha: false, forceWebGL: true });
      await r.init();
      return { renderizador: r, backend: 'webgl2', motivoDaQueda: motivo };
    }
  }

  const r = new WebGPURenderer({ canvas, antialias: true, alpha: false, forceWebGL: true });
  await r.init();
  return { renderizador: r, backend: 'webgl2', motivoDaQueda: 'pedido por ?render=webgl2' };
}

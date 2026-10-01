/**
 * Quanto espaco um texto ocupa, sem LER LAYOUT.
 *
 * A regra dura do caminho por quadro e que nada nele pode chamar
 * `getBoundingClientRect`, `offsetWidth` ou `getComputedStyle`: qualquer uma
 * forca layout sincrono, e o posicionador de rotulos decide abreviar DENTRO do
 * quadro. E o equivalente exato, no DOM, do `font.render()` por quadro que o
 * projeto em pygame ja mediu — 4,4 us contra 0,17 us com cache — e resolveu.
 *
 * A saida e `measureText` num canvas 2D fora da tela, com cache por
 * `(texto, tamanho, peso)`. O cache e invalidado quando as fontes terminam de
 * carregar e quando a escala de texto muda, que sao as duas unicas coisas que
 * mudam a largura de um mesmo texto.
 */
let contexto: CanvasRenderingContext2D | null = null;
const cache = new Map<string, number>();

const FAMILIA = "'Inter Variable', system-ui, -apple-system, 'Helvetica Neue', sans-serif";

function obterContexto(): CanvasRenderingContext2D | null {
  if (contexto) return contexto;
  const canvas = document.createElement('canvas');
  contexto = canvas.getContext('2d');
  return contexto;
}

export function larguraDoTexto(texto: string, tamanhoPx: number, peso = 500): number {
  const chave = `${tamanhoPx}|${peso}|${texto}`;
  const guardada = cache.get(chave);
  if (guardada !== undefined) return guardada;

  const ctx = obterContexto();
  if (!ctx) return texto.length * tamanhoPx * 0.55;
  ctx.font = `${peso} ${tamanhoPx}px ${FAMILIA}`;
  const l = ctx.measureText(texto).width;
  cache.set(chave, l);
  return l;
}

export function limparCache(): void {
  cache.clear();
}

/** Liga a invalidacao aos dois eventos que mudam a largura de um mesmo texto. */
export function observarMudancasDeFonte(): () => void {
  const aoCarregarFontes = (): void => limparCache();
  void document.fonts?.ready.then(aoCarregarFontes);

  const observador = new MutationObserver(limparCache);
  observador.observe(document.documentElement, { attributes: true, attributeFilter: ['style'] });
  return () => observador.disconnect();
}

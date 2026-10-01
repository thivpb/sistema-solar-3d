/**
 * Salvar uma imagem da tela.
 *
 * Dois cuidados herdados da versao em pygame, e um novo que so existe no DOM:
 *
 * 1. **Ler o canvas no MESMO quadro em que ele foi desenhado.** Com WebGL2 o
 *    conteudo e descartado depois de apresentado (`preserveDrawingBuffer` e
 *    falso, e liga-lo custa desempenho em todo quadro para servir a um botao).
 *    Ler fora do quadro devolve buffer vazio — foi assim que o teste de
 *    precisao chegou a acusar "tela preta" num caminho que desenhava certo.
 *
 * 2. **Nao deixar a pausa da gravacao virar salto na data.** A versao anterior
 *    descartava um `tick()` depois de salvar, pelo mesmo motivo: o tempo gasto
 *    escrevendo o arquivo nao e tempo que o Sistema Solar andou.
 *
 * 3. **Os rotulos entram na imagem.** Eles sao DOM, e nao pixels do canvas;
 *    sem compor, a captura sai sem nome nenhum e nao serve para nada.
 */
export interface PedidoDeCaptura {
  canvas: HTMLCanvasElement;
  /**
   * Tamanho do canvas em pixels CSS.
   *
   * Vem de fora, medido pelo `ResizeObserver`, e nao de `clientWidth` aqui
   * dentro: este modulo e chamado DE DENTRO do quadro, e ler layout ali forca
   * reflow sincrono. Vale mesmo sendo uma vez so por captura — o lint proibe o
   * padrao, nao a frequencia, porque e o padrao que volta despercebido.
   */
  larguraCss: number;
  alturaCss: number;
  /** Rotulos ja colocados, em pixels CSS. */
  rotulos: readonly { texto: string; x: number; y: number; largura: number; altura: number }[];
  /** Uma linha no rodape: a data simulada, e o que estiver exagerado. */
  rodape: string;
  nomeDoArquivo: string;
}

const COR_DA_PLACA = 'rgba(12, 14, 22, 0.8)';
const COR_DO_TEXTO = 'rgb(232, 234, 240)';
const FAMILIA = "'Inter Variable', system-ui, -apple-system, sans-serif";

/**
 * Compoe e baixa. Tem de ser chamada DENTRO do quadro, logo apos o desenho —
 * daí ela receber o canvas ja pronto em vez de pedir um novo render.
 */
export function capturar(pedido: PedidoDeCaptura): void {
  const { canvas, rotulos, rodape, larguraCss, alturaCss } = pedido;

  const fora = document.createElement('canvas');
  fora.width = canvas.width;
  fora.height = canvas.height;
  const ctx = fora.getContext('2d');
  if (!ctx) return;

  ctx.drawImage(canvas, 0, 0);

  // Os rotulos vem em pixels CSS; o canvas esta em pixels de dispositivo.
  const escala = canvas.width / Math.max(1, larguraCss);
  ctx.scale(escala, escala);

  const tamanho = 13;
  ctx.font = `500 ${tamanho}px ${FAMILIA}`;
  ctx.textBaseline = 'middle';
  for (const r of rotulos) {
    ctx.fillStyle = COR_DA_PLACA;
    ctx.beginPath();
    ctx.roundRect(r.x, r.y, r.largura, r.altura, 5);
    ctx.fill();
    ctx.fillStyle = COR_DO_TEXTO;
    ctx.fillText(r.texto, r.x + 8, r.y + r.altura / 2);
  }

  if (rodape) {
    ctx.font = `400 12px ${FAMILIA}`;
    const largura = ctx.measureText(rodape).width + 16;
    ctx.fillStyle = COR_DA_PLACA;
    ctx.beginPath();
    ctx.roundRect(8, alturaCss - 28, largura, 20, 5);
    ctx.fill();
    ctx.fillStyle = COR_DO_TEXTO;
    ctx.fillText(rodape, 16, alturaCss - 18);
  }

  fora.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = pedido.nomeDoArquivo;
    a.click();
    // Revogar no proximo quadro: revogar antes do clique ser processado
    // cancelaria o download em alguns navegadores.
    requestAnimationFrame(() => URL.revokeObjectURL(url));
  }, 'image/png');
}

/** `sistema-solar-20260929-163045.png` — ordenavel por nome. */
export function nomeDaCaptura(agora: Date): string {
  const p = (n: number, d = 2): string => String(n).padStart(d, '0');
  return (
    `sistema-solar-${agora.getFullYear()}${p(agora.getMonth() + 1)}${p(agora.getDate())}` +
    `-${p(agora.getHours())}${p(agora.getMinutes())}${p(agora.getSeconds())}.png`
  );
}

/**
 * Um rotulo esta atras de alguma coisa?
 *
 * Teste analitico raio-esfera, e nao leitura do buffer de profundidade: e
 * deterministico, roda sem GPU, e por isso da para testar headless. Em 2D
 * ortografico este problema nao existia — la bastava ordenar por profundidade.
 *
 * O rotulo ocluido NAO some e NAO fica translucido: reduzir opacidade
 * destruiria o contraste garantido de 4,5:1, e o projeto proibe transmitir
 * informacao so por intensidade. Ele ganha contorno tracejado, que e forma.
 */
export interface Esfera {
  /** Centro em coordenadas de camera (a camera esta na origem). */
  centro: readonly [number, number, number];
  raio: number;
}

/**
 * Verdadeiro quando o segmento da camera (origem) ate `ponto` atravessa a esfera.
 *
 * A propria esfera do corpo rotulado nao conta: o rotulo fica na borda dele.
 */
export function estaOcluido(
  ponto: readonly [number, number, number],
  esferas: readonly Esfera[],
  ignorar: number,
): boolean {
  const dist = Math.hypot(ponto[0], ponto[1], ponto[2]);
  if (dist === 0) return false;
  const dx = ponto[0] / dist;
  const dy = ponto[1] / dist;
  const dz = ponto[2] / dist;

  for (let i = 0; i < esferas.length; i++) {
    if (i === ignorar) continue;
    const e = esferas[i]!;
    const cx = e.centro[0];
    const cy = e.centro[1];
    const cz = e.centro[2];
    // Projecao do centro sobre o raio. Atras da camera nao oclui nada.
    const t = cx * dx + cy * dy + cz * dz;
    if (t <= 0 || t >= dist) continue;
    const px = cx - t * dx;
    const py = cy - t * dy;
    const pz = cz - t * dz;
    if (Math.hypot(px, py, pz) < e.raio) return true;
  }
  return false;
}

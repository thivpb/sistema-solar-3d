/**
 * O tamanho desenhado, e a honestidade dele.
 *
 * Em escala real os planetas somem: a Terra vista de 31,5 UA tem 6e-5 pixel.
 * A versao anterior resolvia desenhando discos de 3 a 16 px e DIZENDO quantas
 * vezes o tamanho estava exagerado. A mesma honestidade tem de sobreviver em
 * perspectiva, e sobrevive assim:
 *
 *     p_real     = raioUa * f / d                    raio aparente verdadeiro, em px
 *     p_piso     = sol ? 11 : clamp(5*(r/6371)^0,38, 3, 16)
 *     p_exibido  = (p_real^3 + p_piso^3)^(1/3)
 *     ampliacao  = p_exibido / p_real                escrita na tela, ao vivo
 *
 * `n = 3` e C-infinito e estritamente crescente: **aproximar-se nunca encolhe
 * o planeta**, e o exagero se apaga sozinho. Em `p_real = p_piso` a ampliacao
 * e 1,26x; em `3*p_piso` ja e 1,012x. Nao ha salto de tamanho em lugar nenhum.
 *
 * **O caso do Sol e especial e foi portado.** A versao anterior fixava 11 px
 * para ele em vez de usar a formula; pela formula generica ele daria 29,8,
 * clipado em 16 — 45% maior que hoje, justo no corpo que vai alimentar o
 * limiar do bloom na fase F4.
 *
 * **Em "tamanho real" o piso e ZERO, e nao ha impostor.** Os planetas somem
 * mesmo. Um impostor sempre ligado tornaria falsa a propria opcao que existe
 * para mostrar a escala verdadeira.
 *
 * Unidade: **pixels CSS**, com `setPixelRatio(min(dpr, 2))`. Sem fixar isso os
 * planetas apareceriam com metade do tamanho num Retina, porque o piso foi
 * herdado de um codigo sem `devicePixelRatio`.
 */
const RAIO_TERRA_KM = 6371;
const RAIO_SOL_PX = 11;
const EXPOENTE = 0.38;
const PISO_MIN_PX = 3;
const PISO_MAX_PX = 16;

export function pisoEmPixels(raioKm: number, ehSol: boolean): number {
  if (ehSol) return RAIO_SOL_PX;
  const relativo = raioKm / RAIO_TERRA_KM;
  return Math.min(PISO_MAX_PX, Math.max(PISO_MIN_PX, 5 * relativo ** EXPOENTE));
}

/** Pixels por unidade de tamanho angular, dada a altura do canvas e o fov. */
export function fatorDeProjecao(fovGraus: number, alturaPx: number): number {
  return alturaPx / (2 * Math.tan((fovGraus * Math.PI) / 360));
}

/**
 * Raio que a malha deve ter, em UA, para aparecer com o tamanho certo.
 *
 * **Recebe `pixelsPorUa` ja avaliado, e nao o fov.** Em perspectiva esse
 * numero vale `f / d` e depende da distancia; em ortografica e constante e
 * nao depende de nada. Passar o fov para ca obrigaria este modulo a saber que
 * existem duas projecoes — e a formula do exagero e a mesma nas duas, porque
 * ela e sobre PIXELS.
 */
export function raioDesenhadoUa(
  raioRealUa: number,
  pixelsPorUa: number,
  tamanhoReal: boolean,
  ehSol: boolean,
): number {
  if (tamanhoReal) return raioRealUa;
  if (!(pixelsPorUa > 0)) return raioRealUa;
  const pReal = raioRealUa * pixelsPorUa;
  const pPiso = pisoEmPixels(raioRealUa * 149597870.7, ehSol);
  const pExibido = Math.cbrt(pReal ** 3 + pPiso ** 3);
  return pExibido / pixelsPorUa;
}

/** Quantas vezes o corpo esta maior que o real. 1,0 significa tamanho verdadeiro. */
export function ampliacao(raioRealUa: number, pixelsPorUa: number, ehSol: boolean): number {
  const pReal = raioRealUa * pixelsPorUa;
  if (pReal <= 0) return Infinity;
  const pPiso = pisoEmPixels(raioRealUa * 149597870.7, ehSol);
  return Math.cbrt(pReal ** 3 + pPiso ** 3) / pReal;
}

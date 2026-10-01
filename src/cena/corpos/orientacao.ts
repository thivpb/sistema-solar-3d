/**
 * Para onde o eixo de um corpo aponta, e onde esta o meridiano zero.
 *
 * A convencao da IAU da o polo norte em `(alpha_0, delta_0)` — ascensao reta e
 * declinacao, no frame **equatorial ICRF** — e o meridiano zero por
 * `W = W_0 + W_ponto * d`, com `d` em dias desde J2000.
 *
 * **A simulacao NAO roda nesse frame.** Ela roda no ecliptico J2000, escolhido
 * em `gerar_efemeride.py` (`REF_PLANE=ECLIPTIC`). Entao a orientacao e a
 * matriz inteira:
 *
 *     M = Rx(−eps) · Rz(alpha_0 + 90°) · Rx(90° − delta_0) · Rz(W)
 *
 * Duas formas de errar isso, as duas caras:
 *
 *   - **Rodar so o polo** e esquecer o `Rz(W)`: o eixo fica certo e o
 *     meridiano zero fica em qualquer lugar. A textura nasce girada, e como
 *     nao ha com o que comparar, ninguem nota.
 *   - **Esquecer o `Rx(−eps)`**: todo planeta ganha 23,44° a mais de
 *     inclinacao. O resultado "parece quase certo", que e o pior tipo de erro:
 *     a Terra continua inclinada, Urano continua deitado, e tudo esta errado.
 *
 * O `+90°` no primeiro Rz e o que alinha o meridiano de origem com o no
 * ascendente do equador do corpo — nao e um ajuste arbitrario.
 */
import { Euler, Matrix4, Quaternion } from 'three';
import { OBLIQUIDADE_DA_ECLIPTICA, type Rotacao } from '../../dados/corposVisuais.ts';

const GRAU = Math.PI / 180;

const rx = (a: number): Matrix4 => new Matrix4().makeRotationX(a);
const rz = (a: number): Matrix4 => new Matrix4().makeRotationZ(a);

/**
 * Dias desde J2000 (JD 2451545,0), que e a epoca das constantes da IAU.
 * O `jd` da simulacao ja vem em TDB, que e a escala certa.
 */
export const diasDesdeJ2000 = (jd: number): number => jd - 2451545.0;

const matriz = new Matrix4();
const quaternio = new Quaternion();

/**
 * `E1 = 125,045° − 0,0529921°/dia`, o angulo do no ascendente da orbita da Lua.
 * So a Lua tem termos de E1 grandes o bastante para importar aqui.
 */
function polosComE1(rot: Rotacao, d: number): { ra: number; dec: number; w: number } {
  let ra = rot.poloRa;
  let dec = rot.poloDec;
  let w = rot.w0 + rot.wPorDia * d;

  if (rot.e1) {
    const e1 = (125.045 - 0.0529921 * d) * GRAU;
    ra += rot.e1.ra * Math.sin(e1);
    dec += rot.e1.dec * Math.cos(e1);
    w += rot.e1.w * Math.sin(e1);
  }

  // Os termos de argumento proprio. `porSeculo` e por SECULO juliano, que e a
  // unidade em que a IAU publica os angulos do polo — `d / 36525`. Misturar
  // isso com os dias de `E1` daria um erro de quatro ordens de grandeza no
  // argumento, e o resultado ainda pareceria um angulo.
  if (rot.periodicos) {
    const t = d / 36525;
    for (const p of rot.periodicos) {
      const a = (p.a0 + p.porSeculo * t) * GRAU;
      if (p.ra) ra += p.ra * Math.sin(a);
      if (p.dec) dec += p.dec * Math.cos(a);
      if (p.w) w += p.w * Math.sin(a);
    }
  }

  return { ra, dec, w };
}

/**
 * Quaternio que leva o corpo da orientacao de referencia para a de agora.
 *
 * A cena usa Z como norte da ecliptica, que e o mesmo eixo do frame de
 * trabalho — entao a conversao e so o `Rx(−eps)` de entrada.
 */
/**
 * `deslocamentoDoMeridiano` soma graus ao `W` da IAU, e a nada mais.
 *
 * Existe para o teto de giro (`giroVisivel.ts`): o meridiano desenhado atrasa
 * em relacao ao real quando a rotacao passaria de alguns pixels por quadro. Ele
 * entra SO no `Rz(W)` final — o polo, a obliquidade e o no ascendente ficam
 * intactos, entao o eixo continua apontando para onde a IAU manda e o
 * terminador continua geometricamente certo. O que muda e qual meridiano esta
 * de frente.
 *
 * Zero por omissao: quem chama sem ele — `orientacao.test.ts`, `eixoDoCorpo`,
 * a ficha de cada corpo — continua recebendo a orientacao da IAU sem atalho.
 */
export function orientacaoDoCorpo(
  rot: Rotacao,
  jd: number,
  alvo = quaternio,
  deslocamentoDoMeridiano = 0,
): Quaternion {
  const p = polosComE1(rot, diasDesdeJ2000(jd));

  matriz
    .copy(rx(-OBLIQUIDADE_DA_ECLIPTICA * GRAU))
    .multiply(rz((p.ra + 90) * GRAU))
    .multiply(rx((90 - p.dec) * GRAU))
    .multiply(rz((p.w + deslocamentoDoMeridiano) * GRAU));

  return alvo.setFromRotationMatrix(matriz);
}

/** O eixo de rotacao, ja no frame da cena. Usado para os aneis e para o HUD. */
export function eixoDoCorpo(rot: Rotacao, jd = 2451545.0): [number, number, number] {
  const p = polosComE1(rot, diasDesdeJ2000(jd));
  const ra = p.ra * GRAU;
  const dec = p.dec * GRAU;
  // Do equatorial ICRF para cartesiano...
  const x = Math.cos(dec) * Math.cos(ra);
  const y = Math.cos(dec) * Math.sin(ra);
  const z = Math.sin(dec);
  // ...e dai para a ecliptica, girando −eps em torno de X.
  const e = -OBLIQUIDADE_DA_ECLIPTICA * GRAU;
  return [x, y * Math.cos(e) - z * Math.sin(e), y * Math.sin(e) + z * Math.cos(e)];
}

/** Quantos graus o eixo esta longe do norte da ecliptica. Para conferir contra a tabela. */
export function inclinacaoDoEixoGraus(rot: Rotacao, jd = 2451545.0): number {
  const eixo = eixoDoCorpo(rot, jd);
  return Math.acos(Math.min(1, Math.max(-1, eixo[2]))) / GRAU;
}

/** Euler equivalente, so para depurar — nao entra no caminho por quadro. */
export function eulerDoCorpo(rot: Rotacao, jd: number): Euler {
  return new Euler().setFromQuaternion(orientacaoDoCorpo(rot, jd), 'ZXY');
}

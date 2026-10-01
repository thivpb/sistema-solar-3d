/**
 * O estado da camera: `(pivo, raio, azimute, elevacao)`. NUNCA um centro absoluto.
 *
 * **Esta escolha resolve, por construcao, a licao mais cara do projeto anterior.**
 * La a camera guardava um centro absoluto e o fazia perseguir a posicao do
 * corpo acompanhado, com amortecimento exponencial. Amortecimento exponencial
 * nunca alcanca um alvo em movimento: mediram 11 px de atraso para Marte a 30
 * dias/s e 237 px a 3.650 — e o erro em PIXELS nao encolhia, porque o zoom
 * crescia na mesma taxa em que o erro decaia. A correcao de la foi um prazo
 * fixo de 0,45 s, apos o qual a camera travava rigidamente no corpo.
 *
 * Em coordenadas relativas ao pivo nao existe perseguicao. Acompanhar e
 * trocar o pivo pela posicao do corpo a cada quadro, e o erro e exatamente
 * ZERO. O prazo fixo continua existindo, mas so onde continua sendo o
 * problema certo: nas TRANSICOES, em que o alvo tambem se move.
 *
 * Um detalhe fecha o buraco: o pivo tem de vir do MESMO instantaneo e da MESMA
 * interpolacao que as malhas. Se a camera lesse a posicao integrada e as
 * malhas a interpolada, o erro voltaria com outra cara.
 */
export interface EstadoCamera {
  /** Ponto para onde a camera olha, em UA absolutas. */
  pivo: [number, number, number];
  /** Distancia da camera ao pivo, em UA. */
  raio: number;
  /** Radianos. 0 aponta para +X. */
  azimute: number;
  /** Radianos. +pi/2 e o polo norte da ecliptica; ficamos abaixo dele. */
  elevacao: number;
  /** Campo de visao vertical, em graus. */
  fovGraus: number;
}

/** Quase pi/2, e nao pi/2: no polo exato a base perde uma direcao e a camera gira sozinha. */
export const ELEVACAO_MAXIMA = Math.PI / 2 - 1e-4;

export const RAIO_MINIMO_UA = 1e-9; // ~0,15 km
export const RAIO_MAXIMO_UA = 200;

export function criarCamera(parcial: Partial<EstadoCamera> = {}): EstadoCamera {
  return {
    pivo: [0, 0, 0],
    raio: 31.5,
    azimute: -Math.PI / 2,
    elevacao: 0.45,
    fovGraus: 45,
    ...parcial,
  };
}

/** Posicao da camera no mundo, em UA absolutas. */
export function posicaoDaCamera(c: EstadoCamera): [number, number, number] {
  const cosEl = Math.cos(c.elevacao);
  return [
    c.pivo[0] + c.raio * cosEl * Math.cos(c.azimute),
    c.pivo[1] + c.raio * cosEl * Math.sin(c.azimute),
    c.pivo[2] + c.raio * Math.sin(c.elevacao),
  ];
}

export function orbitar(c: EstadoCamera, dAzimute: number, dElevacao: number): void {
  c.azimute += dAzimute;
  // Prende a elevacao em vez de deixar passar do polo. Passar do polo inverte
  // o "cima" e a cena parece dar um salto — o mesmo cuidado que a versao
  // ortografica anterior ja tinha.
  c.elevacao = Math.min(ELEVACAO_MAXIMA, Math.max(-ELEVACAO_MAXIMA, c.elevacao + dElevacao));
}

/**
 * Zoom. O fator multiplica o raio, entao um toque perto e um toque longe
 * mudam a cena na mesma proporcao — que e como a percepcao funciona.
 */
export function aproximar(c: EstadoCamera, fator: number): void {
  c.raio = Math.min(RAIO_MAXIMO_UA, Math.max(RAIO_MINIMO_UA, c.raio / fator));
}

/**
 * Aproxima mantendo FIXO o ponto que esta sob o cursor.
 *
 * A conta e uma homotetia com centro na ancora: se a camera chega `f` vezes
 * mais perto, tudo o que nao e a ancora precisa se aproximar dela na mesma
 * proporcao. Como a camera e definida pelo pivo, basta mover o pivo:
 *
 *     pivo' = ancora + (pivo − ancora) / f
 *
 * O angulo e a distancia camera-pivo mudam sozinhos por construcao, e a
 * direcao de vista nao se mexe — e por isso que o mundo nao gira enquanto se
 * aproxima, que e o defeito de uma ancoragem feita girando a camera.
 *
 * O raio e cortado nos limites ANTES de mover o pivo, e o fator efetivo sai
 * dessa razao: sem isso, no limite do zoom o pivo continuaria escorregando
 * para a ancora com a imagem parada, e a cena andaria de lado sozinha.
 */
export function aproximarEm(
  c: EstadoCamera,
  fator: number,
  ancoraUa: readonly [number, number, number],
): void {
  const anterior = c.raio;
  aproximar(c, fator);
  const efetivo = anterior / c.raio;
  if (!(efetivo > 0) || Math.abs(efetivo - 1) < 1e-12) return;
  c.pivo = [
    ancoraUa[0] + (c.pivo[0] - ancoraUa[0]) / efetivo,
    ancoraUa[1] + (c.pivo[1] - ancoraUa[1]) / efetivo,
    ancoraUa[2] + (c.pivo[2] - ancoraUa[2]) / efetivo,
  ];
}

/** O versor que vai da camera para o pivo. */
export function direcaoDeVista(c: EstadoCamera): [number, number, number] {
  const cosEl = Math.cos(c.elevacao);
  return [-cosEl * Math.cos(c.azimute), -cosEl * Math.sin(c.azimute), -Math.sin(c.elevacao)];
}

/** Desloca o pivo no plano da tela. Solta o acompanhamento — quem faz isto quer olhar outra coisa. */
export function deslocar(c: EstadoCamera, dxUa: number, dyUa: number): void {
  // Direita e cima da camera, derivadas dos mesmos angulos que a posicao.
  const direita: [number, number, number] = [-Math.sin(c.azimute), Math.cos(c.azimute), 0];
  const sinEl = Math.sin(c.elevacao);
  const cosEl = Math.cos(c.elevacao);
  const cima: [number, number, number] = [
    -sinEl * Math.cos(c.azimute),
    -sinEl * Math.sin(c.azimute),
    cosEl,
  ];
  for (let k = 0; k < 3; k++) {
    c.pivo[k] = c.pivo[k]! + direita[k]! * dxUa + cima[k]! * dyUa;
  }
}

/**
 * Largura visivel no plano do alvo, em UA.
 *
 * Em perspectiva NAO existe "campo de visao em UA": o que cabe na tela depende
 * da profundidade. Esta e a leitura honesta — mede certo exatamente no plano
 * que passa pelo pivo, e a interface diz isso por escrito, junto com a
 * distancia da camera ao alvo.
 */
export function larguraVisivelUa(c: EstadoCamera, proporcao: number): number {
  return alturaVisivelUa(c) * proporcao;
}

/**
 * A altura do que cabe na tela, no plano do pivo, em UA.
 *
 * **E a mesma grandeza nas duas projecoes**, e e por isso que ela existe: a
 * ortografica e definida por essa altura, e a perspectiva a calcula do fov.
 * Trocar de uma para a outra preservando este numero e o que faz a tecla `V`
 * nao dar um salto de zoom.
 */
export function alturaVisivelUa(c: EstadoCamera): number {
  return 2 * c.raio * Math.tan((c.fovGraus * Math.PI) / 360);
}

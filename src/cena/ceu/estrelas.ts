/**
 * O ceu de estrelas, do catalogo Yale.
 *
 * ## Por que catalogo, e nao pontinhos aleatorios
 *
 * A versao em pygame desenhava 180 pontos com semente fixa, presos a TELA:
 * eram decoracao, e o proprio codigo dizia isso. Num programa que gira a
 * camera pelo Sistema Solar inteiro, decoracao presa a tela deixa de
 * funcionar — as estrelas andariam junto com o planeta.
 *
 * Com o catalogo, as constelacoes ficam onde devem: quem olha de Marte ve o
 * mesmo ceu que ve da Terra, porque a 1,5 UA de diferenca nao muda nada a
 * dezenas de anos-luz. Sirius fica onde Sirius fica.
 *
 * ## Brilho e tamanho
 *
 *     L = 10^(−0,4 · (V − 6,5))
 *
 * Magnitude e uma escala logaritmica invertida: cada 5 magnitudes sao um fator
 * de 100 em brilho. Sirius, em −1,46, fica cerca de 1.550 vezes acima do
 * limite do olho nu — e e essa faixa dinamica que alimenta o bloom e faz as
 * poucas estrelas de verdade brilhantes se destacarem das mil fracas.
 *
 * O TAMANHO e FIXO, em ~1,8 px. Se variasse com o brilho, as estrelas
 * mudariam de tamanho conforme a exposicao automatica muda — e uma estrela que
 * incha quando a camera se aproxima de Netuno seria simplesmente errado.
 *
 * ## Cor
 *
 * Do corpo negro, a partir da temperatura que o catalogo ja traz. Rigel a
 * 11.000 K sai azul; Betelgeuse a 3.600 K sai laranja. Nao e escolha artistica:
 * e a cor que aquela temperatura tem.
 */
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Euler,
  Points,
  Vector3,
} from 'three';
import { PointsNodeMaterial } from 'three/webgpu';
import { attribute, float, positionLocal, uniform, vec3, vec4 } from 'three/tsl';
import { OBLIQUIDADE_DA_ECLIPTICA } from '../../dados/corposVisuais.ts';

/** Magnitude a partir da qual uma estrela conta como "visivel a olho nu". */
const MAGNITUDE_DE_REFERENCIA = 6.5;

/** Distancia em que as estrelas sao desenhadas. Longe o bastante para nunca
 *  entrar na cena, perto o bastante para caber no far da fatia mais distante. */
const RAIO_DA_ESFERA_CELESTE = 5e5;

/**
 * Cor de um corpo negro, aproximada. Fonte: Tanner Helland, e conferida contra
 * a tabela de Mitchell Charity — erro abaixo de 5% na faixa de 1.500 a 40.000 K,
 * que cobre todas as estrelas do catalogo.
 */
function corDeCorpoNegro(kelvin: number): [number, number, number] {
  const t = Math.min(40000, Math.max(1000, kelvin)) / 100;
  let r: number;
  let g: number;
  let b: number;

  if (t <= 66) {
    r = 255;
    g = 99.4708025861 * Math.log(t) - 161.1195681661;
    b = t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  } else {
    r = 329.698727446 * Math.pow(t - 60, -0.1332047592);
    g = 288.1221695283 * Math.pow(t - 60, -0.0755148492);
    b = 255;
  }
  const limitar = (v: number): number => Math.min(1, Math.max(0, v / 255));
  return [limitar(r), limitar(g), limitar(b)];
}

export interface Estrelas {
  pontos: Points;
  mostrar(ligado: boolean): void;
  /** A esfera celeste acompanha a camera: ela esta infinitamente longe. */
  acompanhar(): void;
}

export async function carregarEstrelas(caminho = 'ceu/bsc5.bin'): Promise<Estrelas | null> {
  let dados: ArrayBuffer;
  try {
    const resp = await fetch(caminho);
    if (!resp.ok) return null;
    dados = await resp.arrayBuffer();
  } catch {
    // Sem catalogo o programa abre do mesmo jeito, so com o panorama da Via
    // Lactea ao fundo. Preferencia nao pode virar motivo de tela de erro, e
    // ceu tambem nao.
    return null;
  }

  const visao = new DataView(dados);
  const n = Math.floor(dados.byteLength / 12);
  const posicoes = new Float32Array(n * 3);
  const cores = new Float32Array(n * 3);
  const brilhos = new Float32Array(n);

  // Do equatorial do catalogo para a ecliptica da cena: uma rotacao so, a
  // mesma `eps` que inclina os eixos dos planetas.
  const paraEcliptica = new Euler(-OBLIQUIDADE_DA_ECLIPTICA * (Math.PI / 180), 0, 0);
  const v = new Vector3();

  for (let i = 0; i < n; i++) {
    const o = i * 12;
    const ra = visao.getFloat32(o, true);
    const dec = visao.getFloat32(o + 4, true);
    const mag = visao.getInt16(o + 8, true) / 100;
    const temp = visao.getUint16(o + 10, true) * 10;

    v.set(
      Math.cos(dec) * Math.cos(ra),
      Math.cos(dec) * Math.sin(ra),
      Math.sin(dec),
    )
      .applyEuler(paraEcliptica)
      .multiplyScalar(RAIO_DA_ESFERA_CELESTE);

    posicoes[3 * i] = v.x;
    posicoes[3 * i + 1] = v.y;
    posicoes[3 * i + 2] = v.z;

    const cor = corDeCorpoNegro(temp);
    cores[3 * i] = cor[0];
    cores[3 * i + 1] = cor[1];
    cores[3 * i + 2] = cor[2];

    brilhos[i] = Math.pow(10, -0.4 * (mag - MAGNITUDE_DE_REFERENCIA));
  }

  const geometria = new BufferGeometry();
  geometria.setAttribute('position', new BufferAttribute(posicoes, 3));
  geometria.setAttribute('corDaEstrela', new BufferAttribute(cores, 3));
  geometria.setAttribute('brilho', new BufferAttribute(brilhos, 1));

  const escala = uniform(1.8);
  const material = new PointsNodeMaterial({
    transparent: true,
    depthWrite: false,
    // Aditivo: duas estrelas proximas somam, como somam de verdade.
    blending: AdditiveBlending,
  });
  // Tamanho FIXO: o brilho entra na cor, e nao no raio do ponto.
  material.sizeNode = escala;
  material.colorNode = vec4(
    attribute('corDaEstrela', 'vec3').mul(attribute('brilho', 'float').pow(float(0.45))),
    float(1),
  );
  material.positionNode = positionLocal;

  const pontos = new Points(geometria, material);
  pontos.frustumCulled = false;
  // Desenhadas antes de tudo: elas estao atras de tudo.
  pontos.renderOrder = -1;

  return {
    pontos,
    mostrar(ligado) {
      pontos.visible = ligado;
    },
    acompanhar() {
      // A camera fica na origem por causa da origem flutuante, e a esfera
      // celeste tambem — entao nao ha o que mover. O metodo existe porque a
      // intencao precisa ficar escrita: se um dia a camera sair da origem,
      // e aqui que a esfera passa a segui-la.
      pontos.position.set(0, 0, 0);
    },
  };
}

export { corDeCorpoNegro, vec3 };

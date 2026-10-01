/**
 * A matematica da camera, sem navegador.
 *
 * Tudo que este arquivo testa e funcao pura: nenhum destes modulos importa
 * `three`, e e isso que permite verificar a parte dificil — a que envolve nove
 * ordens de grandeza — em milissegundos, em vez de num teste de tela.
 */
import { describe, expect, it } from 'vitest';
import {
  ELEVACAO_MAXIMA,
  RAIO_MAXIMO_UA,
  RAIO_MINIMO_UA,
  aproximar,
  criarCamera,
  deslocar,
  larguraVisivelUa,
  orbitar,
  posicaoDaCamera,
} from '@cena/camera/cameraOrbital.ts';
import { RAZAO_MAXIMA_POR_FATIA, fatiasDeProfundidade } from '@cena/camera/planoProximo.ts';
import { RAIO_INTERNOS_UA, RAIO_SISTEMA_UA, enquadrar } from '@cena/camera/enquadramento.ts';
import { DURACAO_S, avancarTransicao, iniciarTransicao } from '@cena/camera/transicao.ts';
import { ampliacao, pisoEmPixels, raioDesenhadoUa,
  fatorDeProjecao,
} from '@cena/escala/exageroDeTamanho.ts';

const UA_KM = 149597870.7;

describe('a camera guarda (pivo, raio, azimute, elevacao)', () => {
  it('a posicao fica sempre a `raio` do pivo', () => {
    const c = criarCamera({ pivo: [3, -2, 0.5], raio: 7 });
    for (const [az, el] of [[0, 0], [1.2, 0.8], [-2.5, -1.4]] as const) {
      c.azimute = az;
      c.elevacao = el;
      const p = posicaoDaCamera(c);
      expect(Math.hypot(p[0] - 3, p[1] + 2, p[2] - 0.5)).toBeCloseTo(7, 12);
    }
  });

  it('a elevacao nunca chega ao polo', () => {
    // No polo exato a base perde uma direcao e a camera gira sozinha — o mesmo
    // cuidado que a versao ortografica anterior ja tinha.
    const c = criarCamera();
    orbitar(c, 0, 10);
    expect(c.elevacao).toBe(ELEVACAO_MAXIMA);
    expect(c.elevacao).toBeLessThan(Math.PI / 2);
    orbitar(c, 0, -100);
    expect(c.elevacao).toBe(-ELEVACAO_MAXIMA);
  });

  it('o zoom e proporcional, e preso nos dois extremos', () => {
    const c = criarCamera({ raio: 10 });
    aproximar(c, 2);
    expect(c.raio).toBe(5);
    aproximar(c, 0.5);
    expect(c.raio).toBe(10);

    aproximar(c, 1e12);
    expect(c.raio).toBe(RAIO_MINIMO_UA);
    aproximar(c, 1e-20);
    expect(c.raio).toBe(RAIO_MAXIMO_UA);
  });

  it('deslocar move no plano da tela, perpendicular a linha de visao', () => {
    const c = criarCamera({ pivo: [0, 0, 0], raio: 5, azimute: 0, elevacao: 0 });
    const antes = posicaoDaCamera(c);
    deslocar(c, 1, 0);
    // O deslocamento e perpendicular ao vetor camera->pivo: a distancia se mantem.
    expect(Math.hypot(...posicaoDaCamera(c).map((v, k) => v - antes[k]!))).toBeCloseTo(1, 12);
    expect(c.raio).toBe(5);
  });

  it('a largura visivel cresce com a distancia — nao ha "campo de visao em UA"', () => {
    const c = criarCamera({ raio: 10, fovGraus: 45 });
    const perto = larguraVisivelUa(c, 16 / 9);
    c.raio = 20;
    expect(larguraVisivelUa(c, 16 / 9)).toBeCloseTo(2 * perto, 12);
  });
});

describe('fatias de profundidade', () => {
  it('cobrem do near ao far, sem buraco entre elas', () => {
    const fatias = fatiasDeProfundidade(1e-5, 60, 2);
    expect(fatias.length).toBeGreaterThanOrEqual(2);
    for (let k = 1; k < fatias.length; k++) {
      expect(fatias[k]!.far).toBeCloseTo(fatias[k - 1]!.near, 12);
    }
  });

  it('vem da mais distante para a mais proxima, que e a ordem de desenho', () => {
    const fatias = fatiasDeProfundidade(1e-5, 60, 3);
    for (let k = 1; k < fatias.length; k++) {
      expect(fatias[k]!.near).toBeLessThan(fatias[k - 1]!.near);
    }
  });

  it('nenhuma fatia estoura a razao que um z-buffer de 24 bits aguenta', () => {
    // 31,5 UA ate 1 km de altitude em Marte: nove ordens de grandeza.
    for (const [perto, longe] of [[1e-9, 60], [1e-5, 60], [1, 60], [20, 40]] as const) {
      for (const f of fatiasDeProfundidade(perto, longe, 2)) {
        expect(f.far / f.near, `${perto}..${longe}`).toBeLessThanOrEqual(RAZAO_MAXIMA_POR_FATIA * 1.001);
      }
    }
  });

  it('usa uma fatia so quando uma basta — nao se paga por duas a toa', () => {
    expect(fatiasDeProfundidade(10, 20, 2).length).toBe(2); // pedidas 2, cabem 2
    expect(fatiasDeProfundidade(10, 20, 1).length).toBe(1);
  });

  it('a divisao e geometrica: todas as fatias tem a mesma precisao relativa', () => {
    const fatias = fatiasDeProfundidade(1e-6, 60, 3);
    const razoes = fatias.map((f) => f.far / f.near);
    for (const r of razoes) expect(r).toBeCloseTo(razoes[0]!, 6);
  });
});

describe('enquadramentos', () => {
  const sol: [number, number, number] = [0.001, -0.004, 0];
  const marte = { posicao: [1.4, 0.3, 0.02] as [number, number, number], afelioUa: 1.666, raioKm: 3389.5 };

  it('os valores sao os da versao anterior, escolhidos olhando a tela', () => {
    expect(enquadrar('sistema', sol, null).raio).toBe(RAIO_SISTEMA_UA);
    expect(enquadrar('internos', sol, null).raio).toBe(RAIO_INTERNOS_UA);
  });

  it('acompanhar usa o afelio vezes 1,25, para a orbita caber com folga', () => {
    expect(enquadrar('acompanhar', sol, marte).raio).toBeCloseTo(1.666 * 1.25, 12);
    expect(enquadrar('acompanhar', sol, marte).pivo).toEqual(marte.posicao);
  });

  it('"perto" poe a camera em orbita baixa, a tres raios do corpo', () => {
    expect(enquadrar('perto', sol, marte).raio).toBeCloseTo((3389.5 / UA_KM) * 3, 15);
  });

  it('sem alvo, os modos que precisam de um caem na visao geral', () => {
    expect(enquadrar('acompanhar', sol, null).raio).toBe(RAIO_SISTEMA_UA);
    expect(enquadrar('perto', sol, null).raio).toBe(RAIO_SISTEMA_UA);
  });

  it('o Sol nao tem afelio, e mesmo assim tem enquadramento', () => {
    const r = enquadrar('acompanhar', sol, { posicao: sol, afelioUa: null, raioKm: 695700 });
    expect(Number.isFinite(r.raio)).toBe(true);
  });
});

describe('transicao', () => {
  it('interpola log(raio): a meia transicao esta na media GEOMETRICA', () => {
    // Linear passaria quase todo o tempo perto de 30 e desabaria no fim —
    // parece corte, nao movimento.
    const c = criarCamera({ raio: 30 });
    const t = iniciarTransicao(0.3, c.azimute, c.elevacao);
    for (let k = 0; k < 100; k++) avancarTransicao(c, t, [0, 0, 0], DURACAO_S / 2 / 100);
    const geometrica = Math.sqrt(30 * 0.3);
    expect(Math.log(c.raio)).toBeGreaterThan(Math.log(0.3));
    expect(c.raio).toBeLessThan(geometrica * 3);
  });

  it('termina EXATA no prazo fixo, sem residuo', () => {
    // Amortecimento exponencial nunca alcanca; o prazo fixo alcanca.
    const c = criarCamera({ raio: 30 });
    const t = iniciarTransicao(0.3, 1.2, 0.4);
    let acabou = false;
    for (let k = 0; k < 40 && !acabou; k++) acabou = avancarTransicao(c, t, [1, 2, 3], 0.016);
    expect(acabou).toBe(true);
    expect(c.raio).toBe(0.3);
    expect(c.azimute).toBe(1.2);
    expect(c.pivo).toEqual([1, 2, 3]);
  });

  it('gira pelo caminho curto', () => {
    const c = criarCamera({ azimute: 0.1 });
    const t = iniciarTransicao(c.raio, 6.2, c.elevacao); // 6,2 rad = -0,08 rad
    avancarTransicao(c, t, [0, 0, 0], 0.016);
    // Foi para tras, e nao 6,1 radianos para a frente.
    expect(c.azimute).toBeLessThan(0.1);
  });
});

describe('tamanho honesto', () => {
  const RAIO_TERRA_UA = 6371 / UA_KM;

  it('o Sol tem o piso proprio de 11 px, portado da versao anterior', () => {
    expect(pisoEmPixels(695700, true)).toBe(11);
    // Pela formula generica ele daria 29,8, clipado em 16 — 45% maior.
    expect(pisoEmPixels(695700, false)).toBe(16);
  });

  it('aproximar-se NUNCA encolhe o corpo', () => {
    let anterior = 0;
    for (let k = 0; k <= 60; k++) {
      const d = 31.5 * Math.pow(RAIO_TERRA_UA / 31.5, k / 60);
      const raio = raioDesenhadoUa(RAIO_TERRA_UA, fatorDeProjecao(45, 647) / (d), false, false);
      const aparente = raio / d;
      expect(aparente, `passo ${k}`).toBeGreaterThanOrEqual(anterior);
      anterior = aparente;
    }
  });

  it('o exagero se apaga sozinho conforme a camera chega perto', () => {
    // Em p_real = p_piso a ampliacao e 1,26x; em 3x o piso, 1,012x.
    const f = 647 / (2 * Math.tan(Math.PI / 8));
    const piso = pisoEmPixels(6371, false);
    const dNoPiso = (RAIO_TERRA_UA * f) / piso;
    expect(ampliacao(RAIO_TERRA_UA, fatorDeProjecao(45, 647) / (dNoPiso), false)).toBeCloseTo(Math.cbrt(2), 6);
    expect(ampliacao(RAIO_TERRA_UA, fatorDeProjecao(45, 647) / (dNoPiso / 3), false)).toBeLessThan(1.02);
  });

  it('longe, a ampliacao e enorme — e a tela DIZ isso', () => {
    expect(ampliacao(RAIO_TERRA_UA, fatorDeProjecao(45, 647) / (31.5), false)).toBeGreaterThan(100);
  });

  it('em "tamanho real" o piso e ZERO e nao ha impostor', () => {
    // Os planetas somem mesmo. Um impostor sempre ligado tornaria falsa a
    // propria opcao que existe para mostrar a escala verdadeira.
    expect(raioDesenhadoUa(RAIO_TERRA_UA, fatorDeProjecao(45, 647) / (31.5), true, false)).toBe(RAIO_TERRA_UA);
    expect(ampliacao(RAIO_TERRA_UA, fatorDeProjecao(45, 647) / (31.5), false)).toBeGreaterThan(1);
  });
});

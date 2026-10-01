/**
 * Validacao do motor gravitacional de nove corpos.
 *
 * Porte de `tests/test_fisica_nbody.py`. Cada bloco compara o resultado com
 * algo que sabemos de forma independente: leis de conservacao, reversibilidade
 * da integracao, e os periodos orbitais conhecidos dos planetas.
 *
 * **Sobre os limiares.** Foram REMEDIDOS aqui, e nao copiados do Python.
 * O numpy soma com `pairwise summation`, que acumula menos erro que um laco
 * simples, e o kernel daqui e simetrico em vez de montar a matriz N x N — as
 * duas coisas mudam a ordem das somas e portanto o ultimo digito. O que se
 * afirma e sempre o LIMITE, nunca o valor: um teste que fixa o valor observado
 * passa a falhar por causa da versao do motor de JavaScript, e um teste que
 * falha por ruido e um teste que sera desligado.
 */
import { describe, expect, it } from 'vitest';
import {
  anguloHeliocentrico,
  distanciaAoSolUa,
  elementosOsculadores,
} from '@nucleo/efemerides.ts';
import { avancar, leapfrog, yoshida4 } from '@nucleo/integrador.ts';
import { centroDeMassa, energia, gmTotal, momentoAngular, momentoLinear } from '@nucleo/estado.ts';
import { UA_KM } from '@nucleo/unidades.ts';
import { ANO_DIAS, CORPOS, NOMES, VALIDACAO, distancia, norma, novo } from './ajuda.ts';

const PASSOS_POR_ANO = Math.trunc(ANO_DIAS * 2);

describe('1. inicializacao simultanea: todos os corpos na MESMA epoca', () => {
  const { estado } = novo();

  it('o relogio comeca em zero e ha nove corpos em 3D', () => {
    expect(estado.tDias).toBe(0);
    expect(estado.n).toBe(9);
    expect(estado.pos.length).toBe(3 * estado.capacidade);
  });

  it('o momento linear total e praticamente nulo (estado baricentrico)', () => {
    const p = norma(momentoLinear(estado)) / gmTotal(estado);
    expect(p).toBeLessThan(1e-10);
  });

  it('o centro de massa dos nove fica a menos de 1000 km da origem', () => {
    // Nao e zero, e isso nao e defeito: a origem e o baricentro do Sistema
    // Solar INTEIRO, e o resto da diferenca e dos corpos que o modelo omite.
    expect(norma(centroDeMassa(estado)) * UA_KM).toBeLessThan(1000);
  });
});

describe('2. conservacao de energia e momento angular (Yoshida4, dt = 0,5 dia)', () => {
  for (const anos of [1, 10, 100]) {
    it(`${anos} ano(s): a energia oscila em vez de derivar`, () => {
      const { estado, rascunho } = novo();
      const e0 = energia(estado);
      const l0 = momentoAngular(estado);
      avancar(estado, yoshida4, 0.5, anos * PASSOS_POR_ANO, rascunho);

      const dE = Math.abs((energia(estado) - e0) / e0);
      const l = momentoAngular(estado);
      const dL = norma([l[0] - l0[0], l[1] - l0[1], l[2] - l0[2]]) / norma(l0);

      expect(dE, `dE/E = ${dE.toExponential(1)}`).toBeLessThan(1e-8);
      expect(dL, `dL/L = ${dL.toExponential(1)}`).toBeLessThan(1e-12);
    });
  }
});

describe('3. o Sol tambem se move (nao e um ponto fixo sem massa)', () => {
  it('anda mais que o proprio raio em 12 anos, puxado por Jupiter', () => {
    const { estado, rascunho } = novo();
    const { estado: inicial } = novo();
    avancar(estado, yoshida4, 0.5, 365 * 2 * 12, rascunho);
    const desloc = distancia(estado.pos, 0, [inicial.pos[0]!, inicial.pos[1]!, inicial.pos[2]!]) * UA_KM;
    expect(desloc, `andou ${Math.round(desloc)} km`).toBeGreaterThan(CORPOS[0]!.raioKm);
  });
});

describe('4. relogio compartilhado: Mercurio da mais voltas que Netuno', () => {
  // Nada de "6 s por orbita" para cada planeta: ha um relogio so, e o numero
  // de voltas sai da fisica.
  const { estado, rascunho } = novo();
  const { estado: inicial } = novo();
  const voltas = new Array<number>(8).fill(0);
  const anterior = Array.from({ length: 8 }, (_, k) => anguloHeliocentrico(estado, k + 1));

  for (let fatia = 0; fatia < 5 * Math.trunc(PASSOS_POR_ANO / 10); fatia++) {
    avancar(estado, yoshida4, 0.5, 10, rascunho);
    for (let k = 0; k < 8; k++) {
      const atual = anguloHeliocentrico(estado, k + 1);
      // Desenrola o salto de +-2pi: o equivalente do np.unwrap do original.
      let d = atual - anterior[k]!;
      while (d > Math.PI) d -= 2 * Math.PI;
      while (d < -Math.PI) d += 2 * Math.PI;
      voltas[k] = voltas[k]! + d / (2 * Math.PI);
      anterior[k] = atual;
    }
  }
  const absVoltas = voltas.map(Math.abs);
  const esperado = Array.from({ length: 8 }, (_, k) => {
    return (5 * ANO_DIAS) / elementosOsculadores(inicial, k + 1).periodoDias;
  });

  it('o numero de voltas cai de Mercurio a Netuno, sem excecao', () => {
    for (let k = 1; k < 8; k++) {
      expect(absVoltas[k]!, `${NOMES[k + 1]} x ${NOMES[k]}`).toBeLessThan(absVoltas[k - 1]!);
    }
  });

  it('Mercurio da mais de 20 vezes as voltas de Jupiter', () => {
    expect(absVoltas[0]!).toBeGreaterThan(20 * absVoltas[4]!);
  });

  it('para quem completa 2+ voltas, o angulo varrido bate com o periodo (2%)', () => {
    // Para Jupiter e os de fora, que nao fecham uma volta em 5 anos, comparar
    // com a taxa MEDIA seria errado: pela 2a lei de Kepler o corpo varre
    // angulo mais depressa perto do perielio. Nao e erro de conta — e a
    // orbita nao ser um circulo.
    for (let k = 0; k < 8; k++) {
      if (esperado[k]! < 2) continue;
      const erro = Math.abs(absVoltas[k]! - esperado[k]!) / esperado[k]!;
      expect(erro, `${NOMES[k + 1]}: ${absVoltas[k]!.toFixed(3)} x ${esperado[k]!.toFixed(3)}`).toBeLessThan(0.02);
    }
  });

  it('os de fora avancam no mesmo relogio, sem fechar uma volta', () => {
    expect(absVoltas.every((v) => v > 0)).toBe(true);
  });
});

describe('5. elementos osculadores vs elementos medios conhecidos', () => {
  // Elementos medios em J2000, da NASA Planetary Fact Sheet.
  const REF: Record<string, number> = {
    Mercúrio: 0.3871, Vênus: 0.72333, Terra: 1.0, Marte: 1.52371,
    Júpiter: 5.20288, Saturno: 9.53667, Urano: 19.18916, Netuno: 30.06992,
  };
  const { estado } = novo();

  it('os nomes da referencia batem com os da efemeride', () => {
    expect(Object.keys(REF).sort()).toEqual(NOMES.slice(1).sort());
  });

  for (let i = 1; i <= 8; i++) {
    it(`${NOMES[i]}: semieixo maior dentro da tolerancia`, () => {
      const el = elementosOsculadores(estado, i);
      const aRef = REF[NOMES[i]!]!;
      const erro = Math.abs(el.a - aRef) / aRef;
      // Internos: osculador e medio quase coincidem. Externos divergem de
      // verdade, por perturbacao mutua — e fisica real, nao erro de conta.
      const tol = i <= 4 ? 0.005 : 0.02;
      expect(erro, `a = ${el.a.toFixed(5)} UA (ref ${aRef}, desvio ${(100 * erro).toFixed(2)}%)`).toBeLessThan(tol);
    });
  }
});

describe('7. Yoshida4 e mais preciso que leapfrog pelo mesmo custo', () => {
  it('leapfrog com dt 3x menor = mesmo numero de avaliacoes de forca', () => {
    const ref = VALIDACAO['10']!;
    const alvo = ref.dias_desde_a_epoca;

    const a = novo();
    avancar(a.estado, yoshida4, 0.5, Math.round(alvo / 0.5), a.rascunho);
    const b = novo();
    avancar(b.estado, leapfrog, 0.5 / 3, Math.round(alvo / (0.5 / 3)), b.rascunho);

    let piorY = 0;
    let piorL = 0;
    for (let i = 0; i < CORPOS.length; i++) {
      const alvoPos = ref.corpos[CORPOS[i]!.chave]!.posicao_ua;
      piorY = Math.max(piorY, distancia(a.estado.pos, i, alvoPos) * UA_KM);
      piorL = Math.max(piorL, distancia(b.estado.pos, i, alvoPos) * UA_KM);
    }
    expect(piorY, `Yoshida4 ${Math.round(piorY)} km x leapfrog ${Math.round(piorL)} km`).toBeLessThan(piorL);
  });
});

describe('8. estabilidade: ninguem escapa nem cai no Sol em 200 anos', () => {
  const { estado, rascunho } = novo();
  const { estado: inicial } = novo();
  const rMin = new Array<number>(9).fill(Infinity);
  const rMax = new Array<number>(9).fill(0);

  for (let ano = 0; ano < 200; ano++) {
    avancar(estado, yoshida4, 0.5, PASSOS_POR_ANO, rascunho);
    for (let i = 0; i < 9; i++) {
      const r = distanciaAoSolUa(estado, i);
      rMin[i] = Math.min(rMin[i]!, r);
      rMax[i] = Math.max(rMax[i]!, r);
    }
  }

  for (let i = 1; i <= 8; i++) {
    it(`${NOMES[i]} fica entre 0,7x o perielio e 1,3x o afelio`, () => {
      const el = elementosOsculadores(inicial, i);
      expect(rMin[i]!, `r min ${rMin[i]!.toFixed(4)} UA`).toBeGreaterThan(0.7 * el.perielio);
      expect(rMax[i]!, `r max ${rMax[i]!.toFixed(4)} UA`).toBeLessThan(1.3 * el.afelio);
    });
  }

  it('todas as orbitas continuam ligadas (energia negativa) apos 200 anos', () => {
    for (let i = 1; i <= 8; i++) {
      expect(elementosOsculadores(estado, i).ligada, NOMES[i]).toBe(true);
    }
  });
});

/**
 * O foco: o escalar que faz o resto do sistema recuar quando se chega perto.
 *
 * Três coisas são medidas aqui, e as três são invariantes que o desenho da
 * feature inteira apoia:
 *
 *   1. **É função pura do quadro.** Sem suavização no tempo, sem estado. Dois
 *      quadros com a câmera parada dão o mesmo número — e é isso que mantém
 *      `precisao.spec.ts` medindo quadros idênticos e `imersivo.spec.ts`
 *      medindo câmera parada.
 *   2. **Mede em raios REAIS.** Se medisse nos desenhados, o exagero de tamanho
 *      poria todo planeta permanentemente no meio do esmaecimento.
 *   3. **Só subtrai.** Quem desligou uma opção não pode vê-la voltar por ter se
 *      aproximado de um planeta.
 */
import { describe, expect, it } from 'vitest';
import {
  CORTE_DA_LINHA,
  FOCO_COMECA_EM,
  FOCO_PLENO_EM,
  atenuacaoDasLinhas,
  foco,
  tetoDeRotulos,
} from '@cena/escala/foco.ts';

const UA_KM = 149597870.7;
/** Raios reais, em UA, dos corpos que aparecem nos casos. */
const RAIO = {
  marte: 3389.5 / UA_KM,
  jupiter: 69911 / UA_KM,
  io: 1821.5 / UA_KM,
  fobos: 11.1 / UA_KM,
};

describe('o escalar', () => {
  it('é zero na visão geral e um no enquadramento "perto"', () => {
    // 31,5 UA de Marte são 1,4 milhão de raios: a visão geral não atenua nada.
    expect(foco(31.5, RAIO.marte)).toBe(0);
    // "perto" é 3R, e o escalar satura em 4R — chegar lá é foco pleno.
    expect(foco(3 * RAIO.marte, RAIO.marte)).toBe(1);
  });

  it('vale o mesmo para qualquer corpo à mesma distância RELATIVA', () => {
    // A propriedade que faz o escalar ser sobre a câmera e não sobre o corpo:
    // Fobos tem 11 km e Júpiter 70 mil, e a vinte raios os dois enchem a tela
    // igual. Um escalar em UA daria respostas opostas para a mesma imagem.
    const alvo = foco(20 * RAIO.jupiter, RAIO.jupiter);
    for (const r of Object.values(RAIO)) {
      expect(foco(20 * r, r), 'a mesma distância relativa deu foco diferente')
        .toBeCloseTo(alvo, 12);
    }
  });

  it('cresce sem voltar atrás, aproximando-se', () => {
    let anterior = -1;
    for (const emRaios of [200, 100, 64, 50, 32, 20, 12, 8, 6, 5, 4, 3, 2, 1]) {
      const f = foco(emRaios * RAIO.io, RAIO.io);
      expect(f, `em ${emRaios} raios`).toBeGreaterThanOrEqual(anterior);
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThanOrEqual(1);
      anterior = f;
    }
  });

  it('as duas pontas são lisas, e não degraus', () => {
    // `smoothstep` existe para isto: sem ele, a atenuação começa e acaba com um
    // joelho, e o olho vê o instante em que ela liga.
    const quase = 1e-6;
    expect(foco(FOCO_COMECA_EM * (1 - quase) * RAIO.marte, RAIO.marte)).toBeLessThan(1e-6);
    expect(foco(FOCO_PLENO_EM * (1 + quase) * RAIO.marte, RAIO.marte)).toBeGreaterThan(1 - 1e-6);
  });

  it('é função pura: a mesma entrada dá a mesma saída, sempre', () => {
    const a = foco(9 * RAIO.marte, RAIO.marte);
    for (let k = 0; k < 100; k++) expect(foco(9 * RAIO.marte, RAIO.marte)).toBe(a);
  });

  it('entrada degenerada não vira NaN', () => {
    // Raio zero acontece de verdade: um corpo do sandbox recém-criado passa um
    // quadro sem raio desenhado. NaN num uniforme de opacidade apaga a cena.
    for (const [d, r] of [[0, 1], [1, 0], [-1, 1], [1, -1], [0, 0]] as const) {
      const f = foco(d, r);
      expect(Number.isFinite(f), `foco(${d}, ${r})`).toBe(true);
      expect(f).toBe(0);
    }
  });
});

describe('a atenuação das linhas', () => {
  it('é identidade sem foco, e zero no corte', () => {
    expect(atenuacaoDasLinhas(0)).toBe(1);
    expect(atenuacaoDasLinhas(CORTE_DA_LINHA)).toBe(0);
    expect(atenuacaoDasLinhas(1)).toBe(0);
  });

  it('só desce, nunca sobe', () => {
    let anterior = 2;
    for (let f = 0; f <= 1.0001; f += 0.02) {
      const a = atenuacaoDasLinhas(f);
      expect(a, `em foco ${f.toFixed(2)}`).toBeLessThanOrEqual(anterior + 1e-12);
      expect(a).toBeGreaterThanOrEqual(0);
      expect(a).toBeLessThanOrEqual(1);
      anterior = a;
    }
  });

  it('ESCONDE no fim, em vez de deixar um fantasma', () => {
    // Uma linha a 2% de opacidade custa o mesmo passe de desenho e não mostra
    // nada. Acima do corte ela vale exatamente zero, e quem chama usa isso
    // para tirá-la da cena.
    expect(atenuacaoDasLinhas(CORTE_DA_LINHA + 1e-9)).toBe(0);
  });
});

describe('o teto de rótulos', () => {
  it('não mexe em nada sem foco', () => {
    expect(tetoDeRotulos(0, 18)).toBe(18);
  });

  it('desce até um, e nunca a zero', () => {
    // Zero rótulos seria a cena sem nome nenhum, inclusive o do corpo que se
    // está olhando — que é justamente o que se quer ler.
    expect(tetoDeRotulos(1, 18)).toBe(1);
    for (let f = 0; f <= 1.0001; f += 0.05) {
      const t = tetoDeRotulos(f, 18);
      expect(t, `em foco ${f.toFixed(2)}`).toBeGreaterThanOrEqual(1);
      expect(t).toBeLessThanOrEqual(18);
    }
  });

  it('desce sem voltar atrás', () => {
    let anterior = 999;
    for (let f = 0; f <= 1.0001; f += 0.02) {
      const t = tetoDeRotulos(f, 18);
      expect(t).toBeLessThanOrEqual(anterior);
      anterior = t;
    }
  });
});

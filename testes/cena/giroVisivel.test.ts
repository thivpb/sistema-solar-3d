/**
 * O teto do giro desenhado, e as duas coisas que ele não pode quebrar.
 *
 * O defeito que ele conserta é de *aliasing*: a 30 dias por segundo, Marte gira
 * 175° entre dois quadros, e dois quadros seguidos mostram lados opostos do
 * planeta. De longe ninguém vê; com o zoom, a textura de 8K fica ilegível.
 *
 * As duas coisas que ele não pode quebrar, e que são a razão de a regra ser
 * medida em pixels e não em graus: um corpo pequeno tem de passar intacto, e a
 * simulação pausada tem de passar intacta. É nelas que moram todas as imagens
 * douradas e o teste de quadros bit a bit idênticos.
 */
import { describe, expect, it } from 'vitest';
import {
  PIXELS_POR_QUADRO,
  RAIO_MINIMO_PX,
  amortecimentoDoGiro,
} from '@cena/corpos/giroVisivel.ts';

/** Marte a 30 d/s e 60 Hz: 350,89°/dia × 0,5 dia por quadro. */
const MARTE_A_30_DIAS_POR_SEGUNDO = (350.89 * 30) / 60;

describe('o amortecimento do giro', () => {
  it('não toca em corpo pequeno, por mais rápido que ele gire', () => {
    // A vista geral inteira cai aqui: nenhum planeta passa de alguns pixels a
    // 31,5 UA. É o que mantém as douradas e `precisao.spec.ts` intactos.
    expect(amortecimentoDoGiro(MARTE_A_30_DIAS_POR_SEGUNDO, 1.5)).toBe(1);
    expect(amortecimentoDoGiro(MARTE_A_30_DIAS_POR_SEGUNDO, RAIO_MINIMO_PX)).toBe(1);
    expect(amortecimentoDoGiro(1e6, 0.1)).toBe(1);
  });

  it('não toca em nada com a simulação parada', () => {
    // ΔW = 0 é o caso de todo teste que pausa antes de fotografar.
    expect(amortecimentoDoGiro(0, 400)).toBe(1);
    expect(amortecimentoDoGiro(-0, 400)).toBe(1);
  });

  it('é PROPORCIONAL: quem gira devagar quase não é tocado', () => {
    // Esta é a diferença entre um teto e um congelamento. Vênus leva 243 dias
    // para dar uma volta e Marte pouco mais de um dia; à mesma velocidade de
    // relógio e à mesma distância, o amortecimento de um é centenas de vezes
    // mais forte que o do outro — porque o defeito de um é centenas de vezes
    // maior. Medido: Vênus cai para pouco menos da metade, Marte para 1/600.
    const venusA30 = (-1.4813 * 30) / 60;
    const fVenus = amortecimentoDoGiro(venusA30, 300);
    const fMarte = amortecimentoDoGiro(MARTE_A_30_DIAS_POR_SEGUNDO, 300);
    expect(fVenus).toBeGreaterThan(0.3);
    expect(fVenus).toBeLessThan(1);
    expect(fVenus / fMarte).toBeGreaterThan(100);

    // E num relógio lento ninguém é tocado: a 1 dia por segundo Vênus anda
    // 0,025° por quadro, que num disco de 300 px são 0,13 pixel.
    expect(amortecimentoDoGiro(-1.4813 / 60, 300)).toBe(1);
  });

  it('segura o giro exatamente no teto, e não mais que isso', () => {
    const raio = 300;
    const f = amortecimentoDoGiro(MARTE_A_30_DIAS_POR_SEGUNDO, raio);
    expect(f).toBeLessThan(0.01);
    // A propriedade: depois de aplicado, o movimento na tela É o teto.
    const depois = MARTE_A_30_DIAS_POR_SEGUNDO * f * (Math.PI / 180) * raio;
    expect(depois).toBeCloseTo(PIXELS_POR_QUADRO, 9);
  });

  it('é simétrico: girar ao contrário amortece igual', () => {
    // Vênus e Urano giram retrógrados, e Tritão também.
    for (const raio of [20, 100, 600]) {
      expect(amortecimentoDoGiro(-40, raio)).toBe(amortecimentoDoGiro(40, raio));
    }
  });

  it('é monótono: mais perto ou mais rápido nunca amortece MENOS', () => {
    let anterior = 1;
    for (let raio = 10; raio <= 800; raio += 10) {
      const f = amortecimentoDoGiro(30, raio);
      expect(f, `raio ${raio}`).toBeLessThanOrEqual(anterior + 1e-12);
      anterior = f;
    }
    anterior = 1;
    for (let dw = 0.1; dw <= 200; dw += 0.5) {
      const f = amortecimentoDoGiro(dw, 300);
      expect(f, `ΔW ${dw}`).toBeLessThanOrEqual(anterior + 1e-12);
      anterior = f;
    }
  });

  it('nunca devolve zero, nem NaN, nem mais que 1', () => {
    // Zero congelaria o corpo de vez; NaN apagaria a orientação inteira.
    for (const dw of [0, 1e-12, 1, 175, 1e9, -175, Number.EPSILON]) {
      for (const raio of [0, 1e-9, 8, 300, 1e6]) {
        const f = amortecimentoDoGiro(dw, raio);
        expect(Number.isFinite(f), `ΔW ${dw}, raio ${raio}`).toBe(true);
        expect(f).toBeGreaterThan(0);
        expect(f).toBeLessThanOrEqual(1);
      }
    }
  });
});

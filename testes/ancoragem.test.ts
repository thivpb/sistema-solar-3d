/**
 * A ancoragem por quadro e a suavização do desvio.
 *
 * Os três erros que este arquivo fecha, e que só apareceriam olhando a tela:
 *
 *   1. **Suavizar a posição em vez do desvio.** A placa passaria a perseguir o
 *      corpo com atraso — a lição mais cara do projeto, em escala menor.
 *   2. **Uma placa nova deslizando desde o zero.** Todo nome que aparecesse
 *      voaria do canto até o lugar dele.
 *   3. **Uma transição que nunca chega.** Sem o prazo fixo, um alvo que muda um
 *      pouco a cada quadro mantém a placa para sempre a meio caminho.
 */
import { describe, expect, it } from 'vitest';
import {
  PRAZO_S,
  TAU_S,
  criarMemoriaDoDesvio,
  posicoesSuavizadas,
  type Ancora,
} from '../src/rotulos/ancoragem.ts';
import type { RotuloColocado } from '../src/rotulos/posicionador.ts';

function rotulo(chave: string, centro: [number, number], canto: [number, number]): RotuloColocado {
  return {
    chave,
    texto: chave,
    forma: 'inteiro',
    papel: null,
    raioPx: 4,
    centroX: centro[0],
    centroY: centro[1],
    x: canto[0],
    y: canto[1],
    largura: 40,
    altura: 14,
    ocluido: false,
  };
}

const ancoras = (m: Record<string, [number, number]>): Map<string, Ancora> =>
  new Map(Object.entries(m).map(([k, [x, y]]) => [k, { x, y }]));

describe('ancoragem por quadro', () => {
  it('uma placa nova entra no lugar, sem deslizar', () => {
    const mem = criarMemoriaDoDesvio();
    const r = rotulo('terra', [100, 100], [112, 94]);
    const p = posicoesSuavizadas([r], ancoras({ terra: [100, 100] }), mem, 1 / 60, 0);
    expect(p.get('terra')).toEqual({ x: 112, y: 94, centroX: 100, centroY: 100 });
  });

  it('o corpo se move e a placa vai JUNTO, sem atraso nenhum', () => {
    // O teste do erro 1. Se a suavização pegasse a posição absoluta, a placa
    // ficaria para trás enquanto o corpo anda — e o erro cresceria com a
    // velocidade da câmera, que é exatamente o defeito que não pode voltar.
    const mem = criarMemoriaDoDesvio();
    const r = rotulo('terra', [100, 100], [112, 94]);
    posicoesSuavizadas([r], ancoras({ terra: [100, 100] }), mem, 1 / 60, 0);

    let t = 0;
    for (let k = 1; k <= 30; k++) {
      t += 1 / 60;
      // O corpo anda 7 px por quadro; a colocação (30 Hz) continua dizendo o
      // mesmo desvio, porque o lado escolhido não mudou.
      const x = 100 + 7 * k;
      const p = posicoesSuavizadas([rotulo('terra', [x, 100], [x + 12, 94])], ancoras({ terra: [x, 100] }), mem, 1 / 60, t);
      expect(p.get('terra')!.x, `quadro ${k}`).toBeCloseTo(x + 12, 9);
    }
  });

  it('trocar de lado desliza, e chega', () => {
    const mem = criarMemoriaDoDesvio();
    posicoesSuavizadas([rotulo('terra', [100, 100], [112, 94])], ancoras({ terra: [100, 100] }), mem, 1 / 60, 0);

    // O alvo pula de +12 para −52: a placa foi para o outro lado do corpo.
    const novo = rotulo('terra', [100, 100], [48, 94]);
    const a = ancoras({ terra: [100, 100] });

    const emT = (t: number): number => posicoesSuavizadas([novo], a, mem, 1 / 60, t).get('terra')!.x;

    // No primeiro quadro ela saiu, mas está longe do destino.
    const primeiro = emT(1 / 60);
    expect(primeiro).toBeLessThan(112);
    expect(primeiro).toBeGreaterThan(48 + 10);

    // Uma constante de tempo depois, cobriu perto de 63% do caminho.
    let t = 1 / 60;
    while (t < TAU_S) {
      t += 1 / 60;
      emT(t);
    }
    const andado = (112 - emT(t)) / (112 - 48);
    expect(andado, `andou ${(100 * andado).toFixed(0)}% numa constante de tempo`).toBeGreaterThan(0.5);
    expect(andado).toBeLessThan(0.85);

    // E o prazo fixo põe no lugar: o teste do erro 3.
    while (t < PRAZO_S + 0.02) {
      t += 1 / 60;
      emT(t);
    }
    expect(emT(t)).toBe(48);
  });

  it('um quadro de cinco minutos não estoura nem ultrapassa o alvo', () => {
    // É o `dt` que chega ao voltar de uma aba oculta. Ele NÃO dispara o prazo
    // fixo — o alvo mudou neste mesmo quadro, e o prazo conta do alvo, não do
    // relógio —, mas o teto no `dt` garante que a interpolação continue sendo
    // uma interpolação: sem ele, `1 − exp(−300/0,08)` dá exatamente 1 e a placa
    // acerta por acidente, e um `dt` negativo por um relógio ajustado daria um
    // fator maior que 1 e a placa passaria do alvo.
    const mem = criarMemoriaDoDesvio();
    const a = ancoras({ terra: [100, 100] });
    posicoesSuavizadas([rotulo('terra', [100, 100], [112, 94])], a, mem, 1 / 60, 0);

    const x = posicoesSuavizadas([rotulo('terra', [100, 100], [48, 94])], a, mem, 300, 300).get('terra')!.x;
    expect(Number.isFinite(x)).toBe(true);
    expect(x, 'passou do alvo').toBeGreaterThanOrEqual(48);
    expect(x, 'quase não andou num quadro enorme').toBeLessThan(52);

    // E o quadro seguinte, já com o prazo vencido, põe no lugar exato.
    expect(
      posicoesSuavizadas([rotulo('terra', [100, 100], [48, 94])], a, mem, 1 / 60, 300.5).get('terra')!.x,
    ).toBe(48);
  });

  it('uma mudança abaixo de meio pixel não reinicia o prazo', () => {
    // Sem a folga, o tremor de sub-pixel da projeção reiniciaria o relógio a
    // cada quadro e o prazo fixo nunca venceria — a placa ficaria para sempre
    // a meio caminho, que é o erro 3 com outra cara.
    const mem = criarMemoriaDoDesvio();
    const a = ancoras({ terra: [100, 100] });
    posicoesSuavizadas([rotulo('terra', [100, 100], [112, 94])], a, mem, 1 / 60, 0);
    let t = 0;
    for (let k = 0; k < 40; k++) {
      t += 1 / 60;
      const jitter = 0.2 * Math.sin(k);
      posicoesSuavizadas([rotulo('terra', [100, 100], [48 + jitter, 94])], a, mem, 1 / 60, t);
    }
    expect(posicoesSuavizadas([rotulo('terra', [100, 100], [48, 94])], a, mem, 1 / 60, t).get('terra')!.x)
      .toBeCloseTo(48, 6);
  });

  it('esquece quem saiu da tela, em vez de acumular', () => {
    const mem = criarMemoriaDoDesvio();
    const a = ancoras({ terra: [100, 100], marte: [200, 100] });
    posicoesSuavizadas(
      [rotulo('terra', [100, 100], [112, 94]), rotulo('marte', [200, 100], [212, 94])],
      a,
      mem,
      1 / 60,
      0,
    );
    expect(mem.size).toBe(2);
    posicoesSuavizadas([rotulo('terra', [100, 100], [112, 94])], a, mem, 1 / 60, 1 / 60);
    expect(mem.size).toBe(1);
    expect(mem.has('marte')).toBe(false);
  });

  it('sem âncora neste quadro, a placa fica onde a colocação a pôs', () => {
    const mem = criarMemoriaDoDesvio();
    const p = posicoesSuavizadas([rotulo('terra', [100, 100], [112, 94])], new Map(), mem, 1 / 60, 0);
    expect(p.get('terra')).toEqual({ x: 112, y: 94, centroX: 100, centroY: 100 });
  });
});

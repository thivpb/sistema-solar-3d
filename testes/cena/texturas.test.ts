/**
 * A escada de níveis de textura, e a propriedade que ela existe para ter.
 *
 * Um corpo parado na fronteira entre dois níveis não pode ficar trocando de
 * textura. Subir um 4K para a GPU custa dezenas de milissegundos, e um 8K custa
 * quatro vezes isso: uma oscilação na fronteira não seria um detalhe de
 * qualidade, seria o programa engasgando para sempre num lugar em que a pessoa
 * está parada olhando.
 *
 * O jeito de afirmar isso é o TESTE DO PONTO FIXO: aplicar a regra duas vezes
 * na mesma distância tem de dar o mesmo resultado da primeira. Se houvesse
 * oscilação, ela apareceria aqui — e a regra estar numa função pura é o que
 * permite perguntar isso sem GPU, sem navegador e sem textura.
 */
import { describe, expect, it } from 'vitest';
import { melhorDisponivel, nivelPara, type Nivel } from '@cena/texturas/carregador.ts';

/** Onde 'perto' põe a câmera: três raios do corpo. Ver `cena/camera.ts`. */
const ENQUADRAMENTO_PERTO = 3;

const NIVEIS: readonly Nivel[] = ['2k', '4k', '8k'];
const ORDEM: Record<Nivel, number> = { '2k': 0, '4k': 1, '8k': 2 };

describe('a escada de níveis', () => {
  it('de longe é 2K, e de perto é 8K', () => {
    expect(nivelPara(1000, null)).toBe('2k');
    expect(nivelPara(60, null)).toBe('2k');
    expect(nivelPara(ENQUADRAMENTO_PERTO, null)).toBe('8k');
    // O enquadramento 'perto' cai DENTRO da faixa do 8K com folga: o limiar é
    // o dobro dele, para chegar e sair sem trocar duas vezes.
    expect(nivelPara(ENQUADRAMENTO_PERTO * 2 - 0.1, null)).toBe('8k');
  });

  it('é um PONTO FIXO: aplicar duas vezes dá o mesmo', () => {
    // A propriedade inteira. Qualquer distância, qualquer nível de partida.
    for (const partida of [...NIVEIS, null]) {
      for (let d = 0.5; d < 80; d += 0.25) {
        const uma = nivelPara(d, partida);
        expect(nivelPara(d, uma), `${d} raios, partindo de ${partida}`).toBe(uma);
      }
    }
  });

  /** Percorre uma aproximação ou um afastamento, realimentando o nível. */
  function trajetoria(de: number, ate: number, passo: number): { d: number; n: Nivel }[] {
    const saida: { d: number; n: Nivel }[] = [];
    let nivel: Nivel | null = null;
    for (let d = de; passo < 0 ? d > ate : d < ate; d += passo) {
      nivel = nivelPara(d, nivel);
      saida.push({ d, n: nivel });
    }
    return saida;
  }

  it('aproximar-se nunca BAIXA o nível, e afastar-se nunca o sobe', () => {
    // Realimentado, que é como o programa usa: o nível de agora entra no
    // cálculo do próximo. Comparar chamadas independentes não mediria a
    // histerese, que é justamente a parte com memória.
    const chegando = trajetoria(80, 0.5, -0.25);
    for (let i = 1; i < chegando.length; i++) {
      expect(ORDEM[chegando[i]!.n], `a ${chegando[i]!.d} raios, chegando`)
        .toBeGreaterThanOrEqual(ORDEM[chegando[i - 1]!.n]);
    }
    const saindo = trajetoria(0.5, 80, 0.25);
    for (let i = 1; i < saindo.length; i++) {
      expect(ORDEM[saindo[i]!.n], `a ${saindo[i]!.d} raios, saindo`)
        .toBeLessThanOrEqual(ORDEM[saindo[i - 1]!.n]);
    }
    // E as duas pontas são as certas, senão "monótona" seria verdade também
    // para uma regra que nunca muda de nível.
    expect(chegando.at(0)!.n).toBe('2k');
    expect(chegando.at(-1)!.n).toBe('8k');
    expect(saindo.at(0)!.n).toBe('8k');
    expect(saindo.at(-1)!.n).toBe('2k');
  });

  it('nunca pula do 2K direto para o 8K: a subida é em dois degraus', () => {
    // Não é estética: 2K → 8K é dezesseis vezes mais pixels de uma vez, no
    // quadro em que a pessoa mais está olhando para o corpo.
    for (const t of [trajetoria(80, 0.5, -0.25), trajetoria(0.5, 80, 0.25)]) {
      for (let i = 1; i < t.length; i++) {
        expect(Math.abs(ORDEM[t[i]!.n] - ORDEM[t[i - 1]!.n]), `a ${t[i]!.d} raios`)
          .toBeLessThanOrEqual(1);
      }
    }
  });

  it('a histerese existe de verdade nas duas fronteiras', () => {
    // A guarda que impede este arquivo de ficar verde com a histerese
    // removida: nas duas fronteiras, o nível TEM de depender de onde se veio.
    expect(nivelPara(30, '2k')).toBe('2k');
    expect(nivelPara(30, '4k')).toBe('4k');
    expect(nivelPara(10, '4k')).toBe('4k');
    expect(nivelPara(10, '8k')).toBe('8k');
  });
});

describe('o nível entregue quando o pedido não existe', () => {
  /**
   * O defeito que esta parte fecha, porque ele passou despercebido uma vez.
   *
   * Quando o 8K entrou, `pedir` desistia se o nível pedido não tivesse
   * caminho. O efeito não foi "fica sem 8K": foi **Marte chegando a órbita
   * baixa ainda em 2K**, porque a partir de 6 raios o pedido passou a ser 8K e
   * o 4K que existia nunca mais era pedido. Na tela era uma superfície
   * borrada; no teste foi o contraste do quadro caindo de 30 para 25.
   */
  const TUDO = { '2k': 'a', '4k': 'b', '8k': 'c' };
  const ATE_4K = { '2k': 'a', '4k': 'b' };
  const SO_2K = { '2k': 'a' };

  it('entrega o pedido quando ele existe', () => {
    expect(melhorDisponivel('8k', TUDO)).toBe('8k');
    expect(melhorDisponivel('4k', TUDO)).toBe('4k');
    expect(melhorDisponivel('2k', TUDO)).toBe('2k');
  });

  it('desce até o melhor que existe, e NUNCA sobe', () => {
    expect(melhorDisponivel('8k', ATE_4K)).toBe('4k');
    expect(melhorDisponivel('8k', SO_2K)).toBe('2k');
    expect(melhorDisponivel('4k', SO_2K)).toBe('2k');
    // Subir seria entregar uma imagem mais pesada que a distância justifica,
    // no meio de um quadro — o oposto do que a escada existe para fazer.
    expect(melhorDisponivel('2k', TUDO)).toBe('2k');
  });

  it('sem nível nenhum, diz que não há — em vez de desenhar errado', () => {
    expect(melhorDisponivel('8k', {})).toBeNull();
  });

  it('é IDEMPOTENTE, que é o que impede o laço de carregamento', () => {
    // A comparação com o nível de agora acontece depois de resolver. Se
    // resolver o já resolvido desse outra coisa, o corpo trocaria de textura a
    // cada quadro para sempre.
    for (const mapa of [TUDO, ATE_4K, SO_2K]) {
      for (const pedido of NIVEIS) {
        const uma = melhorDisponivel(pedido, mapa);
        expect(melhorDisponivel(uma!, mapa)).toBe(uma);
      }
    }
  });
});

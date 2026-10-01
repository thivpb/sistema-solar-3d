/**
 * A régua embaixo da cena, e a propriedade que ela existe para ter.
 *
 * O defeito medido, na tela: com o duplo clique levando a câmera a três raios
 * do corpo, as duas leituras diziam **"0,0000 UA"** — a três raios de Io, que
 * são 5.464 km. Uma régua que marca zero quando se aproxima não é imprecisa; é
 * uma régua que deixou de medir, e deixou de medir exatamente na situação em
 * que alguém está olhando para ela.
 */
import { describe, expect, it } from 'vitest';
import { distancia, milhares, numero } from '@interface/formato.ts';

const UA_KM = 149597870.7;
/** Três raios de Io, que é o enquadramento 'perto' da menor lua texturizada. */
const PERTO_DE_IO_UA = (3 * 1821.49) / UA_KM;

describe('numero', () => {
  it('escreve em português, com vírgula', () => {
    expect(numero(1.5)).toBe('1,50');
    expect(numero(0.25)).toBe('0,2500');
    expect(numero(1234)).toBe('1234');
  });

  it('dá mais casas a número pequeno, e nenhuma a número grande', () => {
    expect(numero(0.5)).toBe('0,5000');
    expect(numero(5)).toBe('5,00');
    expect(numero(500)).toBe('500');
    // Negativo segue a mesma regra: era `v >= 100`, e −500 caía na faixa de
    // quatro casas por ser menor que 1.
    expect(numero(-500)).toBe('-500');
  });
});

describe('milhares', () => {
  it('agrupa por ponto, como se escreve em português', () => {
    expect(milhares(149597871)).toBe('149.597.871');
    expect(milhares(1000)).toBe('1.000');
    expect(milhares(999)).toBe('999');
    expect(milhares(1234.5, 1)).toBe('1.234,5');
  });
});

describe('distancia', () => {
  it('NÃO diz zero quando se chega perto', () => {
    // A propriedade inteira, no valor que a produziu.
    const texto = distancia(PERTO_DE_IO_UA);
    expect(texto).not.toMatch(/^0,0+ /);
    expect(texto).toBe('5.464 km');
  });

  it('usa UA onde UA é a unidade natural', () => {
    expect(distancia(31.5)).toBe('31,50 UA');
    expect(distancia(1)).toBe('1,00 UA');
    expect(distancia(0.5)).toBe('0,5000 UA');
  });

  it('desce para km abaixo do corte, e o corte cai num vão vazio', () => {
    // 0,01 UA são 1,5 milhão de km: acima de qualquer corpo do sistema e
    // abaixo de qualquer distância entre dois planetas. É por isso que a
    // leitura não fica piscando entre as duas unidades.
    expect(distancia(0.01)).toBe('0,0100 UA');
    expect(distancia(0.0099)).toMatch(/km$/);
  });

  it('ganha uma casa na faixa da órbita baixa', () => {
    // O programa promete chegar a 100 m do chão. "0 km" ali seria o mesmo
    // defeito de novo, uma unidade abaixo.
    expect(distancia(0.1 / UA_KM)).toBe('0,1 km');
    expect(distancia(9 / UA_KM)).toBe('9,0 km');
    expect(distancia(11 / UA_KM)).toBe('11 km');
  });

  it('não escreve NaN na tela', () => {
    expect(distancia(Number.NaN)).toBe('—');
    expect(distancia(Number.POSITIVE_INFINITY)).toBe('—');
  });
});

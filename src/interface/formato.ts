/**
 * Números escritos em português, num lugar só.
 *
 * ## Por que existe
 *
 * A mesma função `numero` estava escrita em cinco arquivos, com **duas regras
 * diferentes** — umas versões trocavam o ponto por vírgula e outras também
 * agrupavam os milhares —, e cada uma com as suas casas decimais. Duas leituras
 * do mesmo valor em cantos diferentes da tela saíam escritas de jeitos
 * diferentes, e ninguém percebia porque nunca aparecem lado a lado.
 *
 * ## A régua que o zoom quebrou
 *
 * `distancia` nasce de um defeito visto na tela. A leitura embaixo da cena
 * sempre disse "câmera a X UA do alvo", e isso funcionou enquanto chegar perto
 * não era um gesto do programa. Com o duplo clique levando a câmera a três
 * raios do corpo, as duas leituras passaram a dizer **"0,0000 UA"** —
 * exatamente na situação em que alguém está olhando para elas. Uma régua que
 * marca zero quando se aproxima não é uma régua imprecisa: é uma régua que
 * deixou de medir.
 *
 * A unidade acompanha a grandeza, como qualquer instrumento: quilômetros
 * abaixo de um centésimo de UA, UA acima. O corte é nomeado e a troca é
 * escrita na própria leitura, para que ninguém compare dois números em
 * unidades diferentes sem notar.
 */

/** Quilômetros por unidade astronômica. IAU 2012, exato por definição. */
const UA_KM = 149597870.7;

/**
 * Abaixo disto a leitura vai em quilômetros.
 *
 * 0,01 UA são 1,5 milhão de km — bem acima de qualquer corpo do sistema, e bem
 * abaixo da menor distância entre dois planetas. Ou seja: o corte cai num vão
 * onde nada acontece, e por isso não fica piscando entre as duas unidades.
 */
const EM_KM_ABAIXO_DE_UA = 0.01;

/** Casas decimais pela ordem de grandeza: número grande não precisa de quatro. */
export function numero(v: number, casas?: number): string {
  const n = casas ?? (Math.abs(v) >= 100 ? 0 : Math.abs(v) >= 1 ? 2 : 4);
  return v.toFixed(n).replace('.', ',');
}

/** O mesmo, com os milhares agrupados por ponto: 149.597.871. */
export function milhares(v: number, casas = 0): string {
  const [inteiro, decimal] = v.toFixed(casas).split('.');
  const agrupado = inteiro!.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return decimal ? `${agrupado},${decimal}` : agrupado;
}

/**
 * Uma distância em UA, escrita na unidade que ela merece.
 *
 * Devolve o texto COM a unidade, e não só o número: quem escreve "X UA" ao
 * redor não teria como saber que a unidade mudou, e a leitura viraria
 * "0,0001 UA" com o valor em km do lado.
 */
export function distancia(ua: number): string {
  if (!Number.isFinite(ua)) return '—';
  const abs = Math.abs(ua);
  if (abs < EM_KM_ABAIXO_DE_UA) {
    const km = ua * UA_KM;
    // Abaixo de 10 km a leitura ganha uma casa: é a faixa da órbita baixa, em
    // que o programa promete chegar a 100 m do chão.
    return `${Math.abs(km) < 10 ? numero(km, 1) : milhares(km)} km`;
  }
  return `${numero(ua)} UA`;
}

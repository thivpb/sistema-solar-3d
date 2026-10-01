/**
 * O foco: um escalar de 0 a 1 que diz o quanto a camera esta em cima de um corpo.
 *
 * **E um escalar continuo, e nao um modo.** Nao ha estado para ligar nem botao
 * para apertar: ele e funcao da posicao da camera, e so. Aproximar-se aumenta,
 * afastar-se diminui, e o gesto que muda a cena e o mesmo gesto que a pessoa ja
 * usa para olhar. Um modo precisaria de um controle a mais, de um lugar para
 * morar no estado, e de uma decisao sobre o que acontece ao sair dele.
 *
 * **A distancia se mede em raios REAIS do corpo, nunca nos desenhados.** A cena
 * ja calcula `emRaios = dist / raioDesenhado` para escolher o nivel de textura,
 * e reaproveitar aquilo seria de graca e errado: com o exagero de tamanho
 * ligado, um corpo parado no piso de pixels tem `raioDesenhado` grande o
 * bastante para `emRaios` cair para algumas dezenas na visao geral — e todo
 * planeta viveria permanentemente no meio do esmaecimento. Com raio real, o
 * escalar nao depende do exagero, nao depende do "tamanho real" e nao precisa
 * de ramo para o modo maquete, porque a maquete comprime posicoes e nunca
 * escala local.
 *
 * **Nao ha suavizacao no tempo.** A camera ja e suavizada por `transicao.ts`, e
 * um segundo amortecimento em cima do primeiro e o erro mais caro que este
 * projeto ja documentou. Sendo funcao pura do quadro, dois quadros com a camera
 * parada dao o mesmo valor — que e o que mantem `precisao.spec.ts` medindo
 * quadros identicos e `imersivo.spec.ts` medindo camera parada.
 */

/** Acima disto, em raios reais do corpo, nada e atenuado. */
export const FOCO_COMECA_EM = 64;

/**
 * Abaixo disto o foco e pleno.
 *
 * Quatro raios, e o enquadramento "perto" e tres: chegar la deixa o escalar
 * saturado com folga. A 3 raios e com 45° de campo, a altura visivel e
 * `2 x 3R x tan(22,5°) = 2,485R` contra um diametro de `2R` — o corpo ocupa 80%
 * da altura da tela. E isso que "a textura enche a vista" quer dizer.
 */
export const FOCO_PLENO_EM = 4;

/**
 * Acima deste foco a linha e ESCONDIDA, e nao desenhada quase transparente.
 *
 * Uma linha que o programa nao vai mais desenhar e uma linha que ele nao
 * desenha. Deixa-la em 2% de opacidade custa o mesmo passe de desenho e entrega
 * um fantasma.
 */
export const CORTE_DA_LINHA = 0.92;

/**
 * O foco, de 0 a 1. `distanciaUa` e `raioRealUa` na mesma unidade.
 *
 * A rampa e em espaco LOG pelo mesmo motivo que `transicao.ts` interpola
 * `log(raio)`: linear em raios gastaria quase toda a rampa perto de 64 e
 * desabaria no fim — um corte, e nao um movimento. Em log, cada oitava de
 * aproximacao rende o mesmo tanto de esmaecimento, que e como a percepcao
 * funciona. O `smoothstep` no fim tira os joelhos das duas pontas.
 */
export function foco(distanciaUa: number, raioRealUa: number): number {
  if (!(raioRealUa > 0) || !(distanciaUa > 0)) return 0;
  const emRaios = distanciaUa / raioRealUa;
  if (emRaios >= FOCO_COMECA_EM) return 0;
  if (emRaios <= FOCO_PLENO_EM) return 1;
  const t =
    Math.log(FOCO_COMECA_EM / emRaios) / Math.log(FOCO_COMECA_EM / FOCO_PLENO_EM);
  return t * t * (3 - 2 * t);
}

/**
 * Quanto da opacidade de uma linha auxiliar sobrevive a este foco.
 *
 * **Isto MULTIPLICA, e nunca liga.** Quem desligou "Caminhos previstos" nao
 * pode ve-los voltar por ter se aproximado de um planeta.
 *
 * As fitas de orbita ja sao desenhadas como `misturar(fundo, cor, 0,3)` — 30%
 * da cor do corpo sobre o fundo — e os aneis de distancia usam uma cor
 * declarada decorativa. Nenhum dos dois esta sob a regra de 3:1, porque a
 * informacao deles e a FORMA e nao a cor, e nada neles e unico: o caminho
 * previsto e redundante com o proprio movimento do corpo. Por isso o
 * esmaecimento pode ir a zero sem par novo em `PARES_PARA_CONFERIR` — e por
 * isso ele nunca toca a malha de um corpo, que seria outra conversa.
 */
export function atenuacaoDasLinhas(f: number): number {
  if (f >= CORTE_DA_LINHA) return 0;
  return Math.max(0, 1 - f / CORTE_DA_LINHA);
}

/**
 * Quantos rotulos sobrevivem a este foco.
 *
 * **Afina a multidao; nao apaga o texto.** Baixar a opacidade de uma placa
 * deixaria texto legivel abaixo de 4,5:1, e a pessoa pode parar a roda em
 * qualquer lugar — nao ha defesa de "e so uma transicao". Em vez disso desce o
 * teto que `colocar` ja recebe, e a prioridade que ja existe decide quem fica:
 * o corpo acompanhado vale +1000 e e o ultimo a sair.
 */
export function tetoDeRotulos(f: number, tetoBase: number): number {
  if (f <= 0) return tetoBase;
  return Math.max(1, Math.round(tetoBase * (1 - f) + 1 * f));
}

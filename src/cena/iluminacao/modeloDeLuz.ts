/**
 * A luz. Uma so, pontual, no Sol — e mais nada.
 *
 * `scene.environment = null` e nenhuma `AmbientLight`. A luz que ilumina cada
 * ponto e `N·L` com a penumbra do disco solar, e mais nada.
 *
 * ## O PISO do lado noturno, e por que ele existe
 *
 * Este cabecalho dizia, com todas as letras, que "o lado noturno e preto de
 * verdade", e chamava a luz ambiente de atalho que tira da cena a unica coisa
 * que o espaco tem de proprio: o contraste absoluto entre um lado e o outro.
 * Como descricao de fisica, continua certo. Como decisao de PROGRAMA, estava
 * errada, e o que a derrubou foi o zoom.
 *
 * Medido na tela, com Marte a tres raios e o Sol a noventa graus: o disco
 * inteiro sai **preto**, e o unico desenho que sobra e o arco da atmosfera no
 * limbo. Um programa que existe para mostrar como os planetas sao carregava um
 * mapa de 8K, orientava o eixo pelo polo da IAU, media o meridiano — e
 * entregava um buraco preto. A metade que se via era metade; a outra metade
 * nao existia para quem estava olhando.
 *
 * Dai o piso. O lado noturno passa a receber `PISO_DO_LADO_NOTURNO` da luz do
 * meio-dia — a mesma textura, na mesma cor, mais escura. Nao e uma segunda
 * fonte de luz nem um termo ambiente de aparencia: e a MESMA luz, com um
 * minimo, e por isso o terminador continua sendo um terminador em vez de
 * sumir. O que se perde e o preto absoluto; o que se ganha e o planeta inteiro.
 *
 * **Isso e licenca visual, e vai declarada.** Ha entrada nomeada no bloco "o
 * que a tela simplifica", amarrada por `honestidade.test.ts`, e
 * `e2e/ladoNoturno.spec.ts` mede as duas metades da regra: a noite aparece, e a
 * noite continua sendo noite.
 *
 * ## A penumbra do terminador
 *
 * `N·L` cru da uma borda de dia-para-noite fina demais. O Sol nao e um ponto:
 * visto da Terra ele tem 0,53° de diametro, e a faixa de penumbra tem a
 * largura desse angulo. Sem ela o terminador vira uma navalha e a cena parece
 * CGI de 1998; com ela, parece uma fotografia.
 *
 *     s  = raioDoSol / distanciaAoSol      (meio angulo, em radianos)
 *     nl = smoothstep(−s, s, dot(N, L))
 *
 * ## O decaimento fica DESLIGADO
 *
 * A irradiancia entra por uniforme, calculada na CPU com a distancia REAL. Se
 * a luz decaisse sozinha com `1/d²` usando a posicao da cena, o modo maquete —
 * que comprime as distancias — deixaria Netuno a 5,5 UA visuais e portanto
 * ~30 vezes mais iluminado que o real. A compressao passaria a alterar um
 * resultado fisico visivel, que e exatamente o vazamento que a regra "a escala
 * visual nunca altera a fisica" existe para impedir.
 */
import { float, mix, normalWorld, positionWorld, smoothstep, uniform, vec3, vec4 } from 'three/tsl';
import type { texture } from 'three/tsl';
import type Node from 'three/src/nodes/core/Node.js';

/**
 * Um no escalar. Escrito assim, e nao como `ReturnType<typeof float>`, porque
 * `float` e sobrecarregado: a inferencia cai numa sobrecarga que devolve
 * `VarNode`, e ai qualquer expressao normal deixa de ser atribuivel.
 */
export type NoFloat = Node<'float'>;
import { Vector3 } from 'three';

/**
 * Os uniformes sao criados pela fabrica e o TIPO e derivado dela.
 * Declarar a interface a mao com `ReturnType<typeof uniform>` perde o
 * parametro de tipo do no, e ai `.sub()` e `.negate()` somem.
 */
function criar() {
  return {
    /** Centro do corpo, no espaco da cena. Base das duas sombras do anel. */
    centroDoCorpo: uniform(new Vector3()),
    /** Raio desenhado do corpo, em unidades de cena. */
    raioDesenhado: uniform(1),
    /** Normal do plano dos aneis — o polo do corpo, no espaco da cena. */
    poloDoCorpo: uniform(new Vector3(0, 0, 1)),
    /** Raio interno e externo dos aneis, em raios do corpo. */
    anelInterno: uniform(1.11),
    anelExterno: uniform(2.33),
    /** Posicao do Sol, no MESMO espaco em que as malhas estao (relativo a camera). */
    posicaoDoSol: uniform(new Vector3()),
    /** Raio do Sol dividido pela distancia real ate este corpo. Da a penumbra. */
    meioAngulo: uniform(0.00465), // 0,53° / 2, visto de 1 UA
    /** Quanto de luz chega, em relacao a 1 UA. Calculado com a distancia REAL. */
    irradiancia: uniform(1),
  };
}

export type UniformesDeLuz = ReturnType<typeof criar>;

export const criarUniformesDeLuz = criar;

/**
 * `0` na noite fechada, `1` no meio-dia, com a penumbra do tamanho certo.
 *
 * Continua devolvendo ZERO na noite, e e de proposito: este e o fator que diz
 * ONDE e noite, e ha quem precise saber disso — as luzes de cidade da Terra so
 * acendem onde ele e zero, e o halo da atmosfera so brilha onde ele nao e.
 * Quem quer a luz que ILUMINA a superficie usa `comPisoNoturno` por cima.
 *
 * Funcao TypeScript comum, e nao um `Fn` do TSL: ela so monta o grafo de nos,
 * e o `Fn` existe para reaproveitar CODIGO no shader, o que aqui nao se ganha.
 */
export function fatorDeLuz(u: UniformesDeLuz) {
  const paraOSol = u.posicaoDoSol.sub(positionWorld).normalize();
  const nl = normalWorld.normalize().dot(paraOSol);
  return smoothstep(u.meioAngulo.negate(), u.meioAngulo, nl);
}

/**
 * Quanto da luz do meio-dia o lado noturno recebe.
 *
 * **Medido, e nao escolhido.** O criterio tem dois lados, e os dois estao em
 * `e2e/ladoNoturno.spec.ts`: a noite tem de APARECER — com relevo, nao como
 * chapa cinza — e tem de continuar sendo NOITE, claramente mais escura que o
 * dia. Abaixo de ~0,08 a textura do lado noturno morre na quantizacao de 8 bits
 * depois do tonemapping; acima de ~0,25 o terminador deixa de se ler e o corpo
 * parece chapado, sem volume.
 *
 * 0,14 fica no meio dessa faixa: sao 2,8 paradas abaixo do meio-dia, a mesma
 * distancia que uma fotografia com sombra aberta tem do sol direto.
 */
export const PISO_DO_LADO_NOTURNO = 0.14;

/**
 * A luz que ILUMINA a superficie: a mesma de sempre, com um minimo.
 *
 * `mix(piso, 1, luz)`, e nao `max(luz, piso)`: com `max` o terminador ganharia
 * um degrau na altura do piso — uma linha dura exatamente onde o projeto
 * gastou uma penumbra do tamanho do disco solar para nao ter uma. Interpolando,
 * a rampa continua inteira, so que entre `piso` e `1` em vez de entre `0` e `1`.
 */
export function comPisoNoturno(luz: NoFloat): NoFloat {
  return luz.mul(float(1 - PISO_DO_LADO_NOTURNO)).add(float(PISO_DO_LADO_NOTURNO));
}

/**
 * **Sombra do PLANETA sobre o ANEL.**
 *
 * Analitica, e nao por mapa de sombra: o corpo e uma esfera, entao basta
 * perguntar se o raio que sai do ponto do anel em direcao ao Sol passa dentro
 * dela. `t` e o parametro do ponto de maior aproximacao; ele so conta se for
 * positivo, ou seja, se a esfera estiver entre o ponto e o Sol — senao o anel
 * do lado de la ficaria escuro sem motivo.
 */
export function sombraDoCorpoNoAnel(u: UniformesDeLuz) {
  const d = positionWorld.sub(u.centroDoCorpo);
  const paraOSol = u.posicaoDoSol.sub(positionWorld).normalize();
  const t = d.dot(paraOSol).negate();
  const perpendicular = d.add(paraOSol.mul(t));
  const raioRelativo = perpendicular.length().div(u.raioDesenhado);

  // A borda da sombra tem a largura do disco solar visto dali: e penumbra, e
  // nao um corte. Sem isso a sombra no anel tem serrilhado de navalha.
  const margem = u.meioAngulo.mul(20).max(float(0.002));
  const foraDaSombra = smoothstep(float(1).sub(margem), float(1).add(margem), raioRelativo);
  const naSombra = mix(float(0.06), float(1), foraDaSombra);

  // `t < 0` significa que o corpo esta ATRAS do ponto em relacao ao Sol: nao
  // ha sombra nenhuma nesse lado.
  return t.greaterThan(float(0)).select(naSombra, 1);
}

/**
 * **Sombra do ANEL sobre o PLANETA.**
 *
 * O caminho inverso: do ponto da superficie em direcao ao Sol, onde o raio
 * cruza o PLANO do anel? Se cruza dentro da faixa, a luz que chega e atenuada
 * por `exp(−tau / |cos i|)` — e aqui esta a razao de o alfa da textura ter de
 * virar profundidade optica antes: com o alfa cru a atenuacao nao depende do
 * angulo, e a sombra obliqua, que e a que se ve, desaparece.
 */
export function sombraDoAnelNoCorpo(
  u: UniformesDeLuz,
  tauDoAnel: (r: NoFloat) => NoFloat,
) {
  const paraOSol = u.posicaoDoSol.sub(positionWorld).normalize();
  const n = u.poloDoCorpo.normalize();
  const cosI = n.dot(paraOSol);
  const d = positionWorld.sub(u.centroDoCorpo);

  // Intersecao raio-plano: t = −(d·n) / (dir·n).
  const denominador = cosI.abs().max(float(1e-3)).mul(cosI.sign());
  const t = d.dot(n).negate().div(denominador);
  const cruzamento = d.add(paraOSol.mul(t));
  const raioNoAnel = cruzamento.length().div(u.raioDesenhado);

  const dentro = t
    .greaterThan(float(0))
    .and(raioNoAnel.greaterThan(u.anelInterno))
    .and(raioNoAnel.lessThan(u.anelExterno));

  const atenuacao = tauDoAnel(raioNoAnel).div(cosI.abs().max(float(0.02))).negate().exp();
  // O `1` vai como NUMERO, e nao como `float(1)`: a primeira sobrecarga de
  // `select` aceita numero, e e ela que da o tipo certo. Com um no no lugar,
  // o TypeScript escolhe a sobrecarga generica e reclama.
  return dentro.select(atenuacao, 1);
}

/**
 * `ReturnType<typeof texture>` escolhe a sobrecarga generica e infere o tipo do
 * no como `unknown`, o que faz `.rgb` e `.r` sumirem. Fixando o parametro em
 * `'vec4'` — que e o padrao do `TextureNode` — os componentes voltam.
 */
export type NoDeTextura = ReturnType<typeof texture<'vec4'>>;

export interface MapasDaSuperficie {
  albedo: NoDeTextura;
  noite?: NoDeTextura;
  nuvens?: NoDeTextura;
  /** Quanto o corpo reflete, da ficha da NASA. Modula o brilho do lado de dia. */
  albedoGeometrico: number;
  /** Profundidade optica do anel num raio dado. Ausente em corpo sem anel. */
  tauDoAnel?: (r: NoFloat) => NoFloat;
}

/**
 * A cor final de um ponto da superficie.
 *
 * Ordem: dia, noite, nuvens. As nuvens entram por ULTIMO e so do lado
 * iluminado — nuvem nao brilha no escuro, e deixar as luzes de cidade
 * aparecerem ATRAVES da nuvem e um erro classico e visivel.
 *
 * **Dois fatores de luz, e a diferenca importa.** `luz` e o cru, zero na
 * noite: e ele que diz ONDE e noite, e e ele que as luzes de cidade
 * perguntam. `luzVisivel` e o que de fato ilumina a superficie, com o piso.
 * Trocar um pelo outro no lugar errado apaga as luzes das cidades ou as faz
 * vazar para o lado de dia.
 */
export function corDaSuperficie(u: UniformesDeLuz, mapas: MapasDaSuperficie) {
  // A sombra do anel entra na LUZ, e nao na cor: ela nao escurece a
  // superficie, ela impede o Sol de chegar nela.
  const luz = mapas.tauDoAnel
    ? fatorDeLuz(u).mul(sombraDoAnelNoCorpo(u, mapas.tauDoAnel))
    : fatorDeLuz(u);
  // O piso entra DEPOIS da sombra do anel, e nao antes. Assim a faixa que o
  // anel projeta sobre Saturno tambem para de ser um vazio preto atravessando
  // o planeta e passa a ser uma sombra com a superficie dentro — que e o que
  // uma fotografia da Cassini mostra.
  const luzVisivel = comPisoNoturno(luz);
  const dia = mapas.albedo.rgb.mul(float(mapas.albedoGeometrico * 2.2));

  let cor = dia.mul(luzVisivel).mul(u.irradiancia);

  if (mapas.noite) {
    // As luzes de cidade so aparecem onde o Sol nao bate, e a transicao e mais
    // estreita que a da luz: o contorno do continente iluminado nao pode
    // vazar para o lado de dia. A mascara le a luz CRUA — com a do piso ela
    // nunca chegaria a zero, e as cidades acenderiam de dia.
    const noite = mapas.noite.rgb.mul(float(1.4));
    cor = cor.add(noite.mul(float(1).sub(smoothstep(float(0), float(0.25), luz))));
  }

  if (mapas.nuvens) {
    // As nuvens usam a luz COM piso, pela mesma razao que a superficie: com a
    // crua, o lado noturno da Terra ficaria com o oceano visivel e buracos
    // pretos em forma de nuvem por cima — a cobertura apagaria justamente o
    // que o piso acabou de acender. Elas continuam escondendo as luzes de
    // cidade, que e o erro classico que a ordem daqui existe para evitar.
    const cobertura = mapas.nuvens.r;
    cor = mix(cor, vec3(1, 1, 1).mul(luzVisivel).mul(u.irradiancia), cobertura.mul(float(0.9)));
  }

  return vec4(cor, float(1));
}

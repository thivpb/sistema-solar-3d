/**
 * O retrato que a fisica publica a cada quadro, e que a cena e a interface leem.
 *
 * Este e o contrato que mantem as camadas separadas: a cena recebe um
 * Instantaneo e desenha; ela nao conhece o simulador, nao conhece o reducer e
 * nao tem como pedir que a fisica ande.
 *
 * **As posicoes vem em Float64 ABSOLUTO**, em UA, e nao num buffer de render
 * pronto. A tentacao de publicar Float32 ja relativo a camera economiza uma
 * subtracao e custa caro: Float32 quantiza a 269 km a 30 UA e a 13 km a 1,5 UA.
 * Fobos tem 11 km de diametro — ele ficaria menor que o quantum de posicao do
 * proprio pai. Quem converte para coordenada de cena e `cena/origemFlutuante`,
 * em dupla precisao, num ponto unico.
 */
import type { IdCorpo } from './ids.ts';

export interface Instantaneo {
  /** Dias TDB desde a epoca, JA interpolado: `tDias + alfa * dt`. */
  tDias: number;
  /** Dia juliano correspondente, para virar data civil. */
  jd: number;
  /** (3N) UA, absolutas, na ordem do catalogo. */
  pos: Float64Array;
  /** (3N) UA/dia, do ultimo estado integrado. */
  vel: Float64Array;
  n: number;
  /** Verdadeiro quando o quadro nao entregou o tempo pedido. */
  atrasado: boolean;
  pausado: boolean;
}

/**
 * O que a ficha de um corpo mostra. Derivado do Instantaneo, nao guardado.
 *
 * E uma UNIAO, e nao um objeto com campos opcionais, porque o Sol nao e um
 * planeta com alguns dados faltando: as grandezas dele sao de outra natureza.
 * Ele nao tem distancia ao Sol, nao tem periodo e nao tem elipse — ele E a
 * referencia heliocentrica, e o que se mede dele e o movimento em torno do
 * centro de massa.
 *
 * Tratar isso como campo opcional foi o que produziu, na primeira versao, uma
 * ficha do Sol dizendo "uma volta leva cerca de 0 dias".
 *
 * Pelo mesmo motivo ha um terceiro tipo para as LUAS. Elas nao orbitam o Sol,
 * e a distancia que importa nelas e a do planeta; a posicao nao vem da
 * integracao, e sim de um modelo aproximado, e o desvio disso e um numero que
 * a ficha precisa mostrar. Nada disso cabe numa leitura de planeta com campos
 * a mais.
 */
export type LeituraDeCorpo =
  | {
      chave: IdCorpo;
      nome: string;
      tipo: 'orbita';
      distanciaAoSolUa: number;
      velocidadeKmS: number;
      periodoDias: number;
      /** Falso quando a energia e >= 0: o corpo nao esta preso ao Sol. */
      ligada: boolean;
    }
  | {
      chave: IdCorpo;
      nome: string;
      tipo: 'lua';
      /** A chave do corpo que ela orbita. */
      pai: IdCorpo;
      nomeDoPai: string;
      /** Semieixo da orbita em torno do planeta, em km. */
      distanciaAoPlanetaKm: number;
      /** Volta em torno do planeta, em dias. */
      periodoDias: number;
      /** O desvio medido contra a efemeride do JPL, em km. Vai escrito. */
      desvioMedidoKm: number;
    }
  | {
      chave: IdCorpo;
      nome: string;
      tipo: 'referencial';
      /** Distancia ao centro de massa dos corpos simulados, em UA. */
      distanciaAoCentroUa: number;
      /** Velocidade em relacao ao centro de massa, em km/s. */
      velocidadeKmS: number;
    };

/**
 * A analise do Sol, ja convertida para as unidades que aparecem escritas.
 *
 * Mora aqui, e nao em `nucleo/analiseSol.ts`, pelo mesmo motivo que
 * `LeituraDeCorpo`: e o formato do que ATRAVESSA a fronteira. O nucleo publica
 * vetores em UA/dia^2 e nao sabe que existe uma tabela ordenada por fracao do
 * total; a interface le esta estrutura e nao sabe que existe `EstadoSistema`.
 */
export interface AnaliseDoSolNaTela {
  distanciaAoCentroKm: number;
  velocidadeKmS: number;
  /** Modulo da aceleracao resultante, em m/s^2. */
  aceleracaoMS2: number;
  /** Uma linha por sistema planetario, da maior puxada para a menor. */
  puxoes: { nome: string; aceleracaoMS2: number }[];
}

/**
 * O que a opcao "Mostrar dados técnicos" mostra.
 *
 * Existe porque o texto de ajuda dessa opcao PROMETE quatro coisas — passo de
 * integracao, energia, desempenho e qual placa esta desenhando — e a tela
 * entregava so a ultima. Promessa escrita e funcionalidade sao a mesma coisa
 * do ponto de vista de quem le.
 *
 * O numero que justifica o integrador escolhido e `desvioDeEnergia`. Num
 * integrador simpletico ele OSCILA e nao cresce; num Euler ou num RK4 ele
 * cresce sem voltar. Mostra-lo ao vivo e a unica forma de a afirmacao
 * "integrador simpletico" ser algo alem de uma palavra no README.
 */
export interface DadosTecnicos {
  /** Passo do integrador, em dias. */
  passoDias: number;
  /** Passos por segundo real, medidos no intervalo entre publicacoes. */
  passosPorSegundo: number;
  quadrosPorSegundo: number;
  msPorQuadro: number;
  /** |E(t) - E(0)| / |E(0)|. Adimensional. */
  desvioDeEnergia: number;
  /** |L(t) - L(0)| / |L(0)|. Conserva-se melhor ainda que a energia. */
  desvioDeMomentoAngular: number;
  corpos: number;
  backend: string;
}

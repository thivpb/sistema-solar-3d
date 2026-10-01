/**
 * Acoes: o que a pessoa pediu, como dado.
 *
 * Um componente NUNCA muda o estado do programa. Ele devolve uma Acao, e
 * `aplicar.ts` decide o que fazer com ela, num lugar so. Quando alguem
 * precisar descobrir "por que clicar aqui fez aquilo", ha um unico ponto para
 * olhar — e esse foi o motivo original da escolha, na versao em pygame.
 *
 * Em TypeScript isso vira uma uniao discriminada, e o compilador passa a
 * cobrar exaustividade no reducer de graca. Mas ha um buraco que ele NAO
 * cobre: um membro da uniao que nenhum componente constroi nao e erro de
 * compilacao. Dai `produtorDeAcao.test.ts` existir.
 */
import type {
  EscalaVisual,
  IdCorpo,
  Modo,
  ModoDeUso,
  VisibilidadeDasLuas,
  Vista,
} from '../contratos/ids.ts';
import type { Predefinicao } from '../contratos/sandbox.ts';

export type { EscalaVisual, Modo, ModoDeUso, VisibilidadeDasLuas, Vista };
export type { Predefinicao };

export type Lado = 'a' | 'b';

/** As telas sobrepostas. Uma de cada vez, como no original. */
export type Tela =
  | 'ajuda'
  | 'tutorial'
  | 'dica'
  // Nao ha 'detalhes'. A ficha completa de um corpo virou uma secao da lateral,
  // que abre ao lado da cena em vez de sobre ela. A caixa obrigava a escolher
  // entre ler sobre o planeta e olhar para o planeta, e fechar a caixa apagava
  // o que se tinha acabado de ler.
  | 'comparar'
  | 'atividades'
  | 'matematica-do-sol'
  | 'tabela-de-dados'
  // Nao ha 'criar-pelos-numeros'. Ela existiu na especificacao como caminho
  // acessivel ao lado de um gesto de arrastar, por causa do criterio 2.5.7 da
  // WCAG 2.2. O gesto de arrastar nao foi construido: no modo Criar se aponta,
  // se clica e se usa um controle deslizante, que o teclado opera. Sem arrasto
  // nao ha o que dar alternativa, e uma tela que ninguem alcanca e pior que
  // uma tela que nao existe.
  | 'laboratorio';

export type Opcao =
  | 'orbitas'
  | 'trilhas'
  | 'rotulos'
  | 'aneisDeDistancia'
  | 'estrelas'
  | 'tamanhoReal'
  | 'textoMaior'
  | 'tecnico'
  | 'reduzirAnimacao';

/**
 * As tres gavetas do painel, pela PERGUNTA que cada uma responde.
 *
 * `cena` e "como a cena e desenhada", `leitura` e "como eu leio" — sobre o
 * leitor, e nao sobre a cena — e `explorar` e "para onde ir". As tres moravam
 * juntas dentro de "Mais opções", que era o motivo de ninguem achar nada:
 * "Mais opções" nao e uma pergunta, e uma gaveta de sobras.
 */
export type Gaveta = 'cena' | 'leitura' | 'destinos';

export type Acao =
  // -- tempo ----------------------------------------------------------------
  | { tipo: 'alternar-pausa' }
  | { tipo: 'mudar-velocidade'; passo?: -1 | 1; valor?: number }
  | { tipo: 'avancar-passo'; sentido?: -1 | 1 }
  | { tipo: 'voltar-ao-inicio' }
  // -- camera ---------------------------------------------------------------
  | { tipo: 'trocar-modo'; modo: Modo }
  | { tipo: 'alternar-vista' }
  | { tipo: 'vista-superior' }
  | { tipo: 'ajustar-zoom'; fator: number; ancora?: readonly [number, number] }
  | { tipo: 'orbitar-camera'; azimute: number; elevacao: number }
  /**
   * Desloca a camera. As duas componentes sao FRACAO DA ALTURA VISIVEL, e nao
   * pixels nem UA.
   *
   * O nome do campo carrega a unidade de proposito. Antes eles se chamavam
   * `dx`/`dy` e nada dizia em que unidade estavam: `ponteiro.ts` convertia pixel
   * para UA antes de despachar, e `atalhos.ts` mandava 48 — que era o comentario
   * "pixels por toque" chegando cru em `deslocar(camera, dxUa, dyUa)`. Shift+seta
   * deslocava o pivo 48 UA por toque, num sistema de 31,5 UA de raio: um toque
   * jogava a camera para fora do Sistema Solar. O caminho do mouse estava certo e
   * o do teclado errado, o que quebrava a paridade gesto-tecla que e requisito.
   *
   * A fracao e adimensional e independe do zoom, entao os dois produtores falam
   * a mesma lingua e a conversao acontece num lugar so — em `principal.ts`, que e
   * o unico que conhece a altura visivel em UA.
   */
  | { tipo: 'deslocar-camera'; fracaoX: number; fracaoY: number }
  | { tipo: 'acompanhar'; chave: IdCorpo | null }
  // -- selecao --------------------------------------------------------------
  | { tipo: 'selecionar'; chave: IdCorpo | null }
  | { tipo: 'comparar-com'; chave: IdCorpo | null }
  | { tipo: 'mudar-comparacao'; lado: Lado; passo: -1 | 1 }
  | { tipo: 'inverter-comparacao' }
  // -- cena -----------------------------------------------------------------
  | { tipo: 'alternar-opcao'; opcao: Opcao }
  | { tipo: 'definir-escala-visual'; escala: EscalaVisual }
  /**
   * Quanto as luas aparecem. Tres estados, nao um booleano — ver
   * `VisibilidadeDasLuas`.
   */
  | { tipo: 'definir-luas'; visibilidade: VisibilidadeDasLuas }
  /** O proximo dos tres, em ciclo. Produtor: a tecla `L`. */
  | { tipo: 'ciclar-luas' }
  | { tipo: 'alternar-lateral' }
  | { tipo: 'alternar-ficha' }
  /**
   * Entra e sai do modo imersivo.
   *
   * Separado de `trocar-modo-de-uso` porque a tela cheia e do NAVEGADOR, e
   * pedi-la exige um gesto da pessoa no mesmo quadro — `requestFullscreen`
   * recusa quando nao ha. Uma acao propria deixa o efeito de tela cheia sair
   * exatamente daqui, e de nenhum outro caminho que tambem troque o modo.
   */
  | { tipo: 'alternar-imersivo' }
  /**
   * Abre ou fecha uma das tres gavetas do painel.
   *
   * Era `alternar-mais-opcoes`, uma acao para uma gaveta so. Quando "Leitura" e
   * "Explorar" sairam de dentro de "Mais opções" — porque nao eram a mesma
   * pergunta —, o caminho obvio seria escrever mais duas acoes e mais dois
   * booleanos. Uma acao com um nome de gaveta faz a quarta custar uma linha, e
   * e o mesmo padrao que `alternar-opcao` ja usa para as oito opcoes.
   */
  | { tipo: 'alternar-gaveta'; gaveta: Gaveta }
  // -- telas ----------------------------------------------------------------
  | { tipo: 'abrir-tela'; tela: Tela; argumento?: string }
  | { tipo: 'mostrar-dica'; chave: string }
  | { tipo: 'fechar' }
  // -- sandbox --------------------------------------------------------------
  | { tipo: 'trocar-modo-de-uso'; modo: ModoDeUso }
  | { tipo: 'escolher-predefinicao'; predefinicao: Predefinicao }
  | { tipo: 'mirar-colocacao'; pos: readonly [number, number, number] | null }
  | { tipo: 'definir-velocidade'; fracaoDaCircular: number }
  | { tipo: 'criar-corpo' }
  /**
   * A recusa de uma criacao, com a saida junto.
   *
   * Produtor: `principal.ts`, que e quem chama o sistema vivo e recebe o
   * veredito. A frase ja vem escrita, de `dados/textos.ts`; o que o reducer
   * precisa saber alem dela e se o passo curto RESOLVE — e disso que depende
   * existir ou nao o botao. Uma recusa sem saida e um beco.
   */
  | { tipo: 'recusar-criacao'; texto: string; passoCurtoResolve: boolean }
  | { tipo: 'apagar-corpo'; chave: IdCorpo }
  | { tipo: 'desfazer' }
  | { tipo: 'restaurar-sistema' }
  | { tipo: 'usar-passo-curto' }
  /**
   * O resultado de uma mutacao, vindo de quem de fato mexeu no sistema.
   *
   * `principal.ts` e o produtor: ele chama `sistemaVivo`, recebe o veredito e
   * despacha isto. O reducer nao pode calcular estes campos — ele e puro e
   * nunca ve `EstadoSistema` —, e sem eles o distintivo de sistema modificado
   * seria um palpite do reducer sobre um estado que ele nao enxerga.
   */
  | { tipo: 'sistema-mudou'; modificado: boolean; podeDesfazer: boolean; proximoDesfazer: string | null }
  // -- sistema --------------------------------------------------------------
  | { tipo: 'capturar-tela' }
  /**
   * Uma frase temporaria na pilha de avisos.
   *
   * Saiu da uniao na F2 por nao ter produtor — uma acao que so o reducer
   * construiria seria caminho morto. Voltou na F7 JUNTO com o produtor: quando
   * uma criacao e recusada, quem tem os numeros do veredito e `principal.ts`,
   * e quem sabe escrever a frase em portugues e `dados/textos.ts`. O reducer
   * nao ve nenhum dos dois.
   */
  | { tipo: 'avisar'; texto: string };

// `confirmar` continua fora da uniao, e por isso: o reducer ja emite o EFEITO
// de mesmo nome, e ninguem de fora precisa confirmar nada. `avisar` voltou —
// ver o comentario dela acima —, e voltou do jeito que estava combinado: com o
// produtor junto, e nao antes.

export type TipoDeAcao = Acao['tipo'];

/**
 * Todos os tipos, como valor. Existe para o teste de exaustividade: a uniao
 * acima some em tempo de execucao, entao sem esta lista nao ha como percorrer
 * os membros e perguntar se cada um tem produtor.
 *
 * Manter em sincronia com a uniao e responsabilidade de `acoes.test.ts`, que
 * falha se um tipo estiver numa e nao na outra.
 */
export const TIPOS_DE_ACAO = [
  'alternar-pausa', 'mudar-velocidade', 'avancar-passo', 'voltar-ao-inicio',
  'trocar-modo', 'alternar-vista', 'vista-superior', 'ajustar-zoom',
  'orbitar-camera', 'deslocar-camera', 'acompanhar',
  'selecionar', 'comparar-com', 'mudar-comparacao', 'inverter-comparacao',
  'alternar-opcao', 'definir-escala-visual', 'definir-luas', 'ciclar-luas',
  'alternar-lateral', 'alternar-ficha', 'alternar-imersivo', 'alternar-gaveta',
  'abrir-tela', 'mostrar-dica', 'fechar',
  'trocar-modo-de-uso', 'escolher-predefinicao', 'mirar-colocacao', 'definir-velocidade',
  'criar-corpo', 'recusar-criacao', 'apagar-corpo', 'desfazer', 'restaurar-sistema', 'usar-passo-curto',
  'sistema-mudou',
  'capturar-tela', 'avisar',
] as const satisfies readonly TipoDeAcao[];

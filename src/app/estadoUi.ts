/**
 * O que a interface esta mostrando. Sem fisica dentro.
 *
 * Separado do estado fisico de proposito: trocar de modo, abrir um painel ou
 * selecionar um planeta nao pode, POR CONSTRUCAO, alterar uma posicao ou o
 * relogio. Na versao em pygame isso era garantido por um teste que lia os
 * imports; aqui o dependency-cruiser faz o mesmo.
 */
import type {
  EscalaVisual,
  Gaveta,
  ModoDeUso,
  Modo,
  Opcao,
  Predefinicao,
  Tela,
  VisibilidadeDasLuas,
  Vista,
} from './acoes.ts';
import type { IdCorpo } from '../contratos/ids.ts';

export interface EstadoUi {
  pausado: boolean;
  diasPorSegundo: number;
  modo: Modo;
  vista: Vista;
  selecionado: IdCorpo | null;
  acompanhado: IdCorpo | null;
  comparando: IdCorpo | null;
  escalaVisual: EscalaVisual;
  /** Quanto as luas aparecem: com, sem, ou so elas. */
  luas: VisibilidadeDasLuas;
  lateralAberta: boolean;
  /** A ficha inteira do corpo escolhido, aberta na lateral em vez de num modal. */
  fichaAberta: boolean;
  /** Que gavetas do painel estao abertas. Ver `Gaveta` em `acoes.ts`. */
  gavetas: Record<Gaveta, boolean>;
  telaAberta: Tela | null;
  argumentoTela: string | null;
  tutorialVisto: boolean;
  sistemaModificado: boolean;
  podeDesfazer: boolean;
  /** O que o próximo "Desfazer" desfaz, por extenso. */
  proximoDesfazer: string | null;
  modoDeUso: ModoDeUso;
  /** O corpo sendo criado, enquanto não foi aceito. */
  rascunho: {
    predefinicao: Predefinicao;
    /** Onde ele vai ficar, em UA. Nulo até alguém mirar. */
    pos: readonly [number, number, number] | null;
    /** A velocidade, como fração da circular naquele ponto. 1 = órbita redonda. */
    fracaoDaCircular: number;
    /** A última recusa, enquanto não se muda nada. Nula quando não há. */
    recusa: { texto: string; passoCurtoResolve: boolean } | null;
  };
  opcoes: Record<Opcao, boolean>;
}

export const ESTADO_INICIAL: EstadoUi = {
  pausado: false,
  diasPorSegundo: 30,
  modo: 'sistema',
  vista: 'perspectiva',
  selecionado: null,
  acompanhado: null,
  comparando: null,
  escalaVisual: 'real',
  luas: 'com',
  lateralAberta: true,
  fichaAberta: false,
  gavetas: { cena: false, leitura: false, destinos: false },
  telaAberta: null,
  argumentoTela: null,
  tutorialVisto: false,
  sistemaModificado: false,
  podeDesfazer: false,
  proximoDesfazer: null,
  modoDeUso: 'explorar',
  rascunho: { predefinicao: 'asteroide', pos: null, fracaoDaCircular: 1, recusa: null },
  opcoes: {
    orbitas: true,
    trilhas: true,
    rotulos: true,
    aneisDeDistancia: true,
    estrelas: true,
    tamanhoReal: false,
    textoMaior: false,
    tecnico: false,
    reduzirAnimacao: false,
  },
};

/**
 * O que vai para o arquivo de preferencias.
 *
 * Campos transitorios sao deliberadamente zerados: selecao, corpo acompanhado,
 * comparacao e tela aberta. Reabrir o programa com um modal aberto, ou com um
 * planeta selecionado que a pessoa nao lembra ter escolhido, e pior que
 * reabrir limpo.
 */
export function paraPreferencias(e: EstadoUi): Record<string, unknown> {
  return {
    versao: 1,
    modo: e.modo === 'acompanhar' || e.modo === 'perto' ? 'sistema' : e.modo,
    vista: e.vista,
    diasPorSegundo: e.diasPorSegundo,
    escalaVisual: e.escalaVisual,
    luas: e.luas,
    lateralAberta: e.lateralAberta,
    gavetas: { ...e.gavetas },
    tutorialVisto: e.tutorialVisto,
    // `modoDeUso` e `rascunho` NAO sao gravados, pelo mesmo motivo que a
    // selecao e o modal aberto: reabrir o programa no modo Criar, com metade
    // de um corpo pela frente, e pior que reabrir limpo. E o sistema
    // modificado tambem nao: ele so existe enquanto a sessao existe.
    opcoes: { ...e.opcoes },
  };
}

/**
 * Le o arquivo de preferencias ignorando o que nao reconhece.
 *
 * "Preferencia e conveniencia, nao pode virar motivo de tela de erro" — a
 * regra e herdada literal do projeto anterior. Arquivo de uma versao velha,
 * chave desconhecida, tipo errado: tudo cai no padrao, calado.
 */
export function dePreferencias(bruto: unknown): EstadoUi {
  const e: EstadoUi = { ...ESTADO_INICIAL, opcoes: { ...ESTADO_INICIAL.opcoes } };
  if (typeof bruto !== 'object' || bruto === null) return e;
  const d = bruto as Record<string, unknown>;

  if (d['modo'] === 'sistema' || d['modo'] === 'internos') e.modo = d['modo'];
  if (d['vista'] === 'perspectiva' || d['vista'] === 'ortografica') e.vista = d['vista'];
  if (d['escalaVisual'] === 'real' || d['escalaVisual'] === 'maquete') e.escalaVisual = d['escalaVisual'];
  if (typeof d['diasPorSegundo'] === 'number' && d['diasPorSegundo'] > 0) {
    e.diasPorSegundo = d['diasPorSegundo'];
  }
  // Compatibilidade com o arquivo da versao anterior, em que `luas` era um
  // booleano dentro de `opcoes`. O laco de opcoes mais abaixo ignora a chave por
  // nao reconhece-la, e sem esta linha quem tinha desligado as luas as veria
  // voltar calado — o tipo de perda pequena que faz preferencia parecer nao
  // funcionar. Vem ANTES da leitura nova, para que a nova prevaleca quando as
  // duas estiverem no arquivo.
  const opcoesGravadas = d['opcoes'];
  if (typeof opcoesGravadas === 'object' && opcoesGravadas !== null) {
    const antiga = (opcoesGravadas as Record<string, unknown>)['luas'];
    if (typeof antiga === 'boolean') e.luas = antiga ? 'com' : 'sem';
  }
  if (d['luas'] === 'com' || d['luas'] === 'sem' || d['luas'] === 'so') e.luas = d['luas'];
  if (typeof d['lateralAberta'] === 'boolean') e.lateralAberta = d['lateralAberta'];
  // `maisOpcoesAberto` era um booleano so, e virou tres gavetas. Um arquivo de
  // preferencias gravado antes disso continua sendo lido: o valor antigo abre a
  // gaveta que herdou o conteudo dele. Mesmo caminho que `luas` percorreu
  // quando deixou de ser booleano.
  if (typeof d['maisOpcoesAberto'] === 'boolean') e.gavetas.cena = d['maisOpcoesAberto'];
  const gavetas = d['gavetas'];
  if (typeof gavetas === 'object' && gavetas !== null) {
    for (const [k, v] of Object.entries(gavetas)) {
      if (k in e.gavetas && typeof v === 'boolean') e.gavetas[k as Gaveta] = v;
    }
  }
  if (typeof d['tutorialVisto'] === 'boolean') e.tutorialVisto = d['tutorialVisto'];

  const opcoes = d['opcoes'];
  if (typeof opcoes === 'object' && opcoes !== null) {
    for (const [k, v] of Object.entries(opcoes)) {
      if (k in e.opcoes && typeof v === 'boolean') e.opcoes[k as Opcao] = v;
    }
  }
  return e;
}

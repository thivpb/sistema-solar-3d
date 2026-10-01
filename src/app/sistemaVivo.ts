/**
 * O sistema que pode mudar — e o unico lugar onde ele muda.
 *
 * O `EstadoSistema` da fisica e o catalogo de corpos da interface sao duas
 * listas paralelas indexadas pela mesma posicao. Enquanto so existiam os nove
 * da efemeride, elas nasciam juntas e nunca mudavam. O sandbox quebra isso: um
 * corpo criado tem de entrar nas duas, um apagado tem de sair das duas, e o
 * `removerCorpo` do nucleo DESLOCA todos os indices seguintes — de proposito,
 * para nao embaralhar a ordem de somatorio das forcas.
 *
 * Duas listas que se deslocam juntas e uma que nao se desloca e o defeito que
 * este modulo existe para tornar impossivel: aqui as duas mudam na mesma
 * chamada, e quem mais guarda indice recebe um aviso para se corrigir.
 *
 * **Nada aqui roda por quadro.** O sistema so muda em EVENTOS discretos: criar,
 * apagar, editar, desfazer, voltar ao inicio. E por isso que guardar um
 * instantaneo inteiro a cada mudanca e barato — sao uns 800 bytes, algumas
 * dezenas de vezes por sessao — enquanto guardar por quadro seria absurdo.
 */
import { copiarEstado, inserirCorpo, removerCorpo, restaurarEstado } from '../nucleo/estado.ts';
import { MAXIMO_DE_CORPOS_CRIADOS, avaliarVizinhanca, avaliarCriacao } from '../nucleo/guardas.ts';
import type { VereditoDeVizinhanca, Veredito } from '../nucleo/guardas.ts';
import { elementosDeVetores } from '../nucleo/efemerides.ts';
import type { EstadoSistema } from '../nucleo/tipos.ts';
import type { Corpo } from '../contratos/ids.ts';
import type { CorpoCriado, Predefinicao } from '../contratos/sandbox.ts';
import { receitaDe } from '../dados/predefinicoes.ts';

export type Recusa =
  | { tipo: 'periastro'; veredito: Extract<Veredito, { aceito: false }> }
  | { tipo: 'vizinhanca'; veredito: Extract<VereditoDeVizinhanca, { aceito: false }>; nome: string }
  | { tipo: 'lotado'; maximo: number };

export type Resultado = { ok: true; chave: string; indice: number } | { ok: false; recusa: Recusa };

/** Um instantaneo de tudo que o sandbox pode ter mudado. */
interface Marco {
  estado: EstadoSistema;
  corpos: Corpo[];
  criados: CorpoCriado[];
  rotulo: string;
}

export interface SistemaVivo {
  readonly estado: EstadoSistema;
  readonly corpos: readonly Corpo[];
  readonly criados: readonly CorpoCriado[];
  readonly modificado: boolean;
  readonly podeDesfazer: boolean;
  /** O que o proximo "Desfazer" desfaz, por extenso. Nulo quando nao ha nada. */
  readonly proximoDesfazer: string | null;
  criar(p: {
    predefinicao: Predefinicao;
    pos: readonly [number, number, number];
    vel: readonly [number, number, number];
    dtDias: number;
    diaSimulado: number;
  }): Resultado;
  apagar(chave: string): boolean;
  desfazer(): string | null;
  /** Volta ao preset da efemeride, descartando tudo. */
  restaurar(): void;
  /** Avisado sempre que a lista de corpos muda de tamanho ou de ordem. */
  aoMudar(ouvinte: () => void): void;
}

/**
 * Teto da pilha de desfazer.
 *
 * Vinte marcos cobrem qualquer sessao de sala de aula e custam 16 KB. O que
 * importa nao e o numero: e que o distintivo "sistema modificado" NAO seja
 * `podeDesfazer` — a pilha descarta o marco mais antigo, e depois de vinte e
 * uma criacoes o distintivo sumiria com o sistema ainda modificado. O
 * distintivo olha a lista de criados; a pilha e outra coisa.
 */
const PROFUNDIDADE_DO_DESFAZER = 20;

export function criarSistemaVivo(estado: EstadoSistema, corpos: Corpo[]): SistemaVivo {
  const original: Marco = {
    estado: copiarEstado(estado),
    corpos: corpos.map((c) => ({ ...c })),
    criados: [],
    rotulo: 'o Sistema Solar do JPL',
  };
  let criados: CorpoCriado[] = [];
  const pilha: Marco[] = [];
  const ouvintes: (() => void)[] = [];
  let proximoNumero = 1;

  const avisar = (): void => {
    for (const o of ouvintes) o();
  };

  const guardar = (rotulo: string): void => {
    pilha.push({
      estado: copiarEstado(estado),
      corpos: corpos.map((c) => ({ ...c })),
      criados: criados.map((c) => ({ ...c })),
      rotulo,
    });
    if (pilha.length > PROFUNDIDADE_DO_DESFAZER) pilha.shift();
  };

  const voltarPara = (m: Marco): void => {
    restaurarEstado(estado, m.estado);
    corpos.length = 0;
    corpos.push(...m.corpos.map((c) => ({ ...c })));
    criados = m.criados.map((c) => ({ ...c }));
    avisar();
  };

  return {
    estado,
    corpos,
    get criados() {
      return criados;
    },
    // O distintivo olha a LISTA DE CRIADOS, e nao a pilha de desfazer: a pilha
    // descarta o marco mais antigo, e um invariante ligado a ela apagaria o
    // distintivo no vigesimo primeiro corpo com o sistema ainda modificado.
    get modificado() {
      return criados.length > 0 || corpos.length !== original.corpos.length;
    },
    get podeDesfazer() {
      return pilha.length > 0;
    },
    get proximoDesfazer() {
      return pilha.length > 0 ? pilha[pilha.length - 1]!.rotulo : null;
    },

    criar({ predefinicao, pos, vel, dtDias, diaSimulado }) {
      if (criados.length >= MAXIMO_DE_CORPOS_CRIADOS) {
        return { ok: false, recusa: { tipo: 'lotado', maximo: MAXIMO_DE_CORPOS_CRIADOS } };
      }
      const receita = receitaDe(predefinicao);

      // As duas guardas rodam ANTES de inserir. Avaliar depois exigiria
      // inserir e desfazer, e o estado passaria — por um instante — por uma
      // configuracao que o proprio programa considera invalida.
      const vizinhanca = avaliarVizinhanca(estado, pos, dtDias);
      if (!vizinhanca.aceito) {
        return {
          ok: false,
          recusa: { tipo: 'vizinhanca', veredito: vizinhanca, nome: corpos[vizinhanca.vizinho]?.nome ?? '?' },
        };
      }

      const rSol: [number, number, number] = [
        pos[0] - estado.pos[0]!,
        pos[1] - estado.pos[1]!,
        pos[2] - estado.pos[2]!,
      ];
      const vSol: [number, number, number] = [
        vel[0] - estado.vel[0]!,
        vel[1] - estado.vel[1]!,
        vel[2] - estado.vel[2]!,
      ];
      const mu = estado.gm[0]! + receita.gm;
      const veredito = avaliarCriacao(elementosDeVetores(rSol, vSol, mu), mu, dtDias);
      if (!veredito.aceito) return { ok: false, recusa: { tipo: 'periastro', veredito } };

      guardar(`criar ${receita.nome.toLowerCase()}`);

      // O numero do nome vem de um contador MONOTONO, e nao de "quantos desta
      // predefinicao existem". Contar os existentes produz nome repetido
      // depois de qualquer remocao: apagar o Cometa 1 faria a proxima criacao
      // se chamar Cometa 2 de novo, e a lista lateral ficaria com dois.
      const numero = proximoNumero++;
      const chave = `criado-${numero}`;
      const nome = `${receita.nome} ${numero}`;
      const indice = inserirCorpo(estado, pos, vel, receita.gm);
      corpos.push({
        chave,
        nome,
        // `papel: 'teste'` nao e rotulo: e o que diz ao resto do programa que
        // este corpo nao veio da efemeride. A ficha dele nao tem bloco de
        // fontes, e o distintivo de sistema modificado conta a partir daqui.
        papel: 'teste',
        gm: receita.gm,
        raioKm: receita.raioKm,
        idHorizons: '',
        eBaricentro: false,
      });
      criados.push({ chave, nome, predefinicao, criadoEmDiaSimulado: diaSimulado });
      avisar();
      return { ok: true, chave, indice };
    },

    apagar(chave) {
      const i = corpos.findIndex((c) => c.chave === chave);
      if (i < 0) return false;
      guardar(`apagar ${corpos[i]!.nome}`);
      removerCorpo(estado, i);
      corpos.splice(i, 1);
      criados = criados.filter((c) => c.chave !== chave);
      avisar();
      return true;
    },

    desfazer() {
      const m = pilha.pop();
      if (!m) return null;
      voltarPara(m);
      return m.rotulo;
    },

    restaurar() {
      pilha.length = 0;
      proximoNumero = 1;
      voltarPara(original);
    },

    aoMudar(o) {
      ouvintes.push(o);
    },
  };
}

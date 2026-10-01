/**
 * O UNICO lugar onde o estado da interface muda.
 *
 * A versao em pygame dizia, no proprio docstring: "Widgets devolvem `Acao`,
 * nunca mudam estado. `Aplicacao.aplicar` e o unico lugar onde algo muda — e
 * onde se depura 'por que clicar aqui fez aquilo'." A regra sobrevive.
 *
 * A funcao e **pura**: recebe estado e acao, devolve estado novo e uma lista
 * de EFEITOS. Efeito e o que o reducer nao pode fazer sozinho — reiniciar a
 * fisica, gravar preferencias, tirar uma captura de tela, anunciar algo num
 * leitor de tela. Devolve-los como dado, em vez de executa-los aqui, e o que
 * mantem o reducer testavel sem navegador e sem simulacao.
 *
 * O `const _: never = acao` no fim faz o compilador recusar um membro novo da
 * uniao que ninguem tratou. Ele NAO pega o contrario — um membro que ninguem
 * constroi —, e por isso ha um teste separado para esse lado.
 */
import type { Acao, Lado, Modo } from './acoes.ts';
import type { EstadoUi } from './estadoUi.ts';
import { ESTADO_INICIAL } from './estadoUi.ts';
import type { IdCorpo } from '../contratos/ids.ts';
import type { Predefinicao } from '../contratos/sandbox.ts';
import { receitaDe } from '../dados/predefinicoes.ts';
import { mudarVelocidade } from '../nucleo/relogio.ts';

export type Efeito =
  | { tipo: 'reiniciar-fisica' }
  | { tipo: 'passo-unico'; sentido: -1 | 1 }
  | { tipo: 'enquadrar'; modo: Modo; alvo: IdCorpo | null }
  | { tipo: 'orbitar-camera'; azimute: number; elevacao: number }
  /** Fracao da altura visivel. Ver a acao de mesmo nome em `acoes.ts`. */
  | { tipo: 'deslocar-camera'; fracaoX: number; fracaoY: number }
  | { tipo: 'ajustar-zoom'; fator: number; ancora?: readonly [number, number] }
  | { tipo: 'vista-superior' }
  /**
   * Pede ou devolve a tela cheia do navegador.
   *
   * O reducer nao pode chamar `requestFullscreen` — ele e puro e nao ve o DOM.
   * E a chamada precisa acontecer no MESMO turno do gesto da pessoa, senao o
   * navegador recusa: daí ser um efeito despachado em resposta a um clique ou a
   * uma tecla, e nao algo agendado.
   */
  | { tipo: 'tela-cheia'; querer: boolean }
  | { tipo: 'capturar-tela' }
  | { tipo: 'salvar-preferencias' }
  /** Vai para a regiao `polite` de confirmacoes: selecao, modo, velocidade. */
  | { tipo: 'confirmar'; texto: string }
  /** Vai para a fila visivel de avisos, e para a OUTRA regiao `polite`. */
  | { tipo: 'avisar'; texto: string }
  // -- sandbox ---------------------------------------------------------------
  /** Cria de verdade. Quem mexe no `EstadoSistema` e `principal.ts`. */
  | {
      tipo: 'criar-corpo';
      predefinicao: Predefinicao;
      pos: readonly [number, number, number];
      fracaoDaCircular: number;
    }
  | { tipo: 'apagar-corpo'; chave: IdCorpo }
  | { tipo: 'desfazer' }
  | { tipo: 'restaurar-sistema' }
  | { tipo: 'usar-passo-curto' };

export interface Contexto {
  /** Chaves dos corpos, na ordem do catalogo. Usada para ciclar a comparacao. */
  chaves: readonly IdCorpo[];
  /** Teto medido desta maquina, em dias por segundo. */
  tetoDiasPorSegundo: number;
  nomeDe(chave: IdCorpo): string;
}

export interface Resultado {
  ui: EstadoUi;
  efeitos: Efeito[];
}

function ciclar(chaves: readonly IdCorpo[], atual: IdCorpo | null, passo: -1 | 1): IdCorpo | null {
  if (chaves.length === 0) return null;
  const i = atual === null ? -1 : chaves.indexOf(atual);
  const j = (i + passo + chaves.length) % chaves.length;
  return chaves[j] ?? null;
}

export function aplicar(ui: EstadoUi, acao: Acao, ctx: Contexto): Resultado {
  const efeitos: Efeito[] = [];
  const e: EstadoUi = { ...ui, opcoes: { ...ui.opcoes } };

  switch (acao.tipo) {
    // -- tempo --------------------------------------------------------------
    case 'alternar-pausa':
      e.pausado = !e.pausado;
      efeitos.push({ tipo: 'confirmar', texto: e.pausado ? 'Pausado.' : 'O tempo voltou a correr.' });
      break;

    case 'mudar-velocidade': {
      const antes = e.diasPorSegundo;
      e.diasPorSegundo =
        acao.valor !== undefined
          ? Math.min(acao.valor, ctx.tetoDiasPorSegundo)
          : mudarVelocidade(antes, acao.passo ?? 1, ctx.tetoDiasPorSegundo);
      if (e.diasPorSegundo === antes && acao.passo === 1) {
        // O teto foi medido nesta maquina; dizer por que o botao nao fez nada
        // e melhor que deixar a pessoa clicando.
        efeitos.push({ tipo: 'avisar', texto: 'Esta e a velocidade mais alta que este computador entrega.' });
      }
      efeitos.push({ tipo: 'salvar-preferencias' });
      break;
    }

    case 'avancar-passo':
      // Avancar um passo com o tempo correndo nao faz sentido: pausa junto.
      e.pausado = true;
      efeitos.push({ tipo: 'passo-unico', sentido: acao.sentido ?? 1 });
      break;

    case 'voltar-ao-inicio':
      e.selecionado = null;
      e.acompanhado = null;
      e.comparando = null;
      e.modo = 'sistema';
      e.sistemaModificado = false;
      efeitos.push({ tipo: 'reiniciar-fisica' });
      efeitos.push({ tipo: 'enquadrar', modo: 'sistema', alvo: null });
      efeitos.push({ tipo: 'confirmar', texto: 'De volta ao Sistema Solar de 1 de janeiro de 2026.' });
      break;

    // -- camera -------------------------------------------------------------
    case 'trocar-modo': {
      // "Acompanhar" e "perto" precisam de alvo. Sem corpo escolhido, o pedido
      // vira um aviso em vez de um modo quebrado.
      const precisaAlvo = acao.modo === 'acompanhar' || acao.modo === 'perto';
      // **O escolhido vem antes do acompanhado**, e nao o contrario.
      //
      // Os dois sao intencao da pessoa, mas o escolhido e a MAIS RECENTE:
      // quem ja esta acompanhando Jupiter, clica na Terra e aperta "chegar
      // perto" esta pedindo a Terra. Com a prioridade invertida, a camera
      // ficava em Jupiter e nada na tela explicava por que — a lista mostrava
      // a Terra selecionada e a exposicao continuava medindo 5,2 UA.
      const alvo = e.selecionado ?? e.acompanhado;
      if (precisaAlvo && !alvo) {
        efeitos.push({ tipo: 'avisar', texto: 'Escolha um corpo primeiro.' });
        break;
      }
      e.modo = acao.modo;
      if (precisaAlvo) e.acompanhado = alvo;
      efeitos.push({ tipo: 'enquadrar', modo: acao.modo, alvo: precisaAlvo ? alvo : null });
      efeitos.push({ tipo: 'salvar-preferencias' });
      break;
    }

    case 'alternar-vista':
      e.vista = e.vista === 'perspectiva' ? 'ortografica' : 'perspectiva';
      efeitos.push({
        tipo: 'confirmar',
        texto: e.vista === 'ortografica' ? 'Vista de cima, sem perspectiva.' : 'Vista em perspectiva.',
      });
      efeitos.push({ tipo: 'salvar-preferencias' });
      break;

    case 'vista-superior':
      efeitos.push({ tipo: 'vista-superior' });
      efeitos.push({ tipo: 'confirmar', texto: 'Camera alinhada com o plano dos planetas.' });
      break;

    case 'ajustar-zoom':
      efeitos.push(
        acao.ancora
          ? { tipo: 'ajustar-zoom', fator: acao.fator, ancora: acao.ancora }
          : { tipo: 'ajustar-zoom', fator: acao.fator },
      );
      break;

    case 'orbitar-camera':
      efeitos.push({ tipo: 'orbitar-camera', azimute: acao.azimute, elevacao: acao.elevacao });
      break;

    case 'deslocar-camera':
      // Deslocar e dizer "quero olhar outra coisa": solta o acompanhamento.
      if (e.acompanhado) {
        e.acompanhado = null;
        if (e.modo === 'acompanhar' || e.modo === 'perto') e.modo = 'sistema';
      }
      efeitos.push({ tipo: 'deslocar-camera', fracaoX: acao.fracaoX, fracaoY: acao.fracaoY });
      break;

    case 'acompanhar':
      e.acompanhado = acao.chave;
      e.modo = acao.chave ? 'acompanhar' : 'sistema';
      efeitos.push({ tipo: 'enquadrar', modo: e.modo, alvo: acao.chave });
      efeitos.push({
        tipo: 'confirmar',
        texto: acao.chave ? `Acompanhando ${ctx.nomeDe(acao.chave)}.` : 'Acompanhamento solto.',
      });
      break;

    // -- selecao ------------------------------------------------------------
    case 'selecionar':
      e.selecionado = acao.chave;
      if (acao.chave) efeitos.push({ tipo: 'confirmar', texto: `${ctx.nomeDe(acao.chave)} selecionado.` });
      break;

    case 'comparar-com':
      e.comparando = acao.chave;
      if (acao.chave) {
        efeitos.push({ tipo: 'confirmar', texto: `${ctx.nomeDe(acao.chave)} escolhido para comparar.` });
      }
      break;

    case 'mudar-comparacao': {
      const lado: Lado = acao.lado;
      const atual = lado === 'a' ? e.selecionado : e.comparando;
      const novo = ciclar(ctx.chaves, atual, acao.passo);
      if (lado === 'a') e.selecionado = novo;
      else e.comparando = novo;
      if (novo) efeitos.push({ tipo: 'confirmar', texto: `${lado.toUpperCase()}: ${ctx.nomeDe(novo)}.` });
      break;
    }

    case 'inverter-comparacao': {
      const a = e.selecionado;
      e.selecionado = e.comparando;
      e.comparando = a;
      efeitos.push({ tipo: 'confirmar', texto: 'A e B trocados.' });
      break;
    }

    // -- cena ---------------------------------------------------------------
    case 'alternar-opcao':
      e.opcoes[acao.opcao] = !e.opcoes[acao.opcao];
      efeitos.push({ tipo: 'salvar-preferencias' });
      break;

    case 'definir-escala-visual': {
      const mudou = e.escalaVisual !== acao.escala;
      e.escalaVisual = acao.escala;
      if (mudou) {
        efeitos.push({
          tipo: 'avisar',
          texto:
            acao.escala === 'maquete'
              ? 'Distâncias comprimidas. O desenho deixou de estar em escala; os números das fichas continuam reais.'
              : 'Distâncias reais.',
        });
        // Reenquadra. Trocar de escala muda o tamanho do sistema desenhado por
        // um fator de 5,7 no caso da orbita de Netuno: sem reenquadrar, ligar a
        // compressao deixa a camera a 31,5 UA de um sistema que agora cabe em
        // 5,5, e a pessoa ve os oito planetas virarem um ponto.
        efeitos.push({
          tipo: 'enquadrar',
          modo: e.modo,
          alvo: e.modo === 'acompanhar' || e.modo === 'perto' ? (e.acompanhado ?? e.selecionado) : null,
        });
      }
      efeitos.push({ tipo: 'salvar-preferencias' });
      break;
    }

    case 'alternar-ficha':
      e.fichaAberta = !e.fichaAberta;
      // Abrir a ficha inteira NAO abre a lateral escondida: seriam duas coisas
      // num gesto so, e a segunda sem pedido.
      efeitos.push({ tipo: 'salvar-preferencias' });
      break;

    case 'ciclar-luas': {
      const ordem = ['com', 'sem', 'so'] as const;
      const proximo = ordem[(ordem.indexOf(e.luas) + 1) % ordem.length]!;
      return aplicar(ui, { tipo: 'definir-luas', visibilidade: proximo }, ctx);
    }

    case 'definir-luas': {
      const mudou = e.luas !== acao.visibilidade;
      e.luas = acao.visibilidade;
      if (mudou) {
        efeitos.push({
          tipo: 'confirmar',
          texto:
            acao.visibilidade === 'sem'
              ? 'Luas escondidas.'
              : acao.visibilidade === 'so'
                ? 'Só as luas. Os planetas continuam desenhados, mas os nomes e os caminhos passam a ser das luas.'
                : 'Luas e planetas.',
        });
        efeitos.push({ tipo: 'salvar-preferencias' });
      }
      break;
    }

    case 'alternar-imersivo': {
      const entrando = e.modoDeUso !== 'voar';
      e.modoDeUso = entrando ? 'voar' : 'explorar';
      // Voar e mover o pivo da camera, e nao ha como fazer isso grudado num
      // corpo: o acompanhamento reescreve o pivo a cada quadro e o voo seria
      // desfeito antes de aparecer. Soltar aqui, de uma vez, e mais honesto que
      // deixar as teclas sem efeito visivel.
      if (entrando) e.acompanhado = null;
      // O rascunho de criacao nao sobrevive: as teclas WASD sao do voo, e
      // metade de um corpo pela frente num modo que nao o conclui e lixo.
      if (entrando) e.rascunho = { ...e.rascunho, pos: null, recusa: null };
      efeitos.push({ tipo: 'tela-cheia', querer: entrando });
      efeitos.push({
        tipo: 'confirmar',
        texto: entrando
          ? 'Modo imersivo. W, A, S e D voam; Q e E sobem e descem; Shift acelera. Esc sai.'
          : 'Modo imersivo encerrado.',
      });
      break;
    }

    case 'alternar-lateral':
      e.lateralAberta = !e.lateralAberta;
      efeitos.push({ tipo: 'salvar-preferencias' });
      break;

    case 'alternar-gaveta':
      e.gavetas = { ...e.gavetas, [acao.gaveta]: !e.gavetas[acao.gaveta] };
      efeitos.push({ tipo: 'salvar-preferencias' });
      break;

    // -- telas --------------------------------------------------------------
    case 'abrir-tela':
      e.telaAberta = acao.tela;
      e.argumentoTela = acao.argumento ?? null;
      if (acao.tela === 'tutorial') e.tutorialVisto = true;
      // O laboratorio pausa a simulacao: e a pausa que torna a elipse, a data
      // do cabecalho e os numeros de desvio coerentes entre si.
      if (acao.tela === 'laboratorio') e.pausado = true;
      break;

    case 'mostrar-dica':
      e.telaAberta = 'dica';
      e.argumentoTela = acao.chave;
      break;

    case 'fechar':
      if (e.telaAberta === 'tutorial') e.tutorialVisto = true;
      // Uma tecla, uma coisa: com caixa aberta o Esc fecha a caixa e o modo
      // imersivo fica. So quando nao ha nada para fechar e que ele sai do modo.
      // Sem esta ordem, abrir a ajuda dentro do modo imersivo e apertar Esc
      // fecharia a ajuda E jogaria a pessoa fora do modo, de uma vez.
      if (e.telaAberta === null && e.modoDeUso === 'voar') {
        e.modoDeUso = 'explorar';
        efeitos.push({ tipo: 'tela-cheia', querer: false });
        efeitos.push({ tipo: 'confirmar', texto: 'Modo imersivo encerrado.' });
      }
      e.telaAberta = null;
      e.argumentoTela = null;
      efeitos.push({ tipo: 'salvar-preferencias' });
      break;

    // -- sandbox ------------------------------------------------------------
    case 'trocar-modo-de-uso':
      // Sair do voo por este caminho tambem devolve a tela cheia. Senao dava
      // para ficar em tela cheia sem estar no modo que a pediu, e a unica saida
      // seria o Esc do navegador — um estado sem controle escrito que o abandone.
      if (e.modoDeUso === 'voar' && acao.modo !== 'voar') {
        efeitos.push({ tipo: 'tela-cheia', querer: false });
      }
      if (acao.modo === 'voar') {
        e.acompanhado = null;
        efeitos.push({ tipo: 'tela-cheia', querer: true });
      }
      // **Entrar em Criar abre o painel**, pelo mesmo motivo que entrar em Voar
      // pede tela cheia: o modo EXIGE uma interface que so existe ali.
      //
      // `PainelDeCriacao` so e montado dentro da lateral. Com o painel
      // escondido — e o botao que o esconde fica ao lado do proprio
      // segmentado de modo, na mesma faixa —, escolher "Criar" nao mostrava
      // nada: nem o tipo de corpo, nem a mira, nem o botao de criar. Clicar na
      // cena desenhava uma elipse de previsao solta, sem texto e sem forma de
      // confirmar. A unica saida era adivinhar que "Mostrar painel" resolvia.
      if (acao.modo === 'criar') e.lateralAberta = true;
      e.modoDeUso = acao.modo;
      // Sair do modo Criar descarta o rascunho. Guardá-lo deixaria uma linha
      // de prumo pela frente ao voltar, sem que nada explicasse de onde veio.
      if (acao.modo === 'explorar') e.rascunho = { ...e.rascunho, pos: null };
      efeitos.push({
        tipo: 'confirmar',
        texto:
          acao.modo === 'criar'
            ? 'Modo criar. Escolha o tipo de corpo e mire na cena, ou use "Criar pelos números".'
            : acao.modo === 'voar'
              ? 'Modo imersivo. W, A, S e D voam; Q e E sobem e descem; Shift acelera. Esc sai.'
              : 'Modo explorar.',
      });
      break;

    case 'escolher-predefinicao':
      e.rascunho = { ...e.rascunho, predefinicao: acao.predefinicao, recusa: null };
      efeitos.push({ tipo: 'confirmar', texto: `${receitaDe(acao.predefinicao).nome} escolhido.` });
      break;

    case 'mirar-colocacao':
      // Mirar noutro ponto apaga a recusa: ela era sobre o ponto anterior, e
      // deixar o texto velho na tela seria recusar uma coisa que ninguem pediu.
      e.rascunho = { ...e.rascunho, pos: acao.pos, recusa: null };
      break;

    case 'definir-velocidade':
      // Sem teto a velocidade viraria uma hipérbole com periastro minúsculo, e
      // a guarda recusaria depois de a pessoa já ter arrastado até lá. 1,6 é
      // acima da de escape (√2 = 1,414), que é o ponto que se quer mostrar.
      e.rascunho = {
        ...e.rascunho,
        fracaoDaCircular: Math.min(1.6, Math.max(0, acao.fracaoDaCircular)),
        recusa: null,
      };
      break;

    case 'criar-corpo':
      if (!e.rascunho.pos) {
        efeitos.push({ tipo: 'avisar', texto: 'Mire um ponto na cena antes de criar.' });
        break;
      }
      efeitos.push({
        tipo: 'criar-corpo',
        predefinicao: e.rascunho.predefinicao,
        pos: e.rascunho.pos,
        fracaoDaCircular: e.rascunho.fracaoDaCircular,
      });
      break;

    case 'recusar-criacao':
      e.rascunho = {
        ...e.rascunho,
        recusa: { texto: acao.texto, passoCurtoResolve: acao.passoCurtoResolve },
      };
      efeitos.push({ tipo: 'avisar', texto: acao.texto });
      break;

    case 'apagar-corpo':
      efeitos.push({ tipo: 'apagar-corpo', chave: acao.chave });
      break;

    case 'desfazer':
      if (!e.podeDesfazer) {
        efeitos.push({ tipo: 'avisar', texto: 'Não há nada para desfazer.' });
        break;
      }
      efeitos.push({ tipo: 'desfazer' });
      break;

    case 'restaurar-sistema':
      efeitos.push({ tipo: 'restaurar-sistema' });
      e.selecionado = null;
      e.acompanhado = null;
      e.comparando = null;
      break;

    case 'usar-passo-curto':
      efeitos.push({ tipo: 'usar-passo-curto' });
      // A escada de velocidade e cortada por `ctx.tetoDiasPorSegundo`, que a
      // maquina mediu, e nao por uma constante: com o passo quatro vezes menor
      // o teto cai na mesma proporcao. Fixar "1825" aqui valeria so para uma
      // maquina cujo teto medido fosse 7300.
      e.diasPorSegundo = Math.min(e.diasPorSegundo, ctx.tetoDiasPorSegundo / 4);
      efeitos.push({ tipo: 'confirmar', texto: 'Passo curto ligado: meio dia virou um oitavo.' });
      // A recusa deixou de valer: era com o passo antigo.
      e.rascunho = { ...e.rascunho, recusa: null };
      break;

    case 'sistema-mudou':
      e.sistemaModificado = acao.modificado;
      e.podeDesfazer = acao.podeDesfazer;
      e.proximoDesfazer = acao.proximoDesfazer;
      break;

    // -- sistema ------------------------------------------------------------
    case 'capturar-tela':
      efeitos.push({ tipo: 'capturar-tela' });
      break;

    case 'avisar':
      efeitos.push({ tipo: 'avisar', texto: acao.texto });
      break;

    default: {
      // Um membro novo da uniao sem tratamento nao compila: `acao` so e
      // atribuivel a `never` se todos os casos ja tiverem sido cobertos acima.
      const _exaustivo: never = acao;
      void _exaustivo;
      return { ui, efeitos: [] };
    }
  }

  return { ui: e, efeitos };
}

export { ESTADO_INICIAL };

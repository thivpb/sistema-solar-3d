/**
 * As telas sobrepostas, com o conteudo educativo.
 *
 * **O `<dialog>` fica montado o tempo todo**, mesmo sem tela aberta. A
 * primeira versao devolvia `null` quando nao havia tela, e com isso o elemento
 * saia do DOM no mesmo quadro em que `close()` era chamado — antes de o
 * navegador devolver o foco a quem abriu. O foco caia no `<body>`, que e
 * exatamente o defeito que `<dialog>` existe para nao ter.
 */
import type { JSX } from 'preact';
import { Modal } from './Modal.tsx';
import { Botao } from '../componentes/controles.tsx';
import { TABELA_DE_ATALHOS, TECLAS_DO_NAVEGADOR } from '../../app/atalhos.ts';
import { despachar, ui } from '../estado.ts';
import type { AnaliseDoSolNaTela, LeituraDeCorpo } from '../../contratos/instantaneo.ts';
import type { EstadoUi } from '../../app/estadoUi.ts';
import {
  ATIVIDADES,
  CONTROLES,
  DICAS,
  ESCALA_FICHA,
  FONTES,
  HONESTIDADE,
  TUTORIAL,
} from '../../dados/textos.ts';
// `fichas.ts` e `corposVisuais.ts` sairam daqui junto com a caixa de detalhes:
// quem le massa, rotacao, curiosidade e procedencia agora e `componentes/Ficha.tsx`.
// O credito das texturas fica, porque ele e do programa e nao de um corpo.
import { CREDITO_DAS_TEXTURAS } from '../../dados/corposVisuais.ts';
import { LUAS } from '../../dados/luas.ts';

/**
 * `leitura` e `criados` sairam daqui.
 *
 * Elas existiam para a caixa de detalhes, que era a unica tela sobre UM corpo.
 * O que sobrou sao telas sobre o programa e sobre o sistema inteiro: a tabela de
 * dados quer todas as leituras, a Matematica do Sol quer a analise do Sol, e as
 * demais nao querem numero nenhum.
 */
interface Props {
  corpos: readonly { chave: string; nome: string }[];
  leituras: readonly LeituraDeCorpo[];
  /** A análise do Sol, recalculada ao vivo. */
  sol: AnaliseDoSolNaTela | null;
}

interface Conteudo {
  titulo: string;
  corpo: JSX.Element;
  acoes?: JSX.Element;
}

const numero = (v: number, casas = 3): string => v.toFixed(casas).replace('.', ',');

const milhares = (v: number): string =>
  Math.round(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');

/** Texto com parágrafos separados por linha em branco vira vários `<p>`. */
function Paragrafos({ texto }: { texto: string }): JSX.Element {
  return (
    <>
      {texto.split('\n\n').map((p, i) => (
        <p key={i}>{p}</p>
      ))}
    </>
  );
}

export function Telas({ leituras, sol }: Props): JSX.Element {
  const e = ui.value;
  const fechar = (): void => despachar({ tipo: 'fechar' });
  // O laboratorio NAO e modal: ele e uma lamina ao lado da cena, e a cena
  // continua a vista de proposito — metade do que ele mostra esta la fora.
  const conteudo =
    e.telaAberta && e.telaAberta !== 'laboratorio'
      ? conteudoDe(e, leituras, sol)
      : null;

  return (
    <Modal
      titulo={conteudo?.titulo ?? ''}
      aberto={conteudo !== null}
      onFechar={fechar}
      acoes={conteudo?.acoes}
    >
      {conteudo?.corpo ?? null}
    </Modal>
  );
}

function conteudoDe(e: EstadoUi, leituras: readonly LeituraDeCorpo[], sol: Props['sol']): Conteudo {
  const tela = e.telaAberta!;

  switch (tela) {
    // ── Ajuda ───────────────────────────────────────────────────────────────
    case 'ajuda':
      return {
        titulo: 'Ajuda',
        corpo: (
          <>
            <h3>Como mexer</h3>
            <Paragrafos texto={CONTROLES} />

            <h3>Atalhos</h3>
            <p class="nota">
              Os atalhos complementam os botões. Nenhum deles é a única forma de fazer alguma coisa.
            </p>
            <table class="tabela">
              <thead>
                <tr>
                  <th scope="col">Tecla</th>
                  <th scope="col">O que faz</th>
                </tr>
              </thead>
              <tbody>
                {TABELA_DE_ATALHOS.map((a) => (
                  <tr key={a.escrito}>
                    <th scope="row">{a.escrito}</th>
                    <td>{a.descricao}</td>
                  </tr>
                ))}
                <tr>
                  <th scope="row">{TECLAS_DO_NAVEGADOR.join(', ')}</th>
                  <td>navegação padrão: percorrer, acionar e rolar</td>
                </tr>
              </tbody>
            </table>

            {/* Os três blocos que o projeto separa desde a primeira versão. */}
            {[HONESTIDADE.calcula, HONESTIDADE.simplifica, HONESTIDADE.naoInclui].map((b) => (
              <section key={b.titulo}>
                <h3>{b.titulo}</h3>
                <Paragrafos texto={b.texto} />
              </section>
            ))}

            <h3>O que os números da ficha significam</h3>
            <Paragrafos texto={ESCALA_FICHA} />

            <h3>{FONTES.titulo}</h3>
            <dl class="fontes">
              {FONTES.blocos.map((b) => (
                <div key={b.nome}>
                  <dt>{b.nome}</dt>
                  <dd>{b.texto}</dd>
                </div>
              ))}
            </dl>
            <p class="nota">{CREDITO_DAS_TEXTURAS}</p>
          </>
        ),
      };

    // ── Detalhes de um corpo ────────────────────────────────────────────────
    // Nao ha `case 'detalhes'`. A ficha completa de um corpo saiu daqui e virou
    // uma secao da barra lateral, em `componentes/Ficha.tsx`.
    //
    // O motivo e o que a caixa custava: ela cobria a cena, e ler sobre um planeta
    // exigia parar de olhar para ele. Fechar a caixa para ver o planeta apagava o
    // que se tinha acabado de ler, e reabri-la cobria o planeta de novo. Uma
    // ficha ao lado da cena nao tem esse vaivem, e a lateral ja rolava por dentro.
    //
    // O que continua em caixa e o que E documento: Ajuda, Atividades, tutorial,
    // tabela de dados. Documento se le de uma vez; objeto se olha enquanto se le.
    // ── Comparar ────────────────────────────────────────────────────────────
    case 'comparar': {
      const a = leituras.find((l) => l.chave === e.selecionado) ?? null;
      const b = leituras.find((l) => l.chave === e.comparando) ?? null;
      const orbita = (l: LeituraDeCorpo | null): l is Extract<LeituraDeCorpo, { tipo: 'orbita' }> =>
        l !== null && l.tipo === 'orbita';

      const intervalo = orbita(a) && orbita(b) ? Math.max(a.periodoDias, b.periodoDias) : null;

      return {
        titulo: 'Comparar corpos',
        acoes: <Botao onClick={() => despachar({ tipo: 'inverter-comparacao' })}>Inverter A e B</Botao>,
        corpo: (
          <>
            <div class="seletor-ab">
              {(['a', 'b'] as const).map((lado) => {
                const l = lado === 'a' ? a : b;
                return (
                  <div key={lado} class="seletor-ab__lado">
                    <h3>
                      {lado.toUpperCase()}: {l?.nome ?? 'nenhum'}
                    </h3>
                    <div class="seletor-ab__botoes">
                      <Botao
                        onClick={() => despachar({ tipo: 'mudar-comparacao', lado, passo: -1 })}
                        rotulo={`Corpo anterior no lado ${lado.toUpperCase()}`}
                      >
                        Anterior
                      </Botao>
                      <Botao
                        onClick={() => despachar({ tipo: 'mudar-comparacao', lado, passo: 1 })}
                        rotulo={`Próximo corpo no lado ${lado.toUpperCase()}`}
                      >
                        Próximo
                      </Botao>
                    </div>
                  </div>
                );
              })}
            </div>

            {orbita(a) && orbita(b) && intervalo ? (
              <>
                <p>
                  No mesmo intervalo de {milhares(intervalo)} dias — o tempo de uma volta do mais
                  lento dos dois:
                </p>
                <table class="tabela">
                  <thead>
                    <tr>
                      <th scope="col"></th>
                      <th scope="col">{a.nome}</th>
                      <th scope="col">{b.nome}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <th scope="row">voltas nesse tempo</th>
                      <td>{numero(intervalo / a.periodoDias, 2)}</td>
                      <td>{numero(intervalo / b.periodoDias, 2)}</td>
                    </tr>
                    <tr>
                      <th scope="row">velocidade</th>
                      <td>{numero(a.velocidadeKmS, 1)} km/s</td>
                      <td>{numero(b.velocidadeKmS, 1)} km/s</td>
                    </tr>
                    <tr>
                      <th scope="row">distância ao Sol agora</th>
                      <td>{numero(a.distanciaAoSolUa)} UA</td>
                      <td>{numero(b.distanciaAoSolUa)} UA</td>
                    </tr>
                  </tbody>
                </table>

                <h3>Por que a diferença</h3>
                <p>
                  Quanto mais perto do Sol, mais forte a gravidade e mais depressa o corpo
                  precisa andar para não cair. Nada foi sincronizado nem acelerado para esta
                  comparação: são as velocidades que cada um tem na simulação.
                </p>
                <p class="nota">
                  Velocidade × tempo não dá a distância percorrida: a velocidade muda ao longo da
                  órbita, e mais ainda quando ela é alongada.
                </p>
              </>
            ) : (
              <p class="nota">
                Escolha dois corpos em órbita fechada. O Sol não entra na comparação: ele não
                orbita nada.
              </p>
            )}
          </>
        ),
      };
    }

    // ── Atividades e dicas ──────────────────────────────────────────────────
    case 'atividades':
      return {
        titulo: 'Coisas para experimentar',
        corpo: (
          <>
            <p class="nota">
              Cada uma pode ser respondida olhando a própria simulação. A resposta está escrita
              junto, para conferir depois de tentar.
            </p>
            {ATIVIDADES.map((a) => (
              <section key={a.titulo}>
                <h3>{a.titulo}</h3>
                <p>{a.tarefa}</p>
                <p class="nota">Resposta: {a.resposta}</p>
              </section>
            ))}

            <h3>Perguntas rápidas</h3>
            <ul class="dicas">
              {Object.entries(DICAS).map(([chave, d]) => (
                <li key={chave}>
                  <Botao onClick={() => despachar({ tipo: 'mostrar-dica', chave })}>
                    {d.pergunta}
                  </Botao>
                </li>
              ))}
            </ul>
          </>
        ),
      };

    case 'dica': {
      const d = e.argumentoTela ? DICAS[e.argumentoTela] : undefined;
      return {
        titulo: d?.pergunta ?? 'Dica',
        acoes: (
          <Botao onClick={() => despachar({ tipo: 'abrir-tela', tela: 'atividades' })}>
            Ver as outras
          </Botao>
        ),
        corpo: d ? <Paragrafos texto={d.resposta} /> : <p class="nota">Dica não encontrada.</p>,
      };
    }

    // ── A matemática do Sol ─────────────────────────────────────────────────
    case 'matematica-do-sol': {
      // Os puxoes vem ordenados do maior para o menor.
      const maiorPuxao = sol?.puxoes[0]?.aceleracaoMS2 ?? 1;
      return {
        titulo: 'A matemática do Sol',
        corpo: sol ? (
          <>
            <p>
              O Sol não tem órbita em volta de nada — ele é o centro da referência. O que ele tem
              é um bamboleio: a soma das puxadas dos oito sistemas planetários o desloca em torno
              do centro de massa de todos.
            </p>
            <dl class="ficha__dados">
              <dt>distância ao centro de massa</dt>
              <dd>{milhares(sol.distanciaAoCentroKm)} km</dd>
              <dt>velocidade em relação a ele</dt>
              <dd>{numero(sol.velocidadeKmS, 4)} km/s</dd>
              <dt>aceleração resultante</dt>
              <dd>{sol.aceleracaoMS2.toExponential(3).replace('.', ',')} m/s²</dd>
            </dl>

            <h3>Quem puxa quanto</h3>
            <p class="nota">
              A aceleração que cada sistema planetário impõe ao Sol, agora, em m/s².
            </p>
            <table class="tabela">
              <thead>
                <tr>
                  <th scope="col">Sistema</th>
                  <th scope="col">Puxada</th>
                  {/* Comparar com a MAIOR, e não com a resultante.
                      "Fração do total" era falso: as parcelas são vetores que
                      apontam para lados diferentes e se cancelam em parte, de
                      modo que os módulos somavam 147% da resultante. Uma
                      coluna de porcentagem que não fecha em 100 é um erro que
                      quem lê atribui ao programa — e com razão. */}
                  <th scope="col">Comparada com a de Júpiter</th>
                </tr>
              </thead>
              <tbody>
                {sol.puxoes.map((p) => (
                  <tr key={p.nome}>
                    <th scope="row">{p.nome}</th>
                    <td>{p.aceleracaoMS2.toExponential(2).replace('.', ',')}</td>
                    <td>
                      {p.aceleracaoMS2 >= maiorPuxao
                        ? '—'
                        : `${numero((100 * p.aceleracaoMS2) / maiorPuxao, 1)}%`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p class="nota">
              A conta é a lei de Newton, uma parcela por corpo: <b>a = GM / d²</b>. As parcelas são
              vetores e apontam para lados diferentes, então elas não se somam como números: a
              resultante acima é menor que a soma das puxadas desta tabela, porque uma cancela
              parte da outra. É a mesma conta que move todo o resto da simulação.
            </p>
          </>
        ) : (
          <p class="nota">Sem dados ainda.</p>
        ),
      };
    }

    // ── Tabela de dados ─────────────────────────────────────────────────────
    case 'tabela-de-dados':
      return {
        titulo: 'Os corpos, em tabela',
        corpo: (
          <>
            <p class="nota">
              A mesma informação que está desenhada na cena, em texto. A cena é um canvas, e um
              canvas não tem como ser lido por um leitor de tela.
            </p>
            <table class="tabela">
              <thead>
                <tr>
                  <th scope="col">Corpo</th>
                  <th scope="col">Distância ao Sol</th>
                  <th scope="col">Velocidade</th>
                  <th scope="col">Uma volta leva</th>
                </tr>
              </thead>
              <tbody>
                {/* Só os corpos da física. As luas têm tabela própria logo
                    abaixo, porque as colunas delas são outras: uma lua não tem
                    distância ao Sol que valha a pena escrever, e tem um desvio
                    medido que nenhum planeta tem. Uma tabela só, com metade das
                    células vazias, diria menos sobre as duas. */}
                {leituras
                  .filter((l) => l.tipo !== 'lua')
                  .map((l) => (
                    <tr key={l.chave}>
                      <th scope="row">{l.nome}</th>
                      <td>
                        {l.tipo === 'referencial'
                          ? `${milhares(l.distanciaAoCentroUa * 149597870.7)} km do centro de massa`
                          : `${numero(l.distanciaAoSolUa)} UA`}
                      </td>
                      <td>{numero(l.velocidadeKmS, l.tipo === 'referencial' ? 3 : 1)} km/s</td>
                      <td>
                        {l.tipo === 'referencial'
                          ? 'não há período único'
                          : l.ligada
                            ? `${milhares(l.periodoDias)} dias`
                            : '—'}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>

            {/* As luas existiam SÓ no canvas — desenhadas, rotuladas e
                invisíveis para quem usa leitor de tela. "Nada existe só no
                canvas" é regra do projeto desde a primeira versão, e esta
                tabela é onde ela se cumpre para elas. */}
            <h3>As luas desenhadas</h3>
            <p class="nota">
              Elas não entram no cálculo da gravidade: a posição vem de um modelo de órbita
              aproximado. O desvio de cada uma foi medido contra a efeméride do JPL num intervalo
              de vinte anos, e está na última coluna.
            </p>
            <table class="tabela">
              <thead>
                <tr>
                  <th scope="col">Lua</th>
                  <th scope="col">Orbita</th>
                  <th scope="col">Distância ao planeta</th>
                  <th scope="col">Uma volta leva</th>
                  <th scope="col">Desvio medido</th>
                </tr>
              </thead>
              <tbody>
                {LUAS.map((l) => (
                  <tr key={l.chave}>
                    <th scope="row">{l.nome}</th>
                    <td>{nomeDoPai(l.pai, leituras)}</td>
                    <td>{milhares(l.aKm)} km</td>
                    <td>{numero(360 / l.taxaDaAnomaliaMediaGrausDia, 2)} dias</td>
                    <td>{milhares(l.erroMaximoKm)} km</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ),
      };

    // ── Tutorial ────────────────────────────────────────────────────────────
    case 'tutorial':
      return {
        titulo: 'Bem-vindo',
        corpo: (
          <>
            {TUTORIAL.map((t) => (
              <section key={t.titulo}>
                <h3>{t.titulo}</h3>
                <p>{t.texto}</p>
              </section>
            ))}
            <p class="nota">Esta orientação não aparece de novo. A Ajuda tem tudo isto e mais.</p>
          </>
        ),
      };

    // 'laboratorio' nao chega aqui: `Telas` o intercepta antes, porque ele e
    // lamina e nao caixa. O ramo existe so para o compilador continuar
    // cobrando exaustividade sobre `Tela`.
    case 'laboratorio':
      return { titulo: '', corpo: <p /> };

    default: {
      const _exaustivo: never = tela;
      void _exaustivo;
      return { titulo: '', corpo: <p /> };
    }
  }
}

const nomeDoPai = (pai: string, leituras: readonly LeituraDeCorpo[]): string =>
  leituras.find((l) => l.chave === pai)?.nome ?? pai;

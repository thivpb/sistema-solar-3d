/**
 * O painel, organizado por PERGUNTA em vez de por widget.
 *
 * ## O que estava errado
 *
 * O painel antigo era a barra lateral do programa em 2D com peças novas
 * penduradas: data no topo, lista, ficha, dois botões soltos e uma gaveta
 * chamada "Mais opções" que misturava três assuntos — como a cena é desenhada,
 * como o leitor lê, e para onde ir a seguir. A data ficava a meia tela dos
 * botões de velocidade, que operam o mesmo relógio. "Modo imersivo" e "Comparar
 * corpos" ficavam lado a lado sem terem nada em comum.
 *
 * ## A organização de agora
 *
 * Quatro blocos, cada um respondendo a uma pergunta inteira:
 *
 *   1. **Ponto de vista** — de onde eu vejo (`ControlesDaCamera.tsx`);
 *   2. **Corpos** — qual corpo: filtro de luas, lista, e "Ver como tabela";
 *   3. **a ficha** — o que este corpo é, com as ações dele juntas;
 *   4. **as gavetas** — Mais opções · Leitura · Ir para.
 *
 * Contar blocos é o que `orcamento.spec.ts` faz, e as três gavetas ficam dentro
 * de um invólucro só de propósito: elas são um bloco na tela — uma pilha de
 * títulos fechados — e contá-las como três diria que o painel cresceu quando o
 * que aconteceu foi o contrário.
 *
 * **"Ver como tabela" fica sempre à vista, logo abaixo da lista, e nunca numa
 * gaveta.** Ele é o equivalente em texto do canvas, e `acessibilidade.spec.ts`
 * o aciona direto: enterrá-lo tornaria o caminho de leitor de tela mais longo
 * que o do mouse, que é o contrário do que ele existe para fazer.
 *
 * **"Leitura" é gaveta própria, e não uma seção dentro de "Mais opções".** Texto
 * maior, reduzir animação e dados técnicos são sobre o LEITOR; órbitas, rastros
 * e maquete são sobre a CENA. Estavam no mesmo lugar por acidente de história.
 *
 * **A terceira gaveta chama-se "Ir para", e não "Explorar".** "Explorar" já é o
 * nome de um dos três modos, na barra de cima, e dois controles diferentes com
 * o mesmo nome visível é uma armadilha para todo mundo — quem lê a tela, quem
 * usa leitor de tela, e quem escreve teste. `dicasAlcancaveis.spec.ts` bateu
 * nela primeiro: a busca por teclado acionava o modo achando que abria a
 * gaveta, e as seis dicas ficaram inalcançáveis. As quatro coisas lá dentro
 * são destinos, então o nome diz destino.
 */
import type { JSX } from 'preact';
import { Alternador, Botao, GrupoSegmentado, PainelRecolhivel } from './controles.tsx';
import { ListaDeCorpos, type ItemDeCorpo } from './ListaDeCorpos.tsx';
import { ControlesDaCamera } from './ControlesDaCamera.tsx';
import { Ficha } from './Ficha.tsx';
import { despachar, ui } from '../estado.ts';
import type { LeituraDeCorpo } from '../../contratos/instantaneo.ts';
import type { VisibilidadeDasLuas } from '../../contratos/ids.ts';
import { PainelDeCriacao } from '../sandbox/PainelDeCriacao.tsx';
import { AJUDA_OPCOES, BOTOES, LUAS_NA_TELA, OPCOES } from '../../dados/textos.ts';
import type { Opcao } from '../../app/acoes.ts';

interface Props {
  corpos: readonly ItemDeCorpo[];
  leitura: LeituraDeCorpo | null;
  criados: readonly { chave: string; nome: string }[];
}

const ESTADOS_DAS_LUAS: readonly { valor: VisibilidadeDasLuas; texto: string }[] = [
  { valor: 'com', texto: 'Com' },
  { valor: 'sem', texto: 'Sem' },
  { valor: 'so', texto: 'Só elas' },
];

/** O que APARECE na cena. */
const DO_DESENHO = ['orbitas', 'trilhas', 'rotulos', 'aneisDeDistancia', 'estrelas'] as const;
/** Sobre quem lê, e não sobre a cena. */
const DA_LEITURA = ['textoMaior', 'reduzirAnimacao', 'tecnico'] as const satisfies readonly Opcao[];

export function Lateral({ corpos, leitura, criados }: Props): JSX.Element {
  const e = ui.value;
  const quantasLuas = corpos.filter((c) => c.tipo === 'lua').length;

  return (
    <aside class="lateral" role="complementary" aria-label="Painel de controle">
      <ControlesDaCamera />

      {e.modoDeUso === 'criar' ? <PainelDeCriacao criados={criados} /> : null}

      <section class="painel__bloco" aria-labelledby="titulo-corpos">
        <div class="lateral__cabecalho">
          <h2 class="painel__titulo" id="titulo-corpos">
            Corpos
          </h2>
          <div class="lateral__luas">
            <GrupoSegmentado
              rotulo={`Luas na tela — ${quantasLuas} desenhadas`}
              opcoes={ESTADOS_DAS_LUAS}
              valor={e.luas}
              onEscolher={(v) => despachar({ tipo: 'definir-luas', visibilidade: v })}
            />
          </div>
        </div>
        <p class="lateral__dica">{LUAS_NA_TELA[e.luas]}</p>

        <ListaDeCorpos corpos={corpos} luas={e.luas} />

        <div class="lateral__botoes">
          <Botao onClick={() => despachar({ tipo: 'abrir-tela', tela: 'tabela-de-dados' })}>
            Ver como tabela
          </Botao>
          <Botao onClick={() => despachar({ tipo: 'abrir-tela', tela: 'comparar' })}>
            {BOTOES.comparar}
          </Botao>
        </div>
      </section>

      <Ficha leitura={leitura} criados={criados.map((c) => c.chave)} />

      <div class="lateral__gavetas">
        <PainelRecolhivel
          titulo={BOTOES.maisOpcoes}
          aberto={e.gavetas.cena}
          onAlternar={() => despachar({ tipo: 'alternar-gaveta', gaveta: 'cena' })}
        >
          <h3 class="recolhivel__secao">O que aparece</h3>
          {DO_DESENHO.map((o) => (
            <Alternador
              key={o}
              texto={OPCOES[o]}
              ajuda={AJUDA_OPCOES[o]}
              ligado={e.opcoes[o]}
              onAlternar={() => despachar({ tipo: 'alternar-opcao', opcao: o })}
            />
          ))}

          <h3 class="recolhivel__secao">Em que escala</h3>
          <Alternador
            texto={OPCOES.tamanhoReal}
            ajuda={AJUDA_OPCOES.tamanhoReal}
            ligado={e.opcoes.tamanhoReal}
            onAlternar={() => despachar({ tipo: 'alternar-opcao', opcao: 'tamanhoReal' })}
          />
          {/* A escala visual NAO e uma `Opcao` booleana: ela tem acao propria no
              reducer porque um dia tera mais de dois valores. Daí ficar fora do
              laço acima. */}
          <Alternador
            texto="Modo maquete"
            ajuda={AJUDA_OPCOES.maquete}
            ligado={e.escalaVisual === 'maquete'}
            onAlternar={() =>
              despachar({
                tipo: 'definir-escala-visual',
                escala: e.escalaVisual === 'maquete' ? 'real' : 'maquete',
              })
            }
          />
        </PainelRecolhivel>

        <PainelRecolhivel
          titulo="Leitura"
          aberto={e.gavetas.leitura}
          onAlternar={() => despachar({ tipo: 'alternar-gaveta', gaveta: 'leitura' })}
        >
          {DA_LEITURA.map((o) => (
            <Alternador
              key={o}
              texto={OPCOES[o]}
              ajuda={AJUDA_OPCOES[o]}
              ligado={e.opcoes[o]}
              onAlternar={() => despachar({ tipo: 'alternar-opcao', opcao: o })}
            />
          ))}
        </PainelRecolhivel>

        <PainelRecolhivel
          titulo="Ir para"
          aberto={e.gavetas.destinos}
          onAlternar={() => despachar({ tipo: 'alternar-gaveta', gaveta: 'destinos' })}
        >
          <div class="lateral__botoes">
            <Botao onClick={() => despachar({ tipo: 'abrir-tela', tela: 'atividades' })}>
              {BOTOES.atividades}
            </Botao>
            <Botao onClick={() => despachar({ tipo: 'abrir-tela', tela: 'matematica-do-sol' })}>
              A matemática do Sol
            </Botao>
            <Botao onClick={() => despachar({ tipo: 'abrir-tela', tela: 'laboratorio' })}>
              {BOTOES.laboratorio}
            </Botao>
            <Botao onClick={() => despachar({ tipo: 'voltar-ao-inicio' })}>{BOTOES.inicio}</Botao>
          </div>
        </PainelRecolhivel>
      </div>
    </aside>
  );
}

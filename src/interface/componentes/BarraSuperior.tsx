/**
 * A barra de cima, reorganizada por PERGUNTA.
 *
 * A disciplina herdada continua: "cinco controles visíveis, não vinte", e
 * `orcamento.spec.ts` conta os grupos nomeados e falha se a barra crescer — uma
 * regra fácil de afirmar num README e impossível de manter por boa vontade ao
 * longo de meses.
 *
 * ## O que mudou, e por quê
 *
 * A barra tinha seis grupos e respondia a três perguntas diferentes misturadas:
 * *quando* (pausa, velocidade), *de onde vejo* (enquadramento, focar) e *o que
 * estou fazendo* (explorar, criar, ajuda). Pior: a data por extenso — que é a
 * leitura de tempo mais importante da tela — morava na LATERAL, a meia tela do
 * botão que a fazia andar.
 *
 * Agora a barra responde a duas perguntas e só:
 *
 *   - **quando**, à esquerda: pausa · − velocidade + · a data por extenso;
 *   - **o que estou fazendo**, à direita: Explorar · Criar · Voar · Ajuda.
 *
 * O enquadramento desceu para o painel, junto com as outras perguntas de
 * câmera (`ControlesDaCamera.tsx`). "Focar X" saiu: ele fazia o mesmo que
 * "Acompanhar" na ficha do corpo, e duas portas para a mesma sala custam uma
 * escolha a cada vez.
 *
 * **"Voar" virou a terceira posição do modo**, em vez de um botão perdido na
 * lateral. São as três coisas que se pode estar fazendo, e o estado já se
 * chamava `modoDeUso: 'explorar' | 'criar' | 'voar'` no reducer desde sempre —
 * a tela é que não dizia isso. O botão "Modo imersivo" some do painel; a saída
 * escrita continua dentro do modo, na tira, e o Esc continua saindo.
 *
 * O botão de Ajuda fica SEMPRE no mesmo lugar, à direita. É o critério 3.2.6 da
 * WCAG 2.2: ajuda consistente.
 */
import type { JSX } from 'preact';
import { Botao, GrupoSegmentado } from './controles.tsx';
import { despachar, ui } from '../estado.ts';
import { dataPorExtenso, velocidadePorExtenso } from '../../nucleo/relogio.ts';
import type { DataCivil } from '../../nucleo/relogio.ts';
import type { ModoDeUso } from '../../app/acoes.ts';
import { BOTOES } from '../../dados/textos.ts';

interface Props {
  data: DataCivil;
  noTeto: boolean;
  noPiso: boolean;
}

const MODOS_DE_USO: readonly { valor: ModoDeUso; texto: string }[] = [
  { valor: 'explorar', texto: 'Explorar' },
  { valor: 'criar', texto: 'Criar' },
  { valor: 'voar', texto: 'Voar' },
];

export function BarraSuperior({ data, noTeto, noPiso }: Props): JSX.Element {
  const e = ui.value;

  return (
    <header class="barra" role="banner">
      <div class="barra__grupo barra__grupo--tempo">
        <Botao primario onClick={() => despachar({ tipo: 'alternar-pausa' })}>
          {e.pausado ? BOTOES.continuar : BOTOES.pausar}
        </Botao>
        <Botao
          onClick={() => despachar({ tipo: 'mudar-velocidade', passo: -1 })}
          desabilitado={noPiso}
          rotulo="Diminuir a velocidade do tempo"
        >
          −
        </Botao>
        {/* aria-live off: quem muda a velocidade ja recebe a confirmacao pela
            regiao propria; anunciar aqui tambem duplicaria. */}
        <span class="barra__velocidade" aria-live="off">
          {velocidadePorExtenso(e.diasPorSegundo)}
        </span>
        <Botao
          onClick={() => despachar({ tipo: 'mudar-velocidade', passo: 1 })}
          desabilitado={noTeto}
          rotulo="Aumentar a velocidade do tempo"
        >
          +
        </Botao>
        {/* A data desceu da lateral para cá: ela é a leitura do mesmo relógio
            que os botões ao lado operam, e estar a meia tela deles era herança
            do desenho em 2D, onde o tempo não tinha faixa própria.
            `aria-live` fica de fora: com a simulação correndo ela mudaria a
            cada quadro, e um leitor de tela que anuncia a cada quadro não
            deixa ouvir mais nada. */}
        <p class="barra__data">{dataPorExtenso(data)}</p>
      </div>

      <div class="barra__grupo barra__grupo--direita">
        <GrupoSegmentado
          rotulo="O que você está fazendo"
          opcoes={MODOS_DE_USO}
          valor={e.modoDeUso}
          onEscolher={(modo) => despachar({ tipo: 'trocar-modo-de-uso', modo })}
        />
        {/* Recolher o painel e util em tela estreita, e o controle existia na
            versao anterior. O texto muda com o estado, em vez de so a cor. */}
        <Botao onClick={() => despachar({ tipo: 'alternar-lateral' })} ativo={e.lateralAberta}>
          {e.lateralAberta ? 'Esconder painel' : 'Mostrar painel'}
        </Botao>
        <Botao onClick={() => despachar({ tipo: 'abrir-tela', tela: 'ajuda' })}>{BOTOES.ajuda}</Botao>
      </div>
    </header>
  );
}

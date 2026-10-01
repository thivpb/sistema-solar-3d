/**
 * O modo Criar, em três passos e sem digitar nada.
 *
 * **Nenhum arrasto.** O plano original pedia arrastar o vetor de velocidade
 * com marcadores de `v_circ` e `v_esc`, e mais um diálogo "Criar pelos
 * números" como caminho alternativo, por causa do critério 2.5.7 da WCAG 2.2
 * (Dragging Movements). Aqui o caminho sem arrasto é o **único**, e por isso
 * mesmo é melhor: a velocidade é um controle deslizante, que se opera com as
 * setas do teclado e com um toque, e os dois marcadores continuam lá — a lição
 * sobre velocidade orbital é a mesma, e ninguém precisa de um caminho separado.
 *
 * Os três passos: escolher o tipo pelo **nome escrito**, mirar um ponto na
 * cena com um clique, e aceitar a velocidade sugerida — que nasce em 1, a
 * órbita redonda.
 */
import type { JSX } from 'preact';
import { Botao } from '../componentes/controles.tsx';
import { despachar, ui } from '../estado.ts';
import { RECEITAS } from '../../dados/predefinicoes.ts';
import { SANDBOX } from '../../dados/textos.ts';
import type { Predefinicao } from '../../contratos/sandbox.ts';

const numero = (v: number, casas = 2): string => v.toFixed(casas).replace('.', ',');

interface Props {
  /** Nome e chave de cada corpo criado, para a lista de apagar. */
  criados: readonly { chave: string; nome: string }[];
}

export function PainelDeCriacao({ criados }: Props): JSX.Element {
  const e = ui.value;
  const r = e.rascunho;
  const receita = RECEITAS.find((x) => x.chave === r.predefinicao)!;
  const distanciaUa = r.pos ? Math.hypot(r.pos[0], r.pos[1], r.pos[2]) : null;

  return (
    <section class="criar" aria-label="Criar um corpo">
      <h2 class="lateral__titulo">1. Que tipo de corpo</h2>
      <div class="criar__tipos" role="radiogroup" aria-label="Tipo de corpo">
        {RECEITAS.map((x) => (
          <button
            key={x.chave}
            type="button"
            role="radio"
            aria-checked={x.chave === r.predefinicao}
            class={`criar__tipo${x.chave === r.predefinicao ? ' criar__tipo--ativo' : ''}`}
            onClick={() => despachar({ tipo: 'escolher-predefinicao', predefinicao: x.chave as Predefinicao })}
          >
            <span class="criar__nome">{x.nome}</span>
            <small class="criar__descricao">{x.descricao}</small>
          </button>
        ))}
      </div>

      <h2 class="lateral__titulo">2. Onde</h2>
      {r.pos ? (
        <p class="criar__mira">
          A {numero(distanciaUa!, 3)} UA do Sol. Clique de novo na cena para mudar.
        </p>
      ) : (
        <p class="nota">{SANDBOX.ondeMirar}</p>
      )}

      <h2 class="lateral__titulo">3. Com que velocidade</h2>
      <label class="criar__campo">
        <span>
          <b>{numero(r.fracaoDaCircular)}</b> vez{r.fracaoDaCircular === 1 ? '' : 'es'} a velocidade
          de órbita redonda
        </span>
        <input
          type="range"
          min={0}
          max={1.6}
          step={0.01}
          value={r.fracaoDaCircular}
          aria-describedby="criar-velocidade-ajuda"
          onInput={(ev) =>
            despachar({
              tipo: 'definir-velocidade',
              fracaoDaCircular: Number((ev.currentTarget as HTMLInputElement).value),
            })
          }
        />
        {/* As marcas são o conteúdo, e não enfeite: elas transformam um gesto
            arbitrário numa lição. 1 é a órbita redonda; 1,41 é a velocidade de
            escape, e daí para cima o corpo vai embora e não volta. */}
        <span class="criar__marcas" aria-hidden="true">
          <span>parado</span>
          <span>redonda</span>
          <span>escapa</span>
        </span>
      </label>
      <p id="criar-velocidade-ajuda" class="nota">
        {r.fracaoDaCircular === 0
          ? SANDBOX.velocidadeZero
          : r.fracaoDaCircular < 1
            ? SANDBOX.velocidadeAbaixo
            : r.fracaoDaCircular < Math.SQRT2
              ? SANDBOX.velocidadeAcima
              : SANDBOX.velocidadeDeEscape}
      </p>

      {/* A recusa fica AQUI, ao lado do botão que a provocou, e não num
          diálogo. Um `<dialog>` torna o resto da página inerte: quem criasse
          pelo teclado e fosse recusado ficaria preso na caixa, com o botão da
          saída do lado de fora. */}
      {r.recusa ? (
        <div class="criar__recusa" role="alert">
          <p>{r.recusa.texto}</p>
          {r.recusa.passoCurtoResolve ? (
            <Botao onClick={() => despachar({ tipo: 'usar-passo-curto' })}>
              Usar passo curto
            </Botao>
          ) : null}
        </div>
      ) : null}

      <div class="lateral__botoes">
        <Botao primario onClick={() => despachar({ tipo: 'criar-corpo' })} desabilitado={!r.pos}>
          Criar {receita.nome.toLowerCase()}
        </Botao>
        <Botao onClick={() => despachar({ tipo: 'desfazer' })} desabilitado={!e.podeDesfazer}>
          {e.proximoDesfazer ? `Desfazer ${e.proximoDesfazer}` : 'Desfazer'}
        </Botao>
      </div>

      {criados.length > 0 ? (
        <>
          <h2 class="lateral__titulo">O que você criou</h2>
          <ul class="criar__lista">
            {criados.map((c) => (
              <li key={c.chave}>
                <span>{c.nome}</span>
                <Botao
                  onClick={() => despachar({ tipo: 'apagar-corpo', chave: c.chave })}
                  rotulo={`Apagar ${c.nome}`}
                >
                  Apagar
                </Botao>
              </li>
            ))}
          </ul>
          <div class="lateral__botoes">
            <Botao onClick={() => despachar({ tipo: 'restaurar-sistema' })}>
              Voltar ao Sistema Solar do JPL
            </Botao>
          </div>
        </>
      ) : null}

      <p class="nota">{SANDBOX.semColisoes}</p>
    </section>
  );
}

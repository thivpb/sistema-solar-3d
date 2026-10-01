/**
 * Duas regioes `polite` separadas, e uma `alert`. A separacao nao e zelo.
 *
 * Uma regiao so, recebendo eventos rapidos em sequencia — segurar `]` percorre
 * a escada de velocidade em poucos quadros —, faz o leitor de tela descartar
 * ou embaralhar mensagens. Pior: os avisos passariam a sobrescrever as
 * confirmacoes de selecao, que sao o retorno mais importante.
 *
 *   confirmacao   "Terra selecionado." "Pausado." "B: Marte."
 *   avisos        "Seu computador nao esta acompanhando esta velocidade."
 *   alerta        so o que e urgente E transitorio.
 *
 * "Sistema modificado" NAO entra em `alert`: e um estado permanente, nao um
 * evento. Ele e anunciado uma vez na transicao e depois vive como texto
 * normal, visivel, dentro do visor.
 *
 * A pilha visivel de avisos recebe `aria-hidden`, senao cada aviso seria
 * anunciado duas vezes: uma pela regiao viva, outra pelo texto que apareceu.
 */
import type { JSX } from 'preact';
import { avisos, confirmacao } from '../estado.ts';

export function RegioesVivas(): JSX.Element {
  return (
    <>
      <div class="visualmente-oculto" role="status" aria-live="polite" aria-atomic="true">
        {confirmacao.value}
      </div>
      <div class="visualmente-oculto" role="status" aria-live="polite" aria-atomic="true">
        {avisos.value.map((a) => a.texto).join('. ')}
      </div>
    </>
  );
}

/** A pilha visivel. Muda de cor E traz o texto; nunca so a cor. */
export function PilhaDeAvisos(): JSX.Element | null {
  if (avisos.value.length === 0) return null;
  return (
    <div class="avisos" aria-hidden="true">
      {avisos.value.map((a) => (
        <p key={a.id} class="avisos__item">
          {a.texto}
        </p>
      ))}
    </div>
  );
}

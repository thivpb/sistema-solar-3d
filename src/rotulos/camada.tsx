/**
 * Os rotulos, em DOM sobre o canvas.
 *
 * Duas decisoes que valem explicacao:
 *
 * **A camada inteira e `aria-hidden`.** Ela repete, em forma grafica, o que a
 * lista lateral ja diz em texto navegavel. Anunciar de novo faria o leitor de
 * tela ler dezoito nomes soltos sem contexto a cada mudanca de camera.
 *
 * **So `transform` muda por quadro.** Uma escrita de `transform` toca apenas a
 * camada de composicao do navegador; mexer em `left`/`top` forcaria layout. O
 * texto so e reescrito quando muda de forma — de inteiro para abreviado —, que
 * e raro.
 *
 * Quem escreve esse `transform` a cada quadro e `ancoragem.ts`, por fora do
 * Preact: o estado da interface e publicado a 8 Hz, e uma placa que so se move
 * oito vezes por segundo salta visivelmente enquanto a cena corre a sessenta.
 * Os `data-rotulo` e `data-anel` abaixo existem para ela achar os nos — sao o
 * unico acoplamento, e e por atributo, nao por estrutura.
 */
import type { JSX } from 'preact';
import type { RotuloColocado } from './posicionador.ts';
import { corDoCorpo } from '../dados/cores.ts';
import { paraCss } from '../interface/contraste.ts';

/** O que cada papel escreve na placa. Palavra, e nunca so cor. */
const MARCA: Record<string, string> = { a: 'A', b: 'B', acompanhado: '◎' };

export function CamadaDeRotulos({ rotulos }: { rotulos: readonly RotuloColocado[] }): JSX.Element {
  return (
    <div class="rotulos" aria-hidden="true">
      {/* O anel do corpo acompanhado. TRACEJADO, e nao de outra cor: sobre uma
          cena que vai do preto ao branco, um contorno que so muda de cor
          desaparece na metade dos fundos. O tracejado se enxerga nos dois. */}
      {rotulos
        .filter((r) => r.papel === 'acompanhado')
        .map((r) => {
          const raio = Math.max(r.raioPx + 8, 16);
          return (
            <span
              key={`anel-${r.chave}`}
              class="rotulos__anel"
              data-anel={r.chave}
              data-raio={raio}
              style={{
                transform: `translate(${r.centroX - raio}px, ${r.centroY - raio}px)`,
                width: `${2 * raio}px`,
                height: `${2 * raio}px`,
              }}
            />
          );
        })}
      {rotulos.map((r) =>
        r.forma === 'ponto' ? (
          <span
            key={r.chave}
            class="rotulos__ponto"
            data-rotulo={r.chave}
            style={{
              transform: `translate(${r.x}px, ${r.y}px)`,
              background: paraCss(corDoCorpo(r.chave)),
            }}
          />
        ) : (
          <span
            key={r.chave}
            class={`rotulos__placa${r.ocluido ? ' rotulos__placa--atras' : ''}`}
            data-rotulo={r.chave}
            style={{ transform: `translate(${r.x}px, ${r.y}px)` }}
          >
            {/* A barra colorida carrega a cor; o NOME e sempre `texto`, em
                16:1. Netuno reprovaria como texto, e a regra vale para todos. */}
            <i class="rotulos__barra" style={{ background: paraCss(corDoCorpo(r.chave)) }} />
            {r.texto}
            {/* O distintivo vai ESCRITO dentro da placa, no contraste da placa
                — e nao pintado sobre a cena, onde nada garante 4,5:1. */}
            {r.papel ? <b class={`rotulos__marca rotulos__marca--${r.papel}`}>{MARCA[r.papel]}</b> : null}
          </span>
        ),
      )}
    </div>
  );
}

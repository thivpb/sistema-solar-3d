/**
 * A tira do modo imersivo: o que sobra de interface quando a cena toma a tela.
 *
 * **Recuar nao e desaparecer.** Um modo "sem interface" tem duas armadilhas, e
 * as duas custam mais do que a tela cheia rende:
 *
 *   1. *Sem saida escrita.* Se a unica forma de sair fosse o Esc, o Esc seria a
 *      unica forma de fazer alguma coisa — e a regra do projeto e que nenhum
 *      atalho seja isso. Daí o botao de sair estar aqui, com texto, e ser o
 *      primeiro elemento focavel do modo.
 *   2. *Sem as licencas visuais.* Os corpos estao ampliados, as distancias podem
 *      estar comprimidas, e a exposicao pode estar multiplicada. Essas tres
 *      etiquetas nao sao enfeite de rodape: elas sao o que separa "uma imagem do
 *      Sistema Solar" de "uma imagem que parece o Sistema Solar". Esconde-las no
 *      modo mais bonito seria esconde-las exatamente onde elas mais importam.
 *      `honestidade.test.ts` prende isso.
 *
 * O que sai, sai porque tem substituto: a barra superior e a lateral voltam
 * inteiras com um Esc ou com o botao daqui.
 */
import type { JSX } from 'preact';
import { Botao } from './controles.tsx';
import { despachar, ui } from '../estado.ts';
import { BOTOES, RODAPE } from '../../dados/textos.ts';

interface Props {
  /** UA por segundo com a tecla apertada, já com o turbo fora. Vem do laço. */
  velocidadeUaPorS: number;
  exposicao: number;
}

const numero = (v: number): string =>
  (v >= 100 ? v.toFixed(0) : v >= 1 ? v.toFixed(2) : v.toFixed(4)).replace('.', ',');

export function Imersivo({ velocidadeUaPorS, exposicao }: Props): JSX.Element {
  const e = ui.value;
  return (
    <div class="imersivo">
      <div class="imersivo__saida">
        <Botao onClick={() => despachar({ tipo: 'alternar-imersivo' })} primario>
          {BOTOES.sairDoImersivo}
        </Botao>
      </div>

      <div class="imersivo__tira" role="group" aria-label="Modo imersivo">
        {/* As teclas ficam escritas, e nao numa caixa de ajuda: um modo que
            esconde todos os controles precisa dizer na tela quais restaram.
            São letras dentro de <kbd>, que o leitor de tela anuncia como texto
            e não como símbolo decorativo. */}
        <p class="imersivo__teclas">
          <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> voam · <kbd>Q</kbd> <kbd>E</kbd> descem
          e sobem · <kbd>Shift</kbd> acelera quatro vezes · arraste para olhar em volta ·{' '}
          <kbd>Esc</kbd> sai
        </p>
        <p class="imersivo__velocidade">
          {/* O número muda com o zoom, e isso é o controle de velocidade: quem
              quer voar devagar aproxima. Escrevê-lo transforma um comportamento
              que se sente num comportamento que se entende. */}
          voando a {numero(velocidadeUaPorS)} UA por segundo — aproxime para voar mais devagar
        </p>
      </div>

      {/* As mesmas etiquetas do rodapé normal, e não versões curtas: uma licença
          resumida é uma licença que diz menos do que precisa. */}
      <div class="imersivo__licencas">
        {e.escalaVisual === 'maquete' ? (
          <span class="visor__etiqueta">{RODAPE.comprimido}</span>
        ) : null}
        {exposicao > 1.5 || exposicao < 0.7 ? (
          <span class="visor__etiqueta">
            exposição ×{exposicao < 10 ? exposicao.toFixed(1).replace('.', ',') : exposicao.toFixed(0)}
          </span>
        ) : null}
        {e.opcoes.tamanhoReal ? null : (
          <span class="visor__etiqueta">{RODAPE.ampliado}</span>
        )}
      </div>
    </div>
  );
}

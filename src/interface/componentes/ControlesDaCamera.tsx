/**
 * Onde a câmera está olhando — tudo o que responde "de onde eu vejo".
 *
 * ## Por que isto virou um bloco só
 *
 * As quatro perguntas de câmera estavam em três lugares. O enquadramento era um
 * segmentado na barra de cima; "Vista de cima" e "Alinhar ao plano" flutuavam
 * SOBRE a cena, no canto, sem grupo e sem título; e "chegar perto" só existia
 * como tecla. Nada dizia que as quatro eram a mesma ideia, e a pessoa que
 * quisesse mudar o ponto de vista tinha de procurar em dois lugares e adivinhar
 * um terceiro.
 *
 * O desenho anterior veio do programa em 2D, onde a cena era um círculo chapado
 * e a câmera não era um assunto. Aqui ela é o assunto central.
 *
 * ## Por que os controles saíram de cima da cena
 *
 * Era o pedido, com todas as letras: "menos disruptiva entre marcar as opções e
 * a visualização". Um botão sobre o canvas disputa com o que o canvas está
 * mostrando, e no modo imersivo os três tinham de ser escondidos por uma regra
 * própria de CSS — sinal de que nunca pertenceram ali. Sobre a cena ficam só
 * leituras: a régua, a data técnica, as etiquetas de licença e os avisos.
 *
 * Nada ficou inalcançável: com o painel escondido, o botão que o escondeu está
 * na barra e diz "Mostrar painel". As teclas 1 a 4, V e T continuam valendo e
 * continuam escritas na Ajuda — e nenhuma delas é o único caminho.
 */
import type { JSX } from 'preact';
import { Botao, GrupoSegmentado } from './controles.tsx';
import { despachar, ui } from '../estado.ts';
import type { Modo } from '../../app/acoes.ts';

/* Os nomes ficam POR EXTENSO, embora o painel seja estreito. "Internos"
   sozinho nao diz internos a que, e um leitor de tela anunciaria
   "Enquadramento da camera, Internos" — que e quase uma charada. O segmentado
   quebra em duas linhas quando nao cabe, e isso custa 46 px uma vez. */
const ENQUADRAMENTOS = [
  { valor: 'sistema' as const, texto: 'Sistema completo' },
  { valor: 'internos' as const, texto: 'Planetas internos' },
];

export function ControlesDaCamera(): JSX.Element {
  const e = ui.value;
  // 'acompanhar' e 'perto' não são posições deste segmentado: eles dependem de
  // um corpo e moram na ficha dele. Mostrar um segmentado de quatro em que dois
  // só às vezes funcionam seria prometer o que nem sempre se pode cumprir.
  const enquadramento: Modo = e.modo === 'internos' ? 'internos' : 'sistema';

  return (
    <section class="painel__bloco" aria-labelledby="titulo-camera">
      <h2 class="painel__titulo" id="titulo-camera">
        Ponto de vista
      </h2>

      {/* "Ver de perto" e "Acompanhar" NÃO estão aqui, embora sejam câmera.
          Os dois dependem de um corpo escolhido, e uma ação que depende de um
          corpo mora na ficha DESSE corpo — junto do nome dele, e não num bloco
          que às vezes funciona. Era assim que "Focar planeta" se comportava na
          barra antiga: desabilitado na maior parte do tempo, sem dizer o que
          faltava. */}
      <div class="painel__linha">
        <GrupoSegmentado
          rotulo="Enquadramento da câmera"
          opcoes={ENQUADRAMENTOS}
          valor={enquadramento}
          onEscolher={(modo) => despachar({ tipo: 'trocar-modo', modo })}
        />
      </div>

      <div class="painel__linha">
        <Botao onClick={() => despachar({ tipo: 'alternar-vista' })} ativo={e.vista === 'ortografica'}>
          {e.vista === 'perspectiva' ? 'Vista de cima (V)' : 'Perspectiva (V)'}
        </Botao>
        <Botao onClick={() => despachar({ tipo: 'vista-superior' })}>Alinhar ao plano (T)</Botao>
      </div>
    </section>
  );
}

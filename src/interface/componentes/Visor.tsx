/**
 * A area da cena, e tudo que flutua sobre ela.
 *
 * `role="application"` fica SO no `<canvas>`, que nao tem filhos — o escopo
 * mais estreito possivel. E o que permite as setas chegarem a camera sem tirar
 * o resto da pagina do modo de navegacao do leitor de tela. Pendurar
 * `application` num contorno maior cobraria caro: dentro dele, cada botao
 * deixaria de ser anunciado como botao.
 *
 * **Nada existe so no canvas.** "Ver como tabela" abre a mesma informacao em
 * `<table>`, e a lista lateral e a interface de teclado para escolher corpos.
 * Um canvas, para quem usa leitor de tela, e um retangulo.
 */
import type { JSX } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { Botao } from './controles.tsx';
import { PilhaDeAvisos } from './RegioesVivas.tsx';
import { distancia } from '../formato.ts';
import { despachar, ui } from '../estado.ts';
import { CamadaDeRotulos } from '../../rotulos/camada.tsx';
import type { RotuloColocado } from '../../rotulos/posicionador.ts';
import { RODAPE } from '../../dados/textos.ts';
import { PASSO_PADRAO_DIAS } from '../../nucleo/integrador.ts';
import type { DadosTecnicos } from '../../contratos/instantaneo.ts';

interface Props {
  /** Largura visivel no plano do alvo, em UA. Em perspectiva, "campo de visao" mediria errado. */
  larguraVisivelUa: number;
  distanciaAoAlvoUa: number;
  atrasado: boolean;
  backend: string;
  exposicao: number;
  rotulos: readonly RotuloColocado[];
  /** O passo da física agora, em dias. Ver a prop de mesmo nome em `App.tsx`. */
  passoDias: number;
  tecnicos: DadosTecnicos | null;
  aoMontarCanvas?: (canvas: HTMLCanvasElement) => void;
}

export function Visor({
  larguraVisivelUa,
  distanciaAoAlvoUa,
  atrasado,
  backend,
  exposicao,
  rotulos,
  passoDias,
  tecnicos,
  aoMontarCanvas,
}: Props): JSX.Element {
  const e = ui.value;
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (ref.current && aoMontarCanvas) aoMontarCanvas(ref.current);
  }, [aoMontarCanvas]);

  return (
    <div class="visor">
      <canvas
        ref={ref}
        class="visor__canvas"
        role="application"
        tabIndex={0}
        aria-label="Sistema Solar em três dimensões"
        aria-describedby="visor-instrucoes"
      />
      <CamadaDeRotulos rotulos={rotulos} />

      <p id="visor-instrucoes" class="visualmente-oculto">
        Arraste para girar a câmera, ou use as setas. Segure Shift para deslocar. Use mais e menos
        para aproximar e afastar. A lista de corpos na barra lateral faz o mesmo sem o mouse.
      </p>

      <div class="visor__leitura">
        {/* A régua é SUBSTITUÍDA pelo aviso quando a escala não é linear — e
            não posta ao lado dele. Os dois números são distâncias no espaço
            DESENHADO; com a compressão ligada, "largura visível: 4,2 UA" é
            falso, porque nenhuma das duas pontas está a 4,2 UA de nada. Uma
            régua reta sobre escala comprimida é mentira gráfica, e mostrá-la
            junto com o aviso seria pior que mostrá-la sozinha: pareceria que o
            aviso a qualifica em vez de a invalidar. */}
        {e.escalaVisual === 'maquete' ? (
          <span class="visor__etiqueta">{RODAPE.comprimido}</span>
        ) : (
          <>
            {/* **Estas duas leituras são escritas POR FORA do Preact.**
                Elas mudam a cada movimento de câmera, e o estado da interface
                é publicado a 8 Hz: com o zoom virando o gesto central do
                programa, a régua andava aos saltos de 125 ms enquanto a cena
                corria a sessenta. É o mesmo caminho das placas de rótulo, com
                o mesmo acoplamento por atributo — `principal.ts` acha o nó por
                `data-leitura` e escreve o `textContent`, comparando a string
                antes de escrever.

                A unidade acompanha a grandeza: a 3 raios de Io as duas
                diziam "0,0000 UA", ou seja, a régua marcava zero justamente
                quando alguém estava olhando para ela. Ver `formato.ts`. */}
            <span data-leitura="largura">
              largura visível no plano do alvo: {distancia(larguraVisivelUa)}
            </span>
            <span data-leitura="distancia">câmera a {distancia(distanciaAoAlvoUa)} do alvo</span>
          </>
        )}

        {/* A exposicao e um recurso visual, nao um fato sobre o Sistema Solar:
            aparece escrita sempre que sai de 1, como toda exageracao deste programa. */}
        {exposicao > 1.5 || exposicao < 0.7 ? (
          <span>exposição ×{exposicao < 10 ? exposicao.toFixed(1).replace('.', ',') : exposicao.toFixed(0)}</span>
        ) : null}
      </div>

      {/* O painel tecnico. A ajuda dessa opcao promete passo de integracao,
          energia, desempenho e qual placa desenha — as quatro coisas estao
          aqui, e nao so a ultima.

          O desvio de energia e o numero que sustenta a escolha do integrador:
          num simpletico ele OSCILA em torno de zero e nao cresce. Deixa-lo a
          vista transforma "integrador simplético" de palavra em observacao. */}
      {e.opcoes.tecnico && tecnicos ? (
        <dl class="tecnico" aria-label="Dados técnicos">
          <div>
            <dt>passo</dt>
            <dd>{tecnicos.passoDias.toString().replace('.', ',')} dia</dd>
          </div>
          <div>
            <dt>passos por segundo</dt>
            <dd>{Math.round(tecnicos.passosPorSegundo)}</dd>
          </div>
          <div>
            <dt>quadro</dt>
            <dd>
              {tecnicos.msPorQuadro.toFixed(1).replace('.', ',')} ms de {(1000 / tecnicos.quadrosPorSegundo).toFixed(1).replace('.', ',')}
            </dd>
          </div>
          <div>
            <dt>desvio de energia</dt>
            <dd>{tecnicos.desvioDeEnergia.toExponential(1).replace('.', ',')}</dd>
          </div>
          <div>
            <dt>desvio do momento angular</dt>
            <dd>{tecnicos.desvioDeMomentoAngular.toExponential(1).replace('.', ',')}</dd>
          </div>
          <div>
            <dt>corpos</dt>
            <dd>{tecnicos.corpos}</dd>
          </div>
          <div>
            <dt>desenho</dt>
            <dd>{backend}</dd>
          </div>
        </dl>
      ) : null}

      {/* O passo curto é permanente e muda o que a escada de velocidade
          oferece. Ele fica ao lado do distintivo de sistema modificado, e não
          na régua do rodapé, pelo mesmo motivo: não é uma leitura da cena, é um
          estado do programa. E fica visível SEMPRE que está ligado, e não só
          com os dados técnicos abertos — uma explicação atrás de uma opção
          desligada não explica nada. */}
      {/* **Os três avisos do topo numa faixa só, empilhados.**
          Os três eram `position: absolute` no MESMO ponto — `top: 0.75rem;
          left: 50%; translateX(-50%)` —, com z-index incoerente entre eles.
          Quando dois acendiam juntos, e eles acendem juntos com facilidade
          (passo curto entra sozinho quando o computador não acompanha, e é
          exatamente aí que o aviso de atraso também acende), saíam desenhados
          um por cima do outro: como o fundo tem 0,86 de opacidade, o texto de
          baixo vazava pelo de cima e os dois ficavam ilegíveis.
          Numa coluna, cada um empurra o seguinte para baixo. */}
      <div class="visor__avisosDoTopo">
        {passoDias !== PASSO_PADRAO_DIAS ? (
          <p class="visor__passo" role="status">
            {RODAPE.passoCurto}
          </p>
        ) : null}

        {atrasado ? (
          <p class="visor__alerta" role="alert">
            {RODAPE.atrasado}
          </p>
        ) : null}

        {/* O distintivo fica ACIMA dos botões e não na régua do rodapé: ele não
            é uma leitura, é um estado do programa, e some sozinho quando a
            pessoa volta ao sistema do JPL. O botão de voltar fica junto — um
            aviso sem saída é um beco. */}
        {e.sistemaModificado ? (
          <div class="visor__modificado" role="status">
            <span>{RODAPE.sistemaModificado}</span>
            <Botao onClick={() => despachar({ tipo: 'restaurar-sistema' })}>
              Voltar ao Sistema Solar do JPL
            </Botao>
          </div>
        ) : null}
      </div>

      {/* **Sobre a cena nao ha nada clicavel.**
          Havia tres botoes aqui — vista, alinhar e tabela —, soltos num canto,
          sem grupo e sem titulo, disputando atencao com o que o canvas estava
          mostrando. Que nunca tenham pertencido a este lugar ja estava escrito
          no CSS: o modo imersivo precisava de uma regra propria para escondê-los.
          Os dois primeiros foram para `ControlesDaCamera.tsx`, com as outras
          perguntas de camera; "Ver como tabela" foi para logo abaixo da lista,
          que e onde ele responde a mesma pergunta em texto.
          Sobre a cena ficam so LEITURAS: a regua, a data tecnica, as etiquetas
          de licenca e os avisos. `orcamento.spec.ts` afirma o zero. */}
      <PilhaDeAvisos />
    </div>
  );
}

/**
 * O laboratorio de Fourier: a lamina lateral com a cadeia de epiciclos.
 *
 * **Continua 2D e continua um grafico.** A terceira dimensao nao acrescenta
 * informacao aqui e acrescenta oclusao — e a oclusao esconderia justamente o
 * desvio que se quer medir. O que mudou em relacao a versao anterior e a
 * moldura: em vez de tomar a tela inteira, ele e uma lamina ao lado da cena
 * PAUSADA, e a orbita osculadora em questao continua desenhada la fora, no
 * plano orbital real.
 *
 * **O rotulo "construcao historica" nao e decoracao.** A cadeia de epiciclos
 * descreve a orbita com precisao arbitraria, e e facil sair daqui achando que
 * o programa simula epiciclos. Ele nao simula: a fisica e a integracao de
 * N corpos, e esta lamina e uma releitura da mesma elipse. Sem o aviso escrito,
 * o laboratorio ensinaria o contrario do que pretende.
 *
 * SVG, e nao canvas 2D: a curva sai de um `<path>` declarativo que o Preact
 * reconcilia sozinho, o texto dentro do grafico e texto de verdade para o
 * leitor de tela, e nada aqui precisa de um laco de desenho proprio.
 */
import type { JSX } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { Botao } from '../componentes/controles.tsx';
import { despachar, ui } from '../estado.ts';
import {
  TERMOS_INICIAL,
  TERMOS_MAX,
  cadeiaDeEpiciclos,
  decompor,
  desvio,
  reconstruir,
} from '../../nucleo/fourier.ts';
import type { CurvaDoLaboratorio } from '../../nucleo/efemerides.ts';
import { UA_KM } from '../../nucleo/unidades.ts';
import { LABORATORIO } from '../../dados/textos.ts';

interface Props {
  nome: string;
  curva: CurvaDoLaboratorio | null;
}

/** Pontos por volta na curva reconstruida. 360 ja e liso em qualquer zoom desta lamina. */
const PONTOS = 360;
/** Quantos quadros por volta a animacao dos epiciclos leva. */
const QUADROS_POR_VOLTA = 900;

export function Laboratorio({ nome, curva }: Props): JSX.Element {
  const e = ui.value;
  const [termos, setTermos] = useState(TERMOS_INICIAL);
  const [fase, setFase] = useState(curva?.faseAtual ?? 0);
  const [animando, setAnimando] = useState(!e.opcoes.reduzirAnimacao);
  const secao = useRef<HTMLElement>(null);

  // O foco entra na lamina ao abrir: sem isto, quem usa teclado abriria um
  // painel e continuaria com o foco no botao que ficou atras dele.
  useEffect(() => {
    secao.current?.focus();
  }, []);

  useEffect(() => {
    if (!animando) return;
    let pedido = 0;
    const passo = (): void => {
      setFase((f) => (f + 1 / QUADROS_POR_VOLTA) % 1);
      pedido = requestAnimationFrame(passo);
    };
    pedido = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(pedido);
  }, [animando]);

  const serie = useMemo(() => (curva ? decompor(curva.pontos, TERMOS_MAX) : null), [curva]);

  const erro = useMemo(
    () => (serie && curva ? desvio(serie, curva.pontos, termos) : null),
    [serie, curva, termos],
  );

  const fechar = (): void => despachar({ tipo: 'fechar' });

  if (!curva || !serie) {
    return (
      <aside class="lab" aria-label="Laboratório de Fourier">
        <div class="lab__cabecalho">
          <h2>Laboratório</h2>
          <Botao onClick={fechar}>Fechar</Botao>
        </div>
        <p class="nota">{LABORATORIO.semOrbita}</p>
      </aside>
    );
  }

  // A moldura sai da orbita e NAO muda com o numero de harmonicos: se ela
  // acompanhasse a curva reconstruida, mexer no controle reenquadraria o
  // desenho e a comparacao que o laboratorio existe para mostrar — o quanto
  // falta — sumiria dentro do reenquadramento.
  const raio = curva.aUa * (1 + curva.excentricidade) * 1.18;
  const vista = `${-raio} ${-raio} ${2 * raio} ${2 * raio}`;

  const caminho = (pontos: Float64Array): string => {
    const n = pontos.length / 2;
    let d = '';
    for (let k = 0; k < n; k++) {
      d += `${k === 0 ? 'M' : 'L'}${pontos[2 * k]!.toFixed(6)} ${(-pontos[2 * k + 1]!).toFixed(6)}`;
    }
    return `${d}Z`;
  };

  const aproximada = new Float64Array(2 * PONTOS);
  for (let k = 0; k < PONTOS; k++) {
    const [x, y] = reconstruir(serie, k / PONTOS, termos);
    aproximada[2 * k] = x;
    aproximada[2 * k + 1] = y;
  }

  const { excentrico, elos, ponta } = cadeiaDeEpiciclos(serie, fase, termos);
  const kmDe = (ua: number): string =>
    ua * UA_KM >= 1000
      ? `${Math.round(ua * UA_KM).toLocaleString('pt-BR')} km`
      : `${(ua * UA_KM).toFixed(1).replace('.', ',')} km`;

  // A espessura em unidades de UA, para que o traco tenha a mesma grossura na
  // tela qualquer que seja a orbita enquadrada.
  const traco = raio / 190;

  return (
    <aside class="lab" aria-label={`Laboratório de Fourier: ${nome}`} tabIndex={-1} ref={secao}>
      <div class="lab__cabecalho">
        <h2>{nome} em epiciclos</h2>
        <Botao onClick={fechar}>Fechar</Botao>
      </div>

      <p class="lab__aviso">{LABORATORIO.avisoHistorico}</p>

      <svg
        class="lab__grafico"
        viewBox={vista}
        role="img"
        aria-label={
          `A órbita de ${nome} e a soma de ${termos} ${termos === 1 ? 'epiciclo' : 'epiciclos'}. ` +
          `O desvio máximo entre as duas é de ${kmDe(erro!.maximoUa)}.`
        }
      >
        {/* A orbita de verdade, por baixo: e a referencia contra a qual se le
            tudo o mais. Tracejada, e nao so de outra cor — informacao nunca
            so por cor. */}
        <path
          d={caminho(curva.pontos)}
          fill="none"
          stroke="var(--texto-apagado)"
          stroke-width={traco}
          stroke-dasharray={`${traco * 5} ${traco * 4}`}
        />
        <path d={caminho(aproximada)} fill="none" stroke="var(--acento)" stroke-width={traco * 1.5} />

        {/* Os circulos da cadeia. */}
        {elos.map((elo) => (
          <g key={elo.n}>
            <circle
              cx={elo.centro[0]}
              cy={-elo.centro[1]}
              r={elo.raio}
              fill="none"
              stroke="var(--borda)"
              stroke-width={traco * 0.7}
            />
            <line
              x1={elo.centro[0]}
              y1={-elo.centro[1]}
              x2={elo.ponta[0]}
              y2={-elo.ponta[1]}
              stroke="var(--texto-fraco)"
              stroke-width={traco * 0.7}
            />
          </g>
        ))}

        {/* O foco — onde esta o Sol — e o excentrico, que e de onde a cadeia
            parte. Os dois nao coincidem, e essa distancia E a excentricidade
            vista de outro jeito. */}
        <circle cx={0} cy={0} r={traco * 3} fill="var(--aviso)" />
        <circle
          cx={excentrico[0]}
          cy={-excentrico[1]}
          r={traco * 2}
          fill="none"
          stroke="var(--aviso)"
          stroke-width={traco}
        />
        <circle cx={ponta[0]} cy={-ponta[1]} r={traco * 2.6} fill="var(--acento)" />
      </svg>

      <div class="lab__controles">
        <label class="lab__campo">
          <span>
            Epiciclos: <b>{termos}</b>
          </span>
          <input
            type="range"
            min={1}
            max={TERMOS_MAX}
            step={1}
            value={termos}
            onInput={(ev) => setTermos(Number((ev.currentTarget as HTMLInputElement).value))}
          />
        </label>

        <label class="lab__campo">
          <span>
            Posição na volta: <b>{Math.round(fase * 100)}%</b>
          </span>
          <input
            type="range"
            min={0}
            max={999}
            step={1}
            value={Math.round(fase * 1000)}
            onInput={(ev) => {
              setAnimando(false);
              setFase(Number((ev.currentTarget as HTMLInputElement).value) / 1000);
            }}
          />
        </label>

        <div class="lab__botoes">
          <Botao onClick={() => setAnimando((a) => !a)} ativo={animando}>
            {animando ? 'Parar o movimento' : 'Mover os epiciclos'}
          </Botao>
          <Botao onClick={() => setFase(curva.faseAtual)}>Onde {nome} está</Botao>
        </div>
      </div>

      <dl class="ficha__dados">
        <dt>desvio médio</dt>
        <dd>{kmDe(erro!.medioUa)}</dd>
        <dt>desvio máximo</dt>
        <dd>{kmDe(erro!.maximoUa)}</dd>
        <dt>excentricidade</dt>
        <dd>{curva.excentricidade.toFixed(4).replace('.', ',')}</dd>
        <dt>uma volta leva</dt>
        <dd>{Math.round(curva.periodoDias).toLocaleString('pt-BR')} dias</dd>
      </dl>

      <p class="nota">{LABORATORIO.comoLer}</p>
    </aside>
  );
}

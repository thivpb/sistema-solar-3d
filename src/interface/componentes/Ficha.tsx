/**
 * A ficha de um corpo, curta ou inteira, na lateral — e nunca numa caixa.
 *
 * **O modal de detalhes foi apagado.** Ler sobre um planeta e olhar para ele
 * eram duas coisas que o programa obrigava a fazer em turnos: a caixa cobria a
 * cena, e fechar a caixa apagava o que se tinha acabado de ler. Aqui os dois
 * convivem, e a lateral alarga em vez de sobrepor.
 *
 * Os tres tipos de leitura tem naturezas diferentes e por isso tem blocos
 * diferentes. O Sol nao tem periodo; uma lua nao orbita o Sol e a posicao dela
 * nao vem da integracao, e o desvio disso e um numero que a ficha mostra. Sao
 * ramos do tipo, e nao campos opcionais — a primeira versao do programa tratou
 * isso como campo faltando e produziu uma ficha do Sol dizendo "uma volta leva
 * cerca de 0 dias".
 */
import type { JSX } from 'preact';
import { Botao } from './controles.tsx';
import { despachar, ui } from '../estado.ts';
import type { LeituraDeCorpo } from '../../contratos/instantaneo.ts';
import { PLANETAS, ficha } from '../../dados/fichas.ts';
import { CORPOS_VISUAIS, TEXTURAS } from '../../dados/corposVisuais.ts';
import { BOTOES, ESCALA_FICHA, FONTES, SANDBOX } from '../../dados/textos.ts';
import { LUAS } from '../../dados/luas.ts';

const UA_KM = 149597870.7;

const numero = (v: number, casas = 3): string => v.toFixed(casas).replace('.', ',');
const milhares = (v: number): string =>
  Math.round(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');

function porGrandeza(v: number): string {
  const a = Math.abs(v);
  if (a >= 100) return milhares(v);
  if (a >= 10) return numero(v, 1);
  if (a >= 1) return numero(v, 2);
  return numero(v, 3);
}

function duracao(dias: number): string {
  const d = Math.abs(dias);
  if (d < 2) return `${numero(d * 24, 1)} horas`;
  if (d < 1000) return `${numero(d, 1)} dias`;
  return `${milhares(d)} dias`;
}

interface Props {
  leitura: LeituraDeCorpo | null;
  /** Chaves dos corpos criados: a ficha deles é de outra natureza. */
  criados: readonly string[];
}

/**
 * As três linhas de medida. Sempre à vista; com mais casas quando a ficha abre.
 *
 * `detalhada` não é enfeite: fechada, a ficha é um resumo e "cerca de 10.771
 * dias" basta; aberta, ela é a ficha completa e precisa dar o que a caixa de
 * detalhes dava — o período TAMBÉM em anos, e a distância com as casas que
 * distinguem um instante do seguinte. Perder os anos na travessia seria perder
 * informação junto com a caixa, e a caixa saiu por cobrir a cena, não por ter
 * números demais.
 */
export function FichaCurta({
  leitura,
  detalhada = false,
}: {
  leitura: LeituraDeCorpo;
  detalhada?: boolean;
}): JSX.Element {
  if (leitura.tipo === 'referencial') {
    return (
      <dl class="ficha__dados">
        <dt>distância ao centro de massa</dt>
        <dd>{milhares(leitura.distanciaAoCentroUa * UA_KM)} km</dd>
        <dt>velocidade</dt>
        <dd>{numero(leitura.velocidadeKmS, 3)} km/s</dd>
        <dt>uma volta leva</dt>
        <dd>não há período único</dd>
      </dl>
    );
  }
  if (leitura.tipo === 'lua') {
    return (
      <dl class="ficha__dados">
        <dt>orbita</dt>
        <dd>{leitura.nomeDoPai}</dd>
        <dt>distância ao planeta</dt>
        <dd>{milhares(leitura.distanciaAoPlanetaKm)} km</dd>
        <dt>uma volta leva</dt>
        <dd>{duracao(leitura.periodoDias)}</dd>
      </dl>
    );
  }
  return (
    <dl class="ficha__dados">
      <dt>distância ao Sol</dt>
      <dd>{numero(leitura.distanciaAoSolUa, detalhada ? 4 : 3)} UA</dd>
      <dt>velocidade</dt>
      <dd>{numero(leitura.velocidadeKmS, detalhada ? 2 : 1)} km/s</dd>
      <dt>uma volta leva</dt>
      <dd>
        {!leitura.ligada
          ? 'não está em órbita fechada'
          : detalhada
            ? `${milhares(leitura.periodoDias)} dias (${numero(leitura.periodoDias / 365.25, 2)} anos)`
            : `cerca de ${milhares(leitura.periodoDias)} dias`}
      </dd>
    </dl>
  );
}

export function Ficha({ leitura, criados }: Props): JSX.Element {
  const e = ui.value;
  if (!leitura) {
    return <p class="lateral__vazio">Escolha um corpo na lista para ver os números dele.</p>;
  }

  const criado = criados.includes(leitura.chave);
  const aberta = e.fichaAberta;
  const f = ficha(leitura.chave);
  const dados = PLANETAS[leitura.chave];
  const visual = CORPOS_VISUAIS[leitura.chave];
  const lua = LUAS.find((l) => l.chave === leitura.chave);
  const mapas = TEXTURAS.filter((m) => m.corpo === leitura.chave);

  return (
    <div class={`ficha${aberta ? ' ficha--inteira' : ''}`}>
      <h2 class="ficha__nome">{leitura.nome}</h2>
      {criado ? <p class="nota">{SANDBOX.fichaDeCriado}</p> : f.frase ? <p class="ficha__frase">{f.frase}</p> : null}

      {/* Com a ficha inteira aberta, as tres linhas de medida ganham titulo e
          nota. Elas sao as UNICAS que mudam enquanto o tempo corre, e no meio
          de sete blocos de tabela isso deixa de ser obvio — a caixa antiga
          dizia essa frase, e ela vale mais aqui do que valia la. Fechada, a
          ficha sao tres linhas e um titulo acima delas seria ruido. */}
      {aberta ? (
        <>
          <h3 class="ficha__secao">Medidas agora</h3>
          <p class="nota">
            Estes números saem do cálculo da simulação, não de uma tabela. Eles mudam enquanto o
            tempo corre.
          </p>
        </>
      ) : null}

      <FichaCurta leitura={leitura} detalhada={aberta} />

      {/* As acoes DESTE corpo, juntas e abaixo da ficha dele.
          "Ver de perto" e o mesmo que o duplo clique na cena e que a tecla 4 —
          um gesto de ponteiro, um de teclado e um botao escrito para a mesma
          coisa, que e a regra do projeto: nenhum atalho e a unica forma de
          fazer alguma coisa. */}
      <div class="lateral__botoes">
        <Botao onClick={() => despachar({ tipo: 'alternar-ficha' })} ativo={aberta}>
          {aberta ? BOTOES.fecharFicha : BOTOES.fichaInteira}
        </Botao>
        <Botao onClick={() => despachar({ tipo: 'trocar-modo', modo: 'perto' })}>
          Ver de perto
        </Botao>
        <Botao
          onClick={() =>
            despachar({ tipo: 'acompanhar', chave: e.acompanhado === leitura.chave ? null : leitura.chave })
          }
          ativo={e.acompanhado === leitura.chave}
        >
          {e.acompanhado === leitura.chave ? 'Soltar' : 'Acompanhar'}
        </Botao>
      </div>

      {!aberta ? null : (
        <div class="ficha__inteira">
          {leitura.tipo === 'lua' && lua ? (
            <>
              <h3>Medidas da órbita</h3>
              <dl class="ficha__dados">
                <dt>excentricidade</dt>
                <dd>{numero(lua.excentricidade, 4)}</dd>
                <dt>inclinação</dt>
                {/* O plano de referência vai com uma explicação junto. "Plano
                    de Laplace" é o termo certo e não diz nada para quem chega
                    aqui; nove das treze luas estão nele, então seria jargão na
                    maioria das fichas. */}
                <dd>
                  {numero(lua.inclinacaoGraus, 2)}° sobre{' '}
                  {lua.plano === 'ecliptic'
                    ? 'o plano da órbita da Terra'
                    : lua.plano === 'equatorial'
                      ? 'o equador do planeta'
                      : 'o plano de Laplace — o plano médio em que a órbita se assenta, entre o equador do planeta e o plano da órbita dele'}
                </dd>
                <dt>raio</dt>
                <dd>{milhares(lua.raioMedioKm)} km</dd>
              </dl>
              <h3>O quanto isto erra</h3>
              <p>
                A posição desta lua não vem da integração da gravidade: ela é propagada por um
                modelo de órbita aproximado, com os elementos médios do JPL. O desvio foi medido
                contra a efeméride, num intervalo de vinte anos que o modelo nunca viu ao ser
                construído: <b>{milhares(leitura.desvioMedidoKm)} km</b>, ou{' '}
                {numero((100 * leitura.desvioMedidoKm) / lua.aKm, 1)}% do raio da órbita.
              </p>
              <p class="nota">
                Ele não cresce com o tempo — é um desvio limitado, feito dos empurrões periódicos
                que um modelo de duas massas não tem.
              </p>
            </>
          ) : null}

          {visual ? (
            <>
              <h3>Como ele gira</h3>
              <dl class="ficha__dados">
                <dt>inclinação do eixo</dt>
                <dd>{numero(visual.rotacao.obliquidadeGraus, 2)}°</dd>
                <dt>uma rotação leva</dt>
                <dd>
                  {duracao(360 / visual.rotacao.wPorDia)}
                  {visual.rotacao.wPorDia < 0 ? ', ao contrário dos outros' : ''}
                </dd>
                <dt>achatamento</dt>
                <dd>
                  {visual.achatamento > 0.001
                    ? `${numero(visual.achatamento * 100, 1)}% mais largo que alto`
                    : 'praticamente esférico'}
                </dd>
              </dl>
            </>
          ) : null}

          {dados ? (
            <>
              <h3>Características físicas</h3>
              <dl class="ficha__dados">
                <dt>massa</dt>
                <dd>{porGrandeza(dados.massa1e24kg)} × 10²⁴ kg</dd>
                <dt>gravidade no equador</dt>
                <dd>{numero(dados.gravidade, 1)} m/s²</dd>
                <dt>temperatura</dt>
                <dd>{dados.temperaturaC} °C</dd>
                <dt>luas conhecidas</dt>
                <dd>{dados.luas}</dd>
                <dt>anéis</dt>
                <dd>{dados.aneis ? 'sim' : 'não'}</dd>
              </dl>
              <p class="nota">
                A temperatura é {dados.temperaturaReferencia}. {dados.atmosfera}
              </p>
            </>
          ) : null}

          {criado || !f.curiosidade ? null : (
            <>
              <h3>Curiosidade</h3>
              <p>{f.curiosidade}</p>
            </>
          )}

          {criado || mapas.length === 0 ? null : (
            <>
              <h3>De onde vem a imagem</h3>
              <ul class="procedencia">
                {mapas.map((m) => (
                  <li key={m.papel}>
                    <b>{m.papel}</b>: {rotuloDeProcedencia(m.procedencia)}
                    {m.nota ? ` — ${m.nota}` : ''}
                  </li>
                ))}
              </ul>
            </>
          )}

          <h3>{criado ? 'Sem fontes' : FONTES.titulo}</h3>
          {criado ? (
            <p class="nota">
              Os números acima saem do cálculo, como os de qualquer outro corpo — a física não
              distingue um corpo criado de um medido. O que não existe é fonte: ninguém mediu este
              corpo, porque ele não existe fora daqui.
            </p>
          ) : (
            <p class="nota">
              {dados
                ? 'Massa, gravidade, temperatura, luas e atmosfera vêm da NASA/NSSDCA. '
                : leitura.tipo === 'lua'
                  ? 'Os elementos da órbita vêm da tabela de satélites do JPL, e o período foi medido contra o Horizons. '
                  : ''}
              Os demais números são calculados aqui, a partir da efeméride do JPL.
            </p>
          )}

          <p class="nota">{ESCALA_FICHA.split('\n\n')[0]}</p>
        </div>
      )}
    </div>
  );
}

function rotuloDeProcedencia(p: string): string {
  switch (p) {
    case 'imagem':
      return 'fotografia ou mosaico de imageamento direto';
    case 'derivado':
      return 'dado medido, mas transformado';
    case 'artistico':
      return 'reconstrução — o dado não existe';
    case 'calculado':
      return 'calculado a partir de outros dados';
    default:
      return 'decorativo';
  }
}

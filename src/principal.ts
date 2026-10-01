/**
 * Ponto de entrada, e a unica peca que conhece todas as camadas.
 *
 * Aqui, e so aqui, o nucleo, a cena e a interface se encontram. As regras de
 * camada proibem que eles se enxerguem entre si; alguem tem de monta-los, e e
 * este arquivo.
 *
 * A ordem do quadro e a mesma da versao em pygame:
 *   1. o tempo real decorrido  2. a fisica  3. a camera  4. o desenho
 * As acoes ja foram aplicadas quando aconteceram, porque no DOM os eventos
 * chegam fora do laco e o reducer e sincrono.
 */
import { render, h } from 'preact';
import { App } from './interface/App.tsx';
import { aoEfeito, definirContexto, definirUi, despachar, ui } from './interface/estado.ts';
import { manterServidorDePe } from './app/batida.ts';
import { criarLaco } from './app/laco.ts';
import { dePreferencias, type EstadoUi } from './app/estadoUi.ts';
import { lerPreferencias } from './app/preferencias.ts';
import { ligarPonteiro } from './app/ponteiro.ts';
import { ligarVoo } from './app/voo.ts';
import type { ItemDeCorpo } from './interface/componentes/ListaDeCorpos.tsx';
import { velocidadeDeVooUaPorS, voar } from './cena/camera/voo.ts';
import { pontoNoPlanoDoPivo } from './cena/selecao.ts';
import { carregar } from './dados/carregar.ts';
import {
  curvaDoLaboratorio,
  distanciaAoSolUa,
  elementosOsculadores,
  previsaoDeOrbita,
  velocidadeOrbital,
  type CurvaDoLaboratorio,
} from './nucleo/efemerides.ts';
import { analisarSol } from './nucleo/analiseSol.ts';
import { energia, momentoAngular } from './nucleo/estado.ts';
import { UA_KM, kmPorS, mPorS2, uaParaKm } from './nucleo/unidades.ts';
import { criarRenderizador } from './cena/renderizador.ts';
import { distancia as distanciaEscrita } from './interface/formato.ts';
import { criarSistemaVivo, type Recusa } from './app/sistemaVivo.ts';
import { EPOCA_DAS_LUAS_JD, LUAS } from './dados/luas.ts';
import { posicaoDaLua } from './nucleo/luas.ts';
import { PASSO_CURTO_DIAS } from './nucleo/integrador.ts';
import { RECUSAS } from './dados/textos.ts';
import { criarCena, type Cena } from './cena/cena.ts';
import {
  alturaVisivelUa,
  aproximar,
  aproximarEm,
  direcaoDeVista,
  criarCamera,
  deslocar,
  larguraVisivelUa,
  orbitar,
  posicaoDaCamera,
} from './cena/camera/cameraOrbital.ts';
import { avancarTransicao, iniciarTransicao, type Transicao } from './cena/camera/transicao.ts';
import { enquadrar } from './cena/camera/enquadramento.ts';
import { comprimirPonto, comprimirRaio } from './cena/escala/escalaVisual.ts';
import { ELEVACAO_MAXIMA } from './cena/camera/cameraOrbital.ts';
import type { AnaliseDoSolNaTela, DadosTecnicos, LeituraDeCorpo } from './contratos/instantaneo.ts';
import { abreviar, colocar, type Candidato, type RotuloColocado } from './rotulos/posicionador.ts';
import { tetoDeRotulos } from './cena/escala/foco.ts';
import {
  criarMemoriaDoDesvio,
  escrever as escreverRotulos,
  posicoesSuavizadas,
} from './rotulos/ancoragem.ts';
import { larguraDoTexto, observarMudancasDeFonte } from './rotulos/medida.ts';
import { capturar, nomeDaCaptura } from './cena/captura.ts';
import { dataPorExtenso, dataDaSimulacao } from './nucleo/relogio.ts';
import './interface/base.css';

manterServidorDePe();

const catalogo = carregar();
/**
 * A lista que a interface mostra: os corpos da fisica E as treze luas.
 *
 * As luas entram com `pai`, e e so isso que a lista precisa para se desenhar em
 * dois niveis. Elas nao tem indice no `EstadoSistema` — nunca tiveram, por serem
 * cinematicas —, e por isso tudo que indexa por numero continua sem enxerga-las.
 * Quem resolve a posicao de uma chave, seja de que natureza for, e `posicaoDe`.
 */
function montarLista(): ItemDeCorpo[] {
  const daFisica: ItemDeCorpo[] = catalogo.corpos.map((c) => ({
    chave: c.chave,
    nome: c.nome,
    tipo: 'corpo',
    criado: c.papel === 'teste',
  }));
  const asLuas: ItemDeCorpo[] = LUAS.map((l) => ({
    chave: l.chave,
    nome: l.nome,
    tipo: 'lua',
    pai: l.pai,
  }));
  return [...daFisica, ...asLuas];
}

let corpos = montarLista();

function exigirRaiz(): HTMLElement {
  const el = document.querySelector<HTMLElement>('#raiz');
  if (!el) throw new Error('faltou o elemento #raiz no index.html');
  return el;
}
const raiz = exigirRaiz();

const camera = criarCamera();

/**
 * As teclas de voo, ligadas no DOCUMENTO e nao no canvas.
 *
 * O mesmo motivo do ouvinte de atalhos em `App.tsx`: uma tecla que so funciona
 * com o canvas em foco e uma tecla que quase nunca funciona. Quem decide se ela
 * vale e `ativo`, que le o modo — e `App.tsx` pergunta a `consome` antes de
 * resolver um atalho, para que o `D` do voo nao abra nada.
 */
const voo = ligarVoo(document, { ativo: () => ui.value.modoDeUso === 'voar' });
let transicao: Transicao | null = null;
let cena: Cena | null = null;
let canvas: HTMLCanvasElement | null = null;
let backend = 'iniciando';
let leituras: LeituraDeCorpo[] = [];
let analiseDoSol: AnaliseDoSolNaTela | null = null;
let tecnicos: DadosTecnicos | null = null;

/**
 * A curva do laboratorio, guardada com a chave do que a produziu.
 *
 * Ela so muda quando muda o corpo ou o instante, e o laboratorio abre com a
 * cena PAUSADA — entao na pratica ela e calculada uma vez por abertura. Sem a
 * memoria, cada publicacao a 8 Hz devolveria um objeto novo, e o `useMemo` da
 * lamina refaria a decomposicao de Fourier oito vezes por segundo para chegar
 * exatamente no mesmo resultado.
 */
let curvaDoLab: { chave: string; curva: CurvaDoLaboratorio | null } | null = null;

function laboratorio(): CurvaDoLaboratorio | null {
  const e = ui.value;
  if (e.telaAberta !== 'laboratorio') return null;
  const i = indiceDe(e.selecionado);
  if (i <= 0) return null;
  const chave = `${e.selecionado}@${laco.simulador.estado.tDias}`;
  if (curvaDoLab?.chave !== chave) {
    curvaDoLab = { chave, curva: curvaDoLaboratorio(laco.simulador.estado, i) };
  }
  return curvaDoLab.curva;
}

/**
 * As referencias de conservacao, tiradas UMA vez, no estado de partida.
 *
 * Sao `let` e nao `const` porque o sandbox pode mudar o sistema: criar ou
 * apagar um corpo muda a energia por um degrau que nao e deriva de integracao,
 * e continuar comparando com a referencia velha transformaria o painel num
 * medidor de "quantos corpos voce criou".
 */
let energiaDeReferencia = 0;
let momentoDeReferencia = 0;
/** Media movel do tempo de quadro. Um valor cru pisca a 60 Hz e nao se le. */
let msPorQuadro = 16.7;
let ultimaPublicacao = 0;
let publicacaoAnterior = 0;
let tDiasAnterior = 0;
let dtDeTempoSimulado = 0;
let atrasado = false;
let larguraPx = 800;
let alturaPx = 600;
let rotulos: RotuloColocado[] = [];
/** O desvio suavizado de cada placa em relacao ao corpo dela. Ver `ancoragem.ts`. */
const desvioDosRotulos = criarMemoriaDoDesvio();
const ancorasDoQuadro = new Map<string, { x: number; y: number }>();
let azimuteAnterior = 0;
const memoriaDeDirecao = new Map<string, number>();
observarMudancasDeFonte();

/**
 * Chave -> indice na fisica, e chave -> lua, em tabela.
 *
 * As tres buscas — `indiceDe`, `LUAS.find` e o nome — eram varreduras
 * lineares, e rodavam por CORPO por passada de rotulo: ate tres varreduras de
 * nove e treze elementos vezes vinte e dois corpos, oito vezes por segundo.
 * Nenhuma delas e cara sozinha, e juntas sao trabalho que nao precisa
 * existir: as duas listas so mudam quando o sandbox cria ou apaga um corpo.
 *
 * `sincronizarIndices` e chamada de onde as listas mudam. Esquecer de chama-la
 * daria um indice velho, entao ela e chamada de UM lugar so — o mesmo efeito
 * que ja avisa a cena — e o teste de sandbox, que cria, apaga e desfaz,
 * atravessa esse caminho inteiro.
 */
const LUA_POR_CHAVE = new Map(LUAS.map((l) => [l.chave, l]));

function indicesDosCorpos(): Map<string, number> {
  return new Map(catalogo.corpos.map((c, i) => [c.chave, i]));
}

/**
 * Preenchida AQUI, e nao so quando a lista muda.
 *
 * Nascer vazia e ser preenchida em `publicarMudanca` parecia bastar — a lista
 * so muda pelo sandbox. Mas `publicarMudanca` nao roda na abertura, entao o
 * programa inteiro comecava com `indiceDe` devolvendo −1 para todo mundo: o
 * sujeito da exposicao virava nenhum, o enquadramento perdia o alvo, e as
 * douradas acusaram — `jupiter-e-as-galileanas` saiu com 74% dos pixels
 * diferentes. Um cache que nasce vazio e um cache errado ate a primeira
 * escrita, e aqui a primeira escrita vinha de um gesto que pode nunca
 * acontecer.
 */
let indicePorChave = indicesDosCorpos();

function sincronizarIndices(): void {
  indicePorChave = indicesDosCorpos();
}

const indiceDe = (chave: string | null): number =>
  (chave === null ? undefined : indicePorChave.get(chave)) ?? -1;

/**
 * O retangulo que o painel cobre sobre a cena, em pixels do canvas.
 *
 * **Medido do proprio painel**, e nao de um numero escrito aqui:
 * `--largura-lateral` sao 20rem, e 20rem nao sao 320 px — a raiz deste
 * programa tem 17 px de fonte, e com "Texto maior" tem 21. Escrever 320 erra
 * por vinte pixels no caso comum e por oitenta no caso grande, e um obstaculo
 * menor que o painel e exatamente o defeito que isto conserta: ele entrava
 * como uma tira de 8 px, e os nomes dos corpos da faixa direita eram
 * desenhados ATRAS do painel, gastando uma das dezoito vagas do teto sem que
 * ninguem os visse.
 *
 * Vazio quando ele nao cobre nada: acima do ponto de quebra a lateral fica AO
 * LADO da cena, e o canvas ja vem estreito por causa dela. Quem decide e o
 * `position` calculado pelo navegador — a media query mora no CSS e nao
 * precisa de uma copia aqui.
 */
function retanguloDoPainel(
  larguraPx: number,
  alturaPx: number,
): { x: number; y: number; largura: number; altura: number }[] {
  const painel = document.querySelector('.lateral');
  const canvas = document.querySelector('canvas');
  if (!painel || !canvas) return [];
  if (getComputedStyle(painel).position !== 'absolute') return [];
  const p = painel.getBoundingClientRect();
  const c = canvas.getBoundingClientRect();
  const x = Math.max(0, p.left - c.left);
  const y = Math.max(0, p.top - c.top);
  return [{ x, y, largura: Math.min(p.width, larguraPx - x), altura: Math.min(p.height, alturaPx - y) }];
}

/**
 * Os retangulos que o posicionador de rotulos recebeu no ultimo calculo.
 *
 * Publicado para medicao: o painel entrava nessa lista como uma tira de 8 px
 * em vez dos 320 px que ele de fato cobre quando sobrepoe a cena, e nenhum
 * teste conseguia distinguir os dois pelo resultado — se nenhum corpo calhasse
 * de cair na faixa, as duas versoes desenhavam igual. Medir a ENTRADA do
 * calculo distingue sempre.
 */
let ultimosObstaculos: readonly { x: number; y: number; largura: number; altura: number }[] = [];

const emMaquete = (): boolean => ui.value.escalaVisual === 'maquete';

/**
 * Leva um ponto em UA reais para o espaco DESENHADO.
 *
 * A camera vive no espaco desenhado, e nao no real: o pivo, o enquadramento e
 * o raio dela sao todos coordenadas de tela. Se o pivo ficasse no espaco real
 * enquanto a cena comprime, acompanhar um corpo apontaria a camera para onde o
 * corpo NAO esta — quanto mais longe do Sol, mais errado. E o mesmo tipo de
 * defeito que a origem flutuante existe para evitar, com outra cara.
 */
function paraDesenho(p: [number, number, number]): [number, number, number] {
  return emMaquete() ? comprimirPonto(p, posicaoDoSol()) : p;
}

/** Onde o alvo do enquadramento esta AGORA, lido do mesmo estado que as malhas. */
function dadosDoAlvo(chave: string | null): Parameters<typeof enquadrar>[2] {
  if (chave === null) return null;
  const posicao = posicaoDe(chave);
  if (!posicao) return null;

  const lua = LUA_POR_CHAVE.get(chave);
  if (lua) {
    // Acompanhar uma lua enquadra a orbita DELA em torno do planeta, e nao a
    // do planeta em torno do Sol. A compressao nao entra: o vetor lua-planeta
    // nunca e comprimido, pelo mesmo motivo que "chegar perto" nao e — e uma
    // escala local.
    return {
      posicao: paraDesenho(posicao),
      afelioUa: (lua.aKm / UA_KM) * (1 + lua.excentricidade),
      raioKm: lua.raioMedioKm,
    };
  }

  const i = indiceDe(chave);
  // Nem corpo da fisica nem lua: acontece com um corpo do sandbox apagado
  // enquanto era acompanhado. Sem esta linha, `catalogo.corpos[-1]` e
  // `undefined` e o `!` abaixo transforma um caso previsivel em queda.
  if (i < 0) return null;
  const e = laco.simulador.estado;
  const corpo = catalogo.corpos[i]!;
  const afelio = i === 0 ? null : elementosOsculadores(e, i).afelio;
  const util = afelio !== null && Number.isFinite(afelio) ? afelio : null;
  return {
    posicao: paraDesenho(posicao),
    // O afelio enquadra a orbita inteira, e a orbita desenhada encolheu junto.
    afelioUa: util === null ? null : emMaquete() ? comprimirRaio(util) : util,
    raioKm: corpo.raioKm,
  };
}

/** O Sol e o centro da compressao, entao ele e o mesmo nos dois espacos. */
function posicaoDoSol(): [number, number, number] {
  const e = laco.simulador.estado;
  return [e.pos[0]!, e.pos[1]!, e.pos[2]!];
}

/**
 * O dono das mutacoes.
 *
 * Recebe as MESMAS referencias que o laco e a cena usam — o `EstadoSistema` e
 * a lista de corpos —, e nao copias. E o que faz criar um corpo aparecer na
 * fisica, na lista lateral e na cena sem nenhuma etapa de sincronizacao
 * espalhada: ha um dono, e os outros se corrigem por `sincronizarCorpos`.
 */
const vivo = criarSistemaVivo(catalogo.estado, catalogo.corpos);

/** A interface precisa saber o que mudou; so `principal.ts` tem como contar. */
function publicarMudanca(): void {
  // **Antes de qualquer coisa ler um indice.** `removerCorpo` do nucleo desloca
  // todos os indices seguintes, de proposito, para nao embaralhar a ordem de
  // somatorio das forcas — e quem guarda indice tem de se deslocar junto. Este
  // e o unico lugar por onde a lista muda.
  sincronizarIndices();
  despachar({
    tipo: 'sistema-mudou',
    modificado: vivo.modificado,
    podeDesfazer: vivo.podeDesfazer,
    proximoDesfazer: vivo.proximoDesfazer,
  });
  corpos = montarLista();
  definirContexto({
    chaves: catalogo.corpos.map((c) => c.chave),
    // Getter, e nao valor: o teto muda quando o passo curto entra, e o reducer
    // le `ctx.tetoDiasPorSegundo` no instante em que a acao chega.
    get tetoDiasPorSegundo() {
      return laco.tetoDiasPorSegundo;
    },
    nomeDe: (chave) => nomeDaChave(chave),
  });
  cena?.sincronizarCorpos();
}

/**
 * A órbita que o corpo do rascunho teria, desenhada enquanto ele não existe.
 *
 * Recalculada quando o RASCUNHO muda — mirar, mudar a velocidade, trocar o
 * tipo —, e não por quadro: ela não depende do tempo. A forma fechada custa
 * 240 pontos de seno e cosseno, o que a torna instantânea; nada disso precisa
 * de um worker nem de integração.
 */
function atualizarPrevisao(): void {
  const r = ui.value.rascunho;
  if (!cena) return;
  if (ui.value.modoDeUso !== 'criar' || !r.pos) {
    cena.mostrarPrevisao(new Float64Array(0));
    return;
  }
  const e = laco.simulador.estado;
  cena.mostrarPrevisao(
    previsaoDeOrbita(
      r.pos,
      velocidadeParaOrbita(r.pos, r.fracaoDaCircular),
      [e.pos[0]!, e.pos[1]!, e.pos[2]!],
      [e.vel[0]!, e.vel[1]!, e.vel[2]!],
      e.gm[0]!,
    ),
  );
}

/** O ponto do mundo sob o cursor, no plano do pivô. Nulo em vista rasante. */
function ancoraDoCursor(xCss: number, yCss: number): [number, number, number] | null {
  if (!cena) return null;
  return pontoNoPlanoDoPivo(
    posicaoDaCamera(camera),
    cena.direcaoNaTela(xCss, yCss, larguraPx, alturaPx),
    direcaoDeVista(camera),
    camera.raio,
  );
}

/**
 * Onde um clique na cena cai, em UA.
 *
 * O raio que sai da câmera por aquele pixel é cruzado com o **plano da
 * eclíptica** — o plano em que os oito planetas orbitam, que passa pelo Sol.
 * É o plano que dá sentido a "coloque um corpo ali".
 *
 * **Quando a vista fica rasante, o plano troca.** Com a câmera quase dentro do
 * plano, o raio o encontra a uma distância que explode: um pixel a mais na
 * tela move o ponto por unidades astronômicas, e dois cliques vizinhos dão
 * posições sem relação. Aí o plano passa a ser o da câmera, à distância do
 * alvo — e quem chamou ANUNCIA a troca por escrito.
 */
function ondeOCliqueCai(
  xCss: number,
  yCss: number,
): { pos: [number, number, number]; trocouDePlano: boolean } | null {
  if (!cena) return null;
  const dir = cena.direcaoNaTela(xCss, yCss, larguraPx, alturaPx);
  const olho = posicaoDaCamera(camera);
  const zDoPlano = posicaoDoSol()[2];

  // 0,12 e sen(7 graus). Abaixo disso a interseccao fica a mais de oito vezes
  // a distancia da camera ao plano, e a colocacao deixa de ser controlavel.
  const rasante = Math.abs(dir[2]) < 0.12;
  if (!rasante) {
    const t = (zDoPlano - olho[2]) / dir[2];
    if (t > 0 && Number.isFinite(t)) {
      return { pos: [olho[0] + t * dir[0], olho[1] + t * dir[1], zDoPlano], trocouDePlano: false };
    }
  }

  const d = camera.raio;
  return {
    pos: [olho[0] + d * dir[0], olho[1] + d * dir[1], olho[2] + d * dir[2]],
    trocouDePlano: true,
  };
}

/**
 * A velocidade que um corpo precisa ter naquele ponto, como fração da circular.
 *
 * `v_circ = raiz(mu/r)`, perpendicular ao raio e no plano da eclíptica — a
 * mesma direção em que os oito planetas andam. Uma fração de 1 dá órbita
 * redonda; √2 = 1,414 é a velocidade de escape, e acima disso o corpo vai
 * embora. Os dois números aparecem marcados no controle, e é isso que
 * transforma um gesto que seria arbitrário numa lição sobre velocidade
 * orbital.
 *
 * A velocidade sai SOMADA à do Sol: o referencial do programa é baricêntrico,
 * e um corpo criado com velocidade heliocêntrica pura herdaria, sem querer, o
 * bamboleio do Sol ao contrário.
 */
function velocidadeParaOrbita(
  pos: readonly [number, number, number],
  fracao: number,
): [number, number, number] {
  const e = laco.simulador.estado;
  const dx = pos[0] - e.pos[0]!;
  const dy = pos[1] - e.pos[1]!;
  const dz = pos[2] - e.pos[2]!;
  const r = Math.hypot(dx, dy, dz);
  if (!(r > 0)) return [e.vel[0]!, e.vel[1]!, e.vel[2]!];
  const vCirc = Math.sqrt(e.gm[0]! / r);
  // Perpendicular ao raio, dentro do plano da eclíptica, no sentido em que os
  // planetas andam. Com o corpo exatamente sobre o eixo z não há essa direção;
  // ali qualquer perpendicular serve, e x é tão boa quanto outra.
  const n = Math.hypot(dx, dy);
  const ux = n > 1e-12 ? -dy / n : 1;
  const uy = n > 1e-12 ? dx / n : 0;
  const v = vCirc * fracao;
  return [e.vel[0]! + ux * v, e.vel[1]! + uy * v, e.vel[2]!];
}

/** Traduz um veredito do núcleo para uma frase. */
function porExtenso(r: Recusa): string {
  if (r.tipo === 'lotado') return RECUSAS.lotado(r.maximo);
  if (r.tipo === 'vizinhanca') {
    return RECUSAS.vizinhoPerto(r.nome, r.veredito.distanciaUa, r.veredito.minimaUa);
  }
  const v = r.veredito;
  const temSaida = v.passoSugeridoDias !== null;
  return v.razao === 'periastro-rapido-demais'
    ? RECUSAS.periastroCurto(v.perielioUa, v.passosNoPeriastro, temSaida)
    : RECUSAS.voltaCurta(v.periodoDias, v.passosPorVolta, temSaida);
}

const laco = criarLaco({
  catalogo,
  lerUi: () => ui.value,
  aoQuadro(instantaneo, dtRealS) {
    atrasado = instantaneo.atrasado;
    const estadoUi = ui.value;

    // 3. a camera. O pivo acompanha o corpo LENDO O MESMO instantaneo que as
    //    malhas vao usar — se lesse outra coisa, o erro de acompanhamento que
    //    esta arquitetura elimina voltaria com outra cara.
    const alvo = estadoUi.acompanhado ?? (estadoUi.modo === 'perto' ? estadoUi.selecionado : null);
    const i = indiceDe(alvo);
    const posicaoDoAlvo = alvo ? posicaoDe(alvo) : null;
    if (transicao) {
      // **`dadosDoAlvo`, e nao `i >= 0`.** `indiceDe` procura so em
      // `catalogo.corpos` e devolve −1 para as treze luas; com a condicao pelo
      // indice, voar ate uma lua voava ate o SOL por 0,45 s e so entao saltava
      // para o lugar certo. `dadosDoAlvo` resolve as duas naturezas — e o mesmo
      // `posicaoDe` que o acompanhamento usa quando nao ha transicao.
      const destino = dadosDoAlvo(alvo)?.posicao ?? posicaoDoSol();
      if (avancarTransicao(camera, transicao, destino, dtRealS)) transicao = null;
    } else if (posicaoDoAlvo) {
      // Sem perseguicao: o pivo E a posicao do corpo. Erro exatamente zero.
      // Vale tambem para uma lua, que nao tem indice na fisica: quem resolve a
      // posicao e `posicaoDe`, e ela conhece as duas naturezas.
      camera.pivo = paraDesenho(posicaoDoAlvo);
    }

    // O voo vem DEPOIS do acompanhamento, e nao antes, e a ordem nao e livre: o
    // acompanhamento reescreve o pivo por completo, e um voo aplicado antes dele
    // seria apagado no mesmo quadro. Na pratica os dois nunca coexistem —
    // entrar no modo imersivo solta o corpo acompanhado —, mas a ordem correta e
    // a que continua certa quando alguem juntar os dois.
    //
    // E multiplica por `dtRealS`: a velocidade e em UA por SEGUNDO, entao cada
    // quadro pega a fracao de segundo que passou. Sem isso o voo andaria mais
    // rapido num computador mais rapido, que e o defeito que o passo fixo da
    // fisica existe para nao ter.
    const rumo = voo.rumo();
    if (rumo.frente !== 0 || rumo.direita !== 0 || rumo.cima !== 0) {
      const passo = velocidadeDeVooUaPorS(camera, rumo.turbo) * dtRealS;
      voar(camera, rumo.frente * passo, rumo.direita * passo, rumo.cima * passo);
      // Voar e "quero olhar outra coisa", igual a deslocar: a transicao em curso
      // perde o sentido e seria uma briga entre dois donos do mesmo pivo.
      transicao = null;
    }

    // 4. o desenho
    if (cena) {
      // O sujeito da exposicao e EXATAMENTE o alvo da camera — o mesmo `alvo`
      // que define o pivo acima, e nao "o acompanhado ou o selecionado".
      //
      // A diferenca e visivel: escolher Mercurio na lista, para ler a ficha
      // dele, deixava a camera onde estava, a 31,5 UA, e mandava a exposicao
      // medir a luz a 0,39 UA do Sol. O resultado era fator 0,2 e a visao
      // geral inteira apagada — a lista de corpos escurecia a cena. Selecionar
      // um corpo e um ato de leitura; so aproximar-se dele muda a luz que a
      // camera recebe.
      // O sujeito da exposicao e um indice da FISICA. Acompanhando uma lua, o
      // sujeito e o planeta dela: a luz que chega na lua e a que chega no
      // planeta, com casas decimais de sobra.
      const sujeito = i >= 0 ? i : indiceDe((alvo === null ? undefined : LUA_POR_CHAVE.get(alvo))?.pai ?? null);
      cena.definirEstado(laco.simulador.estado);
      cena.desenhar(
        instantaneo.pos,
        instantaneo.jd,
        camera,
        {
          tamanhoReal: estadoUi.opcoes.tamanhoReal,
          estrelas: estadoUi.opcoes.estrelas,
          orbitas: estadoUi.opcoes.orbitas,
          trilhas: estadoUi.opcoes.trilhas,
          aneisDeDistancia: estadoUi.opcoes.aneisDeDistancia,
          // A cena so precisa saber SE desenha. A diferenca entre "com" e "só
          // elas" e de quem ganha nome e caminho, e isso se decide nos rotulos.
          luas: estadoUi.luas !== 'sem',
          vista: estadoUi.vista,
          maquete: estadoUi.escalaVisual === 'maquete',
          alvoDaCamera: alvo,
        },
        sujeito,
      );
    }

    // Os rotulos sao recalculados a ~30 Hz: a ancoragem acompanha o quadro
    // (o `transform` de cada placa), mas resolver a colocacao sessenta vezes
    // por segundo nao muda nada que se enxergue.
    if (cena && estadoUi.opcoes.rotulos && quadroDeRotulo++ % 2 === 0) {
      rotulos = calcularRotulos(estadoUi);
    } else if (!estadoUi.opcoes.rotulos && rotulos.length > 0) {
      rotulos = [];
      desvioDosRotulos.clear();
    }

    // A ancoragem, POR QUADRO. A colocacao acima decide o lado de cada nome, e
    // isso a 30 Hz basta; onde o corpo esta muda a 60, e e isso que se escreve
    // aqui — direto no `transform` dos nos, por fora do Preact. O estado da
    // interface e publicado a 8 Hz, e por esse caminho as placas andariam aos
    // saltos de 125 ms com a cena correndo a sessenta.
    // A camada some e volta com a opcao "Nomes dos corpos", entao ela e
    // procurada enquanto nao se acha — e nao uma vez so, na abertura.
    if (!camadaDeRotulos?.isConnected) camadaDeRotulos = document.querySelector('.rotulos');
    if (cena && rotulos.length > 0 && camadaDeRotulos) {
      const projecoes = cena.projetar(larguraPx, alturaPx);
      ancorasDoQuadro.clear();
      for (const p of projecoes) if (p.naFrente) ancorasDoQuadro.set(p.chave, { x: p.x, y: p.y });
      escreverRotulos(
        camadaDeRotulos,
        posicoesSuavizadas(rotulos, ancorasDoQuadro, desvioDosRotulos, dtRealS, agoraEmSegundos()),
      );
    }

    escreverAsLeituras();

    // A captura acontece AQUI, logo depois de desenhar e antes de o navegador
    // apresentar: com WebGL2 o conteudo do canvas e descartado na apresentacao,
    // e ler fora do quadro devolveria buffer vazio.
    if (capturaPendente && canvas) {
      capturaPendente = false;
      const data = dataDaSimulacao(catalogo.jdEpoca, laco.simulador.estado.tDias);
      const exageros = [
        !estadoUi.opcoes.tamanhoReal ? 'corpos ampliados' : null,
        estadoUi.escalaVisual === 'maquete' ? 'distâncias comprimidas' : null,
        (cena?.exposicao ?? 1) > 1.5 ? `exposição ×${(cena?.exposicao ?? 1).toFixed(0)}` : null,
      ].filter(Boolean);
      capturar({
        canvas,
        larguraCss: larguraPx,
        alturaCss: alturaPx,
        rotulos,
        rodape: `${dataPorExtenso(data)}${exageros.length ? ' — ' + exageros.join(', ') : ''}`,
        nomeDoArquivo: nomeDaCaptura(new Date()),
      });
    }

    // Acumulados a cada quadro, lidos a cada publicacao: medir passos ou
    // milissegundos no instante da publicacao mediria UM quadro, e um quadro
    // isolado varia demais para caber num numero que alguem le.
    dtDeTempoSimulado += laco.simulador.estado.tDias - tDiasAnterior;
    tDiasAnterior = laco.simulador.estado.tDias;
    msPorQuadro += (dtRealS * 1000 - msPorQuadro) * 0.06;

    const agora = performance.now();
    if (agora - ultimaPublicacao < 125) return;
    ultimaPublicacao = agora;

    const e = laco.simulador.estado;
    const sol = analisarSol(e);

    if (energiaDeReferencia === 0) {
      energiaDeReferencia = energia(e);
      momentoDeReferencia = Math.hypot(...momentoAngular(e));
    }
    const passos = dtDeTempoSimulado > 0 ? dtDeTempoSimulado / laco.simulador.dtDias : 0;
    dtDeTempoSimulado = 0;
    tecnicos = {
      passoDias: laco.simulador.dtDias,
      passosPorSegundo: (passos * 1000) / Math.max(1, agora - publicacaoAnterior),
      quadrosPorSegundo: laco.quadrosPorSegundo,
      msPorQuadro,
      desvioDeEnergia: Math.abs((energia(e) - energiaDeReferencia) / energiaDeReferencia),
      desvioDeMomentoAngular: Math.abs(
        (Math.hypot(...momentoAngular(e)) - momentoDeReferencia) / momentoDeReferencia,
      ),
      corpos: e.n,
      backend,
    };
    publicacaoAnterior = agora;

    // Ordenada aqui, e nao no nucleo: a ordem e uma decisao de apresentacao —
    // "quem puxa mais primeiro" — e o nucleo publica na ordem do catalogo.
    analiseDoSol = {
      distanciaAoCentroKm: uaParaKm(Math.hypot(...sol.posicaoRelativaUa)),
      velocidadeKmS: kmPorS(Math.hypot(...sol.velocidadeRelativaUaD)),
      aceleracaoMS2: mPorS2(Math.hypot(...sol.aceleracaoUaD2)),
      puxoes: sol.parcelas
        .map((parcela) => ({
          nome: catalogo.corpos[parcela.indice]?.nome ?? '?',
          aceleracaoMS2: mPorS2(parcela.modulo),
        }))
        .sort((a, b) => b.aceleracaoMS2 - a.aceleracaoMS2),
    };

    // As luas entram nas leituras com tipo proprio. Elas nao orbitam o Sol, a
    // posicao nao vem da integracao, e o desvio disso e um numero que a ficha
    // precisa mostrar — nada disso cabe numa leitura de planeta.
    const leiturasDasLuas: LeituraDeCorpo[] = LUAS.map((l) => ({
      chave: l.chave,
      nome: l.nome,
      tipo: 'lua',
      pai: l.pai,
      nomeDoPai: nomeDaChave(l.pai),
      distanciaAoPlanetaKm: l.aKm,
      periodoDias: 360 / l.taxaDaAnomaliaMediaGrausDia,
      desvioMedidoKm: l.erroMaximoKm,
    }));

    leituras = catalogo.corpos.map((c, k): LeituraDeCorpo => {
      if (k === 0) {
        return {
          chave: c.chave,
          nome: c.nome,
          tipo: 'referencial',
          distanciaAoCentroUa: Math.hypot(...sol.posicaoRelativaUa),
          velocidadeKmS: kmPorS(Math.hypot(...sol.velocidadeRelativaUaD)),
        };
      }
      const el = elementosOsculadores(e, k);
      return {
        chave: c.chave,
        nome: c.nome,
        tipo: 'orbita',
        distanciaAoSolUa: distanciaAoSolUa(e, k),
        velocidadeKmS: kmPorS(velocidadeOrbital(e, k)),
        periodoDias: el.periodoDias,
        ligada: el.ligada,
      };
    });
    leituras.push(...leiturasDasLuas);
    desenhar();
  },
});

definirContexto({
  chaves: catalogo.corpos.map((c) => c.chave),
  tetoDiasPorSegundo: laco.tetoDiasPorSegundo,
  nomeDe: (chave) => catalogo.corpos.find((c) => c.chave === chave)?.nome ?? chave,
});

aoEfeito((efeito) => {
  laco.aplicarEfeito(efeito);
  switch (efeito.tipo) {
    case 'orbitar-camera':
      orbitar(camera, efeito.azimute, efeito.elevacao);
      transicao = null;
      break;
    case 'deslocar-camera': {
      // O unico lugar que converte fracao em UA, porque e o unico que conhece a
      // altura visivel. Ver o comentario da acao em `app/acoes.ts`.
      const h = alturaVisivelUa(camera);
      deslocar(camera, efeito.fracaoX * h, efeito.fracaoY * h);
      transicao = null;
      break;
    }
    case 'ajustar-zoom': {
      // **A roda CANCELA a transicao.**
      //
      // Era o unico efeito de camera que nao cancelava, e isso deixava a roda
      // morta por meio segundo depois de qualquer enquadramento: `aproximar`
      // escrevia o raio e `avancarTransicao` o sobrescrevia no quadro seguinte,
      // ate o prazo fixo, quando ele saltava para o valor de destino. Com o
      // duplo clique passando a voar ate o corpo, "ir tirando o zoom e ver o
      // resto voltar" e o gesto seguinte mais provavel — e ele nao funcionava.
      transicao = null;

      // **E a ancora do cursor nao vale enquanto se acompanha um corpo.**
      //
      // `aproximarEm` move o PIVO para manter o ponto sob o cursor parado, e o
      // acompanhamento reescreve o pivo no quadro seguinte. Dois donos do mesmo
      // pivo, que e exatamente o que a camera orbital foi desenhada para nao
      // ter. Acompanhando, o zoom e centrado — que e o que a pessoa espera de
      // um corpo que ela mandou a camera seguir.
      const acompanhando = ui.value.acompanhado !== null;
      const ancora =
        efeito.ancora && !acompanhando ? ancoraDoCursor(efeito.ancora[0], efeito.ancora[1]) : null;
      if (ancora) aproximarEm(camera, efeito.fator, ancora);
      else aproximar(camera, efeito.fator);
      break;
    }
    case 'tela-cheia': {
      // `requestFullscreen` devolve uma promessa que REJEITA quando o navegador
      // recusa — sem gesto da pessoa, dentro de um iframe, ou com a politica de
      // permissao fechada. Uma rejeicao nao tratada aparece no console como erro
      // do programa, e o modo imersivo funciona sem a tela cheia: os controles
      // recuam e o voo voa de qualquer jeito. Entao a recusa vira um aviso
      // escrito, e nao uma falha.
      const raizDoDocumento = document.documentElement;
      if (efeito.querer) {
        if (!document.fullscreenElement) {
          raizDoDocumento.requestFullscreen?.().then(
            () => despachar({ tipo: 'avisar', texto: '' }),
            () =>
              despachar({
                tipo: 'avisar',
                texto:
                  'O navegador não deu a tela cheia. O modo imersivo continua valendo: os controles recuaram e as teclas de voo funcionam.',
              }),
          );
        }
      } else if (document.fullscreenElement) {
        void document.exitFullscreen?.();
      }
      // Soltar as teclas nas duas direcoes. A troca de tela cheia rouba o foco
      // por um instante, e um `keyup` perdido nesse instante deixaria a camera
      // voando sozinha.
      voo.soltar();
      break;
    }

    case 'vista-superior':
      // Alinhar com a ecliptica e uma transicao como outra qualquer: saltar
      // para a vista de cima desorienta.
      transicao = iniciarTransicao(camera.raio, camera.azimute, ELEVACAO_MAXIMA);
      break;
    case 'enquadrar': {
      const destino = enquadrar(efeito.modo, posicaoDoSol(), dadosDoAlvo(efeito.alvo), emMaquete());
      transicao = iniciarTransicao(destino.raio, camera.azimute, camera.elevacao);
      break;
    }
    case 'capturar-tela':
      capturaPendente = true;
      break;
    case 'reiniciar-fisica':
      cena?.limparTrilhas();
      // O meridiano desenhado tambem volta ao inicio: o teto de giro acumula
      // um atraso enquanto alguem olha um corpo de perto, e "Voltar ao inicio"
      // promete devolver o programa ao estado de partida inteiro.
      cena?.zerarGiro();
      camera.pivo = [0, 0, 0];
      transicao = iniciarTransicao(31.5, -Math.PI / 2, 0.45);
      break;

    // -- sandbox ------------------------------------------------------------
    case 'criar-corpo': {
      const e = laco.simulador.estado;
      const pos = efeito.pos;
      const resultado = vivo.criar({
        predefinicao: efeito.predefinicao,
        pos,
        vel: velocidadeParaOrbita(pos, efeito.fracaoDaCircular),
        dtDias: laco.simulador.dtDias,
        diaSimulado: e.tDias,
      });
      if (!resultado.ok) {
        despachar({
          tipo: 'recusar-criacao',
          texto: porExtenso(resultado.recusa),
          passoCurtoResolve:
            resultado.recusa.tipo === 'periastro' &&
            resultado.recusa.veredito.passoSugeridoDias !== null &&
            laco.simulador.dtDias !== PASSO_CURTO_DIAS,
        });
        break;
      }
      publicarMudanca();
      despachar({ tipo: 'mirar-colocacao', pos: null });
      despachar({ tipo: 'selecionar', chave: resultado.chave });
      break;
    }

    case 'apagar-corpo':
      if (vivo.apagar(efeito.chave)) publicarMudanca();
      break;

    case 'desfazer': {
      const o = vivo.desfazer();
      publicarMudanca();
      if (o) despachar({ tipo: 'avisar', texto: `Desfeito: ${o}.` });
      break;
    }

    case 'restaurar-sistema':
      vivo.restaurar();
      cena?.limparTrilhas();
      publicarMudanca();
      despachar({ tipo: 'avisar', texto: 'De volta ao Sistema Solar da efeméride do JPL.' });
      break;

    case 'usar-passo-curto':
      laco.simulador.dtDias = PASSO_CURTO_DIAS;
      break;
    default:
      break;
  }
});

let quadroDeRotulo = 0;
/** A camada de rotulos no DOM. Achada uma vez; some e volta com a opcao. */
let camadaDeRotulos: HTMLElement | null = null;
const agoraEmSegundos = (): number => performance.now() / 1000;
/** Uma captura pedida, a ser atendida no FIM do proximo quadro desenhado. */
let capturaPendente = false;

/**
 * Monta os candidatos e chama o posicionador.
 *
 * A prioridade e a mesma da versao anterior, com um termo novo que so existe
 * em 3D: quando dois corpos disputam o mesmo espaco, ganha o MAIS PROXIMO da
 * camera. Em ortografica nao havia essa pergunta.
 */
/**
 * Onde qualquer coisa desenhada esta, em UA. Corpo da fisica ou lua.
 *
 * As luas nao tem indice no estado fisico — elas sao cinematicas —, entao
 * `indiceDe` devolve −1 para elas e tudo que indexa por numero as perde. Esta
 * funcao e o ponto unico onde as duas naturezas se encontram, e e por ela que
 * acompanhar uma lua passa a funcionar como acompanhar um planeta.
 */
const deslocamentoDaLua: [number, number, number] = [0, 0, 0];

function posicaoDe(chave: string | null): [number, number, number] | null {
  if (!chave) return null;
  const e = laco.simulador.estado;
  const i = indiceDe(chave);
  if (i >= 0) return [e.pos[3 * i]!, e.pos[3 * i + 1]!, e.pos[3 * i + 2]!];

  const lua = LUA_POR_CHAVE.get(chave);
  if (!lua) return null;
  const iPai = indiceDe(lua.pai);
  if (iPai < 0) return null;
  posicaoDaLua(lua, lua.base, catalogo.jdEpoca + e.tDias - EPOCA_DAS_LUAS_JD, deslocamentoDaLua);
  return [
    e.pos[3 * iPai]! + deslocamentoDaLua[0],
    e.pos[3 * iPai + 1]! + deslocamentoDaLua[1],
    e.pos[3 * iPai + 2]! + deslocamentoDaLua[2],
  ];
}

/** O nome de qualquer coisa desenhada: corpo da fisica, lua ou corpo criado. */
function nomeDaChave(chave: string): string {
  const i = indicePorChave.get(chave);
  return (
    (i === undefined ? undefined : catalogo.corpos[i]?.nome) ??
    LUA_POR_CHAVE.get(chave)?.nome ??
    chave
  );
}

/**
 * As duas reguas embaixo da cena, escritas por fora do Preact.
 *
 * ## O terceiro nivel que `interface/estado.ts` prometia
 *
 * O cabecalho daquele arquivo descreve tres frequencias — 60 Hz para a cena e
 * o `transform` dos rotulos, 8 Hz para "os numeros do HUD, por `textContent`,
 * com o valor arredondado ANTES de virar string e a string comparada com a
 * anterior", e evento para o resto. O nivel do meio nunca existiu: nao havia
 * **nenhum** `textContent` em `src/`, e esses numeros iam na arvore Preact
 * inteira, republicada a 8 Hz.
 *
 * Isso era invisivel enquanto chegar perto nao era um gesto do programa. Com o
 * duplo clique levando a camera ao corpo, a regua passou a mudar a cada quadro
 * de uma aproximacao — e andava aos saltos de 125 ms enquanto a cena corria a
 * sessenta.
 *
 * O acoplamento e por atributo, `data-leitura`, como o das placas de rotulo, e
 * nao por estrutura. Os nos podem nao existir: em "Modo maquete" as duas
 * reguas sao SUBSTITUIDAS por um aviso, porque uma regua reta sobre escala
 * comprimida seria mentira grafica.
 */
const LEITURAS = { largura: '', distancia: '' };
let nosDasLeituras: { largura: HTMLElement | null; distancia: HTMLElement | null } | null = null;

function escreverAsLeituras(): void {
  if (!nosDasLeituras?.largura?.isConnected && !nosDasLeituras?.distancia?.isConnected) {
    nosDasLeituras = {
      largura: document.querySelector('[data-leitura="largura"]'),
      distancia: document.querySelector('[data-leitura="distancia"]'),
    };
  }
  const larguraUa = larguraVisivelUa(camera, larguraPx / Math.max(1, alturaPx));
  const textos = {
    largura: `largura visível no plano do alvo: ${distanciaEscrita(larguraUa)}`,
    distancia: `câmera a ${distanciaEscrita(camera.raio)} do alvo`,
  };
  for (const qual of ['largura', 'distancia'] as const) {
    // A string e comparada antes de escrever: `textContent` invalida o layout
    // do no, e escrever o mesmo texto sessenta vezes por segundo pagaria esse
    // custo para nao mudar nada na tela.
    if (LEITURAS[qual] === textos[qual]) continue;
    LEITURAS[qual] = textos[qual];
    const no = nosDasLeituras?.[qual];
    if (no?.isConnected) no.textContent = textos[qual];
  }
}

function calcularRotulos(estadoUi: EstadoUi): RotuloColocado[] {
  if (!cena) return [];
  const projecoes = cena.projetar(larguraPx, alturaPx);

  const candidatos: Candidato[] = [];
  for (let i = 0; i < projecoes.length; i++) {
    const p = projecoes[i]!;
    if (!p.naFrente) continue;
    // Por CHAVE, e nunca por indice. A cena guarda os corpos da fisica e
    // depois as treze luas na mesma lista; `catalogo.corpos[i]` para um indice
    // de lua devolvia `undefined` e o rotulo saia como a chave, em minuscula.
    // Pior: depois de criar um corpo no sandbox, `catalogo.corpos` cresce, e
    // aquele mesmo indice passa a devolver o nome de OUTRO corpo — a lua sairia
    // rotulada com o nome do asteroide que alguem acabou de criar.
    const nome = nomeDaChave(p.chave);
    const ehLua = LUAS.some((l) => l.chave === p.chave);
    const ehAcompanhado = estadoUi.acompanhado === p.chave;
    const ehA = estadoUi.selecionado === p.chave;
    const ehB = estadoUi.comparando === p.chave;
    candidatos.push({
      chave: p.chave,
      nome,
      abreviacao: abreviar(nome),
      x: p.x,
      y: p.y,
      raioPx: p.raioPx,
      prioridade:
        (ehAcompanhado ? 1000 : 0) +
        (ehA ? 500 : 0) +
        (ehB ? 250 : 0) +
        // "Só as luas" nao apaga os planetas da cena: ele troca a ordem de quem
        // ganha nome. O teto de rotulos e 18, e sao 13 luas — entao as luas
        // visiveis ficam todas nomeadas e os planetas disputam o que sobra, em
        // vez de o contrario. Um bonus, e nao um filtro: filtrar deixaria um
        // planeta com quatro luas nomeadas em volta e nenhum nome no meio.
        (estadoUi.luas === 'so' && ehLua ? 400 : 0) +
        // Mais proximo ganha, e entre iguais ganha o maior na tela.
        100 / Math.max(p.distanciaUa, 1e-6) +
        p.raioPx,
      ocluido: p.ocluido,
      nuncaAbreviar: ehA || ehAcompanhado,
      // O acompanhado ganha o anel; entre A e B, A vem primeiro. Um corpo que
      // e as duas coisas mostra o anel, que e o estado mais forte.
      papel: ehAcompanhado ? 'acompanhado' : ehA ? 'a' : ehB ? 'b' : null,
    });
  }

  const obstaculos = retanguloDoPainel(larguraPx, alturaPx);

  ultimosObstaculos = obstaculos;

  const girandoRapido = Math.abs(camera.azimute - azimuteAnterior) > 0.01;
  azimuteAnterior = camera.azimute;

  return colocar(candidatos, {
    larguraTela: larguraPx,
    alturaTela: alturaPx,
    alturaDoTexto: 14,
    obstaculos,
    medir: (t) => larguraDoTexto(t, 13),
    memoria: memoriaDeDirecao,
    camaraGirandoRapido: girandoRapido,
    // **O foco AFINA a multidao; nao apaga o texto.**
    //
    // Baixar a opacidade das placas deixaria texto legivel abaixo de 4,5:1, e a
    // pessoa pode parar a roda em qualquer lugar — nao ha defesa de "e so uma
    // transicao". Descer o teto usa a prioridade que ja existe: o corpo
    // acompanhado vale +1000 e e o ultimo nome a sair da tela.
    teto: tetoDeRotulos(cena.foco, 18),
  });
}

function dimensionar(): void {
  if (!canvas || !cena) return;
  // Le o tamanho em pixels CSS e passa adiante. Nao se escreve `canvas.width`
  // aqui: quem faz isso e o `setSize` do renderizador, que cria os dois
  // buffers — cor e profundidade — com o mesmo tamanho.
  larguraPx = Math.max(1, canvas.clientWidth);
  alturaPx = Math.max(1, canvas.clientHeight);
  cena.redimensionar(larguraPx, alturaPx);
}

async function montarCena(c: HTMLCanvasElement): Promise<void> {
  if (canvas === c) return;
  canvas = c;
  const { renderizador, backend: qual, motivoDaQueda } = await criarRenderizador(c);
  // Pixels CSS, com teto de 2: sem isso os planetas sairiam com metade do
  // tamanho num Retina, porque o piso em pixels foi herdado de um codigo que
  // nao conhecia devicePixelRatio.
  renderizador.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  backend = motivoDaQueda ? `${qual} (${motivoDaQueda})` : qual;
  // Os periodos alimentam o intervalo de amostragem de cada rastro: 0,25% do
  // periodo do proprio corpo, para Mercurio nao virar borrao e Netuno tracinho.
  const periodos = catalogo.corpos.map((_, i) =>
    i === 0 ? null : elementosOsculadores(catalogo.estado, i).periodoDias,
  );
  // A lista VIVA, e nao uma copia: o sandbox empurra e tira corpos dela, e a
  // cena precisa ver isso. Uma copia tornaria `sincronizarCorpos` uma funcao
  // que compara um retrato antigo consigo mesmo.
  cena = criarCena(renderizador, catalogo.corpos, periodos);
  dimensionar();
  new ResizeObserver(dimensionar).observe(c);
  ligarPonteiro(c, {
    despachar,
    alturaPx: () => alturaPx,
    aoClicar: (x, y, duplo) => {
      if (ui.value.modoDeUso !== 'criar') {
        // Em Explorar, clicar na cena escolhe o corpo. Um duplo clique vai
        // alem e acompanha — o mesmo que a tecla 3, e o gesto que quase todo
        // programa de mapa usa para "me leve ate ali".
        const chave = cena?.corpoEm(x, y, larguraPx, alturaPx) ?? null;
        if (!chave) return;
        despachar({ tipo: 'selecionar', chave });
        // **Duplo clique ENQUADRA o corpo, e nao a orbita dele.**
        //
        // Era `'acompanhar'`, que enquadra o afelio vezes 1,25 — a elipse
        // inteira. Ver a textura, o terminador e as sombras do anel exigia
        // chegar perto, e nada no programa levava ate la: o gesto que todo mapa
        // usa para "me leve ali" parava a uma unidade astronomica do destino.
        //
        // `'perto'` e `3R`, e a conta fecha: com 45° de campo, a altura visivel
        // e `2 x 3R x tan(22,5°) = 2,485R` contra um diametro de `2R` — o corpo
        // ocupa 80% da altura da tela. Cheio, sem cortar.
        //
        // `aoClicar` dispara DUAS vezes num duplo clique, a primeira com
        // `duplo` falso. Isso e de proposito (ver `ponteiro.ts`) e aqui nao
        // atrapalha: selecionar e idempotente, e quando o voo comeca a ficha do
        // corpo ja esta aberta.
        if (duplo) despachar({ tipo: 'trocar-modo', modo: 'perto' });
        return;
      }
      const alvo = ondeOCliqueCai(x, y);
      if (!alvo) return;
      despachar({ tipo: 'mirar-colocacao', pos: alvo.pos });
      if (alvo.trocouDePlano) {
        // A troca de plano e ANUNCIADA. Mudar em silencio o significado de um
        // gesto e o tipo de coisa que este projeto nao faz: a pessoa apontou
        // para um lugar e o corpo apareceria noutro, sem explicacao.
        despachar({
          tipo: 'avisar',
          texto:
            'A câmera está quase de lado em relação ao plano dos planetas, e ali um ponto na ' +
            'tela não decide uma posição nesse plano. O corpo foi colocado no plano da câmera, ' +
            'à distância do alvo. Use T para alinhar com o plano dos planetas.',
        });
      }
    },
  });
  desenhar();
}

function desenhar(): void {
  // A previsao acompanha o rascunho, e `desenhar` roda a cada despacho e a
  // cada publicacao — que e exatamente quando o rascunho pode ter mudado.
  // Pendurar em efeitos especificos exigiria lembrar de acrescentar cada acao
  // nova a lista, e esquecer uma deixaria a linha velha na tela.
  atualizarPrevisao();
  render(
    h(App, {
      corpos,
      leituras,
      sol: analiseDoSol,
      tecnicos,
      curvaDoLaboratorio: laboratorio(),
      criados: vivo.criados.map((c) => ({ chave: c.chave, nome: c.nome })),
      jd: catalogo.jdEpoca + laco.simulador.estado.tDias,
      tDias: laco.simulador.estado.tDias,
      atrasado,
      tetoDiasPorSegundo: laco.tetoDiasPorSegundo,
      passoDias: laco.simulador.dtDias,
      larguraVisivelUa: larguraVisivelUa(camera, larguraPx / Math.max(1, alturaPx)),
      exposicao: cena?.exposicao ?? 1,
      rotulos,
      distanciaAoAlvoUa: camera.raio,
      // Sem o turbo: o numero escrito e o da tecla sozinha, e a tira diz que
      // Shift multiplica por quatro. Escrever o valor do turbo quando o Shift
      // esta apertado faria o numero saltar toda vez que se acelerasse.
      velocidadeDeVooUaPorS: velocidadeDeVooUaPorS(camera, false),
      backend,
      aoMontarCanvas: (c: HTMLCanvasElement) => {
        void montarCena(c);
      },
    }),
    raiz,
  );
}

/**
 * Sair da tela cheia pelo caminho do NAVEGADOR tambem sai do modo.
 *
 * O Esc e o F11 do navegador nao passam pelo nosso reducer: eles devolvem a
 * janela e vao embora. Sem este ouvinte, a pessoa veria a janela voltar ao normal
 * e continuaria no modo imersivo — sem barra, sem lateral, com o WASD ligado e
 * com um Esc que agora fecharia o modo de verdade. Dois Escs para uma saida, e o
 * primeiro parecendo ter funcionado pela metade.
 *
 * `trocar-modo-de-uso` e nao `alternar-imersivo`: alternar entraria de novo se
 * o evento chegasse fora de hora. A intencao aqui e "vai para explorar", nao
 * "troca o que estiver valendo".
 */
document.addEventListener('fullscreenchange', () => {
  if (!document.fullscreenElement && ui.value.modoDeUso === 'voar') {
    despachar({ tipo: 'trocar-modo-de-uso', modo: 'explorar' });
  }
});

void (async () => {
  definirUi(dePreferencias(await lerPreferencias()));
  // A orientacao aparece UMA vez, na primeira abertura, e `tutorialVisto` vai
  // para o arquivo de preferencias — inclusive quando a pessoa fecha no Esc
  // sem ler. Reabrir a mesma caixa para quem ja disse que nao quer e a forma
  // mais rapida de ensinar alguem a fechar caixas sem ler.
  if (!ui.value.tutorialVisto) despachar({ tipo: 'abrir-tela', tela: 'tutorial' });
  desenhar();
  laco.iniciar();
})();

// Usada so pelo teste de precisao, para posicionar a camera sem depender de
// arrastar o mouse por nove ordens de grandeza.
declare global {
  interface Window {
    __camera?: typeof camera;
    __posicaoDaCamera?: () => [number, number, number];
    __mostrarCascas?: (ligado: boolean) => void;
    __fatias?: () => number;
    __backend?: () => string;
    __grafo?: () => unknown;
    __anel?: () => unknown;
    __anelOpaco?: () => string;
    __larguraDoMapaDaSombra?: () => number;
    __ladoIluminado?: (deslocamento?: number) => void;
    __assentou?: () => boolean;
    __raioAparente?: (chave: string) => number;
    __foco?: () => number;
    __obstaculosDosRotulos?: () => { x: number; y: number; largura: number; altura: number }[];
    __fita?: (chave: string) => unknown;
    __orientacaoDe?: (chave: string) => [number, number, number, number] | null;
  }
}
window.__camera = camera;
window.__posicaoDaCamera = () => posicaoDaCamera(camera);
window.__mostrarCascas = (ligado) => cena?.mostrarCascas(ligado);
window.__fatias = () => cena?.fatiasNoUltimoQuadro ?? 0;
// **`assentou` inclui a camera.** `cena.assentou` so conhece texturas e
// exposicao; uma camera ainda suavizando e movimento que `precisao.spec.ts`
// (quadros bit a bit identicos) e `douradas.spec.ts` nao esperam.
window.__assentou = () => (cena?.assentou ?? false) && transicao === null;
window.__raioAparente = (chave: string) => {
  const c = cena?.corpos.find((x) => x.chave === chave);
  if (!c) return 0;
  return c.montado.malha.scale.x / Math.max(c.montado.grupo.position.length(), 1e-12);
};
// O foco do quadro e o estado das linhas: e o que `e2e/foco.spec.ts` mede.
// Sao leituras — nenhuma das duas muda a cena, entao medir nao altera o que
// esta sendo medido.
/**
 * A orientacao DESENHADA de um corpo, como quaternion.
 *
 * Desenhada, e nao a da IAU: e justamente a diferenca entre as duas que o teto
 * de giro cria, e perguntar a `orientacaoDoCorpo` mediria o programa de antes.
 * Ver `cena/corpos/giroVisivel.ts` e `e2e/giro.spec.ts`.
 */
window.__orientacaoDe = (chave: string) => {
  const c = cena?.corpos.find((x) => x.chave === chave);
  if (!c) return null;
  const q = c.montado.malha.quaternion;
  return [q.x, q.y, q.z, q.w] as [number, number, number, number];
};

window.__obstaculosDosRotulos = () => ultimosObstaculos.map((o) => ({ ...o }));

window.__foco = () => cena?.foco ?? 0;
window.__fita = (chave: string) => cena?.estadoDaFita(chave) ?? null;

window.__backend = () => backend;

/** Onde cada corpo caiu na tela, com o raio aparente. Para o teste de escolha. */
window.__projecoes = () => cena?.projetar(larguraPx, alturaPx) ?? [];
window.__corpoEm = (x: number, y: number) => cena?.corpoEm(x, y, larguraPx, alturaPx) ?? 'SEM CENA';
window.__tamanho = () => [larguraPx, alturaPx] as [number, number];
window.__ancora = (x: number, y: number) => ancoraDoCursor(x, y);
window.__dir = (x: number, y: number) => cena?.direcaoNaTela(x, y, larguraPx, alturaPx) ?? null;

/**
 * Onde cada corpo caiu na CENA, em unidades de desenho relativas ao Sol.
 *
 * Existe para o teste do modo maquete. Medir a compressao pelos pixels da tela
 * misturaria duas coisas — a compressao e o reenquadramento que ela dispara —,
 * e o teste passaria a depender da moldura em vez da escala.
 */
window.__posicaoNaCena = (chave: string) => {
  const c = cena?.corpos.find((x) => x.chave === chave);
  const sol = cena?.corpos.find((x) => x.chave === 'sol');
  if (!c || !sol) return null;
  const p = c.montado.grupo.position;
  const s = sol.montado.grupo.position;
  return { x: p.x - s.x, y: p.y - s.y, z: p.z - s.z, r: p.distanceTo(s) };
};

/** A luz que o corpo recebe, como a cena a calcula. Tem de NAO mudar com a escala. */
window.__irradianciaDe = (chave: string) => {
  const c = cena?.corpos.find((x) => x.chave === chave);
  return c ? c.montado.irradianciaAtual() : null;
};
/**
 * Poe a camera entre o Sol e o alvo — ou seja, olhando o lado iluminado.
 *
 * Existe para o teste de precisao. Depois da fase F4 os corpos tem lado
 * noturno de verdade, e uma camera que calha de nascer atras do corpo ve uma
 * silhueta preta: o teste mediria a ausencia de imagem e passaria por engano.
 */
/**
 * `deslocamento` gira a camera em torno do alvo a partir da direcao do Sol.
 *
 * 0,6 rad e o padrao e deixa o corpo quase todo iluminado; somar PI poe a
 * camera do outro lado e entrega o LADO NOTURNO inteiro, que e o que
 * `e2e/ladoNoturno.spec.ts` precisa medir. Parametro com valor por omissao:
 * quem ja chamava sem nada continua recebendo o que recebia.
 */
window.__ladoIluminado = (deslocamento = 0.6) => {
  const sol = posicaoDoSol();
  const dx = sol[0] - camera.pivo[0];
  const dy = sol[1] - camera.pivo[1];
  // O deslocamento de 0,6 rad (34 graus) nao e cosmetico. Apontando exatamente
  // para o Sol, a camera fica na MESMA reta que o liga ao corpo — e quando o
  // raio da camera passa da distancia corpo-Sol, o Sol entra no quadro, na
  // frente do corpo. A 31,5 UA de Marte era o halo do Sol que aparecia com 263
  // pixels de largura, e o teste concluia que o corpo tinha encolhido. Fora do
  // eixo por 34 graus, o Sol sai do campo em qualquer distancia e o corpo
  // continua iluminado em quase toda a face visivel.
  camera.azimute = Math.atan2(dy, dx) + deslocamento;
  camera.elevacao = 0.2;
  transicao = null;
};

/**
 * Largura da imagem que a SOMBRA do anel de Saturno esta amostrando.
 *
 * Mede um defeito que ja aconteceu: o no da sombra era criado com o objeto
 * `Texture` do instante da montagem — sempre o marcador de 1x1 — e
 * `trocarMapa` nunca o alcancava. A sombra saia com profundidade optica
 * constante, uma tira chapada atravessando o planeta, enquanto o anel ao lado
 * desenhava a imagem de verdade.
 */
window.__larguraDoMapaDaSombra = () =>
  cena?.corpos.find((c) => c.chave === 'saturno')?.montado.larguraDoMapaDaSombra() ?? 0;

window.__anelOpaco = () => {
  const a = cena?.corpos.find((c) => c.chave === 'saturno')?.montado.aneis;
  if (!a) return 'sem anel';
  const m = a.material as unknown as { opacityNode: unknown; opacity: number; transparent: boolean; needsUpdate: boolean };
  m.opacityNode = null;
  m.opacity = 1;
  m.transparent = false;
  m.needsUpdate = true;
  return 'material do anel virou opaco';
};
window.__anel = () => {
  const s = cena?.corpos.find((c) => c.chave === 'saturno');
  const a = s?.montado.aneis;
  if (!a) return { existe: false };
  a.updateWorldMatrix(true, false);
  const g = a.geometry;
  g.computeBoundingSphere();
  const m = a.material as { transparent?: boolean; opacity?: number; visible?: boolean; side?: number };
  return {
    existe: true,
    visible: a.visible,
    renderOrder: a.renderOrder,
    escala: a.scale.toArray(),
    matrizMundo: Array.from(a.matrixWorld.elements).map((v) => +v.toPrecision(4)),
    raioDaEsferaEnvolvente: g.boundingSphere?.radius ?? null,
    vertices: g.attributes['position']?.count ?? 0,
    indices: g.index?.count ?? 0,
    material: { transparent: m.transparent, opacity: m.opacity, side: m.side },
  };
};
window.__grafo = () =>
  (cena?.corpos ?? []).map((c) => ({
    chave: c.chave,
    filhosDoGrupo: c.montado.grupo.children.length,
    temAneis: c.montado.aneis !== null,
    aneisVisiveis: c.montado.aneis?.visible ?? null,
    escalaDosAneis: c.montado.aneis?.scale.x ?? null,
    escalaDaMalha: c.montado.malha.scale.x,
    posicaoDoGrupo: c.montado.grupo.position.toArray().map((v) => +v.toFixed(6)),
  }));

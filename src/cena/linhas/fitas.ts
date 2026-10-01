/**
 * Caminhos previstos e rastros percorridos, como fitas de largura em PIXELS.
 *
 * ## Por que largura em pixels, e nao no mundo
 *
 * Uma linha de espessura fixa no mundo some quando a camera se afasta e vira
 * um tubo quando ela chega perto. Numa cena que cobre doze ordens de grandeza
 * isso nao e um detalhe: a orbita de Netuno e a orbita da Lua teriam de ser
 * desenhadas com a mesma linha, e uma das duas ficaria invisivel.
 *
 * ## O truque da origem: o grupo fica no SOL
 *
 * Os pontos sao guardados em coordenadas RELATIVAS AO SOL, e o grupo inteiro
 * recebe a posicao do Sol menos a da camera. Assim a geometria so muda quando
 * a orbita muda — e nao a cada quadro por causa da origem flutuante. Sem isso
 * seriam 1.620 pontos reescritos sessenta vezes por segundo, para nada.
 *
 * ## A diferenca entre os dois
 *
 * O **caminho previsto** e a elipse osculadora: onde o corpo iria se, a partir
 * deste instante, so o Sol existisse. O **rastro** e por onde ele passou de
 * verdade nesta simulacao. Em escala humana os dois coincidem, e e bom que
 * coincidam — serve de conferencia visual de que a integracao esta certa.
 */
import { comprimirRaio, comprimirRelativos } from '../escala/escalaVisual.ts';
import { Group, Vector3 } from 'three';
import { Line2 } from 'three/addons/lines/webgpu/Line2.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { Line2NodeMaterial } from 'three/webgpu';
import { corDaOrbita, corDaTrilha } from '../../dados/cores.ts';
import { elipseOsculadora } from '../../nucleo/efemerides.ts';
import { ConjuntoTrilhas } from '../../nucleo/trilha.ts';
import type { EstadoSistema } from '../../nucleo/tipos.ts';

const PONTOS_DA_ELIPSE = 240;

/** Quantos quadros entre recalculos da elipse. Os elementos mudam devagar. */
const QUADROS_ENTRE_RECALCULOS = 20;

interface Fita {
  linha: Line2;
  geometria: LineGeometry;
  buffer: Float32Array;
}

/** Opacidade de uma fita sem atenuacao. `atenuar` multiplica esta. */
const OPACIDADE_DA_FITA = 0.85;
/** Idem, para os aneis de distancia. */
const OPACIDADE_DO_ANEL = 0.5;

function criarFita(cor: readonly [number, number, number], larguraPx: number, pontos: number): Fita {
  const geometria = new LineGeometry();
  const buffer = new Float32Array(pontos * 3);
  geometria.setPositions(buffer);

  const material = new Line2NodeMaterial({
    color: (cor[0] << 16) | (cor[1] << 8) | cor[2],
    linewidth: larguraPx,
    worldUnits: false, // largura em PIXELS
    transparent: true,
    opacity: OPACIDADE_DA_FITA,
    depthWrite: false,
    dashed: false,
  });

  const linha = new Line2(geometria, material);
  linha.frustumCulled = false;
  linha.renderOrder = 1;
  return { linha, geometria, buffer };
}

/** Ver `Fitas.estadoDaFita`. */
export interface EstadoDaFita {
  opacidadeDaOrbita: number;
  opacidadeDoRastro: number;
  orbitaVisivel: boolean;
  rastroVisivel: boolean;
}

export interface Fitas {
  grupo: Group;
  mostrarOrbitas(ligado: boolean): void;
  mostrarTrilhas(ligado: boolean): void;
  /**
   * Atenuacao global das linhas, de 0 (apagadas) a 1 (como sempre).
   *
   * **MULTIPLICA a opacidade e NUNCA liga o que foi desligado.** Quem desligou
   * "Caminhos previstos" nao pode ve-los voltar por ter se aproximado de um
   * planeta. Abaixo de zero a linha e ESCONDIDA, e nao desenhada transparente:
   * um fantasma custa o mesmo passe de desenho e nao mostra nada.
   *
   * `chaveEmFoco` fica de fora da atenuacao: o rastro do corpo que se esta
   * olhando e justamente o que mostra o deslocamento dele, e apaga-lo tiraria
   * a unica coisa que diz que ele se move.
   */
  atenuar(fator: number, chaveEmFoco: string | null): void;
  /**
   * O estado visual de uma fita, para MEDIR o esmaecimento de fora.
   *
   * Devolve a opacidade e a visibilidade separadas de proposito. Uma linha
   * desligada pela pessoa e uma linha apagada pelo foco sao a mesma imagem e
   * coisas diferentes: e exatamente essa diferenca que prova que a atenuacao
   * multiplica em vez de ligar. Colapsar as duas num numero so tornaria a
   * propriedade impossivel de afirmar.
   */
  estadoDaFita(chave: string): EstadoDaFita | null;
  /** Chamada por quadro. `posSolUa` posiciona o grupo; o resto e relativo a ele. */
  atualizar(
    estado: EstadoSistema,
    camUa: readonly [number, number, number],
    tDias: number,
    maquete: boolean,
  ): void;
  limparTrilhas(): void;
}

/**
 * `capacidade` reserva fitas para os corpos que o sandbox ainda vai criar.
 *
 * Criar `Line2` no meio do quadro custa alocacao de geometria e compilacao de
 * material — um engasgo visivel exatamente no instante em que a pessoa clicou.
 * As fitas de sobra nascem escondidas e nao custam nada enquanto ninguem as
 * usa.
 */
export function criarFitas(
  corpos: readonly { chave: string; nome: string }[],
  periodosDias: readonly (number | null)[],
  capacidade = corpos.length,
): Fitas {
  const grupo = new Group();
  const orbitas: Fita[] = [];
  const trilhas: Fita[] = [];
  const total = Math.max(capacidade, corpos.length);
  const periodosCompletos = Array.from({ length: total }, (_, i) => periodosDias[i] ?? null);
  const conjunto = new ConjuntoTrilhas(periodosCompletos, 420);

  // O Sol nao orbita a si mesmo: ele entra na lista para os indices baterem,
  // mas com a fita escondida.
  for (let i = 0; i < total; i++) {
    const chave = corpos[i]?.chave ?? `reserva-${i}`;
    const o = criarFita(corDaOrbita(chave, false), 1.4, PONTOS_DA_ELIPSE);
    const t = criarFita(corDaTrilha(chave), 2.2, 420);
    if (chave === 'sol' || i >= corpos.length) {
      o.linha.visible = false;
      t.linha.visible = false;
    }
    orbitas.push(o);
    trilhas.push(t);
    grupo.add(o.linha);
    grupo.add(t.linha);
  }

  let quadro = 0;
  let orbitasLigadas = true;
  let trilhasLigadas = true;
  let atenuacaoAtual = 1;
  let focoAtual: string | null = null;

  /**
   * As tres condicoes numa conjuncao so, num lugar so.
   *
   * Uma linha aparece quando a opcao esta ligada E ela pertence a um corpo que
   * existe E a atenuacao ainda deixou alguma coisa dela. Espalhar isso por tres
   * funcoes era como a terceira condicao entraria errada.
   */
  function aplicarVisibilidade(): void {
    for (let i = 0; i < orbitas.length; i++) {
      const existe = i < corpos.length;
      const chave = existe ? corpos[i]!.chave : null;
      const doFoco = chave !== null && chave === focoAtual;
      // O Sol nao tem orbita para desenhar.
      orbitas[i]!.linha.visible = orbitasLigadas && existe && chave !== 'sol' && atenuacaoAtual > 0;
      trilhas[i]!.linha.visible = trilhasLigadas && existe && (doFoco || atenuacaoAtual > 0);
    }
  }
  // Trocar de escala muda TODA a geometria guardada. Sem forcar o recalculo,
  // as orbitas ficariam na escala antiga ate o proximo multiplo de
  // QUADROS_ENTRE_RECALCULOS — ate dois segundos com os planetas fora delas.
  let maqueteAnterior: boolean | null = null;
  const relativo = new Float32Array(PONTOS_DA_ELIPSE * 3);

  return {
    grupo,

    atenuar(fator, chaveEmFoco) {
      // O caso comum e `fator === 1` sem foco: uma comparacao de float por
      // quadro em vez de quarenta e quatro escritas de uniforme.
      if (fator === atenuacaoAtual && chaveEmFoco === focoAtual) return;
      atenuacaoAtual = fator;
      focoAtual = chaveEmFoco;
      for (let i = 0; i < orbitas.length; i++) {
        const chave = i < corpos.length ? corpos[i]!.chave : null;
        // O rastro do proprio corpo em foco nao atenua: ele e o que mostra o
        // deslocamento. A orbita dele atenua junto com as outras — a elipse
        // inteira nao cabe na tela quando se esta a tres raios dela.
        const doFoco = chave !== null && chave === chaveEmFoco;
        const fOrbita = fator;
        const fTrilha = doFoco ? 1 : fator;
        const mo = orbitas[i]!.linha.material as { opacity: number };
        const mt = trilhas[i]!.linha.material as { opacity: number };
        mo.opacity = OPACIDADE_DA_FITA * fOrbita;
        mt.opacity = OPACIDADE_DA_FITA * fTrilha;
      }
      aplicarVisibilidade();
    },

    estadoDaFita(chave) {
      const i = corpos.findIndex((c) => c.chave === chave);
      if (i < 0) return null;
      const mo = orbitas[i]!.linha.material as { opacity: number };
      const mt = trilhas[i]!.linha.material as { opacity: number };
      return {
        opacidadeDaOrbita: mo.opacity,
        opacidadeDoRastro: mt.opacity,
        orbitaVisivel: orbitas[i]!.linha.visible,
        rastroVisivel: trilhas[i]!.linha.visible,
      };
    },

    mostrarOrbitas(ligado) {
      orbitasLigadas = ligado;
      aplicarVisibilidade();
    },

    mostrarTrilhas(ligado) {
      trilhasLigadas = ligado;
      aplicarVisibilidade();
    },

    limparTrilhas() {
      conjunto.limpar();
    },

    atualizar(estado, camUa, tDias, maquete) {
      const sx = estado.pos[0]!;
      const sy = estado.pos[1]!;
      const sz = estado.pos[2]!;
      // O grupo e ancorado no Sol e toda a geometria dentro dele e relativa ao
      // Sol — que e exatamente a origem em torno da qual a compressao acontece.
      grupo.position.set(sx - camUa[0], sy - camUa[1], sz - camUa[2]);

      const trocouDeEscala = maquete !== maqueteAnterior;
      maqueteAnterior = maquete;

      if (trilhasLigadas) {
        conjunto.registrar(estado.pos, tDias);
        for (let i = 1; i < Math.min(corpos.length, estado.n); i++) {
          const pontos = conjunto.pontos(i);
          const fita = trilhas[i]!;
          const n = pontos.length / 3;
          if (n < 2) continue;
          // Guardados relativos ao Sol, como a geometria espera.
          for (let k = 0; k < n; k++) {
            fita.buffer[3 * k] = pontos[3 * k]! - sx;
            fita.buffer[3 * k + 1] = pontos[3 * k + 1]! - sy;
            fita.buffer[3 * k + 2] = pontos[3 * k + 2]! - sz;
          }
          // O resto do buffer repete o ultimo ponto: segmentos de comprimento
          // zero nao desenham nada, e assim nao ha risco de uma reta atravessar
          // a cena ate a origem.
          for (let k = n; k < 420; k++) {
            fita.buffer[3 * k] = fita.buffer[3 * (n - 1)]!;
            fita.buffer[3 * k + 1] = fita.buffer[3 * (n - 1) + 1]!;
            fita.buffer[3 * k + 2] = fita.buffer[3 * (n - 1) + 2]!;
          }
          if (maquete) comprimirRelativos(fita.buffer, 420);
          fita.geometria.setPositions(fita.buffer);
        }
      }

      quadro++;
      if (!orbitasLigadas) return;
      if (!trocouDeEscala && quadro % QUADROS_ENTRE_RECALCULOS !== 0) return;

      for (let i = 1; i < Math.min(corpos.length, estado.n); i++) {
        const pontos = elipseOsculadora(estado, i, PONTOS_DA_ELIPSE);
        const fita = orbitas[i]!;
        if (pontos.length === 0) {
          fita.linha.visible = false;
          continue;
        }
        fita.linha.visible = true;
        for (let k = 0; k < PONTOS_DA_ELIPSE; k++) {
          relativo[3 * k] = pontos[3 * k]! - sx;
          relativo[3 * k + 1] = pontos[3 * k + 1]! - sy;
          relativo[3 * k + 2] = pontos[3 * k + 2]! - sz;
        }
        if (maquete) comprimirRelativos(relativo, PONTOS_DA_ELIPSE);
        fita.geometria.setPositions(relativo);
      }
    },
  };
}

/**
 * A linha da orbita que o corpo TERIA, enquanto ele ainda nao existe.
 *
 * Ambar, e nao a cor de um corpo: ela nao e um caminho percorrido nem um
 * caminho previsto de algo que existe — e uma consequencia do gesto que esta
 * acontecendo. Some no instante em que o corpo e criado, e ali a fita normal
 * dele toma o lugar.
 */
export function criarPrevisao(): {
  linha: Line2;
  mostrar(pontos: Float64Array, camUa: readonly [number, number, number]): void;
  esconder(): void;
} {
  const N = 240;
  const fita = criarFita([255, 196, 92], 1.8, N);
  fita.linha.visible = false;
  fita.linha.renderOrder = 2;
  return {
    linha: fita.linha,
    mostrar(pontos, camUa) {
      if (pontos.length < 3 * N) {
        fita.linha.visible = false;
        return;
      }
      for (let k = 0; k < N; k++) {
        fita.buffer[3 * k] = pontos[3 * k]! - camUa[0];
        fita.buffer[3 * k + 1] = pontos[3 * k + 1]! - camUa[1];
        fita.buffer[3 * k + 2] = pontos[3 * k + 2]! - camUa[2];
      }
      fita.geometria.setPositions(fita.buffer);
      fita.linha.visible = true;
    },
    esconder() {
      fita.linha.visible = false;
    },
  };
}

/** Anéis de distancia em 1, 5, 10, 20 e 30 UA, no plano da ecliptica. */
export const RAIOS_DOS_ANEIS_UA = [1, 5, 10, 20, 30] as const;

export function criarAneisDeDistancia(cor: readonly [number, number, number]): {
  grupo: Group;
  mostrar(ligado: boolean): void;
  /** Mesma atenuacao das fitas. Ver `Fitas.atenuar`. */
  atenuar(fator: number): void;
  posicionar(solUa: readonly [number, number, number], camUa: readonly [number, number, number]): void;
  /** Refaz os circulos na escala pedida. O rotulo continua dizendo a distancia REAL. */
  definirEscala(maquete: boolean): void;
} {
  const grupo = new Group();
  const N = 180;
  const geometrias: LineGeometry[] = [];
  const buffers: Float32Array[] = [];

  for (const r of RAIOS_DOS_ANEIS_UA) {
    const buffer = new Float32Array(N * 3);
    for (let k = 0; k < N; k++) {
      const a = (2 * Math.PI * k) / (N - 1);
      buffer[3 * k] = r * Math.cos(a);
      buffer[3 * k + 1] = r * Math.sin(a);
      buffer[3 * k + 2] = 0;
    }
    const geometria = new LineGeometry();
    geometria.setPositions(buffer);
    geometrias.push(geometria);
    buffers.push(buffer);
    const material = new Line2NodeMaterial({
      color: (cor[0] << 16) | (cor[1] << 8) | cor[2],
      linewidth: 1,
      worldUnits: false,
      transparent: true,
      opacity: OPACIDADE_DO_ANEL,
      depthWrite: false,
    });
    const linha = new Line2(geometria, material);
    linha.frustumCulled = false;
    grupo.add(linha);
  }

  const v = new Vector3();
  let maqueteAtual = false;
  let atenuacaoDoAnel = 1;
  return {
    grupo,
    mostrar(ligado) {
      grupo.visible = ligado;
    },
    /** Mesmo contrato de `Fitas.atenuar`: multiplica, nunca liga. */
    atenuar(fator: number) {
      if (fator === atenuacaoDoAnel) return;
      atenuacaoDoAnel = fator;
      for (const filho of grupo.children) {
        const m = (filho as { material?: { opacity: number } }).material;
        if (m) m.opacity = OPACIDADE_DO_ANEL * fator;
        (filho as { visible: boolean }).visible = fator > 0;
      }
    },
    definirEscala(maquete) {
      if (maquete === maqueteAtual) return;
      maqueteAtual = maquete;
      // Os aneis marcam 1, 5, 10, 20 e 30 UA REAIS. Com a compressao ligada
      // eles encolhem junto com as orbitas, e e por isso que continuam
      // marcando o que dizem marcar: se ficassem no raio original, o anel de
      // 30 UA passaria a cruzar orbitas que estao a 5 UA dele.
      RAIOS_DOS_ANEIS_UA.forEach((r, i) => {
        const raio = maquete ? comprimirRaio(r) : r;
        const buffer = buffers[i]!;
        for (let k = 0; k < N; k++) {
          const a = (2 * Math.PI * k) / (N - 1);
          buffer[3 * k] = raio * Math.cos(a);
          buffer[3 * k + 1] = raio * Math.sin(a);
        }
        geometrias[i]!.setPositions(buffer);
      });
    },
    posicionar(solUa, camUa) {
      v.set(solUa[0] - camUa[0], solUa[1] - camUa[1], solUa[2] - camUa[2]);
      grupo.position.copy(v);
    },
  };
}

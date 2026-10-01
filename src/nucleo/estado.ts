/**
 * Criacao e leitura do estado. As grandezas conservadas moram aqui porque sao
 * o jeito barato de perguntar "a integracao ainda esta certa?".
 *
 * Num sistema isolado integrado por um metodo simpletico, energia e momento
 * angular oscilam em torno de um valor fixo em vez de derivar. O HUD tecnico
 * mostra os dois ao vivo, e os testes os usam como criterio — e por isso que
 * um erro de sinal ou de unidade aparece em segundos, e nao em cem anos
 * simulados.
 */
import type { EstadoSistema } from './tipos.ts';

const FOLGA_PADRAO = 16;

export interface DadosIniciais {
  pos: readonly number[] | Float64Array;
  vel: readonly number[] | Float64Array;
  gm: readonly number[] | Float64Array;
  tDias?: number;
  /** Corpos extras que cabem sem realocar. O sandbox usa; o preset canonico nao. */
  folga?: number;
}

export function criarEstado(dados: DadosIniciais): EstadoSistema {
  const n = dados.gm.length;
  if (dados.pos.length !== 3 * n || dados.vel.length !== 3 * n) {
    throw new Error(
      `pos e vel precisam ter 3 numeros por corpo: n=${n}, pos=${dados.pos.length}, vel=${dados.vel.length}`,
    );
  }
  const capacidade = n + (dados.folga ?? FOLGA_PADRAO);
  const estado: EstadoSistema = {
    pos: new Float64Array(3 * capacidade),
    vel: new Float64Array(3 * capacidade),
    gm: new Float64Array(capacidade),
    n,
    capacidade,
    tDias: dados.tDias ?? 0,
  };
  estado.pos.set(dados.pos as ArrayLike<number>, 0);
  estado.vel.set(dados.vel as ArrayLike<number>, 0);
  estado.gm.set(dados.gm as ArrayLike<number>, 0);
  return estado;
}

export function copiarEstado(e: EstadoSistema): EstadoSistema {
  return {
    pos: e.pos.slice(),
    vel: e.vel.slice(),
    gm: e.gm.slice(),
    n: e.n,
    capacidade: e.capacidade,
    tDias: e.tDias,
  };
}

/** Copia o conteudo de `origem` para `destino`, sem alocar quando ja cabe. */
export function restaurarEstado(destino: EstadoSistema, origem: EstadoSistema): void {
  if (destino.capacidade < origem.n) {
    destino.pos = new Float64Array(3 * origem.capacidade);
    destino.vel = new Float64Array(3 * origem.capacidade);
    destino.gm = new Float64Array(origem.capacidade);
    destino.capacidade = origem.capacidade;
  }
  destino.pos.set(origem.pos.subarray(0, 3 * origem.n));
  destino.vel.set(origem.vel.subarray(0, 3 * origem.n));
  destino.gm.set(origem.gm.subarray(0, origem.n));
  destino.n = origem.n;
  destino.tDias = origem.tDias;
}

function crescer(e: EstadoSistema, capacidadeMinima: number): void {
  if (e.capacidade >= capacidadeMinima) return;
  const nova = Math.max(capacidadeMinima, e.capacidade * 2);
  const pos = new Float64Array(3 * nova);
  const vel = new Float64Array(3 * nova);
  const gm = new Float64Array(nova);
  pos.set(e.pos);
  vel.set(e.vel);
  gm.set(e.gm);
  e.pos = pos;
  e.vel = vel;
  e.gm = gm;
  e.capacidade = nova;
}

/**
 * Acrescenta um corpo NO FIM e devolve o indice dele.
 *
 * Inserir no fim nao e detalhe de implementacao: o laco de forcas soma os
 * pares na ordem dos indices, entao acrescentar ao fim preserva a ordem de
 * somatorio dos pares que ja existiam. E o que faz
 * `insercaoNaoPerturba.test.ts` poder exigir trajetorias identicas BIT A BIT
 * para os corpos antigos quando se insere um corpo de massa zero.
 */
export function inserirCorpo(
  e: EstadoSistema,
  pos: readonly [number, number, number],
  vel: readonly [number, number, number],
  gm: number,
): number {
  crescer(e, e.n + 1);
  const i = e.n;
  e.pos[3 * i] = pos[0];
  e.pos[3 * i + 1] = pos[1];
  e.pos[3 * i + 2] = pos[2];
  e.vel[3 * i] = vel[0];
  e.vel[3 * i + 1] = vel[1];
  e.vel[3 * i + 2] = vel[2];
  e.gm[i] = gm;
  e.n += 1;
  return i;
}

/**
 * Remove o corpo `i` deslocando os seguintes para tras.
 *
 * Nao se troca pelo ultimo ("swap-remove"), apesar de ser mais barato: isso
 * embaralharia a ordem dos corpos, e a ordem e visivel — ela e a lista lateral,
 * a ordem de somatorio das forcas e os indices que a cena guarda.
 */
export function removerCorpo(e: EstadoSistema, i: number): void {
  if (i < 0 || i >= e.n) throw new RangeError(`corpo ${i} nao existe (n = ${e.n})`);
  e.pos.copyWithin(3 * i, 3 * (i + 1), 3 * e.n);
  e.vel.copyWithin(3 * i, 3 * (i + 1), 3 * e.n);
  e.gm.copyWithin(i, i + 1, e.n);
  e.n -= 1;
}

// -- leitura por corpo -------------------------------------------------------

/** Distancia do corpo i ao corpo `relativoA` (por padrao o Sol), em UA, em 3D. */
export function raio(e: EstadoSistema, i: number, relativoA = 0): number {
  const a = 3 * i;
  const b = 3 * relativoA;
  const dx = e.pos[a]! - e.pos[b]!;
  const dy = e.pos[a + 1]! - e.pos[b + 1]!;
  const dz = e.pos[a + 2]! - e.pos[b + 2]!;
  return Math.hypot(dx, dy, dz);
}

/** Velocidade do corpo i em relacao ao corpo `relativoA`, em UA/dia. */
export function velocidadeRelativa(e: EstadoSistema, i: number, relativoA = 0): number {
  const a = 3 * i;
  const b = 3 * relativoA;
  return Math.hypot(e.vel[a]! - e.vel[b]!, e.vel[a + 1]! - e.vel[b + 1]!, e.vel[a + 2]! - e.vel[b + 2]!);
}

export function posicaoDe(e: EstadoSistema, i: number): [number, number, number] {
  return [e.pos[3 * i]!, e.pos[3 * i + 1]!, e.pos[3 * i + 2]!];
}

export function velocidadeDe(e: EstadoSistema, i: number): [number, number, number] {
  return [e.vel[3 * i]!, e.vel[3 * i + 1]!, e.vel[3 * i + 2]!];
}

// -- grandezas conservadas ---------------------------------------------------

/**
 * Energia total por unidade de constante gravitacional (UA^2/dia^2 vezes GM).
 * Cinetica mais potencial.
 */
export function energia(e: EstadoSistema): number {
  const { pos, vel, gm, n } = e;
  let cinetica = 0;
  for (let i = 0; i < n; i++) {
    const k = 3 * i;
    cinetica += gm[i]! * (vel[k]! * vel[k]! + vel[k + 1]! * vel[k + 1]! + vel[k + 2]! * vel[k + 2]!);
  }
  cinetica *= 0.5;

  let potencial = 0;
  for (let i = 0; i < n; i++) {
    const a = 3 * i;
    for (let j = i + 1; j < n; j++) {
      const b = 3 * j;
      const d = Math.hypot(pos[b]! - pos[a]!, pos[b + 1]! - pos[a + 1]!, pos[b + 2]! - pos[a + 2]!);
      potencial -= (gm[i]! * gm[j]!) / d;
    }
  }
  return cinetica + potencial;
}

/** Momento angular total (3,). Conserva-se ainda melhor que a energia. */
export function momentoAngular(e: EstadoSistema): [number, number, number] {
  const { pos, vel, gm, n } = e;
  let lx = 0;
  let ly = 0;
  let lz = 0;
  for (let i = 0; i < n; i++) {
    const k = 3 * i;
    const m = gm[i]!;
    lx += m * (pos[k + 1]! * vel[k + 2]! - pos[k + 2]! * vel[k + 1]!);
    ly += m * (pos[k + 2]! * vel[k]! - pos[k]! * vel[k + 2]!);
    lz += m * (pos[k]! * vel[k + 1]! - pos[k + 1]! * vel[k]!);
  }
  return [lx, ly, lz];
}

/** Momento linear total (3,). Fica proximo de zero num estado baricentrico. */
export function momentoLinear(e: EstadoSistema): [number, number, number] {
  const { vel, gm, n } = e;
  let px = 0;
  let py = 0;
  let pz = 0;
  for (let i = 0; i < n; i++) {
    const k = 3 * i;
    const m = gm[i]!;
    px += m * vel[k]!;
    py += m * vel[k + 1]!;
    pz += m * vel[k + 2]!;
  }
  return [px, py, pz];
}

export function gmTotal(e: EstadoSistema): number {
  let soma = 0;
  for (let i = 0; i < e.n; i++) soma += e.gm[i]!;
  return soma;
}

/**
 * Centro de massa dos corpos simulados (3,), em UA.
 *
 * Nao e exatamente a origem, e isso nao e defeito: a origem e o baricentro do
 * Sistema Solar inteiro, que inclui corpos que este modelo nao carrega.
 */
export function centroDeMassa(e: EstadoSistema): [number, number, number] {
  const { pos, gm, n } = e;
  let cx = 0;
  let cy = 0;
  let cz = 0;
  for (let i = 0; i < n; i++) {
    const k = 3 * i;
    const m = gm[i]!;
    cx += m * pos[k]!;
    cy += m * pos[k + 1]!;
    cz += m * pos[k + 2]!;
  }
  const total = gmTotal(e);
  return [cx / total, cy / total, cz / total];
}

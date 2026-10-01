/**
 * O sandbox: as guardas e o sistema vivo.
 *
 * Os casos aqui vieram quase todos de uma revisao adversarial da
 * especificacao, feita antes de a primeira linha existir. Cada um custou uma
 * frase de especificacao e teria custado uma sessao de depuracao.
 */
import { describe, expect, it } from 'vitest';
import {
  MAXIMO_DE_CORPOS_CRIADOS,
  avaliarVizinhanca,
  separacaoMinima,
} from '@nucleo/guardas.ts';
import { criarSistemaVivo } from '@app/sistemaVivo.ts';
import { carregar, indiceDe } from '@dados/carregar.ts';
import { receitaDe } from '@dados/predefinicoes.ts';
import { PASSO_PADRAO_DIAS } from '@nucleo/integrador.ts';
import { energia } from '@nucleo/estado.ts';
import type { Predefinicao } from '@contratos/sandbox.ts';

const GM_SOL = 2.9591220828411951e-4;

describe('a guarda de vizinhanca', () => {
  it('a separacao minima cresce com a massa do vizinho', () => {
    const doSol = separacaoMinima(GM_SOL);
    const deJupiter = separacaoMinima(2.825345825225792e-7);
    expect(doSol).toBeGreaterThan(deJupiter);
    // Ordens de grandeza plausiveis: alguns centesimos de UA do Sol.
    expect(doSol).toBeGreaterThan(0.01);
    expect(doSol).toBeLessThan(0.5);
  });

  it('um vizinho SEM massa nao impoe separacao nenhuma', () => {
    // As predefinicoes "Asteroide" e "Cometa" tem massa exatamente zero. Uma
    // formula com `mu = gm_i + gm_j` daria separacao zero para um par delas e
    // a guarda aceitaria dois corpos sobrepostos; com a GM do VIZINHO, o par
    // realmente nao tem restricao — e esta certo, porque dois corpos sem massa
    // nao se puxam.
    expect(separacaoMinima(0)).toBe(0);
    expect(receitaDe('asteroide').gm).toBe(0);
    expect(receitaDe('cometa').gm).toBe(0);
  });

  it('recusa um ponto em cima de Jupiter e aceita um longe dele', () => {
    const { estado, corpos } = carregar();
    const j = indiceDe(corpos, 'jupiter');
    const emCima: [number, number, number] = [
      estado.pos[3 * j]!,
      estado.pos[3 * j + 1]!,
      estado.pos[3 * j + 2]!,
    ];
    const v = avaliarVizinhanca(estado, emCima);
    expect(v.aceito).toBe(false);
    if (!v.aceito) {
      expect(v.vizinho).toBe(j);
      expect(v.distanciaUa).toBe(0);
    }
    expect(avaliarVizinhanca(estado, [emCima[0] + 3, emCima[1], emCima[2]]).aceito).toBe(true);
  });

  it('devolve o PIOR caso, e nao o primeiro da lista', () => {
    // Devolver o primeiro que reprova daria uma mensagem que muda com a ordem
    // do catalogo, e a pessoa afastaria o corpo de quem nao era o problema.
    const { estado, corpos } = carregar();
    const t = indiceDe(corpos, 'terra');
    // Um ponto perto da Terra: o Sol tambem reprova (a 1 UA), mas a Terra
    // reprova proporcionalmente muito mais.
    const v = avaliarVizinhanca(estado, [
      estado.pos[3 * t]! + 1e-4,
      estado.pos[3 * t + 1]!,
      estado.pos[3 * t + 2]!,
    ]);
    expect(v.aceito).toBe(false);
    if (!v.aceito) expect(corpos[v.vizinho]!.chave).toBe('terra');
  });
});

describe('o sistema vivo', () => {
  const novo = () => {
    const c = carregar();
    return { c, vivo: criarSistemaVivo(c.estado, c.corpos) };
  };
  const longe = (r: number): [number, number, number] => [r, 0, 0];
  const circular = (r: number): [number, number, number] => [0, Math.sqrt(GM_SOL / r), 0];

  const criar = (vivo: ReturnType<typeof criarSistemaVivo>, r = 3, tipo: Predefinicao = 'asteroide') =>
    vivo.criar({
      predefinicao: tipo,
      pos: longe(r),
      vel: circular(r),
      dtDias: PASSO_PADRAO_DIAS,
      diaSimulado: 0,
    });

  it('criar acrescenta nas DUAS listas, no mesmo indice', () => {
    const { c, vivo } = novo();
    const antes = c.corpos.length;
    const r = criar(vivo);
    expect(r.ok).toBe(true);
    expect(c.corpos.length).toBe(antes + 1);
    expect(c.estado.n).toBe(antes + 1);
    if (r.ok) expect(c.corpos[r.indice]!.chave).toBe(r.chave);
  });

  it('apagar tira das duas, e os indices seguintes se deslocam juntos', () => {
    const { c, vivo } = novo();
    const a = criar(vivo, 3);
    const b = criar(vivo, 6);
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok) return;
    vivo.apagar(a.chave);
    expect(c.corpos.length).toBe(c.estado.n);
    // O segundo criado subiu uma posicao nas DUAS listas.
    const i = c.corpos.findIndex((x) => x.chave === (b.ok ? b.chave : ''));
    expect(i).toBe(c.corpos.length - 1);
    expect(c.estado.gm[i]).toBe(0);
  });

  it('o nome nao se repete depois de apagar', () => {
    // Contar "quantos desta predefinicao existem" produz nome repetido depois
    // de qualquer remocao: apagar o Asteroide 1 faria o proximo se chamar
    // Asteroide 1 de novo, e a lista lateral ficaria com dois.
    const { c, vivo } = novo();
    const a = criar(vivo, 3);
    criar(vivo, 6);
    if (a.ok) vivo.apagar(a.chave);
    criar(vivo, 9);
    const nomes = c.corpos.filter((x) => x.papel === 'teste').map((x) => x.nome);
    expect(new Set(nomes).size, nomes.join(', ')).toBe(nomes.length);
  });

  it('desfazer volta exatamente ao estado anterior', () => {
    const { c, vivo } = novo();
    const antes = energia(c.estado);
    criar(vivo, 3, 'gasoso');
    expect(energia(c.estado)).not.toBe(antes);
    expect(vivo.desfazer()).toBeTruthy();
    expect(c.estado.n).toBe(9);
    expect(energia(c.estado)).toBe(antes);
  });

  it('o distintivo NAO e "pode desfazer": a pilha descarta e ele nao pode sumir', () => {
    // O invariante `modificado === podeDesfazer` e falso assim que a pilha
    // descarta o marco mais antigo. Com profundidade 20, o corpo 21 apagaria
    // o distintivo com o sistema ainda modificado.
    const { vivo } = novo();
    for (let k = 0; k < 25; k++) criar(vivo, 3 + k * 0.5);
    expect(vivo.modificado).toBe(true);
    for (let k = 0; k < 30; k++) vivo.desfazer();
    expect(vivo.podeDesfazer).toBe(false);
    // Desfazer tudo o que a pilha guardava nao volta ao sistema do JPL: ela so
    // guarda vinte. O distintivo continua, e esta certo — o sistema segue
    // modificado, e ha o botao de restaurar para isso.
    expect(vivo.modificado).toBe(true);
    vivo.restaurar();
    expect(vivo.modificado).toBe(false);
  });

  it('restaurar volta ao preset e limpa a pilha', () => {
    const { c, vivo } = novo();
    const original = energia(c.estado);
    criar(vivo, 4, 'estrela');
    criar(vivo, 8, 'rochoso');
    vivo.restaurar();
    expect(c.estado.n).toBe(9);
    expect(c.corpos.length).toBe(9);
    expect(energia(c.estado)).toBe(original);
    expect(vivo.podeDesfazer).toBe(false);
    expect(vivo.criados.length).toBe(0);
  });

  it('o teto de corpos e respeitado, e a recusa diz qual e', () => {
    const { vivo } = novo();
    for (let k = 0; k < MAXIMO_DE_CORPOS_CRIADOS; k++) criar(vivo, 3 + k * 0.5);
    const r = criar(vivo, 40);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.recusa.tipo).toBe('lotado');
      if (r.recusa.tipo === 'lotado') expect(r.recusa.maximo).toBe(MAXIMO_DE_CORPOS_CRIADOS);
    }
  });

  it('as duas guardas cobrem coisas diferentes, e nao uma so', () => {
    const { vivo } = novo();

    // (a) Perto do Sol AGORA: a guarda de vizinhanca pega, porque ela mede a
    // posicao do clique. A separacao minima do Sol e 0,144 UA.
    const perto = vivo.criar({
      predefinicao: 'asteroide',
      pos: [0.05, 0, 0],
      vel: [0, Math.sqrt(GM_SOL / 0.05), 0],
      dtDias: PASSO_PADRAO_DIAS,
      diaSimulado: 0,
    });
    expect(perto.ok).toBe(false);
    if (!perto.ok) expect(perto.recusa.tipo).toBe('vizinhanca');

    // (b) Longe de tudo AGORA, mas numa orbita quase radial: no instante do
    // clique ele parece inofensivo, e o periastro fica em 0,025 UA. So a
    // guarda de periastro pega, e e por isso que ela existe.
    const radial = vivo.criar({
      predefinicao: 'asteroide',
      pos: [5, 0, 0],
      vel: [0, 0.1 * Math.sqrt(GM_SOL / 5), 0],
      dtDias: PASSO_PADRAO_DIAS,
      diaSimulado: 0,
    });
    expect(radial.ok, 'a orbita quase radial passou').toBe(false);
    if (!radial.ok) {
      expect(radial.recusa.tipo).toBe('periastro');
      if (radial.recusa.tipo === 'periastro') {
        expect(radial.recusa.veredito.razao).toBe('periastro-rapido-demais');
        expect(radial.recusa.veredito.perielioUa).toBeLessThan(0.1);
      }
    }
  });

  it('a recusa acontece ANTES de inserir: o estado nunca passa pelo invalido', () => {
    const { c, vivo } = novo();
    const antes = { n: c.estado.n, corpos: c.corpos.length, energia: energia(c.estado) };
    vivo.criar({
      predefinicao: 'gasoso',
      pos: [0.05, 0, 0],
      vel: [0, Math.sqrt(GM_SOL / 0.05), 0],
      dtDias: PASSO_PADRAO_DIAS,
      diaSimulado: 0,
    });
    expect(c.estado.n).toBe(antes.n);
    expect(c.corpos.length).toBe(antes.corpos);
    expect(energia(c.estado)).toBe(antes.energia);
    expect(vivo.podeDesfazer, 'uma recusa nao pode empilhar um marco').toBe(false);
  });

  it('um corpo de massa zero nao muda a energia dos outros nove', () => {
    // A mesma garantia que `insercaoNaoPerturba.test.ts` da bit a bit, aqui
    // pela porta do sandbox: as duas predefinicoes sem massa sao seguras por
    // construcao, e nao por sorte.
    const { c, vivo } = novo();
    const antes = energia(c.estado);
    criar(vivo, 3, 'asteroide');
    // A energia total muda por zero: `gm = 0` anula os dois termos em que o
    // corpo novo aparece.
    expect(energia(c.estado)).toBe(antes);
  });
});

/**
 * Porte de `tests/test_atalhos.py`, que existia por um motivo concreto:
 *
 *   "Na versao anterior o rodape era uma string escrita a mao com os atalhos,
 *    e qualquer mudanca no codigo a deixava mentindo sem ninguem notar."
 *
 * Aqui a tabela e DERIVADA do mapa, o que ja resolve boa parte. O teste
 * continua existindo para o que a derivacao nao cobre: escopo, e o fato de
 * todo atalho ter de ter um controle escrito equivalente.
 */
import { describe, expect, it } from 'vitest';
import { ATALHOS, TABELA_DE_ATALHOS, resolver } from '@app/atalhos.ts';
import { atalhoGlobalPodeAgir } from '@app/escopoDeTeclado.ts';

const evento = (key: string, extra: Partial<{ shiftKey: boolean; metaKey: boolean; ctrlKey: boolean }> = {}) => ({
  key,
  shiftKey: false,
  metaKey: false,
  ctrlKey: false,
  ...extra,
});

describe('o mapa e a tabela escrita nao divergem', () => {
  it('toda tecla do mapa aparece na tabela', () => {
    for (const a of ATALHOS) {
      expect(TABELA_DE_ATALHOS.some((t) => t.escrito === a.escrito), a.escrito).toBe(true);
    }
  });

  it('toda linha da tabela corresponde a uma tecla que funciona', () => {
    for (const linha of TABELA_DE_ATALHOS) {
      const atalho = ATALHOS.find((a) => a.escrito === linha.escrito);
      expect(atalho, linha.escrito).toBeDefined();
      // Os modificadores do proprio atalho entram no evento. Sem isso, a
      // primeira entrada que exigisse Cmd reprovaria o teste — e nao porque
      // ela nao funciona, mas porque o teste sintetizava um evento sem Cmd.
      const t = atalho!.teclas[0]!;
      expect(resolver(evento(t.tecla, { metaKey: t.meta ?? false }), null), linha.escrito)
        .not.toBeNull();
    }
  });

  it('Cmd+Shift+Z NAO desfaz: nao ha refazer, e um desfazer a mais seria pior', () => {
    // Shift nao entra na comparacao de teclas — e ele que faz `/` virar `?` —,
    // entao sem a marca `semShift` o Refazer convencional de todo aplicativo
    // casaria com o desfazer e tiraria mais um corpo, com `preventDefault` por
    // cima para a pessoa nem ver o navegador reagir.
    expect(resolver(evento('z', { metaKey: true }), null)).toEqual({ tipo: 'desfazer' });
    expect(resolver(evento('Z', { metaKey: true, shiftKey: true }), null)).toBeNull();
    expect(resolver(evento('z', { ctrlKey: true, shiftKey: true }), null)).toBeNull();
  });

  it('Z sem modificador nenhum nao desfaz', () => {
    expect(resolver(evento('z'), null)).toBeNull();
  });

  it('nenhuma linha da tabela esta sem descricao', () => {
    for (const linha of TABELA_DE_ATALHOS) expect(linha.descricao.length).toBeGreaterThan(8);
  });
});

describe('as teclas resolvem para a acao certa', () => {
  it('as basicas', () => {
    expect(resolver(evento(' '), null)).toEqual({ tipo: 'alternar-pausa' });
    expect(resolver(evento(']'), null)).toEqual({ tipo: 'mudar-velocidade', passo: 1 });
    expect(resolver(evento('['), null)).toEqual({ tipo: 'mudar-velocidade', passo: -1 });
    expect(resolver(evento('.'), null)).toEqual({ tipo: 'avancar-passo', sentido: 1 });
    expect(resolver(evento(','), null)).toEqual({ tipo: 'avancar-passo', sentido: -1 });
    expect(resolver(evento('Escape'), null)).toEqual({ tipo: 'fechar' });
  });

  it('maiuscula e minuscula funcionam igual', () => {
    expect(resolver(evento('v'), null)).toEqual(resolver(evento('V'), null));
    expect(resolver(evento('r'), null)).toEqual(resolver(evento('R'), null));
  });

  it('o "?" da Ajuda funciona MESMO exigindo Shift no teclado', () => {
    // A primeira versao do resolver comparava `shiftKey` e este atalho nunca
    // disparava: `key` ja vem como '?' justamente porque o Shift foi aplicado.
    expect(resolver(evento('?', { shiftKey: true }), null)).toEqual({ tipo: 'abrir-tela', tela: 'ajuda' });
    expect(resolver(evento('F1'), null)).toEqual({ tipo: 'abrir-tela', tela: 'ajuda' });
  });

  it('as setas orbitam, e com Shift deslocam', () => {
    expect(resolver(evento('ArrowLeft'), null)).toMatchObject({ tipo: 'orbitar-camera' });
    expect(resolver(evento('ArrowLeft', { shiftKey: true }), null)).toMatchObject({ tipo: 'deslocar-camera' });
    expect(resolver(evento('ArrowUp'), null)).toMatchObject({ tipo: 'orbitar-camera', elevacao: 0.06 });
    expect(resolver(evento('ArrowDown'), null)).toMatchObject({ tipo: 'orbitar-camera', elevacao: -0.06 });
  });

  it('a tecla da captura e nossa; com Cmd ou Ctrl ela e do navegador', () => {
    // Era `S`, e virou `G` porque o `S` passou a andar para tras no modo
    // imersivo. Ver o comentario no proprio atalho.
    expect(resolver(evento('g'), null)).toEqual({ tipo: 'capturar-tela' });
    expect(resolver(evento('g', { metaKey: true }), null)).toBeNull();
    expect(resolver(evento('g', { ctrlKey: true }), null)).toBeNull();
  });

  it('Esc fecha a caixa e NAO encerra o programa', () => {
    const acao = resolver(evento('Escape'), null);
    expect(acao).toEqual({ tipo: 'fechar' });

    // A guarda procurava a palavra "sair" em qualquer descricao, e assim
    // reprovou o atalho que entra e SAI do modo imersivo — que nao encerra nada.
    // Procurar uma palavra solta media o vocabulario, e nao o comportamento.
    //
    // O que ela quer dizer e: nenhum atalho abandona o PROGRAMA. Entao e isso
    // que ela mede agora, por duas vias que precisam concordar: nenhuma
    // descricao promete sair do programa, e nenhum atalho produz uma acao capaz
    // de encerra-lo. A segunda e a forte — a uniao `Acao` simplesmente nao tem um
    // membro desses, e enquanto nao tiver, nenhum atalho pode chamar um.
    const ENCERRAR = /\b(sair|fechar|encerrar)\b[^.]*\b(programa|aplicativo|simula[cç][aã]o|janela|aba)\b/i;
    for (const a of ATALHOS) expect(a.descricao).not.toMatch(ENCERRAR);

    const TIPOS_QUE_ENCERRAM = ['encerrar', 'sair', 'fechar-programa'];
    for (const a of ATALHOS) {
      expect(TIPOS_QUE_ENCERRAM).not.toContain(a.acao({ shift: false }).tipo);
    }
  });

  it('a guarda de encerramento reprova uma descricao que prometa sair do programa', () => {
    // Sem esta prova a guarda acima poderia estar medindo nada: uma expressao
    // regular que nunca casa passa em qualquer lista. Aqui esta a frase que ela
    // TEM de pegar, e o formato e o mesmo das descricoes de verdade.
    const ENCERRAR = /\b(sair|fechar|encerrar)\b[^.]*\b(programa|aplicativo|simula[cç][aã]o|janela|aba)\b/i;
    expect('Sair do programa').toMatch(ENCERRAR);
    expect('Encerrar a simulação e voltar ao sistema').toMatch(ENCERRAR);
    // E as que ela NAO pode pegar, porque nenhuma delas encerra coisa alguma.
    expect('Entrar e sair do modo imersivo: tela cheia, e W A S D para voar').not.toMatch(ENCERRAR);
    expect('Fechar a caixa aberta').not.toMatch(ENCERRAR);
  });
});

describe('escopo: onde o foco esta decide quem fica com a tecla', () => {
  const campo = { tagName: 'INPUT' };
  const botao = { tagName: 'BUTTON' };
  const lista = { tagName: 'DIV', role: 'listbox' };

  it('campo editavel consome tudo', () => {
    expect(resolver(evento('s'), campo)).toBeNull();
    expect(resolver(evento(' '), campo)).toBeNull();
    expect(atalhoGlobalPodeAgir('r', { tagName: 'DIV', isContentEditable: true })).toBe(false);
  });

  it('Espaco num botao aciona o botao, e nao pausa junto', () => {
    // Sem esta regra, Espaco no botao "Pausar" pausaria duas vezes — ou seja,
    // nao pausaria.
    expect(resolver(evento(' '), botao)).toBeNull();
    expect(resolver(evento('Enter'), botao)).toBeNull();
  });

  it('mas uma letra sobre um botao continua sendo atalho global', () => {
    expect(resolver(evento('r'), botao)).toEqual({ tipo: 'voltar-ao-inicio' });
  });

  it('PageUp e Home ficam com o componente em foco', () => {
    expect(atalhoGlobalPodeAgir('PageUp', lista)).toBe(false);
    expect(atalhoGlobalPodeAgir('Home', lista)).toBe(false);
    expect(atalhoGlobalPodeAgir('End', null)).toBe(false);
  });

  it('o zoom usa + e -, que nao conflitam com a lista', () => {
    expect(resolver(evento('+'), lista)).toEqual({ tipo: 'ajustar-zoom', fator: 1.25 });
    expect(resolver(evento('-'), lista)).toEqual({ tipo: 'ajustar-zoom', fator: 0.8 });
  });
});

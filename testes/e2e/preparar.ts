/**
 * Abrir a pagina num estado conhecido.
 *
 * Existe por causa de um acoplamento real: as preferencias do programa moram
 * num ARQUIVO ao lado de `dist/`, e nao no navegador. Isso e deliberado — o
 * `localStorage` e particionado por origem, e a origem inclui a porta —, mas
 * tem a consequencia de que o estado sobrevive entre testes e entre execucoes.
 *
 * Sem esta funcao, o resultado de um teste passaria a depender do arquivo que
 * o teste ANTERIOR deixou no disco, e a primeira vitima seria a orientacao de
 * primeira abertura: ela aparece quando `tutorialVisto` e falso, e esconderia
 * a tela principal de metade da suite dependendo da ordem de execucao.
 *
 * Quem QUER testar a primeira abertura pede `{ tutorialVisto: false }`, e a
 * intencao fica escrita na chamada.
 */
import type { Page } from '@playwright/test';

export const PREFERENCIAS_PADRAO = {
  versao: 1,
  tutorialVisto: true,
} as const;

export async function abrir(
  pagina: Page,
  preferencias: Record<string, unknown> = {},
  caminho = '/',
): Promise<void> {
  // Descarregar a pagina ANTES de gravar.
  //
  // `gravarPreferencias` grava com 400 ms de atraso, para que alternar tres
  // opcoes seguidas nao vire tres requisicoes. Sem descarregar primeiro, um
  // temporizador armado pela pagina anterior dispara DEPOIS deste PUT e grava
  // por cima dele — e o teste seguinte abre com a preferencia do teste
  // anterior. Foi assim que o teste da orientacao de primeira abertura passou
  // sozinho e falhou na suite. Navegar mata os temporizadores da pagina velha.
  await pagina.goto('about:blank');
  await pagina.request.put('/preferencias.json', {
    headers: { 'content-type': 'application/json' },
    data: { ...PREFERENCIAS_PADRAO, ...preferencias },
  });
  await pagina.goto(caminho);
}

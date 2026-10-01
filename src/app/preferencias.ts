/**
 * Preferencias em ARQUIVO, nao em localStorage.
 *
 * `localStorage` e particionado por ORIGEM, e a origem inclui a porta. Numa
 * abertura em que a porta 8731 estivesse ocupada, tudo se perderia e o
 * tutorial de primeira execucao voltaria. Gravar num arquivo ao lado de
 * `dist/`, pelo servidor local, mata esse problema pela raiz E restaura o
 * `preferencias.json` que o projeto sempre teve.
 *
 * Regra herdada, literal: **"Preferencia e conveniencia, nao pode virar motivo
 * de tela de erro."** Nenhuma funcao aqui lanca. Servidor fora do ar, arquivo
 * corrompido, JSON de outra versao: tudo cai no padrao, calado.
 *
 * **Por que este arquivo mora em `app/` e nao em `dados/`.** Ele nasceu la, e
 * o lint o expulsou: `src/dados/` guarda FATOS CONGELADOS com procedencia, e a
 * regra que proibe `fetch` ali existe para que um dado nunca passe a ser
 * buscado em vez de embarcado. Preferencia nao e fato: e entrada e saida.
 * Mover foi mais barato que abrir excecao, e deixou as duas pastas com uma
 * definicao mais limpa.
 */
const CAMINHO = '/preferencias.json';
const ESPERA_ANTES_DE_GRAVAR_MS = 400;

export async function lerPreferencias(): Promise<unknown> {
  try {
    const r = await fetch(CAMINHO, { cache: 'no-store' });
    if (!r.ok) return {};
    return await r.json();
  } catch {
    return {};
  }
}

let pendente: ReturnType<typeof setTimeout> | null = null;

/**
 * Grava com atraso: alternar tres opcoes seguidas nao pode virar tres
 * requisicoes. O atraso tambem evita gravar a cada clique de um controle que
 * a pessoa esta arrastando.
 */
export function gravarPreferencias(dados: Record<string, unknown>): void {
  if (pendente) clearTimeout(pendente);
  pendente = setTimeout(() => {
    pendente = null;
    void fetch(CAMINHO, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(dados),
      keepalive: true,
    }).catch(() => {
      // Sem servidor, sem preferencias gravadas. O programa segue igual.
    });
  }, ESPERA_ANTES_DE_GRAVAR_MS);
}

/**
 * A batida que mantem o servidor local de pe.
 *
 * O servidor sai sozinho depois de 30 s sem receber nada em /_batida. E isso que faz "fechar a
 * aba" encerrar o programa, em vez de deixar um processo orfao escutando numa porta ate alguem
 * ir ao terminal mata-lo. Batemos a cada 10 s para que duas batidas possam falhar sem derrubar
 * nada.
 *
 * Quando a aba fica escondida nao paramos de bater: o programa continua rodando atras de outra
 * janela, e encerra-lo porque a pessoa foi olhar outra coisa seria pior que o problema.
 * `pagehide` e que e o fim de verdade, e ele nao dispara em troca de aba.
 */
const INTERVALO_MS = 10_000;

export function manterServidorDePe(): () => void {
  let vivo = true;

  const bater = (): void => {
    if (!vivo) return;
    // keepalive: a ultima batida antes de a aba morrer ainda sai, mesmo com a pagina indo embora.
    void fetch('/_batida', { method: 'GET', keepalive: true }).catch(() => {
      // Servidor fora do ar. Nao ha o que fazer daqui, e insistir com erro no console so poluiria.
    });
  };

  bater();
  const relogio = setInterval(bater, INTERVALO_MS);

  const parar = (): void => {
    vivo = false;
    clearInterval(relogio);
  };
  addEventListener('pagehide', parar, { once: true });

  return parar;
}

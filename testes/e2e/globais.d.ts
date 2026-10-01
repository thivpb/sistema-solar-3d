/** Ganchos que `principal.ts` publica para o teste de precisao posicionar a camera. */
declare global {
  interface Window {
    __camera?: { raio: number; azimute: number; elevacao: number; pivo: [number, number, number] };
    __posicaoDaCamera?: () => [number, number, number];
    __mostrarCascas?: (ligado: boolean) => void;
    __fatias?: () => number;
    __ladoIluminado?: (deslocamento?: number) => void;
    __larguraDoMapaDaSombra?: () => number;
    __assentou?: () => boolean;
    __raioAparente?: (chave: string) => number;
    __posicaoNaCena?: (chave: string) => { x: number; y: number; z: number; r: number } | null;
    __irradianciaDe?: (chave: string) => number | null;
    __corpoEm?: (x: number, y: number) => string | null;
    __tamanho?: () => [number, number];
    __ancora?: (x: number, y: number) => [number, number, number] | null;
    __dir?: (x: number, y: number) => [number, number, number] | null;
    __foco?: () => number;
    __obstaculosDosRotulos?: () => { x: number; y: number; largura: number; altura: number }[];
    __orientacaoDe?: (chave: string) => [number, number, number, number] | null;
    __fita?: (
      chave: string,
    ) => {
      opacidadeDaOrbita: number;
      opacidadeDoRastro: number;
      orbitaVisivel: boolean;
      rastroVisivel: boolean;
    } | null;
    __projecoes?: () => { chave: string; x: number; y: number; raioPx: number; naFrente: boolean; ocluido: boolean; distanciaUa: number }[];
  }
}
export {};

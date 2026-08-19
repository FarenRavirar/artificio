// O `tsc` não conhece import de CSS como efeito colateral; o bundler do
// consumidor é quem resolve. Sem esta declaração, importar a folha obrigatória
// do `react-image-crop` falha o build com TS2882.
declare module '*.css';

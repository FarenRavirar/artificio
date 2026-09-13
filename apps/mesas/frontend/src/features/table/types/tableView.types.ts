// ViewModel de mesa — fonte única em `@artificio/catalog-table` (spec 102 T4.2).
// O SSR renderiza a partir deste mesmo ViewModel, então ele não pode ter duas
// definições.
export type * from '@artificio/catalog-table';

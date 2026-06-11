export const slugify = (text: string): string => {
  return text
    .toString()
    .normalize('NFD') // remove acentos
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-') // troca espaços por hífens
    .replace(/[^\w-]+/g, '') // remove tudo que não for letra ou hífen
    .replace(/--+/g, '-'); // evita hífens duplos
};

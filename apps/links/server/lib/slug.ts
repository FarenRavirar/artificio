// Slugify único (usado por server + seed). Remove diacríticos via faixa de combinantes
// U+0300–U+036F (RegExp construído de escapes p/ não depender de caractere literal no fonte),
// colapsa não-alfanuméricos.
const COMBINING = new RegExp("[\\u0300-\\u036f]", "g");

export function slugify(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(COMBINING, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

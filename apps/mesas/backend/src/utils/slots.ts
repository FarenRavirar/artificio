/**
 * Vagas abertas de uma mesa (spec 106 D11): `slots_open` é o que o mestre controla;
 * `total - filled` só entra quando ele falta. Mesma regra de `sumOpenSlots`
 * (useMestre) e de `formatSlots` (whatsappAnnouncement) no front: o teste cruzado
 * de T8.8 prende as três ao mesmo número.
 */
export function slotsAvailable(t: {
  slots_open?: number | null;
  slots_total?: number | null;
  slots_filled?: number | null;
}): number {
  return t.slots_open ?? (t.slots_total ?? 0) - (t.slots_filled ?? 0);
}

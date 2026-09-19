export const NOVEDAD_CONCEPTS = [
  { label: "Deducción por daños", sign: -1 },
  { label: "Deducción por préstamo", sign: -1 },
  { label: "Pago por prestación de servicios", sign: 1 },
] as const;

export function novedadSign(concept: string): number {
  return NOVEDAD_CONCEPTS.find((c) => c.label === concept)?.sign ?? -1;
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function fmtDateHuman(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" });
}

/** Dado un ISO date, devuelve el rango viernes->jueves que lo contiene. */
export function periodRangeFor(dateStr: string): { start: string; end: string } {
  const d = new Date(dateStr + "T00:00:00");
  const day = d.getDay(); // 0 dom ... 5 vie ... 6 sab
  const diffFromFriday = (day - 5 + 7) % 7;
  const start = new Date(d);
  start.setDate(d.getDate() - diffFromFriday);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const toISO = (x: Date) => x.toISOString().slice(0, 10);
  return { start: toISO(start), end: toISO(end) };
}

/** Calcula el siguiente rango viernes->jueves disponible (no usado todavía). */
export function nextAvailablePeriodRange(
  existingRanges: { start: string; end: string }[]
): { start: string; end: string } {
  let candidateDate = todayISO();
  if (existingRanges.length > 0) {
    const maxEnd = existingRanges.reduce((max, r) => (r.end > max ? r.end : max), existingRanges[0].end);
    const dayAfter = new Date(maxEnd + "T00:00:00");
    dayAfter.setDate(dayAfter.getDate() + 1);
    const dayAfterISO = dayAfter.toISOString().slice(0, 10);
    if (dayAfterISO > candidateDate) candidateDate = dayAfterISO;
  }
  let { start, end } = periodRangeFor(candidateDate);
  let guard = 0;
  while (existingRanges.some((r) => r.start === start && r.end === end) && guard < 60) {
    const next = new Date(end + "T00:00:00");
    next.setDate(next.getDate() + 1);
    const nextISO = next.toISOString().slice(0, 10);
    ({ start, end } = periodRangeFor(nextISO));
    guard++;
  }
  return { start, end };
}

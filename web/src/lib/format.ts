const money = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
const number = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 });

export const cop = (n: number | null | undefined) => money.format(n ?? 0).replace(/\s/g, ' ');
export const num = (n: number | null | undefined) => number.format(n ?? 0);

/** "1,5 kg" · "3 und" */
export const qty = (n: number, unit: string) => `${num(n)} ${unit}`;

const DAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const DAYS_SHORT = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export const pad = (n: number) => String(n).padStart(2, '0');

export function parse(s: string): Date {
  const [d, t = '00:00'] = s.split(' ');
  const [y, m, day] = d.split('-').map(Number);
  const [h, min] = t.split(':').map(Number);
  return new Date(y, m - 1, day, h, min);
}

export const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function today() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export const longDate = (s: string | Date) => {
  const d = typeof s === 'string' ? parse(s) : s;
  return `${DAYS[d.getDay()]} ${d.getDate()} de ${MONTHS[d.getMonth()]}`;
};

export const shortDate = (s: string | Date) => {
  const d = typeof s === 'string' ? parse(s) : s;
  return `${DAYS_SHORT[d.getDay()]} ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
};

export const dayShort = (s: string) => DAYS_SHORT[parse(s).getDay()];

export function hour(s: string | Date) {
  const d = typeof s === 'string' ? parse(s) : s;
  const h = d.getHours();
  return `${h % 12 === 0 ? 12 : h % 12}:${pad(d.getMinutes())} ${h < 12 ? 'a. m.' : 'p. m.'}`;
}

export const hourLabel = (h: number) => `${h % 12 === 0 ? 12 : h % 12} ${h < 12 ? 'a. m.' : 'p. m.'}`;

/** Atajos de billetes colombianos para el pago en efectivo. */
export function cashSuggestions(total: number): number[] {
  const bills = [2000, 5000, 10000, 20000, 50000, 100000];
  const out = new Set<number>([total]);
  for (const b of bills) {
    const v = Math.ceil(total / b) * b;
    if (v >= total) out.add(v);
  }
  return [...out].sort((a, b) => a - b).slice(0, 5);
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

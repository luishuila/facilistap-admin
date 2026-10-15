import { LocalizedName } from '../models/language.interface';

/** Valor del grupo listo para el backend: sin espacios ni idiomas vacios; null si no queda ninguno. */
export function toLocalizedName(value: Record<string, unknown> | null | undefined): LocalizedName | null {
  const out: LocalizedName = {};
  for (const [code, text] of Object.entries(value ?? {})) {
    const trimmed = typeof text === 'string' ? text.trim() : '';
    if (trimmed) out[code] = trimmed;
  }
  return Object.keys(out).length ? out : null;
}

/** Texto corto para tablas: "ES · EN · DE +7" (o "—" si no tiene traducciones). */
export function translationsLabel(value: LocalizedName | null | undefined, max = 3): string {
  const codes = Object.keys(value ?? {}).filter((c) => !!value?.[c]?.trim());
  if (!codes.length) return '—';
  const shown = codes.slice(0, max).map((c) => c.toUpperCase()).join(' · ');
  return codes.length > max ? `${shown} +${codes.length - max}` : shown;
}

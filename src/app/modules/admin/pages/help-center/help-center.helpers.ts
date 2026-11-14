import { LocalizedName } from '../../../../core/models/language.interface';

/** Texto en español (o el primero que haya) de un campo guardado por idioma. */
export function localizedNameOf(value: LocalizedName | null | undefined): string {
  return value?.['es'] || Object.values(value ?? {}).find((text) => !!text) || '';
}

/** % de votos "Sí" (null si nadie ha votado). */
export function helpfulPercent(helpful: number, notHelpful: number): number | null {
  const total = (helpful ?? 0) + (notHelpful ?? 0);
  return total ? Math.round(((helpful ?? 0) * 100) / total) : null;
}

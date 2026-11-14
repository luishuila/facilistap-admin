/**
 * Vista previa de un artículo del Centro de ayuda: el mismo formato que pinta la app
 * (facilis-tap-frontend › features/help-center/utils/help-markdown.util.ts).
 *
 *   ## Título · - punto · 1. paso · **negrita** · > nota · [texto](/ruta) · ![texto](https://imagen)
 *
 * Todo se escapa antes de dar formato: nunca entra HTML escrito en el artículo.
 */

const escapeHtml = (text: string): string =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const isInternal = (url: string): boolean => /^\/(?!\/)/.test(url);

function inline(text: string): string {
  let out = escapeHtml(text);
  out = out.replace(/!\[([^\]]*)\]\((https:\/\/[^\s)]+)\)/g, (_m, alt: string, url: string) => `<img src="${url}" alt="${alt}">`);
  out = out.replace(/\[([^\]]+)\]\(([^\s)]+)\)/g, (_m, label: string, url: string) => {
    if (isInternal(url)) return `<a class="help-link" title="Pantalla de la app: ${url}">${label}</a>`;
    if (/^https:\/\//.test(url)) return `<a class="help-link" href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>`;
    return label;
  });
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  return out;
}

interface ListBlock {
  type: 'ul' | 'ol';
  items: string[];
}

export function renderHelpMarkdown(source: string | null | undefined): string {
  const lines = String(source ?? '').replace(/\r\n?/g, '\n').split('\n');
  const html: string[] = [];
  let paragraph: string[] = [];
  let tip: string[] = [];
  let list: ListBlock | null = null;

  const flushParagraph = () => {
    if (paragraph.length) html.push(`<p>${paragraph.map(inline).join('<br>')}</p>`);
    paragraph = [];
  };
  const flushTip = () => {
    if (tip.length) html.push(`<div class="help-tip">${tip.map(inline).join('<br>')}</div>`);
    tip = [];
  };
  const flushList = () => {
    if (list) html.push(`<${list.type}>${list.items.map((item) => `<li>${inline(item)}</li>`).join('')}</${list.type}>`);
    list = null;
  };
  const flushAll = () => {
    flushParagraph();
    flushTip();
    flushList();
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flushAll();
      continue;
    }

    let match = /^(#{1,4})\s+(.*)$/.exec(line);
    if (match) {
      flushAll();
      const tag = match[1].length <= 2 ? 'h3' : 'h4';
      html.push(`<${tag}>${inline(match[2])}</${tag}>`);
      continue;
    }

    match = /^>\s?(.*)$/.exec(line);
    if (match) {
      flushParagraph();
      flushList();
      tip.push(match[1]);
      continue;
    }

    const bullet = /^[-*•]\s+(.*)$/.exec(line);
    const numbered = /^\d+[.)]\s+(.*)$/.exec(line);
    if (bullet || numbered) {
      flushParagraph();
      flushTip();
      const type: ListBlock['type'] = bullet ? 'ul' : 'ol';
      const current: ListBlock = list && list.type === type ? list : { type, items: [] };
      if (current !== list) {
        flushList();
        list = current;
      }
      current.items.push((bullet ?? numbered)![1]);
      continue;
    }

    if (list && /^\s{2,}/.test(raw)) {
      const open: ListBlock = list;
      open.items[open.items.length - 1] += ` ${line}`;
      continue;
    }

    flushList();
    flushTip();
    paragraph.push(line);
  }

  flushAll();
  return html.join('');
}

/** "¿Cómo agendo?" → "como-agendo" (igual que el backend al crear sin slug). */
export function slugify(text: string): string {
  const slug = String(text ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100)
    .replace(/-+$/g, '');
  return slug;
}

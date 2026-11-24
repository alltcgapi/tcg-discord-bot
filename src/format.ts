// The reply contract: every string the embed and the autocomplete are built
// from. No Discord import here, so the whole contract is tested without a
// gateway connection.

import type { Card, Quote } from './api.ts';
import { gameName, gameShort } from './games.ts';

export const NO_QUOTE = 'no quote today';

// Where the numbers come from, in the footer of every reply. Keep it if you run
// a copy of this bot: it is how people in your server find the data.
export const CREDIT = 'Prices via alltcgapi.com';

/** Lines per market field: enough for the usual print languages, short enough to read in chat. */
export const MAX_LINES = 5;

/** Beyond this age a quote says how old it is, next to its date. */
export const STALE_DAYS = 7;

// Which figure stands for a market when a source publishes several. Cardmarket:
// the lowest near mint ask first, since that is what a buyer pays today.
// TCGplayer: the market price, which is computed from recent sales.
const CARDMARKET_ORDER = ['LOWEST_NEAR_MINT', 'LOWEST', 'TREND', 'AVG_7D', 'AVG_30D'];
const TCGPLAYER_ORDER = ['MARKET', 'LOWEST', 'LOWEST_NEAR_MINT', 'TREND', 'AVG_7D', 'AVG_30D'];

const LANGUAGES = ['en', 'ja', 'de', 'fr', 'it', 'es', 'pt', 'zh', 'ko'];
const PRINTINGS = ['NORMAL', 'HOLOFOIL', 'REVERSE_HOLO', 'FIRST_EDITION', 'FIRST_EDITION_HOLOFOIL'];

const VARIANT_LABEL: Readonly<Record<string, string>> = {
  LOWEST_NEAR_MINT: 'lowest NM ask',
  LOWEST: 'lowest ask',
  TREND: 'trend',
  AVG_7D: '7-day avg sale',
  AVG_30D: '30-day avg sale',
  MARKET: 'market',
};

const PRINTING_LABEL: Readonly<Record<string, string>> = {
  NORMAL: 'Normal',
  HOLOFOIL: 'Holofoil',
  REVERSE_HOLO: 'Reverse holo',
  FIRST_EDITION: '1st Edition',
  FIRST_EDITION_HOLOFOIL: '1st Ed. holofoil',
};

const DAY_MS = 86_400_000;

const rankOf = (order: readonly string[], value: string | null): number => {
  const i = value === null ? -1 : order.indexOf(value);
  return i === -1 ? order.length : i;
};

/** The preferred variant of a group and, among those, the newest quote. */
function pick(rows: readonly Quote[], order: readonly string[]): Quote | undefined {
  let best: Quote | undefined;
  for (const q of rows) {
    if (best === undefined) {
      best = q;
      continue;
    }
    const byVariant = rankOf(order, q.variant) - rankOf(order, best.variant);
    if (byVariant < 0 || (byVariant === 0 && q.as_of > best.as_of)) best = q;
  }
  return best;
}

function groupBy(rows: readonly Quote[], key: (q: Quote) => string): Map<string, Quote[]> {
  const groups = new Map<string, Quote[]>();
  for (const q of rows) {
    const k = key(q);
    groups.set(k, [...(groups.get(k) ?? []), q]);
  }
  return groups;
}

function line(label: string, q: Quote, now: number): string {
  const day = q.as_of.slice(0, 10);
  const age = Math.floor((now - Date.parse(q.as_of)) / DAY_MS);
  const stale = Number.isFinite(age) && age > STALE_DAYS ? ` (${age} days old)` : '';
  const variant = VARIANT_LABEL[q.variant] ?? q.variant.toLowerCase();
  // The currency comes from the row, never from the field name: a number is
  // printed next to the currency the API gave it, whatever the source.
  return `${label} **${q.price.amount.toFixed(2)} ${q.price.currency}** · ${variant} · ${day}${stale}`;
}

function lines(entries: readonly (readonly [string, Quote])[], now: number, more: string): string {
  if (entries.length === 0) return NO_QUOTE;
  const shown = entries.slice(0, MAX_LINES).map(([label, q]) => line(label, q, now));
  const hidden = entries.length - shown.length;
  return [...shown, ...(hidden > 0 ? [`+${hidden} more ${more}`] : [])].join('\n');
}

/**
 * Cardmarket, one line per print language: an English copy and a Japanese copy
 * of the same card are two listings with two prices, not one.
 */
export function europe(quotes: readonly Quote[], now: number = Date.now()): string {
  const rows = quotes.filter((q) => q.source === 'CARDMARKET');
  const entries = [...groupBy(rows, (q) => q.language)]
    .sort(([a], [b]) => rankOf(LANGUAGES, a) - rankOf(LANGUAGES, b) || a.localeCompare(b))
    .flatMap(([language, group]) => {
      const q = pick(group, CARDMARKET_ORDER);
      return q === undefined ? [] : [[language.toUpperCase(), q] as const];
    });
  return lines(entries, now, 'languages');
}

/**
 * TCGplayer, one line per language and printing: TCGplayer prices Normal and
 * Holofoil apart, and the difference is often the whole value of the card.
 */
export function unitedStates(quotes: readonly Quote[], now: number = Date.now()): string {
  const rows = quotes.filter((q) => q.source === 'TCGPLAYER');
  const entries = [...groupBy(rows, (q) => `${q.language}|${q.printing ?? ''}`)]
    .map(([, group]) => group)
    .sort((a, b) => {
      const [x, y] = [a[0], b[0]];
      if (x === undefined || y === undefined) return 0;
      return rankOf(LANGUAGES, x.language) - rankOf(LANGUAGES, y.language) || rankOf(PRINTINGS, x.printing) - rankOf(PRINTINGS, y.printing);
    })
    .flatMap((group) => {
      const q = pick(group, TCGPLAYER_ORDER);
      if (q === undefined) return [];
      const printing = q.printing === null ? '' : ` ${PRINTING_LABEL[q.printing] ?? q.printing}`;
      return [[`${q.language.toUpperCase()}${printing}`, q] as const];
    });
  return lines(entries, now, 'printings');
}

export function title(card: Pick<Card, 'name'>): string {
  return card.name;
}

export function subtitle(card: Pick<Card, 'game' | 'set' | 'number' | 'rarity'>): string {
  return `${gameName(card.game)} · ${card.set.name} (${card.set.code}) #${card.number}${card.rarity === null ? '' : ` · ${card.rarity}`}`;
}

export const FOOTER = `Nothing is converted: EUR and USD are two markets · ${CREDIT}`;

/** The embed as Discord's API takes it. A plain object, so it is testable as data. */
export interface Embed {
  readonly title: string;
  readonly description: string;
  // Mutable on purpose: discord.js types `fields` as a plain array.
  readonly fields: { readonly name: string; readonly value: string; readonly inline: boolean }[];
  readonly thumbnail?: { readonly url: string };
  readonly footer: { readonly text: string };
}

export function embed(card: Card, quotes: readonly Quote[], now: number = Date.now()): Embed {
  return {
    title: title(card).slice(0, 256),
    description: subtitle(card),
    // Inline fields sit side by side: the two markets read as two columns.
    fields: [
      { name: 'Cardmarket · EUR', value: europe(quotes, now), inline: true },
      { name: 'TCGplayer · USD', value: unitedStates(quotes, now), inline: true },
    ],
    ...(card.image_url === null ? {} : { thumbnail: { url: card.image_url } }),
    footer: { text: FOOTER },
  };
}

/**
 * One autocomplete choice. The label carries the game when the user did not
 * pick one, because "Elsa" exists in more than one game; the value is the
 * card id, so the command never has to guess.
 */
export function choice(card: Card, withGame: boolean): { name: string; value: string } {
  const game = withGame ? ` · ${gameShort(card.game)}` : '';
  return { name: `${card.name}${game} · ${card.set.name} #${card.number}`.slice(0, 100), value: card.id };
}

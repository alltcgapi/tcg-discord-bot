// What the bot does with an interaction, without Discord in the way: the
// autocomplete suggestions and the /price reply, both built from the API.
// bot.ts only passes the options in and the result out.

import { ApiError, type Api } from './api.ts';
import { choice, embed, type Embed } from './format.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Discord shows at most 25 choices. */
const CHOICES = 25;

export interface SuggestOptions {
  /** How long a typed prefix keeps its answer. */
  readonly ttlMs?: number;
  readonly now?: () => number;
}

/**
 * Autocomplete fires on every keystroke, and every search is a credit. Two
 * cheap brakes: nothing under two characters, and a minute of memory per typed
 * prefix and game, so a user who deletes a letter and types it again costs
 * nothing.
 */
export function suggester(api: Api, options: SuggestOptions = {}) {
  const ttl = options.ttlMs ?? 60_000;
  const now = options.now ?? Date.now;
  const cache = new Map<string, { until: number; choices: { name: string; value: string }[] }>();

  return async function suggest(typed: string, game: string | undefined): Promise<{ name: string; value: string }[]> {
    const prefix = typed.trim();
    if (prefix.length < 2) return [];
    const key = `${game ?? ''}|${prefix.toLowerCase()}`;
    const hit = cache.get(key);
    if (hit !== undefined && hit.until > now()) return hit.choices;

    const cards = await api.searchCards(prefix, game, CHOICES);
    const choices = cards.map((card) => choice(card, game === undefined));
    // A map with no ceiling is a leak that shows up after weeks.
    if (cache.size >= 1000) cache.clear();
    cache.set(key, { until: now() + ttl, choices });
    return choices;
  };
}

export type Reply = { readonly kind: 'embed'; readonly embed: Embed } | { readonly kind: 'text'; readonly text: string };

export interface ReplyOptions {
  readonly now?: number;
  /** Where the API's error code goes: the user reads a sentence, the admin needs the code. */
  readonly log?: (message: string) => void;
}

/**
 * The /price reply.
 *
 * The value is normally a card id, picked from the autocomplete. When the user
 * pressed enter on free text instead, the bot searches it: one match is that
 * card, several are a list to pick from, because pricing the wrong printing
 * with two decimals is worse than asking.
 */
export async function priceReply(api: Api, value: string, game: string | undefined, options: ReplyOptions = {}): Promise<Reply> {
  const now = options.now ?? Date.now();
  const log = options.log ?? ((message: string) => console.error(message));
  const typed = value.trim();
  try {
    if (UUID.test(typed)) {
      // The id is known, so the card and its quotes are two independent calls.
      const [card, quotes] = await Promise.all([api.card(typed), api.prices(typed)]);
      return { kind: 'embed', embed: embed(card, quotes, now) };
    }
    const matches = await api.searchCards(typed, game, 5);
    const [card] = matches;
    if (card === undefined) {
      return { kind: 'text', text: `No card name starts with "${typed}"${game === undefined ? '' : ' in that game'}. Start typing and pick one from the list.` };
    }
    if (matches.length > 1) {
      const list = matches.map((c) => `• ${choice(c, game === undefined).name}`).join('\n');
      return { kind: 'text', text: `Several cards start with "${typed}". Pick one from the list while typing:\n${list}` };
    }
    const quotes = await api.prices(card.id);
    return { kind: 'embed', embed: embed(card, quotes, now) };
  } catch (error) {
    log(`[price] ${typed}: ${error instanceof Error ? error.message : String(error)}`);
    return { kind: 'text', text: errorText(error) };
  }
}

/** What a user in chat can act on. The API key and its plan stay the admin's business. */
export function errorText(error: unknown): string {
  if (error instanceof ApiError) {
    switch (error.code) {
      case 'RATE_LIMITED':
      case 'CONCURRENCY_LIMIT':
        return `Too many lookups right now. Try again in ${error.retryAfter ?? 1} s.`;
      case 'CARD_NOT_FOUND':
        return 'That card is not in the catalogue. Start typing and pick one from the list.';
      case 'TRIAL_EXPIRED':
      case 'QUOTA_EXCEEDED':
        return 'The bot has used up its API allowance. Tell the server admin.';
      case 'MISSING_API_KEY':
      case 'INVALID_API_KEY':
      case 'KEY_REVOKED':
      case 'KEY_EXPIRED':
        return 'The bot is not configured with a working API key. Tell the server admin.';
      default:
        return `Could not price this card (${error.code}).`;
    }
  }
  return 'Could not reach the price service. Try again in a moment.';
}

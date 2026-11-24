import type { Card, Quote } from '../src/api.ts';

export const NOW = Date.parse('2026-11-19T12:00:00Z');
export const CARD_ID = '01d3a5f3-18df-4520-ac0b-4449c077f179';

export function card(overrides: Partial<Card> = {}): Card {
  return {
    id: CARD_ID,
    game: 'onepiece',
    set: { id: '95435c34-0000-4000-8000-000000000001', code: 'OP11', name: 'A Fist of Divine Speed' },
    number: 'OP11-095',
    name: 'Monkey.D.Garp',
    rarity: 'SUPER RARE',
    image_url: 'https://media.alltcgapi.com/onepiece/OP11-095.webp',
    ...overrides,
  };
}

export function quote(source: string, variant: string, amount: number, currency: string, asOf: string, extra: Partial<Quote> = {}): Quote {
  return { source, variant, language: 'en', condition: null, printing: null, region: null, price: { amount, currency }, as_of: asOf, ...extra };
}

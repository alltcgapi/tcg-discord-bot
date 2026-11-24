// The reply contract, as data: what a user in a Discord channel reads.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CREDIT, MAX_LINES, NO_QUOTE, choice, embed, europe, unitedStates } from '../src/format.ts';
import { GAMES } from '../src/games.ts';
import { NOW, card, quote } from './fixtures.ts';

test('EUR and USD sit in two inline fields, never in one figure', () => {
  const e = embed(card(), [
    quote('CARDMARKET', 'LOWEST_NEAR_MINT', 12.5, 'EUR', '2026-11-18T06:00:00Z'),
    quote('TCGPLAYER', 'MARKET', 14.2, 'USD', '2026-11-18T06:00:00Z', { printing: 'NORMAL' }),
  ], NOW);
  assert.deepEqual(e.fields.map((f) => [f.name, f.inline]), [['Cardmarket · EUR', true], ['TCGplayer · USD', true]]);
  assert.equal(e.fields[0]?.value, 'EN **12.50 EUR** · lowest NM ask · 2026-11-18');
  assert.equal(e.fields[1]?.value, 'EN Normal **14.20 USD** · market · 2026-11-18');
  assert.doesNotMatch(JSON.stringify(e), /26\.7|total|≈/);
});

test('title, set line, image and the credit', () => {
  const e = embed(card(), [], NOW);
  assert.equal(e.title, 'Monkey.D.Garp');
  assert.equal(e.description, 'One Piece Card Game · A Fist of Divine Speed (OP11) #OP11-095 · SUPER RARE');
  assert.equal(e.thumbnail?.url, 'https://media.alltcgapi.com/onepiece/OP11-095.webp');
  assert.ok(e.footer.text.endsWith(CREDIT));
  assert.equal(embed(card({ image_url: null }), [], NOW).thumbnail, undefined);
});

test('no quote is said as such, per market', () => {
  const e = embed(card(), [quote('CARDMARKET', 'TREND', 3, 'EUR', '2026-11-18T06:00:00Z')], NOW);
  assert.equal(e.fields[1]?.value, NO_QUOTE);
});

test('Cardmarket: one line per language, the near mint ask first, the newest of a variant', () => {
  const value = europe([
    quote('CARDMARKET', 'TREND', 30, 'EUR', '2026-11-18T06:00:00Z', { language: 'ja' }),
    quote('CARDMARKET', 'LOWEST_NEAR_MINT', 10, 'EUR', '2026-11-10T06:00:00Z'),
    quote('CARDMARKET', 'LOWEST_NEAR_MINT', 11, 'EUR', '2026-11-18T06:00:00Z'),
    quote('CARDMARKET', 'TREND', 99, 'EUR', '2026-11-18T06:00:00Z'),
    quote('TCGPLAYER', 'MARKET', 5, 'USD', '2026-11-18T06:00:00Z'),
  ], NOW);
  assert.equal(value, 'EN **11.00 EUR** · lowest NM ask · 2026-11-18\nJA **30.00 EUR** · trend · 2026-11-18');
});

test('TCGplayer: Normal and Holofoil are two lines', () => {
  const value = unitedStates([
    quote('TCGPLAYER', 'MARKET', 80, 'USD', '2026-11-18T06:00:00Z', { printing: 'HOLOFOIL' }),
    quote('TCGPLAYER', 'LOWEST', 4, 'USD', '2026-11-18T06:00:00Z', { printing: 'NORMAL' }),
    quote('TCGPLAYER', 'MARKET', 5, 'USD', '2026-11-18T06:00:00Z', { printing: 'NORMAL' }),
  ], NOW);
  assert.equal(value, 'EN Normal **5.00 USD** · market · 2026-11-18\nEN Holofoil **80.00 USD** · market · 2026-11-18');
});

test('an old quote says how old it is, next to its date', () => {
  const value = europe([quote('CARDMARKET', 'LOWEST_NEAR_MINT', 2, 'EUR', '2026-11-01T06:00:00Z')], NOW);
  assert.match(value, /2026-11-01 \(18 days old\)$/);
});

test('the currency printed is the one on the row', () => {
  // A source that one day quotes in another currency must not be relabelled EUR.
  const value = europe([quote('CARDMARKET', 'LOWEST_NEAR_MINT', 2, 'GBP', '2026-11-18T06:00:00Z')], NOW);
  assert.match(value, /\*\*2\.00 GBP\*\*/);
});

test('long lists stop at MAX_LINES and say how many are left', () => {
  const langs = ['en', 'ja', 'de', 'fr', 'it', 'es', 'pt'];
  const value = europe(langs.map((language) => quote('CARDMARKET', 'LOWEST_NEAR_MINT', 1, 'EUR', '2026-11-18T06:00:00Z', { language })), NOW);
  const rows = value.split('\n');
  assert.equal(rows.length, MAX_LINES + 1);
  assert.equal(rows.at(-1), '+2 more languages');
  assert.ok(value.length <= 1024, 'Discord refuses a field value over 1024 characters');
});

test('autocomplete label: the game only when none was picked, value is the card id, at most 100 chars', () => {
  assert.deepEqual(choice(card(), true), { name: 'Monkey.D.Garp · One Piece · A Fist of Divine Speed #OP11-095', value: card().id });
  assert.equal(choice(card(), false).name, 'Monkey.D.Garp · A Fist of Divine Speed #OP11-095');
  assert.equal(choice(card({ name: 'x'.repeat(200) }), true).name.length, 100);
});

test('the game picker holds the nineteen ids, within the 25 choices Discord allows', () => {
  assert.equal(GAMES.length, 19);
  assert.equal(new Set(GAMES.map((g) => g.id)).size, 19);
  for (const g of GAMES) assert.ok(g.name.length <= 100 && g.short.length <= 20, g.id);
});

// The bot against a stubbed API: which calls it makes, and what it answers.
import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { Api } from '../src/api.ts';
import { price } from '../src/command.ts';
import { errorText, priceReply, suggester } from '../src/handlers.ts';
import { CARD_ID, NOW, card, quote } from './fixtures.ts';

type Route = (url: URL) => unknown;

function fakeApi(t: TestContext, route: Route): { api: Api; seen: URL[]; keys: (string | undefined)[] } {
  const seen: URL[] = [];
  const keys: (string | undefined)[] = [];
  t.mock.method(globalThis, 'fetch', async (input: string | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    seen.push(url);
    keys.push((init?.headers as Record<string, string> | undefined)?.['x-api-key']);
    const out = route(url);
    return out instanceof Response ? out : Response.json(out);
  });
  return { api: new Api('http://api.test', 'atcg_live_test'), seen, keys };
}

const quiet = { now: NOW, log: () => undefined };

const errorBody = (code: string, message: string) => ({ error: { code, message, request_id: 'req_1' } });

test('/price: an autocompleted card and a game option with 19 fixed choices', () => {
  const json = price.toJSON();
  assert.equal(json.name, 'price');
  const [cardOption, gameOption] = (json.options ?? []) as { name: string; required?: boolean; autocomplete?: boolean; choices?: unknown[] }[];
  assert.equal(cardOption?.name, 'card');
  assert.equal(cardOption?.autocomplete, true);
  assert.equal(cardOption?.required, true);
  assert.equal(gameOption?.name, 'game');
  assert.equal(gameOption?.choices?.length, 19);
});

test('autocomplete: the picked game reaches the search, the key is sent, 25 rows asked', async (t) => {
  const { api, seen, keys } = fakeApi(t, () => ({ data: [card()] }));
  const choices = await suggester(api)('garp', 'onepiece');
  assert.equal(seen[0]?.pathname, '/v1/cards');
  assert.deepEqual(Object.fromEntries(seen[0]?.searchParams ?? []), { name: 'garp', game: 'onepiece', limit: '25' });
  assert.equal(keys[0], 'atcg_live_test');
  assert.deepEqual(choices, [{ name: 'Monkey.D.Garp · A Fist of Divine Speed #OP11-095', value: CARD_ID }]);
});

test('autocomplete without a game spans every game and labels each choice with it', async (t) => {
  const { api, seen } = fakeApi(t, () => ({ data: [card()] }));
  const [only] = await suggester(api)('garp', undefined);
  assert.equal(seen[0]?.searchParams.has('game'), false);
  assert.match(only?.name ?? '', /· One Piece ·/);
});

test('autocomplete: nothing under two characters, and a typed prefix is remembered for a minute', async (t) => {
  let clock = NOW;
  const { api, seen } = fakeApi(t, () => ({ data: [card()] }));
  const suggest = suggester(api, { now: () => clock });
  assert.deepEqual(await suggest('g', undefined), []);
  await suggest('Garp', 'onepiece');
  await suggest('garp ', 'onepiece');
  assert.equal(seen.length, 1);
  await suggest('garp', 'lorcana');
  assert.equal(seen.length, 2, 'another game is another search');
  clock += 61_000;
  await suggest('garp', 'onepiece');
  assert.equal(seen.length, 3);
});

test('/price with a picked card: the card and its quotes, two calls', async (t) => {
  const { api, seen } = fakeApi(t, (u) =>
    u.pathname.endsWith('/prices')
      ? { data: [quote('CARDMARKET', 'LOWEST_NEAR_MINT', 12.5, 'EUR', '2026-11-18T06:00:00Z')] }
      : { data: card() },
  );
  const reply = await priceReply(api, CARD_ID, undefined, quiet);
  assert.deepEqual(seen.map((u) => u.pathname), [`/v1/cards/${CARD_ID}`, `/v1/cards/${CARD_ID}/prices`]);
  assert.equal(reply.kind, 'embed');
  if (reply.kind === 'embed') assert.match(reply.embed.fields[0]?.value ?? '', /12\.50 EUR/);
});

test('/price with free text: one match is priced, several are listed, none is said', async (t) => {
  let matches = [card()];
  const { api, seen } = fakeApi(t, (u) => (u.pathname === '/v1/cards' ? { data: matches } : { data: [] }));

  const one = await priceReply(api, 'monkey.d.garp', 'onepiece', quiet);
  assert.equal(one.kind, 'embed');
  assert.deepEqual(Object.fromEntries(seen[0]?.searchParams ?? []), { name: 'monkey.d.garp', game: 'onepiece', limit: '5' });
  assert.equal(seen[1]?.pathname, `/v1/cards/${CARD_ID}/prices`);

  matches = [card(), card({ id: 'b0000000-0000-4000-8000-000000000002', set: { id: 'x', code: 'ST21', name: 'Gear 5' } })];
  const several = await priceReply(api, 'monkey', undefined, quiet);
  assert.equal(several.kind, 'text');
  if (several.kind === 'text') assert.match(several.text, /Several cards start with "monkey"[\s\S]*• Monkey\.D\.Garp · One Piece · Gear 5 #OP11-095/);

  matches = [];
  const none = await priceReply(api, 'zzz', 'onepiece', quiet);
  assert.equal(none.kind, 'text');
  if (none.kind === 'text') assert.match(none.text, /No card name starts with "zzz" in that game/);
});

test('/price: a 429 says how long to wait, from Retry-After', async (t) => {
  const { api } = fakeApi(t, () =>
    Response.json(errorBody('RATE_LIMITED', 'Rate limit exceeded.'), { status: 429, headers: { 'retry-after': '3' } }),
  );
  const reply = await priceReply(api, CARD_ID, undefined, quiet);
  assert.deepEqual(reply, { kind: 'text', text: 'Too many lookups right now. Try again in 3 s.' });
});

test('/price: account problems go to the admin, not to the user in chat', async (t) => {
  const { api } = fakeApi(t, () => Response.json(errorBody('TRIAL_EXPIRED', 'Choose a plan at /v1/billing/plans.'), { status: 403 }));
  const logged: string[] = [];
  const reply = await priceReply(api, CARD_ID, undefined, { now: NOW, log: (m) => logged.push(m) });
  assert.deepEqual(reply, { kind: 'text', text: 'The bot has used up its API allowance. Tell the server admin.' });
  // The code reaches the process log, where the admin looks.
  assert.match(logged[0] ?? '', /TRIAL_EXPIRED/);
});

test('a network failure is not dressed up as an API error', () => {
  assert.match(errorText(new TypeError('fetch failed')), /Could not reach the price service/);
});

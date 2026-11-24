# alltcgapi Discord bot

A `/price` command for Discord that answers with the current Cardmarket (EUR) and TCGplayer (USD)
prices of a card, side by side, for any of the 19 games [alltcgapi](https://alltcgapi.com) covers.
TypeScript on discord.js, about 500 lines plus the tests. Run it as is or copy it into your
own bot.

```
/price card:Monkey.D.Garp game:One Piece Card Game
```

```
Monkey.D.Garp
One Piece Card Game · A Fist of Divine Speed (OP11) #OP11-095 · SUPER RARE

Cardmarket · EUR                                TCGplayer · USD
EN 12.50 EUR · lowest NM ask · 2026-11-18       EN Normal 14.20 USD · market · 2026-11-18
JA 30.00 EUR · trend · 2026-11-18

Nothing is converted: EUR and USD are two markets · Prices via alltcgapi.com
```

The card image is the embed thumbnail.

## The command

`/price card:<name> [game:<game>]`

- `card` autocompletes from the API while you type. Each choice is one printing (name, set and
  number), and its value is the card id, so the bot prices the printing you picked rather than
  guessing among cards that share a name.
- `game` is optional, a fixed list of the 19 games. Pick it first and the suggestions come from that
  game only. Without it they span every game and each one says which game it is from.
- Pressing enter on free text works too: one match is priced, several come back as a list to pick
  from, none says so.

## Three decisions

1. **Two markets, two columns, no arithmetic.** Cardmarket quotes are in EUR, TCGplayer quotes in
   USD. They are printed in two inline fields and never added, averaged or converted. The currency
   on each line is the one the API returned for that row, not the field's title.
2. **Every number carries where and when.** Each line has the language or printing, what kind of
   figure it is (lowest near mint ask, trend, market) and the date it was observed. A quote older
   than seven days says how old it is.
3. **One line per market segment.** Cardmarket lists an English and a Japanese copy apart, so the
   bot prints one line per language. TCGplayer prices Normal and Holofoil apart, so it prints one
   line per printing. Within a line it picks the most useful figure: on Cardmarket the lowest near
   mint ask, then lowest, trend, 7-day and 30-day averages; on TCGplayer the market price first. At
   most five lines per market; the rest is counted.

## Quick start

1. Create the Discord application and invite the bot: [docs/create-the-discord-app.md](docs/create-the-discord-app.md).
2. Get an alltcgapi key at [alltcgapi.com/free-api-key](https://alltcgapi.com/free-api-key): the
   page creates the account and shows the key once.
3. Configure and run:

```bash
cp .env.example .env   # fill in DISCORD_TOKEN, DISCORD_APP_ID, ALLTCG_API_KEY
npm ci
npm start
```

Node 22.6 or newer: the bot runs its TypeScript directly with `--experimental-strip-types`, with no
build step.

| Variable | Required | |
|---|---|---|
| `DISCORD_TOKEN` | yes | the bot token |
| `DISCORD_APP_ID` | yes | the application id |
| `DISCORD_GUILD_ID` | no | register on one server at once; empty registers globally (up to an hour) |
| `ALLTCG_API_KEY` | yes | the alltcgapi key, `atcg_live_…` |
| `ALLTCG_BASE_URL` | no | defaults to `https://api.alltcgapi.com` |

## What it costs

Every API call spends credits on the key's account: a search is 1 credit, a card is 1, its prices
are 2. A `/price` from the autocomplete is therefore 3 credits, plus the searches made while typing.
Autocomplete fires on every keystroke, so the bot waits for two characters and remembers each typed
prefix for a minute per game. A bot in a busy server should run on a key whose plan fits it.

When the API answers 429, the user reads how many seconds to wait. When the key has used up its
allowance or stopped working, the user is told to ask the server admin; plan details are not shown
in the channel.

## Layout

| File | |
|---|---|
| `src/bot.ts` | the Discord wiring: command registration, autocomplete, the reply |
| `src/command.ts` | the `/price` definition |
| `src/handlers.ts` | autocomplete suggestions and the reply, without Discord in the way |
| `src/format.ts` | every string of the embed, as plain data |
| `src/api.ts` | a fetch client for the three routes the bot reads |
| `src/games.ts` | the 19 game ids and their names |

```bash
npm run typecheck
npm test
```

The tests run against a stubbed API and need no Discord connection.

## Not in this bot

The bot shows current prices only. The API also serves price history, which this bot does not
use. Graded prices and recognition of a card from a photo are not in the API.

## Licence

MIT. Keep the "Prices via alltcgapi.com" footer if you run a copy: it is how people in your server
find where the numbers come from.

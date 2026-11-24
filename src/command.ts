// The /price command, as Discord registers it.

import { SlashCommandBuilder } from 'discord.js';
import { GAMES } from './games.ts';

export const price = new SlashCommandBuilder()
  .setName('price')
  .setDescription('Cardmarket (EUR) and TCGplayer (USD) prices for a card')
  // `card` autocompletes: the user picks a printing while typing, so the
  // handler receives a card id and never has to guess which "Charizard".
  .addStringOption((o) =>
    o.setName('card').setDescription('Card name: pick one from the list').setRequired(true).setAutocomplete(true),
  )
  // `game` is a fixed list. Set it first and the card suggestions come from
  // that game only; leave it out and they span every game, labelled with it.
  .addStringOption((o) =>
    o
      .setName('game')
      .setDescription('Narrow the card list to one game')
      .setRequired(false)
      .addChoices(...GAMES.map((g) => ({ name: g.name, value: g.id }))),
  );

// A Discord /price command for 19 trading card games, on the alltcgapi REST API.
//
// Three decisions, explained in ../README.md:
//   1. autocomplete picks the printing, so the handler receives a card id;
//   2. two markets, two fields, no arithmetic: EUR and USD stay apart;
//   3. every line carries its source and its date.

import { Client, GatewayIntentBits, REST, Routes } from 'discord.js';
import { Api } from './api.ts';
import { price } from './command.ts';
import { priceReply, suggester } from './handlers.ts';

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set. Copy .env.example to .env and fill it in.`);
  return value;
}

const token = env('DISCORD_TOKEN');
const appId = env('DISCORD_APP_ID');
// With a guild id the command appears at once in that server; without, it is
// registered globally, which Discord takes up to an hour to propagate.
const guildId = process.env['DISCORD_GUILD_ID'];

const api = new Api(process.env['ALLTCG_BASE_URL'], env('ALLTCG_API_KEY'));
const suggest = suggester(api);
// Slash commands need only the Guilds intent: no message content, nothing privileged.
const bot = new Client({ intents: [GatewayIntentBits.Guilds] });

await new REST({ version: '10' }).setToken(token).put(
  guildId ? Routes.applicationGuildCommands(appId, guildId) : Routes.applicationCommands(appId),
  { body: [price.toJSON()] },
);

bot.on('interactionCreate', async (interaction) => {
  if (interaction.isAutocomplete() && interaction.commandName === 'price') {
    const focused = interaction.options.getFocused(true);
    if (focused.name !== 'card') return interaction.respond([]).catch(() => undefined);
    const game = interaction.options.getString('game') ?? undefined;
    // Discord gives autocomplete 3 seconds; a failed or late answer is an empty
    // list, not a crash.
    const choices = await suggest(focused.value, game).catch(() => []);
    return interaction.respond(choices).catch(() => undefined);
  }
  if (!interaction.isChatInputCommand() || interaction.commandName !== 'price') return;

  try {
    // Deferring buys fifteen minutes instead of three seconds.
    await interaction.deferReply();
    const reply = await priceReply(api, interaction.options.getString('card', true), interaction.options.getString('game') ?? undefined);
    await interaction.editReply(reply.kind === 'embed' ? { embeds: [reply.embed] } : { content: reply.text });
  } catch (error) {
    // An interaction Discord already expired, a channel the bot cannot post in:
    // log it and keep serving the others. A rejected listener would end the process.
    console.error('[price] reply failed:', error);
  }
});

bot.once('clientReady', () => console.log(`Logged in as ${bot.user?.tag}. Type /price in your server.`));
await bot.login(token);

// The games the API serves, with the id it takes in `game=`. Nineteen fit in
// one Discord choice list (the limit is 25), so the `game` option is a picker
// the user filters by typing, and a wrong id is impossible.

export const GAMES = [
  { id: 'pokemon', name: 'Pokémon TCG', short: 'Pokémon' },
  { id: 'yugioh', name: 'Yu-Gi-Oh! Trading Card Game', short: 'Yu-Gi-Oh!' },
  { id: 'onepiece', name: 'One Piece Card Game', short: 'One Piece' },
  { id: 'lorcana', name: 'Disney Lorcana', short: 'Lorcana' },
  { id: 'digimon', name: 'Digimon Card Game', short: 'Digimon' },
  { id: 'dragonball-fw', name: 'Dragon Ball Super Card Game Fusion World', short: 'Fusion World' },
  { id: 'fab', name: 'Flesh and Blood', short: 'Flesh and Blood' },
  { id: 'swu', name: 'Star Wars: Unlimited', short: 'SW Unlimited' },
  { id: 'weissschwarz', name: 'Weiss Schwarz', short: 'Weiss Schwarz' },
  { id: 'vanguard', name: 'Cardfight!! Vanguard', short: 'Vanguard' },
  { id: 'riftbound', name: 'Riftbound', short: 'Riftbound' },
  { id: 'gundam', name: 'Gundam Card Game', short: 'Gundam' },
  { id: 'fftcg', name: 'Final Fantasy Trading Card Game', short: 'Final Fantasy' },
  { id: 'fow', name: 'Force of Will', short: 'Force of Will' },
  { id: 'dragonball-masters', name: 'Dragon Ball Super Card Game Masters', short: 'DB Masters' },
  { id: 'battlespirits', name: 'Battle Spirits Saga', short: 'Battle Spirits' },
  { id: 'cyberpunk', name: 'Cyberpunk TCG', short: 'Cyberpunk' },
  { id: 'swdestiny', name: 'Star Wars: Destiny', short: 'SW Destiny' },
  { id: 'dragoborne', name: 'Dragoborne: Rise to Supremacy', short: 'Dragoborne' },
] as const;

export const gameName = (id: string): string => GAMES.find((g) => g.id === id)?.name ?? id;
export const gameShort = (id: string): string => GAMES.find((g) => g.id === id)?.short ?? id;

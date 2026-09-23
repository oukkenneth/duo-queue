const asset = (path) => `${import.meta.env.BASE_URL}assets/${path}`;
// Replace files at these paths, or point a slot at a new relative asset filename.
export const ASSETS = {
  audio: { queuePop: asset('audio/league_queue_pop.mp3') },
  characters: { choncc: asset('characters/choncc.png'), doughcat: asset('characters/doughcat.png'), hero: asset('characters/hero.png'), accepted: asset('characters/accepted-autumn.png') },
  backgrounds: { invite: null, autumn: null },
  decor: { duck: null, autumnLeaves: null, petals: null, sparkles: null, floralArch: null },
  icons: Object.fromEntries(['queue', 'calendar', 'party', 'location'].map(name => [name, asset(`icons/${name}.svg`)])),
};
export const THEME = { loadingMs: 4200, declineMessages: ['you sure??', 'nahh thats crazy?', 'damn okay 😭'] };



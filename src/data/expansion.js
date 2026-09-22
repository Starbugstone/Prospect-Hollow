import { LATE_LEVELS } from './lateLevels.js';
// Seven columns, nine rows. Side columns stay open so barriers can always
// be approached. # = stone, X = reinforced stone, c = chain,
// r/b/g = ruby/sapphire/emerald seal, R = relic, E = bottom exit.
// Ice is seeded around these authored structures. Each chapter has a breather
// in its fifth puzzle and a finale in its sixth. Five active colors leave room
// to learn chains, seals and delivery goals without blanket layers of ice.
import { CITY_LEVELS } from './cityLevels.js';
import { MOTOR_LEVELS } from './motorLevels.js';
export const EXPANSION_LEVELS = [
  {
    map: '......./......./......./...#.../......./......./......./......./.......',
    ice: 56,
    tip: 'One more row to explore. Open the stone barrier to keep the cascades flowing.',
  },
  {
    map: '......./......./.##..../......./....##./......./...#.../......./.......',
    ice: 60,
    tip: 'Open the staggered stone shelves. Each gap reconnects a column.',
  },
  {
    map: '......./......./..#.#../......./.X...X./......./..#.#../......./.......',
    ice: 64,
    tip: 'Work into the ice pockets from the open columns. Banded stone takes two hits.',
  },
  {
    map: '......./......./.XX..../......./...XX../......./..XX.../......./.......',
    ice: 68,
    tip: 'Choose which passage to open first. Cross fire can reach several shelves.',
  },
  {
    map: '......./......./......./.#...#./......./......./......./......./.......',
    ice: 52,
    tip: 'A clearing in the depths. Use the open space to build bonuses and chase cascades.',
  },
  {
    map: '......./......./.XX.XX./......./...X.../......./.XX.XX./......./.......',
    ice: 72,
    tip: 'Open the heart of the mountain. Use the middle and side columns to reach every vault.',
  },
  {
    map: '......./......./......./..c.c../......./......./......./......./.......',
    ice: 62,
    tip: 'Chained gems stay in place. Include them in a match, or hit them with a bonus to break the chain.',
  },
  {
    map: '......./......./..c.c../......./...c.../......./..c.c../......./.......',
    ice: 66,
    tip: 'Gems can fall past a chain. Bring matching colors to the pinned gem.',
  },
  {
    map: '......./......./.#...#./......./..c.c../......./.c...c./......./.......',
    ice: 70,
    tip: 'Break each chain, then match on the ice beneath it. One hit removes one layer.',
  },
  {
    map: '......./......./.X.c.X./......./..c.c../......./.X.c.X./......./.......',
    ice: 74,
    tip: 'Stone and chains guard the vault. Open a column before clearing the gems below it.',
  },
  {
    map: '......./......./......./.c.c.c./......./......./......./......./.......',
    ice: 58,
    tip: 'Break free. Include chained gems in your matches to release them.',
  },
  {
    map: '......./......./.cX.Xc./......./..c.c../......./.Xc.cX./......./.......',
    ice: 78,
    tip: 'Free every link and clear the vault. Build bonuses in the open lanes.',
  },
  {
    map: '......./......./......./..r.r../......./...r.../......./......./.......',
    ice: 64,
    tip: 'Ruby seals: match red ruby gems on the R marks. A bonus hit opens any seal.',
  },
  {
    map: '......./......./..r.b../......./...b.../......./..b.r../......./.......',
    ice: 68,
    tip: 'R means ruby; S means sapphire. Bring the marked color onto each seal and match it.',
  },
  {
    map: '......./......./.r.g.b./......./...g.../......./.b.g.r./......./.......',
    ice: 72,
    tip: 'R: ruby. S: sapphire. E: emerald. Match the marked color on a seal, or use a bonus.',
  },
  {
    map: '......./......./.X.r.X./......./.b.g.b./......./.#.r.#./......./.......',
    ice: 76,
    tip: 'Open the stone chambers, then guide the right colors onto their seals.',
  },
  {
    map: '......./......./......./..r.g../......./..g.b../......./......./.......',
    ice: 60,
    tip: 'Let the prism bloom. Create a bonus to open several colored seals together.',
  },
  {
    map: '......./......./.Xr.bX./......./.b.g.r./......./.Xg.rX./......./.......',
    ice: 80,
    tip: 'Unlock every chamber. Save a well-placed bonus for the hardest seals to reach.',
  },
  {
    map: '......./...R.../......./......./......./......./......./......./...E...',
    ice: 60,
    tip: 'Drop the golden relic through its glowing bottom exit. Relics cannot swap or be blasted away.',
  },
  {
    map: '......./..R.R../......./......./......./......./......./......./..E.E..',
    ice: 64,
    tip: 'Clear beneath both relics to guide them down. Collect both and clear the remaining ice.',
  },
  {
    map: '......./..R.R../......./..#.#../......./..X.X../......./......./..E.E..',
    ice: 68,
    tip: 'Break the stone beneath the relics. Each open column brings the treasure closer to its exit.',
  },
  {
    map: '......./..R.R../......./..c.c../......./.c...c./......./......./..E.E..',
    ice: 72,
    tip: 'Match the chained gems, and clear beneath the relics to reach the exits.',
  },
  {
    map: '......./.R.R.R./......./......./......./......./......./......./.E.E.E.',
    ice: 56,
    tip: 'Three treasures, open paths. A cross or bomb beneath the relics can bring them home together.',
  },
  {
    map: '......./..RRR../......./.#...#./......./..c.c../......./......./..EEE..',
    ice: 76,
    tip: 'The great discovery: free the chains, break the stone, collect all three relics and clear the ice.',
  },
  {
    map: '......./......./..c..../......./....c../......./..c..../......./.......',
    ice: 64,
    tip: 'Follow the river seam. Match the chained gems along its banks.',
  },
  {
    map: '......./......./.#..c../......./...#.../......./..c..#./......./.......',
    ice: 68,
    tip: 'Open the winding passage from either bank.',
  },
  {
    map: '......./......./..r.b../......./...c.../......./..b.r../......./.......',
    ice: 72,
    tip: 'Match ruby and sapphire seals to uncover the riverbank crystals.',
  },
  {
    map: '......./..R..../......./.X...X./......./..c.c../......./......./..E....',
    ice: 76,
    tip: 'Clear the landing below the relic and guide it to the exit.',
  },
  {
    map: '......./......./......./..c.c../......./......./......./......./.......',
    ice: 60,
    tip: 'A quiet stretch of water leaves room for long cascades.',
  },
  {
    map: '......./..RR.../......./.X...X./......./..r.b../......./......./..EE...',
    ice: 80,
    tip: 'Open the river route. Two discoveries mark a new chapter for town.',
  },
  {
    map: '......./......./..c.c../......./...#.../......./......./......./.......',
    ice: 68,
    tip: 'Connect the galleries by clearing the central crossing.',
  },
  {
    map: '......./......./.#...#./......./..c.c../......./......./......./.......',
    ice: 72,
    tip: 'Work beside timber and iron to open the freight passage.',
  },
  {
    map: '......./..R..../......./..c..../......./...r.../......./......./..E....',
    ice: 76,
    tip: 'Guide the freight relic through its open column.',
  },
  {
    map: '......./......./..r.b../......./.X.c.X./......./..b.r../......./.......',
    ice: 80,
    tip: 'Open the colored switches and release the chained center.',
  },
  {
    map: '......./......./......./.#...#./......./......./......./......./.......',
    ice: 64,
    tip: 'An open platform makes room to prepare the next cascade.',
  },
  {
    map: '......./..RR.../......./.c...c./......./..r.b../......./......./..EE...',
    ice: 84,
    tip: 'Deliver both relics to complete the river and rail discoveries.',
  },
  {
    map: '......./......./......./..c.c../......./......./......./......./.......',
    ice: 60,
    tip: 'Open the workshop entrance. Include the two chained gems in your matches.',
  },
  {
    map: '......./......./..#..../......./....c../......./..#..../......./.......',
    ice: 64,
    tip: 'Clear a passage between the workshop shelves.',
  },
  {
    map: '......./......./.c...c./......./...#.../......./..c.c../......./.......',
    ice: 68,
    tip: 'Free the outer chains before working into the center.',
  },
  {
    map: '......./......./.X...X./......./..c.c../......./...c.../......./.......',
    ice: 72,
    tip: 'Break the reinforced shelves and reconnect the galleries.',
  },
  {
    map: '......./......./......./...c.../......./......./......./......./.......',
    ice: 56,
    tip: 'A quiet workshop leaves room for a long cascade.',
  },
  {
    map: '......./..R.R../......./..c.c../......./.#...#./......./......./..E.E..',
    ice: 76,
    tip: 'Deliver the workshop treasures through the open shafts.',
  },
  {
    map: '......./......./......./..r.b../......./......./......./......./.......',
    ice: 62,
    tip: 'Ruby and sapphire seals mark the copper gallery entrance.',
  },
  {
    map: '......./......./..r..../......./....b../......./..c..../......./.......',
    ice: 66,
    tip: 'Follow the copper seam from one seal to the next.',
  },
  {
    map: '......./..R..../......./.#...#./......./...b.../......./......./..E....',
    ice: 70,
    tip: 'Clear the central gallery and bring its treasure home.',
  },
  {
    map: '......./......./.X.r.X./......./..c.c../......./...b.../......./.......',
    ice: 74,
    tip: 'Open the side approaches to reach both colored seals.',
  },
  {
    map: '......./......./......./..r.b../......./......./......./......./.......',
    ice: 58,
    tip: 'An open copper chamber gives you room to build bonuses.',
  },
  {
    map: '......./..RR.../......./.#...#./......./..r.b../......./......./..EE...',
    ice: 78,
    tip: 'Two relics complete the copper discoveries.',
  },
  {
    map: '......./......./......./..c.c../......./...r.../......./......./.......',
    ice: 64,
    tip: 'Open the first powerhouse chamber with chains and one ruby seal.',
  },
  {
    map: '......./......./.#...#./......./..r.b../......./......./......./.......',
    ice: 68,
    tip: 'Connect the bright chambers through the open middle.',
  },
  {
    map: '......./..R..../......./..c..../......./....b../......./......./..E....',
    ice: 72,
    tip: 'Free the treasure shaft and clear the remaining seal.',
  },
  {
    map: '......./......./.X...X./......./..r.b../......./..c.c../......./.......',
    ice: 76,
    tip: 'Build a bonus in the open lanes to reach the deeper chambers.',
  },
  {
    map: '......./......./......./...#.../......./......./......./......./.......',
    ice: 60,
    tip: 'A moment of calm before the town celebration.',
  },
  {
    map: '......./..RR.../......./.c...c./......./..r.b../......./......./..EE...',
    ice: 80,
    tip: 'Bring both discoveries home. Prospect Hollow is ready to shine.',
  },
  {
    map: '......./......./...r.../......./..b.b../......./......./......./.......',
    ice: 66,
    tip: 'Open the signals and reconnect the underground passages.',
  },
  {
    map: '......./......./.#...c./......./..b..../......./....r../......./.......',
    ice: 70,
    tip: 'Open the signals and reconnect the underground passages.',
  },
  {
    map: '......./..R..../......./.c...c./......./...#.../......./......./..E....',
    ice: 74,
    tip: 'Open the signals and reconnect the underground passages.',
  },
  {
    map: '......./......./..X.X../......./.r...b./......./..c.c../......./.......',
    ice: 78,
    tip: 'Open the signals and reconnect the underground passages.',
  },
  {
    map: '......./......./......./...b.../......./...c.../......./......./.......',
    ice: 62,
    tip: 'Open the signals and reconnect the underground passages.',
  },
  {
    map: '......./...RR../......./..c.c../......./.r...b./......./......./...EE..',
    ice: 82,
    tip: 'Open the signals and reconnect the underground passages.',
  },
  {
    map: '......./......./..#.#../......./......./......./......./......./.......',
    ice: 66,
    tip: 'Clear the masonry shelves and recover the buried relics.',
  },
  {
    map: '......./......./..X..../......./....#../......./.c...c./......./.......',
    ice: 70,
    tip: 'Clear the masonry shelves and recover the buried relics.',
  },
  {
    map: '......./......./.#...#./......./..r.b../......./...c.../......./.......',
    ice: 74,
    tip: 'Clear the masonry shelves and recover the buried relics.',
  },
  {
    map: '......./..R.R../......./..#.#../......./...X.../......./......./..E.E..',
    ice: 78,
    tip: 'Clear the masonry shelves and recover the buried relics.',
  },
  {
    map: '......./......./......./..#..../......./....c../......./......./.......',
    ice: 62,
    tip: 'Clear the masonry shelves and recover the buried relics.',
  },
  {
    map: '......./..RR.../......./.X...X./......./...c.../......./......./..EE...',
    ice: 82,
    tip: 'Clear the masonry shelves and recover the buried relics.',
  },
  {
    map: '......./......./....c../......./..c..../......./......./......./.......',
    ice: 62,
    tip: 'Follow the water channels through chains and colored seals.',
  },
  {
    map: '......./......./...b.../......./.c...c./......./...r.../......./.......',
    ice: 70,
    tip: 'Follow the water channels through chains and colored seals.',
  },
  {
    map: '......./...R.../......./..#.#../......./...c.../......./......./...E...',
    ice: 74,
    tip: 'Follow the water channels through chains and colored seals.',
  },
  {
    map: '......./......./.r...b./......./.X...X./......./...c.../......./.......',
    ice: 78,
    tip: 'Follow the water channels through chains and colored seals.',
  },
  {
    map: '......./......./......./..b.b../......./......./......./......./.......',
    ice: 62,
    tip: 'Follow the water channels through chains and colored seals.',
  },
  {
    map: '......./..R.R../......./.r...b./......./..c.c../......./......./..E.E..',
    ice: 82,
    tip: 'Follow the water channels through chains and colored seals.',
  },
  {
    map: '......./......./...#.../......./..r.b../......./......./......./.......',
    ice: 66,
    tip: 'Connect the final galleries beneath the electric town.',
  },
  {
    map: '......./......./.c...c./......./..#.#../......./......./......./.......',
    ice: 70,
    tip: 'Connect the final galleries beneath the electric town.',
  },
  {
    map: '......./....R../......./...c.../......./......./......./......./....E..',
    ice: 68,
    tip: 'Connect the final galleries beneath the electric town.',
  },
  {
    map: '......./......./..r.b../......./...X.../......./.c...c./......./.......',
    ice: 78,
    tip: 'Connect the final galleries beneath the electric town.',
  },
  {
    map: '......./......./......./...r.../......./..#.#../......./......./.......',
    ice: 62,
    tip: 'Connect the final galleries beneath the electric town.',
  },
  {
    map: '......./...RR../......./.X...X./......./...c.../......./......./...EE..',
    ice: 82,
    tip: 'Connect the final galleries beneath the electric town.',
  },
  {
    map: '......./......./...c.../......./..r.b../......./......./......./.......',
    ice: 66,
    tip: 'Bring the last treasures into the light of Prospect Hollow.',
  },
  {
    map: '......./......./.#...#./......./..c.c../......./...b.../......./.......',
    ice: 70,
    tip: 'Bring the last treasures into the light of Prospect Hollow.',
  },
  {
    map: '......./..R..../......./..r..../......./....b../......./......./..E....',
    ice: 74,
    tip: 'Bring the last treasures into the light of Prospect Hollow.',
  },
  {
    map: '......./......./..X.X../......./.b...r./......./...c.../......./.......',
    ice: 78,
    tip: 'Bring the last treasures into the light of Prospect Hollow.',
  },
  {
    map: '......./......./......./..c.c../......./...#.../......./......./.......',
    ice: 62,
    tip: 'Bring the last treasures into the light of Prospect Hollow.',
  },
  {
    map: '......./..RRR../......./.c...c./......./......./......./......./..EEE..',
    ice: 78,
    tip: 'Bring the last treasures into the light of Prospect Hollow.',
  },
  ...MOTOR_LEVELS,
  ...CITY_LEVELS,
  ...LATE_LEVELS,
];

// Append-only chapters 68 onwards (levels 403+): the floating seam below the forge
// and reservoir. See docs/mine-expansion-plan.md for the agreed rules and order.
//
// Boards share the deep-mine grammar (see parseMineBoard) plus:
//   F  floatstone: a relic that rises when the gems above it are cleared
//   G  floatstone held by a chain
//   5/6/7  floatstone held by a vine of root knot k/m/n
//   E  exit: a basket on the bottom row, a sky hatch on the top row
//   L  lens mirror on an edge cell; the level's `lenses` list gives, in reading
//      order, the direction each one sends a turned beam (n, s, e, w, ne, nw, se, sw)
//   * / +  one-/two-hit starglass: only a beam turned by a lens can break it
//   z / Z  one-/two-hit phase seal: its gem changes color after every move
//   f  frozen gem on ice
//   P / p, U / u  portal entrances and their exits: a gem falling out of P comes
//      out of p (and U into u)
//   C  relic held by a chain
//   q / Q  moon lock (flips gravity once) / moon dial (flips it on every blast)
// A chapter or level with `dust: true` buries its 1–4 fossils under dust instead of rock.
//   W / Y  one-/two-hit cracked wall of chamber a; w the wall of chamber b. A level's
//      `chambers` list seals whole rows ({ id, rows: [first, last] }) until the
//      matching wall is broken
// Levels whose goal is lighting lanterns or delivering cargo carry no ice.
// Moves are unlimited; difficulty comes only from these layouts and goals.
import { parseMineBoard } from './deepMineLevels.js';

const COLS = 7;
const ROWS = 9;
// Pieces that sit on another cell symbol are lifted out before the shared parser.
const PIECES = { F: '.', G: 'c', 5: 'K', 6: 'M', 7: 'N' };
const RELICS = { C: 'c' };
const FIXTURES = { L: '_', P: '.', p: '.', U: '.', u: '.' };
const liftPieces = (board) => {
  const floats = [];
  const relics = [];
  const lensCells = [];
  const portalEnds = { P: [], p: [], U: [], u: [] };
  const cells = [...board.trim().replaceAll(/[\s/]+/g, '')];
  const map = board
    .trim()
    .split(/[\s/]+/)
    .map((row) =>
      [...row]
        .map((symbol) => PIECES[symbol] ?? RELICS[symbol] ?? FIXTURES[symbol] ?? symbol)
        .join(''),
    )
    .join('/');
  cells.forEach((symbol, index) => {
    if (PIECES[symbol]) floats.push(index);
    if (RELICS[symbol]) relics.push(index);
    if (symbol === 'L') lensCells.push(index);
    if (portalEnds[symbol]) portalEnds[symbol].push(index);
  });
  const portals = [
    [portalEnds.P, portalEnds.p],
    [portalEnds.U, portalEnds.u],
  ].flatMap(([from, to]) => {
    if (from.length !== to.length || from.length > 1)
      throw new Error('Each portal needs exactly one entrance and one exit');
    return from.length ? [{ from: from[0], to: to[0] }] : [];
  });
  return { map, floats, relics, lensCells, portals };
};
const PLANS = [
  {
    id: 'riverglass-seams',
    name: 'Riverglass seams',
    motif: 'ribbon',
    stops: [
      'First glint',
      'Glass ribbons',
      'Lantern pockets',
      'Banded vault',
      'Quiet glass',
      'Riverglass heart',
    ],
    levels: [
      {
        board: 'l.....l/...l.../.l...l./......./l..l..l/......./.l...l./......./l.....l',
        ice: 0,
        orders: [['sapphire', 36]],
        chestTarget: 22500,
        tip: 'A glint of strange glass below the reservoir. Match on or beside each lantern to light it; the edges take a little planning.',
      },
      {
        board: '......./.c...../..c..../...c.../....c../.....c./......./.c...c./.......',
        ice: 126,
        chestTarget: 42500,
        tip: 'A ribbon of chained glass. Match with each chained gem to free it, then clear the ice below.',
      },
      {
        board: '......./.l...l./......./l..l..l/......./......./......./.#.#.#./#l#l#l#',
        ice: 0,
        orders: [
          ['ruby', 72],
          ['sapphire', 72],
        ],
        chestTarget: 50500,
        tip: 'Three lanterns are walled in by stone along the floor. Match beside the stone to break in, then light each lantern.',
      },
      {
        board: '......./..r.b../......./.cX.Xc./......./..c.c../......./.g...g./.......',
        ice: 140,
        orders: [
          ['sapphire', 62],
          ['emerald', 62],
        ],
        chestTarget: 53500,
        tip: 'Banded stone and colored seals. Build a bonus in the open middle to reach both sides.',
      },
      {
        board: '...l.../.l...l./..c.c../l.....l/...c.../.l...l./..c.c../.l...l./.......',
        ice: 0,
        orders: [['emerald', 52]],
        chestTarget: 33500,
        tip: 'A quiet gallery of glowing glass. Enjoy the cascades, free the chained gems and light the lanterns.',
      },
      {
        board: '.l...l./..o.o../l.....l/.DBDBD./.BlDlB./.DBDBD./l.....l/......./.l...l.',
        ice: 0,
        orders: [
          ['ruby', 99],
          ['sapphire', 99],
        ],
        chestTarget: 63500,
        coreCharges: 4,
        tip: 'Two lanterns sit inside a vault of rock gates. Charge both braziers for bombs, blast your way in and light every lantern.',
      },
    ],
  },
  {
    id: 'floatstone-shafts',
    name: 'Floatstone shafts',
    motif: 'pocket',
    stops: [
      'First float',
      'Twin hatches',
      'Stone ceiling',
      'Held in place',
      'Drifting up',
      'Sky shaft',
    ],
    levels: [
      {
        board: '...E.../......./......./......./......./......./...F.../......./.......',
        ice: 0,
        orders: [['sapphire', 48]],
        chestTarget: 32500,
        tip: 'Floatstones rise. Clear the gems directly above one and it floats up into the gap. Bring it to the sky hatch at the top.',
      },
      {
        board: '.E...E./......./......./......./......./......./......./.F...F./.......',
        ice: 0,
        orders: [
          ['emerald', 47],
          ['ruby', 47],
        ],
        chestTarget: 36500,
        tip: 'Two floatstones, two hatches. Vertical matches above a floatstone lift it several cells at once.',
      },
      {
        board: '..E.E../......./..X.X../......./......./......./......./..F.F../.......',
        ice: 0,
        extraColor: 'amethyst',
        chestTarget: 23000,
        tip: 'Banded stone blocks the way up and takes two hits. Match beside it to break it, then lift the floatstones through.',
      },
      {
        board: '.E.E.E./......./.#...#./......./......./.G.F.G./......./......./.......',
        ice: 0,
        orders: [
          ['sapphire', 65],
          ['emerald', 65],
        ],
        chestTarget: 46500,
        tip: 'Two floatstones are chained in place. Blast a chained floatstone with any bonus to set it free.',
      },
      {
        board: '..E.E../......./......./......./......./..F.F../......./......./.......',
        ice: 0,
        chestTarget: 16500,
        tip: 'A wide, quiet shaft. Let the floatstones drift up between cascades.',
      },
      {
        board: '.E.E.E./......./.B.D.B./......./..#.#../......./.F.G.F./......./.......',
        ice: 0,
        orders: [
          ['ruby', 88],
          ['sapphire', 88],
        ],
        chestTarget: 58000,
        tip: 'Rock gates seal the sky shaft. Craft bombs and crosses to blast them, then lift all three floatstones.',
      },
    ],
  },
  {
    id: 'glowing-fossils',
    name: 'Glowing fossils',
    motif: 'twins',
    fossilLayers: 1,
    stops: [
      'Spore light',
      'Falling light',
      'Relay chain',
      'Gated beds',
      'Soft glow',
      'Glowing heart',
    ],
    levels: [
      {
        board: '......./......./......./h..11../h..11../......./......./......./.......',
        ice: 99,
        chestTarget: 32500,
        tip: 'A spore burst cracks fossil rock. Match beside each mushroom to fire it along its row, then finish the fossil with a bonus if needed.',
      },
      {
        board: '.v...v./......./......./......./......./11...22/11...22/......./.......',
        ice: 140,
        chestTarget: 42500,
        tip: 'Each mushroom fires down its column and opens half a fossil. Craft bonuses for the outer pieces.',
      },
      {
        board: '.v...../......./h....v./......./......./....11./.22.11./.22..../.......',
        ice: 140,
        orders: [
          ['ruby', 49],
          ['sapphire', 49],
        ],
        chestTarget: 43500,
        tip: 'One burst can fire another mushroom. Light the left relay to send spores down the right shaft.',
      },
      {
        board: '......./......./......./hD...Dh/11...22/11...22/B.....B/......./.......',
        ice: 140,
        orders: [
          ['sapphire', 68],
          ['emerald', 68],
        ],
        chestTarget: 51000,
        tip: 'Fossils hide in the walls. Spore bursts crack the dark gates; bombs and crosses open the casings.',
      },
      {
        board: '......./......./...v.../......./......./..11.../..11.../......./.......',
        ice: 53,
        chestTarget: 23500,
        tip: 'A soft glow over one fossil. One spore and one bonus are all it takes.',
      },
      {
        board: '......./......./hv...v./......./D11.22D/D11.22D/...v.../..33.../..33...',
        ice: 60,
        chestTarget: 51000,
        fossilLayers: 2,
        tip: 'One match can wake the whole grotto: the row burst fires both column relays. Thick casings still need extra bonus hits.',
      },
    ],
  },
  {
    id: 'rising-and-falling',
    name: 'Rising and falling',
    motif: 'steps',
    stops: [
      'Up and down',
      'Crossing paths',
      'Between stones',
      'Gated baskets',
      'Gentle tide',
      'Both ways home',
    ],
    levels: [
      {
        board: '..E..../......./......./....R../......./..F..../......./......./....E..',
        ice: 0,
        orders: [['sapphire', 36]],
        chestTarget: 24000,
        tip: 'The pearl falls to the basket below; the floatstone rises to the hatch above. Clear beneath one and above the other.',
      },
      {
        board: '...E.../...R.../......./......./......./......./...F.../......./...E...',
        ice: 0,
        orders: [
          ['emerald', 52],
          ['ruby', 52],
        ],
        chestTarget: 38000,
        tip: 'The pearl and the floatstone share a column. They slip past each other as you clear the gems between them.',
      },
      {
        board: '..E.E../.R...R./......./.#X.X#./......./..F.F../......./......./.E...E.',
        ice: 0,
        orders: [
          ['ruby', 59],
          ['sapphire', 59],
        ],
        chestTarget: 45000,
        tip: 'Stones block both ways. Break them with matches beside them, then send everything home.',
      },
      {
        board: '.E.E.E./......./.R...R./......./.X.#.X./......./.F.F.F./.D...D./.E...E.',
        ice: 0,
        chestTarget: 40000,
        tip: 'Stone hangs over the floatstones and rock gates guard the baskets. Matches break the stone; the gates need bombs and crosses.',
      },
      {
        board: '..E.E../......./...R.../......./......./......./..F.F../......./...E...',
        ice: 0,
        orders: [['emerald', 43]],
        chestTarget: 26500,
        tip: 'A gentle tide of pearls and floatstones. Let the cascades carry them home.',
      },
      {
        board: 'E.E.E.E/.R.R.R./......./......./......./......./G.F.F.G/.B.D.B./.E.E.E.',
        ice: 0,
        chestTarget: 67500,
        tip: 'Three pearls down, four floatstones up. Blast the chains and gates, and every piece finds its way home.',
      },
    ],
  },
  {
    id: 'rigging-vault',
    name: 'Rigging vault',
    motif: 'pocket',
    stops: [
      'Tied down',
      'Two moorings',
      'Behind the rigging',
      'Tangled lines',
      'Slack ropes',
      'Cast off',
    ],
    levels: [
      {
        board: '...E.../......./......./......./......./...5.../..KkK../......./.......',
        ice: 0,
        orders: [['sapphire', 39]],
        chestTarget: 23500,
        tip: 'A root knot holds the floatstone down. Match right beside the knot to cut every vine at once, then lift the floatstone.',
      },
      {
        board: '.E...E./......./......./......./.5...6./KkK.MmM/......./......./.......',
        ice: 0,
        orders: [
          ['emerald', 52],
          ['ruby', 52],
        ],
        chestTarget: 37000,
        tip: 'Two knots, two moored floatstones. Cut each knot with a match beside it, or hit it with a bonus.',
      },
      {
        board: '.E...E./......./......./.X...X./Kk...mM/.5...6./......./......./.......',
        ice: 0,
        extraColor: 'amethyst',
        chestTarget: 18000,
        knotHealth: 2,
        tip: 'Thick knots and banded stone both take two hits. Break the stone above each knot so the floatstones have a clear way up.',
      },
      {
        board: '.E.E.E./......./.R...R./......./.5.6.7./.k.m.n./.K.M.N./......./.E...E.',
        ice: 0,
        orders: [
          ['sapphire', 53],
          ['emerald', 53],
        ],
        chestTarget: 41500,
        tip: 'Three knots hold three floatstones while two pearls wait above. Cut the knots and send the pearls down past them.',
      },
      {
        board: '..E.E../......./......./......./..5.6../..k.m../......./......./.......',
        ice: 0,
        orders: [['emerald', 43]],
        chestTarget: 25000,
        tip: 'Slack ropes. Two easy knots, then let the floatstones drift away.',
      },
      {
        board: 'E.E.E.E/......./.D...D./......./5.6.7.G/k.m.n.c/K.M.N../......./.......',
        ice: 0,
        chestTarget: 45000,
        knotHealth: 2,
        tip: 'Cast off every line. Thick knots, a chained floatstone and rock gates: plan bonuses that hit several at once.',
      },
    ],
  },
  {
    id: 'brazier-chimney',
    name: 'Brazier chimney',
    motif: 'arch',
    stops: ['Warm draft', 'Twin flues', 'Smoke shelf', 'Soot vault', 'Ember rest', 'Chimney top'],
    levels: [
      {
        board: '...E.../......./......./...D.../..o.o../...F.../......./......./.......',
        ice: 0,
        orders: [['sapphire', 48]],
        chestTarget: 27000,
        coreCharges: 4,
        tip: 'Charge the braziers for bombs and blast the thick gate above the floatstone. Then lift it up the chimney.',
      },
      {
        board: '.E...E./......./.D...D./o.....o/.F...F./......./......./......./.......',
        ice: 0,
        chestTarget: 25000,
        coreCharges: 4,
        tip: 'Two flues, two braziers. Place each bomb so its blast reaches the gate above a floatstone.',
      },
      {
        board: '.E.E.E./......./......./.D.B.D./..o.o../.F.F.F./......./......./.......',
        ice: 0,
        orders: [
          ['ruby', 61],
          ['sapphire', 61],
        ],
        chestTarget: 43000,
        coreCharges: 5,
        tip: 'Soot-black gates cap all three flues. Bombs from the braziers and your own crosses can break them.',
      },
      {
        board: 'E.E.E.E/......./.D.B.D./o.....o/G.F.F.G/......./.R...R./......./.E...E.',
        ice: 0,
        chestTarget: 47000,
        coreCharges: 5,
        tip: 'Floatstones up, pearls down. Chained floatstones need a blast; the braziers help with both.',
      },
      {
        board: '..E.E../......./......./..B..../...o.../..F.F../......./......./.......',
        ice: 0,
        orders: [['emerald', 34]],
        chestTarget: 22500,
        coreCharges: 4,
        tip: 'A warm rest by the embers. One brazier, one light gate and two floatstones.',
      },
      {
        board: 'E.E.E.E/.R...R./B.....B/D.....D/.o...o./F.G.G.F/......./......./.E...E.',
        ice: 0,
        orders: [
          ['ruby', 93],
          ['sapphire', 93],
        ],
        chestTarget: 67000,
        coreCharges: 5,
        tip: 'The top of the chimney. Thick gates cap the outer flues, chains hold the middle floatstones and two pearls must fall all the way down: aim every bomb where it does double work.',
      },
    ],
  },
  {
    id: 'starlit-survey',
    name: 'Starlit survey',
    motif: 'steps',
    stops: ['The kite', 'Star field', 'Zigzag', 'The long trail', 'Night lanterns', 'Great bear'],
    levels: [
      {
        board: '......./.l...l./......./......./...l.../......./......./.l...l./.......',
        survey: true,
        surveyOrder: [2, 3, 1, 5, 4],
        ice: 0,
        orders: [['sapphire', 38]],
        chestTarget: 24000,
        tip: 'Glints in the rock form a constellation. Light the numbered markers in order, starting from the middle, and fill the sapphire order.',
      },
      {
        board: '.l...l./...l.../l.c.c.l/..l.l../......./..l.l../l.c.c.l/...l.../.l...l.',
        ice: 0,
        orders: [['emerald', 65]],
        chestTarget: 42000,
        tip: 'A field of tiny stars. Light every lantern, free the chained gems and fill the emerald order.',
      },
      {
        board: 'l.....l/......./......./l.....l/..#.#../......./......./......./...l...',
        survey: true,
        surveyOrder: [1, 2, 4, 3, 5],
        ice: 0,
        orders: [
          ['ruby', 60],
          ['sapphire', 60],
        ],
        chestTarget: 42500,
        tip: 'The trail zigzags across the cavern. Follow the numbers; stone stands between the last two.',
      },
      {
        board: 'l..l..l/.c...c./......./.l...l./..X.X../......./.c...c./......./l.....l',
        survey: true,
        surveyOrder: [3, 4, 5, 2, 6, 1, 7],
        ice: 0,
        orders: [['emerald', 74]],
        chestTarget: 48500,
        tip: 'A long trail from the bottom left corner, over the top and down to the far corner. Free chained gems on the way.',
      },
      {
        board: '......./.l...l./......./...l.../......./.l...l./......./......./.......',
        ice: 0,
        orders: [['ruby', 38]],
        chestTarget: 21500,
        tip: 'A quiet night of five lanterns and a small ruby order.',
      },
      {
        board: 'l.....l/......./..o.o../.D...D./.l...l./......./.B.l.B./......./l.....l',
        survey: true,
        surveyOrder: [1, 2, 5, 3, 4, 6, 7],
        ice: 0,
        orders: [
          ['sapphire', 110],
          ['emerald', 110],
        ],
        chestTarget: 73000,
        coreCharges: 4,
        tip: 'The Great Bear. Rock gates guard part of the trail; charge the braziers for bombs and keep the numbers in order.',
      },
    ],
  },
  {
    id: 'lens-gallery',
    name: 'Lens gallery',
    motif: 'pocket',
    coreBonuses: ['cross'],
    stops: [
      'First reflection',
      'Corner mirrors',
      'Periscope',
      'Thick starglass',
      'Still glass',
      'Hall of mirrors',
    ],
    levels: [
      {
        board: '......./......./L..h.../......./......./......./*....../*....../.......',
        lenses: ['s'],
        ice: 90,
        chestTarget: 32000,
        tip: 'A lens mirror turns beams. Fire the mushroom: its row burst hits the mirror and runs down the edge, shattering the starglass that nothing else can break.',
      },
      {
        board: '......./......./*.....*/......./*.....*/......./......./......./L..h..L',
        lenses: ['n', 'n'],
        ice: 110,
        chestTarget: 36000,
        tip: 'Mirrors in both bottom corners. Any beam along the floor, or up either edge, turns and climbs the walls.',
      },
      {
        board: '......./......./......./......./......./L.*.*.L/......./...o.../......L',
        lenses: ['e', 'w', 'n'],
        ice: 110,
        chestTarget: 37500,
        tip: 'A periscope: the corner mirror sends floor beams up the right edge, then the next mirror turns them across the starglass row. The charge core gives a cross.',
      },
      {
        board: '......./......./......./+.....+/......./..D.D../......./...o.../L..h..L',
        lenses: ['n', 'n'],
        ice: 140,
        orders: [
          ['sapphire', 61],
          ['emerald', 61],
        ],
        chestTarget: 43500,
        tip: 'Thick starglass needs two turned beams. Bonuses settle on the floor, so crosses along the bottom row are your best mirror shots.',
      },
      {
        board: '......./......./......./......./*....../......./......./......./L..h...',
        lenses: ['n'],
        ice: 114,
        chestTarget: 34000,
        tip: 'Still glass. One mirror, one mushroom and one starglass.',
      },
      {
        board: 'L.....L/......./*.....*/......./+.....+/..B.B../*.....*/...o.../L..h..L',
        lenses: ['e', 'w', 'n', 'n'],
        ice: 140,
        orders: [
          ['ruby', 97],
          ['sapphire', 97],
        ],
        chestTarget: 66000,
        tip: 'A hall of mirrors. Floor beams climb both walls and cross the ceiling; plan crosses that light up the whole hall.',
      },
    ],
  },
  {
    id: 'spore-observatory',
    name: 'Spore observatory',
    motif: 'twins',
    coreBonuses: ['cross'],
    stops: [
      'First prism',
      'Crossed beams',
      'Column relay',
      'Star chart',
      'Quiet dome',
      'Observatory',
    ],
    levels: [
      {
        board: '......./......./......./......./......./......./..*..../.*...../L..h...',
        lenses: ['ne'],
        ice: 113,
        chestTarget: 41500,
        tip: 'A gold prism sends beams diagonally. Fire the mushroom along the floor and the prism turns its burst up across the board.',
      },
      {
        board: '......./......./......./......./......./...+.../..*.*../...o.../L..h..L',
        lenses: ['ne', 'nw'],
        ice: 110,
        chestTarget: 37000,
        tip: 'Two prisms, two diagonals. The thick starglass in the middle sits where both beams cross; the charge core gives a cross for a second shot.',
      },
      {
        board: '......./......./......./v....../......./...*.../......./.*...../L...h..',
        lenses: ['ne'],
        ice: 140,
        orders: [
          ['ruby', 74],
          ['sapphire', 74],
        ],
        chestTarget: 52000,
        tip: 'A column mushroom on the left edge also reaches the corner prism. Either relay sends a beam up the diagonal.',
      },
      {
        board: 'L.....L/......./......./..B.B../......./...+.../..*.*../...o.../L..h..L',
        lenses: ['s', 's', 'ne', 'nw'],
        ice: 140,
        chestTarget: 36500,
        tip: 'Silver mirrors at the top, gold prisms at the bottom. Crosses along the edges and floor turn into beams that criss-cross the dome.',
      },
      {
        board: '......./......./......./......./......./......./......./.*...../L..h...',
        lenses: ['ne'],
        ice: 75,
        chestTarget: 29500,
        tip: 'A quiet dome. One prism, one mushroom and one starglass.',
      },
      {
        board: 'L.....L/......./..D.D../......./v.....v/.*.+.*./..*.*../...o.../L..h..L',
        lenses: ['se', 'sw', 'ne', 'nw'],
        ice: 140,
        orders: [
          ['ruby', 115],
          ['sapphire', 115],
        ],
        chestTarget: 78500,
        tip: 'The great observatory. Edge mushrooms fire both prisms on their side; the floor mushroom fires the bottom pair. The thick starglass in the middle needs two diagonals.',
      },
    ],
  },
  {
    id: 'phase-vault',
    name: 'Phase vault',
    motif: 'pool',
    stops: ['Waxing', 'Crescent row', 'Full moon', 'Double phase', 'New moon', 'Eclipse'],
    levels: [
      {
        board: '......./......./..z.z../......./......./..z.z../......./......./.......',
        ice: 73,
        chestTarget: 29000,
        tip: 'Phase seals change their gem after every move, to the color shown in the corner. Plan for the change, then match on each seal to break it.',
      },
      {
        board: '......./......./.z...z./..c.c../...z.../..c.c../.z...z./......./.......',
        ice: 130,
        chestTarget: 47000,
        tip: 'Five phase seals among chained gems. A change can complete a match for you: watch the corner colors.',
      },
      {
        board: '......./......./......./.zzzzz./......./......./......./......./.......',
        ice: 140,
        orders: [
          ['ruby', 59],
          ['sapphire', 59],
        ],
        chestTarget: 43500,
        tip: 'A crescent of five seals in a row. When several change to the same color at once, they clear together.',
      },
      {
        board: '......./.Z...Z./......./..D.D../.Z...Z./......./.Z...Z./......./.......',
        ice: 140,
        orders: [
          ['sapphire', 66],
          ['emerald', 66],
        ],
        chestTarget: 52000,
        tip: 'Seals marked 2 need two matches. Rock gates block the middle; bonuses help with both.',
      },
      {
        board: '......./......./......./..z.z../......./......./......./......./.......',
        ice: 89,
        chestTarget: 27500,
        tip: 'A new moon: two quiet seals under a sheet of ice.',
      },
      {
        board: '......./.Z.Z.Z./......./.Z.D.Z./......./.Z.Z.Z./......./..B.B../.......',
        ice: 140,
        orders: [
          ['ruby', 89],
          ['sapphire', 89],
        ],
        chestTarget: 64000,
        tip: 'An eclipse: eight double seals around a thick gate. Break every seal; the changing gems can do half the work if you watch the corner colors.',
      },
    ],
  },
  {
    id: 'comet-frost',
    name: 'Comet frost',
    motif: 'ribbon',
    stops: ['Comet tail', 'Frozen phases', 'Ice shelf', 'Deep winter', 'Thaw', 'Comet heart'],
    levels: [
      {
        board: '......./......./......./.fffff./......./......./......./......./.......',
        ice: 61,
        chestTarget: 26000,
        tip: 'A comet tail of frozen gems. Clear a gem beside each one to thaw it, then match on its ice.',
      },
      {
        board: '......./......./.f.z.f./......./..fzf../......./.f.z.f./......./.......',
        ice: 115,
        chestTarget: 42500,
        tip: 'Frozen gems and phase seals. A thawed gem next to a seal can make the change work for you.',
      },
      {
        board: '......./......./..X.X../.ff.ff./......./.ff.ff./..X.X../......./.......',
        ice: 118,
        chestTarget: 38000,
        tip: 'An ice shelf between banded stones. Thaw the frozen pairs from the open middle.',
      },
      {
        board: '......./.f...f./..Z.Z../.f.f.f./..Z.Z../.f...f./......./......./.......',
        ice: 140,
        orders: [
          ['sapphire', 70],
          ['emerald', 70],
        ],
        chestTarget: 53500,
        tip: 'Deep winter: frozen gems, double seals and thick ice. Bonuses thaw and break several at once.',
      },
      {
        board: '......./......./......./..f.f../......./......./......./......./.......',
        ice: 82,
        chestTarget: 27000,
        tip: 'A gentle thaw. Two frozen gems in a wide sheet of ice.',
      },
      {
        board: '......./.fffff./.f.Z.f./.fZDZf./.f.Z.f./.fffff./......./......./.......',
        ice: 140,
        orders: [
          ['ruby', 89],
          ['sapphire', 89],
        ],
        chestTarget: 62000,
        tip: 'The heart of the comet. Thaw the frozen ring from outside, then break the double seals and the thick gate at its core.',
      },
    ],
  },
  {
    id: 'lens-vault',
    name: 'Lens vault',
    rows: 10,
    motif: 'pocket',
    fossilLayers: 1,
    coreBonuses: ['cross'],
    stops: [
      'Deep vault',
      'Sapphire seam',
      'Diagonal dig',
      'Treasury',
      'Quiet vault',
      'Vault of stars',
    ],
    levels: [
      {
        board: '......./......./......./11...../11...../......./.....22/.....22/......./L..h..L',
        lenses: ['n', 'n'],
        ice: 126,
        chestTarget: 31000,
        tip: 'A deeper, taller vault. Floor beams climb both walls and crack the fossils in them; bonuses finish the inner pieces.',
      },
      {
        board: '......./......./......./*.....*/......./11...22/11...22/......./...o.../L..h..L',
        lenses: ['n', 'n'],
        ice: 140,
        orders: [['sapphire', 79]],
        chestTarget: 52000,
        tip: 'Fossils, starglass and a sapphire order. The wall beams reach all three kinds of target.',
      },
      {
        board: '......./......./......./......./..11.../..11.../......./..*.*../......./L..h..L',
        lenses: ['ne', 'nw'],
        ice: 140,
        chestTarget: 44000,
        tip: 'Prisms send the floor beam diagonally through the middle of the vault, across the fossil.',
      },
      {
        board: 'L.....L/......./*.....*/v.....v/11...22/11...22/......./..*.*../...o.../L..h..L',
        lenses: ['s', 's', 'ne', 'nw'],
        ice: 140,
        orders: [['emerald', 91]],
        chestTarget: 60000,
        fossilLayers: 2,
        tip: 'The treasury. Edge mushrooms fire the mirrors above and the prisms below; thick fossils line the walls and an emerald order waits.',
      },
      {
        board: '......./......./......./......./......./11...../11...../......./......./L..h...',
        lenses: ['n'],
        ice: 95,
        chestTarget: 28000,
        tip: 'A quiet vault with one fossil on the wall.',
      },
      {
        board: 'L.....L/......./+.....+/v..*..v/11...22/11...22/......./..33.../..33.o./L..h..L',
        lenses: ['se', 'sw', 'n', 'n'],
        ice: 140,
        orders: [
          ['ruby', 114],
          ['sapphire', 114],
        ],
        chestTarget: 79500,
        fossilLayers: 2,
        tip: 'The vault of stars. Edge mushrooms fire both lenses on their side; diagonal beams reach the buried center. Plan every shot.',
      },
    ],
  },
  {
    id: 'portal-sidings',
    name: 'Portal sidings',
    motif: 'pocket',
    stops: [
      'First portal',
      'Twin sidings',
      'Stone siding',
      'Gated yard',
      'Quiet siding',
      'Grand junction',
    ],
    levels: [
      {
        board: 'R....../......./......./...p.../......./P....../_....../_....../_..E...',
        ice: 0,
        orders: [['sapphire', 48]],
        chestTarget: 31500,
        tip: 'A moon gem waits at the top of the side track. Clear below it until it drops into the portal, then guide it from the middle down to the basket.',
      },
      {
        board: 'R.....R/......./......./..p.u../......./P.....U/_....._/_....._/_.E.E._',
        ice: 0,
        orders: [
          ['emerald', 65],
          ['ruby', 65],
        ],
        chestTarget: 47000,
        tip: 'Two sidings, two portals, two baskets. Each portal leads to the cell of the same color.',
      },
      {
        board: 'R....../......./R....../...p.../......./P..#.../_..X.../_....../_..E...',
        ice: 0,
        orders: [
          ['ruby', 58],
          ['sapphire', 58],
        ],
        chestTarget: 42500,
        tip: 'Two moon gems queue on the siding, and stone blocks the way below the portal exit. Break it from the sides.',
      },
      {
        board: 'R.....R/......./R....../..p.u../......./P.....U/_.B.B._/_....._/_.E.E._',
        ice: 0,
        orders: [
          ['sapphire', 75],
          ['emerald', 75],
        ],
        chestTarget: 55500,
        tip: 'Rock gates guard both baskets. Send the moon gems through the portals, then blast the gates open for them.',
      },
      {
        board: 'R....../......./......./...p.../......./P..#.../_....../_....../_..E...',
        ice: 0,
        orders: [['emerald', 43]],
        chestTarget: 29000,
        tip: 'A quiet siding with a single moon gem and one stone in its way.',
      },
      {
        board: 'R.....R/......./C.....C/..p.u../......./P.D.D.U/_....._/_.c.c._/_.E.E._',
        ice: 0,
        orders: [
          ['ruby', 95],
          ['sapphire', 95],
        ],
        chestTarget: 69000,
        tip: 'The grand junction. Two moon gems are chained on the sidings and thick gates sit beside the tracks: blast what blocks the way.',
      },
    ],
  },
  {
    id: 'moon-gem-freight',
    name: 'Moon-gem freight',
    motif: 'steps',
    stops: [
      'Manifest',
      'Chained crate',
      'Double shipment',
      'Full load',
      'Light cargo',
      'Freight train',
    ],
    levels: [
      {
        board: '......R/......./......./...u.../......./......U/......_/......_/...E.._',
        ice: 0,
        orders: [['sapphire', 37]],
        chestTarget: 25500,
        tip: 'Freight from the right siding, and a sapphire order to fill while the moon gem travels.',
      },
      {
        board: 'R....../......./R....../...p.../......./P....../_....../_....../_..E...',
        ice: 0,
        orders: [['emerald', 58]],
        chestTarget: 36500,
        tip: 'Two moon gems queue on the siding while you fill an emerald order.',
      },
      {
        board: 'R.....R/......./......./..p.u../......./P.....U/_....._/_....._/_.E.E._',
        ice: 0,
        orders: [
          ['ruby', 52],
          ['sapphire', 52],
        ],
        chestTarget: 38000,
        tip: 'A double shipment and two orders. Bonuses near the middle help with both.',
      },
      {
        board: 'R.....R/......./C.....R/..p.u../......./P.....U/_.B.B._/_....._/_.E.E._',
        ice: 0,
        orders: [
          ['emerald', 62],
          ['ruby', 62],
        ],
        chestTarget: 48500,
        tip: 'A full load: four moon gems, one of them chained, gated baskets and two orders.',
      },
      {
        board: '......./......./......R/...u.../......./......U/......_/......_/...E.._',
        ice: 0,
        orders: [['ruby', 29]],
        chestTarget: 21000,
        tip: 'Light cargo: one moon gem and a small ruby order.',
      },
      {
        board: 'R.....R/C.....C/......./..p.u../..#.#../P.....U/_.D.D._/_....._/_.E.E._',
        ice: 0,
        chestTarget: 50500,
        orders: [
          ['ruby', 30],
          ['sapphire', 30],
          ['emerald', 30],
        ],
        tip: 'The freight train. Four moon gems, stone in the yard, thick gates at the baskets and three orders to fill.',
      },
    ],
  },
  {
    id: 'breakthrough',
    name: 'Breakthrough',
    rows: 10,
    motif: 'arch',
    stops: [
      'Cracked floor',
      'Thick wall',
      'Trail below',
      'Two chambers',
      'Easy dig',
      'Into the deep',
    ],
    levels: [
      {
        board: '......./......./......./......./......./__WWW__/......./.l...l./......./..l.l..',
        chambers: [{ rows: [6, 9] }],
        ice: 0,
        chestTarget: 14500,
        tip: 'A cracked floor hides a deeper chamber. Blast the cracked wall with bonuses to break through, then light the lanterns below.',
      },
      {
        board: '......./......./......./......./......./__YYY__/......./......./......./.......',
        chambers: [{ rows: [6, 9] }],
        ice: 58,
        chestTarget: 42500,
        tip: 'A thick wall: each piece needs two blasts. Bombs and crosses from the upper chamber open the way down to the ice below.',
      },
      {
        board: '......./l.....l/......./...l.../......./__WWW__/......./.l...l./......./...l...',
        chambers: [{ rows: [6, 9] }],
        survey: true,
        ice: 0,
        orders: [
          ['ruby', 54],
          ['sapphire', 54],
        ],
        chestTarget: 37000,
        tip: 'The survey trail continues below the cracked floor. Light the upper markers, break through and finish the trail in the chamber.',
      },
      {
        board: '......./......./......./......./......./WWW.www/......./.X...X./......./.......',
        chambers: [
          { id: 'a', rows: [6, 9], cols: [0, 2] },
          { id: 'b', rows: [6, 9], cols: [4, 6] },
        ],
        ice: 122,
        chestTarget: 50000,
        tip: 'Two chambers either side of an open shaft. Each cracked wall opens its own chamber; bombs dropped down the shaft reach both.',
      },
      {
        board: '......./......./......./......./......./__WWW__/......./......./......./.......',
        chambers: [{ rows: [6, 9] }],
        ice: 41,
        chestTarget: 20500,
        tip: 'An easy dig through a thin floor.',
      },
      {
        board: '..R.R../...R.../......./......./......./__WYW__/......./......./......./..EEE..',
        chambers: [{ rows: [6, 9] }],
        ice: 0,
        orders: [
          ['ruby', 85],
          ['sapphire', 85],
        ],
        chestTarget: 57500,
        tip: 'Three relics wait above the cracked floor. Break through and bring them all the way down to the baskets in the deep.',
      },
    ],
  },
  {
    id: 'elevator-foundations',
    name: 'Elevator foundations',
    rows: 10,
    motif: 'twins',
    stops: ['Footings', 'Deep roots', 'Tangled shaft', 'Twin footings', 'Level ground', 'Bedrock'],
    levels: [
      {
        board: '......./..o.o../......./......./......./__WWW__/......./..KkK../...K.../.......',
        chambers: [{ rows: [6, 9] }],
        ice: 49,
        chestTarget: 24000,
        coreCharges: 4,
        tip: 'Charge the braziers for bombs, blast through the cracked floor, then cut the root knot that has grown into the footings.',
      },
      {
        board: '......./..o.o../......./......./......./__YYY__/......./.KkK.../....MmM/.......',
        chambers: [{ rows: [6, 9] }],
        ice: 69,
        chestTarget: 40500,
        coreCharges: 4,
        tip: 'A thick floor and two knots below. Each wall piece needs two blasts.',
      },
      {
        board: '......./.KkK.../......./....o../......./__WWW__/......./...MmM./......./.......',
        chambers: [{ rows: [6, 9] }],
        ice: 89,
        chestTarget: 37500,
        coreCharges: 4,
        tip: 'Roots tangle the shaft above and below the floor. Cut the upper knot first to free the space for bonuses.',
      },
      {
        board: '......./.o...o./......./......./......./WWW.www/......./KkK.MmM/......./.......',
        chambers: [
          { id: 'a', rows: [6, 9], cols: [0, 2] },
          { id: 'b', rows: [6, 9], cols: [4, 6] },
        ],
        ice: 140,
        orders: [
          ['sapphire', 78],
          ['emerald', 78],
        ],
        chestTarget: 64500,
        coreCharges: 4,
        knotHealth: 2,
        tip: 'Twin footings either side of the shaft. Break into each, then cut the thick knots inside.',
      },
      {
        board: '......./...o.../......./......./......./__WWW__/......./......./......./.......',
        chambers: [{ rows: [6, 9] }],
        ice: 70,
        chestTarget: 33000,
        coreCharges: 4,
        tip: 'Level ground: one brazier, one thin floor and a floor of ice.',
      },
      {
        board: '......./..o.o../.D...D./......./......./__WYW__/......./.KkK.../....MmM/.......',
        chambers: [{ rows: [6, 9] }],
        ice: 140,
        orders: [
          ['ruby', 73],
          ['sapphire', 73],
        ],
        chestTarget: 64000,
        coreCharges: 5,
        knotHealth: 2,
        tip: 'Bedrock for the elevator. Thick gates, a thick floor and thick knots: every brazier bomb counts.',
      },
    ],
  },
  {
    id: 'portal-pearls',
    name: 'Portal pearls',
    motif: 'steps',
    gravity: 'funnel',
    stops: [
      'Pearl siding',
      'Both banks',
      'Gated mouth',
      'Deep current',
      'Still pool',
      'Pearl junction',
    ],
    levels: [
      {
        board: 'R....../......./......./...p.../......./P....._/__...__/___B___/___E___',
        ice: 0,
        orders: [['sapphire', 40]],
        chestTarget: 25500,
        tip: 'The pearl rides the portal into the bowl, then rolls down to the basket. Blast the dark gate in the throat.',
      },
      {
        board: 'R.....R/......./......./..p.u../......./P.....U/__...__/___B___/___E___',
        ice: 0,
        orders: [
          ['emerald', 40],
          ['ruby', 40],
        ],
        chestTarget: 39000,
        tip: 'Pearls from both banks meet in the bowl and take turns through the throat.',
      },
      {
        board: 'R.....R/......./......./..p.u../B.....B/P.....U/__...__/___B___/___E___',
        ice: 0,
        orders: [
          ['ruby', 47],
          ['sapphire', 47],
        ],
        chestTarget: 37000,
        tip: 'Gates block both portal mouths. Blast them open, then the gate in the throat.',
      },
      {
        board: 'R.....R/C....../......./..p.u../B.....D/P.....U/__...__/___D___/___E___',
        ice: 0,
        chestTarget: 45500,
        tip: 'A deep current: three pearls, one chained, and thick gates on the way down.',
      },
      {
        board: '......./......./R....../...p.../......./P....._/__...__/___.___/___E___',
        ice: 0,
        orders: [['emerald', 31]],
        chestTarget: 21000,
        tip: 'A still pool with one pearl and an open throat.',
      },
      {
        board: 'R.....R/C.....C/......./..p.u../B.....B/P.....U/__...__/___D___/___E___',
        ice: 0,
        chestTarget: 63000,
        tip: 'The pearl junction. Four pearls, two of them chained, gated mouths and a thick throat gate.',
      },
    ],
  },
  {
    id: 'ribbon-foundry',
    name: 'Ribbon foundry',
    rows: 11,
    motif: 'arch',
    coreBonuses: ['cross'],
    stops: [
      'Spinning floor',
      'Sealed portal',
      'Cable vault',
      'Mirror shaft',
      'Cooling floor',
      'Ribbon heart',
    ],
    levels: [
      {
        board:
          '......./......./......./......./......./......./__WWW__/......./.l...l./......./..l.l..',
        chambers: [{ rows: [7, 10] }],
        ice: 0,
        chestTarget: 21500,
        tip: 'A taller foundry. Break through the cracked floor and light the lanterns in the chamber below.',
      },
      {
        board:
          'R....../......./......./......./P....../_....../__WWW__/_....../_..p.../_....../_..E...',
        chambers: [{ rows: [7, 10] }],
        ice: 0,
        orders: [
          ['emerald', 65],
          ['ruby', 65],
        ],
        chestTarget: 44500,
        tip: 'The portal leads into a sealed chamber. Break the floor first; until then the moon gem has nowhere to go.',
      },
      {
        board:
          '..R.R../......./..o.o../......./......./......./__YYY__/......./.KkK.../......./..E.E..',
        chambers: [{ rows: [7, 10] }],
        ice: 0,
        orders: [
          ['ruby', 53],
          ['sapphire', 53],
        ],
        chestTarget: 36500,
        coreCharges: 4,
        coreBonuses: ['bomb'],
        tip: 'The cable vault. Two relics must fall through a thick floor and past a root knot to the baskets at the bottom.',
      },
      {
        board:
          '......./......./......./...o.../......./......./__WWW__/......./*....../......./L..h..L',
        chambers: [{ rows: [7, 10] }],
        lenses: ['n', 'n'],
        coreBonuses: ['cross'],
        ice: 140,
        orders: [
          ['sapphire', 66],
          ['emerald', 66],
        ],
        chestTarget: 67500,
        tip: 'Break into the mirror shaft below, then fire the floor mushroom: its beam climbs both walls and shatters the starglass. The charge core gives a cross for the wall.',
      },
      {
        board:
          '......./......./......./......./......./......./__WWW__/......./......./......./.......',
        chambers: [{ rows: [7, 10] }],
        ice: 20,
        chestTarget: 26000,
        tip: 'A cooling floor: one thin wall between you and the deep.',
      },
      {
        board:
          '..R.R../......./.z...z./......./..o.o../......./__WYW__/......./*.....*/......./L.E.E.L',
        chambers: [{ rows: [7, 10] }],
        lenses: ['n', 'n'],
        ice: 0,
        orders: [
          ['ruby', 120],
          ['sapphire', 120],
        ],
        chestTarget: 86000,
        coreCharges: 4,
        tip: 'The ribbon heart. Phase seals above, a cracked floor, two relics to deliver and starglass that only the floor mirrors can reach.',
      },
    ],
  },
  {
    id: 'upside-hollow',
    name: 'Upside hollow',
    motif: 'pool',
    gravity: 'up',
    stops: [
      'Falling up',
      'Rising pearl',
      'Sinking stones',
      'Topsy-turvy',
      'Drifting',
      'Upside down',
    ],
    levels: [
      {
        board: '......./......./......./......./......./......./......./......./.......',
        ice: 90,
        chestTarget: 25000,
        tip: 'The floating crystal turns this cavern upside down: gems fall up and new ones rise from the floor. Clear the ice as usual.',
      },
      {
        board: '.E...E./.#...#./......./......./......./......./......./......./.R...R.',
        ice: 0,
        orders: [
          ['emerald', 65],
          ['ruby', 65],
        ],
        chestTarget: 46500,
        tip: 'Pearls fall up here too. Clear above each pearl so it rises to the hatch in the ceiling; stone guards both hatches.',
      },
      {
        board: '......./......./..F.F../......./......./......./......./......./..E.E..',
        ice: 0,
        orders: [
          ['ruby', 72],
          ['sapphire', 72],
        ],
        chestTarget: 50000,
        tip: 'Floatstones always go against gravity, so here they sink. Clear below them to bring them down to the baskets.',
      },
      {
        board: '.E...E./.#...#./......./.R...R./......./..F.F../......./......./..E.E..',
        ice: 0,
        orders: [
          ['sapphire', 75],
          ['emerald', 75],
        ],
        chestTarget: 52000,
        tip: 'Topsy-turvy: pearls rise to the ceiling hatches and floatstones sink to the floor baskets. Stone guards the ceiling.',
      },
      {
        board: '......./......./..c.c../......./......./......./......./......./.......',
        ice: 66,
        chestTarget: 21500,
        tip: 'A drifting rest. Chained gems and a field of ice in the upside-down cavern.',
      },
      {
        board: '.E.E.E./.B.D.B./......./.R.R.R./..o.o../......./.F...F./......./.E...E.',
        ice: 0,
        orders: [
          ['ruby', 120],
          ['sapphire', 120],
        ],
        chestTarget: 88500,
        coreCharges: 4,
        tip: 'Upside down to the end: three pearls up through gated hatches, two floatstones down to the floor. Charge the braziers for bombs.',
      },
    ],
  },
  {
    id: 'twin-gravity',
    name: 'Twin gravity',
    motif: 'twins',
    gravity: 'split',
    stops: ['Two skies', 'Twin pearls', 'Lantern rims', 'Gated rims', 'Seam rest', 'Mirror worlds'],
    levels: [
      {
        board: '......./......./......./......./......./......./......./......./.......',
        ice: 70,
        chestTarget: 25500,
        tip: 'Two skies: the top half falls up and the bottom half falls down. New gems pour out of the seam in the middle.',
      },
      {
        board: '...E.../......./...R.../......./......./......./...R.../......./...E...',
        ice: 0,
        orders: [
          ['emerald', 46],
          ['ruby', 46],
        ],
        chestTarget: 31500,
        tip: 'One pearl rises to the ceiling, the other falls to the floor. Each follows the gravity of its half.',
      },
      {
        board: 'l..l..l/......./......./......./......./......./......./......./l..l..l',
        ice: 0,
        orders: [
          ['ruby', 62],
          ['emerald', 62],
        ],
        chestTarget: 40000,
        tip: 'Lanterns line both rims while two orders wait. Matches far from the seam take a little more planning.',
      },
      {
        board: '.E...E./.B...B./.R...R./......./......./......./.R...R./.B...B./.E...E.',
        ice: 0,
        orders: [
          ['sapphire', 89],
          ['emerald', 89],
        ],
        chestTarget: 57000,
        tip: 'Gates guard the hatches and the baskets. Blast them open and send each pearl to its own rim.',
      },
      {
        board: '......./......./......./..c.c../......./......./......./......./.......',
        ice: 62,
        chestTarget: 24000,
        tip: 'A rest by the seam. Two chains and a field of ice.',
      },
      {
        board: '.E.E.E./.D.B.D./.R...R./...R.../......./......./.R...R./.D.B.D./.E.E.E.',
        ice: 0,
        orders: [
          ['ruby', 97],
          ['sapphire', 97],
        ],
        chestTarget: 61500,
        tip: 'Mirror worlds. Five pearls, two directions and a ring of thick gates on both rims.',
      },
    ],
  },
  {
    id: 'moondust-beds',
    name: 'Moondust beds',
    motif: 'pocket',
    gravity: 'up',
    dust: true,
    fossilLayers: 1,
    stops: ['Pale dust', 'Both halves', 'Dusty chains', 'Deep dust', 'Still dust', 'Moon fossils'],
    levels: [
      {
        board: '......./......./.11.22./.11.22./......./......./......./......./.......',
        ice: 65,
        chestTarget: 26000,
        tip: 'Fossils lie under pale dust here. Match on the dust to brush it away; the cavern still falls up.',
      },
      {
        board: '......./.11..../.11..../......./......./......./....22./....22./.......',
        gravity: 'split',
        ice: 80,
        chestTarget: 26500,
        fossilLayers: 2,
        tip: 'One fossil in each half of a twin-gravity cavern. Thick dust needs two matches.',
      },
      {
        board: '......./..c.c../.11.22./.11.22./..c.c../......./......./......./.......',
        ice: 140,
        orders: [
          ['ruby', 44],
          ['sapphire', 44],
        ],
        chestTarget: 44000,
        tip: 'Chained gems pin the dust in place. Free them, then brush both fossils clean.',
      },
      {
        board: '.B...B./......./.11.22./.11.22./......./...33../...33../......./.......',
        ice: 140,
        orders: [
          ['sapphire', 77],
          ['emerald', 77],
        ],
        chestTarget: 54000,
        fossilLayers: 2,
        tip: 'Deep dust and gates in the ceiling. Bonuses brush whole fossils at once.',
      },
      {
        board: '......./......./......./..11.../..11.../......./......./......./.......',
        gravity: 'down',
        ice: 81,
        chestTarget: 31000,
        tip: 'A still corner where gravity behaves. One fossil under the dust.',
      },
      {
        board: '.D...D./.11.22./.11.22./......./......./......./.33.44./.33.44./.D...D.',
        gravity: 'split',
        ice: 140,
        orders: [
          ['ruby', 99],
          ['sapphire', 99],
        ],
        chestTarget: 64500,
        fossilLayers: 2,
        tip: 'Moon fossils in both halves, thick dust and thick gates on both rims.',
      },
    ],
  },
  {
    id: 'moon-lock',
    name: 'The moon lock',
    motif: 'arch',
    stops: [
      'Turn the key',
      'Sinking floats',
      'Side lock',
      'Locked yard',
      'Quiet key',
      'Keeper of the lock',
    ],
    levels: [
      {
        board: 'q....../......./......./......./...R.../......./......./......./...E...',
        gravity: 'up',
        ice: 0,
        orders: [['sapphire', 48]],
        chestTarget: 33000,
        tip: 'The pearl rises and there is no hatch above. Blast the moon lock in the corner with a bonus: gravity turns over for good and the pearl can fall to the basket.',
      },
      {
        board: '......./......./..F.F../......./......./......./......./......./..E.E.q',
        ice: 0,
        orders: [
          ['emerald', 53],
          ['ruby', 53],
        ],
        chestTarget: 44500,
        tip: 'No hatches above, so these floatstones need gravity turned over: then they sink. Blast the moon lock in the corner.',
      },
      {
        board: '......./......./......./.R...R./......q/......./.#...#./......./.E...E.',
        gravity: 'up',
        ice: 0,
        orders: [
          ['ruby', 52],
          ['sapphire', 52],
        ],
        chestTarget: 41000,
        tip: 'The moon lock sits on the side wall this time. Aim a cross along its row, or a bomb beside it.',
      },
      {
        board: '......./..F.F../......./.F...F./......./......./.B...B./......./qEE.EE.',
        ice: 0,
        orders: [
          ['sapphire', 77],
          ['emerald', 77],
        ],
        chestTarget: 56000,
        tip: 'Four floatstones, gated baskets and a moon lock in the corner. Turn gravity over, then blast the gates as the floatstones sink.',
      },
      {
        board: '......q/......./......./...R.../......./......./......./......./...E...',
        gravity: 'up',
        ice: 0,
        orders: [['emerald', 43]],
        chestTarget: 32000,
        tip: 'A quiet key: one pearl, one lock.',
      },
      {
        board: 'q....../.R.R.R./...C.../......./......./......./.D.B.D./......./.E.E.E.',
        gravity: 'up',
        ice: 0,
        chestTarget: 49500,
        tip: 'The keeper of the lock. Turn gravity over, free the chained pearl and blast the gates in the floor.',
      },
    ],
  },
  {
    id: 'willowkin-float-grove',
    name: 'Willowkin float grove',
    motif: 'twins',
    stops: [
      'Seedling',
      'Moored floats',
      'Root lanterns',
      'Tangled grove',
      'Shade',
      'The first tree',
    ],
    levels: [
      {
        board: 'l.....l/.l...l./......./..KkK../...K.../......./.l...l./......./l.....l',
        ice: 0,
        orders: [['emerald', 50]],
        chestTarget: 32500,
        tip: 'The Willowkin have planted a seedling in the floating cavern. Cut its tangled roots, light the lanterns around it and gather emeralds for its soil.',
      },
      {
        board: '......./......./.5...6./Kk...mM/......./......./......./......./.E...Eq',
        ice: 0,
        orders: [
          ['emerald', 16],
          ['ruby', 16],
        ],
        chestTarget: 31500,
        tip: 'Roots moor two floatstones. Cut the knots, then blast the moon lock to turn gravity over so they sink to the baskets.',
      },
      {
        board: '.l...l./......./..KkK../......./.l...l./......./..MmM../......./.l...l.',
        gravity: 'up',
        ice: 0,
        orders: [
          ['ruby', 56],
          ['sapphire', 56],
        ],
        chestTarget: 37000,
        tip: 'Root knots and lanterns in an upside-down grove. Cut both knots, light every lantern and fill both orders.',
      },
      {
        board: '.l...l./..5.6../..k.m../......./.F...F./......./......./......./qEE.EE.',
        ice: 0,
        orders: [
          ['sapphire', 66],
          ['emerald', 66],
        ],
        chestTarget: 49000,
        tip: 'A tangled grove: two moored floatstones, two free ones and a moon lock. Cut the knots and turn gravity over.',
      },
      {
        board: '......./.l...l./..l.l../...k.../...K.../......./.l...l./......./.......',
        ice: 0,
        orders: [['emerald', 40]],
        chestTarget: 25500,
        tip: 'A shady rest under the young tree, with a small emerald order for the Willowkin.',
      },
      {
        board: '...l.../..lKl../.lKkKl./...K.../...F.../..MmM../...M.../......./q..E...',
        knotHealth: 2,
        ice: 0,
        orders: [
          ['ruby', 100],
          ['sapphire', 100],
        ],
        chestTarget: 67000,
        tip: 'The first tree on the floating island. Light its lantern crown, cut its thick roots and send the floatstone down to the Willowkin waiting below.',
      },
    ],
  },
  {
    id: 'starfall-cavern',
    name: 'Starfall cavern',
    motif: 'steps',
    stops: [
      'First dial',
      'Back and forth',
      'Gated stars',
      'Dial in reach',
      'Falling star',
      'Starfall',
    ],
    levels: [
      {
        board: '......./......./......./...R.../......./......./...F.../......./Q..E...',
        ice: 0,
        chestTarget: 25000,
        tip: 'A moon dial turns gravity over every time a bonus blast hits it. Deliver the pearl while things fall down, then turn the dial so the floatstone sinks.',
      },
      {
        board: '......./.R...R./......./......./..F.F../......./......./......./QEE.EE.',
        ice: 0,
        chestTarget: 57000,
        tip: 'Pearls need gravity down, floatstones need it up. Turn the dial back and forth to bring them all home.',
      },
      {
        board: '......./.R...F./......./......./.F...R./......./.B...B./......./QE...E.',
        ice: 0,
        chestTarget: 62500,
        tip: 'Gates guard the baskets. Blast them open first so every flip of the dial counts.',
      },
      {
        board: '......./.R.F.R./......./Q....../......./.F.R.F./......./......./.E.E.E.',
        ice: 0,
        chestTarget: 62500,
        tip: 'The dial sits on the side wall, closer to the action: blasts along its row will turn gravity over, wanted or not.',
      },
      {
        board: '......./......./......./...F.../......./......./......./......./Q..E...',
        ice: 0,
        orders: [['emerald', 17]],
        chestTarget: 27500,
        tip: 'A falling star: one floatstone, one turn of the dial.',
      },
      {
        board: '......./.R.F.R./.F.C.F./......Q/......./..c.c../.B.D.B./......./.E.E.E.',
        ice: 0,
        chestTarget: 63500,
        tip: 'The great starfall. Pearls and floatstones, chains and gates, and a dial in the middle of the wall: every blast near it turns the cavern over.',
      },
    ],
  },
];

// Five colors per board, as before. Ruby, sapphire and emerald stay in every set for
// seals and orders; peridot joins from chapter 1 and starmetal from chapter 7, each in
// place of one of the older gems.
const COLOR_SETS = {
  A: ['ruby', 'sapphire', 'emerald', 'peridot', 'amethyst'],
  B: ['ruby', 'sapphire', 'emerald', 'topaz', 'peridot'],
  C: ['ruby', 'sapphire', 'emerald', 'peridot', 'moonstone'],
  D: ['ruby', 'sapphire', 'emerald', 'peridot', 'starmetal'],
  E: ['ruby', 'sapphire', 'emerald', 'topaz', 'starmetal'],
  F: ['ruby', 'sapphire', 'emerald', 'amethyst', 'starmetal'],
  G: ['ruby', 'sapphire', 'emerald', 'moonstone', 'starmetal'],
};
// One rotation per act (six chapters); each chapter's three seams use it in order.
const ACT_PALETTES = ['ABC', 'DEF', 'DCE', 'GDB'];
const chapterPalettes = (chapter) =>
  [...ACT_PALETTES[Math.floor(chapter / 6) % ACT_PALETTES.length]].map((set) => [
    ...COLOR_SETS[set],
  ]);

export const HOLLOW_MINE_CHAPTERS = PLANS.map(
  ({ id, name, cols = COLS, rows = ROWS, levels }, chapter) => {
    // Six-color boards: a level's `extraColor` joins its seam's set.
    const extraColors = Object.fromEntries(
      levels.flatMap((level, slot) => (level.extraColor ? [[slot, level.extraColor]] : [])),
    );
    return {
      id,
      name,
      theme: id,
      cols,
      rows,
      gemTypeCount: 5,
      palettes: chapterPalettes(chapter),
      ...(Object.keys(extraColors).length ? { extraColors } : {}),
    };
  },
);
export const HOLLOW_MINE_LEVEL_NAMES = PLANS.flatMap(({ name, stops }) =>
  stops.map((stop) => `${name}: ${stop}`),
);
export const HOLLOW_MINE_LEVELS = PLANS.flatMap((plan) =>
  plan.levels.map(({ board, fossilLayers = plan.fossilLayers ?? 2, knotHealth, ...level }) => {
    const { map, floats, relics, lensCells, portals } = liftPieces(board);
    const { lenses = [], dust = plan.dust, ...rest } = level;
    const cols = plan.cols ?? COLS,
      rows = plan.rows ?? ROWS;
    if (lenses.length !== lensCells.length) throw new Error('Every lens needs one direction');
    const edge = (index) =>
      index < cols || index >= (rows - 1) * cols || index % cols === 0 || index % cols === cols - 1;
    if (!lensCells.every(edge)) throw new Error('Lens mirrors sit on the board edge');
    const parsed = parseMineBoard(map, {
      fossilLayers,
      knotHealth,
      cols,
      rows,
      extra: /[*+zZfWYwqQ]/,
    });
    // Moon-dust beds: the fossil lies under ordinary gems and its dust wears off with matches.
    if (dust) for (const fossil of parsed.fossils) fossil.encased = false;
    return {
      ...parsed,
      ...(floats.length ? { floats } : {}),
      ...(portals.length ? { portals } : {}),
      ...(relics.length ? { relics } : {}),
      ...(lensCells.length
        ? { lenses: lensCells.map((index, order) => ({ index, out: lenses[order] })) }
        : {}),
      ...rest,
      openExitRows: 0,
      maxIceLayers: 2,
      coreBonuses: rest.coreBonuses ?? plan.coreBonuses ?? ['bomb'],
      ...((rest.gravity ?? plan.gravity) ? { gravity: rest.gravity ?? plan.gravity } : {}),
      motif: plan.motif,
    };
  }),
);

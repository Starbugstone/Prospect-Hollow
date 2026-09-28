# Tomorrow City gallery

WebGL captures of a completed Tomorrow City town (`npm run demo:eras`, fixture
`tomorrow-complete`), rendered in headless Chromium with SwiftShader. Desktop shots
are cropped to the 3D scene; phone shots show the full 390 × 844 screen.

![Connected City old town, before](images/tomorrow-city/00-old-town-before-connected-city.png)

_Before: the same old-town view in Connected City (2005)._

![The whole town: old town, river, east bank and the new x = 65 column](images/tomorrow-city/01-overview.png)

_The whole town: old town, river, east bank and the new x = 65 column._

![The original frontier plots rebuilt as domes, cottages and rotundas](images/tomorrow-city/02-old-town.png)

_The original frontier plots rebuilt as domes, cottages and rotundas._

![Sky pods (spiral homes), Biodome and the east bank](images/tomorrow-city/03-sky-pods-biodome.png)

_Sky pods (spiral homes), Biodome and the east bank._

![Business tower spire, City towers and the east-bank streets](images/tomorrow-city/04-skyline-towers.png)

_Business tower spire, City towers and the east-bank streets._

![Maglev loop, transit hub, city hall rotunda and the geodesic technology campus](images/tomorrow-city/05-maglev-transit.png)

_Maglev loop, transit hub, city hall rotunda and the geodesic technology campus._

![TV orb tower, concert shells, radio mast and the airport's dome lounge](images/tomorrow-city/06-tv-concert-radio.png)

_TV orb tower, concert shells, radio mast and the airport's dome lounge._

![Airport with its glazed rooftop dome lounge](images/tomorrow-city/07-airport.png)

_Airport with its glazed rooftop dome lounge._

![Domed watermill, wharf pavilion and greenhouse farms](images/tomorrow-city/08-watermill-wharf.png)

_Domed watermill, wharf pavilion and greenhouse farms._

![Mine with the glazed portal hood and geodesic sorting dome](images/tomorrow-city/09-mine.png)

_Mine with the glazed portal hood and geodesic sorting dome._

![Town square with the orbital-rings fountain](images/tomorrow-city/10-square-fountain.png)

_Town square with the orbital-rings fountain._

## Transport

The airport, station and port each switch to a rounded vehicle once that building is
modernized in Tomorrow City (`src/game/town/RoundedTransports.js`). Each is built from
the shared primitives with at most 16 meshes (24 for the three-car train), so the moving
vehicles stay cheap to draw.

![Sky saucer in flight](images/tomorrow-city/13-sky-saucer-flight.png)

_Sky saucer on approach: a disc hull under a glass dome, with spinning rim lights._

![Sky saucer landed on the runway](images/tomorrow-city/14-sky-saucer-landed.png)

_Landed on its three legs, which reach from the hull down to foot pads on the runway._

![Solar express train](images/tomorrow-city/15-solar-express-train.png)

_Solar express: a streamlined lead car and two glazed carriages running on the rails._

![Solar express bogies](images/tomorrow-city/15b-solar-express-bogies.png)

_Its skirted underframe, with rolling wheel axles on both rails._

![Hover river ferry](images/tomorrow-city/16-hover-ferry.png)

_Hover river ferry with a glazed dome cabin, passing the domed watermill._

## Cars and people

Traffic becomes hover cars and a hover shuttle bus that bob gently as they move, and
incident crews arrive in rounded response pods (`TownVehicles.js`). Villagers wear the
`tomorrow` wardrobe: a wrap-around visor and a glowing collar ring. Both new outfit parts
reuse existing shapes, so GPU instancing adds no draw calls.

![Villagers with visors and collar rings](images/tomorrow-city/17-villagers-visors.png)

_Villagers at the square in visors and glowing collar rings._

![A villager outside the saloon](images/tomorrow-city/18-villager-street.png)

_A villager outside the vaulted saloon._

![Hover car](images/tomorrow-city/19-hover-car.png)

_A touring hover car with a glass canopy, glow skirt and tail light._

![Hover shuttle bus](images/tomorrow-city/20-hover-shuttle-bus.png)

_The village hover shuttle bus by the blacksmith's hangar._

![Storm response pod](images/tomorrow-city/21-storm-response-pod.png)

_The storm-cleanup crew's hovering response pod at the river promenade._

## The space dog

In Tomorrow City the village dog becomes a Cosmo-style space dog. The `tomorrow` wardrobe
declares `petCostume: 'space-helmet'`, so a later era can reuse the costume without an
era-name check. The dog wears a clear bubble helmet (the only extra material, and a
transparent one) on a white collar ring, a white suit with red star patches, and red boots.

![Space dog, front](images/tomorrow-city/22-space-dog.png)

![Space dog, side](images/tomorrow-city/23-space-dog-side.png)

## Phone

<img src="images/tomorrow-city/11-phone-old-town.png" alt="Phone: old town" width="300"> <img src="images/tomorrow-city/12-phone-east.png" alt="Phone: east bank" width="300">

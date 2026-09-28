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
the shared primitives with at most 16 meshes, so the moving vehicles stay cheap to draw.

![Electric sky liner in flight](images/tomorrow-city/13-sky-liner-flight.png)

_Electric sky liner: blended wings and ducted fans, on approach._

![Electric sky liner taxiing](images/tomorrow-city/14-sky-liner-taxi.png)

_The sky liner taxiing by the domed airport lounge._

![Maglev pod train](images/tomorrow-city/15-maglev-pod-train.png)

_Maglev pod train, floating on guideway skids over the railway._

![Hover river ferry](images/tomorrow-city/16-hover-ferry.png)

_Hover river ferry with a glazed dome cabin, passing the domed watermill._

## Phone

<img src="images/tomorrow-city/11-phone-old-town.png" alt="Phone: old town" width="300"> <img src="images/tomorrow-city/12-phone-east.png" alt="Phone: east bank" width="300">

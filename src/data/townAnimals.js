// Shared ambient cast and habitat content. Era behavior reads evolution capabilities;
// a successor era needs no animal-specific era-name branches or saved state.
export const TOWN_ANIMALS = {
  dog: { name: 'Village dog', speed: 0.85, radius: 0.64, rest: 5, idle: 'sniffing' },
  cat: { name: 'Village cat', speed: 0.65, radius: 0.62, rest: 8, idle: 'grooming' },
  hen: { name: 'Farmyard hen', speed: 0.42, radius: 0.47, rest: 4, idle: 'pecking' },
  pigeon: { name: 'Village pigeon', speed: 4.5, radius: 0.55, rest: 10, idle: 'pecking' },
  fox: { name: 'Outskirts fox', speed: 0.9, radius: 0.98, rest: 4, idle: 'listening' },
  raccoon: { name: 'Outskirts raccoon', speed: 0.55, radius: 0.98, rest: 6, idle: 'foraging' },
};

// Local coordinates of open ground, outside enclosed building shells. More
// habitats can be added here without changing the shared flight/feeding lifecycle.
export const ANIMAL_HABITATS = [
  { building: 'square', point: [0, 0.25, 1.85], feeding: true },
  { building: 'park', point: [0, 0.18, 1.65], feeding: true },
  { building: 'gardenCourt', point: [0, 0.07, 3.2] },
  { building: 'riverPark', point: [0, 0.07, 3.2] },
  { building: 'farm', point: [-0.8, 0.07, 3.1], feeding: true },
  { building: 'home', point: [0.7, 0.07, 3.2], feeding: true },
];

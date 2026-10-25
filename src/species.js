// Album entries: every species the orca can meet, with a real fact for curious kids.
export const SPECIES = [
  { id: 'orca', name: 'Orca', fact: 'Orcas live in family groups called pods, led by the oldest female. Each pod has its own calls.' },
  { id: 'herring', name: 'Atlantic Herring', fact: 'Herring swim in huge schools of millions. Bunching into a "bait ball" helps protect them.' },
  { id: 'gull', name: 'Herring Gull', fact: 'Gulls watch the sea for diving whales and dolphins, because that means fish are near the surface.' },
  { id: 'dolphin', name: 'Bottlenose Dolphin', fact: 'Dolphins sleep with one eye open and give each other names using special whistles.' },
  { id: 'turtle', name: 'Green Sea Turtle', fact: 'Sea turtles can hold their breath for hours while resting, but must come up to breathe.' },
  { id: 'seal', name: 'Harbour Seal', fact: 'Seals can dive more than 400 metres deep and slow down their heart to save oxygen.' },
  { id: 'humpback', name: 'Humpback Whale', fact: 'Male humpbacks sing long songs that can travel across the ocean for many kilometres.' },
  { id: 'shark', name: 'Blue Shark', fact: 'Blue sharks travel thousands of kilometres. Sharks are important for keeping the ocean healthy.' },
];

export const speciesById = Object.fromEntries(SPECIES.map((s) => [s.id, s]));

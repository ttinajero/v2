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
  { id: 'greatwhite', name: 'Great White Shark', fact: 'Great whites can be 6 metres long, but when orcas arrive, great whites leave the area for months.' },
  { id: 'jellyfish', name: 'Moon Jellyfish', fact: 'Jellyfish have no brain, no heart and no bones. Some kinds glow in the dark!' },
  // Legends: only seen on rare nights. Did you really see them?
  { id: 'ghost', name: 'Sea Ghosts', legend: true, fact: 'Sailors told stories of glowing lights over the sea at night. Some were really glowing plankton!' },
  { id: 'ghostship', name: 'The Ghost Ship', legend: true, fact: 'The legend of the Flying Dutchman tells of a ghost ship that can never reach port.' },
  { id: 'siren', name: 'The Sirens', legend: true, fact: 'Old sailors may have mistaken manatees and dugongs for singing mermaids.' },
  { id: 'monster', name: 'The Deep One', legend: true, fact: 'Giant squids up to 13 metres long really live in the deep sea. Nobody saw one alive until 2004!' },
];

export const speciesById = Object.fromEntries(SPECIES.map((s) => [s.id, s]));

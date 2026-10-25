import * as THREE from 'three';

// Muted, slightly eerie palettes in the spirit of DREDGE.
const KEYS = [
  { hour: 0, deep: '#071420', shallow: '#173a46', horizon: '#18283a', zenith: '#03080f', sun: '#8fb0d0', foam: '#56707e' },
  { hour: 5, deep: '#08131f', shallow: '#1a3a46', horizon: '#3a4a5e', zenith: '#0b1424', sun: '#8fb0d0', foam: '#7a8e9a' },
  { hour: 6.5, deep: '#152536', shallow: '#4f6a72', horizon: '#e8a17a', zenith: '#33476b', sun: '#ffb68a', foam: '#f2ddd0' },
  { hour: 9, deep: '#0c3a42', shallow: '#2b8585', horizon: '#a9cfcb', zenith: '#4a89a8', sun: '#fff2d8', foam: '#eef6f2' },
  { hour: 15, deep: '#0c3a42', shallow: '#2f8a86', horizon: '#b4d3c9', zenith: '#4d8aa6', sun: '#fff0d2', foam: '#eef6f2' },
  { hour: 18, deep: '#1c2c48', shallow: '#5a6488', horizon: '#f4aa62', zenith: '#4a5c88', sun: '#ffa868', foam: '#f6dcc4' },
  { hour: 19.5, deep: '#142034', shallow: '#33445c', horizon: '#7a5262', zenith: '#18213c', sun: '#d89070', foam: '#c8bcc4' },
  { hour: 21, deep: '#071420', shallow: '#173a46', horizon: '#18283a', zenith: '#03080f', sun: '#8fb0d0', foam: '#56707e' },
  { hour: 24, deep: '#071420', shallow: '#173a46', horizon: '#18283a', zenith: '#03080f', sun: '#8fb0d0', foam: '#56707e' },
];

const FIELDS = ['deep', 'shallow', 'horizon', 'zenith', 'sun', 'foam'];
const parsed = KEYS.map((k) => {
  const out = { hour: k.hour };
  for (const f of FIELDS) out[f] = new THREE.Color(k[f]);
  return out;
});

const tmp = {};
for (const f of FIELDS) tmp[f] = new THREE.Color();

export function sampleDay(hour) {
  const h = ((hour % 24) + 24) % 24;
  let i = 0;
  while (i < parsed.length - 2 && parsed[i + 1].hour <= h) i++;
  const a = parsed[i];
  const b = parsed[i + 1];
  const t = THREE.MathUtils.smoothstep(h, a.hour, b.hour);
  for (const f of FIELDS) tmp[f].copy(a[f]).lerp(b[f], t);

  // Sun travels east → overhead → west; tilted toward -z so sunsets face the default camera.
  const angle = ((h - 6) / 24) * Math.PI * 2;
  const sunDir = new THREE.Vector3(Math.cos(angle), Math.sin(angle) * 1.2, -1.2).normalize();
  const moonDir = new THREE.Vector3(-sunDir.x, -sunDir.y, -0.8).normalize();

  const sunPower = THREE.MathUtils.smoothstep(sunDir.y, -0.04, 0.2);
  const moonPower = THREE.MathUtils.smoothstep(moonDir.y, -0.04, 0.2) * 0.35;
  const night = 1 - THREE.MathUtils.smoothstep(sunDir.y, -0.15, 0.05);
  const useSun = sunPower >= moonPower;

  return {
    colors: tmp,
    sunDir,
    moonDir,
    night,
    lightDir: useSun ? sunDir : moonDir,
    lightIntensity: useSun ? sunPower * 1.4 : moonPower,
  };
}

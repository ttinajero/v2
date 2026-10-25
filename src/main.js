import * as THREE from 'three';
import GUI from 'lil-gui';
import { createOcean } from './ocean.js';
import { createSky } from './sky.js';
import { sampleDay } from './daycycle.js';
import { Waves } from './waves.js';
import { createOrca } from './orca.js';
import { OrcaController } from './orcaController.js';
import { ChaseCamera } from './chaseCamera.js';
import { createInput } from './input.js';
import { Spray } from './spray.js';
import { createWorld, WORLD_HALF } from './world.js';
import { createHud } from './hud.js';
import { createTouchControls, prefersTouch } from './touch.js';
import { createQuality } from './quality.js';
import { createInteract } from './interact.js';
import { loadSave, writeSave, resetProgress } from './save.js';
import { onModalChange, modalOpen } from './ui.js';
import { openPause, openFaint, openSettings } from './menus.js';
import { createFish } from './fish.js';
import { createMissions } from './missions.js';
import { createAnimals } from './animals.js';
import { createBoats } from './boats.js';
import { createFamily } from './family.js';
import { createProgression } from './progression.js';
import { createAudio } from './audio.js';
import { createTutorial } from './tutorial.js';
import { createUpdates } from './updates.js';
import { createEvents } from './events.js';
import { speciesById } from './species.js';
import { water } from './materials.js';
import { loadingStep, loadingReady, loadingFailed } from './loading.js';

const START = { x: 0, z: 60, yaw: Math.PI };

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true });
} catch (error) {
  loadingFailed(error, '3D graphics are not available right now. Close other tabs or apps and reload the page.');
  throw error;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 20000);
camera.position.set(START.x, 8, START.z + 18);

const save = loadSave();

await loadingStep(0.1, 'Filling the ocean…');
const waves = new Waves();
const ocean = createOcean();
const sky = createSky();
scene.add(sky.mesh, ocean.mesh);

const sun = new THREE.DirectionalLight(0xffffff, 1);
const hemi = new THREE.HemisphereLight(0xffffff, 0x000000, 1);
scene.add(sun, sun.target, hemi);

await loadingStep(0.35, 'Waking up the orca…');
const input = createInput();
input.setEnabled(false); // until the player presses start
const orca = createOrca();
scene.add(orca.group);
const controller = new OrcaController(waves, input);
controller.respawn(START.x, START.z, START.yaw, 100, 100);
const chase = new ChaseCamera(camera, renderer.domElement);

await loadingStep(0.55, 'Placing the buoys…');
const spray = new Spray();
scene.add(spray.points);
const world = createWorld(scene, waves);

// Everything the game systems share.
const game = {
  scene,
  camera,
  renderer,
  waves,
  ocean,
  controller,
  orca,
  chase,
  spray,
  input,
  save,
  time: 0,
  started: false,
  paused: false,
  systems: [],
  day: null,
  addSystem(system) {
    this.systems.push(system);
    return system;
  },
  // Broadcast a game event (seal tagged, boat scared…) to every system.
  emit(event) {
    for (const s of this.systems) s.onEvent?.(event);
  },
  persist() {
    writeSave(save);
  },
};

const hud = createHud({
  onMap: () => hud.toggleBigMap(),
  onPause: () => game.started && !modalOpen() && openPause(game),
  onProfile: () => game.openProfile?.(),
  onClock: () => {
    game.timeScale = game.timeScale === 2 ? 1 : 2;
    hud.showToast(game.timeScale === 2 ? 'Time ×2: days and nights go by twice as fast' : 'Time back to normal');
  },
});
game.timeScale = 1;
game.hud = hud;
const touch = createTouchControls(input, chase);
game.touch = touch;
const interact = createInteract(game);
game.interact = interact;
const quality = createQuality(renderer, ocean, spray);

// First sighting of a species: add it to the album.
game.discover = (id) => {
  if (save.album[id]) return;
  save.album[id] = true;
  game.persist();
  hud.showToast(`New in your album: ${speciesById[id]?.name || id}!`);
  game.onAlbum?.(id);
};

game.fish = game.addSystem(createFish(game));
game.animals = game.addSystem(createAnimals(game));
const audio = game.addSystem(createAudio(game));
game.audio = audio;
audio.setVolumes(save.settings.music, save.settings.sfx);
game.onEat = () => {
  audio.eat();
  game.emit({ type: 'eat' });
};
game.onBite = () => audio.bite();
game.onMissionComplete = () => audio.success();
game.onMissionFail = () => audio.fail();
game.onRankUp = () => audio.fanfare();
game.onAlbum = () => audio.ui();
// Unlock audio on the first touch or key, wherever it happens.
const unlockAudio = () => audio.unlock();
window.addEventListener('pointerdown', unlockAudio, { once: true });
window.addEventListener('keydown', unlockAudio, { once: true });
document.addEventListener('click', (e) => {
  if (e.target.closest?.('.btn, .hud-icon-btn, .tab, .skin-card')) audio.ui();
});

game.progression = game.addSystem(createProgression(game));
game.openProfile = (tab) => game.progression.openProfile(tab);
game.family = game.addSystem(createFamily(game));
const boats = game.addSystem(createBoats(game));
game.boats = boats;
const missions = game.addSystem(createMissions(game));
game.missions = missions;
game.events = game.addSystem(createEvents(game));
const tutorial = game.addSystem(createTutorial(game));
game.tutorial = tutorial;
game.missionInfo = () => missions.info() || tutorial.info();

// The orca's call: family and missions listen for it.
game.addSystem({
  update() {
    if (!input.pressed('call')) return;
    game.emit({ type: 'call' });
    audio.orcaCall();
    // Family members answer, each with their own voice.
    game.family.members.forEach((fo, i) => {
      if (game.family.following(fo.member.id)) audio.familyReply(0.9 + i * 0.45, 1 / fo.member.scale);
    });
    const c = controller;
    spray.spout(c.position.x + c.forward.x * 1.9, c.surfaceY + 0.4, c.position.z + c.forward.z * 1.9, 0.35);
  },
});

// Captain Marina's coast guard boat: the mission board.
const HUB = { x: -60, z: 30 };
const coastGuard = boats.spawn('coastguard', { x: HUB.x, z: HUB.z, heading: Math.PI / 2, net: false });
coastGuard.talkLabel = 'Talk to Captain Marina';
coastGuard.onTalk = () => {
  missions.openBoard();
  game.emit({ type: 'board' });
};
game.hub = HUB;

// Free-play poachers: chase them off for a few points; they come back later.
const AMBIENT = [
  { type: 'trawler', route: [[-400, -500], [400, -550], [500, 300], [-300, 450]] },
  { type: 'speedboat', route: [[700, -200], [1000, 400], [500, 900], [300, 200]] },
];
function spawnAmbient(def) {
  const [x, z] = def.route[0];
  boats.spawn(def.type, {
    x,
    z,
    route: def.route,
    onScared: () => {
      if (missions.active) return;
      save.points += 25;
      save.totalPoints += 25;
      game.persist();
      hud.showToast('Poachers chased away! +25 points');
      setTimeout(() => spawnAmbient(def), 90000);
    },
  });
}
AMBIENT.forEach(spawnAmbient);

// --- Fainting and safe spots ---
const safeSpot = { x: START.x, z: START.z, yaw: START.yaw };
let safeTimer = 0;
game.addSystem({
  update(dt) {
    safeTimer -= dt;
    const c = controller;
    if (safeTimer <= 0 && c.health > 40 && c.trapped === 0 && c.depth < 3 && !game.dangerNear) {
      safeSpot.x = c.position.x;
      safeSpot.z = c.position.z;
      safeSpot.yaw = c.yaw;
      safeTimer = 5;
    }
  },
  onEvent(e) {
    if (e.type === 'damage') game.lastDamageSource = e.source;
    if (e.type === 'faint') {
      game.onFaint?.();
      openFaint(game, () => {
        controller.respawn(safeSpot.x, safeSpot.z, safeSpot.yaw, 60, 60);
        chase.yaw = null;
      });
    }
  },
});

// --- Ocean panel (advanced, hidden by default) ---
const params = {
  hour: save.hour ?? 9,
  cycle: true,
  cycleSpeed: 0.02, // in-game hours per real second: a full day lasts 20 minutes
  waveSpeed: 1,
  chop: 0.85,
  scale: 1,
  wind: 200,
  foam: 0.5,
  ripples: 1,
  exposure: 1.05,
};
game.params = params;

const gui = new GUI({ title: 'Ocean' });
const fTime = gui.addFolder('Time');
fTime.add(params, 'hour', 0, 24, 0.01).name('Time of day').listen();
fTime.add(params, 'cycle').name('Auto cycle');
fTime.add(params, 'cycleSpeed', 0.02, 2, 0.01).name('Cycle speed');
const fWaves = gui.addFolder('Waves');
fWaves.add(params, 'chop', 0, 1.05, 0.01).name('Choppiness');
fWaves.add(params, 'scale', 0.4, 3, 0.01).name('Size');
fWaves.add(params, 'waveSpeed', 0, 3, 0.01).name('Speed');
fWaves.add(params, 'wind', 0, 360, 1).name('Wind direction').onChange((v) => waves.setWind(THREE.MathUtils.degToRad(v)));
const fSurface = gui.addFolder('Surface');
fSurface.add(params, 'foam', 0, 1, 0.01).name('Foam');
fSurface.add(params, 'ripples', 0, 2, 0.01).name('Ripples');
fSurface.add(params, 'exposure', 0.4, 2, 0.01).name('Exposure');
gui.hide();
waves.setWind(THREE.MathUtils.degToRad(params.wind));
game.toggleOceanPanel = () => gui.show(gui._hidden);
game.openMainMenu = () => {
  if (confirm('Go back to the main menu? Your progress is saved.')) location.reload();
};

// --- Settings ---
game.applySettings = () => {
  const s = save.settings;
  quality.set(s.quality);
  touch.setVisible(prefersTouch(s.touch));
  touch.setSide(s.joystickSide);
  chase.sensitivity = s.sensitivity;
  chase.reduceMotion = s.reduceMotion;
  document.body.classList.toggle('large-text', s.largeText);
  document.body.classList.toggle('reduce-motion', s.reduceMotion);
  game.audio?.setVolumes(s.music, s.sfx);
};
game.applySettings();
window.matchMedia('(pointer: coarse)').addEventListener?.('change', () => game.applySettings());

// Gameplay input only while playing and no menu is open.
function syncInput() {
  game.paused = modalOpen();
  input.setEnabled(game.started && !game.paused);
}
onModalChange(syncInput);

// iPad Safari can drop the WebGL context (low memory, long time in the background).
// three.js restores it when the browser allows; if that takes too long, offer a reload.
let contextTimer = null;
renderer.domElement.addEventListener('webglcontextlost', () => {
  contextTimer = setTimeout(() => {
    if (document.querySelector('.context-lost')) return;
    const box = document.createElement('div');
    box.className = 'context-lost';
    box.innerHTML = '<p>The ocean needs a moment to come back.</p><button type="button" class="btn btn-primary">Reload the game</button><p class="small">Your progress is saved.</p>';
    box.querySelector('button').addEventListener('click', () => location.reload());
    document.body.appendChild(box);
  }, 2500);
});
renderer.domElement.addEventListener('webglcontextrestored', () => {
  clearTimeout(contextTimer);
  document.querySelector('.context-lost')?.remove();
});

// Keep iOS Safari from pinch-zooming the page.
document.addEventListener('gesturestart', (e) => e.preventDefault());

function resize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  spray.uniforms.uPixelScale.value = window.innerHeight / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
}
window.addEventListener('resize', resize);
resize();

function applyDay() {
  const day = sampleDay(params.hour);
  game.day = day;
  const { colors } = day;
  const ou = ocean.uniforms;
  ou.uDeepColor.value.copy(colors.deep);
  ou.uShallowColor.value.copy(colors.shallow);
  ou.uSkyHorizon.value.copy(colors.horizon);
  ou.uSkyZenith.value.copy(colors.zenith);
  ou.uFoamColor.value.copy(colors.foam);
  ou.uLightColor.value.copy(colors.sun);
  ou.uLightDir.value.copy(day.lightDir);
  ou.uLightIntensity.value = day.lightIntensity;

  const su = sky.uniforms;
  su.uHorizon.value.copy(colors.horizon);
  su.uZenith.value.copy(colors.zenith);
  su.uDeep.value.copy(colors.deep);
  su.uSunColor.value.copy(colors.sun);
  su.uSunDir.value.copy(day.sunDir);
  su.uMoonDir.value.copy(day.moonDir);
  su.uNight.value = day.night;
  scene.background = colors.horizon;

  sun.color.copy(colors.sun);
  sun.intensity = day.lightIntensity * 2.2;
  sun.position.copy(controller.position).addScaledVector(day.lightDir, 50);
  sun.target.position.copy(controller.position);
  hemi.color.copy(colors.zenith).lerp(colors.horizon, 0.5);
  hemi.groundColor.copy(colors.deep);
  hemi.intensity = 1.1 + day.night * 0.9; // moonlit nights stay readable

  orca.uniforms.uWaterColor.value.copy(colors.deep).multiplyScalar(0.7);
  water.uWaterColor.value.copy(orca.uniforms.uWaterColor.value);
  spray.uniforms.uColor.value.copy(colors.foam).multiplyScalar(0.5 + day.lightIntensity * 0.45);
  game.onDay?.(day);

  // Nightfall and dawn announcements.
  const isNight = day.night > 0.6;
  if (game.started && isNight !== game.isNight) {
    hud.showToast(isNight ? 'Night is falling… the sea gets dangerous.' : 'The sun is rising. Good morning, guardian!', 4);
  }
  game.isNight = isNight;
}

const PHYSICS_DT = 1 / 120;
let lastFrame = performance.now();
let accumulator = 0;
let wakeTimer = 0;
const side = new THREE.Vector3();

function handleEvents() {
  for (const e of controller.events) {
    if (e.type === 'breach') {
      spray.breach(e.x, e.y, e.z, controller.velocity, e.strength);
      ocean.addWake(e.x, e.z, 1.6);
      audio.splash(e.strength * 0.5, e);
    } else if (e.type === 'splash') {
      spray.splash(e.x, e.y, e.z, e.strength);
      ocean.addWake(e.x, e.z, 1 + e.strength * 0.25);
      chase.addShake(Math.min(e.strength * 0.05, 0.5));
      audio.splash(e.strength, e);
    } else if (e.type === 'slap') {
      spray.splash(e.x, e.y, e.z, Math.min(e.strength * 0.35, 4));
      ocean.addWake(e.x, e.z, 0.8 + Math.min(e.strength * 0.08, 0.8));
      audio.slap(e);
    } else if (e.type === 'spout') {
      spray.spout(e.x, e.y, e.z, e.strength);
      audio.blow(e);
    } else if (e.type === 'damage') {
      hud.flashDamage();
      chase.addShake(0.4);
      audio.damage();
    }
    for (const s of game.systems) s.onEvent?.(e);
  }
  controller.events.length = 0;
}

function surfaceEffects(dt) {
  const c = controller;
  const atSurface = c.submersion > 0.15 && c.depth < 1.8;
  const speed = c.relSpeed;

  wakeTimer -= dt;
  if (atSurface && speed > 1.5 && wakeTimer <= 0) {
    ocean.addWake(c.position.x, c.position.z, THREE.MathUtils.clamp(speed / 10, 0.25, 1));
    wakeTimer = 0.22;
  }

  // Bow spray when pushing hard through the surface.
  if (atSurface && c.depth < 1.2 && speed > 5) {
    const f = c.forward;
    const n = Math.floor((speed - 5) * 9 * dt + Math.random());
    const nx = c.position.x + f.x * 3.3;
    const nz = c.position.z + f.z * 3.3;
    for (let i = 0; i < n; i++) {
      const s = Math.random() < 0.5 ? 1 : -1;
      side.set(Math.cos(c.yaw) * s, 0, -Math.sin(c.yaw) * s);
      spray.bow(nx + side.x * 0.6, c.surfaceY, nz + side.z * 0.6, side, f, speed);
    }
  }
}

function boundaryWarning() {
  const p = controller.position;
  const edge = Math.max(Math.abs(p.x), Math.abs(p.z));
  if (edge > WORLD_HALF) {
    // A current pushes back toward the centre of the map.
    const push = Math.min((edge - WORLD_HALF) * 0.05, 6);
    const len = Math.hypot(p.x, p.z);
    controller.velocity.x -= (p.x / len) * push * PHYSICS_DT * 4;
    controller.velocity.z -= (p.z / len) * push * PHYSICS_DT * 4;
    return 'A strong current pushes you back: edge of the map';
  }
  if (controller.trapped > 0) return 'Caught in a net! Tap Action to break free';
  if (controller.breath < 0.25 && !controller.inAir) return 'Running out of air: swim up to breathe';
  if (controller.exhausted) return 'Too tired! Swim slowly to rest';
  return '';
}

function collectMarkers() {
  const markers = world.buoys.map((b) => ({ x: b.x, z: b.z, type: b.visited ? 'visited' : 'buoy', label: b.name }));
  for (const s of game.systems) s.markers?.(markers);
  return markers;
}

// The most urgent on-screen alert from any system (shark swarm, boat calling for help…).
function collectAlert() {
  const alerts = [];
  for (const sys of game.systems) sys.alerts?.(alerts);
  return alerts[0] || null;
}

function handleGlobalKeys() {
  if (!game.started) return;
  if (input.pressedAlways('pause') && !modalOpen()) openPause(game);
  if (input.pressedAlways('map') && !modalOpen()) hud.toggleBigMap();
  if (input.pressedAlways('panel')) game.toggleOceanPanel();
}

function frame() {
  const now = performance.now();
  const frameDt = (now - lastFrame) / 1000;
  lastFrame = now;
  const dt = Math.min(frameDt, 0.1);
  quality.update(frameDt);
  handleGlobalKeys();
  if (params.cycle && !game.paused) {
    params.hour = (params.hour + dt * params.cycleSpeed * game.timeScale) % 24;
    // Remember the time of day now and then (not every frame: it writes storage).
    if (Math.floor(game.time / 30) !== Math.floor((game.time - dt) / 30)) {
      save.hour = params.hour;
      game.persist();
    }
  }

  waves.chop = params.chop + (game.extraChop || 0); // events (the sea monster) can stir the sea
  waves.scale = params.scale;
  waves.fadeOrigin.copy(camera.position);

  if (!game.paused) {
    game.time += dt;
    accumulator += dt;
    let steps = 0;
    while (accumulator >= PHYSICS_DT && steps < 12) {
      waves.time += PHYSICS_DT * params.waveSpeed;
      controller.step(PHYSICS_DT);
      accumulator -= PHYSICS_DT;
      steps++;
    }
    if (steps === 12) accumulator = 0;
    handleEvents();
    surfaceEffects(dt);
    for (const s of game.systems) s.update?.(dt);
    interact.update(dt);
    world.update(game.time, controller.position, (b, n, total) => {
      hud.showToast(`${b.name} · ${n}/${total} places discovered`);
      game.onDiscover?.(b);
    });
    spray.update(dt, waves);
  }

  controller.applyTo(orca.group, orca.uniforms);
  chase.update(dt, controller, waves);
  touch.setAction(interact.label);
  hud.update(dt, {
    orca: controller,
    markers: collectMarkers(),
    warningText: game.started ? boundaryWarning() : '',
    missionInfo: game.missionInfo?.() || null,
    actionLabel: interact.label,
    hour: params.hour,
    night: game.isNight,
    timeScale: game.timeScale,
    alert: collectAlert(),
    bossBar: game.systems.reduce((found, sys) => found || sys.bossBar?.() || null, null),
    touchMode: document.body.classList.contains('touch-mode'),
  });

  const ou = ocean.uniforms;
  waves.writeUniforms(ou);
  ou.uClock.value = game.time;
  ou.uFoamAmount.value = params.foam;
  ou.uRipples.value = params.ripples;
  ocean.mesh.position.set(camera.position.x, 0, camera.position.z);
  sky.uniforms.uTime.value = game.time;
  sky.mesh.position.copy(camera.position);
  renderer.toneMappingExposure = params.exposure * (1 + 0.3 * (game.day?.night || 0)) * (1 - 0.45 * (game.gloom || 0));
  applyDay();

  input.endFrame();
  renderer.render(scene, camera);
}

function loop() {
  frame();
  requestAnimationFrame(loop);
}

try {
  await loadingStep(0.75, 'Preparing water and light…');
  applyDay();
  await renderer.compileAsync(scene, camera);
  await loadingStep(0.92, 'Final touches…');
  loop(); // the ocean starts moving behind the loading screen
  const { choice, name } = await loadingReady({ hasSave: save.started || Object.keys(save.missions).length > 0 || save.points > 0, savedName: save.name, onSettings: () => openSettings(game) });
  audio.unlock(); // still inside the tap's user activation
  if (choice === 'new') {
    resetProgress(save);
    save.name = name;
    save.started = true;
    game.persist();
    game.progression.apply();
    controller.respawn(START.x, START.z, START.yaw, 100, 100);
    game.tutorial?.start();
  }
  game.started = true;
  syncInput();
  game.updates = createUpdates(game);
} catch (error) {
  loadingFailed(error);
}

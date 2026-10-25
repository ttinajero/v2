import * as THREE from 'three';
import { openModal, el } from './ui.js';
import { ICONS } from './icons.js';
import { MISSIONS } from './missionDefs.js';

const ARROWS = ['↑', '↗', '→', '↘', '↓', '↙', '←', '↖'];

// Tall column of light that shows where to go, visible from far away.
function createBeacon(color) {
  const material = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      varying float vH;
      void main() {
        vH = uv.y;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uTime;
      varying float vH;
      void main() {
        float a = (1.0 - vH) * (0.55 + 0.15 * sin(uTime * 3.0 - vH * 12.0));
        gl_FragColor = vec4(uColor, a);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.6, 60, 16, 1, true).translate(0, 30, 0), material);
  beam.renderOrder = 3;
  beam.frustumCulled = false;
  return beam;
}

function formatTime(seconds) {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function starsHtml(n) {
  return `<div class="stars">${[0, 1, 2].map((i) => `<span class="${i < n ? 'on' : ''}">${ICONS.star}</span>`).join('')}</div>`;
}

// Mission engine: offers missions at map spots, runs the active one, scores and saves.
export function createMissions(game) {
  const { scene, controller, waves, save } = game;
  let active = null; // { def, instance, time }
  const beacons = new Map(); // mission id -> mesh
  const targetBeacon = createBeacon(0xffe066);
  targetBeacon.visible = false;
  scene.add(targetBeacon);

  const isUnlocked = (def) => !def.requires || def.requires(save, game);
  const available = () => MISSIONS.filter((d) => isUnlocked(d) && !active);

  for (const def of MISSIONS) {
    const b = createBeacon(save.missions[def.id] ? 0x5fa8b0 : 0x8fd8e0);
    b.scale.set(0.8, 0.6, 0.8);
    scene.add(b);
    beacons.set(def.id, b);
  }

  function refreshBeacons() {
    for (const def of MISSIONS) {
      const b = beacons.get(def.id);
      const show = !active && isUnlocked(def);
      b.visible = show;
      if (show) {
        b.material.uniforms.uColor.value.set(save.missions[def.id] ? 0x4b8a90 : 0x8fd8e0);
        b.position.set(def.start.x, waves.heightAt(def.start.x, def.start.z) - 0.5, def.start.z);
      }
    }
  }

  function briefing(def) {
    const best = save.missions[def.id];
    openModal({
      title: def.title,
      body: `<p class="mission-type">${def.type}</p><p>${def.intro}</p>${best ? `<p class="mission-best">Best: ${starsHtml(best)}</p>` : ''}`,
      buttons: [
        { label: 'Not now' },
        { label: best ? 'Play again' : 'Start mission', primary: true, onClick: () => start(def) },
      ],
    });
  }

  function start(def) {
    const ctx = {
      game,
      complete: (stars) => complete(stars),
      fail: (reason) => fail(reason),
      elapsed: () => (active ? active.time : 0),
    };
    active = { def, instance: null, time: 0 };
    active.instance = def.create(ctx);
    refreshBeacons();
    game.hud.showToast(`Mission: ${def.title}`);
    game.onMissionStart?.(def);
  }

  function end() {
    if (!active) return;
    active.instance.dispose?.();
    active = null;
    targetBeacon.visible = false;
    refreshBeacons();
  }

  function complete(starsOverride) {
    if (!active) return;
    const { def, time } = active;
    const [t3, t2] = def.stars || [Infinity, Infinity];
    const stars = starsOverride ?? (time <= t3 ? 3 : time <= t2 ? 2 : 1);
    const first = !save.missions[def.id];
    const points = Math.round(def.reward * (first ? 1 : 0.4) * (0.6 + stars * 0.2));
    save.missions[def.id] = Math.max(save.missions[def.id] || 0, stars);
    save.points += points;
    save.totalPoints += points;
    game.persist();
    end();
    game.onMissionComplete?.(def, stars, points);
    const body = el('div', 'mission-result');
    body.innerHTML = `${starsHtml(stars)}<p class="reward">${ICONS.star}<strong>+${points}</strong> points</p><p>${def.outro || 'Well done, guardian!'}</p>`;
    openModal({ title: 'Mission complete!', body, className: 'modal-complete', buttons: [{ label: 'Continue', primary: true }] });
  }

  function fail(reason) {
    if (!active) return;
    const def = active.def;
    end();
    game.onMissionFail?.(def);
    openModal({
      title: 'Mission failed',
      body: `<p>${reason}</p><p>Don't give up, you can try again!</p>`,
      buttons: [{ label: 'Later' }, { label: 'Try again', primary: true, onClick: () => start(def) }],
    });
  }

  // Captain Marina's board on the coast guard boat: every mission, start any unlocked one.
  function openBoard() {
    const list = el('div', 'board');
    for (const def of MISSIONS) {
      const unlocked = isUnlocked(def);
      const row = el('div', `board-row ${unlocked ? '' : 'locked'}`, list);
      const info = el('div', 'board-info', row);
      el('div', 'board-title', info, def.title);
      el('div', 'board-type', info, unlocked ? def.type : def.lockedText || 'Locked');
      el('div', 'board-stars', row, save.missions[def.id] ? starsHtml(save.missions[def.id]) : '');
      const btn = el('button', `btn btn-small ${save.missions[def.id] ? '' : 'btn-primary'}`, row, save.missions[def.id] ? 'Replay' : 'Start');
      btn.type = 'button';
      btn.disabled = !unlocked || !!active;
      btn.addEventListener('click', () => {
        modal.close();
        briefing(def);
      });
    }
    const done = MISSIONS.filter((d) => save.missions[d.id]).length;
    const intro = el('p', 'board-intro');
    intro.textContent = active ? `You are on a mission: ${active.def.title}. Finish it first!` : `"Thank you for helping the ocean, guardian! Pick a job." · ${done}/${MISSIONS.length} done`;
    const body = el('div');
    body.append(intro, list);
    const modal = openModal({ title: 'Captain Marina', body, className: 'modal-board' });
  }

  refreshBeacons();
  let refreshTimer = 0;

  return {
    get active() {
      return active;
    },
    start,
    openBoard,
    abandon() {
      end();
      game.hud.showToast('Mission abandoned');
    },
    update(dt) {
      for (const b of beacons.values()) b.material.uniforms.uTime.value = game.time;
      targetBeacon.material.uniforms.uTime.value = game.time;
      refreshTimer -= dt;
      if (refreshTimer <= 0) {
        refreshBeacons(); // follows the waves and newly unlocked missions
        refreshTimer = 0.5;
      }
      if (!active) return;
      active.time += dt;
      active.instance.update?.(dt);
      if (!active) return; // finished during update
      const t = active.instance.target?.();
      targetBeacon.visible = !!t;
      if (t) targetBeacon.position.set(t.x, waves.heightAt(t.x, t.z) - 0.5, t.z);
    },
    onEvent(e) {
      active?.instance.onEvent?.(e);
    },
    interactables(out) {
      if (active) {
        active.instance.interactables?.(out);
        return;
      }
      for (const def of available()) {
        out.push({ x: def.start.x, z: def.start.z, radius: 12, label: `Mission: ${def.title}`, onAction: () => briefing(def) });
      }
    },
    markers(out) {
      if (active) {
        active.instance.markers?.(out);
        const t = active.instance.target?.();
        if (t) out.push({ x: t.x, z: t.z, type: 'target', label: active.def.title });
        return;
      }
      for (const def of available()) out.push({ x: def.start.x, z: def.start.z, type: 'mission', label: def.title, color: save.missions[def.id] ? '#4b8a90' : undefined });
    },
    // Text for the HUD panel.
    info() {
      if (!active) return null;
      const inst = active.instance;
      const t = inst.target?.();
      let meta = inst.meta?.() || '';
      if (t) {
        const p = controller.position;
        const dist = Math.hypot(t.x - p.x, t.z - p.z);
        if (dist > 15) {
          // Arrow relative to where the orca is facing.
          const bearing = Math.atan2(t.x - p.x, t.z - p.z);
          const rel = Math.atan2(Math.sin(controller.yaw - bearing), Math.cos(controller.yaw - bearing));
          const arrow = ARROWS[(Math.round(rel / (Math.PI / 4)) + 8) % 8];
          meta = `${arrow} ${dist.toFixed(0)} m${meta ? ` · ${meta}` : ''}`;
        }
      }
      return { title: active.def.title, objective: inst.objective(), meta };
    },
    formatTime,
  };
}

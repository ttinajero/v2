import { WORLD_HALF } from './world.js';
import { ICONS } from './icons.js';
import { el } from './ui.js';

const CARDINALS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

const MARKER_STYLE = {
  buoy: { color: '#ffb347', size: 4 },
  visited: { color: '#6dffb0', size: 4 },
  target: { color: '#ffe066', size: 6 },
  mission: { color: '#8fd8e0', size: 5 },
  boat: { color: '#ff6b5c', size: 5 },
  hub: { color: '#7fb4ff', size: 6 },
  friend: { color: '#6dffb0', size: 3 },
  animal: { color: '#c9d6dc', size: 2.5 },
  danger: { color: '#ff3b3b', size: 5 },
  mystery: { color: '#b98cff', size: 7 },
};

function bar(parent, icon, cls) {
  const row = el('div', `hud-bar ${cls}`, parent);
  el('span', 'hud-bar-icon', row, icon);
  const track = el('div', 'hud-bar-track', row);
  const fill = el('div', 'hud-bar-fill', track);
  return { row, fill };
}

// Survival bars, readouts, mission panel, action prompt, minimap, full map and toasts.
export function createHud({ onMap, onPause, onProfile, onClock }) {
  const root = el('div', 'hud', document.body);

  const top = el('div', 'hud-topbar', root);
  const topButton = (icon, label, fn) => {
    const b = el('button', 'hud-icon-btn', top, icon);
    b.type = 'button';
    b.setAttribute('aria-label', label);
    b.title = label;
    b.addEventListener('click', fn);
    return b;
  };
  topButton(ICONS.profile, 'Profile', onProfile);
  topButton(ICONS.map, 'Map (M)', onMap);
  topButton(ICONS.pause, 'Pause (Esc)', onPause);

  const stats = el('div', 'hud-stats', root);
  const health = bar(stats, ICONS.heart, 'health');
  const energy = bar(stats, ICONS.bolt, 'energy');
  const air = bar(stats, ICONS.bubble, 'air');
  const readout = el('div', 'hud-readout', stats);
  // Tapping the clock toggles the day/night speed between normal and ×2.
  const clock = el('button', 'hud-clock', root);
  clock.type = 'button';
  clock.title = 'Tap to change time speed';
  clock.addEventListener('click', () => onClock?.());

  const mission = el('div', 'hud-mission', root);
  const missionTitle = el('div', 'hud-mission-title', mission);
  const missionText = el('div', 'hud-mission-text', mission);
  const missionMeta = el('div', 'hud-mission-meta', mission);

  const prompt = el('div', 'hud-prompt', root);
  const mini = el('canvas', 'hud-minimap', root);
  const big = el('canvas', 'hud-bigmap', root);
  const toast = el('div', 'hud-toast', root);
  const warning = el('div', 'hud-warning', root);
  const alertEl = el('div', 'hud-alert', root);
  const boss = el('div', 'hud-boss', root);
  const bossName = el('div', 'hud-boss-name', boss);
  const bossFill = el('div', 'hud-boss-fill', el('div', 'hud-boss-track', boss));
  const vignette = el('div', 'hud-damage', root);
  const dangerFrame = el('div', 'hud-danger-frame', root);
  const superChip = el('div', 'hud-super', root);
  let bigOpen = false;
  let toastTimer = 0;
  let damageTimer = 0;
  const toastQueue = [];
  const trail = [];
  let trailTimer = 0;
  let mapTime = 0;

  function sizeCanvas(c, cssW, cssH) {
    const dpr = Math.min(window.devicePixelRatio, 2);
    if (c.width !== cssW * dpr || c.style.width !== `${cssW}px`) {
      c.width = cssW * dpr;
      c.height = cssH * dpr;
      c.style.width = `${cssW}px`;
      c.style.height = `${cssH}px`;
    }
    return dpr;
  }

  function drawMap(c, cssSize, cx, cz, metersAcross, orca, markers, full) {
    const dpr = sizeCanvas(c, cssSize, cssSize);
    const ctx = c.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const s = cssSize / metersAcross;
    const toX = (x) => cssSize / 2 + (x - cx) * s;
    const toY = (z) => cssSize / 2 + (z - cz) * s;

    ctx.clearRect(0, 0, cssSize, cssSize);
    ctx.fillStyle = 'rgba(8, 28, 36, 0.82)';
    ctx.fillRect(0, 0, cssSize, cssSize);

    ctx.strokeStyle = 'rgba(140, 190, 190, 0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let g = -WORLD_HALF; g <= WORLD_HALF; g += 250) {
      ctx.moveTo(toX(g), toY(-WORLD_HALF));
      ctx.lineTo(toX(g), toY(WORLD_HALF));
      ctx.moveTo(toX(-WORLD_HALF), toY(g));
      ctx.lineTo(toX(WORLD_HALF), toY(g));
    }
    ctx.stroke();

    ctx.strokeStyle = 'rgba(240, 160, 90, 0.7)';
    ctx.setLineDash([6, 5]);
    ctx.strokeRect(toX(-WORLD_HALF), toY(-WORLD_HALF), WORLD_HALF * 2 * s, WORLD_HALF * 2 * s);
    ctx.setLineDash([]);

    if (trail.length > 1) {
      ctx.strokeStyle = 'rgba(220, 240, 240, 0.3)';
      ctx.beginPath();
      trail.forEach(([x, z], i) => (i ? ctx.lineTo(toX(x), toY(z)) : ctx.moveTo(toX(x), toY(z))));
      ctx.lineTo(toX(orca.position.x), toY(orca.position.z));
      ctx.stroke();
    }

    ctx.font = '11px ui-sans-serif, system-ui, sans-serif';
    const pulse = 0.5 + 0.5 * Math.sin(mapTime * 4);
    // Danger corridors (shark swarms): wide red bands.
    for (const m of markers) {
      if (m.type !== 'stripe') continue;
      ctx.strokeStyle = `rgba(255, 50, 50, ${0.3 + pulse * 0.25})`;
      ctx.lineCap = 'round';
      ctx.lineWidth = Math.max(6, m.width * s);
      ctx.beginPath();
      ctx.moveTo(toX(m.x1), toY(m.z1));
      ctx.lineTo(toX(m.x2), toY(m.z2));
      ctx.stroke();
    }
    ctx.lineCap = 'butt';
    for (const m of markers) {
      if (m.type === 'stripe') continue;
      if (m.type === 'animal' && !full && metersAcross > 900) continue;
      const style = MARKER_STYLE[m.type] || MARKER_STYLE.buoy;
      let x = toX(m.x);
      let y = toY(m.z);
      const inside = x > 6 && x < cssSize - 6 && y > 6 && y < cssSize - 6;
      if (!inside) {
        if (full || m.type === 'animal' || m.type === 'friend') continue;
        // Clamp to the edge so off-screen points of interest still show the way.
        x = Math.min(Math.max(x, 6), cssSize - 6);
        y = Math.min(Math.max(y, 6), cssSize - 6);
      }
      ctx.fillStyle = m.color || style.color;
      if (m.type === 'target') {
        ctx.strokeStyle = style.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, style.size + 3 + pulse * 4, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.beginPath();
      if (m.type === 'mystery') {
        // A glowing question mark.
        ctx.arc(x, y, style.size + pulse * 1.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 11px ui-sans-serif, system-ui, sans-serif';
        ctx.fillText('?', x - 3, y + 4);
        ctx.font = '11px ui-sans-serif, system-ui, sans-serif';
        ctx.beginPath();
      } else if (m.type === 'boat') {
        ctx.rect(x - 4, y - 4, 8, 8);
      } else if (m.type === 'hub') {
        ctx.moveTo(x, y - 7);
        ctx.lineTo(x + 6, y + 4);
        ctx.lineTo(x - 6, y + 4);
        ctx.closePath();
      } else {
        ctx.arc(x, y, inside || full ? style.size : 3, 0, Math.PI * 2);
      }
      ctx.fill();
      if (full && m.label) {
        ctx.fillStyle = 'rgba(230, 240, 240, 0.85)';
        ctx.fillText(m.label, x + 8, y + 4);
      }
    }

    const ox = toX(orca.position.x);
    const oy = toY(orca.position.z);
    ctx.save();
    ctx.translate(ox, oy);
    ctx.rotate(-Math.atan2(Math.sin(orca.yaw), Math.cos(orca.yaw)) + Math.PI);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.lineTo(5, 6);
    ctx.lineTo(0, 3);
    ctx.lineTo(-5, 6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = 'rgba(230, 240, 240, 0.8)';
    ctx.font = 'bold 11px ui-sans-serif, system-ui, sans-serif';
    ctx.fillText('N', cssSize / 2 - 4, 13);
  }

  function showToast(text, duration = 3.5) {
    toastQueue.push({ text, duration });
  }

  function setBar(b, value, lowAt) {
    b.fill.style.width = `${Math.max(0, Math.min(1, value)) * 100}%`;
    b.row.classList.toggle('low', value < lowAt);
  }

  function update(dt, { orca, markers, warningText, missionInfo, actionLabel, touchMode, hour = 12, night = false, timeScale = 1, alert = null, bossBar = null, danger = false, superTime = 0 }) {
    // Danger mode: a faint red frame around the screen while something threatens the orca.
    dangerFrame.classList.toggle('show', danger);
    superChip.classList.toggle('show', superTime > 0);
    if (superTime > 0) {
      const s = Math.ceil(superTime);
      superChip.textContent = `SUPER WHALE ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    }
    alertEl.textContent = alert || '';
    alertEl.classList.toggle('show', !!alert);
    boss.classList.toggle('show', !!bossBar);
    if (bossBar) {
      bossName.textContent = bossBar.name;
      bossFill.style.width = `${Math.max(0, Math.min(1, bossBar.value)) * 100}%`;
    }
    mapTime += dt;
    const h = Math.floor(hour);
    const m = Math.floor((hour - h) * 60 / 10) * 10;
    const clockHtml = `${night ? ICONS.moon : ICONS.sun}<span>${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}</span>${timeScale > 1 ? `<b>×${timeScale}</b>` : ''}`;
    if (clock.innerHTML !== clockHtml) clock.innerHTML = clockHtml;
    clock.classList.toggle('night', night);
    clock.classList.toggle('fast', timeScale > 1);
    clock.setAttribute('aria-label', `Time ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}, speed ×${timeScale}. Tap to change`);
    setBar(health, orca.health / orca.maxHealth, 0.3);
    setBar(energy, orca.energy / orca.maxEnergy, 0.2);
    setBar(air, orca.breath, 0.25);
    air.row.classList.toggle('full', orca.breath >= 0.999);

    const kmh = orca.speed * 3.6;
    const depth = Math.max(0, orca.depth - 0.77);
    const heading = ((Math.atan2(Math.sin(orca.yaw), -Math.cos(orca.yaw)) * 180) / Math.PI + 360) % 360;
    readout.textContent = `${kmh.toFixed(0)} km/h · ${orca.inAir ? 'airborne' : `${depth.toFixed(1)} m deep`} · ${CARDINALS[Math.round(heading / 45) % 8]}`;

    if (missionInfo) {
      mission.classList.add('show');
      missionTitle.textContent = missionInfo.title;
      missionText.textContent = missionInfo.objective;
      missionMeta.textContent = missionInfo.meta || '';
    } else {
      mission.classList.remove('show');
    }

    if (actionLabel && !touchMode) {
      prompt.innerHTML = `<kbd>F</kbd> ${actionLabel}`;
      prompt.classList.add('show');
    } else {
      prompt.classList.remove('show');
    }

    trailTimer -= dt;
    if (trailTimer <= 0) {
      trail.push([orca.position.x, orca.position.z]);
      if (trail.length > 600) trail.shift();
      trailTimer = 1.5;
    }

    drawMap(mini, touchMode ? 150 : 190, orca.position.x, orca.position.z, 700, orca, markers, false);
    if (bigOpen) {
      const size = Math.max(200, Math.min(window.innerWidth, window.innerHeight) - 100);
      drawMap(big, size, 0, 0, WORLD_HALF * 2.1, orca, markers, true);
    }

    if (toastTimer > 0) {
      toastTimer -= dt;
      if (toastTimer <= 0) toast.classList.remove('show');
    } else if (toastQueue.length) {
      const next = toastQueue.shift();
      toast.textContent = next.text;
      toast.classList.add('show');
      toastTimer = next.duration;
    }
    warning.textContent = warningText || '';
    warning.classList.toggle('show', !!warningText);

    if (damageTimer > 0) {
      damageTimer -= dt;
      if (damageTimer <= 0) vignette.classList.remove('show');
    }
  }

  return {
    update,
    showToast,
    toggleBigMap() {
      bigOpen = !bigOpen;
      big.classList.toggle('show', bigOpen);
    },
    get bigMapOpen() {
      return bigOpen;
    },
    flashDamage() {
      vignette.classList.add('show');
      damageTimer = 0.35;
    },
    setVisible(visible) {
      root.hidden = !visible;
    },
  };
}

import * as THREE from 'three';
import { WORLD_HALF } from '../world.js';

export const rand = (a, b) => a + Math.random() * (b - a);
export const dist2d = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

// A random spot between minD and maxD metres from the orca, kept inside the map.
export function pointNearOrca(game, minD, maxD, aheadBias = 1.4) {
  const c = game.controller;
  const a = c.yaw + rand(-aheadBias, aheadBias);
  const d = rand(minD, maxD);
  const lim = WORLD_HALF * 0.92;
  return {
    x: THREE.MathUtils.clamp(c.position.x + Math.sin(a) * d, -lim, lim),
    z: THREE.MathUtils.clamp(c.position.z + Math.cos(a) * d, -lim, lim),
  };
}

// Sprite drawn on a canvas once (question marks, ghosts, sirens…).
export function canvasSprite(draw, { size = 128, scale = 4, color = 0xffffff, additive = true } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  draw(canvas.getContext('2d'), size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({
    map: texture,
    color,
    transparent: true,
    depthWrite: false,
    toneMapped: false, // keep glows bright and saturated
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.setScalar(scale);
  sprite.renderOrder = 3;
  return sprite;
}

// Frees GPU memory of something we created for an event.
export function disposeObject(obj) {
  obj.traverse((o) => {
    o.geometry?.dispose();
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of mats) {
      if (m.userData?.shared) continue;
      m.map?.dispose();
      m.dispose();
    }
  });
}

// Distance from point p to the segment a-b, plus where along it (0..1) it is closest.
export function distanceToSegment(p, a, b) {
  const abx = b.x - a.x;
  const abz = b.z - a.z;
  const t = THREE.MathUtils.clamp(((p.x - a.x) * abx + (p.z - a.z) * abz) / (abx * abx + abz * abz), 0, 1);
  return { d: Math.hypot(p.x - (a.x + abx * t), p.z - (a.z + abz * t)), t };
}

// Red "!" that floats over anything attacking the orca, so it is easy to spot.
export function createDangerIcon() {
  const icon = canvasSprite(
    (ctx, n) => {
      ctx.fillStyle = '#ff3b3b';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = n * 0.06;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(n / 2, n * 0.1);
      ctx.lineTo(n * 0.92, n * 0.86);
      ctx.lineTo(n * 0.08, n * 0.86);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${n * 0.5}px ui-sans-serif, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('!', n / 2, n * 0.6);
    },
    { scale: 1.8, additive: false },
  );
  icon.userData.base = 1.8;
  icon.visible = false;
  return icon;
}

// Keeps a danger icon above a creature; `show` decides if it is visible this frame.
export function updateDangerIcon(game, icon, position, show) {
  icon.visible = show;
  if (!show) return;
  icon.position.set(position.x, game.waves.heightAt(position.x, position.z) + 3 + Math.sin(game.time * 6) * 0.25, position.z);
  icon.scale.setScalar(icon.userData.base + Math.sin(game.time * 8) * 0.2);
}

// When the orca is near the surface, attackers swim right below it with the fin out.
export function attackDepth(controller) {
  const orcaDepth = controller.surfaceY - controller.position.y;
  return orcaDepth < 2 ? 0.55 : Math.min(orcaDepth, 20);
}

import * as THREE from 'three';

function damp(current, target, lambda, dt) {
  return THREE.MathUtils.lerp(current, target, 1 - Math.exp(-lambda * dt));
}

// Third-person camera that trails the orca's heading, never dips below the waves,
// and can be swung around (mouse drag here, touch drag/pinch via orbit() and zoom()).
// It drifts back behind the orca after a moment.
export class ChaseCamera {
  constructor(camera, dom) {
    this.camera = camera;
    this.distance = 17;
    this.pitch = 0.3;
    this.yawOffset = 0;
    this.sensitivity = 1;
    this.reduceMotion = false;
    this.lastInteraction = -Infinity;
    this.yaw = null;
    this.shake = 0;
    this._look = new THREE.Vector3();
    this._desired = new THREE.Vector3();

    let dragging = false;
    dom.addEventListener('pointerdown', (e) => {
      dragging = true;
      try {
        dom.setPointerCapture(e.pointerId);
      } catch {
        /* pointer already gone */
      }
    });
    dom.addEventListener('pointerup', () => (dragging = false));
    dom.addEventListener('pointercancel', () => (dragging = false));
    dom.addEventListener('pointermove', (e) => {
      if (dragging) this.orbit(e.movementX, e.movementY);
    });
    dom.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        this.zoom(1 + e.deltaY * 0.001);
      },
      { passive: false },
    );
  }

  orbit(dx, dy) {
    this.yawOffset -= dx * 0.005 * this.sensitivity;
    this.pitch = THREE.MathUtils.clamp(this.pitch + dy * 0.004 * this.sensitivity, 0.04, 1.3);
    this.lastInteraction = performance.now();
  }

  zoom(factor) {
    this.distance = THREE.MathUtils.clamp(this.distance * factor, 7, 60);
  }

  addShake(amount) {
    if (!this.reduceMotion) this.shake = Math.min(this.shake + amount, 1.2);
  }

  update(dt, orca, waves) {
    if (performance.now() - this.lastInteraction > 1500) {
      this.yawOffset = damp(this.yawOffset, 0, 1.2, dt);
    }
    // Follow the heading lazily so turns read on screen (snappier with reduced motion).
    const follow = this.reduceMotion ? 6 : 3;
    this.yaw = this.yaw === null ? orca.yaw : this.yaw + Math.atan2(Math.sin(orca.yaw - this.yaw), Math.cos(orca.yaw - this.yaw)) * (1 - Math.exp(-follow * dt));

    const p = orca.position;
    const behind = this.yaw + this.yawOffset + Math.PI;
    const horiz = this.distance * Math.cos(this.pitch);
    const desired = this._desired.set(
      p.x + Math.sin(behind) * horiz,
      p.y + this.distance * Math.sin(this.pitch) + 1.5,
      p.z + Math.cos(behind) * horiz,
    );

    const cam = this.camera.position;
    const k = 1 - Math.exp(-6 * dt);
    cam.x += (desired.x - cam.x) * k;
    cam.z += (desired.z - cam.z) * k;
    cam.y += (desired.y - cam.y) * (1 - Math.exp(-4 * dt));
    const floor = waves.heightAt(cam.x, cam.z) + 1.2;
    if (cam.y < floor) cam.y = floor;

    this._look.set(p.x + Math.sin(this.yaw) * 3, p.y + 1, p.z + Math.cos(this.yaw) * 3);
    if (this.shake > 0) {
      const s = this.shake * 0.35;
      this._look.x += (Math.random() - 0.5) * s;
      this._look.y += (Math.random() - 0.5) * s;
      this.shake = Math.max(0, this.shake - dt * 2.5);
    }
    this.camera.lookAt(this._look);
  }
}

import * as THREE from 'three';

const G = 9.8;
const RADIUS = 0.9; // body half-height used for submersion
const HALF_SPAN = 3; // nose/tail sample distance from the centre
const FLUKE_TIP = 3.9; // centre to fluke tips
const BUOYANCY = 1.08; // slightly positive: rests with the back just breaking the surface
const CRUISE_THRUST = 2.5;
const SPRINT_THRUST = 12;
const MAX_DEPTH = 45;
const BREATH_SECONDS = 75; // how long a full breath lasts underwater
const TAIL_SLAP_TIME = 2.2;
const JUMP_TIME = 1.9;

// Energy costs and recovery (per second unless noted).
const ENERGY = { sprint: 7, jump: 18, tailSlap: 10, spyhop: 2, regen: 5, restRegen: 11 };

function damp(current, target, lambda, dt) {
  return THREE.MathUtils.lerp(current, target, 1 - Math.exp(-lambda * dt));
}

function wrapAngle(a) {
  return Math.atan2(Math.sin(a), Math.cos(a));
}

// Swimming physics: buoyancy from the real wave surface, drag against the moving water,
// thrust from the tail only while the tail is in the water, ballistic flight when breaching.
// On top of that, scripted orca behaviours (porpoising, jumps, spyhops, tail slaps)
// and the survival stats: health, energy and air.
export class OrcaController {
  constructor(waves, input) {
    this.waves = waves;
    this.input = input;
    this.maxHealth = 100;
    this.maxEnergy = 100;
    this.health = 100;
    this.energy = 100;
    this.exhausted = false;
    this.lastDamage = -Infinity;
    this.trapped = 0; // seconds stuck in a thrown net
    this.upgrades = { air: 0, speed: 0, strength: 0, energy: 0 };
    this.position = new THREE.Vector3(0, waves.heightAt(0, 0) - 0.77, 0);
    this.velocity = new THREE.Vector3();
    this.yaw = Math.PI; // facing north (-z)
    this.pitch = 0;
    this.roll = 0;
    this.yawRate = 0;
    this.pitchRate = 0;
    this.rollRate = 0;
    this.breath = 1;
    this.underTime = 0;
    this.blowTimer = 12;
    this.submersion = 1;
    this.depth = 0.77; // centre depth below the local surface
    this.surfaceY = 0;
    this.thrust = 0;
    this.relSpeed = 0; // speed through the water, ignoring wave currents
    this.diving = false;
    this.behavior = 'swim'; // swim | porpoise | jump | spyhop | tailslap
    this.behaviorTime = 0;
    this.events = [];

    // Animation state fed to the shader.
    this.swimPhase = 0;
    this.swimAmp = 0.08;
    this.strokeDrive = 0; // 0 gliding … 1 full power
    this.glideTimer = 0;
    this.bend = 0;
    this.arch = 0;
    this.flukeAmp = 0;
    this.dorsalSway = 0;
    this.pecL = new THREE.Vector2();
    this.pecR = new THREE.Vector2();
    this.time = 0;

    this.forward = new THREE.Vector3();
    this._flat = new THREE.Vector3();
    this._left = new THREE.Vector3();
    this._water = new THREE.Vector3();
    this._rel = new THREE.Vector3();
    this._lat = new THREE.Vector3();
    this._tipPrevY = 0;
    this._tipPrevAbove = false;
    this._airborne = false;
  }

  get speed() {
    return this.velocity.length();
  }

  get inAir() {
    return this.submersion <= 0.02;
  }

  _updateAxes() {
    const cp = Math.cos(this.pitch);
    this.forward.set(Math.sin(this.yaw) * cp, Math.sin(this.pitch), Math.cos(this.yaw) * cp);
    this._flat.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    this._left.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
  }

  _setBehavior(name) {
    this.behavior = name;
    this.behaviorTime = 0;
    this._slapSent = false;
  }

  get strength() {
    return 1 + this.upgrades.strength * 0.25;
  }

  setUpgrades(upgrades) {
    Object.assign(this.upgrades, upgrades);
    this.maxEnergy = 100 + this.upgrades.energy * 20;
    this.energy = Math.min(this.energy, this.maxEnergy);
  }

  damage(amount, source = 'hit') {
    if (this.time - this.lastDamage < 0.6 || this.health <= 0) return false;
    this.lastDamage = this.time;
    this.health = Math.max(0, this.health - amount);
    this.events.push({ type: 'damage', amount, source });
    if (this.health <= 0) this.events.push({ type: 'faint' });
    return true;
  }

  heal(health, energy = 0) {
    this.health = Math.min(this.maxHealth, this.health + health);
    this.energy = Math.min(this.maxEnergy, this.energy + energy);
  }

  _spend(amount) {
    this.energy = Math.max(0, this.energy - amount);
    if (this.energy <= 1) this.exhausted = true;
  }

  // Put the orca back at the surface somewhere safe (after fainting or a new game).
  respawn(x, z, yaw, health = 60, energy = 60) {
    this.position.set(x, this.waves.heightAt(x, z) - 0.77, z);
    this.velocity.set(0, 0, 0);
    this.yaw = yaw;
    this.pitch = 0;
    this.roll = 0;
    this.health = Math.min(this.maxHealth, health);
    this.energy = Math.min(this.maxEnergy, energy);
    this.breath = 1;
    this.exhausted = false;
    this.trapped = 0;
    this.diving = false;
    this._airborne = false;
    this._setBehavior('swim');
  }

  step(dt) {
    const { waves, input, position: p, velocity: v } = this;
    this.time += dt;
    this.behaviorTime += dt;
    this._updateAxes();
    const flat = this._flat;
    const left = this._left;

    // Sample the surface under the centre, nose, tail and both flanks.
    const hC = waves.heightAt(p.x, p.z);
    const hN = waves.heightAt(p.x + flat.x * HALF_SPAN, p.z + flat.z * HALF_SPAN);
    const hT = waves.heightAt(p.x - flat.x * HALF_SPAN, p.z - flat.z * HALF_SPAN);
    const hL = waves.heightAt(p.x + left.x * 1.2, p.z + left.z * 1.2);
    const hR = waves.heightAt(p.x - left.x * 1.2, p.z - left.z * 1.2);

    const prevSub = this.submersion;
    const depth = hC - p.y;
    const sub = THREE.MathUtils.clamp((depth + RADIUS) / (2 * RADIUS), 0, 1);
    const tailY = p.y - this.forward.y * HALF_SPAN;
    const tailSub = THREE.MathUtils.clamp((hT - tailY + 0.4) / 0.8, 0, 1);
    const surfaceFactor = 1 - THREE.MathUtils.smoothstep(depth, 0.6, 3);
    this.depth = depth;
    this.surfaceY = hC;
    this.submersion = sub;
    const inAir = sub <= 0.02;
    const atSurface = !inAir && depth < 2;

    // --- Input ---
    if (this.exhausted && this.energy > 25) this.exhausted = false;
    const trapped = this.trapped > 0;
    const forwardAmt = trapped ? 0 : input.forward();
    const forwardKey = forwardAmt > 0;
    const backKey = !trapped && input.back();
    const sprint = input.held('sprint') && !this.exhausted;
    const turn = trapped ? 0 : input.turn();
    const pitchIn = trapped ? 0 : (input.held('rise') ? 1 : 0) - (input.held('dive') ? 1 : 0);
    const spyhopKey = input.held('spyhop');
    const fwdSpeed = v.dot(this.forward);
    if (trapped) this.trapped = Math.max(0, this.trapped - dt);

    // Until told to dive, the orca keeps itself at the surface, riding the swell.
    if (pitchIn < 0) this.diving = true;
    else if (pitchIn > 0 || depth < 1) this.diving = false;

    // --- Behaviour selection ---
    const b = this.behavior;
    if (b === 'swim' || b === 'porpoise') {
      if (spyhopKey && atSurface && this.relSpeed < 3) this._setBehavior('spyhop');
      else if (input.pressed('tailSlap') && atSurface && this.relSpeed < 7 && !this.exhausted && this.energy >= ENERGY.tailSlap) {
        this._spend(ENERGY.tailSlap);
        this._setBehavior('tailslap');
      } else if (input.pressed('jump') && !inAir && depth < 5 && !this.exhausted && this.energy >= ENERGY.jump && !trapped) {
        this._spend(ENERGY.jump);
        this._setBehavior('jump');
      }
      else if (forwardKey && sprint && atSurface && !this.diving && pitchIn === 0 && this.relSpeed > 8) {
        if (b !== 'porpoise') this._setBehavior('porpoise');
      } else if (b === 'porpoise' && !inAir) this._setBehavior('swim');
    } else if (b === 'spyhop' && (!spyhopKey || depth > 4)) {
      this._setBehavior('swim');
    } else if (b === 'tailslap' && this.behaviorTime > TAIL_SLAP_TIME) {
      this._setBehavior('swim');
    } else if (b === 'jump' && (this.behaviorTime > JUMP_TIME || (inAir && this.behaviorTime > 0.5))) {
      this._setBehavior('swim');
    }
    const behavior = this.behavior;
    const bt = this.behaviorTime;

    // --- Heading ---
    if (!inAir) {
      const agility = behavior === 'spyhop' ? 0.5 : 0.45 + 0.45 * Math.min(Math.abs(fwdSpeed) / 6, 1);
      this.yawRate = damp(this.yawRate, turn * agility, 5, dt);
    } else {
      this.yawRate = damp(this.yawRate, 0, 1, dt);
    }
    this.yaw += this.yawRate * dt;

    // --- Pitch ---
    const prevPitch = this.pitch;
    const slopePitch = Math.atan2(hN - hT, HALF_SPAN * 2);
    if (inAir) {
      // Nose follows the arc of the jump.
      this.pitch = damp(this.pitch, Math.atan2(v.y, Math.hypot(v.x, v.z)), 3, dt);
    } else if (behavior === 'spyhop') {
      this.pitch = damp(this.pitch, 1.42, 2.2, dt);
    } else if (behavior === 'tailslap') {
      // Head down so the flukes rise, a wind-up, then a hard strike back down.
      let target = -1.15;
      let rate = 3;
      if (bt > 0.8 && bt < 1.05) target = -1.4;
      else if (bt >= 1.05 && bt < 1.5) {
        target = -0.35;
        rate = 11;
        if (!this._slapSent) {
          // The strike itself: whatever is close hears and feels it.
          this._slapSent = true;
          this.events.push({ type: 'tailslap', x: p.x, z: p.z });
        }
      }
      else if (bt >= 1.5) { target = slopePitch; rate = 2; }
      this.pitch = damp(this.pitch, target, rate, dt);
    } else if (behavior === 'jump') {
      // A quick dip to gather speed, then nose up and burst out of the water.
      if (bt < 0.45) this.pitch = damp(this.pitch, -0.45, 6, dt);
      else this.pitch = damp(this.pitch, 0.95, 5, dt);
    } else if (behavior === 'porpoise') {
      // Rhythmic low leaps: the cheapest way for an orca to travel fast.
      this.pitch = damp(this.pitch, 0.5 * Math.sin(bt * 2.2) + 0.08, 5, dt);
    } else if (pitchIn !== 0) {
      this.pitch += pitchIn * 1.1 * dt;
    } else {
      let target = slopePitch * surfaceFactor;
      if (this.breath < 0.15 && depth > 1.5) target = 0.6; // out of air: head for the surface
      this.pitch = damp(this.pitch, target, 1.2 + 2.5 * surfaceFactor, dt);
    }
    this.pitch = THREE.MathUtils.clamp(this.pitch, -1.45, 1.45);
    this.pitchRate = damp(this.pitchRate, (this.pitch - prevPitch) / dt, 8, dt);

    // --- Roll: bank into turns, rock with the swell, spin when steering mid-air ---
    const prevRoll = this.roll;
    if (inAir) {
      this.roll += turn * 2.4 * dt;
    } else {
      if (prevSub < 0.05) this.roll = wrapAngle(this.roll);
      const bank = -this.yawRate * THREE.MathUtils.clamp(fwdSpeed / 6, 0, 1) * 0.28;
      const swellRoll = Math.atan2(hL - hR, 2.4) * surfaceFactor;
      const target = behavior === 'spyhop' ? 0 : bank + swellRoll;
      this.roll = damp(this.roll, target, Math.abs(this.roll) > 1 ? 1.5 : 4, dt);
    }
    this.rollRate = damp(this.rollRate, (this.roll - prevRoll) / dt, 8, dt);

    this._updateAxes();
    const fwd = this.forward;

    // --- Forces ---
    const power = 1 + this.upgrades.speed * 0.1;
    let thrust = 0;
    if (forwardKey) thrust = (sprint ? SPRINT_THRUST : CRUISE_THRUST * forwardAmt) * power;
    else if (backKey) thrust = -2.5;
    if (this.exhausted) thrust = Math.min(thrust, CRUISE_THRUST * 0.7);
    if (this.breath < 0.15 && depth > 1.5) thrust = Math.max(thrust, CRUISE_THRUST);
    if (behavior === 'spyhop' || behavior === 'tailslap' || trapped) thrust = 0;
    if (behavior === 'jump') thrust = SPRINT_THRUST * (bt < 0.45 ? 1.2 : 2.4) * power;
    thrust *= tailSub * (0.5 + 0.5 * sub); // flukes push less once the body leaves the water
    this.thrust = thrust;

    v.y += (-G + G * BUOYANCY * sub) * dt;
    if (behavior === 'spyhop') {
      // Sculling with flukes and flippers holds the head up out of the water.
      v.y = damp(v.y, (hC - 0.6 - p.y) * 2.5, 6, dt);
    } else if (behavior === 'tailslap' && bt < 1.5) {
      v.y = damp(v.y, (hC - 1.6 - p.y) * 2, 4, dt);
    } else if (!this.diving && pitchIn === 0 && sub >= 1) {
      // Swim back up when a crest rolls over, scaled by how far under it ended up.
      const excess = Math.min((depth + RADIUS) / (2 * RADIUS) - 1, 3);
      v.y += excess * G * 1.6 * (1 - THREE.MathUtils.smoothstep(depth, 3, 6)) * dt;
    }
    v.addScaledVector(fwd, thrust * dt);

    // Drag is relative to the water, which itself moves in orbits under each wave.
    const water = waves.velocityAt(p.x, p.z, Math.max(depth, 0), this._water).multiplyScalar(sub);
    const rel = this._rel.copy(v).sub(water);
    let rf = rel.dot(fwd);
    const lat = this._lat.copy(rel).addScaledVector(fwd, -rf);
    const brakeDrag = backKey ? 2.5 : 1; // flippers flared out as air brakes
    const waveDrag = (1 + 0.6 * surfaceFactor * sub) * brakeDrag; // swimming at the surface costs more
    rf -= (0.08 * rf * Math.abs(rf) + 0.12 * rf) * waveDrag * sub * dt;
    this.relSpeed = Math.abs(rf);
    lat.multiplyScalar(Math.exp(-3.2 * sub * dt)); // fins and body resist sideways motion
    if (trapped) rf *= Math.exp(-4 * dt); // the net holds the orca back
    v.copy(fwd).multiplyScalar(rf).add(lat).add(water);

    p.addScaledVector(v, dt);
    if (p.y < -MAX_DEPTH) v.y += (-MAX_DEPTH - p.y) * 2 * dt;

    // --- Breathing: the blowhole sits on top of the head ---
    const blowX = p.x + fwd.x * 1.9;
    const blowZ = p.z + fwd.z * 1.9;
    const blowY = p.y + fwd.y * 1.9 + 0.7;
    const blowDepth = waves.heightAt(blowX, blowZ) - blowY;
    if (blowDepth < 0) {
      this.blowTimer -= dt;
      // An exhale on surfacing after a dive, and a breath every so often while resting.
      if (this.underTime > 4 || this.blowTimer <= 0) {
        this.events.push({ type: 'spout', x: blowX, y: blowY, z: blowZ, strength: this.underTime > 4 ? 1 : 0.6 });
        this.blowTimer = 18 + Math.random() * 14;
      }
      this.underTime = 0;
      this.breath = Math.min(1, this.breath + dt / 3);
    } else {
      this.underTime += dt;
      this.breath = Math.max(0, this.breath - dt / (BREATH_SECONDS * (1 + this.upgrades.air * 0.25)));
      if (this.breath <= 0) this.damage(3, 'air'); // the damage cooldown spaces these out
    }

    // --- Energy: sprinting and tricks tire the orca, easy swimming lets it recover ---
    if (sprint && forwardKey) {
      this._spend(ENERGY.sprint * dt);
    } else if (behavior === 'spyhop') {
      this._spend(ENERGY.spyhop * dt);
    } else if (behavior !== 'jump' && behavior !== 'tailslap') {
      const resting = this.relSpeed < 2 && !inAir;
      this.energy = Math.min(this.maxEnergy, this.energy + (resting ? ENERGY.restRegen : ENERGY.regen) * dt);
    }
    // Health slowly returns when well rested and out of trouble.
    if (this.energy > this.maxEnergy * 0.5 && this.time - this.lastDamage > 5 && this.breath > 0) {
      this.health = Math.min(this.maxHealth, this.health + 0.8 * dt);
    }

    // --- Surface events for spray and wake ---
    // The centre crossing the surface marks leaving and re-entering the water.
    if (!this._airborne && prevSub >= 0.5 && sub < 0.5 && v.y > 2.5) {
      this._airborne = true;
      this.events.push({ type: 'breach', x: p.x, y: hC, z: p.z, strength: v.y });
    } else if (this._airborne && sub >= 0.5) {
      this._airborne = false;
      if (v.y < -1.5) {
        // Landing on the side throws far more water than a clean head-first re-entry.
        const sideways = Math.abs(Math.sin(this.roll)) + Math.max(0, -this.pitch + 0.3) * 0.3;
        this.events.push({ type: 'splash', x: p.x, y: hC, z: p.z, strength: -v.y * (1 + sideways) });
      }
    }
    // Flukes striking the surface (tail slaps, landings, porpoising).
    const tipX = p.x - fwd.x * FLUKE_TIP;
    const tipZ = p.z - fwd.z * FLUKE_TIP;
    const tipY = p.y - fwd.y * FLUKE_TIP;
    const tipAbove = tipY > waves.heightAt(tipX, tipZ) + 0.1;
    const tipVy = (tipY - this._tipPrevY) / dt;
    if (this._tipPrevAbove && !tipAbove && tipVy < -3) {
      this.events.push({ type: 'slap', x: tipX, y: tipY, z: tipZ, strength: -tipVy });
    }
    this._tipPrevAbove = tipAbove;
    this._tipPrevY = tipY;

    this._animate(dt, { inAir, behavior, bt, turn, pitchIn, backKey, sprint, forwardKey });
  }

  // Fin and body motion. Kept separate from the physics but driven by the same state.
  _animate(dt, { inAir, behavior, bt, turn, pitchIn, backKey }) {
    const effort = Math.abs(this.thrust) / SPRINT_THRUST;

    // Power strokes while thrusting; when coasting, a single lazy stroke every few seconds.
    let drive = effort > 0 ? 0.35 + effort * 0.65 : 0;
    if (effort === 0 && !inAir) {
      this.glideTimer -= dt;
      if (this.glideTimer <= -1.3) this.glideTimer = 2.5 + Math.random() * 2.5;
      if (this.glideTimer <= 0) drive = 0.25;
    }
    if (behavior === 'spyhop') drive = 0.3;
    if (behavior === 'tailslap') drive = 0;
    if (inAir) drive = 0;
    this.strokeDrive = damp(this.strokeDrive, drive, 3, dt);

    const frequency = 0.9 + this.strokeDrive * 6 + this.relSpeed * 0.12; // rad/s of phase
    this.swimPhase += dt * frequency;
    this.swimAmp = damp(this.swimAmp, 0.02 + this.strokeDrive * 0.26, 4, dt);
    this.flukeAmp = damp(this.flukeAmp, 0.05 + this.strokeDrive * 0.5, 4, dt);

    this.bend = damp(this.bend, -this.yawRate * 0.35, 4, dt);
    this.arch = damp(this.arch, THREE.MathUtils.clamp(this.pitchRate * 0.35, -0.5, 0.5), 6, dt);
    // The tall fin lags behind rolls and turns.
    this.dorsalSway = damp(this.dorsalSway, THREE.MathUtils.clamp(-this.rollRate * 0.05 + this.yawRate * 0.05, -0.12, 0.12), 5, dt);

    // Flippers: tucked when fast, flared to brake, angled to steer and pitch, sculling when slow.
    const tuck = THREE.MathUtils.smoothstep(this.relSpeed, 4, 11);
    let flap = 0.05 - tuck * 0.15;
    let attack = -pitchIn * 0.35;
    let steer = turn * 0.3 * (1 - tuck * 0.5);
    if (backKey) {
      flap = 0.35;
      attack = 0.9;
    }
    if (inAir) {
      flap = 0.3 + Math.sin(this.time * 1.5) * 0.05;
      attack = 0.1;
      steer = 0;
    }
    let scull = 0;
    if (behavior === 'spyhop') {
      scull = Math.sin(this.time * 2.2) * 0.3;
      attack = 0.4;
      flap = 0.2;
    } else if (behavior === 'swim' && this.relSpeed < 2) {
      scull = Math.sin(this.time * 1.1) * 0.07;
    }
    if (behavior === 'tailslap' && bt < 1.5) {
      flap = 0.4;
      attack = 0.5;
    }
    // Turning left lowers the left flipper's leading edge and raises the right one's.
    this.pecL.x = damp(this.pecL.x, flap + scull - steer * 0.4, 6, dt);
    this.pecR.x = damp(this.pecR.x, flap + scull + steer * 0.4, 6, dt);
    this.pecL.y = damp(this.pecL.y, attack + steer, 6, dt);
    this.pecR.y = damp(this.pecR.y, attack - steer, 6, dt);
  }

  applyTo(group, uniforms) {
    group.position.copy(this.position);
    group.rotation.set(-this.pitch, this.yaw, this.roll);
    uniforms.uSwimPhase.value = this.swimPhase;
    uniforms.uSwimAmp.value = this.swimAmp;
    uniforms.uBend.value = this.bend;
    uniforms.uArch.value = this.arch;
    uniforms.uFlukeAmp.value = this.flukeAmp;
    uniforms.uDorsalSway.value = this.dorsalSway;
    uniforms.uPecL.value.copy(this.pecL);
    uniforms.uPecR.value.copy(this.pecR);
    uniforms.uSurfaceY.value = this.surfaceY;
  }
}

import * as THREE from 'three';
import { Creature } from '../animals.js';
import { createShark } from '../models.js';
import { openModal } from '../ui.js';
import { rand, dist2d, pointNearOrca, createDangerIcon, updateDangerIcon, attackDepth } from './common.js';

const NOTICE_RADIUS = 45;
const ESCAPE_DISTANCE = 60;
const FLEE_TIME = 30;
const MAX_HP = 100;

// A great white roams with its fin out. Get close and you choose: fight or flee.
export function createGreatWhite(game) {
  const c = game.controller;
  const orca = c.position;
  const spot = pointNearOrca(game, 260, 420, Math.PI);
  const model = createShark();
  model.scale.setScalar(1.9);
  const shark = new Creature(game, model, { x: spot.x, z: spot.z, depth: 0.7, speed: 2.5, turnRate: 1.2 });
  shark.home = { x: spot.x, z: spot.z, radius: 80 };
  const icon = createDangerIcon();
  icon.userData.base = 2.6;
  game.scene.add(icon);

  let mode = 'roam'; // roam | choosing | fight | flee | beaten | gone
  let hp = MAX_HP;
  let timer = 0;
  let attackTimer = rand(3, 5);
  let charging = false;
  let biteCooldown = 0;
  let hitCooldown = 0;
  let stunned = 0;
  let orbitDir = Math.random() < 0.5 ? 1 : -1;

  // Leaving (beaten or done): the timer restarts so it has a few seconds to swim off.
  function leave(next) {
    mode = next;
    timer = 0;
  }

  function hurt(amount, how) {
    if (mode !== 'fight') return;
    hp = Math.max(0, hp - amount * c.strength);
    stunned = 0.8;
    charging = false;
    game.chase.addShake(0.3);
    game.spray.splash(shark.position.x, c.surfaceY, shark.position.z, 2);
    game.hud.showToast(how);
    if (hp <= 0) {
      leave('beaten');
      game.save.points += 150;
      game.save.totalPoints += 150;
      game.persist();
      game.discover?.('greatwhite');
      game.audio?.success();
      game.hud.showToast('You won! +150 points. Great whites are afraid of orcas in real life too!', 6);
    }
  }

  function choose() {
    mode = 'choosing';
    game.audio?.danger();
    openModal({
      title: 'A great white shark!',
      body: '<p>A huge great white shark is coming straight at you. What do you do?</p><p class="small-print">Fight: ram it, tail slap it and bite it. Flee: sprint away until you are 60 m away.</p>',
      dismissable: false,
      className: 'modal-choice',
      buttons: [
        { label: 'Flee', onClick: () => { mode = 'flee'; timer = 0; } },
        { label: 'Fight', primary: true, onClick: () => { mode = 'fight'; timer = 0; } },
      ],
    });
  }

  return {
    update(dt) {
      timer += dt;
      biteCooldown = Math.max(0, biteCooldown - dt);
      hitCooldown = Math.max(0, hitCooldown - dt);
      stunned = Math.max(0, stunned - dt);
      const d = shark.distanceTo(orca);

      if (mode === 'roam') {
        shark.wander(dt);
        shark.targetSpeed = 2.5;
        shark.targetDepth = 0.7; // dorsal fin cuts the surface
        if (d < NOTICE_RADIUS && !c.inAir) choose();
        if (timer > 240) leave('gone');
      } else if (mode === 'fight') {
        if (stunned > 0) {
          shark.targetSpeed = 1;
        } else if (charging) {
          shark.steerTo(orca.x, orca.z, dt, 2.5);
          shark.targetSpeed = 9;
          if (d < 5 && biteCooldown === 0) {
            c.damage(12, 'greatwhite');
            biteCooldown = 2.5;
            charging = false;
            attackTimer = rand(3, 5);
          }
          if (timer > 4) charging = false;
        } else {
          // Circle the orca, then charge.
          const a = Math.atan2(shark.position.x - orca.x, shark.position.z - orca.z) + orbitDir * 0.6;
          shark.steerTo(orca.x + Math.sin(a) * 14, orca.z + Math.cos(a) * 14, dt, 2);
          shark.targetSpeed = 5;
          attackTimer -= dt;
          if (attackTimer <= 0) {
            charging = true;
            timer = 0;
            orbitDir = -orbitDir;
          }
        }
        shark.targetDepth = attackDepth(c);
        // A fast ram with the nose pointed at the shark hurts it.
        const toShark = { x: shark.position.x - orca.x, z: shark.position.z - orca.z };
        const len = Math.hypot(toShark.x, toShark.z) || 1;
        const facing = (c.forward.x * toShark.x + c.forward.z * toShark.z) / len;
        if (d < 6 && c.relSpeed > 5 && facing > 0.5 && hitCooldown === 0) {
          hitCooldown = 1.2;
          hurt(20, 'RAM! Direct hit!');
        }
        if (d > 160) leave('gone'); // swam away from the fight
      } else if (mode === 'flee') {
        shark.steerTo(orca.x, orca.z, dt, 2);
        shark.targetSpeed = 6; // a full sprint is enough to get away
        shark.targetDepth = attackDepth(c);
        if (d < 4.5 && biteCooldown === 0) {
          c.damage(10, 'greatwhite');
          biteCooldown = 2.5;
        }
        if (d > ESCAPE_DISTANCE) {
          game.save.points += 25;
          game.save.totalPoints += 25;
          game.persist();
          game.hud.showToast('You got away! +25 points');
          leave('gone');
        } else if (timer > FLEE_TIME) {
          game.hud.showToast('The great white lost interest and swam off.');
          leave('gone');
        }
      } else if (mode === 'beaten' || mode === 'gone') {
        shark.steerAway(orca.x, orca.z, dt, 2);
        shark.targetSpeed = 8;
        shark.targetDepth = 6;
        if (timer > 8 || d > 250) this.done = true;
      }
      if (mode !== 'choosing') shark.move(dt, mode === 'roam' ? 0.4 : 0.9);
      updateDangerIcon(game, icon, shark.position, mode === 'fight' || mode === 'flee' || mode === 'choosing');
    },
    onEvent(e) {
      if (e.type === 'tailslap' && dist2d(shark.position, orca) < 11) hurt(12, 'Tail slap hit!');
    },
    onFaint() {
      if (mode === 'fight' || mode === 'flee') leave('gone');
    },
    interactables(out) {
      if (mode !== 'fight') return;
      out.push({
        x: shark.position.x,
        y: shark.position.y,
        z: shark.position.z,
        radius: 6.5,
        label: 'Bite',
        cooldown: 0.8,
        onAction: () => {
          game.audio?.bite();
          hurt(8, 'Bite!');
        },
      });
    },
    bossBar() {
      return mode === 'fight' ? { name: 'Great White Shark', value: hp / MAX_HP } : null;
    },
    alerts(out) {
      if (mode === 'flee') out.push(`Swim away! ${Math.round(shark.distanceTo(orca))} / ${ESCAPE_DISTANCE} m`);
    },
    markers(out) {
      if (mode !== 'roam' || shark.distanceTo(orca) < 300) out.push({ x: shark.position.x, z: shark.position.z, type: 'danger', label: 'Great white' });
    },
    dispose() {
      game.scene.remove(model, icon);
      icon.material.map.dispose();
      icon.material.dispose();
      model.traverse((o) => o.geometry?.dispose());
    },
  };
}

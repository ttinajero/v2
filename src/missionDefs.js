import * as THREE from 'three';
import { createTurtle, createNet, createDolphin, createWhale, createSeal, animateCreature } from './models.js';
import { createRing, createBottle, createTrash, createShipwreck, createKelpForest, createChest, createPearl, createSandbar, createIceFloe } from './props.js';
import { Creature } from './animals.js';
import { FAMILY } from './family.js';

// Each mission: { id, title, type, intro, outro, start: {x, z}, reward, stars: [3★ time, 2★ time],
// requires?(save, game), lockedText, create(ctx) -> { update, objective, target, meta, interactables,
// markers, onEvent, dispose } }. ctx = { game, complete(stars?), fail(reason), elapsed() }.
// Captain Marina, on the coast guard boat, tells the story in the intros.

const rand = (a, b) => a + Math.random() * (b - a);
const dist2d = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const doneCount = (save) => Object.keys(save.missions).length;
const pct = (v) => `${Math.round(Math.min(Math.max(v, 0), 1) * 100)}%`;

function floatOnWaves(game, obj, x, z, depth = 0) {
  obj.position.set(x, game.waves.heightAt(x, z) - depth, z);
}

// Releases GPU memory for a removed object (materials are shared, so they stay).
function freeGeometry(obj) {
  obj.traverse((o) => o.geometry?.dispose());
}

// Tracks what a mission adds so it can all be cleaned up afterwards.
function scope(game) {
  const objects = [];
  const boats = [];
  const creatures = [];
  return {
    add(o) {
      game.scene.add(o);
      objects.push(o);
      return o;
    },
    boat(type, opts) {
      const b = game.boats.spawn(type, opts);
      boats.push(b);
      return b;
    },
    creature(model, opts) {
      const c = new Creature(game, model, opts);
      creatures.push(c);
      return c;
    },
    dispose() {
      objects.forEach((o) => {
        game.scene.remove(o);
        freeGeometry(o);
      });
      boats.forEach((b) => game.boats.remove(b));
      creatures.forEach((c) => {
        game.scene.remove(c.model);
        freeGeometry(c.model);
      });
    },
  };
}

// ---------- Rescue: Tangled Turtle ----------
const tangledTurtle = {
  id: 'tangled-turtle',
  title: 'Tangled Turtle',
  type: 'Rescue',
  intro: 'Captain Marina: "A sea turtle is stuck in an old fishing net and cannot swim up to breathe! Find it and bite the net to set it free before its air runs out."',
  outro: 'The turtle is free! Old nets are dangerous for everyone in the sea.',
  start: { x: 30, z: -10 },
  reward: 100,
  stars: [45, 75],
  create({ game, complete, fail }) {
    const spot = { x: 170, z: -230 };
    const sc = scope(game);
    const turtle = sc.add(createTurtle());
    const net = sc.add(createNet(1.6));
    let netHealth = 5;
    let air = 90;
    let freed = false;
    let freeTime = 0;
    return {
      objective: () => (freed ? 'The turtle is free!' : netHealth === 5 ? 'Find the tangled turtle' : `Bite the net! ${netHealth} more`),
      meta: () => (freed ? '' : `Turtle's air ${Math.ceil(air)}s`),
      target: () => (freed ? null : spot),
      update(dt) {
        const t = game.time;
        if (!freed) {
          air -= dt;
          if (air <= 0) return fail('The turtle ran out of air. Turtles need to reach the surface to breathe.');
          floatOnWaves(game, turtle, spot.x, spot.z, 0.6);
          turtle.rotation.set(Math.sin(t * 3) * 0.15, 0.6, Math.sin(t * 2.3) * 0.2);
          animateCreature(turtle, t, 1);
          net.position.copy(turtle.position);
          net.rotation.y = t * 0.2;
          net.scale.setScalar(0.5 + 0.5 * (netHealth / 5));
        } else {
          freeTime += dt;
          turtle.position.x += Math.sin(0.6) * 2.5 * dt;
          turtle.position.z += Math.cos(0.6) * 2.5 * dt;
          turtle.position.y -= 0.6 * dt;
          turtle.rotation.set(0.25, 0.6, 0);
          animateCreature(turtle, t, 0.4);
          net.position.y -= 1.5 * dt;
          net.children[0].material.opacity = Math.max(0, 0.9 - freeTime * 0.4);
          if (freeTime > 3) complete();
        }
      },
      interactables(out) {
        if (freed) return;
        out.push({
          x: turtle.position.x,
          y: turtle.position.y,
          z: turtle.position.z,
          radius: 6,
          label: 'Bite net',
          cooldown: 0.35,
          onAction() {
            netHealth--;
            const p = turtle.position;
            game.spray.splash(p.x, game.waves.heightAt(p.x, p.z), p.z, 1.2);
            game.chase.addShake(0.25);
            game.onBite?.();
            if (netHealth <= 0) {
              freed = true;
              game.hud.showToast('You freed the turtle!');
              game.discover?.('turtle');
            }
          },
        });
      },
      dispose: () => sc.dispose(),
    };
  },
};

// ---------- Defense: Dolphin Defense ----------
const dolphinDefense = {
  id: 'dolphin-defense',
  title: 'Dolphin Defense',
  type: 'Defense',
  intro: 'Captain Marina: "Poachers in a speedboat are chasing a family of dolphins! Jump next to the boat, slap your tail and ram it until the crew is scared enough to leave."',
  outro: 'The dolphins are safe, and two of them want to swim with you from now on!',
  start: { x: 220, z: -60 },
  reward: 150,
  stars: [60, 100],
  requires: (save) => doneCount(save) >= 1,
  lockedText: 'Finish 1 mission to unlock',
  create({ game, complete, fail }) {
    const sc = scope(game);
    const center = { x: 430, z: -230 };
    const pod = [0, 1, 2].map((i) => {
      const d = sc.creature(createDolphin(), { x: center.x + i * 4, z: center.z + rand(-3, 3), depth: 1, speed: 5, turnRate: 1.5 });
      d.offset = [rand(-5, 5), rand(-6, 2)];
      return d;
    });
    const leader = pod[0];
    const boat = sc.boat('speedboat', { x: center.x + 120, z: center.z - 120, target: leader, spec: { speed: 7 } });
    const CAPTURE = 12;
    let doneTimer = 0;
    return {
      objective: () => (boat.fleeing ? 'They are running away!' : `Scare off the speedboat! Fear ${pct(boat.fear / 100)}`),
      meta: () => (boat.fleeing ? '' : `Dolphins in danger ${pct(boat.capture / CAPTURE)}`),
      target: () => (boat.fleeing ? null : boat.position),
      update(dt) {
        // The pod flees from the boat.
        leader.steerAway(boat.position.x, boat.position.z, dt, 1.2);
        leader.home = { x: 0, z: 0, radius: 1300 };
        leader.wander(dt);
        for (const d of pod) {
          if (d !== leader) {
            const h = leader.heading;
            d.steerTo(leader.position.x + Math.cos(h) * d.offset[0] + Math.sin(h) * d.offset[1], leader.position.z - Math.sin(h) * d.offset[0] + Math.cos(h) * d.offset[1], dt, 2.5);
            d.targetSpeed = 5.5;
          }
          d.leap = Math.max(0, Math.sin(game.time * 1.8 + d.phase)) * 1.2 - 0.2;
          d.move(dt, 0.8);
        }
        if (boat.fleeing) {
          doneTimer += dt;
          if (doneTimer > 2) {
            if (game.save.friends < 2) game.save.friends = 2;
            complete();
          }
        } else if (boat.capture >= CAPTURE) {
          fail('The poachers caught the dolphins. Scare the boat faster next time!');
        }
      },
      markers(out) {
        out.push({ x: leader.position.x, z: leader.position.z, type: 'friend' });
      },
      dispose: () => sc.dispose(),
    };
  },
};

// ---------- Defense: Net Cutter ----------
const netCutter = {
  id: 'net-cutter',
  title: 'Net Cutter',
  type: 'Defense',
  intro: 'Captain Marina: "An illegal fishing boat is dragging a huge net. Bite through its three lines to free the fish, then make the boat leave for good."',
  outro: 'The net is gone and the fishing boat has left. The fish thank you!',
  start: { x: -260, z: 120 },
  reward: 150,
  stars: [80, 140],
  requires: (save) => doneCount(save) >= 1,
  lockedText: 'Finish 1 mission to unlock',
  create({ game, complete }) {
    const sc = scope(game);
    const boat = sc.boat('trawler', { x: -380, z: 260, route: [[-380, 260], [-520, 420], [-300, 560], [-200, 380]] });
    let doneTimer = 0;
    return {
      objective: () => {
        if (boat.fleeing) return 'The boat is leaving!';
        const left = boat.net ? boat.net.cut.filter((c) => !c).length : 0;
        return left > 0 ? `Bite the net lines: ${left} left` : `Now scare the boat away! Fear ${pct(boat.fear / 100)}`;
      },
      target: () => {
        if (boat.fleeing) return null;
        const p = boat.cutPoints()[0];
        return p || boat.position;
      },
      update(dt) {
        if (boat.fleeing) {
          doneTimer += dt;
          if (doneTimer > 2) complete();
        }
      },
      dispose: () => sc.dispose(),
    };
  },
};

// ---------- Rescue: Lost Calf ----------
const lostCalf = {
  id: 'lost-calf',
  title: 'Lost Calf',
  type: 'Rescue',
  intro: 'Captain Marina: "A baby humpback whale lost its mother in the storm. Find the calf, then swim slowly so it can follow you back to her."',
  outro: 'Mother and calf are together again. Listen to them sing!',
  start: { x: -420, z: -520 },
  reward: 150,
  stars: [100, 170],
  requires: (save) => doneCount(save) >= 2,
  lockedText: 'Finish 2 missions to unlock',
  create({ game, complete }) {
    const sc = scope(game);
    const calfModel = createWhale();
    calfModel.scale.setScalar(0.4);
    const calf = sc.creature(calfModel, { x: -500, z: -640, depth: 1, speed: 0.5, turnRate: 1 });
    const mother = sc.creature(createWhale(), { x: -850, z: -1020, depth: 2, speed: 1, turnRate: 0.2 });
    mother.home = { x: -850, z: -1020, radius: 40 };
    const orca = game.controller.position;
    let following = false;
    let reunited = 0;
    let blow = 4;
    return {
      objective: () => (reunited ? 'Together again!' : following ? 'Lead the calf to its mother (swim slowly)' : 'Find the lost whale calf'),
      meta: () => (following ? (dist2d(calf.position, orca) > 30 ? 'The calf is falling behind!' : '') : ''),
      target: () => (reunited ? null : following ? mother.position : calf.position),
      update(dt) {
        mother.wander(dt);
        mother.targetDepth = 1.5;
        mother.move(dt, 0.2);
        const d = dist2d(calf.position, orca);
        if (!following && d < 25) {
          following = true;
          game.hud.showToast('The calf is following you!');
          game.discover?.('humpback');
        }
        if (reunited) {
          reunited += dt;
          calf.steerTo(mother.position.x, mother.position.z, dt, 1);
          calf.targetSpeed = 1.5;
          if (reunited > 3) complete();
        } else if (following && d < 45) {
          calf.steerTo(orca.x, orca.z, dt, 1.2);
          calf.targetSpeed = THREE.MathUtils.clamp((d - 8) * 0.4, 0, 3.2);
        } else {
          calf.wander(dt);
          calf.targetSpeed = 0.6;
        }
        calf.move(dt, 0.5);
        blow -= dt;
        if (blow <= 0) {
          game.spray.spout(calf.position.x, game.waves.heightAt(calf.position.x, calf.position.z) + 0.2, calf.position.z, 0.7);
          blow = 9;
        }
        if (!reunited && dist2d(calf.position, mother.position) < 35) {
          reunited = 0.01;
          game.hud.showToast('The calf found its mother!');
        }
      },
      dispose: () => sc.dispose(),
    };
  },
};

// ---------- Rescue: Stranded Whale ----------
const strandedWhale = {
  id: 'stranded-whale',
  title: 'Stranded Whale',
  type: 'Rescue',
  intro: 'Captain Marina: "A humpback is stuck on a sandbank in the shallows! Push it back into deep water, but pushing is tiring, so keep an eye on your energy."',
  outro: 'The whale is back in deep water. What a strong orca you are!',
  start: { x: 820, z: -780 },
  reward: 160,
  stars: [60, 100],
  requires: (save) => doneCount(save) >= 3,
  lockedText: 'Finish 3 missions to unlock',
  create({ game, complete }) {
    const sc = scope(game);
    const bar = { x: 1000, z: -1000 };
    const sand = sc.add(createSandbar(32));
    sand.position.set(bar.x, -1.6, bar.z);
    const whale = sc.add(createWhale());
    const pos = new THREE.Vector3(bar.x, 0, bar.z);
    const away = Math.atan2(-bar.x, -bar.z); // toward the open sea in the middle of the map
    let freed = 0;
    return {
      objective: () => (freed ? 'It is swimming free!' : dist2d(pos, game.controller.position) > 30 ? 'Find the stranded whale' : `Push it to deep water: ${pct(dist2d(pos, bar) / 38)}`),
      target: () => (freed ? null : pos),
      update(dt) {
        const t = game.time;
        if (freed) {
          freed += dt;
          pos.x += Math.sin(away) * 2 * dt;
          pos.z += Math.cos(away) * 2 * dt;
          if (freed > 3) complete();
        }
        whale.position.set(pos.x, game.waves.heightAt(pos.x, pos.z) - (freed ? 2 : 0.6), pos.z);
        whale.rotation.set(0, away, freed ? 0 : 0.35 + Math.sin(t) * 0.03, 'YXZ');
        animateCreature(whale, t, freed ? 0.4 : 0.1);
      },
      interactables(out) {
        if (freed) return;
        out.push({
          x: pos.x,
          z: pos.z,
          radius: 10,
          label: 'Push',
          cooldown: 0.5,
          onAction() {
            const c = game.controller;
            if (c.energy < 6) {
              game.hud.showToast('Too tired to push! Rest or eat some fish');
              return;
            }
            c.energy -= 6;
            pos.x += Math.sin(away) * 4;
            pos.z += Math.cos(away) * 4;
            game.spray.splash(pos.x, game.waves.heightAt(pos.x, pos.z), pos.z, 2);
            game.chase.addShake(0.3);
            if (dist2d(pos, bar) > 38) {
              freed = 0.01;
              game.spray.spout(pos.x, game.waves.heightAt(pos.x, pos.z) + 0.5, pos.z, 1.6);
              game.hud.showToast('The whale is free!');
              game.discover?.('humpback');
            }
          },
        });
      },
      dispose: () => sc.dispose(),
    };
  },
};

// ---------- Defense: Crane Breaker ----------
const craneBreaker = {
  id: 'crane-breaker',
  title: 'Crane Breaker',
  type: 'Defense',
  intro: 'Captain Marina: "A big ship caught a seal and is lifting it with its crane! Jump out of the water right next to the ship to hit the crane. Three hits should break it."',
  outro: 'The crane broke and the seal splashed back into the sea. Hooray!',
  start: { x: 600, z: 250 },
  reward: 200,
  stars: [70, 120],
  requires: (save) => doneCount(save) >= 3,
  lockedText: 'Finish 3 missions to unlock',
  create({ game, complete }) {
    const sc = scope(game);
    const ship = sc.boat('whaler', { x: 720, z: 380, route: [[720, 380], [820, 520], [640, 600], [560, 440]], net: false, spec: { speed: 1.5 } });
    const seal = createSeal();
    const sealNet = createNet(1.1);
    // The seal hangs from the end of the crane arm.
    const hook = new THREE.Group();
    hook.position.set(0, 1.5, 7.5);
    hook.add(seal, sealNet);
    seal.rotation.x = Math.PI / 2;
    ship.crane.add(hook);
    let dropped = false;
    let drop = 0;
    let sealPos = null;
    let vel = 0;
    return {
      objective: () => (dropped ? 'The seal is free!' : `Jump right next to the ship to hit the crane (${ship.craneHealth} left)`),
      target: () => (dropped ? null : ship.position),
      update(dt) {
        if (!dropped && ship.craneHealth <= 0) {
          dropped = true;
          sealPos = new THREE.Vector3();
          seal.getWorldPosition(sealPos);
          hook.remove(seal);
          sc.add(seal);
          sealNet.visible = false;
          game.discover?.('seal');
        }
        if (dropped) {
          drop += dt;
          vel -= 9.8 * dt;
          sealPos.y = Math.max(sealPos.y + vel * dt, game.waves.heightAt(sealPos.x, sealPos.z) - 0.4);
          if (drop > 1) {
            sealPos.x += 3 * dt;
            seal.rotation.set(0, Math.PI / 2, 0);
          }
          seal.position.copy(sealPos);
          animateCreature(seal, game.time, 0.9);
          if (drop > 3.5) complete();
        } else {
          seal.rotation.z = Math.sin(game.time * 4) * 0.3; // wriggling
        }
      },
      dispose: () => sc.dispose(),
    };
  },
};

// ---------- Explore: Secret Places ----------
const secretPlaces = {
  id: 'secret-places',
  title: 'Secret Places',
  type: 'Explore',
  intro: 'Captain Marina: "Old sailors talk about three secret places: a sunken ship, a forest under the sea and a field of bubbles. Can you find all three?"',
  outro: 'You found every secret place. A true ocean explorer!',
  start: { x: -120, z: -160 },
  reward: 200,
  stars: [300, 500],
  requires: (save) => doneCount(save) >= 1,
  lockedText: 'Finish 1 mission to unlock',
  create({ game, complete }) {
    const sc = scope(game);
    const wreck = sc.add(createShipwreck());
    wreck.position.set(-1050, -13, -150);
    const kelp = sc.add(createKelpForest());
    kelp.position.set(250, 0, 1150);
    const spots = [
      { name: 'the shipwreck', x: -1050, z: -150, found: false },
      { name: 'the kelp forest', x: 250, z: 1150, found: false },
      { name: 'the bubble field', x: 1150, z: 850, found: false },
    ];
    const orca = game.controller.position;
    let finished = 0;
    const remaining = () => spots.filter((s) => !s.found);
    return {
      objective: () => (finished ? 'All found!' : `Find ${remaining().map((s) => s.name).join(', ')}`),
      meta: () => `${spots.length - remaining().length}/3 found`,
      target: () => {
        const r = remaining();
        if (!r.length) return null;
        return r.sort((a, b) => dist2d(a, orca) - dist2d(b, orca))[0];
      },
      update(dt) {
        kelp.userData.animate(game.time);
        // Bubbles rising from the sea floor.
        const b = spots[2];
        if (dist2d(b, orca) < 300 && Math.random() < dt * 25) {
          const x = b.x + rand(-15, 15);
          const z = b.z + rand(-15, 15);
          game.spray.emit(x, game.waves.heightAt(x, z) - 0.2, z, 0, rand(1, 2.5), 0, { size: rand(0.2, 0.5), life: 0.8, gravity: 0.2, opacity: 0.6 });
        }
        for (const s of spots) {
          if (!s.found && dist2d(s, orca) < 30) {
            s.found = true;
            game.hud.showToast(`You found ${s.name}!`);
          }
        }
        if (!remaining().length) {
          finished += dt;
          if (finished > 1.5) complete();
        }
      },
      dispose: () => sc.dispose(),
    };
  },
};

// ---------- Explore: Message in a Bottle ----------
const bottles = {
  id: 'bottle-messages',
  title: 'Message in a Bottle',
  type: 'Explore',
  intro: 'Captain Marina: "Five bottles with pieces of a treasure map are floating nearby. Collect them all, then dive down to the treasure!"',
  outro: 'You found the pirate treasure! Gold coins and an old compass.',
  start: { x: 60, z: 520 },
  reward: 180,
  stars: [150, 240],
  requires: (save) => doneCount(save) >= 2,
  lockedText: 'Finish 2 missions to unlock',
  create({ game, complete }) {
    const sc = scope(game);
    const items = Array.from({ length: 5 }, (_, i) => {
      const a = (i / 5) * Math.PI * 2 + rand(-0.3, 0.3);
      const r = rand(90, 230);
      return { x: 0 + Math.cos(a) * r, z: 700 + Math.sin(a) * r, mesh: sc.add(createBottle()), got: false };
    });
    const chestSpot = { x: -180, z: 820 };
    const chest = sc.add(createChest());
    let opened = 0;
    const orca = game.controller.position;
    const left = () => items.filter((i) => !i.got);
    return {
      objective: () => (left().length ? `Collect the bottles: ${5 - left().length}/5` : opened ? 'Treasure!' : 'Dive down to the treasure chest and open it'),
      meta: () => (left().length ? '' : `Treasure depth ${Math.max(0, game.controller.depth - 0.8).toFixed(0)} / 16 m`),
      target: () => {
        const l = left();
        if (l.length) return l.sort((a, b) => dist2d(a, orca) - dist2d(b, orca))[0];
        return opened ? null : chestSpot;
      },
      update(dt) {
        for (const it of items) {
          if (it.got) continue;
          floatOnWaves(game, it.mesh, it.x, it.z, 0.1);
          it.mesh.rotation.y += dt;
          if (dist2d(it, orca) < 5 && game.controller.depth < 3) {
            it.got = true;
            it.mesh.visible = false;
            game.hud.showToast(left().length ? `Bottle found! ${left().length} to go` : 'All the map pieces! The treasure is deep below the X');
          }
        }
        chest.visible = !left().length;
        chest.position.set(chestSpot.x, game.waves.heightAt(chestSpot.x, chestSpot.z) - 16, chestSpot.z);
        if (opened) {
          opened += dt;
          chest.userData.lid.rotation.x = Math.min(opened, 1) * -1.2;
          if (Math.random() < dt * 20) game.spray.emit(chest.position.x, chest.position.y + 0.6, chest.position.z, rand(-0.5, 0.5), rand(1, 2), rand(-0.5, 0.5), { size: 0.25, life: 1.2, gravity: -0.3, opacity: 0.9 });
          if (opened > 2.5) complete();
        }
      },
      interactables(out) {
        if (left().length || opened) return;
        out.push({ x: chest.position.x, y: chest.position.y, z: chest.position.z, radius: 6, label: 'Open chest', onAction: () => (opened = 0.01) });
      },
      dispose: () => sc.dispose(),
    };
  },
};

// ---------- Cleanup: Ocean Cleanup ----------
const cleanup = {
  id: 'ocean-cleanup',
  title: 'Ocean Cleanup',
  type: 'Cleanup',
  intro: 'Captain Marina: "Plastic bags, bottles and old nets are floating where the turtles eat. Swim into the rubbish to collect it before the tide carries it away!"',
  outro: 'The water is clean again. Every piece of plastic you pick up helps a turtle or a bird.',
  start: { x: -150, z: 380 },
  reward: 120,
  stars: [80, 120],
  create({ game, complete, fail, elapsed }) {
    const sc = scope(game);
    const LIMIT = 150;
    const trash = Array.from({ length: 8 }, (_, i) => {
      const a = rand(0, Math.PI * 2);
      const r = rand(20, 140);
      return { x: -220 + Math.cos(a) * r, z: 520 + Math.sin(a) * r, mesh: sc.add(createTrash(i % 3)), got: false, spin: rand(-1, 1) };
    });
    const orca = game.controller.position;
    const left = () => trash.filter((t) => !t.got);
    let finished = 0;
    return {
      objective: () => (left().length ? `Collect the rubbish: ${8 - left().length}/8` : 'All clean!'),
      meta: () => (left().length ? `Time ${Math.ceil(LIMIT - elapsed())}s` : ''),
      target: () => {
        const l = left();
        return l.length ? l.sort((a, b) => dist2d(a, orca) - dist2d(b, orca))[0] : null;
      },
      update(dt) {
        if (left().length && elapsed() > LIMIT) return fail('The tide carried the rubbish away. Try to be quicker!');
        for (const t of trash) {
          if (t.got) continue;
          floatOnWaves(game, t.mesh, t.x, t.z, 0.15);
          t.mesh.rotation.y += t.spin * dt;
          if (dist2d(t, orca) < 4.5 && game.controller.depth < 3) {
            t.got = true;
            t.mesh.visible = false;
            game.spray.splash(t.x, game.waves.heightAt(t.x, t.z), t.z, 0.8);
          }
        }
        if (!left().length) {
          finished += dt;
          if (finished > 1) complete();
        }
      },
      markers(out) {
        for (const t of left()) out.push({ x: t.x, z: t.z, type: 'animal', color: '#ffe066' });
      },
      dispose: () => sc.dispose(),
    };
  },
};

// ---------- Pod: Find Your Family ----------
const findFamily = {
  id: 'find-family',
  title: 'Find Your Family',
  type: 'Pod',
  intro: 'Captain Marina: "Orcas live in families, and yours got separated in the storm. Grandma Tika, Mom Luna and little Pip are out there. Swim close and call them with the Call button!"',
  outro: 'Your whole family is together! They will swim with you wherever you go.',
  start: { x: -30, z: 95 },
  reward: 300,
  stars: [420, 720],
  requires: (save) => doneCount(save) >= 3,
  lockedText: 'Finish 3 missions to unlock',
  create({ game, complete }) {
    const orca = game.controller.position;
    const family = game.family;
    let finished = 0;
    const missing = () => FAMILY.filter((m) => !family.found(m.id));
    const memberPos = (m) => family.members.find((f) => f.member.id === m.id).position;
    const call = (m) => {
      family.join(m.id);
      game.hud.showToast(`${m.name} joined you!`);
      game.spray.spout(orca.x, game.controller.surfaceY + 0.5, orca.z, 0.8);
      game.discover?.('orca');
    };
    return {
      objective: () => (missing().length ? `Find ${missing().map((m) => m.name).join(', ')}` : 'Family reunited!'),
      meta: () => `${3 - missing().length}/3 found`,
      target: () => {
        const m = missing().sort((a, b) => dist2d(memberPos(a), orca) - dist2d(memberPos(b), orca))[0];
        return m ? memberPos(m) : null;
      },
      update(dt) {
        if (!missing().length) {
          finished += dt;
          if (finished > 1.5) complete();
        }
      },
      onEvent(e) {
        if (e.type !== 'call') return;
        for (const m of missing()) if (dist2d(memberPos(m), orca) < 40) call(m);
      },
      interactables(out) {
        for (const m of missing()) {
          const p = memberPos(m);
          out.push({ x: p.x, z: p.z, radius: 25, label: `Call ${m.name}`, onAction: () => call(m) });
        }
      },
    };
  },
};

// ---------- Pod: Wave Practice ----------
const wavePractice = {
  id: 'wave-practice',
  title: 'Wave Practice',
  type: 'Pod',
  intro: 'Grandma Tika: "Orca families make waves together! Swim to the ice floe. When the ring shrinks small, press Action at the same time as us. Three good waves and you are a real orca!"',
  outro: 'What a wave! Grandma Tika says you are ready for anything.',
  start: { x: 300, z: 40 },
  reward: 200,
  requires: (save) => save.family.length >= 3,
  lockedText: 'Find your whole family first',
  create({ game, complete }) {
    const sc = scope(game);
    const floe = sc.add(createIceFloe());
    const spot = { x: 340, z: -20 };
    const ring = sc.add(new THREE.Mesh(new THREE.TorusGeometry(1, 0.12, 8, 40).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffe066, transparent: true, opacity: 0.9 })));
    const orca = game.controller.position;
    let hits = 0;
    let misses = 0;
    let cycle = 0;
    let feedback = '';
    let finished = 0;
    const PERIOD = 1.8;
    const near = () => dist2d(orca, spot) < 35;
    return {
      objective: () => (finished ? 'Huge wave!' : near() ? 'Press Action when the ring is small!' : 'Swim to the ice floe'),
      meta: () => (near() ? `Waves ${hits}/3${feedback ? ` · ${feedback}` : ''}` : ''),
      target: () => (finished ? null : spot),
      update(dt) {
        floatOnWaves(game, floe, spot.x, spot.z, 0.2);
        floe.rotation.y += dt * 0.05;
        ring.visible = near() && !finished;
        if (ring.visible) {
          cycle = (cycle + dt / PERIOD) % 1;
          const r = THREE.MathUtils.lerp(9, 1, cycle);
          ring.scale.setScalar(r);
          ring.material.color.set(r < 2.6 ? 0x6dffb0 : 0xffe066);
          ring.position.set(orca.x, game.controller.surfaceY + 0.2, orca.z);
        }
        if (finished) {
          finished += dt;
          if (finished > 2.5) complete(misses === 0 ? 3 : misses <= 2 ? 2 : 1);
        }
      },
      interactables(out) {
        if (!near() || finished) return;
        out.push({
          x: orca.x,
          z: orca.z,
          radius: 50,
          label: 'Make a wave!',
          cooldown: 0.4,
          onAction() {
            const r = THREE.MathUtils.lerp(9, 1, cycle);
            if (r < 2.6) {
              hits++;
              feedback = 'Perfect!';
              game.family.jumpAll();
              game.spray.splash(orca.x, game.controller.surfaceY, orca.z, 3 + hits * 2);
              game.ocean.addWake(orca.x, orca.z, 2.5);
              game.chase.addShake(0.4 + hits * 0.2);
              if (hits >= 3) {
                finished = 0.01;
                game.spray.splash(spot.x, game.waves.heightAt(spot.x, spot.z), spot.z, 10);
              }
            } else {
              misses++;
              feedback = 'Too early!';
            }
            cycle = 0;
          },
        });
      },
      dispose: () => sc.dispose(),
    };
  },
};

// ---------- Challenge: High Jump ----------
const highJump = {
  id: 'high-jump',
  title: 'High Jump',
  type: 'Challenge',
  intro: 'Captain Marina: "Let\'s see how high you can fly! Swim fast and press Jump. Clear 3.5 metres to pass, 5 metres for three stars."',
  outro: 'What a leap! The seagulls are jealous.',
  start: { x: -10, z: 130 },
  reward: 100,
  create({ game, complete }) {
    const c = game.controller;
    let best = 0;
    let current = 0;
    let finished = 0;
    return {
      objective: () => (finished ? 'Amazing jump!' : 'Jump higher than 3.5 m'),
      meta: () => `Best ${best.toFixed(1)} m`,
      target: () => null,
      update(dt) {
        if (c.inAir) current = Math.max(current, c.position.y - c.surfaceY);
        else if (current > 0) {
          best = Math.max(best, current);
          if (current > 1) game.hud.showToast(`${current.toFixed(1)} m!`);
          current = 0;
        }
        if (best >= 3.5 && !finished) finished = 0.01;
        if (finished) {
          finished += dt;
          if (finished > 1.2) complete(best >= 5 ? 3 : best >= 4.2 ? 2 : 1);
        }
      },
    };
  },
};

// ---------- Challenge: Ring Race ----------
const ringRace = {
  id: 'ring-race',
  title: 'Ring Race',
  type: 'Challenge',
  intro: 'Captain Marina: "Swim through all ten golden rings in order. Some are underwater and one is in the air, so you will need to dive and jump!"',
  outro: 'A perfect race. You are the fastest orca in the sea!',
  start: { x: 160, z: 230 },
  reward: 150,
  stars: [70, 100],
  create({ game, complete, fail, elapsed }) {
    const sc = scope(game);
    const LIMIT = 140;
    // A winding course: [x, z, height relative to the surface].
    const course = [];
    let x = 190;
    let z = 280;
    let h = 0.2;
    for (let i = 0; i < 10; i++) {
      const a = 0.6 + Math.sin(i * 0.9) * 0.8;
      x += Math.sin(a) * 45;
      z += Math.cos(a) * 45;
      h = i === 6 ? 2.2 : i % 3 === 1 ? -3 : -0.6;
      course.push({ x, z, h, a, mesh: sc.add(createRing()) });
    }
    let next = 0;
    let finished = 0;
    const c = game.controller;
    return {
      objective: () => (finished ? 'Finish!' : `Swim through the rings: ${next}/10${course[next]?.h > 1 ? ' (jump!)' : course[next]?.h < -2 ? ' (dive!)' : ''}`),
      meta: () => (finished ? '' : `Time ${Math.ceil(LIMIT - elapsed())}s`),
      target: () => (finished ? null : course[next]),
      update(dt) {
        if (!finished && elapsed() > LIMIT) return fail('Time is up! Try a faster line through the rings.');
        course.forEach((r, i) => {
          const surface = game.waves.heightAt(r.x, r.z);
          r.mesh.position.set(r.x, surface + r.h, r.z);
          r.mesh.rotation.set(0, r.a, 0);
          r.mesh.visible = i >= next;
          r.mesh.scale.setScalar(i === next ? 1 + Math.sin(game.time * 5) * 0.05 : 0.8);
        });
        if (finished) {
          finished += dt;
          if (finished > 1) complete();
          return;
        }
        const r = course[next];
        const dy = c.position.y - r.mesh.position.y;
        if (Math.hypot(c.position.x - r.x, c.position.z - r.z) < 3.6 && Math.abs(dy) < 3) {
          next++;
          game.spray.splash(r.x, game.waves.heightAt(r.x, r.z), r.z, 1);
          if (next >= course.length) finished = 0.01;
        }
      },
      dispose: () => sc.dispose(),
    };
  },
};

// ---------- Challenge: Deep Dive ----------
const deepDive = {
  id: 'deep-dive',
  title: 'Deep Dive',
  type: 'Challenge',
  intro: 'Captain Marina: "A glowing pearl lies 35 metres down. Take a big breath, dive (hold Dive), grab it and come back up before your air runs out!"',
  outro: 'The pearl is beautiful. And you came back up just in time!',
  start: { x: -620, z: 40 },
  reward: 180,
  stars: [40, 70],
  requires: (save) => doneCount(save) >= 2,
  lockedText: 'Finish 2 missions to unlock',
  create({ game, complete, fail }) {
    const sc = scope(game);
    const spot = { x: -660, z: -20 };
    const pearl = sc.add(createPearl());
    const c = game.controller;
    let got = false;
    let finished = 0;
    return {
      objective: () => (finished ? 'Made it!' : got ? 'Swim up and breathe!' : 'Dive down and grab the pearl'),
      meta: () => `Depth ${Math.max(0, c.depth - 0.8).toFixed(0)} m${got ? '' : ' / 35 m'}`,
      target: () => (got ? null : spot),
      update(dt) {
        if (!got) {
          pearl.position.set(spot.x, game.waves.heightAt(spot.x, spot.z) - 35, spot.z);
          pearl.userData.pearl.scale.setScalar(1 + Math.sin(game.time * 3) * 0.1);
        } else if (!finished && c.underTime === 0 && c.depth < 1.5) {
          finished = 0.01;
        }
        if (finished) {
          finished += dt;
          if (finished > 1) complete();
        }
      },
      onEvent(e) {
        if (e.type === 'faint') fail('You ran out of air. Dive straight down and come straight back up!');
      },
      interactables(out) {
        if (got) return;
        out.push({
          x: pearl.position.x,
          y: pearl.position.y,
          z: pearl.position.z,
          radius: 6,
          label: 'Grab pearl',
          onAction() {
            got = true;
            pearl.visible = false;
            game.hud.showToast('Got it! Now swim up, quick!');
          },
        });
      },
      dispose: () => sc.dispose(),
    };
  },
};

// ---------- Play: Seal Tag ----------
const sealTag = {
  id: 'seal-tag',
  title: 'Seal Tag',
  type: 'Play',
  intro: 'Captain Marina: "The seals want to play tag! Touch five different seals before the time runs out. Gently, it is just a game."',
  outro: 'Tag, you are it! The seals had a great time.',
  start: { x: -280, z: -370 },
  reward: 120,
  stars: [25, 40],
  create({ game, complete, fail, elapsed }) {
    const LIMIT = 60;
    const tagged = new Set();
    const colony = { x: -300, z: -420 };
    let finished = 0;
    return {
      objective: () => (finished ? 'Tag complete!' : `Tag 5 different seals: ${tagged.size}/5`),
      meta: () => (finished ? '' : `Time ${Math.ceil(LIMIT - elapsed())}s`),
      target: () => (dist2d(game.controller.position, colony) > 60 ? colony : null),
      update(dt) {
        if (!finished && elapsed() > LIMIT) return fail('Time is up! The seals are quick, try sneaking up slowly.');
        if (finished) {
          finished += dt;
          if (finished > 1) complete();
        }
      },
      onEvent(e) {
        if (e.type === 'sealTag' && !tagged.has(e.seal) && !finished) {
          tagged.add(e.seal);
          game.hud.showToast(`Tagged! ${tagged.size}/5`);
          if (tagged.size >= 5) finished = 0.01;
        }
      },
    };
  },
};


// ---------- Boss: The Whaling Ship ----------
const whalingShip = {
  id: 'whaling-ship',
  title: 'The Whaling Ship',
  type: 'Boss',
  intro: 'Captain Marina: "This is it, guardian. A huge whaling ship is hunting the humpback whale, with two speedboats to help it. First cut its net, then break its harpoon crane by jumping next to it, then scare it away for good. Your family is with you!"',
  outro: 'The whaling ship is gone and the humpback is safe. You are the true Guardian of the Ocean!',
  start: { x: 380, z: -420 },
  reward: 500,
  stars: [240, 360],
  requires: (save) => doneCount(save) >= 8,
  lockedText: 'Finish 8 missions to unlock',
  create({ game, complete, fail }) {
    const sc = scope(game);
    const whale = sc.creature(createWhale(), { x: 650, z: -650, depth: 1.5, speed: 1.4, turnRate: 0.3 });
    whale.home = { x: 650, z: -650, radius: 260 };
    const ship = sc.boat('whaler', { x: 820, z: -500, target: whale, craneHealth: 4, spec: { speed: 2.2, fearResist: 0.6 } });
    ship.lockFear = true;
    const escorts = [];
    const CAPTURE = 35;
    let phase = 1;
    let finished = 0;
    let blow = 6;
    const label = () => ['', 'Cut the net lines', 'Jump next to the ship to break the crane', 'Scare the ship away!'][phase];
    return {
      objective: () => {
        if (finished) return 'Victory!';
        if (phase === 1) return `${label()}: ${ship.cutPoints().length} left`;
        if (phase === 2) return `${label()} (${ship.craneHealth} left)`;
        return `${label()} Fear ${pct(ship.fear / 100)}`;
      },
      meta: () => (finished ? '' : `Phase ${phase}/3 · Whale in danger ${pct(ship.capture / CAPTURE)}`),
      target: () => {
        if (finished) return null;
        if (phase === 1) return ship.cutPoints()[0] || ship.position;
        return ship.position;
      },
      update(dt) {
        // The whale tries to get away from the ship; it surfaces to blow now and then.
        whale.steerAway(ship.position.x, ship.position.z, dt, 0.4);
        whale.wander(dt);
        whale.targetSpeed = 1.6;
        whale.move(dt, 0.4);
        blow -= dt;
        if (blow <= 0) {
          game.spray.spout(whale.position.x, game.waves.heightAt(whale.position.x, whale.position.z) + 0.3, whale.position.z, 1.4);
          blow = 12;
        }
        if (finished) {
          finished += dt;
          if (finished > 3) complete();
          return;
        }
        if (phase === 1 && ship.net?.released) {
          phase = 2;
          game.hud.showToast('Net gone! Now break the harpoon crane');
          // The speedboats join the fight.
          for (const side of [-1, 1]) {
            const b = sc.boat('speedboat', { x: ship.position.x + side * 40, z: ship.position.z + 30, target: game.controller, spec: { speed: 6 } });
            b.lockFear = false;
            escorts.push(b);
          }
        }
        if (phase === 2 && ship.craneHealth <= 0) {
          phase = 3;
          ship.lockFear = false;
          ship.fear = Math.min(ship.fear, 40);
          game.hud.showToast('The crane is broken! Scare the ship away!');
        }
        if (phase === 3 && ship.fleeing) {
          finished = 0.01;
          escorts.forEach((b) => b.scare(200, 'boss'));
          game.family?.jumpAll();
          game.spray.splash(game.controller.position.x, game.controller.surfaceY, game.controller.position.z, 6);
        }
        if (ship.capture >= CAPTURE) fail('The whaling ship reached the whale. Be quicker with the net and the crane!');
      },
      markers(out) {
        out.push({ x: whale.position.x, z: whale.position.z, type: 'friend' });
      },
      dispose: () => sc.dispose(),
    };
  },
};

export const MISSIONS = [
  tangledTurtle,
  dolphinDefense,
  netCutter,
  highJump,
  cleanup,
  sealTag,
  secretPlaces,
  ringRace,
  lostCalf,
  bottles,
  deepDive,
  strandedWhale,
  craneBreaker,
  findFamily,
  wavePractice,
  whalingShip,
];

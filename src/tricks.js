import { el } from './ui.js';

const TAU = Math.PI * 2;
const COMBO_WINDOW = 5; // seconds to land the next trick and keep the combo going
const SOFT_CAP = 150; // trick points per minute before rewards shrink, so tricks stay fun but not farmable
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// Acrobatics: every jump is scored on landing (height, spins, belly flops, porpoise
// chains). Tricks landed close together build a combo multiplier.
export function createTricks(game) {
  const c = game.controller;
  const popup = el('div', 'trick-popup', document.body);
  let air = null; // { maxHeight, roll, lastRoll, time }
  let combo = 0;
  let comboTimer = 0;
  let porpoise = 0;
  let porpoiseTimer = 0;
  let popupTimer = 0;
  const recent = []; // [time, points] for the per-minute soft cap

  function show(text) {
    popup.textContent = text;
    popup.classList.remove('pop');
    void popup.offsetWidth; // restart the animation
    popup.classList.add('pop', 'show');
    popupTimer = 2.2;
  }

  function award(names, base) {
    combo = comboTimer > 0 ? combo + 1 : 1;
    comboTimer = COMBO_WINDOW;
    const mult = Math.min(1 + (combo - 1) * 0.25, 2);
    while (recent.length && game.time - recent[0][0] > 60) recent.shift();
    const lastMinute = recent.reduce((sum, [, p]) => sum + p, 0);
    const points = Math.max(1, Math.round(base * mult * (lastMinute > SOFT_CAP ? 0.25 : 1)));
    recent.push([game.time, points]);
    game.save.points += points;
    game.save.totalPoints += points;
    game.persist();
    show(`${names.join(' + ')}${mult > 1 ? ` ×${mult.toFixed(mult % 1 ? 2 : 0)}` : ''}  +${points}`);
    game.audio?.ui();
    game.onTrick?.(names, points);
  }

  function land() {
    if (air.time < 0.35) return; // just a little hop
    const names = [];
    let base = 0;
    const h = air.maxHeight;
    if (h >= 6) {
      names.push('Sky High');
      base += 15;
    } else if (h >= 4) {
      names.push('High Jump');
      base += 8;
    } else if (h >= 2) {
      names.push('Jump');
      base += 3;
    }
    const spins = Math.floor((air.roll + 1.3) / TAU); // ~290° counts as a spin
    if (spins > 0) {
      names.push(spins === 1 ? 'Spin' : spins === 2 ? 'Double Spin' : spins === 3 ? 'Triple Spin' : `${spins}x Spin`);
      base += 8 * spins;
    }
    if (Math.abs(Math.sin(c.roll)) > 0.7) {
      names.push('Belly Flop');
      base += 3;
    }
    if (c.behavior === 'porpoise' || porpoiseTimer > 0) {
      porpoise = porpoiseTimer > 0 ? porpoise + 1 : 1;
      porpoiseTimer = 3;
      if (porpoise >= 3) {
        names.push(`Porpoise ×${porpoise}`);
        base += 2;
      }
    }
    if (base > 0) award(names, base);
  }

  return {
    update(dt) {
      comboTimer = Math.max(0, comboTimer - dt);
      porpoiseTimer = Math.max(0, porpoiseTimer - dt);
      if (popupTimer > 0) {
        popupTimer -= dt;
        if (popupTimer <= 0) popup.classList.remove('show');
      }
      if (c.inAir) {
        if (!air) air = { maxHeight: 0, roll: 0, lastRoll: c.roll, time: 0 };
        air.time += dt;
        air.maxHeight = Math.max(air.maxHeight, c.position.y - c.surfaceY);
        air.roll += Math.abs(wrap(c.roll - air.lastRoll));
        air.lastRoll = c.roll;
      } else if (air) {
        land();
        air = null;
      }
    },
    onEvent(e) {
      if (e.type === 'tailslap') award(['Tail Slap'], 1);
      if (e.type === 'faint') {
        combo = 0;
        comboTimer = 0;
      }
    },
  };
}

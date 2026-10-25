import { openModal, el } from './ui.js';
import { ICONS } from './icons.js';
import { SPECIES } from './species.js';
import { MISSIONS } from './missionDefs.js';

export const UPGRADES = [
  { id: 'air', name: 'Big Lungs', text: 'Hold your breath longer underwater.' },
  { id: 'speed', name: 'Strong Tail', text: 'Swim and sprint faster.' },
  { id: 'strength', name: 'Power', text: 'Rams, jumps and tail slaps scare boats more.' },
  { id: 'energy', name: 'Stamina', text: 'More energy for sprints and tricks.' },
];
const UPGRADE_COST = [150, 300, 500];

export const SKINS = [
  { id: 'classic', name: 'Classic', dark: 0x0b0c0f, mid: 0x5a6168, light: 0xe9eef0, cost: 0 },
  { id: 'midnight', name: 'Midnight', dark: 0x0d1b3a, mid: 0x3a5a8a, light: 0x9fd0ff, cost: 200 },
  { id: 'albino', name: 'Snowy', dark: 0xf0e4de, mid: 0xd8bfbf, light: 0xffffff, cost: 400 },
  { id: 'golden', name: 'Golden Legend', dark: 0x5c3f0c, mid: 0xb08a30, light: 0xffe7a0, cost: 0, rank: 3 },
];

export const RANKS = [
  { name: 'Calf', points: 0 },
  { name: 'Juvenile', points: 300 },
  { name: 'Hunter', points: 900 },
  { name: 'Ocean Guardian', points: 2000 },
];

export function rankIndex(totalPoints) {
  let r = 0;
  RANKS.forEach((rank, i) => totalPoints >= rank.points && (r = i));
  return r;
}

const hex = (n) => `#${n.toString(16).padStart(6, '0')}`;
const escapeHtml = (t) => t.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);

// Points, upgrades, skins, ranks and the profile screen.
export function createProgression(game) {
  const { save } = game;
  let shownRank = rankIndex(save.totalPoints);

  function apply() {
    game.controller.setUpgrades(save.upgrades);
    const skin = SKINS.find((s) => s.id === save.skin) || SKINS[0];
    game.orca.setSkin(skin);
  }

  function spend(cost) {
    if (save.points < cost) return false;
    save.points -= cost;
    game.persist();
    return true;
  }

  function openProfile(tab = 'orca') {
    const body = el('div', 'profile');
    const tabs = el('div', 'tabs', body);
    const panel = el('div', 'tab-panel', body);
    const TABS = [
      ['orca', 'My Orca'],
      ['pod', 'Pod'],
      ['upgrades', 'Upgrades'],
      ['skins', 'Skins'],
      ['album', 'Album'],
    ];
    const buttons = TABS.map(([id, label]) => {
      const b = el('button', 'tab', tabs, label);
      b.type = 'button';
      b.addEventListener('click', () => show(id));
      return [id, b];
    });

    function show(id) {
      buttons.forEach(([bid, b]) => b.classList.toggle('active', bid === id));
      panel.innerHTML = '';
      ({ orca: renderOrca, pod: renderPod, upgrades: renderUpgrades, skins: renderSkins, album: renderAlbum })[id]();
    }

    function renderOrca() {
      const r = rankIndex(save.totalPoints);
      const next = RANKS[r + 1];
      const nameRow = el('label', 'name-row', panel);
      el('span', '', nameRow, 'Name');
      const input = el('input', '', nameRow);
      input.maxLength = 16;
      input.placeholder = 'Name your orca';
      input.value = save.name;
      input.addEventListener('input', () => {
        save.name = input.value.trim();
        game.persist();
      });
      const rank = el('div', 'rank-card', panel);
      rank.innerHTML = `
        <div class="rank-name">${RANKS[r].name}</div>
        <div class="rank-bar"><div style="width:${next ? Math.min(100, ((save.totalPoints - RANKS[r].points) / (next.points - RANKS[r].points)) * 100) : 100}%"></div></div>
        <div class="rank-next">${next ? `${next.points - save.totalPoints} points to ${next.name}` : 'Highest rank reached!'}</div>`;
      const stats = el('div', 'stats-grid', panel);
      const done = MISSIONS.filter((m) => save.missions[m.id]).length;
      const stars = Object.values(save.missions).reduce((a, b) => a + b, 0);
      [
        [ICONS.star, `${save.points}`, 'points to spend'],
        [ICONS.map, `${done}/${MISSIONS.length}`, 'missions done'],
        [ICONS.star, `${stars}/${MISSIONS.length * 3}`, 'stars'],
        [ICONS.profile, `${Object.keys(save.album).length}/${SPECIES.length}`, 'animals in album'],
      ].forEach(([icon, value, label]) => {
        el('div', 'stat', stats, `${icon}<strong>${value}</strong><span>${label}</span>`);
      });
    }

    // Companions: send each one to rest (swim alone) or call them back.
    function renderPod() {
      const family = game.family;
      const list = family.companions();
      if (!list.length) {
        el('p', 'pod-empty', panel, 'No companions yet. Find your family and help the dolphins, and they will swim with you!');
        return;
      }
      el('p', 'points-line pod-intro', panel, 'Choose who swims with you. Resting companions wait at home until you call them.');
      for (const comp of list) {
        const with_ = family.following(comp.id);
        const row = el('div', 'shop-row', panel);
        const info = el('div', 'shop-info', row);
        el('div', 'shop-name', info, comp.name);
        el('div', 'shop-text', info, with_ ? 'Swimming with you' : 'Resting at home');
        const btn = el('button', `btn btn-small ${with_ ? '' : 'btn-primary'}`, row, with_ ? 'Let rest' : 'Call back');
        btn.type = 'button';
        btn.addEventListener('click', () => {
          if (with_) family.rest(comp.id);
          else {
            family.wake(comp.id);
            game.hud.showToast(`${comp.name.replace(/ \(.*\)/, '')} ${comp.id === 'dolphins' ? 'are' : 'is'} coming back!`);
          }
          show('pod');
        });
      }
      const allRow = el('div', 'pod-all', panel);
      const alone = el('button', 'btn', allRow, 'Swim alone');
      alone.type = 'button';
      alone.disabled = list.every((c) => !family.following(c.id));
      alone.addEventListener('click', () => {
        family.restAll();
        show('pod');
      });
      const everyone = el('button', 'btn btn-primary', allRow, 'Call everyone');
      everyone.type = 'button';
      everyone.disabled = list.every((c) => family.following(c.id));
      everyone.addEventListener('click', () => {
        family.callAll();
        show('pod');
      });
    }

    function renderUpgrades() {
      el('p', 'points-line', panel, `${ICONS.star} <strong>${save.points}</strong> points to spend`);
      for (const u of UPGRADES) {
        const level = save.upgrades[u.id];
        const row = el('div', 'shop-row', panel);
        const info = el('div', 'shop-info', row);
        el('div', 'shop-name', info, `${u.name} <span class="pips">${[0, 1, 2].map((i) => `<i class="${i < level ? 'on' : ''}"></i>`).join('')}</span>`);
        el('div', 'shop-text', info, u.text);
        const cost = UPGRADE_COST[level];
        const btn = el('button', 'btn btn-small btn-primary', row, level >= 3 ? 'Max' : `${cost}`);
        btn.type = 'button';
        btn.disabled = level >= 3 || save.points < cost;
        btn.addEventListener('click', () => {
          if (!spend(cost)) return;
          save.upgrades[u.id]++;
          game.persist();
          apply();
          game.hud.showToast(`${u.name} upgraded!`);
          show('upgrades');
        });
      }
    }

    function renderSkins() {
      el('p', 'points-line', panel, `${ICONS.star} <strong>${save.points}</strong> points to spend`);
      const grid = el('div', 'skin-grid', panel);
      const r = rankIndex(save.totalPoints);
      for (const skin of SKINS) {
        const owned = save.skins.includes(skin.id) || (skin.rank !== undefined && r >= skin.rank);
        const card = el('button', `skin-card ${save.skin === skin.id ? 'active' : ''}`, grid);
        card.type = 'button';
        card.innerHTML = `
          <span class="swatch" style="background:linear-gradient(180deg, ${hex(skin.dark)} 0 50%, ${hex(skin.mid)} 50% 62%, ${hex(skin.light)} 62%)"></span>
          <strong>${skin.name}</strong>
          <span>${save.skin === skin.id ? 'Wearing' : owned ? 'Wear' : skin.rank !== undefined ? `Reach ${RANKS[skin.rank].name}` : `${skin.cost} points`}</span>`;
        card.disabled = !owned && (skin.rank !== undefined || save.points < skin.cost);
        card.addEventListener('click', () => {
          if (!owned) {
            if (!spend(skin.cost)) return;
            save.skins.push(skin.id);
          }
          save.skin = skin.id;
          game.persist();
          apply();
          show('skins');
        });
      }
    }

    function renderAlbum() {
      el('p', 'points-line', panel, `${Object.keys(save.album).length} of ${SPECIES.length} animals found`);
      const list = el('div', 'album', panel);
      for (const sp of SPECIES) {
        const found = save.album[sp.id];
        const card = el('div', `album-card ${found ? '' : 'unknown'}`, list);
        if (sp.legend) card.classList.add('legend');
        card.innerHTML = found
          ? `<strong>${sp.legend ? 'Legend · ' : ''}${sp.name}</strong><p>${sp.fact}</p>`
          : `<strong>???</strong><p>${sp.legend ? 'A legend of the night sea… keep your eyes open after dark.' : 'Not found yet. Keep exploring!'}</p>`;
      }
    }

    openModal({ title: save.name ? escapeHtml(save.name) : 'My Orca', body, className: 'modal-profile' });
    show(tab);
  }

  // The orca is always in its own album.
  if (!save.album.orca) save.album.orca = true;
  apply();

  return {
    apply,
    openProfile,
    update() {
      const r = rankIndex(save.totalPoints);
      if (r > shownRank) {
        shownRank = r;
        game.onRankUp?.(RANKS[r]);
        openModal({
          title: 'New rank!',
          body: `<div class="rank-up">${ICONS.star}<strong>${RANKS[r].name}</strong></div><p>You are becoming a legend of the sea.${r === 3 ? ' You unlocked the Golden Legend skin!' : ''}</p>`,
          className: 'modal-complete',
          buttons: [{ label: 'Hooray!', primary: true }],
        });
      }
    },
  };
}

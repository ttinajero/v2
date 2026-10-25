import { el } from './ui.js';

const CHECK_EVERY_MS = 10 * 60 * 1000;
const base = import.meta.env.BASE_URL;

// Polls for a newer published build (version.json) and for live content tweaks
// (content.json: event odds and one-off announcements) every 10 minutes.
export function createUpdates(game) {
  const { save } = game;
  let lastCheck = 0;
  let bannerShown = false;

  function showBanner(version) {
    if (bannerShown) return;
    bannerShown = true;
    const banner = el('div', 'update-banner', document.body);
    el('span', '', banner, `A new version (${version}) is ready!`);
    const btn = el('button', 'btn btn-small btn-primary', banner, 'Update');
    btn.type = 'button';
    // Progress is saved continuously, so reloading is always safe.
    btn.addEventListener('click', () => location.reload());
    const later = el('button', 'btn btn-small', banner, 'Later');
    later.type = 'button';
    later.addEventListener('click', () => {
      banner.remove();
      bannerShown = false;
    });
  }

  async function fetchJson(name) {
    const res = await fetch(`${base}${name}?t=${Date.now()}`, { cache: 'no-store' });
    return res.ok ? res.json() : null;
  }

  async function check() {
    lastCheck = Date.now();
    try {
      const [remote, content] = await Promise.all([fetchJson('version.json'), fetchJson('content.json')]);
      if (remote?.version && remote.version !== __APP_VERSION__) showBanner(remote.version);
      if (content) {
        game.content = content;
        game.onContent?.(content);
        const msg = content.message;
        if (msg?.id && msg.text && !save.seenMessages.includes(msg.id)) {
          save.seenMessages.push(msg.id);
          game.persist();
          game.hud.showToast(msg.text, 6);
        }
      }
    } catch {
      // Offline or the file is missing: try again next time.
    }
  }

  check();
  setInterval(check, CHECK_EVERY_MS);
  // Coming back to a tab that slept for a while (iPad) also triggers a check.
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && Date.now() - lastCheck > CHECK_EVERY_MS) check();
  });

  return { check, version: __APP_VERSION__ };
}

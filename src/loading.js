// Loading screen: real progress through the setup steps, orca facts while waiting,
// and a start button once the first frames are ready.
const FACTS = [
  'Orcas can swim faster than 50 km/h (30 mph).',
  'A male orca can be 8 metres long and weigh 6 tonnes.',
  "A male's dorsal fin can stand 1.8 metres tall.",
  'Every orca family has its own "dialect" of whistles and clicks.',
  'Orca families are led by the grandmother.',
  "The white patches behind the eyes aren't eyes: they're just colour.",
  'Orcas breathe through a hole on top of their head called a blowhole.',
  'Orcas are actually the biggest dolphins in the world.',
  'Some orcas hunt by making waves together to wash seals off the ice.',
  'Orcas sleep with half of their brain awake so they keep breathing.',
];

const root = document.getElementById('loading');
const fill = root.querySelector('.loading-fill');
const stepEl = root.querySelector('.loading-step');
const factEl = root.querySelector('.loading-fact');

let factIndex = Math.floor(Math.random() * FACTS.length);
factEl.textContent = FACTS[factIndex];
const factTimer = setInterval(() => {
  factIndex = (factIndex + 1) % FACTS.length;
  factEl.textContent = FACTS[factIndex];
}, 4500);

// Let the browser paint between heavy synchronous steps. Background tabs pause
// requestAnimationFrame, so a timeout makes sure loading never stalls there.
const nextPaint = () =>
  new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(done, 60);
    requestAnimationFrame(() => setTimeout(done, 0));
  });

export async function loadingStep(progress, label) {
  fill.style.width = `${Math.round(progress * 100)}%`;
  stepEl.textContent = label;
  await nextPaint();
}

// Anything that blows up during setup should say so instead of leaving the bar stuck.
const onSetupError = (e) => loadingFailed(e.error || e.reason || e);
window.addEventListener('error', onSetupError);
window.addEventListener('unhandledrejection', onSetupError);

export function loadingFailed(error, message = 'The game could not load. Try reloading the page.') {
  if (root.classList.contains('failed')) return; // keep the first, most specific message
  stepEl.textContent = message;
  root.classList.add('failed');
  console.error(error);
}

// Main menu once everything is ready. Resolves with { choice: 'continue' | 'new', name }.
// `onSettings` opens the settings without leaving the menu.
export function loadingReady({ hasSave = false, savedName = '', onSettings } = {}) {
  fill.style.width = '100%';
  stepEl.textContent = hasSave ? `Welcome back${savedName ? `, ${savedName}` : ''}!` : 'All set!';
  window.removeEventListener('error', onSetupError);
  window.removeEventListener('unhandledrejection', onSetupError);
  const menu = root.querySelector('.loading-menu');
  const form = root.querySelector('.loading-name');
  const nameInput = form.querySelector('input');
  const [continueBtn, newBtn] = menu.querySelectorAll('.loading-start');
  continueBtn.hidden = !hasSave;
  newBtn.textContent = hasSave ? 'New game' : 'Start swimming';
  newBtn.classList.toggle('secondary', hasSave);
  menu.hidden = false;
  (hasSave ? continueBtn : newBtn).focus();

  return new Promise((resolve) => {
    const finish = (result) => {
      clearInterval(factTimer);
      root.classList.add('done');
      setTimeout(() => root.remove(), 1000);
      resolve(result);
    };
    const askName = () => {
      menu.hidden = true;
      form.hidden = false;
      nameInput.value = savedName;
      nameInput.focus();
    };
    menu.addEventListener('click', (e) => {
      const choice = e.target.closest('button')?.dataset.choice;
      if (choice === 'continue') finish({ choice: 'continue', name: savedName });
      else if (choice === 'new') {
        if (hasSave && !confirm('Start a new game? Your missions, points and album will be erased (settings are kept).')) return;
        askName();
      } else if (choice === 'settings') onSettings?.();
    });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      finish({ choice: 'new', name: nameInput.value.trim().slice(0, 16) });
    });
  });
}

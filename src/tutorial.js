// First-play guide: a few short steps shown in the mission panel, with wording for
// keyboard or touch. It can be skipped from the pause menu.
export function createTutorial(game) {
  const { controller, save } = game;
  const touch = () => document.body.classList.contains('touch-mode');
  let step = -1;
  let progress = 0;
  let lastYaw = 0;

  const STEPS = [
    {
      text: () => (touch() ? 'Push the joystick up to swim' : 'Hold W to swim forward'),
      update(dt) {
        progress += controller.relSpeed * dt;
        return progress > 25;
      },
    },
    {
      text: () => (touch() ? 'Move the joystick left and right to turn' : 'Use A and D to turn'),
      update() {
        progress += Math.abs(controller.yaw - lastYaw);
        lastYaw = controller.yaw;
        return progress > 2.5;
      },
    },
    {
      text: () => (touch() ? 'Hold the Dive button to go down' : 'Hold C to dive down'),
      update() {
        return controller.depth > 4;
      },
    },
    {
      text: () => 'Swim up to breathe: orcas need air!',
      update() {
        return controller.depth < 1.4 && controller.underTime === 0;
      },
    },
    {
      text: () => (touch() ? 'Swim fast and tap Jump!' : 'Swim fast and press J to jump!'),
      event: 'breach',
    },
    {
      text: () => 'Hungry? Seagulls show where fish are. Swim through a school to eat',
      target: () => game.fishTarget?.(),
      event: 'eat',
    },
    {
      text: () => (touch() ? 'Find Captain Marina\'s boat and tap Action' : 'Find Captain Marina\'s boat and press F'),
      target: () => game.hub,
      event: 'board',
    },
  ];

  function next() {
    step++;
    progress = 0;
    lastYaw = controller.yaw;
    if (step >= STEPS.length) {
      step = -1;
      save.tutorialDone = true;
      game.persist();
      game.hud.showToast('Tutorial complete! Have fun, guardian!', 4);
      game.audio?.success();
      return;
    }
    if (step > 0) game.audio?.ui();
  }

  return {
    get active() {
      return step >= 0;
    },
    start() {
      step = -1;
      next();
    },
    skip() {
      step = STEPS.length - 1;
      next();
    },
    update(dt) {
      if (step < 0 || game.missions?.active) return;
      const s = STEPS[step];
      if (s.update?.(dt)) next();
    },
    onEvent(e) {
      if (step < 0) return;
      const s = STEPS[step];
      if (s.event && s.event === e.type) next();
    },
    info() {
      if (step < 0) return null;
      const s = STEPS[step];
      return { title: `Tutorial ${step + 1}/${STEPS.length}`, objective: s.text(), meta: '' };
    },
    target() {
      return step >= 0 ? STEPS[step].target?.() || null : null;
    },
    markers(out) {
      const t = this.target();
      if (t) out.push({ x: t.x, z: t.z, type: 'target', label: 'Tutorial' });
    },
  };
}

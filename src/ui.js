import { ICONS } from './icons.js';

// Small DOM helpers and a modal stack. While any modal is open the game is paused.
export function el(tag, className, parent, html) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (html !== undefined) e.innerHTML = html;
  if (parent) parent.appendChild(e);
  return e;
}

const stack = [];
const listeners = new Set();

export function onModalChange(fn) {
  listeners.add(fn);
}

export function modalOpen() {
  return stack.length > 0;
}

function notify() {
  listeners.forEach((fn) => fn(stack.length > 0));
}

/**
 * openModal({ title, body, buttons: [{ label, primary, onClick, close = true }], dismissable, className })
 * `body` is an HTML string or an element. Returns { root, close }.
 */
export function openModal({ title, body, buttons = [], dismissable = true, className = '', onClose } = {}) {
  const overlay = el('div', `modal-overlay ${className}`, document.body);
  const box = el('div', 'modal', overlay);
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-modal', 'true');
  if (title) el('h2', 'modal-title', box, title);
  if (dismissable) {
    const x = el('button', 'modal-close', box, ICONS.close);
    x.type = 'button';
    x.setAttribute('aria-label', 'Close');
    x.addEventListener('click', () => close());
  }
  const content = el('div', 'modal-body', box);
  if (typeof body === 'string') content.innerHTML = body;
  else if (body) content.appendChild(body);

  if (buttons.length) {
    const row = el('div', 'modal-buttons', box);
    buttons.forEach((b) => {
      const btn = el('button', `btn ${b.primary ? 'btn-primary' : ''}`, row, b.label);
      btn.type = 'button';
      btn.addEventListener('click', () => {
        if (b.close !== false) close();
        b.onClick?.();
      });
    });
    requestAnimationFrame(() => row.querySelector('.btn-primary, .btn')?.focus());
  }

  const onKey = (e) => {
    if (e.code === 'Escape' && dismissable && stack[stack.length - 1] === entry) {
      e.stopPropagation();
      close();
    }
  };
  window.addEventListener('keydown', onKey, true);

  let closed = false;
  function close() {
    if (closed) return;
    closed = true;
    window.removeEventListener('keydown', onKey, true);
    overlay.classList.add('closing');
    setTimeout(() => overlay.remove(), 200);
    stack.splice(stack.indexOf(entry), 1);
    notify();
    onClose?.();
  }
  const entry = { overlay, close };
  stack.push(entry);
  notify();
  return { root: box, content, close };
}

export function closeAllModals() {
  [...stack].reverse().forEach((m) => m.close());
}

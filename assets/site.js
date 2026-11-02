/* The interface layer. Every page works without it. */
(() => {
  const root = document.documentElement;
  const canHover = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // The clock in the corner.
  const clock = document.querySelector('[data-clock]');
  if (clock) {
    const time = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' });
    const tick = () => { clock.textContent = `London ${time.format(new Date())}`; };
    tick();
    setInterval(tick, 15000);
  }

  // Light and dark. The head script applies a saved choice before first paint.
  const toggle = document.querySelector('[data-theme-toggle]');
  if (toggle) {
    const isDark = () => (root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches);
    const label = () => toggle.setAttribute('aria-label', isDark() ? 'Switch to light theme' : 'Switch to dark theme');
    const flip = () => {
      root.dataset.theme = isDark() ? 'light' : 'dark';
      try { localStorage.setItem('theme', root.dataset.theme); } catch {}
      label();
    };
    label();
    toggle.addEventListener('click', () => {
      if (document.startViewTransition && !calm) document.startViewTransition(flip);
      else flip();
    });
  }

  // A frame's real size, shown the way a design tool shows it.
  const sheet = document.querySelector('.frame-sheet');
  const sizeLabel = document.querySelector('[data-frame-size]');
  if (sheet && sizeLabel && 'ResizeObserver' in window) {
    new ResizeObserver(([entry]) => {
      const { width, height } = entry.target.getBoundingClientRect();
      sizeLabel.textContent = `${Math.round(width)} × ${Math.round(height)}`;
    }).observe(sheet);
  }

  if (!canHover) return;

  // The canvas brightens around the pointer, trailing it slightly.
  if (!calm) {
    let targetX = 0, targetY = 0, x = 0, y = 0, frame = 0, seen = false;
    const follow = () => {
      x += (targetX - x) * .16;
      y += (targetY - y) * .16;
      root.style.setProperty('--mx', `${x.toFixed(1)}px`);
      root.style.setProperty('--my', `${y.toFixed(1)}px`);
      frame = Math.abs(targetX - x) + Math.abs(targetY - y) > .4 ? requestAnimationFrame(follow) : 0;
    };
    addEventListener('pointermove', (event) => {
      targetX = event.clientX;
      targetY = event.clientY;
      if (!seen) {
        seen = true;
        x = targetX;
        y = targetY;
        root.classList.add('lit');
      }
      if (!frame) frame = requestAnimationFrame(follow);
    }, { passive: true });
    root.addEventListener('pointerleave', () => { seen = false; root.classList.remove('lit'); });
  }

  // Selection: one box that travels between frames, with its handles and its size.
  const layer = document.createElement('div');
  layer.className = 'sel-layer';
  layer.setAttribute('aria-hidden', 'true');
  layer.innerHTML = '<div class="sel"><i></i><i></i><i></i><i></i><b></b></div>';
  document.body.append(layer);
  const box = layer.querySelector('.sel');
  const size = box.querySelector('b');

  let selected = null;
  let release = 0;
  let touched = false;

  const measure = (host) => (host.querySelector('[data-sel-box]') || host).getBoundingClientRect();

  const select = (host) => {
    clearTimeout(release);
    const rect = measure(host);
    const place = () => {
      box.style.transform = `translate(${Math.round(rect.left + scrollX)}px, ${Math.round(rect.top + scrollY)}px)`;
      box.style.width = `${Math.round(rect.width)}px`;
      box.style.height = `${Math.round(rect.height)}px`;
      size.textContent = `${Math.round(rect.width)} × ${Math.round(rect.height)}`;
    };
    if (box.classList.contains('on')) {
      place();
    } else {
      box.style.transition = 'none';
      place();
      void box.offsetWidth;
      box.style.transition = '';
      box.classList.add('on');
    }
    selected = host;
  };

  const deselect = (delay = 70) => {
    clearTimeout(release);
    release = setTimeout(() => {
      box.classList.remove('on');
      selected = null;
    }, delay);
  };

  document.addEventListener('pointerover', (event) => {
    const host = event.target.closest('[data-sel]');
    if (host) {
      touched = true;
      if (host !== selected) select(host);
      else clearTimeout(release);
    } else if (selected) {
      deselect();
    }
  });

  document.addEventListener('focusin', (event) => {
    if (!event.target.matches(':focus-visible')) return;
    const host = event.target.closest('[data-sel]');
    if (host) {
      touched = true;
      select(host);
    } else if (selected) {
      deselect(0);
    }
  });

  document.addEventListener('focusout', () => {
    if (selected) deselect();
  });

  addEventListener('resize', () => deselect(0));
  addEventListener('pagehide', () => box.classList.remove('on'));

  // On the landing page, someone else is already in the file. They move the way a hand does:
  // along a slight arc, easing in and out, then resting completely still for a while.
  const thumbs = [...document.querySelectorAll('.thumb')];
  if (!thumbs.length) return;

  const ghost = document.createElement('div');
  ghost.className = 'ghost';
  ghost.innerHTML = '<svg viewBox="0 0 15 15"><path d="M1.5 1 13.5 6 8 7.7 5.9 13.5z"/></svg><span>James Stainer, PhD</span>';
  layer.append(ghost);

  const tag = ghost.querySelector('span');
  const between = (low, high) => low + Math.random() * (high - low);
  const wait = (ms) => new Promise((done) => setTimeout(done, ms));

  // The resting place is kept relative to a frame, so it survives the window changing size.
  let rest = { frame: thumbs.length - 1, fx: .44, fy: .9 };
  let here = { x: 0, y: 0 };
  let motion = 0;
  let arrive = null;

  const locate = ({ frame, fx, fy }) => {
    const rect = measure(thumbs[frame]);
    const room = document.documentElement.clientWidth - tag.offsetWidth - 28;
    return { x: Math.min(rect.left + scrollX + rect.width * fx, room), y: rect.top + scrollY + rect.height * fy };
  };

  const draw = () => { ghost.style.transform = `translate(${here.x.toFixed(2)}px, ${here.y.toFixed(2)}px)`; };

  const glide = (next) => new Promise((done) => {
    rest = next;
    const from = here;
    const to = locate(next);
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const distance = Math.hypot(dx, dy) || 1;
    const bow = (Math.random() < .5 ? -1 : 1) * Math.min(110, distance * between(.08, .18));
    const c1 = { x: from.x + dx * .3 - (dy / distance) * bow, y: from.y + dy * .3 + (dx / distance) * bow };
    const c2 = { x: from.x + dx * .72 - (dy / distance) * bow * .7, y: from.y + dy * .72 + (dx / distance) * bow * .7 };
    const duration = 380 + distance * 1.25;
    const started = performance.now();
    arrive = done;
    const step = (now) => {
      const t = Math.min(1, (now - started) / duration);
      const s = t * t * t * (t * (t * 6 - 15) + 10);
      const u = 1 - s;
      here = {
        x: u * u * u * from.x + 3 * u * u * s * c1.x + 3 * u * s * s * c2.x + s * s * s * to.x,
        y: u * u * u * from.y + 3 * u * u * s * c1.y + 3 * u * s * s * c2.y + s * s * s * to.y,
      };
      draw();
      if (t < 1) {
        motion = requestAnimationFrame(step);
      } else {
        arrive = null;
        done();
      }
    };
    motion = requestAnimationFrame(step);
  });

  addEventListener('resize', () => {
    cancelAnimationFrame(motion);
    here = locate(rest);
    draw();
    if (arrive) {
      arrive();
      arrive = null;
    }
  });

  const somewhereIn = (frame) => ({ frame, fx: between(.22, .72), fy: between(.3, .88) });

  const wander = async (firstPause) => {
    let pause = firstPause;
    for (;;) {
      await wait(pause);
      pause = between(3500, 8000);
      // Hold still while the visitor is choosing something, or when nobody is looking.
      if (document.hidden || selected) continue;
      const others = thumbs.map((_, i) => i).filter((i) => i !== rest.frame);
      const frame = Math.random() < .3 ? rest.frame : others[Math.floor(Math.random() * others.length)];
      await glide(somewhereIn(frame));
    }
  };

  const begin = async () => {
    // The frames slide in on load, so only measure them once they have landed.
    await Promise.allSettled([document.fonts.ready, ...thumbs.flatMap((thumb) => thumb.getAnimations().map((run) => run.finished))]);

    let played = false;
    try { played = sessionStorage.getItem('intro') === '1'; sessionStorage.setItem('intro', '1'); } catch {}

    if (played || calm || root.classList.contains('vt')) {
      here = locate(rest);
      draw();
      ghost.classList.add('on');
      if (!calm) wander(between(900, 1800));
      return;
    }

    // First visit: the cursor crosses the file, selects a frame, then moves on.
    rest = { frame: thumbs.length - 1, fx: 1.06, fy: 1.04 };
    here = locate(rest);
    draw();
    ghost.classList.add('on');
    await wait(280);
    await glide({ frame: 0, fx: .78, fy: .86 });
    await wait(200);
    if (!touched) select(thumbs[0]);
    await wait(1100);
    if (!touched) deselect(0);
    await wait(450);
    await glide(somewhereIn(thumbs.length - 1));
    wander(between(3500, 8000));
  };

  begin();
})();

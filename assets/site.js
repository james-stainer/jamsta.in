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
})();

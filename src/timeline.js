/* ============================================================================
   Timeline — the signature control.
   A 96-hour scrubber with day/night shading so the diurnal cycle (which drives
   the urban heat-island signal) is legible before you even press play.
   ========================================================================== */
window.DUCT = window.DUCT || {};

DUCT.timeline = {
  playing: false,
  timer: null,
  fps: 4,            // frames per second when playing
  el: {}
};

DUCT.timeline.init = function () {
  const t = DUCT.timeline;
  t.el.wrap = document.getElementById('timeline');
  t.el.canvas = document.getElementById('timeline-track');
  t.el.range = document.getElementById('timeline-range');
  t.el.play = document.getElementById('timeline-play');
  t.el.stamp = document.getElementById('timeline-stamp');
  t.el.counter = document.getElementById('timeline-counter');

  const meta = DUCT.layers.wrfMeta();
  if (!meta) {
    t.el.wrap.classList.add('is-disabled');
    t.el.stamp.textContent = 'no time series loaded';
    t.el.counter.textContent = '';
    return;
  }

  const n = meta.frames.length;
  t.el.range.min = 0;
  t.el.range.max = n - 1;
  t.el.range.value = 0;
  t.el.range.step = 1;

  t.el.range.addEventListener('input', () => {
    t.stop();
    t.goto(parseInt(t.el.range.value, 10));
  });
  t.el.play.addEventListener('click', () => (t.playing ? t.stop() : t.start()));

  t.drawTrack();
  t.goto(0);
  window.addEventListener('resize', () => t.drawTrack());
};

// Parse the frame timestamp for a given index from the meta manifest.
DUCT.timeline._time = function (i) {
  const meta = DUCT.layers.wrfMeta();
  const t0 = new Date(meta.t0);                       // ISO, treated as run time
  return new Date(t0.getTime() + i * meta.dt_hours * 3600 * 1000);
};

// Format for the big readout, in the run's local timezone offset (IST default).
DUCT.timeline._fmt = function (d) {
  const meta = DUCT.layers.wrfMeta();
  const tz = (meta && meta.tz_label) || 'IST';
  const opts = { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC' };
  // meta timestamps are already offset to local; render as UTC to avoid double shift
  return d.toLocaleString('en-GB', opts).replace(',', '') + ' ' + tz;
};

DUCT.timeline.goto = function (i) {
  const t = DUCT.timeline;
  const meta = DUCT.layers.wrfMeta();
  if (!meta) return;
  const n = meta.frames.length;
  i = ((i % n) + n) % n;
  t.el.range.value = i;
  DUCT.layers.setWRFFrame(i);

  const d = t._time(i);
  t.el.stamp.textContent = t._fmt(d);
  t.el.counter.textContent = 'hour ' + String(i + 1).padStart(2, '0') + ' / ' + n;
  t.drawPlayhead(i / (n - 1));
  if (DUCT.stations && DUCT.stations.markStep) DUCT.stations.markStep(i);
};

DUCT.timeline.start = function () {
  const t = DUCT.timeline;
  if (!DUCT.layers.wrfMeta()) return;
  t.playing = true;
  t.el.play.classList.add('is-playing');
  t.el.play.setAttribute('aria-label', 'Pause');
  const step = () => {
    const i = (DUCT.layers.wrf.index + 1);
    t.goto(i);
    t.timer = setTimeout(step, 1000 / t.fps);
  };
  t.timer = setTimeout(step, 1000 / t.fps);
};

DUCT.timeline.stop = function () {
  const t = DUCT.timeline;
  t.playing = false;
  t.el.play.classList.remove('is-playing');
  t.el.play.setAttribute('aria-label', 'Play');
  if (t.timer) clearTimeout(t.timer);
};

/* ---- Canvas: draw diurnal day/night bands + hour ticks ------------------- */
DUCT.timeline.drawTrack = function () {
  const t = DUCT.timeline;
  const meta = DUCT.layers.wrfMeta();
  const canvas = t.el.canvas;
  if (!canvas || !meta) return;

  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth, h = canvas.clientHeight;
  canvas.width = w * dpr; canvas.height = h * dpr;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  const n = meta.frames.length;
  for (let i = 0; i < n; i++) {
    const d = t._time(i);
    const hr = d.getUTCHours();               // meta already local-offset
    const isNight = hr < 6 || hr >= 19;        // simple diurnal split
    const x = (i / (n - 1)) * w;
    const bw = w / (n - 1) + 1;
    ctx.fillStyle = isNight ? 'rgba(30,42,60,0.85)' : 'rgba(61,214,196,0.10)';
    ctx.fillRect(x - bw / 2, 0, bw, h);
    if (hr === 0) {                            // midnight day-boundary tick
      ctx.fillStyle = 'rgba(230,237,245,0.35)';
      ctx.fillRect(x - 0.5, 0, 1, h);
    }
  }
  t._trackCtx = ctx; t._trackW = w; t._trackH = h;
  t.drawPlayhead(DUCT.layers.wrf.index / (n - 1));
};

DUCT.timeline.drawPlayhead = function (frac) {
  const t = DUCT.timeline;
  // Playhead is a DOM element over the canvas for crispness.
  const ph = document.getElementById('timeline-playhead');
  if (ph) ph.style.left = (frac * 100) + '%';
};

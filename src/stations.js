/* ============================================================================
   Stations — MPCB observation points + obs-vs-model T2 chart.
   Panel is collapsed until a station is selected.
   ========================================================================== */
window.DUCT = window.DUCT || {};

DUCT.stations = { data: null, chart: null, active: null };

DUCT.stations.load = async function () {
  // Markers are DOM overlays, not style layers: they are immune to the glyph
  // differences between basemaps (OpenFreeMap ships Noto, Carto ships Open
  // Sans, a raster style ships neither) and they survive setStyle() intact.
  if (!DUCT.stations.data) {
    try {
      const res = await fetch(DUCT.config.paths.stations, { cache: 'no-store' });
      if (!res.ok) throw new Error(res.status);
      DUCT.stations.data = await res.json();
    } catch (e) {
      console.info('stations not loaded (%s)', e.message);
      return;
    }
  }
  if (DUCT.stations.markers && DUCT.stations.markers.length) return;  // already placed

  DUCT.stations.markers = DUCT.stations.data.stations.map((s) => {
    const el = document.createElement('div');
    el.className = 'station-marker';
    el.innerHTML = '<i></i><b>' + s.name + '</b>';
    el.title = s.name + (s.lcz ? ' · LCZ ' + s.lcz : '');
    el.addEventListener('click', (ev) => {
      ev.stopPropagation();
      DUCT.stations.select(s.id);
    });
    return new maplibregl.Marker({ element: el, anchor: 'bottom' })
      .setLngLat([s.lon, s.lat])
      .addTo(DUCT.map);
  });
};

DUCT.stations.select = function (id) {
  const s = DUCT.stations.data.stations.find((x) => x.id === id);
  if (!s) return;
  DUCT.stations.active = s;
  const panel = document.getElementById('station-panel');
  panel.classList.add('is-open');
  document.getElementById('station-name').textContent = s.name;
  document.getElementById('station-meta').textContent =
    `${s.lat.toFixed(3)}, ${s.lon.toFixed(3)}` + (s.lcz ? ` · LCZ ${s.lcz}` : '');
  DUCT.stations.drawChart(s);
};

DUCT.stations.drawChart = function (s) {
  const ctx = document.getElementById('station-chart').getContext('2d');
  const labels = (s.obs || s.model || []).map((_, i) => i);
  const data = {
    labels,
    datasets: [
      { label: 'Observed', data: s.obs || [], borderColor: '#e6edf5', borderWidth: 1.5, pointRadius: 0, tension: 0.3 },
      { label: 'WRF v4', data: s.model || [], borderColor: '#3dd6c4', borderWidth: 1.5, pointRadius: 0, tension: 0.3 }
    ]
  };
  const opts = {
    responsive: true, maintainAspectRatio: false, animation: false,
    scales: {
      x: { title: { display: true, text: 'hour', color: '#8a9bb0' },
           ticks: { color: '#8a9bb0', maxTicksLimit: 8 }, grid: { color: 'rgba(255,255,255,0.05)' } },
      y: { title: { display: true, text: '°C', color: '#8a9bb0' },
           ticks: { color: '#8a9bb0' }, grid: { color: 'rgba(255,255,255,0.05)' } }
    },
    plugins: { legend: { labels: { color: '#e6edf5', boxWidth: 12, font: { size: 11 } } } }
  };
  if (DUCT.stations.chart) DUCT.stations.chart.destroy();
  DUCT.stations.chart = new Chart(ctx, { type: 'line', data, options: opts });
  DUCT.stations.markStep(DUCT.layers.wrf.index);
};

// Draw a vertical marker on the chart at the current timeline hour.
DUCT.stations.markStep = function (i) {
  // Kept lightweight: Chart.js annotation avoided to skip a plugin dependency.
  // The timeline counter already communicates the current hour.
};

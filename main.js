/* =============================================
   Lucy & Desi — Site JavaScript
   Loads content from the JSON files the admin
   panel edits, and renders it into each page.
   ============================================= */

(() => {
  'use strict';

  /* ---------- Helpers ---------- */

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function esc(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // Parse "YYYY-MM-DD" as a local date (avoids timezone shifting the day).
  function parseDate(s) {
    if (!s) return null;
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
    if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
    const d = new Date(s);
    return isNaN(d) ? null : d;
  }

  const monthShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthLong = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
    'August', 'September', 'October', 'November', 'December'];

  function fmtDate(s, long = false) {
    const d = parseDate(s);
    if (!d) return '';
    const m = long ? monthLong : monthShort;
    return `${m[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  }

  function byDateDesc(a, b) {
    return (parseDate(b.date)?.getTime() || 0) - (parseDate(a.date)?.getTime() || 0);
  }

  function slugify(s) {
    return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }

  function tagClass(who) {
    return who === 'Lucy' ? 'tag-lucy' : who === 'Desi' ? 'tag-desi' : 'tag-both';
  }

  function ageText(birthday) {
    const b = parseDate(birthday);
    if (!b) return '';
    const now = new Date();
    let months = (now.getFullYear() - b.getFullYear()) * 12 + (now.getMonth() - b.getMonth());
    if (now.getDate() < b.getDate()) months -= 1;
    if (months < 0) return '';
    if (months < 12) return `${months} month${months === 1 ? '' : 's'} old`;
    const y = Math.floor(months / 12), mo = months % 12;
    return `${y} year${y === 1 ? '' : 's'}${mo ? ` ${mo} month${mo === 1 ? '' : 's'}` : ''} old`;
  }

  // Minimal Markdown: headings, paragraphs, bold, italic, links, lists, line breaks.
  function md(src) {
    const inline = (t) => esc(t)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
      .replace(/_([^_\n]+)_/g, '<em>$1</em>')
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

    const blocks = String(src || '').replace(/\r\n/g, '\n').split(/\n{2,}/);
    return blocks.map((b) => {
      const lines = b.split('\n').filter((l) => l.trim() !== '');
      if (!lines.length) return '';
      const h = /^(#{1,3})\s+(.*)$/.exec(lines[0]);
      if (h && lines.length === 1) {
        const level = h[1].length + 1; // h2..h4 inside a post
        return `<h${level}>${inline(h[2])}</h${level}>`;
      }
      if (lines.every((l) => /^\s*[-*]\s+/.test(l))) {
        return '<ul>' + lines.map((l) => `<li>${inline(l.replace(/^\s*[-*]\s+/, ''))}</li>`).join('') + '</ul>';
      }
      if (lines.every((l) => /^\s*\d+[.)]\s+/.test(l))) {
        return '<ol>' + lines.map((l) => `<li>${inline(l.replace(/^\s*\d+[.)]\s+/, ''))}</li>`).join('') + '</ol>';
      }
      return `<p>${lines.map(inline).join('<br>')}</p>`;
    }).join('\n');
  }

  async function loadJSON(file, key) {
    try {
      const res = await fetch(file, { cache: 'no-cache' });
      if (!res.ok) throw new Error(res.status);
      const data = await res.json();
      return key ? (Array.isArray(data[key]) ? data[key] : []) : data;
    } catch (e) {
      console.warn(`Could not load ${file}`, e);
      return key ? [] : {};
    }
  }

  const load = {
    site: () => loadJSON('site.json'),
    photos: async () => (await loadJSON('photos.json', 'photos')).filter((p) => p.image).sort(byDateDesc),
    posts: async () => (await loadJSON('posts.json', 'posts')).filter((p) => p.title).sort(byDateDesc),
    milestones: async () => (await loadJSON('milestones.json', 'milestones')).filter((m) => m.title).sort(byDateDesc),
    weights: async () => (await loadJSON('weights.json', 'weights'))
      .filter((w) => w.date && w.cat && Number.isFinite(+w.lbs))
      .sort((a, b) => byDateDesc(b, a)),
  };

  function empty(el, text) {
    el.innerHTML = `<div class="empty-state">${esc(text)}</div>`;
  }

  /* ---------- Renderers ---------- */

  function photoTile(p, i) {
    return `<button type="button" class="gallery-item" data-index="${i}" aria-label="${esc(p.caption || 'Photo')}">
      <img src="${esc(p.image)}" alt="${esc(p.caption || '')}" loading="lazy">
    </button>`;
  }

  function placeholderTiles(n) {
    const colors = ['lucy', 'desi', 'lavender'];
    return Array.from({ length: n }, (_, i) =>
      `<div class="gallery-item gallery-item--placeholder" style="background: var(--${colors[i % 3]}-light);">
        <div class="gallery-placeholder"><span>Photo coming soon</span></div>
      </div>`).join('');
  }

  function renderGallery(container, photos, limit) {
    const list = limit ? photos.slice(0, limit) : photos;
    if (!list.length) {
      container.innerHTML = placeholderTiles(limit || 4);
      return;
    }
    container.innerHTML = list.map(photoTile).join('');
    setupLightbox(container, list);
  }

  function setupLightbox(container, photos) {
    let dlg = $('#lightbox');
    if (!dlg) {
      dlg = document.createElement('dialog');
      dlg.id = 'lightbox';
      dlg.className = 'lightbox';
      dlg.innerHTML = `
        <button type="button" class="lightbox-close" aria-label="Close">×</button>
        <button type="button" class="lightbox-nav lightbox-prev" aria-label="Previous photo">‹</button>
        <figure><img alt=""><figcaption></figcaption></figure>
        <button type="button" class="lightbox-nav lightbox-next" aria-label="Next photo">›</button>`;
      document.body.appendChild(dlg);
      dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
      $('.lightbox-close', dlg).addEventListener('click', () => dlg.close());
    }
    let current = 0;
    const show = (i) => {
      current = (i + photos.length) % photos.length;
      const p = photos[current];
      $('img', dlg).src = p.image;
      $('img', dlg).alt = p.caption || '';
      const bits = [p.caption, p.who && p.who !== 'Both' ? p.who : '', fmtDate(p.date)].filter(Boolean);
      $('figcaption', dlg).textContent = bits.join(' — ');
      $$('.lightbox-nav', dlg).forEach((b) => { b.style.display = photos.length > 1 ? '' : 'none'; });
    };
    $('.lightbox-prev', dlg).onclick = () => show(current - 1);
    $('.lightbox-next', dlg).onclick = () => show(current + 1);
    dlg.onkeydown = (e) => {
      if (e.key === 'ArrowLeft') show(current - 1);
      if (e.key === 'ArrowRight') show(current + 1);
    };
    $$('.gallery-item[data-index]', container).forEach((btn) => {
      btn.addEventListener('click', () => { show(+btn.dataset.index); dlg.showModal(); });
    });
  }

  function postCard(p) {
    const slug = slugify(p.title) + '-' + (p.date || '').replace(/-/g, '');
    return `<article class="blog-card">
      ${p.image ? `<a href="post.html?p=${esc(slug)}" class="blog-card-image"><img src="${esc(p.image)}" alt="" loading="lazy"></a>` : ''}
      <div class="blog-meta"><span>${esc(fmtDate(p.date))}</span><span class="blog-tag ${tagClass(p.who)}">${esc(p.who || 'Both')}</span></div>
      <h3><a href="post.html?p=${esc(slug)}">${esc(p.title)}</a></h3>
      <p>${esc(p.summary || firstSentence(p.body))}</p>
      <a href="post.html?p=${esc(slug)}" class="read-more">Read more</a>
    </article>`;
  }

  function firstSentence(body) {
    const t = String(body || '').replace(/[#*_>\-]/g, '').trim();
    const m = /^(.{20,200}?[.!?])(\s|$)/.exec(t);
    return m ? m[1] : t.slice(0, 160);
  }

  function renderPosts(container, posts, limit) {
    const list = limit ? posts.slice(0, limit) : posts;
    if (!list.length) return empty(container, 'No posts yet. The first one is waiting to be written.');
    container.innerHTML = list.map(postCard).join('');
  }

  function milestoneItem(m) {
    const dot = m.who === 'Lucy' ? 'var(--lucy-dark)' : m.who === 'Desi' ? 'var(--desi-dark)' : 'var(--lavender-dark)';
    return `<div class="timeline-item">
      <div class="timeline-dot" style="border-color: ${dot};"></div>
      <div class="timeline-date">${esc(fmtDate(m.date))}${m.who && m.who !== 'Both' ? ` · ${esc(m.who)}` : ''}</div>
      <div class="timeline-content">
        <h3>${esc(m.title)}</h3>
        ${m.description ? `<p>${esc(m.description)}</p>` : ''}
        ${m.image ? `<img class="timeline-image" src="${esc(m.image)}" alt="" loading="lazy">` : ''}
      </div>
    </div>`;
  }

  function renderMilestones(container, items, limit) {
    const list = limit ? items.slice(0, limit) : items;
    if (!list.length) return empty(container, 'No milestones yet.');
    container.innerHTML = list.map(milestoneItem).join('');
  }

  /* ---------- Growth chart (hand-drawn SVG) ---------- */

  function renderChart(container, weights) {
    const cats = ['Lucy', 'Desi'];
    const series = cats.map((c) => weights.filter((w) => w.cat === c));
    const all = series.flat();
    if (!all.length) return empty(container, 'No weigh-ins yet. Add the first one in the admin panel.');

    const narrow = container.clientWidth > 0 && container.clientWidth < 520;
    const W = narrow ? 380 : 720, H = narrow ? 300 : 360, padL = 44, padR = 16, padT = 20, padB = 44;
    const xs = all.map((w) => parseDate(w.date).getTime());
    const ys = all.map((w) => +w.lbs);
    let xMin = Math.min(...xs), xMax = Math.max(...xs);
    if (xMax === xMin) { xMin -= 15 * 864e5; xMax += 15 * 864e5; }
    else { const pad = (xMax - xMin) * 0.04; xMin -= pad; xMax += pad; }
    let yMin = Math.floor(Math.min(...ys) - 1), yMax = Math.ceil(Math.max(...ys) + 1);
    if (yMin < 0) yMin = 0;
    if (yMax - yMin < 4) yMax = yMin + 4;

    const sx = (t) => padL + ((t - xMin) / (xMax - xMin)) * (W - padL - padR);
    const sy = (v) => H - padB - ((v - yMin) / (yMax - yMin)) * (H - padT - padB);

    // Y grid: whole pounds, at most ~8 lines
    const yStep = Math.max(1, Math.ceil((yMax - yMin) / 8));
    let grid = '';
    for (let v = yMin; v <= yMax; v += yStep) {
      grid += `<line x1="${padL}" x2="${W - padR}" y1="${sy(v)}" y2="${sy(v)}" class="chart-grid"/>
               <text x="${padL - 8}" y="${sy(v) + 4}" class="chart-tick" text-anchor="end">${v}</text>`;
    }
    // X ticks: up to 6 evenly spaced dates
    const uniq = Array.from(new Set(xs)).sort((a, b) => a - b);
    let ticks;
    if (uniq.length <= (narrow ? 4 : 6)) {
      ticks = uniq.map((t) => [t, `${monthShort[new Date(t).getMonth()]} ${new Date(t).getDate()}`]);
    } else {
      const n = narrow ? 4 : 6;
      ticks = Array.from({ length: n }, (_, i) => {
        const t = xMin + ((xMax - xMin) * i) / (n - 1);
        const d = new Date(t);
        return [t, `${monthShort[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`];
      });
    }
    const xt = ticks.map(([t, label]) =>
      `<text x="${sx(t)}" y="${H - padB + 20}" class="chart-tick" text-anchor="middle">${label}</text>`).join('');

    const colors = { Lucy: 'var(--lucy-dark)', Desi: 'var(--desi-dark)' };
    let lines = '';
    series.forEach((pts, i) => {
      if (!pts.length) return;
      const cat = cats[i];
      const path = pts.map((w, j) => `${j ? 'L' : 'M'}${sx(parseDate(w.date).getTime()).toFixed(1)} ${sy(+w.lbs).toFixed(1)}`).join(' ');
      lines += `<path d="${path}" fill="none" stroke="${colors[cat]}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`;
      pts.forEach((w) => {
        lines += `<circle cx="${sx(parseDate(w.date).getTime())}" cy="${sy(+w.lbs)}" r="5" fill="var(--bg-card)" stroke="${colors[cat]}" stroke-width="2.5">
          <title>${esc(cat)} — ${esc(fmtDate(w.date))}: ${esc(w.lbs)} lb${w.note ? ` (${esc(w.note)})` : ''}</title></circle>`;
      });
    });

    container.innerHTML = `
      <div class="chart-legend">
        <span><i style="background: var(--lucy-dark)"></i>Lucy</span>
        <span><i style="background: var(--desi-dark)"></i>Desi</span>
      </div>
      <svg viewBox="0 0 ${W} ${H}" class="growth-chart" role="img" aria-label="Weight over time for Lucy and Desi">
        ${grid}${xt}
        <text x="14" y="${(padT + H - padB) / 2}" class="chart-tick" text-anchor="middle" transform="rotate(-90 14 ${(padT + H - padB) / 2})">pounds</text>
        ${lines}
      </svg>`;
  }

  function renderWeightSummary(container, weights) {
    const latest = (cat) => weights.filter((w) => w.cat === cat).slice(-1)[0];
    const html = ['Lucy', 'Desi'].map((cat) => {
      const w = latest(cat);
      const cls = cat.toLowerCase();
      return `<div class="weight-card weight-card--${cls}">
        <div class="weight-name">${cat}</div>
        <div class="weight-value">${w ? `${(+w.lbs).toFixed(1)}<small> lb</small>` : '<small>no weigh-in yet</small>'}</div>
        ${w ? `<div class="weight-date">${esc(fmtDate(w.date))}</div>` : ''}
      </div>`;
    }).join('');
    container.innerHTML = html;
  }

  function renderWeightTable(container, weights) {
    if (!weights.length) { container.innerHTML = ''; return; }
    const rows = weights.slice().reverse().map((w) => `<tr>
      <td>${esc(fmtDate(w.date))}</td>
      <td><span class="blog-tag ${tagClass(w.cat)}">${esc(w.cat)}</span></td>
      <td class="num">${(+w.lbs).toFixed(1)}</td>
      <td class="note">${esc(w.note || '')}</td>
    </tr>`).join('');
    container.innerHTML = `<table class="weight-table">
      <thead><tr><th>Date</th><th>Cat</th><th class="num">lb</th><th>Note</th></tr></thead>
      <tbody>${rows}</tbody></table>`;
  }

  /* ---------- Page setup ---------- */

  function setupNav() {
    const toggle = $('.nav-toggle');
    const navLinks = $('.nav-links');
    if (toggle && navLinks) {
      toggle.addEventListener('click', () => {
        const isOpen = navLinks.classList.toggle('open');
        toggle.setAttribute('aria-expanded', isOpen);
      });
      document.addEventListener('click', (e) => {
        if (!toggle.contains(e.target) && !navLinks.contains(e.target)) {
          navLinks.classList.remove('open');
          toggle.setAttribute('aria-expanded', false);
        }
      });
    }
    const current = (window.location.pathname.split('/').pop() || 'index.html').replace(/\.html$/, '') || 'index';
    $$('.nav-links a').forEach((link) => {
      const href = (link.getAttribute('href') || '').replace(/\.html$/, '');
      if (href === current || (current === 'post' && href === 'blog')) link.classList.add('active');
    });
  }

  async function applySiteSettings() {
    const site = await load.site();
    const set = (sel, val) => { const el = $(sel); if (el && val) el.textContent = val; };
    set('[data-site="tagline"]', site.tagline);
    set('[data-site="intro"]', site.intro);
    set('[data-site="lucy_blurb"]', site.lucy_blurb);
    set('[data-site="desi_blurb"]', site.desi_blurb);
    set('[data-site="location"]', site.location);
    const age = ageText(site.birthday);
    $$('[data-site="age"]').forEach((el) => { el.textContent = age; });
    return site;
  }

  const pages = {
    async home() {
      const [photos, posts, milestones, weights] = await Promise.all([load.photos(), load.posts(), load.milestones(), load.weights()]);
      renderGallery($('#home-photos'), photos, 4);
      renderPosts($('#home-posts'), posts, 2);
      renderMilestones($('#home-milestones'), milestones, 2);
      renderWeightSummary($('#home-weights'), weights);
    },
    async gallery() {
      const photos = await load.photos();
      const grid = $('#gallery');
      if (!photos.length) return empty(grid, 'No photos yet. Sign in and add the first one.');
      renderGallery(grid, photos);
      const count = $('#photo-count');
      if (count) count.textContent = `${photos.length} photo${photos.length === 1 ? '' : 's'}`;
    },
    async blog() {
      renderPosts($('#posts'), await load.posts());
    },
    async post() {
      const posts = await load.posts();
      const want = new URLSearchParams(location.search).get('p');
      const post = posts.find((p) => slugify(p.title) + '-' + (p.date || '').replace(/-/g, '') === want) || posts[0];
      const el = $('#post');
      if (!post) return empty(el, 'That post could not be found.');
      document.title = `${post.title} — Lucy & Desi`;
      el.innerHTML = `
        <div class="blog-meta"><span>${esc(fmtDate(post.date, true))}</span><span class="blog-tag ${tagClass(post.who)}">${esc(post.who || 'Both')}</span></div>
        <h1>${esc(post.title)}</h1>
        ${post.image ? `<img class="post-image" src="${esc(post.image)}" alt="">` : ''}
        <div class="post-body">${md(post.body)}</div>
        <p class="mt-md"><a href="blog.html" class="btn btn-outline">All posts</a></p>`;
    },
    async milestones() {
      renderMilestones($('#milestones'), await load.milestones());
    },
    async growth() {
      const weights = await load.weights();
      renderWeightSummary($('#growth-summary'), weights);
      renderChart($('#growth-chart'), weights);
      renderWeightTable($('#growth-table'), weights);
      let t;
      window.addEventListener('resize', () => { clearTimeout(t); t = setTimeout(() => renderChart($('#growth-chart'), weights), 150); });
    },
  };

  document.addEventListener('DOMContentLoaded', async () => {
    setupNav();
    await applySiteSettings();
    const page = document.body.dataset.page;
    if (pages[page]) pages[page]();
  });
})();

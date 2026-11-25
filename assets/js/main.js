/* 智能健康科學實驗室 — 共用互動腳本
 * 讀取 data/*.json 並渲染成員、消息、論文、PI 履歷；
 * 處理導覽列（手機選單、捲動高亮）、進場動畫與心電圖動畫。
 * 版面樣式由各設計的 style.css 決定，本檔只輸出語意化標記與 kebab-case 類別。
 */
(() => {
  'use strict';

  const root = document.body.dataset.root || '';
  const isEn = document.documentElement.lang.toLowerCase().startsWith('en');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const t = (zh, en) => (isEn ? en : zh);

  const LABELS = {
    roles: {
      pi: t('實驗室主持人', 'Principal Investigator'),
      postdoc: t('博士後研究員', 'Postdoctoral Researchers'),
      phd: t('博士生', 'Ph.D. Students'),
      assistant: t('研究助理', 'Research Assistants'),
      master: t('碩士生', 'M.S. Students'),
      undergrad: t('大學部專題生', 'Undergraduate Researchers'),
      external: t('校外指導', 'External Mentees'),
      alumni: t('畢業成員', 'Alumni')
    },
    pubTypes: {
      all: t('全部', 'All'),
      journal: t('期刊', 'Journal'),
      conference: t('研討會', 'Conference'),
      preprint: t('預印本', 'Preprint'),
      thesis: t('論文', 'Thesis'),
      patent: t('專利', 'Patent')
    },
    newsTypes: {
      all: t('全部', 'All'),
      publication: t('發表', 'Publication'),
      member: t('成員', 'Member'),
      event: t('活動', 'Event')
    },
    more: t('顯示更多', 'Show more'),
    less: t('收合', 'Show less'),
    loadError: location.protocol === 'file:'
      ? t('無法直接以檔案開啟讀取資料，請雙擊專案資料夾中的「預覽網站.bat」來預覽網站。', 'Data cannot be loaded from a local file. Please run 預覽網站.bat in the project folder to preview the site.')
      : t('資料載入失敗，請確認 data 資料夾內的 .json 檔案存在且格式正確。', 'Failed to load data. Please check that the .json files in the data folder exist and are valid.'),
    patentYear: t('專利', 'Patents')
  };

  /* ---------- 工具函式 ---------- */
  const escapeHtml = (s = '') =>
    String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // 安全轉換：**粗體** → <strong>，【佔位】→ 標示樣式
  const format = (s = '') =>
    escapeHtml(s)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/【([^】]*)】/g, '<span class="placeholder-text">【$1】</span>');

  // 讀取 data/*.json（需以 http 開啟：GitHub Pages 或「預覽網站.bat」）
  const cache = {};
  const getData = (name) => {
    if (!cache[name]) {
      cache[name] = fetch(`${root}data/${name}.json`).then((res) => {
        if (!res.ok) throw new Error(`data/${name}.json: ${res.status}`);
        return res.json();
      });
    }
    return cache[name];
  };

  const showError = (el) => {
    el.innerHTML = `<p class="load-error">${LABELS.loadError}</p>`;
  };

  // 年份範圍篩選：容器上的 data-from / data-to（例如 2021–2026）
  const yearRange = (el) => ({ from: Number(el.dataset.from) || -Infinity, to: Number(el.dataset.to) || Infinity });
  // 期間文字（如 "Sep. 2020 – Aug. 2025"）是否與範圍重疊；Present／迄今視為今年；沒有年份的項目保留
  const inRange = (text, { from, to }) => {
    const years = (String(text).match(/(?:19|20)\d{2}/g) || []).map(Number);
    if (/present|迄今|至今/i.test(text)) years.push(new Date().getFullYear());
    if (!years.length) return true;
    return Math.max(...years) >= from && Math.min(...years) <= to;
  };

  const resolvePath = (p) => (!p || /^(https?:|mailto:)/.test(p) ? p : root + p);

  /* ---------- 導覽列 ---------- */
  const initNav = () => {
    const header = document.querySelector('.site-header');
    const toggle = document.querySelector('.nav-toggle');
    const menu = toggle && document.getElementById(toggle.getAttribute('aria-controls'));

    if (toggle && menu) {
      const setOpen = (open) => {
        toggle.setAttribute('aria-expanded', String(open));
        menu.classList.toggle('is-open', open);
        document.body.classList.toggle('nav-open', open);
      };
      toggle.addEventListener('click', () => setOpen(toggle.getAttribute('aria-expanded') !== 'true'));
      menu.addEventListener('click', (e) => {
        if (e.target.closest('a')) setOpen(false);
      });
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
          setOpen(false);
          toggle.focus();
        }
      });
      window.matchMedia('(min-width: 900px)').addEventListener('change', (e) => e.matches && setOpen(false));
    }

    if (header) {
      const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 12);
      onScroll();
      window.addEventListener('scroll', onScroll, { passive: true });
    }

    // 捲動時高亮目前區塊
    const links = [...document.querySelectorAll('.nav-menu a[href^="#"]')];
    const sections = links.map((a) => document.querySelector(a.getAttribute('href'))).filter(Boolean);
    if ('IntersectionObserver' in window && sections.length) {
      const io = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            links.forEach((a) => {
              const active = a.getAttribute('href') === `#${entry.target.id}`;
              a.classList.toggle('is-active', active);
              if (active) a.setAttribute('aria-current', 'true');
              else a.removeAttribute('aria-current');
            });
          });
        },
        { rootMargin: '-45% 0px -50% 0px' }
      );
      sections.forEach((s) => io.observe(s));
    }
  };

  /* ---------- 進場動畫 ---------- */
  const initReveal = () => {
    const items = document.querySelectorAll('.reveal');
    if (reduceMotion || !('IntersectionObserver' in window)) {
      items.forEach((el) => el.classList.add('is-visible'));
      return;
    }
    const io = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            obs.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    items.forEach((el) => io.observe(el));
  };

  /* ---------- 篩選按鈕 ---------- */
  const buildFilters = (types, labels, onChange, ariaLabel) => {
    const bar = document.createElement('div');
    bar.className = 'filter-bar';
    bar.setAttribute('role', 'group');
    bar.setAttribute('aria-label', ariaLabel);
    ['all', ...types].forEach((type, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'filter-btn';
      btn.dataset.type = type;
      btn.textContent = labels[type] || type;
      btn.setAttribute('aria-pressed', String(i === 0));
      btn.addEventListener('click', () => {
        bar.querySelectorAll('.filter-btn').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
        onChange(type);
      });
      bar.appendChild(btn);
    });
    return bar;
  };

  const buildMoreButton = (onToggle) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'more-btn';
    btn.textContent = LABELS.more;
    btn.setAttribute('aria-expanded', 'false');
    btn.addEventListener('click', () => {
      const expanded = btn.getAttribute('aria-expanded') !== 'true';
      btn.setAttribute('aria-expanded', String(expanded));
      btn.textContent = expanded ? LABELS.less : LABELS.more;
      onToggle(expanded);
    });
    return btn;
  };

  /* ---------- 成員 ---------- */
  const ROLE_ORDER = ['pi', 'postdoc', 'phd', 'master', 'undergrad', 'external', 'assistant'];

  const memberCard = (m) => {
    const name = isEn ? m.name_en : m.name_zh;
    const sub = isEn ? m.name_zh : m.name_en;
    const title = isEn ? m.title_en : m.title_zh;
    const aff = isEn ? m.affiliation_en : m.affiliation_zh;
    const research = isEn ? m.research_en : m.research;
    const links = [];
    if (m.email) links.push(`<a href="mailto:${escapeHtml(m.email)}" aria-label="Email ${escapeHtml(name)}">Email</a>`);
    if (m.links?.website) links.push(`<a href="${escapeHtml(m.links.website)}">${t('個人頁', 'Profile')}</a>`);
    if (m.links?.scholar) links.push(`<a href="${escapeHtml(m.links.scholar)}" target="_blank" rel="noopener">Scholar</a>`);
    if (m.links?.github) links.push(`<a href="${escapeHtml(m.links.github)}" target="_blank" rel="noopener">GitHub</a>`);
    const extra = m.status === 'alumni' && m.destination ? `<p class="member-destination">${format(m.destination)}</p>` : '';
    return `
      <article class="member-card member-card--${escapeHtml(m.role)} reveal">
        <div class="member-photo">
          <img src="${escapeHtml(resolvePath(m.photo))}" alt="${escapeHtml(t(`${m.name_zh} 的照片`, `Photo of ${m.name_zh}`))}" loading="lazy" width="400" height="400">
        </div>
        <div class="member-body">
          <p class="member-title">${format(title)}</p>
          <h4 class="member-name">${format(name)}</h4>
          <p class="member-name-sub">${format(sub)}</p>
          ${aff ? `<p class="member-affiliation">${format(aff)}</p>` : ''}
          ${research ? `<p class="member-research">${format(research)}</p>` : ''}
          ${extra}
          ${links.length ? `<p class="member-links">${links.join('')}</p>` : ''}
        </div>
      </article>`;
  };

  const renderMembers = async (el) => {
    try {
      const members = await getData('members');
      const current = members.filter((m) => m.status !== 'alumni');
      const alumni = members.filter((m) => m.status === 'alumni');
      let html = '';
      ROLE_ORDER.forEach((role) => {
        const list = current.filter((m) => m.role === role);
        if (!list.length) return;
        html += `
          <div class="member-group member-group--${role}">
            <h3 class="member-group-title">${LABELS.roles[role]}</h3>
            <div class="member-grid">${list.map(memberCard).join('')}</div>
          </div>`;
      });
      if (alumni.length) {
        html += `
          <div class="member-group member-group--alumni">
            <h3 class="member-group-title">${LABELS.roles.alumni}</h3>
            <div class="member-grid">${alumni.map(memberCard).join('')}</div>
          </div>`;
      }
      el.innerHTML = html;
      setStat('members', current.length);
      initReveal();
    } catch (err) {
      console.error(err);
      showError(el);
    }
  };

  /* ---------- 最新消息 ---------- */
  const formatDate = (d) => d.replace(/-/g, '.');

  const renderNews = async (el) => {
    try {
      const news = (await getData('news')).sort((a, b) => b.date.localeCompare(a.date));
      const limit = Number(el.dataset.limit) || news.length;
      let type = 'all';
      let expanded = false;

      const list = document.createElement('ul');
      list.className = 'news-list';

      const draw = () => {
        const filtered = news.filter((n) => type === 'all' || n.category === type);
        const shown = expanded ? filtered : filtered.slice(0, limit);
        list.innerHTML = shown
          .map((n) => {
            const text = format(isEn ? n.en : n.zh);
            const body = n.link ? `<a href="${escapeHtml(n.link)}">${text}</a>` : text;
            return `
              <li class="news-item news-item--${escapeHtml(n.category)}">
                <time class="news-date" datetime="${escapeHtml(n.date)}">${formatDate(n.date)}</time>
                <span class="news-tag news-tag--${escapeHtml(n.category)}">${LABELS.newsTypes[n.category] || n.category}</span>
                <p class="news-text">${body}</p>
              </li>`;
          })
          .join('');
        if (moreBtn) moreBtn.hidden = filtered.length <= limit;
      };

      el.innerHTML = '';
      if (el.dataset.filter === 'true') {
        const types = [...new Set(news.map((n) => n.category))];
        el.appendChild(buildFilters(types, LABELS.newsTypes, (tp) => { type = tp; draw(); }, t('消息分類', 'News category')));
      }
      el.appendChild(list);
      const moreBtn = buildMoreButton((exp) => { expanded = exp; draw(); });
      el.appendChild(moreBtn);
      draw();
    } catch (err) {
      console.error(err);
      showError(el);
    }
  };

  /* ---------- 論文 ---------- */
  const pubItem = (p) => {
    const links = Object.entries(p.links || {})
      .filter(([, url]) => url)
      .map(([k, url]) => `<a href="${escapeHtml(url)}" target="_blank" rel="noopener">${k.toUpperCase()}</a>`)
      .join('');
    return `
      <li class="pub-item pub-item--${escapeHtml(p.type)}">
        <p class="pub-title">${format(p.title)}</p>
        <p class="pub-authors">${format(p.authors)}</p>
        <p class="pub-meta">
          <span class="pub-type pub-type--${escapeHtml(p.type)}">${LABELS.pubTypes[p.type] || p.type}</span>
          ${p.note ? `<span class="pub-note">${escapeHtml(p.note)}</span>` : ''}
          <span class="pub-venue">${format(p.venue)}</span>
        </p>
        ${links ? `<p class="pub-links">${links}</p>` : ''}
      </li>`;
  };

  const renderPublications = async (el) => {
    try {
      const range = yearRange(el);
      const pubs = (await getData('publications')).filter((p) => inRange(p.year ?? '', range));
      const limit = Number(el.dataset.limit) || pubs.length;
      let type = 'all';
      let expanded = false;

      setStat('journals', pubs.filter((p) => p.type === 'journal').length);
      setStat('conferences', pubs.filter((p) => p.type === 'conference').length);
      setStat('patents', pubs.filter((p) => p.type === 'patent').length);

      const wrap = document.createElement('div');
      wrap.className = 'pub-groups';

      const draw = () => {
        const filtered = pubs.filter((p) => type === 'all' || p.type === type);
        const shown = expanded ? filtered : filtered.slice(0, limit);
        const groups = new Map();
        shown.forEach((p) => {
          const key = p.year || LABELS.patentYear;
          if (!groups.has(key)) groups.set(key, []);
          groups.get(key).push(p);
        });
        wrap.innerHTML = [...groups]
          .map(
            ([year, list]) => `
            <section class="pub-year-group" aria-label="${escapeHtml(String(year))}">
              <h3 class="pub-year">${escapeHtml(String(year))}</h3>
              <ol class="pub-list">${list.map(pubItem).join('')}</ol>
            </section>`
          )
          .join('');
        moreBtn.hidden = filtered.length <= limit;
      };

      el.innerHTML = '';
      if (el.dataset.filter === 'true') {
        const types = [...new Set(pubs.map((p) => p.type))];
        el.appendChild(buildFilters(types, LABELS.pubTypes, (tp) => { type = tp; expanded = false; moreBtn.setAttribute('aria-expanded', 'false'); moreBtn.textContent = LABELS.more; draw(); }, t('論文類型', 'Publication type')));
      }
      el.appendChild(wrap);
      const moreBtn = buildMoreButton((exp) => { expanded = exp; draw(); });
      el.appendChild(moreBtn);
      draw();
    } catch (err) {
      console.error(err);
      showError(el);
    }
  };

  /* ---------- 統計數字 ---------- */
  const setStat = (key, value) => {
    document.querySelectorAll(`[data-stat="${key}"]`).forEach((el) => {
      if (reduceMotion) {
        el.textContent = value;
        return;
      }
      const start = performance.now();
      const dur = 900;
      const step = (now) => {
        const p = Math.min(1, (now - start) / dur);
        el.textContent = Math.round(value * (1 - Math.pow(1 - p, 3)));
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  };

  /* ---------- PI 履歷 ---------- */
  const renderPi = async (els) => {
    try {
      const pi = await getData('pi');
      els.forEach((el) => {
        const key = el.dataset.key;
        const range = yearRange(el);
        let data = pi[key];
        if (Array.isArray(data) && (el.dataset.from || el.dataset.to)) {
          data = data.filter((d) => inRange(d.period ?? d.year ?? '', range));
        }
        if (typeof data === 'string') {
          el.innerHTML = format(data);
        } else if (key === 'specialties' || key === 'skills') {
          el.innerHTML = data.map((s) => `<li class="tag">${format(s)}</li>`).join('');
        } else if (key === 'awards') {
          el.innerHTML = data
            .map((a) => `
              <li class="cv-item">
                <span class="cv-period">${escapeHtml(a.year)}</span>
                <div class="cv-text"><strong>${format(a.title)}</strong><span class="cv-sub">${format(a.work)}</span></div>
              </li>`)
            .join('');
        } else if (Array.isArray(data)) {
          el.innerHTML = data
            .map((d) => {
              // 計畫角色（主持人、大專生指導教授等）接在計畫編號後面
              const role = isEn ? d.role_en : d.role_zh;
              const sub = [d.id, role].filter(Boolean).map(escapeHtml).join(t('・', ' · '));
              return `
              <li class="cv-item">
                <span class="cv-period">${format(d.period)}</span>
                <div class="cv-text">${format(d.text)}${sub ? `<span class="cv-sub">${sub}</span>` : ''}</div>
              </li>`;
            })
            .join('');
        }
      });
      setStat('projects', pi.projects.length);
      setStat('awards', pi.awards.length);
    } catch (err) {
      console.error(err);
      els.forEach(showError);
    }
  };

  /* ---------- 心電圖動畫（canvas[data-ecg]） ---------- */
  const initEcg = () => {
    document.querySelectorAll('canvas[data-ecg]').forEach((canvas) => {
      const ctx = canvas.getContext('2d');
      let w = 0;
      let h = 0;
      let x = 0;
      let lastY = null;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const color = () => getComputedStyle(canvas).getPropertyValue('--ecg-color').trim() || '#22d3ee';
      const bg = () => getComputedStyle(canvas).getPropertyValue('--ecg-fade').trim() || 'rgba(0,0,0,0.06)';

      const resize = () => {
        const rect = canvas.getBoundingClientRect();
        w = rect.width;
        h = rect.height;
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        x = 0;
        lastY = null;
      };

      // 一個心跳週期的形狀（P 波、QRS、T 波）
      const beat = (phase) => {
        const g = (c, wd, a) => a * Math.exp(-Math.pow((phase - c) / wd, 2));
        return g(0.18, 0.035, 0.12) - g(0.36, 0.012, 0.15) + g(0.4, 0.012, 1) - g(0.44, 0.014, 0.3) + g(0.66, 0.06, 0.25);
      };
      const yAt = (px) => {
        const period = 260;
        const phase = (px % period) / period;
        return h * 0.58 - beat(phase) * h * 0.38;
      };

      const drawStatic = () => {
        ctx.clearRect(0, 0, w, h);
        ctx.strokeStyle = color();
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let px = 0; px <= w; px += 2) {
          const y = yAt(px);
          if (px === 0) ctx.moveTo(px, y);
          else ctx.lineTo(px, y);
        }
        ctx.stroke();
      };

      resize();
      window.addEventListener('resize', () => {
        resize();
        if (reduceMotion) drawStatic();
      });

      if (reduceMotion) {
        drawStatic();
        return;
      }

      const speed = 3;
      const tick = () => {
        // 擦除游標前方一小段，製造監視器掃描效果
        ctx.clearRect(x, 0, 24, h);
        ctx.fillStyle = bg();
        ctx.strokeStyle = color();
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.shadowColor = color();
        ctx.shadowBlur = 8;
        for (let i = 0; i < speed; i++) {
          const y = yAt(x);
          if (lastY !== null) {
            ctx.beginPath();
            ctx.moveTo(x - 1, lastY);
            ctx.lineTo(x, y);
            ctx.stroke();
          }
          lastY = y;
          x += 1;
          if (x > w) {
            x = 0;
            lastY = null;
          }
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  };

  /* ---------- 啟動 ---------- */
  document.addEventListener('DOMContentLoaded', () => {
    initNav();
    initReveal();
    initEcg();
    document.querySelectorAll('[data-render="members"]').forEach(renderMembers);
    document.querySelectorAll('[data-render="news"]').forEach(renderNews);
    document.querySelectorAll('[data-render="publications"]').forEach(renderPublications);
    const piEls = [...document.querySelectorAll('[data-render="pi"]')];
    if (piEls.length) renderPi(piEls);
    document.querySelectorAll('[data-year]').forEach((el) => (el.textContent = new Date().getFullYear()));
  });
})();

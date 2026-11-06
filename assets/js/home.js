/* 主页「每周最新文献」展板：读取 window.__WEEKLY_PAPERS__ 或 /api/papers-weekly 并渲染 */
(function () {
  'use strict';

  var grid = document.getElementById('homePapersGrid');
  if (!grid) return;
  var metaEl = document.getElementById('homePapersMeta');
  var root = document.body.dataset.root || '';

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function authorsLabel(authors) {
    if (!authors || !authors.length) return '';
    var names = authors.slice(0, 3);
    return names.join(', ') + (authors.length > 3 ? ' 等' : '');
  }

  function card(paper) {
    var url = paper.url || '';
    var title = url
      ? '<a href="' + escapeHtml(url) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(paper.title) + '</a>'
      : escapeHtml(paper.title);
    var keywords = (paper.keywords || [])
      .filter(function (kw) { return kw !== '其他相关'; })
      .slice(0, 3)
      .map(function (kw) {
        return '<span class="paper-keyword">' + escapeHtml(kw) + '</span>';
      }).join('');
    var author = authorsLabel(paper.authors);
    var summary = (paper.summary || '').trim();
    return (
      '<article class="home-paper-card">' +
      '  <div class="home-paper-top">' +
      '    <span class="paper-venue">' + escapeHtml(paper.venue || paper.source || '') + '</span>' +
      '    <span class="paper-year">' + escapeHtml(paper.year || '') + '</span>' +
      '  </div>' +
      '  <h3 class="home-paper-title">' + title + '</h3>' +
      (author ? '  <div class="paper-authors">' + escapeHtml(author) + '</div>' : '') +
      (keywords ? '  <div class="paper-keywords">' + keywords + '</div>' : '') +
      (summary ? '  <p class="home-paper-summary">' + escapeHtml(summary) + '</p>' : '') +
      '</article>'
    );
  }

  /* 按来源轮询选取，保证展板覆盖多个期刊/会议而非全是同一来源 */
  function pickDiverse(papers, count) {
    var ranked = papers.filter(function (paper) {
      return (paper.keywords || []).some(function (kw) { return kw !== '其他相关'; });
    });
    if (ranked.length < count) ranked = papers;
    var byVenue = {};
    var venues = [];
    ranked.forEach(function (paper) {
      var v = paper.venue || paper.source || '其他';
      if (!byVenue[v]) { byVenue[v] = []; venues.push(v); }
      byVenue[v].push(paper);
    });
    venues.forEach(function (v) {
      byVenue[v].sort(function (a, b) {
        return String(b.date || '').localeCompare(String(a.date || ''));
      });
    });
    var out = [];
    for (var round = 0; out.length < count && round < 10; round++) {
      for (var i = 0; i < venues.length && out.length < count; i++) {
        if (byVenue[venues[i]][round]) out.push(byVenue[venues[i]][round]);
      }
    }
    return out;
  }

  function renderEmpty() {
    grid.innerHTML =
      '<div class="home-papers-empty">' +
      '  <p>每周文献任务尚未运行。前往「阅读文献」手动触发一次，或等待每周一自动检索。</p>' +
      '  <a class="btn btn-primary" href="' + root + 'library/index.html">前往阅读文献 <span aria-hidden="true">→</span></a>' +
      '</div>';
    if (metaEl) metaEl.textContent = '';
  }

  function render(papers, meta) {
    if (!papers || !papers.length) { renderEmpty(); return; }
    grid.innerHTML = pickDiverse(papers, 6).map(card).join('');
    if (metaEl) {
      var parts = ['本周共 ' + papers.length + ' 篇'];
      if (meta && meta.last_auto_at) parts.push('上次检索 ' + meta.last_auto_at.slice(0, 10));
      metaEl.textContent = parts.join(' · ');
    }
  }

  var stored = window.__WEEKLY_PAPERS__ || [];
  var storedMeta = window.__WEEKLY_META__ || {};
  var isHttp = location.protocol === 'http:' || location.protocol === 'https:';

  if (isHttp) {
    Promise.all([
      fetch('/api/papers-weekly', { cache: 'no-store' }).then(function (r) { return r.json(); }).catch(function () { return stored; }),
      fetch('/api/papers-weekly-meta', { cache: 'no-store' }).then(function (r) { return r.json(); }).catch(function () { return storedMeta; })
    ]).then(function (res) {
      render(res[0] && res[0].length ? res[0] : stored, res[1] || storedMeta);
    }).catch(function () {
      render(stored, storedMeta);
    });
  } else {
    render(stored, storedMeta);
  }
})();
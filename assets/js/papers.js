/* 年度文献检索全部结果页：按关键词查看某分类下的所有论文 */
(function () {
  'use strict';

  var list = document.getElementById('papersList');
  if (!list) return;
  var title = document.getElementById('papersTitle');
  var meta = document.getElementById('papersMeta');
  var filter = document.getElementById('papersFilter');
  var count = document.getElementById('papersCount');

  var papers = window.__PAPERS__ || [];

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function qs(name) {
    var match = location.search.match(new RegExp('[?&]' + name + '=([^&]*)'));
    return match ? decodeURIComponent(match[1].replace(/\+/g, ' ')) : '';
  }

  function authorsLabel(authors) {
    if (!authors || !authors.length) return '';
    var names = authors.slice(0, 4);
    return names.join(', ') + (authors.length > 4 ? ' 等' : '');
  }

  function paperCard(paper) {
    var url = paper.url || '';
    var titleHtml = url
      ? '<a class="paper-link" href="' + escapeHtml(url) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(paper.title) + '</a>'
      : '<span class="paper-link">' + escapeHtml(paper.title) + '</span>';
    var author = authorsLabel(paper.authors);
    var summary = (paper.summary || '').trim();
    var abstract = (paper.abstract || '').trim();
    var abstractBlock = (abstract && abstract.length > summary.length)
      ? '<details class="paper-abstract"><summary>完整摘要</summary><p>' + escapeHtml(abstract) + '</p></details>'
      : '';
    var keywords = (paper.keywords || [])
      .filter(function (kw) { return kw !== '其他相关'; })
      .map(function (kw) { return '<span class="paper-keyword">' + escapeHtml(kw) + '</span>'; })
      .join('');
    return (
      '<article class="paper-card">' +
      '  <div class="paper-head">' +
      '    <span class="paper-venue">' + escapeHtml(paper.venue || paper.source) + '</span>' +
      '    <span class="paper-year">' + escapeHtml(paper.year || '') + '</span>' +
      '  </div>' +
      '  <h4 class="paper-title">' + titleHtml + '</h4>' +
      (author ? '  <div class="paper-authors">' + escapeHtml(author) + '</div>' : '') +
      (keywords ? '  <div class="paper-keywords">' + keywords + '</div>' : '') +
      (summary ? '  <p class="paper-summary">' + escapeHtml(summary) + '</p>' : '') +
      abstractBlock +
      '</article>'
    );
  }

  function allKeywords() {
    var seen = {};
    var out = [];
    papers.forEach(function (paper) {
      (paper.keywords || []).forEach(function (kw) {
        if (kw !== '其他相关' && !seen[kw]) { seen[kw] = true; out.push(kw); }
      });
    });
    return out.sort();
  }

  function renderFilter(current) {
    if (!filter) return;
    var keywords = allKeywords();
    filter.innerHTML = '<option value="">全部关键词</option>' +
      keywords.map(function (kw) {
        return '<option value="' + escapeHtml(kw) + '"' + (kw === current ? ' selected' : '') + '>' + escapeHtml(kw) + '</option>';
      }).join('');
  }

  function render(kw) {
    kw = kw || '';
    var shown = papers;
    if (kw) {
      shown = papers.filter(function (paper) {
        return (paper.keywords || []).indexOf(kw) !== -1;
      });
    }
    shown = shown.slice().sort(function (a, b) {
      return String(b.date || '').localeCompare(String(a.date || ''));
    });

    if (title) title.textContent = kw || '全部文献';
    if (meta) meta.textContent = '年度检索 · 命中 ' + shown.length + ' 篇';
    if (count) count.textContent = shown.length + ' 篇';
    renderFilter(kw);

    if (!shown.length) {
      list.innerHTML = '<div class="search-empty">该关键词下暂无文献。</div>';
      return;
    }
    list.innerHTML = shown.map(paperCard).join('');
  }

  var initial = qs('kw') || '';
  render(initial);

  if (filter) {
    filter.addEventListener('change', function () {
      var value = filter.value;
      var url = 'papers.html' + (value ? '?kw=' + encodeURIComponent(value) : '');
      history.replaceState(null, '', url);
      render(value);
    });
  }

  // http 模式下优先取服务端实时数据
  var isHttp = location.protocol === 'http:' || location.protocol === 'https:';
  if (isHttp) {
    fetch('/api/papers', { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data && data.length) { papers = data; render(initial); }
      })
      .catch(function () {});
  }
})();
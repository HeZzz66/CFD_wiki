/* CFD Wiki 前端交互：主题、侧边栏、搜索、目录高亮、代码复制 */
(function () {
  'use strict';

  var root = document.body.dataset.root || '';
  var docEl = document.documentElement;
  var THEME_KEY = 'cfdwiki-theme';

  /* ---------------- 主题 ---------------- */
  var themeToggle = document.getElementById('themeToggle');
  var metaTheme = document.querySelector('meta[name="theme-color"]');

  function applyTheme(theme, persist) {
    docEl.dataset.theme = theme;
    if (metaTheme) {
      metaTheme.setAttribute('content', theme === 'dark' ? '#0b111b' : '#0b66d6');
    }
    if (themeToggle) {
      themeToggle.setAttribute('aria-label', theme === 'dark' ? '切换到浅色主题' : '切换到深色主题');
    }
    if (persist) {
      try { localStorage.setItem(THEME_KEY, theme); } catch (e) {}
    }
  }

  applyTheme(docEl.dataset.theme || 'light', false);

  if (themeToggle) {
    themeToggle.addEventListener('click', function () {
      applyTheme(docEl.dataset.theme === 'dark' ? 'light' : 'dark', true);
    });
  }

  /* ---------------- 移动端侧边栏 ---------------- */
  var sidebar = document.getElementById('sidebar');
  var menuToggle = document.getElementById('menuToggle');
  var drawerOverlay = document.getElementById('drawerOverlay');

  function setDrawer(open) {
    if (!sidebar || !drawerOverlay || !menuToggle) return;
    sidebar.classList.toggle('is-open', open);
    drawerOverlay.hidden = !open;
    menuToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    document.body.classList.toggle('no-scroll', open);
  }

  if (menuToggle) {
    menuToggle.addEventListener('click', function () {
      setDrawer(!sidebar.classList.contains('is-open'));
    });
  }
  if (drawerOverlay) {
    drawerOverlay.addEventListener('click', function () { setDrawer(false); });
  }
  if (sidebar) {
    sidebar.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () { setDrawer(false); });
    });
  }

  /* ---------------- 搜索 ---------------- */
  var modal = document.getElementById('searchModal');
  var trigger = document.getElementById('searchTrigger');
  var input = document.getElementById('searchInput');
  var resultsBox = document.getElementById('searchResults');
  var countBox = document.getElementById('searchCount');
  var entries = null;
  var loading = false;
  var activeIndex = -1;
  var currentResults = [];

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function loadIndex() {
    if (entries || loading) return;
    if (window.__CFD_SEARCH_INDEX) {
      entries = window.__CFD_SEARCH_INDEX;
      if (input.value.trim()) runSearch(input.value);
      return;
    }
    loading = true;
    fetch(root + 'search-index.json')
      .then(function (response) {
        if (!response.ok) throw new Error('index not found');
        return response.json();
      })
      .then(function (data) {
        entries = data;
        loading = false;
        if (input.value.trim()) runSearch(input.value);
      })
      .catch(function () {
        loading = false;
        if (resultsBox) {
          resultsBox.innerHTML = '<div class="search-empty">搜索索引加载失败。<br>请通过 <code>python build.py --serve</code> 启动本地服务后再搜索。</div>';
        }
      });
  }

  function openSearch() {
    if (!modal) return;
    modal.hidden = false;
    document.body.classList.add('no-scroll');
    if (input) {
      input.value = '';
      input.focus();
    }
    activeIndex = -1;
    currentResults = [];
    if (resultsBox) {
      resultsBox.innerHTML = '<div class="search-empty">输入关键词开始搜索，例如“SIMPLE”“k-ω SST”“FNO”。</div>';
    }
    if (countBox) countBox.textContent = '';
    loadIndex();
  }

  function closeSearch() {
    if (!modal) return;
    modal.hidden = true;
    document.body.classList.remove('no-scroll');
    setDrawer(false);
  }

  function highlight(text, tokens) {
    var safe = escapeHtml(text);
    if (!tokens.length) return safe;
    var pattern = new RegExp('(' + tokens.map(escapeRegExp).join('|') + ')', 'gi');
    return safe.replace(pattern, '<mark>$1</mark>');
  }

  function makeSnippet(text, tokens) {
    var lower = text.toLowerCase();
    var position = -1;
    for (var i = 0; i < tokens.length; i++) {
      var found = lower.indexOf(tokens[i]);
      if (found !== -1 && (position === -1 || found < position)) position = found;
    }
    if (position === -1) return text.slice(0, 150);
    var start = Math.max(0, position - 50);
    var end = Math.min(text.length, position + 130);
    return (start > 0 ? '…' : '') + text.slice(start, end) + (end < text.length ? '…' : '');
  }

  function runSearch(rawQuery) {
    if (!entries) return;
    var query = rawQuery.trim().toLowerCase();
    var tokens = query.split(/\s+/).filter(Boolean);
    if (!tokens.length) {
      currentResults = [];
      resultsBox.innerHTML = '<div class="search-empty">输入关键词开始搜索，例如“SIMPLE”“k-ω SST”“FNO”。</div>';
      countBox.textContent = '';
      return;
    }

    var scored = [];
    entries.forEach(function (entry) {
      var title = (entry.t || '').toLowerCase();
      var chapter = (entry.c || '').toLowerCase();
      var summary = (entry.s || '').toLowerCase();
      var tags = (entry.g || []).join(' ').toLowerCase();
      var text = (entry.x || '').toLowerCase();
      var score = 0;
      var matchedAll = true;

      tokens.forEach(function (token) {
        var tokenScore = 0;
        if (title.indexOf(token) !== -1) tokenScore += 120;
        if (tags.indexOf(token) !== -1) tokenScore += 60;
        if (summary.indexOf(token) !== -1) tokenScore += 40;
        if (chapter.indexOf(token) !== -1) tokenScore += 26;
        var count = 0;
        var position = text.indexOf(token);
        while (position !== -1 && count < 12) {
          count += 1;
          position = text.indexOf(token, position + token.length);
        }
        if (count) tokenScore += 10 + Math.min(count, 8) * 2;
        if (tokenScore === 0) matchedAll = false;
        score += tokenScore;
      });

      if (matchedAll) scored.push({ entry: entry, score: score });
    });

    scored.sort(function (a, b) { return b.score - a.score; });
    currentResults = scored.slice(0, 12);
    activeIndex = currentResults.length ? 0 : -1;

    if (!currentResults.length) {
      resultsBox.innerHTML = '<div class="search-empty">没有找到与 “' + escapeHtml(rawQuery) + '” 相关的内容。<br>试试更短的术语，或直接浏览左侧章节。</div>';
      countBox.textContent = '0 条结果';
      return;
    }

    resultsBox.innerHTML = currentResults.map(function (item, index) {
      var entry = item.entry;
      var snippet = makeSnippet((entry.x || '').toString(), tokens);
      var chapterBadge = entry.n
        ? '<span class="search-result-chapter">第 ' + escapeHtml(entry.n) + ' 章</span>'
        : '<span class="search-result-chapter">首页</span>';
      return '<a class="search-result' + (index === 0 ? ' is-active' : '') + '" href="' + root + entry.u + '" data-index="' + index + '">' +
        '<div class="search-result-top">' +
        '<span class="search-result-title">' + highlight(entry.t || '', tokens) + '</span>' +
        chapterBadge +
        '</div>' +
        '<div class="search-result-snippet">' + highlight(snippet, tokens) + '</div>' +
        '</a>';
    }).join('');

    countBox.textContent = currentResults.length + ' 条结果';
    resultsBox.querySelectorAll('.search-result').forEach(function (node) {
      node.addEventListener('mouseenter', function () {
        setActive(parseInt(node.dataset.index, 10));
      });
    });
  }

  function setActive(index) {
    if (!resultsBox) return;
    var nodes = resultsBox.querySelectorAll('.search-result');
    if (!nodes.length) return;
    if (index < 0) index = nodes.length - 1;
    if (index >= nodes.length) index = 0;
    activeIndex = index;
    nodes.forEach(function (node, i) {
      node.classList.toggle('is-active', i === index);
    });
    nodes[index].scrollIntoView({ block: 'nearest' });
  }

  if (trigger) trigger.addEventListener('click', openSearch);

  if (modal) {
    modal.addEventListener('click', function (event) {
      if (event.target === modal) closeSearch();
    });
  }

  document.addEventListener('keydown', function (event) {
    var key = event.key;
    if ((event.ctrlKey || event.metaKey) && key.toLowerCase() === 'k') {
      event.preventDefault();
      if (modal && modal.hidden) openSearch();
      else closeSearch();
      return;
    }
    if (!modal || modal.hidden) return;

    if (key === 'Escape') {
      closeSearch();
    } else if (key === 'ArrowDown') {
      event.preventDefault();
      setActive(activeIndex + 1);
    } else if (key === 'ArrowUp') {
      event.preventDefault();
      setActive(activeIndex - 1);
    } else if (key === 'Enter') {
      var links = resultsBox.querySelectorAll('.search-result');
      if (links.length) {
        event.preventDefault();
        var target = links[Math.max(activeIndex, 0)];
        if (target) window.location.href = target.getAttribute('href');
      }
    }
  });

  if (input) {
    var searchTimer = null;
    input.addEventListener('input', function () {
      window.clearTimeout(searchTimer);
      searchTimer = window.setTimeout(function () { runSearch(input.value); }, 110);
    });
  }

  /* ---------------- 目录高亮 ---------------- */
  var tocLinks = document.querySelectorAll('.toc-body a');
  if (tocLinks.length) {
    var headings = [];
    tocLinks.forEach(function (link) {
      var id = link.getAttribute('href').replace('#', '');
      var heading = document.getElementById(id);
      if (heading) headings.push({ id: id, heading: heading, link: link });
    });

    function setTocActive(id) {
      tocLinks.forEach(function (link) {
        link.classList.toggle('is-active', link.getAttribute('href') === '#' + id);
      });
    }

    if ('IntersectionObserver' in window) {
      var observer = new IntersectionObserver(function (entries) {
        var visible = entries.filter(function (item) { return item.isIntersecting; });
        if (!visible.length) return;
        visible.sort(function (a, b) { return a.boundingClientRect.top - b.boundingClientRect.top; });
        setTocActive(visible[0].target.id);
      }, { rootMargin: '-90px 0px -68% 0px', threshold: 0 });

      headings.forEach(function (item) { observer.observe(item.heading); });
    }
  }

  /* ---------------- 代码复制 ---------------- */
  document.querySelectorAll('.codehilite').forEach(function (block) {
    var pre = block.querySelector('pre');
    if (!pre) return;
    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'copy-code';
    button.textContent = '复制';
    button.addEventListener('click', function () {
      var text = pre.innerText;
      var done = function () {
        button.textContent = '已复制';
        button.classList.add('is-copied');
        window.setTimeout(function () {
          button.textContent = '复制';
          button.classList.remove('is-copied');
        }, 1400);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done).catch(function () {});
      } else {
        var range = document.createRange();
        range.selectNodeContents(pre);
        var selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        try { document.execCommand('copy'); done(); } catch (e) {}
        selection.removeAllRanges();
      }
    });
    block.appendChild(button);
  });

  /* ---------------- 阅读进度 / 回到顶部 ---------------- */
  var progress = document.getElementById('readingProgress');
  var backTop = document.getElementById('backToTop');

  function onScroll() {
    var scrollTop = window.pageYOffset || docEl.scrollTop;
    var height = docEl.scrollHeight - window.innerHeight;
    if (progress) {
      progress.style.width = (height > 0 ? (scrollTop / height) * 100 : 0) + '%';
    }
    if (backTop) {
      backTop.classList.toggle('is-visible', scrollTop > 420);
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  if (backTop) {
    backTop.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }
  /* ---------------- 侧边栏模块折叠 ---------------- */
  var NAV_KEY = 'cfdwiki:nav-collapsed';
  var collapsedModules = [];
  try {
    collapsedModules = JSON.parse(localStorage.getItem(NAV_KEY) || '[]') || [];
  } catch (e) {}

  document.querySelectorAll('.nav-module').forEach(function (module) {
    var key = module.getAttribute('data-module');
    var head = module.querySelector('[data-module-toggle]');
    if (!head) return;
    var isCollapsed = collapsedModules.indexOf(key) >= 0;
    module.classList.toggle('is-collapsed', isCollapsed);
    head.setAttribute('aria-expanded', isCollapsed ? 'false' : 'true');
    head.addEventListener('click', function () {
      var next = !module.classList.contains('is-collapsed');
      module.classList.toggle('is-collapsed', next);
      head.setAttribute('aria-expanded', next ? 'false' : 'true');
      var index = collapsedModules.indexOf(key);
      if (next && index < 0) collapsedModules.push(key);
      if (!next && index >= 0) collapsedModules.splice(index, 1);
      try { localStorage.setItem(NAV_KEY, JSON.stringify(collapsedModules)); } catch (e) {}
    });
  });
})();

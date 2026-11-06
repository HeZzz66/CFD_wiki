/* 论文与书籍：上传、本地存储、馆藏列表 */
(function () {
  'use strict';

  var grid = document.getElementById('libraryGrid');
  var hasShelf = !!grid;
  var collection = hasShelf ? (grid.getAttribute('data-collection') || '') : '';
  var viewerBase = hasShelf
    ? (grid.getAttribute('data-viewer') || 'viewer.html')
    : 'viewer.html';

  var drop = document.getElementById('uploadDrop');
  var input = document.getElementById('uploadInput');
  var pick = document.getElementById('uploadPick');
  var metaBox = document.getElementById('uploadMeta');
  var titleInput = document.getElementById('uploadTitle');
  var authorsInput = document.getElementById('uploadAuthors');
  var yearInput = document.getElementById('uploadYear');
  var confirmBtn = document.getElementById('uploadConfirm');
  var cancelBtn = document.getElementById('uploadCancel');
  var statusEl = document.getElementById('uploadStatus');
  var emptyEl = document.getElementById('libraryEmpty');
  var countEl = document.getElementById('libraryCount');

  var ALLOWED = ['.pdf', '.docx', '.html', '.htm'];
  var LIMIT = 200 * 1024 * 1024;
  var serverMode = location.protocol === 'http:' || location.protocol === 'https:';
  var items = [];
  var pendingFiles = [];

  /* ---------- IndexedDB ---------- */
  function openDB() {
    return new Promise(function (resolve, reject) {
      var request = indexedDB.open('cfdwiki-library', 1);
      request.onupgradeneeded = function () {
        var db = request.result;
        if (!db.objectStoreNames.contains('files')) {
          db.createObjectStore('files', { keyPath: 'id' });
        }
      };
      request.onsuccess = function () { resolve(request.result); };
      request.onerror = function () { reject(request.error); };
    });
  }

  function localAll() {
    return openDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction('files', 'readonly');
        var req = tx.objectStore('files').getAll();
        req.onsuccess = function () {
          var rows = (req.result || []).map(function (row) { return Object.assign(row, { local: true }); });
          rows.sort(function (a, b) { return String(b.added).localeCompare(String(a.added)); });
          resolve(rows);
        };
        req.onerror = function () { reject(req.error); };
      });
    }).catch(function () { return []; });
  }

  function localPut(record) {
    return openDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction('files', 'readwrite');
        tx.objectStore('files').put(record);
        tx.oncomplete = function () { resolve(record); };
        tx.onerror = function () { reject(tx.error); };
      });
    });
  }

  /* ---------- 列表 ---------- */
  function sizeLabel(size) {
    if (size >= 1024 * 1024) return (size / 1024 / 1024).toFixed(1) + ' MB';
    return Math.max(1, Math.round(size / 1024)) + ' KB';
  }

  function localStamp() {
    var now = new Date();
    var pad = function (value) { return String(value).padStart(2, '0'); };
    return (
      now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate()) +
      'T' + pad(now.getHours()) + ':' + pad(now.getMinutes()) + ':' + pad(now.getSeconds())
    );
  }

  function render() {
    if (!grid) return;
    grid.innerHTML = '';
    items.forEach(function (item) {
      var link = document.createElement('a');
      link.className = 'library-card';
      link.href = viewerBase + '?' + (item.local ? 'local=' : 'id=') + encodeURIComponent(item.id);

      var badge = document.createElement('span');
      badge.className = 'lc-badge';
      badge.textContent = String(item.kind || '').toUpperCase();

      var body = document.createElement('span');
      body.className = 'lc-body';
      var title = document.createElement('span');
      title.className = 'lc-title';
      title.textContent = item.title || '未命名文献';
      var meta = document.createElement('span');
      meta.className = 'lc-meta';
      var parts = [];
      if (item.authors) parts.push(item.authors);
      if (item.year) parts.push(item.year);
      parts.push(sizeLabel(item.size || 0));
      if (item.local) parts.push('本机存储');
      meta.textContent = parts.join(' · ');
      body.appendChild(title);
      body.appendChild(meta);

      var arrow = document.createElement('span');
      arrow.className = 'lc-arrow';
      arrow.setAttribute('aria-hidden', 'true');
      arrow.textContent = '→';

      link.appendChild(badge);
      link.appendChild(body);
      link.appendChild(arrow);
      grid.appendChild(link);
    });
    if (emptyEl) emptyEl.hidden = items.length > 0;
    if (countEl) countEl.textContent = items.length + (collection === 'book' ? ' 本' : ' 份文献');
  }

  function load() {
    var serverItems = Promise.resolve([]);
    if (serverMode) {
      serverItems = fetch('/api/library', { cache: 'no-store' })
        .then(function (response) {
          if (!response.ok) throw new Error('no api');
          return response.json();
        })
        .catch(function () { return []; });
    }
    return Promise.all([serverItems, localAll()]).then(function (result) {
      var remote = result[0] || [];
      if (!remote.length && Array.isArray(window.__LIBRARY__)) remote = window.__LIBRARY__;
      items = remote.concat(result[1]);
      if (collection) {
        items = items.filter(function (item) {
          return (item.collection || 'book') === collection;
        });
      }
      items.sort(function (a, b) { return String(b.added).localeCompare(String(a.added)); });
      render();
    });
  }

  /* ---------- 上传 ---------- */
  function setStatus(text, tone) {
    if (!statusEl) return;
    statusEl.textContent = text;
    statusEl.dataset.tone = tone || '';
  }

  function extOf(name) {
    var index = name.lastIndexOf('.');
    return index >= 0 ? name.slice(index).toLowerCase() : '';
  }

  function validate(files) {
    var out = [];
    for (var i = 0; i < files.length; i += 1) {
      var file = files[i];
      if (ALLOWED.indexOf(extOf(file.name)) === -1) {
        setStatus('已跳过「' + file.name + '」：仅支持 PDF / DOCX / HTML', 'err');
        continue;
      }
      if (file.size > LIMIT) {
        setStatus('已跳过「' + file.name + '」：超过 200 MB', 'err');
        continue;
      }
      out.push(file);
    }
    return out;
  }

  function uploadServer(file, meta) {
    return new Promise(function (resolve, reject) {
      var xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/upload');
      xhr.setRequestHeader('Content-Type', 'application/octet-stream');
      xhr.setRequestHeader('X-Filename', encodeURIComponent(file.name));
      xhr.setRequestHeader('X-Title', encodeURIComponent(meta.title || ''));
      xhr.setRequestHeader('X-Authors', encodeURIComponent(meta.authors || ''));
      xhr.setRequestHeader('X-Year', encodeURIComponent(meta.year || ''));
      xhr.setRequestHeader('X-Collection', encodeURIComponent(collection || 'reading'));
      xhr.onload = function () {
        if (xhr.status >= 200 && xhr.status < 300) {
          try { resolve(JSON.parse(xhr.responseText)); }
          catch (e) { reject(new Error('返回数据异常')); }
        } else {
          var message = '上传失败';
          try { message = JSON.parse(xhr.responseText).error || message; } catch (e) {}
          reject(new Error(message));
        }
      };
      xhr.onerror = function () { reject(new Error('无法连接本地服务')); };
      xhr.send(file);
    });
  }

  function uploadLocal(file, meta) {
    var id = 'local-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
    var record = {
      id: id,
      title: meta.title || file.name.replace(/\.[^.]+$/, ''),
      authors: meta.authors || '',
      year: meta.year || '',
      kind: extOf(file.name).replace('.', ''),
      collection: collection || 'reading',
      size: file.size,
      added: localStamp(),
      blob: file
    };
    return localPut(record).then(function () {
      return Object.assign(record, { local: true });
    });
  }

  function uploadFiles(files, meta) {
    if (!files.length) return;
    var queue = files.slice();
    var total = queue.length;
    var done = 0;

    function next() {
      if (!queue.length) {
        setStatus('已完成 ' + total + ' 个文件', 'ok');
        hideMeta();
        pendingFiles = [];
        load();
        return;
      }
      var file = queue.shift();
      var info = meta || {};
      if (!info.title && total > 1) {
        info = { title: file.name.replace(/\.[^.]+$/, ''), authors: '', year: '' };
      }
      setStatus('正在上传 ' + (done + 1) + '/' + total + '：' + file.name, '');
      var task = serverMode ? uploadServer(file, info) : Promise.reject(new Error('local'));
      task.catch(function () { return uploadLocal(file, info); })
        .then(function (entry) {
          done += 1;
          items.unshift(entry.local ? entry : Object.assign({}, entry));
          render();
          next();
        })
        .catch(function (error) {
          setStatus('「' + file.name + '」上传失败：' + error.message, 'err');
          next();
        });
    }
    next();
  }

  /* ---------- 交互 ---------- */
  function showMeta(file) {
    pendingFiles = [file];
    if (metaBox) metaBox.hidden = false;
    if (titleInput) titleInput.value = file.name.replace(/\.[^.]+$/, '');
    if (authorsInput) authorsInput.value = '';
    if (yearInput) yearInput.value = '';
    setStatus('已选择：' + file.name, '');
    if (titleInput) titleInput.focus();
  }

  function hideMeta() {
    if (metaBox) metaBox.hidden = true;
  }

  function handleFiles(fileList) {
    var files = validate(Array.prototype.slice.call(fileList));
    if (!files.length) return;
    if (files.length === 1) {
      showMeta(files[0]);
    } else {
      pendingFiles = [];
      hideMeta();
      setStatus('正在上传 ' + files.length + ' 个文件…', '');
      uploadFiles(files, null);
    }
    if (input) input.value = '';
  }

  if (pick) pick.addEventListener('click', function () { if (input) input.click(); });
  if (input) input.addEventListener('change', function () { handleFiles(input.files); });

  if (drop) {
    ['dragenter', 'dragover'].forEach(function (type) {
      drop.addEventListener(type, function (event) {
        event.preventDefault();
        drop.classList.add('is-dragging');
      });
    });
    ['dragleave', 'drop'].forEach(function (type) {
      drop.addEventListener(type, function (event) {
        event.preventDefault();
        drop.classList.remove('is-dragging');
      });
    });
    drop.addEventListener('drop', function (event) {
      if (event.dataTransfer && event.dataTransfer.files) handleFiles(event.dataTransfer.files);
    });
  }

  if (confirmBtn) {
    confirmBtn.addEventListener('click', function () {
      if (!pendingFiles.length) return;
      var meta = {
        title: (titleInput && titleInput.value.trim()) || '',
        authors: (authorsInput && authorsInput.value.trim()) || '',
        year: (yearInput && yearInput.value.trim()) || ''
      };
      var files = pendingFiles.slice();
      hideMeta();
      uploadFiles(files, meta);
    });
  }

  if (cancelBtn) {
    cancelBtn.addEventListener('click', function () {
      pendingFiles = [];
      hideMeta();
      setStatus('已取消', '');
    });
  }

  if (hasShelf) load();

  /* ============ 文献检索（AI for Science / 神经算子）============ */
  var searchPanel = document.getElementById('librarySearch');
  if (searchPanel) {
    var kwBox = document.getElementById('searchKeywords');
    var kwInput = document.getElementById('searchKeywordInput');
    var kwAdd = document.getElementById('searchKeywordAdd');
    var runBtn = document.getElementById('searchRun');
    var searchStatus = document.getElementById('searchStatus');
    var searchMeta = document.getElementById('searchMeta');
    var resultsBox = document.getElementById('searchResults');

    var keywords = [];
    var papers = [];
    var running = false;

    function escapeHtml(value) {
      return String(value == null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    function setSearchStatus(text, tone) {
      if (!searchStatus) return;
      searchStatus.textContent = text;
      searchStatus.dataset.tone = tone || '';
    }

    function renderKeywords() {
      if (!kwBox) return;
      kwBox.innerHTML = '';
      keywords.forEach(function (kw, index) {
        var chip = document.createElement('span');
        chip.className = 'search-chip';
        var label = document.createElement('span');
        label.className = 'search-chip-label';
        label.textContent = kw;
        var del = document.createElement('button');
        del.className = 'search-chip-del';
        del.type = 'button';
        del.setAttribute('aria-label', '删除 ' + kw);
        del.textContent = '×';
        del.addEventListener('click', function () {
          keywords.splice(index, 1);
          renderKeywords();
        });
        chip.appendChild(label);
        chip.appendChild(del);
        kwBox.appendChild(chip);
      });
    }

    function addKeyword(word) {
      word = (word || '').trim();
      if (!word) return;
      if (keywords.indexOf(word) !== -1) return;
      keywords.push(word);
      renderKeywords();
    }

    function groupsOf(papersList) {
      var groups = {};
      var order = [];
      papersList.forEach(function (paper) {
        (paper.keywords || []).forEach(function (kw) {
          if (!groups[kw]) { groups[kw] = []; order.push(kw); }
          groups[kw].push(paper);
        });
      });
      return order.map(function (kw) { return { keyword: kw, papers: groups[kw] }; });
    }

    function authorsLabel(authors) {
      if (!authors || !authors.length) return '';
      var names = authors.slice(0, 3);
      var suffix = authors.length > 3 ? ' 等' : '';
      return names.join(', ') + suffix;
    }

    function paperCard(paper) {
      var url = paper.url || '';
      var titleHtml = url
        ? '<a class="paper-link" href="' + escapeHtml(url) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(paper.title) + '</a>'
        : '<span class="paper-link">' + escapeHtml(paper.title) + '</span>';
      var author = authorsLabel(paper.authors);
      var abstract = (paper.abstract || '').trim();
      var summary = (paper.summary || '').trim();
      var abstractBlock = '';
      if (abstract && abstract.length > summary.length) {
        abstractBlock =
          '<details class="paper-abstract"><summary>完整摘要</summary>' +
          '<p>' + escapeHtml(abstract) + '</p></details>';
      }
      return (
        '<article class="paper-card">' +
        '  <div class="paper-head">' +
        '    <span class="paper-venue">' + escapeHtml(paper.venue || paper.source) + '</span>' +
        '    <span class="paper-year">' + escapeHtml(paper.year || '') + '</span>' +
        '  </div>' +
        '  <h4 class="paper-title">' + titleHtml + '</h4>' +
        (author ? '  <div class="paper-authors">' + escapeHtml(author) + '</div>' : '') +
        (summary ? '  <p class="paper-summary">' + escapeHtml(summary) + '</p>' : '') +
        abstractBlock +
        '</article>'
      );
    }

    function renderResults(papersList) {
      if (!resultsBox) return;
      papers = papersList || [];
      if (!papers.length) {
        resultsBox.innerHTML = '<div class="search-empty">暂无检索结果。点击上方按钮执行一次检索，或先启动本地服务（<code>python build.py --serve</code>）。</div>';
        return;
      }
      var LIMIT = 6;
      var groups = groupsOf(papers).filter(function (group) {
        return group.keyword !== '其他相关';
      });
      resultsBox.innerHTML = groups.map(function (group) {
        var shown = group.papers.slice(0, LIMIT);
        var cards = shown.map(paperCard).join('');
        var rest = group.papers.length - LIMIT;
        var more = rest > 0
          ? '<a class="paper-more" href="papers.html?kw=' + encodeURIComponent(group.keyword) + '">查看全部 ' + group.papers.length + ' 篇 →</a>'
          : '';
        return (
          '<section class="paper-group">' +
          '  <h3 class="paper-group-title">' + escapeHtml(group.keyword) +
          '    <span class="paper-group-count">' + group.papers.length + ' 篇</span>' +
          '  </h3>' +
          '  <div class="paper-list">' + cards + '</div>' +
          more +
          '</section>'
        );
      }).join('');
    }

    function renderMeta(meta) {
      if (!searchMeta) return;
      var parts = [];
      parts.push('已收录 ' + (meta.total || papers.length) + ' 篇');
      if (meta.last_manual_at) parts.push('上次手动检索 ' + meta.last_manual_at.slice(0, 10));
      if (meta.last_auto_at) parts.push('上次自动更新 ' + meta.last_auto_at.slice(0, 10));
      searchMeta.textContent = parts.join(' · ');
    }

    function loadMetaAndPapers() {
      var meta = window.__PAPERS_META__ || {};
      keywords = (meta.keywords || []).slice();
      renderKeywords();
      var serverMeta = serverMode
        ? fetch('/api/papers-meta', { cache: 'no-store' }).then(function (r) { return r.json(); }).catch(function () { return null; })
        : Promise.resolve(meta);
      var serverPapers = serverMode
        ? fetch('/api/papers', { cache: 'no-store' }).then(function (r) { return r.json(); }).catch(function () { return window.__PAPERS__ || []; })
        : Promise.resolve(window.__PAPERS__ || []);
      serverPapers.then(function (list) { renderResults(list); });
      serverMeta.then(function (m) {
        if (m && m.keywords && m.keywords.length) { keywords = m.keywords; renderKeywords(); }
        renderMeta(m || meta);
      });
    }

    function runFetch() {
      if (running) return;
      if (!serverMode) {
        setSearchStatus('请先运行 python build.py --serve 启动本地服务后再检索', 'err');
        return;
      }
      running = true;
      if (runBtn) { runBtn.disabled = true; runBtn.textContent = '正在检索…'; }
      setSearchStatus('正在检索 arXiv / 期刊 / 会议…… 这一步需要几十秒，请稍候', '');
      if (resultsBox) resultsBox.innerHTML = '';

      fetch('/api/fetch-papers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keywords: keywords, days: 365 })
      })
        .then(function (response) {
          if (!response.ok) {
            return response.json().then(function (data) { throw new Error(data.error || '检索失败'); });
          }
          return response.json();
        })
        .then(function (result) {
          var errors = result.errors || [];
          var summaries = [];
          if (result.sources && result.sources.length) summaries.push('命中来源：' + result.sources.join('、'));
          if (errors.length) summaries.push('部分来源失败：' + errors.join('；'));
          renderResults(result.papers);
          renderMeta({ total: result.total, last_manual_at: result.ran_at, last_auto_at: (window.__PAPERS_META__ || {}).last_auto_at });
          setSearchStatus('检索完成，共 ' + result.total + ' 篇' + (summaries.length ? '（' + summaries.join('；') + '）' : ''), result.total ? 'ok' : '');
        })
        .catch(function (error) {
          setSearchStatus('检索失败：' + error.message, 'err');
        })
        .then(function () {
          running = false;
          if (runBtn) { runBtn.disabled = false; runBtn.textContent = '执行检索 · 近 1 年'; }
        });
    }

    if (kwAdd) kwAdd.addEventListener('click', function () { addKeyword(kwInput && kwInput.value); if (kwInput) kwInput.value = ''; });
    if (kwInput) {
      kwInput.addEventListener('keydown', function (event) {
        if (event.key === 'Enter') { event.preventDefault(); addKeyword(kwInput.value); kwInput.value = ''; }
      });
    }
    if (runBtn) runBtn.addEventListener('click', runFetch);

    loadMetaAndPapers();
  }

  /* ============ 每周文献任务（独立关键词 / 倒计时） ============ */
  var weeklyTask = document.getElementById('weeklyTask');
  if (weeklyTask) {
    var wKwBox = document.getElementById('weeklyKeywords');
    var wKwInput = document.getElementById('weeklyKeywordInput');
    var wKwAdd = document.getElementById('weeklyKeywordAdd');
    var wRun = document.getElementById('weeklyRun');
    var wStatus = document.getElementById('weeklyStatus');
    var wLastAt = document.getElementById('weeklyLastAt');
    var wCountdown = document.getElementById('weeklyCountdown');
    var wTotal = document.getElementById('weeklyTotal');

    var weeklyKeywords = [];
    var weeklyRunning = false;
    var weeklyTimer = null;

    function escapeHtmlW(value) {
      return String(value == null ? '' : value)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function setWStatus(text, tone) {
      if (!wStatus) return;
      wStatus.textContent = text;
      wStatus.dataset.tone = tone || '';
    }

    function renderWKeywords() {
      if (!wKwBox) return;
      wKwBox.innerHTML = '';
      weeklyKeywords.forEach(function (kw, index) {
        var chip = document.createElement('span');
        chip.className = 'search-chip';
        var label = document.createElement('span');
        label.className = 'search-chip-label';
        label.textContent = kw;
        var del = document.createElement('button');
        del.className = 'search-chip-del';
        del.type = 'button';
        del.setAttribute('aria-label', '删除 ' + kw);
        del.textContent = '×';
        del.addEventListener('click', function () {
          weeklyKeywords.splice(index, 1);
          renderWKeywords();
        });
        chip.appendChild(label);
        chip.appendChild(del);
        wKwBox.appendChild(chip);
      });
    }

    function addWKeyword(word) {
      word = (word || '').trim();
      if (!word) return;
      if (weeklyKeywords.indexOf(word) !== -1) return;
      weeklyKeywords.push(word);
      renderWKeywords();
    }

    function nextMonday9am() {
      var now = new Date();
      var d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0, 0, 0);
      var wd = d.getDay(); // 0=周日 1=周一
      var add = (8 - wd) % 7;
      if (add === 0 && now >= d) add = 7;
      d.setDate(d.getDate() + add);
      return d;
    }

    function pad2(n) { return String(n).padStart(2, '0'); }

    function renderCountdown() {
      if (!wCountdown) return;
      var now = new Date();
      var target = nextMonday9am();
      var diff = Math.max(0, target.getTime() - now.getTime());
      var days = Math.floor(diff / 86400000);
      var hours = Math.floor((diff % 86400000) / 3600000);
      var mins = Math.floor((diff % 3600000) / 60000);
      var secs = Math.floor((diff % 60000) / 1000);
      wCountdown.textContent = days + ' 天 ' + pad2(hours) + ':' + pad2(mins) + ':' + pad2(secs);
    }

    function loadWeekly() {
      var meta = window.__WEEKLY_META__ || {};
      weeklyKeywords = (meta.keywords || []).slice();
      renderWKeywords();
      if (wLastAt) wLastAt.textContent = (meta.last_auto_at || '').slice(0, 10) || '尚未检索';
      if (wTotal) wTotal.textContent = (meta.total || 0) + ' 篇';
      renderCountdown();
      if (weeklyTimer) clearInterval(weeklyTimer);
      weeklyTimer = setInterval(renderCountdown, 1000);

      if (serverMode) {
        fetch('/api/papers-weekly-meta', { cache: 'no-store' })
          .then(function (r) { return r.json(); })
          .then(function (m) {
            if (m && m.keywords && m.keywords.length) { weeklyKeywords = m.keywords; renderWKeywords(); }
            if (wLastAt) wLastAt.textContent = (m.last_auto_at || '').slice(0, 10) || '尚未检索';
            if (wTotal) wTotal.textContent = (m.total || 0) + ' 篇';
          })
          .catch(function () {});
      }
    }

    function runWeekly() {
      if (weeklyRunning) return;
      if (!serverMode) {
        setWStatus('请先运行 python build.py --serve 启动本地服务后再检索', 'err');
        return;
      }
      weeklyRunning = true;
      if (wRun) { wRun.disabled = true; wRun.textContent = '正在检索…'; }
      setWStatus('正在检索近两周最新文献…… 请稍候', '');
      fetch('/api/fetch-weekly', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keywords: weeklyKeywords, days: 14 })
      })
        .then(function (response) {
          if (!response.ok) return response.json().then(function (d) { throw new Error(d.error || '检索失败'); });
          return response.json();
        })
        .then(function (result) {
          var summaries = [];
          if (result.sources && result.sources.length) summaries.push('命中来源：' + result.sources.join('、'));
          if (result.errors && result.errors.length) summaries.push('部分来源失败：' + result.errors.join('；'));
          if (wLastAt) wLastAt.textContent = (result.ran_at || '').slice(0, 10) || '刚刚';
          if (wTotal) wTotal.textContent = result.total + ' 篇';
          setWStatus('本周检索完成，共 ' + result.total + ' 篇' + (summaries.length ? '（' + summaries.join('；') + '）' : ''), result.total ? 'ok' : '');
        })
        .catch(function (error) {
          setWStatus('检索失败：' + error.message, 'err');
        })
        .then(function () {
          weeklyRunning = false;
          if (wRun) { wRun.disabled = false; wRun.textContent = '立即检索本周'; }
        });
    }

    if (wKwAdd) wKwAdd.addEventListener('click', function () { addWKeyword(wKwInput && wKwInput.value); if (wKwInput) wKwInput.value = ''; });
    if (wKwInput) {
      wKwInput.addEventListener('keydown', function (event) {
        if (event.key === 'Enter') { event.preventDefault(); addWKeyword(wKwInput.value); wKwInput.value = ''; }
      });
    }
    if (wRun) wRun.addEventListener('click', runWeekly);

    loadWeekly();
  }
})();

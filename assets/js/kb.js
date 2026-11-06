/* 在读文献：来源 → 词条 → 索引/日志 → 图谱与检索（llm_wiki 的静态增强版） */
(function () {
  'use strict';

  var shell = document.getElementById('kbShell');
  if (!shell) return;

  var ROOT = shell.getAttribute('data-root') || '../';
  var VIEWER = ROOT + 'library/viewer.html';
  var $ = function (id) { return document.getElementById(id); };

  var state = {
    view: 'wiki',
    kb: null,
    currentId: null,
    dirty: false,
    saving: false,
    server: false,
    items: [],
    graph: null,
    lastPageId: null
  };

  var TYPE_ORDER = [
    ['overview', '总览'],
    ['source', '来源'],
    ['concept', '概念'],
    ['entity', '实体'],
    ['topic', '主题'],
    ['meta', '规则']
  ];
  var TYPE_COLOR = {
    overview: '#5b8def',
    source: '#e0954a',
    concept: '#3fb6a8',
    entity: '#9a7bd6',
    topic: '#d46a8c',
    meta: '#8a9bb0'
  };
  var LINK_RE = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;

  /* ---------------- 通用 ---------------- */
  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function nowISO() { return new Date().toISOString(); }
  function uid(prefix) {
    return prefix + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }
  function plain(html) {
    var box = document.createElement('div');
    box.innerHTML = html || '';
    return box.textContent || '';
  }
  function toast(message) {
    var el = $('kbToast');
    if (!el) return;
    el.textContent = message;
    el.hidden = false;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(function () { el.hidden = true; }, 2200);
  }

  /* ---------------- 存储：IndexedDB + 可选服务端 ---------------- */
  function openDB(name, store) {
    return new Promise(function (resolve, reject) {
      var req = indexedDB.open(name, 1);
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains(store)) db.createObjectStore(store, { keyPath: 'id' });
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
  }
  function idbGet(store, key, dbName) {
    return openDB(dbName || 'cfdwiki-kb', store).then(function (db) {
      return new Promise(function (resolve, reject) {
        var req = db.transaction(store, 'readonly').objectStore(store).get(key);
        req.onsuccess = function () { resolve(req.result ? req.result.value : null); };
        req.onerror = function () { reject(req.error); };
      });
    }).catch(function () { return null; });
  }
  function idbSet(store, key, value, dbName) {
    return openDB(dbName || 'cfdwiki-kb', store).then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(store, 'readwrite');
        tx.objectStore(store).put({ id: key, value: value });
        tx.oncomplete = function () { resolve(true); };
        tx.onerror = function () { reject(tx.error); };
      });
    }).catch(function () { return false; });
  }
  function idbAll(store, dbName) {
    return openDB(dbName || 'cfdwiki-library', store).then(function (db) {
      return new Promise(function (resolve, reject) {
        var req = db.transaction(store, 'readonly').objectStore(store).getAll();
        req.onsuccess = function () { resolve(req.result || []); };
        req.onerror = function () { reject(req.error); };
      });
    }).catch(function () { return []; });
  }
  function idbPut(store, value, dbName) {
    return openDB(dbName || 'cfdwiki-library', store).then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(store, 'readwrite');
        tx.objectStore(store).put(value);
        tx.oncomplete = function () { resolve(value); };
        tx.onerror = function () { reject(tx.error); };
      });
    });
  }

  function defaultKB() {
    var now = nowISO();
    function page(id, title, type, body) {
      return { id: id, title: title, type: type, tags: [], sources: [], body: body, created: now, updated: now };
    }
    return {
      version: 1,
      updated: now,
      log: [],
      pages: [
        page('overview', '知识库总览', 'overview',
          '<p>这里是由「在读文献」逐步长成的个人知识库。导入一篇文献会生成一条 <strong>来源</strong> 词条，再把概念、方法、结论拆成 <strong>概念 / 实体 / 主题</strong> 词条，用 <code>[[双链]]</code> 串起来。</p>'),
        page('index', '索引', 'meta', '<p>索引会随词条增删自动重建。</p>'),
        page('log', '操作日志', 'meta', '<p>导入、新建、删除与重建索引的时间记录。</p>'),
        page('purpose', '研究目的 purpose', 'meta', '<h2>这个库为什么存在</h2><p>待补充。</p>'),
        page('schema', '结构规则 schema', 'meta', '<h2>词条类型</h2><p>source / concept / entity / topic。</p>')
      ]
    };
  }

  function normalize(kb) {
    if (!kb || !Array.isArray(kb.pages)) return defaultKB();
    var fallback = defaultKB();
    var ids = {};
    kb.pages.forEach(function (p) { if (p && p.id) ids[p.id] = true; });
    fallback.pages.forEach(function (p) {
      if (!ids[p.id]) kb.pages.push(p);
    });
    kb.pages.forEach(function (p) {
      if (!Array.isArray(p.tags)) p.tags = [];
      if (!Array.isArray(p.sources)) p.sources = [];
      if (typeof p.body !== 'string') p.body = '';
      if (!p.type) p.type = 'concept';
    });
    if (!Array.isArray(kb.log)) kb.log = [];
    return kb;
  }

  function loadKB() {
    var server = Promise.resolve(null);
    if (location.protocol === 'http:' || location.protocol === 'https:') {
      server = fetch('/api/kb', { cache: 'no-store' })
        .then(function (response) {
          if (!response.ok) throw new Error('no api');
          return response.json();
        })
        .catch(function () { return null; });
    }
    return Promise.all([server, idbGet('docs', 'kb')]).then(function (result) {
      var remote = result[0];
      var local = result[1];
      if (remote && remote.pages && remote.pages.length) {
        state.server = true;
        // 服务端只有默认骨架、而本地已有编辑时，优先保留本地
        if (local && local.pages && local.pages.length > remote.pages.length && remote.pages.length <= 5) {
          return local;
        }
        return remote;
      }
      if (local) return local;
      if (window.__KB__ && Array.isArray(window.__KB__.pages)) return window.__KB__;
      return defaultKB();
    }).then(normalize);
  }

  var saveTimer = null;
  var serverTimer = null;

  function persist() {
    state.kb.updated = nowISO();
    idbSet('docs', 'kb', state.kb);
    if (state.server) {
      clearTimeout(serverTimer);
      serverTimer = setTimeout(function () {
        fetch('/api/kb', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(state.kb)
        }).then(function (response) {
          return response.json().then(function (data) {
            if (!response.ok) throw new Error(data.error || '保存失败');
            setSaveState('已保存');
          });
        }).catch(function () {
          setSaveState('本地已保存 · 服务端未同步');
        });
      }, 900);
    }
  }

  /* ---------------- 词条工具 ---------------- */
  function pages() { return state.kb.pages; }
  function findPage(id) {
    for (var i = 0; i < pages().length; i += 1) if (pages()[i].id === id) return pages()[i];
    return null;
  }
  function findByTitle(title) {
    var key = String(title || '').trim().toLowerCase();
    for (var i = 0; i < pages().length; i += 1) {
      if (pages()[i].title.trim().toLowerCase() === key) return pages()[i];
    }
    return null;
  }
  function resolveLink(text) {
    var value = String(text || '').trim();
    return findPage(value) || findByTitle(value);
  }
  function linkCount() {
    var total = 0;
    pages().forEach(function (p) {
      var matches = (p.body || '').match(LINK_RE);
      if (matches) total += matches.length;
    });
    return total;
  }

  /* 把 [[双链]] 渲染为可点击链接（遍历文本节点，避免污染 HTML 标签） */
  function linkify(html) {
    var box = document.createElement('div');
    box.innerHTML = html || '';
    var walker = document.createTreeWalker(box, NodeFilter.SHOW_TEXT, null);
    var nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(function (node) {
      var text = node.nodeValue || '';
      if (text.indexOf('[[') === -1) return;
      var frag = document.createDocumentFragment();
      var last = 0;
      var re = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;
      var match;
      while ((match = re.exec(text))) {
        if (match.index > last) frag.appendChild(document.createTextNode(text.slice(last, match.index)));
        var target = match[1].trim();
        var label = (match[2] || match[1]).trim();
        var page = resolveLink(target);
        var a = document.createElement('a');
        a.className = 'kb-wikilink';
        if (page) {
          a.href = '#kb=' + encodeURIComponent(page.id);
          a.setAttribute('data-page', page.id);
        } else if (target.indexOf('/') !== -1 || /\.html?$/.test(target)) {
          a.href = /^https?:|^mailto:/.test(target)
            ? target
            : ROOT + target.replace(/\.html?$/, '') + '.html';
          a.className += ' kb-wikilink-ext';
          a.setAttribute('target', '_blank');
        } else {
          a.href = '#';
          a.className += ' is-missing';
          a.setAttribute('data-new', target);
          a.title = '词条不存在，点击新建';
        }
        a.textContent = label;
        frag.appendChild(a);
        last = match.index + match[0].length;
      }
      if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
      node.parentNode.replaceChild(frag, node);
    });
    return box.innerHTML;
  }

  /* ---------------- 树与页头 ---------------- */
  function renderTree() {
    var tree = $('kbTree');
    var empty = $('kbTreeEmpty');
    if (!tree) return;
    tree.innerHTML = '';
    var groups = {};
    var visible = 0;
    pages().forEach(function (p) {
      if (p.id === 'index' || p.id === 'log') return;
      visible += 1;
      if (!groups[p.type]) groups[p.type] = [];
      groups[p.type].push(p);
    });
    TYPE_ORDER.forEach(function (pair) {
      var list = groups[pair[0]] || [];
      if (!list.length) return;
      var box = document.createElement('div');
      box.className = 'kb-tree-group';
      var head = document.createElement('div');
      head.className = 'kb-tree-head';
      head.textContent = pair[1];
      var count = document.createElement('span');
      count.textContent = String(list.length);
      head.appendChild(count);
      box.appendChild(head);
      list.sort(function (a, b) { return String(b.updated).localeCompare(String(a.updated)); });
      list.forEach(function (p) {
        var item = document.createElement('button');
        item.type = 'button';
        item.className = 'kb-tree-item' + (p.id === state.currentId ? ' is-active' : '');
        item.setAttribute('data-page', p.id);
        var dot = document.createElement('span');
        dot.className = 'kb-type-dot';
        dot.style.background = TYPE_COLOR[p.type] || 'var(--text-3)';
        var label = document.createElement('span');
        label.className = 'kb-tree-title';
        label.textContent = p.title;
        item.appendChild(dot);
        item.appendChild(label);
        item.addEventListener('click', function () { openPage(p.id); });
        box.appendChild(item);
      });
      tree.appendChild(box);
    });
    if (empty) empty.hidden = visible > 0;
  }

  function renderHeader() {
    var count = pages().filter(function (p) { return p.id !== 'index' && p.id !== 'log'; }).length;
    if ($('kbPageCount')) $('kbPageCount').textContent = String(count);
    if ($('kbLinkCount')) $('kbLinkCount').textContent = String(linkCount());
    if ($('kbStorageBadge')) $('kbStorageBadge').textContent = state.server ? '服务端存储' : '本地存储';
  }

  /* ---------------- 索引 / 日志 ---------------- */
  function rebuildIndex() {
    var index = findPage('index');
    if (!index) return;
    var groups = {};
    pages().forEach(function (p) {
      if (p.id === 'index' || p.id === 'log') return;
      if (!groups[p.type]) groups[p.type] = [];
      groups[p.type].push(p);
    });
    var html = '<p>共 ' + pages().length + ' 个页面，' + linkCount() + ' 条双链。按类型分组：</p>';
    TYPE_ORDER.forEach(function (pair) {
      var list = groups[pair[0]] || [];
      if (!list.length) return;
      html += '<h3>' + pair[1] + '（' + list.length + '）</h3><ul>';
      list.forEach(function (p) { html += '<li>[[' + p.title + ']]</li>'; });
      html += '</ul>';
    });
    index.body = html;
    index.updated = nowISO();
  }

  function logEntry(action, detail) {
    if (!Array.isArray(state.kb.log)) state.kb.log = [];
    state.kb.log.unshift({ at: nowISO(), action: action, detail: detail || '' });
    if (state.kb.log.length > 120) state.kb.log.length = 120;
    renderLog();
  }

  function renderLog() {
    var log = findPage('log');
    if (!log) return;
    var list = '<p>最近操作记录，最多保留 120 条。</p><ul class="kb-log-list">';
    (state.kb.log || []).forEach(function (row) {
      var time = String(row.at || '').replace('T', ' ').slice(0, 16);
      list += '<li><time>' + esc(time) + '</time><strong>' + esc(row.action) + '</strong> ' + esc(row.detail) + '</li>';
    });
    list += '</ul>';
    log.body = list;
  }

  /* ---------------- 编辑器 ---------------- */
  var titleEl = $('kbTitle');
  var typeEl = $('kbType');
  var tagsEl = $('kbTags');
  var bodyEl = $('kbBody');
  var saveStateEl = $('kbSaveState');

  function setSaveState(text) {
    if (saveStateEl) saveStateEl.textContent = text;
  }

  function markDirty() {
    state.dirty = true;
    setSaveState('未保存');
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNow, 700);
  }

  function saveNow() {
    if (!state.currentId) return;
    var page = findPage(state.currentId);
    if (!page) return;
    var title = titleEl.value.trim() || '未命名词条';
    var changedTitle = page.title !== title;
    page.title = title;
    page.type = typeEl.value;
    page.tags = tagsEl.value.split(/[,，]/).map(function (t) { return t.trim(); }).filter(Boolean);
    page.body = bodyEl.innerHTML;
    page.updated = nowISO();
    state.dirty = false;
    persist();
    setSaveState('已保存');
    renderTree();
    renderPreview();
    renderBacklinks();
    renderHeader();
    renderSourceChips();
    if (changedTitle) rebuildIndex();
  }

  function openPage(id, focusTitle) {
    if (state.currentId && state.dirty) saveNow();
    var page = findPage(id);
    if (!page) return;
    state.currentId = id;
    state.lastPageId = id;
    try { localStorage.setItem('cfdwiki:kb:last', id); } catch (e) {}
    titleEl.value = page.title;
    typeEl.value = page.type;
    tagsEl.value = (page.tags || []).join(', ');
    bodyEl.innerHTML = page.body || '';
    setSaveState('已保存');
    renderTree();
    renderPreview();
    renderBacklinks();
    renderSourceChips();
    updateSourcePicker();
    if (focusTitle) { titleEl.focus(); titleEl.select(); }
  }

  /* ---------------- 预览 / 反向链接 / 来源 ---------------- */
  function renderPreview() {
    var box = $('kbPreview');
    if (!box || !state.currentId) return;
    var page = findPage(state.currentId);
    box.innerHTML = page ? linkify(page.body) : '';
  }

  function renderBacklinks() {
    var box = $('kbBacklinks');
    var count = $('kbBacklinkCount');
    if (!box) return;
    box.innerHTML = '';
    var current = findPage(state.currentId);
    if (!current) return;
    var links = [];
    pages().forEach(function (p) {
      if (p.id === current.id) return;
      var hits = 0;
      var re = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;
      var match;
      while ((match = re.exec(p.body || '')) !== null) {
        var target = resolveLink(match[1]);
        if (target && target.id === current.id) hits += 1;
      }
      if (hits) links.push({ page: p, hits: hits });
    });
    links.sort(function (a, b) { return b.hits - a.hits; });
    if (count) count.textContent = String(links.length);
    if (!links.length) {
      box.innerHTML = '<p class="kb-hint">还没有其他词条引用它。</p>';
      return;
    }
    links.forEach(function (row) {
      var a = document.createElement('button');
      a.type = 'button';
      a.className = 'kb-backlink';
      a.innerHTML = '<span>' + esc(row.page.title) + '</span><em>' + row.hits + '</em>';
      a.addEventListener('click', function () { openPage(row.page.id); });
      box.appendChild(a);
    });
  }

  function linkForItem(item) {
    return VIEWER + '?' + (item.local ? 'local=' : 'id=') + encodeURIComponent(item.id);
  }

  function renderSourceChips() {
    var box = $('kbSourcesRow');
    if (!box) return;
    box.innerHTML = '';
    var page = findPage(state.currentId);
    if (!page) return;
    if (!page.sources.length) {
      box.innerHTML = '<span class="kb-hint">尚未关联来源。通过「关联来源」把这篇词条挂到原文上，保证可追溯。</span>';
      return;
    }
    var label = document.createElement('span');
    label.className = 'kb-sources-label';
    label.textContent = '来源';
    box.appendChild(label);
    page.sources.forEach(function (id) {
      var item = state.items.filter(function (it) { return it.id === id; })[0];
      var chip = document.createElement('span');
      chip.className = 'kb-source-chip';
      var a = document.createElement('a');
      a.href = item ? linkForItem(item) : '#';
      a.target = '_blank';
      a.rel = 'noopener';
      a.textContent = item ? item.title : id;
      var del = document.createElement('button');
      del.type = 'button';
      del.textContent = '×';
      del.title = '移除来源关联';
      del.addEventListener('click', function () {
        page.sources = page.sources.filter(function (x) { return x !== id; });
        persist();
        renderSourceChips();
        updateSourcePicker();
      });
      chip.appendChild(a);
      chip.appendChild(del);
      box.appendChild(chip);
    });
  }

  function updateSourcePicker() {
    var picker = $('kbSourcePicker');
    if (!picker) return;
    var page = findPage(state.currentId);
    if (!page) return;
    picker.innerHTML = '';
    if (!state.items.length) {
      picker.innerHTML = '<p class="kb-hint">还没有可关联的来源，请先在「来源」上传文献。</p>';
      return;
    }
    state.items.forEach(function (item) {
      var label = document.createElement('label');
      label.className = 'kb-pick-row';
      var box = document.createElement('input');
      box.type = 'checkbox';
      box.checked = page.sources.indexOf(item.id) !== -1;
      box.addEventListener('change', function () {
        if (box.checked) {
          if (page.sources.indexOf(item.id) === -1) page.sources.push(item.id);
        } else {
          page.sources = page.sources.filter(function (x) { return x !== item.id; });
        }
        persist();
        renderSourceChips();
        renderBacklinks();
      });
      var text = document.createElement('span');
      text.textContent = item.title || '未命名文献';
      label.appendChild(box);
      label.appendChild(text);
      picker.appendChild(label);
    });
  }

  /* ---------------- 视图切换 ---------------- */
  function switchView(view) {
    state.view = view;
    Array.prototype.forEach.call(document.querySelectorAll('.kb-rail-btn'), function (btn) {
      btn.classList.toggle('is-active', btn.getAttribute('data-view') === view);
    });
    var views = {
      wiki: $('kbWikiView'),
      sources: $('kbSourcesView'),
      graph: $('kbGraphView'),
      search: $('kbSearchView'),
      settings: $('kbSettingsView')
    };
    Object.keys(views).forEach(function (key) {
      if (views[key]) views[key].hidden = key !== view;
    });
    var explorer = $('kbExplorer');
    if (explorer) explorer.hidden = view !== 'wiki';
    shell.classList.toggle('is-wide', view !== 'wiki');
    if (view === 'sources') { renderSources(); }
    if (view === 'graph') { setTimeout(renderGraph, 60); }
    if (view === 'search') { $('kbSearchInput').focus(); renderSearch(''); }
    if (view === 'settings') { renderSettings(); }
  }

  /* ---------------- 新建 / 删除 / 导出 ---------------- */
  function newPage(title, type, body) {
    var page = {
      id: uid('p'),
      title: title || '未命名词条',
      type: type || 'concept',
      tags: [],
      sources: [],
      body: body || '',
      created: nowISO(),
      updated: nowISO()
    };
    pages().push(page);
    rebuildIndex();
    logEntry('新建词条', page.title);
    persist();
    renderTree();
    renderHeader();
    switchView('wiki');
    openPage(page.id, true);
  }

  function deletePage() {
    var page = findPage(state.currentId);
    if (!page) return;
    if (['overview', 'index', 'log', 'purpose', 'schema'].indexOf(page.id) !== -1) {
      toast('系统页面不能删除');
      return;
    }
    if (!window.confirm('删除词条「' + page.title + '」？此操作不可撤销。')) return;
    state.kb.pages = state.kb.pages.filter(function (p) { return p.id !== page.id; });
    logEntry('删除词条', page.title);
    rebuildIndex();
    persist();
    renderTree();
    renderHeader();
    openPage(findPage('overview') ? 'overview' : pages()[0].id);
  }

  function htmlToMarkdown(html) {
    var box = document.createElement('div');
    box.innerHTML = html || '';
    box.querySelectorAll('br').forEach(function (br) { br.replaceWith('\n'); });
    var out = '';
    Array.prototype.forEach.call(box.childNodes, function (node) {
      if (node.nodeType === 3) { out += node.nodeValue; return; }
      if (node.nodeType !== 1) return;
      var tag = node.tagName.toLowerCase();
      var inner = htmlToMarkdown(node.innerHTML).trim();
      if (tag === 'h2') out += '\n## ' + inner + '\n';
      else if (tag === 'h3') out += '\n### ' + inner + '\n';
      else if (tag === 'li') out += '- ' + inner + '\n';
      else if (tag === 'ul' || tag === 'ol') out += inner + '\n';
      else out += inner + '\n\n';
    });
    return out.replace(/\n{3,}/g, '\n\n').trim();
  }

  function exportMarkdown() {
    var page = findPage(state.currentId);
    if (!page) return;
    var front = '---\ntitle: ' + page.title + '\ntype: ' + page.type +
      '\ntags: [' + (page.tags || []).join(', ') + ']' +
      '\nsources: [' + (page.sources || []).join(', ') + ']' +
      '\nupdated: ' + page.updated + '\n---\n\n';
    download(front + htmlToMarkdown(page.body), safeName(page.title) + '.md', 'text/markdown');
  }

  function safeName(name) {
    return String(name).replace(/[\\/:*?"<>|]/g, '-').slice(0, 60);
  }

  function download(content, filename, mime) {
    var blob = new Blob([content], { type: mime || 'application/octet-stream' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 3000);
  }

  /* ---------------- 富文本工具栏 ---------------- */
  function insertHTML(html) {
    bodyEl.focus();
    if (!document.execCommand('insertHTML', false, html)) {
      bodyEl.innerHTML += html;
    }
    markDirty();
  }

  function bindEditor() {
    if (!titleEl) return;
    titleEl.addEventListener('input', markDirty);
    tagsEl.addEventListener('input', markDirty);
    typeEl.addEventListener('change', markDirty);
    bodyEl.addEventListener('input', markDirty);
    bodyEl.addEventListener('paste', function (event) {
      var clipboard = event.clipboardData;
      if (!clipboard) return;
      var image = Array.prototype.filter.call(clipboard.files || [], function (file) {
        return file.type.indexOf('image/') === 0;
      })[0];
      if (!image) return;
      event.preventDefault();
      readImage(image);
    });

    var toolbar = $('kbToolbar');
    if (toolbar) {
      toolbar.addEventListener('click', function (event) {
        var btn = event.target.closest('button');
        if (!btn) return;
        var cmd = btn.getAttribute('data-cmd');
        var action = btn.getAttribute('data-action');
        if (cmd) {
          bodyEl.focus();
          document.execCommand(cmd, false, btn.getAttribute('data-value') || null);
          markDirty();
        } else if (action === 'wikilink') {
          bodyEl.focus();
          document.execCommand('insertText', false, '[[词条名]]');
          markDirty();
        } else if (action === 'image') {
          var fileInput = document.createElement('input');
          fileInput.type = 'file';
          fileInput.accept = 'image/*';
          fileInput.addEventListener('change', function () {
            if (fileInput.files && fileInput.files[0]) readImage(fileInput.files[0]);
          });
          fileInput.click();
        } else if (action === 'export-md') {
          exportMarkdown();
        } else if (action === 'delete') {
          deletePage();
        }
      });
    }

    var picker = $('kbSourcePicker');
    var addSource = $('kbAddSource');
    if (addSource && picker) {
      addSource.addEventListener('click', function () {
        picker.hidden = !picker.hidden;
        if (!picker.hidden) updateSourcePicker();
      });
    }

    document.addEventListener('click', function (event) {
      var link = event.target.closest('.kb-wikilink');
      if (!link) return;
      var pageId = link.getAttribute('data-page');
      var missing = link.getAttribute('data-new');
      if (pageId) { event.preventDefault(); switchView('wiki'); openPage(pageId); }
      else if (missing) { event.preventDefault(); newPage(missing, 'concept'); }
    });

    window.addEventListener('beforeunload', function () {
      if (state.dirty) saveNow();
    });
    document.addEventListener('keydown', function (event) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        saveNow();
      }
    });
  }

  function readImage(file) {
    var reader = new FileReader();
    reader.onload = function () {
      insertHTML('<img src="' + reader.result + '" alt="' + esc(file.name) + '">');
    };
    reader.readAsDataURL(file);
  }

  /* ---------------- 来源 ---------------- */
  function loadItems() {
    var remote = Promise.resolve([]);
    if (location.protocol === 'http:' || location.protocol === 'https:') {
      remote = fetch('/api/library', { cache: 'no-store' })
        .then(function (response) { return response.ok ? response.json() : []; })
        .catch(function () { return []; });
    }
    return Promise.all([remote, idbAll('files')]).then(function (result) {
      var list = (result[0] || []).concat(result[1] || []);
      if (!list.length && Array.isArray(window.__LIBRARY__)) list = window.__LIBRARY__.slice();
      list.forEach(function (item) { if (!item.collection) item.collection = 'reading'; });
      list = list.filter(function (item) { return item.collection === 'reading'; });
      list.sort(function (a, b) { return String(b.added).localeCompare(String(a.added)); });
      state.items = list;
    });
  }

  function hasNotes(item) {
    try {
      var key = 'cfdwiki:notes:' + (item.local ? 'local:' : 'lib:') + item.id;
      return !!localStorage.getItem(key);
    } catch (e) { return false; }
  }

  function ingestedPage(item) {
    return pages().filter(function (p) { return p.type === 'source' && (p.sources || []).indexOf(item.id) !== -1; })[0] || null;
  }

  function renderSources() {
    var grid = $('kbSourcesGrid');
    var empty = $('kbSourcesEmpty');
    if (!grid) return;
    grid.innerHTML = '';
    state.items.forEach(function (item) {
      var card = document.createElement('article');
      card.className = 'kb-source-card';
      var badge = document.createElement('span');
      badge.className = 'kb-source-kind';
      badge.textContent = String(item.kind || 'pdf').toUpperCase();
      var body = document.createElement('div');
      body.className = 'kb-source-body';
      var title = document.createElement('h4');
      title.textContent = item.title || '未命名文献';
      var meta = document.createElement('p');
      var parts = [];
      if (item.authors) parts.push(item.authors);
      if (item.year) parts.push(item.year);
      parts.push(item.local ? '本机存储' : '服务端');
      if (hasNotes(item)) parts.push('已批注');
      meta.textContent = parts.join(' · ');
      body.appendChild(title);
      body.appendChild(meta);
      var actions = document.createElement('div');
      actions.className = 'kb-source-actions';
      var read = document.createElement('a');
      read.className = 'btn btn-ghost';
      read.href = linkForItem(item);
      read.target = '_blank';
      read.rel = 'noopener';
      read.textContent = '阅读';
      var ingestBtn = document.createElement('button');
      ingestBtn.type = 'button';
      ingestBtn.className = 'btn btn-primary';
      var existing = ingestedPage(item);
      ingestBtn.textContent = existing ? '打开词条' : '导入知识库';
      ingestBtn.addEventListener('click', function () {
        if (existing) { switchView('wiki'); openPage(existing.id); }
        else ingest(item);
      });
      actions.appendChild(read);
      actions.appendChild(ingestBtn);
      card.appendChild(badge);
      card.appendChild(body);
      card.appendChild(actions);
      grid.appendChild(card);
    });
    if (empty) empty.hidden = state.items.length > 0;
    updateSourcePicker();
  }

  function ingest(item) {
    var existing = ingestedPage(item);
    if (existing) { switchView('wiki'); openPage(existing.id); return; }
    var notes = '';
    try {
      notes = localStorage.getItem('cfdwiki:notes:' + (item.local ? 'local:' : 'lib:') + item.id) || '';
    } catch (e) { notes = ''; }
    if (notes) {
      var box = document.createElement('div');
      box.innerHTML = notes;
      Array.prototype.forEach.call(box.querySelectorAll('img'), function (img) { img.remove(); });
      notes = box.innerHTML;
    }
    var meta = '<p><strong>原文：</strong><a href="' + linkForItem(item) + '" target="_blank" rel="noopener">' + esc(item.title || '未命名文献') + '</a>';
    if (item.authors) meta += ' · ' + esc(item.authors);
    if (item.year) meta += ' · ' + esc(item.year);
    meta += '</p>';
    var body = meta +
      '<h2>核心结论</h2><p>待补充：这篇文献解决了什么问题，结论是什么。</p>' +
      '<h2>方法与数据</h2><p>待补充：方法、算例、实验或数据集。</p>' +
      '<h2>与已有知识的联系</h2><p>待补充：用 [[词条名]] 链接到相关概念与主题。</p>' +
      '<h2>疑问与待查</h2><p>待补充。</p>' +
      (notes ? '<h2>批注摘录</h2>' + notes : '<h2>批注摘录</h2><p>阅读器里还没有笔记。点「阅读」先做批注，再回来重新导入即可。</p>');
    var page = {
      id: uid('src'),
      title: '来源：' + (item.title || '未命名文献'),
      type: 'source',
      tags: [String(item.kind || '').toLowerCase(), String(item.year || '')].filter(Boolean),
      sources: [item.id],
      body: body,
      created: nowISO(),
      updated: nowISO()
    };
    pages().push(page);
    rebuildIndex();
    logEntry('导入来源', page.title);
    persist();
    renderTree();
    renderHeader();
    renderSources();
    switchView('wiki');
    openPage(page.id, true);
    toast('已生成来源摘要，补齐四节即可');
  }

  function bindSources() {
    var drop = $('kbUploadDrop');
    var input = $('kbUploadInput');
    var pick = $('kbUploadPick');
    var metaBox = $('kbUploadMeta');
    var titleInput = $('kbUploadTitle');
    var authorsInput = $('kbUploadAuthors');
    var yearInput = $('kbUploadYear');
    var confirmBtn = $('kbUploadConfirm');
    var cancelBtn = $('kbUploadCancel');
    var statusEl = $('kbUploadStatus');
    var pending = [];
    var ALLOWED = ['.pdf', '.docx', '.html', '.htm'];
    var LIMIT = 200 * 1024 * 1024;

    function status(text) {
      if (!statusEl) return;
      statusEl.textContent = text;
    }
    function extOf(name) {
      var i = name.lastIndexOf('.');
      return i >= 0 ? name.slice(i).toLowerCase() : '';
    }
    function hideMeta() { if (metaBox) metaBox.hidden = true; }
    function validate(files) {
      return Array.prototype.filter.call(files || [], function (file) {
        if (ALLOWED.indexOf(extOf(file.name)) === -1) { status('已跳过「' + file.name + '」：仅支持 PDF / DOCX / HTML'); return false; }
        if (file.size > LIMIT) { status('已跳过「' + file.name + '」：超过 200 MB'); return false; }
        return true;
      });
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
        xhr.setRequestHeader('X-Collection', 'reading');
        xhr.onload = function () {
          if (xhr.status >= 200 && xhr.status < 300) {
            try { resolve(JSON.parse(xhr.responseText)); } catch (e) { reject(new Error('返回数据异常')); }
          } else {
            var msg = '上传失败';
            try { msg = JSON.parse(xhr.responseText).error || msg; } catch (e) {}
            reject(new Error(msg));
          }
        };
        xhr.onerror = function () { reject(new Error('无法连接本地服务')); };
        xhr.send(file);
      });
    }
    function uploadLocal(file, meta) {
      var record = {
        id: 'local-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
        title: meta.title || file.name.replace(/\.[^.]+$/, ''),
        authors: meta.authors || '',
        year: meta.year || '',
        kind: extOf(file.name).replace('.', ''),
        collection: 'reading',
        size: file.size,
        added: new Date().toISOString().slice(0, 19),
        blob: file
      };
      return idbPut('files', record).then(function () { return Object.assign(record, { local: true }); });
    }
    function uploadFiles(files, meta) {
      var queue = files.slice();
      function next() {
        if (!queue.length) { status('已完成导入'); hideMeta(); loadItems().then(renderSources); return; }
        var file = queue.shift();
        var info = meta || { title: file.name.replace(/\.[^.]+$/, ''), authors: '', year: '' };
        status('正在上传：' + file.name);
        var task = (location.protocol === 'http:' || location.protocol === 'https:')
          ? uploadServer(file, info)
          : Promise.reject(new Error('local'));
        task.catch(function () { return uploadLocal(file, info); })
          .then(function (entry) {
            state.items.unshift(entry.local ? entry : Object.assign({}, entry));
            renderSources();
            next();
          })
          .catch(function (error) { status('「' + file.name + '」失败：' + error.message); next(); });
      }
      next();
    }
    function handle(files) {
      var valid = validate(files);
      if (!valid.length) return;
      if (valid.length === 1) {
        pending = valid;
        if (metaBox) metaBox.hidden = false;
        if (titleInput) { titleInput.value = valid[0].name.replace(/\.[^.]+$/, ''); titleInput.focus(); }
        if (authorsInput) authorsInput.value = '';
        if (yearInput) yearInput.value = '';
      } else {
        uploadFiles(valid, null);
      }
    }
    if (pick) pick.addEventListener('click', function () { if (input) input.click(); });
    if (input) input.addEventListener('change', function () { handle(input.files); input.value = ''; });
    if (drop) {
      ['dragenter', 'dragover'].forEach(function (type) {
        drop.addEventListener(type, function (e) { e.preventDefault(); drop.classList.add('is-dragging'); });
      });
      ['dragleave', 'drop'].forEach(function (type) {
        drop.addEventListener(type, function (e) { e.preventDefault(); drop.classList.remove('is-dragging'); });
      });
      drop.addEventListener('drop', function (e) { if (e.dataTransfer && e.dataTransfer.files) handle(e.dataTransfer.files); });
    }
    if (confirmBtn) confirmBtn.addEventListener('click', function () {
      if (!pending.length) return;
      var meta = {
        title: (titleInput && titleInput.value.trim()) || '',
        authors: (authorsInput && authorsInput.value.trim()) || '',
        year: (yearInput && yearInput.value.trim()) || ''
      };
      var files = pending.slice();
      pending = [];
      hideMeta();
      uploadFiles(files, meta);
    });
    if (cancelBtn) cancelBtn.addEventListener('click', function () { pending = []; hideMeta(); status('已取消'); });
  }

  /* ---------------- 图谱 ---------------- */
  var graphState = null;

  function buildGraph() {
    var nodes = pages().filter(function (p) {
      return ['overview', 'source', 'concept', 'entity', 'topic'].indexOf(p.type) !== -1;
    }).map(function (p) {
      return Object.assign({}, p);
    });
    var byId = {};
    nodes.forEach(function (p) { byId[p.id] = p; });
    var edgeMap = {};
    var neighbors = {};
    nodes.forEach(function (p) { neighbors[p.id] = {}; });

    function addEdge(a, b, weight) {
      if (!byId[a] || !byId[b] || a === b) return;
      var key = a < b ? a + '|' + b : b + '|' + a;
      edgeMap[key] = edgeMap[key] || { source: a, target: b, weight: 0, signals: {} };
      edgeMap[key].weight += weight;
    }

    nodes.forEach(function (p) {
      var re = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;
      var match;
      while ((match = re.exec(p.body || '')) !== null) {
        var target = resolveLink(match[1]);
        if (target && byId[target.id]) {
          addEdge(p.id, target.id, 3);
          neighbors[p.id][target.id] = true;
          neighbors[target.id][p.id] = true;
        }
      }
    });

    var list = nodes.slice();
    for (var i = 0; i < list.length; i += 1) {
      for (var j = i + 1; j < list.length; j += 1) {
        var a = list[i];
        var b = list[j];
        var shared = (a.sources || []).filter(function (id) { return (b.sources || []).indexOf(id) !== -1; });
        if (shared.length) addEdge(a.id, b.id, 4 * shared.length);
        var common = 0;
        Object.keys(neighbors[a.id]).forEach(function (z) {
          if (neighbors[b.id][z]) {
            var deg = Object.keys(neighbors[z]).length + 1;
            common += 1 / Math.log(deg + 1);
          }
        });
        if (common > 0) addEdge(a.id, b.id, 1.5 * common);
        if (a.type === b.type) addEdge(a.id, b.id, 1);
      }
    }

    var edges = Object.keys(edgeMap).map(function (key) { return edgeMap[key]; });
    return { nodes: nodes, edges: edges, byId: byId };
  }

  function renderGraph() {
    var canvas = $('kbGraph');
    if (!canvas) return;
    var wrap = canvas.parentNode;
    var width = Math.max(360, wrap.clientWidth - 2);
    var height = Math.max(360, wrap.clientHeight - 2);
    var dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    var ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    var data = buildGraph();
    var nodes = data.nodes;
    var cx = width / 2;
    var cy = height / 2;
    nodes.forEach(function (node, index) {
      var angle = (index / Math.max(1, nodes.length)) * Math.PI * 2;
      node.x = cx + Math.cos(angle) * Math.min(width, height) * 0.32;
      node.y = cy + Math.sin(angle) * Math.min(width, height) * 0.32;
      node.vx = 0;
      node.vy = 0;
      node.r = 6;
      node.links = 0;
    });
    data.edges.forEach(function (edge) {
      if (data.byId[edge.source]) data.byId[edge.source].links += 1;
      if (data.byId[edge.target]) data.byId[edge.target].links += 1;
    });
    nodes.forEach(function (node) { node.r = 6 + Math.min(11, node.links * 1.4); });

    for (var step = 0; step < 140; step += 1) {
      var alpha = 1 - step / 140;
      for (var i = 0; i < nodes.length; i += 1) {
        for (var j = i + 1; j < nodes.length; j += 1) {
          var a = nodes[i];
          var b = nodes[j];
          var dx = b.x - a.x;
          var dy = b.y - a.y;
          var dist = Math.sqrt(dx * dx + dy * dy) || 1;
          var force = (120 * 120) / dist;
          var fx = (dx / dist) * force * 0.0015 * alpha;
          var fy = (dy / dist) * force * 0.0015 * alpha;
          a.vx -= fx; a.vy -= fy;
          b.vx += fx; b.vy += fy;
        }
        nodes[i].vx += (cx - nodes[i].x) * 0.002 * alpha;
        nodes[i].vy += (cy - nodes[i].y) * 0.002 * alpha;
      }
      data.edges.forEach(function (edge) {
        var a = data.byId[edge.source];
        var b = data.byId[edge.target];
        if (!a || !b) return;
        var dx = b.x - a.x;
        var dy = b.y - a.y;
        var dist = Math.sqrt(dx * dx + dy * dy) || 1;
        var target = 110;
        var spring = (dist - target) * 0.0016 * Math.min(2.5, 0.8 + edge.weight / 5) * alpha;
        var fx = (dx / dist) * spring;
        var fy = (dy / dist) * spring;
        a.vx += fx; a.vy += fy;
        b.vx -= fx; b.vy -= fy;
      });
      nodes.forEach(function (node) {
        node.x += Math.max(-12, Math.min(12, node.vx));
        node.y += Math.max(-12, Math.min(12, node.vy));
        node.vx *= 0.75;
        node.vy *= 0.75;
        node.x = Math.max(node.r + 8, Math.min(width - node.r - 8, node.x));
        node.y = Math.max(node.r + 8, Math.min(height - node.r - 8, node.y));
      });
    }

    graphState = {
      data: data, width: width, height: height, ctx: ctx, hover: null,
      nodes: nodes, edges: data.edges
    };

    function draw() {
      ctx.clearRect(0, 0, width, height);
      ctx.save();
      ctx.strokeStyle = 'rgba(110,150,200,0.18)';
      data.edges.forEach(function (edge) {
        var a = data.byId[edge.source];
        var b = data.byId[edge.target];
        if (!a || !b) return;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.lineWidth = Math.min(4, 0.4 + edge.weight / 4);
        ctx.strokeStyle = 'rgba(110,150,200,' + Math.min(0.5, 0.08 + edge.weight / 24) + ')';
        ctx.stroke();
      });
      nodes.forEach(function (node) {
        var dim = graphState.hover && graphState.hover !== node ? 0.55 : 1;
        ctx.globalAlpha = dim;
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.r, 0, Math.PI * 2);
        ctx.fillStyle = TYPE_COLOR[node.type] || '#8a9bb0';
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'rgba(255,255,255,0.65)';
        ctx.stroke();
        if (node.r > 8 || (graphState.hover && graphState.hover === node)) {
          ctx.font = '12px system-ui, sans-serif';
          ctx.fillStyle = 'rgba(30,40,55,0.9)';
          ctx.textAlign = 'center';
          ctx.fillText(node.title.slice(0, 16), node.x, node.y - node.r - 7);
        }
        ctx.globalAlpha = 1;
      });
      ctx.restore();
    }

    function nearest(event) {
      var rect = canvas.getBoundingClientRect();
      var mx = event.clientX - rect.left;
      var my = event.clientY - rect.top;
      var best = null;
      var bestDist = 18;
      nodes.forEach(function (node) {
        var dist = Math.sqrt((node.x - mx) * (node.x - mx) + (node.y - my) * (node.y - my));
        if (dist < node.r + 6 && dist < bestDist) { best = node; bestDist = dist; }
      });
      return best;
    }

    canvas.onmousemove = function (event) {
      var node = nearest(event);
      if (graphState.hover !== node) {
        graphState.hover = node;
        canvas.style.cursor = node ? 'pointer' : 'default';
        var tip = $('kbGraphTip');
        if (tip) {
          if (node) {
            tip.hidden = false;
            tip.textContent = node.title + ' · ' + node.links + ' 条关系';
            var rect = canvas.getBoundingClientRect();
            tip.style.left = (event.clientX - rect.left + 14) + 'px';
            tip.style.top = (event.clientY - rect.top + 14) + 'px';
          } else {
            tip.hidden = true;
          }
        }
        draw();
      }
    };
    canvas.onmouseleave = function () { graphState.hover = null; var tip = $('kbGraphTip'); if (tip) tip.hidden = true; draw(); };
    canvas.onclick = function (event) {
      var node = nearest(event);
      if (node) { switchView('wiki'); openPage(node.id); }
    };

    var legend = $('kbGraphLegend');
    if (legend) {
      legend.innerHTML = '';
      TYPE_ORDER.forEach(function (pair) {
        var count = nodes.filter(function (n) { return n.type === pair[0]; }).length;
        if (!count) return;
        var span = document.createElement('span');
        span.innerHTML = '<i style="background:' + TYPE_COLOR[pair[0]] + '"></i>' + pair[1] + ' ' + count;
        legend.appendChild(span);
      });
      if (!nodes.length) legend.innerHTML = '<span class="kb-hint">还没有可绘制的词条。</span>';
    }
    draw();
  }

  /* ---------------- 检索 ---------------- */
  function renderSearch(query) {
    var box = $('kbSearchResults');
    if (!box) return;
    var q = String(query || '').trim().toLowerCase();
    box.innerHTML = '';
    var hits = [];
    pages().forEach(function (p) {
      if (p.id === 'index' || p.id === 'log') return;
      var title = p.title.toLowerCase();
      var tags = (p.tags || []).join(' ').toLowerCase();
      var text = plain(p.body).toLowerCase();
      var score = 0;
      if (title.indexOf(q) !== -1 && q) score += 8;
      if (tags.indexOf(q) !== -1 && q) score += 4;
      var occurrences = 0;
      if (q) {
        var at = 0;
        while ((at = text.indexOf(q, at)) !== -1) { occurrences += 1; at += q.length; }
      }
      score += Math.min(6, occurrences);
      if (!q || score > 0) {
        var snippet = '';
        if (q) {
          var cut = text.indexOf(q);
          snippet = plain(p.body).slice(Math.max(0, cut - 45), cut + 70);
        } else {
          snippet = plain(p.body).slice(0, 90);
        }
        hits.push({ page: p, score: score, snippet: snippet });
      }
    });
    hits.sort(function (a, b) { return b.score - a.score; });
    if (!hits.length) {
      box.innerHTML = '<div class="kb-empty">没有匹配的词条' + (q ? '：' + esc(q) : '') + '。</div>';
      return;
    }
    hits.forEach(function (hit) {
      var row = document.createElement('button');
      row.type = 'button';
      row.className = 'kb-search-row';
      row.innerHTML = '<span class="kb-search-type" style="color:' + (TYPE_COLOR[hit.page.type] || 'inherit') + '">' + esc(hit.page.type) + '</span>' +
        '<strong>' + esc(hit.page.title) + '</strong>' +
        '<span class="kb-search-snippet">' + esc(hit.snippet) + '</span>';
      row.addEventListener('click', function () { switchView('wiki'); openPage(hit.page.id); });
      box.appendChild(row);
    });
  }

  /* ---------------- 设置 ---------------- */
  function renderSettings() {
    var statPages = $('kbStatPages');
    var statLinks = $('kbStatLinks');
    var statSources = $('kbStatSources');
    var statStorage = $('kbStatStorage');
    if (statPages) statPages.textContent = String(pages().length);
    if (statLinks) statLinks.textContent = String(linkCount());
    if (statSources) statSources.textContent = String(state.items.length);
    if (statStorage) statStorage.textContent = state.server ? '服务端' : '浏览器';
    var hint = $('kbStorageHint');
    if (hint) {
      hint.textContent = state.server
        ? '当前由 python build.py --serve 提供服务，词条写入 library/kb.json，可随站点部署。'
        : '当前为静态页面，词条保存在此浏览器的 IndexedDB 中；换设备或清理浏览器数据会丢失，请定期导出 JSON 工程。';
    }
    var index = findPage('index');
    var log = findPage('log');
    if ($('kbIndexPreview')) $('kbIndexPreview').innerHTML = index ? linkify(index.body) : '';
    if ($('kbLogPreview')) $('kbLogPreview').innerHTML = log ? linkify(log.body) : '';
  }

  function bindSettings() {
    var exportBtn = $('kbExportJson');
    if (exportBtn) exportBtn.addEventListener('click', function () {
      download(JSON.stringify(state.kb, null, 2), 'cfdwiki-kb-' + nowISO().slice(0, 10) + '.json', 'application/json');
    });
    var importBtn = $('kbImportBtn');
    var importInput = $('kbImportInput');
    if (importBtn && importInput) {
      importBtn.addEventListener('click', function () { importInput.click(); });
      importInput.addEventListener('change', function () {
        var file = importInput.files && importInput.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function () {
          try {
            var data = JSON.parse(reader.result);
            if (!data || !Array.isArray(data.pages)) throw new Error('不是知识库工程');
            state.kb = normalize(data);
            persist();
            logEntry('导入工程', file.name);
            renderAll();
            if (findPage('overview')) openPage('overview');
            toast('工程已导入');
          } catch (error) {
            toast('导入失败：' + error.message);
          }
        };
        reader.readAsText(file);
        importInput.value = '';
      });
    }
    var rebuildBtn = $('kbRebuild');
    if (rebuildBtn) rebuildBtn.addEventListener('click', function () {
      rebuildIndex();
      renderLog();
      persist();
      renderSettings();
      logEntry('重建索引', '索引与日志已刷新');
      toast('索引已重建');
    });
    var resetBtn = $('kbReset');
    if (resetBtn) resetBtn.addEventListener('click', function () {
      if (!window.confirm('清空全部词条并恢复初始知识库？建议先导出 JSON 备份。')) return;
      state.kb = defaultKB();
      persist();
      state.currentId = null;
      renderAll();
      openPage('overview');
      toast('知识库已重置');
    });
  }

  /* ---------------- 启动 ---------------- */
  function renderAll() {
    if ((state.kb.log || []).length === 0) renderLog();
    else renderLog();
    renderTree();
    renderHeader();
    renderSettings();
  }

  function bindRail() {
    var rail = $('kbRail');
    if (!rail) return;
    rail.addEventListener('click', function (event) {
      var btn = event.target.closest('.kb-rail-btn');
      if (btn) switchView(btn.getAttribute('data-view'));
    });
    var newBtn = $('kbNewPage');
    if (newBtn) newBtn.addEventListener('click', function () { newPage(); });
    var searchInput = $('kbSearchInput');
    if (searchInput) {
      searchInput.addEventListener('input', function () { renderSearch(searchInput.value); });
    }
    window.addEventListener('resize', function () {
      if (state.view === 'graph') { clearTimeout(renderGraph.timer); renderGraph.timer = setTimeout(renderGraph, 200); }
    });
  }

  bindEditor();
  bindSources();
  bindSettings();
  bindRail();

  loadKB().then(function (kb) {
    state.kb = kb;
    if (!(state.kb.log || []).length) renderLog();
    rebuildIndex();
    renderTree();
    renderHeader();
    renderSettings();
    switchView('wiki');
    var last = null;
    try { last = localStorage.getItem('cfdwiki:kb:last'); } catch (e) {}
    var start = last && findPage(last) ? last : (findPage('overview') ? 'overview' : pages()[0].id);
    openPage(start);
    loadItems().then(function () {
      renderSources();
      renderSourceChips();
      updateSourcePicker();
    });
  });
})();

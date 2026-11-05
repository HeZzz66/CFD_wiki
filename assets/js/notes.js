/* 右侧笔记面板：自动保存、导出、与正文滚动同步 */
(function () {
  'use strict';

  var rail = document.getElementById('pageRail');
  var editor = document.getElementById('notesEditor');
  if (!rail || !editor) return;

  var pageKey = rail.getAttribute('data-page') || location.pathname;
  var STORAGE_KEY = 'cfdwiki:notes:' + pageKey;
  var TAB_KEY = 'cfdwiki:rail-tab';
  var SYNC_KEY = 'cfdwiki:notes-sync';

  var tabs = rail.querySelectorAll('[data-rail-tab]');
  var panels = rail.querySelectorAll('[data-rail-panel]');
  var statusEl = document.getElementById('notesStatus');
  var countEl = document.getElementById('notesCount');
  var syncBtn = document.getElementById('notesSync');
  var exportBtn = document.getElementById('notesExport');
  var clearBtn = document.getElementById('notesClear');
  var dot = document.getElementById('railNoteDot');
  var fab = document.getElementById('notesFab');
  var article = document.querySelector('.article');

  var syncEnabled = localStorage.getItem(SYNC_KEY) !== '0';
  var saveTimer = null;
  var applyingSync = false;

  function countWords(text) {
    var cjk = (text.match(/\u4e00-\u9fff/g) || []).length;
    var words = (text.replace(/\u4e00-\u9fff/g, ' ').match(/[A-Za-z0-9_]+/g) || []).length;
    return cjk + words;
  }

  function updateCount() {
    if (countEl) countEl.textContent = countWords(editor.value) + ' 字';
    if (dot) dot.hidden = !editor.value.trim();
  }

  function setStatus(text, tone) {
    if (!statusEl) return;
    statusEl.textContent = text;
    statusEl.dataset.tone = tone || '';
  }

  function save(immediate) {
    try {
      if (editor.value.trim()) {
        localStorage.setItem(STORAGE_KEY, editor.value);
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
      var now = new Date();
      setStatus(
        '已保存 ' + String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0'),
        'ok'
      );
    } catch (e) {
      setStatus('保存失败：浏览器存储不可用', 'err');
    }
    if (immediate) clearTimeout(saveTimer);
  }

  // 恢复本页笔记
  try {
    var saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      editor.value = saved;
      setStatus('已恢复上次笔记', 'ok');
    }
  } catch (e) {}

  updateCount();

  editor.addEventListener('input', function () {
    updateCount();
    setStatus('正在保存…', '');
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () { save(true); }, 400);
  });

  editor.addEventListener('keydown', function (event) {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
      event.preventDefault();
      save(true);
    }
  });

  window.addEventListener('beforeunload', function () { save(true); });

  /* ---------- 标签切换 ---------- */
  function activateTab(name) {
    tabs.forEach(function (tab) {
      var active = tab.getAttribute('data-rail-tab') === name;
      tab.classList.toggle('is-active', active);
      tab.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    panels.forEach(function (panel) {
      panel.hidden = panel.getAttribute('data-rail-panel') !== name;
    });
    if (name === 'notes') {
      applySync();
      setTimeout(function () { editor.focus(); }, 60);
    }
  }

  tabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      var name = tab.getAttribute('data-rail-tab');
      try { localStorage.setItem(TAB_KEY, name); } catch (e) {}
      activateTab(name);
      rail.classList.add('is-mobile-open');
    });
  });

  try {
    var lastTab = localStorage.getItem(TAB_KEY);
    if (lastTab === 'notes' && window.innerWidth > 1100) activateTab('notes');
  } catch (e) {}

  /* ---------- 同步滚动 ---------- */
  function applySync() {
    if (!syncEnabled || !article) return;
    var editorOverflow = editor.scrollHeight - editor.clientHeight;
    if (editorOverflow <= 4) return;
    var rect = article.getBoundingClientRect();
    var total = article.offsetHeight - window.innerHeight;
    if (total <= 0) return;
    var progress = Math.min(1, Math.max(0, -rect.top / total));
    applyingSync = true;
    editor.scrollTop = progress * editorOverflow;
    window.requestAnimationFrame(function () { applyingSync = false; });
  }

  var ticking = false;
  window.addEventListener('scroll', function () {
    if (ticking || applyingSync) return;
    ticking = true;
    window.requestAnimationFrame(function () {
      ticking = false;
      if (document.querySelector('[data-rail-panel="notes"]').hidden === false) applySync();
    });
  }, { passive: true });

  if (syncBtn) {
    syncBtn.classList.toggle('is-on', syncEnabled);
    syncBtn.setAttribute('aria-pressed', syncEnabled ? 'true' : 'false');
    syncBtn.addEventListener('click', function () {
      syncEnabled = !syncEnabled;
      syncBtn.classList.toggle('is-on', syncEnabled);
      syncBtn.setAttribute('aria-pressed', syncEnabled ? 'true' : 'false');
      try { localStorage.setItem(SYNC_KEY, syncEnabled ? '1' : '0'); } catch (e) {}
      setStatus(syncEnabled ? '同步滚动已开启' : '同步滚动已关闭', '');
      applySync();
    });
  }

  /* ---------- 导出 / 清空 ---------- */
  if (exportBtn) {
    exportBtn.addEventListener('click', function () {
      if (!editor.value.trim()) {
        setStatus('笔记为空，无需导出', '');
        return;
      }
      var title = (document.querySelector('.page-title') || {}).textContent || pageKey;
      var content = '# ' + title.trim() + '\n\n来源：' + pageKey + '\n\n' + editor.value + '\n';
      var blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
      var link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = title.trim().replace(/[\\/:*?"<>|]/g, '_') + '-笔记.md';
      document.body.appendChild(link);
      link.click();
      setTimeout(function () {
        URL.revokeObjectURL(link.href);
        link.remove();
      }, 800);
      setStatus('已导出 Markdown', 'ok');
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', function () {
      if (!editor.value.trim()) return;
      if (!window.confirm('清空本页笔记？此操作不可撤销。')) return;
      editor.value = '';
      save(true);
      updateCount();
    });
  }

  /* ---------- 移动端浮动按钮 ---------- */
  if (fab) {
    fab.addEventListener('click', function () {
      var open = rail.classList.toggle('is-mobile-open');
      if (open) activateTab('notes');
    });
  }

  document.addEventListener('click', function (event) {
    if (window.innerWidth > 1100) return;
    if (!rail.classList.contains('is-mobile-open')) return;
    if (rail.contains(event.target) || (fab && fab.contains(event.target))) return;
    rail.classList.remove('is-mobile-open');
  });
})();

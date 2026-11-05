/* 文献阅读器：PDF / DOCX / HTML 在线阅读 + 随文笔记 */
(function () {
  'use strict';

  var docEl = document.getElementById('viewerDoc');
  var mount = document.getElementById('docMount');
  var loading = document.getElementById('viewerLoading');
  var titleEl = document.getElementById('viewerTitle');
  var metaEl = document.getElementById('viewerMeta');
  var rawLink = document.getElementById('viewerRaw');
  var downloadLink = document.getElementById('viewerDownload');

  var editor = document.getElementById('notesEditor');
  var statusEl = document.getElementById('notesStatus');
  var countEl = document.getElementById('notesCount');
  var syncBtn = document.getElementById('notesSync');
  var exportBtn = document.getElementById('notesExport');
  var imageBtn = document.getElementById('notesImageBtn');
  var imageInput = document.getElementById('notesImageInput');
  var toolsBar = document.querySelector('.notes-tools');

  if (!docEl || !mount) return;

  var params = new URLSearchParams(location.search);
  var localId = params.get('local');
  var remoteId = params.get('id');
  var docKey = localId ? 'local:' + localId : remoteId ? 'lib:' + remoteId : location.pathname;
  var NOTES_KEY = 'cfdwiki:notes:' + docKey;
  var SYNC_KEY = 'cfdwiki:notes-sync';
  var syncEnabled = localStorage.getItem(SYNC_KEY) !== '0';

  /* ---------------- 笔记 ---------------- */
  function countWords(text) {
    var cjk = (text.match(/[\u4e00-\u9fff]/g) || []).length;
    var words = (text.replace(/[\u4e00-\u9fff]/g, ' ').match(/[A-Za-z0-9_]+/g) || []).length;
    return cjk + words;
  }

  function setStatus(text, tone) {
    if (!statusEl) return;
    statusEl.textContent = text;
    statusEl.dataset.tone = tone || '';
  }

  function updateCount() {
    if (countEl && editor) countEl.textContent = countWords(editor.textContent || '') + ' 字';
  }

  function isEmpty() {
    if (!editor) return true;
    return !editor.textContent.trim() && !editor.querySelector('img');
  }

  function save() {
    if (!editor) return;
    try {
      if (!isEmpty()) localStorage.setItem(NOTES_KEY, editor.innerHTML);
      else localStorage.removeItem(NOTES_KEY);
      var now = new Date();
      setStatus('已保存 ' + String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0'), 'ok');
    } catch (e) {
      setStatus('保存失败：存储空间不足，可先导出笔记', 'err');
    }
  }

  var saveTimer = null;
  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(save, 500);
  }

  function escapeText(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br>');
  }

  function isHtml(value) {
    return /<\s*[a-z][^>]*>/i.test(value);
  }

  function insertHtml(html) {
    editor.focus();
    var selection = window.getSelection();
    var range = selection && selection.rangeCount ? selection.getRangeAt(0) : null;
    if ((!range || !editor.contains(range.commonAncestorContainer)) && savedRange && editor.contains(savedRange.commonAncestorContainer)) {
      selection.removeAllRanges();
      selection.addRange(savedRange);
      range = savedRange;
    }
    if (range && editor.contains(range.commonAncestorContainer)) {
      document.execCommand('insertHTML', false, html);
    } else {
      editor.innerHTML = editor.innerHTML + html;
    }
    savedRange = null;
    updateCount();
    scheduleSave();
  }

  var savedRange = null;
  function rememberCaret() {
    var selection = window.getSelection();
    if (selection && selection.rangeCount && editor.contains(selection.getRangeAt(0).commonAncestorContainer)) {
      savedRange = selection.getRangeAt(0).cloneRange();
    }
  }

  function insertImage(file) {
    if (!file || !/^image\//i.test(file.type)) return;
    setStatus('正在插入图片…', '');
    var reader = new FileReader();
    reader.onload = function () {
      var image = new Image();
      image.onload = function () {
        var maxWidth = 1100;
        var width = image.naturalWidth || maxWidth;
        var height = image.naturalHeight || maxWidth;
        var ratio = Math.min(1, maxWidth / width);
        var canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(width * ratio));
        canvas.height = Math.max(1, Math.round(height * ratio));
        var context = canvas.getContext('2d');
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        var data = canvas.toDataURL('image/jpeg', 0.82);
        insertHtml('<img src="' + data + '" alt="笔记截图">');
        setStatus('图片已插入', 'ok');
      };
      image.onerror = function () { setStatus('图片读取失败', 'err'); };
      image.src = reader.result;
    };
    reader.onerror = function () { setStatus('图片读取失败', 'err'); };
    reader.readAsDataURL(file);
  }

  function insertFiles(files) {
    Array.prototype.slice.call(files || []).forEach(function (file) {
      if (/^image\//i.test(file.type)) insertImage(file);
    });
  }

  if (editor) {
    try {
      var saved = localStorage.getItem(NOTES_KEY);
      if (saved) {
        editor.innerHTML = isHtml(saved) ? saved : escapeText(saved);
        setStatus('已恢复上次笔记', 'ok');
      }
    } catch (e) {}
    updateCount();

    editor.addEventListener('input', function () {
      updateCount();
      setStatus('正在保存…', '');
      scheduleSave();
    });
    editor.addEventListener('keydown', function (event) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        save();
      }
    });
    editor.addEventListener('paste', function (event) {
      var data = event.clipboardData;
      if (!data || !data.items) return;
      var files = [];
      for (var i = 0; i < data.items.length; i += 1) {
        var item = data.items[i];
        if (item.kind === 'file' && /^image\//i.test(item.type)) {
          var file = item.getAsFile();
          if (file) files.push(file);
        }
      }
      if (!files.length) return;
      event.preventDefault();
      insertFiles(files);
    });
    editor.addEventListener('dragover', function (event) { event.preventDefault(); });
    editor.addEventListener('drop', function (event) {
      if (!event.dataTransfer) return;
      var files = event.dataTransfer.files;
      if (!files || !files.length) return;
      event.preventDefault();
      insertFiles(files);
    });
    window.addEventListener('beforeunload', save);
  }

  function applyCommand(command, value) {
    if (!editor) return;
    editor.focus();
    if (command === 'formatBlock' && value) value = '<' + value + '>';
    try { document.execCommand(command, false, value || null); } catch (e) {}
    updateCount();
    scheduleSave();
    refreshToolbar();
  }

  function refreshToolbar() {
    if (!toolsBar || !editor || document.activeElement !== editor) return;
    var states = {
      bold: document.queryCommandState('bold'),
      italic: document.queryCommandState('italic'),
      underline: document.queryCommandState('underline'),
      insertUnorderedList: document.queryCommandState('insertUnorderedList'),
      insertOrderedList: document.queryCommandState('insertOrderedList')
    };
    toolsBar.querySelectorAll('[data-note-cmd]').forEach(function (button) {
      var command = button.getAttribute('data-note-cmd');
      button.classList.toggle('is-active', !!states[command]);
    });
    var block = String(document.queryCommandValue('formatBlock') || '').toLowerCase();
    toolsBar.querySelectorAll('[data-note-value]').forEach(function (button) {
      button.classList.toggle('is-active', block === button.getAttribute('data-note-value'));
    });
  }

  if (toolsBar) {
    toolsBar.addEventListener('mousedown', function (event) {
      var button = event.target.closest('[data-note-cmd]');
      if (!button) return;
      event.preventDefault();
      applyCommand(button.getAttribute('data-note-cmd'), button.getAttribute('data-note-value'));
    });
    document.addEventListener('selectionchange', refreshToolbar);
  }

  if (imageBtn && imageInput) {
    imageBtn.addEventListener('mousedown', rememberCaret);
    imageBtn.addEventListener('click', function () { imageInput.click(); });
    imageInput.addEventListener('change', function () {
      insertFiles(imageInput.files);
      imageInput.value = '';
    });
  }

  if (syncBtn) {
    syncBtn.classList.toggle('is-on', syncEnabled);
    syncBtn.setAttribute('aria-pressed', syncEnabled ? 'true' : 'false');
    syncBtn.addEventListener('click', function () {
      syncEnabled = !syncEnabled;
      syncBtn.classList.toggle('is-on', syncEnabled);
      syncBtn.setAttribute('aria-pressed', syncEnabled ? 'true' : 'false');
      try { localStorage.setItem(SYNC_KEY, syncEnabled ? '1' : '0'); } catch (e) {}
      setStatus(syncEnabled ? '同步滚动已开启' : '同步滚动已关闭', '');
    });
  }

  function nodeToMarkdown(node) {
    if (node.nodeType === 3) return (node.nodeValue || '').replace(/\u00a0/g, ' ');
    if (node.nodeType !== 1) return '';
    var tag = node.tagName.toLowerCase();
    if (tag === 'br') return '\n';
    if (tag === 'img') return '\n![截图](' + (node.getAttribute('src') || '') + ')\n';
    var inner = Array.prototype.map.call(node.childNodes, nodeToMarkdown).join('');
    if (tag === 'strong' || tag === 'b') return '**' + inner + '**';
    if (tag === 'em' || tag === 'i') return '*' + inner + '*';
    if (tag === 'li') return '- ' + inner.trim() + '\n';
    if (tag === 'ul' || tag === 'ol') return '\n' + inner + '\n';
    if (/^h[1-6]$/.test(tag)) return '\n' + '#'.repeat(Number(tag.charAt(1))) + ' ' + inner.trim() + '\n';
    if (tag === 'p' || tag === 'div') return '\n' + inner + '\n';
    return inner;
  }

  if (exportBtn) {
    exportBtn.addEventListener('click', function () {
      if (!editor || isEmpty()) {
        setStatus('笔记为空，无需导出', '');
        return;
      }
      var title = (titleEl && titleEl.textContent) || '文献笔记';
      var body = Array.prototype.map.call(editor.childNodes, nodeToMarkdown).join('').replace(/\n{3,}/g, '\n\n').trim();
      var content = '# ' + title + '\n\n来源：' + docKey + '\n\n' + body + '\n';
      var blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
      var link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = title.replace(/[\\/:*?"<>|]/g, '_') + '-笔记.md';
      document.body.appendChild(link);
      link.click();
      setTimeout(function () { URL.revokeObjectURL(link.href); link.remove(); }, 800);
      setStatus('已导出 Markdown', 'ok');
    });
  }

  /* ---------------- 正文与笔记同步滚动 ---------------- */
  var ticking = false;
  docEl.addEventListener('scroll', function () {
    if (!syncEnabled || !editor || ticking) return;
    ticking = true;
    window.requestAnimationFrame(function () {
      ticking = false;
      var docOverflow = docEl.scrollHeight - docEl.clientHeight;
      var noteOverflow = editor.scrollHeight - editor.clientHeight;
      if (docOverflow <= 0 || noteOverflow <= 4) return;
      editor.scrollTop = (docEl.scrollTop / docOverflow) * noteOverflow;
    });
  }, { passive: true });

  /* ---------------- 渲染 ---------------- */
  function fail(message) {
    if (loading) {
      loading.hidden = false;
      loading.textContent = message;
      loading.dataset.tone = 'err';
    }
    mount.innerHTML = '';
  }

  function ready() {
    if (loading) loading.hidden = true;
  }

  function sizeLabel(size) {
    if (!size) return '';
    if (size >= 1024 * 1024) return (size / 1024 / 1024).toFixed(1) + ' MB';
    return Math.max(1, Math.round(size / 1024)) + ' KB';
  }

  function setHeading(item, extra) {
    if (titleEl) titleEl.textContent = item.title || '未命名文献';
    var parts = [];
    if (item.authors) parts.push(item.authors);
    if (item.year) parts.push(item.year);
    if (item.kind) parts.push(String(item.kind).toUpperCase());
    if (item.size) parts.push(sizeLabel(item.size));
    if (extra) parts.push(extra);
    if (metaEl) metaEl.textContent = parts.join(' · ');
    document.title = (item.title || '文献阅读器') + ' · CFD Wiki';
  }

  function mountIframe(url, kind) {
    var frame = document.createElement('iframe');
    frame.className = 'doc-frame';
    frame.title = '文献内容';
    if (kind === 'html') frame.setAttribute('sandbox', 'allow-scripts allow-popups');
    frame.src = url;
    frame.addEventListener('load', ready);
    mount.innerHTML = '';
    mount.appendChild(frame);
    setTimeout(ready, 1500);
  }

  function mountHtml(text) {
    var box = document.createElement('div');
    box.className = 'doc-html';
    box.innerHTML = text;
    mount.innerHTML = '';
    mount.appendChild(box);
    ready();
  }

  function mountPdf(url) {
    if (!window.pdfjsLib || !window.pdfjsLib.getDocument) {
      mountIframe(url, 'pdf');
      return;
    }
    try {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = '../assets/js/pdf.worker.min.js';
    } catch (e) {}

    if (loading) loading.textContent = '正在解析 PDF…';
    var task = window.pdfjsLib.getDocument({ url: url, isEvalSupported: false });
    task.promise
      .then(function (pdf) {
        if (loading) loading.textContent = '正在排版 ' + pdf.numPages + ' 页…';
        var chain = Promise.resolve();
        for (var pageNo = 1; pageNo <= pdf.numPages; pageNo += 1) {
          (function (number) {
            chain = chain.then(function () {
              return pdf.getPage(number).then(function (page) {
                var scale = 1.4;
                var viewport = page.getViewport({ scale: scale });
                var canvas = document.createElement('canvas');
                canvas.className = 'pdf-page';
                canvas.width = Math.floor(viewport.width);
                canvas.height = Math.floor(viewport.height);
                mount.appendChild(canvas);
                return page.render({ canvasContext: canvas.getContext('2d'), viewport: viewport }).promise;
              });
            });
          })(pageNo);
        }
        return chain;
      })
      .then(function () {
        ready();
      })
      .catch(function () {
        mount.innerHTML = '';
        mountIframe(url, 'pdf');
      });
  }

  function mountDocx(text) {
    var style =
      '.doc-html{max-width:860px;margin:0 auto;padding:28px 34px 60px;font:16px/1.85 -apple-system,"Segoe UI","Microsoft YaHei",sans-serif;color:#1c2430;background:#fff;}' +
      '.doc-html h1,.doc-html h2,.doc-html h3{line-height:1.4;margin:1.2em 0 .6em;}' +
      '.doc-html p{margin:0 0 14px;}' +
      '.doc-html table{border-collapse:collapse;width:100%;margin:16px 0;}' +
      '.doc-html td{border:1px solid #d6dbe3;padding:8px 10px;}';
    mountHtml('<style>' + style + '</style>' + text);
  }

  function localFail() {
    fail('本地文献不存在，可能已被浏览器清理。');
  }

  function showLocalDocx(record) {
    if (!window.mammoth) {
      fail('本地模式下没有 DOCX 解析器，请改用 python build.py --serve 上传。');
      return;
    }
    var reader = new FileReader();
    reader.onload = function () {
      window.mammoth
        .convertToHtml({ arrayBuffer: reader.result })
        .then(function (result) { mountDocx(result.value); })
        .catch(function () { fail('DOCX 解析失败，可能文件已损坏。'); });
    };
    reader.onerror = function () { fail('无法读取本地文件。'); };
    reader.readAsArrayBuffer(record.blob);
  }

  function openLocal(id) {
    var request = indexedDB.open('cfdwiki-library', 1);
    request.onerror = function () { fail('无法读取浏览器本地存储。'); };
    request.onsuccess = function () {
      var db = request.result;
      var get = db.transaction('files', 'readonly').objectStore('files').get(id);
      get.onerror = function () { fail('读取本地文献失败。'); };
      get.onsuccess = function () {
        var record = get.result;
        if (!record) return localFail();
        setHeading(record, '本机存储');
        var url = URL.createObjectURL(record.blob);
        if (rawLink) { rawLink.hidden = false; rawLink.href = url; }
        if (downloadLink) {
          downloadLink.hidden = false;
          downloadLink.href = url;
          downloadLink.download = (record.title || 'document') + '.' + (record.kind || 'bin');
        }
        var kind = String(record.kind || '').toLowerCase();
        if (kind === 'pdf') mountPdf(url);
        else if (kind === 'docx') showLocalDocx(record);
        else mountIframe(url, 'html');
      };
    };
  }

  function openRemote(id) {
    var list = Array.isArray(window.__LIBRARY__) ? window.__LIBRARY__ : [];
    var item = list.filter(function (row) { return row.id === id; })[0];
    if (!item) {
      fail('馆藏中找不到这篇文献，可能尚未构建或已被移除。请回到列表刷新。');
      return;
    }
    setHeading(item, '');
    var kind = String(item.kind || '').toLowerCase();
    if (rawLink) { rawLink.hidden = false; rawLink.href = item.file; }
    if (downloadLink) {
      downloadLink.hidden = false;
      downloadLink.href = item.file;
      downloadLink.download = (item.title || 'document') + '.' + kind;
    }

    if (kind === 'docx') {
      if (item.preview) {
        fetch(item.preview)
          .then(function (response) {
            if (!response.ok) throw new Error('preview');
            return response.text();
          })
          .then(mountDocx)
          .catch(function () { mountIframe(item.preview, 'html'); });
      } else {
        fail('这份 DOCX 没有生成 HTML 预览，请通过 python build.py --serve 重新上传。');
      }
    } else if (kind === 'pdf') {
      mountPdf(item.file);
    } else {
      mountIframe(item.file, 'html');
    }
  }

  if (localId) openLocal(localId);
  else if (remoteId) openRemote(remoteId);
  else fail('缺少文献参数。请从文献列表进入。');
})();

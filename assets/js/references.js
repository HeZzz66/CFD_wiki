/* 章节参考文档：上传、列表、在线浏览（PDF / DOCX / PPT） */
(function () {
  'use strict';

  var panel = document.getElementById('chapterRefs');
  if (!panel) return;

  var chapterId = panel.dataset.chapter || '';
  var list = document.getElementById('refList');
  var preview = document.getElementById('refPreview');
  var input = document.getElementById('refInput');
  var btn = document.getElementById('refUploadBtn');
  var status = document.getElementById('refStatus');
  var root = document.body.dataset.root || '';
  var serverMode = location.protocol === 'http:' || location.protocol === 'https:';

  var items = [];
  var ALLOWED = ['.pdf', '.docx', '.html', '.htm', '.ppt', '.pptx'];
  var LIMIT = 200 * 1024 * 1024;

  function extOf(name) {
    var i = name.lastIndexOf('.');
    return i >= 0 ? name.slice(i).toLowerCase() : '';
  }

  function sizeLabel(size) {
    if (size >= 1024 * 1024) return (size / 1024 / 1024).toFixed(1) + ' MB';
    return Math.max(1, Math.round(size / 1024)) + ' KB';
  }

  function setStatus(text, tone) {
    if (!status) return;
    status.textContent = text;
    status.dataset.tone = tone || '';
  }

  function refUrl(item) {
    return root + 'library/refs/' + item.file;
  }

  function render() {
    if (!list) return;
    list.innerHTML = '';
    if (!items.length) {
      list.innerHTML = '<p class="rail-empty">还没有参考文档。上传第一篇论文或讲义，它会出现在这里。</p>';
      return;
    }
    items.forEach(function (item) {
      var row = document.createElement('div');
      row.className = 'ref-item';

      var badge = document.createElement('span');
      badge.className = 'lc-badge';
      badge.textContent = String(item.kind || '').toUpperCase();

      var body = document.createElement('div');
      body.className = 'ref-item-body';
      var title = document.createElement('strong');
      title.className = 'ref-item-title';
      title.textContent = item.title || '未命名文档';
      var meta = document.createElement('span');
      meta.className = 'ref-item-meta';
      var mparts = [sizeLabel(item.size || 0)];
      if (item.added) mparts.push(String(item.added).slice(0, 10));
      meta.textContent = mparts.join(' · ');
      body.appendChild(title);
      body.appendChild(meta);

      var actions = document.createElement('div');
      actions.className = 'ref-item-actions';
      var viewBtn = document.createElement('button');
      viewBtn.className = 'btn btn-ghost';
      viewBtn.type = 'button';
      viewBtn.textContent = '浏览';
      viewBtn.addEventListener('click', function () { openPreview(item); });
      var dl = document.createElement('a');
      dl.className = 'btn btn-ghost';
      dl.textContent = '下载';
      dl.href = refUrl(item);
      dl.setAttribute('download', item.title || '');
      actions.appendChild(viewBtn);
      actions.appendChild(dl);

      row.appendChild(badge);
      row.appendChild(body);
      row.appendChild(actions);
      list.appendChild(row);
    });
  }

  function openPreview(item) {
    if (!preview) return;
    var kind = String(item.kind || '').toLowerCase();
    if (kind === 'pdf') {
      preview.hidden = false;
      preview.innerHTML = '<iframe class="ref-iframe" src="' + refUrl(item) + '" title="' + (item.title || '') + '"></iframe>';
    } else if (kind === 'docx') {
      preview.hidden = false;
      if (item.preview) {
        preview.innerHTML = '<iframe class="ref-iframe" src="' + root + 'library/refs/' + item.preview + '"></iframe>';
      } else {
        preview.innerHTML = '<p class="ref-note">该 DOCX 暂无在线预览，请下载后用 Word 打开。</p>';
      }
    } else if (kind === 'ppt' || kind === 'pptx') {
      preview.hidden = false;
      preview.innerHTML = '<p class="ref-note">PPT 无法在线预览，请下载后用 PowerPoint 打开。</p>';
    } else {
      preview.hidden = false;
      preview.innerHTML = '<iframe class="ref-iframe" src="' + refUrl(item) + '"></iframe>';
    }
  }

  function upload(file) {
    if (!file) return;
    if (ALLOWED.indexOf(extOf(file.name)) === -1) {
      setStatus('仅支持 PDF / DOCX / PPT', 'err');
      return;
    }
    if (file.size > LIMIT) {
      setStatus('文件超过 200 MB 上限', 'err');
      return;
    }
    setStatus('正在上传：' + file.name, '');
    var xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/upload-ref');
    xhr.setRequestHeader('X-Chapter', encodeURIComponent(chapterId));
    xhr.setRequestHeader('X-Filename', encodeURIComponent(file.name));
    xhr.setRequestHeader('X-Title', encodeURIComponent(file.name.replace(/\.[^.]+$/, '')));
    xhr.onload = function () {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          var entry = JSON.parse(xhr.responseText);
          items.unshift(entry);
          render();
          setStatus('已上传', 'ok');
        } catch (e) {
          setStatus('返回数据异常', 'err');
        }
      } else {
        var message = '上传失败';
        try { message = JSON.parse(xhr.responseText).error || message; } catch (e) {}
        setStatus(message, 'err');
      }
    };
    xhr.onerror = function () { setStatus('无法连接本地服务', 'err'); };
    xhr.send(file);
  }

  if (btn) btn.addEventListener('click', function () { if (input) input.click(); });
  if (input) {
    input.addEventListener('change', function () {
      if (!serverMode) {
        setStatus('请先运行 python build.py --serve 再上传', 'err');
        input.value = '';
        return;
      }
      var files = Array.prototype.slice.call(input.files || []);
      if (files.length) upload(files[0]);
      input.value = '';
    });
  }

  function load() {
    var injected = (window.__REFS__ || {})[chapterId] || [];
    items = injected.slice();
    render();
    if (serverMode) {
      fetch('/api/refs?chapter=' + encodeURIComponent(chapterId), { cache: 'no-store' })
        .then(function (r) { return r.json(); })
        .then(function (data) { if (data && data.length) { items = data; render(); } })
        .catch(function () {});
    }
  }

  load();
})();
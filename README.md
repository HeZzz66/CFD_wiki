# CFD Wiki

一个面向计算流体力学（CFD）的静态知识库，视觉与信息架构参考 [OI Wiki](https://oi-wiki.org/)。内容覆盖数学基础、流体力学基本概念、CFD 数值方法、湍流模型、AI for CFD 与工程后处理。

## 本地构建与预览

```bash
# 安装依赖
pip install -r requirements.txt

# 构建（输出到 site/）
python build.py

# 构建并启动本地预览（默认 http://127.0.0.1:8765）
python build.py --serve

# 指定端口 / 清理重建
python build.py --serve --port 9000 --clean
```

> 搜索索引以内嵌脚本 `site/search-index.js` 载入，`file://` 直接双击与 `--serve` 两种方式都能搜索。文献上传在 `file://` 下自动退回浏览器 IndexedDB 存储。

部署时把 `site/` 目录上传到 GitHub Pages、Netlify、Nginx 即可，无需后端。

## 目录结构

```
.
├── build.py                 # 静态站点生成器（唯一构建入口）
├── wiki.json                # 站点标题、描述、许可证
├── requirements.txt
├── content/                 # 只写 Markdown，不写导航表
│   ├── index.md             # 首页正文
│   ├── ch1 ... ch6/
│   │   ├── _chapter.json    # 章节元信息（自动发现）
│   │   ├── index.md         # 章节导览（自动生成“本章内容”卡片）
│   │   └── *.md             # 具体页面
│   └── library/             # 论文与书籍分区（_chapter.json 中 kind: "library"）
├── library/                 # 上传的文献（manifest.json + files/ + previews/）
├── templates/               # Jinja2 模板（base / page / home / library / viewer / 404）
├── assets/                  # CSS、JS、favicon
└── site/                    # 构建产物（可随时删除）
```

## 增加章节或页面

### 新增一章

1. 在 `content/` 下创建目录，例如 `content/ch7/`。
2. 添加 `_chapter.json`：

```json
{
  "title": "传热与多物理场",
  "subtitle": "共轭传热 · 辐射 · 流固耦合",
  "summary": "一句话说明本章解决什么问题。",
  "order": 7,
  "number": "7"
}
```

3. 添加 `content/ch7/index.md` 作为章节导览（`order: 0`），再添加任意数量的 `.md` 页面。
4. 运行 `python build.py`。侧边栏、首页卡片、搜索索引、上下篇导航都会自动更新，**不需要改任何模板或脚本**。

侧边栏按 `kind` 自动分成「基础知识」（前六章）与「阅读文献」（`library` 分区）两个模块，模块标题可点击收起/展开，状态记录在 `localStorage`（键 `cfdwiki:nav-collapsed`）。

### 新增一页

在章节目录下新建 Markdown 文件，例如 `content/ch3/fvm-limiter.md`，写 front matter：

```yaml
---
title: 限制器与高分辨率格式
order: 5
summary: 一句话摘要，会显示在章节卡片和搜索结果中。
tags: [TVD, 限制器, 迎风]
---
```

`order` 越小越靠前；`draft: true` 可让页面在构建时被跳过。文件名（不含扩展名）就是 URL 路径的一部分，建议使用英文短横线命名。

## 论文与书籍分区

`content/library/` 是一个特殊章节：`_chapter.json` 中写 `"kind": "library"`，导航里会自动排到「阅读分区」，并使用 `templates/library.html` 渲染上传区与馆藏列表。

- **上传**：支持 `.pdf`、`.docx`、`.html`，单文件上限 200 MB。
  - `python build.py --serve` 模式：文件写入根目录 `library/files/`，元数据写入 `library/manifest.json`，DOCX 由服务端用标准库转成 HTML 存入 `library/previews/`，可长期保留。
  - 直接打开 `site/index.html`：文件与 blob 存入浏览器 IndexedDB（库名 `cfdwiki-library`），只在本机可见。
- **阅读**：`library/viewer.html?id=<id>` 是左右双栏阅读器。PDF 由内置 pdf.js 逐页渲染到 canvas，DOCX 注入预览 HTML，HTML 走沙箱 iframe；正文与笔记各占一栏。
- **笔记**：阅读器右栏始终是可编辑的富文本笔记框，支持加粗、斜体、下划线、标题、列表，也可按 `Ctrl+V` 粘贴截图、拖入图片或点「图」按钮插入（图片会压缩后内嵌）。按文档存在 `localStorage`（键 `cfdwiki:notes:<id>`），输入自动保存（Ctrl+S 立即保存），正文上下滚动时笔记按比例同步滚动（工具栏「同步」可开关），可一键导出 Markdown。文档页同样有「目录 / 笔记」右栏。

### 文献检索（AI for Science / 神经算子）

馆藏页还内置了一个「文献检索」面板，可自动爬取近 1 年 arXiv、PoF、JFM、JCP、Nature Communications、Nature Machine Intelligence 与 NeurIPS / ICML / ICLR 中「AI for Science（流体力学）」与「神经算子」方向的论文，按关键词分类并给出内容简介。

- **数据源**：全部使用无需密钥的公开接口——arXiv Atom API、Crossref（按 ISSN 过滤期刊）、OpenReview（按投稿 invitation 过滤会议）。
- **关键词**：系统内置了一组默认关键词（neural operator、Fourier neural operator、DeepONet、physics-informed neural network、machine learning fluid dynamics 等），可在面板上删除或添加自定义词。
- **任务一（手动）**：点「执行检索 · 近 1 年」调用 `POST /api/fetch-papers`，检索近 1 年文献，去重后按关键词分组展示，每条含来源、作者、年份与摘要简介。
- **任务二（周定时）**：`python build.py --serve` 启动后，后台线程每分钟检查一次，一旦检测到「跨入新的一周（以每周一为界）」就自动执行一次检索，时间窗取上两周。
- **存储**：结果写入 `library/papers.json`，构建时注入 `site/library-papers.js`（`window.__PAPERS__`），`file://` 直接打开也能看到上次检索结果；`--serve` 模式下实时读取。检索引擎代码位于 `papers_fetch.py`，关键词与调度状态分别存在 `library/fetch_keywords.json` 与 `library/fetch_state.json`。

删除文献时，删掉 `library/files/` 中对应文件并从 `manifest.json` 移除条目，再重新构建即可。

## 文献自动检索（不依赖本地服务）

`papers_fetch.py` 可独立运行，按关键词检索 arXiv、5 本期刊与 NeurIPS/ICML/ICLR，结果写入 `library/papers.json`：

```bash
python papers_fetch.py --days 14 --trigger auto   # 周任务：检索上两周
python papers_fetch.py --days 365                 # 手动：检索近 1 年
```

仓库内置 `.github/workflows/weekly-papers.yml`：

- **每周一 09:00（北京时间）** 自动运行周任务，然后重建站点；
- 在 Actions 页面点「Run workflow」可手动触发，等同页面上的「执行检索」；
- 结果提交回 `library/`，并通过 `peaceiris/actions-gh-pages` 发布到 `gh-pages` 分支。

启用步骤：

1. 把项目推送到 GitHub 并开启 Actions；
2. 仓库 Settings → Pages，Source 选择 `gh-pages` 分支（否则只创建分支、不发布）；
3. 之后无需本地 `--serve`，主页「每周最新文献」展板会自动更新。

> 为什么不能在 `index.html` 里直接跑？浏览器跨域限制：arXiv 与 OpenReview 不返回 CORS 头，公共代理在当前网络也不可用。GitHub Actions 在服务端运行，不受此限制。

## Markdown 扩展语法

### 公式

行内公式用 `$...$`，独立公式用 `$$...$$`：

```markdown
连续性方程为 $\nabla\cdot\mathbf{u}=0$。

$$
\frac{\partial \rho}{\partial t}+\nabla\cdot(\rho\mathbf{u})=0
$$
```

公式由 MathJax 渲染。代码块与行内代码中的 `$` 不会被解析，可安全放入 shell 脚本。

### 站内链接

使用 `[[章节/页面|显示文本]]`，构建器会自动补全相对路径、校验目标是否存在：

```markdown
参见 [[ch3/fvm|有限体积法]]，或直接阅读 [[ch2/governing-equations|N-S 方程]]。
```

### 提示块

```markdown
:::tip 提示
这里写正文，支持 Markdown、公式与代码。
:::
```

类型：`note`、`tip`、`warning`、`danger`、`info`。标题可省略。

### Mermaid 图

````markdown
```mermaid
flowchart LR
  A[网格] --> B[离散] --> C[求解] --> D[后处理]
```
````

构建器会识别 `mermaid` 代码块并注入 Mermaid 渲染脚本，只在该页面需要时加载。

### 代码

使用带语言标记的围栏代码块，构建时由 Pygments 高亮，并自动生成“复制”按钮：

````markdown
```python
def residual(u):
    return -u
```
````

支持 `python`、`cpp`、`fortran`、`bash`、`json`、`yaml` 等常用语言。

## 设计约定

- 页面正文不写一级标题（`#`），标题由 front matter 的 `title` 渲染。
- 章节内的小节从 `##` 开始，右侧目录只收录 `##` 与 `###`。
- 公式中的矢量建议用 `\mathbf{u}`，张量用指标记法并在首次出现时解释。
- 跨章引用优先使用 `[[...]]`，不要把相对路径写死。

## 技术栈

- Python 3.9+
- `markdown`（Markdown 解析、TOC、代码高亮）
- `PyYAML`（front matter）
- `Jinja2`（模板）
- `Pygments`（代码着色）
- 浏览器端：MathJax 3（内置 `assets/js/tex-svg-full.js`）、Mermaid 10（内置 `assets/js/mermaid.min.js`）、Mammoth（内置 `assets/js/mammoth.browser.min.js`，用于浏览器本地解析 DOCX），公式、流程图与文献均可离线渲染

---
title: 检索论文
order: 0
summary: 每周自动检索近两周新论文，年度检索按关键词分类展示近一年 AI for Science 与神经算子文献。
tags: [文献检索, arXiv, 神经算子, 每周任务]
---

这里是自动检索区：不用自己翻期刊目录，站点会按固定关键词去 arXiv、PoF、JFM、JCP、Nature Communications、Nature Machine Intelligence 与 NeurIPS / ICML / ICLR 抓取新论文，并把结果按关键词归类。

## 每周任务与年度检索

- **每周任务**（页面顶部）：每周一自动检索上两周的论文，关键词独立于年度检索，互不影响。面板会显示上次检索时间、下次检索倒计时与本周收录数量，也可以随时点“立即检索本周”。
- **年度检索**：面向近 1 年，按关键词分组，每组先展示 6 篇；点 `more` 进入全部结果页面。适合做方向调研，而不是追新。

两个任务的数据都写在 `library/` 下的 JSON 中，周任务只增不减，不会覆盖历史记录。

## 接下来读什么

检索到论文之后，通常有两条路：

1. 想先通读原文、做批注 → 上传到[在读文献](../reading/index.html)，用富文本笔记边读边记，再把要点导入个人知识库。
2. 想系统补教材 → 到[书籍](../books/index.html)上传或浏览 PDF / DOCX 教材、手册与技术报告。

:::tip 关键词策略
每周任务的关键词宜窄（例如 `PINN turbulence`、`neural operator CFD`），年度检索的关键词宜宽（例如 `turbulence closure`、`reduced order model`）。窄词保证新论文不漏，宽词保证综述时覆盖面够。
:::

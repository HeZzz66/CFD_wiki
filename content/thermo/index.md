---
title: 本章导览
order: 0
summary: 本章补齐 CFD 的热物理基础：状态方程与相平衡、傅里叶导热、对流换热关联式、辐射换热网络，以及换热器与共轭传热的建模流程，形成从物性到整机性能的闭环。
tags: [热力学, 传热学, 学习路径]
---

CFD 经常被当作“解 N-S 方程”的同义词，但工程问题里真正难算的往往是能量：燃烧室出口温度、电池包最高温、凝汽器真空度、散热器翅片效率。这些问题的共同点是**能量方程与物性、相变、辐射耦合**。本章不重复本科热力学，而是挑出 CFD 真正会用到的部分，并把它们与求解器里的选项一一对应。

## 本章在全书中的位置

第二章的能量方程给出的是框架：

$$
\frac{\partial(\rho E)}{\partial t}
+\nabla\cdot\left[\mathbf{u}\left(\rho E+p\right)\right]
=\nabla\cdot\left(k\nabla T\right)+\cdots
$$

但框架里每个系数从哪来、什么时候可以简化，需要本章回答：

- [[thermo/thermodynamics|热力学基础与状态方程]] 给出 $\rho(p,T)$、$h(T)$ 与相平衡；
- [[thermo/conduction|导热与傅里叶定律]] 给出固体侧的温度场与热阻；
- [[thermo/convection|对流换热与边界层]] 给出壁面 $h$ 与 $Nu$ 关联式；
- [[thermo/radiation|辐射换热]] 给出高温工况下不可忽略的第四种热流；
- [[thermo/heat-exchanger-cfd|换热器与 CFD 耦合]] 把这些工具组装成整机模型。

本章与 [[multiphase/index|两相流与多相流]] 的分工也很清楚：两相流章节关心“相怎么分布、压降怎么算”，本章关心“相变吸放多少热、壁温是多少”。沸腾与凝结的关联式在两章中都会出现，只是侧重点不同。

## 章节地图

| 顺序 | 页面 | 要解决的问题 | 读完后应能 |
| --- | --- | --- | --- |
| 1 | [[thermo/thermodynamics|热力学基础与状态方程]] | 密度、焓、熵怎么由 $p$、$T$ 得到？ | 判断该用理想气体还是 PR/IF97，会用等熵关系与声速 |
| 2 | [[thermo/conduction|导热与傅里叶定律]] | 固体内部温度怎么分布？ | 用热阻网络算多层壁，估肋片效率与瞬态温升 |
| 3 | [[thermo/convection|对流换热与边界层]] | 壁面换热系数怎么取？ | 选对 Dittus–Boelter、Gnielinski、Churchill–Bernstein 等关联式 |
| 4 | [[thermo/radiation|辐射换热]] | 高温下辐射占多少？ | 用灰体网络算两面封闭腔，判断何时需要 DO/P1 模型 |
| 5 | [[thermo/heat-exchanger-cfd|换热器与 CFD 耦合]] | 怎么把传热算到整机？ | 用 LMTD/ε-NTU 选型，设计周期性单元与共轭传热算例 |

## 三条阅读建议

**第一条：用“一个散热器”贯穿全章。** 假设要给一块 100 W 的芯片设计铝挤散热器：读热力学时确定空气物性与密度；读导热时算翅片效率与接触热阻；读对流时用 Churchill–Chu 或平板关联式估自然对流 $h$；读辐射时判断 60 ℃ 表面辐射是否可忽略；读换热器时用 ε-NTU 校核整体热阻。五页内容在同一个对象上汇合，比抽象推导更容易记住。

**第二条：先判断“哪个热阻最大”，再算细节。** 传热问题永远是串联热阻：对流、导热、接触、污垢、辐射并联。先估各项量级，找出主导项，再决定要不要精确计算它。把 90% 的精力花在占 5% 的热阻上，是工程计算最常见的浪费。

**第三条：把关联式的适用区间当成公式的一部分。** $Nu=0.023Re^{0.8}Pr^{0.4}$ 只在 $Re>10^4$、充分发展湍流、物性变化不大时成立。离开这个区间，它给出的数仍然“看起来合理”，但可能偏差一倍。每次引用关联式，都写下 $Re$、$Pr$ 范围与特征长度。

:::tip 和其他章节的衔接
本章的 $Nu$ 与 $h$ 是 [[ch2/boundary-layer|边界层]] 的定量延伸；本章的导热离散与 [[ch3/fvm|有限体积法]] 使用同一套面通量思想；本章的辐射源项与 [[ch4/rans|RANS]] 中的温度输运方程耦合；相变换热则直接连到 [[multiphase/boiling-condensation|沸腾与凝结传热]]。
:::

## 一条贯穿全章的线索

以“高温烟气加热管内的水”为例：

1. 烟气侧：CO$_2$ 与 H$_2$O 在 1000 K 下辐射显著，用 [[thermo/radiation|WSGG + DO]] 算辐射热流；
2. 管壁：导热热阻与污垢热阻串联，用 [[thermo/conduction|热阻网络]] 算壁温；
3. 水侧：过冷段用 [[thermo/convection|Dittus–Boelter]]，沸腾段切换到 [[multiphase/boiling-condensation|Chen 关联式]]；
4. 整体：用 [[thermo/heat-exchanger-cfd|ε-NTU]] 校核换热量与出口温度；
5. 若壁温接近材料极限，还要回到辐射与沸腾两侧，检查 CHF 裕度。

这条链条说明：传热不是一门孤立的课，而是把物性、边界层、辐射与相变串起来的系统分析。

## 读完本章的自检清单

1. 给定 $p$、$T$ 与工质，能否判断理想气体假设是否成立？误差大概多少？
2. 能否写出平板、圆筒、球壳的导热热阻，并解释为什么圆筒是对数分布？
3. 给定 $h$、$k$、$L$，能否算出 $Bi$ 并判断是否可用集总参数法？
4. 能否说出 Dittus–Boelter 与 Gnielinski 的适用区间，并解释为什么后者覆盖过渡区？
5. 给定两块平行板的温度与发射率，能否算出辐射热流？插入辐射屏后如何变化？
6. 给定换热器的四个温度与流量，能否用 LMTD 与 ε-NTU 互相校核？

如果其中任何一题卡住，回到对应页面重读那一节。本章的公式都可以查手册，真正需要掌握的是**什么时候用哪一个、以及结果是否在物理上合理**。

## 推荐教材

- Incropera, F. P., DeWitt, D. P. *Fundamentals of Heat and Mass Transfer*, 7th ed. Wiley, 2011.（传热学标准教材，关联式与图表齐全）
- Çengel, Y. A., Ghajar, A. J. *Heat and Mass Transfer*, 6th ed. McGraw-Hill, 2020.（叙述直观，工程案例多）
- Bird, R. B., Stewart, W. E., Lightfoot, E. N. *Transport Phenomena*, 2nd ed. Wiley, 2006.（动量、能量、质量传递的统一框架）
- Kays, W. M., Crawford, M. E., Weigand, B. *Convective Heat and Mass Transfer*, 4th ed. McGraw-Hill, 2005.（对流换热的深入推导）
- Patankar, S. V. *Numerical Heat Transfer and Fluid Flow*. Hemisphere, 1980.（导热与对流离散的经典，SIMPLE 算法的出处）

建议以 Incropera 为主教材，遇到关联式选择问题时查 Çengel 的工程案例，需要推导边界层与类比关系时翻 Kays，做数值实现时对照 Patankar。

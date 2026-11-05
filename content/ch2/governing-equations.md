---
title: 守恒方程与 N-S 方程
order: 3
summary: 从雷诺输运定理推导连续性方程、Cauchy 动量方程与能量方程，给出牛顿本构下的 Navier-Stokes 形式、封闭性讨论、边界条件与无量纲化。
tags: [N-S方程, 连续性方程, 动量方程, 能量方程]
---

运动学只描述速度场长什么样，不回答它为什么这样。守恒方程给出因果：质量不能凭空产生，动量变化等于外力，能量只能转移或转化。本页从雷诺输运定理出发，把三条守恒律写成积分与微分两种形式，最后讨论封闭性与边界条件。这是全书物理部分的核心，也是 [[ch3/fvm|有限体积法]] 直接离散的对象。

## 系统与控制体

**系统**（system）是固定的一团流体质点，边界随流体运动；**控制体**（control volume, CV）是空间中固定的一个区域，流体不断穿过它的边界。拉格朗日视角用系统，欧拉视角用控制体。两者之间的换算是雷诺输运定理：

$$
\frac{d}{dt}\int_{V(t)}\phi\,dV
=\int_V\frac{\partial\phi}{\partial t}\,dV
+\oint_{\partial V}\phi\,\mathbf{u}\cdot\mathbf{n}\,dS,
$$

其中 $\phi$ 是单位体积的某种量（质量、动量、能量），$\mathbf{n}$ 为外法向。左边是“系统总量的变化率”，右边第一项是控制体内随时间的变化，第二项是穿过边界的净流出通量。若控制体边界以速度 $\mathbf{u}_b$ 运动，把 $\mathbf{u}$ 换成相对速度 $\mathbf{u}-\mathbf{u}_b$ 即可；网格变形、动网格与流固耦合都使用这个修正。

雷诺输运定理的价值在于：它把对“运动系统”的求导，换成对“固定区域”的积分加表面通量。有限体积法正是逐单元计算这些面通量，因此不需要显式求空间导数。

## 连续性方程

取 $\phi=\rho$。系统质量不变，因此

$$
\frac{d}{dt}\int_V\rho\,dV+\oint_{\partial V}\rho\,\mathbf{u}\cdot\mathbf{n}\,dS=0.
$$

对任意控制体，由高斯定理把面积分化为体积分，得到微分形式

$$
\frac{\partial\rho}{\partial t}+\nabla\cdot(\rho\mathbf{u})=0.
$$

这是**守恒型**（conservative form），散度作用在 $\rho\mathbf{u}$ 整体上。展开散度可得**非守恒型**：

$$
\frac{\partial\rho}{\partial t}+\mathbf{u}\cdot\nabla\rho+\rho\nabla\cdot\mathbf{u}=0
\quad\Longleftrightarrow\quad
\frac{D\rho}{Dt}+\rho\nabla\cdot\mathbf{u}=0.
$$

两式在数学上等价，但在数值上不等价：只有守恒型离散才能保证跨间断（如激波）的质量守恒。做可压缩流动时，这一区别会直接决定激波位置与强度是否正确。

不可压缩流动满足

$$
\nabla\cdot\mathbf{u}=0.
$$

再次强调，这是对速度场的约束，并不要求 $\rho$ 为常数。密度可以随温度变化，只要在连续性方程中被消去；自然对流、多组分混合都采用这种处理。

## 动量方程

对系统用牛顿第二定律，$\phi=\rho\mathbf{u}$。表面力由应力张量 $\boldsymbol{\sigma}$ 描述，体积力记为 $\rho\mathbf{f}$。Cauchy 应力形式为

$$
\rho\frac{D\mathbf{u}}{Dt}=\nabla\cdot\boldsymbol{\sigma}+\rho\mathbf{f}.
$$

应力张量分解为各向同性压力与偏应力：

$$
\boldsymbol{\sigma}=-p\mathbf{I}+\boldsymbol{\tau}.
$$

对牛顿流体，偏应力与变形率成正比：

$$
\boldsymbol{\tau}=\mu\left(\nabla\mathbf{u}+(\nabla\mathbf{u})^{\mathsf{T}}\right)-\frac{2}{3}\mu\left(\nabla\cdot\mathbf{u}\right)\mathbf{I}.
$$

第二项保证体积粘性在不可压缩极限下不产生额外正应力；对不可压缩流动 $\nabla\cdot\mathbf{u}=0$，它自动消失。代入 Cauchy 方程得到**Navier-Stokes 方程**：

$$
\rho\frac{D\mathbf{u}}{Dt}
=-\nabla p
+\nabla\cdot\left[\mu\left(\nabla\mathbf{u}+(\nabla\mathbf{u})^{\mathsf{T}}\right)\right]
+\rho\mathbf{f}.
$$

常物性、不可压缩时简化为最常见的形式：

$$
\rho\left(\frac{\partial\mathbf{u}}{\partial t}+(\mathbf{u}\cdot\nabla)\mathbf{u}\right)
=-\nabla p+\mu\nabla^2\mathbf{u}+\rho\mathbf{f}.
$$

各项的物理含义可以用一张表对照：

| 项 | 数学形式 | 物理意义 | 数值处理要点 |
| --- | --- | --- | --- |
| 当地加速度 | $\partial\mathbf{u}/\partial t$ | 固定点的速度变化 | 非定常项，时间推进格式 |
| 对流项 | $(\mathbf{u}\cdot\nabla)\mathbf{u}$ | 流体携带自身动量 | 非线性，需迎风/限制器 |
| 压力梯度 | $-\nabla p$ | 高压指向低压的力 | 与连续性耦合，需压力修正 |
| 粘性扩散 | $\mu\nabla^2\mathbf{u}$ | 动量在邻近流体间扩散 | 壁面附近梯度大，需加密 |
| 体积力 | $\rho\mathbf{f}$ | 重力、电磁力、离心力 | 浮力常用 Boussinesq |

可压缩流动更常写**守恒型通量形式**，便于有限体积离散与激波捕捉：

$$
\frac{\partial(\rho\mathbf{u})}{\partial t}
+\nabla\cdot\left(\rho\mathbf{u}\mathbf{u}+p\mathbf{I}-\boldsymbol{\tau}\right)
=\rho\mathbf{f},
$$

其中 $\rho\mathbf{u}\mathbf{u}$ 是并矢（二阶张量），$(\rho\mathbf{u}\mathbf{u})_{ij}=\rho u_i u_j$。它把“动量被速度输运”写成面通量，正是 [[ch3/fvm|有限体积法]] 中通量重构的起点。

## 能量方程

取 $\phi=\rho E$，$E=e+\frac{1}{2}u_iu_i$ 为单位质量的总能量，$e$ 为内能。总能量守恒的微分形式为

$$
\frac{\partial(\rho E)}{\partial t}+\nabla\cdot(\rho E\mathbf{u})
=\nabla\cdot(\boldsymbol{\sigma}\cdot\mathbf{u})
+\nabla\cdot(k\nabla T)
+\rho\mathbf{f}\cdot\mathbf{u}
+\dot q_v,
$$

右端依次是应力做功、热传导、体积力做功与体积热源。$k$ 为导热系数，$\dot q_v$ 为单位体积热源（如化学反应、焦耳热）。

把动能方程从中减去，得到内能形式。对不可压缩、常物性流体，粘性耗散与热传导占主导，温度方程可写为

$$
\rho c_p\frac{DT}{Dt}=\nabla\cdot(k\nabla T)+\Phi,
$$

其中粘性耗散函数

$$
\Phi=\boldsymbol{\tau}:\nabla\mathbf{u}\ge 0
$$

表示机械能不可逆地转化为热。低速流动中 $\Phi$ 通常远小于对流与传导项，可以忽略；但在高剪切润滑、粘性泵与微通道中它可能是主要热源。

温度形式与总能形式的差别不只是代数化简。总能形式保留动能与压力功，能正确描述激波、高速压缩与膨胀；温度形式默认动能变化可忽略、压力功已通过连续性方程消去，因此只适用于低 $Ma$ 流动。当 $Ma>0.3$ 或存在激波时，必须回到总能形式，否则会出现“温度算对了、总压算错了”的问题。

## 状态方程与封闭性

未知量有 $\rho$、三个速度分量、$p$、$T$，共六个；连续性 1 个、动量 3 个、能量 1 个，共五个方程。因此还需要一个状态方程把 $p$、$\rho$、$T$ 联系起来：

$$
p=p(\rho,T),\qquad e=e(\rho,T).
$$

理想气体取 $p=\rho RT$、$e=c_vT$，并满足 $R=c_p-c_v$、$\gamma=c_p/c_v$。真实气体、超临界流体与相变问题则需要更复杂的状态方程，且往往要把求解变量从原始变量切换到守恒变量，以保证间断处的正确性。

不可压缩流动不需要状态方程求压力，因为密度已知；压力由连续性方程作为约束确定，这正是压力泊松方程与投影法的来源。若存在温度差引起的浮力，采用 **Boussinesq 近似**：

$$
\rho=\rho_0\left[1-\beta\left(T-T_0\right)\right],
$$

且只在体积力项中保留这个密度变化，其余项仍用 $\rho_0$。这样既捕捉了热对流，又避免了可压缩求解器的小时间步限制。

## 边界条件与初始条件

N-S 方程是二阶偏微分方程，需要给定边界上的速度或应力、温度或热流。常见类型如下：

| 类型 | 数学表达 | 适用场景 | 备注 |
| --- | --- | --- | --- |
| 无滑移壁面 | $\mathbf{u}=0$ | 固体壁面 | 最常用，需解析边界层 |
| 移动壁面 | $\mathbf{u}=\mathbf{U}_w$ | 旋转机械、履带 | 注意壁面法向分量为零 |
| 入口速度 | $\mathbf{u}=\mathbf{u}_{in}$ | 管道、风洞入口 | 需给出湍流参数 |
| 出口压力 | $p=p_{out}$ | 开放出口 | 常配合零梯度速度 |
| 远场 | 特征边界 | 外流、飞行器 | 允许波出入 |
| 周期 | $\phi(\mathbf{x}+\mathbf{L})=\phi(\mathbf{x})$ | 充分发展、叶栅 | 需保证净通量平衡 |
| 对称 | $u_n=0,\ \partial u_t/\partial n=0$ | 对称面 | 减少计算量 |

初始条件同样重要。定常问题用初值作为迭代起点，初值越接近解，收敛越快；非定常问题初值决定瞬态过程，物理上应给出与边界一致的场。不可压缩求解器还要求初始速度场满足 $\nabla\cdot\mathbf{u}=0$，否则第一步就会产生虚假压力波。边界条件的数量与位置必须与方程类型匹配，详见 [[ch1/pde-foundations|偏微分方程基础]]。

## 无量纲化与相似参数

取特征长度 $L$、特征速度 $U$、特征时间 $L/U$、特征压力 $\rho U^2$，定义

$$
\mathbf{x}^*=\frac{\mathbf{x}}{L},\quad
\mathbf{u}^*=\frac{\mathbf{u}}{U},\quad
t^*=\frac{tU}{L},\quad
p^*=\frac{p}{\rho U^2}.
$$

代入不可压缩 N-S 方程，得到

$$
\frac{\partial\mathbf{u}^*}{\partial t^*}
+(\mathbf{u}^*\cdot\nabla^*)\mathbf{u}^*
=-\nabla^*p^*+\frac{1}{Re}\nabla^{*2}\mathbf{u}^*+\frac{1}{Fr^2}\mathbf{g}^*,
$$

其中

$$
Re=\frac{\rho UL}{\mu},\qquad
Fr=\frac{U}{\sqrt{gL}},\qquad
Ma=\frac{U}{a}.
$$

$Re$ 衡量惯性力与粘性力之比，决定层流还是湍流；$Fr$ 衡量惯性力与重力之比，决定自由表面与浮力效应；$Ma$ 衡量可压缩性。三个参数一旦确定，几何相似的流动在无量纲意义上就等价，这是风洞缩比实验与 CFD 验证的基础，也是在 [[ch5/benchmarks|基准算例]] 中对比不同求解器的前提。

## 汇总

| 方程 | 守恒量 | 积分形式 | 微分形式 |
| --- | --- | --- | --- |
| 连续性 | 质量 | $\dfrac{d}{dt}\int_V\rho\,dV+\oint_S\rho\mathbf{u}\cdot\mathbf{n}\,dS=0$ | $\partial_t\rho+\nabla\cdot(\rho\mathbf{u})=0$ |
| 动量 | 动量 | $\dfrac{d}{dt}\int_V\rho\mathbf{u}\,dV+\oint_S\rho\mathbf{u}(\mathbf{u}\cdot\mathbf{n})\,dS=\int_V\rho\mathbf{f}\,dV+\oint_S\boldsymbol{\sigma}\cdot\mathbf{n}\,dS$ | $\rho\,D\mathbf{u}/Dt=\nabla\cdot\boldsymbol{\sigma}+\rho\mathbf{f}$ |
| 能量 | 总能量 | $\dfrac{d}{dt}\int_V\rho E\,dV+\oint_S\rho E\mathbf{u}\cdot\mathbf{n}\,dS=\dot W+\dot Q$ | $\partial_t(\rho E)+\nabla\cdot(\rho E\mathbf{u})=\nabla\cdot(\boldsymbol{\sigma}\cdot\mathbf{u})+\nabla\cdot(k\nabla T)+\dot q_v$ |

三行结构完全一致：左边是“总量变化 + 净流出”，右边是“源与汇”。这种统一形式正是守恒型离散可以逐项对应到面通量的原因。

:::tip 下一步
把本页的微分方程放到网格上，就进入 [[ch3/fvm|有限体积法]]；把速度分解为平均与脉动并对方程取平均，就进入 [[ch4/rans|RANS]]。若只想先获得可手算的近似，可跳到 [[ch2/bernoulli-integral|伯努利方程]] 做沿流线积分。
:::

---
title: 流动的运动学描述
order: 2
summary: 介绍拉格朗日与欧拉两种描述、物质导数的推导、流线/迹线/脉线的区别，以及速度梯度张量的变形率-旋转分解与涡量、环量、速度势。
tags: [运动学, 物质导数, 流线, 涡量]
---

上一页把流体当作连续介质，并给出了物性参数。这一页只做一件事：描述它怎么动。同一股水流，可以跟着一个质点走，也可以站在岸边看固定位置的速度变化。两种视角及其换算，构成了运动学的全部内容；守恒方程中的对流项、涡量动力学与湍流中的旋转结构，都建立在这里。

## 拉格朗日描述与欧拉描述

**拉格朗日描述**给每个流体质点贴一个永久标签 $\mathbf{a}=(a,b,c)$（通常是初始位置），再用它的位置函数描述运动：

$$
\mathbf{x}=\mathbf{X}(\mathbf{a},t),
\qquad
\mathbf{u}(\mathbf{a},t)=\frac{\partial\mathbf{X}(\mathbf{a},t)}{\partial t}.
$$

这种描述像“跟踪每个乘客”，适合固体力学、质点轨迹与粒子追踪，但在流体中要跟踪无穷多质点，实际很少直接使用。

**欧拉描述**不关心质点身份，只在固定空间点上记录场量：

$$
\mathbf{u}=\mathbf{u}(\mathbf{x},t),\qquad p=p(\mathbf{x},t),\qquad \rho=\rho(\mathbf{x},t).
$$

CFD 几乎全部采用欧拉描述，因为网格固定在空间，求解器只需要知道每个网格点上的值。代价是：欧拉场看不到“这个质点从哪里来”。

两者通过**物质导数**连接。设某个质点当前位于 $\mathbf{x}$，其标签为 $\mathbf{a}$，则标量 $\phi$ 沿质点轨迹的变化率为

$$
\frac{D\phi}{Dt}
=\frac{\partial\phi}{\partial t}
+u_j\frac{\partial\phi}{\partial x_j}
=\frac{\partial\phi}{\partial t}+\mathbf{u}\cdot\nabla\phi.
$$

推导只需对 $\phi(\mathbf{X}(\mathbf{a},t),t)$ 用链式法则：固定标签 $\mathbf{a}$ 时，$\partial\mathbf{x}/\partial t=\mathbf{u}$，于是位置变化项就变成对流项。第一项是当地变化率（站在岸边看到的），第二项是对流变化率（被水流带到新位置看到的不同值）。两者相加才是质点自身的感受。

对速度本身取物质导数，得到加速度：

$$
\mathbf{a}=\frac{D\mathbf{u}}{Dt}
=\frac{\partial\mathbf{u}}{\partial t}+(\mathbf{u}\cdot\nabla)\mathbf{u}.
$$

注意对流项 $(\mathbf{u}\cdot\nabla)\mathbf{u}$ 对速度是二次的，这是 N-S 方程非线性的来源，也是湍流、激波与涡破碎的数学根源。

## 流线、迹线、脉线

三种曲线常被混淆，区别在于“描的是谁的历史”。

**流线**在某一瞬间与当地速度矢量相切，方程为一阶常微分方程组：

$$
\frac{dx}{u}=\frac{dy}{v}=\frac{dz}{w}.
$$

流线是“瞬时照片”，同一时刻不同流线上的点没有时间关联。

**迹线**是单个质点在一段时间内的运动轨迹，满足

$$
\frac{d\mathbf{x}}{dt}=\mathbf{u}(\mathbf{x},t),
$$

初值是该质点在起始时刻的位置。

**脉线**（streakline）是先后经过同一固定点的所有质点在同一时刻的连线，例如烟囱冒出的烟柱、风洞中从排烟针头流出的烟线。

| 曲线 | 定义 | 依赖时间 | 何时三者重合 |
| --- | --- | --- | --- |
| 流线 | 瞬时速度场的切线 | 只取某一时刻 | 定常流动 |
| 迹线 | 单个质点的轨迹 | 需要一段历史 | 定常流动 |
| 脉线 | 经过同一点的所有质点当前位置 | 需要一段历史 | 定常流动 |

在定常流动中，流线形状不随时间变化，质点必然沿流线运动，因此三者重合；在非定常流动中，流线会随时间变形，质点轨迹与瞬时流线不再相同。实验中向流场注入示踪剂拍到的多是脉线，数值后处理画出的多是流线，比较两者时要注意这一差别。

由相邻流线围成的管状区域称为**流管**。定常流动中流管壁面与速度相切，没有质量穿过，因此管内质量流量守恒：

$$
\dot{m}=\int_A\rho\,\mathbf{u}\cdot\mathbf{n}\,dA.
$$

对不可压缩、截面积 $A_1,A_2$ 的流管，$\dot{m}=\rho A_1u_1=\rho A_2u_2$，这就是连续性方程的一维形式，也是文丘里流量计的出发点。

## 速度梯度张量的分解

速度场的一阶信息全部包含在速度梯度张量 $\nabla\mathbf{u}$ 中，其分量为 $L_{ij}=\partial u_i/\partial x_j$。把它拆成对称与反对称两部分：

$$
\nabla\mathbf{u}=\mathbf{S}+\mathbf{W},
$$

$$
S_{ij}=\frac{1}{2}\left(\frac{\partial u_i}{\partial x_j}+\frac{\partial u_j}{\partial x_i}\right),
\qquad
W_{ij}=\frac{1}{2}\left(\frac{\partial u_i}{\partial x_j}-\frac{\partial u_j}{\partial x_i}\right).
$$

$\mathbf{S}$ 称为**变形率张量**，对称，描述流体微元如何被拉长、压扁与剪切；$\mathbf{W}$ 称为**旋转率张量**，反对称，描述微元如何刚体旋转。它们的迹满足

$$
\mathrm{tr}(\mathbf{S})=\nabla\cdot\mathbf{u},
$$

即体积膨胀率。不可压缩时 $\nabla\cdot\mathbf{u}=0$，微元体积不变，但形状可以任意变化。

一个容易误解的例子是简单剪切流 $u=\dot\gamma y,\ v=0$，其中 $\dot\gamma$ 为剪切率。此时

$$
S_{12}=S_{21}=\frac{\dot\gamma}{2},\qquad
W_{12}=-W_{21}=-\frac{\dot\gamma}{2},\qquad
\omega_z=-\dot\gamma.
$$

也就是说，纯剪切同时包含“角变形”和“旋转”两部分，且各占一半。这解释了为什么剪切流有涡量却不一定是“看得见的旋涡”：涡量度量的是微元的平均旋转，而不是流线的弯曲程度。

## 涡量、环量与速度势

**涡量**定义为速度的旋度：

$$
\boldsymbol{\omega}=\nabla\times\mathbf{u}.
$$

**环量**是速度沿闭合曲线的线积分，由斯托克斯定理与涡量联系起来：

$$
\Gamma=\oint_C\mathbf{u}\cdot d\mathbf{l}
=\int_S\boldsymbol{\omega}\cdot\mathbf{n}\,dS.
$$

若流场处处无旋（$\boldsymbol{\omega}=0$），则环量为零，速度可以写成某个标量的梯度：

$$
\mathbf{u}=\nabla\phi,
$$

$\phi$ 称为**速度势**。代入不可压缩连续性方程 $\nabla\cdot\mathbf{u}=0$，得到拉普拉斯方程

$$
\nabla^2\phi=0.
$$

势流理论因此只需要解一个线性方程，这是它在大飞机气动初步设计、地下水渗流与电渗流中仍然好用的原因。但势流无法产生阻力与边界层，真实流动的壁面剪切必须回到 [[ch2/boundary-layer|边界层]] 中处理。

两个标准例子可以校准对涡量的直觉。刚体旋转 $u_\theta=\Omega r$ 的涡量为 $2\Omega$，处处非零；自由涡 $u_\theta=\Gamma/(2\pi r)$ 在 $r>0$ 处涡量为零，但包围原点的环量为 $\Gamma$，涡量集中在原点，这正是 [[ch1/field-theory|场论]] 中讨论过的奇异涡量。CFD 后处理中的 Q 判据、λ₂ 判据，本质上都是在速度梯度张量上寻找“旋转强于变形”的区域，见 [[ch4/les|大涡模拟]]。

## 二维算例：驻点流

考虑平面驻点流

$$
u=ax,\qquad v=-ay,\qquad a>0.
$$

先算散度与涡量：

$$
\nabla\cdot\mathbf{u}=\frac{\partial u}{\partial x}+\frac{\partial v}{\partial y}=a-a=0,
$$

$$
\omega_z=\frac{\partial v}{\partial x}-\frac{\partial u}{\partial y}=0.
$$

流场不可压缩且无旋，因此存在速度势 $\phi=\frac{a}{2}(x^2-y^2)$。流线满足

$$
\frac{dx}{ax}=\frac{dy}{-ay}
\quad\Longrightarrow\quad
\frac{dy}{dx}=-\frac{y}{x}
\quad\Longrightarrow\quad
xy=C.
$$

流线是双曲线族：沿 $x$ 轴流体冲向原点后向两侧分流，沿 $y$ 轴则被拉伸，这正是“驻点”名称的来源。

下面的代码用 `numpy` 与 `matplotlib` 画出这组流线，只需几行：

```python
import numpy as np
import matplotlib.pyplot as plt

# 平面驻点流 u = a*x, v = -a*y，散度与涡量均为零
a = 1.0
x = np.linspace(-1.0, 1.0, 120)
y = np.linspace(-1.0, 1.0, 120)
X, Y = np.meshgrid(x, y)
U, V = a * X, -a * Y

fig, ax = plt.subplots(figsize=(5, 5))
ax.streamplot(X, Y, U, V, density=1.3, color="steelblue", linewidth=1.0)
ax.set_aspect("equal")
ax.set_xlim(-1, 1)
ax.set_ylim(-1, 1)
ax.set_xlabel("x")
ax.set_ylabel("y")
plt.show()
```

若把速度场改成 $u=-ay,\ v=ax$，散度仍为零但涡量变为 $2a$，`streamplot` 画出的图案会是同心圆：流线弯曲，但每个微元也在绕自身中心旋转。把两幅图放在一起看，就能直观区分“流线弯”与“流体转”。

:::note 数值涡量的精度
用差分从离散速度场计算涡量时，结果对网格尺度敏感。粗网格会把集中的涡量抹平，壁面附近则容易受单侧差分影响。做涡结构识别前，应先确认网格分辨率足以解析目标涡的直径，否则 Q 判据给出的只是数值噪声。
:::

## 小结

- 拉格朗日跟踪质点，欧拉观察空间点；物质导数 $\mathrm{D}/\mathrm{D}t=\partial_t+\mathbf{u}\cdot\nabla$ 是两者之间的翻译器。
- 流线是瞬时照片，迹线与脉线包含历史；定常流动中三者重合。
- 速度梯度分解为变形率 $\mathbf{S}$ 与旋转率 $\mathbf{W}$，涡量是 $\mathbf{W}$ 的直接体现。
- 无旋流动可引入速度势，把连续性方程化为拉普拉斯方程。

这些量下一步会直接进入 [[ch2/governing-equations|守恒方程]]：物质导数给出加速度，$\nabla\cdot\mathbf{u}$ 进入连续性方程，$\mathbf{S}$ 进入牛顿本构关系。

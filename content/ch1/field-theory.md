---
title: 场论基础
order: 1
summary: 从标量场与矢量场出发，整理梯度、散度、旋度、拉普拉斯算子、高斯散度定理与斯托克斯定理，并说明它们在流体力学中的物理含义。
tags: [场论, 梯度, 散度, 旋度, 高斯定理]
---

流体力学中的每一个守恒律，最终都可以写成“某个场量的空间导数 + 时间导数 = 源项”。因此，场论不是数学系的选修课，而是读懂 N-S 方程的第一把钥匙。这一节只保留 CFD 中真正高频使用的部分：三种一阶运算、两种积分定理、一套恒等式。

## 标量场与矢量场

**标量场**给空间中每一点赋一个数，例如压力 $p(\mathbf{x},t)$、温度 $T(\mathbf{x},t)$、密度 $\rho(\mathbf{x},t)$。**矢量场**给每一点赋一个矢量，例如速度 $\mathbf{u}(\mathbf{x},t)$、涡量 $\boldsymbol{\omega}(\mathbf{x},t)$、电场 $\mathbf{E}$。

在 CFD 中，我们关心的不是单个点的值，而是场的**局部变化率**。若把场想象成地形图，标量场的高度变化用梯度描述，矢量场的“源/汇”用散度描述，“旋转”用旋度描述。

设笛卡尔坐标基为 $\mathbf{e}_x,\mathbf{e}_y,\mathbf{e}_z$，位置矢量与速度分别为

$$
\mathbf{x}=x\mathbf{e}_x+y\mathbf{e}_y+z\mathbf{e}_z,\qquad
\mathbf{u}=u\mathbf{e}_x+v\mathbf{e}_y+w\mathbf{e}_z.
$$

## Nabla 算子与三种基本运算

定义微分算子

$$
\nabla=\mathbf{e}_x\frac{\partial}{\partial x}
+\mathbf{e}_y\frac{\partial}{\partial y}
+\mathbf{e}_z\frac{\partial}{\partial z}.
$$

它本身不是矢量，而是“等待作用”的算子。作用在标量场上得到矢量（梯度），作用在矢量场上可以通过点乘或叉乘得到标量或矢量（散度、旋度）。

### 梯度 Gradient

对标量场 $f$，

$$
\nabla f=\frac{\partial f}{\partial x}\mathbf{e}_x
+\frac{\partial f}{\partial y}\mathbf{e}_y
+\frac{\partial f}{\partial z}\mathbf{e}_z.
$$

梯度指向 $f$ 增长最快的方向，其模长等于该方向的方向导数。沿单位方向 $\mathbf{n}$ 的方向导数为

$$
\frac{\partial f}{\partial n}=\nabla f\cdot\mathbf{n}.
$$

在流体力学里，压力梯度 $\nabla p$ 是动量方程中最重要的源项：高压指向低压的力为 $-\nabla p$。温度梯度 $\nabla T$ 则通过傅里叶定律 $\mathbf{q}=-k\nabla T$ 产生热流。

### 散度 Divergence

对矢量场 $\mathbf{u}$，

$$
\nabla\cdot\mathbf{u}
=\frac{\partial u}{\partial x}
+\frac{\partial v}{\partial y}
+\frac{\partial w}{\partial z}
=\frac{\partial u_i}{\partial x_i},
$$

其中最后一项使用了爱因斯坦求和约定（重复指标求和）。散度是一个**标量**，表示单位体积内矢量场的净流出量。

- $\nabla\cdot\mathbf{u}>0$：该点像“源”，体积有膨胀趋势；
- $\nabla\cdot\mathbf{u}<0$：该点像“汇”，体积有压缩趋势；
- $\nabla\cdot\mathbf{u}=0$：不可压缩流动的连续性方程。

对密度场，守恒形式为

$$
\frac{\partial \rho}{\partial t}+\nabla\cdot(\rho\mathbf{u})=0.
$$

### 旋度 Curl

对矢量场 $\mathbf{u}$，旋度定义为

$$
\nabla\times\mathbf{u}=
\begin{vmatrix}
\mathbf{e}_x & \mathbf{e}_y & \mathbf{e}_z\\[2pt]
\dfrac{\partial}{\partial x} & \dfrac{\partial}{\partial y} & \dfrac{\partial}{\partial z}\\[4pt]
u & v & w
\end{vmatrix}
=\left(\frac{\partial w}{\partial y}-\frac{\partial v}{\partial z}\right)\mathbf{e}_x
+\left(\frac{\partial u}{\partial z}-\frac{\partial w}{\partial x}\right)\mathbf{e}_y
+\left(\frac{\partial v}{\partial x}-\frac{\partial u}{\partial y}\right)\mathbf{e}_z.
$$

旋度描述场的**局部旋转强度**。一个刚体以角速度 $\boldsymbol{\Omega}$ 旋转时，速度场为 $\mathbf{u}=\boldsymbol{\Omega}\times\mathbf{r}$，此时

$$
\nabla\times\mathbf{u}=2\boldsymbol{\Omega}.
$$

也就是说，旋度等于角速度的两倍。流体中的涡量（vorticity）就定义为

$$
\boldsymbol{\omega}=\nabla\times\mathbf{u}.
$$

## 拉普拉斯算子与常用恒等式

拉普拉斯算子作用于标量场：

$$
\nabla^2 f=\nabla\cdot(\nabla f)
=\frac{\partial^2 f}{\partial x^2}
+\frac{\partial^2 f}{\partial y^2}
+\frac{\partial^2 f}{\partial z^2}.
$$

它衡量某点的值与其邻域平均值的偏差：$\nabla^2 f>0$ 表示该点低于周围平均（局部“凹”），常用于扩散项、压力泊松方程与热传导。

以下恒等式在推导守恒方程时几乎每天都会遇到：

| 恒等式 | 含义 |
| --- | --- |
| $\nabla\times(\nabla f)=0$ | 梯度场无旋 |
| $\nabla\cdot(\nabla\times\mathbf{u})=0$ | 旋度场无源 |
| $\nabla\cdot(f\mathbf{u})=f\nabla\cdot\mathbf{u}+\mathbf{u}\cdot\nabla f$ | 乘积法则（散度） |
| $\nabla\times(f\mathbf{u})=f\nabla\times\mathbf{u}+\nabla f\times\mathbf{u}$ | 乘积法则（旋度） |
| $\nabla(\mathbf{u}\cdot\mathbf{u})=2(\mathbf{u}\cdot\nabla)\mathbf{u}+2\mathbf{u}\times\boldsymbol{\omega}$ | 对流项变形 |

最后一条尤其关键。它把 N-S 方程中的对流项写成

$$
(\mathbf{u}\cdot\nabla)\mathbf{u}
=\nabla\left(\frac{|\mathbf{u}|^2}{2}\right)-\mathbf{u}\times\boldsymbol{\omega},
$$

从而把“沿流线加速”分解为“动能梯度”和“涡量与速度的叉乘”。这也是涡动力学方程的出发点。

## 积分定理：从微分到控制体

CFD 的有限体积法建立在积分形式的守恒律上，因此高斯散度定理与斯托克斯定理是必须掌握的工具。

### 高斯散度定理（Gauss–Ostrogradsky）

对光滑矢量场 $\mathbf{u}$ 与体积 $V$（边界为 $\partial V$，外法向为 $\mathbf{n}$），

$$
\int_V \nabla\cdot\mathbf{u}\,\mathrm{d}V
=\oint_{\partial V}\mathbf{u}\cdot\mathbf{n}\,\mathrm{d}S.
$$

它把“体积内的源”与“边界上的通量”联系起来。对守恒方程做体积分，就可以把 $\partial_t$ 移到积分号外，把空间导数变成面通量：

$$
\frac{\mathrm{d}}{\mathrm{d}t}\int_V \rho\,\mathrm{d}V
+\oint_{\partial V}\rho\mathbf{u}\cdot\mathbf{n}\,\mathrm{d}S=0.
$$

这正是有限体积法离散的起点：每个单元只关心六个面上的通量，而不需要显式求导。

### 斯托克斯定理（Stokes）

对曲面 $S$（边界为闭合曲线 $\partial S$，法向 $\mathbf{n}$ 与曲线方向满足右手定则），

$$
\int_S(\nabla\times\mathbf{u})\cdot\mathbf{n}\,\mathrm{d}S
=\oint_{\partial S}\mathbf{u}\cdot\mathrm{d}\mathbf{l}.
$$

它说明“穿过曲面的涡量通量”等于“沿边界的环量”。若流场无旋（$\nabla\times\mathbf{u}=0$），则任意闭合曲线上的环量为零，可以引入速度势 $\phi$ 使 $\mathbf{u}=\nabla\phi$，此时连续性方程化为拉普拉斯方程

$$
\nabla^2\phi=0.
$$

### 雷诺输运定理

对随时间运动的控制体 $V(t)$，标量场 $\phi$ 的总量变化为

$$
\frac{\mathrm{d}}{\mathrm{d}t}\int_{V(t)}\phi\,\mathrm{d}V
=\int_{V(t)}\frac{\partial\phi}{\partial t}\,\mathrm{d}V
+\oint_{\partial V(t)}\phi\,\mathbf{u}_b\cdot\mathbf{n}\,\mathrm{d}S,
$$

其中 $\mathbf{u}_b$ 是控制体边界速度。若控制体随流体运动（$\mathbf{u}_b=\mathbf{u}$），则得到物质导数形式

$$
\frac{\mathrm{D}}{\mathrm{D}t}\int_V \phi\,\mathrm{d}V
=\int_V\left(\frac{\partial\phi}{\partial t}+\nabla\cdot(\phi\mathbf{u})\right)\mathrm{d}V,
\qquad
\frac{\mathrm{D}\phi}{\mathrm{D}t}
=\frac{\partial\phi}{\partial t}+\mathbf{u}\cdot\nabla\phi.
$$

物质导数 $\mathrm{D}/\mathrm{D}t$ 表示“跟随流体质点观察到的变化率”，是不可压缩与可压缩推导中统一语言。

## 曲线坐标中的常用形式

工程问题很少正好是直角坐标。柱坐标 $(r,\theta,z)$ 下，梯度与散度分别为

$$
\nabla f=\frac{\partial f}{\partial r}\mathbf{e}_r
+\frac{1}{r}\frac{\partial f}{\partial\theta}\mathbf{e}_\theta
+\frac{\partial f}{\partial z}\mathbf{e}_z,
$$

$$
\nabla\cdot\mathbf{u}
=\frac{1}{r}\frac{\partial (ru_r)}{\partial r}
+\frac{1}{r}\frac{\partial u_\theta}{\partial\theta}
+\frac{\partial u_z}{\partial z}.
$$

注意 $1/r$ 因子来自面积元的几何缩放，容易漏写。柱坐标下的拉普拉斯算子为

$$
\nabla^2 f=\frac{1}{r}\frac{\partial}{\partial r}\left(r\frac{\partial f}{\partial r}\right)
+\frac{1}{r^2}\frac{\partial^2 f}{\partial\theta^2}
+\frac{\partial^2 f}{\partial z^2}.
$$

## 在流体力学中的对应

| 数学对象 | 流体力学含义 | 典型出现位置 |
| --- | --- | --- |
| $\nabla p$ | 压力梯度力 | 动量方程源项 |
| $\nabla\cdot\mathbf{u}$ | 体积膨胀率 | 连续性方程 |
| $\nabla\times\mathbf{u}$ | 涡量，局部旋转 | 涡动力学、Q 判据 |
| $\nabla\cdot(\mu\nabla\mathbf{u})$ | 粘性扩散 | 动量方程 |
| $\nabla\cdot\mathbf{q}$ | 热流散度 | 能量方程 |
| $\nabla^2\phi=0$ | 无旋不可压势流 | 势流理论、远场边界 |

一个常见的误区是把“散度为零”与“无旋”混为一谈。不可压缩只要求 $\nabla\cdot\mathbf{u}=0$，涡量完全可以非零；反之，无旋流动 $\nabla\times\mathbf{u}=0$ 也可以有非零散度（例如可压缩源流）。

## 例子：点涡与奇异涡量

二维点涡的速度场为

$$
u_r=0,\qquad u_\theta=\frac{\Gamma}{2\pi r},\qquad \Gamma>0.
$$

在 $r>0$ 处直接计算可得

$$
\nabla\cdot\mathbf{u}=0,\qquad
\omega_z=\frac{1}{r}\frac{\partial (ru_\theta)}{\partial r}=0.
$$

但沿包围原点的圆周计算环量：

$$
\oint \mathbf{u}\cdot\mathrm{d}\mathbf{l}
=\int_0^{2\pi}\frac{\Gamma}{2\pi r}\,r\,\mathrm{d}\theta
=\Gamma.
$$

由斯托克斯定理，这说明原点处存在一个集中的涡量：$\omega_z=\Gamma\delta^2(\mathbf{x})$。这类“除奇点外处处无旋”的流动提醒我们：**微分形式的无旋判断依赖定义域光滑**，在数值离散时奇点附近的涡量会被网格尺度抹平。

下面的 Python 片段用中心差分从速度场计算涡量，是后处理中最常见的操作之一：

```python
import numpy as np

def vorticity_2d(u, v, dx, dy):
    """二维速度场 -> 涡量 ω_z = ∂v/∂x - ∂u/∂y（中心差分）。"""
    dvdx = np.gradient(v, dx, axis=1)
    dudy = np.gradient(u, dy, axis=0)
    return dvdx - dudy

# 示例：刚性旋转 u = -Ω y, v = Ω x，理论涡量为 2Ω
n = 64
x = np.linspace(-1, 1, n)
y = np.linspace(-1, 1, n)
X, Y = np.meshgrid(x, y)
omega = 1.0
u, v = -omega * Y, omega * X
dx = x[1] - x[0]
dy = y[1] - y[0]
wz = vorticity_2d(u, v, dx, dy)
print("内部点涡量均值：", wz[1:-1, 1:-1].mean())  # 约等于 2.0
```

:::warning 差分的边界
`np.gradient` 在边界使用单侧差分，精度低于内部。若要在壁面附近计算涡量，应使用与求解器一致的离散格式，或先插值到规则网格，否则壁面涡量会出现明显偏差。
:::

## 小结

- 梯度、散度、旋度分别回答“往哪变”“源有多强”“转得多快”。
- 高斯定理把体积分变成面积分，是有限体积法的数学基础；斯托克斯定理把涡量通量与环量联系起来。
- 物质导数 $\mathrm{D}/\mathrm{D}t=\partial_t+\mathbf{u}\cdot\nabla$ 是把欧拉描述转换为拉格朗日描述的关键。
- 下一步可以阅读[张量分析与应力](ch1/tensor-analysis.html)，把矢量运算推广到应力与变形率；或者直接进入[流体力学基本方程](../ch2/governing-equations.html)。

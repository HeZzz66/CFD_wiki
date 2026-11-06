---
title: 两相流动量方程与压降
order: 3
summary: 从分相与混合物动量方程出发，把两相压降分解为摩擦、加速与重力三部分，给出 Lockhart–Martinelli 参数与 Chisholm 乘子、Friedel 等关联式的结构与适用条件，并说明局部损失与临界流。
tags: [两相压降, Lockhart-Martinelli, Chisholm, 加速压降]
---

一维两相流计算最常被问到的两个量是**压降**与**含气率**。上一页解决了含气率，这一页解决压降。与单相不同，两相压降不能简单用“平均密度 + 总质量流量”代入 Darcy 公式：相间速度差、界面剪切、蒸发加速、重力分量都会各自贡献一部分。工程上把这四项分开计算，再用关联式封闭摩擦项。

## 压降的分解

对定截面管道内的定常两相流，总压降写成

$$
-\frac{\mathrm{d}p}{\mathrm{d}z}
=\left(\frac{\mathrm{d}p}{\mathrm{d}z}\right)_f
+\left(\frac{\mathrm{d}p}{\mathrm{d}z}\right)_{acc}
+\left(\frac{\mathrm{d}p}{\mathrm{d}z}\right)_{g},
$$

三项分别称为**摩擦压降**、**加速压降**与**重力压降**。对水平管，重力项为零；对垂直上升管，重力项为正（消耗压力）；对下降管，重力项为负（重力助流）。三者量级随工况变化：低干度水平管以摩擦为主，高干度蒸发通道中加速项可占 20%–40%，而垂直沸腾通道中重力项往往最大。

## 分相动量方程

把每一相看作占据各自体积分数的连续介质，气相与液相的动量方程分别为

$$
\alpha\rho_g\frac{\mathrm{D}\mathbf{u}_g}{\mathrm{D}t}
=-\alpha\nabla p+\nabla\cdot\left(\alpha\boldsymbol{\tau}_g\right)
+\alpha\rho_g\mathbf{g}+\mathbf{F}_{ig},
$$

$$
(1-\alpha)\rho_l\frac{\mathrm{D}\mathbf{u}_l}{\mathrm{D}t}
=-(1-\alpha)\nabla p+\nabla\cdot\left((1-\alpha)\boldsymbol{\tau}_l\right)
+(1-\alpha)\rho_l\mathbf{g}-\mathbf{F}_{ig},
$$

其中 $\mathbf{F}_{ig}$ 是界面动量交换（阻力、升力、虚拟质量等）。两式相加得到混合物动量方程；若忽略相间加速度与界面应力，混合物方程退化为

$$
\frac{\partial(\rho_m j)}{\partial t}
+\frac{\partial}{\partial z}\left(\rho_m j^2\right)
=-\frac{\mathrm{d}p}{\mathrm{d}z}-\rho_m g\sin\theta-\frac{4\tau_w}{D},
$$

$\rho_m=\alpha\rho_g+(1-\alpha)\rho_l$。这一步说明：**一维压降计算的关键，仍然是把壁面剪切 $\tau_w$ 用两相关联式封闭**。

## 摩擦压降：Lockhart–Martinelli 方法

Lockhart 与 Martinelli（1949）提出用“分相折算”处理摩擦压降。记液相单独流过同一管道（质量流量为 $\dot m_l=(1-x)\dot m$）时的压降为

$$
\left(\frac{\mathrm{d}p}{\mathrm{d}z}\right)_l
=f_l\frac{G_l^2}{2D\rho_l},
\qquad G_l=(1-x)G,
$$

气相单独流过时的压降为

$$
\left(\frac{\mathrm{d}p}{\mathrm{d}z}\right)_g
=f_g\frac{G_g^2}{2D\rho_g},
\qquad G_g=xG.
$$

定义 **Lockhart–Martinelli 参数**

$$
X=\sqrt{\frac{(dp/dz)_l}{(dp/dz)_g}},
$$

以及两相摩擦乘子

$$
\phi_l^2=\frac{(dp/dz)_f}{(dp/dz)_l},
\qquad
\phi_g^2=\frac{(dp/dz)_f}{(dp/dz)_g}.
$$

Chisholm 给出乘子与 $X$ 的解析关系：

$$
\phi_l^2=1+\frac{C}{X}+\frac{1}{X^2}
$$

$$
\phi_g^2=1+C X+X^2,
$$

其中 $C$ 是取决于两相流态的常数：

| 液相流态 | 气相流态 | $C$ |
| --- | --- | --- |
| 湍流 | 湍流 | 20 |
| 层流 | 层流 | 12 |
| 层流 | 湍流 | 10 |
| 湍流 | 层流 | 10–12 |

最后一行在不同文献中取值略有差异，取 10 或 12 都会带来百分之几的偏差。工程计算中通常先按 $Re_l$、$Re_g$ 判断流态，再查表。

### 快速估算 $X$

当两相均为湍流时，用 Blasius 关系 $f\propto Re^{-0.2}$ 可把 $X$ 化为只含干度与物性的形式：

$$
X_{tt}=\left(\frac{1-x}{x}\right)^{0.9}
\left(\frac{\rho_g}{\rho_l}\right)^{0.5}
\left(\frac{\mu_l}{\mu_g}\right)^{0.1}.
$$

两相均为层流时：

$$
X_{ll}=\left(\frac{1-x}{x}\right)^{0.5}
\left(\frac{\rho_g}{\rho_l}\right)^{0.5}
\left(\frac{\mu_l}{\mu_g}\right)^{0.5}.
$$

这两个式子的价值在于：不需要先算 $f_l$、$f_g$，就能估出 $X$ 的量级。对水-空气常压系统，$X_{tt}$ 在 $x=0.1$ 时约为 0.4；对水-蒸汽高压系统，由于密度比小得多，$X$ 会明显更大。

### 用 $\phi_l^2$ 还原压降

$$
\left(\frac{\mathrm{d}p}{\mathrm{d}z}\right)_f
=\phi_l^2\left(\frac{\mathrm{d}p}{\mathrm{d}z}\right)_l.
$$

这是 L-M 方法最常用的形式：先按液相单独流动算一个“基准压降”，再乘以乘子。乘子的物理含义是“两相流的摩擦损失相当于多少倍的液相单独流动”。

:::warning L-M 方法的适用范围
Lockhart–Martinelli 原始数据来自低压、小管径、绝热的气液两相流，适用于**低干度、分层或环状、无相变**的工况。对高压、高干度、弹状流、沸腾通道，误差会明显增大。它也**不适用于加速压降与重力压降**，那两项必须单独计算。
:::

## 其他摩擦压降关联式

由于 L-M 方法的局限，工程上发展了大量替代关联式。它们大多以“全液相折算”为基准，即把总质量流量全部当作液体流过管道：

$$
\left(\frac{\mathrm{d}p}{\mathrm{d}z}\right)_{lo}
=f_{lo}\frac{G^2}{2D\rho_l},
\qquad
\phi_{lo}^2=\frac{(dp/dz)_f}{(dp/dz)_{lo}}.
$$

**Friedel（1979）** 关联式是高压、高干度工况中应用最广的形式之一。它把乘子写成

$$
\phi_{lo}^2=Eu+3.24\,F\,H\,Fr^{-0.045}We^{-0.035},
$$

其中 $Eu$ 反映两相与全液相的动量比，$F$、$H$ 是干度与物性比的幂函数组合，$Fr=G^2/(gD\rho_h^2)$、$We=G^2D/(\rho_h\sigma)$ 是两相 Froude 数与 Weber 数。具体指数见原文；这里只需记住：**Friedel 用 Froude 数修正重力影响、用 Weber 数修正表面张力影响**，因此比 L-M 更适合大管径与高压。

**Müller-Steinhagen & Heck（1986）** 采用另一种思路：分别算全液相与全气相的压降梯度，再按干度做经验插值。它不需要判断流态，在油气管道中表现稳定。

**均相模型** 则直接用 $\rho_h$ 与 $\mu_h$（见 [[multiphase/homogeneous-drift-flux|均相流与漂移流模型]]）：

$$
\left(\frac{\mathrm{d}p}{\mathrm{d}z}\right)_f
=f_h\frac{G^2}{2D\rho_h}.
$$

| 关联式 | 基准 | 适用工况 | 优点 / 局限 |
| --- | --- | --- | --- |
| Lockhart–Martinelli | 分相 | 低压、低干度、绝热 | 形式简单；高压误差大 |
| Chisholm | 分相 | 宽干度、需流态判断 | 有解析式；$C$ 依赖流态 |
| Friedel | 全液相 | 高压、大管径、高干度 | 精度较好；公式复杂 |
| Müller-Steinhagen–Heck | 全液相/全气相 | 油气管道 | 无需流态判断 |
| 均相 | 混合物 | 雾状流、临界流 | 最简单；低干度偏差大 |

## 加速压降

加速压降来自动量通量的变化。分相模型中

$$
M(z)=G^2\left[\frac{x^2}{\rho_g\alpha}
+\frac{(1-x)^2}{\rho_l(1-\alpha)}\right],
$$

$$
\left(\frac{\mathrm{d}p}{\mathrm{d}z}\right)_{acc}
=\frac{\mathrm{d}M}{\mathrm{d}z}.
$$

当干度沿程增大（蒸发）或含气率上升时，$M$ 增大，压力下降。对均相模型，$M=G^2/\rho_h=G^2[x/\rho_g+(1-x)/\rho_l]$，于是

$$
\left(\frac{\mathrm{d}p}{\mathrm{d}z}\right)_{acc}
=G^2\frac{\mathrm{d}}{\mathrm{d}z}
\left(\frac{x}{\rho_g}+\frac{1-x}{\rho_l}\right).
$$

若忽略密度沿程变化，可近似写成

$$
\left(\frac{\mathrm{d}p}{\mathrm{d}z}\right)_{acc}
\approx G^2\left(\frac{1}{\rho_g}-\frac{1}{\rho_l}\right)\frac{\mathrm{d}x}{\mathrm{d}z}.
$$

这一项在**蒸发器出口、闪蒸、临界流**中不可忽略。很多初学者只算摩擦项，结果在高压蒸汽管道中低估压降 30% 以上。

## 重力压降

$$
\left(\frac{\mathrm{d}p}{\mathrm{d}z}\right)_g
=\left[\alpha\rho_g+(1-\alpha)\rho_l\right]g\sin\theta,
$$

$\theta$ 为管道与水平面的夹角。垂直上升管 $\theta=90^\circ$，重力项等于混合密度乘以 $g$。对水-蒸汽系统，$\rho_m$ 随含气率从 $\rho_l$ 迅速降到接近 $\rho_g$，因此重力压降沿程显著减小。

注意符号约定：若定义 $\mathrm{d}p/\mathrm{d}z$ 为沿流动方向的压力梯度，则上升管中 $-\mathrm{d}p/\mathrm{d}z$ 为正的压降；下降管中重力项为负，可能抵消摩擦项。

## 局部损失

弯头、阀门、突扩突缩等局部阻力，两相流的处理比单相复杂。工程近似常用两种做法：

**均相法**：把混合物当作单相，

$$
\Delta p_{local}=K_m\frac{\rho_m u_m^2}{2},
\qquad u_m=j=\frac{G}{\rho_h},
$$

$K_m$ 取单相的值。

**乘子法**：

$$
\Delta p_{local}=\phi_{lo}^2\,\Delta p_{lo},
$$

即用全液相局部损失乘以两相乘子。突扩、突缩、孔板等部件的两相 $K$ 值有专门实验关联式，不能简单沿用单相值。

## 临界流与壅塞

当出口压力降到某一值以下，管内流量不再随背压下降而增加，出现**壅塞（choked flow）**。均相平衡模型（HEM）给出的临界质量通量为

$$
G_c=\left(-\frac{1}{\left(\partial v/\partial p\right)_s}\right)^{1/2},
$$

$v$ 是混合物比容，下标 $s$ 表示沿等熵线求导。对理想气体，$G_c=\sqrt{\gamma p\rho}=\rho a$，即出口速度达到声速。两相流的“声速”远低于单相声速，因为气相的可压缩性被液相的热惯性调制；这正是压力容器泄放、安全阀选型必须用两相声速的原因。

:::note 两相声速不是常数
两相混合物声速可低至几十 m/s（远低于气相声速数百 m/s），且强烈依赖含气率与频率。工程上用 HEM 声速做保守估计，用六方程模型做更精细的临界流分析。
:::

## 工程算例：蒸发管压降分解

考虑一根内径 $D=25\ \mathrm{mm}$ 的垂直蒸发管，质量通量 $G=800\ \mathrm{kg/(m^2\cdot s)}$，入口干度 $x=0$，出口干度 $x=0.2$，工质为水，压力约 1 bar。

| 项目 | 估算方法 | 量级 |
| --- | --- | --- |
| 摩擦 | L-M 乘子或均相 $f_h$ | 数十 kPa |
| 加速 | $G^2\Delta(1/\rho)$ | 数 kPa |
| 重力 | $\rho_m g L$ | 每米约 9 kPa |

可以看到：**重力项在垂直管中按每米 9 kPa 量级累积**，一根 3 m 长的管子就贡献约 27 kPa，往往超过摩擦项。这也是为什么锅炉水冷壁的压降计算必须精确给出含气率分布。

## Python 示例：L-M 摩擦压降与三项分解

下面的脚本计算空气-水水平管的两相摩擦压降，并比较 L-M 与均相模型。

```python
import numpy as np

rho_l, rho_g = 998.0, 1.2
mu_l, mu_g = 8.9e-4, 1.8e-5
D, G, x = 0.025, 500.0, 0.10

def friction_factor(Re):
    """层流用 64/Re，湍流用 Blasius（Darcy 摩擦因子）。"""
    if Re < 2300:
        return 64.0 / Re
    return 0.3164 * Re ** (-0.25)

def single_phase_dp(G_k, rho_k, mu_k):
    Re = G_k * D / mu_k
    f = friction_factor(Re)
    return f * G_k**2 / (2 * D * rho_k), Re

dp_l, Re_l = single_phase_dp((1 - x) * G, rho_l, mu_l)
dp_g, Re_g = single_phase_dp(x * G, rho_g, mu_g)

X = np.sqrt(dp_l / dp_g)
if Re_l > 2300 and Re_g > 2300:
    C = 20.0
elif Re_l < 2300 and Re_g < 2300:
    C = 12.0
else:
    C = 10.0
phi_l2 = 1.0 + C / X + 1.0 / X**2
dp_tp = phi_l2 * dp_l

# 均相模型对照
rho_h = 1.0 / (x / rho_g + (1 - x) / rho_l)
mu_h = 1.0 / (x / mu_g + (1 - x) / mu_l)
dp_h, Re_h = single_phase_dp(G, rho_h, mu_h)

# 加速项（忽略密度沿程变化）
dp_acc = G**2 * (1 / rho_g - 1 / rho_l) * x / 1.0   # 设 dx/dz = 1 m^-1

print(f"Re_l={Re_l:.2e}, Re_g={Re_g:.2e}")
print(f"X={X:.3f}, phi_l2={phi_l2:.2f}")
print(f"L-M 摩擦压降 = {dp_tp/1e3:.2f} kPa/m")
print(f"均相摩擦压降 = {dp_h/1e3:.2f} kPa/m")
print(f"加速压降（dx/dz=1） = {dp_acc/1e3:.2f} kPa/m")
```

典型的输出会显示 L-M 乘子在数十量级（本例约 60），即两相摩擦压降比液相单独流动大近两个量级。这正是多相流管道设计中“压降裕量”往往很大的原因。

:::tip 结果校核
算出压降后，务必回到能量平衡检查：泵功 $=\Delta p\,\dot V$ 是否与热负荷、摩擦耗散一致？若压降对应的泵功超过输入热功率的百分之几，通常说明含气率或摩擦乘子被高估。
:::

## 小结

- 两相压降分为摩擦、加速、重力三部分，必须分开计算，不能用一个“平均密度”糊在一起。
- Lockhart–Martinelli 用 $X$ 与 $\phi_l^2=1+C/X+1/X^2$ 把两相摩擦折算到液相基准，适用于低压、低干度、绝热工况。
- 高压、大管径、高干度应改用 Friedel 或 Müller-Steinhagen–Heck 关联式。
- 加速压降由动量通量变化产生，在蒸发与临界流中占比很大；重力压降由混合密度决定。
- 临界流必须用两相声速，HEM 给出保守的壅塞质量通量估计。

## 延伸阅读

- Wallis, G. B. *One-Dimensional Two-Phase Flow*. McGraw-Hill, 1969.
- Ishii, M., Hibiki, T. *Thermo-Fluid Dynamics of Two-Phase Flow*, 2nd ed. Springer, 2006.
- Hewitt, G. F., Hall-Taylor, N. S. *Annular Two-Phase Flow*. Pergamon Press, 1970.
- Brennen, C. E. *Fundamentals of Multiphase Flow*. Cambridge University Press, 2005.

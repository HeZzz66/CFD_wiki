---
title: 均相流与漂移流模型
order: 2
summary: 从均相假设出发推导混合物密度、含气率与两相摩擦，再引入滑移比的 Zivi 关系与 Zuber–Findlay 漂移流方程，说明两类一维模型的精度差异与适用工况。
tags: [均相模型, 漂移流, 滑移比, Zuber-Findlay]
---

上一页的流型告诉我们：气液两相的速度很少相等。但工程计算不可能对每根管道都做三维界面解析，于是出现两类一维近似：**均相模型**强行令两相速度相同，把混合物当作一种“等效流体”；**漂移流模型**承认速度差，但只用一个平均漂移速度来修正。前者简单、后者更接近实际，两者共同构成两相流一维分析的主干。

## 均相模型的基本假设

均相模型（homogeneous model）做了三条强假设：

1. 两相速度相等，$S=u_g/u_l=1$；
2. 两相处于热力学平衡，温度相同；
3. 混合物可用单一密度、单一粘度与单一速度描述。

在这些假设下，混合物密度由体积加权得到：

$$
\frac{1}{\rho_h}=\frac{x}{\rho_g}+\frac{1-x}{\rho_l},
\qquad
\rho_h=\left(\frac{x}{\rho_g}+\frac{1-x}{\rho_l}\right)^{-1}.
$$

它与干度的关系是非线性的：即使 $x$ 很小，只要 $\rho_l/\rho_g$ 很大，含气率也会迅速上升。

### 含气率

由 $S=1$ 与干度定义，直接得到

$$
\alpha_h=\frac{x/\rho_g}{x/\rho_g+(1-x)/\rho_l}
=\frac{1}{1+\dfrac{1-x}{x}\dfrac{\rho_g}{\rho_l}}.
$$

这条式子是均相模型的核心。对水-空气常压系统（$\rho_l/\rho_g\approx830$），$x=0.01$ 时 $\alpha_h\approx0.89$。也就是说，**质量上只有 1% 的气，体积上却占了近 90%**。这正是两相流“干度小、含气率大”的反直觉之处。

### 均相摩擦压降

均相模型的摩擦压降写成单相形式：

$$
-\left(\frac{\mathrm{d}p}{\mathrm{d}z}\right)_f
=f_h\frac{G^2}{2D\rho_h},
\qquad
Re_h=\frac{GD}{\mu_h},
$$

其中 $G=\dot m/A$ 是总质量通量，$f_h$ 由 $Re_h$ 按单相 Moody 图或 Colebrook 公式求得。问题转移到**两相粘度** $\mu_h$ 如何定义。常用关联式有：

| 名称 | 两相粘度定义 | 特点 |
| --- | --- | --- |
| McAdams | $\dfrac{1}{\mu_h}=\dfrac{x}{\mu_g}+\dfrac{1-x}{\mu_l}$ | 偏小，压降预测偏高 |
| Cicchitti | $\mu_h=x\mu_g+(1-x)\mu_l$ | 线性加权，最简单 |
| Dukler | $\mu_h=\rho_h\left(\dfrac{x\mu_g}{\rho_g}+\dfrac{(1-x)\mu_l}{\rho_l}\right)$ | 体积加权，常用于油气管道 |

三者没有绝对优劣：它们都是把实验数据拟合进一个“等效粘度”里。选哪一个，应与压降关联式的标定数据保持一致。

:::tip 均相模型的适用场合
均相模型在**高干度、高流速、气泡细小且分布均匀**的工况下表现最好，例如雾状流、窄通道内的分散泡状流、临界流计算。对分层流、弹状流与低干度环状流，误差可达 50% 以上。
:::

## 滑移比与 Zivi 关系

均相模型最大的偏差来自忽略滑移。若只保留滑移比 $S$ 这一个自由度，含气率变为

$$
\alpha=\frac{1}{1+\dfrac{1-x}{x}\dfrac{\rho_g}{\rho_l}S}.
$$

$S$ 越大，同样干度下 $\alpha$ 越小：气相速度越高，维持同样质量流量所需的体积份额越少。Zivi（1964）从“最小熵产”出发，给出一个只依赖密度的估计：

$$
S=\left(\frac{\rho_l}{\rho_g}\right)^{1/3}.
$$

对水-空气，$S\approx9.4$，已经远大于 1；对水-蒸汽（$\rho_l/\rho_g$ 约 20–100），$S$ 约 3–4.6。Zivi 关系不需要任何实验标定，因此在缺乏数据时常用作一阶修正。

更一般地，滑移比与流型相关：泡状流 $S$ 接近 1–2，弹状流可达 3–5，环状流液膜速度远低于气芯，$S$ 可超过 10。因此固定 $S$ 的模型只在窄工况内有效。

## 漂移流模型

漂移流模型（drift-flux model）由 Zuber 与 Findlay（1965）提出，是两相流一维分析中精度与复杂度平衡得最好的一类。它的出发点不是“假设速度相等”，而是把两相速度差写成一个**分布参数**加一个**漂移速度**。

### 基本运动学关系

定义气相表观速度 $j_g=\alpha u_g$、液相表观速度 $j_l=(1-\alpha)u_l$，混合物表观速度 $j=j_g+j_l$。气相速度可分解为

$$
u_g=C_0 j+V_{gj},
$$

其中 $C_0$ 是**分布参数**（distribution parameter），反映截面上的速度与含气率分布；$V_{gj}$ 是**漂移速度**（drift velocity），反映气泡相对于混合物的上升。两边乘 $\alpha$ 得

$$
j_g=\alpha\left(C_0 j+V_{gj}\right),
$$

于是

$$
\alpha=\frac{j_g}{C_0 j+V_{gj}}
$$

这个式子非常实用：只要知道 $j_g$、$j_l$ 与两个封闭参数，就能算出含气率，不需要迭代。

### 封闭参数的典型取值

| 流型 | $C_0$ | $V_{gj}$ |
| --- | --- | --- |
| 泡状流 | 约 1.2 | $\sqrt{2}\left(\dfrac{\sigma g(\rho_l-\rho_g)}{\rho_l^2}\right)^{1/4}$ |
| 弹状流 | 约 1.2 | $0.35\sqrt{\dfrac{gD(\rho_l-\rho_g)}{\rho_l}}$ |
| 搅混流 | 约 1.0–1.2 | 与泡状流同阶 |
| 环状流 | 约 1.0 | 近似为 0（气芯速度由压降决定） |

$C_0>1$ 的物理含义是：管道中心速度高于截面平均速度，而含气率也常在中心较高，两者相关导致气相被“加权”输运得更快。$V_{gj}$ 则来自浮力与表面张力（或重力）的平衡，泡状流的 $\sqrt{2}(\sigma g\Delta\rho/\rho_l^2)^{1/4}$ 就是经典的 Zuber 上升速度尺度。

:::warning 参数不是万能常数
$C_0$ 与 $V_{gj}$ 都随管径、压力、入口与流型变化。Ishii 与 Hibiki 给出了考虑管径与界面浓度的修正形式。直接把表中的常数用于高压蒸汽或大管径，误差可能超过 30%。
:::

### 一维守恒方程

漂移流模型仍需与守恒方程耦合。气相连续性方程为

$$
\frac{\partial(\alpha\rho_g)}{\partial t}
+\frac{\partial(\alpha\rho_g u_g)}{\partial z}
=\Gamma_g,
$$

液相连续性为

$$
\frac{\partial((1-\alpha)\rho_l)}{\partial t}
+\frac{\partial((1-\alpha)\rho_l u_l)}{\partial z}
=-\Gamma_g,
$$

混合物动量方程（忽略相间动量交换的细节）为

$$
\frac{\partial(\rho_m j)}{\partial t}
+\frac{\partial}{\partial z}\left(\rho_m j^2\right)
=-\frac{\partial p}{\partial z}
-\rho_m g\sin\theta
-\frac{4\tau_w}{D},
$$

其中 $\rho_m=\alpha\rho_g+(1-\alpha)\rho_l$ 是混合密度，$\tau_w$ 是壁面剪切。$\Gamma_g$ 是相变源项，在沸腾与凝结中不能省略。

这组方程是系统级热工水力程序（RELAP5、TRACE、CATHARE）的核心结构，也是 CFD 与一维管网耦合时的常用接口。

## 三类模型的比较

| 模型 | 未知量 | 封闭关系 | 典型误差 | 适用场景 |
| --- | --- | --- | --- | --- |
| 均相 | $\alpha$、$u$、$p$ | $\mu_h$ 关联式 | 低干度时偏大，可达 50% | 雾状流、临界流、快速估算 |
| 滑移（Zivi） | 加 $S$ | $S=(\rho_l/\rho_g)^{1/3}$ | 20%–40% | 无实验数据的绝热流动 |
| 漂移流 | 加 $C_0$、$V_{gj}$ | 按流型选参数 | 10%–20% | 管流、沸腾通道、系统程序 |
| 两流体 | 每相速度、温度 | 相间力、传热、传质 | 取决于封闭 | 三维 CFD、非平衡流动 |

精度提升的代价是封闭关系越来越多。三维两流体模型要为阻力、升力、虚拟质量、湍流扩散分别建模，而漂移流模型只用一个 $C_0$ 与一个 $V_{gj}$ 概括。这也是为什么工程初步设计几乎总是从漂移流开始。

## Python 示例：三种模型的含气率对比

下面的脚本对水-空气系统扫描干度，比较均相、Zivi 滑移与漂移流的含气率，并画出曲线。漂移流参数取泡状流的典型值。

```python
import numpy as np
import matplotlib.pyplot as plt

rho_l, rho_g = 998.0, 1.2
sigma, g, D = 0.072, 9.81, 0.05

def alpha_homogeneous(x):
    return 1.0 / (1.0 + (1.0 - x) / x * rho_g / rho_l)

def alpha_zivi(x):
    S = (rho_l / rho_g) ** (1 / 3)
    return 1.0 / (1.0 + (1.0 - x) / x * rho_g / rho_l * S)

def alpha_drift(x, G=1000.0):
    """G 为总质量通量 kg/(m2 s)，用漂移流关系求 alpha。"""
    j_g = x * G / rho_g
    j_l = (1.0 - x) * G / rho_l
    j = j_g + j_l
    C0 = 1.2
    Vgj = np.sqrt(2) * (sigma * g * (rho_l - rho_g) / rho_l**2) ** 0.25
    return j_g / (C0 * j + Vgj)

x = np.linspace(0.001, 0.5, 200)
a1, a2, a3 = alpha_homogeneous(x), alpha_zivi(x), alpha_drift(x)

for xi in [0.01, 0.05, 0.1, 0.2]:
    print(f"x={xi:4.2f}  均相={alpha_homogeneous(xi):.4f}  "
          f"Zivi={alpha_zivi(xi):.4f}  漂移流={alpha_drift(xi):.4f}")

plt.figure(figsize=(6, 4))
plt.plot(x, a1, label="homogeneous (S=1)")
plt.plot(x, a2, label="Zivi slip")
plt.plot(x, a3, label="drift-flux (C0=1.2)")
plt.xlabel("quality x")
plt.ylabel(r"void fraction $\alpha$")
plt.ylim(0, 1)
plt.legend()
plt.grid(alpha=0.3)
plt.tight_layout()
plt.show()
```

结果会显示：在低干度区，均相模型给出最高的含气率（因为它假设无滑移），Zivi 与漂移流都明显更低，二者在极小干度与中等干度时互有高低；干度增大时均相与 Zivi 逐渐趋近 1，而固定 $C_0=1.2$ 的漂移流在高干度下会明显偏低。这正是漂移流参数必须随流型切换的原因。

:::note 干度趋近于零的数值问题
$x\to0$ 时 $\alpha$ 对 $x$ 极其敏感，且 $1/x$ 会造成除零。实际程序中应设一个很小的干度下限（例如 $10^{-6}$），或用 $j_g$ 直接构造 $\alpha$，避免奇异性。
:::

## 从一维到三维的桥梁

漂移流模型可以作为三维两流体模型的**代数滑移封闭**：在只关心相分布、不关心界面细节时，用 $\alpha=j_g/(C_0j+V_{gj})$ 替代完整的相间力平衡，计算量显著下降。OpenFOAM 的 `driftFluxFoam` 就是这一思路的实现，常用于沉降、鼓泡塔与泥浆输送。

但要注意：漂移流模型的 $C_0$、$V_{gj}$ 是在一维截面平均意义上标定的，直接用在三维网格上时，必须把它们解释为局部关系，否则会出现非物理的相分布。严谨做法是用两流体模型标定，再用漂移流做快速估算。

## 小结

- 均相模型用混合物密度与等效粘度把两相流写成单相形式，低干度时严重低估含气率。
- Zivi 关系用 $S=(\rho_l/\rho_g)^{1/3}$ 引入滑移，不需要实验标定，适合一阶修正。
- 漂移流模型用 $C_0$ 与 $V_{gj}$ 概括截面分布与相间滑移，$\alpha=j_g/(C_0j+V_{gj})$ 是工程上最常用的一维关系。
- 模型精度从均相、滑移到漂移流递增，封闭参数也随之增多；三维两流体模型则需要完整的相间力与传热封闭。
- 一维模型的价值在于快速估算与系统耦合，不能替代三维界面解析。

## 延伸阅读

- Wallis, G. B. *One-Dimensional Two-Phase Flow*. McGraw-Hill, 1969.
- Ishii, M., Hibiki, T. *Thermo-Fluid Dynamics of Two-Phase Flow*, 2nd ed. Springer, 2006.
- Brennen, C. E. *Fundamentals of Multiphase Flow*. Cambridge University Press, 2005.
- Crowe, C. T., Schwarzkopf, J. D., Sommerfeld, M., Tsuji, Y. *Multiphase Flows with Droplets and Particles*, 2nd ed. CRC Press, 2011.

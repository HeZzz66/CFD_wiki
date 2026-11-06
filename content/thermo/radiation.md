---
title: 辐射换热
order: 4
summary: 从黑体辐射与斯特藩–玻尔兹曼定律出发，讲清发射率、角系数与灰体表面网络，给出两面封闭腔与辐射屏的计算方法，并介绍参与性介质中的辐射传递方程与 CFD 常用辐射模型。
tags: [辐射, 角系数, 灰体, 辐射传递方程]
---

导热与对流需要介质，辐射不需要。太阳的热量穿过真空到达地球，高温炉膛的热量以电磁波形式穿过烟气抵达水冷壁。在高温（$T>800\ \mathrm{K}$）或大温差场景中，辐射换热量常与对流同量级甚至更大；忽略辐射的 CFD 结果会系统性偏低。

## 基本概念

### 立体角与辐射强度

辐射沿方向传播，用**立体角** $\Omega$（单位 sr）描述方向范围。**辐射强度** $I$（W/(m²·sr)）定义为单位面积、单位立体角内的辐射功率。对漫发射表面（各方向强度相同），半球空间的积分给出**辐射力**

$$
E=\pi I.
$$

这个 $\pi$ 来自半球积分 $\int\cos\theta\,\mathrm{d}\Omega=\pi$，是辐射计算中最容易漏掉的因子。

### 黑体与 Planck 定律

**黑体**是理想吸收体与发射体：吸收率、发射率均为 1。其光谱辐射力由 Planck 定律给出：

$$
E_{b\lambda}=\frac{2\pi hc^2}{\lambda^5}
\frac{1}{\exp\left(hc/\lambda k_BT\right)-1},
$$

$h$ 是 Planck 常数，$c$ 是光速，$k_B$ 是 Boltzmann 常数。对全部波长积分得到 **Stefan–Boltzmann 定律**：

$$
E_b=\sigma T^4,
\qquad
\sigma=5.670\times10^{-8}\ \mathrm{W/(m^2\cdot K^4)}.
$$

峰值波长由 **Wien 位移定律** 给出：

$$
\lambda_{max}T=2898\ \mathrm{\mu m\cdot K}.
$$

300 K 的物体峰值在 9.7 μm（远红外），1000 K 时移到 2.9 μm，因此高温辐射主要在近红外。

### 表面辐射性质

实际表面不是黑体。定义：

- **发射率** $\varepsilon=E/E_b$，$0\le\varepsilon\le1$；
- **吸收率** $\alpha$：入射辐射被吸收的比例；
- **反射率** $\rho$：被反射的比例；
- **透射率** $\tau$：透过的比例，$\alpha+\rho+\tau=1$。

对不透明表面 $\tau=0$，$\alpha+\rho=1$。**Kirchhoff 定律**指出，在热平衡下，光谱定向发射率等于光谱定向吸收率：

$$
\varepsilon_\lambda(\theta)=\alpha_\lambda(\theta).
$$

工程上常做两条简化：**灰体**（$\varepsilon$ 与波长无关）与**漫射**（$\varepsilon$ 与方向无关）。在这两条假设下 $\varepsilon=\alpha$。

| 表面（约 300 K） | 发射率 $\varepsilon$ |
| --- | --- |
| 抛光铝 | 0.04–0.05 |
| 氧化铝 | 0.8 |
| 不锈钢（抛光） | 0.1–0.2 |
| 氧化钢 | 0.8 |
| 水 | 0.96 |
| 玻璃 | 0.90–0.95 |
| 炭黑/烟炱 | 0.95 |

低发射率表面（抛光金属）既能减少吸热，也能减少散热，这是保温杯镀银的原理。

## 角系数

**角系数** $F_{ij}$ 定义为表面 $i$ 发出的辐射中直接到达表面 $j$ 的比例：

$$
F_{ij}=\frac{1}{A_i}\int_{A_i}\int_{A_j}
\frac{\cos\theta_i\cos\theta_j}{\pi R^2}\,\mathrm{d}A_j\,\mathrm{d}A_i,
$$

$R$ 是两微元之间的距离，$\theta_i$、$\theta_j$ 是法向与连线的夹角。角系数是纯几何量，与温度、发射率无关。

三条基本性质：

互易性：

$$
A_iF_{ij}=A_jF_{ji},
$$

封闭性（对封闭腔求和为 1）：

$$
\sum_jF_{ij}=1,
$$

可加性（$j$、$k$ 不重叠）：

$$
F_{i(j+k)}=F_{ij}+F_{ik}.
$$

常用结果：

| 几何 | 角系数 |
| --- | --- |
| 无限大平行平板 | $F_{12}=1$ |
| 同心球/无限长同心圆柱 | $F_{12}=1$，$F_{21}=A_1/A_2$ |
| 小表面被大腔包围 | $F_{12}=1$ |
| 两平行有限矩形 | 需查表或数值积分 |

二维几何可用**交叉线法**：把两表面的端点用交叉与非交叉线连接，

$$
F_{12}=\frac{L_{cross}-L_{uncross}}{2L_1},
$$

$L_{cross}$、$L_{uncross}$ 分别为交叉线与非交叉线的总长，$L_1$ 是表面 1 的长度。

## 灰体表面网络

对不透明灰体表面，定义**有效辐射**（radiosity）

$$
J=E+\rho G=\varepsilon E_b+(1-\varepsilon)G,
$$

$G$ 是投入辐射（irradiation）。离开表面的净辐射为

$$
Q_i=\left(J_i-G_i\right)A_i
=\frac{E_{b,i}-J_i}{(1-\varepsilon_i)/(\varepsilon_iA_i)}.
$$

表面之间的辐射交换为

$$
Q_{ij}=\frac{J_i-J_j}{1/(A_iF_{ij})}.
$$

于是每个表面可以画成一个节点：节点电势为 $J_i$，对地电阻为 $(1-\varepsilon_i)/(\varepsilon_iA_i)$，表面间电阻为 $1/(A_iF_{ij})$。这就是**辐射网络法**。

### 两面封闭腔

对两个表面组成的封闭腔（如无限大平行板、同心圆柱），网络简化为三个串联电阻：

$$
Q=\frac{\sigma\left(T_1^4-T_2^4\right)}
{\dfrac{1-\varepsilon_1}{\varepsilon_1A_1}
+\dfrac{1}{A_1F_{12}}
+\dfrac{1-\varepsilon_2}{\varepsilon_2A_2}}.
$$

对无限大平行板，$A_1=A_2=A$、$F_{12}=1$，单位面积热流为

$$
q''=\frac{\sigma\left(T_1^4-T_2^4\right)}
{1/\varepsilon_1+1/\varepsilon_2-1}.
$$

这个式子说明：即使两块板都是黑体，$q''$ 也不会超过 $\sigma(T_1^4-T_2^4)$；发射率降低会成倍增加热阻。

### 辐射屏

在两面之间插入一块薄屏（发射率 $\varepsilon_s$），网络增加两个表面电阻，并把原来的一个空间电阻换成两个。对无限大平行板，插入 $N$ 块屏后

$$
q''=\frac{\sigma\left(T_1^4-T_2^4\right)}
{1/\varepsilon_1+1/\varepsilon_2-1
+N\left(\dfrac{2}{\varepsilon_s}-1\right)}.
$$

当屏的发射率很低（如镀铝箔 $\varepsilon_s\approx0.05$）时，热流可降低一个数量级。这是真空绝热、低温储罐与航天热控的基础。

:::tip 辐射屏的方向性
辐射屏对“无限大平行板”近似成立；对圆柱面或球面，屏的表面积逐层增大，网络电阻需按各自面积计算。直接用平板公式会低估屏的效果。
:::

## 参与性介质

气体、烟炱、液滴云会吸收、发射与散射辐射，称为**参与性介质**。描述辐射在介质中传播的方程是**辐射传递方程**（RTE）：

$$
\frac{\mathrm{d}I_\lambda}{\mathrm{d}s}
=-\left(\kappa_\lambda+\sigma_{s\lambda}\right)I_\lambda
+\kappa_\lambda I_{b\lambda}
+\frac{\sigma_{s\lambda}}{4\pi}\int_{4\pi}I_\lambda\left(\mathbf{s}'\right)
p\left(\mathbf{s}'\!\to\mathbf{s}\right)\mathrm{d}\Omega',
$$

$\kappa_\lambda$ 是吸收系数，$\sigma_{s\lambda}$ 是散射系数，$p$ 是散射相函数。第一项是衰减，第二项是发射，第三项是散射入射。

### 光学厚度

定义光学厚度

$$
\tau=\int_0^L\left(\kappa+\sigma_s\right)\mathrm{d}s.
$$

$\tau\ll1$ 为**光学薄**，介质几乎透明，辐射可忽略或按体积源处理；$\tau\gg1$ 为**光学厚**，辐射近似为扩散，可用 Rosseland 近似：

$$
\mathbf{q}_{rad}=-\frac{16\sigma T^3}{3\kappa}\nabla T
=-k_{rad}\nabla T,
\qquad
k_{rad}=\frac{16\sigma T^3}{3\kappa}.
$$

这样辐射被折算成一个“辐射导热系数”，可直接加入能量方程，计算量最小。

### 常用辐射模型

| 模型 | 思路 | 适用 | 代价 |
| --- | --- | --- | --- |
| Rosseland | 光学厚扩散近似 | 炉膛、火焰内部 | 低，但光学薄区失效 |
| P1 | 辐射强度展开为一阶球谐 | 中等光学厚度 | 中等，需求解一个扩散方程 |
| 离散坐标（DO/DOM） | 在多个方向上解 RTE | 通用，可处理散射 | 高，方向数多 |
| 离散传递（DTM） | 沿射线积分 | 燃烧室 | 中等，射线效应 |
| Monte Carlo | 随机追踪光子 | 复杂几何、基准 | 很高，但最灵活 |

DO 模型在 CFD 中最常用：它把 $4\pi$ 立体角离散成若干方向，对每个方向解一条 RTE，方向数（如 8、16、32）决定精度与成本。方向太少会出现“射线效应”（ray effect），表现为非物理的热流条纹。

### 气体辐射

燃烧产物中的 CO$_2$、H$_2$O、CH$_4$ 在红外波段有强吸收带，吸收系数强烈依赖波长与温度。工程上用**灰气体加权和**（WSGG）模型，把非灰气体近似为几种灰气体的加权组合：

$$
\varepsilon\left(T\right)=\sum_{i=0}^{n}a_i\left(T\right)
\left[1-\exp\left(-\kappa_ipL\right)\right].
$$

更精确的方法是逐线计算（LBL）或窄带模型，但计算量太大，通常只用于生成 WSGG 系数。

## 辐射与对流、导热的耦合

表面辐射边界为

$$
-k\frac{\partial T}{\partial n}
=\varepsilon\sigma\left(T_w^4-T_{sur}^4\right)
+h\left(T_w-T_\infty\right).
$$

$T^4$ 的强非线性使迭代容易振荡，需做线性化：

$$
T_w^4\approx T_w^{*4}+4T_w^{*3}\left(T_w-T_w^{*}\right),
$$

把三次项并入系数矩阵，四次项留在源项。这是辐射耦合求解的标准技巧。

能量方程中的辐射源项为

$$
S_{rad}=-\nabla\cdot\mathbf{q}_{rad}
=\kappa\left(4\pi I_b-G\right),
$$

其中 $G=\int_{4\pi}I\,\mathrm{d}\Omega$ 是投入辐射。P1 与 DO 模型都通过这一项与能量方程耦合。

## Python 示例：两面封闭腔与辐射屏

下面的脚本计算两块无限大平行板之间的辐射热流，并比较插入 1 块与 5 块低发射率辐射屏的效果。

```python
import numpy as np

sigma = 5.670e-8
T1, T2 = 800.0, 300.0
eps1 = eps2 = 0.8

def q_parallel(T1, T2, eps1, eps2):
    return sigma * (T1**4 - T2**4) / (1/eps1 + 1/eps2 - 1)

def q_with_shields(T1, T2, eps1, eps2, eps_s, N):
    R = 1/eps1 + 1/eps2 - 1 + N * (2/eps_s - 1)
    return sigma * (T1**4 - T2**4) / R

q0 = q_parallel(T1, T2, eps1, eps2)
q1 = q_with_shields(T1, T2, eps1, eps2, 0.05, 1)
q5 = q_with_shields(T1, T2, eps1, eps2, 0.05, 5)

print(f"无屏热流：        {q0/1e3:8.2f} kW/m2")
print(f"1 块铝箔屏：      {q1/1e3:8.2f} kW/m2  ({q1/q0*100:.1f}%)")
print(f"5 块铝箔屏：      {q5/1e3:8.2f} kW/m2  ({q5/q0*100:.1f}%)")

# 屏数与热流的关系
for N in [0, 1, 2, 5, 10]:
    q = q_with_shields(T1, T2, eps1, eps2, 0.05, N) if N else q0
    print(f"N={N:2d}  q''={q/1e3:7.2f} kW/m2")
```

结果会显示：一块 $\varepsilon=0.05$ 的辐射屏就把热流降到原来的约 4%；屏数增加后热流近似按 $1/N$ 下降。这与真空绝热的设计逻辑完全一致。

:::warning 辐射计算的常见错误
三个高频错误：忘记 $E=\pi I$ 中的 $\pi$；把摄氏度直接代入 $T^4$（必须用开尔文）；对非黑体表面漏掉 $(1-\varepsilon)/\varepsilon$ 的表面电阻。任何辐射结果都应先用黑体极限 $\sigma(T_1^4-T_2^4)$ 检查量级。
:::

## 小结

- 黑体辐射由 Stefan–Boltzmann 定律 $E_b=\sigma T^4$ 描述，峰值波长由 Wien 定律给出。
- 实际表面用发射率、吸收率、反射率描述，灰体与漫射假设下 $\varepsilon=\alpha$。
- 角系数是纯几何量，满足互易性、封闭性与可加性；灰体网络把辐射问题化为电阻网络。
- 两面封闭腔的热流由表面电阻与空间电阻串联决定，辐射屏可成倍降低热流。
- 参与性介质用 RTE 描述，光学厚度决定能否用 Rosseland 或 P1 近似；DO 是通用但昂贵的模型。
- 辐射与能量方程耦合时需对 $T^4$ 线性化，避免迭代振荡。

## 延伸阅读

- Incropera, F. P., DeWitt, D. P. *Fundamentals of Heat and Mass Transfer*, 7th ed. Wiley, 2011.
- Çengel, Y. A., Ghajar, A. J. *Heat and Mass Transfer*, 6th ed. McGraw-Hill, 2020.
- Patankar, S. V. *Numerical Heat Transfer and Fluid Flow*. Hemisphere, 1980.
- Kays, W. M., Crawford, M. E., Weigand, B. *Convective Heat and Mass Transfer*, 4th ed. McGraw-Hill, 2005.

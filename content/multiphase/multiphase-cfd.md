---
title: 多相流 CFD 建模
order: 5
summary: 按“界面是否解析”梳理多相 CFD 的方法谱系：VOF/Level-Set 界面捕捉、欧拉-欧拉两流体、欧拉-拉格朗日颗粒追踪，给出相间力、相变与湍流封闭，并讨论网格、时间步与验证算例。
tags: [VOF, 欧拉-欧拉, 相间力, 表面张力]
---

前面的页面都在做“降维”：把三维界面平均成一维含气率与压降。真正的多相 CFD 要回答的是另一类问题：气泡怎么变形、液膜在哪里破裂、颗粒如何沉积、相分布是否均匀。这些问题没有一维对应物，必须在网格上解析或统计界面。方法的选择取决于一个判断：**界面要不要被解析**。

## 方法谱系

| 方法 | 界面处理 | 解析尺度 | 典型工具 | 适用场景 |
| --- | --- | --- | --- | --- |
| 界面解析（VOF / Level-Set / Front Tracking） | 显式捕捉 | 界面厚度 1–3 网格 | interFoam、Fluent VOF | 气泡上升、溃坝、液膜、射流破碎 |
| 欧拉-欧拉两流体 | 统计平均 | 大于气泡尺度的单元 | Fluent Mixture/Eulerian、multiphaseEulerFoam | 鼓泡塔、流化床、管流 |
| 欧拉-拉格朗日（点颗粒） | 颗粒追踪 | 颗粒小于网格 | Fluent DPM、MPPICFoam | 喷雾、旋风、颗粒输送 |
| 混合模型 | 代数滑移 | 大于分散相尺度 | Mixture | 低含气率、快速估算 |
| 群体平衡（PBM） | 粒径分布 | 统计 | OpenQBMM、Fluent PBM | 破碎/合并主导的分散流 |

一条经验规则：**界面尺度与设备尺度之比决定方法**。若气泡直径是管径的 1/10，界面解析需要极细网格；若气泡直径是管径的 1/1000，界面解析在工程上不可行，只能用欧拉-欧拉或拉格朗日。

## 欧拉-欧拉两流体模型

两流体模型把每一相都视为充满整个计算域的连续介质，用体积分数 $\alpha_k$ 表示局部占有率，$\sum_k\alpha_k=1$。对相 $k$：

$$
\frac{\partial(\alpha_k\rho_k)}{\partial t}
+\nabla\cdot(\alpha_k\rho_k\mathbf{u}_k)=\Gamma_k,
$$

$$
\frac{\partial(\alpha_k\rho_k\mathbf{u}_k)}{\partial t}
+\nabla\cdot(\alpha_k\rho_k\mathbf{u}_k\mathbf{u}_k)
=-\alpha_k\nabla p+\nabla\cdot\left(\alpha_k\boldsymbol{\tau}_k\right)
+\alpha_k\rho_k\mathbf{g}+\mathbf{F}_{ik}+\Gamma_k\mathbf{u}_k.
$$

$\Gamma_k$ 是相变质量源，$\mathbf{F}_{ik}$ 是相间动量交换。两相共享同一个压力场（假定局部压力平衡），这是“双流体”与“两套单相流”的关键区别。

### 相间力

相间力决定滑移与相分布，是两流体模型最主要的封闭难点。

**阻力（drag）**：

$$
\mathbf{F}_{D}=\frac{3}{4}\frac{\alpha_d\rho_c C_D}{d}\left|\mathbf{u}_r\right|\mathbf{u}_r,
\qquad
\mathbf{u}_r=\mathbf{u}_d-\mathbf{u}_c,
$$

$d$ 为分散相直径，$c$ 表示连续相。球形颗粒的 Schiller–Naumann 关系为

$$
C_D=\frac{24}{Re_p}\left(1+0.15Re_p^{0.687}\right),\quad Re_p<1000,
$$

$$
C_D=0.44,\quad Re_p>1000,
$$

$Re_p=\rho_c|\mathbf{u}_r|d/\mu_c$。气泡与液滴的阻力系数偏离刚性球，需用 Tomiyama、Grace 等考虑变形与污染度的关系式。

**升力（lift）**：

$$
\mathbf{F}_{L}=C_L\rho_c\alpha_d\left(\mathbf{u}_r\times\boldsymbol{\omega}_c\right),
$$

$\boldsymbol{\omega}_c=\nabla\times\mathbf{u}_c$ 是连续相涡量。无界剪切中刚性球的 Saffman 升力系数与 $\sqrt{Re_\omega}$ 有关；Auton 给出的典型值为 $C_L\approx0.5$。气泡的升力在大小气泡之间会变号，这是鼓泡塔径向相分布预测的关键。

**虚拟质量力（virtual mass）**：

$$
\mathbf{F}_{VM}=C_{VM}\rho_c\alpha_d
\left(\frac{\mathrm{D}\mathbf{u}_c}{\mathrm{D}t}
-\frac{\mathrm{D}\mathbf{u}_d}{\mathrm{D}t}\right),
$$

刚性球 $C_{VM}=0.5$。它描述分散相加速时对连续相的附加排开作用，在非定常流动中重要。

**壁面润滑力**：把气泡推离壁面，避免非物理的壁面高含气率。

**湍流扩散力**：由连续相湍流对分散相的随机输运产生，常用 Lopez de Bertodano 形式

$$
\mathbf{F}_{TD}=C_{TD}\rho_c k_c\nabla\alpha_d,
$$

$k_c$ 是连续相湍动能。它把分散相从高含气率区输运到低含气率区，抑制过陡的相界面。

| 相间力 | 量级 | 何时必须保留 |
| --- | --- | --- |
| 阻力 | 最大 | 几乎所有工况 |
| 升力 | 中等 | 存在剪切、需要预测径向分布 |
| 虚拟质量 | 中小 | 加速度大、非定常 |
| 壁面润滑 | 小 | 近壁相分布、沸腾通道 |
| 湍流扩散 | 小 | 高湍流、分散相扩散 |

### 相间传热

对分散相颗粒/气泡，常用 Ranz–Marshall 关系：

$$
Nu=2+0.6Re_p^{1/2}Pr^{1/3},
$$

它由“导热极限 $Nu=2$”与“对流增强”两部分组成。相间传热系数

$$
h=\frac{Nu\,k_c}{d},
$$

再乘以界面面积浓度 $a_i=6\alpha_d/d$，得到体积换热源项 $h a_i(T_c-T_d)$。

## 界面捕捉方法

### VOF

VOF 用体积分数 $\alpha$（液相为 1、气相为 0）标记界面：

$$
\frac{\partial\alpha}{\partial t}
+\nabla\cdot(\alpha\mathbf{u})=0.
$$

界面在 $\alpha=0.5$ 的等值面上重构。数值难点是 $\alpha$ 的输运必须保持**有界**（$0\le\alpha\le1$）且界面**锐利**。常用手段：

- **几何重构（PLIC）**：在每个单元内用平面切割重构界面，按通量精确输运；
- **界面压缩**：在 $\alpha$ 方程中加入压缩项

$$
\frac{\partial\alpha}{\partial t}
+\nabla\cdot(\alpha\mathbf{u})
+\nabla\cdot\left(\alpha(1-\alpha)\mathbf{u}_c\right)=0,
$$

$\mathbf{u}_c$ 是人为的压缩速度，只在界面处非零，用于抵消数值扩散。OpenFOAM 的 `interFoam` 采用这一形式，压缩系数 $C_\alpha$ 常取 1–4。

### 表面张力

表面张力以**连续表面力**（CSF，Brackbill）形式加入动量方程：

$$
\mathbf{f}_\sigma=\sigma\kappa\nabla\alpha,
\qquad
\kappa=-\nabla\cdot\left(\frac{\nabla\alpha}{|\nabla\alpha|}\right),
$$

$\kappa$ 是界面曲率。$\nabla\alpha$ 在离散意义下近似界面 delta 函数，因此体积分后等价于面上的表面张力。

CSF 的经典问题是**寄生电流**（parasitic currents）：离散曲率误差产生非物理的界面流动，在静止气泡周围形成涡环。缓解办法是提高曲率计算精度（如高度函数法）、使用平衡力公式（balanced-force CSF），或改用 Level-Set 的平滑曲率。

### Level-Set 与 CLSVOF

Level-Set 用带符号距离函数 $\phi$ 表示界面（$\phi=0$ 为界面）：

$$
\frac{\partial\phi}{\partial t}+\mathbf{u}\cdot\nabla\phi=0,
$$

每隔若干步做**重新初始化**，求解

$$
\frac{\partial\phi}{\partial\tau}
+S(\phi)\left(|\nabla\phi|-1\right)=0,
$$

使 $|\nabla\phi|\approx1$。Level-Set 的曲率光滑、界面精度高，但质量不守恒；VOF 守恒但界面易扩散。**CLSVOF** 把两者耦合：用 VOF 保证质量守恒，用 Level-Set 计算曲率与法向。

### 接触角与壁面润湿

壁面处的接触角通过界面法向的边界条件施加：

$$
\mathbf{n}_s=\cos\theta\,\mathbf{n}_w+\sin\theta\,\mathbf{t}_w,
$$

$\theta$ 是接触角，$\mathbf{n}_w$、$\mathbf{t}_w$ 是壁面法向与切向。液滴在疏水表面的滚动、冷凝液滴脱落都依赖这一条件。

## 欧拉-拉格朗日与颗粒

当分散相体积分数很低（通常 $<10^{-3}$）时，可以只追踪颗粒，连续相用欧拉网格：

$$
m_p\frac{\mathrm{d}\mathbf{v}_p}{\mathrm{d}t}
=\mathbf{F}_D+\mathbf{F}_L+\mathbf{F}_{VM}+m_p\mathbf{g}+\cdots,
$$

$$
\frac{\mathrm{d}\mathbf{x}_p}{\mathrm{d}t}=\mathbf{v}_p.
$$

球形颗粒的弛豫时间为

$$
\tau_p=\frac{\rho_p d_p^2}{18\mu_c},
$$

**Stokes 数** $St=\tau_p/\tau_f$ 衡量颗粒跟随流动的能力：$St\ll1$ 颗粒随流，$St\gg1$ 颗粒保持惯性。喷雾、旋风分离与颗粒沉积的定性行为都可以由 $St$ 判断。

**DEM** 在颗粒间加入软球碰撞力，用于密相颗粒流；**MP-PIC** 用计算粒子代表大量真实颗粒，兼顾 DEM 的碰撞模型与 CFD 的网格规模，适合鼓泡流化床。

## 湍流封闭

两流体模型的湍流建模有三条路线：

1. **混合物 $k$-$\varepsilon$**：把两相当作一个混合物，只解一套 $k$、$\varepsilon$，简单但对滑移强的工况偏差大；
2. **分相 $k$-$\varepsilon$**：每相一套，需要相间湍流交换项，封闭困难；
3. **Sato 气泡诱导湍流**：在连续相涡粘性上叠加

$$
\mu_t^{BI}=C_{BI}\rho_c\alpha_d d\left|\mathbf{u}_r\right|,
\qquad C_{BI}\approx0.01,
$$

它描述气泡尾迹产生的额外混合。鼓泡塔的径向液速剖面若不加这一项，往往预测成“壁面上升、中心下降”的错误形状。

## 相变模型

### Lee 模型

Lee（1980）把相变写成温度偏离饱和温度的线性松弛：

$$
\dot m_{l\to g}=r\,\alpha_l\rho_l\frac{T-T_{sat}}{T_{sat}},
\qquad T>T_{sat},
$$

$$
\dot m_{g\to l}=r\,\alpha_g\rho_g\frac{T_{sat}-T}{T_{sat}},
\qquad T<T_{sat},
$$

$r$ 是经验传质系数（单位 1/s），需要按过热/过冷程度标定。它简单、稳健，但把界面传热简化为体积松弛，不能预测气泡生长速率。

### 壁面沸腾（RPI 模型）

Kurul 与 Podowski 提出的 RPI 壁面热流分解为三部分：

$$
q''_w=q''_c+q''_q+q''_e,
$$

- $q''_c$：单相对流，按液相体积分数加权；
- $q''_q$：气泡脱离时带走的显热（quenching）；
- $q''_e$：气泡生长期间的蒸发潜热。

$$
q''_e=\frac{\pi}{6}d_w^3\rho_g h_{fg}f\,N_a,
$$

$d_w$ 是气泡脱离直径，$f$ 是脱离频率，$N_a$ 是活化核心密度。RPI 模型把核态沸腾的微观机制压缩成几个待标定参数，是沸腾 CFD 的主流工程做法。

## 数值实践

### 时间步

- 对流 CFL：$\Delta t\le CFL\cdot\Delta x/|\mathbf{u}|$，显式格式取 $CFL\lesssim0.5$；
- 界面 CFL：VOF 界面步通常取 0.1–0.25；
- 毛细时间步：$\Delta t_\sigma=\sqrt{\rho_l\Delta x^3/(2\pi\sigma)}$，用于显式表面张力，否则界面会不稳定。

### 网格

界面解析要求界面法向 10 层以上网格，曲率才能算准；界面附近还应加密。欧拉-欧拉对网格要求较低，但单元尺寸应大于气泡尺度，否则“体积分数”失去统计意义。

| 求解器（OpenFOAM） | 方法 | 典型用途 |
| --- | --- | --- |
| `interFoam` | VOF + 界面压缩 | 溃坝、气泡、液膜 |
| `interIsoFoam` | VOF + 几何重构 | 锐利界面 |
| `multiphaseEulerFoam` | 欧拉-欧拉多相 | 鼓泡塔、流化床 |
| `reactingTwoPhaseEulerFoam` | 欧拉-欧拉 + 相变/反应 | 沸腾、冷凝 |
| `MPPICFoam` | MP-PIC | 密相颗粒流 |
| `driftFluxFoam` | 漂移流 | 沉降、泥浆 |

## Python 示例：一维 VOF 输运的数值扩散

下面的脚本用一维常速度场输运阶跃界面，比较一阶迎风与带压缩项格式的界面锐度。它复现了 VOF 中最常见的问题：数值扩散会把界面抹成几十个网格宽。

```python
import numpy as np
import matplotlib.pyplot as plt

n, L = 200, 1.0
dx = L / n
x = np.linspace(dx / 2, L - dx / 2, n)
u = 1.0
dt = 0.4 * dx / u
nsteps = 200

def init():
    a = np.zeros(n)
    a[(x > 0.2) & (x < 0.4)] = 1.0     # 初始液块
    return a

def upwind(a):
    flux = np.zeros(n + 1)
    flux[1:-1] = u * np.where(u > 0, a[:-1], a[1:])
    a_new = a - dt / dx * (flux[1:] - flux[:-1])
    return np.clip(a_new, 0.0, 1.0)

def compressive(a, C=1.0):
    # 简化界面压缩：在界面处附加反向通量，抵消数值扩散
    a_new = upwind(a)
    grad = np.gradient(a, dx)
    ac = -C * u * dx * grad * (a * (1 - a))
    a_new = np.clip(a_new - dt / dx * (ac - np.roll(ac, 1)), 0.0, 1.0)
    return a_new

a0 = init()
a1, a2 = a0.copy(), a0.copy()
for _ in range(nsteps):
    a1 = upwind(a1)
    a2 = compressive(a2, C=2.0)

plt.figure(figsize=(6, 3.5))
plt.plot(x, a0, "k--", label="initial")
plt.plot(x, a1, label="first-order upwind")
plt.plot(x, a2, label="with compression")
plt.xlabel("x")
plt.ylabel(r"$\alpha$")
plt.legend()
plt.grid(alpha=0.3)
plt.tight_layout()
plt.show()

print("迎风界面宽度（alpha 从 0.05 到 0.95 的网格数）:",
      np.sum((a1 > 0.05) & (a1 < 0.95)))
print("压缩格式界面宽度:",
      np.sum((a2 > 0.05) & (a2 < 0.95)))
```

这段代码不是生产级 VOF，但它把两个要点演示清楚：一阶迎风的数值扩散与界面压缩的锐化作用。真实求解器用 PLIC 几何重构，界面宽度可控制在 2–3 个网格。

:::warning 表面张力的时间步限制
显式表面张力在细网格上极其刚硬。若 $\Delta t$ 超过毛细时间步，界面会出现网格尺度的“锯齿”并迅速发散。遇到这种情况，应先减小时间步，再检查曲率离散是否守恒。
:::

## 验证算例

| 算例 | 考察内容 | 常用参考解 |
| --- | --- | --- |
| 静气泡（Laplace 压力） | 表面张力、寄生电流 | $\Delta p=2\sigma/R$ |
| 单气泡上升 | 阻力、变形、路径稳定性 | 实验轨迹与终端速度 |
| 溃坝 | 界面输运、质量守恒 | Martin–Moyce 实验 |
| Rayleigh–Taylor | 界面不稳定增长 | 线性增长率 |
| 鼓泡塔 | 相分布、径向液速 | 实验与一维漂移流 |
| 流化床 | 颗粒碰撞、压降 | 最小流化速度 |

验证时至少检查三条：质量守恒（$\sum\alpha$ 漂移）、网格收敛（界面厚度与气泡速度随加密变化）、能量/动量平衡。只对照一张“好看的云图”不能算验证。

## 小结

- 多相 CFD 的第一决策是界面是否解析：解析用 VOF/Level-Set，统计平均用欧拉-欧拉，稀薄分散用拉格朗日。
- 两流体模型的核心是相间力封闭，阻力、升力、虚拟质量、壁面润滑与湍流扩散各有适用工况。
- VOF 的关键是有界输运与锐利界面，表面张力用 CSF 模型，需警惕寄生电流与毛细时间步。
- 相变可用 Lee 体积松弛或 RPI 壁面沸腾模型，后者把核态沸腾分解为对流、淬熄与蒸发三部分。
- 网格、时间步与验证算例共同决定结果可信度，云图不能代替定量校核。

## 延伸阅读

- Brennen, C. E. *Fundamentals of Multiphase Flow*. Cambridge University Press, 2005.
- Ishii, M., Hibiki, T. *Thermo-Fluid Dynamics of Two-Phase Flow*, 2nd ed. Springer, 2006.
- Crowe, C. T., Schwarzkopf, J. D., Sommerfeld, M., Tsuji, Y. *Multiphase Flows with Droplets and Particles*, 2nd ed. CRC Press, 2011.
- Wallis, G. B. *One-Dimensional Two-Phase Flow*. McGraw-Hill, 1969.

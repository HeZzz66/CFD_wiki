---
title: 有限体积法 FVM
order: 1
summary: 从积分守恒律出发，讲清控制体、面通量、扩散与对流离散、Riemann 求解器、压力速度耦合与时间推进，并给出一维对流扩散的完整 Python 实现。
tags: [有限体积法, 迎风格式, SIMPLE, Riemann 求解器]
---

有限体积法（Finite Volume Method，FVM）的核心只有一句话：守恒律在任意控制体上都成立，离散时只需保证每个面上的通量“进多少、出多少”。这条性质使它天然守恒，也让它在激波、自由面、强源项问题上比有限差分更稳健。工程上常见的 Fluent、CFX、STAR-CCM+、OpenFOAM 的有限体积求解器，都是这一思想的实现。

这一页从积分形式出发，依次讨论扩散项、对流项、通量分裂、压力速度耦合与时间推进，最后用一个一维对流扩散算例把格式、稳定性与误差串起来。

## 从积分守恒律到半离散形式

对固定控制体 $V$，边界为 $\partial V$，外法向为 $\mathbf{n}$，守恒律的积分形式为

$$
\frac{\mathrm{d}}{\mathrm{d}t}\int_V \mathbf{U}\,\mathrm{d}V
+\oint_{\partial V}\mathbf{F}(\mathbf{U})\cdot\mathbf{n}\,\mathrm{d}S
=\int_V\mathbf{S}(\mathbf{U})\,\mathrm{d}V,
$$

其中 $\mathbf{U}$ 是守恒量向量，$\mathbf{F}$ 是通量张量（对 N-S 方程包含无粘与粘性两部分），$\mathbf{S}$ 是源项。$V$ 可以是任意形状，这一点很关键：FVM 不要求网格是笛卡尔矩形，只要求能算出每个面的面积、法向与几何中心。

把单元 $P$ 的体积记为 $V_P$，单元平均守恒量记为 $\mathbf{U}_P$，面 $f$ 的通量记为 $\Phi_f$，则

$$
V_P\frac{\mathrm{d}\mathbf{U}_P}{\mathrm{d}t}
+\sum_{f\in\mathcal{F}_P}\Phi_f
=V_P\mathbf{S}_P,
$$

$\mathcal{F}_P$ 是单元 $P$ 的所有面。这就是半离散形式：空间导数被换成了面的面积分，未知量存放在单元中心或顶点。

按未知量位置，FVM 分为两类。

- **单元中心（cell-centered）**：未知量存在单元形心，面通量由相邻两个单元的值构造。绝大多数商业软件与 OpenFOAM 采用这种布局，边界条件通过虚拟单元或面值施加。
- **顶点中心（vertex-centered）**：未知量存在网格节点，控制体由围绕节点的单元拼成（对偶网格）。它在非结构网格上精度略好，但控制体构造与并行分区更复杂。

## 扩散项离散

扩散通量是

$$
\Phi_f^{\mathrm{diff}}
=\int_{A_f}\Gamma\nabla\phi\cdot\mathbf{n}\,\mathrm{d}A
\approx \Gamma_f\left(\nabla\phi\right)_f\cdot\mathbf{n}_f A_f,
$$

其中 $\Gamma$ 是扩散系数（粘性、导热或组分扩散），$A_f$ 是面面积，$\mathbf{n}_f$ 是单位外法向。难点在于面法向梯度。若连接单元中心 $P,N$ 的向量 $\mathbf{d}_{PN}$ 与 $\mathbf{n}_f$ 平行（正交网格），可以直接写成

$$
\left(\nabla\phi\right)_f\cdot\mathbf{n}_f
\approx\frac{\phi_N-\phi_P}{d_{PN}},
$$

$d_{PN}$ 是两中心在法向上的投影距离。这一步把扩散项化成了“相邻值之差”，系数为正，天然满足最大值原理。

实际网格很少完全正交。非正交时把法向分解为

$$
\mathbf{n}_f=\frac{\mathbf{d}_{PN}}{\mathbf{d}_{PN}\cdot\mathbf{n}_f}+\mathbf{k}_f,
$$

$\mathbf{k}_f$ 是剩余的“非正交矢量”。于是面梯度写成两项

$$
\left(\nabla\phi\right)_f\cdot\mathbf{n}_f
\approx\frac{\phi_N-\phi_P}{d_{PN}}
+\mathbf{k}_f\cdot\overline{\nabla\phi}_f,
$$

第二项称为非正交修正，$\overline{\nabla\phi}_f$ 是面两侧梯度的平均。修正项显式处理时会使矩阵失去严格对角占优，因此常配合迭代或延迟修正。正交性差、修正过大时，计算容易发散，这也是网格质量页反复强调正交性的原因。

## 对流项离散

对流项需要面值 $\phi_f$。不同的取值方式，决定了格式的精度、稳定性与数值扩散。

**中心差分**取两侧平均：

$$
\phi_f=\frac{1}{2}\left(\phi_P+\phi_N\right).
$$

它二阶精度，但在对流主导时会产生非物理振荡，单元 Péclet 数超过 2 后解可能完全失真。

**一阶迎风**按流动方向取上游值：

$$
\phi_f=
\begin{cases}
\phi_P, & \mathbf{u}_f\cdot\mathbf{n}_f>0,\\
\phi_N, & \text{otherwise}.
\end{cases}
$$

它绝对有界、不会振荡，代价是严重的数值扩散：在均匀网格上相当于把扩散系数人为增加

$$
\Gamma_{\mathrm{num}}=\frac{\rho u\Delta x}{2}.
$$

网格越粗、速度越大，抹平越厉害。激波会被抹成好几层单元，边界层厚度也会被高估。

**二阶迎风**用上游两个单元做线性外推：

$$
\phi_f=\frac{3}{2}\phi_P-\frac{1}{2}\phi_W,
$$

其中 $W$ 是 $P$ 的上游邻居。它精度更高，但仍有振荡风险。

**QUICK** 用上游两点与下游一点做二次插值，在面位于两单元中点时

$$
\phi_f=\frac{3}{4}\phi_P+\frac{3}{8}\phi_N-\frac{1}{8}\phi_W.
$$

它对涡与边界层的分辨更好，但同样需要限制器才能保证有界。

| 格式 | 名义精度 | 有界性 | 数值扩散 | 典型用途 |
| --- | --- | --- | --- | --- |
| 中心差分 | 二阶 | 差 | 无 | 扩散主导、LES 的低耗散需求 |
| 一阶迎风 | 一阶 | 好 | 大 | 初值、强对流、鲁棒性优先 |
| 二阶迎风 | 二阶 | 一般 | 中 | 一般内流、稳态计算 |
| QUICK | 二阶（三点） | 一般 | 小 | 旋转机械、分离流 |
| 受限高阶 | 二阶 | 好 | 小 | 激波、自由面、输运标量 |

### TVD 与限制器

要同时获得高阶精度与有界性，需要让格式在光滑区取高阶、在极值附近退化为一阶。总变差递减（TVD）条件提供了这个框架。面值写成

$$
\phi_f=\phi_P+\frac{1}{2}\psi(r_f)\left(\phi_P-\phi_W\right),
$$

$$
r_f=\frac{\phi_P-\phi_W}{\phi_N-\phi_P},
$$

$\psi(r)$ 是限制器。$r$ 接近 1 表示单调光滑，$\psi$ 接近 1 保留二阶；$r$ 为负或很小表示出现极值，$\psi$ 趋于 0 退回迎风。常用的 minmod 限制器为

$$
\psi(r)=\max\left(0,\min(1,r)\right),
$$

van Leer 限制器为

$$
\psi(r)=\frac{r+\lvert r\rvert}{1+\lvert r\rvert}.
$$

限制器把格式降到一阶极值点附近，因此激波后仍会有一层过渡，但不会出现负密度或负压力。

## 通量分裂与近似 Riemann 求解器

可压缩流动的对流通量依赖左右两个状态。把面左右两侧的重构值记为 $\mathbf{U}_L,\mathbf{U}_R$，Godunov 型格式通过求解局部 Riemann 问题得到通量。精确解太贵，工程上多用近似求解器。

**Roe 格式**把通量差分解到特征空间：

$$
\mathbf{F}_f=\frac{1}{2}\left(\mathbf{F}_L+\mathbf{F}_R\right)
-\frac{1}{2}\sum_{k}\lvert\lambda_k\rvert\alpha_k\mathbf{r}_k,
$$

$\lambda_k$ 是 Roe 平均后的特征值，$\alpha_k$ 是波强，$\mathbf{r}_k$ 是右特征向量。它的分辨率高，但在跨声速点附近特征值趋零，会产生膨胀激波，需要熵修正。

**HLLC** 用两层波与一个接触波近似 Riemann 扇：

$$
\mathbf{F}_{\mathrm{HLLC}}=
\begin{cases}
\mathbf{F}_L, & S_L\ge 0,\\
\mathbf{F}_L+S_L\left(\mathbf{U}^{*}_L-\mathbf{U}_L\right), & S_L<0\le S_M,\\
\mathbf{F}_R+S_R\left(\mathbf{U}^{*}_R-\mathbf{U}_R\right), & S_M<0<S_R,\\
\mathbf{F}_R, & S_R\le 0,
\end{cases}
$$

$S_L,S_R$ 是左右波速估计，$S_M$ 是接触波速度，$\mathbf{U}^{*}_L,\mathbf{U}^{*}_R$ 是星区状态。HLLC 保正、鲁棒，适合激波与强膨胀，是许多可压缩求解器的默认选择；代价是接触面与剪切层分辨率不如 Roe。

可压缩与不可压缩的差异不只在通量形式。可压缩求解器以密度为基本变量，用状态方程闭合压力，时间推进受声速 CFL 限制；不可压缩求解器把压力当作约束乘子，需要解压力泊松方程，密度不随压力变化。低速可压缩流动若直接用密度基求解器，会遇到刚性问题，因此常改用压力基或预处理。

:::note 什么时候需要 Riemann 求解器
只有可压缩、以密度为变量的求解器才需要。不可压缩 FVM 的对流项本质是“输运已知标量”，用迎风或限制器即可，不需要求解 Riemann 问题。
:::

## 压力-速度耦合

不可压缩 N-S 方程没有压力的时间导数，连续性方程只是一个约束。若把压力和速度都存放在单元中心，会出现棋盘压力：相邻单元压力高低交替，中心差分的压力梯度在单元中心恰好为零，动量方程感知不到压力，解却满足离散连续性。这就是同位网格的棋盘问题。

Rhie-Chow 动量插值通过构造面法向速度来抑制该模式：

$$
u_{f,n}=\overline{u}_{f,n}
-\frac{V_f}{a_P}\left[
\frac{p_N-p_P}{d_{PN}}
-\left(\overline{\nabla p}\right)_f\cdot\mathbf{n}_f
\right],
$$

$\overline{u}_{f,n}$ 是动量插值得到的面速度，$a_P$ 是动量方程主对角系数，方括号内是“面压力梯度减去插值压力梯度”。它在面通量中重新引入压力差，使棋盘模式无法零能耗散。

SIMPLE 算法在此基础上迭代：

1. 给定初始压力场 $p^{*}$，求解动量方程得到 $u^{*}$；
2. 用 $u^{*}$ 计算各面质量通量，得到连续性误差；
3. 解压力修正方程

$$
\nabla\cdot\left(\frac{V_P}{a_P}\nabla p'\right)=\nabla\cdot\mathbf{u}^{*},
$$

4. 用 $p'$ 修正压力与速度，并更新面通量；
5. 更新物性、检查残差与监测量，未收敛则回到第 1 步。

压力与速度通常需要欠松弛（例如压力 0.3、动量 0.7），否则修正量过大会导致振荡。PISO 在同一个时间步内做两次或更多压力修正，且去掉了 SIMPLE 的部分欠松弛，适合瞬态问题；代价是每步计算量更大。

## 时间推进与收敛

半离散方程是一个常微分方程组。隐式欧拉写成

$$
V_P\frac{\mathbf{U}^{n+1}_P-\mathbf{U}^{n}_P}{\Delta t}
+\mathbf{R}_P\left(\mathbf{U}^{n+1}\right)=0,
$$

$\mathbf{R}_P$ 是空间残差（面通量之和减去源项）。隐式格式无条件稳定，但每步要解大型线性系统，时间精度只有一阶；二阶向后差分或 Crank–Nicolson 可以提高时间精度。

显式格式受 CFL 条件限制：

$$
\mathrm{CFL}=\frac{\lVert\mathbf{u}\rVert\Delta t}{\Delta x}\le 1,
$$

可压缩流动还要把声速算进去：

$$
\Delta t\le\frac{V_P}{\sum_f\left(\lvert u_n\rvert+c\right)A_f},
$$

$u_n$ 是面法向速度，$c$ 是当地声速。显式格式每步便宜但步数多，适合 LES 与强非定常问题；隐式格式适合稳态与长时间平均。

稳态计算常用伪时间推进：在方程中加一个伪时间导数，用局部时间步长把不同尺寸的单元“拉平”，加速收敛到定常解。收敛判据不能只看残差，还要看监测量：

$$
R_{\mathrm{rms}}=\sqrt{\frac{1}{N}\sum_{i=1}^{N}r_i^2},
$$

$r_i$ 是第 $i$ 个单元的归一化残差，$N$ 是单元数。工程上常要求残差下降三到四个数量级，同时进出口质量流量不平衡小于千分之一、关键监测量（升力、压降、壁面热流）趋于平稳。残差曲线变成一条水平线但监测量仍在漂移，通常说明还有未收敛的低频模态。

## 一维稳态对流-扩散的 Python 示例

考虑

$$
u\frac{\mathrm{d}\phi}{\mathrm{d}x}
=\Gamma\frac{\mathrm{d}^2\phi}{\mathrm{d}x^2},
\qquad \phi(0)=0,\ \phi(1)=1,
$$

取 $u=1$、$\Gamma=0.1$、$L=1$，则 Péclet 数 $\mathrm{Pe}=uL/\Gamma=10$。解析解为

$$
\phi(x)=\frac{e^{\mathrm{Pe}\,x}-1}{e^{\mathrm{Pe}}-1}.
$$

在均匀网格上做单元中心 FVM：对流项用一阶迎风，扩散项用中心差分，边界用半格距离施加 Dirichlet 条件。组装得到三对角系统，用 Thomas 算法求解：

```python
import numpy as np

def thomas(a, b, c, d):
    """三对角求解：a 为下对角（长度 n-1），b 主对角，c 上对角，d 右端。"""
    n = len(d)
    b = b.astype(float).copy()
    c = c.astype(float).copy()
    d = d.astype(float).copy()
    for i in range(1, n):
        m = a[i - 1] / b[i - 1]
        b[i] -= m * c[i - 1]
        d[i] -= m * d[i - 1]
    x = np.zeros(n)
    x[-1] = d[-1] / b[-1]
    for i in range(n - 2, -1, -1):
        x[i] = (d[i] - c[i] * x[i + 1]) / b[i]
    return x

def solve_upwind(n, u=1.0, gamma=0.1, length=1.0):
    """一维稳态对流-扩散，一阶迎风 + 中心差分扩散。"""
    h = length / n
    a = np.zeros(n - 1)
    b = np.zeros(n)
    c = np.zeros(n)
    d = np.zeros(n)

    # 西边界：入口 phi=0，扩散项用半格距离
    b[0] = u + 3.0 * gamma / h
    c[0] = -gamma / h

    # 内部单元：迎风对流 + 两侧扩散
    for i in range(1, n - 1):
        a[i - 1] = -(u + gamma / h)
        b[i] = u + 2.0 * gamma / h
        c[i] = -gamma / h

    # 东边界：出口 phi=1，扩散项用半格距离
    a[n - 2] = -(u + gamma / h)
    b[n - 1] = u + 3.0 * gamma / h
    d[n - 1] = 2.0 * gamma / h

    return thomas(a, b, c, d)

pe = 10.0
for n in (10, 20, 40, 80):
    h = 1.0 / n
    phi = solve_upwind(n)
    x = (np.arange(n) + 0.5) * h
    exact = (np.exp(pe * x) - 1.0) / (np.exp(pe) - 1.0)
    err = np.max(np.abs(phi - exact))
    print(f"N={n:3d}  h={h:.4f}  max|err|={err:.4e}")
    if n == 40:
        print("   x       数值解      解析解")
        for i in range(0, n, 5):
            print(f"  {x[i]:.3f}  {phi[i]:.6f}  {exact[i]:.6f}")
```

运行后可以看到两点。第一，数值解整体跟着解析曲线，但在 $x$ 接近 1 的薄边界层内被迎风格式抹平：$\Gamma_{\mathrm{num}}=uh/2$ 在 $N=10$ 时为 $0.05$，相当于把真实扩散系数放大了一半。第二，最大误差随 $N$ 加倍近似减半，体现一阶格式的收敛速率。

若把对流项换成中心差分，$\mathrm{Pe}$ 较大时解会在边界层前出现振荡，甚至出现负值；这正是单元 Péclet 数超过 2 的典型症状。实际计算中，二阶格式必须配合限制器，或改用足够细的网格。

:::warning 边界条件的半格距离
边界单元只有一个内部邻居，扩散通量的距离是 $h/2$ 而不是 $h$。漏掉这个半格因子会使壁面通量偏差接近一倍，且网格越细偏差越隐蔽。
:::

## 小结

- FVM 守恒性来自“面通量成对出现”，同一面在两侧单元符号相反，内部面自动抵消。
- 扩散项的核心是面法向梯度，非正交网格需要修正；对流项的核心是面值重构，精度与有界性需要折中。
- 可压缩流动用 Riemann 型通量，不可压缩流动用压力修正与 Rhie–Chow 插值解决棋盘问题。
- 时间推进的稳定条件、残差判据与监测量必须一起看。网格质量与工作流分别决定了离散误差与设置误差。

进一步阅读：网格如何影响这些格式，见[[ch3/mesh|网格生成与质量]]；如何把一次计算组织成可复现的流程，见[[ch3/cfd-workflow|CFD 工作流与验证确认]]。

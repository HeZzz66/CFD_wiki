---
title: 有限元法 FEM
order: 2
summary: 从强形式、加权残差到 Galerkin 弱形式，推导一维 Poisson 的单元刚度矩阵，并讨论等参元、数值积分、边界条件、时间推进与对流稳定化。
tags: [有限元法, 弱形式, Galerkin, 刚度矩阵]
---

有限元法（Finite Element Method，FEM）与有限体积法一样，都是把连续方程变成代数方程，但它的出发点不是“面通量守恒”，而是“残差在某种加权意义下为零”。这套语言最初为结构力学设计，如今已扩展到传热、电磁、流固耦合与多物理场。对 CFD 读者来说，FEM 至少有两个用途：理解弱形式与边界条件的自然处理方式，以及在复杂几何、共轭传热、流固耦合问题中选择合适的工具。

这一页用一维 Poisson 方程走完整个推导，再把它推广到二维单元、时间依赖问题与不可压流动。

## 从强形式到弱形式

考虑一维 Poisson 方程

$$
-\frac{\mathrm{d}^2u}{\mathrm{d}x^2}=f(x),
\qquad 0<x<1,
$$

边界条件 $u(0)=u(1)=0$。这是“强形式”：要求 $u$ 二阶可导，且逐点满足方程。真实解在角点、材料界面附近往往不满足这么强的光滑性，弱形式则把要求降低到一阶导数平方可积。

取任意检验函数 $v$，在定义域上积分：

$$
\int_0^1\left(-u''-f\right)v\,\mathrm{d}x=0.
$$

对第一项分部积分：

$$
\int_0^1 u'v'\,\mathrm{d}x
-\left[u'v\right]_0^1
=\int_0^1 fv\,\mathrm{d}x.
$$

若检验函数在边界上为零，边界项消失，得到弱形式：求 $u\in H_0^1$，使

$$
\int_0^1 u'v'\,\mathrm{d}x
=\int_0^1 fv\,\mathrm{d}x,
\qquad \forall v\in H_0^1.
$$

$H_0^1$ 表示一阶导数平方可积、在边界取零的函数空间。这个式子只含一阶导数，因此分片线性函数也可以代入。Galerkin 方法进一步把 $u$ 与 $v$ 都限制在同一个有限维子空间中，这就是“试函数与检验函数同空间”。

## 形函数与单元刚度矩阵

把区间分成 $n$ 个单元，节点为 $0=x_0<x_1<\cdots<x_n=1$，单元长度 $h_e=x_{e+1}-x_e$。在每个节点放一个“帽子函数” $N_j$：在节点 $j$ 取 1，在相邻节点取 0，其余为零。于是近似解为

$$
u_h(x)=\sum_{j=0}^{n}u_jN_j(x),
$$

$u_j$ 是节点值，也是未知量。取 $v=N_i$，代入弱形式：

$$
\sum_{j=0}^{n}u_j\int_0^1 N_i'N_j'\,\mathrm{d}x
=\int_0^1 fN_i\,\mathrm{d}x.
$$

写成矩阵形式

$$
\mathbf{K}\mathbf{u}=\mathbf{F},
$$

其中

$$
K_{ij}=\int_0^1 N_i'N_j'\,\mathrm{d}x,
\qquad
F_i=\int_0^1 fN_i\,\mathrm{d}x.
$$

$K$ 就是刚度矩阵，$F$ 是载荷向量。逐个单元积分，单元 $e$ 上的局部矩阵为

$$
\mathbf{K}^e=\frac{1}{h_e}
\begin{bmatrix}
1 & -1\\
-1 & 1
\end{bmatrix},
\qquad
\mathbf{F}^e=\frac{h_e}{2}
\begin{bmatrix}
1\\1
\end{bmatrix}
$$

后者对应 $f=1$ 的一致载荷。局部矩阵对所有单元都相同（均匀网格），组装时按节点编号叠加到全局矩阵的对角块，相邻单元在共享节点上的贡献自动相加。这正是“单元刚度矩阵组装成整体刚度矩阵”的过程。

## 等参元、Jacobian 与数值积分

二维问题很少是规则矩形。等参元把物理坐标与参考坐标用同一组形函数联系起来：

$$
x(\xi,\eta)=\sum_{a}N_a(\xi,\eta)x_a,
\qquad
y(\xi,\eta)=\sum_{a}N_a(\xi,\eta)y_a.
$$

积分从物理单元换到参考单元（例如 $[-1,1]^2$）时，面积元要乘上 Jacobian 行列式：

$$
\int_{\Omega_e}g(x,y)\,\mathrm{d}x\,\mathrm{d}y
=\int_{-1}^{1}\int_{-1}^{1}
g\left(x(\xi,\eta),y(\xi,\eta)\right)
\lvert J(\xi,\eta)\rvert\,\mathrm{d}\xi\,\mathrm{d}\eta,
$$

$J$ 是坐标变换的 Jacobian 矩阵，$\lvert J\rvert$ 是其行列式。形函数对物理坐标的导数则为

$$
\frac{\partial N_a}{\partial x}
=\frac{\partial N_a}{\partial \xi}\frac{\partial \xi}{\partial x}
+\frac{\partial N_a}{\partial \eta}\frac{\partial \eta}{\partial x},
$$

实际实现中通过 $J^{-1}$ 一次性计算两个方向的导数。

积分通常用 Gauss 求积：

$$
\int_{-1}^{1}g(\xi)\,\mathrm{d}\xi
\approx\sum_{q=1}^{n_q}w_qg(\xi_q),
$$

$n_q$ 个 Gauss 点可以精确积分 $2n_q-1$ 次多项式。线性三角形用 1 点（形心），二次三角形常用 3 点或 6 点；四边形常用 $2\times2$ Gauss。积分点不足会导致“沙漏”模式，过多则浪费计算。

二维常用单元包括：

- **三角形**：适应任意边界，线性元 3 节点、二次元 6 节点；
- **四边形**：结构化区域精度高，但扭曲过大时 Jacobian 可能为负；
- **混合单元**：边界用三角形、内部用四边形，兼顾贴合与效率。

若某个单元的 $\lvert J\rvert$ 为负，说明单元节点顺序反了或单元被压扁，刚度矩阵会出现负贡献，求解必然出错。这是网格检查中最先要看的一项。

## 组装、边界条件与稀疏求解

组装后的 $\mathbf{K}$ 是稀疏、对称、正定的（在正确边界条件下）。整体规模可能达到百万未知量，不能存成稠密矩阵。常用格式是压缩稀疏行（CSR），配合共轭梯度、GMRES 与代数多重网格预条件。

Dirichlet 边界条件有两种施加方式。

**消元法**把已知节点集合记为 $c$、自由节点记为 $f$，把方程分块：

$$
\mathbf{K}_{ff}\mathbf{u}_f
=\mathbf{F}_f-\mathbf{K}_{fc}\mathbf{u}_c,
$$

$\mathbf{u}_c$ 是已知边界值。只需求解自由部分的子系统，数值上最干净。

**置大数法**把对角元乘上一个极大数、右端项改为“极大数乘给定值”，强迫该节点近似取给定值。实现简单，但会破坏矩阵条件数，且在大规模并行中不如消元稳定。

Neumann 边界条件不需要修改未知量：在弱形式分部积分时，边界项 $\int_{\partial\Omega}v\nabla u\cdot\mathbf{n}$ 会自然出现，把给定的热流或面力代入即可。这是 FEM 相对 FDM 的一个优势：通量边界是“自然边界条件”，无需虚拟节点。

## 时间依赖与对流主导问题

瞬态扩散方程

$$
\frac{\partial u}{\partial t}=\nabla\cdot\left(\Gamma\nabla u\right)+s
$$

经空间离散后得到

$$
\mathbf{M}\dot{\mathbf{u}}+\mathbf{K}\mathbf{u}=\mathbf{F},
$$

$\mathbf{M}$ 是质量矩阵。时间方向可用 $\theta$ 格式：

$$
\mathbf{M}\frac{\mathbf{u}^{n+1}-\mathbf{u}^{n}}{\Delta t}
+\theta\mathbf{K}\mathbf{u}^{n+1}
+(1-\theta)\mathbf{K}\mathbf{u}^{n}
=\mathbf{F}^{n+\theta},
$$

$\theta=0$ 为显式 Euler，$\theta=1$ 为隐式 Euler，$\theta=1/2$ 为 Crank–Nicolson。显式格式受网格与扩散系数限制，隐式格式稳定但每步要解线性系统。

对流主导时，标准 Galerkin 解会出现跨节点的非物理振荡，因为中心型权函数无法识别流动方向。稳定化方法是在弱形式中加入沿流线的残差项，例如 SUPG：

$$
\sum_{e}\int_{\Omega_e}
\tau_e\left(\mathbf{b}\cdot\nabla\mathbf{w}\right)
\mathcal{R}(u_h)\,\mathrm{d}\Omega,
\qquad
\tau_e\approx\frac{h_e}{2\lVert\mathbf{b}\rVert},
$$

$\mathbf{b}$ 是流速，$\mathcal{R}(u_h)$ 是方程残差，$\tau_e$ 是单元时间尺度。它相当于在流线方向引入可控的数值扩散，而不污染横向。

不可压 N-S 的混合元还要满足 Ladyzhenskaya–Babuška–Brezzi（LBB）条件：

$$
\inf_{q\ne0}\sup_{\mathbf{v}\ne0}
\frac{\int_\Omega q\,\nabla\cdot\mathbf{v}\,\mathrm{d}\Omega}
{\lVert\mathbf{v}\rVert_1\lVert q\rVert_0}
\ge\beta>0.
$$

它要求速度空间足够丰富，才能对每一个压力模式产生非零的散度响应。同阶的 $P_1/P_1$ 单元不满足该条件，会出现棋盘压力；Taylor–Hood 元（速度 $P_2$、压力 $P_1$）满足，或改用同阶元加压力稳定化。

## FVM 与 FEM 的对比

| 维度 | 有限体积法 | 有限元法 |
| --- | --- | --- |
| 守恒性 | 局部逐面守恒，天然保守恒 | 弱形式意义下守恒，需构造守恒通量 |
| 复杂几何 | 非结构网格适应性强 | 等参元适应性强，边界贴合好 |
| 激波与间断 | 限制器、Riemann 求解器成熟 | 需间断 Galerkin 或强稳定化 |
| 结构/多物理耦合 | 较弱 | 强，同一弱形式可耦合多场 |
| 矩阵性质 | 常为非对称，迎风带来对角占优 | 扩散问题对称正定 |
| 典型软件 | Fluent、CFX、STAR-CCM+、OpenFOAM | COMSOL、Abaqus、ANSYS Mechanical |

两者并非替代关系。内流、外流、湍流的大规模计算仍以 FVM 为主；需要精确贴合边界、耦合结构变形或电磁场时，FEM 更自然。近年来间断 Galerkin（DG）把两者的优点结合：单元内用高阶多项式，单元间用数值通量，既有高阶精度又有局部守恒。

## 一维 Poisson 的 Python 实现

取 $f(x)=\pi^2\sin(\pi x)$，精确解为 $u=\sin(\pi x)$，边界为零。用线性单元、2 点 Gauss 积分组装全局矩阵，消去边界节点后求解：

```python
import numpy as np

gp = np.array([-1.0, 1.0]) / np.sqrt(3.0)   # Gauss 点
gw = np.array([1.0, 1.0])                    # Gauss 权重

def fem_poisson(n_elem):
    """-u'' = pi^2 sin(pi x)，u(0)=u(1)=0，线性单元 + 2 点 Gauss 积分。"""
    h = 1.0 / n_elem
    n_node = n_elem + 1
    K = np.zeros((n_node, n_node))
    F = np.zeros(n_node)

    ke = np.array([[1.0, -1.0], [-1.0, 1.0]]) / h
    N = np.array([(1.0 - gp) / 2.0, (1.0 + gp) / 2.0])  # 形函数在 Gauss 点取值

    for e in range(n_elem):
        xc = (e + 0.5) * h
        xq = xc + 0.5 * h * gp
        fq = np.pi ** 2 * np.sin(np.pi * xq)
        # 载荷积分：sum_q w_q f(x_q) N_a(xi_q) * (h/2)
        fe = 0.5 * h * (N * (gw * fq)).sum(axis=1)
        idx = [e, e + 1]
        K[np.ix_(idx, idx)] += ke
        F[idx] += fe

    free = np.arange(1, n_node - 1)
    u = np.zeros(n_node)
    u[free] = np.linalg.solve(K[np.ix_(free, free)], F[free])
    x = np.linspace(0.0, 1.0, n_node)
    return x, u, np.sin(np.pi * x)

def l2_error(n_elem):
    """用 2 点 Gauss 积分计算全场 L2 误差。"""
    h = 1.0 / n_elem
    x, u, _ = fem_poisson(n_elem)
    total = 0.0
    for e in range(n_elem):
        xq = (e + 0.5) * h + 0.5 * h * gp
        uq = 0.5 * (1.0 - gp) * u[e] + 0.5 * (1.0 + gp) * u[e + 1]
        exact = np.sin(np.pi * xq)
        total += 0.5 * h * (gw * (uq - exact) ** 2).sum()
    return np.sqrt(total)

prev = None
for n in (4, 8, 16, 32, 64):
    x, u, exact = fem_poisson(n)
    err = np.max(np.abs(u - exact))
    l2 = l2_error(n)
    rate = "" if prev is None else f"  L2收敛阶={np.log(prev / l2) / np.log(2):.2f}"
    print(f"单元数={n:3d}  节点max|err|={err:.3e}  L2={l2:.3e}{rate}")
    prev = l2
```

运行结果会显示 L2 误差随单元数加倍按约四倍下降，即 $O(h^2)$；节点最大误差下降得更快，这是线性元在节点上的超收敛，不能据此认为全场精度也达到了四阶。这里还有两个细节值得注意：第一，载荷向量用 Gauss 积分而不是简单地取单元中点乘长度，否则右端项的误差会污染收敛阶；第二，边界节点虽然被消去，但在组装时仍保留在全局矩阵中，最后只取自由子块求解。

:::note 为什么节点值看起来“特别准”
对一维常系数 Poisson 问题，线性单元的节点值往往具有超收敛性，甚至与精确解在节点上一致。但单元内部的解仍是分片线性的，整体 $L^2$ 误差依然按 $h^2$ 下降。不要用节点误差代替全场误差。
:::

## 小结

- 弱形式把二阶导数降为一阶，使分片线性函数成为合法近似；Galerkin 让试函数与检验函数同空间。
- 单元刚度矩阵来自形函数导数的积分，组装就是把局部矩阵按节点编号叠加。
- 等参元用 Jacobian 把任意单元映射到参考单元，Gauss 积分负责数值求积；负 Jacobian 是网格错误。
- 对流主导时需要 SUPG 等稳定化，不可压混合元需要满足 LBB 条件。
- FEM 与 FVM 的差异主要在守恒性、间断处理与多物理耦合，选择取决于问题而不是“哪个更先进”。

相关阅读：弱形式背后的分类与边界条件，见[[ch1/pde-foundations|偏微分方程基础]]；面通量视角的对照，见[[ch3/fvm|有限体积法]]；单元形状与质量如何影响 Jacobian，见[[ch3/mesh|网格生成与质量]]。

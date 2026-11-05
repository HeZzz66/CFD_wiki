---
title: 大涡模拟 LES
order: 3
summary: 用滤波把尺度分离，得到亚格子应力；介绍 Smagorinsky、动态 Smagorinsky 与 WALE 三种闭合，给出 Python 计算变形率、涡粘与亚格子应力的实现，以及 LES 时间推进骨架。
tags: [LES, 亚格子模型, Smagorinsky, WALE, 滤波]
---

LES 的出发点是一个折中：DNS 太贵，RANS 把全部湍流都模化又太粗。既然大尺度涡携带了大部分能量、且受几何边界控制，而小尺度涡近似各向同性、行为更“普适”，那就只解析大尺度，把小尺度的影响压缩成一个应力项。这个“压缩”动作就是滤波。

## 滤波与滤波后方程

**滤波**是把瞬时场与一个核函数做空间卷积：

$$
\bar{u}_i(\mathbf{x},t)=\int G_\Delta(\mathbf{x}-\mathbf{r})\,u_i(\mathbf{r},t)\,\mathrm{d}\mathbf{r},
$$

其中 $G_\Delta$ 是宽度为 $\Delta$ 的滤波核（盒式、高斯或谱截断），$\Delta$ 通常取网格尺度的量级，例如 $\Delta=(\Delta x\Delta y\Delta z)^{1/3}$。滤波与雷诺平均的根本区别在于：滤波保留了大尺度的非定常性，因此 LES 的解仍是随时间演化的三维流场。

对不可压 N-S 方程逐项滤波，连续性方程保持 $\partial_i\bar u_i=0$，动量方程变为

$$
\frac{\partial \bar u_i}{\partial t}
+\bar u_j\frac{\partial \bar u_i}{\partial x_j}
=-\frac{1}{\rho}\frac{\partial \bar p}{\partial x_i}
+\nu\frac{\partial^2 \bar u_i}{\partial x_j\partial x_j}
-\frac{\partial \tau_{ij}}{\partial x_j},
$$

多出的项是**亚格子应力**（SGS stress）：

$$
\tau_{ij}=\overline{u_i u_j}-\bar u_i\bar u_j.
$$

它表示“被滤掉的小尺度脉动对已解析大尺度动量的输运”。注意 $\tau_{ij}$ 与雷诺应力不同：它只在滤波宽度 $\Delta$ 附近起作用，且 $\Delta\to0$ 时趋于零。对可压缩流动，通常改用 Favre 滤波 $\tilde u_i=\overline{\rho u_i}/\bar\rho$，形式更简洁，但会引入额外的亚格子通量（如 $\tau_{ij}$、热流与组分通量），需要一并模化。

### 可压缩情形

对密度变化的流动，Favre 滤波把密度并进平均，动量方程与不可压形式同构，但会额外产生亚格子热流与组分通量：

$$
\tau_{ij}^{\mathrm{F}}=\widetilde{u_iu_j}-\tilde u_i\tilde u_j,
\qquad
q_j^{\mathrm{sgs}}=\widetilde{u_jT}-\tilde u_j\tilde T,
$$

其中 $\tilde{\cdot}$ 表示 Favre 滤波，$T$ 是温度，$q_j^{\mathrm{sgs}}$ 是亚格子热流。后者通常用梯度扩散假设 $q_j^{\mathrm{sgs}}=-\alpha_t\,\partial_j\tilde T$ 闭合，$\alpha_t=\nu_t/Pr_t$，$Pr_t\approx0.6\sim0.9$。燃烧问题还需要亚格子组分与反应速率的闭合，难度远高于不可压情形。

## Smagorinsky 模型

最早的 SGS 模型由 Smagorinsky 于 1963 年提出，直接借用 Boussinesq 假设：

$$
\tau_{ij}-\frac{1}{3}\tau_{kk}\delta_{ij}
=-2\nu_t\bar S_{ij},
\qquad
\nu_t=(C_s\Delta)^2\left\Vert\bar S\right\Vert,
$$

其中 $C_s$ 是 Smagorinsky 常数（通常取 $0.1\sim0.2$），$\bar S_{ij}$ 是解析尺度的变形率张量，其模定义为

$$
\left\Vert\bar S\right\Vert=\sqrt{2\bar S_{ij}\bar S_{ij}}.
$$

这个模型只有一行代码，计算便宜、鲁棒，适合初始开发与教学。但它的缺陷同样明显：

- $C_s$ 是常数，无法同时适应层流区与湍流区；在层流或强剪切但无湍流的地方，$\nu_t$ 仍然非零，造成过度耗散。
- 它假设局部平衡（生产 = 耗散），无法描述能量反向传递（backscatter）。
- 壁面附近 $\nu_t$ 不自动衰减到零，需要额外的阻尼函数或壁面模型。

常配合**湍流 Prandtl 数** $Pr_t\approx0.9$ 用于标量输运：$\alpha_t=\nu_t/Pr_t$，其中 $\alpha_t$ 是亚格子热扩散系数。

## 动态 Smagorinsky 与 Germano 恒等式

Germano 等人（1991）提出用两个滤波尺度来“动态”确定 $C_s$。在网格滤波 $\Delta$ 之上再施加一次**测试滤波**（宽度 $\hat\Delta=2\Delta$），记测试滤波为 $\hat{\cdot}$，则存在精确的代数恒等式

$$
L_{ij}=\widehat{\bar u_i\bar u_j}-\hat{\bar u}_i\hat{\bar u}_j,
$$

其中 $L_{ij}$ 称为 Leonard 应力。它只依赖已解析的速度场，因此可以数值计算。把 Smagorinsky 形式代入，可得

$$
M_{ij}=2\Delta^2\left(\widehat{\left\Vert\bar S\right\Vert\bar S_{ij}}
-\alpha^2\widehat{\left\Vert\bar S\right\Vert}\widehat{\bar S}_{ij}\right),
\qquad
\tau_{ij}=-2C_s^2\Delta^2\left\Vert\bar S\right\Vert\bar S_{ij},
$$

其中 $\alpha=\hat\Delta/\Delta=2$。于是 $L_{ij}=C_s^2M_{ij}$，在最小二乘意义下（Lilly 1992）解出

$$
C_s^2\Delta^2=\frac{\langle L_{ij}M_{ij}\rangle}{\langle M_{kl}M_{kl}\rangle},
$$

尖括号表示对统计均匀方向做平均（或沿流线平均）。动态模型的好处是系数随流场自适应：层流区自动趋近零，转捩与分离区能给出较大的 $\nu_t$。代价是需要额外一次滤波，且 $C_s$ 可能为负（backscatter），需要截断以保证数值稳定。

## WALE 模型

WALE（Wall-Adapting Local Eddy-viscosity）模型不用 $C_s$ 的常数假设，而是从速度梯度张量的局部结构构造涡粘：

$$
\nu_t=(C_w\Delta)^2
\frac{\left(S_{ij}^{d}S_{ij}^{d}\right)^{3/2}}
{\left(\bar S_{ij}\bar S_{ij}\right)^{5/2}
+\left(S_{ij}^{d}S_{ij}^{d}\right)^{5/4}},
$$

其中 $C_w\approx0.325$，$S_{ij}^{d}$ 是速度梯度张量的对称部分去掉变形率后的“迹为零”张量：

$$
S_{ij}^{d}=\frac{1}{2}\left(g_{ij}^2+g_{ji}^2\right)
-\frac{1}{3}\delta_{ij}g_{kk}^2,
\qquad
g_{ij}=\frac{\partial \bar u_i}{\partial x_j}.
$$

它的优点是：在纯剪切流中自动给出接近零的 $\nu_t$（避免 Smagorinsky 的过度耗散），在壁面处按 $y^3$ 衰减到零，因此对壁面边界层更友好，常用于复杂几何的工程 LES。

动态模型在实践中还需要两处工程处理：对 $C_s$ 施加上下限截断（如 $0\sim0.2$），并沿统计均匀方向做平均，以抑制负涡粘引起的数值不稳定。WALE 则不存在这个问题，但它的常数 $C_w$ 对网格分辨率仍有一定敏感性。

| 模型 | 待定系数 | 壁面行为 | 优点 | 缺点 |
| --- | --- | --- | --- | --- |
| Smagorinsky | $C_s$ 常数 | 不自动归零 | 简单、便宜、稳定 | 过度耗散，层流区不消失 |
| 动态 Smagorinsky | 由 Germano 恒等式动态求出 | 随流动自适应 | 系数自适应，可处理转捩 | 需测试滤波，可能负涡粘 |
| WALE | $C_w$ 常数 | 按 $y^3$ 衰减 | 剪切流正确，壁面友好 | 仍有常数，极端网格下敏感 |

## 网格要求与壁面处理

LES 对网格的要求比 RANS 严格得多。经验规则是：滤波尺度 $\Delta$ 应落在惯性子区内，通常要求 $\Delta/\eta\gtrsim 10$；壁面解析 LES（WRLES）要求第一层网格 $y^+<1$，并在边界层内布置约 10～20 层网格；若网格不够，就必须引入**壁面模型**（WMLES），用 RANS 或壁面律在近壁区提供剪切应力。若 $\Delta/\eta>100$，亚格子承担的能流已经很小，LES 退化为“昂贵的 DNS 预处理”；反之 $\Delta/\eta<5$ 时滤波落在耗散区，Smagorinsky 的局部平衡假设不再成立。

$$
y^+=\frac{u_\tau y}{\nu},\qquad
u_\tau=\sqrt{\frac{\tau_w}{\rho}},
$$

其中 $u_\tau$ 是摩擦速度，$\tau_w$ 是壁面剪切应力，$y$ 是到壁面的距离。$y^+$ 是判断近壁分辨率的第一指标，也是选择壁面处理方式的依据。

:::tip DES 与 DDES
分离涡模拟（DES）在边界层内用 RANS、在分离区用 LES，通过比较 $\Delta$ 与壁面距离来切换。延迟 DES（DDES）加入屏蔽函数，防止网格过细时把边界层误判为分离区。它们本质上是“分区混合”，不是纯粹的 LES。
:::

## Python：计算亚格子应力

下面的函数从给定的二维解析速度场出发，用中心差分求变形率、涡粘与亚格子应力，可用于后处理或模型对比：

```python
import numpy as np

def sgs_smagorinsky(u, v, dx, dy, rho=1.0, Cs=0.15):
    """二维 Smagorinsky：返回 S_ij、|S|、mu_sgs 与 tau_ij（偏应力部分）。"""
    dudx = np.gradient(u, dx, axis=1)
    dudy = np.gradient(u, dy, axis=0)
    dvdx = np.gradient(v, dx, axis=1)
    dvdy = np.gradient(v, dy, axis=0)

    Sxx = dudx
    Syy = dvdy
    Sxy = 0.5 * (dudy + dvdx)
    Smag = np.sqrt(2.0 * (Sxx**2 + Syy**2 + 2.0 * Sxy**2))
    Delta = (dx * dy) ** 0.5
    nu_t = (Cs * Delta)**2 * Smag          # 涡粘 m^2/s
    mu_sgs = rho * nu_t                    # 动力涡粘 Pa·s

    tau_xx = -2.0 * mu_sgs * Sxx
    tau_yy = -2.0 * mu_sgs * Syy
    tau_xy = -2.0 * mu_sgs * Sxy
    return (Sxx, Syy, Sxy), Smag, mu_sgs, (tau_xx, tau_yy, tau_xy)

# 验证：简单剪切流 u = S*y，v = 0，则 Sxy = S/2，|S| = S
n, L = 64, 2.0 * np.pi
x = np.linspace(0, L, n, endpoint=False)
y = np.linspace(0, L, n, endpoint=False)
X, Y = np.meshgrid(x, y, indexing="xy")
S, rho = 2.0, 1.0
u, v = S * Y, np.zeros_like(X)
_, Smag, mu_sgs, _ = sgs_smagorinsky(u, v, x[1]-x[0], y[1]-y[0], rho)
print("|S| 内部均值：", Smag[1:-1, 1:-1].mean(), " 理论值：", S)
```

要注意的边界处理与 `np.gradient` 一致：壁面处用单侧差分，得到的 $\mu_{sgs}$ 在壁面不会严格为零，这正是 Smagorinsky 需要额外阻尼的原因。

## LES 时间推进骨架

LES 本身不是“一个模型”，而是“求解器 + 亚格子模型”。下面的骨架说明各步骤的位置，真实实现需要完整的 CFD 求解器：

```python
# 伪代码：不可压 LES 一个时间步（有限体积/谱方法均可）
def les_step(u, p, dt, nu, model, grid):
    # 1. 由解析速度计算变形率与亚格子涡粘
    S = compute_strain_rate(u, grid)
    mu_sgs = model.viscosity(S, grid.delta, grid.wall_distance)

    # 2. 组装动量方程右端：对流 + 压力梯度 + 分子扩散 + 亚格子扩散
    rhs = -convect(u, grid) - grad(p) + div((nu + mu_sgs / rho) * grad(u))

    # 3. 时间推进（低存储 RK4 或 AB2），并施加边界条件
    u_star = u + dt * rhs
    u_star = apply_boundary(u_star, grid)

    # 4. 压力泊松方程，投影到无散空间
    p = solve_poisson(div(u_star) / dt, grid)
    u_new = u_star - dt * grad(p)

    # 5. 亚格子动能由模型隐式耗散，无需额外方程
    return u_new, p
```

:::warning 时间步与稳定性
LES 的显式时间步受最小网格与最大速度限制（$\Delta t\approx0.3\,\Delta x/u_{\max}$）。若为了省时间放大步长，高频模态会先失真，表现为能谱在高波数端“堆积”而不是正常衰减。
:::

## 小结

- 滤波把尺度分离，亚格子应力 $\tau_{ij}$ 承载小尺度对大尺度的输运。
- Smagorinsky 便宜但过度耗散；动态模型用 Germano 恒等式自适应求系数；WALE 在剪切流与壁面附近更合理。
- LES 的成本主要花在网格与时间推进上，模型本身的开销可以忽略；因此网格质量比模型选择更决定结果。
- 与 RANS 的分工见 [[ch4/rans|RANS 与涡粘模型]]；若想彻底去掉模型，见 [[ch4/dns|DNS 与 fDNS]]。

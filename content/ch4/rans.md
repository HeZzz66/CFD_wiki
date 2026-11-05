---
title: RANS 与涡粘模型
order: 2
summary: 从 N-S 方程出发推导雷诺平均方程，认识雷诺应力带来的封闭问题；介绍 Boussinesq 涡粘假设、标准 k-ε、k-ω 与 SST 模型的方程与常数，并给出可运行的显式推进代码。
tags: [RANS, k-epsilon, k-omega, SST, 涡粘, 雷诺应力]
---

RANS 是工程 CFD 中使用率最高的湍流处理方式。它的思路很直接：既然我们关心的是平均流场，就不要去解析每一个涡，而是对 N-S 方程做时间平均，把脉动的影响归入一个待模化的应力项。代价是精度，收益是成本。本节从平均方程推到涡粘假设，再给出三个最常用模型的完整形式。

## 雷诺平均方程与封闭问题

对不可压缩 N-S 方程

$$
\frac{\partial u_i}{\partial t}+u_j\frac{\partial u_i}{\partial x_j}
=-\frac{1}{\rho}\frac{\partial p}{\partial x_i}
+\nu\frac{\partial^2 u_i}{\partial x_j\partial x_j},
\qquad
\frac{\partial u_i}{\partial x_i}=0
$$

做雷诺分解 $u_i=U_i+u_i'$、$p=P+p'$，再取平均。利用平均与导数可交换、$\langle U_i u_j'\rangle=0$ 等法则，连续性方程保持不变，动量方程多出一项：

$$
\frac{\partial U_i}{\partial t}+U_j\frac{\partial U_i}{\partial x_j}
=-\frac{1}{\rho}\frac{\partial P}{\partial x_i}
+\frac{\partial}{\partial x_j}\left(\nu\frac{\partial U_i}{\partial x_j}\right)
-\frac{\partial}{\partial x_j}\left\langle u_i'u_j'\right\rangle.
$$

最后一项 $-\partial_j\langle u_i'u_j'\rangle$ 就是**雷诺应力**的散度（严格说是应力除以密度）。它与粘性应力散度形式相同，因此常写成

$$
\frac{\partial}{\partial x_j}\left(\nu\frac{\partial U_i}{\partial x_j}-\left\langle u_i'u_j'\right\rangle\right),
$$

也就是说，湍流对平均动量的作用被“折叠”进了一个额外的应力。问题在于：这个应力由六个未知分量组成，而方程只有四个（三个动量 + 一个连续），方程组不封闭。**湍流模型的任务，就是用平均场量去近似这六个分量。**

:::note 为什么不能用“平均即线性”
若把脉动项直接丢掉，得到的是层流方程，它在分离区会严重高估回流、在管流中给出错误的摩阻。雷诺应力的量级往往与分子粘性应力相当甚至更大，不能当作小量忽略。
:::

## Boussinesq 涡粘假设

最常用的封闭方式是 1877 年 Boussinesq 提出的**涡粘假设**：仿照牛顿粘性定律，假设雷诺应力与平均变形率成正比，

$$
-\rho\left\langle u_i'u_j'\right\rangle
=\mu_t\left(\frac{\partial U_i}{\partial x_j}+\frac{\partial U_j}{\partial x_i}\right)
-\frac{2}{3}\rho k\,\delta_{ij},
$$

其中 $\mu_t$ 是**涡粘系数**（单位 $\mathrm{Pa\cdot s}$，与分子粘度相同），$k=\frac12\langle u_i'u_i'\rangle$，$\delta_{ij}$ 是 Kronecker 符号。末项的作用是保证取迹后回到 $2\rho k$：令 $i=j$ 并求和，第一项因连续性 $\partial_i U_i=0$ 而消失。

涡粘不是物性，而是流动状态的函数。两方程模型的核心，就是再引入两个输运方程来确定 $\mu_t$：

$$
\mu_t=\rho C_\mu\frac{k^2}{\varepsilon},
\qquad
\mu_t=\rho\frac{k}{\omega},
$$

前者用于 k-ε，后者用于 k-ω。其中 $\varepsilon$ 是耗散率，$\omega=\varepsilon/(C_\mu k)$ 是比耗散率（单位 $\mathrm{s^{-1}}$），$C_\mu=0.09$。这两个式子把“涡粘”与“湍流的能量及其耗散速度”联系起来：$k$ 越大涡粘越大，$\varepsilon$ 越大涡粘越小。

## 标准 k-ε 模型

k-ε 模型由 Launder 与 Spalding 在 1974 年提出，是工业 CFD 的默认选项。它求解两个标量输运方程。

**湍动能方程**：

$$
\frac{\partial k}{\partial t}+U_j\frac{\partial k}{\partial x_j}
=P_k-\varepsilon
+\frac{\partial}{\partial x_j}\left[\left(\nu+\frac{\nu_t}{\sigma_k}\right)\frac{\partial k}{\partial x_j}\right],
$$

**耗散率方程**：

$$
\frac{\partial \varepsilon}{\partial t}+U_j\frac{\partial \varepsilon}{\partial x_j}
=C_1\frac{\varepsilon}{k}P_k-C_2\frac{\varepsilon^2}{k}
+\frac{\partial}{\partial x_j}\left[\left(\nu+\frac{\nu_t}{\sigma_\varepsilon}\right)\frac{\partial \varepsilon}{\partial x_j}\right],
$$

其中 $\nu_t=\mu_t/\rho$，$\sigma_k$、$\sigma_\varepsilon$ 是湍流 Prandtl 数（$k$、$\varepsilon$ 的“扩散系数”相对涡粘的比例）。生产项为

$$
P_k=2\nu_t S_{ij}S_{ij},
\qquad
S_{ij}=\frac{1}{2}\left(\frac{\partial U_i}{\partial x_j}+\frac{\partial U_j}{\partial x_i}\right),
$$

即平均变形率张量的二范数乘涡粘。注意 $P_k$ 恒非负，这保证了湍动能不会被“负生产”抽干，但也意味着模型无法描述稳定分层下的湍流抑制。

| 常数 | $C_\mu$ | $C_1$ | $C_2$ | $\sigma_k$ | $\sigma_\varepsilon$ |
| --- | --- | --- | --- | --- | --- |
| 取值 | 0.09 | 1.44 | 1.92 | 1.0 | 1.3 |

这些常数来自剪切层、管流与衰减湍流的标定，并非从第一性原理导出。它们的普适性有限，正是 k-ε 在不同流动中表现参差的根源。

**优点**：方程稳健、收敛性好、对网格不敏感，适合充分发展的管内流、外流远场与初步设计。

**缺点**：
- 壁面附近 $k\to0$、$\varepsilon$ 有限，$\mu_t$ 的构造要求使用壁面函数，否则需要极细的近壁网格；
- 对逆压梯度与分离的预测偏晚，分离区长度常被低估；
- 假设各向同性涡粘，无法捕捉旋流中的各向异性与二次流；
- 驻点附近 $P_k$ 可能被高估，造成“驻点湍流过强”。

## k-ω 与 SST

k-ω 模型（Wilcox）用 $\omega$ 代替 $\varepsilon$ 作为第二个变量，在近壁区表现更好。其 $\omega$ 方程为

$$
\frac{\partial \omega}{\partial t}+U_j\frac{\partial \omega}{\partial x_j}
=\alpha\frac{\omega}{k}P_k-\beta\omega^2
+\frac{\partial}{\partial x_j}\left[\left(\nu+\sigma_\omega\nu_t\right)\frac{\partial \omega}{\partial x_j}\right],
$$

其中 $\alpha$、$\beta$、$\sigma_\omega$ 为模型常数。$\omega$ 在壁面有明确的渐近行为（$\omega\propto 1/y^2$），因此无需壁面函数即可积分到壁面；代价是对来流 $\omega$ 的取值敏感，自由剪切层中容易过度耗散。

**SST（Shear Stress Transport）** 模型把两者按区域混合：近壁用 k-ω，远场用 k-ε。混合通过函数 $F_1\in[0,1]$ 完成：

$$
\phi=F_1\phi_1+(1-F_1)\phi_2,
$$

其中 $\phi$ 代表任意模型常数（如 $\beta$、$\sigma_\omega$），下标 1 为 k-ω 分支，2 为 k-ε 分支。$F_1$ 由壁面距离 $y$、$k$、$\omega$ 与交叉扩散项构造，在近壁趋近 1、在边界层外趋近 0。

SST 的关键改进是**剪切应力限制器**：

$$
\mu_t=\frac{\rho a_1 k}{\max\left(a_1\omega,\; S F_2\right)},
\qquad
S=\sqrt{2S_{ij}S_{ij}},
$$

其中 $a_1=0.31$，$F_2$ 是第二个混合函数（在边界层内接近 1）。它把涡粘上限约束为 $a_1 k/S$，避免了 k-ω 在逆压梯度下对剪切应力的高估。这正是 SST 在翼型分离、扩压器与叶轮机械中比标准 k-ε 更稳的原因。

| 模型 | 方程数 | 近壁处理 | 逆压梯度/分离 | 典型用途 |
| --- | --- | --- | --- | --- |
| 标准 k-ε | 2 | 壁面函数为主 | 偏弱，分离偏晚 | 管内流、初设、外流远场 |
| k-ω | 2 | 可积分到壁面 | 较好，但对来流敏感 | 近壁剪切层、低 Re 流动 |
| SST k-ω | 2 | 混合，可积分到壁面 | 较好，工程首选 | 翼型、叶轮、汽车外流 |
| RSM | 6～7 | 需壁面处理 | 强，能捕捉各向异性 | 旋流、强分离、燃烧 |

## 雷诺应力模型与壁面处理

**雷诺应力模型（RSM）** 直接为六个 $\langle u_i'u_j'\rangle$ 分量各写一个输运方程，不再使用涡粘假设。它保留了应力输运、压力—应变再分配与耗散的各向异性，因而能预测旋流中的二次流与强分离。代价是方程数从 2 增加到 7，收敛困难、网格敏感。

**代数应力模型（ASM）** 是对 RSM 的简化：把应力输运方程中的对流与扩散项近似掉，得到一组代数关系，用 $k$、$\varepsilon$ 与平均应变率显式表达应力。它在旋流计算中比涡粘模型便宜，但精度介于两者之间。

**壁面处理**有两种路线。高 Re 数方法使用**壁面函数**：第一层网格落在对数律区（$y^+\approx30\sim300$），用经验关系给出壁面剪切与 $k$、$\varepsilon$ 的边界值，从而绕过粘性底层。低 Re 数方法则加密网格到 $y^+<1$，直接积分到壁面，并对近壁的耗散与生产做修正。两者不能混用：网格落在缓冲层（$y^+\approx5\sim30$）时，壁面函数与低 Re 修正都会给出明显偏差。

## Python 实现：一维 k-ε 显式推进

下面给出一个最小可运行的一维 k-ε 推进器。为了突出四个物理过程（对流、扩散、生产、耗散），设平均剪切 $S=\partial U/\partial y$ 为常数（均匀剪切湍流的典型设定），平均速度 $U$ 沿 $x$ 均匀，网格周期。所有量为 SI 单位。

```python
import numpy as np

# ---------------- 参数（SI 单位） ----------------
nx, dx = 64, 1e-2            # 网格数与间距 / m
U, S = 1.0, 5.0              # 平均速度 m/s，恒定剪切 1/s
nu, dt, nstep = 1e-5, 1e-4, 2000
Cmu, C1, C2, sigk, sige = 0.09, 1.44, 1.92, 1.0, 1.3

k = np.full(nx, 1e-2)        # 湍动能 m^2/s^2
eps = np.full(nx, 1e-2)      # 耗散率 m^2/s^3

def ddx_upwind(phi):
    """一阶迎风（U>0），周期边界用 roll 实现。"""
    return (phi - np.roll(phi, 1)) / dx

def d2dx2_periodic(phi):
    """二阶中心差分拉普拉斯，周期边界。"""
    return (np.roll(phi, -1) - 2.0 * phi + np.roll(phi, 1)) / dx**2

for step in range(nstep):
    nut = Cmu * k**2 / eps              # 涡粘 m^2/s
    Pk = nut * S**2                     # 生产项 m^2/s^3
    # k 方程：对流 + 生产 - 耗散 + 扩散
    dk = (-U * ddx_upwind(k) + Pk - eps
          + (nu + nut / sigk) * d2dx2_periodic(k))
    # ε 方程：对流 + 生产 - 破坏 + 扩散
    de = (-U * ddx_upwind(eps)
          + C1 * eps / k * Pk - C2 * eps**2 / k
          + (nu + nut / sige) * d2dx2_periodic(eps))
    k = np.maximum(k + dt * dk, 1e-12)      # 保正
    eps = np.maximum(eps + dt * de, 1e-12)

print("k 均值：", k.mean(), " eps 均值：", eps.mean())
```

几点说明：

- 显式格式的稳定步长受 CFL 与扩散条件限制，约为 $\Delta t<\min(\Delta x/U,\ \Delta x^2/(2\nu_{\mathrm{eff}}))$；调大 $U$ 或 $S$ 之前要重新估算。
- 生产项用的是**给定剪切**，而不是从速度场差分得到。真实求解器中 $S_{ij}$ 由动量方程的离散速度计算，两者在离散层面必须保持一致，否则能量不守恒。
- `np.maximum` 只是工程上的保正手段，并不保证物理正确。k-ε 在强应变下仍可能产生负的 $k$，这时应缩小时间步或改用隐式处理。

:::warning 别把演示当求解器
这段代码只推进两个标量方程，动量方程是“冻结”的（$U$、$S$ 给定）。真正的 RANS 求解器需要把 $k$、$\varepsilon$ 与动量方程耦合迭代，并处理压力—速度耦合、壁面边界与收敛判据。
:::

## 小结

- 雷诺平均把脉动的影响集中到 $-\rho\langle u_i'u_j'\rangle$，封闭问题是 RANS 的核心。
- Boussinesq 假设用一个标量 $\mu_t$ 代替六个应力分量，简单但牺牲了各向异性。
- 标准 k-ε 稳健但对分离与近壁不敏感；k-ω 近壁好但怕来流污染；SST 用混合函数与剪切应力限制器取两者之长。
- 工程实现中，模型方程与动量方程的离散必须匹配，边界处理比模型系数更影响结果。

继续阅读 [[ch4/les|大涡模拟 LES]]，看“平均”换成“滤波”后模型结构如何变化；离散细节可参考 [[ch3/fvm|有限体积法]]，多语言实现见 [[ch4/implementation|C++ 与 Fortran 实现]]。

---
title: DNS 与 fDNS
order: 4
summary: 直接数值模拟解析全部湍流尺度，网格量随 Re 按 9/4 次幂增长；本节给出分辨率要求、数值格式约束、fDNS 的用途，以及二维伪谱法求解器的完整骨架。
tags: [DNS, fDNS, 伪谱法, 去混叠, 高精度格式]
---

DNS 是湍流研究里的“显微镜”：不加任何模型，直接把 N-S 方程从含能尺度积分到耗散尺度。它给出的不是工程答案，而是**真值**——用于标定 RANS 系数、检验 LES 亚格子模型、生成训练数据。理解 DNS 的关键不是会写求解器，而是清楚它的成本从哪里来、数值误差如何伪装成物理。

## 分辨率要求

DNS 必须解析到 Kolmogorov 尺度。工程上的经验判据是网格间距不大于两倍 Kolmogorov 尺度：

$$
\Delta x\approx 2\eta,\qquad
\eta=\left(\frac{\nu^3}{\varepsilon}\right)^{1/4}.
$$

时间步则同时受对流 CFL 与粘性稳定性限制：

$$
\Delta t\lesssim \min\left(\frac{\mathrm{CFL}\,\Delta x}{u_{\max}},\ 
\frac{\Delta x^2}{2\nu}\right),
$$

其中 $\mathrm{CFL}$ 通常取 0.3～0.5，$u_{\max}$ 是瞬时最大速度。在壁湍流中，近壁条带的速度尺度远大于外层，实际步长往往由壁面附近决定。

把这些尺度与积分尺度 $L$ 联系起来，可以得到著名的标度律。由 $Re=u'L/\nu$ 与 $\varepsilon\sim u'^3/L$ 可得

$$
\frac{L}{\eta}\sim Re^{3/4},
$$

于是三维网格数为

$$
N\sim\left(\frac{L}{\Delta x}\right)^3\sim\left(\frac{L}{\eta}\right)^3\sim Re^{9/4}.
$$

时间步数同样按 $Re^{3/4}$ 增长（大涡翻转时间与 $\eta$ 的比值），总计算量约为 $Re^{3}$。这意味着 $Re$ 从 $10^4$ 增到 $10^5$，成本增加约 30 倍；整机级别的 DNS 在可预见的未来仍不可行。

:::note 壁面修正
上面的标度是针对各向同性湍流。壁湍流中近壁条带的展向间距随 $Re$ 变化，网格标度会略偏离 $Re^{9/4}$，实际 DNS 常用 $Re_\tau$ 直接估算首层 $y^+$ 与流向长度。
:::

## 数值要求

DNS 的误差有两类：耗散误差与色散误差。前者会把小尺度脉动的能量“吃掉”，让能谱提前截断；后者会让不同波数以错误速度传播，破坏相位关系。因此格式选择有明确偏好：

- **高精度**：谱方法（指数收敛）或 6 阶以上的紧致差分/有限差分；
- **低耗散**：避免一阶迎风与过强的限制器，它们在小尺度上等价于人为粘性；
- **能量守恒**：对流项宜用斜对称形式，离散后保证动能不被人为产生或耗散；
- **边界处理**：入口用合成湍流，出口用无反射条件，壁面用无滑移；边界格式的精度通常低于内部，需要单独验证。

对流项的斜对称写法为

$$
\frac{\partial u_i}{\partial t}
=-\frac{1}{2}\left(u_j\frac{\partial u_i}{\partial x_j}
+\frac{\partial}{\partial x_j}\left(u_j u_i\right)\right)
+\nu\frac{\partial^2 u_i}{\partial x_j\partial x_j}
-\frac{1}{\rho}\frac{\partial p}{\partial x_i}.
$$

它在连续层面与原始形式等价（利用 $\partial_j u_j=0$），在离散层面则能显著改善长期能量行为。这也是伪谱法中去掉非线性项“自输运”误差的常用手段。此外，统计量需要在大涡翻转时间量级上做平均，单帧“漂亮”的涡结构不能说明结果正确。

典型 DNS 算例包括：各向同性衰减湍流（用于标定能谱常数）、均匀剪切湍流（研究快速畸变）、槽道湍流（壁面标定，$Re_\tau$ 从 180 到数千）、以及圆柱/翼型的分离流。前两类周期性强、适合谱方法；后两类需要复杂边界，通常用高阶有限差分，且往往要求 6 阶以上格式才能把数值耗散压到可接受水平。

| 方法 | 网格量级 | 时间步 | 典型成本 | 主要用途 |
| --- | --- | --- | --- | --- |
| DNS | $Re^{9/4}$，常为 $10^{8}\sim10^{9}$ | 受 $\tau_\eta$ 限制，$10^{5}$ 步以上 | 千万核时量级 | 机理研究、模型标定、数据集生成 |
| LES | $10^{6}\sim10^{7}$ | 受 $\Delta$ 限制 | 万核时量级 | 工程非定常、分离流、噪声 |
| RANS | $10^{4}\sim10^{6}$ | 稳态或大步长 | 单机到百核 | 工程设计、参数扫描 |

## fDNS：先解析，再滤波

fDNS（filtered DNS）不是一种新的求解方法，而是**数据处理流程**：先用 DNS 得到高分辨率的瞬时场，再施加与目标 LES 相同的滤波核，得到“应当被 LES 解析的部分”。它的价值在于提供 a priori 检验：

$$
\bar u_i^{\mathrm{fDNS}}(\mathbf{x},t)
=\int G_\Delta(\mathbf{x}-\mathbf{r})\,u_i^{\mathrm{DNS}}(\mathbf{r},t)\,\mathrm{d}\mathbf{r},
$$

真实亚格子应力则由 DNS 直接算出：

$$
\tau_{ij}^{\mathrm{exact}}
=\overline{u_i u_j}^{\mathrm{DNS}}
-\bar u_i^{\mathrm{fDNS}}\bar u_j^{\mathrm{fDNS}}.
$$

把模型给出的 $\tau_{ij}^{\mathrm{model}}$ 与 $\tau_{ij}^{\mathrm{exact}}$ 逐点比较，就能知道模型在哪个区域高估或低估耗散，而不必跑完整 LES。这是动态模型、WALE、神经网络亚格子模型开发中的标准步骤。

fDNS 与 LES 的区别可以概括为：LES 是“边算边模化”，滤波与求解同时进行，误差会反馈到流场；fDNS 是“先算准再滤波”，滤波只用于评估，不参与求解。因此 fDNS 能分离“模型误差”与“求解误差”，但它不能替代 LES 来预测新流动。

需要强调的是，a priori 检验只能说明“模型给出的应力是否接近真值”，不能说明“加入模型后整个流场是否变好”。后者称为 a posteriori 检验，必须真正跑 LES。两者常常不一致：某个模型在逐点比较中误差很小，却因为耗散不足导致计算发散；另一个模型误差较大，但数值上稳定。工程上最终仍以 a posteriori 结果为准。

## 二维伪谱法骨架

谱方法在周期边界上精度最高，是各向同性湍流 DNS 的标准工具。下面的二维不可压版本包含 FFT、$2/3$ 去混叠、RK4 与压力泊松投影，可直接运行；三维只需把第二维换成三重循环的波数。

```python
import numpy as np

N, L, nu, dt = 64, 2.0 * np.pi, 1e-3, 2e-3
k1d = 2.0 * np.pi * np.fft.fftfreq(N, d=L / N)          # 波数
kx, ky = np.meshgrid(k1d, k1d, indexing="xy")
k2 = kx**2 + ky**2
kmax = np.abs(k1d).max()

# 2/3 去混叠：只保留低波数模态，其余置零
mask = (np.abs(kx) <= 2.0 / 3.0 * kmax) & (np.abs(ky) <= 2.0 / 3.0 * kmax)
k2_safe = k2.copy()
k2_safe[0, 0] = 1.0                                      # 避免除零

def rhs(uhat, vhat):
    """返回 du/dt 与 dv/dt 的谱系数（含压力投影）。"""
    u = np.fft.ifft2(uhat).real
    v = np.fft.ifft2(vhat).real
    dudx = np.fft.ifft2(1j * kx * uhat).real
    dudy = np.fft.ifft2(1j * ky * uhat).real
    dvdx = np.fft.ifft2(1j * kx * vhat).real
    dvdy = np.fft.ifft2(1j * ky * vhat).real

    # 对流项在物理空间计算，再变换回去并去混叠
    nl_u = np.fft.fft2(-(u * dudx + v * dudy)) * mask
    nl_v = np.fft.fft2(-(u * dvdx + v * dvdy)) * mask
    Ru = nl_u - nu * k2 * uhat                          # 粘性扩散
    Rv = nl_v - nu * k2 * vhat

    # 压力泊松：nabla^2 p = div(R)，谱空间 p_hat = -i(k·R)/k^2
    div = 1j * (kx * Ru + ky * Rv)
    phat = -div / k2_safe
    phat[0, 0] = 0.0
    Ru = Ru - 1j * kx * phat                            # 投影到无散空间
    Rv = Rv - 1j * ky * phat
    return Ru, Rv

# Taylor-Green 初值：u = sin(x)cos(y), v = -cos(x)sin(y)
x = np.linspace(0, L, N, endpoint=False)
X, Y = np.meshgrid(x, x, indexing="xy")
u0, v0 = np.sin(X) * np.cos(Y), -np.cos(X) * np.sin(Y)
uhat, vhat = np.fft.fft2(u0), np.fft.fft2(v0)

for step in range(2000):
    k1u, k1v = rhs(uhat, vhat)                          # RK4 四个阶段
    k2u, k2v = rhs(uhat + 0.5 * dt * k1u, vhat + 0.5 * dt * k1v)
    k3u, k3v = rhs(uhat + 0.5 * dt * k2u, vhat + 0.5 * dt * k2v)
    k4u, k4v = rhs(uhat + dt * k3u, vhat + dt * k3v)
    uhat += dt / 6.0 * (k1u + 2 * k2u + 2 * k3u + k4u)
    vhat += dt / 6.0 * (k1v + 2 * k2v + 2 * k3v + k4v)

u_end = np.fft.ifft2(uhat).real
print("动能：", 0.5 * np.mean(u_end**2))
```

:::warning 仅限周期边界
伪谱法依赖 FFT 的周期性，只适用于周期盒或统计均匀方向。槽道湍流需要在流向/展向用谱方法、壁法向用有限差分（半离散谱方法）；复杂几何则完全不能用谱方法，应改用高阶有限体积或有限元。
:::

代码中有三处容易出错，值得单独检查：$k=0$ 模态的处理（均值应保持，不能被压力投影污染）、去混叠的截断波数（$2/3$ 规则对应 $\left|k\right|\leq\frac{2}{3}k_{\max}$）、以及非线性项必须在物理空间计算后再变换（直接在谱空间卷积代价高且易混叠）。

## 结果可信度检查

DNS 的结果不能只看“流场像不像”，至少要做三项定量检查。其一是**能谱**：惯性区应呈现 $k^{-5/3}$ 的直线，若高波数端突然陡降，说明格式耗散过强或网格不足。其二是**耗散率**，可由能谱积分得到

$$
\varepsilon=2\nu\int_0^\infty k^{2}E(k)\,\mathrm{d}k,
$$

它应当与湍动能的衰减率 $-dk/dt$ 一致；两者不符，通常意味着时间推进或去混叠环节有误。其三是**散度**，$\max\left|\nabla\cdot\mathbf{u}\right|$ 应保持在机器精度量级，否则压力投影的泊松求解没有真正收敛，后续的统计量都会被“压缩伪速度”污染。

## 小结

- DNS 的网格量随 $Re^{9/4}$ 增长、总成本随 $Re^3$ 增长，这是它无法用于工程设计的根本原因。
- 谱方法与高阶差分是主流，低耗散与能量守恒比“阶数高”更重要。
- fDNS 用 DNS 真值检验 LES 模型，是模型开发与数据驱动方法的基准。
- 若只需要工程精度，回到 [[ch4/les|大涡模拟 LES]]；若连 LES 都太贵，回到 [[ch4/rans|RANS 与涡粘模型]]。湍流统计量的定义见 [[ch4/turbulence-physics|湍流统计与能量级串]]。

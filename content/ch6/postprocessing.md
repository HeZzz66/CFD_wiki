---
title: 流体后处理核心算法
order: 3
summary: 把 Cp、Cf 与 y+、涡量与 Q 准则、λ2 判据、RK4 流线、质量流量与加权平均、雷诺应力、FFT 能量谱、壁面压力积分等后处理量写成可直接调用的 numpy 函数。
tags: [后处理, 算法, 涡识别, 统计, 阻力]
---

这一页给出可直接调用的函数。实现基于 `numpy`，流线积分用到 `scipy`；代码假设数据是规则网格上的三维数组 `(nx, ny, nz)`，单位统一为 SI（米、秒、帕、千克）。换单位公式仍成立，但系数数值会失去可比性。

## 统一约定

约定：索引 `(i, j, k)` 对应 `x, y, z`；`dx, dy, dz` 为标量间距，非均匀网格应先插值或改用坐标数组；变量记作 `u, v, w, p, rho, nu`；派生量统一转 `float64`。

后处理量分三类：局部量逐点算，线积分量沿面求和，统计量沿样本平均。

## 压力系数 Cp

压力系数把当地压力无量纲化：

$$
C_p = \frac{p - p_\infty}{\tfrac12 \rho_\infty U_\infty^2}.
$$

```python
import numpy as np

def pressure_coefficient(p, p_inf, rho_inf, u_inf):
    q_inf = 0.5 * rho_inf * u_inf ** 2
    return (p - p_inf) / q_inf
```

三个容易出错的地方：

1. **表压与绝对压力。** 求解器可能输出表压，`p_inf` 就必须用同一基准；混用会让 Cp 整体平移。
2. **运动压力。** 不可压缩求解器常把压力除以密度后存储，单位是 $\mathrm{m^2/s^2}$。此时要么先乘回密度，要么直接把分母写成 $\tfrac12 U_\infty^2$。
3. **可压缩流。** 高马赫数下仍可用同一公式，但参考动压应按冻结来流算；若用等熵关系换算，必须说明假设。

Cp 的价值在于可比性：参考量一致，不同 Re 与风洞下的 Cp 分布才能对比。把 `p_inf` 与 `q_inf` 写进图注，别在代码里藏魔法数。

## 壁面摩擦系数与 y+

壁面剪切应力由壁面法向速度梯度得到：

$$
\tau_w = \mu \left.\frac{\partial u_t}{\partial n}\right|_{w},
$$

其中 $u_t$ 是壁面切向速度，$n$ 是壁面法向。摩擦系数与摩擦速度分别为

$$
C_f = \frac{\tau_w}{\tfrac12 \rho U_\infty^2},
\qquad
u_\tau = \sqrt{\frac{\tau_w}{\rho}},
\qquad
y^+ = \frac{u_\tau y}{\nu}.
$$

```python
def wall_shear_stress(mu, y, u_t):
    """y[0]=0, u_t[0]=0, uniform spacing; second-order one-sided."""
    return mu * (-3.0 * u_t[0] + 4.0 * u_t[1] - u_t[2]) / (2.0 * y[1])

def skin_friction_coefficient(tau_w, rho, u_inf):
    return tau_w / (0.5 * rho * u_inf ** 2)

def friction_velocity(tau_w, rho):
    return np.sqrt(np.abs(tau_w) / rho)

def y_plus(tau_w, rho, y, nu):
    return friction_velocity(tau_w, rho) * y / nu
```

实现说明：

- 二阶单边差分要求前三点等距且壁面速度为零，有滑移壁面时不能用。
- `y` 取单元中心到壁面的法向距离，`y[1]` 是第一层单元中心。
- `y+ < 1` 适合低雷诺数壁面解析；落在 5 到 30 通常意味着第一层在缓冲层，壁面函数与解析都不舒服。
- 求解器输出 `wallShearStress` 时优先用它，差分对网格质量很敏感。

Cf 的符号取决于切向定义。把壁面切向与来流对齐并统一符号，否则上下表面的曲线会反号。

## 涡量与 Q 准则

涡量是速度的旋度：

$$
\boldsymbol{\omega} = \nabla \times \mathbf{u},
\qquad
\omega_i = \epsilon_{ijk}\partial_j u_k.
$$

速度梯度张量记为 $G_{ij}=\partial u_i/\partial x_j$。它的对称部分与反对称部分分别是应变率张量 $S$ 与旋转张量 $\Omega$：

$$
S_{ij}=\tfrac12\left(\partial_i u_j+\partial_j u_i\right),
\qquad
\Omega_{ij}=\tfrac12\left(\partial_i u_j-\partial_j u_i\right).
$$

Q 准则定义为

$$
Q = \tfrac12\left(\lVert\Omega\rVert_F^2-\lVert S\rVert_F^2\right).
$$

$Q>0$ 表示旋转强于剪切，常用于显示涡管。

```python
def velocity_gradient(u, v, w, dx, dy, dz):
    dudx, dudy, dudz = np.gradient(u, dx, dy, dz)
    dvdx, dvdy, dvdz = np.gradient(v, dx, dy, dz)
    dwdx, dwdy, dwdz = np.gradient(w, dx, dy, dz)
    return np.array([
        [dudx, dudy, dudz],
        [dvdx, dvdy, dvdz],
        [dwdx, dwdy, dwdz],
    ])

def strain_rotation(G):
    S = 0.5 * (G + np.swapaxes(G, 0, 1))
    W = 0.5 * (G - np.swapaxes(G, 0, 1))
    return S, W

def vorticity(G):
    return np.stack([
        G[2, 1] - G[1, 2],
        G[0, 2] - G[2, 0],
        G[1, 0] - G[0, 1],
    ], axis=-1)

def q_criterion(G):
    S, W = strain_rotation(G)
    S2 = np.einsum("ij...,ij...->...", S, S)
    W2 = np.einsum("ij...,ij...->...", W, W)
    return 0.5 * (W2 - S2)
```

`np.gradient` 边界单边、内部中心，整体二阶精度；非均匀网格应传坐标数组 `np.gradient(u, x, y, z)`。

Q 的阈值没有普适值，依赖网格尺度与流场强度；跨算例比较应使用同一阈值，或用 $Q/Q_{\max}$ 归一化。把 Q 的绝对值当常数是常见误用。

:::warning 涡量不等于涡
涡量在剪切层里可以很大，但那里未必有相干涡结构。Q 与 $\lambda_2$ 的设计目的，正是把“旋转主导”的区域从“剪切主导”的区域里分出来。展示涡结构时，最好同时给出 Q 的阈值与网格尺度。
:::

## λ2 判据

λ2 判据看张量

$$
A = S^2 + \Omega^2
$$

的特征值。把三个特征值按从小到大排为 $\lambda_1 \le \lambda_2 \le \lambda_3$，则 $\lambda_2<0$ 的区域被判为涡核。它的物理依据是：在涡核内部，旋转项压过应变项，使中间特征值变负。

```python
def lambda2(G):
    S, W = strain_rotation(G)
    A = (np.einsum("ij...,jk...->ik...", S, S)
         + np.einsum("ij...,jk...->ik...", W, W))
    A = 0.5 * (A + np.swapaxes(A, 0, 1))
    A = np.moveaxis(A, (0, 1), (-2, -1))
    lam = np.linalg.eigvalsh(A)
    return lam[..., 1]
```

`eigvalsh` 只接受对称矩阵并返回升序特征值，索引 1 即 $\lambda_2$；`moveaxis` 把矩阵轴移到最后两位。数组很大时按 `z` 分块处理。

Q 与 λ2 给出的涡结构相似但阈值敏感性不同：λ2 对强剪切更稳健，Q 对可压缩更敏感。论文应说明方法、阈值与无量纲化。

## 流线积分（RK4）

流线满足

$$
\frac{\mathrm{d}\mathbf{x}}{\mathrm{d}s}
= \frac{\mathbf{u}(\mathbf{x})}{\lVert\mathbf{u}(\mathbf{x})\rVert},
$$

即按弧长前进，`ds` 有长度量纲，便于控制空间分辨率。

四阶 Runge-Kutta 的一步为

$$
\mathbf{x}_{n+1}
= \mathbf{x}_n + \frac{\Delta s}{6}
\left(\mathbf{k}_1 + 2\mathbf{k}_2 + 2\mathbf{k}_3 + \mathbf{k}_4\right),
$$

其中 $\mathbf{k}_1=\mathbf{f}(\mathbf{x}_n)$，$\mathbf{k}_2=\mathbf{f}(\mathbf{x}_n+\tfrac{\Delta s}{2}\mathbf{k}_1)$，$\mathbf{f}$ 是单位速度。

```python
from scipy.interpolate import RegularGridInterpolator

def trace_streamline(u, v, w, x, y, z, seed, ds=1e-3, nsteps=2000):
    axes = (x, y, z)
    fu = RegularGridInterpolator(axes, u, bounds_error=False, fill_value=np.nan)
    fv = RegularGridInterpolator(axes, v, bounds_error=False, fill_value=np.nan)
    fw = RegularGridInterpolator(axes, w, bounds_error=False, fill_value=np.nan)

    def sample(f, p):
        return float(np.asarray(f(p)).reshape(-1)[0])

    def unit_velocity(p):
        vals = np.array([sample(fu, p), sample(fv, p), sample(fw, p)])
        if not np.all(np.isfinite(vals)):
            return None
        speed = np.linalg.norm(vals)
        if speed < 1e-12:
            return None
        return vals / speed

    p = np.asarray(seed, dtype=float)
    path = [p.copy()]
    for _ in range(nsteps):
        k1 = unit_velocity(p)
        if k1 is None:
            break
        k2 = unit_velocity(p + 0.5 * ds * k1)
        if k2 is None:
            break
        k3 = unit_velocity(p + 0.5 * ds * k2)
        if k3 is None:
            break
        k4 = unit_velocity(p + ds * k3)
        if k4 is None:
            break
        p = p + (ds / 6.0) * (k1 + 2.0 * k2 + 2.0 * k3 + k4)
        path.append(p.copy())
    return np.array(path)
```

实现要点：

- `fill_value=np.nan` 让越界点返回 NaN，积分自动停止。
- 驻点附近速度趋零会放大噪声，用 `speed < 1e-12` 截断。
- 种子向内偏移半个单元，避开壁面与入口面。
- 非定常流的粒子轨迹应积分 $\mathrm{d}\mathbf{x}/\mathrm{d}t=\mathbf{u}$，而不是单位速度。

## 质量流量与加权平均

通过一个面的质量流量为

$$
\dot m = \int_A \rho\,\mathbf{u}\cdot\mathbf{n}\,\mathrm{d}A
\approx \sum_f \rho_f\left(\mathbf{u}_f\cdot\mathbf{n}_f\right)A_f.
$$

面积加权平均与质量加权平均分别为

$$
\bar\phi_A = \frac{\sum_f \phi_f A_f}{\sum_f A_f},
\qquad
\bar\phi_m = \frac{\sum_f \rho_f \phi_f\left(\mathbf{u}_f\cdot\mathbf{n}_f\right)A_f}
{\sum_f \rho_f\left(\mathbf{u}_f\cdot\mathbf{n}_f\right)A_f}.
$$

```python
def mass_flow(rho, un, area):
    """un is the normal velocity, positive along the outward normal."""
    return float(np.sum(rho * un * area))

def area_average(phi, area):
    return float(np.sum(phi * area) / np.sum(area))

def mass_weighted_average(phi, rho, un, area):
    weight = rho * un * area
    return float(np.sum(phi * weight) / np.sum(weight))
```

面积加权回答“面上平均温度是多少”，质量加权回答“流出的流体平均带走多少焓”；速度不均匀时两者差别很大，报告必须说明。

边界面法向必须统一朝外，否则流量相互抵消，得到“守恒”的假象。分别对入口与出口取绝对值再比较，差值应在百分之几以内。

## 雷诺应力与湍流统计

对一组时间样本 $\mathbf{u}^{(n)}$，时均与脉动为

$$
\bar u_i = \frac1N\sum_{n=1}^N u_i^{(n)},
\qquad
u_i' = u_i - \bar u_i.
$$

雷诺应力张量与湍动能为

$$
\overline{u_i'u_j'} = \frac1N\sum_{n=1}^N u_i'^{(n)}u_j'^{(n)},
\qquad
k = \tfrac12\overline{u_i'u_i'}.
$$

```python
def reynolds_stress(samples):
    """samples shape (N, 3); returns 3x3 tensor."""
    fluct = samples - samples.mean(axis=0)
    return fluct.T @ fluct / samples.shape[0]

def turbulent_kinetic_energy(samples):
    return 0.5 * float(np.trace(reynolds_stress(samples)))
```

注意：

- 样本是同一空间点的时间序列，空间平均是另一类统计量。
- 采样间隔应大于湍流积分时间尺度，否则等效独立样本数远小于 `N`；误差按

  $$
  \epsilon_{\mathrm{stat}} \propto N^{-1/2}
  $$

  下降，样本数翻四倍误差才减半。
- LES 的雷诺应力含 resolved 与 subgrid 两部分，只统计解析速度会低估湍动能；RANS 只给时均量，不能重建脉动。

## FFT 能量谱

对长度为 $N$ 的一维信号 $u_n$，离散傅里叶变换为

$$
\hat u_k = \sum_{n=0}^{N-1} u_n e^{-\mathrm{i}2\pi kn/N}.
$$

能谱按 Parseval 关系归一化：

$$
E(k) = \frac{1}{N^2}\left|\hat u_k\right|^2,
\qquad
k = \frac{2\pi}{N\Delta x}.
$$

```python
def energy_spectrum_1d(u, dx):
    n = u.size
    signal = u - u.mean()
    spectrum = np.fft.rfft(signal)
    k = 2.0 * np.pi * np.fft.rfftfreq(n, d=dx)
    energy = np.abs(spectrum) ** 2 / n ** 2
    energy[1:-1] *= 2.0
    return k, energy
```

`rfft` 只返回非负频率，除直流与 Nyquist 外的频点要乘 2 才能保持总能量。非周期信号先加窗（Hann 或 Tukey），否则泄漏污染低频。惯性区应满足 $E(k)\propto k^{-5/3}$，这是检查能谱的常用依据。

三维能谱还要做球壳平均：

$$
E(k)\Delta k = \sum_{|\mathbf{k}|\in[k,k+\Delta k]} \tfrac12\left|\hat{\mathbf{u}}(\mathbf{k})\right|^2.
$$

先做三维 FFT，再按波数模长分箱求和；箱宽要容纳多个模态，又不能抹平斜率。

## 壁面压力积分求阻力与升力

对物体表面 $S$（外法向 $\mathbf{n}$），流体对物体的作用力为

$$
F_i = -\oint_S p n_i\,\mathrm{d}S
+ \oint_S \tau_{ij}n_j\,\mathrm{d}S.
$$

第一项是压差阻力，第二项是摩擦阻力。离散形式为

$$
F_i \approx -\sum_f p_f n_{i,f} A_f
+ \sum_f \tau_{ij,f} n_{j,f} A_f.
$$

```python
def pressure_force(p, normals, areas):
    """normals point outward from the body; p in Pa."""
    return -np.sum((p * areas)[:, None] * normals, axis=0)

def force_coefficients(force, rho_inf, u_inf, area_ref):
    q_inf = 0.5 * rho_inf * u_inf ** 2
    return force / (q_inf * area_ref)

def project_force(force, direction):
    return float(np.dot(force, direction))
```

使用步骤：

1. 提取壁面面中心、外法向与面积；外法向必须由物体指向流体，否则整体符号会错。
2. 压力取壁面值；只有单元中心压力时先插值到面，或说明使用相邻单元值的近似。
3. 摩擦项单独累加，只算压力项得到的是压差阻力，不是总阻力。
4. 把合力投影到来流与升力方向，再除以 $\tfrac12\rho_\infty U_\infty^2 A_{\mathrm{ref}}$。

力矩同理：

$$
\mathbf{M} = -\oint_S p\left(\mathbf{x}\times\mathbf{n}\right)\mathrm{d}S,
$$

参考点要固定并写进报告。参考点换了，力矩数值就变了。

## 校验：用制造解检查实现

写完函数先用解析场验证。取线性剪切 $u=ay$、$v=w=0$，涡量应为 $(0,0,-a)$，Q 应为零。若涡量符号反了，检查 $G$ 的下标顺序；若 Q 不为零，检查 $S$ 与 $W$ 的对称化是否作用在矩阵轴。这个测试只需几行，却能拦住大多数索引与转置错误。

:::tip 单位与参考量清单
每个脚本开头统一写死：`rho_inf`、`u_inf`、`p_inf`、`mu`、`nu`、`L_ref`、`A_ref`。所有函数只接受这些量，不在内部硬编码。这样换工况时只改一处，也方便把参数写进图注与报告。
:::

## 计算顺序与内存

流水线是：读取 → 统一网格 → 梯度张量 → 局部量 → 沿面积分 → 统计 → 出图。梯度张量占 9 个三维数组，是内存峰值；大数据应分块计算 Q 与 λ2。所有函数返回 numpy 数组而非图片，同一套指标可供 matplotlib、PyVista 与 CSV 使用，下一章 [[ch6/visualization|出版级出图]] 只负责把这些数组变成图。

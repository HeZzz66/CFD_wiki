---
title: 导热与傅里叶定律
order: 2
summary: 从傅里叶定律与热阻网络出发，推导一维平板、圆筒与球壳的稳态导热，讨论肋片、接触热阻、集总参数与半无限体瞬态导热，并给出二维导热的有限体积离散与 Python 实现。
tags: [傅里叶定律, 热阻, 肋片, 瞬态导热]
---

导热是三种传热方式中最“安静”的一种：没有流体运动，也没有电磁波，热量靠分子振动与自由电子从高温处向低温处迁移。它决定了固体内部的温度分布，也决定了流固界面上的热流。CFD 中的共轭传热、电子散热、电池热管理，最终都要回到导热方程。

## 傅里叶定律

一维稳态导热的实验定律为

$$
q''=-k\frac{\mathrm{d}T}{\mathrm{d}x},
$$

$q''$ 是热流密度（W/m²），$k$ 是导热系数（W/(m·K)），负号表示热流方向与温度梯度相反。三维推广为

$$
\mathbf{q}''=-k\nabla T.
$$

对各向异性材料（如纤维增强复合材料、层状岩体），$k$ 是二阶张量：

$$
q''_i=-k_{ij}\frac{\partial T}{\partial x_j}.
$$

CFD 中大多数工程材料按各向同性处理，但复合材料与生物组织必须用张量形式。

| 材料（约 300 K） | $k$，W/(m·K) | 说明 |
| --- | --- | --- |
| 铜 | 398 | 电子导热，换热器管壁 |
| 铝 | 205 | 轻量化散热器 |
| 不锈钢 | 15–20 | 耐腐蚀，热阻较大 |
| 玻璃 | 0.8 | 保温、观察窗 |
| 水 | 0.60 | 自然对流与沸腾介质 |
| 空气 | 0.026 | 隔热层主体 |

导热系数的温度依赖性对高温问题不可忽略；金属的 $k$ 随温度升高通常下降，气体则上升。

## 一维稳态导热与热阻

### 平壁

对厚度 $L$、面积 $A$ 的平壁，温度线性分布：

$$
q''=k\frac{T_1-T_2}{L},
\qquad
Q=kA\frac{T_1-T_2}{L}.
$$

定义导热热阻

$$
R_{cond}=\frac{L}{kA},
$$

则 $Q=\Delta T/R_{cond}$，与电路的欧姆定律完全同构。

### 圆筒壁

对内外半径 $r_1$、$r_2$、长度 $L$ 的圆筒，稳态径向导热为

$$
Q=\frac{2\pi kL\left(T_1-T_2\right)}{\ln(r_2/r_1)},
\qquad
R_{cond}=\frac{\ln(r_2/r_1)}{2\pi kL}.
$$

注意热流沿半径方向扩散，面积随半径增大，因此温度分布是对数型而非线性。

### 球壳

$$
Q=\frac{4\pi k\left(T_1-T_2\right)}{1/r_1-1/r_2},
\qquad
R_{cond}=\frac{1/r_1-1/r_2}{4\pi k}.
$$

### 复合壁与接触热阻

多层平壁的总热阻为各层串联：

$$
R_{total}=\sum_i\frac{L_i}{k_iA}.
$$

两层固体接触时，微观粗糙度导致实际接触面积小于名义面积，形成**接触热阻**

$$
R_c=\frac{1}{h_cA},
$$

$h_c$ 是接触换热系数，典型值从粗糙干燥接触的 $10^3\ \mathrm{W/(m^2\cdot K)}$ 到涂导热硅脂的 $10^5$ 量级。CFD 中共轭传热若忽略接触热阻，界面温度会偏低，热流被高估。

:::tip 热阻网络的用法
把导热、对流、辐射都写成热阻，可以快速估算多层结构的温度分布，而不必解 PDE。例如“芯片—硅脂—散热器—空气”四层串联，先算总热阻，再由功耗定温升。这是电子散热设计的日常工作。
:::

## 扩展表面：肋片

肋片（fin）通过增大换热面积降低对流热阻，广泛用于散热器、换热器与燃气轮机叶片冷却。

对等截面直肋，取一维导热 + 表面对流，能量平衡给出

$$
\frac{\mathrm{d}^2\theta}{\mathrm{d}x^2}-m^2\theta=0,
\qquad
\theta=T-T_\infty,
$$

$$
m=\sqrt{\frac{hP}{kA_c}},
$$

$P$ 是肋片周长，$A_c$ 是横截面积。边界条件为肋根 $\theta(0)=\theta_b$、肋端绝热（$\mathrm{d}\theta/\mathrm{d}x=0$）时，

$$
\frac{\theta(x)}{\theta_b}
=\frac{\cosh\left[m(L-x)\right]}{\cosh(mL)}.
$$

肋效率定义为实际散热量与“整个肋面保持肋根温度”时的理想散热量之比：

$$
\eta_f=\frac{\tanh(mL)}{mL}.
$$

肋片越薄越长，$mL$ 越大，效率越低——因为肋端温度已经接近环境温度，再增加长度只增加面积而不增加温差。

| 肋型 | 效率公式（绝热端） | 备注 |
| --- | --- | --- |
| 等截面直肋 | $\tanh(mL)/(mL)$ | 最常见 |
| 环肋 | 修正贝塞尔函数 | 散热器翅片 |
| 针肋 | 类似直肋 | 紧凑式换热器 |

## 二维与三维稳态导热

无内热源时，稳态导热满足拉普拉斯方程：

$$
\nabla^2T=0.
$$

有内热源 $q'''$（W/m³）时：

$$
\nabla^2T=-\frac{q'''}{k}.
$$

解析解只对少数规则几何（矩形、圆柱、球）存在，一般靠分离变量或格林函数。工程上更多用数值方法，把区域离散成网格，解线性方程组。

常见边界条件：

- **第一类（Dirichlet）**：给定壁温 $T=T_w$；
- **第二类（Neumann）**：给定热流 $-k\partial T/\partial n=q''_w$，绝热时 $q''_w=0$；
- **第三类（Robin）**：给定对流换热 $-k\partial T/\partial n=h(T_w-T_\infty)$；
- **辐射边界**：$-k\partial T/\partial n=\varepsilon\sigma(T_w^4-T_{sur}^4)$。

## 瞬态导热

### 集总参数法

当物体内部导热热阻远小于表面对流热阻时，可假设内部温度均匀。判据是 **Biot 数**

$$
Bi=\frac{hL_c}{k}<0.1,
$$

$L_c=V/A_s$ 是特征长度。此时能量平衡为

$$
\rho Vc_p\frac{\mathrm{d}T}{\mathrm{d}t}=-hA_s\left(T-T_\infty\right),
$$

解得

$$
\frac{T(t)-T_\infty}{T_i-T_\infty}=e^{-t/\tau},
\qquad
\tau=\frac{\rho Vc_p}{hA_s}.
$$

$\tau$ 是热时间常数：$t=\tau$ 时温差衰减到初始值的 36.8%，$t=3\tau$ 时约 5%。

### 半无限体

表面温度突然变为 $T_s$ 时，半无限体的温度分布为

$$
\frac{T(x,t)-T_i}{T_s-T_i}
=\operatorname{erfc}\left(\frac{x}{2\sqrt{\alpha t}}\right),
$$

$\alpha=k/(\rho c_p)$ 是热扩散率。热影响深度约为

$$
\delta\sim\sqrt{\alpha t}.
$$

这解释了为什么土壤日温度波动只影响表层几十厘米，而年温度波动可深入数米。

### 有限厚度的瞬态

有限平壁的瞬态解是无穷级数，工程上常用 Heisler 图表或一维数值解。级数首项在 $Fo=\alpha t/L^2>1$ 后占主导，因此长时间行为近似指数衰减。

## 数值离散：有限体积法

对控制体 $P$ 积分稳态导热方程：

$$
\int_V\nabla\cdot(k\nabla T)\,\mathrm{d}V
=\sum_f k_f\frac{T_N-T_P}{d_{PN}}A_f.
$$

二维正交网格上，离散方程为

$$
a_PT_P=a_ET_E+a_WT_W+a_NT_N+a_ST_S,
$$

$$
a_E=\frac{k_eA_e}{\delta x_e},\quad
a_W=\frac{k_wA_w}{\delta x_w},\quad
a_P=a_E+a_W+a_N+a_S.
$$

界面导热系数用**调和平均**：

$$
k_e=\frac{2k_Pk_E}{k_P+k_E},
$$

它保证两层材料串联时的热阻正确。若用算术平均，界面热阻会被低估。

源项线性化：

$$
S_P\Delta V=S_u+S_PT_P,
$$

把 $S_P$ 移到左端可保证对角占优，避免负温度。这一处理是 Patankar 书中的标准做法。

### 迭代求解

二维 Laplace 方程的 Jacobi 迭代为

$$
T_P^{(n+1)}=\frac{1}{4}\left(T_E+T_W+T_N+T_S\right)^{(n)}.
$$

Gauss–Seidel 用最新值更新，收敛更快；再加 SOR（超松弛）可进一步加速。大规模三维问题用多重网格或 Krylov 方法。

## 共轭传热

流体与固体同时求解温度场，界面满足

$$
T_s=T_f,
\qquad
-k_s\frac{\partial T_s}{\partial n}
=-k_f\frac{\partial T_f}{\partial n},
$$

这就是**共轭传热**（conjugate heat transfer，CHT）。它的难点不在方程，而在界面两侧网格与时间尺度不同：固体热扩散慢、流体对流快，需用隐式耦合或分区迭代。

Biot 数在这里再次出现：$Bi\ll1$ 时固体内部温度均匀，可只解流体侧；$Bi\gg1$ 时固体内部温度梯度不可忽略，必须解固体导热。

## Python 示例：二维稳态导热的迭代求解

下面的脚本在 $50\times50$ 网格上解 Laplace 方程：左边界 $T=100$，右边界 $T=0$，上下绝热。理论解是线性分布，可用于验证离散格式。

```python
import numpy as np

nx, ny = 50, 50
T = np.zeros((ny, nx))
T[:, 0] = 100.0          # 左边界
T[:, -1] = 0.0           # 右边界
T[0, :] = T[1, :]        # 下边界绝热（先给初值）
T[-1, :] = T[-2, :]      # 上边界绝热

dx = 1.0 / (nx - 1)
tol = 1e-6
for it in range(20000):
    T_old = T.copy()
    # 内部节点 Jacobi 迭代（向量化）
    T[1:-1, 1:-1] = 0.25 * (
        T_old[2:, 1:-1] + T_old[:-2, 1:-1]
        + T_old[1:-1, 2:] + T_old[1:-1, :-2]
    )
    # 绝热边界：零法向梯度
    T[0, 1:-1] = T[1, 1:-1]
    T[-1, 1:-1] = T[-2, 1:-1]
    err = np.max(np.abs(T - T_old))
    if err < tol:
        print(f"收敛于第 {it} 步，残差 {err:.2e}")
        break

# 与一维线性解对比（上下绝热时应为 T = 100(1 - x/L)）
x = np.linspace(0, 1, nx)
T_exact = 100.0 * (1 - x)
mid = ny // 2
print("中心线最大误差:", np.max(np.abs(T[mid, :] - T_exact)))
print("平均温度:", T.mean())
```

运行后中心线误差应在 $10^{-3}$ 量级（离散误差随网格加密按二阶减小）。把上下边界改成对流边界，就能模拟更接近实际的散热问题。

:::warning 绝热边界的实现
绝热边界不是“把边界温度固定”，而是令法向梯度为零。上面的做法用相邻内点赋值，等价于零梯度；更严谨的有限体积做法是在边界面上令通量为零。两者在均匀网格上等价，在非均匀网格上不同。
:::

## 小结

- 傅里叶定律 $\mathbf{q}''=-k\nabla T$ 是导热的唯一本构关系，热阻网络是它的工程化表达。
- 平壁、圆筒、球壳的热阻形式不同，复合壁按串联相加，接触热阻常被忽略但影响很大。
- 肋片用 $m=\sqrt{hP/(kA_c)}$ 与 $\eta_f=\tanh(mL)/(mL)$ 描述，肋效率随 $mL$ 增大而下降。
- 瞬态导热的两个基本模型是集总参数（$Bi<0.1$）与半无限体（erfc 解）。
- 数值离散的关键是界面导热系数的调和平均与源项线性化，共轭传热需同时满足温度与热流连续。

## 延伸阅读

- Incropera, F. P., DeWitt, D. P. *Fundamentals of Heat and Mass Transfer*, 7th ed. Wiley, 2011.
- Çengel, Y. A., Ghajar, A. J. *Heat and Mass Transfer*, 6th ed. McGraw-Hill, 2020.
- Patankar, S. V. *Numerical Heat Transfer and Fluid Flow*. Hemisphere, 1980.
- Bird, R. B., Stewart, W. E., Lightfoot, E. N. *Transport Phenomena*, 2nd ed. Wiley, 2006.

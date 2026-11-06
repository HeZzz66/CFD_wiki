---
title: 热力学基础与状态方程
order: 1
summary: 梳理热力学状态量、第一与第二定律、理想气体与真实气体状态方程、声速与等熵关系，以及饱和、相平衡与 CFD 常用的热物性计算方法。
tags: [热力学, 状态方程, 理想气体, 相平衡]
---

CFD 的能量方程里，密度与温度的关系由状态方程给出；可压缩流的激波与膨胀波由等熵关系决定；沸腾与凝结由相平衡决定。这些内容都属于热力学。对 CFD 学习者而言，热力学的价值不在于背诵公式，而在于判断**什么时候可以把流体当作理想气体、什么时候必须用真实气体模型、什么时候必须考虑相变**。

## 系统、状态与过程

热力学用**状态量**描述平衡态：压力 $p$、比容 $v$（或密度 $\rho=1/v$）、温度 $T$、内能 $u$、焓 $h$、熵 $s$。状态量只依赖当前状态，与路径无关；热量 $Q$ 与功 $W$ 是过程量，依赖路径。

对简单可压缩系统，两个独立状态量即可确定其余全部状态量（状态公理）。例如给定 $(p,T)$，密度由状态方程给出，焓由物性关系给出。CFD 中每个单元存储的是守恒量 $(\rho,\rho\mathbf{u},\rho E)$，需要通过状态方程反推出 $p$ 与 $T$，这一步称为**状态方程求逆**，其稳定性直接影响可压缩求解器的收敛。

## 热力学第一定律

对闭口系统，

$$
\delta q-\delta w=\mathrm{d}u,
$$

$q$ 是单位质量吸热，$w$ 是单位质量对外做功。对开口系统（控制体），定常流动的能量方程为

$$
q-w=\left(h_2+\frac{u_2^2}{2}+gz_2\right)
-\left(h_1+\frac{u_1^2}{2}+gz_1\right),
$$

其中焓

$$
h=u+pv=u+\frac{p}{\rho}.
$$

焓的物理意义是“内能 + 流动功”，它使开口系统的能量方程不必显式出现压力功。

### 比热与 Mayer 关系

定容比热与定压比热分别为

$$
c_v=\left(\frac{\partial u}{\partial T}\right)_v,
\qquad
c_p=\left(\frac{\partial h}{\partial T}\right)_p.
$$

对理想气体，

$$
c_p-c_v=R,
\qquad
\gamma=\frac{c_p}{c_v}.
$$

空气在常温下 $\gamma\approx1.4$，$R=287\ \mathrm{J/(kg\cdot K)}$。$c_p$ 与 $c_v$ 随温度变化时，理想气体假设仍成立，只是需要把 $c_p(T)$ 积分得到焓：

$$
h(T)-h(T_{ref})=\int_{T_{ref}}^{T}c_p(T')\,\mathrm{d}T'.
$$

CFD 中的分段多项式（NASA 7 系数、9 系数）就是为这一积分服务的。

## 第二定律与熵

可逆过程中

$$
\mathrm{d}s=\frac{\delta q_{rev}}{T}.
$$

对理想气体，

$$
\mathrm{d}s=c_p\frac{\mathrm{d}T}{T}-R\frac{\mathrm{d}p}{p}
=c_v\frac{\mathrm{d}T}{T}-R\frac{\mathrm{d}\rho}{\rho}.
$$

由此得到等熵关系：

$$
\frac{T_2}{T_1}=\left(\frac{p_2}{p_1}\right)^{(\gamma-1)/\gamma}
=\left(\frac{\rho_2}{\rho_1}\right)^{\gamma-1},
\qquad
\frac{p}{\rho^\gamma}=\text{const}.
$$

这三条式子是可压缩 CFD 中最常用的关系：激波前后用 Rankine–Hugoniot 关系，等熵膨胀用上述幂律，亚音速喷嘴的流量由壅塞条件决定。

### 声速与马赫数

等熵声速为

$$
a=\sqrt{\left(\frac{\partial p}{\partial\rho}\right)_s}
=\sqrt{\gamma RT}
=\sqrt{\gamma\frac{p}{\rho}}.
$$

马赫数 $Ma=U/a$。$Ma<0.3$ 时密度变化小于约 5%，可按不可压缩处理；$Ma>1$ 出现激波，必须用可压缩求解器与通量分裂格式。

### 滞止参数

对理想气体一维定常绝能流动，

$$
T_0=T\left(1+\frac{\gamma-1}{2}Ma^2\right),
$$

$$
p_0=p\left(1+\frac{\gamma-1}{2}Ma^2\right)^{\gamma/(\gamma-1)}.
$$

$T_0$、$p_0$ 是等熵滞止到静止时得到的温度与压力。它们是与实验（总温总压探针）对接的量，也是入口边界条件的常用给法。

## 状态方程

### 理想气体

$$
p=\rho RT,
\qquad R=\frac{R_u}{M},
$$

$R_u=8.314\ \mathrm{kJ/(kmol\cdot K)}$，$M$ 是摩尔质量。空气 $M\approx28.97\ \mathrm{g/mol}$，$R\approx0.287\ \mathrm{kJ/(kg\cdot K)}$。

理想气体假设忽略分子体积与分子间作用力，适用于高温、低压、远离临界点。工程判据常用对比压力 $p_r=p/p_c$ 与对比温度 $T_r=T/T_c$：当 $T_r>2$ 且 $p_r<0.1$ 时，理想气体误差通常可接受。

### 压缩因子与真实气体

定义压缩因子

$$
Z=\frac{pv}{RT}=\frac{p}{\rho RT},
$$

理想气体 $Z=1$。真实气体在高压、低温下 $Z$ 可显著偏离 1：CO$_2$ 在 300 K、50 bar 时已接近饱和，$Z$ 约为 0.7，密度比理想气体高约 40%。

**van der Waals 方程**是最简单的真实气体模型：

$$
\left(p+\frac{a}{v^2}\right)\left(v-b\right)=RT,
$$

$a$ 修正分子间引力，$b$ 修正分子体积。它能在临界点附近给出定性正确的相变行为，但精度有限。

**Peng–Robinson（PR）方程**在工程 CFD 与流程模拟中应用更广：

$$
p=\frac{RT}{v-b}
-\frac{a\alpha(T)}{v^2+2bv-b^2},
$$

$$
a=0.45724\frac{R^2T_c^2}{p_c},
\qquad
b=0.07780\frac{RT_c}{p_c},
$$

$$
\alpha(T)=\left[1+m\left(1-\sqrt{T_r}\right)\right]^2,
\qquad
m=0.37464+1.54226\omega-0.26992\omega^2,
$$

$\omega$ 是偏心因子。PR 方程对烃类、CO$_2$ 与轻气体的密度与相平衡预测较好，是闪蒸与多组分输运的常用选择。

| 模型 | 形式 | 优点 | 局限 |
| --- | --- | --- | --- |
| 理想气体 | $p=\rho RT$ | 简单、无需迭代 | 高压/低温误差大 |
| van der Waals | 立方型 | 解析简单、含相变 | 精度低 |
| Peng–Robinson | 立方型 | 烃类与 CO$_2$ 精度好 | 需解三次方程 |
| SRK | 立方型 | 轻气体与烃类 | 极性物质偏差 |
| IAPWS-IF97 | 专用拟合 | 水/蒸汽高精度 | 仅限水 |

## 相平衡与饱和

### Clausius–Clapeyron 方程

两相平衡时，饱和压力随温度的变化由

$$
\frac{\mathrm{d}p_{sat}}{\mathrm{d}T}
=\frac{h_{fg}}{T\left(v_g-v_l\right)}
=\frac{h_{fg}}{T\left(1/\rho_g-1/\rho_l\right)}
$$

给出，$h_{fg}$ 是潜热。若把气相当作理想气体且 $v_g\gg v_l$，化为

$$
\frac{\mathrm{d}\ln p_{sat}}{\mathrm{d}T}
=\frac{h_{fg}}{RT^2}.
$$

在潜热近似为常数时积分得

$$
\ln\frac{p_{sat,2}}{p_{sat,1}}
=-\frac{h_{fg}}{R}\left(\frac{1}{T_2}-\frac{1}{T_1}\right).
$$

这条式子解释了为什么饱和压力随温度近似指数增长，也是 Antoine 拟合的理论背景。

### Antoine 方程

工程上常用

$$
\log_{10}p_{sat}=A-\frac{B}{T+C},
$$

$T$ 通常为 K 或 $^\circ$C，$p_{sat}$ 的单位随数据表而异（mmHg、bar、Pa 都有），使用前必须核对单位。Antoine 只适用于有限温度区间，跨越临界点后失效。

### 干度与饱和状态

在饱和 dome 内，混合物由饱和液与饱和汽组成，干度

$$
x=\frac{m_g}{m_g+m_l}
$$

确定状态点。混合物比容与比焓为

$$
v=xv_g+(1-x)v_l,
\qquad
h=xh_g+(1-x)h_l.
$$

这两条式子是两相流一维计算与沸腾 CFD 的入口：CFD 求解的焓或温度，必须先转换为干度，才能查相区。

:::note 亚稳态与闪蒸
压力突然降到饱和压力以下时，液体不会立即沸腾，而是进入**亚稳态**（过热液体）。闪蒸的成核与弛豫时间决定了喷嘴、阀门下游的相变位置。平衡模型（HEM）假设无限快相变，非平衡模型则需要成核率与气泡生长速率。
:::

## 热物性计算

### NASA 多项式

对理想气体，比热常用 7 系数拟合：

$$
\frac{c_p}{R}=a_1+a_2T+a_3T^2+a_4T^3+a_5T^4,
$$

$$
\frac{h}{RT}=a_1+\frac{a_2}{2}T+\frac{a_3}{3}T^2
+\frac{a_4}{4}T^3+\frac{a_5}{5}T^4+\frac{a_6}{T},
$$

$$
\frac{s}{R}=a_1\ln T+a_2T+\frac{a_3}{2}T^2
+\frac{a_4}{3}T^3+\frac{a_5}{4}T^4+a_7.
$$

燃烧与高温气体 CFD 几乎都用这一形式，优点是求导简单、温度范围宽；缺点是在低温段需要另一组系数。

### 水与蒸汽

IAPWS-IF97 是水/蒸汽的工业标准，覆盖液态、蒸汽、超临界与两相区。它比理想气体复杂得多，但精度高、区间衔接明确。CFD 中的沸腾与冷凝若涉及跨临界压力，应直接调用 IF97 或 CoolProp，而不是自己拟合。

| 工具 | 覆盖 | 典型用途 |
| --- | --- | --- |
| NASA 多项式 | 高温气体 | 燃烧、高超声速 |
| IAPWS-IF97 | 水/蒸汽 | 锅炉、汽轮机、冷凝器 |
| CoolProp | 大量工质 | 制冷剂、有机朗肯循环 |
| NIST REFPROP | 高精度多工质 | 标定与验证 |

## CFD 中的热力学选择

### 不可压缩与可压缩

不可压缩求解器只解动量与连续性，密度为常数（或仅随温度变化，用 Boussinesq 近似）：

$$
\rho=\rho_0\left[1-\beta\left(T-T_0\right)\right],
$$

$\beta$ 是热膨胀系数。它适用于 $Ma<0.3$ 且温度变化不大的自然对流与强制对流。

可压缩求解器解总能量方程：

$$
\frac{\partial(\rho E)}{\partial t}
+\nabla\cdot\left[\mathbf{u}\left(\rho E+p\right)\right]
=\nabla\cdot\left(k\nabla T\right)
+\nabla\cdot\left(\boldsymbol{\tau}\cdot\mathbf{u}\right)
+\rho\mathbf{g}\cdot\mathbf{u},
$$

$$
E=e+\frac{|\mathbf{u}|^2}{2},
\qquad
H=h+\frac{|\mathbf{u}|^2}{2}.
$$

注意 $E$ 用内能、$H$ 用焓，二者差一个压力功 $p/\rho$。把总能量写成焓形式时，压力功已经在通量里，不能再重复加入源项。

### 低速可压缩与低马赫预处理

当 $Ma$ 很小但仍需考虑密度变化（如大温差自然对流、燃烧），直接解可压缩方程会遇到刚性问题：声波时间尺度远小于对流时间尺度。低马赫预处理通过修改时间导数项，把声波速度“降”到与对流同量级，是燃烧与热声求解器的常用技术。

## Python 示例：Peng–Robinson 状态方程

下面的脚本用 PR 方程计算 CO$_2$ 在 300 K、不同压力下的压缩因子与密度，并与理想气体对比。

```python
import numpy as np

R = 8.314          # J/(mol·K)
M = 0.04401        # kg/mol
Tc, pc, omega = 304.13, 7.377e6, 0.2239   # CO2 临界参数

def pr_parameters(T):
    a = 0.45724 * R**2 * Tc**2 / pc
    b = 0.07780 * R * Tc / pc
    m = 0.37464 + 1.54226 * omega - 0.26992 * omega**2
    alpha = (1 + m * (1 - np.sqrt(T / Tc)))**2
    return a * alpha, b

def pr_z(T, p):
    """解 PR 立方方程，返回气相根 Z。"""
    a, b = pr_parameters(T)
    A = a * p / (R**2 * T**2)
    B = b * p / (R * T)
    coeffs = [1,
              -(1 - B),
              A - 3 * B**2 - 2 * B,
              -(A * B - B**2 - B**3)]
    roots = np.roots(coeffs)
    real = roots[np.abs(roots.imag) < 1e-10].real
    return np.max(real)          # 气相取最大实根

T = 300.0
for p_bar in [1, 10, 20, 50, 80]:
    p = p_bar * 1e5
    Z = pr_z(T, p)
    rho_pr = p * M / (Z * R * T)
    rho_ideal = p * M / (R * T)
    print(f"p={p_bar:3d} bar  Z={Z:.3f}  rho_PR={rho_pr:6.2f} kg/m3  "
          f"rho_ideal={rho_ideal:6.2f} kg/m3")

# 临界点校核：PR 的理论临界压缩因子约为 0.307
print("Z at critical point ≈", pr_z(Tc, pc))
```

输出会显示：低压时 PR 与理想气体几乎一致；50 bar 以上 PR 密度明显更高，$Z$ 低于 1；临界点附近 $Z\approx0.3$，与 PR 方程的理论值相符。

:::warning 立方方程的多根
PR 方程在饱和 dome 内有三个实根，分别对应液相、亚稳态与气相。选错根会导致密度跳变、相变判断错误。工程代码通常按“最大根为气相、最小根为液相”选取，并用逸度相等判断相稳定性。
:::

## 小结

- 状态方程把 $(p,T)$ 与密度联系起来，理想气体只适用于低压高温；高压与近临界区必须用 PR、SRK 或专用物性库。
- 焓、熵与等熵关系是可压缩 CFD 的基础，声速 $a=\sqrt{\gamma RT}$ 决定马赫数与壅塞。
- 相平衡由 Clausius–Clapeyron 与 Antoine 描述，干度是连接热力学与两相流的桥梁。
- CFD 中必须明确用内能还是焓、是否包含压力功，以及是否需要低马赫预处理。
- 物性库（NASA、IF97、CoolProp）比自拟公式可靠，跨临界与相变问题尤其如此。

## 延伸阅读

- Incropera, F. P., DeWitt, D. P. *Fundamentals of Heat and Mass Transfer*, 7th ed. Wiley, 2011.
- Çengel, Y. A., Ghajar, A. J. *Heat and Mass Transfer*, 6th ed. McGraw-Hill, 2020.
- Bird, R. B., Stewart, W. E., Lightfoot, E. N. *Transport Phenomena*, 2nd ed. Wiley, 2006.
- Patankar, S. V. *Numerical Heat Transfer and Fluid Flow*. Hemisphere, 1980.

---
title: 对流换热与边界层
order: 3
summary: 从对流换热的定义与边界层方程出发，梳理 Re、Pr、Nu、Pe、St 等无量纲数，给出管内与外部强制对流、自然对流与混合对流的经典关联式及其适用区间。
tags: [对流换热, 边界层, Nu, Dittus-Boelter, Churchill-Bernstein]
---

导热只靠分子传热，对流则靠流体把热量“搬走”。同样一块 60 ℃ 的散热片，在静止空气中靠自然对流，在风扇吹拂下靠强制对流，散热量可能相差一个量级。CFD 计算对流换热的核心，是把壁面热流写成 $q''=h(T_w-T_\infty)$，而 $h$ 必须由边界层结构或实验关联式给出。

## 对流换热的定义

牛顿冷却定律定义对流换热系数：

$$
q''=h\left(T_w-T_\infty\right),
\qquad
h=\frac{q''}{T_w-T_\infty}.
$$

$h$ 不是物性，而是流场、壁面几何与温差共同决定的“结果量”。这就是为什么同一个表面在不同流速下 $h$ 不同，也是为什么 CFD 要用局部 $h(x)$ 而不是全场常数。

用导热系数无量纲化，得到 **Nusselt 数**

$$
Nu=\frac{hL}{k},
$$

它表示“对流换热量与同厚度流体层纯导热量之比”。$Nu$ 是几何与流动的函数，$h$ 只是它的有量纲包装。

## 边界层方程

对平板绕流，Prandtl 边界层近似给出

$$
u\frac{\partial u}{\partial x}+v\frac{\partial u}{\partial y}
=-\frac{1}{\rho}\frac{\mathrm{d}p}{\mathrm{d}x}
+\nu\frac{\partial^2u}{\partial y^2},
$$

$$
u\frac{\partial T}{\partial x}+v\frac{\partial T}{\partial y}
=\alpha\frac{\partial^2T}{\partial y^2},
$$

$$
\frac{\partial u}{\partial x}+\frac{\partial v}{\partial y}=0.
$$

动量方程与能量方程结构相同，只是扩散系数从 $\nu$ 换成热扩散率 $\alpha$。二者之比就是 **Prandtl 数**

$$
Pr=\frac{\nu}{\alpha}=\frac{\mu c_p}{k}.
$$

$Pr$ 衡量“动量扩散与热扩散谁更快”：$Pr\approx1$ 时速度边界层与温度边界层厚度相近（空气 $Pr\approx0.71$）；$Pr\gg1$ 时温度边界层更薄（水 $Pr\approx7$，油 $Pr\gg100$）；液态金属 $Pr\ll1$，温度边界层远厚于速度边界层。

### 边界层厚度的尺度关系

层流平板的速度边界层厚度

$$
\delta\sim\frac{x}{\sqrt{Re_x}},
\qquad
Re_x=\frac{Ux}{\nu},
$$

热边界层厚度

$$
\delta_T\sim\frac{\delta}{Pr^{1/3}}.
$$

由此得到局部 $Nu$ 的标度：

$$
Nu_x\sim Re_x^{1/2}Pr^{1/3}.
$$

这正是层流平板关联式 $Nu_x=0.332Re_x^{1/2}Pr^{1/3}$ 的来源，常数由 Blasius 相似解确定。

## 无量纲数体系

| 无量纲数 | 定义 | 含义 |
| --- | --- | --- |
| Reynolds $Re$ | $\rho UL/\mu$ | 惯性力/粘性力 |
| Prandtl $Pr$ | $\mu c_p/k$ | 动量扩散/热扩散 |
| Nusselt $Nu$ | $hL/k$ | 对流/纯导热 |
| Péclet $Pe$ | $Re\,Pr$ | 对流/热扩散 |
| Stanton $St$ | $Nu/(Re\,Pr)$ | 实际换热/热容量通量 |
| Grashof $Gr$ | $g\beta\Delta T L^3/\nu^2$ | 浮力/粘性力 |
| Rayleigh $Ra$ | $Gr\,Pr$ | 自然对流强度 |
| Richardson $Ri$ | $Gr/Re^2$ | 自然对流/强制对流 |

这些数不是孤立的：$Pe=RePr$、$Ra=GrPr$、$St=Nu/(RePr)$，记住这三条关系可以少背很多公式。

## 管内强制对流

### 入口段与充分发展

管内流动先经过入口段，速度剖面与温度剖面逐渐发展。层流入口长度约为

$$
L_{h}\approx0.05\,Re_D\,D,
$$

湍流入口长度约为 $10D$。热入口长度还受 $Pr$ 影响，层流时约为 $0.05Re_DPr\,D$。

充分发展层流的 $Nu$ 只取决于边界条件：

| 边界条件 | $Nu_D$ |
| --- | --- |
| 常壁温 | 3.66 |
| 常热流 | 4.36 |

这两个数是层流管内换热的“下限”，与 $Re$ 无关。很多 CFD 算例用它们校核层流管道换热。

### 湍流管内关联式

**Dittus–Boelter**：

$$
Nu_D=0.023\,Re_D^{0.8}Pr^{n},
\qquad
n=\begin{cases}0.4,&\text{heating}\\0.3,&\text{cooling}\end{cases}
$$

适用：$Re_D>10^4$、$0.6<Pr<160$、充分发展湍流、物性变化不大。它是最经典的工程公式，但对低 $Re$ 与高 $Pr$ 偏差较大。

**Sieder–Tate**：

$$
Nu_D=0.027\,Re_D^{0.8}Pr^{1/3}
\left(\frac{\mu}{\mu_w}\right)^{0.14},
$$

适用：$Re_D>10^4$、$0.7<Pr<16700$，用壁温粘度修正非均匀物性。努塞尔数对 $Pr$ 的指数从 0.4 降为 1/3，是对高 $Pr$ 流体的修正。

**Gnielinski**：

$$
Nu_D=\frac{(f/8)\left(Re_D-1000\right)Pr}
{1+12.7\sqrt{f/8}\left(Pr^{2/3}-1\right)},
$$

$$
f=\left(0.790\ln Re_D-1.64\right)^{-2},
$$

适用：$3000<Re_D<5\times10^6$、$0.5<Pr<2000$。它覆盖过渡区，精度优于 Dittus–Boelter，是当前工程计算的首选。

| 关联式 | 适用 $Re$ | 适用 $Pr$ | 特点 |
| --- | --- | --- | --- |
| Dittus–Boelter | $>10^4$ | 0.6–160 | 最简单 |
| Sieder–Tate | $>10^4$ | 0.7–16700 | 含壁温粘度修正 |
| Gnielinski | 3000–$5\times10^6$ | 0.5–2000 | 覆盖过渡区，精度高 |

### 粗糙管与非圆管

工程管道有粗糙度，Moody 图的摩擦因子可直接用于换热类比：

$$
St\,Pr^{2/3}=\frac{f}{8},
$$

即 **Chilton–Colburn 类比**。由此

$$
Nu=Re\,Pr^{1/3}\frac{f}{8}.
$$

粗糙度增大摩擦因子的同时增强换热，二者通过 $j$ 因子联系在一起。非圆管用水力直径

$$
D_h=\frac{4A_c}{P},
$$

$A_c$ 是流通面积，$P$ 是湿周；但层流非圆管的 $Nu$ 与形状有关，需查表修正。

## 外部强制对流

### 平板

层流（$Re_x<5\times10^5$）：

$$
Nu_x=0.332\,Re_x^{1/2}Pr^{1/3},
\qquad
\overline{Nu}_L=0.664\,Re_L^{1/2}Pr^{1/3}.
$$

湍流：

$$
Nu_x=0.0296\,Re_x^{0.8}Pr^{1/3},
\qquad
\overline{Nu}_L=0.037\,Re_L^{0.8}Pr^{1/3}.
$$

混合边界层（前缘层流、后段湍流）常用

$$
\overline{Nu}_L
=\left(0.037Re_L^{0.8}-871\right)Pr^{1/3},
$$

其中 $871$ 来自转捩位置修正。

### 圆柱：Churchill–Bernstein

$$
Nu_D=0.3+
\frac{0.62\,Re_D^{1/2}Pr^{1/3}}
{\left[1+\left(0.4/Pr\right)^{2/3}\right]^{1/4}}
\left[1+\left(\frac{Re_D}{282000}\right)^{5/8}\right]^{4/5},
$$

适用 $Re_DPr>0.2$，覆盖层流到湍流、低 $Pr$ 到高 $Pr$。它是圆柱绕流最常用的单式关联。

### 球与管束

球体常用 Whitaker 关系：

$$
Nu=2+\left(0.4Re^{1/2}+0.06Re^{2/3}\right)Pr^{0.4}
\left(\frac{\mu_\infty}{\mu_s}\right)^{1/4}.
$$

管束换热用 Grimison 或 Zukauskas 关联，需按排列方式（顺排/叉排）与 $Re$ 分段查表。CFD 中若直接解析管束，网格量巨大，通常用多孔介质或周期性单元近似。

## 自然对流

自然对流的驱动力是浮力，强度由 Rayleigh 数

$$
Ra=Gr\,Pr=\frac{g\beta\Delta T L^3}{\nu\alpha}
$$

决定。竖直平板自然对流的 Churchill–Chu 关联式为

$$
Nu=\left\{
0.825+
\frac{0.387\,Ra^{1/6}}
{\left[1+\left(0.492/Pr\right)^{9/16}\right]^{8/27}}
\right\}^2,
$$

适用于整块竖直平板，包括层流与湍流。水平圆柱、水平板与封闭腔各有专门关联式。

自然对流换热的量级：室内空气、$Ra\sim10^9$ 时 $Nu\sim10^2$，$h\sim5\ \mathrm{W/(m^2\cdot K)}$，远低于强制对流。这就是为什么散热器需要风扇。

## 混合对流

当自然对流与强制对流同时显著时，用 Richardson 数判断：

$$
Ri=\frac{Gr}{Re^2}.
$$

$Ri\ll1$ 强制对流主导，$Ri\gg1$ 自然对流主导，$Ri\sim1$ 必须同时考虑。工程上常用

$$
Nu^n=Nu_{forced}^n\pm Nu_{natural}^n,
$$

$n$ 取 3 左右，符号取决于浮力与流动方向一致或相反。具体指数与符号需按工况选取，不能一概而论。

## 换热强化

常见强化手段及其代价：

| 手段 | 机理 | 代价 |
| --- | --- | --- |
| 肋片/翅片 | 增大面积 | 体积、材料、流阻 |
| 螺旋槽管 | 旋转流、边界层分离 | 压降上升 |
| 内插物（扭带、线圈） | 扰流、二次流 | 压降显著上升 |
| 纳米流体 | 提高导热系数 | 稳定性、粘度上升 |
| 射流冲击 | 薄边界层 | 局部热应力 |

评价强化效果不能只看 $h$，要看**单位泵功下的换热量**。常用准则有 $Nu/Nu_0$ 与 $(f/f_0)^{1/3}$ 的比值（等泵功比较），或熵产最小化。

## CFD 中的对流换热

### 壁面热流与 $y^+$

要解析热边界层，第一层网格应满足 $y^+<1$（低 $Re$ 模型）；若用壁面函数，$y^+$ 应落在对数律区间（约 30–300），且不能跨区间。热边界层的 $y^+$ 要求与速度边界层相同，但高 $Pr$ 流体的热边界层更薄，网格需更密。

### 热壁面函数

湍流热通量的壁面函数通常写成

$$
\frac{T_w-T_P}{T_\tau}
=\frac{Pr_t}{\kappa}\ln\left(\frac{y^+}{y_0^+}\right)+P,
$$

$T_\tau=q''_w/(\rho c_p u_\tau)$ 是摩擦温度，$Pr_t$ 是湍流 Prandtl 数（常取 0.85–0.9），$P$ 是 Jayatilleke 函数。高 $Pr$ 流体（水、油）的 $P$ 项很大，壁面函数误差明显，宜用低 $Re$ 或两层模型。

### 共轭传热边界

流体侧与固体侧同时求解时，界面热流必须连续：

$$
q''_f=q''_s,
\qquad
-k_f\frac{\partial T_f}{\partial n}
=-k_s\frac{\partial T_s}{\partial n}.
$$

CFD 中若只解流体、把壁温当常数，会忽略固体内部导热，薄壁换热器的误差可达 20% 以上。

## Python 示例：管内对流关联式对比

下面的脚本对水在圆管内流动，比较 Dittus–Boelter、Sieder–Tate 与 Gnielinski 三个关联式，并给出相对偏差。

```python
import numpy as np

D = 0.02            # m
mu, rho, k, cp = 8.9e-4, 998.0, 0.60, 4180.0
Pr = mu * cp / k
mu_w = 6.5e-4       # 壁温下的粘度（示例）

def dittus_boelter(Re, heating=True):
    n = 0.4 if heating else 0.3
    return 0.023 * Re**0.8 * Pr**n

def sieder_tate(Re):
    return 0.027 * Re**0.8 * Pr**(1/3) * (mu / mu_w)**0.14

def gnielinski(Re):
    f = (0.790 * np.log(Re) - 1.64)**(-2)
    return (f / 8) * (Re - 1000) * Pr / (
        1 + 12.7 * np.sqrt(f / 8) * (Pr**(2/3) - 1))

print(f"Pr = {Pr:.2f}")
print(f"{'Re':>10} {'D-B':>10} {'S-T':>10} {'Gnielinski':>12} {'D-B偏差':>10}")
for Re in [5e3, 1e4, 5e4, 1e5, 5e5]:
    nu_db = dittus_boelter(Re)
    nu_st = sieder_tate(Re)
    nu_gn = gnielinski(Re)
    h = nu_gn * k / D
    print(f"{Re:10.0f} {nu_db:10.1f} {nu_st:10.1f} {nu_gn:12.1f} "
          f"{(nu_db/nu_gn-1)*100:9.1f}%   h={h:7.0f} W/m2K")
```

典型结果：$Re=10^4$ 时 Dittus–Boelter 与 Gnielinski 接近；$Re=10^5$ 时前者低约 16%，$Re=5\times10^5$ 时低约 24%。这说明高 $Re$ 下 Dittus–Boelter 偏保守，工程上应优先用 Gnielinski。

:::warning 关联式的“同名不同式”
同一位作者在不同年份、不同教材中可能给出略有差异的系数（例如 Dittus–Boelter 的 0.023 与 0.024）。引用时必须同时给出系数与适用区间，否则结果无法复现。工程计算应在同一份报告内保持关联式一致。
:::

## 小结

- 对流换热系数 $h$ 不是物性，而是边界层结构与流场的综合结果；$Nu=hL/k$ 才是可标度的量。
- $Pr$ 决定速度与温度边界层的相对厚度，$Pe=RePr$、$St=Nu/(RePr)$ 是常用换算。
- 管内湍流优先用 Gnielinski，Dittus–Boelter 适合快速估算，Sieder–Tate 适合物性变化大的工况。
- 外部流动用 Churchill–Bernstein（圆柱）、平板相似解与 Whitaker（球）等关联式。
- 自然对流由 $Ra$ 控制，混合对流由 $Ri$ 判断；CFD 中壁面 $y^+$ 与热壁面函数决定换热精度。

## 延伸阅读

- Incropera, F. P., DeWitt, D. P. *Fundamentals of Heat and Mass Transfer*, 7th ed. Wiley, 2011.
- Çengel, Y. A., Ghajar, A. J. *Heat and Mass Transfer*, 6th ed. McGraw-Hill, 2020.
- Kays, W. M., Crawford, M. E., Weigand, B. *Convective Heat and Mass Transfer*, 4th ed. McGraw-Hill, 2005.
- Bird, R. B., Stewart, W. E., Lightfoot, E. N. *Transport Phenomena*, 2nd ed. Wiley, 2006.

---
title: 沸腾与凝结传热
order: 4
summary: 从沸腾曲线出发，梳理核态沸腾、临界热流密度、过渡与膜态沸腾的物理机制与经典关联式，再讨论流动沸腾的分区与 Chen 关联式，以及膜状凝结的 Nusselt 解与工程修正。
tags: [沸腾, 凝结, CHF, Nusselt, Chen]
---

相变传热是多相流中最“非线性”的部分：壁面过热度增加 10 K，热流密度可能上升一个量级；再增加 10 K，却可能跨过临界热流密度（CHF），传热系数骤降、壁温飞升。沸腾与凝结的关联式几乎都是经验或半经验的，但每一个都建立在清晰的物理图像上。理解这些图像，比记住常数更重要。

## 沸腾曲线

把加热壁面的热流密度 $q''$ 对壁面过热度 $\Delta T=T_w-T_{sat}$ 作图，得到经典的**沸腾曲线**（Nukiyama 曲线）。曲线分四段：

**自然对流区**（$\Delta T\lesssim5\ \mathrm{K}$）：壁面温度略高于饱和温度，但还不足以激活汽化核心，热量靠单相自然对流带走。$q''\propto\Delta T^{5/4}$ 量级。

**核态沸腾区**（约 $5\ \mathrm{K}\lesssim\Delta T\lesssim30\ \mathrm{K}$）：壁面微坑中的残余气体成为汽化核心，气泡周期性生长、脱离。热流密度随过热度急剧上升，$q''\propto\Delta T^{3}$ 左右（Rohsenow 关联式的指数来源）。这一区又分**孤立气泡区**与**气泡相互作用区**，后者气泡合并成汽柱，传热最强。

**过渡沸腾区**（约 $30\ \mathrm{K}\lesssim\Delta T\lesssim100\ \mathrm{K}$）：气泡合并成不稳定汽膜，局部干涸与润湿交替，热流密度随过热度**下降**。这是负反馈区，恒热流加热时壁温会跳跃，工程上必须避开。

**膜态沸腾区**（$\Delta T\gtrsim100\ \mathrm{K}$）：壁面被连续汽膜覆盖，热量先经导热穿过汽膜，再在汽膜界面蒸发。热流密度重新随 $\Delta T$ 上升，但传热系数很低。辐射在高温时不可忽略。

| 区域 | $\Delta T$ 量级（水，1 atm） | $q''$ 量级 | 传热机制 |
| --- | --- | --- | --- |
| 自然对流 | < 5 K | < 10 kW/m² | 单相自然对流 |
| 核态沸腾 | 5–30 K | 10 kW/m² – 1 MW/m² | 汽化核心、气泡扰动 |
| 过渡沸腾 | 30–100 K | 下降 | 不稳定汽膜 |
| 膜态沸腾 | > 100 K | 重新上升 | 汽膜导热 + 辐射 |

**临界热流密度**（CHF，又称烧毁点 burnout）是核态沸腾的峰值，水在常压下约 $1.1\ \mathrm{MW/m^2}$。**最小热流密度**（Leidenfrost 点）是膜态沸腾的下限，约为 CHF 的 0.09 倍。

:::warning 恒热流与恒壁温
在恒壁温加热下，跨越 CHF 后壁温连续变化；在恒热流加热（如电加热、核燃料棒）下，一旦 $q''$ 超过 CHF，壁温会沿过渡沸腾的负斜率段跳跃到膜态沸腾对应的高温，可能瞬间烧毁。工程判断必须区分这两种边界条件。
:::

## 核态沸腾关联式

### Rohsenow 关联式

Rohsenow（1952）把核态沸腾的热流密度写成

$$
q''=\mu_l h_{fg}\left[\frac{g(\rho_l-\rho_g)}{\sigma}\right]^{1/2}
\left[\frac{c_{p,l}\Delta T_e}{C_{sf}\,h_{fg}\,Pr_l^{\,n}}\right]^{3},
$$

其中 $\Delta T_e=T_w-T_{sat}$ 是壁面过热度，$C_{sf}$ 与 $n$ 是工质-壁面组合的经验常数。对水-铜表面，常用 $C_{sf}=0.013$、$n=1.0$；对有机工质，$n$ 常取 1.7 左右。$C_{sf}$ 对表面粗糙度与氧化状态极其敏感，同一工质不同表面的取值可相差数倍。

反解出过热度：

$$
\Delta T_e=\frac{C_{sf}h_{fg}Pr_l^{\,n}}{c_{p,l}}
\left[\frac{q''}{\mu_l h_{fg}}\right]^{1/3}
\left[\frac{\sigma}{g(\rho_l-\rho_g)}\right]^{1/6}.
$$

这条式子的实用价值在于：给定热流密度，可以直接估出壁温，用于结构热应力与材料选择。

### Forster–Zuber 关联式

Forster 与 Zuber（1955）从气泡边界层的蒸发出发，得到

$$
h_{nb}=0.00122\,
\frac{k_l^{0.79}c_{p,l}^{0.45}\rho_l^{0.49}g^{0.25}}
{\sigma^{0.5}\mu_l^{0.29}h_{fg}^{0.24}\rho_g^{0.24}}
\Delta T^{0.24}\Delta p_{sat}^{0.75},
$$

其中 $\Delta p_{sat}=p_{sat}(T_w)-p_{sat}(T_{sat})$ 由 Clausius–Clapeyron 关系给出。它是 Chen 流动沸腾关联式中核态沸腾分量的来源。

### Cooper 关联式

Cooper（1984）给出一个只依赖对比压力与分子量的形式：

$$
h=55\,p_r^{0.12}\left(-\log_{10}p_r\right)^{-0.55}M^{-0.5}q''^{0.67},
$$

$p_r=p/p_c$ 是对比压力，$M$ 是分子量（kg/kmol），$q''$ 单位 W/m²。它特别适合制冷剂，在缺少表面信息时比 Rohsenow 更稳健。

## 临界热流密度

Zuber（1959）用 Taylor 不稳定波长与汽膜内两相流动的平衡，得到池沸腾 CHF：

$$
q''_{max}=0.131\,\rho_g h_{fg}
\left[\frac{\sigma g(\rho_l-\rho_g)}{\rho_g^2}\right]^{1/4}.
$$

Kutateladze 给出的常数为 0.149，两者只差约 14%，都属于同一量级估算。代入水在 1 atm 的物性，可得 $q''_{max}\approx1.1\ \mathrm{MW/m^2}$，与实验吻合。

CHF 随压力变化显著：低压时气泡体积大、易形成汽膜，CHF 较低；接近临界压力时表面张力趋于零，CHF 也下降。工程上还有**偏离核态沸腾**（DNB）与**干涸**（dryout）两种不同的临界现象：前者发生在高热流密度、低干度的池沸腾或过冷沸腾，后者发生在环状流液膜被蒸干。

## 膜态沸腾

对水平圆柱外的膜态沸腾，Bromley（1950）给出

$$
h=0.62\left[
\frac{k_g^3\rho_g(\rho_l-\rho_g)g\left(h_{fg}+0.4c_{p,g}\Delta T\right)}
{\mu_g D\,\Delta T}
\right]^{1/4},
$$

其中 $h_{fg}+0.4c_{p,g}\Delta T$ 是考虑汽膜显热的修正潜热，$D$ 是圆柱直径。高温时需叠加辐射换热：

$$
h_{total}=h_{conv}+\frac{3}{4}h_{rad},
$$

系数 $3/4$ 来自辐射与对流并联时的近似处理，并非严格叠加。

## 流动沸腾的分区

管内流动沸腾比池沸腾复杂，因为干度沿程变化。按干度从负到正，依次经历：

**过冷沸腾（subcooled boiling）**：主流温度低于 $T_{sat}$，但壁温已超过 $T_{sat}$，壁面附近产生气泡。分**局部过冷**与**显著过冷**两段，后者净蒸汽开始产生（ONB，onset of nucleate boiling）。

**饱和核态沸腾（saturated nucleate boiling）**：主流达到饱和，干度为正，壁面核态沸腾主导。传热系数随热流密度上升。

**两相对流沸腾（two-phase forced convection）**：干度较高、流速较大时，液膜被高速气芯剪切减薄，对流蒸发主导，传热系数主要随质量通量上升。

**干涸与雾状流（dryout / mist flow）**：液膜被蒸干或撕裂，壁面间歇润湿，传热系数骤降。这是蒸发器最危险的区域。

### Chen 关联式

Chen（1966）把流动沸腾的传热系数写成两部分之和：

$$
h_{tp}=h_{mac}+h_{mic}=F\,h_{lo}+S\,h_{nb},
$$

- $h_{lo}$：全液相（总质量流量全部为液）按 Dittus–Boelter 算出的对流换热系数；
- $h_{nb}$：Forster–Zuber 核态沸腾系数；
- $F$：**增强因子**，反映两相速度提高带来的对流增强；
- $S$：**抑制因子**，反映气泡被对流带走、核态沸腾被削弱。

Chen 给出的封闭关系为

$$
F=2.35\left(\frac{1}{X_{tt}}+0.213\right)^{0.736},
$$

当 $X_{tt}\ge10$ 时取 $F=1$。

$$
S=\frac{1}{1+2.53\times10^{-6}\,Re_{tp}^{1.17}},
\qquad
Re_{tp}=Re_l F^{1.25},
$$

$X_{tt}$ 是 Martinelli 参数（见 [[multiphase/two-phase-momentum|两相流动量方程与压降]]）。Chen 关联式适用于垂直管内的饱和流动沸腾，对过冷沸腾需另加修正。

| 关联式 | 对象 | 关键参数 | 适用工质 |
| --- | --- | --- | --- |
| Rohsenow | 池核态沸腾 | $C_{sf}$、$n$ | 水、有机工质 |
| Forster–Zuber | 核态沸腾分量 | $\Delta T$、$\Delta p_{sat}$ | 通用 |
| Cooper | 池沸腾 | $p_r$、$M$、$q''$ | 制冷剂 |
| Chen | 流动沸腾 | $X_{tt}$、$Re_{tp}$ | 水、制冷剂 |
| Bromley | 膜态沸腾 | $D$、$\Delta T$ | 通用 |

## 凝结传热

### Nusselt 膜状凝结解

Nusselt（1916）对竖直壁面上的层流膜状凝结做了经典分析：假设液膜连续、层流、界面无剪切、汽相静止、液膜内导热主导。得到局部换热系数

$$
h(z)=\left[\frac{\rho_l(\rho_l-\rho_g)g\,h_{fg}'k_l^3}{4\mu_l\Delta T\,z}\right]^{1/4},
$$

沿高度 $L$ 的平均值为

$$
h=0.943\left[
\frac{\rho_l(\rho_l-\rho_g)g\,h_{fg}'k_l^3}
{\mu_l\Delta T\,L}
\right]^{1/4},
$$

其中修正潜热 $h_{fg}'=h_{fg}+0.68c_{p,l}\Delta T$，用于考虑液膜过冷。水平圆管外凝结的平均系数为

$$
h=0.729\left[
\frac{\rho_l(\rho_l-\rho_g)g\,h_{fg}'k_l^3}
{\mu_l\Delta T\,D}
\right]^{1/4},
$$

注意常数从 0.943 变为 0.729，特征是长度从 $L$ 变为 $D$。

### 液膜流态与修正

液膜雷诺数定义为

$$
Re_\delta=\frac{4\Gamma}{\mu_l},
\qquad
\Gamma=\frac{\dot m_l}{\pi D}.
$$

$\Gamma$ 是管外单位周长上的液膜质量流量。经验分区大致为：$Re_\delta<30$ 为无波层流，$30<Re_\delta<1800$ 为波状层流，$Re_\delta>1800$ 为湍流。波状与湍流区传热系数高于 Nusselt 解，需要乘修正系数；具体数值随工质与壁面条件变化，工程上常查手册曲线。

### 滴状凝结

当冷凝表面经过低表面能处理（如镀聚四氟乙烯、注入非润湿涂层），凝结液以离散液滴形式形成并脱落，传热系数可比膜状凝结高 5–10 倍。滴状凝结的稳定性是工程难点：涂层老化、氧化或蒸汽中含油都会使其退化为膜状。

:::note 不凝性气体的影响
蒸汽中混入少量空气（哪怕 1%）就会在液膜界面富集，形成扩散边界层，使凝结传热系数下降 30%–60%。这就是电站凝汽器必须抽真空的原因。CFD 模拟凝结时必须把不凝性气体作为独立组分输运，不能只用单相蒸汽。
:::

## 相变传热的无量纲数

| 无量纲数 | 定义 | 物理含义 |
| --- | --- | --- |
| Jakob 数 $Ja$ | $c_{p,l}\Delta T/h_{fg}$ | 显热与潜热之比，决定气泡生长速度 |
| 沸腾数 $Bo$ | $q''/(G h_{fg})$ | 壁面热流对应的蒸发份额 |
| Weber 数 $We$ | $G^2D/(\rho_l\sigma)$ | 惯性力与表面张力之比 |
| Capillary 数 $Ca$ | $\mu_l j_l/\sigma$ | 粘性力与表面张力之比 |
| 过冷度 $Ja$ 变体 | $\rho_lc_{p,l}\Delta T/(\rho_g h_{fg})$ | 过冷沸腾中气泡层的热容量比 |

$Ja$ 越大，同样的过热度能产生更多蒸汽，气泡生长越快；$Bo$ 越大，沿程干度上升越快，越容易提前进入干涸。

## Python 示例：水的池沸腾曲线

下面的脚本用 Rohsenow 关联式画核态沸腾段，用 Zuber 公式标出 CHF，用 Bromley 公式估膜态沸腾，形成一条完整的数量级曲线。

```python
import numpy as np
import matplotlib.pyplot as plt

# 水在 1 atm 的饱和物性
rho_l, rho_g = 957.0, 0.597
mu_l = 2.82e-4          # 饱和水动力粘度 Pa·s
cp_l = 4.30e3           # J/(kg·K)
k_l = 0.68              # W/(m·K)
h_fg = 2.257e6          # J/kg
sigma = 0.0589          # N/m
Pr_l = mu_l * cp_l / k_l
g = 9.81

def q_rohsenow(dT, Csf=0.013, n=1.0):
    return (mu_l * h_fg * np.sqrt(g * (rho_l - rho_g) / sigma) *
            (cp_l * dT / (Csf * h_fg * Pr_l**n))**3)

def q_chf():
    return 0.131 * rho_g * h_fg * (sigma * g * (rho_l - rho_g) / rho_g**2)**0.25

dT = np.linspace(1, 40, 200)
q_nb = q_rohsenow(dT)
q_max = q_chf()

print(f"CHF ≈ {q_max/1e6:.2f} MW/m2")
for T in [5, 10, 20, 30]:
    print(f"ΔT={T:2d} K, Rohsenow q''={q_rohsenow(T)/1e3:8.1f} kW/m2")

plt.figure(figsize=(6, 4))
plt.loglog(dT, q_nb, label="nucleate boiling (Rohsenow)")
plt.axhline(q_max, color="r", ls="--", label="CHF (Zuber)")
plt.xlabel(r"$\Delta T$ (K)")
plt.ylabel(r"$q''$ (W/m$^2$)")
plt.legend()
plt.grid(True, which="both", alpha=0.3)
plt.tight_layout()
plt.show()
```

脚本能复现两个事实：核态沸腾热流随过热度约三次方增长；水在常压的 CHF 在 1 MW/m² 量级。若把 $C_{sf}$ 从 0.013 改到 0.006，曲线整体右移，说明表面状态对沸腾起始点影响很大。

:::tip 关联式选用顺序
有实验数据时优先用实验；没有时按工质选关联式：水用 Rohsenow 或 Chen，制冷剂用 Cooper 或 Shah，膜态沸腾用 Bromley。任何关联式都要检查适用压力、干度与热流范围，超出范围时只当作数量级估计。
:::

## 小结

- 沸腾曲线分自然对流、核态沸腾、过渡沸腾、膜态沸腾四段，CHF 是核态沸腾的峰值，也是恒热流加热的安全边界。
- Rohsenow 用 $C_{sf}$、$n$ 概括表面与工质组合，Forster–Zuber 与 Cooper 分别适合通用与制冷剂工况。
- 流动沸腾按干度分区，Chen 关联式用增强因子 $F$ 与抑制因子 $S$ 把对流与核态沸腾叠加。
- 膜状凝结的 Nusselt 解给出 $h\propto\Delta T^{-1/4}L^{-1/4}$，滴状凝结可高出一个量级但不稳定。
- 不凝性气体、干涸与表面老化是工程偏差的主要来源，CFD 必须显式建模。

## 延伸阅读

- Incropera, F. P., DeWitt, D. P. *Fundamentals of Heat and Mass Transfer*, 7th ed. Wiley, 2011.
- Çengel, Y. A., Ghajar, A. J. *Heat and Mass Transfer*, 6th ed. McGraw-Hill, 2020.
- Ishii, M., Hibiki, T. *Thermo-Fluid Dynamics of Two-Phase Flow*, 2nd ed. Springer, 2006.
- Hewitt, G. F., Hall-Taylor, N. S. *Annular Two-Phase Flow*. Pergamon Press, 1970.

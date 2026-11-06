---
title: 换热器与 CFD 耦合
order: 5
summary: 从换热器的 LMTD 与 ε-NTU 两种设计方法出发，讨论总传热系数、污垢热阻与泵功，再讲清周期性单元、共轭传热、多孔介质与集管分配等 CFD 建模策略及验证方法。
tags: [换热器, LMTD, ε-NTU, 共轭传热]
---

换热器是热力系统的心脏：锅炉、冷凝器、蒸发器、散热器、回热器，本质上都是一段被安排好的传热表面。CFD 在换热器设计中的角色有两层：一是**校核**，用三维流场解释为什么实测传热系数低于关联式；二是**优化**，在给定泵功下寻找更好的翅片形状、管排布与集管结构。

## 换热器类型与性能参数

| 类型 | 结构 | 典型应用 | 特点 |
| --- | --- | --- | --- |
| 管壳式 | 管束 + 壳体 + 折流板 | 电站、化工 | 耐高压，易清洗 |
| 板式 | 波纹板片叠装 | 暖通、食品 | 紧凑，$U$ 高，压降大 |
| 板翅式 | 翅片 + 隔板 | 航空、低温 | 单位体积面积大 |
| 套管式 | 两同心管 | 实验、小型 | 逆流，简单 |
| 螺旋板式 | 双螺旋通道 | 高粘度流体 | 自清洁，压降适中 |

核心性能参数有三个：**总传热系数 $U$**、**传热面积 $A$**、**压降 $\Delta p$**。前两者决定换热量，第三者决定泵功。三者互相制约：提高流速能增大 $U$，但压降按 $G^2$ 上升。

## 总传热系数与热阻

对管壁两侧的换热，

$$
\frac{1}{UA}
=\frac{1}{h_hA_h}
+\frac{R_{f,h}}{A_h}
+\frac{\ln(D_o/D_i)}{2\pi kL}
+\frac{R_{f,c}}{A_c}
+\frac{1}{h_cA_c},
$$

$R_f$ 是污垢热阻（fouling resistance），$A_h$、$A_c$ 分别是热侧与冷侧的换热面积。对翅片管，$A$ 要乘以翅片效率 $\eta_f$ 与表面效率 $\eta_o$。

污垢是换热器性能衰减的主因：运行数月后，$R_f$ 可能使 $U$ 下降 20%–40%。CFD 很难直接模拟污垢生长，通常用经验污垢曲线或定期清洗策略处理。

## LMTD 方法

对逆流或顺流换热器，沿程温差按指数变化。定义对数平均温差

$$
\Delta T_{lm}=\frac{\Delta T_1-\Delta T_2}
{\ln\left(\Delta T_1/\Delta T_2\right)},
$$

$\Delta T_1$、$\Delta T_2$ 是两端冷热流体的温差。换热量为

$$
Q=UA\,\Delta T_{lm}.
$$

对逆流：

$$
\Delta T_1=T_{h,in}-T_{c,out},
\qquad
\Delta T_2=T_{h,out}-T_{c,in}.
$$

对顺流：

$$
\Delta T_1=T_{h,in}-T_{c,in},
\qquad
\Delta T_2=T_{h,out}-T_{c,out}.
$$

逆流的 $\Delta T_{lm}$ 总是大于顺流，因此在相同 $UA$ 下换热量更大。这也是换热器尽量按逆流布置的原因。

对叉流、多管程等复杂布置，引入修正因子

$$
Q=UA\,F\,\Delta T_{lm,cf},
$$

$F<1$ 由布置与 $P$、$R$ 两个无量纲参数查图确定：

$$
P=\frac{T_{c,out}-T_{c,in}}{T_{h,in}-T_{c,in}},
\qquad
R=\frac{T_{h,in}-T_{h,out}}{T_{c,out}-T_{c,in}}.
$$

$F$ 低于 0.8 时通常说明布置不合理，应改用多管程或逆流。

## ε-NTU 方法

当出口温度未知时，LMTD 需要迭代。ε-NTU 方法把问题改写为无量纲形式，直接给出换热量。

定义热容量流率

$$
C_h=\dot m_hc_{p,h},
\qquad
C_c=\dot m_cc_{p,c},
$$

$$
C_{min}=\min\left(C_h,C_c\right),
\qquad
C_{max}=\max\left(C_h,C_c\right),
\qquad
C_r=\frac{C_{min}}{C_{max}}.
$$

最大可能换热量为

$$
Q_{max}=C_{min}\left(T_{h,in}-T_{c,in}\right).
$$

实际换热量为

$$
Q=\varepsilon\,Q_{max},
$$

其中**效能** $\varepsilon$ 由传热单元数

$$
NTU=\frac{UA}{C_{min}}
$$

与 $C_r$ 决定。

对逆流：

$$
\varepsilon=\frac{1-\exp\left[-NTU\left(1-C_r\right)\right]}
{1-C_r\exp\left[-NTU\left(1-C_r\right)\right]}.
$$

对顺流：

$$
\varepsilon=\frac{1-\exp\left[-NTU\left(1+C_r\right)\right]}
{1+C_r}.
$$

$C_r=0$（一侧相变，如冷凝器、蒸发器）时，两种布置都退化为

$$
\varepsilon=1-e^{-NTU}.
$$

| 布置 | $\varepsilon$ 表达式 | 备注 |
| --- | --- | --- |
| 逆流 | 上式 | 效率最高 |
| 顺流 | 上式 | 效率较低 |
| 单管程叉流 | 近似式 | 需查表 |
| 相变 | $1-e^{-NTU}$ | $C_r=0$ |

ε-NTU 的优势是无需迭代：给定 $UA$、进出口温度中的任意三个，就能直接算出第四个。

## 压降与泵功

换热器压降由沿程摩擦与局部阻力组成：

$$
\Delta p=f\frac{L}{D_h}\frac{G^2}{2\rho}
+\sum K\frac{G^2}{2\rho}.
$$

泵功为

$$
P_{pump}=\frac{\Delta p\,\dot V}{\eta},
$$

$\eta$ 是泵效率。比较不同强化方案时，常用**等泵功约束**：在相同 $P_{pump}$ 下比较换热量，而不是在相同流量下比较 $h$。

常用的性能评价指标是**面积 goodness factor** 与 **j/f 比**：

$$
j_H=St\,Pr^{2/3},
\qquad
\frac{j_H}{f}.
$$

$j/f$ 越大，说明单位摩擦代价换来的换热越多。翅片越密，$j$ 与 $f$ 同时上升，但 $j/f$ 往往下降，因此存在最优翅片间距。

## 换热器 CFD 建模

### 周期性单元

完整换热器包含数百根管、数千个翅片，直接建模不现实。常用**周期性单元**：取一个管间距或一个翅片通道，施加周期性边界：

$$
\phi\left(\mathbf{x}+\mathbf{L}\right)=\phi\left(\mathbf{x}\right),
$$

并在流向施加**流线周期性**（streamwise periodic）条件，即允许压力线性下降而温度/速度剖面重复：

$$
p\left(\mathbf{x}+\mathbf{L}\right)=p\left(\mathbf{x}\right)-\Delta p,
\qquad
T\left(\mathbf{x}+\mathbf{L}\right)=T\left(\mathbf{x}\right)+\Delta T.
$$

这样一个小单元就能代表整个换热器，计算量降低两三个数量级。

### 共轭传热

换热器 CFD 必须同时解流体与固体：

- 流体侧解 N-S + 能量；
- 固体侧解导热；
- 界面满足温度与热流连续。

若忽略固体导热（把壁温设为常数），翅片效率被高估，换热量偏大。薄壁与高导热材料（铜、铝）的共轭效应尤其明显。

### 多孔介质近似

对翅片密集、通道细小的紧凑式换热器，可把翅片区当作各向异性多孔介质：

$$
\frac{\partial(\rho\mathbf{u})}{\partial t}
+\nabla\cdot(\rho\mathbf{u})=0,
$$

$$
\rho\frac{\mathrm{D}\mathbf{u}}{\mathrm{D}t}
=-\nabla p+\nabla\cdot\left(\mu\nabla\mathbf{u}\right)
-\frac{\mu}{K}\mathbf{u}
-\frac{C_F\rho}{\sqrt{K}}\left|\mathbf{u}\right|\mathbf{u},
$$

$K$ 是渗透率，$C_F$ 是 Forchheimer 系数。它们由细观 CFD 或实验标定。多孔介质模型能大幅降低网格量，但无法解析翅片尾迹与局部热点。

### 集管与流量分配

换热器性能不仅取决于管束，还取决于**集管分配均匀性**。分配不均会导致部分管子过冷、部分管子过热，整体效能下降。集管 CFD 需要解三维湍流，重点关注：

- 入口射流是否直接冲击第一排管；
- 集管截面积与管束面积之比；
- 分配孔板与导流结构。

### 相变换热器

冷凝器与蒸发器的 CFD 更复杂：涉及两相流型、相变潜热、液膜与不凝性气体。常用做法是：

- 管内冷凝/蒸发用一维或两流体模型标定 $h$ 与 $\Delta p$；
- 壳侧用多孔介质或分布参数模型；
- 整体用 ε-NTU 与 CFD 分层耦合。

## 验证与不确定度

换热器 CFD 的验证至少包括：

1. **能量平衡**：热侧放热 = 冷侧吸热（误差 < 2%）；
2. **$UA$ 校核**：由 CFD 得到的 $h$ 反算 $UA$，与 ε-NTU 或实验对比；
3. **压降校核**：与 Darcy–Weisbach 或实验关联式对比；
4. **网格无关性**：$Nu$ 与 $f$ 随网格加密的变化小于 2%；
5. **湍流模型敏感性**：$k$-$\varepsilon$、$k$-$\omega$ SST、雷诺应力模型的差异。

只对照温度云图不能算验证。工程报告应给出 $Nu$、$f$、$j/f$ 的定量对比表。

## Python 示例：LMTD 选型与 ε-NTU 校核

下面的脚本对一个逆流换热器做选型：已知换热量与四个温度，求所需 $UA$；再用 ε-NTU 反算效能，验证两种方法一致；最后估算泵功。

```python
import numpy as np

mdot_h, cp_h = 2.0, 4180.0      # 热侧水
mdot_c, cp_c = 3.0, 4180.0      # 冷侧水
Th_in, Th_out = 90.0, 60.0
Tc_in, Tc_out = 20.0, 40.0

Q = mdot_h * cp_h * (Th_in - Th_out)
C_h = mdot_h * cp_h
C_c = mdot_c * cp_c
C_min, C_max = min(C_h, C_c), max(C_h, C_c)
Cr = C_min / C_max

# LMTD（逆流）
dT1 = Th_in - Tc_out
dT2 = Th_out - Tc_in
dTlm = (dT1 - dT2) / np.log(dT1 / dT2)
UA = Q / dTlm

# ε-NTU 校核
eps = Q / (C_min * (Th_in - Tc_in))
NTU = UA / C_min
eps_theory = (1 - np.exp(-NTU * (1 - Cr))) / (
    1 - Cr * np.exp(-NTU * (1 - Cr)))

print(f"Q = {Q/1e3:.1f} kW")
print(f"ΔTlm = {dTlm:.2f} K, UA = {UA:.1f} W/K")
print(f"NTU = {NTU:.3f}, Cr = {Cr:.3f}")
print(f"ε(由温度) = {eps:.3f}, ε(由NTU) = {eps_theory:.3f}")

# 泵功估算：假设冷侧体积流量与压降
Vdot = mdot_c / 998.0
dp = 20e3
eta = 0.7
P = dp * Vdot / eta
print(f"冷侧泵功 ≈ {P:.1f} W（Δp={dp/1e3:.0f} kPa）")
```

两个 $\varepsilon$ 应一致到小数点后三位，这是 LMTD 与 ε-NTU 互为校核的意义。若不一致，通常说明温差端点取反（顺流/逆流混淆）或 $C_{min}$ 选错。

:::warning 相变换热器的 $C_r$
冷凝器与蒸发器中一侧发生相变，温度基本不变，此时 $C_r=0$，$\varepsilon=1-e^{-NTU}$。但如果把相变侧的热容量流率按显热 $c_p$ 计算，会得到错误的 $C_r$。正确做法是把相变侧视为“无限大热容量”，或用潜热折算。
:::

## 换热器 CFD 的工作流

1. **确定尺度**：整机、管束单元、单通道还是翅片单元？
2. **选模型**：单相湍流、共轭传热、多孔介质还是两流体？
3. **建网格**：壁面 $y^+$ 满足所选湍流模型；翅片前缘与尾迹加密。
4. **设边界**：入口质量流量或速度、出口压力、壁面热流或耦合温度。
5. **求解**：先稳态、后瞬态；先单相、后相变。
6. **后处理**：$Nu$、$f$、$j/f$、温度均匀性、压降。
7. **验证**：能量平衡、关联式对比、网格无关性。

这条流程与 [[thermo/convection|对流换热与边界层]]、[[thermo/conduction|导热与傅里叶定律]] 的内容一一对应：前者提供 $h$ 的标度，后者提供固体侧的热阻。

## 小结

- 换热器性能由 $U$、$A$、$\Delta p$ 三者共同决定，强化传热必然伴随压降上升。
- LMTD 适合已知四个温度求面积；ε-NTU 适合已知 $UA$ 求换热量，相变时 $C_r=0$。
- 总传热系数是串联热阻的倒数，污垢热阻与翅片效率是工程偏差的主要来源。
- CFD 常用周期性单元、共轭传热与多孔介质近似，集管分配与相变是难点。
- 验证必须做能量平衡、$UA$ 校核、压降校核与网格无关性，云图不能代替定量对比。

## 延伸阅读

- Incropera, F. P., DeWitt, D. P. *Fundamentals of Heat and Mass Transfer*, 7th ed. Wiley, 2011.
- Çengel, Y. A., Ghajar, A. J. *Heat and Mass Transfer*, 6th ed. McGraw-Hill, 2020.
- Kays, W. M., Crawford, M. E., Weigand, B. *Convective Heat and Mass Transfer*, 4th ed. McGraw-Hill, 2005.
- Patankar, S. V. *Numerical Heat Transfer and Fluid Flow*. Hemisphere, 1980.

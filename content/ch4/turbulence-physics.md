---
title: 湍流统计与能量级串
order: 1
summary: 从雷诺分解与平均法则出发，定义湍动能、雷诺应力、湍流强度与耗散率，再通过能谱与 Kolmogorov 尺度描述能量级串，最后给出 CFD 后处理中统计量的计算方式。
tags: [湍流统计, 雷诺应力, 能量级串, 能谱, Kolmogorov]
---

湍流的第一课不是“怎么算”，而是“怎么描述”。瞬时速度场 $u_i(\mathbf{x},t)$ 在湍流中高度不规则，任何一次采样都无法复现；但它的低阶统计矩却相当稳定。所有湍流模型——无论是 RANS 的涡粘还是 LES 的亚格子应力——都是在这套统计语言里写出来的。这一节把必要的定义一次讲清。

## 雷诺分解与平均法则

把瞬时速度拆成平均值与脉动两部分，称为**雷诺分解**：

$$
u_i(\mathbf{x},t)=\langle u_i\rangle(\mathbf{x},t)+u_i'(\mathbf{x},t),
\qquad \langle u_i'\rangle=0.
$$

这里的 $\langle\cdot\rangle$ 既可以表示系综平均（同一实验重复多次），也可以表示时间平均（在统计定常下两者等价）。对密度变化的可压缩流动，通常改用 Favre 密度加权平均，本节先讨论不可压情形。

平均算子要满足几条基本法则，否则推导平均方程时会出错：

| 法则 | 表达式 | 说明 |
| --- | --- | --- |
| 线性性 | $\langle aA+bB\rangle=a\langle A\rangle+b\langle B\rangle$ | 常数可提出 |
| 与导数交换 | $\langle\partial_t A\rangle=\partial_t\langle A\rangle$ | 要求平均区间与求导尺度分离 |
| 二次平均 | $\langle\langle A\rangle\rangle=\langle A\rangle$ | 平均值本身是确定量 |
| 脉动项 | $\langle\langle A\rangle B'\rangle=0$ | 平均量与脉动不相关 |
| 乘积 | $\langle AB\rangle=\langle A\rangle\langle B\rangle+\langle A'B'\rangle$ | 多出的二阶项是封闭问题的根源 |

最后一条最关键：平均后的对流项会产生 $\langle u_i'u_j'\rangle$，它不是平均场的函数，无法由已知量算出。

:::note 三种“定常”
工程文献里说“定常湍流”，指的是统计定常（$\partial_t\langle u_i\rangle=0$），而不是瞬时场不变。同样，“均匀湍流”指统计量不随空间位置变化，“各向同性”指统计量对旋转反射不变。这三个假设决定了能谱的形式，也决定了模型能否简化。
:::

## 湍动能、雷诺应力与湍流强度

**湍动能**（turbulent kinetic energy）定义为单位质量脉动动能的平均值：

$$
k=\frac{1}{2}\langle u_i'u_i'\rangle
=\frac{1}{2}\left(\langle u'^2\rangle+\langle v'^2\rangle+\langle w'^2\rangle\right).
$$

它的量纲是 $\mathrm{m^2/s^2}$，是 RANS 方程里出现频率最高的标量。

**雷诺应力张量**定义为脉动速度的二阶矩：

$$
R_{ij}=\langle u_i'u_j'\rangle
=\begin{pmatrix}
\langle u'^2\rangle & \langle u'v'\rangle & \langle u'w'\rangle\\
\langle v'u'\rangle & \langle v'^2\rangle & \langle v'w'\rangle\\
\langle w'u'\rangle & \langle w'v'\rangle & \langle w'^2\rangle
\end{pmatrix}.
$$

它是对称的（$R_{ij}=R_{ji}$），因此只有六个独立分量；其迹的一半正好是 $k$。注意它是**应力除以密度**的量纲（$\mathrm{m^2/s^2}$），乘以 $-\rho$ 才是动量方程中的应力项。

**湍流强度**是工程中最常用的单点指标：

$$
Tu=\frac{\sqrt{\frac{2}{3}k}}{U_\infty},
$$

其中 $U_\infty$ 是来流平均速度。风洞实验常报告 $Tu$ 的百分数；若三个方向的脉动近似各向同性，也可写成 $\sqrt{\langle u'^2\rangle}/U_\infty$。

**耗散率** $\varepsilon$ 表示湍动能被粘性剪切转化为内能的速率：

$$
\varepsilon=2\nu\langle s_{ij}'s_{ij}'\rangle,
\qquad
s_{ij}'=\frac{1}{2}\left(\frac{\partial u_i'}{\partial x_j}+\frac{\partial u_j'}{\partial x_i}\right),
$$

其中 $\nu=\mu/\rho$ 是运动粘度，$s_{ij}'$ 是脉动变形率张量。$\varepsilon$ 的量纲是 $\mathrm{m^2/s^3}$，它与 $k$ 一起构成了 RANS 两方程模型的两个基本变量。

## 能量级串与能谱

湍流被视为“大涡不断破碎成小涡”的级串过程。能量从含能尺度注入，逐级传递，最终在 Kolmogorov 尺度上被粘性耗散。统计上，这一过程由**能谱** $E(k)$ 描述：$k$ 是波数（单位长度的倒数），$E(k)\,\mathrm{d}k$ 是波数区间内单位质量的动能。

对**各向同性湍流**，能谱满足归一化关系

$$
\int_0^\infty E(k)\,\mathrm{d}k=k.
$$

在惯性子区（既远离含能尺度、又远离耗散尺度），能量只传递不耗散，Kolmogorov 用量纲分析得到著名的 $-5/3$ 律：

$$
E(k)=C_K\,\varepsilon^{2/3}k^{-5/3},
$$

其中 $C_K\approx1.5$ 是 Kolmogorov 常数。这条直线在双对数坐标上斜率固定，是判断 LES/DNS 结果是否“像湍流”的第一道检查。

含能尺度与耗散尺度同时给出时，可以得到三个 Kolmogorov 微尺度：

$$
\eta=\left(\frac{\nu^3}{\varepsilon}\right)^{1/4},\qquad
u_\eta=(\nu\varepsilon)^{1/4},\qquad
\tau_\eta=\left(\frac{\nu}{\varepsilon}\right)^{1/2},
$$

其中 $\eta$ 是长度尺度，$u_\eta$ 是速度尺度，$\tau_\eta$ 是时间尺度。它们是 DNS 网格与时间步的标尺，也是理解“为什么高雷诺数算不动”的出发点。

| 尺度 | 定义 | 物理含义 |
| --- | --- | --- |
| 积分尺度 $L$ | $L=\dfrac{1}{k}\displaystyle\int_0^\infty \dfrac{E(k)}{k}\,\mathrm{d}k$ | 含能大涡的尺度，与几何尺寸同量级 |
| Taylor 微尺度 $\lambda$ | $\lambda=\sqrt{\dfrac{15\nu k}{\varepsilon}}$ | 介于大涡与耗散之间的尺度，用于定义 Taylor 雷诺数 |
| Kolmogorov 尺度 $\eta$ | $\eta=(\nu^3/\varepsilon)^{1/4}$ | 最小耗散尺度 |
| 涡翻转时间 $T_L$ | $T_L=k/\varepsilon$ | 大涡的特征时间 |

由这些尺度可以定义两个常用的雷诺数：$Re_L=u'L/\nu$ 与 $Re_\lambda=u'\lambda/\nu$。经验上 $Re_\lambda$ 从 $10^2$ 增长到 $10^3$ 时，DNS 成本增加约两个数量级。

## 各向异性与生成机制

真实流动几乎不是各向同性的。剪切使脉动在某方向上被拉伸，壁面则直接压制法向脉动。工程上用**各向异性张量**衡量偏离程度：

$$
b_{ij}=\frac{R_{ij}}{2k}-\frac{1}{3}\delta_{ij},
$$

它的第二、第三不变量把湍流状态画在 Lumley 三角图上，可以区分一维、二维与三维湍流，常用于检验 RANS 模型是否回到真实的可实现域。

湍动能的**生成项**来自雷诺应力对平均剪切的做功：

$$
P_k=-\langle u_i'u_j'\rangle\frac{\partial U_i}{\partial x_j},
$$

其中 $U_i=\langle u_i\rangle$ 是平均速度。在平板边界层中，$P_k\approx-\langle u'v'\rangle\,\partial U/\partial y$，只有 $\langle u'v'\rangle$ 与法向剪切同时非零才有能量注入。这个乘积在缓冲层（$y^+\approx15$）达到峰值，是 RANS 模型最难复现的区域，也是壁面函数与低 Re 修正分歧的焦点。存在浮力时再加一项

$$
G_k=-\frac{g_i}{\rho}\langle\rho'u_i'\rangle,
$$

即浮力生成（或耗散）。热分层流动中，稳定分层会让 $G_k<0$，抑制湍流。

:::tip 快速畸变
当平均剪切的作用时间远短于湍流自身的翻转时间时，脉动来不及响应，雷诺应力的演化可以用线性化的**快速畸变理论**（RDT）预测。它不适用于充分发展的湍流，但能解释为什么强顺压梯度会“压扁”湍流结构。
:::

## 后处理中的统计计算

数值结果给的是瞬时场，统计量需要自己算。设采样序列为 $u^{(n)}$（$n=1,\dots,N$，等时间间隔），时间平均与脉动为

$$
\bar{u}=\frac{1}{N}\sum_{n=1}^{N}u^{(n)},\qquad
u'^{(n)}=u^{(n)}-\bar{u},
$$

均方根（RMS）为

$$
u_{\mathrm{rms}}=\sqrt{\frac{1}{N}\sum_{n=1}^{N}\left(u'^{(n)}\right)^2}.
$$

下面的片段从一段瞬态数据中提取时均、脉动与 RMS，是最常见的后处理起点：

```python
import numpy as np

# samples: 形状 (n_time, n_cell)，每行一个时刻的瞬时速度
def turbulence_stats(samples):
    """返回时均、脉动、RMS 与湍动能 k。"""
    mean = samples.mean(axis=0)              # 时间平均
    fluct = samples - mean                   # 脉动
    rms = np.sqrt((fluct**2).mean(axis=0))   # 单分量 RMS
    k = 0.5 * (fluct**2).mean(axis=0)        # 单分量近似下的湍动能
    return mean, fluct, rms, k

# 示例：合成信号，检验统计量
rng = np.random.default_rng(0)
u = 10.0 + rng.normal(0.0, 0.5, size=(2000, 32))
mean, fluct, rms, k = turbulence_stats(u)
print("时均：", mean[0], "RMS：", rms[0])
```

:::warning 采样窗口
统计收敛要求采样时间远大于积分时间尺度 $T_L$。若只采到几十个大涡翻转时间，$\langle u'v'\rangle$ 的误差可能达到 20% 以上，模型系数标定时会被这类噪声严重误导。
:::

## 统计收敛与采样

时间平均的误差随样本数下降，但“独立样本”的数量由积分时间尺度决定，而不是采样点数：

$$
\epsilon_{\bar u}\approx\frac{u_{\mathrm{rms}}}{\sqrt{N_{\mathrm{eff}}}},
\qquad
N_{\mathrm{eff}}=\frac{T_{\mathrm{sample}}}{2T_L},
$$

其中 $T_{\mathrm{sample}}$ 是采样总时长，$T_L=k/\varepsilon$ 是大涡翻转时间。若 $T_L=1\,\mathrm{s}$、采样 100 s，则 $N_{\mathrm{eff}}\approx50$，时均误差约为 RMS 的 14%。这就是为什么报告湍流统计量时必须同时给出采样时长：单看 RMS 无法判断时均是否收敛。

## 小结

- 雷诺分解把所有湍流量拆成“平均 + 脉动”，平均后产生的二阶矩就是封闭问题的来源。
- $k$、$R_{ij}$、$\varepsilon$ 是三种模型共用的基本量，分别对应能量、应力和耗散。
- 惯性区的 $-5/3$ 律与 Kolmogorov 尺度给出了网格与时间步的下界。
- 剪切生成 $P_k$ 是边界层湍流的主能量来源，浮力生成则在热分层中不可忽略。

下一步进入 [[ch4/rans|RANS 与涡粘模型]]，看 $R_{ij}$ 如何被涡粘假设近似；统计量的实际提取与可视化可参考 [[ch6/postprocessing|后处理]]。

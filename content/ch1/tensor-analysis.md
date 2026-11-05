---
title: 张量分析与应力
order: 2
summary: 用指标记法与爱因斯坦求和约定建立二阶张量代数，推导 Cauchy 应力张量、变形率张量与牛顿本构关系，并给出主应力与 von Mises 等效应力的计算方法。
tags: [张量, 应力, 本构关系, 雷诺应力]
---

场论把梯度、散度和旋度整理成一套矢量语言，但 N-S 方程中的粘性项并不只用一个方向描述：应力既取决于受力面的朝向，也取决于力的方向。描述这类“双方向”对象的工具是二阶张量。这一页从指标记法开始，依次建立应力张量、变形率张量与牛顿本构关系，最后落到主应力与屈服判据这类工程计算上。

## 为什么需要张量

在三维空间中，一个指标取 $1,2,3$ 的对象，其分量个数为 $3^n$，$n$ 就是**阶数**：

- 0 阶张量是标量，$3^0=1$ 个分量，例如压力 $p$、温度 $T$；
- 1 阶张量是矢量，$3^1=3$ 个分量，例如速度 $u_i$、热流 $q_i$；
- 2 阶张量有 $3^2=9$ 个分量，例如应力 $\sigma_{ij}$、变形率 $S_{ij}$。

仅仅凑齐九个数并不构成张量。张量的定义是**在坐标变换下按固定规则变换**的对象。设新旧直角坐标系的基矢量满足方向余弦

$$
a_{ij}=\mathbf{e}'_i\cdot\mathbf{e}_j,
$$

则一阶与二阶张量的变换规则为

$$
T'_i=a_{ij}T_j,\qquad T'_{ij}=a_{ip}a_{jq}T_{pq}.
$$

这个规则说明：张量是“与坐标系无关的物理对象”，分量只是它在某一组基下的投影。由此可以预料，某些由分量组合出来的量在坐标旋转下保持不变，例如迹 $\sigma_{kk}$ 与行列式 $\det\sigma_{ij}$。它们被称为**不变量**，后面判断应力状态时会反复用到。

:::note 张量与矩阵的区别
矩阵只是数的排列，张量则额外要求分量服从上式变换。一个 $3\times3$ 数组若在旋转后不按 $a_{ip}a_{jq}$ 变换，它就不是二阶张量。编程时二者外观相同，物理含义却不同。
:::

## 指标记法与爱因斯坦求和约定

张量推导若逐项写开，很快会失控。指标记法用一条约定换来计算上的整洁：

> 在同一项中，若某个指标重复出现两次，就对该指标从 1 到 3 求和；只出现一次的指标为自由指标，等式两边必须一致。

例如散度写成

$$
\frac{\partial u_i}{\partial x_i}
=\sum_{i=1}^{3}\frac{\partial u_i}{\partial x_i}
=\frac{\partial u}{\partial x}+\frac{\partial v}{\partial y}+\frac{\partial w}{\partial z}.
$$

重复指标 $i$ 是哑指标，改名不影响结果；自由指标则不能被随意改名，否则等式失去意义。实践中还有两条硬规则：同一项中一个指标最多出现两次，等式两边的自由指标必须同名。

### 克罗内克 δ 与置换符号 ε

**克罗内克 δ** 定义为

$$
\delta_{ij}=
\begin{cases}
1, & i=j,\\
0, & i\neq j.
\end{cases}
$$

它相当于单位矩阵，作用是“换指标”：$\delta_{ij}a_j=a_i$。它的迹为 $\delta_{ii}=3$，这在三维空间中是一个容易被忽略但很关键的常数。

**置换符号** $\varepsilon_{ijk}$ 定义为

$$
\varepsilon_{ijk}=
\begin{cases}
+1, & (i,j,k)\ \text{is an even permutation of } (1,2,3),\\
-1, & \text{odd permutation},\\
0, & \text{repeated index}.
\end{cases}
$$

有了它，叉乘可以写成 $(a\times b)_i=\varepsilon_{ijk}a_jb_k$，涡量写成 $\omega_i=\varepsilon_{ijk}\partial u_k/\partial x_j$。最常用的恒等式是

$$
\varepsilon_{ijk}\varepsilon_{ilm}
=\delta_{jl}\delta_{km}-\delta_{jm}\delta_{kl},
$$

它把“两个叉乘的乘积”化为 δ 的组合，是推导涡动力学方程与湍流输运方程时出现频率最高的公式。另一个常用结果是 $\varepsilon_{ijk}\varepsilon_{ijk}=6$，可直接由上式取 $i=l$ 缩并得到。

## 二阶张量的代数

对二阶张量 $\sigma_{ij}$，先定义三个基本运算：迹 $\operatorname{tr}\sigma=\sigma_{kk}$、转置 $\sigma^{\mathrm{T}}_{ij}=\sigma_{ji}$、行列式 $\det\sigma_{ij}$。

任何二阶张量都可以唯一地分解为对称部分与反对称部分：

$$
\sigma_{ij}=\sigma_{(ij)}+\sigma_{[ij]},\qquad
\sigma_{(ij)}=\frac{1}{2}\left(\sigma_{ij}+\sigma_{ji}\right),\qquad
\sigma_{[ij]}=\frac{1}{2}\left(\sigma_{ij}-\sigma_{ji}\right).
$$

对称部分有 6 个独立分量，反对称部分有 3 个，正好对应“变形”与“旋转”两类信息。反对称部分还可以用一个轴矢量表示，这就是涡量的来源。

### 主应力与三个不变量

对称张量的特征值问题写作

$$
\sigma_{ij}n_j=\lambda n_i,
$$

非零解要求系数矩阵奇异，即

$$
\det\left(\sigma_{ij}-\lambda\delta_{ij}\right)=0.
$$

展开后得到特征方程

$$
\lambda^3-I_1\lambda^2+I_2\lambda-I_3=0,
$$

其中三个系数就是主不变量：

$$
I_1=\sigma_{kk},\qquad
I_2=\frac{1}{2}\left(\sigma_{kk}\sigma_{ll}-\sigma_{ij}\sigma_{ji}\right),\qquad
I_3=\det\sigma_{ij}.
$$

三个实根 $\lambda_1,\lambda_2,\lambda_3$ 称为**主应力**，按代数值从大到小记为 $\sigma_1\ge\sigma_2\ge\sigma_3$。对应的特征矢量两两正交（实对称张量的谱定理），它们给出三个互相垂直的**主方向**。在这三个方向上剪应力为零，只有正应力。

| 量 | 定义 | 工程用途 |
| --- | --- | --- |
| 迹 $I_1$ | $\sigma_{kk}$ | 三倍平均正应力，与静水压力直接相关 |
| 第二不变量 $I_2$ | $\tfrac{1}{2}\left(I_1^2-\sigma_{ij}\sigma_{ji}\right)$ | 构造屈服判据、判断剪应力强弱 |
| 第三不变量 $I_3$ | $\det\sigma_{ij}$ | 判断应力状态是否退化，用于应力空间分区 |
| 主应力 | 特征方程的根 | 强度校核、裂纹起裂方向、莫尔圆圆心与半径 |

### 正应力、剪应力与莫尔圆

在二维应力状态下，若已知 $x$ 面与 $y$ 面上的分量 $\sigma_x,\sigma_y,\tau_{xy}$，任意斜截面上的正应力与剪应力在 $\sigma$-$\tau$ 平面上落在一个圆上，称为**莫尔圆**：

$$
R=\sqrt{\left(\frac{\sigma_x-\sigma_y}{2}\right)^2+\tau_{xy}^2},\qquad
\sigma_{1,2}=\frac{\sigma_x+\sigma_y}{2}\pm R.
$$

圆心位于 $(\sigma_x+\sigma_y)/2$，半径为 $R$，因此最大剪应力为

$$
\tau_{\max}=\frac{\sigma_1-\sigma_3}{2},
$$

它出现在与主方向成 $45^\circ$ 的截面上。这解释了为什么薄板试样受拉时断口常沿 $45^\circ$ 方向剪断：那是剪应力最大的方向，而不是正应力最大的方向。

## 连续介质中的 Cauchy 应力张量

取一个法向为 $n_i$ 的面元，作用在该面上的面力密度（单位面积力）记为 $t_i$。Cauchy 应力假设面力是法向的线性函数：

$$
t_i=\sigma_{ij}n_j
\quad\Longleftrightarrow\quad
\mathbf{t}=\boldsymbol{\sigma}\cdot\mathbf{n}.
$$

这就是**应力张量**的定义：$\sigma_{ij}$ 表示法向为 $\mathbf{e}_i$ 的面上、沿 $\mathbf{e}_j$ 方向的应力分量。第一指标是面法向，第二指标是力的方向，顺序不能随意交换。

| 分量类型 | 记号 | 几何含义 |
| --- | --- | --- |
| 正应力 | $\sigma_{xx},\sigma_{yy},\sigma_{zz}$ | 垂直于作用面，拉为正、压为负 |
| 剪应力 | $\sigma_{xy},\sigma_{yx},\sigma_{xz},\ldots$ | 位于作用面内，引起角变形与剪切输运 |

### 应力对称性与静水压力分解

对微元体取角动量守恒，若不存在体积力偶与偶应力，可得

$$
\sigma_{ij}=\sigma_{ji}.
$$

这一步在推导 N-S 方程时经常被直接引用，它把 9 个未知分量减少到 6 个。若介质存在极性（如某些悬浮液、液晶），对称性会被破坏，但常规 CFD 不涉及这种情况。

把应力分成各向同性与偏斜两部分：

$$
p=-\frac{1}{3}\sigma_{kk},\qquad
\sigma_{ij}=-p\,\delta_{ij}+\tau_{ij},\qquad
\tau_{kk}=0.
$$

$\tau_{ij}$ 称为**偏应力**，它只负责改变形状；$-p\delta_{ij}$ 是各向同性的静水压力，只负责改变体积。这个分解是理解“压力泊松方程”和“不可压缩假设”的出发点：不可压缩流动中，压力不再是状态量，而是维持 $\nabla\cdot\mathbf{u}=0$ 的 Lagrange 乘子。

:::warning 符号约定
不同教材对“拉为正”还是“压为正”采用不同约定。本页统一取**拉为正**，因此静水压缩状态下 $\sigma_{ij}=-p\delta_{ij}$，$p>0$。阅读商用软件文档时务必先确认其约定，否则本构关系中的符号会整体反号。
:::

## 变形率张量与旋转张量

应力描述“受了多大的力”，变形率描述“被怎样拉伸”。速度梯度张量为

$$
L_{ij}=\frac{\partial u_i}{\partial x_j},
$$

它分解为对称的**变形率张量** $S_{ij}$ 与反对称的**旋转张量** $W_{ij}$：

$$
S_{ij}=\frac{1}{2}\left(L_{ij}+L_{ji}\right),\qquad
W_{ij}=\frac{1}{2}\left(L_{ij}-L_{ji}\right).
$$

$S_{ij}$ 的主方向给出局部拉伸率最大的三个方向；$W_{ij}$ 描述局部刚体旋转，其强度与涡量 $\omega=\nabla\times\mathbf{u}$ 只差一个因子 2。一个常被忽略的事实是：纯剪切流动的 $S$ 与 $W$ 模长相等，所以“剪切”既包含变形也包含旋转，两者不能混为一谈。

### 牛顿流体本构

对牛顿流体，剪应力与变形率成正比，各向同性部分由压力承担：

$$
\sigma_{ij}=-p\,\delta_{ij}+2\mu S_{ij}.
$$

对于可压缩流动，还需允许体积粘性：

$$
\sigma_{ij}=-p\,\delta_{ij}+\lambda S_{kk}\delta_{ij}+2\mu S_{ij},
\qquad
\lambda=-\frac{2}{3}\mu,
$$

其中 $\lambda$ 为第二粘性系数，Stokes 假设取 $\lambda=-2\mu/3$，使 $\tau_{kk}=0$。代入动量方程即得

$$
\rho\frac{\mathrm{D}u_i}{\mathrm{D}t}
=-\frac{\partial p}{\partial x_i}
+\frac{\partial}{\partial x_j}\left[\mu\left(\frac{\partial u_i}{\partial x_j}+\frac{\partial u_j}{\partial x_i}\right)\right],
$$

详见 [[ch2/governing-equations|流体力学基本方程]]。

### 非牛顿流体

很多工程流体（聚合物熔体、血液、泥浆、牙膏）不满足线性关系。最常用的一类是**广义牛顿流体**：仍假设应力与 $S$ 共轴，但把粘度写成剪切率的函数。幂律模型为

$$
\mu_{\mathrm{eff}}=K\dot\gamma^{\,n-1},\qquad
\dot\gamma=\sqrt{2S_{ij}S_{ij}},
$$

其中 $K$ 为稠度系数，$n$ 为流动指数。$n<1$ 为剪切变稀（如血液、聚合物溶液），$n>1$ 为剪切增稠（如淀粉悬浮液），$n=1$ 退化为牛顿流体。剪切率趋于零时幂律粘度可能发散，工程上常改用 Carreau 或 Bingham 模型加以正则化。

## 与湍流及工程实际的联系

### 雷诺应力的来源

对速度与压力做 Reynolds 分解 $u_i=\bar u_i+u'_i$，平均动量方程中会多出一项

$$
\tau^{\mathrm{R}}_{ij}=-\rho\langle u'_i u'_j\rangle,
$$

它在数学上的位置与粘性应力完全相同，因此称为**雷诺应力**。Boussinesq 假设仿照牛顿本构，用湍流粘度 $\mu_t$ 把它写成

$$
-\rho\langle u'_i u'_j\rangle
=2\mu_t S_{ij}-\frac{2}{3}\rho k\,\delta_{ij},
$$

其中 $k=\tfrac{1}{2}\langle u'_iu'_i\rangle$ 为湍动能。这一假设是大多数工程湍流模型的基础，其局限与修正见 [[ch4/rans|RANS 方法]]。值得注意的是，$\mu_t$ 是流场属性而非流体属性，这正是湍流建模困难的根本原因。

### 壁面剪应力与 von Mises 判据

壁面处的剪应力由速度的法向梯度给出：

$$
\tau_w=\mu\left.\frac{\partial u}{\partial y}\right\rvert_{\text{wall}},
\qquad
u_\tau=\sqrt{\frac{\tau_w}{\rho}},
$$

$u_\tau$ 称为摩擦速度，是壁面湍流标度的基本量，$y^+$ 与壁面函数都由它定义。工程上常用摩阻系数 $C_f=\tau_w/(\tfrac{1}{2}\rho U^2)$ 比较不同方案的减阻效果。

对延性材料，静水压力不引起屈服，只有偏应力起作用。**von Mises 等效应力**定义为

$$
\sigma_{v}=\sqrt{\frac{3}{2}s_{ij}s_{ij}}
=\sqrt{\frac{1}{2}\left[(\sigma_1-\sigma_2)^2+(\sigma_2-\sigma_3)^2+(\sigma_3-\sigma_1)^2\right]},
$$

其中 $s_{ij}=\sigma_{ij}-p\delta_{ij}$ 为偏应力。当 $\sigma_v$ 超过材料屈服强度时判定进入塑性，这一判据与坐标无关，因此可以直接用于有限元后处理。

## 用 NumPy 计算主应力与等效应力

下面的代码对对称应力张量求主应力与 von Mises 应力，注意 `eigh` 只适用于对称矩阵，用它处理非对称输入会得到错误结果：

```python
import numpy as np

def principal_stresses(sigma):
    """对称应力张量的主应力（降序）与对应主方向。"""
    lam, vec = np.linalg.eigh(sigma)   # 实对称矩阵，特征值为实数
    return lam[::-1], vec[:, ::-1]

def von_mises(sigma):
    """von Mises 等效应力，仅由偏应力决定。"""
    p = np.trace(sigma) / 3.0
    s = sigma - p * np.eye(3)                    # 偏应力 s_ij
    return np.sqrt(1.5 * np.sum(s * s))          # (3/2) s_ij s_ij

sigma = np.array([[120.0, 40.0, 0.0],
                  [ 40.0, 60.0, 0.0],
                  [  0.0,  0.0, 20.0]])

lam, vec = principal_stresses(sigma)
print("主应力：", lam)                  # 约 140, 40, 20
print("von Mises：", von_mises(sigma))  # 约 111.4

# 检验不变量：迹与主应力之和应一致
print("迹校验：", np.trace(sigma), lam.sum())
```

:::tip 数值细节
`np.linalg.eig` 对非对称矩阵可能返回复数特征值；应力张量理论上对称，但若数据来自实验或插值，微小非对称会被放大。工程代码中常先做 $\tfrac{1}{2}(\sigma+\sigma^{\mathrm{T}})$ 对称化再求解。
:::

## 小结

- 张量由阶数与变换规则定义，$n$ 阶张量有 $3^n$ 个分量；不变量（迹、行列式、主应力）与坐标无关。
- 指标记法中重复指标求和，$\delta_{ij}$ 换指标，$\varepsilon_{ijk}$ 负责叉乘与涡量。
- 应力可分解为静水压力与偏应力；对称性来自角动量守恒。
- 速度梯度分解为变形率 $S_{ij}$ 与旋转 $W_{ij}$，牛顿本构为 $\sigma=-pI+2\mu S$。
- 湍流雷诺应力在方程中占据与粘性应力相同的位置，这是湍流建模的切入点。

下一步是[[ch1/dimensional-analysis|量纲分析与相似准则]]，把方程整理成只含少数控制参数的形式；若想先看这些张量如何进入守恒方程，可直接阅读[[ch2/governing-equations|流体力学基本方程]]。

---
title: IFNO：隐式傅里叶神经算子
order: 5
summary: 用共享权重的不动点迭代代替堆叠的傅里叶层，使有效深度不受显式层数限制；讨论隐式微分、收敛判据、稳定性与 PyTorch 示意实现。
tags: [IFNO, 隐式层, 不动点, 神经算子]
---

FNO 的深度是显式写死的：堆四层就是四层，堆二十层就背二十份参数与激活。如果一个问题需要很大的有效感受野，显式堆叠很快会撞上显存与优化难题。IFNO 的思路是：把同一个傅里叶块反复施加，直到它收敛到一个不动点，用“迭代次数”代替“层数”。

## 显式堆叠的局限

显式 FNO 的每一层只做一次全局卷积，感受野虽然全局，但信息在通道间的传播仍受层数限制。加深网络会带来两个问题：

- 参数与激活随深度线性增长，显存成为瓶颈；
- 残差连接在深层需要精细调参，否则梯度要么消失要么爆炸。

而很多 PDE 的解本身就是一个不动点问题的解——例如稳态方程、隐式时间推进。这类结构提示我们：与其学一个很深的映射，不如学一个“反复作用直到稳定”的算子。

## 隐式傅里叶层

设输入函数为 $a$，隐状态为 $z$。IFNO 的核心是一个共享参数的更新算子 $F_\theta$：

$$
z^{k+1} = F_\theta\left(z^{k}, a\right), \qquad k = 0,1,2,\dots
$$

前向一直迭代到收敛：

$$
z^{\star} = F_\theta\left(z^{\star}, a\right).
$$

$z^{\star}$ 就是不动点，也是这一层的输出。$F_\theta$ 内部仍是“谱卷积 + 逐点卷积 + 注入输入”的组合，只是不再复制多份。迭代次数由收敛判据决定，而不是超参数。若迭代到上限仍未达到容差，训练时应把该样本的损失降权，避免把未收敛的噪声当成监督信号：

$$
\frac{\left\Vert z^{k+1} - z^{k} \right\Vert}
{\left\Vert z^{k} \right\Vert + \varepsilon} < \tau,
$$

$\tau$ 是容差（常取 $10^{-4}$ 到 $10^{-3}$）。达到容差即停止，因此不同样本的迭代次数可以不同。

### 收敛条件

不动点迭代收敛的充分条件是 $F_\theta$ 关于 $z$ 的雅可比矩阵谱半径小于 1：

$$
\rho\left(J_F\right) < 1, \qquad J_F = \frac{\partial F_\theta}{\partial z}.
$$

实践中很难逐样本验证，常用手段是给 $F_\theta$ 加谱归一化、把更新写成残差形式 $z^{k+1} = z^{k} + \alpha\,G_\theta(z^k,a)$ 并限制 $\alpha$，或在损失里加一项惩罚迭代残差。若迭代发散，前向会得到无意义的输出，训练信号也随之崩坏。

:::warning 不收敛的排查
先单独检查前向：固定输入，打印每步的相对残差。如果残差在若干步后开始上升，多半是 $F_\theta$ 的 Lipschitz 常数过大。降低学习率、加谱归一化或减小注入项的权重，通常能恢复。
:::

## 隐式微分

真正的难点在反向。若把整个迭代过程都记进计算图，内存会随迭代次数线性增长，与深层网络无异。隐式微分的做法是：只对不动点方程求导，利用

$$
z^{\star} = F_\theta(z^{\star}, a)
$$

两边对 $\theta$ 求全导数，得到

$$
\frac{\partial \mathcal{L}}{\partial \theta}
= \frac{\partial \mathcal{L}}{\partial z^{\star}}\,
\left( I - J_F(z^{\star}) \right)^{-1}
\frac{\partial F_\theta(z^{\star}, a)}{\partial \theta},
$$

$I$ 是单位矩阵，$J_F$ 在不动点处取值。这个式子说明：梯度等价于解一个线性系统，而不需要保存前向的每一步。实际实现有三种选择：

- **精确解**：用 `torch.linalg.solve` 直接解线性系统，适合状态维度较小的情形。
- **Neumann 级数**：把逆写成 $I + J_F + J_F^2 + \dots$，截断若干项，等价于在伴随时做若干次不动点迭代。
- **一步梯度（phantom gradient）**：前向不建图，最后一步重新计算并保留图，用 $\partial F_\theta/\partial\theta$ 近似完整梯度。成本最低，偏差最大，但在很多场回归任务上够用。

Neumann 级数的截断项数与迭代次数直接相关：截断 $K$ 项相当于在伴随时近似求解 $K$ 次。若 $J_F$ 的谱半径接近 1，级数收敛很慢，需要更多项；这就是稳定性与梯度成本之间的权衡。

另一个实践细节是热启动：把上一次前向的 $z^{\star}$ 作为下一次迭代的初值，能显著减少迭代次数，尤其在相邻样本相似时。

## 与 DEQ 的联系

IFNO 与深度均衡模型（DEQ）是同一套数学：DEQ 把“无限深网络”写成一个不动点，IFNO 只是把其中的线性层换成了谱卷积。因此 DEQ 的收敛技巧、梯度估计与稳定性分析都可以直接迁移。

差别在于输入注入：DEQ 的输入通常只在第一层进入，IFNO 每个迭代步都注入 $a$，使不动点显式依赖输入函数。这也是它能做算子学习的原因。

## 损失函数

数据项与普通算子学习一致：

$$
\mathcal{L}_{data} = \frac{1}{N}\sum_{i=1}^{N}
\frac{\left\Vert \mathcal{N}_\theta(a_i) - u_i \right\Vert_2^2}
{\left\Vert u_i \right\Vert_2^2 + \varepsilon}.
$$

若加入物理约束，再追加残差项：

$$
\mathcal{L} = \mathcal{L}_{data}
+ \lambda_r \frac{1}{N Q}\sum_{i=1}^{N}\sum_{q=1}^{Q}
r_\theta(a_i, y_q)^2,
$$

$r_\theta$ 是 PDE 残差，$y_q$ 是查询点。残差需要对坐标求导，写法与[[ch5/pino|PINO]]完全相同。

## PyTorch 示意实现

下面的代码标注为**示意**：用“最后一步保留图”的一步梯度近似，不实现精确隐式微分。

```python
import torch
import torch.nn as nn
import torch.nn.functional as F

class ImplicitFourierBlock(nn.Module):
    """共享权重的不动点层；step 对应 F_theta(z, a)。

    SpectralConv2d 复用 FNO 一页的实现，这里只给出层的组织方式。
    """
    def __init__(self, width, modes1, modes2):
        super().__init__()
        self.spec = SpectralConv2d(width, width, modes1, modes2)
        self.pointwise = nn.Conv2d(width, width, 1)
        self.inject = nn.Conv2d(width, width, 1)
        self.norm = nn.GroupNorm(4, width)

    def step(self, z, a):
        h = self.spec(z) + self.pointwise(z) + self.inject(a)
        return self.norm(z + F.gelu(h))          # 残差形式，利于稳定

    def forward(self, a, tol=1e-4, max_iter=30):
        z = torch.zeros_like(a)
        with torch.no_grad():                     # 前向迭代不建图
            for _ in range(max_iter):
                z_next = self.step(z, a)
                rel = (z_next - z).norm() / (z.norm() + 1e-8)
                z = z_next
                if rel < tol:
                    break
        # 一步梯度：在收敛点附近重新计算一次，保留计算图
        return self.step(z.detach(), a)
```

若要精确梯度，需要把 `z` 作为叶子变量，用 `torch.autograd.grad` 对不动点方程做隐函数求导，再解线性系统；实现复杂度显著上升，建议先跑通一步梯度版本。

## 与 FNO 的对比

| 维度 | IFNO | FNO |
| --- | --- | --- |
| 参数数量 | 与迭代次数无关，仅一个块 | 随层数线性增长 |
| 有效深度 | 由迭代次数决定，可自适应 | 固定为层数 |
| 显存 | 前向不建图，反向近似时较低 | 随深度增长 |
| 训练稳定性 | 依赖收敛性，较敏感 | 相对稳定 |
| 推理成本 | 迭代次数不定，可能较慢 | 固定层数，可预测 |
| 实现复杂度 | 高，需要隐式微分或近似 | 低 |

工程取舍很直接：若显存是瓶颈、且问题确实有不动态性质，IFNO 值得尝试；若只追求可复现的基线，显式 FNO 更省事。

## 与显式深度的关系

若把每次迭代视为一层，IFNO 的有效深度等于收敛时的迭代次数。区别在于这些“层”共享参数，因此参数量的增长与深度解耦。实践中 5 到 10 次迭代通常足够，超过之后残差下降很慢，收益有限。

这也带来一个部署问题：不同样本的迭代次数不同，推理延迟存在抖动。实时性要求高的场合，可以固定最大迭代次数并对未收敛样本回退到显式模型；或者训练时加入“迭代次数惩罚”，鼓励网络在更少步数内收敛。

## 稳定性实践

- 用残差形式更新，避免直接预测下一个状态；
- 对谱权重做谱归一化，限制 $J_F$ 的谱半径；
- 前向迭代用 `torch.no_grad()`，只在最后一步建图；
- 监控每步相对残差，若中位数持续上升，说明该批次输入超出了训练分布。

容差、最大迭代次数与损失权重需要一起记录，复现时三者缺一不可；只固定网络结构往往无法重现同一误差水平。

## 小结

- IFNO 用共享权重的不动点迭代替代显式堆叠，有效深度由收敛判据决定。
- 反向传播用隐式微分，核心是解 $(I - J_F)^{-1}$ 相关的线性系统；工程上常用一步梯度近似。
- 收敛性由 $J_F$ 的谱半径控制，需要谱归一化或残差形式来保证。
- 它和 DEQ 同源；想把物理残差加进来，可参考[[ch5/pino|PINO]]，想回到显式结构则看[[ch5/fno|FNO]]。

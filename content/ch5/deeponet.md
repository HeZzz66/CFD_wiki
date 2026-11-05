---
title: DeepONet
order: 3
summary: 用 branch net 编码输入函数的传感器读数、trunk net 编码查询坐标，以两者的内积逼近算子；介绍 Chen–Chen 定理、采样策略、POD 变体与 PyTorch 实现。
tags: [DeepONet, 算子学习, branch, trunk]
---

FNO 在频域做全局卷积，DeepONet 走另一条路：把“输入函数”压成一个定长向量，把“查询位置”压成另一个定长向量，两者做内积就得到该位置的解。这种分解让网络可以在任意查询点上输出，而不必绑定规则网格。

## 算子逼近定理

Chen 与 Chen 在 1995 年证明：单隐层网络可以逼近任意非线性连续算子。设 $G$ 把输入函数 $a$ 映为输出函数 $G(a)$，$y$ 是输出域中的查询点，则对任意 $\varepsilon>0$，存在 $p$ 个 branch 输出 $b_k$、trunk 输出 $t_k$ 与偏置 $b_0$，使得

$$
\left\Vert G(a)(y) - \sum_{k=1}^{p} b_k(a)\, t_k(y) - b_0 \right\Vert < \varepsilon,
$$

对所有 $a$ 在紧集 $K_1$、$y$ 在紧集 $K_2$ 上一致成立。这个定理给出了网络结构：一个网络吃 $a$，一个网络吃 $y$，输出维度相同，内积求和。

需要强调，定理只保证存在性，不保证可训练性。$p$ 取多大、传感器点放在哪、查询点如何采样，都是工程问题。

## 网络结构

把输入函数离散为传感器读数：

$$
\mathbf{a} = \left(a(x_1), a(x_2), \dots, a(x_m)\right),
$$

$m$ 是传感器点数量，位置固定。Branch net 把它映到 $p$ 维特征：

$$
\mathbf{b}(a) = \mathcal{B}_\theta(\mathbf{a}) \in \mathbb{R}^{p}.
$$

Trunk net 把查询坐标 $y$ 映到同样维度的特征：

$$
\mathbf{t}(y) = \mathcal{T}_\phi(y) \in \mathbb{R}^{p}.
$$

最终输出是内积加偏置：

$$
\widehat{G}(a)(y) = \sum_{k=1}^{p} b_k(a)\, t_k(y) + b_0 .
$$

这个形式的解释很直接：$t_k(y)$ 是一组基函数，$b_k(a)$ 是对应的系数。系数由输入函数决定，基函数由查询位置决定。对固定的 $a$，网络输出的就是这组基的线性组合。

这也解释了为什么 DeepONet 可以在任意点查询：trunk 接受连续坐标，输出随坐标连续变化，不需要像 CNN 那样把解固定在网格上。若把 branch 简化为常数、trunk 退化为普通 MLP，结构就回到了[[ch5/pinns|PINN]]——两者本质上是同一分解的两种特例。

实际部署时，trunk 可以预先在固定查询网格上前向一次并缓存基函数值，之后每个新输入只需算 branch 与内积，推理成本很低。样本数在数百到数千量级时，这种“离线基 + 在线系数”的组织方式比整场卷积更省算力。

| 组件 | 输入 | 输出 | 常见结构 |
| --- | --- | --- | --- |
| Branch net | $m$ 个传感器值 | $p$ 维系数 | MLP 或 CNN |
| Trunk net | 查询坐标（1D/2D/3D） | $p$ 维基函数值 | MLP |
| 合并 | 两组 $p$ 维向量 | 标量 | 内积 + 偏置 |

$p$ 通常取 64–256。太小表达能力不足，太大则内积退化为高维噪声，训练后期容易过拟合。

:::tip 传感器位置
传感器点应在训练前固定，并在推理时保持同一布局。若输入是图像式场，可把整张图送入 CNN 作为 branch；若输入是稀疏测量，则 branch 输入就是这些测点的有序拼接。
:::

## 损失函数

训练数据是若干组“输入函数 + 解”，每组解只在若干查询点上已知。损失在查询点上计算：

$$
\mathcal{L}(\theta,\phi) = \frac{1}{N\,Q}\sum_{i=1}^{N}\sum_{q=1}^{Q}
\left( \widehat{G}(a_i)(y_q) - u_i(y_q) \right)^2,
$$

其中 $N$ 是样本数，$Q$ 是每条样本的查询点数。查询点可以每批随机重采，相当于对输出域做数据增强；也可以固定成网格，等价于在网格上做监督。

若解的量级差异大，改用相对形式：

$$
\mathcal{L}_{rel} = \frac{1}{N}\sum_{i=1}^{N}
\frac{\sum_{q=1}^{Q}\left( \widehat{G}(a_i)(y_q) - u_i(y_q) \right)^2}
{\sum_{q=1}^{Q} u_i(y_q)^2 + \varepsilon}.
$$

## 采样策略

- **传感器点**：规则网格、随机点或按物理重要性加密。稀疏测量场景下，点位对应真实传感器，不能随意改动。
- **查询点**：训练时可每批随机采样 $Q$ 个点，使网络在输出域上连续；测试时用规则网格，便于与 CFD 结果逐点比较。
- **课程**：先在小 $Q$、平滑区域训练，再逐步加入边界附近与陡梯度区域，收敛更稳。

## 常见变体

**POD-DeepONet**：把 trunk 换成对训练集解做 POD 得到的正交基，只训练 branch。基函数由数据决定，网络参数更少，小数据下更稳；代价是基的数量受限于奇异值衰减速度。

**多输出 DeepONet**：输出是多分量场（速度、压力）时，可以共享 trunk、给每个分量一个 branch 头，或让 trunk 输出 $p \times c$ 维特征。

**物理约束 DeepONet**：在损失中加入 PDE 残差，对查询坐标求自动微分。结构与 PINO 类似，只是算子层换成了 branch/trunk 内积。可参考[[ch5/pino|PINO]]的残差写法。

## PyTorch 实现

```python
import torch
import torch.nn as nn

class MLP(nn.Module):
    def __init__(self, in_dim, hidden, out_dim, depth=3):
        super().__init__()
        layers = [nn.Linear(in_dim, hidden), nn.Tanh()]
        for _ in range(depth - 1):
            layers += [nn.Linear(hidden, hidden), nn.Tanh()]
        layers += [nn.Linear(hidden, out_dim)]
        self.net = nn.Sequential(*layers)

    def forward(self, x):
        return self.net(x)


class DeepONet(nn.Module):
    """branch 吃 m 个传感器值，trunk 吃 d 维坐标，输出标量。"""
    def __init__(self, m=64, d=2, p=128, hidden=128, depth=3):
        super().__init__()
        self.branch = MLP(m, hidden, p, depth)
        self.trunk = MLP(d, hidden, p, depth)
        self.bias = nn.Parameter(torch.zeros(1))

    def forward(self, sensors, coords):
        # sensors: (B, m)，coords: (Q, d)
        b = self.branch(sensors)              # (B, p)
        t = self.trunk(coords)                # (Q, p)
        return torch.einsum("bp,qp->bq", b, t) + self.bias


def deeponet_loss(model, sensors, coords_list, values_list, eps=1e-8):
    """coords_list / values_list 长度等于 batch，元素为 (Q, d) 与 (Q,)。"""
    preds, targets = [], []
    for i, (y, u) in enumerate(zip(coords_list, values_list)):
        preds.append(model(sensors[i:i + 1], y).squeeze(0))
        targets.append(u)
    pred = torch.stack(preds)                 # (B, Q)
    tgt = torch.stack(targets)                # (B, Q)
    num = ((pred - tgt) ** 2).sum(dim=1)
    den = (tgt ** 2).sum(dim=1) + eps
    return (num / den).mean()
```

实际训练时通常把 batch 展平成 $(B\cdot Q, d)$ 一次性送入 trunk，避免 Python 循环；上面的写法为了突出“逐样本查询”的语义。

## 与 FNO 的对比

| 维度 | DeepONet | FNO |
| --- | --- | --- |
| 输入形式 | 传感器值向量，可稀疏 | 规则网格上的场 |
| 输出位置 | 任意查询点 | 与输入同一网格 |
| 网格依赖 | 无，坐标连续 | 训练时绑定网格，权重可复用 |
| 小数据表现 | 较好，参数少 | 需要较多样本 |
| 高频细节 | 依赖 trunk 容量与基数量 | 由保留模态决定 |
| 训练稳定性 | 内积结构简单，较稳 | 谱层对学习率敏感 |

两者都可以看成“基 + 系数”的分解：FNO 的基是傅里叶模态，DeepONet 的基由 trunk 学出。若输入是稀疏测点或输出需要任意位置查询，DeepONet 更合适；若输入本身就是高分辨率场，FNO 更直接。

## 训练细节

**输入标准化。** 传感器读数可能来自不同物理量，量级差异会让 branch 的第一层偏向大方差通道。按训练集统计量逐传感器做 z-score，是最简单有效的处理。

**trunk 的坐标编码。** 直接用原始坐标时，trunk 对高频变化的响应很慢。常用傅里叶特征把坐标升维：

$$
\mathbf{e}(y) = \left[\sin(2\pi B y),\ \cos(2\pi B y)\right],
$$

$B$ 是一组可调频率（从低频到高频按几何级数取）。升维后 trunk 更容易表达薄边界层，代价是输入维度增加。

**基的正交性。** 若不加约束，不同的 $t_k$ 可能收敛到几乎相同的函数，内积退化为冗余求和。可在损失里加一项对 trunk 输出的相关性惩罚，或用 POD 基初始化 trunk，让基在训练初期就彼此正交。

**输出缩放。** 解的幅值差异大时，给内积后乘一个可学习的标量，或对标签做标准化。否则初期的均方误差几乎全部来自幅值，网络先学“平均场”，细节要很久才出现。

## 常见失败模式

- **trunk 塌缩**：所有查询点输出近似相同，通常因为 $p$ 过大或学习率过高，表现为预测趋于常数。
- **传感器过少**：$m$ 远小于输入函数的有效自由度，branch 无法区分不同输入，误差在分布内也无法下降。
- **查询点分布偏移**：训练只在内部点采样，测试包含边界点，边界附近误差明显偏大。
- **内积饱和**：$p$ 很大但训练样本少，内积项数值增长，梯度爆炸，需要权重衰减或减小 $p$。

## 小结

- DeepONet 用 branch 编码输入函数、trunk 编码查询坐标，内积给出解，理论依据是 Chen–Chen 算子逼近定理。
- 损失只在查询点上计算，查询点可随机采样，训练灵活。
- POD 变体用数据基替代 trunk，适合小样本；物理约束变体可加入 PDE 残差。
- 与[[ch5/fno|FNO]]相比，它更适配稀疏测量与非结构查询点；与[[ch5/pinns|PINN]]相比，它学的是算子而非单个解。

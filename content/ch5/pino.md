---
title: PINO：物理信息神经算子
order: 6
summary: 在算子学习的数据损失之外，用自动微分在查询点上计算 PDE 残差，使一个网络对多组输入函数都给出近似满足方程的解；讨论残差归一化、课程学习与权重平衡。
tags: [PINO, 物理约束, 算子学习, 残差损失]
---

PINO 可以一句话概括：把 PINN 的残差损失，从“单个解”搬到“整个算子”上。网络输入不再是坐标，而是输入函数 $a$；输出是整个解场；残差仍在查询点上用自动微分计算。这样训练一次，就能对一类输入函数反复推理，同时保留物理约束。

## 学习对象

目标是逼近算子

$$
G: a \mapsto u, \qquad u = G(a),
$$

$a$ 可以是初始条件、边界条件、材料系数或几何参数。网络写成

$$
u_\theta = \mathcal{N}_\theta(a),
$$

$\mathcal{N}_\theta$ 可以是[[ch5/fno|FNO]]、[[ch5/deeponet|DeepONet]]或 U-Net。PINO 不规定主干结构，只规定损失怎么加。

与 PINN 的根本差别在于：PINN 对每一组新参数都要重新训练一次；PINO 把参数变化也当成输入的一部分，训练后可直接泛化到训练分布内的新 $a$。

训练集通常这样构造：先用求解器在若干组 $a_i$ 上算出解 $u_i$；把其中一部分作为有标签样本，另一部分只保留 $a_i$ 而不给 $u_i$，用于残差项；查询点在区域内随机采样。这样同一批计算既提供标签，又提供物理约束的载体。若 $a$ 是高维随机场，采样要覆盖其协方差结构的主要模态，否则网络只见过少数纹理，泛化很差。

## 三项损失

PINO 的总损失由数据项、残差项与边界项组成：

$$
\mathcal{L}(\theta) = \mathcal{L}_{data}(\theta)
+ \lambda_r \mathcal{L}_{res}(\theta)
+ \lambda_b \mathcal{L}_{bc}(\theta).
$$

**数据项**在有标签的样本上约束输出：

$$
\mathcal{L}_{data} = \frac{1}{N}\sum_{i=1}^{N}
\frac{\left\Vert u_\theta(a_i) - u_i \right\Vert_2^2}
{\left\Vert u_i \right\Vert_2^2 + \varepsilon}.
$$

**残差项**在无标签的查询点上要求方程成立。设 $\mathcal{D}$ 是方程对应的微分算子，$f$ 是源项，则

$$
r_\theta(a,y) = \mathcal{D}\left[u_\theta(a)\right](y) - f(y),
$$

$$
\mathcal{L}_{res} = \frac{1}{N Q}\sum_{i=1}^{N}\sum_{q=1}^{Q}
r_\theta(a_i, y_q)^2 .
$$

以二维稳态扩散为例，$\mathcal{D}u = \partial_{xx}u + \partial_{yy}u$；对 N-S 方程，$\mathcal{D}$ 则包含对流项与粘性项，需要对输出场的每个分量分别求导。

**边界项**在边界点上约束边值：

$$
\mathcal{L}_{bc} = \frac{1}{N_b}\sum_{i=1}^{N}\sum_{q=1}^{N_b}
\left( u_\theta(a_i)(y_q^{b}) - g(a_i)(y_q^{b}) \right)^2 .
$$

三项的量级需要一起看：数据项按相对误差归一，残差项按平方均值归一，边界项按边值量级归一，否则某个量级大的项会独占梯度。

## 残差怎么算

残差需要“对坐标求导”，而不是对网络参数求导。因此 $u_\theta(a)$ 必须作为坐标的函数被求值，且计算图要保留。典型做法是把归一化坐标作为额外输入通道送进网络，输出场后对坐标通道做 `autograd.grad`。

以 FNO 为骨干时，前向是

$$
u_\theta(a)(\mathbf{x}) = \mathcal{P}\left(\mathcal{B}_L \circ \cdots \circ \mathcal{B}_1
\left(\mathcal{L}(a,\mathbf{x})\right)\right),
$$

$\mathcal{L}$ 是 lifting，$\mathcal{B}_l$ 是傅里叶块，$\mathcal{P}$ 是 projection。只要 $\mathbf{x}$ 是叶子张量且 `create_graph=True`，就能逐点得到 $u_x$、$u_y$ 与二阶项。

:::note 与有限差分的区别
也可以用网格上的中心差分算残差，成本低、实现简单，但精度受网格限制。自动微分给出的是网络表示的解析导数，在配点处更准确，代价是反向图更深、显存更高。分辨率较低时，两者差别不大。
:::

## 训练技巧

**残差归一化。** 不同样本的残差量级可能相差几个数量级，直接取均值会被个别样本主导。常用做法是除以当前批次的残差均方：

$$
\mathcal{L}_{res}^{norm} = \frac{1}{N Q}\sum_{i,q}
\frac{r_\theta(a_i,y_q)^2}
{\mathrm{mean}\left(r_\theta^2\right)_{\text{detach}} + \varepsilon},
$$

分母 detach 后不参与反传，相当于给每批残差做一次尺度对齐。

**课程学习。** 先在平滑、低幅值的输入上训练，再逐步加入高频、强梯度样本。也可以先只开数据项，等网络能复现大致结构后再加入残差项，避免早期残差噪声把网络带偏。

**多点采样。** 每批重采查询点，使残差在整个区域上均匀；在边界层、激波附近按梯度大小加密。固定网格容易让网络“记住”少数点上的残差。

**权重平衡。** $\lambda_r$ 过大时网络会牺牲数据拟合去压残差，表现为整体偏移；过小时物理项形同虚设。常见起点是 $\lambda_r = 10^{-2}$ 到 $10^{-1}$，再按验证集上的残差与相对误差同时调整。

## PyTorch 实现

下面的片段以 FNO 为骨干、二维泊松方程为例，重点在残差与总损失的组织方式。

```python
import torch

def poisson_residual(model, a, coords, source):
    """-lap(u) = f 的残差；coords 为 (B, 2, H, W) 的归一化坐标。"""
    coords = coords.clone().detach().requires_grad_(True)
    u = model(a, coords)                      # (B, 1, H, W)

    grads = torch.autograd.grad(
        u, coords, grad_outputs=torch.ones_like(u), create_graph=True
    )[0]
    u_x, u_y = grads[:, 0:1], grads[:, 1:2]

    u_xx = torch.autograd.grad(
        u_x, coords, grad_outputs=torch.ones_like(u_x), create_graph=True
    )[0][:, 0:1]
    u_yy = torch.autograd.grad(
        u_y, coords, grad_outputs=torch.ones_like(u_y), create_graph=True
    )[0][:, 1:2]

    return u_xx + u_yy - source                # 残差逐点


def pino_loss(model, batch, lam_r=1e-2, lam_b=1e-2, eps=1e-8):
    a, u_true, coords, source, mask_b = batch

    u_pred = model(a, coords)
    num = ((u_pred - u_true) ** 2).flatten(1).sum(dim=1)
    den = u_true.flatten(1).pow(2).sum(dim=1) + eps
    loss_data = (num / den).mean()

    r = poisson_residual(model, a, coords, source)
    loss_res = (r ** 2).mean()

    # mask_b 标记边界点，只在这些点上算边值误差
    loss_bc = ((u_pred - u_true) ** 2 * mask_b).sum() / (mask_b.sum() + eps)

    return loss_data + lam_r * loss_res + lam_b * loss_bc
```

训练循环与普通监督学习相同，只是每步要多一次前向用于残差。显存紧张时可以把残差计算放在 `torch.no_grad()` 之外单独累积，或降低查询点数量。

## 三者对比

| 维度 | PINN | FNO | PINO |
| --- | --- | --- | --- |
| 学习对象 | 单个解 | 算子 | 算子 |
| 输入 | 坐标 | 输入场 | 输入场 |
| 数据需求 | 无标签也可 | 需要成对数据 | 少量数据 + 无标签残差 |
| 物理一致性 | 强约束 | 无 | 中等，由 $\lambda_r$ 控制 |
| 推理成本 | 需重新训练 | 一次前向 | 一次前向 |
| 训练成本 | 高 | 中 | 高，残差反传更贵 |
| 泛化 | 单工况 | 分布内插值 | 分布内插值且更平滑 |

PINO 并不是“必然优于 FNO”：若数据充足且分布窄，FNO 的相对误差可能更低；PINO 的优势在于数据稀疏时仍能给出物理上合理的场，并且对噪声标签更稳健。

:::warning 残差不能替代数据
残差项只约束方程，不约束解的绝对值——常数偏移、边界层厚度都可能落在残差很小的解空间里。没有数据项或边界项时，PINO 容易收敛到平凡解。务必保留至少一种绝对约束。
:::

## 为什么残差有用

纯数据训练的算子在训练分布内可以很准，但样本稍少时会出现两类错误：一是高频噪声被当作信号拟合，二是解在无标签区域自由漂移。残差项在无标签点上提供额外约束，相当于把方程当成“免费的标签”，因此能在数据稀疏时显著改善泛化。

代价是残差对解的绝对幅值不敏感。常数平移、边界层厚度的整体偏移都可能落在低残差区域。所以数据项与边界项不能省，它们负责把解“钉”在正确的尺度和位置上。

## 实现与成本

残差反传的计算图比纯前向深得多：一次二阶导大约相当于多几次前向。显存紧张时可以用梯度检查点（`torch.utils.checkpoint`），用计算换显存；也可以只在部分查询点上计算残差，逐步增加点数。

混合精度需要谨慎：`autograd.grad` 在 `float16` 下容易产生下溢，残差项通常保持 `float32`，其余部分用 `bfloat16`。

两阶段训练在实践中很有效：第一阶段只开数据项，让网络学会大致结构；第二阶段加入残差并降低学习率。若一开始就开残差，随机初始化的输出会给出巨大的残差，梯度方向反而偏离数据。

## 小结

- PINO 在算子学习的数据损失上追加 PDE 残差与边界损失，训练一次即可对多组输入推理。
- 残差通过对坐标求自动微分得到，需要保留计算图，成本高于纯数据训练。
- 残差归一化、课程学习、多点采样与权重平衡是收敛的关键。
- 与[[ch5/pinns|PINN]]相比它学算子，与[[ch5/fno|FNO]]相比它多一层物理约束；定量比较见[[ch5/benchmarks|数据集与评价]]。

---
title: FNO：傅里叶神经算子
order: 2
summary: 用谱卷积在频域截断低频模态，学习从输入场到解场的算子；推导傅里叶层的离散形式，给出 SpectralConv2d 的 PyTorch 实现与分辨率泛化条件。
tags: [FNO, 神经算子, 谱卷积, 频域]
---

FNO 要学的不是某一个解，而是“给定任意输入场 $a$，输出对应解 $u$”的映射。它把卷积核搬到频域：在低频模态上做复数线性变换，再变换回物理空间。这样一次前向就能得到全场，而且同一组权重可以在不同分辨率上使用。

## 算子学习的目标

设算子 $G$ 把输入函数 $a$ 映到解 $u$：

$$
G: a(\mathbf{x}) \mapsto u(\mathbf{x}), \qquad \mathbf{x} \in \Omega \subset \mathbb{R}^2 .
$$

训练数据是若干组离散样本 $\{a_i, u_i\}_{i=1}^{N}$，每组都定义在 $n \times n$ 的规则网格上。网络 $\mathcal{N}_\theta$ 的目标是在网格上逐点匹配：

$$
\mathcal{N}_\theta(a_i)(\mathbf{x}_j) \approx u_i(\mathbf{x}_j),
\quad j = 1,\dots,n^2 .
$$

与 PINN 不同，这里没有“坐标输入”，输入是整个场；与 U-Net 不同，网络层本身带全局感受野，而不是靠堆叠下采样获得。

## 谱卷积

设第 $t$ 层的特征为 $v_t:\Omega \to \mathbb{R}^{c}$。FNO 层由三部分组成：逐点线性变换 $W$、谱卷积、偏置 $b$，再加激活 $\sigma$：

$$
v_{t+1}(\mathbf{x}) = \sigma\left(
W v_t(\mathbf{x})
+ \mathcal{F}^{-1}\left[ R_\phi \cdot \mathcal{F}(v_t) \right](\mathbf{x})
+ b
\right),
$$

其中 $\mathcal{F}$ 是二维傅里叶变换，$R_\phi$ 是可学习的复数权重。关键在于 $R_\phi$ 只作用在前 $k_{max}$ 个低频模态上，更高频的系数被直接置零。写成离散形式：

$$
\widehat{v}_{t+1}(k) = \sum_{j=1}^{c} R_{\phi,j}(k)\,\widehat{v}_{t,j}(k),
\qquad \Vert k \Vert_\infty \le k_{max},
$$

$k=(k_1,k_2)$ 是波数，$\widehat{v}$ 是傅里叶系数。低频承载大尺度结构，高频承载小尺度细节；截断 $k_{max}$ 相当于给算子一个可调的“带宽”。

### 与普通卷积的关系

由卷积定理，频域逐点相乘等价于空域的全域卷积。普通 $3\times3$ 卷积要覆盖 $128\times128$ 的场，需要堆叠数十层；谱卷积一次就把所有位置耦合起来，参数量只有 $k_{max}^2$ 个模态权重。代价是权重在全域共享，无法表达“位置相关”的卷积核——对几何变化剧烈的问题，这是明显限制。

### 为什么能跨分辨率

参数 $R_\phi$ 的维度只与通道数和 $k_{max}$ 有关，与网格数 $n$ 无关。把同一组权重复用到 $2n \times 2n$ 的网格上时，只需在新的频域网格上取对应的低频块。这被称为**离散化不变性**：算子作用在函数上，而网格只是它的一种表示。实际中高分辨率外推仍会衰减，因为训练时未见的高频模态被截断了。

:::note 边界条件
傅里叶变换隐含周期假设。对非周期问题，通常的做法是补零（zero-padding）后变换，或额外输入坐标通道让网络自己修正边界。完全依赖谱卷积处理强非周期边界，效果通常不好。
:::

## 网络结构

FNO 的前向分三步。

1. **Lifting**：用 $1\times1$ 卷积把输入通道（物理量 $a$，可选坐标通道）升到宽度 $w$，得到 $v_0$。
2. **Fourier blocks**：堆叠 $L$ 个谱卷积层，每层保持宽度 $w$ 不变，通道数不随深度变化。
3. **Projection**：用两层 $1\times1$ 卷积（中间加激活）把 $w$ 通道压到输出通道数，得到 $u$。

投影层之后通常不再接归一化，输出直接对应物理量（或标准化后的物理量）。推理时若训练阶段对标签做过标准化，必须在这里反变换，否则误差会被整体缩放掩盖。

| 超参数 | 典型取值 | 影响 |
| --- | --- | --- |
| 宽度 $w$ | 32–64 | 通道容量，过大易过拟合 |
| 模态数 $k_{max}$ | 8–16 | 保留的尺度范围，决定平滑程度 |
| 层数 $L$ | 4–6 | 感受野与非线性深度 |
| 网格 $n$ | 64–256 | 数据分辨率，与 $k_{max}$ 需匹配 |

$k_{max}$ 与 $n$ 的关系值得注意：$k_{max}$ 太接近 $n/2$，谱卷积退化为全局稠密变换，参数暴涨且容易过拟合；太小则连基本激波结构都表达不了。

参数量可以粗略估算：每个傅里叶块约 $2 w^2 k_{max}^2 + w^2$ 个参数，$w$ 为宽度。宽度 32、模态 12、四层时约百万量级，远小于同等感受野的深层 CNN。这也是 FNO 在中小规模数据上不易过拟合的原因之一。

## 损失函数

最常用的是相对 L2 损失，它对解的绝对量级不敏感：

$$
\mathcal{L}_{rel} = \frac{1}{N}\sum_{i=1}^{N}
\frac{\left\Vert \mathcal{N}_\theta(a_i) - u_i \right\Vert_2^2}
{\left\Vert u_i \right\Vert_2^2 + \varepsilon},
$$

$\varepsilon$ 是防止除零的小量。若更关心小尺度结构，可在频域加权：

$$
\mathcal{L}_{spec} = \frac{1}{N}\sum_{i=1}^{N}
\sum_{k} w(k)\,
\left\Vert \widehat{u}_\theta(k) - \widehat{u}_i(k) \right\Vert^2,
$$

$w(k)$ 随波数增大而增大，用于补偿高频能量偏小的问题。实践中更常见的是在相对 L2 上叠加一个梯度损失，形式更简单，效果也稳定。若训练集里各样本的幅值差异很大，可先对标签做标准化，再在推理时反变换，否则损失会被大幅值样本主导。

## PyTorch 实现

核心是二维实数傅里叶变换 `torch.fft.rfft2` 与逆变换 `irfft2`。权重声明为 `torch.cfloat`，只保留低频块。

```python
import torch
import torch.nn as nn
import torch.nn.functional as F

class SpectralConv2d(nn.Module):
    """二维谱卷积：仅在低频模态上做复数线性变换。"""
    def __init__(self, in_channels, out_channels, modes1, modes2):
        super().__init__()
        self.in_channels = in_channels
        self.out_channels = out_channels
        self.modes1 = modes1
        self.modes2 = modes2
        scale = 1.0 / (in_channels * out_channels)
        self.weights = nn.Parameter(
            scale * torch.randn(
                in_channels, out_channels, modes1, modes2, dtype=torch.cfloat
            )
        )

    def forward(self, x):
        # x: (B, C, H, W)
        b, _, h, w = x.shape
        x_ft = torch.fft.rfft2(x)                 # (B, C, H, W//2+1)
        out_ft = torch.zeros(
            b, self.out_channels, h, w // 2 + 1,
            dtype=torch.cfloat, device=x.device,
        )
        out_ft[:, :, :self.modes1, :self.modes2] = torch.einsum(
            "bixy,ioxy->boxy",
            x_ft[:, :, :self.modes1, :self.modes2],
            self.weights,
        )
        return torch.fft.irfft2(out_ft, s=(h, w))


class FNOBlock(nn.Module):
    """W v + 谱卷积 + 偏置，再激活。"""
    def __init__(self, width, modes1, modes2):
        super().__init__()
        self.spec = SpectralConv2d(width, width, modes1, modes2)
        self.pointwise = nn.Conv2d(width, width, 1)
        self.bias = nn.Parameter(torch.zeros(1, width, 1, 1))

    def forward(self, x):
        return F.gelu(self.spec(x) + self.pointwise(x) + self.bias)


class FNO2d(nn.Module):
    def __init__(self, modes1=12, modes2=12, width=32, layers=4,
                 in_ch=1, out_ch=1):
        super().__init__()
        self.lift = nn.Conv2d(in_ch + 2, width, 1)   # +2：坐标通道
        self.blocks = nn.ModuleList(
            [FNOBlock(width, modes1, modes2) for _ in range(layers)]
        )
        self.project = nn.Sequential(
            nn.Conv2d(width, 128, 1), nn.GELU(), nn.Conv2d(128, out_ch, 1)
        )

    def forward(self, a, grid):
        # a: (B, 1, H, W)，grid: (B, 2, H, W) 归一化坐标
        x = self.lift(torch.cat([a, grid], dim=1))
        for blk in self.blocks:
            x = blk(x)
        return self.project(x)
```

训练时用相对 L2：

```python
def relative_l2(pred, target, eps=1e-8):
    diff = (pred - target).reshape(pred.shape[0], -1)
    ref = target.reshape(target.shape[0], -1)
    return (diff.norm(dim=1) / (ref.norm(dim=1) + eps)).mean()

opt = torch.optim.Adam(model.parameters(), lr=1e-3)
for a, u, grid in loader:
    pred = model(a, grid)
    loss = relative_l2(pred, u)
    opt.zero_grad()
    loss.backward()
    opt.step()
```

## 与 PINN 的对比

| 维度 | FNO | PINN |
| --- | --- | --- |
| 学习对象 | 算子 $G$ | 单个解 $u$ |
| 输入 | 离散场 $a$ | 坐标 $(x,t)$ |
| 是否需要标签 | 需要成对数据 | 不需要 |
| 单次推理 | 一次前向，毫秒级 | 需要训练，不用于推理 |
| 分辨率 | 可跨分辨率复用权重 | 与配点无关 |
| 物理一致性 | 无保证，可加残差项 | 由损失直接约束 |

若数据充足、工况相似，FNO 的性价比通常高于 PINN；若数据几乎没有、需要满足守恒律，则应看[[ch5/pino|PINO]]。想用更少的参数获得更大的感受野，可继续读[[ch5/ifno|IFNO]]。

## 实现细节与稳定性

几个容易踩的点。

**频率存储。** `torch.fft.rfft2` 只返回非负频率，最后一维长度为 $W/2+1$，因此 `modes2` 不能超过这个值。负频率由 `irfft2` 依据共轭对称性自动恢复，手动补齐反而会破坏实值性。

**权重初始化。** 谱权重的方差按 $1/(c_{in}c_{out})$ 缩放，使初始输出与输入同量级。若初始化过大，前几层输出幅值爆炸，激活进入饱和区，梯度几乎为零。

**模态与网格匹配。** 截断过高会引入混叠：非线性激活产生的频率超出保留范围，折叠回低频，表现为不自然的条纹。经验上保留不超过 $2n/3$ 的频率：

$$
k_{max} \le \frac{2}{3}\cdot\frac{n}{2},
$$

$n$ 是网格边长。这条规则来自伪谱法的去混叠实践，在 FNO 中同样适用。

**归一化与学习率。** 输入按通道做 z-score，输出先标准化再算损失，推理时反变换。学习率从 $10^{-3}$ 起，配合余弦退火与梯度裁剪；谱层的复数参数对学习率比普通卷积更敏感，出现损失震荡时先降学习率，而不是加宽网络。

## 常见失败模式

- **边界振荡**：输入非周期却直接做傅里叶变换。解决方式是补零、加坐标通道，或改用局部卷积处理边界。
- **高频缺失**：$k_{max}$ 太小或训练集分辨率太低，输出过于平滑。可提高模态数或加入梯度损失。
- **外推崩溃**：训练只覆盖单一雷诺数，测试稍高就发散。这不是架构问题，而是分布问题，需要扩充数据。
- **损失停滞**：检查谱权重是否为零、`irfft2` 的 `s` 是否与输入尺寸一致。

## 小结

- FNO 层 = 逐点线性变换 + 低频谱卷积 + 偏置 + 激活，谱卷积承担全局耦合。
- 截断模态 $k_{max}$ 控制带宽，权重与网格无关，因此具备离散化不变性。
- 训练用相对 L2 即可；边界非周期时需补零或加坐标通道。
- 输出仍是“黑箱”，物理一致性需要额外约束，这是 PINO 的出发点。

---
title: U-Net 与场映射
order: 4
summary: 把 U-Net 看作像素到像素的场映射网络，说明编码-瓶颈-解码与 skip connection 的作用，给出稳态场预测、超分辨率与 LES 亚格子建模中的用法与 PyTorch 实现。
tags: [U-Net, 场映射, 超分辨率, 亚格子]
---

如果只想要一个能在一周内跑通的神经场模型，U-Net 通常是首选。它没有算子学习的理论包装，本质是一个“图像进、图像出”的卷积网络，但在稳态场预测、网格超分辨率与亚格子闭合上表现稳定，训练也远比 PINN 省心。

## 场映射的视角

把流场当成多通道图像：每个通道是一个物理量（$u$、$v$、$p$、$T$），像素是网格单元。网络学习映射

$$
\mathcal{N}_\theta: \mathbb{R}^{c_{in}\times H\times W}
\to \mathbb{R}^{c_{out}\times H\times W},
$$

输入与输出的空间尺寸相同，通道数可以不同。与[[ch5/fno|FNO]]的差别在于：FNO 在频域做全局卷积，U-Net 靠下采样扩大感受野，两者都能“看见”全局，但方式不同。

这类映射适合三类任务：

- **稳态场预测**：给定几何与边界条件编码，直接输出收敛后的压力、速度场。
- **超分辨率**：低分辨率解映射到高分辨率，学习缺失的高频结构。
- **亚格子建模**：从可解尺度场预测未解析的应力张量，替代[[ch4/les|LES]]中的 Smagorinsky 类模型。

与全卷积网络相比，U-Net 的下采样不只是为了省显存，更是为了构造多尺度表示。全局平均池化能带来全局感受野，但会丢掉空间位置；U-Net 通过 skip 把位置信息重新注入，因此在“既要全局压力分布、又要局部涡结构”的任务上表现均衡。一个 base=32 的四级 U-Net 约 7M 参数，$256\times256$ 的前向在消费级显卡上只需几十毫秒。

## 编码器、瓶颈与解码器

U-Net 的形状像字母 U，分三段。

1. **编码器**：反复“卷积 + 池化”，空间尺寸减半、通道数加倍。特征从像素级细节逐渐变为语义级结构。
2. **瓶颈**：最低分辨率的特征，感受野覆盖整幅图，承担全局信息。
3. **解码器**：反复“转置卷积（或上采样）+ 拼接 skip + 卷积”，把尺寸恢复到输入分辨率。

**skip connection** 把编码器同层的特征直接拼到解码器，使解码器同时拿到“深层语义”和“浅层细节”。没有 skip，高频结构会在下采样中丢失，输出会明显模糊。

感受野可以递推计算。设第 $l$ 层卷积核为 $k_l$、步长为 $s_l$，则到第 $L$ 层的等效感受野为

$$
R_L = 1 + \sum_{l=1}^{L}(k_l - 1)\prod_{i=1}^{l-1} s_i .
$$

以四次 $2\times2$ 池化、每级两个 $3\times3$ 卷积为例，$R$ 约为 $140$ 像素；这解释了为什么 U-Net 在 $128\times128$ 或 $256\times256$ 的场上够用，而对更大尺度仍需更深结构或注意力。

## 卷积与上采样

| 操作 | API | 作用 | 注意 |
| --- | --- | --- | --- |
| 普通卷积 | `nn.Conv2d(k=3, p=1)` | 提取局部特征，保持尺寸 | padding 决定边界行为 |
| 池化 | `nn.MaxPool2d(2)` | 降采样，扩大感受野 | 丢失精确位置信息 |
| 转置卷积 | `nn.ConvTranspose2d(k=2, s=2)` | 可学习的上采样 | 易产生棋盘格伪影 |
| 插值上采样 | `nn.Upsample(scale_factor=2)` | 固定插值，参数少 | 表达力弱于转置卷积 |
| 拼接 | `torch.cat` | 融合多尺度特征 | 通道数翻倍，后续卷积要匹配 |

棋盘格伪影来自转置卷积的核重叠不均匀。缓解办法是用 `kernel_size=4, stride=2` 的转置卷积，或先 `Upsample` 再跟一个普通卷积。后者参数更少，在数据量有限时往往更稳。

## 损失函数

最直接的是逐像素均方误差：

$$
\mathcal{L}_{mse} = \frac{1}{N\,c\,H\,W}
\sum_{i=1}^{N}\sum_{j=1}^{c}\sum_{\mathbf{x}}
\left( \hat u_{i,j}(\mathbf{x}) - u_{i,j}(\mathbf{x}) \right)^2 .
$$

物理量量级差异大时（压力与速度可差几个数量级），逐通道归一化后再算 MSE 更合理。另一种常用形式是相对 L2：

$$
\mathcal{L}_{rel} = \frac{1}{N}\sum_{i=1}^{N}
\frac{\left\Vert \hat u_i - u_i \right\Vert_2^2}
{\left\Vert u_i \right\Vert_2^2 + \varepsilon},
$$

它对整体幅值不敏感，适合比较不同工况。若希望边界严格满足，可追加边界损失：

$$
\mathcal{L}_{bc} = \frac{1}{N_b}\sum_{\mathbf{x}\in\partial\Omega}
\left( \hat u(\mathbf{x}) - g(\mathbf{x}) \right)^2 ,
$$

$g$ 是给定的边界值。对不可压场，还可以加连续性残差，用有限差分代替自动微分，代价很低：

$$
\mathcal{L}_{div} = \frac{1}{N}\sum_{\mathbf{x}}
\left( \partial_x \hat u + \partial_y \hat v \right)^2 .
$$

这一项对超分辨率任务尤其有用，因为纯 MSE 往往学不出无散度结构。

:::warning 归一化的坑
输入各通道若不做标准化，卷积核会偏向大量级通道，小量级通道（如压力脉动）几乎学不到。建议按训练集统计量做逐通道标准化，并把统计量随模型一起保存，推理时复用。
:::

## PyTorch 实现

```python
import torch
import torch.nn as nn
import torch.nn.functional as F

class DoubleConv(nn.Module):
    """两次 3x3 卷积，保持空间尺寸。"""
    def __init__(self, in_ch, out_ch):
        super().__init__()
        self.block = nn.Sequential(
            nn.Conv2d(in_ch, out_ch, 3, padding=1, bias=False),
            nn.BatchNorm2d(out_ch), nn.ReLU(inplace=True),
            nn.Conv2d(out_ch, out_ch, 3, padding=1, bias=False),
            nn.BatchNorm2d(out_ch), nn.ReLU(inplace=True),
        )

    def forward(self, x):
        return self.block(x)


class Down(nn.Module):
    def __init__(self, in_ch, out_ch):
        super().__init__()
        self.pool = nn.MaxPool2d(2)
        self.conv = DoubleConv(in_ch, out_ch)

    def forward(self, x):
        return self.conv(self.pool(x))


class Up(nn.Module):
    def __init__(self, in_ch, out_ch):
        super().__init__()
        self.up = nn.ConvTranspose2d(in_ch, in_ch // 2, 2, stride=2)
        self.conv = DoubleConv(in_ch, out_ch)

    def forward(self, x, skip):
        x = self.up(x)
        # 奇数分辨率下尺寸可能差 1 像素，先补齐再拼接
        dy = skip.size(-2) - x.size(-2)
        dx = skip.size(-1) - x.size(-1)
        x = F.pad(x, [dx // 2, dx - dx // 2, dy // 2, dy - dy // 2])
        return self.conv(torch.cat([skip, x], dim=1))


class UNet(nn.Module):
    def __init__(self, in_ch=3, out_ch=2, base=32):
        super().__init__()
        self.inc = DoubleConv(in_ch, base)
        self.d1 = Down(base, base * 2)
        self.d2 = Down(base * 2, base * 4)
        self.d3 = Down(base * 4, base * 8)
        self.u1 = Up(base * 8, base * 4)
        self.u2 = Up(base * 4, base * 2)
        self.u3 = Up(base * 2, base)
        self.outc = nn.Conv2d(base, out_ch, 1)

    def forward(self, x):
        x1 = self.inc(x)          # H x W
        x2 = self.d1(x1)          # H/2
        x3 = self.d2(x2)          # H/4
        x4 = self.d3(x3)          # H/8
        x = self.u1(x4, x3)
        x = self.u2(x, x2)
        x = self.u3(x, x1)
        return self.outc(x)
```

一个 2D 场回归的训练骨架：

```python
model = UNet(in_ch=3, out_ch=2).cuda()
opt = torch.optim.AdamW(model.parameters(), lr=1e-3, weight_decay=1e-4)
for epoch in range(200):
    for inputs, targets in loader:       # 形状 (B, C, H, W)
        pred = model(inputs)
        loss = relative_l2(pred, targets) # 可再加 0.1 * divergence_loss(pred)
        opt.zero_grad()
        loss.backward()
        opt.step()
```

## 与 FNO 的适用差异

| 维度 | U-Net | FNO |
| --- | --- | --- |
| 感受野来源 | 下采样堆叠 | 频域全局卷积 |
| 分辨率绑定 | 强，换分辨率常需重训 | 较弱，权重可复用 |
| 高频细节 | skip 保留较好 | 受 $k_{max}$ 截断限制 |
| 非周期边界 | 靠 padding 与数据学习 | 谱方法隐含周期，需补零 |
| 数据需求 | 中等，图像增强可用 | 较大，需覆盖多种输入 |
| 训练难度 | 低，容易收敛 | 对学习率与模态数敏感 |

经验上，几何固定、边界复杂、追求稳定复现的任务先用 U-Net；输入是大量相似场、需要跨分辨率泛化的任务用 FNO。若要在 U-Net 之上加物理约束，残差写法与[[ch5/pino|PINO]]一致。

## 多尺度与工程细节

标准 U-Net 的感受野靠池化扩展，代价是位置信息丢失。几种常见补足方式：

- **空洞卷积**：在不降分辨率的前提下扩大感受野，适合保留薄边界层。
- **注意力门**：在 skip 拼接前对编码器特征加权，抑制与目标无关的区域。
- **部分卷积**：输入含掩膜（如几何内部）时，只在有效像素上卷积，避免边界被零值污染。

训练大尺寸场时，整图送入显存往往不够。常用做法是切 patch：从 $256^2$ 的场中随机裁 $64^2$ 或 $128^2$ 的小块训练，推理时再滑窗拼接。切 patch 要注意边界效应——卷积在 patch 边缘看到的上下文不完整，拼接后可能出现接缝。缓解办法是重叠裁剪，或在 patch 内随机偏移采样位置。

另一个容易被忽略的点是数据增强的物理合法性。水平翻转对周期或对称几何有效，对带明确来流方向的绕流则不合理；旋转同理。错误的增强会让网络学到不存在的对称性，验证误差反而上升。

## 常见失败模式

- **过度平滑**：损失只看 MSE，高频结构被平均掉。加梯度损失或 H1 项可缓解。
- **边界外推失败**：训练集的边界条件单一，测试换成出口压力边界后误差骤增。
- **几何敏感**：把几何作为额外通道输入时，若几何编码分辨率过低，网络无法区分相近外形。
- **通道串扰**：多物理量未归一化，网络把容量都花在大量级通道上。

## 小结

- U-Net 是像素到像素的场映射，编码器降维、解码器复原，skip connection 保留高频。
- 感受野由卷积核与步长递推决定，$128$ 到 $256$ 的场通常四到五级足够。
- 损失以相对 L2 为主，按需追加边界项与散度项；归一化对多物理量场至关重要。
- 工程上先用小 base（16 或 32）跑通全流程，再按验证误差加宽，比一开始堆大模型更可靠。
- 它适合稳态场、超分与亚格子建模，跨分辨率泛化不如 FNO。

---
title: PINNs：物理信息神经网络
order: 1
summary: 用一个 MLP 表示解 u(x,t)，用自动微分计算 PDE 残差，把数据、方程、边界与初值四项损失加权组合，并讨论软硬约束、权重平衡与训练策略。
tags: [PINN, 物理约束, 自动微分, Burgers]
---

PINN 的出发点只有一句话：如果网络输出真的是 PDE 的解，那么把它代回方程，残差应当处处为零。于是“解方程”被改写为“最小化残差”，求导交给自动微分，求解交给优化器。这一节以 1D Burgers 方程为主线，把损失的四项、采样方式与训练难点讲清楚。

## 问题设定

考虑一维 Burgers 方程

$$
\frac{\partial u}{\partial t} + u\frac{\partial u}{\partial x}
= \nu \frac{\partial^2 u}{\partial x^2},
\qquad x \in [-1,1],\ t \in [0,1],
$$

其中 $\nu>0$ 是运动粘度，$u(x,t)$ 是速度。初值与边界取

$$
u(x,0) = -\sin(\pi x), \qquad u(-1,t)=u(1,t),\ \ u_x(-1,t)=u_x(1,t).
$$

这里 $\nu$ 很小时解会出现陡峭的激波层，正是 PINN 最容易失败的情形之一。

用多层感知机表示解：

$$
u(x,t) \approx u_\theta(x,t) = \mathcal{N}_\theta(x,t),
$$

$\theta$ 为网络权重与偏置。输入是两个标量坐标，输出是一个标量。坐标通常先归一化到 $[-1,1]^2$，否则不同量纲的输入会让网络的第一层尺度失衡。

## 自动微分与残差

PINN 不需要网格，也不需要差分格式。给定配点 $(x_i,t_i)$，用链式法则求 $u_t$、$u_x$、$u_{xx}$，代入方程得到残差

$$
r_\theta(x,t) = \partial_t u_\theta + u_\theta\,\partial_x u_\theta
- \nu\,\partial_{xx} u_\theta .
$$

在 PyTorch 中，这对应 `torch.autograd.grad`，且必须设置 `create_graph=True`，否则二阶导数无法继续回传。求二阶导的典型写法是对一阶导再求一次导：

$$
\partial_{xx} u_\theta
= \frac{\partial}{\partial x}\left(\frac{\partial u_\theta}{\partial x}\right).
$$

这个残差是“逐点”的，与网格无关，因此可以在任意坐标处评估——这也是 PINN 能处理复杂几何与逆问题的根源。

## 复合损失

训练集由四类点构成，每类点对应一项损失。

| 点集 | 采样方式 | 监督信号 | 作用 |
| --- | --- | --- | --- |
| 配点 $\Omega_r$ | 区域内随机或拉丁超立方 | 方程残差为零 | 保证 PDE 成立 |
| 边界点 $\Omega_b$ | 边界上均匀或随机 | 给定边界值 | 固定边界 |
| 初值点 $\Omega_i$ | $t=0$ 平面上采样 | 给定初始场 | 固定时间起点 |
| 观测点 $\Omega_d$ | 实验或仿真数据 | 测得的 $u$ | 校正偏差、逆问题 |

四项损失分别为

$$
\mathcal{L}_{data} = \frac{1}{N_d}\sum_{i=1}^{N_d}
\left( u_\theta(\mathbf{x}_i^d,t_i^d) - u_i^{obs} \right)^2,
$$

$$
\mathcal{L}_{pde} = \frac{1}{N_r}\sum_{i=1}^{N_r}
r_\theta(x_i^r,t_i^r)^2,
$$

$$
\mathcal{L}_{bc} = \frac{1}{N_b}\sum_{i=1}^{N_b}
\left( u_\theta(\mathbf{x}_i^b,t_i^b) - g(\mathbf{x}_i^b,t_i^b) \right)^2,
$$

$$
\mathcal{L}_{ic} = \frac{1}{N_i}\sum_{i=1}^{N_i}
\left( u_\theta(x_i,0) - u_0(x_i) \right)^2 .
$$

总损失为加权和

$$
\mathcal{L}(\theta) = \lambda_d \mathcal{L}_{data}
+ \lambda_r \mathcal{L}_{pde}
+ \lambda_b \mathcal{L}_{bc}
+ \lambda_i \mathcal{L}_{ic},
$$

$\lambda$ 的取值直接决定训练是否收敛：$\lambda_r$ 太大，网络会先学会“处处为零”的平凡解；太小，则方程约束形同虚设。

## 软约束与硬约束

**软约束**把边界与初值当作罚项，就是上面的 $\mathcal{L}_{bc}$ 与 $\mathcal{L}_{ic}$。实现简单，但需要调权重，且边界误差会随训练震荡。

**硬约束**把边界条件写进网络结构，使输出天然满足。例如对一维 Dirichlet 问题，可构造

$$
\hat u_\theta(x) = u_b(x) + (x-a)(b-x)\,\mathcal{N}_\theta(x),
$$

其中 $u_b(x)$ 是满足两端边界值的插值函数，$(x-a)(b-x)$ 在 $x=a,b$ 处为零。这样 $\mathcal{L}_{bc}$ 可以完全去掉，优化只面对 PDE 残差。代价是构造项与几何绑定，复杂外形下不易推广。

:::note 选择建议
边界形状简单、边界值恒定时优先用硬约束；几何复杂或边界随时间变化时用软约束，并给 $\lambda_b$ 一个较大的初值。
:::

## 权重平衡与训练策略

四项损失的量级往往差几个数量级，固定权重很难兼顾。常见做法有三类。

**梯度范数平衡。** 每若干步统计各损失对最后一层权重的梯度范数，令权重反比于梯度尺度：

$$
\lambda_k \leftarrow \frac{\hat\lambda_k}{\mathrm{mean}\left(\left\Vert \nabla_\theta \mathcal{L}_k \right\Vert\right)},
$$

$\hat\lambda_k$ 是基准权重。这样可以让每项对参数更新的贡献相近。

**自适应权重。** 把 $\lambda_k$ 设为可训练变量（如 SA-PINN），用极大似然形式给残差项加对数方差，让网络自己学“哪一项更可信”。缺点是额外参数容易与主损失耦合，训练后期可能退化。

**因果训练。** 对时间依赖问题，按时间窗口分段推进：先在前段时间上把残差压下去，再逐步扩展到后面。若一次性在全程采样，误差会从 $t=0$ 向后传播，表现为后期解偏离。因果训练相当于给损失加了一个时间上的课程。

还有一种常用的自适应加密（RAR）：先用较少的配点训练到收敛，再在残差最大的位置补充配点，重复若干轮。它把采样预算集中到最难满足的区域，对激波与边界层尤其有效。与固定网格相比，RAR 的配点分布随训练变化，实现上要保持每批点的总量稳定，避免后期显存溢出。

:::warning 刚性方程的陷阱
当 $\nu$ 很小、激波很陡时，残差在激波附近极大，梯度会主导训练，网络倾向于把激波抹平以降低平均残差。此时应加密激波附近的配点，或改用分段时间推进，而不是一味增大网络宽度。
:::

## PyTorch 实现

下面的片段保留核心逻辑：MLP、残差函数与四项损失的训练循环。

```python
import torch
import torch.nn as nn

class MLP(nn.Module):
    """输入 (x, t)，输出 u；Tanh 激活对二阶导数更友好。"""
    def __init__(self, in_dim=2, hidden=64, depth=4):
        super().__init__()
        layers = [nn.Linear(in_dim, hidden), nn.Tanh()]
        for _ in range(depth - 1):
            layers += [nn.Linear(hidden, hidden), nn.Tanh()]
        layers += [nn.Linear(hidden, 1)]
        self.net = nn.Sequential(*layers)

    def forward(self, xt):
        return self.net(xt)


def pde_residual(model, xt, nu):
    """Burgers 残差 r = u_t + u u_x - nu u_xx；xt 形状为 (N, 2)。"""
    xt = xt.clone().detach().requires_grad_(True)
    u = model(xt)
    du = torch.autograd.grad(
        u, xt, grad_outputs=torch.ones_like(u), create_graph=True
    )[0]
    u_x, u_t = du[:, 0:1], du[:, 1:2]
    u_xx = torch.autograd.grad(
        u_x, xt, grad_outputs=torch.ones_like(u_x), create_graph=True
    )[0][:, 0:1]
    return u_t + u * u_x - nu * u_xx


def sample_domain(n, device):
    """在 [-1,1] x [0,1] 内均匀随机取配点。"""
    x = -1.0 + 2.0 * torch.rand(n, 1, device=device)
    t = torch.rand(n, 1, device=device)
    return torch.cat([x, t], dim=1)


def train(model, nu=0.01 / torch.pi, steps=20000, device="cpu"):
    model.to(device)
    opt = torch.optim.Adam(model.parameters(), lr=1e-3)
    for step in range(steps):
        xt_r = sample_domain(2048, device)          # 配点
        xt_i = sample_domain(256, device)
        xt_i[:, 1] = 0.0                             # 初值点：t = 0
        x_b = -1.0 + 2.0 * torch.rand(256, 1, device=device)
        t_b = torch.rand(256, 1, device=device)

        r = pde_residual(model, xt_r, nu)
        loss_r = (r ** 2).mean()

        u_i = model(xt_i)
        loss_i = ((u_i - (-torch.sin(torch.pi * xt_i[:, 0:1]))) ** 2).mean()

        # 周期边界：左右两端函数值相等（一阶导条件可再追加一项）
        xt_left = torch.cat([-torch.ones_like(t_b), t_b], dim=1)
        xt_right = torch.cat([torch.ones_like(t_b), t_b], dim=1)
        u_left, u_right = model(xt_left), model(xt_right)
        loss_b = ((u_left - u_right) ** 2).mean()

        loss = 1e-2 * loss_r + 1.0 * loss_b + 1.0 * loss_i
        opt.zero_grad()
        loss.backward()
        opt.step()

        if step % 2000 == 0:
            print(f"step {step:6d}  pde {loss_r.item():.3e}  "
                  f"ic {loss_i.item():.3e}  bc {loss_b.item():.3e}")
```

注意 `pde_residual` 里对输入做了 `detach().requires_grad_()`，避免把采样过程的反向图带进来；`u_x` 再次求导时必须保留计算图，否则二阶项为空。

## 优点与局限

| 维度 | 表现 | 说明 |
| --- | --- | --- |
| 数据需求 | 低 | 无标签也能训练，适合实验数据稀缺的场景 |
| 逆问题 | 强 | 把未知参数设为可训练变量，与网络联合优化 |
| 几何适应性 | 强 | 残差在任意坐标评估，无需贴体网格 |
| 高维问题 | 弱 | 配点数量随维度指数增长，5 维以上成本陡增 |
| 刚性/多尺度 | 弱 | 激波、边界层处残差集中，需要加密与分段训练 |
| 训练成本 | 高 | 每个配点都要反传二阶导，通常比一次 CFD 求解慢 |

一张实用的判断表：若问题是“一个几何、少量观测、要求反演参数”，PINN 很合适；若是“大量相似工况、要求毫秒级推理”，应转向[[ch5/fno|FNO]]或[[ch5/pino|PINO]]。定量对比与实验设置见[[ch5/benchmarks|数据集与评价]]。

## 逆问题

PINN 最实用的场景之一是参数反演。把未知的粘度写成可训练变量：

$$
\nu = \mathrm{softplus}(\phi), \qquad \phi \in \mathbb{R},
$$

$\mathrm{softplus}$ 保证正值。训练时 $\phi$ 与网络参数一起进入优化器，损失只保留观测点上的数据项与方程残差。若观测稀疏，$\phi$ 与解之间存在多解性，需要初值或额外约束（如总耗散）来定解。

这也是 PINN 相对纯数据模型的优势：方程提供了观测点之间的关联，使少量测点也能约束全局参数。

## 常见失败模式

- 损失不降：先检查配点是否覆盖了激波与边界层，再检查权重是否失衡。
- 解趋于常数：$\lambda_r$ 过大或网络过窄，网络选择平凡解降低平均残差。
- 边界漂移：$N_b$ 太少或 $\lambda_b$ 太小，增加边界点通常比调网络有效。
- 训练后期震荡：学习率过高，或四项损失量级差太大，改用梯度归一化。

## 小结

- PINN 用 MLP 表示解，用自动微分得到 PDE 残差，把求解变成无约束优化。
- 四项损失分别约束数据、方程、边界与初值；权重平衡比网络结构更影响成败。
- 硬约束适合简单边界，软约束更通用；因果训练能缓解时间方向的误差累积。
- 下一步可读[[ch5/pino|PINO]]，看看如何把残差损失从“单实例”推广到“算子”。

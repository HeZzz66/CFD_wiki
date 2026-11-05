---
title: matplotlib 与 PyVista 出版级出图
order: 4
summary: 用 matplotlib 做二维等值线、伪彩色、矢量与流线，用 PyVista 做三维切片、等值面与流线，并讨论配色、色标、矢量导出以及 Tecplot 与 Python 的分工。
tags: [matplotlib, PyVista, 科研绘图, 配色]
---

一张合格的 CFD 图要同时满足四件事：物理上正确、读得清楚、可以复现、对读者友好。软件能帮你完成第三件的一部分，前两件靠判断，最后一件靠规范。这一页讲的是把已经算好的数组变成图，不涉及数据读取与派生量计算；那两部分分别在前两页。依赖为 `numpy` 与 `matplotlib`，三维部分另需 `pyvista`。

## 出版图的四条标准

**物理正确**指图上的每个量都有明确的定义与参考量。色标写 `p [Pa]` 还是 `Cp`，坐标是 $x/L$ 还是毫米，切片在哪个位置，这些信息缺一项，图就不可复核。

**读得清楚**指在最终印刷尺寸下仍然可读。很多图在屏幕上很漂亮，缩到单栏宽度后字变成 4 pt、线变成发丝。正确做法是先定最终宽度，再按这个宽度设置字号与线宽。

**可以复现**指图由脚本生成，而不是手工拖拽。脚本、数据版本、配色与坐标范围都进版本库。半年后要改一个标签，只需改一行。

**对读者友好**指不依赖单一颜色通道。红绿色盲、黑白打印、投影仪偏色都会改变颜色的观感。用明度差异、等值线、线型与直接标注来补充颜色。

## 尺寸、字体与导出

期刊通常按栏宽给图：单栏约 8 到 9 cm，双栏约 17 到 18 cm。先确定宽度，再由像素需求反推分辨率：

$$
N_{\mathrm{px}} = \frac{w_{\mathrm{cm}}}{2.54}\,\mathrm{dpi}.
$$

例如 8 cm 宽、300 dpi，约需 945 像素；600 dpi 则约 1890 像素。矢量格式没有这个限制，但位图化的等值面仍要按 dpi 导出。

matplotlib 的 `figsize` 单位是英寸，所以常用一个换算常数：

```python
cm = 1.0 / 2.54
fig, ax = plt.subplots(figsize=(8 * cm, 5 * cm), constrained_layout=True)
```

字号在最终尺寸下取 7 到 9 pt，坐标轴标签 8 到 10 pt，标题 9 到 11 pt。线宽不小于 0.5 pt，坐标轴线宽 0.6 到 0.8 pt。把这些写进全局配置，比每张图单独调更一致：

```python
import matplotlib as mpl

mpl.rcParams.update({
    "font.size": 8,
    "font.family": "DejaVu Sans",
    "axes.linewidth": 0.6,
    "xtick.major.width": 0.6,
    "ytick.major.width": 0.6,
    "xtick.direction": "in",
    "ytick.direction": "in",
    "legend.frameon": False,
    "pdf.fonttype": 42,
    "ps.fonttype": 42,
    "savefig.bbox": "tight",
})
```

`pdf.fonttype=42` 把字体以 TrueType 嵌入 PDF，避免投稿系统提示“字体未嵌入”。`savefig.bbox="tight"` 去掉多余白边，但会让不同图的最终宽度略有差异；需要严格对齐时改为固定 `figsize` 加 `subplots_adjust`。

## 二维标量场：contour 与 pcolormesh

二维标量场有两种常用画法。`contourf` 画填充等值线，适合连续、光滑的量；`pcolormesh` 按单元填色，适合有限体积的单元中心数据，不引入额外插值。

```python
import numpy as np
import matplotlib.pyplot as plt
from matplotlib.colors import TwoSlopeNorm

x = np.linspace(-2.0, 2.0, 240)
y = np.linspace(-1.0, 1.0, 120)
X, Y = np.meshgrid(x, y)

Z = (1.0 - X**2) * np.exp(-(X**2 + Y**2))

levels = np.linspace(-1.0, 1.0, 21)
norm = TwoSlopeNorm(vmin=-1.0, vcenter=0.0, vmax=1.0)

fig, ax = plt.subplots(figsize=(8 / 2.54, 5 / 2.54), constrained_layout=True)
cs = ax.contourf(X, Y, Z, levels=levels, cmap="RdBu_r", norm=norm, extend="both")
cb = fig.colorbar(cs, ax=ax, label=r"$C_p$")
ax.set_xlabel(r"$x/c$")
ax.set_ylabel(r"$y/c$")
ax.set_aspect("equal")
fig.savefig("cp.pdf")
fig.savefig("cp.png", dpi=600)
```

要点：

- `levels` 取奇数个，让零值落在中间一条等值线上；配 `TwoSlopeNorm` 可保证白色恰好对应零。
- `extend="both"` 表示色标两端有超出范围的值，否则极值会被悄悄截断。
- `set_aspect("equal")` 保证几何不变形；如果坐标量纲不同（例如 $x$ 用米、$y$ 用毫米），先换算再画。
- 单元中心数据用 `pcolormesh(x, y, Z, shading="auto")`，不要用 `contourf`，否则等值线会平滑掉单元间的间断。
- 需要看精细结构时，用 `contour` 画线而不是填色；线图不会掩盖小的过冲。

:::note 色标范围要跨图统一
同一物理量在不同工况、不同切片上比较时，固定 `vmin` 与 `vmax`。自动范围会让每张图都“很好看”，但读者无法比较。范围应在图注中写明，或在色标上直接标出。
:::

## 矢量图与流线

矢量图用 `quiver`。关键是抽稀：每个网格点都画箭头，图会变成一团黑。按步长取样后，再调 `scale` 与箭头大小。

```python
U = -Y * np.exp(-(X**2 + Y**2))
V = X * np.exp(-(X**2 + Y**2))

fig, ax = plt.subplots(figsize=(8 / 2.54, 5 / 2.54), constrained_layout=True)
step = 8
ax.quiver(
    X[::step, ::step], Y[::step, ::step],
    U[::step, ::step], V[::step, ::step],
    color="0.25", pivot="mid", scale=18, width=0.002,
)
ax.set_aspect("equal")
fig.savefig("vectors.pdf")
```

`scale` 越大箭头越短；`pivot="mid"` 让箭头以取样点为中心，避免整体偏移。三维矢量图不适合用 matplotlib，交给 PyVista 的 glyph。

流线用 `streamplot`，它要求一维坐标与二维速度场：

```python
fig, ax = plt.subplots(figsize=(8 / 2.54, 5 / 2.54), constrained_layout=True)
strm = ax.streamplot(
    x, y, U, V,
    density=1.2, color="0.2", linewidth=0.6,
    arrowsize=0.6, integration_direction="both",
)
ax.set_aspect("equal")
ax.set_xlim(x[0], x[-1])
ax.set_ylim(y[0], y[-1])
fig.savefig("streamlines.pdf")
```

`density` 控制种子密度，过大线条会互相缠绕。非均匀网格要先插值到均匀网格，否则 `streamplot` 会报维度不匹配。流线颜色可以映射速度模长，但要注意：颜色与线宽同时编码同一物理量，会造成重复编码。

## 三维：用 PyVista

matplotlib 的 3D 能力适合散点与简单曲面，不适合切片、等值面与体渲染。三维场交给 PyVista，它基于 VTK，能直接读 `.vtu`、`.vtk`、OpenFOAM，也能离屏渲染。

下面的代码生成一个解析场，做三向切片、等值面与流线，并导出位图：

```python
import numpy as np
import pyvista as pv

mesh = pv.ImageData(dimensions=(60, 40, 30))
mesh.origin = (-1.0, -1.0, 0.0)
mesh.spacing = (2.0 / 59, 2.0 / 39, 1.0 / 29)

pts = mesh.points
mesh["p"] = pts[:, 0] * np.exp(-(pts[:, 0]**2 + pts[:, 1]**2))
mesh["U"] = np.column_stack([
    -pts[:, 1], pts[:, 0], np.zeros(mesh.n_points),
])

slices = mesh.slice_orthogonal()
iso = mesh.contour([0.2, 0.5], scalars="p")
streams = mesh.streamlines(
    vectors="U",
    source_center=(0.0, 0.0, 0.5),
    source_radius=0.25,
    n_points=40,
    max_length=3.0,
    integrator_type="rk4",
)

pl = pv.Plotter(shape=(1, 2), off_screen=True, window_size=(2400, 1000))
pl.subplot(0, 0)
pl.add_mesh(slices, scalars="p", cmap="RdBu_r", clim=(-1.0, 1.0),
            scalar_bar_args={"title": "p [Pa]"})
pl.subplot(0, 1)
pl.add_mesh(streams.tube(radius=0.02), color="0.2")
pl.add_mesh(iso, color="0.6", opacity=0.6)
pl.add_mesh(mesh.outline(), color="k")
pl.screenshot("panel.png")
pl.close()
```

说明：

- `slice_orthogonal()` 一次给出三个中截面；要任意平面用 `mesh.slice(normal=..., origin=...)`。
- `contour` 的第二个参数是等值列表，`scalars` 指定变量名。等值面单独渲染时，给一个中性灰比用彩虹色更清楚。
- `streamlines` 需要点数据里的矢量。若矢量存在单元数据，先 `cell_data_to_point_data()`。
- `tube(radius=...)` 把折线变成管，渲染更稳；半径按模型尺度取，不要硬编码成 1。
- `off_screen=True` 适合服务器批处理；交互查看时去掉它，用 `pl.show()`。
- `screenshot` 输出 PNG。要矢量图用 `pl.save_graphic("panel.svg")`，但半透明与体渲染在矢量格式里可能被栅格化。

PyVista 也可以直接读结果文件，不需要先转格式：

```python
mesh = pv.read("flow.vtu")
print(mesh.array_names, mesh.n_points, mesh.n_cells)
```

如果读 OpenFOAM，用 `pv.OpenFOAMReader`，详见 [[ch6/python-io|Python 读写]]。

## 配色与色标

配色不是审美问题，而是编码问题。选错色标，读者会读出不存在的高低起伏。

| 数据特征 | 推荐色标 | 说明 |
| --- | --- | --- |
| 单向大小（速度、压力幅值） | `viridis`、`cividis`、`magma` | 明度单调，灰度打印仍可读 |
| 有正负与零基准（Cp） | `RdBu_r`、`coolwarm` | 发散型，零值居中 |
| 周期性相位 | `twilight`、`hsv` | 首尾颜色连续 |
| 分类/离散 | `Set2`、`tab10` | 类别间差异明显 |

不要用 `jet`。它的明度不单调，会在中间亮度处制造虚假的“条带”，且红绿相邻对色盲不友好。很多期刊明确要求避免彩虹色标。

色标的细节：

- 标签写物理量与单位，例如 `p [Pa]`、`Cp [-]`；不要只写变量名。
- 刻度取 5 到 7 个，与等值线层级对齐；太密会挤成一团。
- 需要强调零值时用 `TwoSlopeNorm`，并让零值对应白色或中性色。
- 多图共享色标时，只保留一个 colorbar，放在图组右侧；不要每张子图各放一个。
- 离散数据的 colorbar 用 `BoundaryNorm` 或 `contourf` 的 `levels`，避免连续渐变暗示不存在的中间值。

```python
from matplotlib.colors import BoundaryNorm

bounds = np.linspace(-1.0, 1.0, 11)
cmap = plt.get_cmap("RdBu_r", len(bounds) - 1)
norm = BoundaryNorm(bounds, cmap.N)
```

离散色标让读者能准确读出区间，而不是估计颜色。对分类场（例如不同材料区）尤其重要。

## 多子图与版式

多子图最难的不是画，而是对齐。推荐 `constrained_layout` 或 `GridSpec`，并遵守三条：

1. 同一行子图的坐标范围一致，共享 x 轴；同一列共享 y 轴。
2. 物理量相同的子图共用一个 colorbar。
3. 子图编号 `(a)`、`(b)` 放在左上角，用 `ax.text` 而不是标题。

```python
fig, axes = plt.subplots(1, 2, figsize=(17 / 2.54, 6 / 2.54),
                         constrained_layout=True, sharey=True)
for ax, label in zip(axes, ["(a)", "(b)"]):
    ax.text(-0.12, 1.02, label, transform=ax.transAxes,
            fontsize=9, fontweight="bold", va="bottom")
fig.savefig("compare.pdf")
```

子图标题会与编号冲突，能用坐标轴标签说明的就不要用标题。期刊图注通常单独排版，图内信息越少越好。

## Tecplot 与 Python 的分工

两者不是替代关系，各自有明确的强项：

| 任务 | Tecplot | Python |
| --- | --- | --- |
| 交互查看流场、调视角 | 强 | 一般 |
| 切片、等值面、流线快速探索 | 强 | 需要写代码 |
| 批量处理上百个工况 | 宏，够用 | 强 |
| 自定义派生量与统计 | 公式能力有限 | 强 |
| 三维渲染与动画 | 开箱即用 | PyVista 可做，配置更多 |
| 二维曲线与论文排版 | 一般 | matplotlib 强 |
| 可复现与版本管理 | 宏可复现 | 脚本最强 |

一个实用的流程是：用 Tecplot 快速看流场、找切片位置与视角；把确定的切片位置、色标范围写进 Python 脚本，批量出二维图与积分量；需要三维渲染时，再用 PyVista 或回到 Tecplot 出最终图。中间数据用 `.vtu`、`.plt` 或 CSV 交换。

不要在两套工具里各调一次色标。以 Python 脚本里的 `vmin/vmax` 为准，Tecplot 手动设为相同值；否则同一篇论文里的两张图会对不上。

## 一张图的检查清单

1. 色标有物理量与单位，范围与图注一致。
2. 坐标轴有量纲或无量纲说明，几何比例正确。
3. 等值线层级与色标刻度对齐，没有未标注的截断。
4. 没有使用 `jet`；灰度打印后主要结构仍在。
5. 字号在最终尺寸下不小于 7 pt，线宽不小于 0.5 pt。
6. 线条图导出 PDF/SVG，位图导出 300 dpi 以上。
7. 图由脚本生成，脚本与数据版本可追溯。

:::tip 先灰度打印
把图转成灰度看一眼。如果主要结构消失，说明信息只靠颜色编码。用等值线、线型、直接标注或明度差补充，让黑白读者也能读到同样的结论。
:::

## 与上一章的接口

[[ch6/postprocessing|核心算法]] 返回的是数组：Cp 是 `(nx, ny)` 或 `(n_wall,)`，Q 是三维场，雷诺应力是 `3x3` 张量。这一页的函数只接受这些数组，不读文件、不算物理量。保持这个边界，图才能换数据、数据才能换图，两者都不会互相拖累。

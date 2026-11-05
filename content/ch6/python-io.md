---
title: 用 Python 读写 CFD 数据
order: 2
summary: 覆盖 numpy 结构化数组、h5py 分块读写、PyVista 读取 OpenFOAM 与 VTK、CGNS、Fortran unformatted 记录以及 CSV 与 memmap 大文件处理，每类给出可运行代码。
tags: [Python, HDF5, VTK, OpenFOAM, 数据读写]
---

后处理脚本的第一行不是画图，而是把数据读成 numpy 数组。读错了，后面所有的插值、积分与配色都失去意义。这一页按“内存中的表示—容器格式—求解器格式—老式二进制—大文件策略”展开，每一类都给可直接运行的代码。除特别说明外，依赖为 `numpy`、`scipy`、`h5py`、`pyvista`。

## 统一的数据视图

无论文件长什么样，读进内存后最好统一成三组数组：坐标 `coords`（形状 `(Np, 3)`）、场 `fields`（形状 `(Np, Nv)` 或 `(Nc, Nv)`）、连接关系 `cells`（形状 `(Nc, k)` 或面导向的 `owner/neighbour`）。先统一，再计算；不要把“读文件”和“画图”混在一个函数里。

内存占用可以先估算。若点数为 $N_p$、每个点保存 $N_v$ 个双精度变量，则

$$
M = 8 N_p N_v \ \mathrm{bytes}.
$$

一百万点、十个变量约 80 MB，尚可放进内存；一亿点、二十个变量就是 16 GB，必须分块或内存映射。下面的每种格式，都在回答“怎样只读需要的那一块”。

## numpy 结构化数组

结构化数组把一条记录的全部字段放在连续内存里，适合“一个点一行”的表格数据。它比“一个变量一个数组”更接近文件布局，读写时不需要反复拼接。

```python
import numpy as np

dtype = np.dtype([
    ("x", "<f8"), ("y", "<f8"), ("z", "<f8"),
    ("u", "<f4"), ("v", "<f4"), ("w", "<f4"), ("p", "<f4"),
])

n = 8
data = np.zeros(n, dtype=dtype)
data["x"] = np.linspace(0.0, 1.0, n)
data["p"] = np.arange(n, dtype=np.float32)

np.save("points.npy", data)
back = np.load("points.npy")
assert back.dtype == dtype

mask = back["p"] > 2.0
print(back[mask]["u"])
```

`np.save` 会保留字段名、字段类型与字节序，这是 CSV 做不到的。字段访问 `back["p"]` 返回的是视图而不是拷贝，修改它会改回原数组；需要独立副本时用 `.copy()`。

结构化数组的弱点是线性代数不方便。要做矩阵运算，先按字段拼成普通二维数组：

```python
coords = np.column_stack([back["x"], back["y"], back["z"]])
velocity = np.column_stack([back["u"], back["v"], back["w"]])
```

反过来，从二维数组写回结构化数组时，逐字段赋值即可。字段名建议与求解器变量名一致，但不要依赖大小写：读入后统一转成小写，写文件前再映射回求解器的命名。

## HDF5：分块、压缩与部分读取

HDF5 是容器，不是 CFD 专用格式。它用“组—数据集—属性”组织任意数组，支持分块、压缩、并行 I/O。CGNS 的 HDF5 版本、很多求解器的重启文件、机器学习数据集都建立在这一层。

分块（chunking）决定 I/O 的粒度。一个数据集的逻辑形状可以是 `(nt, np, 3)`，但物理上按 `(1, 256, 3)` 的小块存放。读取 `dset[t, 100:200, :]` 时，HDF5 只加载覆盖这个范围的分块，而不是整个数据集。

```python
import h5py
import numpy as np

nsteps, npts = 20, 1000

with h5py.File("flow.h5", "w") as f:
    f.attrs["units"] = "SI"
    f.attrs["source"] = "solver restart"
    dset = f.create_dataset(
        "velocity",
        shape=(nsteps, npts, 3),
        dtype="f4",
        chunks=(1, 256, 3),
        compression="gzip",
        compression_opts=4,
    )
    for t in range(nsteps):
        dset[t] = np.random.rand(npts, 3).astype("f4")

with h5py.File("flow.h5", "r") as f:
    print("chunks:", f["velocity"].chunks)
    print("shape:", f["velocity"].shape)
    u = f["velocity"][5, 100:200, :]
    print(u.shape)
```

几个实践要点：

- **分块形状要匹配读取模式。** 按时间步读就用 `(1, ...)`；按空间切片读就把空间维度分块。分块过小，元数据开销大；过大，部分读取退化为整块读取。
- **压缩不是越多越好。** gzip 级别 4 左右通常够用；级别 9 省空间但显著拖慢写入。浮点场压缩率一般，别期待文本格式那种数量级的缩减。
- **属性放元数据。** 单位、参考量、求解器版本、时间写进 `attrs`，不要只靠文件名。
- **并发读用 `swmr`。** 写入端以 `libver="latest"` 打开并启用 `swmr_mode`，读取端可以边写边读；并行写则需要 MPI 编译的 HDF5 与 `mpi4py`。

:::note 先看结构再读数据
拿到一个陌生的 `.h5`，先打印树状结构：`f.visititems(lambda n, o: print(n, type(o).__name__))`。很多“读不出来”其实是数据集名字与预期不同，例如 `U` 存在 `/fields/velocity` 下，而不是根组。
:::

## VTK 与 PyVista

VTK 的数据模型分四层：点（points）、单元（cells）、点数据（point data）、单元数据（cell data）。PyVista 把这层包装成 Python 对象，读写 `.vtk`、`.vtu`、`.vtp`、`.vts` 都不需要记格式细节。

先写一个带点数据的 `.vtu`，再读回：

```python
import numpy as np
import pyvista as pv

mesh = pv.Sphere(theta_resolution=30, phi_resolution=30)
mesh["pressure"] = mesh.points[:, 2].astype(np.float64)
mesh["velocity"] = np.column_stack([
    -mesh.points[:, 1],
    mesh.points[:, 0],
    np.zeros(mesh.n_points),
])

mesh.save("sphere.vtu")
back = pv.read("sphere.vtu")
print(back.n_points, back.array_names)
print(back["pressure"].min(), back["pressure"].max())
```

### 读取 OpenFOAM

PyVista 的 `OpenFOAMReader` 直接读算例目录。它需要一个 `.foam` 标记文件，内容可以为空：

```python
from pathlib import Path
import pyvista as pv

case = Path("cavity")
marker = case / "cavity.foam"
if marker.exists():
    reader = pv.OpenFOAMReader(str(marker))
    reader.set_active_time_value(0.5)
    mesh = reader.read()
    print(mesh.n_points, mesh.array_names)
else:
    print("请把 case 换成实际的 OpenFOAM 算例目录")
```

`set_active_time_value` 按物理时间选帧；也可以用 `set_active_time_index` 按序号选。读入后，内部面与边界面会按 `boundary` 名称分组，`mesh.array_names` 里能看到 `U`、`p`、`k` 等变量。OpenFOAM 的 `p` 在不可压缩算例中是运动压力，单位是 $\mathrm{m^2/s^2}$，不要当成 Pa。

### 点数据与单元数据

求解器常把压力存在单元中心。VTK 允许点数据与单元数据同时存在，但画等值线需要点数据：

```python
point_mesh = mesh.cell_data_to_point_data()
slice_2d = point_mesh.slice(normal="z", origin=(0.0, 0.0, 0.05))
slice_2d.save("slice.vtu")
```

反向转换用 `point_data_to_cell_data()`。转换本身是插值，会在间断处抹平峰值；需要严格守恒的积分应在原始单元数据上做，而不是转到点数据后再积分。

## CGNS 简介

CGNS 是面向 CFD 的层次化标准，按“基—区域—网格—解—边界条件”组织，底层通常是 HDF5。它的语义比 VTK 完整：边界类型、参考量、无量纲化信息可以随文件保存。

读取 CGNS 有两个层次。生产脚本优先用 `pycgns`，它按 SIDS 路径访问节点；如果只想快速查看结构，可以用 `h5py` 直接遍历 HDF5 组：

```python
import h5py

with h5py.File("case.cgns", "r") as f:
    def show(name, obj):
        if isinstance(obj, h5py.Dataset):
            print(name, obj.shape, obj.dtype)
    f.visititems(show)
```

输出会出现 `Base/Zone0/GridCoordinates/CoordinateX` 这类路径。节点名由 SIDS 规范定义，不能凭猜测拼路径；这也是为什么直接读 HDF5 只适合检查，不适合做稳定的生产脚本。

`meshio` 也能读写部分 CGNS 文件，适合在 VTK 与 CGNS 之间转换。转换后边界条件通常丢失，需要重新从求解器日志或配置文件补回。

## Fortran unformatted 二进制记录

很多老求解器用 Fortran 的 sequential unformatted 写文件。它的结构是“记录长度—数据—记录长度”：

$$
\underbrace{n}_{4\ \mathrm{bytes}}\ \underbrace{a_1,\dots,a_n}_{\mathrm{payload}}\ \underbrace{n}_{4\ \mathrm{bytes}}
$$

前后两个长度标记用于跳过或校验。下面的代码写一个记录，再读回：

```python
import numpy as np

def write_record(handle, array, dtype="<f4"):
    data = np.ascontiguousarray(array, dtype=dtype)
    nbytes = data.nbytes
    handle.write(np.int32(nbytes).tobytes())
    handle.write(data.tobytes())
    handle.write(np.int32(nbytes).tobytes())

with open("record.bin", "wb") as fh:
    write_record(fh, np.arange(12, dtype="<f4").reshape(3, 4))

with open("record.bin", "rb") as fh:
    n = int(np.fromfile(fh, dtype="<i4", count=1)[0])
    values = np.fromfile(fh, dtype="<f4", count=n // 4)
    trailer = int(np.fromfile(fh, dtype="<i4", count=1)[0])
    print(n, trailer, values.reshape(3, 4))
```

常见变体：

- **8 字节记录标记。** 编译选项 `-frecord-marker=8` 或大文件模式下，前后标记是 8 字节整数；读之前先看文件大小与记录长度是否自洽。
- **记录长度单位。** Intel Fortran 的 `-assume byterecl` 让 `RECL` 以字节计，某些老代码以 4 字节字计，差一个因子 4。
- **字节序。** 大端机器写出的文件在小端机器上读，数值会变成天文数字。用 `array.byteswap().newbyteorder()` 或 `dtype=">f4"` 处理。
- **列主序。** Fortran 按列优先存储，`reshape` 时要写 `order="F"`，否则三维数组的 `i/j/k` 会转置。

直接访问（direct access）unformatted 没有记录标记，每条记录长度固定。这种文件可以当作原始二进制，用 `np.memmap` 按偏移读取，比逐条 `read` 快得多。

## CSV 与大文件：loadtxt、memmap

CSV 可读、可 diff，但只适合小数据与交换，不适合百万行以上的场数据。`np.loadtxt` 与 `np.savetxt` 足够处理壁面曲线、监测点历史这类表格：

```python
import numpy as np

wall = np.column_stack([
    np.linspace(0.0, 1.0, 100),
    np.sin(np.linspace(0.0, np.pi, 100)),
])
np.savetxt("wall.csv", wall, delimiter=",", header="x,cp", comments="")
back = np.loadtxt("wall.csv", delimiter=",", skiprows=1)
print(back.shape)
```

带列名的表用 `np.genfromtxt("wall.csv", delimiter=",", names=True)`，之后可按 `back["cp"]` 访问。超过几十万行时，`loadtxt` 的解析开销明显；可以改用 `pandas.read_csv(..., chunksize=...)` 分块，或直接转成二进制。

二进制大文件的首选是 `np.memmap`。它把文件映射到虚拟内存，切片时只触发对应页的读取，不会一次性载入整个文件：

```python
import numpy as np

nsteps, npts, nvar = 50, 20000, 7

mm = np.memmap(
    "cube.bin", dtype="<f4", mode="w+",
    shape=(nsteps, npts, nvar),
)
mm[:] = np.random.rand(nsteps, npts, nvar).astype("f4")
mm.flush()
del mm

mm = np.memmap(
    "cube.bin", dtype="<f4", mode="r",
    shape=(nsteps, npts, nvar),
)
u = mm[10, :, 3]
print(u.shape, u.mean())
```

使用 `memmap` 时注意：

- 形状与 dtype 必须与写文件时完全一致，否则读出来的数会错位。
- 随机访问小片段会频繁触发页错误；按时间步或按块顺序处理，性能最好。
- 写入后调用 `flush()`，再删除对象，确保数据落盘。
- 不要在 `memmap` 上做大量临时运算；先取到内存副本，再计算。

## 格式选择

| 场景 | 推荐 | 原因 |
| --- | --- | --- |
| 单算例交互查看 | `.vtu` / `.plt` | ParaView、Tecplot 直接打开 |
| 多工况批处理 | HDF5 或 `.npz` | 分块读取、元数据随文件走 |
| 与求解器交换 | 原生格式 + 转换脚本 | 避免中间格式丢边界 |
| 老求解器输出 | Fortran unformatted | 尊重原始记录结构 |
| 论文附表 | CSV | 可读、可审、体积小 |
| 超大瞬态 | HDF5 分块或 memmap | 只读需要的切片 |

:::tip 读写之后先做闭环校验
写完再读回，比较形状、dtype、最小最大值与若干抽样点。`assert np.allclose(back, original)` 能拦住大多数字节序、转置与精度问题。再做一次单位和量纲检查：压力是 Pa 还是 $\mathrm{m^2/s^2}$，速度是 m/s 还是无量纲。
:::

## 脚本组织

把读取、派生量、出图拆成三个函数，数据在函数之间只以 numpy 数组与字典传递：

```python
def load_case(path):
    """返回 coords, fields, meta。"""
    ...

def compute_metrics(coords, fields, meta):
    """返回 Cp、Cf、流量等派生量。"""
    ...

def plot_metrics(metrics, outfile):
    """只负责画图，不读文件。"""
    ...
```

这样换求解器时只改 `load_case`，换图样式时只改 `plot_metrics`。下一章 [[ch6/postprocessing|核心算法]] 会填充中间那层 `compute_metrics`。

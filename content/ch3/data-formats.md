---
title: CFD 常用数据格式
order: 4
summary: 梳理 CGNS、VTK、PLOT3D、OpenFOAM、EnSight、HDF5、STL 与 Tecplot 的组织方式、优缺点和典型工具，并给出 Python 读写示例。
tags: [数据格式, CGNS, VTK, HDF5, OpenFOAM]
---

一次 CFD 计算至少产生两类数据：网格（点、面、单元、边界标记）与场（速度、压力、温度等）。它们既要被求解器读写，又要在后处理器中显示，还要在并行计算中高效落盘。格式选错，轻则导入导出丢边界，重则并行 I/O 成为瓶颈、时间平均算错。

这一页不比较压缩率的小数点，而是讲清每种格式“装什么、怎么组织、适合谁”。掌握结构后，遇到读不进去的文件，通常能在一分钟内判断是几何、变量名还是版本的问题。

## 一个算例的数据量

数据量可以先粗估。若单元数为 $N_c$、每个单元保存 $N_v$ 个标量、每个值占 $b$ 字节，则单个时间步的大小约为

$$
S\approx N_c N_v b.
$$

例如 100 万单元、每个单元 10 个双精度变量，一个时间步约 80 MB；保存 100 步就是 8 GB。并行计算时，I/O 时间由有效带宽决定：

$$
t_{\mathrm{IO}}\approx\frac{S}{B_{\mathrm{eff}}},
$$

$B_{\mathrm{eff}}$ 是考虑文件系统与并行争用后的有效带宽。它解释了为什么大规模计算偏爱“每个进程写一个分块、再用主进程汇总”的并行格式，而不是让所有进程排队写同一个文件。

:::note 网格与场是两件事
网格只写一次，场每个时间步都写。很多格式把两者放在同一个文件里，方便分发但不利于增量输出；HDF5、CGNS 这类容器则允许网格与场分组存放，便于只读需要的部分。
:::

## CGNS

CGNS（CFD General Notation System）是面向 CFD 的层次化标准，最初由 NASA 与波音推动。文件按“基（Base）—区域（Zone）—网格—解—边界条件”组织，结构化、非结构、多块与重叠网格都能表达。扩展名通常为 `.cgns`，底层可以是 HDF5，也可以是早期的 ADF。

它的优势是语义完整：一个文件里同时有网格坐标、单元连接、边界条件类型、无量纲参考量，读入后不需要用户手工对应变量名。缺点是生态偏航空，部分工具只支持结构化区域，学习曲线比“一个数组一个文件”高。

常用工具包括 CGNS 官方库、pycgns、Tecplot、FieldView，以及 Fluent、CFX 的导入导出。ParaView 对 CGNS 的支持依赖插件，版本兼容性需要确认。

## VTK

VTK 有两代格式。**legacy `.vtk`** 是早期文本格式，文件头写明 ASCII 或 BINARY、数据集类型（结构化网格、非结构网格、多块等），随后是点、单元与属性数组。它简单、易手写，但大文件读写慢，且不同工具对二进制编码的解释偶有不一致。

**XML 系列** `.vtu`（非结构网格）、`.vtp`（多边形/点云）、`.vts`（结构化网格）把元数据写成 XML，数据区可压缩、可分块。并行版本 `.pvtu` 只存索引，指向各进程的分块文件，是 ParaView 并行后处理的常用形式。

VTK 的强项是可视化互操作：ParaView、Mayavi、VisIt 与 meshio 都能读写，点数据与单元数据区分清楚。弱项是缺少 CFD 语义：边界条件、参考值、单位通常丢失，需要额外约定。

## PLOT3D

PLOT3D 是 NASA 早期的结构化网格格式，通常由两个文件组成：`.xyz` 存多块网格坐标，`.q` 存守恒量或原始变量。它支持 Fortran 有格式与无格式读写，二进制文件常与特定编译器、字节序绑定。

优点是极简、读写快，航空外流社区与许多求解器（如 OVERFLOW、SU2 的部分工具链）仍在使用。缺点是只支持结构化多块，几乎没有元数据，变量顺序与无量纲化方式要靠文档约定，单位错误很难从文件本身发现。

## OpenFOAM

OpenFOAM 不用单一文件，而是用目录树表达算例：

```text
case/
├── 0/                 # 初始条件与边界条件：U、p、k、omega
├── constant/
│   ├── polyMesh/      # points、faces、owner、neighbour、boundary
│   ├── transportProperties
│   └── turbulenceProperties
├── system/            # controlDict、fvSchemes、fvSolution
└── 0.5/ 1.0/ ...      # 每个写出时刻一个目录
```

`polyMesh` 采用“面导向”存储：`points` 是点坐标，`faces` 是每个面的点索引，`owner` 与 `neighbour` 说明面属于哪个单元、相邻单元是谁，`boundary` 记录边界名称、类型与面数。时间目录里是按变量拆分的文件，每个文件头部写明量纲与边界条件。

这种结构的优点是文本可读、边界条件与数值设置随算例保存、脚本化容易；缺点是文件数量多、小文件 I/O 开销大，跨平台共享时需要打包。`foamToVTK` 可以把结果转成 VTK，ParaView 也有原生 OpenFOAM 读取器。

## EnSight 与 HDF5

**EnSight** 用 `.case` 文件索引几何与变量文件（如 `.geo`、`.scl`、`.vel`），支持结构化、非结构与多体数据，二进制读写效率高，在汽车、航空的 CFD 后处理中常见。它的缺点是格式封闭、免费工具支持有限，通常需要商业后处理器。

**HDF5** 不是 CFD 专用格式，而是一个通用容器：组、数据集、属性、分块、压缩、并行 MPI-IO 都可配置。CGNS、许多求解器的重启文件、机器学习数据集都建立在 HDF5 之上。它的优势是通用与高效，缺点是“能读”不等于“懂语义”：变量名、单位、网格拓扑仍要靠约定。

## STL 与 Tecplot

**STL** 只存三角面片，分 ASCII 与二进制两种，常用于 CAD、3D 打印与快速几何交换。它没有单位、没有变量、没有拓扑连通性，因此不能作为 CFD 网格格式，只能用于表面修复或几何导入。二进制 STL 用 80 字节头加三角形数，随后每个三角形 50 字节。

**Tecplot** 的 ASCII `.dat` 用“标题—变量—区域”组织，二进制 `.plt` 读写更快。它按区域（zone）存网格与变量，适合多块结构网格与实验数据对比；Tecplot 360 与 PyTecplot 可直接读取。缺点是跨工具互操作弱，复杂非结构数据的组织不如 VTK 通用。

## 格式对比

| 格式 | 主要内容 | 压缩/分块 | 并行 I/O | 常用工具 |
| --- | --- | --- | --- | --- |
| CGNS | 网格、解、边界、参考量 | HDF5 支持压缩与分块 | 依赖底层 HDF5 | pycgns、Tecplot、Fluent |
| VTK XML | 网格、点/单元数据 | zlib 压缩、分块 | `.pvtu` 多文件 | ParaView、meshio、VisIt |
| PLOT3D | 结构化网格与流场 | 无 | 多块文件 | OVERFLOW、FieldView |
| OpenFOAM | 网格、场、边界、设置 | 无，按目录拆分 | 每进程分目录 | OpenFOAM、ParaView |
| EnSight | 几何、标量/矢量场 | 二进制、case 索引 | 有限 | EnSight、CFD-Post |
| HDF5 | 任意数组与元数据 | 压缩、分块 | MPI-IO | h5py、CGNS、PyTorch |
| STL | 三角表面 | 无 | 不适用 | CAD、3D 打印 |
| Tecplot | 分区网格与变量 | 二进制 | 有限 | Tecplot 360、PyTecplot |

## Python 读写示例

`meshio` 提供了统一的 VTK 接口。下面的代码写一个带点数据的 `.vtu`，再读回验证：

```python
import meshio
import numpy as np

# 四个角点与一个四边形单元
points = np.array([
    [0.0, 0.0, 0.0],
    [1.0, 0.0, 0.0],
    [1.0, 1.0, 0.0],
    [0.0, 1.0, 0.0],
])
cells = [("quad", np.array([[0, 1, 2, 3]]))]
mesh = meshio.Mesh(
    points,
    cells,
    point_data={"pressure": np.array([1.0, 2.0, 3.0, 4.0])},
)

meshio.write("sample.vtu", mesh)
back = meshio.read("sample.vtu")
print(back.point_data["pressure"])
```

若文件是 HDF5 底层的 CGNS，可以用 `h5py` 先看结构：

```python
import h5py

# 打印 CGNS 文件中的组与数据集层级
with h5py.File("case.cgns", "r") as f:
    def show(name, obj):
        kind = "组" if isinstance(obj, h5py.Group) else "数据集"
        print(f"{kind}: {name}")
    f.visititems(show)
```

`h5py` 只认识 HDF5 的组与数据集，不理解 CGNS 的区域、边界类型与变量语义；要按 CFD 语义读取，应使用 `pycgns`。同理，读 OpenFOAM 的 `polyMesh` 需要自己解析 `owner/neighbour`，或直接用 `foamToVTK`、PyVista 的 OpenFOAM 读取器。

:::warning 单位与变量名
格式能读进来不代表物理量正确。PLOT3D 可能用英尺与英制单位，CGNS 可能存无量纲量，OpenFOAM 的 `p` 可能是运动压力 $p/\rho$。导入后先检查量纲、参考密度与速度，再谈后处理。
:::

## 选型建议

- 需要跨工具、跨平台交换网格与场：优先 VTK XML 或 CGNS；
- 航空结构化多块、与 legacy 求解器对接：PLOT3D 仍可用，但要固定字节序与变量约定；
- OpenFOAM 算例：保留原生目录结构，后处理再转 VTK；
- 大规模并行与重启：HDF5 容器加自定义布局，或 CGNS 的 HDF5 后端；
- 只关心表面：STL 足够，但不要指望它携带边界条件。

无论选哪种格式，都建议在算例目录里留一份说明，写明单位、变量名、参考状态与生成工具的版本。元数据再完整，也常因版本升级或导出插件而丢失；一份随算例保存的文本说明，往往比文件头更可靠，也更容易在团队之间传递。

相关阅读：商业软件如何导入这些格式，见[[ch3/commercial-software|商业软件与开源求解器]]；Python 读取与批量处理的更多细节，见[[ch6/python-io|Python 数据读写]]。

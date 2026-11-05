---
title: C++ 与 Fortran 实现
order: 5
summary: 把湍流模型方程落到数组与循环上：讨论内存布局、索引、边界、并行与时间步，给出 C++ 的 SST 涡粘与生产项、Fortran 的 k-ε 模块，并对照三种语言的工程取舍。
tags: [C++, Fortran, OpenMP, 内存布局, 实现]
---

模型方程写在纸上是连续的偏微分方程，落到代码里则变成“某个数组的第 $i$ 个元素等于相邻元素的和”。这一步转换最容易出两类错误：索引与物理坐标错位、边界条件与内部格式不一致。本节从工程角度讨论这些细节，并给出可直接改写的 C++ 与 Fortran 片段。

## 数组布局与索引

有限体积网格通常存成一维数组加索引映射，而不是二维 `[i][j]`。两种主流布局：

- **行主序**（C/C++、Python/NumPy 默认）：先排 $i$（$x$ 方向），后排 $j$（$y$ 方向），元素 $(i,j)$ 的偏移为 $j\cdot n_x+i$。
- **列主序**（Fortran、MATLAB）：第一个下标变化最快，元素 $(i,j)$ 的偏移为 $i+j\cdot n_x$。

两者在内存里其实是同一件事：**最内层循环必须沿连续方向**，否则每次跳跃一个缓存行，性能可能相差数倍。C++ 中遍历应写成 `for j { for i }`，Fortran 中应写成 `do j; do i`（$i$ 为内层）。

对结构网格，还可以用“鬼网格”（ghost cell）把边界条件统一成填充操作：内部循环从 $i=1$ 到 $n_x-2$，边界层由专门的函数写入。这样内部格式不需要任何 `if` 判断，既干净又利于向量化。对三维网格，偏移写成 $(k\,n_y+j)\,n_x+i$，一旦顺序写反，程序仍能跑通，但边界条件会作用在错误的面上，这类错误往往只能靠解析解算例发现。

$$
\mathrm{idx}(i,j)=j\,n_x+i\quad\text{(row-major)},\qquad
\mathrm{idx}(i,j)=i+j\,n_x\quad\text{(column-major)}.
$$

## 时间步与并行

湍流模型方程的时间推进有两种选择。显式格式实现简单，但步长受 CFL 与扩散稳定性限制：

$$
\Delta t\le\min\left(\frac{\Delta x}{u_{\max}},\ 
\frac{\Delta x^2}{2\left(\nu+\nu_t\right)}\right).
$$

涡粘 $\nu_t$ 往往比分子粘度大两三个数量级，因此扩散项才是真正的限制因素。隐式格式可以用更大的步长，但需要求解线性系统，且 $k$、$\varepsilon$ 的强非线性会让收敛变慢。工程代码常采用“动量隐式 + 湍流量隐式”的分离求解，或用伪瞬态推进到稳态。非定常计算必须使用全局一致的时间步；只有追求稳态时才允许局部时间步加速，否则脉动的相位关系会被破坏。

并行方面，**OpenMP** 适合单机共享内存：在单元循环外加 `!$omp parallel do` 即可，注意每个线程的临时变量必须声明为 `private`。**MPI** 适合分布式内存：按块划分网格，在每个时间步交换一层鬼网格数据，通信量与表面积成正比，因此立方体子域最省通信。

## C++：SST 涡粘与生产项

下面的结构体把场量放在连续内存中，`idx` 负责行主序映射；函数用 `const` 引用保证不修改输入，返回值统一为 SI 单位。

```cpp
// sst.hpp —— k-ω SST 的涡粘与生产项（二维结构化网格，行主序）
#include <algorithm>
#include <cmath>
#include <cstddef>
#include <vector>

struct SstField {
    std::vector<double> k;      // 湍动能，m^2/s^2
    std::vector<double> omega;  // 比耗散率，1/s
    std::vector<double> u, v;   // 平均速度，m/s
    std::size_t nx = 0, ny = 0;
    double rho = 1.0;           // 密度，kg/m^3
    double a1  = 0.31;          // SST 常数
    std::size_t idx(std::size_t i, std::size_t j) const {
        return j * nx + i;      // 行主序：j 为行，i 为列
    }
};

// μ_t = ρ a1 k / max(a1 ω, S F2)，返回 Pa·s
inline double eddy_viscosity(const SstField& f, std::size_t i, std::size_t j,
                             double S, double F2) {
    const double k = f.k[f.idx(i, j)];
    const double w = std::max(f.omega[f.idx(i, j)], 1e-12);
    const double denom = std::max(f.a1 * w, S * F2);
    return f.rho * f.a1 * k / denom;
}

// 生产项 P_k = 2 μ_t S_ij S_ij = 2 μ_t (Sxx² + Syy² + 2 Sxy²)
inline double production(const SstField& f, std::size_t i, std::size_t j,
                         double Sxx, double Syy, double Sxy, double F2) {
    const double S2 = Sxx * Sxx + Syy * Syy + 2.0 * Sxy * Sxy;
    const double S  = std::sqrt(2.0 * S2);          // |S|
    const double mut = eddy_viscosity(f, i, j, S, F2);
    return 2.0 * mut * S2;                          // kg/(m·s^3)
}
```

三个容易忽略的点：`std::max` 的下限保护防止 $k$ 或 $\omega$ 为负时出现除零与 `NaN`；`S` 用的是张量模 $\sqrt{2S_{ij}S_{ij}}$，不是某个分量的绝对值；返回值 `mut * S2` 的量纲是 $\mathrm{kg/(m\cdot s^3)}$，与 $k$ 方程右端其余项一致，若改用 $\mathrm{m^2/s^3}$ 的约定则需提前除以密度。

## Fortran：k-ε 模块

Fortran 的优势是数组语法与列主序，数值计算代码通常比 C++ 更短。下面的模块只做一步显式推进，边界层不更新（由调用者填充）。

```fortran
! k_eps.f90 —— 标准 k-ε 一步显式推进（列主序）
module k_eps
  implicit none
  integer, parameter :: wp = selected_real_kind(15, 307)
  real(wp), parameter :: Cmu = 0.09_wp, C1 = 1.44_wp, C2 = 1.92_wp
  real(wp), parameter :: sigk = 1.0_wp, sige = 1.3_wp
contains
  subroutine advance(nx, ny, dx, dy, dt, nu, u, v, k, eps)
    integer, intent(in) :: nx, ny
    real(wp), intent(in) :: dx, dy, dt, nu
    real(wp), intent(in) :: u(nx, ny), v(nx, ny)
    real(wp), intent(inout) :: k(nx, ny), eps(nx, ny)
    real(wp) :: kold(nx, ny), epsold(nx, ny)
    real(wp) :: nut, Pk, dk, de, lapk, lape
    integer :: i, j

    kold = k; epsold = eps        ! 显式格式必须读旧值，避免原地更新串扰

    !$omp parallel do private(i, j, nut, Pk, dk, de, lapk, lape)
    do j = 2, ny - 1              ! 内层 i 连续，匹配列主序
      do i = 2, nx - 1
        nut = Cmu * kold(i, j)**2 / max(epsold(i, j), 1.0e-12_wp)
        ! 生产项：nut * (du/dy)^2，二维剪切近似
        Pk = nut * ((u(i, j+1) - u(i, j-1)) / (2.0_wp * dy))**2

        lapk = (kold(i+1,j) - 2.0_wp*kold(i,j) + kold(i-1,j)) / dx**2 &
             + (kold(i,j+1) - 2.0_wp*kold(i,j) + kold(i,j-1)) / dy**2
        lape = (epsold(i+1,j) - 2.0_wp*epsold(i,j) + epsold(i-1,j)) / dx**2 &
             + (epsold(i,j+1) - 2.0_wp*epsold(i,j) + epsold(i,j-1)) / dy**2

        dk = Pk - epsold(i, j) + (nu + nut / sigk) * lapk
        de = C1 * epsold(i,j) / kold(i,j) * Pk &
           - C2 * epsold(i,j)**2 / kold(i,j) + (nu + nut / sige) * lape

        k(i, j)   = max(kold(i, j)   + dt * dk, 1.0e-12_wp)
        eps(i, j) = max(epsold(i,j)  + dt * de, 1.0e-12_wp)
      end do
    end do
    !$omp end parallel do
  end subroutine advance
end module k_eps
```

`kold`、`epsold` 的拷贝不是多余的：若在原数组上边算边写，右侧的邻居值可能已被本步更新，格式就从显式变成了“交错更新”，结果依赖循环顺序。对稳态问题影响不大，对非定常 LES/DES 则是隐性错误。

## 从公式到代码的映射

以 $\partial_t k+U_j\partial_j k=P_k-\varepsilon+\partial_j[(\nu+\nu_t/\sigma_k)\partial_j k]$ 为例，逐项对应到一维索引（$i$ 为 $x$ 方向）：

| 公式项 | 离散形式 | 代码中的数组访问 |
| --- | --- | --- |
| 时间导数 $\partial_t k$ | $(k^{n+1}-k^n)/\Delta t$ | `(k[i] - kold[i]) / dt` |
| 对流 $U\partial_x k$ | 一阶迎风 $U(k_i-k_{i-1})/\Delta x$ | `U * (k[i] - k[i-1]) / dx` |
| 扩散 $\partial_x(\Gamma\partial_x k)$ | $\Gamma_{i+1/2}(k_{i+1}-k_i)/\Delta x^2$ 减左面 | `(Ge*(k[i+1]-k[i]) - Gw*(k[i]-k[i-1])) / dx**2` |
| 生产 $P_k$ | $2\nu_t S_{ij}S_{ij}$ | `2*nut*S2[i]` |
| 耗散 $\varepsilon$ | 单元中心值 | `eps[i]` |

面扩散系数 $\Gamma$ 在单元界面上取调和平均（串联热阻模型），比算术平均更能处理 $\nu_t$ 的强跳跃：

$$
\Gamma_{i+1/2}=\frac{2\Gamma_i\Gamma_{i+1}}{\Gamma_i+\Gamma_{i+1}}.
$$

## 通量形式与鬼网格

有限体积代码通常不直接离散微分方程，而是对每个单元做通量平衡：

$$
\frac{\mathrm{d}}{\mathrm{d}t}\left(k_iV_i\right)
=\sum_{f}F_f+S_iV_i,
\qquad
F_f=\Gamma_f\frac{k_N-k_P}{\Delta n_f}A_f,
$$

其中 $V_i$ 是单元体积，$f$ 遍历单元的面，$F_f$ 是穿过面 $f$ 的扩散通量，$A_f$ 是面积，$\Delta n_f$ 是面法向间距，$k_P$、$k_N$ 分别是本单元与邻居的中心值，$S_i$ 是生产与耗散的体积源。代码里“面”的量通常存在独立数组（`face_flux[nface]`），这样同一份通量可以同时用于相邻两个单元，保证离散守恒。

鬼网格的作用是把边界条件变成“填充一圈虚拟单元”：入口填 Dirichlet 值，壁面填镜像值，出口填外推值。填充完成后，内部循环对所有单元使用同一套格式，不需要任何分支判断。这既减少了代码路径，也让编译器更容易向量化。

向量化还有两个实际建议：其一，把标量场分开存成多个数组（SoA），而不是每个单元存一个含 $k$、$\omega$、$\mu_t$ 的结构体（AoS），前者在遍历时是连续访存；其二，避免在热循环里做 `if` 判断与函数调用，把 `max` 保护移到循环外或改用无分支写法。MPI 并行则只需在每步交换一层鬼网格，通信量与子域表面积成正比，因此接近立方体的分块最省通信。

## 三种语言的取舍

| 维度 | Python | C++ | Fortran |
| --- | --- | --- | --- |
| 运行性能 | 低（需 NumPy/Numba 向量化） | 高 | 高 |
| 可读性与开发效率 | 高 | 中 | 中（数组语法简洁） |
| 生态与工具链 | 极强（科学计算、可视化、机器学习） | 强（模板、库、调试器） | 偏弱，但 HPC 编译器成熟 |
| 内存布局 | 行主序 | 行主序 | 列主序 |
| 典型项目 | PyFR、PhiFlow、各类研究脚本 | OpenFOAM、SU2 | Nek5000、OpenFOAM 的部分求解器 |

实践中的组合通常是：**Python 做原型与后处理，C++/Fortran 做热循环**。先在小算例上用 Python 验证公式与系数，再把验证过的离散搬到编译语言，最后用同一算例逐项比对残差。若两边结果不一致，优先检查索引偏移与边界填充，而不是怀疑模型。

:::tip 单位一致性
湍流模型常数是无量纲的，但 $k$、$\varepsilon$、$\mu_t$ 的量纲各不相同。建议在结构体或模块注释中显式标注单位（如 `m^2/s^3`），并在入口处统一到 SI；混用 $\mathrm{mm}$ 与 $\mathrm{m}$ 造成的结果偏差，往往比模型误差大一个数量级。
:::

## 小结

- 布局决定性能：行主序配 `for j { for i }`，列主序配 `do j; do i`。
- 显式推进必须读旧值，原地更新会引入顺序依赖。
- 边界用鬼网格统一处理，内部循环才可能被向量化。
- 从公式到代码的每一步都要能指出对应的数组下标，否则调试时无从下手。

回到 [[ch4/rans|RANS 与涡粘模型]] 对照方程，或到 [[ch4/les|大涡模拟 LES]] 看亚格子模型如何嵌入同一个求解循环；离散框架本身见 [[ch3/fvm|有限体积法]]。

# 项目颜色规范

本文定义原神养成规划器的颜色来源、使用边界和当前取值。界面开发以本文和 `src/renderer/styles.css` 为共同依据；修改任一颜色时必须同步更新另一处，并更新视觉回归基线。

## 1. 基本原则

1. 普通界面颜色只使用语义 Token，不在页面或组件中直接写主题相关色值。
2. 浅色与深色主题使用同一 Token 名称；组件不根据主题自行选择颜色。
3. 绿色只表达成功、满足或二星材料稀有度，不作为品牌主色。
4. 品牌交互使用低饱和青蓝色，中性背景不带明显绿色倾向。
5. 新增颜色前先判断能否复用现有语义；确需新增时，同时定义浅色、深色取值和使用边界。
6. 材料稀有度、主题预览和透明动效属于受控例外，必须使用组件限定选择器，不能污染普通组件。

## 2. 语义 Token

| Token | 浅色主题 | 深色主题 | 用途 |
| --- | --- | --- | --- |
| `--color-bg` | `#F4F5F7` | `#17191D` | 页面和工作区基底 |
| `--color-surface` | `#FFFFFF` | `#22252B` | 表格、弹层和主要工具面 |
| `--color-surface-subtle` | `#F5F6F8` | `#202329` | 次级区块表面 |
| `--color-control` | `#FFFFFF` | `#292D34` | 输入框、选择器和普通按钮表面 |
| `--color-hover` | `#EEF2F6` | `#303640` | 普通悬浮表面 |
| `--color-text` | `#252A31` | `#D8DDE4` | 正文和主要文字 |
| `--color-muted` | `#68717D` | `#929AA6` | 次要说明文字 |
| `--color-muted-strong` | `#5F6874` | `#AEB6C2` | 需要更清晰的次要文字 |
| `--color-primary` | `#557FA3` | `#83ACD0` | 链接、图标、强调线和主要交互 |
| `--color-primary-hover` | `#41698C` | `#557FA3` | 主要交互悬浮状态 |
| `--color-primary-surface` | `#E8F0F7` | `#34495E` | 选中项的柔和背景 |
| `--color-primary-fill` | `#557FA3` | `#496F91` | 实心主要按钮背景 |
| `--color-selected-text` | `#41698C` | `#AECBE3` | 选中控件文字 |
| `--color-on-primary` | `#FFFFFF` | `#EEF3F7` | 实心主要按钮上的文字和图标 |
| `--color-accent` | `#B99145` | `#D2AE68` | 弱引导和稀有重点信息 |
| `--color-passive` | `#80659A` | `#B39AD0` | 合成被动产物增量 |
| `--color-success` | `#3F865F` | `#66AF82` | 成功状态边框和图标 |
| `--color-success-text` | `#176544` | `#79B993` | 成功状态文字 |
| `--color-success-surface` | `#E1F4E9` | `#24342B` | 成功状态背景 |
| `--color-warning-text` | `#A34C23` | `#DF876F` | 警告状态文字 |
| `--color-warning-surface` | `#FFF0E6` | `#382925` | 警告状态背景 |
| `--color-danger` | `#B84E4E` | `#E07A76` | 删除、错误和危险操作 |
| `--color-danger-muted` | `#A94A3D` | `#B96F6A` | 缺口等较弱错误信息 |
| `--color-danger-surface` | `#FFF0ED` | `#342725` | 错误和危险状态背景 |
| `--color-border` | `#D9DDE3` | `#343A43` | 普通边框和分隔线 |
| `--color-border-strong` | `#66788B` | `#4D5967` | 区块顶部强调线和较强边界 |
| `--color-focus` | `#6B9DE4` | `#6B9DE4` | 键盘焦点轮廓 |
| `--color-sidebar` | `#3A4049` | `#292E36` | 固定侧栏背景 |
| `--color-sidebar-text` | `#CBD1DA` | `#BDC6D1` | 侧栏菜单文字和图标 |
| `--color-sidebar-brand` | `#FFF5D8` | `#F0DFB8` | 侧栏产品名称 |
| `--color-sidebar-active` | `#557FA3` | `#465F75` | 侧栏选中和悬浮背景 |
| `--color-sidebar-border` | `#565D68` | `#414954` | 侧栏分隔线 |
| `--color-tooltip` | `#202832` | `#D8DDE4` | Tooltip 和通知背景 |
| `--color-tooltip-text` | `#FFFFFF` | `#17191D` | Tooltip 和通知文字 |
| `--color-overlay` | `#11151A66` | `#10171AAA` | 模态遮罩 |
| `--color-shadow` | `#11151A42` | `#00000055` | 弹层阴影 |

## 3. 固定业务色

材料稀有度颜色表达游戏内等级语义，不跟随品牌主题变化。以下颜色只能用于 `.material-head`、`.material-preview-card`、`.deficit-tag` 和 `.rarity-dots` 等材料等级组件。

| 等级 | 边框或圆点 | 浅色文字 | 深色文字 |
| --- | --- | --- | --- |
| 2 | `#3D9B68` | `#24794B` | `#73BD91`；圆点内使用 `#EDF1F5` |
| 3 | `#438CC8` | `#2867A4` | `#79ADD8`；圆点内使用 `#EDF1F5` |
| 4 | `#8D68B5` | `#6D4795` | `#B39AD0`；圆点内使用 `#EDF1F5` |
| 5 | `#C7982E` | `#997115` | `#D7B76D`；圆点内使用 `#252018` |

浅色稀有度圆点内文字分别使用 `#F1F6F3`、`#F1F5F8`、`#F5F1F8`、`#FFF7E3`。

## 4. 受控例外

- 主题选择器中的缩略图需要同时预览另一主题，因此允许直接使用本规范中的主题色值，不能改为当前主题 Token。
- 同步进度条扫光使用 `#FFFFFF1F`，仅作为透明动画叠层，不承担文字或状态语义。
- `color-mix()` 必须以本文 Token 为输入，用于派生弱背景、悬浮和边框；不得混入新的无归属字面颜色。

## 5. 修改与检查

颜色修改需要同时完成：

1. 更新 `src/renderer/styles.css` 中浅色和深色 Token。
2. 更新本文对应取值和用途。
3. 检查浅色、深色、悬浮、聚焦、禁用和错误状态。
4. 执行 `npm run test:visual`，人工确认差异后再更新视觉基线。
5. 扫描渲染层颜色字面量，确认只剩本文记录的固定业务色和受控例外。

# 原神养成规划器 v1.1.0 设计方案

作者：Kumasuke120
状态：已验收
目标版本：v1.1.0
前置版本：v1.0.0

## 1. 版本定位

v1.1.0 不增加完整培养计划、全局库存、开放日或体力估算。这个版本负责整理 v1.0.0 的工程基础和现有体验，使后续功能能够在稳定的数据、界面、测试和发布流程上开发。

本版本完成以下目标：

1. 保持 v1.0.0 的角色天赋、武器突破和材料合成功能可用。
2. 保持“手动计算”现有名称和功能边界，将产品名统一为“原神养成规划器”。
3. 解决打开方案后再次点击导航导致编辑上下文丢失的问题。
4. 建立浅色、深色和跟随系统三种主题，替换 Electron 默认品牌视觉。
5. 重组设置页并提供用户数据目录与游戏资料目录入口。
6. 将发布内置资料缩减为神里绫华示例关系链，完整资料由用户主动同步。
7. 引入 lint、分层自动化测试、Electron E2E、截图回归和 Windows CI。
8. 统一构建目录、版本注入、EXE 和 ZIP 命名。
9. 建立 MIT License、NOTICE、CHANGELOG、完整 README 和 GitHub 公开所需材料。

## 2. 非目标

以下内容属于后续版本：

- v1.2.x：角色等级与突破、天赋和任意武器组成的完整培养计划。
- v1.3.x：全局库存、计划优先级、预留和冲突分配。
- v1.4.x：版本日历、今日与明日开放素材。
- v1.5.x：树脂、掉落期望和刷取次数。
- v1.6.x：完整动效与 1.x 全流程收口。
- v2.x.x：多账号、OCR、窗口捕获和自定义标题栏。

v1.1.0 不升级游戏资料核心分类 Schema，不引入完整培养计划的 Schema v2 术语枚举。

## 3. 用户可见术语

| v1.0.0             | v1.1.0         | 使用位置                   |
| ------------------ | -------------- | -------------------------- |
| 原神养成材料规划器 | 原神养成规划器 | 窗口、侧栏、关于页、README |
| 手动计算           | 手动计算       | 侧栏、页面标题、方案类型   |
| 我的方案           | 我的方案       | 设置中的现有方案管理       |
| 游戏资料           | 游戏资料       | 设置                       |

本版本只修改已明确的用户可见名称。“手动计算”暂不改名；只有后续完整模型能够组合角色、武器及其培养目标后，才重新评估是否使用“模拟合成”。现有 `manual`、`talent-book` 和 `weapon-ascension` 等持久化值保持兼容，待后续 Schema v2 术语表和迁移设计统一处理。

## 4. 信息架构

v1.1.0 保留现有功能数量，侧栏为：

```text
原神养成规划器

总览
武器突破
角色天赋
手动计算

设置
```

“培养计划”和独立“库存”侧栏入口在 v1.2.x、v1.3.x 实现，本版本不提前放置空入口。

设置包含：

```text
显示与语言 | 我的方案 | 游戏资料 | 关于
```

- “显示与语言”管理界面语言和主题。
- “我的方案”保留搜索、分页、打开和删除，并提供方案导入、导出及用户数据目录入口。
- “游戏资料”管理同步 Lunaris、导入、导出、恢复内置资料及游戏资料目录入口。
- “关于”展示版本、构建标识、作者、项目主页和许可证摘要。

## 5. 全局框架

```text
+-------------------+--------------------------------------------------------------+
| 原神养成规划器     | 当前工作区标题                               [上下文操作]    |
|                   +--------------------------------------------------------------+
| [总览]            |                                                              |
| [武器突破]        |                    当前工作区正文                            |
| [角色天赋]        |                                                              |
| [手动计算]        |                                                              |
|                   |                                                              |
| [设置]            |                                                              |
+-------------------+--------------------------------------------------------------+
```

- 侧栏与顶栏固定，仅正文滚动。
- 顶栏已有工作区标题时，正文不重复同名大标题。
- 语言入口从全局右上角移入设置。
- 页面不设置 Footer。
- 窗口继续使用系统标题栏；自定义标题栏属于 v2.5.x。

## 6. 方案编辑连续性

### 6.1 问题

v1.0.0 打开已保存方案后，再次点击同一功能导航会进入新建状态，使用户难以返回正在编辑的方案。

### 6.2 工作区标签

```text
顶栏：[角色天赋] [「神里绫华」天赋方案 x] [「笛剑」突破方案 x]
```

- 打开方案时建立或切换到对应标签；同一方案只允许一个标签。
- 点击侧栏只切换到该功能最近使用的标签，不创建新页面、不清空输入。
- 顶栏不提供无独立逻辑的 `+`；侧栏负责进入对应功能的基础工作区。
- 标签关闭只关闭工作区，不删除已保存方案。
- 各标签分别保留计算输入和选择器状态；方案标签名称过长时截断，悬浮或键盘聚焦后显示完整名称。
- 标签数量超出可用宽度后在标签栏内部横向滚动，不挤压正文，也不让正文滚动条覆盖标签栏。
- 所有标签组成连续的直角页签组，使用柔和表面底色和共享边框；选中标签增加顶部主色线，与正文同色并取消底部分隔。标签组固定贴合顶栏底部，计算页不在标签栏下方保留额外顶部留白。标签按内容从左排列且文字左对齐，名称弹性截断，关闭按钮固定在最右侧；最小宽度应保证短标签仍易于识别和点击。

### 6.3 未保存内容

```text
关闭未保存方案

当前方案有未保存的修改，关闭后这些修改将丢失。仍要关闭吗？
[取消] [确定]
```

- 关闭含有未保存修改的方案标签时使用系统确认框；取消后继续编辑，确认后丢弃该标签内修改。
- 正常标签切换不销毁状态，不弹出提示。
- 保存成功写入 Profile 后才显示“已保存”或“方案已更新”；保存失败保留输入并显示“保存失败”。
- “另存为”继续使用 v1.0.0 的唯一名称规则，冲突时生成 ` (2)`、` (3)`。
- 来源资料缺少可靠突破曲线的武器只展示武器与阶段选择和“暂不支持突破计算”提示；隐藏缺口摘要、保存操作、材料表和合成角色区，避免把无效结果呈现为可计算状态。

## 7. 设置

### 7.1 显示与语言

```text
界面语言    [简体中文 v]

主题
+----------------+  +----------------+  +----------------+
| 跟随系统       |  | 浅色           |  | 深色           |
| 明暗组合预览   |  | 冷白 · 青蓝    |  | 深灰 · 青蓝    |
+----------------+  +----------------+  +----------------+
```

- 切换语言或主题立即生效并持久化。
- “跟随系统”监听 Windows 应用颜色模式。
- `prefers-reduced-motion` 在本版本直接遵循系统；应用内动态效果设置留到 v1.6.x。

### 7.2 我的方案

```text
[导入方案] [导出方案] [打开用户数据目录]       [搜索方案名称........]

「神里绫华」天赋方案       更新于 2026-09-12 21:30       [打开] [...]
「笛剑」突破方案           更新于 2026-09-11 18:20       [打开] [...]
```

- 保留现有分页、搜索、打开和删除功能。
- 删除继续要求明确确认。
- 用户数据目录不显示绝对路径；点击后由主进程打开 Electron `userData` 目录。
- 导入前校验并备份当前 Profile，失败时不覆盖现有数据。

### 7.3 游戏资料

```text
资料状态      内置示例资料
资料版本      内置示例资料
资料来源      -
更新时间      2026-09-12 21:30:45
内容
角色      武器      角色天赋素材      武器突破素材      图标
1         5         <实际数量>        <实际数量>        <实际数量>

[同步 Lunaris] [导入资料] [导出资料] [恢复内置资料] [打开资料目录]
```

- 游戏资料“更新时间”按本地时区精确到秒，格式为 `YYYY-MM-DD HH:mm:ss`。
- “内容”延续 v1.0.0 的数量统计表，固定展示角色、武器、角色天赋素材、武器突破素材和图标五项；数量从当前已安装资料动态读取，不展示神里绫华等具体对象名称，也不在产品代码中写死示例数量。
- “打开资料目录”定位到用户资料目录下的游戏资料根目录。
- 内置资料的“资料来源”显示 `-`，且“导出资料”不可用；同步或导入的完整资料才允许导出。
- 完整同步、导入和恢复保持原子替换与失败回退。
- Lunaris 同步依次执行版本检查、三个基础目录下载、角色与武器详情处理、资料校验、图标下载和原子安装；详情按每批 8 个对象并发，图标按每批 10 个资源并发。
- 单个必需图标最多尝试下载 5 次；仍失败时终止整次同步，不安装不完整资料，并继续使用原资料。
- 同步期间点击其他页面、切换设置 Tab 或关闭窗口时，显示“取消同步并离开？”确认框；“继续同步”为默认操作。确认离开后先取消并等待同步任务完全退出，再执行导航或关闭窗口。直接点击“取消同步”也必须二次确认。
- 同步区使用横向进度条展示当前阶段和 `已完成/总数`；无确定总数时使用柔和的循环扫光。最近操作最多展示 3 条，并在任务进行时立即加入“开始同步”记录。
- 资料操作日志和同步记录按本地时区显示到分钟，格式为 `YYYY-MM-DD HH:mm`，不显示秒。
- “恢复内置资料”属于可能令既有方案暂时不可打开的高影响操作，执行前必须显示警告确认框：说明游戏资料将替换为内置示例资料、非示例角色或武器的方案可能暂时无法打开，但方案本身不会被删除或改写，重新同步对应资料后即可恢复。
- 确认框的主操作使用明确文案“恢复内置资料”，取消为默认聚焦操作；不得使用含义模糊的“确定”。
- 恢复后，引用缺失角色、武器或材料的方案仍保留在“我的方案”中；打开时显示“所需资料尚未下载，同步 Lunaris 后可继续查看与编辑”，并提供“同步 Lunaris”入口，不进入依赖完整资料的编辑页。
- 方案是否可打开只根据当前资料和方案中保存的稳定 ID 动态判断。重新同步到所需资料后，方案自动恢复可打开状态，不要求用户迁移、重新保存或重新创建。

### 7.4 示例资料弱引导

仅使用示例资料时，在正文顶部显示：

```text
当前使用示例游戏资料，同步后可使用完整角色、武器和材料。 [前往同步] [x]
```

- 不弹窗、不阻断现有示例流程。
- “前往同步”打开设置的游戏资料 Tab，并对“同步 Lunaris”按钮播放一次柔和提示动效。
- 关闭后本次会话不再显示；资料状态改变后重新计算是否需要显示。

### 7.5 关于

```text
[产品图标]  原神养成规划器
            本地运行的原神养成材料规划器

版本            v1.1.0
构建            <Git 短 commit>
作者            Kumasuke120  [GitHub 图标]
[项目主页] [复制版本信息]

MIT License · Unofficial project
```

- 作者链接打开 [Kumasuke120 的 GitHub 主页](https://github.com/kumasuke120)。
- 项目主页确定为 [genshin-planner](https://github.com/kumasuke120/genshin-planner)。
- 外部链接由主进程校验 HTTPS 协议和允许域名后交给系统浏览器。
- 复制版本信息包含应用名称、应用版本和构建标识，不含用户路径和用户数据。

## 8. 主题与品牌

### 8.1 颜色方向

完整颜色取值、用途、固定业务色和修改流程统一由 [`COLOR_GUIDELINES.md`](COLOR_GUIDELINES.md) 管理。本节记录 v1.1.0 的主题结论；实现中的 Token 值必须与该规范一致。

以下为构成品牌观感的核心 Token 摘要：

| Token                    | 浅色                                                                                                                                           | 深色                                                                                                                                           | 用途                 |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| `--color-bg`             | <span style="display:inline-block;width:1em;height:1em;background-color:#F4F5F7;border:1px solid #888;vertical-align:middle"></span> `#F4F5F7` | <span style="display:inline-block;width:1em;height:1em;background-color:#17191D;border:1px solid #888;vertical-align:middle"></span> `#17191D` | 页面基底             |
| `--color-surface`        | <span style="display:inline-block;width:1em;height:1em;background-color:#FFFFFF;border:1px solid #888;vertical-align:middle"></span> `#FFFFFF` | <span style="display:inline-block;width:1em;height:1em;background-color:#22252B;border:1px solid #888;vertical-align:middle"></span> `#22252B` | 表格、弹层、工具面   |
| `--color-text`           | <span style="display:inline-block;width:1em;height:1em;background-color:#252A31;border:1px solid #888;vertical-align:middle"></span> `#252A31` | <span style="display:inline-block;width:1em;height:1em;background-color:#D8DDE4;border:1px solid #888;vertical-align:middle"></span> `#D8DDE4` | 主文字               |
| `--color-muted`          | <span style="display:inline-block;width:1em;height:1em;background-color:#68717D;border:1px solid #888;vertical-align:middle"></span> `#68717D` | <span style="display:inline-block;width:1em;height:1em;background-color:#929AA6;border:1px solid #888;vertical-align:middle"></span> `#929AA6` | 次要文字             |
| `--color-primary`        | <span style="display:inline-block;width:1em;height:1em;background-color:#557FA3;border:1px solid #888;vertical-align:middle"></span> `#557FA3` | <span style="display:inline-block;width:1em;height:1em;background-color:#83ACD0;border:1px solid #888;vertical-align:middle"></span> `#83ACD0` | 主要交互             |
| `--color-primary-fill`   | <span style="display:inline-block;width:1em;height:1em;background-color:#557FA3;border:1px solid #888;vertical-align:middle"></span> `#557FA3` | <span style="display:inline-block;width:1em;height:1em;background-color:#496F91;border:1px solid #888;vertical-align:middle"></span> `#496F91` | 主要按钮填充         |
| `--color-selected-text`  | <span style="display:inline-block;width:1em;height:1em;background-color:#41698C;border:1px solid #888;vertical-align:middle"></span> `#41698C` | <span style="display:inline-block;width:1em;height:1em;background-color:#AECBE3;border:1px solid #888;vertical-align:middle"></span> `#AECBE3` | 选中控件文字         |
| `--color-muted-strong`   | <span style="display:inline-block;width:1em;height:1em;background-color:#5F6874;border:1px solid #888;vertical-align:middle"></span> `#5F6874` | <span style="display:inline-block;width:1em;height:1em;background-color:#AEB6C2;border:1px solid #888;vertical-align:middle"></span> `#AEB6C2` | 较强次要文字         |
| `--color-accent`         | <span style="display:inline-block;width:1em;height:1em;background-color:#B99145;border:1px solid #888;vertical-align:middle"></span> `#B99145` | <span style="display:inline-block;width:1em;height:1em;background-color:#D2AE68;border:1px solid #888;vertical-align:middle"></span> `#D2AE68` | 重点与稀有信息       |
| `--color-success`        | <span style="display:inline-block;width:1em;height:1em;background-color:#3F865F;border:1px solid #888;vertical-align:middle"></span> `#3F865F` | <span style="display:inline-block;width:1em;height:1em;background-color:#66AF82;border:1px solid #888;vertical-align:middle"></span> `#66AF82` | 已满足与成功         |
| `--color-danger`         | <span style="display:inline-block;width:1em;height:1em;background-color:#B84E4E;border:1px solid #888;vertical-align:middle"></span> `#B84E4E` | <span style="display:inline-block;width:1em;height:1em;background-color:#E07A76;border:1px solid #888;vertical-align:middle"></span> `#E07A76` | 删除与错误           |
| `--color-border`         | <span style="display:inline-block;width:1em;height:1em;background-color:#D9DDE3;border:1px solid #888;vertical-align:middle"></span> `#D9DDE3` | <span style="display:inline-block;width:1em;height:1em;background-color:#343A43;border:1px solid #888;vertical-align:middle"></span> `#343A43` | 分隔线与控件边框     |
| `--color-border-strong`  | <span style="display:inline-block;width:1em;height:1em;background-color:#66788B;border:1px solid #888;vertical-align:middle"></span> `#66788B` | <span style="display:inline-block;width:1em;height:1em;background-color:#4D5967;border:1px solid #888;vertical-align:middle"></span> `#4D5967` | 区块顶部强调线       |
| `--color-control`        | <span style="display:inline-block;width:1em;height:1em;background-color:#FFFFFF;border:1px solid #888;vertical-align:middle"></span> `#FFFFFF` | <span style="display:inline-block;width:1em;height:1em;background-color:#292D34;border:1px solid #888;vertical-align:middle"></span> `#292D34` | 输入框与普通按钮表面 |
| `--color-surface-subtle` | <span style="display:inline-block;width:1em;height:1em;background-color:#F5F6F8;border:1px solid #888;vertical-align:middle"></span> `#F5F6F8` | <span style="display:inline-block;width:1em;height:1em;background-color:#202329;border:1px solid #888;vertical-align:middle"></span> `#202329` | 次级区块表面         |
| `--color-tooltip`        | <span style="display:inline-block;width:1em;height:1em;background-color:#202832;border:1px solid #888;vertical-align:middle"></span> `#202832` | <span style="display:inline-block;width:1em;height:1em;background-color:#D8DDE4;border:1px solid #888;vertical-align:middle"></span> `#D8DDE4` | Tooltip 与通知背景   |
| `--color-passive`        | <span style="display:inline-block;width:1em;height:1em;background-color:#80659A;border:1px solid #888;vertical-align:middle"></span> `#80659A` | <span style="display:inline-block;width:1em;height:1em;background-color:#B39AD0;border:1px solid #888;vertical-align:middle"></span> `#B39AD0` | 被动产物增量         |
| `--color-sidebar`        | <span style="display:inline-block;width:1em;height:1em;background-color:#3A4049;border:1px solid #888;vertical-align:middle"></span> `#3A4049` | <span style="display:inline-block;width:1em;height:1em;background-color:#292E36;border:1px solid #888;vertical-align:middle"></span> `#292E36` | 固定侧栏背景         |
| `--color-sidebar-text`   | <span style="display:inline-block;width:1em;height:1em;background-color:#CBD1DA;border:1px solid #888;vertical-align:middle"></span> `#CBD1DA` | <span style="display:inline-block;width:1em;height:1em;background-color:#BDC6D1;border:1px solid #888;vertical-align:middle"></span> `#BDC6D1` | 侧栏菜单文字与图标   |
| `--color-sidebar-active` | <span style="display:inline-block;width:1em;height:1em;background-color:#557FA3;border:1px solid #888;vertical-align:middle"></span> `#557FA3` | <span style="display:inline-block;width:1em;height:1em;background-color:#465F75;border:1px solid #888;vertical-align:middle"></span> `#465F75` | 侧栏选中与悬浮状态   |
| `--color-sidebar-border` | <span style="display:inline-block;width:1em;height:1em;background-color:#565D68;border:1px solid #888;vertical-align:middle"></span> `#565D68` | <span style="display:inline-block;width:1em;height:1em;background-color:#414954;border:1px solid #888;vertical-align:middle"></span> `#414954` | 侧栏分隔线           |

- 绿色不再承担品牌主色，只表达成功或满足。
- 页面颜色只能引用语义 token；组件不得新增无归属的硬编码颜色。
- 页面基底、表面、边框和正文文字使用无绿色倾向的中性灰；浅色和深色共享间距、圆角、字号和交互结构。
- 正文最小文字与背景对比度达到 WCAG AA。
- 深色主题的未选控件使用 `#292D34` 表面和 `#343A43` 边框，选中控件使用低饱和蓝灰 `#34495E`，避免白色控件和高亮分隔线破坏视觉层级。
- 稀有度圆点在浅色和深色主题中保留相同的绿、蓝、紫、金业务背景；浅色主题使用略带各档色相的柔和浅色文字，深色主题中 `2/3/4` 使用浅色文字、`5` 使用深色文字，保证各档清晰且视觉协调。

### 8.2 组件基线

- 卡片和弹层圆角不超过 8px。
- 图标按钮使用 Lucide，提供 Tooltip 与可访问名称。
- 输入、按钮、Tab、表格、通知、Tooltip、对话框和工作区标签建立共享组件状态。
- Hover 不改变元素尺寸；聚焦状态清晰可见。
- 固定格式组件使用稳定宽高，加载和动态文案不推动布局。
- 页面组件不得直接使用浅色主题的表面色、文字色或边框色；必须通过语义 token 适配主题。稀有度等固定业务色也必须使用组件限定选择器，不能用全局 `.r2` 一类规则影响其他组件。

### 8.3 产品图标

- 使用原创图形，不使用原神 Logo、角色立绘或官方图标拼接。
- 方向为“规划清单 + 元素晶体”的简洁符号，避免继续使用 Electron 默认视觉。
- 交付源图、透明 PNG 和 Windows 多尺寸 `.ico`，至少覆盖 16、24、32、48、64、128、256px。
- 在任务栏、窗口图标、关于页和发布制品中使用同一品牌图标。

## 9. 最小内置资料

### 9.1 示例对象

| 类别         | 对象       | 稳定 ID    | 状态                                 |
| ------------ | ---------- | ---------- | ------------------------------------ |
| 角色         | 神里绫华   | `10000002` | 支持角色天赋计算                     |
| 1 星单手剑   | 无锋剑     | `11101`    | 可浏览，来源曲线不完整时明确不可计算 |
| 2 星单手剑   | 银剑       | `11201`    | 可浏览，来源曲线不完整时明确不可计算 |
| 3 星单手剑   | 冷刃       | `11301`    | 支持时完整计算                       |
| 4 星单手剑   | 笛剑       | `11402`    | 支持时完整计算                       |
| 5 星专属武器 | 雾切之回光 | `11509`    | 完整武器突破计算                     |

- 保留上述对象当前功能使用的材料系列、逐级材料、需求曲线、合成角色和关系闭包。
- v1.1.0 只要求跑通当前已经交付的角色天赋、武器突破和手动计算；完整角色等级与突破关系在 v1.2.x 随功能实现补齐。
- 示例对象与用户同步的完整资料使用相同 ID，更新后方案引用保持有效。
- 发布样本和自动化 fixture 分开维护。

### 9.2 图像与权属

- MIT 仅覆盖项目自有代码和原创资源。
- 官方图像只有在确认再分发依据后才能进入发布包；否则示例对象使用原创通用占位图，用户主动同步后再从资料包加载图标。
- `NOTICE` 记录游戏、Lunaris、第三方依赖和非原创资料的来源及权属边界。

### 9.3 构建流程

```text
Lunaris 完整资料 -> 下载与校验 -> 选择示例对象 -> 计算关系闭包
                 -> 校验最小包 -> 写入 resources/game-data/builtin
```

- 增加可重复执行的示例资料生成与校验命令。
- 打包不联网；用户完整资料不进入发布目录。
- 恢复内置资料会回到示例包；该操作只原子替换游戏资料，不得删除、覆盖或迁移 Profile 与培养计划。执行前备份现有游戏资料并按 7.3 节显示影响警告。

### 9.4 本地资料目录

- 对外导入、导出的资料格式仅支持 `.gdata`；中文格式名为“原神游戏资料包”，英文格式名为 “Genshin Data Package”，不兼容旧扩展名。
- 导出文件默认命名为 `genshin-data-<provider>-v<gameDataVersion>.gdata`，其中资料来源和版本号均读取当前 manifest，例如 `genshin-data-lunaris-v7.0.54.2.gdata`。
- 已安装资料以 `game-data/<provider>-v<gameDataVersion>/` 命名，例如 `game-data/lunaris-v7.0.54.2/`。
- `game-data/state.json` 的 `activeVersion` 指向当前启用版本；最近操作记录与该指针保存在同一状态文件中。
- v1.0.0 的 `game-data/active/` 在首次读取时迁移到 manifest 对应的版本目录，培养计划和 Profile 不参与迁移。
- 同步、导入和恢复先写入 staging 目录，校验通过后再切换 `activeVersion`；替换同版本时必须保留临时回滚目录，成功后再清理。

## 10. 文件与构建目录

```text
src/                 源码
resources/           受控内置资源
docs/                Roadmap、设计和维护文档
out/                 可删除的构建工作目录
  renderer/          Vite 输出
  electron/          主进程和 preload 输出
  game-data/         资料生成中间结果
  package/           electron-builder 中间结果
  test-results/      E2E 失败证据与 Playwright 报告
  coverage/          覆盖率报告
  test-build/        测试专用构建
  package/           Windows 发布制品
```

- 迁移 Vite、TypeScript、资料生成和 electron-builder 输出到上述目录。
- Windows 发布制品由 electron-builder 写入 `out/package/`；常规验证不生成该目录。
- 清理旧目录前验证其绝对路径位于仓库内，并确认没有源码或用户数据。
- 新流程通过后删除已被替代的 `dist`、`dist-electron`、`dist-renderer` 和 `build-renderer`。

### 10.1 产品与制品名称

- 中文产品名：`原神养成规划器`。
- 英文产品名：`Genshin Planner`。
- Windows 可执行文件：`GenshinPlanner.exe`。
- ZIP：`GenshinPlanner-v1.1.0-win-x64.zip`。
- `appId` 和用户数据目录标识保持兼容，避免现有 Profile 路径变化。

## 11. 代码结构与质量

- 领域计算保留在 `src/domain`，Profile 与游戏资料持久化分别由主进程存储模块负责；本版本未完成 `App.tsx` 的页面级拆分，后续功能开发前应按全局框架、总览、计算页、设置、选择器和方案管理逐步拆分。
- 共享类型、Schema 和 preload 契约保持单向依赖，渲染进程不导入主进程实现。
- 公共 API、类、类字段、资料适配、IPC、迁移和复杂计算补充简体中文 JSDoc/TSDoc。
- 引入 ESLint 的 TypeScript、React Hooks、import 和 JSDoc/TSDoc 规则。
- `npm run lint` 不自动修改文件；另设 `npm run lint:fix` 供明确调用。
- lint 以准确性为目标，不强制为显而易见的局部实现添加注释。

## 12. 自动化测试设计

### 12.1 分层

| 层次     | 工具与环境                       | 负责内容                                           |
| -------- | -------------------------------- | -------------------------------------------------- |
| 单元测试 | Vitest + Node                    | 计算、名称生成、Schema、资料筛选、路径与迁移纯函数 |
| 组件测试 | Vitest + jsdom + Testing Library | 表单、选择器、Tab、对话框、主题与键盘交互          |
| 集成测试 | Vitest + Node 临时目录           | Profile、资料安装、备份、原子写入、IPC handler     |
| E2E      | Playwright Electron              | 真实窗口中的导航、方案、设置、保存和重启           |
| 视觉回归 | Playwright screenshot            | 固定主题、语言、窗口尺寸下的信息层级和布局         |

### 12.2 命令

```text
npm run test:unit
npm run test:component
npm run test:integration
npm run test:e2e
npm run test:e2e:headed
npm run test:visual
npm run test:coverage
npm run test:clean
npm run verify
```

- `verify` 执行 lint、全部非可视测试、类型检查和生产构建，默认不显示 Electron 窗口。
- E2E 默认以隐藏测试窗口运行，不抢焦点、不移动系统鼠标、不发送真实键盘输入。
- `test:e2e:headed` 仅用于明确的可视调试，不属于默认验证。
- 每次 E2E 创建独立临时 `userData` 和固定资料，不访问真实用户数据。
- 涉及 v1.0.0 兼容性的测试从脱敏固定夹具复制方案到临时 `userData`，不得把开发者当前使用的 Profile 或游戏资料作为测试输入、备份目标或清理目标。
- 原生文件选择器使用测试适配器；真实系统边界保留最少量发布候选人工检查。

### 12.2.1 测试产物生命周期

| 内容                              | 固定位置                        | 是否入 Git | 生命周期                                                    |
| --------------------------------- | ------------------------------- | ---------- | ----------------------------------------------------------- |
| 视觉回归基线                      | `tests/visual/__screenshots__/` | 是         | 仅随确认的设计变化更新                                      |
| README 正式截图                   | `docs/assets/screenshots/`      | 是         | 随发布候选界面更新                                          |
| E2E 截图、diff、trace、视频与报告 | `out/test-results/`             | 否         | 运行前清理旧结果；成功后清空，失败时保留本轮结果            |
| 覆盖率报告                        | `out/coverage/`                 | 否         | 每次 `test:coverage` 重建                                   |
| 测试专用构建                      | `out/test-build/`               | 否         | 每次相关测试重建，`test:clean` 删除                         |
| 临时 Profile、游戏资料与备份      | 系统临时目录中的本次随机子目录  | 否         | 关闭测试进程后在 `finally` 中校验并删除                     |
| 下载或故障注入夹具                | 本次随机临时目录                | 否         | 用例结束时删除；固定脱敏夹具另存 `tests/fixtures/` 并入 Git |

- `npm run test:clean` 只清理表中明确列出的可再生目录，并在删除前校验解析后的绝对路径；测试启动前调用同一清理实现，避免两套规则漂移。
- 测试不得在仓库根目录、真实 `userData`、用户下载目录或桌面散落截图、日志、临时 JSON 和数据库文件。

### 12.3 v1.1.0 核心 E2E

1. 启动示例资料，关闭弱提示并进入游戏资料更新页。
2. 打开已有方案，在导航与标签间切换后继续编辑，输入不丢失。
3. 保存、另存为、名称冲突、保存失败和关闭未保存标签。
4. 手动计算与整数被动结果。
5. 切换浅色、深色和跟随系统，重启后保持设置。
6. 打开用户数据目录和游戏资料目录时验证受限 IPC，不真实启动资源管理器。
7. 在临时 Profile 中放入引用非示例角色和武器的 v1.0.0 方案；恢复内置资料前出现影响警告，取消后资料与方案均不变化。
8. 确认恢复后方案文件内容保持不变，受影响方案仍在列表中但暂不可打开；重新同步完整测试资料后，同一方案无需迁移即可重新打开和计算。
9. 资料同步取消、校验失败或原子替换失败时，原游戏资料与全部方案保持正确。
10. 强制结束测试应用并重新启动，已保存方案与设置保持一致。

### 12.4 视觉回归

- 窗口尺寸至少覆盖 1280x800、1440x900 和 1920x1080。
- 浅色与深色分别覆盖总览、三个计算页、设置、选择器和保存对话框。
- 中文覆盖最长主要文案，英文覆盖长单词和按钮宽度。
- 截图基线更新必须关联设计变化，不能为让测试通过而整体覆盖。
- 视觉回归基线保存在 `tests/visual/__screenshots__/` 并纳入版本控制；README 使用的发布候选截图保存在 `docs/assets/screenshots/`。这两类是受维护的项目资产，不属于测试垃圾。
- 普通 E2E 仅在失败时截图；失败截图、差异图、trace、视频和 HTML 报告统一写入 Git 忽略的 `out/test-results/`。每次测试开始前删除上一轮产物；本轮全部通过后清空，失败时只保留本轮诊断产物并在下一次运行前替换。
- 临时 `userData` 使用系统临时目录下本次测试专属的随机子目录。测试清理必须在 `finally` 中先关闭 Electron 及其子进程，再校验目标确为本次临时目录并定向删除；即使测试失败也不得清理真实用户目录或仓库中的非测试文件。
- Windows 文件句柄暂未释放时进行有限次数重试；仍无法清理则让测试失败并报告准确目录，不扩大删除范围，也不静默遗留。

### 12.5 覆盖率与 CI

- `test:coverage` 合并单元、组件和集成测试的结果；纳入统计的业务源码在 statements、branches、functions 和 lines 四项均不得低于 90%。
- 覆盖率只排除生成代码、纯类型声明、第三方资源和明确无法执行的平台声明文件；不得排除领域计算、Schema、迁移、持久化、IPC、React 组件或错误分支来达到阈值。所有排除项必须在测试配置中逐项可见并说明原因。
- E2E 和视觉回归用于验证真实用户流程与呈现，不计入上述覆盖率以虚增数字；覆盖率门槛达到后采用只升不降原则。
- GitHub Actions 使用 Windows runner 执行 `npm run verify` 和隐藏 Electron E2E。
- 失败上传测试报告、必要日志和截图差异；日志清除用户路径与隐私数据。

## 13. License、Changelog 与 GitHub

### 13.1 License

- 根目录添加标准 MIT `LICENSE`，版权人为 `Kumasuke120`，年份为 2026。
- `package.json` 声明 `license: MIT`。
- `NOTICE` 明确 MIT 适用范围和游戏资料、图像、名称及第三方依赖的权属边界。
- 第三方依赖许可暂通过锁文件和依赖自身许可证追溯；本版本未生成独立的 `THIRD_PARTY_LICENSES` 汇总文件。

### 13.2 Changelog

- 使用 Keep a Changelog 结构：`Unreleased`、`Added`、`Changed`、`Fixed`、`Security`。
- 根据 `v1.0.0` Tag、`DESIGN_v1.0.0.md` 和提交记录补回 v1.0.0。
- v1.1.0 开发中的用户可见变化持续记录在 `Unreleased`，发布时写入日期。

### 13.3 README 与仓库公开

- README 包含产品截图、使用教程、资料更新、数据目录、隐私、开发、验证、Roadmap、License 和免责声明。
- 首批徽章：MIT License、Windows、CI、最新 Release。不存在的 CI 或 Release 不显示徽章。
- 截图来自发布候选构建，不包含本机路径、UID、邮箱或私人方案。
- 公开前扫描当前文件与 Git 历史中的密钥、用户数据、绝对路径、构建产物和无权再分发资源。
- 仓库地址确定为 [genshin-planner](https://github.com/kumasuke120/genshin-planner)。
- 今晚只完成本地公开准备，不创建 GitHub 远端、不推送代码；用户次日验收后再执行首次上传。
- 开发和自动化验证完成后保持未发布状态，不打 `v1.1.0` Git Tag。只有用户人工验收通过并明确同意发布后，才归档 Changelog、打 Tag、生成发布制品或上传 GitHub。

## 14. 数据兼容与迁移

- Profile Schema 保持 v1；新增主题字段采用可选值并提供 `system` 默认值，v1.0.0 Profile 无需破坏性迁移。
- 现有方案 ID、名称、目标、库存和时间保持不变。
- “手动计算”在 v1.1.0 作为临时计算工具，不提供新建或保存方案入口；底层 `manual` 类型保持可读，旧手动计算方案仍可从“我的方案”打开查看，但不再保存修改。
- 现有用户已同步的完整游戏资料继续优先于新内置示例资料。
- 游戏资料与 Profile 是两个独立持久化边界。恢复内置资料不得写入 Profile；资料缺失只产生可逆的“暂不可用”展示状态，不能被解释为方案损坏，也不能触发方案清理。
- 首次启动 v1.1.0 前创建 Profile 和游戏资料状态备份；迁移或读取失败时继续保留原文件。
- `appId`、协议和用户数据根目录保持不变。

## 15. 实现顺序

1. 建立 License、Changelog、目录和脚本基线。
2. 拆分 Profile 与游戏资料持久化边界，保持现有测试通过；页面级组件拆分顺延。
3. 实现工作区标签和未保存状态。
4. 实现设置重组、目录入口和关于页。
5. 实现主题 token、浅色、深色和系统跟随。
6. 生成品牌图标并替换 Electron 默认图标。
7. 实现神里绫华最小资料生成、校验和弱引导。
8. 建立分层 Vitest、Playwright E2E、视觉回归和覆盖率。
9. 整理 README、截图、徽章和 NOTICE；独立第三方许可汇总顺延。
10. 运行完整验证、迁移演练、GitHub 公开前检查和本地发布候选验收，不创建或推送远端。

## 16. 验收标准

- v1.0.0 的计算、资料同步和方案能力没有回归。
- 再次点击导航不会关闭或重置正在编辑的方案。
- 多个工作区标签能够切换、关闭并正确处理未保存内容。
- 产品名、手动计算、EXE 名称和所有用户文案保持一致。
- 浅色、深色和跟随系统均可使用，重启后选择保持一致。
- 设置中的方案、资料、目录和关于入口均有明确结果与错误状态。
- 无完整资料时可以使用神里绫华示例流程，并能主动同步完整资料。
- 所有发布内置资源均有来源和权属记录。
- `npm run verify`、隐藏 Electron E2E 和视觉回归通过，默认测试过程不干扰用户桌面。
- README 教程和截图与发布候选界面一致。
- v1.0.0 Profile、方案和已同步资料升级后仍可使用。
- 常规构建只写入 `out/`，不生成 ZIP；只有用户明确要求才执行打包。
- 自动化测试通过不等同于发布验收；用户验收前不得打 `v1.1.0` Tag。

## 17. 本轮确认项

开始开发前只需确认以下整体方向：

1. v1.1.0 使用工作区标签解决方案编辑连续性，而不是仅修改导航点击行为。
2. 示例角色固定为神里绫华，示例武器固定为无锋剑、银剑、冷刃、笛剑和雾切之回光。
3. 产品英文名使用 `Genshin Planner`，可执行文件和制品前缀使用 `GenshinPlanner`。
4. 当前不生成 Windows 绿色 ZIP；用户验收通过并明确要求发布制品后再执行打包。

# 原神养成材料规划器

离线优先的 Electron 桌面工具，用于规划角色天赋、武器突破和手动材料目标。输入库存后，应用会计算需求、3:1 合成、合成角色被动收益和最终缺口。

## 功能

- 角色天赋、武器突破与手动材料计算
- 保存方案和材料库存
- 内置游戏资料与图标，支持手动同步、导入、导出和恢复
- 中英文界面
- 本地数据优先：日常使用不依赖网络

## 开发

需要 Node.js 20 或更高版本。

```bash
npm install
npm run dev
```

## 验证与构建

```bash
npm test
npx tsc --noEmit -p tsconfig.json
npm run build
```

## Windows 绿色版

```bash
npm run package
```

该命令会先执行生产构建，再生成 Windows x64 ZIP，不生成安装程序。产物位于：

```text
release/Genshin Material Planner-1.0.0-win.zip
```

解压后直接运行 `Genshin Material Planner.exe`。

## 本地数据

Windows 默认将用户方案、库存和已下载游戏资料存放在：

```text
%APPDATA%/genshin-material-planner/
```

其中 `profile.json` 保存方案和库存，`game-data/active` 保存当前下载的游戏资料与图标。

## 设计文档

- [v1.0.0 设计文档](docs/DESIGN_v1.0.0.md)

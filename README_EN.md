# Genshin Planner

<p align="center">
  <a href="README.md">简体中文</a> | <strong>English</strong>
</p>

<p align="center">
  <a href="https://github.com/kumasuke120/genshin-planner/actions/workflows/ci.yml"><img src="https://github.com/kumasuke120/genshin-planner/actions/workflows/ci.yml/badge.svg?branch=master" alt="Build Status"></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/kumasuke120/genshin-planner" alt="MIT License"></a>
  <img src="https://img.shields.io/badge/coverage-%E2%89%A590%25-4C956C" alt="Coverage at least 90%">
  <img src="https://img.shields.io/badge/platform-Windows-557FA3" alt="Windows">
</p>

<p align="center">
  <img src="resources/brand/app-icon.svg" width="112" height="112" alt="Genshin Planner logo">
</p>

![Genshin Planner overview](docs/assets/screenshots/overview.png)

## Usage

1. Open **Settings > Game Data** and select **Sync Lunaris** to download the complete game data. The built-in sample data can also be used to try the basic workflow.
2. Open **Character Talents** or **Weapon Ascension** from the sidebar, then select the target and desired level.
3. Enter the materials currently in your inventory, optionally select a crafting character, and review the available amounts after crafting and any remaining deficits.
4. Select **Save Plan** to keep a progression target. Saved plans can be reopened from the overview or **Settings > My Plans**.
5. Use **Manual Calculation** for a temporary calculation of one material family. Manual calculations cannot be saved as plans.

## Build

Node.js 20 or later is required.

```bash
npm ci
npm run build
```

Local development:

```bash
npm run dev
```

Full verification:

```bash
npm run verify
npm run test:e2e
npm run test:visual
```

Build the portable Windows ZIP:

```bash
npm run package
```

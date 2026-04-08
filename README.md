# Encrypted Diary

[English README](./README.en.md)

一个基于 Electron + React + TypeScript 的本地加密日记应用。

项目目标是提供一个离线、轻量、以本地隐私为优先的桌面日记工具。所有日记内容都保存在本机，使用主密码派生出的密钥进行加密，不依赖云同步。

## 特性

- 本地存储，默认不上传任何日记内容
- 主密码校验基于 PBKDF2
- 日记内容使用 AES-256-GCM 加密
- Electron 主进程负责加密、解密与文件读写
- React + Ant Design 桌面界面
- 自动保存与手动保存
- 全文搜索
- 手动锁定与空闲自动锁定
- 支持打包为 Windows 安装包
- 安装器支持自定义安装路径

## 技术栈

- Electron
- React 18
- TypeScript
- Zustand
- Ant Design
- Vite
- Vitest

## 当前实现范围

当前仓库包含以下已完成能力：

- 首次启动设置主密码
- 再次启动输入主密码解锁
- 左侧日记列表、中间编辑区、右侧搜索结果三栏布局
- 新建、查看、编辑、保存日记
- 菜单栏快捷操作
- 自动保存
- 搜索已保存日记内容
- 主进程内缓存与自动锁定逻辑
- 单元测试与基础打包配置

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 启动开发环境

先启动前端开发服务器：

```bash
npm run dev:renderer
```

再编译并启动 Electron：

```bash
npm run build:electron
npm start
```

## 常用命令

```bash
npm install
npm test
npm run build:electron
npm run dev:renderer
npm start
npm run build
```

说明：

- `npm test`：运行单元测试
- `npm run build:electron`：编译 Electron 主进程
- `npm run dev:renderer`：启动 Vite 开发服务器
- `npm start`：启动桌面应用
- `npm run build`：生成生产构建与安装包

## 打包

执行：

```bash
npm run build
```

构建输出位于：

- `release/win-unpacked/`
- `release/Encrypted Diary Setup <version>.exe`

安装器为 assisted 模式，支持手动选择安装路径。

## 数据存储位置

当前版本默认将数据保存在系统用户目录，而不是安装目录。

Windows 下通常位于：

```text
C:\Users\<用户名>\AppData\Roaming\local-encrypted-diary\appData
```

目录结构如下：

```text
appData/
├─ config.json
├─ index.json
└─ diaries/
   └─ {uuid}.enc
```

说明：

- `config.json`：主密码校验相关参数
- `index.json`：日记索引
- `diaries/*.enc`：每篇日记的加密内容

## 安全设计

项目当前采用的主要安全边界如下：

- 渲染进程不直接访问文件系统与加密 API
- 所有加密、解密、文件读写都在 Electron 主进程执行
- 启用 `contextIsolation`
- 禁用 `nodeIntegration`
- 使用 `preload` 暴露受限 API
- 主密码不明文存储
- 锁定时清空内存中的密钥与缓存

需要说明的是：这不是一个面向高对抗场景的安全产品。它更适合个人本地隐私管理，而不是防御系统级攻击、内存转储或管理员权限攻击。

## 测试

运行测试：

```bash
npm test
```

当前测试覆盖包括：

- 加密/解密正确性
- 不同 IV 生成不同密文
- `authTag` 篡改后解密失败
- 密文篡改后解密失败
- 空文本与长文本边界情况
- 主密码验证
- 自动锁定逻辑

## 项目结构

```text
.
├─ build/               # 安装器自定义脚本
├─ electron/            # Electron 主进程 / preload / IPC
├─ src/
│  ├─ shared/           # 共享类型、加密与搜索逻辑
│  ├─ store/            # Zustand 状态管理
│  ├─ types/            # 类型声明
│  ├─ App.tsx           # 主界面
│  └─ main.tsx          # 前端入口
├─ tests/               # Vitest 单元测试
├─ package.json
└─ README.md
```

## 开发说明

- 生产环境下 Electron 通过 `file://` 加载页面，因此 Vite 构建使用相对资源路径
- 如果调整了打包、资源路径或 preload 配置，建议重新执行完整构建验证
- Windows 安装包使用 `electron-builder`

## 仓库状态

这个项目目前更偏向一个可运行的原型与工程化练习版本，仍有继续增强的空间，例如：

- 更丰富的日志组织能力
- 更细粒度的搜索与高亮
- 更强的删除与管理能力
- 更完善的数据迁移与卸载策略
- 更小的打包体积与更完整的图标资源

## 适合谁

这个项目适合：

- 想学习 Electron + React 桌面应用开发的人
- 想参考本地加密存储基本做法的人
- 想从简单原型继续扩展为完整日记软件的人

## 许可证

当前仓库未单独附带许可证文件。

如果你计划公开发布或接受他人贡献，建议补充一个明确的 `LICENSE` 文件，例如 MIT。

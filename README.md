# VCP 本地部署备份仓库

本仓库是 [VCPChat](https://github.com/lioensky/VCPChat) + [VCPToolBox](https://github.com/lioensky/VCPToolBox) 的 **monorepo 备份**，用于防止本地代码丢失。

- **GitHub：** https://github.com/xingxiaomeng/vcp
- **上游文档：** [VCPToolBox README](VCPToolBox/README.md) · [VCPChat README](VCPChat/README.md)

---

## 目录结构

```
vcp/
├── VCPChat/          # Electron 前端客户端
├── VCPToolBox/       # Node.js 后端与插件系统
├── scripts/          # 辅助脚本
├── start-backend.bat # 启动后端（PM2）
├── start-frontend.bat# 启动前端
├── runtimes/         # 便携 Node / Git / Python（未入库，见下文）
└── vcpkg/            # C++ 包管理器（未入库，可选）
```

**默认端口**

| 服务 | 端口 | 说明 |
|------|------|------|
| vcp-main | 6005 | VCP 主 API |
| vcp-admin | 6006 | 管理面板 |

---

## 仓库里有什么 / 没有什么

`.gitignore` 刻意排除了体积大、可重装或含敏感信息的内容。**克隆本仓库后，还需要从旧机器备份或重新安装下列内容。**

### 已入库（可直接 `git clone` 获得）

- VCPChat、VCPToolBox 全部源码
- Agent 定义、插件源码、SkillBridge 技能目录
- 各插件的 `config.env.example` 模板
- 启动脚本 `start-backend.bat` / `start-frontend.bat`

### 未入库（需本地恢复）

| 路径 / 类型 | 原因 | 恢复方式 |
|-------------|------|----------|
| `**/config.env` | 含 API Key 等密钥 | 从旧机器复制，或由 `.example` 新建 |
| `VCPChat/AppData/` | 用户数据、聊天记录、设置 | 从旧机器整目录复制 |
| `runtimes/` | 便携运行时（约 2 GB） | 从旧机器复制，或安装系统级 Node/Git/Python |
| `**/node_modules/` | npm 依赖 | 各目录执行 `npm install` |
| `vcpkg/` | 第三方 C++ 包管理器 | `git clone https://github.com/microsoft/vcpkg vcpkg` |
| `*.exe` | 编译产物 | 重新编译或从 [VCPChat Releases](https://github.com/lioensky/VCPChat/releases) 下载 |
| `*.db` / `logs/` | 运行时数据库与日志 | 无需恢复，启动后自动生成 |
| `Plugin/**/dailyhot_cache.md` 等缓存 | 插件运行时缓存 | 无需恢复，插件会自动重建 |

> **安全提示：** 切勿将 `config.env`、`.env.local` 或含真实密钥的文件提交到 Git。若曾误提交，请立即轮换密钥并使用 `git filter-repo` 清理历史。

---

## 场景 A：全新机器，从 Git 恢复

### 1. 克隆仓库

```bat
git clone https://github.com/xingxiaomeng/vcp.git
cd vcp
```

### 2. 恢复运行时（二选一）

**方式 A — 从旧机器复制（推荐，与 bat 脚本兼容）**

将旧机器上的 `runtimes/` 整个目录复制到仓库根目录：

```
vcp/runtimes/
├── node/
├── git/
└── python/
```

**方式 B — 使用系统已安装环境**

自行安装 [Node.js LTS](https://nodejs.org/)、Git、Python 3，并确保它们在 `PATH` 中。此时可直接在各子目录运行命令，不必依赖 `runtimes/`（但 `start-*.bat` 默认优先使用 `runtimes/`）。

### 3. 安装 Node 依赖

```bat
cd VCPChat
npm install
npx electron-rebuild --only better-sqlite3
cd ..\VCPToolBox
npm install
cd ..
```

> 每次升级 Electron 或切换 Node 版本后，需在 `VCPChat` 目录重新执行 `npx electron-rebuild --only better-sqlite3`。

### 4. 安装 Python 依赖（音频引擎、部分插件）

```bat
cd VCPChat
pip install -r requirements.txt
cd ..
```

### 5. 恢复配置文件

```bat
:: 主配置（必填）
copy VCPToolBox\config.env.example VCPToolBox\config.env
:: 编辑 VCPToolBox\config.env，填入 API_Key、API_URL、Key 等

:: SkillBridge 插件（若使用 Skill 能力）
copy VCPToolBox\Plugin\SkillBridge\config.env.example VCPToolBox\Plugin\SkillBridge\config.env
```

其他已启用的插件，按需将其目录下的 `config.env.example` 复制为 `config.env` 并填写。

### 6. 恢复用户数据（可选，保留聊天记录与设置）

从旧机器复制：

```
VCPChat/AppData/          → 设置、Agent 配置、歌单、桌面小组件等
```

首次使用可跳过此步，在客户端全局设置中配置用户名与后端地址。

### 7. 音频引擎与壁纸（可选）

- **Hi-Fi 音频：** 编译 `VCPChat/rust_audio_engine`，或从 [VCPChat Releases · 解码器](https://github.com/lioensky/VCPChat/releases) 获取 `audio_server.exe`，放到 `VCPChat/audio_engine/`。
- **壁纸包：** 从 [VCPChat Releases](https://github.com/lioensky/VCPChat/releases) 下载，避免元素窗口显示异常。

音频引擎本地配置见 `VCPChat/audio_engine/.env`（已入库，无密钥，可按需修改采样率等参数）。

### 8. 安装 PM2 并启动

```bat
npm install -g pm2

:: 后端
start-backend.bat

:: 前端（另开终端）
start-frontend.bat
```

后端启动后可用 `pm2 list` 查看 `vcp-main`、`vcp-admin` 状态；日志：`pm2 logs`。

### 9. 前端连接后端

在 VCPChat **全局设置** 中配置：

- 后端地址：`http://127.0.0.1:6005`
- 与 `VCPToolBox/config.env` 中 `Key` 一致的访问密钥
- **用户名**（必填，否则多项功能报错）

---

## 场景 B：旧机器完整备份清单

迁移前，除本 Git 仓库外，建议额外打包以下目录：

```
vcp/runtimes/                          # 便携运行时
vcp/VCPToolBox/config.env              # 主密钥配置
vcp/VCPToolBox/Plugin/**/config.env    # 各插件密钥（按需）
vcp/VCPChat/AppData/                   # 用户数据
vcp/VCPChat/audio_engine/audio_server.exe   # 若未重新编译
vcp/vcpkg/                             # 若本地有 C++ 构建需求
```

恢复顺序：**Git clone → 覆盖上述目录 → npm install → 启动**。

---

## 场景 C：日常同步代码到 GitHub

```bat
cd vcp
git status
git add .
git commit -m "描述本次变更"
git push origin main
```

推送前请确认 `git status` 中**没有** `config.env`、`AppData/`、`node_modules/` 等被忽略项意外出现。若出现，检查是否修改了 `.gitignore` 或使用了 `git add -f`。

---

## vcpkg（可选，C++ 原生模块）

仅在你需要编译 Rust/C++ 音频引擎或其他原生依赖时使用：

```bat
git clone https://github.com/microsoft/vcpkg vcpkg
cd vcpkg
bootstrap-vcpkg.bat
```

`vcpkg/` 目录体积大，未纳入本仓库；每台机器单独 clone 即可。

---

## 常见问题

**Q: `start-backend.bat` 提示找不到 `server.js`？**  
A: 确认在仓库根目录执行，且 `VCPToolBox/` 已完整克隆。

**Q: 前端无法连接后端？**  
A: 检查 `pm2 list` 中 `vcp-main` 是否为 online；端口 6005 是否被占用；前端密钥是否与 `config.env` 的 `Key` 一致。

**Q: `better-sqlite3` / `NODE_MODULE_VERSION` 报错？**  
A: 在 `VCPChat` 目录执行 `npx electron-rebuild --only better-sqlite3`。

**Q: 天气 / GPU / Docker 小组件无数据？**  
A: 需在 `config.env` 配置对应 API Key（如 `WeatherKey`），部分能力依赖 LibreHardwareMonitor 等本地组件。

**Q: Skill 能力不生效？**  
A: 确认 `VCPToolBox/Plugin/SkillBridge/config.env` 存在，且 Agent 文件中包含 `{{VCPSkillToolBox}}` 占位符；重启 `vcp-main` 后检查管理 API 是否注册 SkillBridge。

---

## 相关链接

- 本仓库：https://github.com/xingxiaomeng/vcp
- VCP 官网：https://www.vcptoolbox.com
- 上游 VCPChat：https://github.com/lioensky/VCPChat
- 上游 VCPToolBox：https://github.com/lioensky/VCPToolBox

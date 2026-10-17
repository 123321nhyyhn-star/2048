# 核芯 CORE 2048

一款支持浏览器、HarmonyOS 和 Android 的离线 2048 小游戏。

## 功能

- 标准 4 × 4 棋盘，支持触屏滑动、方向键和 WASD；合成 2048 后可继续挑战。
- 自动保存棋盘、分数和设置，记录最高分、最高数字与合并统计。
- 合并动画、电子音效与触感反馈，可调节音量或关闭声音、震动和动效。
- 游戏资源随应用内置，原生应用无需联网；网页支持离线构建。

## 本地运行

需要 Node.js 20+，无需安装第三方依赖。在项目根目录执行：

```powershell
npm run dev
```

打开 [游戏](http://127.0.0.1:2048)；同一局域网的手机可使用电脑的局域网 IP 访问端口 `2048`。

| 命令 | 用途 |
| --- | --- |
| `npm test` | 运行规则、存档、音效与离线构建测试 |
| `npm run build` | 生成 `dist/` 离线网页，并同步鸿蒙内置资源 |
| `npm run preview` | 预览已构建的网页，需先运行 build |
| `npm run qa` | 启动端口 `2050` 的隔离测试场景 |
| `npm run android:build` | 构建 Android APK，需 Android SDK 和 JDK |
| `npm run harmony:build` | 构建鸿蒙 HAP，需鸿蒙 SDK 和构建工具 |
| `npm run harmony:release` | 构建鸿蒙发布 APP/HAP，分发需配置发布签名 |

网页产物位于 `dist/`，原生安装包位于 `artifacts/`，均由本地构建生成，不随源码提交。将 `dist/` 部署到 HTTPS 站点后可使用 Service Worker 离线缓存。

## 音效测试

启动开发服务器后，打开 [音效测试页](http://127.0.0.1:2048/sound-test.html)，可试听五种音效、调节频率、分声部试听并保存调音参数。测试页复用游戏音效，使用相同的输出增益与峰值压缩；调音设置独立保存，不影响游戏存档。

执行 `node scripts/sound-test.mjs` 可单独生成 `dist/sound-test.html`，也可随完整构建生成，支持直接打开离线试听。

## 目录

| 路径 | 内容 |
| --- | --- |
| `src/` | 游戏规则、界面、存档、音效与音效测试页源码 |
| `public/` | 图标、应用清单和 Service Worker |
| `android/` | Android WebView 容器与原生接口 |
| `harmony/` | 鸿蒙 ArkTS / ArkWeb 工程与内置网页资源 |
| `scripts/` | 开发服务器、构建、资源同步和源码打包脚本 |
| `tests/` | Node.js 自动化测试 |
| `docs/` | 安装、构建、分发和验证说明 |
| `index.html` / `sound-test.html` | 游戏与音效测试页入口模板 |

`dist/` 存放网页构建结果，`artifacts/` 存放安装包及源码归档，`.tools/` 存放本机工具与签名材料；这些目录不纳入版本管理。

## 文档

- [Android 构建与安装](docs/android.md)
- [鸿蒙构建与安装](docs/harmony.md)
- [鸿蒙测试分发](docs/distribution.md)
- [测试与验证](docs/qa.md)

需要分享源码时，在项目根目录运行 `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/package-source.ps1`。归档输出到 `artifacts/`，包含文档与音效测试页，并移除鸿蒙个人签名配置。

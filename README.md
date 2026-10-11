# 核芯 CORE 2048

支持 HarmonyOS NEXT / 鸿蒙 5、6 和 Android 的 2048 小游戏工程。浅灰与炭黑面板、信号黄、模块编号、切角和细线网格，参考《明日方舟：终末地》的工业科幻视觉语言，界面与图标为原创实现。

Android 可分享安装包：`artifacts/apk/core2048-1.0.0.apk`。保留音效、原生震动、动画与本机存档，Android 8.0+，不绑定设备。安装及重新构建说明见 [ANDROID.md](ANDROID.md)。鸿蒙 NEXT 无法直接安装 APK，继续使用原鸿蒙包。

## 已实现

- 手机棋盘滑动和方向键 / WASD，标准 4 × 4 规则；合成页固定在一屏内，手势拖出棋盘不会滚动页面。
- 游玩界面仅显示 2048、分数、最高分、棋盘和重新开始；64 起从黄色经过橙色逐级加深至红色。
- 平滑位移、合并弹跳、粒子、128 及以上核心的冲击反馈、连续合并提示。
- Web Audio 实时合成碰撞音效：低频冲击、高频瞬态与随数字升高的音高，无需外部音频。
- 鸿蒙 `SensorServiceKit.vibrator` 原生触感桥接，轻触 10ms / 合并 22ms / 高能 42ms。
- 声音、音量、震动、动效设置；尊重系统减少动态效果偏好。
- 重新开始确认、2048 达成后继续、失败提示。
- 本机自动存档、历史最高分、最高数字、累计合并、最长连击、里程碑；兼容旧存档，忽略旧撤销记录。
- 鸿蒙 Preferences 原生存档与网页存储备份；后台暂停计时、输入和音频，返回前台后可继续操作。
- 游戏 JavaScript 与 CSS 内联到本地 HTML；鸿蒙包离线运行，不请求网络权限。

## 电脑 / 手机浏览器预览

需要 Node.js 20 或更高版本，不需要安装第三方依赖：

```powershell
npm run dev
```

电脑打开 http://127.0.0.1:2048 。同一局域网内的手机可访问 `http://电脑局域网IP:2048`；HTTP 局域网预览无法保证浏览器震动、离线缓存或添加主屏幕能力。

音效测试页：打开 `http://127.0.0.1:2048/sound-test.html`，查看 5 种音效的实际触发条件、逐个或依次试听，并调整合并数字、连击和试听音量。频率设置支持全部音效的滑块／Hz 输入、自动试听、原声对比、浏览器保存／恢复和参数复制。合并音支持碰撞组／音调组对比、5 个声部独奏、自选声部组合及时间安排查看。页面复用 `src/feedback.js`，不修改游戏存档与设置。执行 `node scripts/sound-test.mjs` 可单独生成 `dist/sound-test.html`，双击即可离线试听；完整构建也会生成此页面。

```powershell
npm test
npm run build
npm run preview
```

构建生成 `dist/index.html`，并同步到 `harmony/entry/src/main/resources/rawfile/`。`dist` 也包含图标、manifest 和 Service Worker；生产浏览器部署到 HTTPS 后可离线缓存。`dev` 模式不注册 Service Worker。

## 鸿蒙安装版

工程目录是 `harmony/`，采用 Stage 模型、ArkTS `UIAbility` + ArkWeb 本地资源 + 原生震动接口。API 12 / HarmonyOS 5.0.0 为最低目标。开发环境可根据已安装 SDK 调整 `harmony/build-profile.json5` 的目标 SDK；兼容 SDK 保持 5.0.0(12)。

真机自动签名和安装步骤见 `INSTALL.md`。

邀请朋友安装的测试分发流程见 `INTERNAL_TEST.md`。`npm run harmony:release` 使用独立 release 产品生成 Release APP/HAP，输出到 `artifacts/release/`。当前工作工程已完成注册应用的发布签名，`harmony-release-signed.app` 已通过本地签名验证，可用于上传测试分发；平台合法性检测和测试版本发布尚待完成。公开源码包移除个人签名配置，重建时需配置自己的签名。

1. 安装 DevEco Studio 和对应的 HarmonyOS SDK（不是 Android Studio）。
2. 在根目录执行 `npm run build`；本次交付已经包含同步好的游戏资源。
3. 使用 DevEco Studio 打开 `harmony/`，等待 OHPM / Hvigor 同步。
4. 在 `File > Project Structure > Signing Configs` 配置自动签名，登录自己的华为开发者账号并连接测试手机或选择模拟器。
5. 使用 IDE 的 Run 在设备上验证；使用 `Build > Build Hap(s)` 生成 HAP。签名配置应指向你的证书、Profile 和设备，工程没有附带个人证书。
6. 构建输出在 `harmony/entry/build/` 下，实际路径以所用 DevEco/Hvigor 版本为准。

也可使用完整的官方 Windows Command Line Tools 包构建。解压目录应包含 `bin`、`ohpm`、`hvigor` 和带 `default` 子目录的 `sdk`：

```powershell
$env:CORE_HARMONY_TOOLS = 'D:\command-line-tools'
npm run harmony:build
```

构建脚本使用工具包中的 Node，配置本次进程的 SDK 路径，构建离线页面，再执行 OHPM 和 Hvigor；生成的 HAP 会复制到 `artifacts/hap/`。可通过 `-SdkRoot` 指定单独的 SDK 目录。无 SDK 的精简工具包不能编译本工程。

已配置 `ohos.permission.VIBRATE`。本次使用官方 Windows Command Line Tools 26.0.0.851、HarmonyOS SDK 26.0.0.105 成功编译、签名并生成 `artifacts/hap/entry-default-signed.hap`。包内兼容和目标 API 均为 12。2026-10-10 已安装、启动到 Mate 60 Pro（鸿蒙 6.1），用户试玩后确认效果可以并接受交付。当前签名是该设备的调试签名；给其他手机安装或正式发布时，应重新配置对应签名。

后续回归检查可参考 `INSTALL.md` 的真机验收列表。详细验证范围见 `QA.md`。

## 代码

- `src/engine.js`：不依赖 UI 的游戏规则。
- `src/main.js`：状态、生命周期、输入、弹窗与动效。
- `src/storage.js`：存档校验、原生存储与网页备份。
- `src/feedback.js`：电子音效与原生 / 浏览器触感。
- `src/style.css`：响应式界面与减少动效。
- `scripts/build.mjs`：零第三方依赖的单文件资源构建。
- `harmony/entry/src/main/ets/pages/Index.ets`：鸿蒙本地页面、返回键和限定震动 / 存档桥接。
- `scripts/qa-server.mjs`：独立端口的胜利、死局和生命周期测试场景，使用模拟原生接口。
- `scripts/package-source.ps1`：打包源码，排除 SDK、构建缓存和签名证书，并在归档内移除个人签名配置，保留当前工作工程的配置。

验证：14 项测试，包括 1,000 个随机棋盘 × 4 个方向的规则校验、离线构建可执行性和存档后端故障恢复。浏览器验证结果见 `QA.md`。

接口参考：[鸿蒙网页加载](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/web-page-loading)、[OpenHarmony ArkWeb 桥接说明](https://github.com/openharmony/docs/blob/master/en/application-dev/faqs/faqs-arkui-web.md)、[官方震动接口](https://github.com/openharmony/docs/blob/master/en/application-dev/reference/apis-sensor-service-kit/js-apis-vibrator.md)。

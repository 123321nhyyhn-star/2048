# 验证记录

验证日期：2026-10-09 至 2026-10-10。

## 已通过

- `npm test`：14 项测试全部通过；包含 1,000 个随机棋盘的四方向规则校验、单文件构建脚本的可执行性、存档校验、双存储后端写入和单后端失效恢复。
- `npm run build`：成功生成单文件离线资源，并同步到鸿蒙 rawfile 目录。
- 浏览器实测：连续方向键移动、合并加分、连击显示、真实拖动滑动手势。
- 撤销：算力从 4 恢复到 0，棋盘恢复上一有效步，历史峰值保留。
- 新运行：显示确认弹窗，确认后只留下两枚初始核心，分数和步数归零。
- 设置：音效和动效开关响应，刷新后设置保留。
- 存档：刷新前后棋盘数字一致，本局算力和运行时间恢复。
- 运行记录和指南：手机底部导航正常打开 / 关闭，对应内容正常显示。
- 390 × 844 手机、320 × 700 小屏、768 × 1024 平板：未发生横向溢出。
- 手机首屏：棋盘和撤销 / 重开按钮可见。
- 试玩后浏览器控制台没有 error 或 warn。
- 隔离测试端口 2050：两枚 1024 合并得到 2048，胜利提示显示算力 2,048；关闭提示后可继续移动。
- 隔离死局场景：最后一步填满无相邻相同数字的棋盘，出现失败提示；撤销恢复到上一棋盘和第 000 步。
- 模拟 `core:pause`：计时保持 00:00、方向输入不改变第 000 步；模拟 `core:resume` 后合并加 4 分，步数恢复更新。
- 页面重新打开后模拟原生存档恢复相同棋盘、算力 4、第 001 步，撤销仍可用；撤销后算力 0、第 000 步。
- 模拟 `core:back` 能关闭设置弹窗。模拟接口验证网页与桥接协议，无法证明真实手机系统事件或震动马达正常。

手机截图：`artifacts/mobile-preview.jpg`。截图中的数字和分数来自真实试玩。

## 鸿蒙真机与交付

官方 Windows Command Line Tools 26.0.0.851 / HarmonyOS SDK 26.0.0.105 已完成资源编译、ArkTS 编译、HAP 打包与 PackingCheck，Hvigor 报告 BUILD SUCCESSFUL；产物为 `artifacts/hap/entry-default-unsigned.hap`。包内 `ets/modules.abc`、原生资源和离线 HTML 均存在，兼容与目标 API 为 12。

2026-10-10：手机 USB 调试已连通，HDC 能读取 Mate 60 Pro 的鸿蒙 6.1 系统信息，设备 API 为 24。已通过华为账号自动生成签名材料，并给 default 产品配置 `signingConfig: "default"`。重新构建的 SignHap 和 assembleHap 均通过，生成 `artifacts/hap/entry-default-signed.hap`；HDC 安装返回 `install bundle successfully`，启动 EntryAbility 返回 `start ability successfully`。

设备签名、安装与启动命令已验证。用户在真机试玩后回复“效果可以，无需检查”，接受本版效果并结束进一步检查。此反馈作为整体试玩验收；系统返回、后台恢复、进程重启存档和各档震动未逐项记录真机测试结果。

2026-10-10：为朋友测试分发增加独立 release 产品和 `npm run harmony:release`。官方工具成功执行项目级 assembleApp，42 项任务全部执行，生成 `artifacts/release/harmony-release-unsigned.app`。APP 内包含 entry-default.hap、pack.info 和 pac.json；HAP 内 `module.json` 标记 debug=false，包名 com.corelab.core2048、版本 1.0.0，ArkTS 字节码和离线游戏资源均存在。发布签名尚未配置，测试版本尚未上传、分发或生成邀请链接。原手机调试签名保留。

随后完成发布签名配置，发布证书与已有 CSR 的公钥一致、证书在有效期内；Profile 签名通过验证，绑定证书、注册 APP ID 及包名均匹配，type=release、app-distribution-type=app_gallery。修正用户新增图片的非法资源名并保留为 app_icon_custom.png 后，SignHap、SignApp、assembleApp 构建成功。可上传产物为 `artifacts/release/harmony-release-signed.app`（99,400 字节）。官方 hap-sign-tool 的 verify-app 对完整 APP 和独立发布 HAP 均返回 success；发布 HAP 的代码签名和权限签名也通过校验。包内 debug=false、版本 1.0.0 和离线资源均已验证。

验证边界：APP 容器内的 entry-default.hap 没有独立的 HAP Signing Block，初次对这个内嵌包单独调用 verify-app 报 signature not found；完整 APP 容器签名验证通过，独立 entry-default-signed.hap 的签名也验证通过。未修改官方 assembleApp 的打包结构。此前用户上传未签名 APP 的平台检测结果为“不通过(991)”，签名版尚待用户上传和平台检测；具体 991 原因未展开。

可运行 `npm run qa` 重现隔离场景：`http://127.0.0.1:2050/win?reset=1`、`/lose?reset=1`、`/lifecycle?reset=1`。测试截图保存在 `artifacts/qa/`。这些场景使用独立来源和模拟接口，不会覆盖端口 2048 的试玩存档；测试页不打入正式应用。

## Android 安装包

2026-10-10：用户确认鸿蒙签名版软件包上传后合法性检测“通过”，随后选择先生成可分享 APK；鸿蒙测试群组、测试版本和邀请分发尚未完成。

Android 容器使用系统 WebView，在受限 HTTPS 本地来源加载内置页面；仅允许 index.html 和 icon.svg 两个资源，禁止文件访问、内容 URI 与外部导航，不申请 INTERNET 权限。SharedPreferences 负责原生存档，震动桥接限定 10/22/42ms；生命周期桥接沿用已有游戏协议。系统栏及刘海通过 WindowInsets 避让，Android 13+ 注册系统返回回调，较早版本使用 Activity 返回接口。

使用现有 Android SDK platform 36、build-tools 35.0.0 和 Java 17 完成资源、Java、DEX 编译。产物 `artifacts/apk/core2048-1.0.0.apk`：包名 com.corelab.core2048、版本 1.0.0 / 1000000、最低 API 26、目标 API 35；aapt 确认桌面启动入口为 MainActivity，唯一权限为 VIBRATE。官方 apksigner 验证通过，APK v2/v3 签名有效，zipalign 校验通过。14 项现有游戏回归测试全部通过，包括构建可执行性、随机棋盘规则、存档恢复及后端故障。

本机 adb devices 未发现 Android 设备；以上为编译、签名、包结构与共享游戏回归验证，未宣称完成 Android 真机安装、马达、后台或系统返回测试。APK 的 SHA-256 位于 `artifacts/apk/SHA256SUMS.txt`。Android 发布密钥仅保留在本地 `.tools/android-signing/`，不随 APK 或源码归档分发。

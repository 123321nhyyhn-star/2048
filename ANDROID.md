# Android 安装包

可分享安装包：`artifacts/apk/core2048-1.0.0.apk`。

- 名称：核芯2048；包名：`com.corelab.core2048`；版本：1.0.0。
- 最低系统：Android 8.0（API 26）。需要较新的 Android System WebView / Chrome 组件，建议保持更新。
- APK 也可供兼容安卓应用的旧版鸿蒙使用；HarmonyOS NEXT / 鸿蒙 5、6 无法直接安装 APK，仍使用原鸿蒙包。
- 完整游戏已内置：无需联网或开发服务器，保留数字碰撞音效、合并动画、原生震动、本机存档和撤销。
- 仅申请 `android.permission.VIBRATE`，没有网络权限、账号、广告或分析服务。

## 分享安装

将 APK 通过文件传输发给对方，在 Android 手机上打开；按系统提示允许该文件管理器或浏览器安装来自此来源的应用，再确认安装。无需获取设备 UDID、华为开发者账号或启用 USB 调试。

音效会在首次触摸后启用。原生震动取决于设备马达及系统设置。返回键先关闭游戏弹窗，在主界面返回则退出；切到后台会暂停计时与音频。存档留在本机，卸载应用或清除应用数据会删除存档。

## 重新构建与更新

需要 Node.js 20+、JDK 17+、Android SDK platform 35+、build-tools 35+：

```powershell
npm run android:build
```

也可以显式指定工具位置：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build-apk.ps1 -SdkRoot 'D:\Android\Sdk' -JavaRoot 'D:\Java\jdk-17' -NodePath 'D:\nodejs\node.exe'
```

脚本直接调用官方 AAPT2、javac、D8、zipalign 和 apksigner，无需 Gradle 或 Android Studio。构建目录为 `android/build/`；校验通过后输出到 `artifacts/apk/`，同时写入 SHA-256 校验文件。

首次构建生成独立的 Android 发布密钥，保存在 `.tools/android-signing/`，后续构建复用它。请私下备份该目录，切勿把它发给测试用户或放入公开源码。升级时还需提高 `android/AndroidManifest.xml` 的 versionCode；保持包名和签名不变才能覆盖更新。此密钥与鸿蒙签名独立。

## 验证范围

2026-10-10 已完成官方工具编译、APK v2/v3 签名校验、zipalign 校验和 14 项游戏回归测试。APK 内含入口 Activity、classes.dex、自适应图标和离线 HTML；清单声明 debug=false，仅震动权限。当前没有连接 Android 测试设备，尚未记录 Android 真机安装、系统返回、后台恢复或震动实测。

官方参考：[加载本地 WebView 内容](https://developer.android.com/develop/ui/views/layout/webapps/load-local-content)、[Android 15 系统栏适配](https://developer.android.com/develop/ui/views/layout/edge-to-edge)、[APK 签名与验证](https://developer.android.com/tools/apksigner)。

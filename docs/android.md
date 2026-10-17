# Android 构建与安装

Android 版使用系统 WebView 加载内置游戏，支持 Android 8.0（API 26）及以上版本。包名为 `com.corelab.core2048`，版本为 `1.0.0`。游戏、音效、动画、原生震动与存档均在本机运行，仅申请震动权限。

以下命令与路径均相对项目根目录。

## 构建

需要 Node.js 20+、JDK 17+、Android SDK platform 35+ 和 build-tools 35+：

```powershell
npm run android:build
```

也可以显式指定工具位置：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build-apk.ps1 -SdkRoot 'D:\Android\Sdk' -JavaRoot 'D:\Java\jdk-17' -NodePath 'D:\nodejs\node.exe'
```

脚本同步当前游戏资源，调用 AAPT2、javac、D8、zipalign 和 apksigner，无需 Gradle。构建中间文件位于 `android/build/`，校验后的安装包和 SHA-256 文件输出到 `artifacts/apk/`。

## 安装与更新

将构建生成的 `artifacts/apk/core2048-1.0.0.apk` 传到手机，按系统提示允许安装。HarmonyOS NEXT 不支持 APK，请使用[鸿蒙安装流程](harmony.md)。

首次构建在 `.tools/android-signing/` 生成发布密钥，后续构建复用该密钥。请单独备份，勿提交到仓库。覆盖更新需保持包名和签名一致，并提高 `android/AndroidManifest.xml` 的 `versionCode`。

## 使用说明

- 首次触摸后启用音效；震动效果取决于设备与系统设置。
- 返回键先关闭弹窗，在主界面返回则退出；切入后台暂停计时与音频。
- 存档保存在本机，卸载或清除应用数据会删除存档。

自动化检查与真机验收项目见[测试与验证](qa.md)。

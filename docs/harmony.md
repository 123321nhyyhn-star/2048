# 鸿蒙构建与安装

工程位于 `harmony/`，采用 ArkTS UIAbility、ArkWeb 本地页面、原生震动与 Preferences 存档。最低兼容目标为 HarmonyOS 5.0.0（API 12）。以下命令与路径均相对项目根目录。

## DevEco Studio

1. 安装 DevEco Studio 及对应 HarmonyOS SDK。
2. 在项目根目录运行 `npm run build`，更新内置游戏资源。
3. 使用 IDE 打开项目的 `harmony/` 目录，等待 OHPM / Hvigor 同步完成。
4. USB 连接测试手机，开启调试并允许电脑连接。
5. 在 **File > Project Structure > Signing Configs** 配置自己的自动签名，并将 `default` 产品关联到该签名。
6. 选择设备，点击 **Run** 构建、安装并启动应用。

调试 Profile 绑定设备，更换手机需重新配置签名。源码不包含个人签名材料。

## 命令行构建

使用包含 `bin`、`ohpm`、`hvigor` 和 `sdk/default` 的完整鸿蒙工具包：

```powershell
$env:CORE_HARMONY_TOOLS = 'D:\command-line-tools'
npm run harmony:build
```

脚本会构建网页、同步内置资源、安装 OHPM 依赖并调用 Hvigor，HAP 输出到 `artifacts/hap/`。签名配置有效时会生成签名包；未签名包需完成签名后才能安装。

独立 SDK 路径可通过参数指定：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build-hap.ps1 -ToolsRoot 'D:\command-line-tools' -SdkRoot 'D:\HarmonyOS\sdk'
```

发布包构建与测试分发见[鸿蒙测试分发](distribution.md)，真机验收见[测试与验证](qa.md)。

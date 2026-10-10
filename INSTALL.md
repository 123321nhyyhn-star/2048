# 鸿蒙手机安装

游戏已通过鸿蒙原生编译与签名，并安装、启动到当前连接的 Mate 60 Pro。可安装产物为 `artifacts/hap/entry-default-signed.hap`，当前调试签名绑定已配置的手机。`entry-default-unsigned.hap` 是编译中间产物。

## DevEco Studio 自动签名

1. 安装华为官方 Windows 版 DevEco Studio。使用 IDE 的 Open 打开 `Y:\codex\2048\harmony`，等待工程同步完成。
2. 用 USB 连接手机，开启 USB 调试，在手机上允许本电脑调试。确认 IDE 的设备列表出现手机。
3. 进入 **File > Project Structure > Project > Signing Configs**。本地调试选择未关联注册应用的自动签名；勾选 **Automatically generate signature**，通过 **Sign In** 登录自己的华为账号，然后保存。版本不同菜单层级可能略有差异。无需把密码或签名证书发到聊天中。
4. 确认 `harmony/build-profile.json5` 的 `signingConfigs` 已生成配置，`products` 的 `default` 已关联该签名。保持应用包名 `com.corelab.core2048`。
5. 在 IDE 中选择手机并点击 **Run**，完成构建、安装和启动。之后在根目录执行 `npm run harmony:build`，可把生成的签名 HAP 收集到 `artifacts/hap/`。

官方说明：[自动签名](https://developer.huawei.com/consumer/cn/doc/HarmonyOS-Guides/ide-signing-auto)。调试 Profile 会绑定设备，更换手机时需要重新签名。

## 真机验收

- 滑动合并后声音正常；音量滑块、音效开关正常。
- 轻触、普通合并、高数字合并的震动反馈正常，关闭触感后停止震动。
- 手机首屏棋盘和操作按钮无遮挡，底部导航可正常点击。
- 合并一步后进入后台，返回时棋盘与分数保持、后台时间不累计。
- 关闭再打开应用，棋盘、分数、设置恢复，撤销记录仍有效。
- 系统返回手势先关闭当前弹窗；游戏主界面返回可退出。

如果手机提示签名或设备不匹配，回到自动签名界面重新生成 Profile，再构建安装。源码打包脚本在归档内移除个人签名配置，并排除签名证书；当前工作工程的签名配置会保留。

# 核芯2048：朋友测试分发

目标：让受邀朋友从华为提供的测试入口安装游戏。发布签名版本已在本机完成，尚未上传或分发；此前未签名预备包上传后的合法性检测未通过。当前手机上的调试包继续可用。

2026-10-10 用户提供的控制台截图已显示注册条目：应用名称 `2048`，APP ID `6917618668125106715`，包名 `com.corelab.core2048`。包名与工程一致。截图仅包含应用列表，尚未确认当前具体测试入口或发布签名配置。

后续完整截图已确认进入“分发 > 应用上架 > 软件包管理”，左侧有“应用测试 > 测试版本列表 / 测试用户”。用户已上传 Release 预备包，合法性检测显示“不通过(991)”，未展开错误详情，不能将错误码直接解释为某一个原因。本地 release 产品尚无签名配置，上传包未签名这一缺项已确认。

随后用户提供发布证书和 Profile。本机已验证证书有效、公钥匹配现有 CSR、Profile 签名有效，Profile 绑定的证书、包名与 APP ID 均匹配，类型为 release、分发类型为 app_gallery。已保存独立 release 签名并成功构建 `artifacts/release/harmony-release-signed.app`；APP 和独立发布 HAP 均通过官方签名工具 verify-app，HAP 的代码签名和权限签名校验通过。版本 1.0.0，debug=false。下一步在软件包管理重新上传此 signed APP，用途选“仅测试”，等待平台合法性检测结果。

## 注册应用

打开 [AppGallery Connect](https://developer.huawei.com/consumer/cn/service/josp/agc/index.html)，使用自己的华为开发者账号登录。按照账号页面要求完成身份验证，然后在“APP与元服务”创建 HarmonyOS 应用。

可直接填写的内容：

| 字段 | 内容 |
| --- | --- |
| 名称 | 核芯2048 |
| 平台 / 软件包类型 | HarmonyOS / APP，以当前创建界面为准 |
| 包名 | com.corelab.core2048 |
| 分类 | 游戏，选择益智类相关分类 |
| 是否元服务 | 否 |
| 默认语言 | 简体中文 |
| 版本名称 / 版本号 | 1.0.0 / 1000000 |
| 首批测试设备 | 手机；工程也声明支持平板 |

如果平台提示包名不可用，请先记录提示，再同步修改工程和签名，避免注册与软件包的包名不一致。开发者名称、联系方式和资质由账号持有人填写真实信息。

## Release 构建与签名

工程已经添加独立 `release` 产品；`default` 保留原手机调试签名。执行：

```powershell
npm run harmony:release
```

产物收集到 `artifacts/release/`。当前工作工程已经配置发布签名，可上传的包是 `harmony-release-signed.app`。源码归档会移除个人签名配置；在另一台电脑重建时，需重新配置匹配的密钥库、证书与 Profile。

2026-10-10 已从现有签名材料导出 `artifacts/signing/core2048-release.csr`，CSR 签名校验通过，公钥与当前签名证书链中的终端证书匹配。它可用于申请发布证书，需搭配原有密钥库使用；未导出密钥库或密码。

在 AGC 顶部“证书、APP ID和Profile > 证书”新增发布证书，上传上述 CSR，并下载 `.cer`。然后为应用 `2048` / 包名 `com.corelab.core2048` 申请对应发布 Profile `.p7b`。如果改用新的密钥库，需要在 DevEco Studio **Build > Generate Key and CSR** 生成该密钥对应的 CSR，并重新申请匹配证书。

在 **File > Project Structure > Project > Signing Configs** 添加名为 `release` 的手动签名配置，填写匹配的 `.p12`、密钥别名、密码、`.cer` 和 `.p7b`；然后在 Products 中把 `release` 产品的 Signing config 设置为 `release` 并保存。不要把密码或密钥文件发到聊天里。重新构建后检查 SignHap / assembleApp 成功，再使用 APP 包上传。

## 测试分发

当前华为入口区分“指定设备发布（原内部测试）”和“邀请测试”。朋友通过邀请下载安装采用邀请测试流程；若账号已提供内部测试群组，可以选择对应群组。实际可用入口、资格与审核要求以账号控制台为准，不预先承诺免审核或生效时间。

在应用的“分发 > 应用测试 > 测试用户”创建群组。可手动添加朋友的华为账号邮箱；若页面支持邀请码，则可使用分享链接和邀请码，减少收集账号的操作。新建测试版本，选择测试类型与群组，上传签名 APP，填写测试时间和应用信息，按平台提示提交。版本生效后才能取得可安装的邀请入口。

尚未收集测试用户名单、生成邀请码、上传版本或发送邀请。

## 可粘贴的介绍

核芯2048是一款离线益智小游戏。滑动数字核心，相同数字碰撞合并，挑战2048与更高数字。工业科幻风格界面配合电子碰撞音效、合并动效和触感反馈，让每一步操作清晰有力。支持单步撤销、自动存档、历史最高分与自定义声音和动效设置。

## 1.0.0 测试说明

- 首个测试版本，包含完整2048玩法、撤销与自动存档。
- 支持碰撞音效、合并动效、原生触感及相关设置。
- 建议体验滑动响应、合并反馈、后台恢复和重新打开后的存档。

## 隐私声明所需的事实

当前游戏不要求注册或登录，不请求网络权限，未接入广告、统计、支付或云存档 SDK。棋盘、分数、历史记录与偏好保存在本机 Preferences 和网页本地存储中；触感功能使用 `ohos.permission.VIBRATE`。这份事实说明供平台隐私表单填写参考，正式声明还需要账号持有人真实的主体和联系方式。

## 官方资料

- [创建与分发应用](https://developer.huawei.com/consumer/cn/appgallery/devstart/)
- [测试入口与流程](https://developer.huawei.com/consumer/cn/appgallery/)
- [创建测试群组](https://developer.huawei.com/consumer/cn/doc/doccenter-submission/agc-help-appgallery-create-testgroup-0000002258071216)
- [工程签名与产品配置](https://developer.huawei.com/consumer/cn/doc/doccenter-deveco-studio/ide-hmos-hvigor-build-profile-app)

# 行程核验：合并与维护说明

2026-08-31 22:51（北京时间）：核验模块已发布到正式阿里云入口 https://139.196.97.236/meeting/#verification，版本 `travel-20260831-761cc510ee01`。今后的前端、比对规则、数据源适配和测试统一在行程管理工具中维护。独立的「航班&高铁查询」目录仅保留旧版本及本地账户配置备份，不再作为生产入口。

## 功能与数据

侧栏「行程核验」直接读取当前会议可见的有效参会名单。没有第二套参会数据库，也无需再次上传 Excel。重复的去程／返程表头按已有字段 ID 区分：

| 含义 | 去程 | 返程 |
|---|---|---|
| 日期 | out_date | return_date |
| 出发场站 | out_from | return_from |
| 到达场站 | out_to | return_to |
| 航班／车次号 | out_no | return_no |
| 出发时间 | out_departure | return_departure |
| 到达时间 | out_arrival | return_arrival |

红色仅用于取得明确计划值后的字段差异；黄色用于缺失或格式问题；未查到、服务失败、未开放日期和航站楼缺失都不等于填写错误。空白去程或返程不补造。核验时刻采用公布计划时刻，不使用预计／实际起降时间。显示来源、查询时间、跨日到达天数。代码／名称可以用于识别机场，不能单凭机场或航空公司推断航站楼。

人工修改从同一名单保存，保留其他字段和扩展信息，记录修改前后值和操作者；数据库已有审计触发器继续记录真实登录身份。保存前读取最新名单，按 updated_at 条件更新；并发变化会拒绝覆盖。未修改方向的核验记录保留，修改方向作废。只有负责人或管理员可进入修改，仍遵守现有项目编辑权限及行列锁定。旧核验快照与当前行程不一致时，不再标记通过。保存不会调用收费接口。

## 代码归属

- app.js / index.html / 会议行程管理系统.html：主应用入口、名单接入、核验按钮和人工修改。
- travel-verification.js：字段核验、快照失效、状态规则。
- travel-verification-panel.js：去返程对照、搜索、状态筛选。
- travel-verification-storage.js：只更新核验元数据或人工修改的行程字段，带并发保护。
- modules/travel-verification/server/：飞常准、12306、去重缓存与额度控制。仅供 Node 后端使用，不发布到静态网站。
- scripts/package-travel-backend.mjs：打包核验服务模块。后续更新以此目录为唯一来源，服务器只接收生成包。

现有共用后端「礼来报价、PO&报价+确认单/server.js」已修改接入桥：读取 TRAVEL_VERIFICATION_MODULE，继续使用原有登录认证、数据库缓存和审计。核验前调用数据库 can_manage_project，并校验请求确实来自该项目的当前名单。需要将这个接入桥与模块一起发布；不再回落到旧航班供应商，以免误消费其他账号。

## 费用及查询范围

- 默认不发起航班收费查询。每次需勾选允许消耗账户额度，每次操作最多安排一个新的航班查询；未处理行程保持待核验。
- 相同行程去重，成功结果缓存15分钟，失败缓存5分钟。有效本地快照15分钟内重用，让下一次处理后续待查航班。
- 后端默认每日最多5次航班查询尝试，配置 VARIFLIGHT_DAILY_LIMIT 可调整。每日次数写入数据库，服务重启不会清零；异常也计一次，不自动重试或充值。
- 铁路使用12306公共查询，不需要新增商业 API 密钥。当前适配器仅接受中国日期今天至未来14天，不查询历史铁路；这不是无限远期时刻表服务，公共接口不可用时保持待核验。
- 飞常准适配器目前只在有明确中国大陆国内时区字段时接受计划数据；国际、港澳台、不同响应结构、缺失字段均需后续联调，不推断为核验成功。
- 日期、班次、机场／车站是外发查询参数；姓名、手机号、医院和证件号不会发送给数据供应商。

## 当前生产配置

后台运行 Node 24，既有数据库应有 travel_api_cache 表；新版模块首次加载仅新增独立的查询次数表，不更改参会名单结构。

```text
TRAVEL_VERIFICATION_MODULE=/部署路径/travel-verification/index.mjs
VARIFLIGHT_API_KEY=在服务器机密环境中配置，不放入源码或HTML
VARIFLIGHT_ENABLED=false
VARIFLIGHT_DAILY_LIMIT=5
RAIL_12306_ENABLED=true
```

账户激活、套餐权限、客户业务使用范围及一次真实计划查询联调完成后，再启用 VARIFLIGHT_ENABLED=true。旧独立工具里的本地密钥本次没有复制到仓库、发布包或服务器。前端检查 /travel/status 的 version=2，遇到旧接口就停止在线查询。

发布顺序：备份已有后台和数据库；部署模块及接入桥；确认 status 返回 version=2；发布静态前端；用正式授权账户检查权限与一条已知行程。服务器迁移仍由原迁移流程处理，核验发布已短暂重启 lilly-meetings 并切换前端版本；未重启数据库或改变迁移边界。回滚时前后端一起恢复，保留数据库和审计记录。

## 本地验证

```sh
node --test scripts/travel-verification-unit.mjs modules/travel-verification/tests/variflight.test.mjs
node scripts/build-site.mjs
node scripts/package-travel-backend.mjs
node scripts/preview-travel.mjs
```

预览地址 http://127.0.0.1:4340/#verification，仅加载示例名单，不连接正式名单。程序测试使用合成数据和内存数据库，不把测试数据混入正式记录。

已验证20项单元、协议与存储／额度集成检查；已通过应用内浏览器检查新导航、名单搜索、审核窗口，以及人工修改后同一名单更新。旧浏览器回归脚本 travel-verification-fields-smoke.mjs 已适配新的人工保存流程，本次未单独执行该 Playwright 脚本。已完成14项生产只读检查，包括现有管理员权限、匿名隔离、核验接口v2、输入拦截和原文件接口。未验证：真实飞常准收费响应、真实铁路成功匹配，以及其他会务账号逐一登录后的完整编辑流程。


## 本次上线记录

- 正式页面： https://139.196.97.236/meeting/#verification 。原账号登录后使用。
- 版本：`travel-20260831-761cc510ee01`；前端目录 `/var/www/lilly-platform/releases/travel-20260831-761cc510ee01`。
- 后端模块：`/opt/lilly-meetings/travel-releases/travel-20260831-761cc510ee01`。
- 接入桥已更新 `/opt/lilly-meetings/server.js`；生产配置 `/etc/systemd/system/lilly-meetings.service.d/30-travel-verification.conf`。
- 20项本地测试通过；14项生产检查全部通过；发布期间没有修改参会记录，也没有调用收费航班接口。铁路启用，飞常准收费开关关闭。
- 首次尝试因 systemd 已 active 而 Node 尚未开始监听，检查触发代码自动回滚。增加 HTTP 就绪检查后重发成功，没有恢复数据库或丢弃期间写入。
- 部署程序：`scripts/deploy-travel-release.mjs`，打包程序：`scripts/prepare-travel-release.mjs`。打包程序里的基线哈希适用于本次发布，后续版本必须重新核对生产基线，不能直接覆盖旧版本。
- 服务器部署记录 `/opt/lilly-verification/travel-20260831-761cc510ee01/validation.json`，最终 `ACTIVE` 标记存在；首次回滚标记保留作历史记录。
- 修改后安装器SHA256：`8b4b1d1657d559a3352e222a8a4c90c0f9688467eda858b5deafc5a1387d3b63`，服务器文件 `installers/travel-20260831-761cc510ee01-r2.mjs`。
- 发布前在线SQLite备份与上一版服务代码保存在版本记录目录，上一版前端 `/var/www/lilly-platform/releases/106ef37730ad6485` 保留。回滚仅恢复代码／配置，不回灌数据库。
- 发布后再次运行现有加密异地备份：`2026-08-31T14-51-16-503Z-KDZnVX`，状态 `encrypted-offsite-readback-verified`；备份服务 `Result=success`、`ExecMainStatus=0`。

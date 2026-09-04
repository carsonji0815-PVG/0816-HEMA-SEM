# 阿里云迁移记录

## 当前边界

2026-08-31 22:38（北京时间）：经用户确认可切换，正式前后端已切到原阿里云服务器。

- 正式入口：<https://139.196.97.236/meeting/>。
- 长期正式域名采用 `lilly-meeting.xiaohuatec.com`。现有 `meeting.xiaohuatec.com` 已承载其他系统，不得覆盖。DNS A 记录生效前继续使用 IP 入口；生效后运行 `ops/domain/activate-domain.sh`，IP 入口仅保留跳转。域名切换脚本会先验证 DNS 指向 `139.196.97.236`，验证失败不会修改生产配置。
- API：`https://139.196.97.236/supabase`；原文件服务仍在同一主机根路径。
- 原账号及密码不变，新域名需要重新登录。旧 Supabase 保留只读，不得解除写入冻结或直接切回。
- 原 `staging` 目录已成为生产环境，存在 `PRODUCTION_ACTIVE` 标记；禁止运行恢复演练、密钥重新生成或合成测试数据脚本。
- 本次上线使用原已发布版本 `7204907d83c1d549273c5a95fb95a4fe2fbe90c7`，只调整运行地址；本地另有未发布的行程核验功能改动，未混入此次部署。
- GitHub 旧入口兼容跳转提交：`81078fd`，保留查询参数及 hash；Actions `33403952700` 已成功。实际抓取根入口、index.html及中文入口，三处均验证跳转到阿里云并保留会议参数。

## 正式切换验证

- 22:32冻结源库16张 public 表的写入；触发器属于 `_lilly_migration_guard`，新库没有这些冻结触发器。
- 最终快照：`/opt/lilly-migration/backups/source-2026-08-31T14-33-06-710Z-cBuanC`。
- 45张表记录数及完整数据指纹全部一致，RLS基础隔离检查通过。参会记录24条包含历史/取消记录，不代表24位有效参会人员。
- 22:38正式只读探测22项通过：HTTPS页面/静态资源、Auth健康、管理员身份与名单访问、匿名名单隔离、公开项目列表、3个项目文件接口、系统服务状态、新库无源冻结。
- 报告：`/opt/lilly-migration/staging/production-validation.json`。
- 私有环境另完成报名模板前置校验、提交、本人编辑、跨填报人越权拦截、关闭报名后编辑、行列锁定、软取消、字段审计等13项检查；测试数据已清理，随后最终快照覆盖演练数据库。
- 未进行生产浏览器全流程/压力测试，也未在生产创建虚构报名。SMTP和Studio没有部署，不可宣称邮件邀请/密码找回或云端管理控制台已迁移。

## 迁移后功能发布补充

2026-08-31 22:51：在迁移完成后独立发布行程核验版本 `travel-20260831-761cc510ee01`。当前前端软链接已指向该新版本，原迁移发布目录保留。共用文件服务增加核验模块配置，其现有Auth地址不变；数据库未再次迁移。14项生产检查通过，并完成发布后加密异地备份 `2026-08-31T14-51-16-503Z-KDZnVX`。详见 `TRAVEL-VERIFICATION.md`。上文和下文的 `106ef37730ad6485` 为初次迁移的历史前端版本。

## 正式运维与备份

- 服务：`lilly-platform.service` 管理6个自托管容器，`lilly-meetings.service` 管理原文件服务，nginx提供HTTPS。
- 新网关仅监听 `127.0.0.1:18000`，数据库无公网端口。
- 前端：`/var/www/lilly-platform/current` → `releases/106ef37730ad6485`。
- 文件服务新增 `/etc/lilly-meetings/supabase.env` 和 systemd drop-in，连接本机Auth；不得打印环境文件。
- 每日03:45（上海时区，最多随机延迟3分钟）执行 `lilly-platform-backup.timer`，PostgreSQL、SQLite、附件、配置和前端一起加密备份至现有OSS。
- 每月第一个星期日05:30执行 `lilly-platform-restore-drill.timer`：使用最新OSS回读密文，在无网络、无公网端口的临时PostgreSQL容器中完整解密恢复，同时检查SQLite、附件和配置；演练不连接、不停止、不写入生产数据库。每日安全巡检要求最近35天内至少有一次成功报告。
- 备份目录 `/var/backups/lilly-platform`；每份 manifest 必须为 `encrypted-offsite-readback-verified` 才算异地回验成功。没有自动清理旧备份，应定期检查磁盘。
- 切换后已实际执行 systemd 备份服务，Result=success、ExecMainStatus=0；备份 `2026-08-31T14-39-35-383Z-ibh3YH`，加密包1,573,281字节，OSS下载、密文校验、解密校验均通过。
- AES-256-GCM 恢复密钥独立保存于服务器 `/opt/lilly-migration/backup-encryption.key`，以及用户本机 `/Users/carson/Documents/礼来平台恢复资料/139.196.97.236-backup-encryption.key`（0600）；密钥不进备份包、不进Git。
- 恢复文件格式：9字节 ASCII `LILLYBKP1` + 12字节IV + 16字节tag + ciphertext；AAD为 `lilly-platform-backup-v1`。恢复前验证密文及解密后的SHA256。
- 新库已经开放写入：回滚必须先暂停新写入并迁回增量，不能直接解冻旧库。旧建档数据、源快照和切换前配置均保留。

以下章节为准备和演练期间的历史记录；其中“尚未切换”仅代表该阶段状态，不覆盖上面的正式切换结论。

## 已核实的资源

- 阿里云上海轻量服务器：`139.196.97.236`，实例 `84650271fb8845f89c4671a6463510f9`。
- 生效配置：2 CPU / 4 GB / 50 GB ESSD。系统内存约 3499 MiB，根分区约 40 GB。
- 已安装 Docker 29.1.3、Compose 2.40.3；没有升级已有系统包，也未重启现有业务服务。
- 准备阶段 `nginx` 和 `lilly-meetings` 保持运行；切换时短暂停止文件服务取最终快照，切换后已恢复。现有业务服务仅监听本地 8787。
- HTTPS 证书到期：北京时间 2026-09-03 20:28:42；Certbot 自动续期计时器已启用，仍需监控后续成功续期。
- 2026-09-04 已使用最新OSS回读密文完成首次隔离恢复演练：PostgreSQL完整恢复、SQLite完整性、附件及配置检查均通过；此后由月度计时器持续执行，最近35天无成功报告会触发每日安全巡检失败。

## 源数据基线（迁移前复查，不是冻结快照）

源项目 `bupsipicxwyeuxunkvii`，Singapore，PostgreSQL 17.6.1.155。

| 内容 | 读取时数量 |
| --- | ---: |
| 会议项目 | 3 |
| 参会记录（包括历史/取消记录，不是有效参会人数） | 24 |
| Auth 用户 / profiles | 1 / 1 |
| change_logs | 497 |
| operation_audit_logs | 470 |
| Supabase Storage 对象 | 0 |

所有 public 业务表已启用 RLS。数据库约 14 MB；附件另在阿里云文件服务，不代表没有业务附件。

## 隔离演练环境

- 官方配置来源：Supabase `self-hosted/v0.8.0`，固定提交 `241bb11c0627f2981746d37033f57dbfa81d29b0`。
- 源配置目录：`/opt/lilly-migration/supabase-upstream`。
- 演练目录：`/opt/lilly-migration/staging`，root-only。
- `compose.db.json` 是仅数据库的演练配置，不是完整生产部署；数据库不发布公网端口，限制 1 CPU / 1024 MB，日志滚动限制 3 × 10 MB。
- `.env`、解析后的 Compose 配置含私密信息，禁止输出、上传到 GitHub 或混入静态站点。
- Docker Hub 连接超时。数据库及核心组件已通过官方 GHCR / ECR 镜像完成下载；Envoy 官方发布文件已分段下载并通过 SHA256 校验。下载成功不等于完成上线。

## 私有接口联调（2026-08-31 22:08 之后）

- DB、Auth、REST、Storage、Envoy、Edge Runtime 六个容器已启动。只有网关映射 `127.0.0.1:18000`，没有新增公网监听。
- Envoy v1.39.0 官方发布二进制 SHA256：`4409dadc87931d8f8676314cbd83071cb65125fb4feac3f6335800580dfa9218`。Docker Hub 无法连接，故暂用已校验的官方 Edge Runtime Debian 基础层封装网关；保留上游 Envoy 配置和入口，没有改写认证规则。
- Edge Runtime v1.74.0 摘要：`sha256:2781daf92394db91f7e94129cc3d04ec474ad16a8fe64b3fbeef6e7d557ab120`。
- 已从源 Supabase 下载线上 public-trip-query v13，与本地源码完全一致，SHA256：`5867092dfccb134b4b8fbddc28e8c3cbbed9be630852863187a77f2e265a318b`。自托管仅增加 `Deno.serve(handler.fetch)` 入口适配，业务处理器与认证包装器未修改。
- 已启用官方非对称签名和 publishable/secret API key 配置，保留原演练 JWT_SECRET、数据库密码和旧式签名兼容；未修改任何源平台密钥。
- 10项私有 API 检查通过：密钥缺失/错误被拒、匿名不可读名单、服务端可读24条恢复记录、Auth 健康/无效用户令牌拦截、公开函数读取项目与预检。
- 使用一个临时虚构账号完成密码登录、用户身份查询、未授权名单隔离验证；随后按精确ID+测试邮箱+测试标记删除该测试账号。原账号和密码未变。
- 报告：`staging/private-api-validation.json`、`staging/private-auth-validation.json`。仍为 `productionReady: false`。
- 测试请求会在演练库产生查询日志，因此不能再用初次恢复的全表计数判断它是否“未变化”；正式切换必须重新取最终快照。

## 已完成的恢复演练（2026-08-31 21:48 之后）

- 完整备份目录：`/opt/lilly-migration/backups/source-2026-08-31T13-24-09-944Z-KQPM1X`，权限仅限 root。
- 三个原始文件校验通过：roles.sql 370 B、schema.sql 93,258 B、data.sql 2,753,265 B。
- 新环境已完成事务恢复：45 张表的记录数全部匹配；随后对备份 COPY 数据与目标库输出作内容指纹比对，通过。空内部表核对为空，没有丢弃任何非空数据。
- `rehearsal-validation.json` 和 `rehearsal-content-and-rls.json` 保存结果，`productionReady` 仍为 **false**。
- 基础 RLS 检查通过：匿名用户不可读名单、未授权认证身份不可读名单、原管理员可读全部24条记录；全部 public 业务表均开启 RLS。
- 尚未完成其他角色的跨项目隔离、报名修改/取消、文件权限、公开接口与浏览器联调，不能用基础 RLS 测试替代完整业务回归。
- 源库无调用 public 函数的自定义 Auth 触发器，此项已单独查询确认。

### 演练中的版本兼容处理

- 官方整套配置固定到 v0.8.0；为匹配源库已有内部字段，Auth 更新到官方稳定版 **v2.196.0**，Storage 更新到 **v1.72.2**，镜像均固定到校验摘要。最终生产仍须做完整回归。
- Auth 摘要：`sha256:c0c25187a6b835e65a6f6e6c6b39d090e832d40e6de5186f2c038e0411944232`。
- Storage 摘要：`sha256:2258f9fb4d3dc0b1c6aaedd0d6e1da2af6c6591b592cd0c9099f3e90fd3fc569`。
- 从源库核实并补齐 `supabase_realtime_admin`：LOGIN、SUPERUSER、INHERIT、CREATEDB、CREATEROLE、REPLICATION、BYPASSRLS 均为 false。没有赋予它额外权限。
- 保留原始备份，仅在演练输入中省略零记录 Auth/Storage 表的空 COPY；这些表仍核对目标数量为零。非空表缺失或恢复出错会停止并回滚。
- 之前失败尝试及私有错误日志均保留。不得因为看到失败目录而误以为最新完整备份失败，也不得将失败目录用于切换。

## 备份脚本

- `scripts/migration-backup.mjs`：本机 PostgreSQL 17 客户端配合 Supabase CLI 的过滤导出脚本，保存到 gitignored `.tmp/aliyun-migration/backups`，文件权限 0600。
- `scripts/aliyun-backup-sealed.mjs`：用服务器公钥封装 AES-GCM 加密的临时导出凭据，通过云助手提交密文；在原服务器容器内读取源数据库，结果只写到 `/opt/lilly-migration/backups`。
- `scripts/aliyun-prepare-staging.mjs`：一次性准备数据库演练配置，目录已存在则停止，禁止覆盖已有环境；不会自动启动或切换服务。
- `scripts/aliyun-stage-core.mjs`：生成隔离 Auth/REST/Storage 配置，无公网监听端口。
- `scripts/aliyun-restore-rehearsal.mjs`：仅允许向空的 `lilly-stage-db` 恢复，单事务、失败回滚，保留每次尝试日志。
- `scripts/aliyun-verify-rehearsal.mjs`：对比内容指纹并在回滚事务内验证基础 RLS，输出不包含个人数据。
- `scripts/aliyun-download-envoy.mjs`：获取固定官方版本，支持分段续传；完整 SHA256 校验通过前不安装、不执行二进制。
- `scripts/aliyun-stage-gateway.mjs`、`scripts/aliyun-stage-functions.mjs`：配置仅限本机访问的网关与报名函数。
- `scripts/aliyun-enable-api-keys.mjs`：运行官方密钥生成程序，验证输出后配置自托管认证；不会更改源数据库或正式入口。
- `scripts/aliyun-test-private-api.mjs`、`scripts/aliyun-test-private-auth.mjs`：接口与测试账号密码登录验证，不输出密钥或个人信息。
- `scripts/aliyun-test-private-registration.mjs`：仅在临时虚构会议中验证报名工作流，清理时按精确ID和测试标记保护原数据。
- 备份清单必须区分 `incomplete`、`exported-not-yet-restore-tested`；只能在恢复验证后认定可用于回滚。
- 密钥目录 `/opt/lilly-migration/transfer` 为 root-only；私钥不得进入云命令参数或代码仓库。

## 切换前必须完成

1. 确认 roles/schema/data 全部导出成功，校验文件哈希；在新数据库事务恢复，失败整批回滚。
2. 配齐 Auth、PostgREST、API gateway、Edge Function 等实际依赖；核对 Storage/Auth 版本差异，不能以删数据绕过恢复错误。
3. 对比所有业务表记录数/内容、函数、触发器、RLS、账号权限；验证超级管理员、项目授权、填报人隔离、锁定和审计。
4. 单独迁移 `public-trip-query`、函数配置和文件服务 Supabase 连接；验证登录、公开报名、本人查询、导入导出、审批、分房、附件。
5. 配置实际对外地址、CORS、密钥和邮件发送；管理员账号禁止公开注册。确认2核4GB承载能力；不自动购买升级。
6. 新前端只发布构建产物。旧 GitHub 二维码/链接需有明确兼容策略，不能直接废弃。
7. 选择短暂停写窗口重新导出最终快照，避免演练期间新增/修改的数据丢失；核对后统一切换前后端，禁止两个数据库同时接收写入。
8. 配置新数据库备份、异地保存、恢复演练、容量及证书监控；保留旧环境用于受控回滚。切换后若新库已产生写入，不能简单切回旧库丢弃新数据。

## 官方参考

- https://supabase.com/docs/guides/self-hosting/docker
- https://supabase.com/docs/guides/self-hosting/restore-from-platform

官方最低规格是2核4GB/40GB SSD，推荐4核8GB/80GB SSD。符合最低规格不代表已经通过本平台生产负载测试。

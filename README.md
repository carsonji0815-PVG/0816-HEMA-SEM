# 礼来会议管理平台

面向医疗会议的报名、异常行程审批、名单锁定和接送机查询工具。前端为纯 HTML/CSS/JavaScript，可部署到 GitHub Pages；正式数据、账号权限和审计记录使用 Supabase 托管服务，不需要自建或维护服务器。

## 已实现

- 按《报名表模版》31 列采集并导出 `.xlsx`
- 二维码/链接报名
- 管理端采用固定邮箱白名单：超级管理员始终拥有全部权限，会务负责人仅进入获授权项目
- 参会报名、已报名修改及本人信息查询使用独立参会端，不使用管理端邮箱登录
- 名单全局锁、按行锁、按字段组锁
- 行程城市不一致、非预设出发城市自动待审批
- 报名和行程变更记录、会务提醒
- 接机司机、车辆、集合点及送机安排
- 参会者输入手机号查询最小化的接送机信息，不使用短信验证码
- GitHub Actions 自动发布 GitHub Pages
- 多项目新建、复制与切换；各项目独立名单、角色、二维码、报名字段和接送规则
- 会务负责人可直接导入线下收到的 `.xlsx` / `.xls` / `.csv` 名单，导入前预览新增、更新和错误行
- 无绿色分类视觉：报名、名单、审批、接送、锁定和提醒采用独立识别色，每个项目自动分配图标与项目色
- 每个项目可上传独立 Excel / CSV 名单模板，公开报名页按模板字段动态生成，自定义列随名单保存和导出
- 同机场/高铁站、同工作人员或车辆的接送机可批量安排，并校验人数上限和已有批次冲突
- 名单显示隐私沟通函与出票进度；变更提醒明确记录参会者、字段及原值 → 新值
- 去程与返程独立审批；需要审批的行程只有通过后才能进入出票中、已出票或改签状态
- 高铁与航班计划时刻在线核验：相同日期、班次和路线自动去重查询，记录数据来源与核验时间，并正确标注跨日到达 `+1`
- 参会者详情和名单导出均包含去程/返程计划时刻核验；行程修改后仅使对应方向的旧核验失效，等待重新核验
- 统一项目入口：新建时选择内部/外部活动并填写会议编码或合同编号、负责人和活动日期；项目创建后才开放报名和行程管理
- 集成文件归档：同一项目内收集报价、会务确认单、PO 和供应商确认邮件，并显示最终材料完成状态
- 文件继续存储在阿里云服务器，使用 SQLite 索引、服务器磁盘和 OSS 异地备份；行程与项目权限继续由 Supabase 管理
- 项目级报名开放开关：导入报名模板后可绕过报价/确认单前置条件提前开放新增报名；关闭后仍保留已报名修改和参会信息查询
- 公开入口拆分为“我要报名 / 更改已报名 / 参会信息查询”，填报人以大区、姓名、员工编号建立项目内身份
- 新报名自动绑定原始填报人，支持管理员移交；取消报名采用软取消，开关、模板、报名、变更、取消和移交均保留审计记录
- 服务端使用短期随机会话和填报人归属校验拦截 URL/ID 越权；管理员默认只读，可由项目负责人单独开启编辑权限

## 本地预览

直接打开 `index.html`，或在项目目录运行：

```bash
python3 -m http.server 4173
```

访问 `http://localhost:4173`。默认 `config.js` 使用演示模式，数据只保存在当前浏览器。演示查询号码：`13800005201`。

## 正式上线

### 1. 建立 Supabase 项目

1. 在 Supabase 新建项目。
2. 新项目先在 SQL Editor 完整执行 `supabase/schema.sql`，再按文件名顺序执行 `supabase/migrations/` 内的升级脚本。已有项目执行尚未运行的升级脚本；本次管理端权限更新对应 `2026082903_system_staff_allowlist.sql`。
3. 在 Authentication 仅为下列管理邮箱创建密码账号。其他邮箱即使拥有 Auth 账号，也会被数据库和前端同时拒绝进入管理端：

   - `jll@grandchinamice.com`：季亮亮，超级管理员
   - `shenxy@grandchinamice.com`：沈祥雨，会务负责人
   - `chenyan@grandchinamice.com`：陈艳，会务负责人
   - `zhucy@grandchinamice.com`：朱宸玥，会务负责人
   - `zhuby@grandchinamice.com`：朱冰焰，会务负责人
   - `zhanh@grandchinamice.com`：占慧，会务负责人
   - `yml@grandchinamice.com`：易敏丽，会务负责人
4. 查询会议 ID：

```sql
select id from public.meetings where slug = 'hema-sem-2026';
```

5. 超级管理员登录后，在“项目设置 → 会务负责人账号”为当前项目分配或回收会务负责人权限。超级管理员不能被回收，且始终可查看和维护全部项目。每个参会二维码使用 `?event=项目编号#portal` 区分项目。

### 2. 部署公开查询函数

安装 Supabase CLI 并登录后执行：

```bash
supabase link --project-ref 你的项目编号
supabase secrets set QUERY_RATE_SALT=一段足够长的随机字符串
supabase functions deploy public-trip-query --no-verify-jwt
```

公开函数只向手机号查询返回脱敏的本人会务信息；报名维护使用短期随机会话，并在服务端校验项目、填报人和参会记录归属。它不会把 service role 密钥暴露给浏览器。

### 3. 填写前端配置

在 Supabase 的 Project Settings → API 中复制 Project URL 和 publishable/anon key，修改 `config.js`：

```js
window.APP_CONFIG = {
  mode: "production",
  supabaseUrl: "https://你的项目编号.supabase.co",
  supabaseAnonKey: "你的 publishable key",
  eventSlug: "hema-sem-2026",
};
```

`anon key` 可以放在浏览器前端，真正的数据权限由 `schema.sql` 中的 RLS 策略控制。绝对不要把 `service_role` key 写入本项目或 GitHub。

### 4. 发布 GitHub Pages

将项目推送到 GitHub 仓库的 `main` 分支，然后在仓库 Settings → Pages 中将 Source 设为 **GitHub Actions**。仓库中的 `.github/workflows/deploy-pages.yml` 会自动部署；以后每次推送 `main` 都会更新公网版本。

## 上线前检查

- 用超级管理员、已授权会务负责人、未授权邮箱分别验证全部权限、项目隔离和登录拦截。
- 将演示数据留在演示模式即可；生产模式只读取 Supabase 数据，不会上传本地演示名单。
- 用无痕窗口分别测试三个公开入口；关闭报名开关后，“我要报名”应禁用，而“更改已报名”和“参会信息查询”仍可使用。
- 用两个不同员工编号交叉测试，确认填报人无法读取、修改或取消对方绑定的参会人员。
- 若公开查询可能遭到批量撞库，建议在 Edge Function 前增加 Cloudflare Turnstile；这不需要短信验证码。
- 身份证/护照属于敏感个人信息，仅在确有业务依据时收集，设置最短保留期，并在会议结束后按组织要求删除。

## 文件说明

- `index.html`：应用全部页面
- `styles.css`：响应式视觉样式
- `app.js`：报名、审批、锁定、接送机、查询和导出逻辑
- `config.js`：演示/生产环境切换
- `supabase/schema.sql`：表结构、RLS、锁定校验与审计触发器
- `supabase/migrations/20260818_multi_project.sql`：多项目权限、配置和复制项目升级脚本
- `supabase/migrations/20260820_project_templates_transport_batches.sql`：项目报名模板、批量接送、名单进度与详细变更记录升级脚本
- `supabase/migrations/2026082004_integrated_project_documents.sql`：统一项目基础信息、项目创建门禁和文件归档关联字段
- `supabase/migrations/20260820_segment_approval_ticket_guard.sql`：去程/返程分段审批与出票前数据库强制校验
- `supabase/migrations/2026082901_registration_control_identity_permissions.sql`：报名开放控制、填报身份绑定、软取消、移交、审计和服务端权限升级脚本
- `supabase/migrations/2026082903_system_staff_allowlist.sql`：管理端固定邮箱白名单、超级管理员兜底权限与项目级会务负责人分配
- `supabase/functions/public-trip-query/index.ts`：报名身份会话、本人报名维护和无短信验证码的参会信息查询接口
- `.github/workflows/deploy-pages.yml`：GitHub Pages 自动发布

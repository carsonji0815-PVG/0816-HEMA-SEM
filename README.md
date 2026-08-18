# 行程台 Journey Desk

面向医疗会议的报名、异常行程审批、名单锁定和接送机查询工具。前端为纯 HTML/CSS/JavaScript，可部署到 GitHub Pages；正式数据、账号权限和审计记录使用 Supabase 托管服务，不需要自建或维护服务器。

## 已实现

- 按《报名表模版》31 列采集并导出 `.xlsx`
- 二维码/链接报名
- 会务负责人、会议负责人（客户）、销售负责人三种角色
- 销售仅可查看本人负责的参会者（Supabase RLS 服务端强制）
- 名单全局锁、按行锁、按字段组锁
- 行程城市不一致、非预设出发城市自动待审批
- 报名和行程变更记录、会务提醒
- 接机司机、车辆、集合点及送机安排
- 参会者输入手机号查询最小化的接送机信息，不使用短信验证码
- GitHub Actions 自动发布 GitHub Pages
- 多项目新建、复制与切换；各项目独立名单、角色、二维码、报名字段和接送规则
- 会务负责人可直接导入线下收到的 `.xlsx` / `.xls` / `.csv` 名单，导入前预览新增、更新和错误行
- 无绿色分类视觉：报名、名单、审批、接送、锁定和提醒采用独立识别色，每个项目自动分配图标与项目色

## 本地预览

直接打开 `index.html`，或在项目目录运行：

```bash
python3 -m http.server 4173
```

访问 `http://localhost:4173`。默认 `config.js` 使用演示模式，数据只保存在当前浏览器。演示查询号码：`13800005201`。

## 正式上线

### 1. 建立 Supabase 项目

1. 在 Supabase 新建项目。
2. 新项目先在 SQL Editor 完整执行 `supabase/schema.sql`，再执行 `supabase/migrations/20260818_multi_project.sql`。已有项目只需执行后一个升级脚本。
3. 在 Authentication 创建工作人员邮箱密码账号。
4. 查询会议 ID：

```sql
select id from public.meetings where slug = 'hema-sem-2026';
```

5. 为每个账号建立角色资料。将下面 UUID 和资料替换为真实值：

```sql
insert into public.profiles (user_id, meeting_id, display_name, phone, role)
values
  ('会务账号UUID', '会议UUID', '会务负责人姓名', '手机号', 'ops'),
  ('客户账号UUID', '会议UUID', '客户会议负责人姓名', '手机号', 'client'),
  ('销售账号UUID', '会议UUID', '销售姓名', '手机号', 'sales');
```

首次执行多项目升级脚本会自动把上述账号复制到 `meeting_members`。之后会务负责人可在“项目管理”中新建或复制项目；每个二维码使用 `?event=项目编号#portal` 区分项目。

### 2. 部署公开查询函数

安装 Supabase CLI 并登录后执行：

```bash
supabase link --project-ref 你的项目编号
supabase secrets set QUERY_RATE_SALT=一段足够长的随机字符串
supabase functions deploy public-trip-query --no-verify-jwt
```

公开查询函数只返回脱敏姓名与接送机信息，并按来源地址限制 10 分钟内最多查询 20 次。它不会返回证件号、医院、客户编号或销售资料。

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

- 用三类真实测试账号分别验证可见名单范围。
- 将演示数据留在演示模式即可；生产模式只读取 Supabase 数据，不会上传本地演示名单。
- 用无痕窗口测试手机号查询仅显示接送机字段。
- 若公开查询可能遭到批量撞库，建议在 Edge Function 前增加 Cloudflare Turnstile；这不需要短信验证码。
- 身份证/护照属于敏感个人信息，仅在确有业务依据时收集，设置最短保留期，并在会议结束后按组织要求删除。

## 文件说明

- `index.html`：应用全部页面
- `styles.css`：响应式视觉样式
- `app.js`：报名、审批、锁定、接送机、查询和导出逻辑
- `config.js`：演示/生产环境切换
- `supabase/schema.sql`：表结构、RLS、锁定校验与审计触发器
- `supabase/migrations/20260818_multi_project.sql`：多项目权限、配置和复制项目升级脚本
- `supabase/functions/public-trip-query/index.ts`：无短信验证码的手机号查询接口
- `.github/workflows/deploy-pages.yml`：GitHub Pages 自动发布

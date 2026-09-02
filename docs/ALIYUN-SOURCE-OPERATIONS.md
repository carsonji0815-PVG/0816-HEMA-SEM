# 阿里云源码、发布与恢复说明

## 权威来源

- 生产运行地址：`https://139.196.97.236/meeting/`。
- 服务器权威 Git 镜像：`/opt/lilly-source/repository.git`，仅 root 可读写，不开放公网 Git/SSH 端口。
- 私有 OSS 源码归档：`oss://lilly-meetings-backup-84650271/source-repositories/lilly-meeting-platform/`。
- 每个归档使用 Git bundle，保留全部分支、标签与提交历史；同目录保存 SHA-256 清单。
- 当前生产所需的六个精确容器镜像另存于私有 OSS：`oss://lilly-meetings-backup-84650271/runtime-images/runtime-images-20260902.tar.gz`；服务器 `/opt/lilly-source/runtime-images.sha256` 保存校验值。
- GitHub 仓库降级为历史副本，不参与生产构建、发布、数据库迁移或恢复。

## 发布原则

1. 工作区必须无未提交修改，回归测试通过后才生成提交。
2. 运行 `node scripts/prepare-aliyun-source-release.mjs` 生成 Git bundle 与校验清单。
3. bundle 上传到私有 OSS，并在阿里云服务器回读、校验 SHA-256 后更新服务器 Git 镜像。
4. 应用发布继续使用不可变发布目录；切换前必须执行加密异地备份。
5. 数据库迁移先在 `BEGIN ... ROLLBACK` 中预检，再单事务正式执行。
6. 新前端、Edge Function、数据库和公网 API 全部校验通过后，才认定发布成功。

## 恢复源码

从服务器镜像恢复：

```bash
git clone /opt/lilly-source/repository.git lilly-meeting-platform
```

从 OSS bundle 恢复：

```bash
git clone lilly-meeting-platform-<commit>.bundle lilly-meeting-platform
```

恢复前必须先比对同目录清单中的 SHA-256；不得把数据库密钥、OSS密钥、Auth secret 或备份解密密钥写入仓库。

若新服务器无法访问原镜像注册表，可从私有 OSS 下载运行镜像归档，核对 `/opt/lilly-source/runtime-images.sha256` 后执行：

```bash
gzip -dc runtime-images-20260902.tar.gz | docker image load
```

该归档只包含运行镜像，不包含数据库、附件或密钥。数据库、SQLite、附件、配置和前端继续由每日加密备份单独恢复。

## 数据服务边界

保留现有 Supabase 兼容开源组件，不替换业务 SDK 或数据库协议。这些组件运行在阿里云自托管 Docker 环境，生产前端指向 `https://139.196.97.236/supabase`。原 Supabase 云项目继续只读保留观察，不再接受生产写入。

## GitHub 边界

- 不再配置 GitHub Pages 或 GitHub Actions 生产部署。
- 旧 GitHub Pages 地址可暂时保留为跳转兼容，避免历史二维码立即失效。
- 关闭旧入口前，应先确认所有二维码、邮件与会议材料均使用阿里云正式地址或后续正式域名。

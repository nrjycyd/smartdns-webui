# SmartDNS WebUI

基于 [pymumu/smartdns-webui](https://github.com/pymumu/smartdns-webui) 定制的 [SmartDNS](https://github.com/pymumu/smartdns) 管理面板，提供查询日志、统计图表、客户端与上游服务器查看，并增强设备标识、表格布局、分组外观和设置备份。

[下载最新版本](https://github.com/nrjycyd/smartdns-webui/releases/latest) · [构建与发布](https://github.com/nrjycyd/smartdns-webui/actions) · [SmartDNS 文档](https://pymumu.github.io/smartdns/)

## 功能

| 模块 | 功能 |
| --- | --- |
| 仪表盘 | 实时查询指标、小时与每日查询趋势、客户端及域名排行榜、缓存列表与缓存清理 |
| 查询日志 | 服务端分页与筛选、域名类型标签、客户端标识、分组外观、缓存命中、Ping、查询耗时、单条记录删除及 WHOIS 查询 |
| 客户端 | 查看 IP、MAC、主机名及最后查询时间，按 MAC 自定义名称、设备图标和颜色 |
| 上游服务器 | 查看协议、地址、安全状态、成功率、平均延迟及查询数量 |
| 日志与终端 | 运行日志、审计日志实时查看，以及后端启用时可用的终端 |
| 设置 | 密码、语言、分组外观、表格显示、时区、备份与恢复 |

界面支持浅色、深色和跟随系统主题，适配电脑、平板及手机；保留 PWA 清单、应用图标和离线提示页，可通过支持的浏览器安装到桌面或主屏幕。

本仓库提供前端静态页面，需要已有的 SmartDNS WebUI 后端提供 `/api/` 和 WebSocket 服务。实际可用的数据与操作取决于后端版本及配置。

## 部署

### 环境要求

- 已安装 SmartDNS，并启用 WebUI 后端。
- 服务器可访问 GitHub，准备好 `curl`、`tar` 和 `sha256sum`。
- 以下命令适用于使用 systemd 的 Linux 主机，以 WebUI 端口 `6080` 为例。OpenWrt、容器及其他安装方式请按实际环境调整路径和重启命令。

部署预编译包不需要 Node.js。

### 安装或更新网页文件

在服务器的 root 终端执行。脚本会下载 Latest Release、校验压缩包、备份已有网页，并保留原有的 `group-colors.json`。

```bash
(
set -e

REPO="https://github.com/nrjycyd/smartdns-webui"
LATEST_URL="$(curl -fsSL -o /dev/null -w '%{url_effective}' "$REPO/releases/latest")"
TAG="${LATEST_URL##*/}"
ASSET="smartdns-ui-${TAG}.tar.gz"
URL="$REPO/releases/download/$TAG"

WORKDIR="$(mktemp -d)"
cd "$WORKDIR"

curl -fL --retry 3 "$URL/$ASSET" -o "$ASSET"
curl -fL --retry 3 "$URL/$ASSET.sha256" -o "$ASSET.sha256"
sha256sum -c "$ASSET.sha256"

if [ -d /opt/smartdns-webui ]; then
  tar -czf "/tmp/smartdns-webui-backup-$(date +%Y%m%d-%H%M%S).tar.gz" \
    -C /opt/smartdns-webui .
fi

install -d -m 755 /opt/smartdns-webui
if [ -f /opt/smartdns-webui/group-colors.json ]; then
  cp -p /opt/smartdns-webui/group-colors.json "$WORKDIR/group-colors.saved.json"
fi

tar --no-same-owner -xzf "$ASSET" -C /opt/smartdns-webui
if [ -f "$WORKDIR/group-colors.saved.json" ]; then
  install -m 644 "$WORKDIR/group-colors.saved.json" /opt/smartdns-webui/group-colors.json
fi

printf '已安装 UI：%s\n' "$TAG"
)
```

压缩包内直接是网页文件。已有网页的备份保存在 `/tmp/smartdns-webui-backup-日期时间.tar.gz`，需要长期留存时请另行保存。浏览器中的个性化设置通过“设置 → 备份”单独导出。

### 指定网页目录

先备份配置：

```bash
cp -a /etc/smartdns/smartdns.conf \
  "/etc/smartdns/smartdns.conf.bak-$(date +%Y%m%d-%H%M%S)"
```

在 `/etc/smartdns/smartdns.conf` 中添加或修改：

```text
smartdns-ui.www-root /opt/smartdns-webui
```

如果插件启动参数中设置了 `-r` 或 `--www-root`，同时修改该路径；启动参数优先于配置项。可参阅 [SmartDNS 插件配置实现](https://github.com/pymumu/smartdns/blob/master/plugin/smartdns-ui/src/plugin.rs)。

首次修改目录后重启 SmartDNS，重启期间 DNS 服务会短暂中断：

```bash
systemctl restart smartdns
systemctl is-active smartdns
curl -fsS http://127.0.0.1:6080/manifest.json
```

确认服务为 `active`、清单可读取后，用浏览器打开实际 WebUI 地址并登录。后续更新同一目录中的 UI 文件后刷新页面即可。

反向代理需转发整个站点、`/api/` 和 WebSocket。请部署在站点根路径；当前配置未支持 `/smartdns/` 等子路径。

## 个性化设置

### 客户端名称、图标与颜色

在“客户端”的记录操作菜单中选择“自定义主机名”，可设置名称、设备图标及自定义颜色。同一 MAC 的 IPv4、IPv6 记录共用设置；查询日志和仪表盘客户端排行榜也可使用自定义名称。

内置 16 个设备图标预设，包括 Apple、Windows、Android、摄像头和常见 NAS；也可输入其他 Iconify 图标名。内置图标可本地显示，其他图标需联网加载。名称留空可恢复服务器主机名，图标和颜色可单独调整。

设备图标的活跃状态依据最近 5 分钟内是否有 DNS 查询。灰色表示近期无查询，问号表示状态未知；该状态不代表设备是否在线。

查询日志中的长 IPv6 可简写为最后两组，悬停与复制保留完整 IP；客户端筛选仍使用完整 IP。更多说明见 [客户端自定义设置](docs/client-names.md)。

### 分组外观

在“设置 → 分组外观”中调整各 DNS 组的文字颜色、图标及图标颜色，并预览深浅主题效果。支持保存、取消和恢复当前分组。

浏览器自定义值覆盖网页目录中的 `group-colors.json` 默认值；未自定义的字段继续沿用文件配置。内置 DIRECT、PROXY、REJECT 外观，可直接编辑文件设置全站默认值，格式见 [分组显示配置](docs/group-colors.md)。

分组外观仅改变显示，不创建或修改 SmartDNS 分流规则。导入、导出统一在“设置 → 备份”中操作。

### 表格显示

“设置 → 显示设置”统一管理查询日志、客户端和上游服务器表格：

- **间距**：紧凑、标准、宽松，立即生效。各表格工具栏中的间距切换可作临时预览。
- **自动适应**：根据表头、当前页内容和窗口空间分配列宽，空间不足时保留横向滚动。
- **手动调整**：拖动列边缘调整，保留各表格已保存的列宽。

查询日志表头采用默认布局，ID 数据左对齐；状态、类型、组及耗时等列使用对应的数据样式。刷新保留已扩展的自动列宽，可用工具栏“重新适配列宽”重新收紧；切页、筛选及相关设置变化会重新测量。窄屏下“回应码”可能暂时隐藏，空间恢复后重新显示。

### 时间与语言

“设置 → 时间显示”提供显示时区与统计数据原始时区，默认均为 `Asia/Shanghai`。完整日期采用 `YYYY/MM/DD HH:mm:ss` 和 24 小时制。

统计数据原始时区应与服务器一致，用来解释统计接口中未携带时区的小时和日期。每日统计沿用服务器分桶，切换显示时区不会重新划分每日数量。运行日志文本保持服务器输出。

“设置 → 语言”可切换中文、英文或德文。右上角可切换主题。

## 备份与恢复

在“设置 → 备份”导出 JSON 文件，迁移到其他设备、浏览器或访问地址时，再导入该文件。

包含以下已保存的参数：

- 客户端名称、图标、颜色及分组外观。
- 表格列宽、列显隐、每页条数、密度和列宽模式。
- 显示时区、统计数据原始时区、语言及主题。

导入流程为“选择文件 → 校验 → 确认导入 → 自动刷新”。导入会替换文件包含的设置；完整备份中记录为默认的项目也会恢复默认值。兼容旧版分组外观 JSON，旧文件仅恢复分组外观。

备份不包含密码、登录令牌、DNS 规则、查询日志、服务端配置或未保存的修改。文件大小不超过 1 MiB，详情见 [备份格式与行为](docs/settings-backup.md)。

这些自定义设置保存在当前浏览器、当前访问来源下，来源包括协议、主机和端口；不会自动跨设备同步，清除站点数据也会清除设置。更换地址或清理数据前，建议先导出备份。

## PWA 与离线提示

安装入口由浏览器提供。电脑可使用 Chrome / Edge 的安装菜单，iPhone / iPad 可在 Safari 中使用“分享 → 添加到主屏幕”。具体支持情况取决于浏览器和访问条件。

Service Worker 需要安全上下文；长期使用建议通过受设备信任的 HTTPS 地址访问。普通局域网 HTTP 可以作为网页访问。HTTPS、SSH 隧道及桌面 Chrome 测试例外的操作步骤见 [PWA 安装与访问](docs/pwa-install.md)，安装条件可参阅 [MDN 文档](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable)。

离线时仅显示公共提示页，不缓存管理页面、API 数据或查询日志；实时管理功能需要连接 SmartDNS 后端。

## 本地开发

使用 Node.js 24 和 npm：

```bash
git clone https://github.com/nrjycyd/smartdns-webui.git
cd smartdns-webui
npm ci
npm run dev
```

开发配置将 `/api/` 转发到 `http://127.0.0.1:6080`，请先准备后端，或按环境修改 `next.config.mjs`。日志、指标和终端还需要可用的 WebSocket 连接。

检查与构建：

```bash
npm test
npm run lint
npm run typecheck
npm run build
```

生产构建生成静态目录 `out/`，部署该目录的内容到 SmartDNS 网页根目录。`npm run build` 包含 ESLint 与 TypeScript 检查。

## 自动发布

推送到 `main` 或在 Actions 手动触发 `Release` 后，工作流按配置执行测试与生产构建。成功后创建以北京时间命名的版本，如 `v1.0.0-pwa-YYYYMMDD-HHmmss`，发布以下附件并标记为 Latest：

- `smartdns-ui-<版本>.tar.gz`：网页部署包。
- `smartdns-ui-<版本>.tar.gz.sha256`：压缩包校验值。

工作流见 [Release](.github/workflows/release.yml)。本地可通过 `node --test tests/*.test.mjs` 运行包括备份与时间显示在内的全部测试。

## 致谢与许可

感谢 [pymumu/smartdns](https://github.com/pymumu/smartdns) 与 [pymumu/smartdns-webui](https://github.com/pymumu/smartdns-webui) 提供的服务端和前端基础。

项目采用 [MIT License](LICENSE)。随项目分发的图标遵循各自许可，归属与许可文件见 [public/licenses](public/licenses)。

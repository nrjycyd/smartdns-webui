# SmartDNS WebUI

基于 [pymumu/smartdns-webui](https://github.com/pymumu/smartdns-webui) 定制的 [SmartDNS](https://github.com/pymumu/smartdns) 管理面板，支持安装到桌面或手机主屏幕、独立应用窗口、跟随主题切换标题栏颜色，以及离线提示。

## 使用 PWA UI

按以下顺序操作：安装 Latest UI → 设置网页目录 → 选择 HTTPS 或 SSH 隧道访问 → 安装应用。

以下以 Linux systemd 主机为例，假设已经安装 SmartDNS 并启用自带的 WebUI 后端，主机地址为 `10.0.0.2`，WebUI 端口为 `6080`。请按实际环境替换地址、端口和 SSH 用户名。安装预编译 UI 不需要在服务器上安装 Node.js。

### 1. 安装 Latest UI

在 **Linux 服务器的 root 终端**执行以下命令。需要 `curl`、`tar` 和 `sha256sum`，命令会自动获取 Latest 版本、下载构建包并校验完整性。

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

echo "安装版本：$TAG"
curl -fL --retry 3 "$URL/$ASSET" -o "$ASSET"
curl -fL --retry 3 "$URL/$ASSET.sha256" -o "$ASSET.sha256"
sha256sum -c "$ASSET.sha256"

if [ -d /opt/smartdns-webui ]; then
  tar -czf "/tmp/smartdns-webui-backup-$(date +%Y%m%d-%H%M%S).tar.gz" \
    -C /opt/smartdns-webui .
fi

install -d -m 755 /opt/smartdns-webui
tar --no-same-owner -xzf "$ASSET" -C /opt/smartdns-webui
)
```

构建包来自 [Latest Release](https://github.com/nrjycyd/smartdns-webui/releases/latest)，其内部直接是网页文件，不需要再编译。首次安装后继续下一步；以后更新 UI 时重新运行上述命令，然后刷新页面即可。已有 UI 会先备份到 `/tmp/smartdns-webui-backup-日期时间.tar.gz`。

### 2. 设置 SmartDNS 网页目录

先备份服务器配置：

```bash
cp -a /etc/smartdns/smartdns.conf \
  "/etc/smartdns/smartdns.conf.bak-$(date +%Y%m%d-%H%M%S)"
```

编辑 `/etc/smartdns/smartdns.conf`，添加或修改已有的网页目录配置：

```text
smartdns-ui.www-root /opt/smartdns-webui
```

若插件加载参数中已有 `-r` 或 `--www-root`，也需改为 `/opt/smartdns-webui`，因为启动参数优先于上述配置项。参见 [SmartDNS 网页目录配置实现](https://github.com/pymumu/smartdns/blob/master/plugin/smartdns-ui/src/plugin.rs)。

首次更改目录后，重启 SmartDNS 并检查网页文件是否可访问。重启会短暂中断 DNS 服务：

```bash
systemctl restart smartdns
systemctl is-active smartdns
curl -fsS http://127.0.0.1:6080/manifest.json
```

`systemctl` 应返回 `active`，最后一条命令应输出 SmartDNS 应用清单。

自定义 UI 使用独立的 `/opt/smartdns-webui` 目录；官方安装脚本更新自带 UI 时使用 `/usr/share/smartdns/wwwroot`，并保留已有配置。升级 SmartDNS 时保留 `smartdns-ui.www-root` 配置即可继续使用自定义 UI；第三方脚本若重置配置，则需重新确认这一项。参见 [官方安装脚本](https://github.com/pymumu/smartdns/blob/master/package/linux/install)。

### 3. 选择 PWA 访问方式

PWA 安装入口和 Service Worker 需要安全上下文。使用具有设备信任证书的 HTTPS 地址，或在当前设备上通过 `localhost` / 回环地址访问。普通局域网 HTTP 地址（例如 `http://10.0.0.2:6080`）不满足该条件。参见 [PWA 安装条件](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable)。

**方式 A：HTTPS，适合电脑和手机长期使用。**

准备一个 HTTPS 入口，例如 `https://smartdns.example.com`，通过反向代理转发到 `http://10.0.0.2:6080`。域名可以只在局域网内解析到服务器，不必开放公网访问。证书必须覆盖访问的域名或 IP，并被使用设备信任；自签名证书需要先正确配置客户端信任。

反向代理应转发整个站点、`/api/` 和终端功能需要的 WebSocket。使用站点根路径访问，当前面板不支持直接挂载到 `/smartdns/` 等子路径。

**方式 B：SSH 本地端口转发，适合电脑上直接使用。**

在 **自己的电脑上**打开终端（Windows 可使用 PowerShell），将 `user` 替换为服务器的 SSH 用户名：

```powershell
ssh -N -L 16080:127.0.0.1:6080 user@10.0.0.2
```

按提示完成 SSH 登录并保持终端运行，然后用电脑浏览器访问 `http://localhost:16080`。浏览器将 `localhost` 视为可信的本地来源，因此可以启用 PWA。命令里的 `127.0.0.1:6080` 指服务器自身的 WebUI，`16080` 是电脑上的本地入口。

通过此地址安装的应用，以后打开时也需要先建立同样的 SSH 隧道。隧道关闭后，应用无法连接 SmartDNS 后台。手机上的 `localhost` 指手机自身，不能直接使用电脑的本地转发端口；手机使用 PWA 推荐选择 HTTPS 方式。

### 4. 安装到桌面或主屏幕

**Windows / macOS / Linux 电脑：**

1. 用支持 PWA 安装的 Chrome 或 Edge 打开上一步的 HTTPS 或 `localhost` 地址，并登录面板。
2. 点击浏览器地址栏或菜单中的安装入口；也可在面板中进入“设置 → 安装应用”，按钮可用时点击安装。
3. 按浏览器提示确认，之后即可从桌面、开始菜单或应用启动器打开独立窗口。

**Android：**

1. 用 Chrome 等支持 PWA 的浏览器打开 HTTPS 地址并登录。
2. 使用浏览器菜单中的“安装应用”或“添加到主屏幕”；具体名称取决于浏览器。
3. 确认后，从主屏幕打开 SmartDNS。

**iPhone / iPad：**

1. 用 Safari 打开 HTTPS 地址并登录。
2. 点击“分享”，选择“添加到主屏幕”，再确认添加。
3. 从主屏幕图标打开 SmartDNS。

安装后使用原有的 SmartDNS 登录流程。不同访问地址的应用和登录状态分别保存，请从最终准备长期使用的地址安装。

## 使用与常见问题

- **安装按钮不可用：** 先确认正在使用可信 HTTPS 或当前设备的 `localhost` 地址。已安装、取消过安装提示或不支持安装事件的浏览器，按钮可能不可用；可查看浏览器自身的安装菜单。
- **直接用局域网 HTTP 能否安装：** 部分浏览器允许将普通网页作为独立窗口安装，但本面板的 PWA 安装按钮与 Service Worker 仍要求安全上下文。
- **是否支持离线管理：** 当前仅缓存公共离线提示页，不缓存登录信息、管理页面、API 数据或查询日志。断网刷新会显示提示；查看实时数据、修改配置仍需连接 SmartDNS 服务器。联网后点击“重试”恢复访问。
- **标题栏颜色：** 在页面右上角切换浅色、深色或跟随系统，支持的浏览器会同步调整窗口标题栏颜色；iOS 状态栏的具体效果由系统和浏览器决定，尚未做真机验证。
- **仍显示旧图标：** 刷新页面后卸载并重新安装应用，保留网站数据。固定在任务栏的图标也可重新固定。桌面图标使用透明背景，Android 自适应图标和 Apple Touch 图标使用绿色实底。
- **更新后检查：** `/manifest.json`、`/sw.js`、`/offline.html` 和 `/icons/` 下的图标应能直接访问，不能被登录重定向或网页回退替换。已安装应用刷新后会获取新页面。

## GitHub 自动发布

推送到 `main` 后，`Release` 工作流会使用 Node.js 24 运行测试并构建页面，成功后自动创建带北京时间的 Release，例如 `v1.0.0-pwa-20261025-223045`，上传 `.tar.gz` 部署包和 `.sha256` 校验文件，并标记为 Latest。历史版本保留。

也可在 Actions 中选择 `Release → Run workflow → main` 手动触发。构建失败时不发布；多个推送会串行处理，快速连续推送时保留最新的待执行任务。

## License

MIT

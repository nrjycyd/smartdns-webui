# SmartDNS WebUI

基于 [pymumu/smartdns-webui](https://github.com/pymumu/smartdns-webui) 定制的 [SmartDNS](https://github.com/pymumu/smartdns) 管理面板，支持安装到桌面或手机主屏幕、独立应用窗口、跟随主题切换标题栏颜色，以及离线提示。

## 使用 PWA UI

按以下顺序操作：安装 Latest UI → 设置网页目录 → 选择访问方式（HTTPS、SSH 隧道或桌面 Chrome 测试例外）→ 安装应用。

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
if [ -f /opt/smartdns-webui/group-colors.json ]; then
  cp -p /opt/smartdns-webui/group-colors.json "$WORKDIR/group-colors.saved.json"
fi
tar --no-same-owner -xzf "$ASSET" -C /opt/smartdns-webui
if [ -f "$WORKDIR/group-colors.saved.json" ]; then
  install -m 644 "$WORKDIR/group-colors.saved.json" /opt/smartdns-webui/group-colors.json
fi
)
```

构建包来自 [Latest Release](https://github.com/nrjycyd/smartdns-webui/releases/latest)，其内部直接是网页文件，不需要再编译。首次安装后继续下一步；以后更新 UI 时重新运行上述命令，然后刷新页面即可。已有 UI 会先备份到 `/tmp/smartdns-webui-backup-日期时间.tar.gz`，已有的 `group-colors.json` 会在解压后恢复。

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

PWA 安装入口和 Service Worker 需要安全上下文。默认使用具有设备信任证书的 HTTPS 地址，或在当前设备上通过 `localhost` / 回环地址访问。普通局域网 HTTP 地址（例如 `http://10.0.0.2:6080`）默认不满足该条件；桌面 Chrome 可通过下述方式 C 为指定来源设置测试例外。参见 [PWA 安装条件](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable)。

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

**方式 C：桌面 Chrome 为内网 HTTP 地址设置测试例外。**

适用于 Windows、macOS、Linux 桌面 Chrome，可直接访问 `http://10.0.0.2:6080` 使用 PWA，无需配置证书或保持 SSH 隧道。这是每台电脑上需要单独设置的浏览器测试选项，不是 iPhone / iPad 的通用方案。

1. 在 Chrome 地址栏打开以下页面：

   ```text
   chrome://flags/#unsafely-treat-insecure-origin-as-secure
   ```

2. 找到 **Insecure origins treated as secure**，在输入框中填写：

   ```text
   http://10.0.0.2:6080
   ```

   地址需包含 `http://`、主机和端口，不要填写 `/auth/sign-in` 等页面路径。使用其他 IP 或端口时，填写实际访问的来源。

3. 将该选项设为 **Enabled**，点击 **Relaunch** 重新启动 Chrome。
4. 重新打开 `http://10.0.0.2:6080`，登录面板，然后通过浏览器菜单或“设置 → 安装应用”完成安装。

可在浏览器开发者工具的控制台输入以下表达式检查，结果应为 `true`：

```javascript
window.isSecureContext
```

**该选项只改变浏览器对指定来源的安全上下文判断，HTTP 流量仍未加密，登录信息也仍通过 HTTP 传输。** 仅对可信内网地址使用；电脑、手机长期通用部署优先选择 HTTPS。若浏览器版本不再提供此选项，可改用方式 A 或 B。

需要撤销时，将该选项恢复为 **Default** 并重新启动 Chrome，或从列表中移除这个来源后重新启动。参见 [Chromium 官方测试说明](https://www.chromium.org/Home/chromium-security/deprecating-powerful-features-on-insecure-origins/)。

**可选：隐藏 Chrome 的“不受支持的命令行标记”提示（Windows）。**

开启方式 C 后，Chrome 可能显示“您使用的是不受支持的命令行标记：`--unsafely-treat-insecure-origin-as-secure=…`。稳定性和安全性会有所下降”。这是浏览器自身的启动提示，面板网页无法移除。

可通过测试启动参数 `--test-type` 隐藏这类提示：

1. 保存工作并彻底退出 Chrome，包括后台运行的进程。
2. 右键用于启动 Chrome 的快捷方式，选择“属性”。
3. 在“目标”末尾追加一个空格和 `--test-type`，保留原有路径和其他参数。例如：

   ```text
   "C:\Program Files\Google\Chrome\Application\chrome.exe" --test-type
   ```

4. 保留方式 C 中设置的 HTTP 来源例外，从修改后的快捷方式重新启动 Chrome，再访问面板。

以后需从带该参数的快捷方式启动；Chrome 已在后台运行时，新的启动参数可能不会生效。从其他快捷方式启动时，提示也可能再次出现。

**`--test-type` 会一并跳过部分其他启动提示，并非只关闭这一条警告。它属于测试参数，仅隐藏提示，不会加密 HTTP 流量，浏览器升级后行为可能变化。** 参见 [Chromium 启动提示处理源码](https://github.com/chromium/chromium/blob/155.0.8059.86/chrome/browser/ui/startup/infobar_utils.cc)。

要恢复启动提示，移除快捷方式中的 `--test-type`，彻底退出并重新启动 Chrome。若还需撤销 HTTP 来源的安全上下文例外，应另将方式 C 的 Chrome flags 选项恢复为 **Default**。

### 4. 安装到桌面或主屏幕

**Windows / macOS / Linux 电脑：**

1. 用支持 PWA 安装的 Chrome 或 Edge 打开上一步的 HTTPS 或 `localhost` 地址，并登录面板；若选择方式 C，则使用已经设置测试例外的桌面 Chrome 打开指定 HTTP 地址。
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

- **安装按钮不可用：** 先确认正在使用可信 HTTPS 或当前设备的 `localhost` 地址；若使用方式 C，确认来源包含正确端口、已重启 Chrome，且 `window.isSecureContext` 为 `true`。已安装、取消过安装提示或不支持安装事件的浏览器，按钮可能不可用；可查看浏览器自身的安装菜单。
- **直接用局域网 HTTP 能否安装：** 部分浏览器允许将普通网页作为独立窗口安装。本面板的 PWA 安装按钮与 Service Worker 仍要求安全上下文；桌面 Chrome 可按方式 C 为指定来源设置测试例外，使其满足该条件。
- **打开 Chrome 时提示命令行标记不受支持：** 这是方式 C 的浏览器测试选项引起的启动提示，可参考该方式下的可选 `--test-type` 设置；它只隐藏提示，不改变 HTTP 未加密的事实。
- **是否支持离线管理：** 当前仅缓存公共离线提示页，不缓存登录信息、管理页面、API 数据或查询日志。断网刷新会显示提示；查看实时数据、修改配置仍需连接 SmartDNS 服务器。联网后点击“重试”恢复访问。
- **标题栏颜色：** 在页面右上角切换浅色、深色或跟随系统，支持的浏览器会同步调整窗口标题栏颜色；iOS 状态栏的具体效果由系统和浏览器决定，尚未做真机验证。
- **仍显示旧图标：** 刷新页面后卸载并重新安装应用，保留网站数据。固定在任务栏的图标也可重新固定。桌面图标使用透明背景，Android 自适应图标和 Apple Touch 图标使用绿色实底。
- **更新后检查：** `/manifest.json`、`/sw.js`、`/offline.html` 和 `/icons/` 下的图标应能直接访问，不能被登录重定向或网页回退替换。已安装应用刷新后会获取新页面。

## 自定义客户端主机名

在“客户端”记录的操作菜单选择“自定义主机名”，可按 MAC 设置名称，同一 MAC 的不同 IP 共用显示名称。仪表盘“最多查询客户端”按 MAC 匹配显示名称并保留 IP，仍按查询次数排名，不改变原有统计与日志跳转。

配置仅保存在当前浏览器，不修改服务端、DHCP 或设备主机名。留空保存或选择“恢复原始主机名”可撤销；无法获取有效 MAC 时保持原始显示。完整行为及限制见 [客户端主机名说明](docs/client-names.md)。

## 全局表格间距

打开“设置 → 显示设置”，可选择“紧凑／标准／宽松”。选择立即应用到查询日志、客户端和上游服务器表格；默认“标准”保持原来的间距，不改变每页显示条数。

各页的间距按钮保留为“临时预览间距”，仅调整当前页面，不覆盖已保存的全局设置。离开页面再返回或刷新后重新采用全局间距；在其他窗口更改全局间距时，当前页面的预览也会重新采用新的全局设置。

设置保存在当前浏览器、当前访问地址的本地存储中，离开页面再返回或刷新后都会保留，同地址的其他窗口也会同步。不修改服务端；换设备、换浏览器或访问地址不会自动同步，清除站点数据后恢复“标准”。

## 查询日志分组颜色与图标

编辑 WebUI 目录中的 `group-colors.json`，可为“组”列配置文字颜色 `color`、Iconify 图标 `icon` 和独立的图标颜色 `iconColor`。默认提供 REJECT 红色双调盾牌、PROXY 蓝色星芒地球、DIRECT 绿色双调闪电图标，并随面板深浅色主题调整配色。

也可在“设置 → 分组外观”中通过颜色选择、图标预览调整外观。UI 仅在当前浏览器、当前访问地址保存修改项，未修改项沿用 JSON 默认值；主动清空则使用原始显示。支持保存／取消、恢复默认及导入导出，不改服务端文件或数据库。

组名直接来自 SmartDNS 日志，无需同步维护分组名单。未配置的组保持原样；文件留空、缺失、格式错误或为 `{}` 时，未设置本地覆盖的部分回退到原有显示。`color` 留空使用主题默认文字颜色，`icon` 留空不显示图标，`iconColor` 留空跟随文字颜色。修改后刷新页面或点击查询日志的刷新按钮即可生效。

默认三枚图标随 UI 打包，无需访问公网；其他图标名需要浏览器访问 Iconify API。完整格式、示例和升级配置保留步骤见 [分组显示配置说明](docs/group-colors.md)。

## GitHub 自动发布

推送到 `main` 后，`Release` 工作流会使用 Node.js 24 运行测试并构建页面，成功后自动创建带北京时间的 Release，例如 `v1.0.0-pwa-20261025-223045`，上传 `.tar.gz` 部署包和 `.sha256` 校验文件，并标记为 Latest。历史版本保留。

也可在 Actions 中选择 `Release → Run workflow → main` 手动触发。构建失败时不发布；多个推送会串行处理，快速连续推送时保留最新的待执行任务。

## License

MIT

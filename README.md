# SmartDNS WebUI

SmartDNS UI界面源码仓。

## 本地开发与构建

使用 Node.js 22 LTS 或更新的受支持 LTS 版本（Next.js 16 至少需要 Node.js 20.9）。

```sh
npm ci
npm run dev
```

开发模式将 `/api/*` 转发到 `http://127.0.0.1:6080`。构建可部署的静态文件：

```sh
npm run typecheck
npm run test:pwa
npm run build
```

构建输出位于 `out/`，将其中的**全部内容**部署到现有 SmartDNS WebUI 静态文件目录，保留 `/_next/`、`/icons/` 等目录结构。当前应用及 API 均使用站点根路径，不支持直接挂载到 `/smartdns/` 等子路径。`npm start` 不适用于此静态导出模式。

## PWA 应用安装

已包含 Web App Manifest、192/512 像素图标、Android maskable 图标、Apple Touch 图标和 Service Worker，无需额外 PWA 插件或 Node.js 生产服务器。

清单使用 `public/manifest.json`，兼容 [SmartDNS 内置静态服务器的 MIME 映射](https://github.com/pymumu/smartdns/blob/master/plugin/smartdns-ui/src/http_server.rs)。安装图标由项目已有的 `public/assets/logo.svg` 缩放生成，maskable 图标额外保留安全区域。

桌面通用图标使用透明背景；Android maskable 和 Apple Touch 图标使用品牌绿色背景。图标 URL 包含版本号以避免沿用旧文件。若桌面仍显示旧的黑底图标，请刷新页面后卸载并重新安装应用（保留网站数据）；重新固定到任务栏时也应使用新的应用图标。

1. 使用具有**客户端信任证书**的 HTTPS 地址访问管理面板。`http://localhost` 或回环地址可用于本机测试；手机访问 `http://192.168.x.x` 等局域网地址不满足安全上下文要求。自签名证书须先在客户端正确受信任。
2. Chrome / Edge：使用地址栏或浏览器菜单中的安装入口；也可进入“设置 → 安装应用”，浏览器发出安装事件后按钮会启用。已安装、被用户取消或不支持安装事件的浏览器可能不显示可用按钮，仍可查看浏览器菜单。
3. iPhone / iPad：用 Safari 打开，选择“分享 → 添加到主屏幕”。安装后以独立窗口启动，保留原有登录流程。

Service Worker 仅在生产模式、安全上下文中注册。它只缓存公共离线提示页，不缓存管理页面、登录信息、API 响应或 Next.js 资源；离线时无法执行管理操作。重新联网后点击“重试”恢复访问。已打开的管理页面仍使用现有网络错误处理。

页面的 `theme-color` 会跟随当前实际配色切换：浅色为 `#f8f9fa`，深色为 `#121517`，与页面顶部工具栏一致。手动选择和“跟随系统”均生效；支持此功能的浏览器会据此调整 PWA 标题栏或浏览器界面颜色。Manifest 提供浅色启动默认值，页面加载后使用实际主题覆盖。操作系统及浏览器可能调整最终显示颜色；iOS 状态栏的具体表现需要真机确认。

### 部署与更新检查

- `/manifest.json`、`/sw.js`、`/offline.html` 和 `/icons/*.png` 必须能够直接访问，不能被登录重定向或 SPA 回退替换。
- 为 Manifest 返回 `application/manifest+json`（或 `application/json`）；为 `/sw.js` 返回 JavaScript MIME 类型。建议对 `/sw.js`、`/offline.html`、Manifest 和 HTML 使用 `Cache-Control: no-cache`，对带哈希的 `/_next/static/` 资源使用长期缓存。
- 使用 HTTPS 反向代理时，同源转发 `/api/`，并为终端功能转发 WebSocket；避免 HTTPS 页面请求 HTTP 后端产生混合内容。
- 更新时部署完整 `out/`。Service Worker 更新采用绕过 HTTP 缓存的检查；修改离线页面时同时递增 `public/sw.js` 中的缓存版本。
- 在浏览器开发者工具的 Application 中检查 Manifest 和 Service Workers；首次在线访问等待 Service Worker 激活后，断网刷新应显示离线提示。API、静态资源和页面内容不应出现在 Cache Storage 中，缓存只包含 `/offline.html`。

PWA 安装条件参考 [MDN](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable)；安装入口取决于浏览器及平台的支持。

## License

MIT

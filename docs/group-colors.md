# 查询日志分组颜色与图标

编辑 WebUI 根目录的 `group-colors.json` 即可调整查询日志“组”列的显示，无需修改 `smartdns.conf`、升级服务端插件或重启 SmartDNS。

源码文件位于 `public/group-colors.json`；静态构建后位于 `out/group-colors.json`。按现有部署路径，服务器上的位置是 `/opt/smartdns-webui/group-colors.json`。

## 在设置页自定义

打开“设置 → 分组外观”。界面沿用面板现有控件，提供文字颜色、图标、独立图标颜色和深浅色实时预览。

- 默认值来自服务器的 `group-colors.json`，界面不修改这个文件。
- 用户修改项仅写入当前浏览器、当前访问地址的本地存储，不调用服务端写入接口，不改 `smartdns.conf` 或服务端数据库。
- 每个字段可选择“沿用默认文件”；文字颜色还可选择“主题默认文字颜色”，图标可选择“不显示图标”，图标颜色可选择“跟随文字颜色”。
- “沿用默认文件”表示没有本地覆盖。主动选择空值表示覆盖为原始显示，不会再次被 JSON 默认值补回。
- 点击“保存更改”后生效；预览不会提前修改日志。“取消”放弃未保存的编辑。
- “恢复此组默认”先移除当前组的本地覆盖，保存后重新采用 JSON 中的默认值。

界面的“默认／自定义”标记表示当前组是否存在本地覆盖。未修改的字段会跟随 JSON 后续更新；主动清空的字段继续保持空值。默认文件缺失或无效时，本地自定义仍会应用，其余使用原始显示。

已知分组来自默认文件、本地规则，以及本次浏览过程中实际看到的查询日志；不会扫描全部历史。也可输入组名并按回车，配置尚未出现在列表中的组。这只增加显示规则，不创建 SmartDNS 分组。

本地存储键名为 `smartdns-webui:group-appearance:v1`。访问地址按协议、主机和端口区分，页面路径不影响。换浏览器、换设备或更换访问地址不会自动同步；清除站点数据会删除这些设置。同一浏览器、同一地址的其他窗口会同步已保存修改。有未保存编辑时，界面会提示其他窗口的变化并保留当前草稿。

### 备份与恢复

统一在“设置 → 备份”中导出、导入已保存的自定义设置，详见 [设置备份](settings-backup.md)。分组外观页保留保存、取消和恢复当前分组；重新加载默认文件、恢复全部默认及原导入导出操作已移除。

旧版分组外观 JSON 或 group-colors.json 可在备份页导入，字段缺失表示继承默认值，空字符串表示明确清空。校验通过后需点击“确认导入”，完成后自动刷新；旧文件仅替换分组外观。导出前请先保存编辑，未保存的草稿不在备份范围内。

## 配置示例

```json
{
  "groups": {
    "REJECT": {
      "color": "light-dark(#c62828, #ef9a9a)",
      "icon": "keyline-icons:shield-off-duotone",
      "iconColor": ""
    },
    "PROXY": {
      "color": "light-dark(#1565c0, #90caf9)",
      "icon": "andrsrxn:globe-sparkle",
      "iconColor": ""
    },
    "DIRECT": {
      "color": "light-dark(#2e7d32, #81c784)",
      "icon": "keyline-icons:circle-zap-sharp-duotone",
      "iconColor": ""
    }
  }
}
```

默认文件提供这三组的配色：浅色 / 深色分别为 REJECT `#c62828` / `#ef9a9a`、PROXY `#1565c0` / `#90caf9`、DIRECT `#2e7d32` / `#81c784`。双调图标保留原始透明度层次。修改后刷新网页，或点击查询日志工具栏中的“刷新数据”，即可重新读取配置；读取使用 `no-store`，每行记录不会重复下载配置。

组名取自 SmartDNS 查询日志的 `domain_group`，按原样精确匹配，区分大小写。JSON 仅控制外观，不创建或重命名分组。未配置的组照常显示，历史记录保留当时的组名。默认组可用键名 `default` 配置，页面仍显示本地化的“默认”。

## JSON 空值与默认显示

| 配置情况 | 效果 |
| --- | --- |
| 文件不存在、为空、格式错误或内容为 `{}` | 未设置 UI 本地覆盖的分组使用面板原有文字颜色，不加图标 |
| 未配置某个组 | 该组保持原样 |
| `color` 为空或未填写 | 使用当前主题的默认文字颜色 |
| `icon` 为空或未填写 | 不显示图标，忽略 `iconColor` |
| `iconColor` 为空或未填写 | 图标跟随组名文字颜色 |

字段前后的空白会去掉，`null` 和错误的字段类型按未填写处理。无效的 CSS 颜色不会生效。组名不会因显示配置而改变，原有按组筛选也保持可用。

例如，红色文字搭配橙色图标：

```json
{
  "groups": {
    "REJECT": {
      "color": "#e53935",
      "icon": "mdi:shield-off-outline",
      "iconColor": "#ff9800"
    }
  }
}
```

颜色使用 CSS 颜色值，如十六进制、`rgb()`、颜色名称或 `light-dark(浅色主题颜色, 深色主题颜色)`。组件会跟随面板实际主题，手动切换主题时也会同步调整；`iconColor` 同样支持这种写法。固定十六进制颜色仍按原值显示。`light-dark()` 需要现代浏览器支持，较旧浏览器不支持时使用默认文字颜色。单色图标可独立改色，彩色图标通常保留自身配色。

## Iconify 图标

`icon` 使用 `图标集:图标名`，例如 `keyline-icons:shield-off-duotone`。支持默认公共 Iconify 图标名，不接受任意 URL 或自定义 API 提供者。

- 默认的三枚图标已内置于 UI，加载它们无需访问公网。旧版默认的三枚 MDI 图标也继续内置，已有配置无需联网即可继续使用。
- 其他有效图标名由 Iconify 组件按需从公共 Iconify API 加载，需要浏览器能访问该服务。组件会合并和复用同名图标请求。
- 图标名称无效、找不到或网络不可用时，组名文字仍然正常显示；修改 JSON 不会自动将新图标加入离线资源。

图标采用 18px 尺寸，和组名并排显示。图标仅用于装饰，组名始终保留。

默认图标来自 Keyline Icons 和 Andrés Raxón 的 andrsrxn/icons，经 Iconify 分发，两套图标均使用 MIT 许可，许可文件位于 `/licenses/keyline-icons.txt` 和 `/licenses/andrsrxn-icons.txt`。兼容保留的旧版 MDI 图标使用 Apache-2.0，许可位于 `/licenses/material-design-icons.txt`；Iconify React 组件许可位于 `/licenses/iconify-react.txt`。

## 更新 UI 时保留自定义配置

Release 包含默认的 `group-colors.json`，直接解压更新会覆盖同名文件。README 的 Latest 安装脚本会自动保留已有的同名文件；使用其他解压流程时，请在解压前备份，完成后恢复。例如在 Linux 中：

```sh
cp -p /opt/smartdns-webui/group-colors.json /tmp/smartdns-group-colors.backup.json
# 按原部署流程解压新的 UI 包到 /opt/smartdns-webui
install -m 644 /tmp/smartdns-group-colors.backup.json /opt/smartdns-webui/group-colors.json
```

安装脚本会保留已有配置；若希望将旧默认图标换成新版默认图标，请使用包中的新 `group-colors.json` 替换服务器配置，或按上述示例手动调整。

如果你有意删除该文件来使用原始显示，升级后也应再次删除包内的默认文件。发布包的默认配置与服务器上的个性化配置应分别维护。

# kokkoro-plugin-setu

> hso，我都不看这些的

## 安装

```shell
# 切换至 bot 目录
cd bot

# 安装 npm 包
npm i kokkoro-plugin-setu
```

## 配置项

```typescript
interface SetuOption extends Option {
  /** 单人每日色色次数限制 */
  max_lsp: number;
  /** 开启 R18 */
  r18: boolean;
  /** 自动撤回（0 或以下则不撤回，单位 s） */
  unsend: number;
  /** 图片尺寸 */
  size: 'original' | 'regular' | 'small' | 'thumb' | 'mini';
  /** 图片反和谐 */
  // anti_harmony: boolean;
}
```

## 环境变量

你可以在项目根目录下创建 `.env` 文件

```ini
# Pixiv 代理地址
SETU_PROXY=i.pixiv.re
# 本地图片缓存总数
SETU_COUNT=500
# 补充图片间隔 (ms)
SETU_DELAY=300000
```

因为插件的 Service 是在初始化时创建的，所以如果你修改了相关变量，需要使用 `reload` 指令将其重新挂载才能生效。

## 注意

- 图片来源 p 站，相关版权归 [pixiv](https://www.pixiv.net/) 及画师所属
- 本功能的初衷是为了活跃群内氛围以及增加趣味性而制作，还请看场合节制使用
- 发送的图片请务必遵守所在国家及其地区的 **法律法规**，若因使用不当所造成的后果你要自行承担

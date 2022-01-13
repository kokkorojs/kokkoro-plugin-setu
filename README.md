# kokkoro-plugin-setu

> hso，我都不看这些的

## 安装

``` shell
# 切换至 bot 目录
cd bot

# 安装 npm 包
npm i kokkoro-setu
```

在 [kokkoro](https://github.com/kokkorojs/kokkoro) 成功运行并登录后，发送 `>enable setu` 即可启用插件  
使用 `>setu <key> <value>` 可修改当前群聊的插件参数，例如开启默认发送闪图 `>setu flash true`

## 参数

``` json
"option": {
  // 单人每日色色张数限制（每天 5 点重置，若 bot 有管理员权限直接塞口球）
  "max_lsp": 5,
  // 看场合使用，如果你在国内且非港澳台地区就不要开了，被请喝茶我不负责
  "r18": false,
  // 是否发送闪图
  "flash": false,
  // 图片尺寸，有效值 ["small", "regular", "original"] ，从左到右依次为 "中图"、"大图"、"超大图"
  "size": "regular",
}
```

## 注意

- 图片来源 p 站，相关版权归 [pixiv](https://www.pixiv.net/) 及画师所属
- 本功能的初衷是为了活跃群内氛围以及增加趣味性而制作，还请看场合节制使用
- 发送的图片请务必遵守所在国家及其地区的 **法律法规**，若因使用不当所造成的后果你要自行承担
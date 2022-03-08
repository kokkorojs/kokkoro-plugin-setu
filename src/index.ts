import { GroupMessageEvent } from 'oicq';
import { Extension, Bot, Order, Option, checkOrder, getOption } from 'kokkoro-core';

import random from './random';
import search from './search';
import { cancelSchedule, resetLsp } from './param';

type Size = 'original' | 'regular' | 'small' | 'thumb' | 'mini';

export interface Lolicon {
  // 错误信息
  error: string;
  // 色图数组
  data: Setu[];
}

export interface Setu {
  // 作品 pid
  pid: number;
  // 作品所在页
  p: number;
  // 作者 uid
  uid: number;
  // 作品标题
  title: string;
  // 作者名（入库时，并过滤掉 @ 及其后内容）
  author: string;
  // 是否 R18（在库中的分类，不等同于作品本身的 R18 标识）
  r18: boolean;
  // 原图宽度 px
  width: number;
  // 原图高度 px
  height: number;
  // 作品标签，包含标签的中文翻译（有的话）
  tags: string[];
  // 图片扩展名
  ext: string;
  // 作品上传日期；时间戳，单位为毫秒
  uploadDate: number;
  // 包含了所有指定 size 的图片地址
  urls: { [size in Size]?: string };
}

export interface SetuParam {
  // 0为非 R18，1为 R18，2为混合（在库中的分类，不等同于作品本身的 R18 标识）
  r18?: number;
  // 一次返回的结果数量，范围为1到100；在指定关键字或标签的情况下，结果数量可能会不足指定的数量
  num?: number;
  // 返回指定uid作者的作品，最多20个
  uid?: number[];
  // 返回从标题、作者、标签中按指定关键字模糊匹配的结果，大小写不敏感，性能和准度较差且功能单一，建议使用tag代替
  keyword?: string;
  // 返回匹配指定标签的作品，详见下文
  tag?: string[] | string[][];
  // 返回指定图片规格的地址
  size?: Size[];
  // 设置图片地址所使用的在线反代服务
  proxy?: string;
  // 返回在这个时间及以后上传的作品；时间戳，单位为毫秒
  dateAfter?: number;
  // 返回在这个时间及以前上传的作品；时间戳，单位为毫秒
  dateBefore?: number;
  // 设置为任意真值以禁用对某些缩写 keyword 和 tag 的自动转换
  dsc?: boolean;
}

export interface SetuOption extends Option {
  max_lsp: number,
  r18: boolean,
  flash: boolean,
  unsend: number,
  size: Size[],
}

export default class implements Extension {
  bot: Bot;
  option: SetuOption = {
    lock: false,
    apply: true,
    max_lsp: 5,
    r18: false,
    flash: false,
    unsend: 0,
    size: ['regular', 'original', 'small'],
  }
  orders: Order[] = [
    {
      func: random,
      regular: /^来[点张份][涩瑟色]图$/,
    },
    {
      func: search,
      regular: /^来[点张份].+[涩瑟色]图$/,
    }
  ]

  constructor(bot: Bot) {
    this.bot = bot;
  }

  async onInit() {
    resetLsp();
  }

  onDestroy() {
    cancelSchedule();
  }

  onGroupMessage(event: GroupMessageEvent) {
    const { raw_message, group_id } = event;
    const option = getOption(this.bot.uin, group_id);
    const order = checkOrder(this.orders, raw_message);

    if (option.apply) {
      order && order.func.bind(this.bot)(event, option);
    } else if (order) {
      event.reply('不可以色色！')
    }
  }
}
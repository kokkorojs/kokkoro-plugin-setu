import { Client, GroupMessageEvent } from 'oicq';
import { checkCommand, getOption } from 'kokkoro-core';

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

export interface Params {
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

export interface SetuOption {
  max_lsp: number,
  r18: boolean,
  flash: boolean,
  unsend: number,
  size: Size[],
}

const mission = {
  random, search,
}
const command = {
  random: /^来[点张份][涩瑟色]图$/,
  search: /^来[点张份].+[涩瑟色]图$/,
}
const default_option: SetuOption = {
  max_lsp: 5,
  r18: false,
  flash: false,
  unsend: 0,
  size: ['regular', 'original', 'small'],
}

function listener(event: GroupMessageEvent) {
  const option = getOption(event);
  const order = checkCommand(command, event.raw_message);

  if (option.apply) {
    order && eval(`mission[order].bind(this)(event, option)`);
  } else if (order) {
    event.reply('不可以色色！')
  }
}

function enable(bot: Client) {
  resetLsp();
  bot.on('message.group', listener);
}

function disable(bot: Client) {
  cancelSchedule();
  bot.off('message.group', listener);
}

module.exports = {
  enable, disable, default_option,
}
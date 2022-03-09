import schedule from 'node-schedule';
import { join } from 'path';
import { existsSync } from 'fs';
import { GroupMessageEvent } from 'oicq';
import { readdir, mkdir } from 'fs/promises';
import { section, Bot, Option } from 'kokkoro-core';

import reload from './reload';


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

interface AllSetu {
  r17: string[];
  r18: string[];
}

let lsp_job: schedule.Job;
let lsp_meme: string[];
const meme_path = join(__dirname, '../image');
const all_setu: AllSetu = { r17: [], r18: [] };

// 获取随机 lsp 表情包
function getMeme(): string {
  const meme_index = Math.floor(Math.random() * lsp_meme.length);
  const meme = join(meme_path, lsp_meme[meme_index]);

  return meme;
}

export const lsp = new Map();
// 色图最后补充时间
export let reload_date = 0;
// 补充 cd（默认 5 分钟）
export const reload_delay = 300000;
export const max_setu = 10;
export const reload_num = 20;
export const api = 'https://api.lolicon.app/setu/v2';
export const proxy = 'i.pixiv.re';
export const r17_path = join(__workname, `/data/setu/r17`);
export const r18_path = join(__workname, `/data/setu/r18`);

// 本地图片数据绑定
(async () => {
  try {
    Object.defineProperty(all_setu, 'r17', {
      value: await readdir(r17_path),
      writable: false
    });
    Object.defineProperty(all_setu, 'r18', {
      value: await readdir(r18_path),
      writable: false
    });
    lsp_meme = await readdir(meme_path);
  } catch (error) {
    !existsSync(join(__workname, `/data`)) && await mkdir(join(__workname, `/data`));

    await mkdir(join(__workname, `/data/setu`));
    await mkdir(r17_path);
    await mkdir(r18_path);
  }

  reload();
})();

// 更新 reload_date
export function updateReloadDate(timestamp: number) {
  reload_date = timestamp;
}

// 关小黑屋
export async function smallBlackRoom(this: Bot, event: GroupMessageEvent, max_lsp: Number) {
  const { group_id, user_id } = event;

  // 判断 lsp 要了几张图，超过 max_lsp 张关小黑屋
  !lsp.has(user_id) && lsp.set(user_id, 0);

  if (lsp.get(user_id) >= max_lsp) {
    const meme = getMeme();
    const image = await section.image(meme);

    event.reply(image, true);
    this.setGroupBan(group_id, user_id, 60 * 5);
    return true;
  } else {
    return false;
  }
}

// 每天 5 点重置 lsp
export function resetLsp() {
  lsp_job = schedule.scheduleJob('0 0 5 * * ?', () => lsp.clear());
}

// 销毁定时任务
export function cancelSchedule() {
  lsp_job.cancel();
}

// 获取涩图目录
export function getAllSetu() {
  return all_setu;
}
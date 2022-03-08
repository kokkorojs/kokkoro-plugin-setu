import schedule from 'node-schedule';
import { join } from 'path';
import { existsSync } from 'fs';
import { section, Bot } from 'kokkoro-core';
import { readdir, mkdir } from 'fs/promises';
import { GroupMessageEvent } from 'oicq';

import reload from './reload';

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
export const max_setu = 50;
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
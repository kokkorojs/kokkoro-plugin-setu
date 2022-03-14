import axios from 'axios';
import { join } from 'path';
import { existsSync } from 'fs';
import { GroupMessageEvent } from 'oicq';
import { Bot, logger, section } from 'kokkoro';
import { Job, scheduleJob } from 'node-schedule';
import { readdir, mkdir } from 'fs/promises';

import reload from './reload';
import { AllSetu, Lolicon, LoliconImage, LoliconParam } from './type';

export const proxy = 'i.pixiv.re';
export const api = 'https://api.lolicon.app/setu/v2';
export const lsp = new Map();
export const all_setu: AllSetu = { r17: [], r18: [] };
export const r17_path = join(__workname, `/data/setu/r17`);
export const r18_path = join(__workname, `/data/setu/r18`);

let lsp_job: Job;
let lsp_meme: string[];

const meme_path = join(__dirname, '../image');

// 本地图片数据绑定
(async () => {
  try {
    lsp_meme = await readdir(meme_path);

    const r17_files = await readdir(r17_path);
    const r18_files = await readdir(r18_path);

    all_setu.r17 = r17_files;
    all_setu.r18 = r18_files;
  } catch (error) {
    !existsSync(join(__workname, `/data`)) && await mkdir(join(__workname, `/data`));

    await mkdir(join(__workname, `/data/setu`));
    await mkdir(r17_path);
    await mkdir(r18_path);
  }

  reload();
})();

// 获取涩图
export function getLoliconImages(param: LoliconParam): Promise<LoliconImage[] | Error> {
  return new Promise((resolve, reject) => {
    axios.post(api, param)
      .then((response) => {
        const lolicon: Lolicon = response.data;
        const error = lolicon.error;

        if (!error) {
          const images = lolicon.data;
          resolve(images);
        }

        logger.error(error);
        reject(new Error(error));
      })
      .catch(error => {
        reject(error);
      })
  })
}

// 获取随机 lsp 表情包
function getMeme(): string {
  const meme_index = Math.floor(Math.random() * lsp_meme.length);
  const meme = join(meme_path, lsp_meme[meme_index]);

  return meme;
}

// 每天 5 点重置 lsp
export function resetLsp() {
  lsp_job = scheduleJob('0 0 5 * * ?', () => lsp.clear());
}

// 销毁定时任务
export function cancelSchedule() {
  lsp_job.cancel();
}

// 关小黑屋
export async function smallBlackRoom(this: Bot, event: GroupMessageEvent, max_lsp: Number) {
  const { group_id, sender } = event;
  const { user_id } = sender;

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

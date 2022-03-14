import axios from 'axios';
import { join } from 'path';
import { existsSync } from 'fs';
import { logger } from 'kokkoro';
import { readdir, mkdir } from 'fs/promises';

import reload from './reload';
import { AllSetu, Lolicon, LoliconImage, LoliconParam, SetuType } from './type';

export const proxy = 'i.pixiv.re';
export const api = 'https://api.lolicon.app/setu/v2';
export const r17_path = join(__workname, `/data/setu/r17`);
export const r18_path = join(__workname, `/data/setu/r18`);

const lsp_meme: string[] = [];
const meme_path = join(__dirname, '../image');
const all_setu: AllSetu = { r17: [], r18: [] };

// 初始化数据
(async () => {
  try {
    lsp_meme.push(...await readdir(meme_path));
    all_setu.r17 = await readdir(r17_path);
    all_setu.r18 = await readdir(r18_path);
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
export function getMeme(): string {
  const meme_index = Math.floor(Math.random() * lsp_meme.length);
  const meme = join(meme_path, lsp_meme[meme_index]);

  return meme;
}

// 获取全部涩图
export function getAllSetu() {
  return all_setu;
}

// 获取涩图
export function getSetu(type: SetuType) {
  const setu = all_setu[type].pop();
  return setu;
}

// 添加涩图
export function addSetu(type: SetuType, setu: string) {
  all_setu[type].push(setu);
}

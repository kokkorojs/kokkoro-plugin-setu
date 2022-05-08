import axios from 'axios';
import { join } from 'path';
import { existsSync } from 'fs';
import { readdir, mkdir, writeFile } from 'fs/promises';
import { GroupMessageEvent } from 'oicq';
import { logger, Bot, segment } from 'kokkoro';

import { SetuType, SetuList, Lolicon, LoliconImage, LoliconParam, SetuOption } from './types';

// 代理可以拿去用，省着点就行
export const proxy = 'pixiv.yuki.sh';
export const api = 'https://api.lolicon.app/setu/v2';
export const r17_path = join(__workname, `/data/setu/r17`);
export const r18_path = join(__workname, `/data/setu/r18`);

// 色图最后补充时间
let reload_date = 0;

const max_setu = 50;
const reload_num = 20;
// 补充 cd（默认 5 分钟）
const reload_delay = 300000;
const lsp_meme: string[] = [];
const lsp_list: Map<number, number> = new Map();
const meme_path = join(__dirname, '../image');
const setu_list: SetuList = { r17: [], r18: [] };

// 初始化数据
(async () => {
  try {
    lsp_meme.push(...await readdir(meme_path));
    setu_list.r17 = await readdir(r17_path);
    setu_list.r18 = await readdir(r18_path);
  } catch (error) {
    !existsSync(join(__workname, `/data`)) && await mkdir(join(__workname, `/data`));

    await mkdir(join(__workname, `/data/setu`));
    await mkdir(r17_path);
    await mkdir(r18_path);
  }

  reloadSetu();
})();

// 补充涩图
async function reloadSetu() {
  const all_setu = getSetuList();
  const current_date = +new Date();

  // 节流处理
  if (current_date - reload_date >= reload_delay) {
    for (const type of ['r17', 'r18'] as SetuType[]) {
      const setu_length = all_setu[type].length;

      if (setu_length > max_setu) {
        logger.mark(`${type} 库存充足，不用补充`);
        continue;
      }

      const param: LoliconParam = {
        proxy,
        r18: type === 'r17' ? 0 : 1,
        num: reload_num,
        size: 'regular',
      }
      logger.mark(`${type} 色图正在补充中...`);

      try {
        const images = await getLoliconImages(param) as LoliconImage[];
        const images_length = images.length;

        for (let i = 0; i < images_length; i++) {
          const regex: RegExp = /(\\|\/|:|\*|\?|"|<|>|\|)/g;
          /**
            * 在 windows 下文件名不能包含 \ / : * ? " < > |
            * pid 与 title 之间使用 @ 符分割，title 若出现非法字符则替换为 -
            */
          let { urls: { 'regular': url }, uid, author, pid, title } = images[i];
          title = title.replace(regex, '-');
          author = author.replace(regex, '-');

          const setu_path = type === 'r17' ? r17_path : r18_path;
          const setu_name = `${uid}@${author}@${pid}@${title}`;
          const setu_url = join(setu_path, setu_name);

          axios
            .get(<string>url, { responseType: 'arraybuffer' })
            .then(response => {
              writeFile(setu_url, response.data, 'binary')
                .then(() => {
                  addSetu(type, setu_name);
                  logger.mark(`setu download success, ${pid} ${title}`);
                })
            })
            .catch(error => {
              logger.error(error.message);
            })
        }
      } catch (error) {
        const { message } = error as Error;
        logger.error(message);
      }
    }

    reload_date = current_date;
  }
}

// 关小黑屋
export function smallBlackRoom(bot: Bot, event: GroupMessageEvent, max_lsp: number): boolean {
  const { group_id, sender } = event;
  const { user_id } = sender;

  // 判断 lsp 要了几张图，超过 max_lsp 张关小黑屋
  !lsp_list.has(user_id) && lsp_list.set(user_id, 0);

  if (lsp_list.get(user_id)! >= max_lsp) {
    const meme = getMeme();
    const image = segment.image(meme);

    event.reply(image, true);
    bot.setGroupBan(group_id, user_id, 60 * 5);
    return true;
  } else {
    return false;
  }
}

// 重置 lsp
export function clearLspList() {
  lsp_list.clear();
}

// 获取涩图
export function getLoliconImages(param: LoliconParam): Promise<LoliconImage[]> {
  return new Promise((resolve, reject) => {
    axios.post(api, param)
      .then((response) => {
        const lolicon: Lolicon = response.data;
        const error = lolicon.error;

        if (error) {
          logger.error(error);
          reject(new Error(error));
        }
        resolve(lolicon.data);
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

// 获取涩图列表
export function getSetuList() {
  return setu_list;
}

// 获取涩图
export function getSetu(type: SetuType) {
  const setu = setu_list[type].pop();
  return setu;
}

// 添加涩图
export function addSetu(type: SetuType, setu: string) {
  setu_list[type].push(setu);
}

// 获取随机涩图
export async function getRandomSetu(r18: boolean, flash: boolean) {
  reloadSetu();

  const setu_list = getSetuList();
  const type = `r${+r18 + 17}` as SetuType;

  if (!setu_list[type].length) {
    throw new Error('色图库存不足，请等待自动补充');
  }
  const setu_file = getSetu(type)!;
  const setu_path = type === 'r17' ? r17_path : r18_path;
  const setu_url = join(setu_path, setu_file);
  const [uid, author, pid, title] = setu_file.split('@');
  const image_info = `作者:\n  ${author} (${uid})\n标题:\n  ${title} (${pid})`;

  return {
    image_info, flash, setu_url, setu_file,
  };
}

// 获取在线涩图
export async function getSearchSetu(tags: string[], option: SetuOption) {
  const { r18, flash, size } = option;
  const param: LoliconParam = {
    proxy,
    r18: +r18,
    size: size[0],
    tag: [tags],
  };

  try {
    const images = await getLoliconImages(param);
    const images_length = images.length;

    if (images_length) {
      const { pid, uid, title, author, tags, urls } = images[0];
      const setu_url = urls[size[0]];
      const image_info = `作者:\n  ${author} (${uid})\n标题:\n  ${title} (${pid})\n标签:\n  ${tags}`;

      return { image_info, setu_url, flash };
    } else {
      throw new Error(`不存在 ${tags} 标签`);
    }
  } catch (error) {
    throw error;
  }
}

// 撤回色图
export function unsendSetu(
  bot: Bot,
  send_info: {
    unsend: number;
    user_id: number;
    message_id: string;
  },
) {
  const { unsend, message_id, user_id } = send_info;

  if (unsend > 0) {
    // 撤回色图
    setTimeout(() => {
      bot.deleteMsg(message_id);
    }, unsend * 1000);
  }
  lsp_list.set(user_id, lsp_list.get(user_id)! + 1);
}
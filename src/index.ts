import { join } from 'path';
import { unlink } from 'fs/promises';
import { GroupMessageEvent } from 'oicq';
import { Job, scheduleJob } from 'node-schedule';
import { Extension, Bot, getOrder, getOption, section, logger } from 'kokkoro';

import reload from './reload';
import { SetuType, SetuOption, LoliconParam, LoliconImage } from './type';
import { getAllSetu, getLoliconImages, getMeme, getSetu, proxy, r17_path, r18_path } from './service';

export default class Setu implements Extension {
  bot: Bot;
  lsp_job: Job;
  lsp: Map<number, number> = new Map();
  option: SetuOption = {
    max_lsp: 5,
    r18: false,
    flash: false,
    unsend: 0,
    size: ['regular', 'original', 'small'],
  }
  orders = [
    {
      func: this.randomSetu,
      regular: /^来[点张份][涩瑟色]图$/,
    },
    {
      func: this.searchSetu,
      regular: /^来[点张份].+[涩瑟色]图$/,
    },
  ];

  constructor(bot: Bot) {
    this.bot = bot;
    this.lsp_job = scheduleJob('0 0 5 * * ?', () => this.clearLsp());
  }

  // 关小黑屋
  async smallBlackRoom(event: GroupMessageEvent, max_lsp: Number): Promise<boolean> {
    const { group_id, sender } = event;
    const { user_id } = sender;

    // 判断 lsp 要了几张图，超过 max_lsp 张关小黑屋
    !this.lsp.has(user_id) && this.lsp.set(user_id, 0);

    if (this.lsp.get(user_id)! >= max_lsp) {
      const meme = getMeme();
      const image = await section.image(meme);

      event.reply(image, true);
      this.bot.setGroupBan(group_id, user_id, 60 * 5);
      return true;
    } else {
      return false;
    }
  }

  // 重置 lsp
  clearLsp() {
    this.lsp.clear();
  }

  // 销毁定时任务
  cancelSchedule() {
    this.lsp_job.cancel();
  }

  // 随机涩图
  async randomSetu(event: GroupMessageEvent, option: SetuOption) {
    reload();

    const { sender } = event;
    const { user_id } = sender;
    const { r18, flash, max_lsp } = option;
    const all_setu = getAllSetu();
    const type = `r${+r18 + 17}` as SetuType;
    const isBan = await this.smallBlackRoom(event, max_lsp);

    if (isBan) return;
    if (!all_setu[type].length) return event.reply('色图库存不足，请等待自动补充', true);

    const setu_file = getSetu(type)!;
    const setu_path = type === 'r17' ? r17_path : r18_path;
    const setu_url = join(setu_path, setu_file);
    const image = await section.image(setu_url, flash);
    const [uid, author, pid, title] = setu_file.split('@');

    event.reply(`作者:\n  ${author} (${uid})\n标题:\n  ${title} (${pid})`);
    event.reply(image)
      .then(response => {
        const unsend = option.unsend;

        if (unsend > 0) {
          const { message_id } = response;

          // 撤回色图
          setTimeout(() => {
            this.bot.deleteMsg(message_id);
          }, unsend * 1000);
        }

        this.lsp.set(user_id, this.lsp.get(user_id)! + 1);
        unlink(join(setu_url))
          .then(() => {
            logger.mark(`图片发送成功，已删除 ${setu_file}`);
          })
          .catch(error => {
            throw error;
          })
      })
      .catch(error => {
        event.reply(error.message);
        logger.error(error.message);
      })
  }

  // 搜索涩图
  async searchSetu(event: GroupMessageEvent, option: SetuOption) {
    const { sender, raw_message } = event;
    const { user_id } = sender;
    const { r18, flash, max_lsp, size } = option;
    const isBan = await this.smallBlackRoom(event, max_lsp);

    if (isBan) return;

    const tags = raw_message.slice(2, raw_message.length - 2).split(' ');
    const param: LoliconParam = {
      proxy,
      r18: +r18,
      size: [size[0]],
      tag: [],
    };

    for (const tag of tags) {
      param.tag!.push([tag] as any);
    }

    event.reply('图片下载中，请耐心等待喵~', true);

    try {
      const images = await getLoliconImages(param) as LoliconImage[];
      const images_length = images.length;

      if (images_length) {
        const { pid, uid, title, author, tags, urls } = images[0];
        const image = await section.image(urls[size[0]] as string, flash);

        event.reply(`作者:\n  ${author} (${uid})\n标题:\n  ${title} (${pid})\n标签:\n  ${tags}`);
        event.reply(image)
          .then(response => {
            const { unsend } = option;

            if (unsend > 0) {
              const { message_id } = response;

              // 撤回色图
              setTimeout(() => {
                this.bot.deleteMsg(message_id);
              }, unsend * 1000);
            }
            this.lsp.set(user_id, this.lsp.get(user_id)! + 1);
          })
      } else {
        event.reply(`不存在 ${tags} 标签，将随机发送本地色图`);
        this.randomSetu(event, option);
      }
    } catch (error) {
      const { message } = error as Error;

      event.reply(message);
      this.bot.logger.error(message);
      return;
    }
  }

  onDestroy() {
    this.cancelSchedule();
  }

  onGroupMessage(event: GroupMessageEvent) {
    const raw_message = event.raw_message;
    const option = getOption(event);
    const order = getOrder(this.orders, raw_message);

    if (option.apply) {
      order && order.call(this, event, option);
    } else if (order) {
      event.reply('不可以色色！')
    }
  }
}

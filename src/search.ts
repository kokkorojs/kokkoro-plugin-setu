import axios from 'axios';
import { section, Bot } from 'kokkoro';
import { GroupMessageEvent } from 'oicq';

import random from './random';
import { LoliconImage, LoliconParam, SetuOption } from './type';
import { getLoliconImages, lsp, proxy, smallBlackRoom } from './service';

// 在线搜索涩图
export default async function (this: Bot, event: GroupMessageEvent, option: SetuOption) {
  const { sender, raw_message } = event;
  const { user_id } = sender;
  const { r18, flash, max_lsp, size } = option;
  const isBan = await smallBlackRoom.call(this, event, max_lsp);

  if (isBan) { return; }

  const tags = raw_message.slice(2, raw_message.length - 2).split(' ');
  const param: LoliconParam = {
    proxy,
    r18: Number(r18),
    size: [size[0]],
    tag: [],
  }

  for (const tag of tags) param.tag?.push([tag] as any)

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
              this.deleteMsg(message_id);
            }, unsend * 1000);
          }
          lsp.set(user_id, lsp.get(user_id) + 1);
        })
    } else {
      event.reply(`不存在 ${tags} 标签，将随机发送本地色图`);
      random.call(this, event, option);
    }
  } catch (error) {
    const { message } = error as Error;

    event.reply(message);
    this.logger.error(message);
    return;
  }
}

import axios from 'axios';
import { section } from 'kokkoro-core';
import { Client, GroupMessageEvent } from 'oicq';

import random from './random';
import { Lolicon, Params, SetuOption } from '.';
import { api, lsp, proxy, smallBlackRoom } from './param';

// 在线搜索涩图
export default async function (this: Client, event: GroupMessageEvent, option: SetuOption) {
  const { user_id, raw_message } = event;
  const { r18, flash, max_lsp, size } = option;

  if (await smallBlackRoom.bind(this)(event, max_lsp)) return;

  const tags = raw_message.slice(2, raw_message.length - 2).split(' ');
  const params: Params = {
    proxy,
    r18: Number(r18),
    size: [size[0]],
    tag: [],
  }

  for (const tag of tags) params.tag?.push([tag] as any)

  event.reply('图片下载中，请耐心等待喵~', true);
  axios
    .post(api, params)
    .then(async (response) => {
      const lolicon: Lolicon = response.data;
      const error = lolicon.error;

      if (error) {
        return event.reply(error)
      }

      const setu = lolicon.data;

      if (setu.length) {
        const { pid, uid, title, author, tags, urls } = setu[0];
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
        random.bind(this)(event, option);
      }
    })
    .catch(error => {
      event.reply(error.message);
      this.logger.error(error.message);
    });
}
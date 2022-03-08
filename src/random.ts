import { join } from 'path';
import { unlink } from 'fs/promises';
import { logger, section, Bot } from 'kokkoro-core';
import { GroupMessageEvent } from 'oicq';

import reload from './reload';
import { SetuOption } from '.';
import { getAllSetu, lsp, r17_path, r18_path, smallBlackRoom } from './param';

export default async function (this: Bot, event: GroupMessageEvent, option: SetuOption) {
  reload();

  const all_setu = getAllSetu();
  const { user_id } = event;
  const { r18, flash, max_lsp } = option;

  if (await smallBlackRoom.bind(this)(event, max_lsp)) return;
  if (!eval(`all_setu.r${17 + Number(r18)}`).length) return event.reply('色图库存不足，请等待自动补充', true);

  const setu = eval(`all_setu.r${17 + Number(r18)}`).pop();
  const setu_url = join(`${!r18 ? r17_path : r18_path}/${setu}`);
  const image = await section.image(setu_url, flash);
  const [uid, author, pid, title] = setu.split('@');

  event.reply(`作者:\n  ${author} (${uid})\n标题:\n  ${title} (${pid})`);
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
      unlink(join(setu_url))
        .then(() => {
          logger.mark(`图片发送成功，已删除 ${setu}`);
        })
    })
    .catch(error => {
      event.reply(error.message);
      logger.error(error.message);
    })
}
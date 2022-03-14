import { join } from 'path';
import { unlink } from 'fs/promises';
import { logger, section, Bot } from 'kokkoro';
import { GroupMessageEvent } from 'oicq';

import reload from './reload';
import { ImageType, SetuOption } from './type';
import { all_setu, lsp, r17_path, r18_path, smallBlackRoom } from './service';

export default async function (this: Bot, event: GroupMessageEvent, option: SetuOption) {
  reload();

  const { sender } = event;
  const { user_id } = sender;
  const { r18, flash, max_lsp } = option;
  const type = `r${+r18 + 17}` as ImageType;
  const isBan = await smallBlackRoom.call(this, event, max_lsp);

  if (isBan) { return; }
  if (!all_setu[type].length) { return event.reply('色图库存不足，请等待自动补充', true); }

  const setu_file = all_setu[type].pop()!;
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
          this.deleteMsg(message_id);
        }, unsend * 1000);
      }

      lsp.set(user_id, lsp.get(user_id) + 1);
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

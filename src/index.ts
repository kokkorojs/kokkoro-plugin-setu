import { join } from 'path';
import { Forwardable } from 'oicq';
import { Plugin, Option } from 'kokkoro';
import { createImage } from '@kokkoro/utils';

import { LoliconSize, r17_path, r18_path, SetuService } from './service';

export interface SetuOption extends Option {
  /** 单人每日色色次数限制 */
  max_lsp: number;
  /** 开启 R18 */
  r18: boolean;
  /** 是否发送闪图 */
  flash: boolean;
  /** 自动撤回（0 或以下则不撤回，单位 s） */
  unsend: number;
  /** 图片尺寸 */
  size: LoliconSize[];
  /** 图片反和谐 */
  // anti_harmony: boolean;
}

const option: SetuOption = {
  apply: true,
  lock: false,
  max_lsp: 5,
  r18: false,
  flash: true,
  unsend: 0,
  size: ['regular', 'original', 'small'],
  // anti_harmony: true,
};
const { version } = require('../package.json');
const plugin = new Plugin('setu', option);
const service = new SetuService('pixiv.yuki.sh');

plugin
  .version(version)
  .schedule('0 0 5 * *', service.clearLspMap);

plugin
  .command('random', 'group')
  .description('随机发送本地涩图')
  .sugar(/^来[点张份][涩瑟色]图$/)
  .prevent(ctx => {
    ctx.reply('不可以色色！', true);
  })
  .action(ctx => {
    const { option, bot, sender } = ctx;
    const { r18, flash, unsend } = option as SetuOption;
    const is_ban = service.smallBlackRoom(ctx);

    if (is_ban) {
      return;
    }
    const setuInfo = service.getRandomSetu(r18, flash);
    const { setu_url, image_info, setu_file } = setuInfo;

    ctx.reply(image_info)
      .then(() => createImage(setu_url, flash))
      .then(image => ctx.reply([image]))
      .then((message_ret) => {
        const sendInfo = {
          unsend,
          user_id: sender.user_id,
          message_id: message_ret.message_id,
        };
        service.unsendSetu(bot, sendInfo);
        service.emit('setu.send.success',bot, setu_url, setu_file);
      })
      .catch(error => ctx.reply(error.message))
  });

plugin
  .command('search <...tags>', 'group')
  .description('检索在线涩图')
  .sugar(/^来[点张份](?<tags>.+)[涩瑟色]图$/)
  .prevent(ctx => {
    ctx.reply('不可以色色！', true);
  })
  .action((ctx) => {
    const { option, bot, query, sender } = ctx;
    const { tags } = query;
    const { unsend, flash, r18 } = option as SetuOption;
    const is_ban = service.smallBlackRoom(ctx);

    if (is_ban) {
      return;
    }
    ctx.reply('图片检索中，请耐心等待喵~', true)
      .then(() => service.searchLoliconImage(tags, option as SetuOption))
      .then(async (setu_info) => {
        const { setu_url, image_info } = setu_info;

        await ctx.reply(image_info);
        return createImage(setu_url!, flash);
      })
      .then(image => ctx.reply([image]))
      .then((message_ret) => {
        const sendInfo = {
          unsend,
          user_id: sender.user_id,
          message_id: message_ret.message_id,
        };
        service.unsendSetu(bot, sendInfo);
      })
      .catch(async (error) => {
        const { setu_url, image_info, setu_file } = service.getRandomSetu(r18, flash);

        ctx.reply(`Error: ${error.message}\n将为你随机发送本地色图`)
          .then(() => ctx.reply(image_info))
          .then(() => createImage(setu_url, flash))
          .then(image => ctx.reply([image]))
          .then((message_ret) => {
            const sendInfo = {
              unsend,
              user_id: sender.user_id,
              message_id: message_ret.message_id,
            };
            service.unsendSetu(bot, sendInfo);
            service.emit('setu.send.success',bot, setu_url, setu_file);
          })
          .catch(error => ctx.reply(error.message))
      });
  });

plugin
  .command('multi <number>', 'group')
  .description('获取多张色图')
  .sugar(/^来(?<number>[1-9]\d*)[点张份][涩瑟色]图$/)
  .prevent(ctx => {
    ctx.reply('不可以色色！', true);
  })
  .action(async (ctx) => {
    const { option, query } = ctx;
    const { number } = query;
    const { r18 } = option as SetuOption;
    const is_ban = service.smallBlackRoom(ctx);

    if (is_ban) {
      return;
    }else if(number > 10){
      return ctx.reply(`数量不能大于 10，人别冲死了`);
    }
    // 多张转发不删除本地图片
    const setus = service.getSetus(r18);
    const images = [];

    for (let i = 0; i < number; i++) {
      const ran = Math.floor(Math.random() * setus.length);
      images.push(setus.splice(ran, 1)[0]);
    };
    const forwardMessage: Forwardable[] = [];

    for (let i = 0; i < number; i++) {
      const setu_file = images[i];
      const setu_path = r18 ? r18_path : r17_path;
      const setu_url = join(setu_path, setu_file);
      const [uid, author, pid, title] = setu_file.split('@');
      const image_info = `作者:\n  ${author} (${uid})\n标题:\n  ${title} (${pid})`;
      const image = await createImage(setu_url);
      const message: Forwardable = {
        message: [image_info, '\n', image],
        user_id: ctx.self_id,
        nickname: ctx.bot.nickname,
      };

      forwardMessage.push(message);
    }
    ctx.group
      .makeForwardMsg(forwardMessage)
      .then(xml => ctx.reply(xml))
      .catch(error => ctx.reply(error.message))
  });

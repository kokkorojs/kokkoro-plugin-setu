import { Plugin } from 'kokkoro';
import { unlink } from 'fs/promises';

import { SetuOption } from './types';
import { clearLspList, getRandomSetu, getSearchSetu, smallBlackRoom, unsendSetu } from './service';

const option: SetuOption = {
  apply: true,
  lock: false,
  max_lsp: 5,
  r18: false,
  flash: true,
  unsend: 0,
  size: ['regular', 'original', 'small'],
};
export const plugin = new Plugin('setu', option).version(require('../package.json').version);

plugin.schedule('0 0 5 * * ?', clearLspList);

plugin
  .command('random', 'group')
  .description('随机发送本地涩图')
  .sugar(/^来[点张份][涩瑟色]图$/)
  .prevent(function () {
    this.reply('不可以色色！');
  })
  .action(function () {
    const { r18, flash, max_lsp, unsend } = this.option as SetuOption;
    const isBan = smallBlackRoom(this.bot, this.event, max_lsp);

    if (isBan) {
      return;
    }
    getRandomSetu(r18, flash)
      .then(setu_info => {
        const { setu_url, image_info, setu_file } = setu_info;

        this.reply(image_info);
        this.replyImage(setu_url, flash)
          .then(message_ret => {
            const send_info = {
              unsend,
              user_id: this.event.sender.user_id,
              message_id: message_ret.message_id,
            }
            unsendSetu(this.bot, send_info);
            unlink(setu_url)
              .then(() => {
                this.bot.logger.mark(`图片发送成功，已删除 ${setu_file}`);
              })
              .catch(error => {
                this.bot.logger.error(error.message);
              })
          })
      })
      .catch(error => {
        this.reply(error.message);
      })
  });

plugin
  .command('search <...tags>', 'group')
  .description('检索在线涩图')
  .sugar(/^来[点张份](?<tags>.+)[涩瑟色]图$/)
  .prevent(function () {
    this.reply('不可以色色！');
  })
  .action(function (tags: string[]) {
    const { max_lsp, unsend, flash } = this.option as SetuOption;;
    const isBan = smallBlackRoom(this.bot, this.event, max_lsp);

    if (isBan) {
      return;
    }
    this.reply('图片检索中，请耐心等待喵~', true);

    getSearchSetu(tags, this.option as SetuOption)
      .then(setu_info => {
        const { setu_url, image_info } = setu_info;

        this.reply(image_info);
        return this.replyImage(setu_url, flash);
      })
      .then(message_ret => {
        const send_info = {
          unsend,
          user_id: this.event.sender.user_id,
          message_id: message_ret.message_id,
        }
        unsendSetu(this.bot, send_info);
      })
      .catch(error => {
        this.reply(`${error.message}\n将随机发送本地色图`);
        this.rewrite('来点色图');
      })
  });

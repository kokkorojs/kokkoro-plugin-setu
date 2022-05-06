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
    this.event.reply('不可以色色！');
  })
  .action(function () {
    const { r18, flash, max_lsp, unsend } = this.option as SetuOption;
    const isBan = smallBlackRoom(this.bot, this.event, max_lsp);

    if (isBan) {
      return;
    }
    getRandomSetu(r18, flash)
      .then(setu_info => {
        const { image, image_info, setu_url, setu_file } = setu_info;

        this.event.reply(image_info);
        this.event.reply(image)
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
        this.event.reply(error.message);
      })
  });

plugin
  .command('search <...tags>', 'group')
  .description('随机发送本地涩图')
  .sugar(/^来[点张份](?<tags>.+)[涩瑟色]图$/)
  .prevent(function () {
    this.event.reply('不可以色色！');
  })
  .action(function (tags: string[]) {
    const { max_lsp, unsend } = this.option as SetuOption;;
    const isBan = smallBlackRoom(this.bot, this.event, max_lsp);

    if (isBan) {
      return;
    }
    this.event.reply('图片下载中，请耐心等待喵~', true);

    getSearchSetu(tags, this.option as SetuOption)
      .then(setu_info => {
        const { image, image_info } = setu_info;

        this.event.reply(image_info);
        return this.event.reply(image);
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
        this.event.reply(error.message);
        this.event.raw_message = '来点色图';
        this.bot.emit('message', this.event);
      })
  });

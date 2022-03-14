import { GroupMessageEvent } from 'oicq';
import { Extension, Bot, Order, getOrder, getOption } from 'kokkoro';

import search from './search';
import random from './random';
import { SetuOption } from './type';
import { cancelSchedule, resetLsp } from './service';

export default class implements Extension {
  bot: Bot;
  option: SetuOption = {
    max_lsp: 5,
    r18: false,
    flash: false,
    unsend: 0,
    size: ['regular', 'original', 'small'],
  }
  orders: Order[] = [
    {
      func: random,
      regular: /^来[点张份][涩瑟色]图$/,
    },
    {
      func: search,
      regular: /^来[点张份].+[涩瑟色]图$/,
    },
  ]

  constructor(bot: Bot) {
    this.bot = bot;
  }

  async onInit() {
    resetLsp();
  }

  onDestroy() {
    cancelSchedule();
  }

  onGroupMessage(event: GroupMessageEvent) {
    const raw_message = event.raw_message;
    const option = getOption(event);
    const order = getOrder(this.orders, raw_message);

    if (option.apply) {
      order && order.func.call(this.bot, event, option);
    } else if (order) {
      event.reply('不可以色色！')
    }
  }
}

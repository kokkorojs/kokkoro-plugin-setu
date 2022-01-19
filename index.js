const { join } = require('path');
const { existsSync } = require('fs');
const { writeFile, readdir, mkdir, unlink } = require('fs/promises');
const { logger, checkCommand, section, getOption } = require('kokkoro-core');

const axios = require('axios');
const schedule = require('node-schedule');

// 色图最后补充时间
let reload_date = 0;
// 补充 cd（默认 5 分钟）
const reload_delay = 300000;

const max_setu = 50;
const reload_num = 20;
const lsp = new Map();
const all_setu = { r17: [], r18: [] };
const api = 'https://api.lolicon.app/setu/v2';
const proxy = 'i.pixiv.re';
const r17_path = join(__workname, `/data/images/setu/r17`);
const r18_path = join(__workname, `/data/images/setu/r18`);

let lsp_job;

// 每天 5 点重置 lsp
function resetLsp() {
  lsp_job = schedule.scheduleJob('0 0 5 * * ?', () => lsp.clear());
}

// #region 本地涩图数据绑定
(async () => {
  try {
    Object.defineProperty(all_setu, 'r17', {
      value: await readdir(r17_path),
      writable: false
    });
    Object.defineProperty(all_setu, 'r18', {
      value: await readdir(r18_path),
      writable: false
    });
  } catch (error) {
    !existsSync(join(__workname, `/data/images`)) && await mkdir(join(__workname, `/data/images`));

    await mkdir(join(__workname, `/data/images/setu`));
    await mkdir(r17_path);
    await mkdir(r18_path);
  }

  reload();
})();
// #endregion

// #region 关小黑屋
async function smallBlackRoom(event, max_lsp) {
  const { group_id, user_id } = event;

  // 判断 lsp 要了几张图，超过 max_lsp 张关小黑屋
  !lsp.has(user_id) && lsp.set(user_id, 0);

  if (lsp.get(user_id) >= max_lsp) {
    this.setGroupBan(group_id, user_id, 60 * 5);

    event.reply(await section.image(`${__dirname}/image/kyaru.jpg`), true);
    return true;
  } else {
    return false;
  }
}
// #endregion

// #region 补充色图
function reload() {
  const current_date = +new Date();

  // 节流处理
  if (current_date - reload_date >= reload_delay) {
    for (let i = 0; i <= 1; i++) {
      if (eval(`all_setu.r${17 + i}`).length > max_setu) { logger.mark(`r${17 + i} 库存充足，不用补充`); continue }

      const params = {
        proxy,
        r18: i,
        num: reload_num,
        size: 'regular',
      }

      logger.mark(`r${17 + i} 色图正在补充中...`);
      axios.post(api, params)
        .then(response => {
          const { error } = response;

          if (error) { logger.error(error); return }

          const { data: setu } = response.data;
          const setu_length = setu.length;

          for (let j = 0; j < setu_length; j++) {
            /**
              * 在 windows 下文件名不能包含 \ / : * ? " < > |
              * pid 与 title 之间使用 @ 符分割，title 若出现非法字符则替换为 -
              */
            const { urls: { [params.size]: url }, uid, author, pid, title } = setu[j];
            const setu_name = `${uid}@${author}@${pid}@${title.replace(/(\\|\/|:|\*|\?|"|<|>|\|)/g, '-')}`;
            const setu_url = join(`${!i ? r17_path : r18_path}/${setu_name}`);

            axios.get(url, { responseType: 'arraybuffer' })
              .then(response => {
                writeFile(setu_url, response.data, 'binary')
                  .then(() => {
                    eval(`all_setu.r${17 + i}`).push(setu_name);
                    logger.mark(`setu download success, ${pid} ${title}`);
                  })
              })
              .catch(error => {
                logger.error(error.message);
              })
          }
        })
        .catch(error => {
          logger.error(error.message);
        })
    }

    reload_date = current_date;
  }
}
// #endregion

// #region 发送本地随机涩图
async function random(event, option) {
  reload();

  const { user_id } = event;
  const { r18, flash, max_lsp } = option;

  if (await smallBlackRoom.bind(this)(event, max_lsp)) return;
  if (!eval(`all_setu.r${17 + r18}`).length) { event.reply('色图库存不足，请等待自动补充', true); return; }

  const setu = eval(`all_setu.r${17 + r18}`).pop();
  const image = await section.image(join(`${!r18 ? r17_path : r18_path}/${setu}`), flash);
  const [uid, author, pid, title] = setu.split('@');

  event.reply(`作者:\n  ${author} (${uid})\n标题:\n  ${title} (${pid})`);
  event.reply(image)
    .then(() => {
      lsp.set(user_id, lsp.get(user_id) + 1);

      unlink(join(`${!r18 ? r17_path : r18_path}/${setu}`))
        .then(() => {
          logger.mark(`图片发送成功，已删除 ${setu}`);
        })
        .catch(error => {
          logger.error(error.message);
        })
    });
}
// #endregion

// #region 在线搜索涩图
async function search(event, option) {
  const { user_id, raw_message } = event;
  const { r18, flash, max_lsp, size } = option;

  if (await smallBlackRoom.bind(this)(event, max_lsp)) return;

  const tags = raw_message.slice(2, raw_message.length - 2).split(' ');
  const params = {
    proxy,
    r18: Number(r18),
    size: size[0],
    tag: [],
  }

  for (const tag of tags) params.tag.push([tag])

  event.reply('图片下载中，请耐心等待喵~', true);
  axios.post(api, params)
    .then(async (response) => {
      const { error } = response;

      if (error) {
        return event.reply(error)
      }

      const { data: setu } = response.data;

      if (setu.length) {
        const { pid, uid, title, author, tags, urls } = setu[0];
        const image = await section.image(urls[size[0]], flash);

        event.reply(`作者:\n  ${author} (${uid})\n标题:\n  ${title} (${pid})\n标签:\n  ${tags}`);
        event.reply(image)
          .then(response => {
            const { unsend } = option;

            if (unsend > 0) {
              const { message_id } = response;

              // 撤回色图
              setTimeout(() => {
                this.deleteMsg(message_id)
                  .catch(error => {
                    this.logger.error(error.message);
                  })
              }, unsend * 1000);
            }
            lsp.set(user_id, lsp.get(user_id) + 1);
          })
      } else {
        event.reply(`不存在 ${tags} 标签，将随机发送本地色图`);
        random(event, option);
      }
    })
    .catch(error => {
      event.reply(error.message);
      this.logger.error(error.message);
    });
}
// #endregion

const command = {
  random: /^来[点张份][涩瑟色]图$/,
  search: /^来[点张份].+[涩瑟色]图$/
}

const default_option = {
  max_lsp: 5,
  r18: false,
  flash: false,
  unsend: 10,
  size: ['regular', 'original', 'small'],
}

function listener(event) {
  const option = getOption(event);
  const mission = checkCommand(command, event.raw_message);

  if (option.apply) {
    mission && eval(`${mission}.bind(this)(event, option)`);
  } else if (mission) {
    event.reply('不可以色色！')
  }
}

function enable(bot) {
  resetLsp();
  bot.on('message.group', listener);
}

function disable(bot) {
  lsp_job.cancel();
  bot.off('message.group', listener);
}

module.exports = {
  enable, disable, default_option,
}
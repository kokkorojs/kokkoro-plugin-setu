const { join } = require('path')
const { existsSync } = require('fs');
const { writeFile, readdir, mkdir, unlink } = require('fs/promises');
const { axios, schedule, cwd, logger, checkCommand, sendImage, at } = require('kokkoro');

const max_setu = 50;
const reload_num = 10;
const lsp = new Map();
const all_setu = { r17: [], r18: [] };
const api = 'https://api.lolicon.app/setu/v2';

// 每天 5 点重置 lsp
schedule.scheduleJob('0 0 5 * * ?', () => lsp.clear());

// #region 本地涩图数据绑定
(async () => {
  try {
    Object.defineProperty(all_setu, 'r17', {
      value: await readdir(join(cwd, `/data/images/setu/r17`)),
      writable: false
    });
    Object.defineProperty(all_setu, 'r18', {
      value: await readdir(join(cwd, `/data/images/setu/r18`)),
      writable: false
    });
  } catch (error) {
    !existsSync(join(cwd, `/data/images`)) && await mkdir(join(cwd, `/data/images`));

    await mkdir(join(cwd, `/data/images/setu`));
    await mkdir(join(cwd, `/data/images/setu/r17`));
    await mkdir(join(cwd, `/data/images/setu/r18`));
  }

  reload();
})();
// #endregion

// #region 关小黑屋
async function smallBlackRoom(event, max_lsp) {
  const { group_id, user_id, reply } = event;

  // 判断 lsp 要了几张图，超过 max_lsp 张关小黑屋
  !lsp.has(user_id) && lsp.set(user_id, 0);

  if (lsp.get(user_id) >= max_lsp) {
    this.setGroupBan(group_id, user_id, 60 * 5);

    reply(`${at(user_id)} ${await sendImage(`${__dirname}/image/kyaru.jpg`)}`);
    return true;
  } else {
    return false;
  }
}
// #endregion

// #region 补充色图
function reload() {
  for (let i = 0; i <= 1; i++) {
    if (eval(`all_setu.r${17 + i}`).length > max_setu) { logger.mark(`r${17 + i} 库存充足，不用补充`); continue }

    const params = {
      r18: i,
      num: reload_num,
      size: 'small',
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
            * 文件名不能包含 \ / : * ? " < > |
            * cq 码 url 不能包括 [ ]
            * pid 与 title 之间使用 @ 符分割，title 若出现非法字符则替换为 -
            */
          const { urls: { small: url }, uid, author, pid, title } = setu[j];
          const setu_name = `${uid}@${author}@${pid}@${title.replace(/(\\|\/|:|\*|\?|"|<|>|\||\[|\])/g, '-')}`;
          const setu_url = join(cwd, `/data/images/setu/${!i ? 'r17' : 'r18'}/${setu_name}`);

          axios.get(url, { responseType: 'arraybuffer' })
            .then(response => {
              writeFile(setu_url, response.data, 'binary')
                .then(() => {
                  eval(`all_setu.r${17 + i}`).push(setu_name);
                  logger.mark(`setu download success, ${pid} ${title}`);
                })
                .catch(error => {
                  logger.error(error.message);
                })
            })
            .catch(error => {
              logger.error(error.message);
            })
        }
      });
  }
}
// #endregion

// #region 发送本地随机涩图
async function random(event, setting) {
  reload();

  const { user_id, reply } = event;
  const { r18, flash, max_lsp } = setting;

  if (await smallBlackRoom.bind(this)(event, max_lsp)) return;
  if (!eval(`all_setu.r${17 + r18}`).length) { reply(`${at(user_id)} 色图库存不足，请等待自动补充`); return; }

  const setu = eval(`all_setu.r${17 + r18}`).pop();
  const image = await sendImage(join(cwd, `/data/images/setu/${!r18 ? 'r17' : 'r18'}/${setu}`), flash);
  const [uid, author, pid, title] = setu.split('@');

  const message = `作者: ${author} (${uid})\n标题: ${title} (${pid})\n${image}`;

  reply(message)
    .then(() => {
      lsp.set(user_id, lsp.get(user_id) + 1);

      unlink(join(cwd, `/data/images/setu/${!r18 ? 'r17' : 'r18'}/${setu}`))
        .then(() => {
          logger.mark(`图片发送成功，已删除 ${image}`);
        })
        .catch(error => {
          logger.error(error.message);
        })
    });
}
// #endregion

// #region 在线搜索涩图
async function search(event, setting) {
  const { user_id, raw_message, reply } = event;
  const { r18, flash, max_lsp, size } = setting;

  if (await smallBlackRoom.bind(this)(event, max_lsp)) return;

  const tags = raw_message.slice(2, raw_message.length - 2);
  const params = {
    r18: Number(r18),
    size: size,
    tags: [tags],
  }

  reply(`${at(user_id)} 图片下载中，请耐心等待喵~`);

  axios.post(api, params)
    .then(async (response) => {
      const { error } = response;

      if (error) { reply(error); return }

      const { data: setu } = response.data;
      const { pid, uid, title, author, tags, urls } = setu[0];

      const image = await sendImage(urls[size], flash);
      const message = `作者: ${author} (${uid})\n标题: ${title} (${pid})\n${image}\nTags: ${tags}`;

      reply(message)
        .then(() => {
          lsp.set(user_id, lsp.get(user_id) + 1);
        })
    })
    .catch(error => {
      reply(error);
    });
}
// #endregion

const command = {
  random: /^来[点张份][涩瑟色]图$/,
  search: /^来[点张份][\S]+[涩瑟色]图$/
}

const default_setting = {
  max_lsp: 5,
  r18: false,
  flash: true,
  // 'original', 'regular', 'small', 'thumb', 'mini'
  size: 'small',
}

function listener(event) {
  const dir = join(this.dir, 'config.js');
  const setting = require(dir)[event.group_id].setting;
  const mission = checkCommand(command, event.raw_message);

  setting.switch && eval(`${mission}.bind(this)(event, setting)`);
}

function enable(bot) {
  bot.on('message.group', listener);
}

function disable(bot) {
  bot.off('message.group', listener);
}

module.exports = {
  enable, disable, default_setting
}
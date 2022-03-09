import axios from 'axios';
import { join } from 'path';
import { logger } from 'kokkoro-core';
import { writeFile } from 'fs/promises';

import { api, getAllSetu, Lolicon, max_setu, proxy, r17_path, r18_path, reload_date, reload_delay, reload_num, SetuParam, updateReloadDate } from './param';

// 补充涩图
export default function () {
  const current_date = +new Date();

  // 节流处理
  if (current_date - reload_date >= reload_delay) {
    const all_setu = getAllSetu();

    for (let i = 0; i <= 1; i++) {
      if (eval(`all_setu.r${17 + i}`).length > max_setu) { logger.mark(`r${17 + i} 库存充足，不用补充`); continue }

      const params: SetuParam = {
        proxy,
        r18: i,
        num: reload_num,
        size: ['regular'],
      }

      logger.mark(`r${17 + i} 色图正在补充中...`);
      axios.post(api, params)
        .then(response => {
          const lolicon: Lolicon = response.data;
          const error = lolicon.error;

          if (error) { logger.error(error); return }

          const setu = lolicon.data;
          const setu_length = setu.length;

          for (let j = 0; j < setu_length; j++) {
            const regex: RegExp = /(\\|\/|:|\*|\?|"|<|>|\|)/g;
            /**
              * 在 windows 下文件名不能包含 \ / : * ? " < > |
              * pid 与 title 之间使用 @ 符分割，title 若出现非法字符则替换为 -
              */
            let { urls: { 'regular': url }, uid, author, pid, title } = setu[j];
            title = title.replace(regex, '-');
            author = author.replace(regex, '-');

            const setu_name = `${uid}@${author}@${pid}@${title}`;
            const setu_url = join(`${!i ? r17_path : r18_path}/${setu_name}`);

            axios
              .get(<string>url, { responseType: 'arraybuffer' })
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

    updateReloadDate(current_date);
  }
}
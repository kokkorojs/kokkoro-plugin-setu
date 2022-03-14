import axios from 'axios';
import { join } from 'path';
import { logger } from 'kokkoro';
import { writeFile } from 'fs/promises';

import { ImageType, LoliconImage, LoliconParam } from './type';
import { all_setu, getLoliconImages, proxy, r17_path, r18_path } from './service';

let reload_date = 0; // 色图最后补充时间

const max_setu = 10;
const reload_num = 20;
const reload_delay = 300000; // 补充 cd（默认 5 分钟）


// 补充涩图
export default async function () {
  const current_date = +new Date();

  // 节流处理
  if (current_date - reload_date >= reload_delay) {
    for (const type of ['r17', 'r18'] as ImageType[]) {
      const setu_length = all_setu[type].length;

      if (setu_length > max_setu) {
        logger.mark(`${type} 库存充足，不用补充`);
        continue;
      }

      const param: LoliconParam = {
        proxy,
        r18: type === 'r17' ? 0 : 1,
        num: reload_num,
        size: ['regular'],
      }
      logger.mark(`${type} 色图正在补充中...`);

      try {
        const images = await getLoliconImages(param) as LoliconImage[];
        const images_length = images.length;

        for (let i = 0; i < images_length; i++) {
          const regex: RegExp = /(\\|\/|:|\*|\?|"|<|>|\|)/g;
          /**
            * 在 windows 下文件名不能包含 \ / : * ? " < > |
            * pid 与 title 之间使用 @ 符分割，title 若出现非法字符则替换为 -
            */
          let { urls: { 'regular': url }, uid, author, pid, title } = images[i];
          title = title.replace(regex, '-');
          author = author.replace(regex, '-');

          const setu_path = type === 'r17' ? r17_path : r18_path;
          const setu_name = `${uid}@${author}@${pid}@${title}`;
          const setu_url = join(setu_path, setu_name);

          axios
            .get(<string>url, { responseType: 'arraybuffer' })
            .then(response => {
              writeFile(setu_url, response.data, 'binary')
                .then(() => {
                  all_setu[type].push(setu_name);
                  logger.mark(`setu download success, ${pid} ${title}`);
                })
            })
            .catch(error => {
              logger.error(error.message);
            })
        }
      } catch (error) {
        const { message } = error as Error;
        logger.error(message);
      }
    }

    reload_date = current_date;
  }
}

import axios from 'axios';
import { join } from 'path';
import { EventEmitter } from 'events';
import { Bot, Context, Logger, segment } from 'kokkoro';
import { existsSync } from 'fs';
import { readdir, mkdir, writeFile, unlink } from 'fs/promises';

import { SetuOption } from '.';
import { throttle } from '@kokkoro/utils';

export type LoliconSize = 'original' | 'regular' | 'small' | 'thumb' | 'mini';

interface LoliconResult {
  /** 错误信息 */
  error: string;
  /** 色图数组 */
  data: LoliconImage[];
}

interface LoliconImage {
  /** 作品 pid */
  pid: number;
  /** 作品所在页 */
  p: number;
  /** 作者 uid */
  uid: number;
  /** 作品标题 */
  title: string;
  /** 作者名（入库时，并过滤掉 @ 及其后内容） */
  author: string;
  /** 是否 R18（在库中的分类，不等同于作品本身的 R18 标识） */
  r18: boolean;
  /** 原图宽度 px */
  width: number;
  /** 原图高度 px */
  height: number;
  /** 作品标签，包含标签的中文翻译（有的话） */
  tags: string[];
  /** 图片扩展名 */
  ext: string;
  /** 作品上传日期；时间戳，单位为毫秒 */
  uploadDate: number;
  /** 包含了所有指定 size 的图片地址 */
  urls: { [size in LoliconSize]?: string };
}

interface LoliconParam {
  // 0为非 R18，1为 R18，2为混合（在库中的分类，不等同于作品本身的 R18 标识）
  r18?: 0 | 1 | 2;
  // 一次返回的结果数量，范围为1到100；在指定关键字或标签的情况下，结果数量可能会不足指定的数量
  num?: number;
  // 返回指定uid作者的作品，最多20个
  uid?: number[];
  // 返回从标题、作者、标签中按指定关键字模糊匹配的结果，大小写不敏感，性能和准度较差且功能单一，建议使用tag代替
  keyword?: string;
  // 返回匹配指定标签的作品，详见下文
  tag?: string[] | string[][];
  // 返回指定图片规格的地址
  size?: LoliconSize[];
  // 设置图片地址所使用的在线反代服务
  proxy?: string;
  // 返回在这个时间及以后上传的作品；时间戳，单位为毫秒
  dateAfter?: number;
  // 返回在这个时间及以前上传的作品；时间戳，单位为毫秒
  dateBefore?: number;
  // 设置为任意真值以禁用对某些缩写 keyword 和 tag 的自动转换
  dsc?: boolean;
}

interface UnsendInfo {
  /** 撤回时间 */
  unsend: number;
  /** 用户 id */
  user_id: number;
  /** 消息 id */
  message_id: string;
}

const images_path = join(__dirname, '../images');
export const r17_path = join(__workname, `/data/setu/r17`);
export const r18_path = join(__workname, `/data/setu/r18`);

export class SetuService extends EventEmitter {
  /** API */
  api: string;
  /** 本地最大缓存图片数 */
  max_setu: number;
  /** 单次补充图片数 */
  reload_num: number;
  /** 补充图片 cd */
  reload_delay: number;
  /** 表情包 */
  memes: string[];
  lspMap: Map<number, number>;
  imageList: {
    r17: string[];
    r18: string[];
  };
  reload: () => void;

  constructor(
    /** 日志 */
    private logger: Logger,
    /** 代理地址 */
    private proxy: string = 'i.pixiv.re',
  ) {
    super();

    this.api = 'https://api.lolicon.app/setu/v2';
    this.max_setu = Number(process.env.SETU_COUNT ?? 500);
    this.reload_num = 20;
    this.reload_delay = Number(process.env.SETU_DELAY ?? 300000);
    this.memes = [];
    this.lspMap = new Map();
    this.imageList = { r17: [], r18: [] };

    this.init();
    this.reload = this.reloadSetu();
    this.on('setu.send.success', (bot, url, file) => {
      unlink(url)
        .then(() => {
          this.logger.mark(`图片发送成功，已删除 ${file}`);
        })
        .catch((error) => {
          this.logger.error(error.message);
        });
    });
  }

  private async init() {
    try {
      this.memes.push(...(await readdir(images_path)));
      this.imageList.r17 = await readdir(r17_path);
      this.imageList.r18 = await readdir(r18_path);
    } catch (error) {
      !existsSync(join(__workname, `/data`)) && (await mkdir(join(__workname, `/data`)));

      await mkdir(join(__workname, `/data/setu`));
      await mkdir(r17_path);
      await mkdir(r18_path);
    }

    this.reload();
  }

  /**
   * 补充色图
   */
  private reloadSetu() {
    return throttle(async () => {
      for (let i = 0; i < 2; i++) {
        const type = !i ? 'r17' : 'r18';
        const list_length = this.imageList[type].length;

        if (list_length > this.max_setu) {
          this.logger.mark(`${type} 库存充足，不用补充`);
          continue;
        }

        const param: LoliconParam = {
          proxy: this.proxy,
          r18: <0 | 1>i,
          num: this.reload_num,
          size: ['regular'],
        };
        this.logger.mark(`${type} 色图正在补充中...`);

        try {
          const images = await this.getLoliconImages(param);
          const images_length = images.length;
          const taskQueue = [];

          for (let i = 0; i < images_length; i++) {
            const image = images[i];
            // 在 windows 下文件名不能包含 \ / : * ? " < > |
            const regex: RegExp = /(\\|\/|:|\*|\?|"|<|>|\|)/g;

            let { urls, uid, author, pid, title } = image;
            let { regular: url } = urls;

            // 若出现非法字符则替换为 ⃺
            title = title.replace(regex, '⃺');
            author = author.replace(regex, '⃺');

            const setu_path = type === 'r17' ? r17_path : r18_path;
            // pid 与 title 之间使用 @ 符分割
            const setu_name = `${uid}@${author}@${pid}@${title}`;
            const setu_url = join(setu_path, setu_name);

            taskQueue.push(
              axios
                .get(<string>url, { responseType: 'arraybuffer' })
                .then((response) => writeFile(setu_url, response.data, 'binary'))
                .then(() => {
                  this.imageList[type].push(setu_name);
                  this.logger.debug(`setu write success, ${pid} ${title}`);
                })
                .catch((error) => {
                  this.logger.error(`setu write error, ${error.message}`);
                })
            );
          }
          await Promise.allSettled(taskQueue);
          this.logger.mark(`${type} 色图补充完毕`);
        } catch (error) {
          this.logger.error(`获取 ${type} 色图失败，${(<Error>error).message}`);
        }
      }
    }, this.reload_delay);
  }

  /**
   * 小黑屋
   *
   * @param ctx - 消息上下文
   * @returns 是否将 lsp 关进小黑屋
   */
  public smallBlackRoom(ctx: Context<'message.group'>): boolean {
    const { bot, group_id, sender, option } = ctx;
    const { user_id } = sender;
    const { max_lsp } = option!;

    // 判断 lsp 要了几张图，超过 max_lsp 张关小黑屋
    !this.lspMap.has(user_id) && this.lspMap.set(user_id, 0);

    if (this.lspMap.get(user_id)! >= max_lsp) {
      const meme = this.getNotEroMeme();
      const image = segment.image(meme);

      ctx.reply(image, true);
      bot.setGroupBan(group_id, user_id, 60 * 5);
      return true;
    } else {
      return false;
    }
  }

  public clearLspMap() {
    this.lspMap.clear();
  }

  /**
   * 获取涩图
   *
   * @param param Lolicon 参数
   * @returns
   */
  public async getLoliconImages(param: LoliconParam): Promise<LoliconImage[]> {
    try {
      const { data } = await axios.post(this.api, param);
      const { error } = data as LoliconResult;

      if (error) {
        this.logger.error(error);
        throw new Error(error);
      }
      return data.data;
    } catch (error) {
      throw error;
    }
  }

  /** 获取不可以色色表情包 */
  private getNotEroMeme(): string {
    const index = Math.floor(Math.random() * this.memes.length);
    const meme = join(images_path, this.memes[index]);

    return meme;
  }

  /**
   * 获取随机涩图
   *
   * @param r18 - 是否 r18
   * @returns 色图信息
   */
  public getRandomSetu(r18: boolean) {
    this.reload();

    const setus = this.getSetus(r18);
    const setus_length = setus.length;

    if (!setus_length) {
      throw new Error('色图库存不足，请等待自动补充');
    }
    const setu_file = setus.pop()!;
    const setu_url = join(r18 ? r18_path : r17_path, setu_file);
    const [uid, author, pid, title] = setu_file.split('@');
    const image_info = `作者:\n  ${author} (${uid})\n标题:\n  ${title} (${pid})`;

    return {
      image_info,
      setu_url,
      setu_file,
    };
  }

  /**
   * 获取在线涩图
   *
   * @param tags - 图片 tag
   * @param option - 群插件配置
   * @returns
   */
  public async searchLoliconImage(tags: string[], option: SetuOption) {
    const { r18, flash, size } = option;

    const param: LoliconParam = {
      proxy: this.proxy,
      r18: <0 | 1>+r18,
      size,
      tag: [tags],
    };

    try {
      const images = await this.getLoliconImages(param);
      const images_length = images.length;

      if (images_length) {
        const { pid, uid, title, author, tags, urls } = images[0];
        const setu_url = urls[<'mini'>size[0]];
        const image_info = `作者:\n  ${author} (${uid})\n标题:\n  ${title} (${pid})\n标签:\n  ${tags
          .map((tag) => `[${tag}]`)
          .join(' ')}`;

        return { image_info, setu_url, flash };
      } else {
        throw new Error(`不存在 ${tags} 标签`);
      }
    } catch (error) {
      throw error;
    }
  }

  /**
   * 消息撤回
   *
   * @param bot - bot 实例
   * @param info - 撤回信息
   */
  public unsendSetu(bot: Bot, info: UnsendInfo) {
    const { unsend, message_id, user_id } = info;

    if (unsend > 0) {
      // 撤回色图
      setTimeout(() => {
        bot.deleteMsg(message_id);
      }, unsend * 1000);
    }
    this.lspMap.set(user_id, this.lspMap.get(user_id)! + 1);
  }

  /**
   * 获取本地涩图列表
   *
   * @param r18 - 是否获取 r18
   * @returns 图片字符串数组
   */
  public getSetus(r18: boolean) {
    return this.imageList[r18 ? 'r18' : 'r17'];
  }
}

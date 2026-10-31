import { load as parseHTML } from 'cheerio';
import { fetchApi } from '@libs/fetch';
import { Plugin } from '@/types/plugin';
import { Filters } from '@libs/filterInputs';
import { defaultCover } from '@libs/defaultCover';
import { NovelStatus } from '@libs/novelStatus';

const NOVEL_URL =
  'https://mugexnovels.com/novels/magic-academys-genius-blinker';

class MugexPlugin implements Plugin.PluginBase {
  id = 'mugex';
  name = 'MUGEX';
  icon = 'src/en/mugex/icon.png';
  site = 'https://mugexnovels.com';
  version = '0.1.0';

  filters = {} satisfies Filters;

  private async getPage(url: string): Promise<string> {
    const response = await fetchApi(url);
    if (!response.ok) {
      throw new Error(`MUGEX request failed: HTTP ${response.status}`);
    }
    return response.text();
  }

  async popularNovels(page: number): Promise<Plugin.NovelItem[]> {
    if (page > 1) return [];
    return [{
      name: 'Magic Academy’s Genius Blinker',
      cover: defaultCover,
      path: NOVEL_URL,
    }];
  }

  async searchNovels(searchTerm: string, page: number): Promise<Plugin.NovelItem[]> {
    if (page > 1) return [];
    const q = searchTerm.toLowerCase().trim();
    if (!q || 'magic academy genius blinker'.includes(q) ||
        q.includes('magic academy') || q.includes('genius blinker')) {
      return this.popularNovels(1);
    }
    return [];
  }

  async parseNovel(novelPath: string): Promise<Plugin.SourceNovel> {
    const url = /^https?:\/\//i.test(novelPath) ? novelPath : NOVEL_URL;
    const html = await this.getPage(url);
    const $ = parseHTML(html);

    const name = $('h1').first().text().trim() ||
      $('meta[property="og:title"]').attr('content') ||
      'Magic Academy’s Genius Blinker';
    const cover = $('meta[property="og:image"]').attr('content') ||
      $('img[alt*="Magic Academy"]').first().attr('src') || defaultCover;
    const authorLine = $('body').text().match(/By\s+([^\n]+)/);
    const summary = $('meta[name="description"]').attr('content') ||
      $('meta[property="og:description"]').attr('content') || '';

    const chapters: Plugin.ChapterItem[] = [];
    const seen = new Set<string>();
    $('a[href]').each((_, element) => {
      const href = $(element).attr('href') || '';
      const label = $(element).text().replace(/\s+/g, ' ').trim();
      const match = href.match(/chapter-(\d+)\.htm(?:$|[?#])/i);
      if (!match || !label) return;
      const absoluteUrl = new URL(href, this.site).toString();
      if (seen.has(absoluteUrl)) return;
      seen.add(absoluteUrl);
      chapters.push({
        name: label,
        path: absoluteUrl,
        chapterNumber: Number(match[1]),
      });
    });
    chapters.sort((a, b) => (a.chapterNumber || 0) - (b.chapterNumber || 0));

    if (!chapters.length) {
      throw new Error('MUGEX did not return chapter links. Try opening the series page in a browser.');
    }
    return {
      path: url,
      name,
      cover,
      author: authorLine?.[1]?.trim(),
      summary,
      status: NovelStatus.Completed,
      chapters,
    };
  }

  async parseChapter(chapterPath: string): Promise<string> {
    const safeUrl = /^https:\/\/mugexnovels\.com\//i.test(chapterPath)
      ? chapterPath
      : NOVEL_URL;
    return `<div>
      <h2>MUGEX chapter</h2>
      <p>MUGEX requires this chapter to be read in its own website reader.
      This source does not bypass its Content Shield or copy chapter text.</p>
      <p><a href="${safeUrl}">Open this chapter on the official MUGEX website</a></p>
    </div>`;
  }

  resolveUrl = (path: string) =>
    /^https?:\/\//i.test(path)
      ? path
      : new URL(path.replace(/^\/+/, ''), this.site + '/').toString();
}

export default new MugexPlugin();
// Trigger plugin publishing workflow.


import type { TT$ } from '@upradata/util';
import type puppeteer from 'puppeteer';


export type Page = puppeteer.Page & {
    goto(url: string, options?: puppeteer.WaitForOptions & { referer?: string; retry?: number; }): Promise<puppeteer.HTTPResponse>;
};

declare module 'puppeteer' {

    export type CreateHtmlListIteratorOptions = {
        list: () => TT$<puppeteer.ElementHandle<Element>[]>;
        waitAjax?: boolean;
        ajaxResponseUrl?: string;
        page?: Page;
        waitNewItemsTimeout?: number;
        polling?: number;
    };

    //  type GoToParameters = Parameters<Page[ 'goto' ]>;

    export interface Page {
        goto(url: string, options?: puppeteer.WaitForOptions & { referer?: string; retry?: number; }): Promise<puppeteer.HTTPResponse>;

        createHtmlListIterator(options: CreateHtmlListIteratorOptions): Promise<(start?: number) => AsyncGenerator<{
            item: puppeteer.ElementHandle<Element>;
            i: number;
        }>>;
    }
}

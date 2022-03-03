
import puppeteer from 'puppeteer';


export type Page = puppeteer.Page & {
    goto(url: string, options?: puppeteer.WaitForOptions & { referer?: string; retry?: number; }): Promise<puppeteer.HTTPResponse>;
};

declare module 'puppeteer' {
    type GoToParameters = Parameters<Page[ 'goto' ]>;

    export interface Page {
        goto(url: string, options?: puppeteer.WaitForOptions & { referer?: string; retry?: number; }): Promise<puppeteer.HTTPResponse>;
    }
}

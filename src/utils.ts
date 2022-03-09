import type Puppeteer from 'puppeteer';
import { delayedPromise } from '@upradata/util';
import type { Page } from './page';



export async function createHtmlListIterator(options: Puppeteer.CreateHtmlListIteratorOptions) {
    const { list: getList, waitAjax, ajaxResponseUrl, waitNewItemsTimeout = 1000, polling = 16, page = this as Page } = options;


    const waitAjaxResponse = async (currentNbItems: number) => {
        if (!page)
            throw new Error(`page must be specified when waiting for ajax response`);

        try {
            await page.bringToFront();
            await page.waitForResponse(response => {
                const isGoodUrl = ajaxResponseUrl ? response.url().includes(ajaxResponseUrl) : true;
                return isGoodUrl && response.headers()[ 'content-type' ] === 'application/json' && response.status() === 200;
            }, { timeout: waitNewItemsTimeout });

            return { isNewItems: true };

        } catch (_e) {
            return waitNewItemsPooling(currentNbItems);
        }

    };


    const waitNewItemsPooling = async (currentNbItems: number) => {
        const { promise, resolve, reject } = delayedPromise<void>();

        const start = performance.now();

        const id = setInterval(async () => {
            const newItems = await getList();

            if (newItems.length > currentNbItems) {
                clearInterval(id);
                return resolve();
            }

            if (performance.now() - start > waitNewItemsTimeout) {
                clearInterval(id);
                return reject();
            }
        }, polling);

        try {
            await promise;
            return { isNewItems: true };
        } catch (e) {
            return { isNewItems: false };
        }
    };

    const getItems = async (start: number) => {
        const items = await getList();

        const done = (items?: Puppeteer.ElementHandle<Element>[] | undefined) => {
            const list = items?.slice(start);

            return {
                items: list,
                count: list?.length ?? 0
            };
        };

        if (start > items.length - 1) {
            await items.at(-1).evaluate(el => el.scrollIntoView(true));

            const { isNewItems } = waitAjax ? await waitAjaxResponse(items.length) : await waitNewItemsPooling(items.length);

            if (!isNewItems)
                return done();

            const newItems = await getList();

            if (newItems.length === items.length)
                return done();

            return done(newItems);
        }

        return done(items);
    };


    const next = async function* (start: number = 0): AsyncGenerator<{ item: Puppeteer.ElementHandle<Element>; i: number; }> {

        const { items, count } = await getItems(start);

        if (count === 0)
            return;

        for (let i = 0; i < items.length; ++i)
            yield { item: items[ i ], i: start + i };

        yield* next(start + count + 1);
    };

    return next;
}

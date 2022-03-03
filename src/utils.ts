import Puppeteer from 'puppeteer';
import { TT$ } from '@upradata/util';


export const createHtmlListIterator = async (options: { list: () => TT$<Puppeteer.ElementHandle<Element>[]>; }) => {
    const { list: getList } = options;

    const getItems = async (start: number) => {
        const items = await getList();

        const done = (items?: Puppeteer.ElementHandle<Element>[] | undefined) => {
            const list = items?.slice(start);

            return {
                items: list,
                count: list ? list.length - 1 - start : 0
            };
        };

        if (start > items.length - 1) {
            await items.at(-1).evaluate(el => el.scrollIntoView(true));
            const newItems = await getList();

            if (newItems.length === items.length)
                return done();

            return done(newItems);
        }

        return done(items);
    };


    const next = async function* (i: number = 0): AsyncGenerator<Puppeteer.ElementHandle<Element>> {

        const { items, count } = await getItems(i);

        if (count === 0)
            return;

        for (const item of items)
            yield item;

        yield* next(i + count);
    };


    return next;
};

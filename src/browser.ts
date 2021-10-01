import path from 'path';
import puppeteer from 'puppeteer';
import { assignRecursive } from '@upradata/util';
import { lookupRoot } from '@upradata/node-util';

export type LaunchOptions = Parameters<typeof puppeteer.launch>[ 0 ];
export type GoToOptions = Parameters<puppeteer.Page[ 'goto' ]>[ 1 ] & { retry?: number; };



export class Browser {
    instance: puppeteer.Browser;
    defaultViewPort: puppeteer.Viewport;


    constructor(public options: LaunchOptions = {}) { }

    async init() {
        const options = assignRecursive({
            // args: [`--window-size=1920,1080`],
            // There is an option to save user data using the userDataDir option when launching puppeteer. This stores the session and other things related to launching chrome.
            userDataDir: path.join(await lookupRoot.async(__dirname) || '', '.puppetter/user_data'),
            defaultViewport: {
                width: 1920,
                height: 1080,
                // deviceScaleFactor: 1 => for high dpi
                deviceScaleFactor: 1
            },
            headless: false,
            ignoreHTTPSErrors: true,
            timeout: 1000
        }, this.options);

        this.defaultViewPort = options.defaultViewport;

        this.instance = await puppeteer.launch(options);

    }


    async newPage(options: { viewport?: puppeteer.Viewport; defaultTimeout?: number; } = {}) {
        const page = await this.instance.newPage();

        page.on('console', consoleObj => console.log(consoleObj.text()));

        await page.setRequestInterception(true);
        page.on('request', request => {
            /* if (request.resourceType() === 'script') {
                request.abort();
            } else {
                request.continue();
            } */
            // console.log(`Request resource type: "${request.resourceType()}"`);
            request.continue();
        });

        page.setViewport(options.viewport || this.defaultViewPort);
        // await page.setUserAgent(randomUseragent.getRandom());

        page.setDefaultTimeout(options.defaultTimeout || 20000); // timeout for waitFor function (default === 30000)

        this.augmentPage(page);

        return page;
    }

    private augmentPage(page: puppeteer.Page) {

        const oldGoTo = page.goto;

        const goToReply = (url: string, options?: GoToOptions, nbRetried: number = 1) => {
            const { retry = 1 } = options || {};

            return oldGoTo.call(this, url, options).catch((e: unknown) => {
                if (e instanceof Error && nbRetried < retry) // TimeoutError
                    return goToReply(url, options, nbRetried + 1);

                return Promise.reject(e);
            });
        };

        page.goto = (url: string, options?: GoToOptions) => goToReply.call(this, url, options);
    }
}

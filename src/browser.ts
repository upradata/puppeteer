import path from 'path';
import { promisify } from 'util';
import puppeteer from 'puppeteer';
import { assignRecursive, bind, ifThen, ValueOf } from '@upradata/util';
import { lookupRoot, red } from '@upradata/node-util';
import type { WebpackCompileOptions, WebpackOutputAsset } from '@upradata/webpack';
export * as Puppeteer from 'puppeteer';


export type LaunchOptions = Parameters<typeof puppeteer.launch>[ 0 ];
export type GoToOptions = Parameters<puppeteer.Page[ 'goto' ]>[ 1 ] & { retry?: number; };

export type WaitOptions = puppeteer.WaitForOptions & { referer?: string; };

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


    async newPage(options: { url?: string; wait?: WaitOptions; viewport?: puppeteer.Viewport; defaultTimeout?: number; } = {}) {
        const { url, wait = { waitUntil: 'load' }, viewport = this.defaultViewPort, defaultTimeout = 20000 } = options;

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

        page.setViewport(viewport);
        // await page.setUserAgent(randomUseragent.getRandom());

        page.setDefaultTimeout(defaultTimeout); // timeout for waitFor function (default === 30000)

        this.augmentPage(page);

        if (url)
            await page.goto(url, wait);

        return page;
    }

    private augmentPage(page: puppeteer.Page) {

        const oldGoTo = page.goto;

        const goToReply = (url: string, options?: GoToOptions, nbRetried: number = 1) => {
            const { retry = 1 } = options || {};

            return oldGoTo.call(page, url, options).catch((e: unknown) => {
                if (e instanceof Error && nbRetried < retry) // TimeoutError
                    return goToReply(url, options, nbRetried + 1);

                return Promise.reject(e);
            });
        };

        page.goto = (url: string, options?: GoToOptions) => goToReply(url, options);
    }

    public async compileModules(options: PuppeteerWebpackCompileOptions): Promise<Array<WebpackOutputAsset & { content: string; }>> {
        const { filesystems: filesystemsOption, outputInclude = /\..?js$/, ...webpackCompileOptions } = options;

        const { webpackCompile } = await import('@upradata/webpack');

        const getFileSystem = <FsType extends keyof WebpackFileSystems>(fsType: FsType): Promise<WebpackFileSystems[ FsType ]> => {
            return ifThen(filesystemsOption[ fsType ] as PuppeteerWebpackFileSystems[ FsType ])
                .next(fs => ({ if: fs === 'memfs', then: { callable: async () => (await import('memfs')).default } }))
                .next(fs => ({ if: fs === 'fs', then: { callable: async () => (await import('fs')).default } }))
                .next(fs => ({
                    if: typeof fs === 'object',
                    then: Promise.resolve(fs),
                    else: { callable: async () => (await import('fs')).default }
                })).value as Promise<WebpackFileSystems[ FsType ]>;
        };

        const { files, filesystems } = await webpackCompile({
            output: {
                path: '/',
                filename: `[name].bundle.js`
            },
            mode: 'development',
            filesystems: filesystemsOption ? {
                input: await getFileSystem('input'),
                intermediate: await getFileSystem('intermediate'),
                output: await getFileSystem('output')
            } : {},
            ...webpackCompileOptions
        });

        const inputFS = filesystems.input;
        const readFile = async (filepath: string) => (await promisify(bind(inputFS.readFile, inputFS))(filepath/* , { encoding: 'utf8' } */)).toString();

        const outputFilter = typeof outputInclude === 'function' ? outputInclude : (file: string) => outputInclude.test(file);

        return Promise.allSettled(
            files.filter(f => outputFilter(f.filepath)).map(async f => ({ ...f, content: await readFile(f.filepath) }))
        ).then(results => {
            for (const result of results.filter(r => r.status === 'rejected') as PromiseRejectedResult[]) {
                console.error(red`Error occured while trying to add webpack output to puppeteer page`);
                console.error(result.reason);
            }

            type Success = PromiseFulfilledResult<WebpackOutputAsset & { content: string; }>;
            return (results.filter(r => r.status === 'fulfilled') as any as Array<Success>).map(v => v.value);
        });
    }

    public async addJsModuleToPage(page: puppeteer.Page, options: PuppeteerWebpackCompileOptions) {
        const files = await this.compileModules(options);
        await Promise.all(files.map(async f => page.addScriptTag({ content: f.content })));

        return this;
    }
}


type WebpackFileSystems = WebpackCompileOptions[ 'filesystems' ];


export type PuppeteerWebpackFileSystems = {
    [ K in keyof WebpackFileSystems ]: WebpackFileSystems[ K ] | 'memfs' | 'fs'
};

export type PuppeteerWebpackCompileOptions = Omit<WebpackCompileOptions, 'filesystems'> & {
    filesystems?: PuppeteerWebpackFileSystems;
    outputInclude?: ((file: string) => boolean) | RegExp;
};

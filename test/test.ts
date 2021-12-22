
import path from 'path';
import { Browser } from '../src';


async function run() {
    const browser = new Browser();
    await browser.init();

    const page = await browser.newPage({ url: 'https://www.google.com/', wait: { waitUntil: 'load' } });

    await browser.addJsModuleToPage(page, {
        context: path.join(__dirname, '..'),
        entry: {
            src: './test/src/index.ts',
        },
        ts: {
            configFile: 'tsconfig.test.json'
        }
    });


    setTimeout(() => {
        console.log('DONE!!!');
    }, 60 * 60000);

}

console.log('Running....');
run();

const { Actor } = require('apify');

Actor.main(async () => {
    const input = await Actor.getInput();
    const { searchTerm = 'restaurants in New York', maxResults = 10 } = input;

    const browser = await Actor.launchPuppeteer();
    const page = await browser.newPage();
    const searchUrl = `https://www.google.com/maps/search/${encodeURIComponent(searchTerm)}`;

    console.log(`Navigating to ${searchUrl}`);
    await page.goto(searchUrl, { waitUntil: 'networkidle2' });

    await page.waitForSelector('.hfpxzc', { timeout: 30000 }); // result container

    // Scroll to load more
    let previousHeight;
    let resultsLoaded = 0;

    while (resultsLoaded < maxResults) {
        resultsLoaded = await page.$$eval('.hfpxzc', els => els.length);
        previousHeight = await page.evaluate('document.querySelector("body").scrollHeight');
        await page.evaluate('window.scrollTo(0, document.body.scrollHeight)');
        await page.waitForTimeout(2000); // wait for more results to load
        const newHeight = await page.evaluate('document.querySelector("body").scrollHeight');
        if (newHeight === previousHeight) break;
    }

    const detailLinks = await page.$$eval('.hfpxzc a', anchors =>
        anchors.map(a => a.href).filter(href => href.includes('/place/'))
    );

    const results = [];

    for (let i = 0; i < Math.min(detailLinks.length, maxResults); i++) {
        const link = detailLinks[i];
        const detailPage = await browser.newPage();
        await detailPage.goto(link, { waitUntil: 'networkidle2' });

        await detailPage.waitForTimeout(3000); // allow details to load

        const data = await detailPage.evaluate(() => {
            const name = document.querySelector('h1 span')?.textContent || null;
            const address = document.querySelector('[data-item-id="address"]')?.textContent || null;
            const phone = document.querySelector('[data-item-id^="phone"]')?.textContent || null;
            const website = document.querySelector('[data-item-id^="authority"] a')?.href || null;
            const rating = document.querySelector('span[aria-label*="stars"]')?.textContent || null;

            return { name, address, phone, website, rating };
        });

        results.push(data);
        console.log(`Scraped: ${data.name}`);
        await detailPage.close();
    }

    await Actor.setValue('OUTPUT', results);
    await browser.close();
});

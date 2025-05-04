const { Actor } = require('apify');

Actor.main(async () => {
    const input = await Actor.getInput();
    const { location = 'New York', keyword = 'restaurant', maxResults = 50 } = input;

    if (maxResults > 200) throw new Error('maxResults cannot be more than 200');

    const searchTerm = `${keyword} in ${location}`;
    const browser = await Actor.launchPuppeteer();
    const page = await browser.newPage();
    const searchUrl = `https://www.google.com/maps/search/${encodeURIComponent(searchTerm)}`;

    console.log(`Searching: ${searchTerm}`);
    await page.goto(searchUrl, { waitUntil: 'networkidle2' });
    await page.waitForSelector('.hfpxzc', { timeout: 30000 });

    // Scroll to load more
    let previousHeight = 0;
    let retries = 0;
    while (true) {
        const currentCount = await page.$$eval('.hfpxzc', els => els.length);
        if (currentCount >= maxResults || retries > 10) break;

        previousHeight = await page.evaluate('document.body.scrollHeight');
        await page.evaluate('window.scrollTo(0, document.body.scrollHeight)');
        await page.waitForTimeout(2000);

        const newHeight = await page.evaluate('document.body.scrollHeight');
        if (newHeight === previousHeight) retries++;
    }

    const detailLinks = await page.$$eval('.hfpxzc a', anchors =>
        anchors.map(a => a.href).filter(href => href.includes('/place/'))
    );

    const results = [];

    for (let i = 0; i < Math.min(detailLinks.length, maxResults); i++) {
        const link = detailLinks[i];
        const detailPage = await browser.newPage();
        await detailPage.goto(link, { waitUntil: 'networkidle2' });
        await detailPage.waitForTimeout(3000);

        const data = await detailPage.evaluate(() => {
            const name = document.querySelector('h1 span')?.textContent || null;
            const address = document.querySelector('[data-item-id="address"]')?.textContent || null;
            const phone = document.querySelector('[data-item-id^="phone"]')?.textContent || null;
            const website = document.querySelector('[data-item-id^="authority"] a')?.href || null;
            const rating = document.querySelector('span[aria-label*="stars"]')?.textContent || null;

            return { name, address, phone, website, rating };
        });

        console.log(`Scraped: ${data.name}`);
        results.push(data);
        await detailPage.close();
    }

    await Actor.setValue('OUTPUT', results);
    await browser.close();
});

const { Actor } = require('apify');

Actor.main(async () => {
    const input = await Actor.getInput();
    const { location = 'New York', keyword = 'restaurant', maxResults = 50 } = input;

    if (maxResults > 200) throw new Error('maxResults cannot be more than 200');

    const searchTerm = `${keyword} in ${location}`;
    const browser = await Actor.launchBrowser(); // <-- fixed line
    const page = await browser.newPage();
    const searchUrl = `https://www.google.com/maps/search/${encodeURIComponent(searchTerm)}`;

    // ... rest of your code ...
});

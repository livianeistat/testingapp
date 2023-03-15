const express = require('express');
const puppeteer = require('puppeteer');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

const app = express();
const port = 3000;

app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

app.post('/', async (req, res) => {
  const keyword = req.body.keyword;

  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  const url = `https://www.google.com/search?q=${keyword}`;
  await page.goto(url);

  let urls = [];
  let count = 0;
  const progressBarInterval = setInterval(() => {
    count++;
    if (count <= 100) {
      res.write(`<script>document.getElementById('progressBar').value = ${count}</script>`);
    }
  }, 1000);

  while (urls.length < 1000) {
    const currentUrls = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a'));
      const urls = links.map(link => link.href);
      const nonGoogleUrls = urls.filter(url => {
        return !url.includes('google.') && !url.includes('webcache.googleusercontent.com');
      });
      return nonGoogleUrls;
    });
    urls = [...urls, ...currentUrls];
    urls = Array.from(new Set(urls));
    const nextButton = await page.$('#pnnext');
    if (urls.length >= 1000 || !nextButton) {
      break;
    }
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2' }),
      page.click('#pnnext')
    ]);
  }

  clearInterval(progressBarInterval);

  const csvWriter = createCsvWriter({
    path: 'urls.csv',
    header: [{ id: 'url', title: 'URL' }]
  });
  const data = urls.slice(0, 1000).map(url => ({ url }));
  await csvWriter.writeRecords(data);

  await browser.close();

  res.send(`
    <h1>Finished scraping ${urls.length} URLs</h1>
    <ul>
      ${urls.slice(0, 10).map(url => `<li>${url}</li>`).join('')}
    </ul>
    <progress id="progressBar" value="100" max="100"></progress>
    <p>The first 1000 URLs have been saved to urls.csv</p>
  `);
});

app.listen(port, () => {
  console.log(`App listening at http://localhost:${port}`);
});

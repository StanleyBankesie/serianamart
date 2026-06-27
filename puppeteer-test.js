const puppeteer = require('puppeteer');

(async () => {
  try {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', err => console.log('PAGE ERROR:', err.toString()));
    
    await page.goto('http://localhost:5173/login');
    
    // Check if we are on login page
    const hasLogin = await page.$('input[name="username"]');
    if (hasLogin) {
      await page.type('input[name="username"]', 'admin');
      await page.type('input[name="password"]', 'admin');
      
      await Promise.all([
        page.waitForNavigation({waitUntil: 'networkidle0'}),
        page.click('button[type="submit"]')
      ]);
    }
    
    console.log('Current URL:', page.url());
    await new Promise(r => setTimeout(r, 2000)); // wait for any subsequent renders
    await browser.close();
  } catch (err) {
    console.error("SCRIPT ERROR:", err);
    process.exit(1);
  }
})();

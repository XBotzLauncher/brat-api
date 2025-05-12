require('dotenv').config();

const express = require('express');
const morgan = require('morgan');
const { chromium } = require('playwright');
const path = require('path');
const os = require('os');
const axios = require('axios');
const { execSync } = require('child_process');
const fs = require('fs');
const { fileURLToPath } = require('url');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(morgan('common'));

// Buat browser instance
let browser;

const launchBrowser = async () => {
  browser = await chromium.launch(); // Browser headless
}

launchBrowser();

async function fetchCount() {
  try {
    return (await axios.get("https://api.counterapi.dev/v1/aqul/brat/up")).data?.count || 0
  } catch {
    return 0
  }
}

app.get('/brat', async (req, res) => {
  const text = req.query.text
  const hit = fetchCount()
  if (!text) return res.status(200).json({
    author: 'XBotzLauncher',
    repository: {
      github: 'https://github.com/XBotzLauncher/brat-api'
    },
    hit: await hit,
    message: "Parameter `text` diperlukan",
    runtime: {
      os: os.type(),
      platform: os.platform(),
      architecture: os.arch(),
      cpuCount: os.cpus().length,
      uptime: `${os.uptime()} seconds`,
      memoryUsage: `${Math.round((os.totalmem() - os.freemem()) / 1024 / 1024)} MB used of ${Math.round(os.totalmem() / 1024 / 1024)} MB`
    }
  })
  if (!browser) {
    await launchBrowser();
  }
  const context = await browser.newContext({
    viewport: {
      width: 1536,
      height: 695
    }
  });
  const page = await context.newPage();

  const filePath = path.join(__dirname, './site/index.html');

  // Open https://www.bratgenerator.com/
  await page.goto(`file://${filePath}`);

  // Click on <div> #toggleButtonWhite
  await page.click('#toggleButtonWhite');

  // Click on <div> #textOverlay
  await page.click('#textOverlay');

  // Click on <input> #textInput
  await page.click('#textInput');

  // Fill "sas" on <input> #textInput
  await page.fill('#textInput', text);

  const element = await page.$('#textOverlay');
  const box = await element.boundingBox();

  res.set('Content-Type', 'image/png');
  res.end(await page.screenshot({
    clip: {
      x: box.x,
      y: box.y,
      width: 500,
      height: 500
    }
  }));
  await context.close();
});

app.get('/bratvid', async (req, res) => {
  try {
    const text = req.query.text;
    const hit = await fetchCount();

    if (!text) {
      return res.status(200).json({
        author: 'XBotzLauncher',
        repository: {
          github: 'https://github.com/XBotzLauncher/brat-api'
        },
        hit,
        message: "Parameter `text` diperlukan",
        runtime: {
          os: os.type(),
          platform: os.platform(),
          architecture: os.arch(),
          cpuCount: os.cpus().length,
          uptime: `${os.uptime()} seconds`,
          memoryUsage: `${Math.round((os.totalmem() - os.freemem()) / 1024 / 1024)} MB used of ${Math.round(os.totalmem() / 1024 / 1024)} MB`
        }
      });
    }

    if (!browser) await launchBrowser();
    const context = await browser.newContext({
      viewport: { width: 1536, height: 695 }
    });
    const page = await context.newPage();
    const filePath = path.join(__dirname, './site/index.html');
    await page.goto(`file://${filePath}`);
    await page.click('#toggleButtonWhite');
    await page.click('#textOverlay');
    await page.click('#textInput');

    const element = await page.$('#textOverlay');
    const box = await element.boundingBox();

    const txt = text.trim().split(" ");
    const tmpDir = path.resolve(__dirname, `./tmp/brat_${Date.now()}`);
    fs.mkdirSync(tmpDir, { recursive: true });

    const images = [];
    for (let i = 0; i < txt.length; i++) {
      const partial = txt.slice(0, i + 1).join(" ");
      await page.fill('#textInput', partial);
      await page.waitForTimeout(100); // delay kecil agar render sempurna

      const imgPath = path.join(tmpDir, `frame_${i}.png`);
      const buffer = await page.screenshot({
        clip: {
          x: box.x,
          y: box.y,
          width: box.width,
          height: box.height
        }
      });
      fs.writeFileSync(imgPath, buffer);
      images.push(imgPath);
    }

    const concatFile = path.join(tmpDir, 'input.txt');
    const durations = images.map((f, i) =>
      `file '${f}'\nduration ${i === images.length - 1 ? 2 : 0.5}`
    );
    fs.writeFileSync(concatFile, durations.join('\n') + '\n');

    const output = path.join(tmpDir, 'output.mp4');
    execSync(`ffmpeg -y -f concat -safe 0 -i "${concatFile}" -vf "fps=30,format=yuv420p" -c:v libx264 "${output}"`);

    res.setHeader('Content-Type', 'video/mp4');
    res.sendFile(output, () => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
      context.close();
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// Menangani penutupan server
const closeBrowser = async () => {
  if (browser) {
    console.log('Closing browser...');
    await browser.close();
    console.log('Browser closed');
  }
};

process.on('SIGINT', async () => {
  console.log('SIGINT received');
  await closeBrowser();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('SIGTERM received');
  await closeBrowser();
  process.exit(0);
});

process.on('exit', async () => {
  console.log('Process exiting');
  await closeBrowser();
});

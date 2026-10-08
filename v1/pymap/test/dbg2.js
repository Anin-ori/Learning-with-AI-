const { chromium } = require("/opt/npm-tools/node_modules/playwright");
const fs = require("fs"), path = require("path");
const D3 = fs.readFileSync("/opt/npm-tools/node_modules/d3/dist/d3.min.js", "utf8");
(async () => {
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  page.on("pageerror", (e) => console.log("PAGEERROR", e.message)); page.on("console", (m) => console.log("console", m.type(), m.text().slice(0, 200)));
  await page.route("**/*", (r) => { const u = r.request().url(); if (u.includes("/d3/")) return r.fulfill({ body: D3, contentType: "application/javascript" }); if (u.startsWith("file:")) return r.continue(); return r.abort(); });
  await page.goto("file://" + path.join(__dirname, "pt.html")); await page.waitForTimeout(900);
  await page.fill("#km-q", "List slicing"); await page.dispatchEvent("#km-q", "change"); await page.waitForTimeout(500);
  console.log(await page.evaluate(() => { const b = document.querySelector("#km-p-det [data-learn]"); return b ? b.outerHTML : "no button: " + document.getElementById("km-p-det").innerHTML.slice(0, 300); }));
  await page.evaluate(() => document.querySelector("#km-p-det [data-learn]").click()); await page.waitForTimeout(400);
  console.log(await page.evaluate(() => [document.body.className, document.getElementById("kmap").hidden, document.querySelector("#main h2").textContent]));
  await browser.close();
})();

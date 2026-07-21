import path from "node:path";
import { chromium } from "@playwright/test";

const browser = await chromium.launch({
  headless: true,
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
});

const cases = [
  ["desktop", { width: 1440, height: 1000 }],
  ["mobile", { width: 390, height: 844 }],
];

const routes = [
  ["/", "overview"],
  ["/ledger", "ledger"],
  ["/referrals", "referrals"],
  ["/deals", "deals"],
  ["/invoices", "invoices"],
  ["/disputes", "disputes"],
  ["/statements", "statements"],
  ["/settings", "settings"],
];

for (const [name, viewport] of cases) {
  const context = await browser.newContext({ viewport });
  for (const [route, routeName] of routes) {
    const page = await context.newPage();
    const errors = [];

    page.on("console", (message) => {
      if (message.type() === "error") {
        errors.push(message.text());
      }
    });
    page.on("pageerror", (error) => errors.push(error.message));

    await page.goto(`http://127.0.0.1:3010${route}`, {
      waitUntil: "networkidle",
      timeout: 60_000,
    });

    const audit = await page.evaluate(() => {
    const visible = (element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    };

    const overflow = Array.from(document.querySelectorAll("body *"))
      .filter(visible)
      .map((element) => {
        const rect = element.getBoundingClientRect();
        if (rect.left < -1 || rect.right > window.innerWidth + 1) {
          return {
            tag: element.tagName.toLowerCase(),
            text: (element.textContent || "").replace(/\s+/g, " ").trim().slice(0, 60),
            left: Math.round(rect.left),
            right: Math.round(rect.right),
            width: Math.round(rect.width),
          };
        }
        return null;
      })
      .filter(Boolean)
      .slice(0, 20);

    const clippedText = Array.from(
      document.querySelectorAll("button, a, summary, h1, h2, p, span"),
    )
      .filter(visible)
      .filter((element) => {
        const style = getComputedStyle(element);
        return style.overflow !== "hidden"
          && (element.scrollWidth > element.clientWidth + 1
            || element.scrollHeight > element.clientHeight + 1);
      })
      .map((element) => ({
        tag: element.tagName.toLowerCase(),
        text: (element.textContent || "").trim().slice(0, 60),
      }))
      .slice(0, 20);

    const images = Array.from(document.images).map((image) => ({
      alt: image.alt,
      complete: image.complete,
      naturalWidth: image.naturalWidth,
    }));

    return {
      title: document.title,
      innerWidth: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      overflow,
      clippedText,
      images,
      h1: document.querySelector("h1")?.textContent,
    };
    });

    await page.screenshot({
      path: path.resolve("work/screenshots", `${name}-${routeName}.png`),
      fullPage: true,
    });

    console.log(`${name.toUpperCase()} ${routeName}`, JSON.stringify({ errors, audit }, null, 2));
    await page.close();
  }
  await context.close();
}

await browser.close();

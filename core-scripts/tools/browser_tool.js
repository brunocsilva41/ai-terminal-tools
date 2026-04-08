import { chromium } from "playwright";

const ALLOWED_TASKS = new Set(["extract_text", "screenshot", "links"]);

function emit(payload, exitCode = 0) {
  console.log(JSON.stringify(payload, null, 2));
  process.exitCode = exitCode;
}

async function browse(url, task = "extract_text") {
  if (!url) {
    emit(
      {
        status: "error",
        error: "Please provide a URL.",
        data: { usage: 'node browser_tool.js "<url>" [extract_text|links|screenshot]' }
      },
      2
    );
    return;
  }

  if (!ALLOWED_TASKS.has(task)) {
    emit(
      {
        status: "error",
        error: `Unsupported task: ${task}`,
        data: { allowed_tasks: Array.from(ALLOWED_TASKS) }
      },
      2
    );
    return;
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto(url, { waitUntil: "networkidle" });

    const data = {
      url,
      task
    };
    if (task === "extract_text") {
      data.text = await page.innerText("body");
    } else if (task === "screenshot") {
      const outputPath = `screenshot_${Date.now()}.png`;
      await page.screenshot({ path: outputPath, fullPage: true });
      data.screenshot_path = outputPath;
    } else if (task === "links") {
      data.links = await page.$$eval("a", (anchors) => anchors.map((anchor) => anchor.href));
    }

    emit({
      status: "success",
      error: null,
      data
    });
  } catch (error) {
    emit(
      {
        status: "error",
        error: error.message,
        data: { url, task }
      },
      1
    );
  } finally {
    await browser.close();
  }
}

const args = process.argv.slice(2);
browse(args[0], args[1] || "extract_text");

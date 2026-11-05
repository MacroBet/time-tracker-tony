// Run with playwright-cli run-code "$(cat tests/schedule-modal.browser.js)".
// Requires a signed-in manager and synthetic Northbank on an isolated demo server.
/* eslint-disable @typescript-eslint/no-unused-expressions -- Playwright CLI consumes this function expression. */
// prettier-ignore
async (page) => {
  const check = (condition, message) => {
    if (!condition) throw new Error(message);
  };
  const host = new URL(page.url()).hostname;
  check(["127.0.0.1", "localhost"].includes(host), "Use only an isolated local demo");
  const session = await (await page.request.get(new URL("/api/auth/session", page.url()).href)).json();
  check(session.mode === "demo", "Synthetic demo mode is required");
  await page.reload();
  const result = [];
  const requests = [];
  page.on("request", (request) => {
    if (request.method() === "PATCH") requests.push(request.postDataJSON());
  });
  const dialog = page.getByRole("dialog");
  const scroll = page.getByRole("region", {
    name: "Scrollable programme table and timeline",
  });
  const position = () =>
    page.evaluate(() => ({
      y: window.scrollY,
      x: document.querySelector(
        '[aria-label="Scrollable programme table and timeline"]',
      ).scrollLeft,
    }));
  async function unchanged(before) {
    const after = await position();
    check(
      before.x === after.x && before.y === after.y,
      `Background moved: ${JSON.stringify({ before, after })}`,
    );
  }
  async function closeAndCheck(trigger, before, key = "Escape") {
    await page.keyboard.press(key);
    await dialog.waitFor({ state: "hidden" });
    await page.waitForFunction(el => document.activeElement === el, await trigger.elementHandle());
    check(
      await trigger.evaluate((el) => document.activeElement === el),
      "Origin focus not restored",
    );
    await unchanged(before);
    check(
      await page.evaluate(
        () => document.body.getAttribute("data-scroll-locked") === null,
      ),
      "Body stayed locked",
    );
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByLabel("Gantt scale").selectOption("day");
  const row = scroll.locator("tbody tr").nth(5).locator("button").first();
  await row.scrollIntoViewIfNeeded();
  const before = await position();
  await row.click();
  await dialog.waitFor();
  await unchanged(before);
  check(
    await page.evaluate(
      () => document.body.getAttribute("data-scroll-locked") !== null,
    ),
    "Body not locked",
  );
  check(
    await dialog
      .locator('input[name="name"]')
      .evaluate((el) => document.activeElement === el),
    "Initial focus missing",
  );
  for (let i = 0; i < 25; i++) {
    await page.keyboard.press("Tab");
    check(
      await dialog.evaluate((el) => el.contains(document.activeElement)),
      "Tab escaped dialog",
    );
  }
  await page.keyboard.press("Shift+Tab");
  check(
    await dialog.evaluate((el) => el.contains(document.activeElement)),
    "Shift+Tab escaped dialog",
  );
  const originalName = await dialog.locator('input[name="name"]').inputValue();
  await dialog.locator('input[name="name"]').fill("Discard this draft");
  await closeAndCheck(row, before);
  await row.click();
  check(
    (await dialog.locator('input[name="name"]').inputValue()) === originalName,
    "Dismiss saved draft",
  );
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await dialog.waitFor({ state: "hidden" });
  await unchanged(before);
  check(requests.length === 0, "Opening or dismissing sent a mutation");
  result.push(
    "row, Escape, dirty discard, Cancel, focus trap and scroll preservation PASS",
  );

  // Both Gantt shortcuts now reach the same complete dialog.
  const pencil = scroll
    .locator("tbody tr")
    .nth(5)
    .getByRole("button", { name: /Quick edit/ });
  await pencil.click();
  check(
    await dialog.locator('input[name="name"]').isVisible(),
    "Pencil lacks full editor",
  );
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  await dialog.waitFor({ state: "hidden" });
  await row.click({ button: "right" });
  await dialog.waitFor();
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "hidden" });
  await scroll.evaluate((el) => {
    el.scrollLeft = 480;
  });
  const bar = scroll.getByRole("button", { name: /^Edit DEMO/ }).nth(5);
  await bar.scrollIntoViewIfNeeded();
  const barBefore = await position();
  await bar.click();
  await unchanged(barBefore);
  await dialog.screenshot({
    path: "/private/tmp/tony-schedule-modal-desktop.png",
  });
  await closeAndCheck(bar, barBefore);
  result.push("pencil, right click, bar and horizontal scroll PASS");

  await bar.click();
  const duration = dialog.locator('input[name="durationDays"]');
  await duration.fill("0");
  await dialog
    .getByRole("button", { name: "Preview programme change" })
    .click();
  check(
    await duration.evaluate((el) => !el.checkValidity()),
    "Invalid duration accepted",
  );
  check(requests.length === 0, "Invalid form sent a request");
  await duration.fill("1");
  const note = dialog.locator('input[name="reason"]');
  check(
    await note.evaluate((el) => !el.checkValidity()),
    "Change note no longer required",
  );
  await note.fill("Isolated modal browser verification");
  await dialog.locator('input[name="name"]').fill(originalName + " · modal QA");
  await dialog
    .getByRole("button", { name: "Preview programme change" })
    .click();
  const save = dialog.getByRole("button", { name: "Save programme revision" });
  await save.waitFor();
  check(
    requests.length === 1 && requests[0].action === "schedule" && requests[0].preview === true,
    "Preview unexpectedly saved",
  );
  await save.click();
  await dialog.waitFor({ state: "hidden" });
  check(
    requests.length === 2 && requests[1].action === "schedule" && requests[1].preview !== true,
    "Save did not use existing API",
  );
  await bar.click();
  check(
    (await dialog.locator('input[name="name"]').inputValue()).endsWith(
      " · modal QA",
    ),
    "Saved name not persisted",
  );
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "hidden" });
  result.push("invalid form, required note, preview and confirmed save PASS");

  await page.setViewportSize({ width: 390, height: 844 });
  const mobile = page
    .getByRole("list", { name: "Programme activities" })
    .locator("button")
    .nth(5);
  await mobile.scrollIntoViewIfNeeded();
  const mobileY = await page.evaluate(() => window.scrollY);
  await mobile.click();
  await dialog.waitFor();
  check(
    (await page.evaluate(() => window.scrollY)) === mobileY,
    "Mobile opening moved background",
  );
  check(
    await dialog.evaluate((el) => {
      const b = el.getBoundingClientRect();
      return (
        b.left >= 0 &&
        b.right <= innerWidth &&
        b.top >= 0 &&
        b.bottom <= innerHeight &&
        el.scrollHeight > el.clientHeight
      );
    }),
    "Mobile dialog not bounded or internally scrollable",
  );
  await dialog.locator('input[name="name"]').focus();
  await dialog.evaluate(el => Promise.all(el.getAnimations().map(animation => animation.finished)));
  await page.screenshot({
    path: "/private/tmp/tony-schedule-modal-mobile.png",
    animations: "disabled",
  });
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "hidden" });
  await page.waitForFunction(el => document.activeElement === el, await mobile.elementHandle());
  check(
    await mobile.evaluate((el) => document.activeElement === el),
    "Mobile origin focus not restored",
  );
  check(
    (await page.evaluate(() => window.scrollY)) === mobileY,
    "Mobile closing moved background",
  );
  result.push(
    "mobile bounds, internal scrolling, focus and background scroll PASS",
  );
  return result;
}

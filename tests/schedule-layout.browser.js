// Signed-in synthetic Northbank, /schedule: playwright-cli run-code "$(cat tests/schedule-layout.browser.js)".
/* eslint-disable @typescript-eslint/no-unused-expressions -- Playwright CLI consumes this function expression. */
// prettier-ignore
async (page) => {
  const check = (ok, message) => { if (!ok) throw new Error(message); };
  check(["localhost", "127.0.0.1"].includes(new URL(page.url()).hostname), "Local demo only");
  const session = await (await page.request.get(new URL("/api/auth/session", page.url()).href)).json();
  check(session.mode === "demo", "Demo mode required");
  await page.reload();
  await page.setViewportSize({width:1440, height:1000});
  const scale = page.getByLabel("Gantt scale");
  check(await scale.inputValue() === "day", "Initial scale is not Days");
  const panel = page.locator("main aside");
  const browser = panel.locator("details").first();
  const summary = browser.locator("summary").first();
  const gantt = page.getByRole("region", {name:"Project Gantt", exact:true});
  check(await browser.getAttribute("open") === null, "Browse should start collapsed");
  const bounds = await panel.evaluate(el => {
    const p = el.getBoundingClientRect();
    const g = document.querySelector('[aria-label="Project Gantt"]').getBoundingClientRect();
    return {panelWidth:p.width, ganttWidth:g.width, sameLeft:p.left === g.left, above:p.bottom <= g.top, collapsedHeight:p.height};
  });
  check(bounds.panelWidth === bounds.ganttWidth && bounds.sameLeft && bounds.above, "Panel reserves a side column");
  await panel.evaluate(el => el.scrollIntoView({block:"start"}));
  await page.evaluate(() => window.scrollBy(0,-160));
  await page.screenshot({path:"/private/tmp/tony-schedule-layout-desktop.png", animations:"disabled"});
  await scale.selectOption("month");
  await summary.click();
  await page.getByLabel("Group assets by").selectOption("phase");
  check(await scale.inputValue() === "month", "Rerender reset chosen scale");
  const type = browser.locator("details").first();
  await type.locator("summary").first().click();
  const group = type.locator("details").first();
  await group.locator("summary").click();
  const asset = group.locator("button").first();
  const selectedName = await asset.getAttribute("title");
  await asset.click();
  const filtered = await gantt.locator("tbody tr").count();
  check(filtered > 0 && filtered < 50, "Equipment selection did not filter activities");
  await summary.click();
  check((await summary.textContent()).includes(selectedName), "Closed summary loses selection label");
  check(await gantt.locator("tbody tr").count() === filtered, "Closing discarded filter");
  await scale.selectOption("week");
  await summary.click();
  check(await scale.inputValue() === "week", "Opening panel reset Weeks");
  await scale.selectOption("day");
  const times = gantt.locator("time");
  check(await times.count() === 35, "Daily columns changed");
  check(await times.first().evaluate(el => el.parentElement.getBoundingClientRect().width) === 48, "Day width changed");
  // Essential modal smoke only; the full modal browser test is separate.
  await gantt.locator("tbody tr button").first().click();
  await page.getByRole("dialog").waitFor();
  await page.keyboard.press("Escape");
  await page.getByRole("dialog").waitFor({state:"hidden"});
  await page.setViewportSize({width:390,height:844});
  await page.getByRole("button", {name:"Timeline",exact:true}).click();
  check(await gantt.locator("tbody tr").count() === filtered, "Mobile lost filter");
  await panel.evaluate(el => el.scrollIntoView({block:"start"}));
  await page.evaluate(() => window.scrollBy(0,-170));
  await page.screenshot({path:"/private/tmp/tony-schedule-layout-mobile.png", animations:"disabled"});
  check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "Mobile page overflow");
  await summary.click();
  check(await gantt.locator("tbody tr").count() === filtered, "Mobile collapse discarded filter");
  await page.getByRole("button", {name:"Clear filter",exact:true}).click();
  check(await gantt.locator("tbody tr").count() === 50, "Clear filter failed");
  return {status:"PASS", bounds, filtered, checks:["default Days", "full-width collapsed panel above Gantt", "group/filter selection retained on collapse", "Weeks/Months retained across rerenders", "35 daily columns at48px", "modal smoke", "mobile panel and no overflow", "clear filter"]};
}

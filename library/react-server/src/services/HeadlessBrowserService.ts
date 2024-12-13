import puppeteer, { Browser, Page } from "puppeteer";

export class HeadlessBrowserService {
  private browser: Browser | null = null;
  private page: Page | null = null;

  async initialize() {
    if (this.browser) return;

    console.log("Launching headless browser...");
    this.browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
      channel: "chrome",
    });

    this.page = await this.browser.newPage();

    // Track network requests
    const criticalRequestsCompleted = {
      loadCachedCustomProviders: false,
      loadcforge: false,
      fetchEnvironAPIKeys: false,
      getfile: false,
    };

    this.page.on("request", (request) => {
      console.log(`[HeadlessBrowser] Request started: ${request.url()}`);
    });

    this.page.on("requestfinished", (request) => {
      const url = request.url();
      console.log(`[HeadlessBrowser] Request finished: ${url}`);

      if (url.includes("/app/loadCachedCustomProviders")) {
        criticalRequestsCompleted.loadCachedCustomProviders = true;
      } else if (url.includes("/app/loadcforge")) {
        criticalRequestsCompleted.loadcforge = true;
      } else if (url.includes("/app/fetchEnvironAPIKeys")) {
        criticalRequestsCompleted.fetchEnvironAPIKeys = true;
      } else if (url.includes("/app/getfile")) {
        criticalRequestsCompleted.getfile = true;
      }
    });

    console.log("Navigating to flow page...");
    await this.page.goto(
      "http://localhost:3000/?p_folder=deediplease%20conversation%20manager__default&i_folder=iteration%201&file_name=flow-1731510739195.cforge",
      {
        waitUntil: ["networkidle0", "domcontentloaded"],
        timeout: 60000,
      },
    );

    // Wait for all critical requests to complete
    console.log("Waiting for critical API calls to complete...");
    await this.page.waitForFunction(
      (completed) => {
        return Object.values(completed).every((value) => value === true);
      },
      { timeout: 60000 },
      criticalRequestsCompleted,
    );

    console.log("Waiting for React to render flow...");
    try {
      await this.page.waitForSelector("#root", {
        timeout: 60000,
        visible: true,
      });

      await this.page.waitForSelector(".react-flow", {
        timeout: 60000,
        visible: true,
      });

      console.log("Flow rendered successfully");
      await this.page.screenshot({ path: "flow-loaded.png" });
    } catch (error) {
      console.error("Error waiting for flow to render:", error);
      await this.page.screenshot({ path: "flow-error.png" });
      throw error;
    }
  }

  async executePromptNode(nodeId: string, userInputs?: Record<string, string>) {
    if (!this.page) throw new Error("Browser not initialized");

    console.log(`[HeadlessBrowser] Executing prompt node: ${nodeId}`);
    console.log(`[HeadlessBrowser] User inputs:`, userInputs);

    try {
      // Wait for React to be ready
      console.log("[HeadlessBrowser] Waiting for React root container...");
      await this.page.screenshot({ path: "before-screenshot.png" });
      await this.page.waitForFunction(
        'document.querySelector("#root").__reactContainer$',
        { timeout: 60000 },
      );

      // Wait for the specific node
      console.log(
        `[HeadlessBrowser] Waiting for node element [data-nodeid="${nodeId}"]...`,
      );
      await this.page.waitForSelector(`[data-nodeid="${nodeId}"]`, {
        timeout: 60000,
        visible: true,
      });
      const userInputs = { f1: "randome value" };
      // Handle user inputs if present
      if (userInputs) {
        console.log("[HeadlessBrowser] Processing user inputs...");
        for (const [inputKey, inputValue] of Object.entries(userInputs)) {
          console.log(
            `[HeadlessBrowser] Setting input ${inputKey}=${inputValue}`,
          );
          await this.page.evaluate(
            ({ nodeId, inputKey, inputValue }) => {
              const node = document.querySelector(`[data-nodeid="${nodeId}"]`);
              if (!node) {
                console.error(`Node ${nodeId} not found`);
              }
              // Implementation depends on your UI structure
            },
            { nodeId, inputKey, inputValue },
          );
        }
      }

      // Click the run button
      console.log("[HeadlessBrowser] Clicking run button...");
      await this.page.click(`[data-nodeid="${nodeId}"] .run-button`);

      // Wait for execution to complete
      console.log("[HeadlessBrowser] Waiting for execution status...");
      const result = await this.page.evaluate((nodeId) => {
        return new Promise((resolve) => {
          const checkInterval = setInterval(() => {
            const node = document.querySelector(`[data-nodeid="${nodeId}"]`);
            const status = node?.getAttribute("data-status");
            console.log(`[HeadlessBrowser] Current status: ${status}`);

            if (status === "READY" || status === "ERROR") {
              clearInterval(checkInterval);
              resolve(status);
            }
          }, 100);
        });
      }, nodeId);

      console.log(
        `[HeadlessBrowser] Execution completed with status: ${result}`,
      );
      return result;
    } catch (error) {
      console.error("[HeadlessBrowser] Error executing prompt node:", error);
      await this.page.screenshot({ path: "error-screenshot.png" });
      throw error;
    }
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
    }
  }
}

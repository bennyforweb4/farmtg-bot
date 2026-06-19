export class FarmtgClient {
  constructor({ token, wsUrl = "wss://farmtg.top/api/game/ws", humanPass = "", logger = console }) {
    if (!token) {
      throw new Error("FarmTG token is required");
    }

    this.token = token;
    this.wsUrl = wsUrl;
    this.humanPass = humanPass;
    this.logger = logger;
    this.rid = 0;
    this.pending = new Map();
    this.plotsVersion = 0;
    this.plotWaiters = new Set();
    this.state = {
      plots: [],
      user: null,
      inventory: [],
    };
  }

  async connect() {
    const headers = {
      Origin: "https://farmtg.top",
    };

    if (this.humanPass) {
      headers["X-Human-Pass"] = this.humanPass;
    }

    this.ws = new WebSocket(this.wsUrl, { headers });

    this.ws.addEventListener("message", (event) => this.handleMessage(event.data));
    this.ws.addEventListener("close", () => this.rejectAll(new Error("FarmTG WebSocket closed")));
    this.ws.addEventListener("error", () => this.rejectAll(new Error("FarmTG WebSocket error")));

    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("FarmTG WebSocket connect timeout")), 12_000);
      this.ws.addEventListener(
        "open",
        () => {
          clearTimeout(timeout);
          resolve();
        },
        { once: true },
      );
      this.ws.addEventListener(
        "error",
        () => {
          clearTimeout(timeout);
          reject(new Error("FarmTG WebSocket open failed"));
        },
        { once: true },
      );
    });

    const authMsg = { type: "auth", token: this.token };
    if (this.humanPass) authMsg.human_pass = this.humanPass;
    this.send(authMsg);
    await this.waitForAuth();
    return this;
  }

  close() {
    this.ws?.close();
  }

  send(payload) {
    this.ws.send(JSON.stringify(payload));
  }

  action(action, data = {}) {
    const rid = String(++this.rid);
    this.send({ type: "action", rid, action, data });

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(rid);
        reject(new Error(`FarmTG action timeout: ${action}`));
      }, 15_000);

      this.pending.set(rid, { action, resolve, reject, timeout });
    });
  }

  async refreshInventory() {
    const result = await this.action("get_inventory");
    this.state.inventory = result?.data?.data ?? result?.data ?? [];
    return this.state.inventory;
  }

  async harvestAll() {
    const data = this.humanPass ? { human_pass: this.humanPass } : {};
    const result = await this.action("harvest_all", data);
    this.applyHarvestResult(result);
    return result;
  }

  plant(plotIndex, cropId) {
    const data = { plot_index: plotIndex, crop_id: cropId };
    if (this.humanPass) data.human_pass = this.humanPass;
    return this.action("plant", data);
  }

  getMaturePlots() {
    return this.state.plots.filter((plot) => plot.stage === "mature" || plot.progress >= 1);
  }

  getEmptyPlots() {
    const unlocked = this.state.user?.unlocked_plots ?? 0;
    const occupied = new Set(
      this.state.plots
        .filter((plot) => plot.stage !== "empty" && plot.stage !== "cleared")
        .map((plot) => plot.plot_index),
    );
    const empty = [];

    for (let index = 0; index < unlocked; index += 1) {
      if (!occupied.has(index)) {
        empty.push(index);
      }
    }

    return empty;
  }

  getWitheredPlots() {
    return this.state.plots
      .filter((plot) => plot.stage === "withered" || plot.stage === "dead")
      .map((plot) => plot.plot_index);
  }

  waitForPlots({ timeoutMs = 12_000, afterVersion = null } = {}) {
    if (this.state.user && (afterVersion === null || this.plotsVersion > afterVersion)) {
      return Promise.resolve(this.state);
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error("Timed out waiting for FarmTG plots"));
      }, timeoutMs);

      const cleanup = () => {
        clearTimeout(timeout);
        this.plotWaiters.delete(waiter);
      };

      const waiter = {
        afterVersion,
        resolve: () => {
          cleanup();
          resolve(this.state);
        },
      };

      this.plotWaiters.add(waiter);
    });
  }

  waitForAuth() {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error("FarmTG auth timeout"));
      }, 12_000);

      const cleanup = () => {
        clearTimeout(timeout);
        this.onAuthOk = null;
      };

      this.onAuthOk = () => {
        cleanup();
        resolve();
      };
    });
  }

  handleMessage(raw) {
    let message;

    try {
      message = JSON.parse(raw);
    } catch {
      this.logger.warn("Ignoring non-JSON FarmTG message");
      return;
    }

    if (message.type === "auth_ok") {
      this.onAuthOk?.();
      return;
    }

    if (message.type === "plots") {
      this.state.plots = message.plots ?? [];
      this.state.user = message.user ?? null;
      this.plotsVersion += 1;
      this.resolvePlotWaiters();
      return;
    }

    if (message.type === "result" && message.rid) {
      const pending = this.pending.get(message.rid);
      if (!pending) {
        return;
      }

      clearTimeout(pending.timeout);
      this.pending.delete(message.rid);

      if (message.ok) {
        pending.resolve(message);
      } else {
        pending.reject(this.buildActionError(pending.action, message));
      }
    }
  }

  buildActionError(action, message) {
    const payload = message ?? {};
    const code = payload.error_code ?? payload.code ?? payload.errorCode ?? payload?.error?.code ?? payload.status_code;
    const reason = payload.error || payload.message || payload.reason || payload.detail;

    const title = reason ? `${action} ${code ? `[${code}]` : ""}` : action;
    const text = `${title}${reason ? `: ${reason}` : ""}`;
    const error = new Error(`FarmTG action failed: ${text}`);

    error.action = action;
    error.code = code ?? null;
    error.serverPayload = payload;
    return error;
  }

  rejectAll(error) {
    for (const [, pending] of this.pending) {
      clearTimeout(pending.timeout);
      pending.reject(error);
    }
    this.pending.clear();
  }

  applyHarvestResult(result) {
    const items = result?.data?.items || [];
    const cleared = new Set(items.filter((item) => item.cleared || item.withered).map((item) => item.plot_index));

    if (cleared.size === 0) {
      return;
    }

    this.state.plots = this.state.plots.filter((plot) => !cleared.has(plot.plot_index));
    this.plotsVersion += 1;
    this.resolvePlotWaiters();
  }

  resolvePlotWaiters() {
    for (const waiter of [...this.plotWaiters]) {
      if (waiter.afterVersion === null || this.plotsVersion > waiter.afterVersion) {
        waiter.resolve();
      }
    }
  }
}
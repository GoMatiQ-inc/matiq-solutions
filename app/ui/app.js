const api = window.solutions,
  $ = (s) => document.querySelector(s);
let state = null,
  page = "library",
  selected = null,
  detail = null,
  settingsApp = "general";
function element(tag, text, cls) {
  const n = document.createElement(tag);
  if (text !== undefined) n.textContent = text;
  if (cls) n.className = cls;
  return n;
}
function button(text, action, primary = false) {
  const b = element("button", text, primary ? "primary" : "");
  b.onclick = () => run(action);
  return b;
}
async function run(fn) {
  $("#error").hidden = true;
  try {
    await fn();
    await refresh();
  } catch (e) {
    $("#error").hidden = false;
    $("#error").textContent = e.message.replace(
      /^Error invoking remote method '[^']+': Error: /,
      "",
    );
  }
}
function confirmInstall(tool, update = false) {
  return new Promise((resolve) => {
    const d = element("dialog");
    d.append(
      element("h2", update ? "Update " + tool.name : "Install " + tool.name),
      element("p", tool.description || "Runs locally on your device."),
      element(
        "p",
        `Tool download: ${Math.ceil((tool.packages[state.target]?.bytes || 0) / 1024 ** 2)} MB. Models, if needed, are downloaded separately.`,
      ),
      element(
        "p",
        "Declared capabilities: " +
          (tool.capabilities?.join(", ") || "No privileged capabilities") +
          ". Installing does not grant OS or project permissions.",
      ),
    );
    const row = element("div", undefined, "actions");
    row.append(
      button("Cancel", () => d.close()),
      button(
        update ? "Download update" : "Install",
        () => {
          resolve(true);
          d.close();
        },
        true,
      ),
    );
    d.append(row);
    d.onclose = () => {
      resolve(false);
      d.remove();
    };
    document.body.append(d);
    d.showModal();
  });
}
async function install(tool, update = false) {
  if (await confirmInstall(tool, update))
    await api.request("install", {
      id: tool.id,
      update,
      approveCapabilities: true,
      reviewedVersion: tool.version,
      reviewedCapabilities: tool.capabilities || [],
    });
}
const shortName = (tool) =>
  (tool.name || tool.manifest?.name || tool.id).replace(/^MatiQ\s+/, "");
const allInstalled = () => Object.values(state.installed.tools);
const available = () => {
  const tools = new Map(state.catalog.tools.map((t) => [t.id, t]));
  for (const t of allInstalled()) tools.set(t.id, { ...tools.get(t.id), ...t });
  return [...tools.values()];
};
function tile(tool, cls) {
  const b = button("", () => openTool(tool.id));
  b.className = cls;
  b.setAttribute("aria-label", shortName(tool));
  const icon = element("span", undefined, "mq-app-icon");
  icon.append(window.matiqIcon(tool.id.split(".").at(-1)));
  b.append(
    icon,
    element(cls === "mq-home-app" ? "strong" : "span", shortName(tool)),
  );
  return b;
}
async function openTool(id, settings = false) {
  $("#app-launcher").hidePopover();
  if (settings) {
    const previous = await api.request("open", { id });
    const current = await api.request("state");
    if (!current.navigation.settings) {
      await api.request("hide");
      page = "settings";
      settingsApp = id;
      return previous;
    }
  }
  await api.request("open", { id, settings });
  page = settings ? "settings" : "tool";
  settingsApp = settings ? id : "general";
  detail = null;
}
async function go(next) {
  $("#app-launcher").hidePopover();
  await api.request("hide");
  selected = null;
  page = next;
  detail = null;
  settingsApp = "general";
}
function management(tool) {
  const installed = state.installed.tools[tool.id],
    c = element("article", undefined, "card");
  c.append(
    element("h3", shortName(tool)),
    element(
      "p",
      tool.description ||
        tool.manifest?.description ||
        "Runs locally on your device.",
    ),
    element("p", "Version " + tool.version, "caption"),
  );
  const row = element("div", undefined, "actions");
  if (installed) {
    const open = button("Open", () => openTool(tool.id), true);
    open.disabled = tool.enabled === false;
    row.append(open);
    if (state.running.some((t) => t.id === tool.id))
      row.append(button("Close", () => api.request("close", { id: tool.id })));
    row.append(
      button(tool.enabled === false ? "Enable" : "Disable", () =>
        api.request("enable", { id: tool.id, enabled: tool.enabled === false }),
      ),
    );
    if (tool.previous)
      row.append(
        button("Roll back", async () => {
          if (
            window.confirm(
              "Return to the retained previous tool version and pause automatic downloads for all installed tools? Your projects will be kept. You can resume automatic downloads in Settings.",
            )
          )
            await api.request("rollback", { id: tool.id });
        }),
      );
    const update = state.updates.find((t) => t.id === tool.id);
    if (update)
      row.append(button("Download update", () => install(update, true)));
    if (tool.pending)
      row.append(element("span", "Update downloaded · restart required"));
    row.append(
      button("Uninstall", async () => {
        if (
          window.confirm(
            "Remove this tool? Projects, settings and shared models will be kept.",
          )
        )
          await api.request("uninstall", { id: tool.id });
      }),
    );
  } else {
    const supported = tool.targets?.includes(state.target),
      b = button(
        supported ? "Install" : "Not available on this device",
        () => install(tool),
        true,
      );
    b.disabled = !supported || state.installing;
    row.append(b);
  }
  c.append(row);
  return c;
}
function render() {
  if (!state) return;
  const current = selected && state.installed.tools[selected],
    isSettings = selected ? state.viewMode === "settings" : page === "settings";
  if (selected) {
    page = isSettings ? "settings" : "tool";
    if (isSettings) settingsApp = selected;
  }
  $("#title").textContent = isSettings
    ? "Settings"
    : current
      ? shortName(current)
      : {
          library: "My tools",
          marketplace: "Marketplace",
          updates: "Downloads & updates",
        }[page] || "My tools";
  const nav = $("#tool-navigation");
  nav.replaceChildren();
  nav.setAttribute(
    "aria-label",
    current ? shortName(current) + " navigation" : "Tool navigation",
  );
  if (current && !isSettings)
    for (const item of state.navigation.items) {
      const b = button(item.label === "New chat" ? "+" : item.label, () =>
        api.request("navigation", { id: selected, index: item.index }),
      );
      b.setAttribute("aria-label", item.label);
      if (item.active) b.setAttribute("aria-current", "page");
      b.disabled = item.disabled;
      nav.append(b);
    }
  const gear = $("#app-settings");
  gear.hidden = !current || isSettings;
  gear.setAttribute(
    "aria-label",
    current ? shortName(current) + " settings" : "App settings",
  );
  gear.title = gear.getAttribute("aria-label");
  gear.onclick = () => run(() => openTool(selected, true));
  const apps = $("#installed-apps");
  apps.replaceChildren();
  for (const t of allInstalled().filter((t) => t.enabled !== false))
    apps.append(tile(t, "mq-app-tile"));
  if (!apps.children.length)
    apps.append(element("p", "Add or enable apps in Marketplace.", "caption"));
  const tabs = $("#settings-tabs");
  tabs.hidden = !isSettings;
  tabs.replaceChildren();
  if (isSettings) {
    const general = button("Solutions", () => go("settings"));
    if (settingsApp === "general") general.setAttribute("aria-current", "page");
    tabs.append(general);
    for (const t of allInstalled()) {
      const b = button(shortName(t), () => openTool(t.id, true));
      if (settingsApp === t.id) b.setAttribute("aria-current", "page");
      b.disabled = t.enabled === false;
      tabs.append(b);
    }
  }
  const root = $("#content");
  root.replaceChildren();
  root.hidden = Boolean(selected);
  $("#cancel-download").hidden = !state.canCancelDownload;
  $("#activity").textContent = state.activity || "";
  if (selected) return;
  if (page === "library") {
    const intro = element("div", undefined, "mq-home-intro");
    intro.append(
      element("h2", "Your apps"),
      element("p", "Pick up where you left off."),
    );
    root.append(intro);
    const grid = element("div", undefined, "mq-home-apps");
    for (const t of allInstalled().filter((t) => t.enabled !== false))
      grid.append(tile(t, "mq-home-app"));
    root.append(grid);
    if (!grid.children.length)
      root.append(
        element(
          "p",
          "No tools installed. Browse the marketplace to choose your first tool.",
        ),
        button("Browse marketplace", () => go("marketplace"), true),
      );
  }
  if (page === "marketplace") {
    if (detail) {
      const tool = available().find((t) => t.id === detail);
      if (tool) {
        root.append(
          button("Back to marketplace", () => {
            detail = null;
          }),
          element("h2", shortName(tool)),
          management(tool),
        );
        return;
      }
      detail = null;
    }
    root.append(
      element("h2", "Marketplace"),
      element(
        "p",
        "Browse available tools and manage the apps on your device.",
      ),
    );
    const controls = element("div", undefined, "mq-market-controls"),
      search = element("input"),
      filter = element("select");
    search.type = "search";
    search.placeholder = "Search available tools";
    search.setAttribute("aria-label", "Search available tools");
    filter.setAttribute("aria-label", "Filter tools");
    for (const [value, label] of [
      ["all", "All tools"],
      ["installed", "Installed"],
      ["available", "Not installed"],
    ]) {
      const option = element("option", label);
      option.value = value;
      filter.append(option);
    }
    controls.append(
      search,
      filter,
      button("Refresh marketplace", () => api.request("catalog.refresh")),
      button("Downloads & updates", () => go("updates")),
    );
    root.append(controls);
    const wrap = element("div", undefined, "mq-table-wrap"),
      table = element("table"),
      head = element("thead"),
      row = element("tr"),
      body = element("tbody");
    table.setAttribute("aria-label", "Available tools");
    for (const text of ["Tool", "Status", "Version"])
      row.append(element("th", text));
    head.append(row);
    table.append(head, body);
    wrap.append(table);
    root.append(wrap, element("p", state.catalogStatus, "caption"));
    function results() {
      body.replaceChildren();
      for (const t of available().filter(
        (t) =>
          (
            shortName(t) +
            " " +
            (t.description || t.manifest?.description || "")
          )
            .toLowerCase()
            .includes(search.value.toLowerCase()) &&
          (filter.value === "all" ||
            Boolean(state.installed.tools[t.id]) ===
              (filter.value === "installed")),
      )) {
        const tr = element("tr"),
          name = element("td"),
          link = button(shortName(t), () => {
            detail = t.id;
          });
        link.className = "mq-tool-link";
        name.append(
          link,
          element("p", t.description || t.manifest?.description || ""),
        );
        tr.append(
          name,
          element(
            "td",
            state.installed.tools[t.id]
              ? t.enabled === false
                ? "Disabled"
                : "Installed"
              : "Available",
          ),
          element("td", t.version),
        );
        body.append(tr);
      }
      if (!body.children.length) {
        const tr = element("tr"),
          td = element(
            "td",
            "No tools match. Refresh the marketplace when connected.",
          );
        td.colSpan = 3;
        tr.append(td);
        body.append(tr);
      }
    }
    search.oninput = results;
    filter.onchange = results;
    results();
  }
  if (page === "updates") {
    root.append(
      element("h2", "Updates for your installed tools."),
      button("Check for updates", () => api.request("updates.check")),
      button("Restart to apply updates", () => api.request("restart")),
    );
    for (const t of state.updates) {
      const c = element("article", undefined, "card");
      c.append(
        element("h3", shortName(t)),
        button("Download update", () => install(t, true)),
      );
      root.append(c);
    }
    if (!state.updates.length)
      root.append(element("p", "No newer compatible updates are available."));
    root.append(
      element(
        "p",
        "New tools are never automatically installed. Restart waits for active work to finish.",
      ),
    );
  }
  if (page === "settings") {
    if (settingsApp !== "general") {
      root.append(element("p", "This app has no additional settings."));
      return;
    }
    root.append(element("h2", "Local by default."));
    const label = element("label", undefined, "setting"),
      check = element("input");
    check.type = "checkbox";
    check.checked = state.settings.autoUpdates;
    check.onchange = () =>
      run(() => api.request("settings", { autoUpdates: check.checked }));
    label.append(
      check,
      document.createTextNode(
        " Download compatible updates for installed tools automatically",
      ),
    );
    root.append(
      label,
      element(
        "p",
        "Projects and models stay on this computer. Uninstalling tools preserves your work.",
      ),
      button("Downloads & updates", () => go("updates")),
      element("p", "Suite version " + state.version + " · " + state.target),
      element("p", state.appUpdate.message, "caption"),
      button("Check for app updates", () => api.request("app.update.check")),
    );
    if (state.appUpdate.status === "available")
      root.append(
        button("Download app update", () => api.request("app.update.download")),
      );
    if (state.appUpdate.status === "ready")
      root.append(
        button("Restart to update app", () =>
          api.request("app.update.install"),
        ),
      );
  }
}
async function refresh() {
  state = await api.request("state");
  selected = state.selected;
  render();
}
$("#launcher").append(window.matiqIcon("launcher"));
$("#app-settings").append(window.matiqIcon("settings"));
$("#app-launcher").addEventListener("toggle", (e) => {
  const open = e.newState === "open";
  $("#launcher").setAttribute("aria-expanded", String(open));
  api.request("overlay", { open }).catch((error) => {
    $("#error").hidden = false;
    $("#error").textContent = error.message;
  });
});
$(".mq-home").onclick = () => run(() => go("library"));
for (const b of document.querySelectorAll("[data-page]"))
  b.onclick = () => run(() => go(b.dataset.page));
$("#cancel-download").onclick = () => run(() => api.request("download.cancel"));
api.onEvent((e) => {
  if (e.type === "activity") $("#activity").textContent = e.message;
  else refresh().catch(showError);
});
function showError(error) {
  $("#error").hidden = false;
  $("#error").textContent = error.message;
}
refresh().catch(showError);

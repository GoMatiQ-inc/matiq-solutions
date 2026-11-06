const api = window.solutions,
  $ = (s) => document.querySelector(s);
let state = null,
  page = "library",
  selected = null;
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
    $("#error").textContent = e.message;
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
function card(tool, installed) {
  const c = element("article", undefined, "card");
  c.append(
    element("h3", tool.name || tool.manifest?.name || tool.id),
    element(
      "p",
      tool.description ||
        tool.manifest?.description ||
        "Runs locally on your computer.",
    ),
    element("p", "Version " + tool.version, "caption"),
  );
  const row = element("div", undefined, "actions");
  if (installed) {
    row.append(
      button(
        "Open",
        async () => {
          await api.request("open", { id: tool.id });
          selected = tool.id;
        },
        true,
      ),
    );
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
    const supported = tool.targets?.includes(state.target);
    const b = button(
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
  $("#title").textContent = selected
    ? state.installed.tools[selected]?.manifest.name || "Tool"
    : {
        library: "My tools",
        marketplace: "Marketplace",
        updates: "Downloads & updates",
        settings: "Settings",
      }[page];
  $("#return").hidden = !selected;
  for (const b of document.querySelectorAll("[data-page]"))
    b.classList.toggle("active", !selected && b.dataset.page === page);
  const root = $("#content");
  root.replaceChildren();
  root.hidden = Boolean(selected);
  const open = $("#open-tools");
  open.replaceChildren();
  for (const tool of state.running)
    open.append(
      button(tool.name, async () => {
        await api.request("open", { id: tool.id });
        selected = tool.id;
      }),
    );
  $("#activity").textContent = state.activity || "";
  if (selected) return;
  if (page === "library") {
    root.append(
      element("h2", "Your tools, on your device."),
      element("p", "Install only what you want to use."),
    );
    const grid = element("div", undefined, "grid");
    for (const t of Object.values(state.installed.tools))
      grid.append(card(t, true));
    if (!grid.children.length) {
      root.append(
        element(
          "p",
          "No tools installed. Browse the marketplace to choose your first tool.",
        ),
        button(
          "Browse marketplace",
          () => {
            page = "marketplace";
          },
          true,
        ),
      );
    } else root.append(grid);
  }
  if (page === "marketplace") {
    root.append(
      element("h2", "Find your next tool."),
      element("p", "Browse without installing. Every tool runs locally."),
    );
    root.append(
      button("Refresh marketplace", () => api.request("catalog.refresh")),
    );
    const search = element("input");
    search.type = "search";
    search.placeholder = "Search available tools";
    search.setAttribute("aria-label", "Search available tools");
    root.append(search);
    const grid = element("div", undefined, "grid");
    function results() {
      grid.replaceChildren();
      for (const t of state.catalog.tools.filter((t) =>
        (t.name + " " + (t.description || ""))
          .toLowerCase()
          .includes(search.value.toLowerCase()),
      )) {
        const installed = state.installed.tools[t.id];
        grid.append(card(installed || t, Boolean(installed)));
      }
      if (!grid.children.length)
        grid.append(
          element(
            "p",
            "No tools match. Refresh the marketplace when connected.",
          ),
        );
    }
    search.oninput = results;
    results();
    root.append(grid, element("p", state.catalogStatus, "caption"));
  }
  if (page === "updates") {
    root.append(
      element("h2", "Updates for your installed tools."),
      button("Check for updates", () => api.request("updates.check")),
      button("Restart to apply updates", () => api.request("restart")),
    );
    for (const t of state.updates) {
      const c = card({ ...t, id: t.id }, false);
      const row = c.querySelector(".actions");
      row.replaceChildren(button("Download update", () => install(t, true)));
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
      element("p", "Suite version " + state.version + " · " + state.target),
      button("Check for app updates", () => api.request("app.update.check")),
    );
  }
}
async function refresh() {
  state = await api.request("state");
  selected = state.selected;
  render();
}
for (const b of document.querySelectorAll("[data-page]"))
  b.onclick = () =>
    run(async () => {
      selected = null;
      page = b.dataset.page;
      await api.request("hide");
    });
$("#return").onclick = () =>
  run(async () => {
    selected = null;
    await api.request("hide");
  });
api.onEvent((e) => {
  if (e.type === "activity") $("#activity").textContent = e.message;
  else
    refresh().catch((error) => {
      $("#error").hidden = false;
      $("#error").textContent = error.message;
    });
});
refresh().catch((e) => {
  $("#error").hidden = false;
  $("#error").textContent = e.message;
});

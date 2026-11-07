// Visual baseline copied from installed Solutions 0.1.1; all actions are simulated.
const mqPreview = {
  page: "library",
  toolMode: "hosted",
  detail: null,
  query: "",
  filter: "all",
  installed: new Set(["com.matiq.voice", "com.matiq.companion"]),
  disabled: new Set(),
  running: new Set(),
  review: false,
  notice: "",
  staged: false,
  recording: false,
  messages: [],
  autoUpdate: true,
  settingsApp: "general",
};
function solutionsPrototype(root) {
  const s = mqPreview,
    tools = report.prototype_tools || [
      {
        id: "com.matiq.voice",
        name: "MatiQ Voice",
        description:
          "Local dictation and meeting notes, with speech kept on your device.",
        version: "0.3.13",
      },
      {
        id: "com.matiq.companion",
        name: "MatiQ Companion",
        description:
          "Chat with local models, attach files and choose the tools each conversation can use.",
        version: "0.1.5",
      },
    ];
  tools.forEach((t) => {
    t.id = t.toolId || t.id;
    t.name = t.name.replace(/^MatiQ\s+/, "");
  });
  const n = (tag, text, cls) => el(tag, text, cls),
    draw = () => solutionsPrototype(root),
    b = (text, fn, primary = false) => {
      const e = n("button", text, primary ? "mq-primary" : "");
      e.type = "button";
      e.onclick = fn;
      return e;
    },
    move = (p) => {
      s.page = p;
      s.detail = null;
      if (tools.some((t) => t.id === p)) s.running.add(p);
      s.notice = "";
      draw();
    };
  const contextId = () =>
    s.page === "settings" &&
    ["com.matiq.voice", "com.matiq.companion"].includes(s.settingsApp)
      ? s.settingsApp.split(".").at(-1) + "-workspace"
      : s.detail
        ? "tool-details"
        : tools.some((t) => t.id === s.page)
          ? ["com.matiq.voice", "com.matiq.companion"].includes(s.page)
            ? s.page.split(".").at(-1) + "-workspace"
            : "general"
          : s.page;
  root._mqToolCleanup?.();
  root.replaceChildren();
  const bar = n("div", undefined, "mq-reviewbar");
  bar.append(
    n("strong", "UI prototype · v7"),
    n("span", "Compact navigation & settings · Prototype only"),
    b("Feedback" + (entries.length ? " · " + entries.length : ""), () => {
      s.review = !s.review;
      draw();
    }),
    b(
      s.installed.size
        ? "Preview empty installation"
        : "Preview installed tools",
      () => {
        if (s.recording) {
          s.notice = "Stop the sample recording first.";
          draw();
          return;
        }
        s.installed = s.installed.size
          ? new Set()
          : new Set(["com.matiq.voice", "com.matiq.companion"]);
        move("library");
      },
    ),
  );
  if (tools.some((t) => t.id === s.page))
    bar.append(
      b(
        s.toolMode === "hosted" ? "View standalone app" : "View inside suite",
        () => {
          s.toolMode = s.toolMode === "hosted" ? "standalone" : "hosted";
          draw();
        },
      ),
    );
  root.append(bar);
  const work = n("div", undefined, "mq-work"),
    head = n("header", undefined, "mq-header");
  const home = b("", () => move("library"));
  home.className = "mq-home";
  home.setAttribute("aria-label", "MatiQ Solutions home");
  const logo = n("img");
  logo.src = report.prototype_logo;
  logo.alt = "MatiQ Solutions";
  home.append(logo);
  head.append(
    home,
    n(
      "h1",
      {
        library: "My tools",
        marketplace: "Marketplace",
        updates: "Downloads & updates",
        settings: "Settings",
        voice: "MatiQ Voice",
        companion: "MatiQ Companion",
      }[s.page] || tools.find((t) => t.id === s.page)?.name,
    ),
  );
  function svgIcon(kind) {
    if (!["voice", "companion"].includes(kind)) kind = "launcher";
    const ns = "http://www.w3.org/2000/svg",
      svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    if (kind === "launcher") {
      for (const y of [5, 12, 19])
        for (const x of [5, 12, 19]) {
          const dot = document.createElementNS(ns, "rect");
          for (const [a, v] of Object.entries({
            x: x - 1.25,
            y: y - 1.25,
            width: 2.5,
            height: 2.5,
            rx: 0.5,
          }))
            dot.setAttribute(a, v);
          svg.append(dot);
        }
    } else {
      const path = document.createElementNS(ns, "path");
      path.setAttribute(
        "d",
        kind === "voice"
          ? "M4 10v4m4-8v12m4-15v18m4-15v12m4-8v4"
          : "M8 5H6a3 3 0 0 0-3 3v8a3 3 0 0 0 3 3h2v3l4-3h6a3 3 0 0 0 3-3v-2M15 2l1.4 4.6L21 8l-4.6 1.4L15 14l-1.4-4.6L9 8l4.6-1.4Z",
      );
      for (const [a, v] of Object.entries({
        fill: "none",
        stroke: "currentColor",
        "stroke-width": 1.65,
        "stroke-linecap": "round",
        "stroke-linejoin": "round",
      }))
        path.setAttribute(a, v);
      svg.append(path);
    }
    return svg;
  }
  const launcher = b("", () => {});
  launcher.setAttribute("popovertarget", "mq-app-launcher");
  launcher.setAttribute("popovertargetaction", "toggle");
  launcher.className = "mq-launcher";
  launcher.setAttribute("aria-label", "Open app launcher");
  launcher.setAttribute("aria-expanded", "false");
  launcher.setAttribute("aria-controls", "mq-app-launcher");
  launcher.title = "Your apps";
  launcher.append(svgIcon("launcher"));
  let toolNavigation = null;
  const currentTool = tools.find((t) => t.id === s.page);
  if (currentTool && s.toolMode === "hosted") {
    toolNavigation = n("nav", undefined, "mq-tool-navigation");
    toolNavigation.setAttribute("aria-label", currentTool.name + " navigation");
    head.append(toolNavigation);
    const gear = b("", () => {
      s.settingsApp = currentTool.id;
      move("settings");
    });
    gear.className = "mq-app-settings";
    gear.setAttribute("aria-label", currentTool.name + " settings");
    gear.title = currentTool.name + " settings";
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    const path = document.createElementNS(svg.namespaceURI, "path");
    path.setAttribute(
      "d",
      "M9.5 3h5l.6 2.5 2 .9 2.3-.8 2.5 4.3-1.8 1.8v2.6l1.8 1.8-2.5 4.3-2.3-.8-2 .9-.6 2.5h-5l-.6-2.5-2-.9-2.3.8-2.5-4.3 1.8-1.8v-2.6L1.7 9.9l2.5-4.3 2.3.8 2-.9L9.5 3Z",
    );
    path.setAttribute("transform", "translate(0 -1) scale(1 .96)");
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", "currentColor");
    path.setAttribute("stroke-width", "1.4");
    path.setAttribute("stroke-linejoin", "round");
    const circle = document.createElementNS(svg.namespaceURI, "circle");
    circle.setAttribute("cx", "12");
    circle.setAttribute("cy", "12");
    circle.setAttribute("r", "3");
    circle.setAttribute("fill", "none");
    circle.setAttribute("stroke", "currentColor");
    circle.setAttribute("stroke-width", "1.5");
    svg.append(path, circle);
    gear.append(svg);
    head.append(gear);
  }
  head.append(launcher);
  const menu = n("div", undefined, "mq-appmenu");
  menu.id = "mq-app-launcher";
  menu.setAttribute("popover", "auto");
  menu.setAttribute("role", "dialog");
  menu.setAttribute("aria-label", "Installed apps");
  menu.addEventListener("toggle", (e) => {
    launcher.setAttribute("aria-expanded", String(e.newState === "open"));
  });
  menu.append(n("h2", "Your apps"));
  const appgrid = n("div", undefined, "mq-appmenu-grid");
  for (const t of tools.filter(
    (t) => s.installed.has(t.id) && !s.disabled.has(t.id),
  )) {
    const tile = b("", () => {
      menu.hidePopover();
      move(t.id);
    });
    tile.className = "mq-app-tile";
    const badge = n("span", undefined, "mq-app-icon");
    badge.append(svgIcon(t.id.split(".").at(-1)));
    tile.append(badge, n("span", t.name.replace("MatiQ ", "")));
    if (s.page === t.id) tile.setAttribute("aria-current", "page");
    appgrid.append(tile);
  }
  if (!tools.some((t) => s.installed.has(t.id) && !s.disabled.has(t.id)))
    appgrid.append(
      n(
        "p",
        "No apps available to open. Add or enable an app in the marketplace.",
        "mq-caption",
      ),
    );
  menu.append(appgrid);
  const links = n("footer", undefined, "mq-appmenu-footer");
  for (const [id, label] of [
    ["settings", "Settings"],
    ["marketplace", "Marketplace"],
  ]) {
    const link = n("a", label);
    link.href = "#" + id;
    link.onclick = (e) => {
      e.preventDefault();
      menu.hidePopover();
      if (id === "settings") s.settingsApp = "general";
      move(id);
    };
    links.append(link);
  }
  menu.append(links);
  head.append(menu);
  work.append(head);
  const main = n("div", undefined, "mq-main");
  if (s.notice) {
    const msg = n("p", s.notice, "mq-notice");
    msg.setAttribute("role", "status");
    main.append(msg);
  }
  function toolFrame(tool, view) {
    const frame = n("iframe");
    frame.className = "mq-installed-tool";
    frame.title =
      tool.name + (view === "settings" ? " settings" : " workspace");
    const mode = view === "settings" ? "hosted" : s.toolMode;
    const entry =
      tool.prototype || "solutions-prototype/" + tool.id + "/src/ui/index.html";
    frame.src = entry + "?mode=" + mode;
    frame.setAttribute(
      "sandbox",
      "allow-scripts allow-same-origin allow-modals allow-forms",
    );
    frame.setAttribute(
      "allow",
      "microphone 'none'; camera 'none'; display-capture 'none'; clipboard-read 'none'; clipboard-write 'none'",
    );
    if (mode === "hosted")
      root._mqToolCleanup = mountPrototypeTool({
        frame,
        navigation: view === "app" ? toolNavigation : null,
        view,
        stylesheet: new URL(
          "../../tool-frame.css",
          new URL(entry, location.href),
        ).href,
      });
    return frame;
  }
  function install(t) {
    const d = n("dialog", undefined, "mq-preview-dialog");
    d.append(
      n("h2", "Install " + t.name),
      n("p", t.description),
      n("p", "Models, if needed, are downloaded separately."),
      n("p", "Installing does not grant OS or project permissions."),
      n(
        "p",
        "Prototype only: no software or model will be downloaded.",
        "mq-caption",
      ),
    );
    const row = n("div", undefined, "mq-actions");
    row.append(
      b("Cancel", () => d.close()),
      b(
        "Install",
        () => {
          s.installed.add(t.id);
          d.close();
          s.notice = t.name + " installed in this preview only.";
          draw();
        },
        true,
      ),
    );
    d.append(row);
    d.onclose = () => d.remove();
    document.body.append(d);
    d.showModal();
  }
  function overview(t) {
    const installed = s.installed.has(t.id),
      disabled = s.disabled.has(t.id);
    main.append(
      b("← All apps", () => {
        s.detail = null;
        s.notice = "";
        draw();
      }),
    );
    const hero = n("div", undefined, "mq-overview-hero"),
      icon = n("span", undefined, "mq-app-icon");
    icon.append(svgIcon(t.id.split(".").at(-1)));
    const text = n("div");
    text.append(
      n("h2", t.name),
      n(
        "p",
        installed
          ? disabled
            ? "Installed · Disabled"
            : "Installed · Enabled"
          : "Not installed",
        "mq-app-status",
      ),
    );
    hero.append(icon, text);
    main.append(hero, n("p", t.description, "mq-overview-description"));
    const actions = n("div", undefined, "mq-actions");
    if (installed) {
      const open = b("Open app", () => move(t.id), true);
      open.disabled = disabled;
      actions.append(
        open,
        b(disabled ? "Enable app" : "Disable app", () => {
          if (t.id === "com.matiq.voice" && s.recording) {
            s.notice = "Stop the sample recording before disabling Voice.";
          } else {
            disabled ? s.disabled.delete(t.id) : s.disabled.add(t.id);
            s.notice = t.name + (disabled ? " enabled." : " disabled.");
          }
          draw();
        }),
        b("Roll back", () => {
          s.notice =
            "Prototype: the retained previous version would be restored and automatic downloads paused. Your saved work is kept.";
          draw();
        }),
        b("Uninstall", () => {
          if (t.id === "com.matiq.voice" && s.recording) {
            s.notice = "Stop the sample recording before uninstalling Voice.";
            draw();
            return;
          }
          const d = n("dialog", undefined, "mq-preview-dialog");
          d.append(
            n("h2", "Uninstall " + t.name + "?"),
            n(
              "p",
              "The app is removed from your installed apps. Projects, settings and shared models are kept. This changes the preview only.",
            ),
          );
          const row = n("div", undefined, "mq-actions");
          row.append(
            b("Cancel", () => d.close()),
            b(
              "Uninstall",
              () => {
                s.installed.delete(t.id);
                s.disabled.delete(t.id);
                s.running.delete(t.id);
                d.close();
                s.notice =
                  t.name + " uninstalled in this preview. Saved work is kept.";
                draw();
              },
              true,
            ),
          );
          d.append(row);
          d.onclose = () => d.remove();
          document.body.append(d);
          d.showModal();
        }),
      );
    } else actions.append(b("Install app", () => install(t), true));
    main.append(actions);
    const content = n("div", undefined, "mq-overview-content"),
      about = n("section"),
      facts = n("aside", undefined, "mq-app-facts");
    about.append(
      n("h3", "Overview"),
      n(
        "p",
        t.id === "com.matiq.voice"
          ? "Dictate into your everyday apps or transcribe recordings using a model running on your computer. Choose and download a speech model separately after installation."
          : t.id === "com.matiq.companion"
            ? "Chat with a local language model, attach files and choose which actions each conversation can use. Choose and download a language model separately after installation."
            : t.description,
      ),
      n("h3", "Permissions"),
      n(
        "p",
        t.id === "com.matiq.voice"
          ? "Microphone for dictation. Accessibility and Input Monitoring for shortcuts and text insertion."
          : t.id === "com.matiq.companion"
            ? "Screen Recording to see your screen. Accessibility for approved mouse and keyboard actions."
            : "Any required permissions are requested by this app when needed. Installation does not grant OS access.",
      ),
      n(
        "p",
        "Installing an app does not grant these permissions. Your work remains on this device.",
      ),
    );
    for (const [label, value] of [
      ["Version", t.version],
      ["Publisher", "MatiQ Solutions"],
      ["Installation", installed ? "Installed" : "Not installed"],
      [
        "Models",
        ["com.matiq.voice", "com.matiq.companion"].includes(t.id)
          ? "Downloaded separately"
          : "App specific",
      ],
      ["Data", "Stored locally"],
    ]) {
      const fact = n("div");
      fact.append(n("dt", label), n("dd", value));
      facts.append(fact);
    }
    content.append(about, facts);
    main.append(content);
  }
  if (s.page === "library") {
    const intro = n("div", undefined, "mq-home-intro");
    intro.append(n("h2", "Your apps"), n("p", "Pick up where you left off."));
    main.append(intro);
    const apps = tools.filter(
      (t) => s.installed.has(t.id) && !s.disabled.has(t.id),
    );
    if (apps.length) {
      const grid = n("div", undefined, "mq-home-apps");
      for (const t of apps) {
        const tile = b("", () => move(t.id));
        tile.className = "mq-home-app";
        const icon = n("span", undefined, "mq-app-icon");
        icon.append(svgIcon(t.id.split(".").at(-1)));
        tile.append(icon, n("strong", t.name.replace("MatiQ ", "")));
        grid.append(tile);
      }
      main.append(grid);
    } else
      main.append(
        n(
          "p",
          s.installed.size
            ? "Your apps are disabled. Enable an app in the marketplace to open it."
            : "Choose your first app from the marketplace.",
        ),
        b("Browse marketplace", () => move("marketplace"), true),
      );
  } else if (s.page === "marketplace") {
    if (s.detail) overview(tools.find((t) => t.id === s.detail));
    else {
      main.append(
        n("h2", "Marketplace"),
        n("p", "Discover apps and manage the ones you’ve installed."),
      );
      const controls = n("div", undefined, "mq-market-controls"),
        search = n("input");
      search.type = "search";
      search.placeholder = "Search apps";
      search.setAttribute("aria-label", "Search apps");
      search.value = s.query;
      const filter = n("select");
      filter.setAttribute("aria-label", "Filter apps");
      for (const [id, label] of [
        ["all", "All apps"],
        ["installed", "Installed"],
        ["available", "Not installed"],
      ]) {
        const option = n("option", label);
        option.value = id;
        option.selected = s.filter === id;
        filter.append(option);
      }
      controls.append(search, filter);
      main.append(controls);
      const wrap = n("div", undefined, "mq-table-wrap");
      wrap.setAttribute("role", "region");
      wrap.setAttribute("aria-label", "Marketplace apps");
      wrap.tabIndex = 0;
      const table = n("table", undefined, "mq-market-table"),
        caption = n("caption", "Available apps");
      table.append(caption);
      const thead = n("thead"),
        tr = n("tr");
      for (const title of ["App", "Status", "Version", "Publisher"]) {
        const th = n("th", title);
        th.scope = "col";
        tr.append(th);
      }
      thead.append(tr);
      const tbody = n("tbody");
      table.append(thead, tbody);
      wrap.append(table);
      main.append(wrap);
      function results() {
        tbody.replaceChildren();
        const list = tools.filter(
          (t) =>
            (t.name + " " + t.description)
              .toLowerCase()
              .includes(s.query.toLowerCase()) &&
            (s.filter === "all" ||
              (s.filter === "installed" && s.installed.has(t.id)) ||
              (s.filter === "available" && !s.installed.has(t.id))),
        );
        for (const t of list) {
          const row = n("tr"),
            app = n("td"),
            name = b(t.name, () => {
              s.detail = t.id;
              s.notice = "";
              draw();
            });
          name.className = "mq-app-name";
          const icon = n("span", undefined, "mq-app-icon");
          icon.append(svgIcon(t.id.split(".").at(-1)));
          const info = n("div");
          info.append(name, n("p", t.description));
          const cell = n("div", undefined, "mq-app-cell");
          cell.append(icon, info);
          app.append(cell);
          row.append(
            app,
            n(
              "td",
              s.installed.has(t.id)
                ? s.disabled.has(t.id)
                  ? "Disabled"
                  : "Installed"
                : "Not installed",
            ),
            n("td", t.version),
            n("td", "MatiQ Solutions"),
          );
          row.onclick = (e) => {
            if (!e.target.closest("button,a")) {
              s.detail = t.id;
              s.notice = "";
              draw();
            }
          };
          tbody.append(row);
        }
        if (!list.length) {
          const row = n("tr"),
            cell = n(
              "td",
              "No apps match. Try another search or choose All apps.",
            );
          cell.colSpan = 4;
          row.append(cell);
          tbody.append(row);
        }
      }
      search.oninput = () => {
        s.query = search.value;
        results();
      };
      filter.onchange = () => {
        s.filter = filter.value;
        results();
      };
      results();
    }
  } else if (s.page === "updates") {
    main.append(
      n("h2", "Updates for your installed tools."),
      b("Check for updates", () => {
        s.staged = !!s.installed.size;
        s.notice = s.staged
          ? "Sample update downloaded for installed tools. Restart required."
          : "No tools installed.";
        draw();
      }),
      document.createTextNode(" "),
      b("Restart to apply updates", () => {
        s.notice = s.recording
          ? "Finish the sample recording before restarting."
          : s.staged
            ? "Sample update applied. Saved work is kept."
            : "No downloaded updates to apply.";
        if (!s.recording) s.staged = false;
        draw();
      }),
      n(
        "p",
        s.staged
          ? "Update downloaded · restart required"
          : "No newer compatible updates are available.",
      ),
      n(
        "p",
        "New tools are never automatically installed. Restart waits for active work to finish.",
      ),
    );
  } else if (s.page === "settings") {
    const tabs = n("nav", undefined, "mq-settings-tabs");
    tabs.setAttribute("aria-label", "Settings sections");
    for (const [id, label] of [
      ["general", "Solutions"],
      ...tools.filter((t) => s.installed.has(t.id)).map((t) => [t.id, t.name]),
    ]) {
      const tab = b(label, () => {
        s.settingsApp = id;
        draw();
      });
      tab.setAttribute("aria-current", s.settingsApp === id ? "page" : "false");
      tabs.append(tab);
    }
    main.append(tabs);
    const selected = tools.find(
      (t) => t.id === s.settingsApp && s.installed.has(t.id),
    );
    if (selected) {
      main.classList.add("mq-app-settings-page");
      main.append(toolFrame(selected, "settings"));
    } else {
      main.append(
        n("h2", "Local by default."),
        b("Downloads & updates", () => move("updates")),
      );
      const label = n("label", undefined, "mq-setting"),
        check = n("input");
      check.type = "checkbox";
      check.checked = s.autoUpdate;
      check.onchange = () => {
        s.autoUpdate = check.checked;
      };
      label.append(
        check,
        document.createTextNode(
          " Download compatible updates for installed tools automatically",
        ),
      );
      main.append(
        label,
        n(
          "p",
          "Projects and models stay on this computer. Uninstalling tools preserves your work.",
        ),
        n("p", "Suite version 0.1.1 · darwin-arm64"),
        n(
          "p",
          "Prototype only: installed app settings are unchanged.",
          "mq-caption",
        ),
        b("Check for app updates", () => {
          s.notice = "Prototype: app update check complete.";
          draw();
        }),
      );
    }
  } else if (tools.some((t) => t.id === s.page)) {
    main.classList.add("mq-tool-workspace");
    main.append(
      toolFrame(
        tools.find((t) => t.id === s.page),
        "app",
      ),
    );
  }
  work.append(main);
  root.append(work);
  if (s.review) {
    const panel = n("aside", undefined, "mq-reviewdrawer");
    panel.setAttribute("aria-label", "Prototype feedback");
    panel.append(
      b("Close feedback", () => {
        s.review = false;
        draw();
      }),
      n("h2", "Design feedback"),
      n(
        "p",
        "This revision uses the installed suite’s styles and assets. Comments save across authorized devices. Apply changes only when explicitly requested in chat.",
      ),
      b("Comment on this screen", () => openResponse(contextId()), true),
      b("Comment on shared shell", () => openResponse("shell")),
      b("General feedback", () => openResponse("general")),
    );
    const link = n("a", "Export feedback JSON");
    link.href = api("export");
    panel.append(link, n("h3", entries.length + " saved responses"));
    for (const e of entries.slice().reverse()) {
      const item = n("article", undefined, "mq-saved");
      item.append(
        n("strong", context(e.context).title),
        n("small", e.kind + (e.decision ? " · " + e.decision : "")),
        n("p", e.note),
      );
      panel.append(item);
    }
    root.append(panel);
  }
}

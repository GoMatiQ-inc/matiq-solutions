const fs = require("node:fs/promises"),
  path = require("node:path"),
  crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");
const { validToolId } = require("./index.cjs");
const read = async (p) => JSON.parse(await fs.readFile(p, "utf8"));
const exists = async (p) =>
  fs.access(p).then(
    () => true,
    () => false,
  );
const write = async (p, v) => {
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, JSON.stringify(v, null, 2) + "\n");
};
const hash = (data) => crypto.createHash("sha256").update(data).digest("hex");
function inside(root, relative) {
  if (typeof relative !== "string" || !relative || path.isAbsolute(relative))
    throw Error("Use a relative prototype path.");
  const full = path.resolve(root, relative);
  if (!full.startsWith(path.resolve(root) + path.sep))
    throw Error("Keep prototype files inside their repository.");
  return full;
}
async function files(root) {
  const result = [];
  async function walk(p) {
    for (const e of await fs.readdir(p, { withFileTypes: true })) {
      if (e.name === "node_modules" || e.name === ".git") continue;
      const f = path.join(p, e.name);
      if (e.isSymbolicLink())
        throw Error(
          "Replace prototype source symlinks with explicit repository files: " +
            f,
        );
      if (e.isDirectory()) await walk(f);
      else result.push(f);
    }
  }
  await walk(root);
  return result.sort();
}
async function config(root) {
  const c = await read(path.join(root, "prototype/manifest.json"));
  if (
    c.schema !== 1 ||
    !validToolId(c.id) ||
    !Array.isArray(c.roots) ||
    !c.roots.length
  )
    throw Error(
      "Run matiq-tool prototype init to create a valid prototype manifest.",
    );
  inside(root, c.workspace);
  inside(root, c.bridge);
  for (const r of c.roots) inside(root, r);
  for (const [a, b] of Object.entries(c.overrides || {})) {
    inside(root, a);
    inside(root, b);
  }
  return c;
}
async function shellRoot(root, explicit) {
  if (explicit) {
    await fs.access(path.join(explicit, "shell.css"));
    return path.resolve(explicit);
  }
  try {
    return path.dirname(
      require.resolve("@matiq-solutions/shell/package.json", {
        paths: [root, __dirname],
      }),
    );
  } catch {
    const local = path.join(__dirname, "../shell");
    if (await exists(path.join(local, "shell.css"))) return local;
    throw Error(
      "Install the pinned @matiq-solutions/shell dependency or pass --shell <shared-shell-directory>.",
    );
  }
}
async function init(root, { bridge, suite } = {}) {
  const tool = await read(path.join(root, "matiq-tool.json"));
  const dest = path.join(root, "prototype/manifest.json");
  if (!(await exists(dest)))
    await write(dest, {
      schema: 1,
      id: tool.id,
      name: tool.name,
      workspace: tool.workspace,
      roots: [path.dirname(tool.workspace)],
      bridge: bridge || "prototype/bridge.js",
      overrides: {},
      baselineVersion: tool.version,
    });
  const c = await config(root);
  if (!(await exists(inside(root, c.bridge)))) {
    await fs.mkdir(path.dirname(inside(root, c.bridge)), { recursive: true });
    await fs.writeFile(
      inside(root, c.bridge),
      "// Prototype-only desktop bridge. Implement sample state here; never call native APIs.\nwindow.tool={request:async(name,value)=>{if(name==='load')return '';if(name==='save')return true;throw Error('Prototype command is not implemented: '+name);}};\n",
    );
  }
  if (!(await exists(path.join(root, "prototype/approval.json"))))
    await write(path.join(root, "prototype/approval.json"), {
      status: "draft",
      instruction:
        "Review standalone and suite prototypes with the owner. Record explicit approval before implementing or packaging changes.",
    });
  if (suite) await register(root, suite);
  return c;
}
async function digest(root, { shell } = {}) {
  const c = await config(root),
    shared = await shellRoot(root, shell),
    entries = [];
  const all = new Set([
    inside(root, "prototype/manifest.json"),
    inside(root, c.bridge),
    ...Object.values(c.overrides || {}).map((p) => inside(root, p)),
  ]);
  for (const r of c.roots)
    for (const f of await files(inside(root, r))) all.add(f);
  for (const f of [...all].sort())
    entries.push([
      path.relative(root, f).split(path.sep).join("/"),
      hash(await fs.readFile(f)),
    ]);
  for (const f of await files(shared))
    if (!path.relative(shared, f).split(path.sep).includes("node_modules"))
      entries.push([
        "@shell/" + path.relative(shared, f).split(path.sep).join("/"),
        hash(await fs.readFile(f)),
      ]);
  const registration = await read(
    path.join(root, "prototype/registration.local.json"),
  ).catch(() => null);
  if (registration) {
    for (const name of ["shell.js", "style.css", "host.js", "index.html"]) {
      const file = path.join(registration.suite, "prototype", name);
      if (await exists(file))
        entries.push(["@suite/" + name, hash(await fs.readFile(file))]);
    }
  }
  return hash(JSON.stringify(entries));
}
async function approval(root, options = {}) {
  const a = await read(path.join(root, "prototype/approval.json")).catch(
    () => null,
  );
  if (
    !a ||
    a.status !== "approved" ||
    !a.approvedBy?.trim() ||
    !a.approvalText?.trim() ||
    !a.approvedAt ||
    a.digest !== (await digest(root, options))
  )
    throw Error(
      "Prototype approval is missing or stale. Build and review both shell modes, obtain explicit owner approval, then record it with matiq-tool prototype approve. Never infer approval from feedback.",
    );
  return a;
}
async function approve(root, { by, text, shell } = {}) {
  if (!by?.trim() || !text?.trim())
    throw Error(
      "Record the actual approver and explicit instruction with --by and --approval-text; do not approve on the owner’s behalf.",
    );
  const local = await read(
    path.join(root, "prototype/registration.local.json"),
  ).catch(() => null);
  if (!local || !(await exists(path.join(local.suite, "prototype/tools.json"))))
    throw Error(
      "Build/register the prototype with --suite before recording approval.",
    );
  const built = await read(
    path.join(root, "prototype/last-build.local.json"),
  ).catch(() => null);
  if (!built || built.sourceDigest !== (await digest(root, { shell })))
    throw Error(
      "Build the current standalone and hosted prototype before recording approval.",
    );
  const a = {
    status: "approved",
    approvedBy: by,
    approvalText: text,
    approvedAt: new Date().toISOString(),
    digest: await digest(root, { shell }),
  };
  await write(path.join(root, "prototype/approval.json"), a);
  return a;
}
async function register(root, suite) {
  root = path.resolve(root);
  suite = path.resolve(suite);
  if (root === suite)
    throw Error(
      "A tool must register from its own repository, not the suite repository.",
    );
  const c = await config(root);
  await fs.access(path.join(suite, "prototype/shell.js"));
  let repository;
  try {
    repository = execFileSync("git", ["remote", "get-url", "origin"], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    })
      .trim()
      .replace(/^git@github.com:/, "https://github.com/")
      .replace(/\.git$/, "");
  } catch {
    repository = "";
  }
  if (
    repository &&
    !/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+$/.test(repository)
  )
    throw Error(
      "Use a public repository reference without embedded credentials.",
    );
  const file = path.join(suite, "prototype/tools.json"),
    catalog = await read(file).catch(() => ({ schema: 1, tools: [] }));
  catalog.tools = catalog.tools.filter((t) => t.id !== c.id);
  catalog.tools.push({
    id: c.id,
    name: c.name,
    repository,
    manifest: "prototype/manifest.json",
  });
  catalog.tools.sort((a, b) => a.id.localeCompare(b.id));
  await write(file, catalog);
  const localFile = path.join(suite, "prototype/tools.local.json"),
    local = await read(localFile).catch(() => ({}));
  local[c.id] = root;
  await write(localFile, local);
  await write(path.join(root, "prototype/registration.local.json"), { suite });
  return c;
}
async function copyTree(from, to, allow = () => true) {
  for (const f of await files(from)) {
    if (!allow(f)) continue;
    const dest = path.join(to, path.relative(from, f));
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.copyFile(f, dest);
  }
}
async function build(
  root,
  { output = path.join(root, ".prototype"), shell } = {},
) {
  root = path.resolve(root);
  output = path.resolve(output);
  if (output === root || root.startsWith(output + path.sep))
    throw Error(
      "Choose a generated output directory, never the source repository.",
    );
  const c = await config(root),
    shared = await shellRoot(root, shell);
  for (const r of c.roots) {
    const source = inside(root, r);
    if (output === source || output.startsWith(source + path.sep))
      throw Error("Keep generated output outside renderer source roots.");
    await copyTree(source, path.join(output, r), (f) =>
      /\.(?:html|css|js|mjs|png|svg|woff2?|txt|json)$/.test(f),
    );
  }
  await copyTree(shared, path.join(output, ".matiq-shell"), (f) =>
    /\.(?:css|png|svg|woff2?|txt)$/.test(f),
  );
  const bridge = inside(root, c.bridge);
  await fs.mkdir(path.dirname(inside(output, c.bridge)), { recursive: true });
  await fs.copyFile(bridge, inside(output, c.bridge));
  for (const [target, source] of Object.entries(c.overrides || {})) {
    await fs.mkdir(path.dirname(inside(output, target)), { recursive: true });
    await fs.copyFile(inside(root, source), inside(output, target));
  }
  const htmlFile = inside(output, c.workspace);
  let html = await fs.readFile(htmlFile, "utf8");
  html = html.replace(
    /(?:\.\.\/)+node_modules\/@matiq-solutions\/shell\/assets\//g,
    path
      .relative(
        path.dirname(htmlFile),
        path.join(output, ".matiq-shell/assets"),
      )
      .split(path.sep)
      .join("/") + "/",
  );
  const rel = (p) =>
    path
      .relative(path.dirname(htmlFile), path.join(output, p))
      .split(path.sep)
      .join("/");
  const mode = "prototype-mode.js";
  await fs.writeFile(
    path.join(output, mode),
    "if(new URLSearchParams(location.search).get('mode')!=='standalone'){const s=document.createElement('link');s.rel='stylesheet';s.href=new URL('.matiq-shell/suite-tool.css',document.currentScript.src).href;document.head.append(s);}\n",
  );
  html = html.replace(
    "</head>",
    `<link rel="stylesheet" href="${rel(".matiq-shell/shell.css")}"><script src="${rel(mode)}"></script><script src="${rel(c.bridge)}"></script></head>`,
  );
  await fs.writeFile(htmlFile, html);
  await fs.mkdir(output, { recursive: true });
  await fs.writeFile(
    path.join(output, "index.html"),
    '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' +
      c.name.replace(/[<>&"]/g, "") +
      '</title></head><body><script src="prototype-entry.js"></script></body></html>',
  );
  await fs.writeFile(
    path.join(output, "prototype-entry.js"),
    "location.replace(" + JSON.stringify(c.workspace) + "+location.search);\n",
  );
  const provenance = {
    schema: 1,
    id: c.id,
    baselineVersion: c.baselineVersion,
    sourceDigest: await digest(root, { shell }),
    generatedAt: new Date().toISOString(),
    nativeOperations: "simulated",
  };
  await write(path.join(output, "prototype-source.json"), provenance);
  await write(path.join(root, "prototype/last-build.local.json"), provenance);
  return provenance;
}
async function buildSuite(
  suite,
  { output = path.join(suite, ".prototype"), shell } = {},
) {
  suite = path.resolve(suite);
  output = path.resolve(output);
  const shared = await shellRoot(suite, shell);
  await copyTree(path.join(suite, "prototype"), output, (f) =>
    /\.(?:html|css|js)$/.test(f),
  );
  await copyTree(shared, path.join(output, ".matiq-shell"), (f) =>
    /\.(?:css|png|svg|woff2?|txt)$/.test(f),
  );
  const catalog = await read(path.join(suite, "prototype/tools.json")),
    local = await read(path.join(suite, "prototype/tools.local.json")).catch(
      () => ({}),
    ),
    tools = [];
  for (const entry of catalog.tools) {
    if (!local[entry.id])
      throw Error(
        "Register the local checkout for " +
          entry.id +
          " with matiq-tool prototype register --suite <suite-root>.",
      );
    const root = local[entry.id],
      c = await config(root);
    if (c.id !== entry.id)
      throw Error("Registered checkout has a different tool ID.");
    await build(root, {
      output: path.join(output, "tools", entry.id),
      shell: shared,
    });
    let manifest = await read(path.join(root, "matiq-tool.json"));
    tools.push({
      id: entry.id.split(".").at(-1),
      toolId: entry.id,
      name: c.name,
      description: manifest.description,
      version: manifest.version,
      prototype: "tools/" + entry.id + "/index.html",
    });
  }
  await write(path.join(output, "catalog.json"), { tools });
  return { output, tools: tools.map((t) => t.toolId) };
}
async function main(args, root = process.cwd()) {
  const command = args[0],
    value = (flag) =>
      args.includes(flag) ? args[args.indexOf(flag) + 1] : undefined,
    suite = value("--suite") || process.env.MATIQ_SOLUTIONS_PROTOTYPE;
  const options = { shell: value("--shell") };
  if (
    ["build", "register"].includes(command) &&
    !(await exists(path.join(root, "prototype/manifest.json")))
  )
    await init(root);
  if (command === "init")
    return init(root, { bridge: value("--bridge"), suite });
  if (command === "register") {
    if (!suite)
      throw Error(
        "Pass --suite <solutions-repository> or set MATIQ_SOLUTIONS_PROTOTYPE.",
      );
    return register(root, suite);
  }
  if (command === "build") {
    if (suite) {
      await register(root, suite);
      return buildSuite(suite, {
        ...options,
        output: value("--output") || path.join(suite, ".prototype"),
      });
    }
    return build(root, {
      ...options,
      ...(value("--output") ? { output: value("--output") } : {}),
    });
  }
  if (command === "suite")
    return buildSuite(root, {
      ...options,
      ...(value("--output") ? { output: value("--output") } : {}),
    });
  if (command === "approve")
    return approve(root, {
      ...options,
      by: value("--by"),
      text: value("--approval-text"),
    });
  if (command === "check") return approval(root, options);
  throw Error("Use prototype init, register, build, suite, approve or check.");
}
module.exports = {
  init,
  config,
  digest,
  approval,
  approve,
  register,
  build,
  buildSuite,
  main,
};

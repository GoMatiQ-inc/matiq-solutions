const fs = require("node:fs/promises");
const config = JSON.parse(
  require("node:fs").readFileSync(process.env.MATIQ_FIXTURE_CONFIG, "utf8"),
);
require("../app/main.cjs")
  .launch({
    ...config,
    download: async (url) => fs.readFile(config.packages[url]),
  })
  .catch((e) => {
    console.error(e);
    require("electron").app.exit(1);
  });

window.matiqIcon = function (kind) {
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
    const p = document.createElementNS(ns, "path");
    p.setAttribute(
      "d",
      kind === "voice"
        ? "M4 10v4m4-8v12m4-15v18m4-15v12m4-8v4"
        : kind === "companion"
          ? "M8 5H6a3 3 0 0 0-3 3v8a3 3 0 0 0 3 3h2v3l4-3h6a3 3 0 0 0 3-3v-2M15 2l1.4 4.6L21 8l-4.6 1.4L15 14l-1.4-4.6L9 8l4.6-1.4Z"
          : kind === "settings"
            ? "M9.5 3h5l.6 2.5 2 .9 2.3-.8 2.5 4.3-1.8 1.8v2.6l1.8 1.8-2.5 4.3-2.3-.8-2 .9-.6 2.5h-5l-.6-2.5-2-.9-2.3.8-2.5-4.3 1.8-1.8v-2.6L1.7 9.9l2.5-4.3 2.3.8 2-.9L9.5 3Z"
            : "M4 4h6v6H4zm10 0h6v6h-6zM4 14h6v6H4zm10 0h6v6h-6z",
    );
    for (const [a, v] of Object.entries({
      fill: "none",
      stroke: "currentColor",
      "stroke-width": 1.5,
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
    }))
      p.setAttribute(a, v);
    svg.append(p);
    if (kind === "settings") {
      const c = document.createElementNS(ns, "circle");
      for (const [a, v] of Object.entries({
        cx: 12,
        cy: 12,
        r: 3,
        fill: "none",
        stroke: "currentColor",
        "stroke-width": 1.5,
      }))
        c.setAttribute(a, v);
      svg.append(c);
    }
  }
  return svg;
};

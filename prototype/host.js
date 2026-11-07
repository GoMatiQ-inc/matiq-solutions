// Local export host. Published reviews supply their own durable feedback adapter.
let report,
  entries = [];
function el(tag, text, cls) {
  const n = document.createElement(tag);
  if (text !== undefined) n.textContent = text;
  if (cls) n.className = cls;
  return n;
}
function context(id) {
  return report.contexts.find((c) => c.id === id) || { title: id };
}
function api() {
  return "#feedback";
}
function openResponse(id) {
  const event = new CustomEvent("matiq:prototype-feedback", {
    detail: { context: id },
    cancelable: true,
  });
  if (window.dispatchEvent(event))
    alert(
      "Use the published private prototype review to save feedback across devices. This local design export does not save comments.",
    );
}
(async () => {
  try {
    const response = await fetch("catalog.json");
    if (!response.ok)
      throw Error("Rebuild the suite prototype so catalog.json is available.");
    const catalog = await response.json();
    report = {
      prototype_logo: ".matiq-shell/assets/matiq-solutions-wordmark-dark.png",
      prototype_tools: catalog.tools,
      contexts: [
        { id: "general", title: "General feedback" },
        { id: "shell", title: "Shared shell" },
        { id: "library", title: "Home" },
        { id: "marketplace", title: "Marketplace" },
        { id: "tool-details", title: "App overview" },
        { id: "voice-workspace", title: "Voice" },
        { id: "companion-workspace", title: "Companion" },
      ],
    };
    solutionsPrototype(document.querySelector("#content"));
  } catch (error) {
    document.querySelector("#content").textContent =
      "Prototype could not load: " + error.message;
  }
})();

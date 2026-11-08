// Prototype composition only: native renderer code and shared SDK styles stay unchanged.
function mountPrototypeTool({ frame, navigation, view }) {
  let observer;
  function attach() {
    observer?.disconnect();
    if (!frame.isConnected) return;
    const doc = frame.contentDocument;
    if (!doc?.body) return;
    let selected = false;
    function sync() {
      if (!frame.isConnected) return;
      const sidebar = doc.querySelector(".sidebar");
      if (!sidebar) return;
      const controls = [...sidebar.querySelectorAll("nav button")].filter(
        (button) => !button.classList.contains("chat-history"),
      );
      const settings = [...sidebar.querySelectorAll("button")].find(
        (button) =>
          button.dataset.page === "settings" ||
          button.id === "settings-nav" ||
          button.textContent.trim().toLowerCase() === "settings",
      );
      const setup = doc.querySelector("#open-setup"),
        preferences = doc.querySelector("#page-settings");
      if (setup && preferences && !preferences.contains(setup))
        preferences.prepend(setup);
      if (view === "settings" && !selected && controls.length) {
        selected = true;
        if (settings) settings.click();
        else {
          frame.hidden = true;
          const message = document.createElement("p");
          message.className = "mq-settings-empty";
          message.textContent = "This app has no additional settings.";
          frame.after(message);
        }
      }
      if (!navigation) return;
      navigation.replaceChildren();
      for (const source of controls) {
        if (source === settings) continue;
        const label =
          source.getAttribute("aria-label") || source.textContent.trim();
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = label === "New chat" ? "+" : label;
        button.className = "mq-tool-tab";
        button.setAttribute("aria-label", label);
        button.title = label;
        button.disabled = source.disabled;
        if (source.classList.contains("active"))
          button.setAttribute("aria-current", "page");
        button.onclick = () => source.click();
        navigation.append(button);
      }
    }
    sync();
    const sidebar = doc.querySelector(".sidebar");
    if (sidebar) {
      observer = new MutationObserver(sync);
      observer.observe(sidebar, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ["class", "disabled"],
      });
    }
  }
  frame.addEventListener("load", attach);
  return () => {
    observer?.disconnect();
    frame.removeEventListener("load", attach);
  };
}

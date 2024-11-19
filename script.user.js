// ==UserScript==
// @name Community fixes for osu! website
// @namespace Violentmonkey Scripts
// @match https://osu.ppy.sh/*
// @grant none
// @version 1.21
// @description Community fixes for osu! website
// @updateURL https://github.com/seneaLL/osu-community-plus/blob/master/script.user.js
// @downloadURL https://github.com/seneaLL/osu-community-plus/blob/master/script.user.js
// ==/UserScript==

const selectors = {
  user__profile: ".user-profile-pages.ui-sortable",
  user__menu: ".simple-menu.simple-menu--nav2.js-click-menu.js-nav2--centered-popup",
  beatmapsets__json: "#json-beatmaps",
  beatapset__popup: "js-portal",
  beatmapset__popup__item: ".beatmaps-popup-item",
};

let settings = { beatmaps: { showLength: true }, profileOrder: ["me", "recent_activity", "top_ranks", "historical", "medals", "beatmaps", "kudosu"] };

// Core/Initialization Functions

const init = () => {
  const pathname = window.location.pathname;

  parseSettings();
  injectStyles();

  waitForContainer(selectors.user__menu, setupSettingsMenu);

  if (pathname.includes("/beatmapsets") && settings.beatmaps.showLength) waitForContainer(selectors.beatmapsets__json, setupBeatmapsetsPage);
  if (pathname.includes("/users/")) waitForContainer(selectors.user__profile, sortProfilePages);
};

const observerPathname = () => {
  init();

  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;

  history.pushState = function (state, title, url) {
    const result = originalPushState.apply(this, arguments);
    window.dispatchEvent(new Event("popstate"));
    return result;
  };

  history.replaceState = function (state, title, url) {
    const result = originalReplaceState.apply(this, arguments);
    window.dispatchEvent(new Event("popstate"));
    return result;
  };

  window.addEventListener("popstate", init);
};

const parseSettings = () => {
  const localSettings = JSON.parse(localStorage.getItem("ocp-settings"));

  const isValidStructure = (obj1, obj2) => {
    if (typeof obj1 !== typeof obj2) return false;

    if (typeof obj1 === "object" && obj1 !== null && obj2 !== null) {
      const keys1 = Object.keys(obj1);
      const keys2 = Object.keys(obj2);

      if (keys1.length !== keys2.length || !keys1.every((key) => keys2.includes(key))) return false;

      return keys1.every((key) => isValidStructure(obj1[key], obj2[key]));
    }

    return true;
  };

  if (localSettings && isValidStructure(settings, localSettings)) settings = localSettings;
  else localStorage.setItem("ocp-settings", JSON.stringify(settings));
};

const injectStyles = () => {
  const style = document.createElement("style");
  style.textContent = `
                .ocp-modal *{box-sizing:border-box;margin:0}
                .ocp-modal{position:fixed;top:0;left:0;width:100%;height:100%;display:flex;align-items:center;justify-content:center;opacity:0;visibility:hidden;transition:opacity .3s,visibility .3s;z-index:1000}
                .ocp-modal--visible{opacity:1;visibility:visible}
                .ocp-modal__backdrop{position:absolute;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.5)}
                .ocp-modal__content{position:relative;display:flex;gap:20px;flex-direction:column;z-index:1001;background:hsl(var(--hsl-b6));padding:50px;border-radius:8px;box-shadow:0 4px 10px rgba(0,0,0,.1);animation:ocp-modal-slide-in .3s ease-out}
                .ocp-modal__close-button{margin-top:10px;padding:10px 20px;border:none;background-color:#007bff;color:#fff;font-size:16px;border-radius:4px;cursor:pointer}
                .ocp-modal__close-button:hover{background-color:#0056b3}
                .ocp-profile-order{max-width:400px;margin:20px auto;border-radius:8px;box-shadow:0 4px 10px rgba(0,0,0,.1)}
                .ocp-profile-order h2{margin-bottom:20px;}
                .ocp-profile-order__list{display:flex;flex-direction:column;gap:10px;}
                .ocp-profile-order__item{padding:15px;background:hsl(var(--hsl-h1));color:#fff;border-radius:4px;text-align:center;cursor:grab;transition:transform .2s}
                .ocp-profile-order__item:active{cursor:grabbing;transform:scale(1.05)}
                .ocp-profile-order__item.inactive{opacity:.5;transition:opacity .2s}
            `;
  document.head.appendChild(style);

  logger("Styles completed injected");
};

// Utility Functions

const logger = (message) => {
  const date = new Date().toISOString().replace(/T/, " ").replace(/\..+/, "");
  const logMessage = `[OCP] ${date} - ${message}`;

  console.log(logMessage);
};

const formatTime = (seconds) => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${padZero(minutes)}:${padZero(remainingSeconds)}`;
};

const padZero = (value) => (value < 10 ? `0${value}` : value);

const extractBeatmapId = (href) => {
  const match = href.match(/\/beatmaps\/(\d+)$/);
  return match ? Number(match[1]) : null;
};

const waitForContainer = (selector, callback) => {
  const observer = new MutationObserver(() => {
    const container = document.querySelector(selector);

    if (container) {
      callback();
      observer.disconnect();
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
};

// Beatmap Related Functions
const beatmapCache = new Map();

const addBeatmapsToCache = (data) => {
  if (!data?.beatmapsets) return;

  data.beatmapsets.forEach(({ beatmaps }) => {
    beatmaps.forEach((beatmap) => {
      if (!beatmapCache.has(beatmap.id)) {
        beatmapCache.set(beatmap.id, beatmap);
      }
    });
  });
};

const formatBeatmapLengths = ({ total_length, hit_length }) => ({
  totalLength: formatTime(total_length),
  hitLength: formatTime(hit_length),
});

const createBadge = (difficultyBadge, { totalLength, hitLength }, isExpert = false) => {
  const badge = document.createElement("div");
  badge.className = "beatmap-list-item__col";

  const durationBadge = document.createElement("div");
  durationBadge.className = `difficulty-badge ${isExpert ? "difficulty-badge difficulty-badge--expert-plus" : ""}`;
  durationBadge.style.setProperty("--bg", difficultyBadge.style.getPropertyValue("--bg"));
  durationBadge.innerHTML = `<span class="difficulty-badge__icon"><span class="fas fa-clock"></span></span><span class="difficulty-badge__rating">${totalLength} (${hitLength})</span>`;

  badge.appendChild(durationBadge);

  return badge;
};

const fetchAndCacheBeatmaps = (url) => {
  fetch(url)
    .then((res) => res.json())
    .then(addBeatmapsToCache)
    .catch((err) => console.error("Error fetching beatmaps:", err));
};

const interceptBeatmapSearchRequests = () => {
  const targetUrl = "https://osu.ppy.sh/beatmapsets/search";
  const originalOpen = XMLHttpRequest.prototype.open;

  XMLHttpRequest.prototype.open = function (method, url, ...args) {
    if (method === "GET" && url.startsWith(targetUrl)) {
      logger("Intercepted GET request: " + url);
      fetchAndCacheBeatmaps(url);
    }
    return originalOpen.apply(this, [method, url, ...args]);
  };
};

const setupBeatmapsetsPage = () => {
  const initialData = document.querySelector(selectors.beatmapsets__json)?.textContent;
  if (initialData) addBeatmapsToCache(JSON.parse(initialData));

  monitorDOMForBeatmapPopups();
  interceptBeatmapSearchRequests();
};

const monitorDOMForBeatmapPopups = () => {
  const observer = new MutationObserver((mutations) => {
    mutations.forEach(({ addedNodes }) => {
      addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE && node.classList.contains(selectors.beatapset__popup))
          node.querySelectorAll(selectors.beatmapset__popup__item).forEach(addDurationBadgeToBeatmapItem);
      });
    });
  });

  observer.observe(document.body, { childList: true, subtree: true });
  logger("Started monitoring DOM for 'js-portal' elements");
};

const addDurationBadgeToBeatmapItem = (beatmapItem) => {
  const beatmapId = extractBeatmapId(beatmapItem.href);
  if (!beatmapId) return;

  const beatmap = beatmapCache.get(beatmapId);
  if (!beatmap) return;

  const difficultyBadge = beatmapItem.querySelector(".difficulty-badge");
  if (!difficultyBadge) return;

  const beatmapListItem = difficultyBadge.closest(".beatmap-list-item");
  if (!beatmapListItem) return;

  beatmapListItem.style.cssText = "width: 100%; display: flex;";

  const formattedLengths = formatBeatmapLengths(beatmap);
  const durationBadge = createBadge(difficultyBadge, formattedLengths, beatmap.difficulty_rating >= 6.5);

  const mainCol = beatmapListItem.querySelector(".beatmap-list-item__col--main");
  if (mainCol) mainCol.insertAdjacentElement("beforebegin", durationBadge);
};

// Settings UI Functions

const setupSettingsMenu = () => {
  const elements = document.querySelectorAll(selectors.user__menu);

  for (const element of elements) {
    const settingsButton = document.createElement("button");
    settingsButton.className = "simple-menu__item";
    settingsButton.type = "button";
    settingsButton.textContent = "OCP settings";

    settingsButton.addEventListener("click", () => {
      const existingModal = document.querySelector(".ocp-modal");
      if (existingModal) return;

      const modal = createSettingsModal();
      setTimeout(() => modal.classList.add("ocp-modal--visible"), 10);
    });

    const logoutButton = element.querySelector(".js-logout-link");
    if (logoutButton) element.insertBefore(settingsButton, logoutButton);

    logger("Settings menu button added");
  }
};

const createSettingsModal = () => {
  const modal = document.createElement("div");
  modal.className = "ocp-modal";

  modal.innerHTML = `
                  <div class="ocp-modal__backdrop"></div>
                  <div class="ocp-modal__content">
                      <h2>OCP Settings</h2>
                      <label>
                          <input type="checkbox" id="showLengthCheckbox" ${settings.beatmaps.showLength ? "checked" : ""} />
                          Показывать длительность beatmaps
                      </label>
                      <div class="ocp-profile-order">
                          <h2>Порядок профиля</h2>
                          <div class="ocp-profile-order__list" id="sortableList">
                              ${settings.profileOrder.map((profile) => `<div class="ocp-profile-order__item" draggable="true">${profile}</div>`).join("")}
                          </div>
                      </div>
                      <button class="ocp-modal__close-button">Close & Save</button>
                  </div>
            `;
  document.body.appendChild(modal);

  const closeButton = modal.querySelector(".ocp-modal__close-button");
  const backdrop = modal.querySelector(".ocp-modal__backdrop");
  const showLengthCheckbox = modal.querySelector("#showLengthCheckbox");
  const sortableList = modal.querySelector("#sortableList");

  const closeModal = () => {
    modal.classList.remove("ocp-modal--visible");
    setTimeout(() => modal.remove(), 300);
  };

  closeButton.addEventListener("click", closeModal);
  backdrop.addEventListener("click", closeModal);

  showLengthCheckbox.addEventListener("change", () => {
    settings.beatmaps.showLength = showLengthCheckbox.checked;
    localStorage.setItem("ocp-settings", JSON.stringify(settings));
  });

  restoreOrder(sortableList);
  initializeDragAndDrop(sortableList);

  return modal;
};

// Profile Order Functions

const restoreOrder = (listElement) => {
  const savedOrder = settings.profileOrder;

  if (savedOrder && Array.isArray(savedOrder)) {
    const itemsMap = Array.from(listElement.children).reduce((map, item) => {
      map[item.textContent.trim()] = item;
      return map;
    }, {});

    savedOrder.forEach((name) => {
      const item = itemsMap[name];
      if (item) listElement.appendChild(item);
    });
  }
};

const initializeDragAndDrop = (listElement) => {
  let draggedItem = null;

  const updateOrderInLocalStorage = () => {
    const order = [...listElement.children].map((item) => item.textContent.trim());
    settings.profileOrder = order;
    localStorage.setItem("ocp-settings", JSON.stringify(settings));
    sortProfilePages();
  };

  listElement.addEventListener("dragstart", (e) => {
    draggedItem = e.target;
    e.target.classList.add("dragging");

    listElement.querySelectorAll(".ocp-profile-order__item").forEach((item) => {
      if (item !== draggedItem) item.classList.add("inactive");
    });
  });

  listElement.addEventListener("dragend", (e) => {
    e.target.classList.remove("dragging");

    listElement.querySelectorAll(".ocp-profile-order__item").forEach((item) => {
      item.classList.remove("inactive");
    });

    updateOrderInLocalStorage();

    draggedItem = null;
  });

  listElement.addEventListener("dragover", (e) => {
    e.preventDefault();
    const afterElement = getDragAfterElement(listElement, e.clientY);
    if (afterElement == null) listElement.appendChild(draggedItem);
    else listElement.insertBefore(draggedItem, afterElement);
  });
};

const getDragAfterElement = (container, y) => {
  const draggableElements = [...container.querySelectorAll(".ocp-profile-order__item:not(.dragging)")];
  return draggableElements.reduce(
    (closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > closest.offset) return { offset, element: child };
      else return closest;
    },
    { offset: Number.NEGATIVE_INFINITY },
  ).element;
};

const sortProfilePages = () => {
  const container = document.querySelector(".user-profile-pages.ui-sortable");
  if (!container) return;

  const pages = Array.from(container.querySelectorAll(".js-sortable--page"));

  pages.sort((a, b) => {
    const idA = a.getAttribute("data-page-id");
    const idB = b.getAttribute("data-page-id");

    return settings.profileOrder.indexOf(idA) - settings.profileOrder.indexOf(idB);
  });

  pages.forEach((page) => container.appendChild(page));

  logger("Profile pages sorted");
};

observerPathname();

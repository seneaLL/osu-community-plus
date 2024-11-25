// ==UserScript==
// @name Community fixes for osu! website
// @namespace Violentmonkey Scripts
// @match https://osu.ppy.sh/*
// @grant none
// @version 1.24
// @description Community fixes for osu! website
// @updateURL https://raw.githubusercontent.com/seneaLL/osu-community-plus/refs/heads/master/script.user.js
// @downloadURL https://raw.githubusercontent.com/seneaLL/osu-community-plus/refs/heads/master/script.user.js
// ==/UserScript==

/**
 * -------------------------------------------------------------
 * -                  Variables Block                          -
 * -------------------------------------------------------------
 * - selectors          - Object containing DOM selectors for  -
 * -                      interface elements                   -
 * - historyCache       - Cache for browsing history from      -
 * -                      localStorage                         -
 * - settingsCache      - Cache for application settings from  -
 * -                      localStorage                         -
 * - localPath          - Stores the previous local path       -
 * - beatmapsCache      - Map instance for beatmap caching     -
 * -------------------------------------------------------------
 */

const selectors = {
  user__profile: ".user-profile-pages.ui-sortable",
  user__menu: ".simple-menu.simple-menu--nav2.js-click-menu.js-nav2--centered-popup",
  logout__button: ".js-logout-link.simple-menu__item",
  beatmapset__json: "#json-beatmapset",
  beatmapsets__json: "#json-beatmaps",
  user__profile__json: ".js-react--profile-page",
  ocp__settings__button: "#ocp-settings__button",
  beatmapset__popup: "js-portal",
  beatmapset__popup__item: ".beatmaps-popup-item",
};

const historyCache = [];

const settingsCache = {
  beatmaps: { showLength: true },
  history: { isEnabled: false, limit: 100 },
  profile: {
    customOrder: false,
    profileOrder: ["me", "recent_activity", "top_ranks", "historical", "medals", "beatmaps", "kudosu"],
  },
};

let localPath = null;

const beatmapsCache = new Map();

/**
 * -------------------------------------------------------------
 * -                  LocalStorage Utilities                   -
 * -------------------------------------------------------------
 * - parseHistory   - Synchronizes the historyCache with data  -
 * -                  stored in localStorage. If the data is   -
 * -                  invalid, it resets the cache             -
 * - parseSettings  - Synchronizes the settingsCache with data -
 * -                  stored in localStorage. If the data is   -
 * -                  invalid or missing, it restores defaults -
 * -------------------------------------------------------------
 */

const parseHistory = () => {
  const historyData = localStorage.getItem("ocp-history");

  if (historyData) {
    const parsedHistory = JSON.parse(historyData);

    if (Array.isArray(parsedHistory)) historyCache.splice(0, historyCache.length, ...parsedHistory);
    else {
      localStorage.removeItem("ocp-history");
      historyCache.splice(0, historyCache.length);
    }
  } else historyCache.splice(0, historyCache.length);
};

const parseSettings = () => {
  const localSettings = localStorage.getItem("ocp-settings");

  if (localSettings) {
    const parsedSettings = JSON.parse(localSettings);
    const template = buildTemplate(settingsCache);

    if (parsedSettings && validateStructure(parsedSettings, template)) {
      settingsCache.beatmaps = { ...settingsCache.beatmaps, ...parsedSettings.beatmaps };
      settingsCache.history = { ...settingsCache.history, ...parsedSettings.history };
      settingsCache.profile = { ...settingsCache.profile, ...parsedSettings.profile };
    } else localStorage.setItem("ocp-settings", JSON.stringify(settingsCache));
  } else localStorage.setItem("ocp-settings", JSON.stringify(settingsCache));
};

/**
 * -------------------------------------------------------------
 * -                  Initialization Workflow                  -
 * -------------------------------------------------------------
 * - init               - Entry point for initializing the     -
 * -                      application. Logs the start and      -
 * -                      end of the initialization process    -
 * - initializeCore     - Handles core initialization tasks,   -
 * -                      such as injecting styles, loading    -
 * -                      user settings, parsing history,      -
 * -                      and saving the current path          -
 * - initializeModules  - Applies specific modifications       -
 * -                      and enhancements based on the        -
 * -                      current page and user settings       -
 * - injectStyles       - Dynamically injects a custom CSS     -
 * -                      stylesheet to modify the UI          -
 * -------------------------------------------------------------
 */

const init = () => {
  logger("Initialization started");

  initializeCore();
  initializeModules();

  logger("Initialization completed");
};

const initializeCore = () => {
  injectStyles();
  parseSettings();
  parseHistory();
  savePathToHistory();
};

const initializeModules = () => {
  const pathname = window.location.pathname;

  setupSettingsMenu();

  if (pathname.includes("/beatmapsets")) setupBeatmapsetsPage();
  if (pathname.includes("/users/")) setupProfilePage();
};

const injectStyles = () => {
  if (document.querySelector("#ocp-styles")) return;

  const style = document.createElement("style");
  style.id = "ocp-styles";

  style.textContent = `
                .ocp-modal{position:fixed;top:0;left:0;width:100%;height:100%;display:flex;align-items:center;justify-content:center;opacity:0;visibility:hidden;transition:opacity .3s,visibility .3s;z-index:1000}
                .ocp-modal *{box-sizing:border-box;margin:0}
                .ocp-modal--visible{opacity:1;visibility:visible}
                .ocp-modal__backdrop{position:absolute;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.5)}
                .ocp-modal__container{position:fixed;top:0;right:-1000px;width:540px;height:100%;padding:20px;display:flex;flex-direction:column;gap:24px;background-color:hsl(var(--hsl-b6));color:#fff;z-index:1000;transition:right .5s ease-in-out}
                .ocp-modal__container--visible{right:0}
                .ocp-modal__header{display:flex;gap:12px;justify-content:space-between;}
                .ocp-modal__divider{width:100%;height:1px;background-color:hsl(var(--hsl-h1))}
                .ocp-tab__button{padding:12px;background:0 0;border:1px solid hsl(var(--hsl-h1));color:#fff;cursor:pointer;border-radius:16px;display:flex;flex-direction:row;gap:12px;align-items:center}
                .ocp-tab__button.active{background:hsl(var(--hsl-h1))}
                .ocp-tab__button:disabled{opacity:.5;cursor:not-allowed;filter:grayscale(1)}
                .ocp-tab__button p{font-size:20px;font-weight:600}
                .ocp-tab__content{display:none}
                .ocp-tab__content.active{display:block}
                .ocp-content__title{font-size:24px;font-weight:600}
                .ocp-history__container{display:flex;flex-direction:column;width:100%;height:calc(100vh - 170px);padding:24px 0;gap:24px;overflow-y:scroll;scrollbar-width:thin;scrollbar-color:hsl(var(--hsl-h1)) transparent}
                .ocp-history__container::-webkit-scrollbar{width:4px;height:4px}
                .ocp-history__container::-webkit-scrollbar-thumb{background-color:hsl(var(--hsl-h1));border-radius:4px}
                .ocp-history__container::-webkit-scrollbar-track{background-color:transparent;border-radius:4px}
                .ocp-history__profile,.ocp-history__beatmap{position:relative;overflow:hidden;display:flex;width:290px;height:90px;border-radius:10px}
                .ocp-profile__avatar{width:70px;height:70px;border-radius:10px;object-fit:cover}
                .ocp-profile__background,.ocp-beatmap__background{position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover}
                .ocp-profile__content{position:relative;display:flex;gap:12px;padding:10px;width:100%;align-items:end}
                .ocp-beatmap__content{position:relative;display:flex;justify-content:space-between;padding:10px;width:100%;flex-direction:column}
                .ocp-profile__username{font-size:20px;font-weight:600;height:max-content}
                .ocp-beatmap__title{ white-space: nowrap; overflow: hidden; text-overflow: ellipsis}
                .bold{font-weight:600}
                .ocp-item__info{display:flex;flex-direction:column;gap:12px;width:100%}
                .ocp-item__info p{font-size:16px;font-weight:600;color:#fff;height:max-content}
                .ocp-container__item{display:flex;width:100%;flex-direction:row;gap:24px;padding:0 12px 0 0;cursor:pointer;}
                .ocp-divider__vertical{width:1px;background-color:hsl(var(--hsl-h1))}
                .ocp-dimming{position:absolute;left:0;top:0;width:100%;height:100%;background:linear-gradient(177.92deg,rgba(0,0,0,.6) 21.809%,rgba(0,0,0,.6) 140.902%)}
                .ocp-modal__icons{display:inline-block;width:30px;height:30px;background-color:currentColor;-webkit-mask-image:var(--svg);mask-image:var(--svg);-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-size:100% 100%;mask-size:100% 100%}
                .ocp-icons__settings{--svg:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%23000' d='m10.135 21l-.362-2.892q-.479-.145-1.035-.454q-.557-.31-.947-.664l-2.668 1.135l-1.865-3.25l2.306-1.739q-.045-.27-.073-.558q-.03-.288-.03-.559q0-.252.03-.53q.028-.278.073-.626L3.258 9.126l1.865-3.212L7.771 7.03q.448-.373.97-.673q.52-.3 1.013-.464L10.134 3h3.732l.361 2.912q.575.202 1.016.463t.909.654l2.725-1.115l1.865 3.211l-2.382 1.796q.082.31.092.569t.01.51q0 .233-.02.491q-.019.259-.088.626l2.344 1.758l-1.865 3.25l-2.681-1.154q-.467.393-.94.673t-.985.445L13.866 21zm1.838-6.5q1.046 0 1.773-.727T14.473 12t-.727-1.773t-1.773-.727q-1.052 0-1.776.727T9.473 12t.724 1.773t1.776.727'/%3E%3C/svg%3E")}
                .ocp-icons__timeline{--svg:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%23000' d='M3 17.5q-.633 0-1.066-.434Q1.5 16.633 1.5 16t.434-1.066T3 14.5q.189 0 .349.029t.305.137l5.012-5.012q-.108-.145-.137-.305T8.5 9q0-.633.434-1.066Q9.367 7.5 10 7.5t1.066.434T11.5 9q0 .127-.127.616l3.012 3.011q.144-.07.285-.098q.142-.029.33-.029t.34.029q.15.029.275.137l4.05-4.05q-.107-.125-.136-.276T19.5 8q0-.633.434-1.066Q20.367 6.5 21 6.5t1.066.434Q22.5 7.367 22.5 8t-.434 1.066T21 9.5q-.188 0-.34-.029q-.15-.029-.276-.137l-4.05 4.05q.07.107.098.261q.029.155.029.326q0 .633-.434 1.066Q15.633 16.5 15 16.5t-1.066-.434Q13.5 15.633 13.5 15q0-.106.098-.63l-2.95-2.95q-.155.07-.318.098q-.162.029-.33.029t-.326-.029q-.155-.028-.261-.098l-5.013 5.013q.108.126.137.276q.028.15.028.34q0 .633-.434 1.066Q3.633 17.5 3 17.5z'/%3E%3C/svg%3E")}
                .ocp-icons__user{--svg: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%23000' d='M12 4a4 4 0 0 1 4 4a4 4 0 0 1-4 4a4 4 0 0 1-4-4a4 4 0 0 1 4-4m0 10c4.42 0 8 1.79 8 4v2H4v-2c0-2.21 3.58-4 8-4'/%3E%3C/svg%3E")}
                .ocp-settings__container{display:flex;gap:24px;padding: 20px 0;flex-direction:column}
                .ocp-settings__item {display: flex; width:100%; justify-content: space-between}
                .ocp-settings__title {font-size:24px}
                .ocp-settings__switch {position: relative; display: inline-block;width:48px; height:24px}
                .ocp-settings__input { display: none }
                .ocp-settings__label {position: absolute; cursor: pointer; background-color: #ccc; border-radius: 24px; width: 100%; height: 100%; transition: background-color 0.3s ease;}
                .ocp-settings__label::before {content: ""; position: absolute; left: 4px; top: 4px; width: 16px; height: 16px; background-color: white; border-radius: 50%; transition: transform 0.3s ease;}
                .ocp-settings__input:checked + .ocp-settings__label {background-color: hsl(var(--hsl-h1));}
                .ocp-settings__input:checked + .ocp-settings__label::before {transform: translateX(24px);}
                .ocp-profile__container{}
                .ocp-profile__order{margin:20px auto;width:100%;border-radius:8px;box-shadow:0 4px 10px rgba(0,0,0,.1)}
                .ocp-profile__order h2{margin-bottom:20px;text-align:center;}
                .ocp-profile-order__list{display:flex;flex-direction:column;gap:10px;}
                .ocp-profile-order__item{padding:15px;background:hsl(var(--hsl-h1));color:#fff;border-radius:4px;text-align:center;cursor:grab;transition:transform .2s;user-select:none}
                .ocp-profile-order__item:active{cursor:grabbing;transform:scale(1.05)}
                .ocp-profile-order__item.inactive{opacity:.5;transition:opacity .2s;cursor:not-allowed;}
        `;

  document.head.appendChild(style);

  logger("Styles injected successfully");
};

/**
 * -------------------------------------------------------------
 * -                  Utility Functions                        -
 * -------------------------------------------------------------
 * - checkType          - Checks the type of a value and       -
 * - validateStructure  - Validates the structure of an object -
 * - buildTemplate      - Builds an template for object        -
 * - logger             - Logs messages with timestamps in a   -
 * -                      standardized format                  -
 * - howTimeAgo         - Calculates the time elapsed since a  -
 * -                      given date and returns a human-      -
 * -                      readable string                      -
 * - waitForContainer   - Observes DOM mutations and triggers  -
 * -                      a callback when the specified        -
 * -                      container is found                   -
 * - interceptRequests  - Intercepts XMLHttpRequest calls      -
 * -                      matching specified criteria, logs    -
 * -                      them, and executes a custom callback -
 * -                      for further processing               -
 * - addBeatmapsToCache - Adds beatmaps to the cache           -
 * - observeBeatmapsets - Monitors DOM changes to              -
 * -                      detect beatmap popups and enhance    -
 * -                      them with additional UI elements     -
 * -------------------------------------------------------------
 */

const checkType = (value) => {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
};

const validateStructure = (obj, template) => {
  for (const key in template) {
    if (template.hasOwnProperty(key)) {
      const expectedType = template[key];
      const value = obj[key];

      if (value === undefined) return false;

      if (typeof expectedType === "object" && !Array.isArray(expectedType)) {
        if (typeof value !== "object" || Array.isArray(value)) return false;
        if (!validateStructure(value, expectedType)) return false;
      } else if (checkType(value) !== expectedType) return false;
    }
  }
  return true;
};

const buildTemplate = (obj) => {
  const template = {};

  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const value = obj[key];
      if (typeof value === "object" && !Array.isArray(value)) template[key] = buildTemplate(value);
      else if (Array.isArray(value)) template[key] = "array";
      else template[key] = checkType(value);
    }
  }

  return template;
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

const formatBeatmapLengths = ({ total_length, hit_length }) => ({
  totalLength: formatTime(total_length),
  hitLength: formatTime(hit_length),
});

const logger = (message, type = "info") => {
  const timestamp = new Date().toISOString();
  console[type](`[${timestamp}] ${message}`);
};

const howTimeAgo = (date) => {
  const now = new Date();
  const diff = now - new Date(date);
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const months = Math.floor(days / 30);
  const years = Math.floor(months / 12);

  if (years > 0) return `${years} year${years > 1 ? "s" : ""} ago`;
  if (months > 0) return `${months} month${months > 1 ? "s" : ""} ago`;
  if (days > 0) return `${days} day${days > 1 ? "s" : ""} ago`;
  if (hours > 0) return `${hours} hour${hours > 1 ? "s" : ""} ago`;
  if (minutes > 0) return `${minutes} minute${minutes > 1 ? "s" : ""} ago`;

  return `${seconds} second${seconds > 1 ? "s" : ""} ago`;
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

const interceptRequests = (targetUrl, method = "GET", onIntercept) => {
  if (!targetUrl || !typeof onIntercept === "function") return;

  const originalOpen = XMLHttpRequest.prototype.open;

  XMLHttpRequest.prototype.open = function (requestMethod, requestUrl, ...args) {
    if (requestMethod === method && requestUrl.includes(targetUrl)) {
      logger(`Intercepted request: ${requestMethod} ${requestUrl}`);
      onIntercept(requestUrl);
    }

    return originalOpen.apply(this, [requestMethod, requestUrl, ...args]);
  };
};

const addBeatmapsToCache = (data) => {
  if (!data?.beatmapsets) return;

  data.beatmapsets.forEach(({ beatmaps }) => {
    beatmaps.forEach((beatmap) => {
      if (!beatmapsCache.has(beatmap.id)) beatmapsCache.set(beatmap.id, beatmap);
    });
  });
};

const observeBeatmapsets = () => {
  const observer = new MutationObserver((mutations) => {
    mutations.forEach(({ addedNodes }) => {
      addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE && node.classList.contains(selectors.beatmapset__popup))
          node.querySelectorAll(selectors.beatmapset__popup__item).forEach(addDurationBadgeToBeatmap);
      });
    });
  });

  observer.observe(document.body, { childList: true, subtree: true });
  logger(`Started monitoring DOM for '${selectors.beatmapset__popup}' elements`);
};

/**
 * -------------------------------------------------------------
 * -                  Beatmapsets Functions                    -
 * -------------------------------------------------------------
 * - setupBeatmapsetsPage       - Sets up the beatmapsets page -
 * - showBeatmapsetsLength      - Displays beatmapset length   -
 * - fetchAndCacheBeatmapsets   - Fetches and caches           -
 * -                              beatmapsets                  -
 * - addDurationBadgeToBeatmap  - Adds duration badge          -
 * -                              to beatmap                   -
 * - createBadge                - Creates a difficulty badge   -
 * -------------------------------------------------------------
 */

const setupBeatmapsetsPage = () => {
  if (settingsCache.beatmaps.showLength) waitForContainer(selectors.beatmapsets__json, showBeatmapsetsLength);
};

const showBeatmapsetsLength = () => {
  observeBeatmapsets();

  const element = document.querySelector(selectors.beatmapsets__json);
  if (!element) return;

  if (element.textContent) addBeatmapsToCache(JSON.parse(element.textContent));

  interceptRequests("https://osu.ppy.sh/beatmapsets/search", "GET", (url) => fetchAndCacheBeatmapsets(url));
};

const fetchAndCacheBeatmapsets = (url) => {
  fetch(url)
    .then((res) => res.json())
    .then(addBeatmapsToCache)
    .catch((err) => logger(`${err}`, "error"));
};

const addDurationBadgeToBeatmap = (node) => {
  const beatmapId = extractBeatmapId(node.href);
  if (!beatmapId) return;

  const beatmap = beatmapsCache.get(beatmapId);
  if (!beatmap) return;

  const difficultyBadge = node.querySelector(".difficulty-badge");
  if (!difficultyBadge) return;

  const beatmapListItem = difficultyBadge.closest(".beatmap-list-item");
  if (!beatmapListItem) return;

  beatmapListItem.style.cssText = "width: 100%; display: flex;";

  const formattedLengths = formatBeatmapLengths(beatmap);
  const durationBadge = createBadge(difficultyBadge, formattedLengths, beatmap.difficulty_rating >= 6.5);

  const mainCol = beatmapListItem.querySelector(".beatmap-list-item__col--main");
  if (mainCol) mainCol.insertAdjacentElement("beforebegin", durationBadge);
};

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

/**
 * -------------------------------------------------------------
 * -                  Profiles Functions                       -
 * -------------------------------------------------------------
 * - setupProfilePage   - Sets up the profile page by waiting  -
 * -                      for the profile container and        -
 * -                      sorting the pages if custom order    -
 * -                      is enabled                           -
 * - sortProfileOrder   - Sorts the profile pages based on     -
 * -                      the custom order specified in the    -
 * -                      settings cache, reordering the       -
 * -                      DOM elements accordingly             -
 * -------------------------------------------------------------
 */

const setupProfilePage = () => {
  if (settingsCache.profile.customOrder) waitForContainer(selectors.user__profile, sortProfileOrder);
};

const sortProfileOrder = () => {
  const container = document.querySelector(".user-profile-pages.ui-sortable");
  if (!container) return;

  const pages = Array.from(container.querySelectorAll(".js-sortable--page"));

  pages.sort((a, b) => {
    const idA = a.getAttribute("data-page-id");
    const idB = b.getAttribute("data-page-id");

    return settingsCache.profile.profileOrder.indexOf(idA) - settingsCache.profile.profileOrder.indexOf(idB);
  });

  pages.forEach((page) => container.appendChild(page));

  logger("Profile pages sorted");
};

/**
 * -------------------------------------------------------------
 * -                  Settings Functions                       -
 * -------------------------------------------------------------
 * - changeSettingsTab      - Switches between active          -
 * -                          settings tabs                    -
 * - updateSettingsCache    - Updates the settings cache and   -
 * -                          saves to localStorage            -
 * - updateHistoryTab       - Renders and updates the history  -
 * -                          tab with recent items            -
 * - updateSettingsTab      - Placeholder function for         -
 * -                          updating settings tabs           -
 * - updateProfileTab       - Renders and initializes the      -
 * -                          profile tab, including           -
 * -                          drag-and-drop functionality      -
 * -                          for profile order                -
 * - renderHistoryItem      - Generates HTML content for an    -
 * -                          individual history item based    -
 * -                          on its type (profile, beatmap)   -
 * - closeSettingsModal     - Closes the settings modal        -
 * -                          and clears any active history    -
 * -                          update intervals                 -
 * - updateModalHeader      - Updates the modal header with    -
 * -                          tab buttons and their states     -
 * - createSettingsModal    - Creates and displays             -
 * -                          the settings modal with tabs     -
 * -                          for settings, profile, and       -
 * -                          history content                  -
 * - setupSettingsMenu      - Sets up the settings menu in the -
 * -                          user menu, adding a button that  -
 * -                          shows or hides the               -
 * -                          settings modal when clicked      -
 * - tabsConfig             - Defines the configuration for    -
 * -                          the tabs used in the settings    -
 * -                          modal                            -
 * -------------------------------------------------------------
 */

const changeSettingsTab = (button) => {
  const tabName = button.dataset.tab;
  const tabConfig = tabsConfig[tabName];

  if (tabConfig?.onActivate) tabConfig.onActivate();

  document.querySelectorAll(".ocp-tab__button").forEach((btn) => btn.classList.remove("active"));
  document.querySelectorAll(".ocp-tab__content").forEach((content) => content.classList.remove("active"));

  button.classList.add("active");
  document.getElementById(tabName)?.classList.add("active");
};

const updateSettingsCache = (input) => {
  const { id, checked } = input;

  if (id === "beatmapShowLength") settingsCache.beatmaps.showLength = checked;
  if (id === "profileCustomOrder") settingsCache.profile.customOrder = checked;
  if (id === "historyIsEnabled") settingsCache.history.isEnabled = checked;

  localStorage.setItem("ocp-settings", JSON.stringify(settingsCache));

  updateModalHeader();
};

const updateHistoryTab = () => {
  const historyContainer = document.querySelector(".ocp-history__container");
  if (!historyContainer) return;

  const historyTitle = historyContainer.parentNode.querySelector(".ocp-content__title");
  if (!historyTitle) return;

  historyContainer.innerHTML = "";

  const historyBytesLength = new TextEncoder().encode(JSON.stringify(historyCache)).length;

  parseHistory();

  historyTitle.textContent = `${tabsConfig.history.label} [${historyCache.length}] (${(historyBytesLength / 1024).toFixed(2)} kb)`;

  const updateTimes = () => {
    const timeElements = document.querySelectorAll(".ocp-item__date");
    timeElements.forEach((element, index) => {
      element.textContent = howTimeAgo(historyCache[index].date);
    });
  };

  historyCache
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .forEach((item) => {
      const element = document.createElement("a");
      element.href = item.path;
      element.className = "ocp-history__item";
      element.innerHTML = renderHistoryItem(item);
      historyContainer.appendChild(element);
    });

  const timeInterval = setInterval(updateTimes, 1000);
  historyContainer.dataset.timeInterval = timeInterval;
};

const updateSettingsTab = () => {};

const updateProfileTab = () => {
  const initializeDragAndDrop = () => {
    const sortableList = document.querySelector("#sortableList");
    if (!sortableList) return;

    let draggedItem = null;

    const updateOrderInLocalStorage = () => {
      if (!settingsCache.profile.customOrder) return;

      const order = [...sortableList.children].map((item) => item.textContent.trim());
      settingsCache.profile.profileOrder = order;
      localStorage.setItem("ocp-settings", JSON.stringify(settingsCache));

      if (settingsCache.profile.customOrder) sortProfileOrder();
    };

    sortableList.addEventListener("dragstart", (e) => {
      draggedItem = e.target;
      e.target.classList.add("dragging");

      sortableList.querySelectorAll(".ocp-profile-order__item").forEach((item) => {
        if (item !== draggedItem) item.classList.add("inactive");
      });
    });

    sortableList.addEventListener("dragend", (e) => {
      e.target.classList.remove("dragging");

      sortableList.querySelectorAll(".ocp-profile-order__item").forEach((item) => {
        item.classList.remove("inactive");
      });

      updateOrderInLocalStorage();

      draggedItem = null;
    });

    sortableList.addEventListener("dragover", (e) => {
      e.preventDefault();
      const afterElement = getDragAfterElement(sortableList, e.clientY);
      if (afterElement == null) sortableList.appendChild(draggedItem);
      else sortableList.insertBefore(draggedItem, afterElement);
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
  const profileContainer = document.querySelector(".ocp-profile__container");
  if (!profileContainer) return;

  profileContainer.innerHTML = `
            <div class="ocp-profile__order">
                <div class="ocp-profile-order__list" id="sortableList">
                    ${settingsCache.profile.profileOrder.map((profile) => `<div class="ocp-profile-order__item${!settingsCache.profile.customOrder ? " inactive" : ""}" draggable="${settingsCache.profile.customOrder}">${profile}</div>`).join("")}
                </div>
            </div>
        `;

  initializeDragAndDrop();
};

const renderHistoryItem = (item) => {
  const templates = {
    profile: (item) => `
            <div class="ocp-container__item">
              <div class="ocp-item__info">
                <p class="ocp-item__date">${howTimeAgo(item.date)}</p>
                <p style="color:hsl(var(--hsl-h1))">${item.type}</p>
              </div>
              <div class="ocp-divider__vertical"></div>
              <div class="ocp-item__content">
                <div class="ocp-history__profile">
                  <img class="ocp-profile__background" src="${item.cover}" />
                  <div class="ocp-dimming"></div>
                  <div class="ocp-profile__content">
                    <img class="ocp-profile__avatar" src="https://a.ppy.sh/${item.id}" />
                    <p class="ocp-profile__username">${item.username}</p>
                  </div>
                </div>
              </div>
            </div>
          `,
    beatmap: (item) => `
            <div class="ocp-container__item">
              <div class="ocp-item__info">
                <p class="ocp-item__date">${howTimeAgo(item.date)}</p>
                <p style="color:hsl(var(--hsl-c1))">${item.type}</p>
              </div>
              <div class="ocp-divider__vertical" style="background-color:hsl(var(--hsl-c1))"></div>
              <div class="ocp-item__content">
                <div class="ocp-history__beatmap">
                  <img class="ocp-beatmap__background" src="https://assets.ppy.sh/beatmaps/${item.set}/covers/card@2x.jpg" />
                  <div class="ocp-dimming"></div>
                  <div class="ocp-beatmap__content">
                    <p class="ocp-beatmap__title">${item.artist} - ${item.title}</p>
                    <p>[${item.version}]</p>
                    <p>mapped by <span class="bold">${item.creator}</span></p>
                  </div>
                </div>
              </div>
            </div>
          `,
  };

  return templates[item.type]?.(item) || "";
};

const closeSettingsModal = () => {
  const modal = document.querySelector(".ocp-modal");
  const modalContent = document.querySelector(".ocp-modal__container");
  const historyContainer = document.querySelector(".ocp-history__container");

  if (historyContainer?.dataset.timeInterval) clearInterval(Number(historyContainer.dataset.timeInterval));

  modalContent?.classList.remove("ocp-modal__container--visible");
  setTimeout(() => modal?.classList.remove("ocp-modal--visible"), 200);
};

const updateModalHeader = () => {
  const header = document.querySelector(".ocp-modal__header");
  if (!header) return;

  header.innerHTML = `
      <button class="ocp-tab__button active" data-tab="settings">
          <span class="ocp-modal__icons ocp-icons__settings"></span>
          <p>${tabsConfig.settings.label}</p>
      </button>
      <button class="ocp-tab__button" data-tab="profile" ${!settingsCache.profile.customOrder && "disabled"}>
          <span class="ocp-modal__icons ocp-icons__user"></span>
          <p>${tabsConfig.profile.label}</p>
      </button>
      <button class="ocp-tab__button" data-tab="history" ${!settingsCache.history.isEnabled && "disabled"}>
          <span class="ocp-modal__icons ocp-icons__timeline"></span>
          <p>${tabsConfig.history.label}</p>
      </button>
    `;

  document.querySelectorAll(".ocp-tab__button").forEach((button) => button.addEventListener("click", () => changeSettingsTab(button)));
};
const createSettingsModal = () => {
  const modal = document.querySelector("#ocp-modal") || document.createElement("div");
  if (!modal) return;

  modal.id = "ocp-modal";
  modal.className = "ocp-modal";

  modal.innerHTML = `
          <div class="ocp-modal__backdrop"></div>
          <div class="ocp-modal__container">
            <div class="ocp-modal__header">
              <button class="ocp-tab__button active" data-tab="settings">
                <span class="ocp-modal__icons ocp-icons__settings"></span>
                <p>${tabsConfig.settings.label}</p>
              </button>
              <button class="ocp-tab__button" data-tab="profile" ${!settingsCache.profile.customOrder && "disabled"}>
                <span class="ocp-modal__icons ocp-icons__user"></span>
                <p>${tabsConfig.profile.label}</p>
              </button>
              <button class="ocp-tab__button" data-tab="history" ${!settingsCache.history.isEnabled && "disabled"}>
                <span class="ocp-modal__icons ocp-icons__timeline"></span>
                <p>${tabsConfig.history.label}</p>
              </button>
            </div>
            <div class="ocp-modal__divider"></div>
            <div class="ocp-modal__content">
              <div class="ocp-tab__content active" id="settings">
                <p class="ocp-content__title">${tabsConfig.settings.label}</p>
                <div class="ocp-settings__container">
                    <div class="ocp-settings__item">
                        <p class="ocp-settings__title">Show Beatmaps Length</p>
                        <div class="ocp-settings__switch">
                            <input type="checkbox" id="beatmapShowLength" class="ocp-settings__input" ${settingsCache.beatmaps.showLength ? "checked" : ""} />
                            <label for="beatmapShowLength" class="ocp-settings__label"></label>
                        </div>
                    </div>
                    <div class="ocp-settings__item">
                        <p class="ocp-settings__title">Profile Custom Order</p>
                        <div class="ocp-settings__switch">
                            <input type="checkbox" id="profileCustomOrder" class="ocp-settings__input" ${settingsCache.profile.customOrder ? "checked" : ""} />
                            <label for="profileCustomOrder" class="ocp-settings__label"></label>
                        </div>
                    </div>
                    <div class="ocp-settings__item">
                        <p class="ocp-settings__title">Save History</p>
                        <div class="ocp-settings__switch">
                            <input type="checkbox" id="historyIsEnabled" class="ocp-settings__input" ${settingsCache.history.isEnabled ? "checked" : ""} />
                            <label for="historyIsEnabled" class="ocp-settings__label"></label>
                        </div>
                    </div>
                </div>
              </div>
              <div class="ocp-tab__content" id="profile">
                <p class="ocp-content__title">${tabsConfig.profile.label}</p>
                <div class="ocp-profile__container"></div>
              </div>
              <div class="ocp-tab__content" id="history">
                <p class="ocp-content__title">${tabsConfig.history.label}</p>
                <div class="ocp-history__container"></div>
              </div>
            </div>
          </div>
        `;

  const modalBackdrop = modal.querySelector(".ocp-modal__backdrop");
  if (!modalBackdrop) return;

  modalBackdrop.addEventListener("click", closeSettingsModal);

  document.body.appendChild(modal);

  document.querySelectorAll(".ocp-tab__button").forEach((button) => button.addEventListener("click", () => changeSettingsTab(button)));
  document.querySelectorAll(".ocp-settings__input").forEach((input) => input.addEventListener("change", () => updateSettingsCache(input)));

  return modal;
};

const setupSettingsMenu = () => {
  const observer = new MutationObserver(() => {
    const containers = document.querySelectorAll(selectors.user__menu);
    if (!containers.length) return;

    for (const container of containers) {
      const logoutButton = container.querySelector(selectors.logout__button);
      if (!logoutButton) continue;

      if (container.querySelector(selectors.ocp__settings__button)) return observer.disconnect();

      const settingsButton = document.createElement("button");
      settingsButton.type = "button";
      settingsButton.className = "simple-menu__item";
      settingsButton.id = "ocp-settings__button";
      settingsButton.textContent = "OCP settings";

      settingsButton.addEventListener("click", () => {
        const existingModal = document.querySelector(".ocp-modal");
        if (existingModal) {
          closeSettingsModal();
          existingModal.remove();
        }

        const modal = createSettingsModal();
        setTimeout(() => {
          modal?.classList.add("ocp-modal--visible");
          modal?.querySelector(".ocp-modal__container")?.classList.add("ocp-modal__container--visible");
        }, 10);
      });

      container.insertBefore(settingsButton, logoutButton);

      observer.disconnect();
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
};

const tabsConfig = {
  settings: { onActivate: updateSettingsTab, label: "Settings" },
  profile: { onActivate: updateProfileTab, label: "Profile Order" },
  history: { onActivate: updateHistoryTab, label: "History" },
};

/**
 * -------------------------------------------------------------
 * -                  History Functions                        -
 * -------------------------------------------------------------
 * - saveToHistory        - Saves data to history cache and    -
 * -                        localStorage                       -
 * - saveProfilePath      - Extracts and saves user profile    -
 * -                        data based on the current path     -
 * - observerPathname     - Observes and intercepts changes    -
 * -                        to the browser's history state,    -
 * -                        ensuring consistent                -
 * -                        state handling                     -
 * - savePathToHistory    - Determines the current path type   -
 * -                        and saves relevant data to         -
 * -                        history                            -
 * - saveBeatmapsetPath   - Extracts and saves beatmapset      -
 * -                        data based on the current path     -
 * -------------------------------------------------------------
 */

const saveToHistory = (data) => {
  if (historyCache.length >= settingsCache.history.limit) history.shift();
  historyCache.push(data);
  localStorage.setItem("ocp-history", JSON.stringify(historyCache));
};

const saveProfilePath = () => {
  const element = document.querySelector(selectors.user__profile__json);
  if (!element) return;

  const profile = JSON.parse(element.getAttribute("data-initial-data"));

  const data = {
    type: "profile",
    id: profile.user.id,
    ruleset: profile.profile_mode,
    country: profile.user.country,
    date: new Date().toISOString(),
    username: profile.user.username,
    cover: profile.user.cover.url ?? null,
    path: `/users/${profile.user.id}`,
  };

  saveToHistory(data);
};

const saveBeatmapsetPath = () => {
  const { hash } = window.location;
  const match = hash.match(/#(\w+)\/(\d+)/);
  if (!match) return;

  const [, ruleset, beatmapId] = match;

  const element = document.querySelector(selectors.beatmapset__json);
  if (!element) return;

  const beatmapset = JSON.parse(element.textContent);
  const beatmap = beatmapset.beatmaps.find((beatmap) => beatmap.id === Number(beatmapId));
  if (!beatmap) return;

  const data = {
    id: beatmap.id,
    type: "beatmap",
    ruleset: ruleset,
    set: beatmapset.id,
    title: beatmapset.title,
    version: beatmap.version,
    artist: beatmapset.artist,
    creator: beatmapset.creator,
    date: new Date().toISOString(),
    path: `/beatmapsets/${beatmapset.id}#${ruleset}/${beatmap.id}`,
  };

  saveToHistory(data);
};

const savePathToHistory = () => {
  const { pathname, hash } = window.location;
  const recentHistory = historyCache[historyCache.length - 1];

  if (recentHistory?.path === `${pathname}${hash}` || !settingsCache.history.isEnabled) return;

  // Doubled /beatmapsets/${hash} fix
  if (localPath === pathname || localPath === `${pathname}${hash}`) return;
  localPath = `${pathname}${hash}`;

  if (pathname.includes("/users/")) waitForContainer(selectors.user__profile__json, saveProfilePath);
  if (pathname.includes("/beatmapsets/")) waitForContainer(selectors.beatmapset__json, saveBeatmapsetPath);
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

observerPathname();

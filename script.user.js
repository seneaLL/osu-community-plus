// ==UserScript==
// @name        Community fixes for osu! website
// @namespace   Violentmonkey Scripts
// @match       https://osu.ppy.sh/beatmapsets*
// @grant       none
// @version     1.0
// @description Community fixes for osu! website
// @updateURL   https://bit.ly/osu-community-plus
// @downloadURL https://bit.ly/osu-community-plus
// ==/UserScript==

(() => {
    const beatmaps = new Map();

    const addBeatmapsFromData = (data) => {
      if (!data?.beatmapsets) return;

      data.beatmapsets.forEach(({ beatmaps: beatmapList }) => {
        beatmapList.forEach((beatmap) => {
          if (!beatmaps.has(beatmap.id)) beatmaps.set(beatmap.id, beatmap);
        });
      });
    };

    const interceptXHR = () => {
      const targetBaseUrl = "https://osu.ppy.sh/beatmapsets/search";
      const originalOpen = XMLHttpRequest.prototype.open;

      XMLHttpRequest.prototype.open = function (method, url, ...args) {
        if (method === "GET" && url.startsWith(targetBaseUrl)) {
          console.log("Intercepted GET request:", url);
          fetch(url)
            .then((res) => res.json())
            .then(addBeatmapsFromData)
            .catch((err) => console.error("Error duplicating request:", err));
        }
        return originalOpen.apply(this, [method, url, ...args]);
      };
    };

    const monitorDOM = () => {
      const observer = new MutationObserver((mutations) => {
        mutations.forEach(({ addedNodes }) => {
          addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE && node.classList.contains("js-portal"))
              node.querySelectorAll(".beatmaps-popup-item").forEach(addDurationBadge);
          });
        });
      });

      observer.observe(document.body, { childList: true, subtree: true });
      console.log("Started monitoring DOM for 'js-portal' elements");
    };

    const addDurationBadge = (beatmapItem) => {
      const beatmapId = extractBeatmapId(beatmapItem.href);
      if (!beatmapId) return;

      const beatmap = beatmaps.get(beatmapId);
      if (!beatmap) return;

      const difficultyBadge = beatmapItem.querySelector(".difficulty-badge");
      if (!difficultyBadge) return;

      const beatmapListItem = difficultyBadge.closest(".beatmap-list-item");
      if (!beatmapListItem) return;

      beatmapListItem.style.cssText = "width: 100%; display: flex;";

      const formattedLengths = formatBeatmapLengths(beatmap);
      const durationBadge = createBadge(difficultyBadge, formattedLengths);

      const mainCol = beatmapListItem.querySelector(".beatmap-list-item__col--main");
      if (mainCol) mainCol.insertAdjacentElement("beforebegin", durationBadge);
    };

    const createBadge = (difficultyBadge, { totalLength, hitLength }) => {
      const badge = document.createElement("div");
      badge.className = "beatmap-list-item__col";

      const durationBadge = document.createElement("div");
      durationBadge.className = "difficulty-badge";
      durationBadge.style.setProperty("--bg", difficultyBadge.style.getPropertyValue("--bg"));
      durationBadge.innerHTML = `
          <span class="difficulty-badge__icon"><span class="fas fa-clock"></span></span>
          <span class="difficulty-badge__rating">${totalLength} (${hitLength})</span>
        `;

      badge.appendChild(durationBadge);
      return badge;
    };

    const extractBeatmapId = (href) => {
      const match = href.match(/\/beatmaps\/(\d+)$/);
      return match ? Number(match[1]) : null;
    };

    const formatBeatmapLengths = ({ total_length, hit_length }) => ({
      totalLength: formatTime(total_length),
      hitLength: formatTime(hit_length),
    });

    const formatTime = (seconds) => {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;
      return `${padZero(minutes)}:${padZero(remainingSeconds)}`;
    };

    const padZero = (value) => (value < 10 ? `0${value}` : value);

    const bootstrap = () => {
      interceptXHR();
      monitorDOM();
      const initialData = document.getElementById("json-beatmaps")?.textContent;
      if (initialData) addBeatmapsFromData(JSON.parse(initialData));
    };

    bootstrap();
  })();

(function () {
    if (!window.hstatsApi) {
        return;
    }

    function findMetric(label) {
        var cards = Array.from(document.querySelectorAll(".metric-card"));
        return cards.find(function (card) {
            var text = card.querySelector(".metric-label");
            return text && text.textContent.trim().toLowerCase() === label;
        });
    }

    function updateMetric(card, value, metaText) {
        if (!card) {
            return;
        }
        var valueEl = card.querySelector(".metric-value");
        var metaEl = card.querySelector(".metric-meta");
        if (valueEl) {
            valueEl.dataset.value = String(value);
            if (window.hstatsUpdateNumber) {
                window.hstatsUpdateNumber(valueEl, value);
            } else {
                valueEl.textContent = new Intl.NumberFormat("en-US").format(value);
            }
        }
        if (metaEl && metaText) {
            metaEl.textContent = metaText;
        }
    }

    async function loadServerData() {
        try {
            var data = await window.hstatsApi.get("/api/server-data");
            updateMetric(findMetric("online players"), data.online_players, "Updated just now");
            updateMetric(findMetric("active servers"), data.online_servers, "Updated just now");
        } catch (err) {
            // Keep placeholders if API fails.
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", loadServerData);
    } else {
        loadServerData();
    }
})();

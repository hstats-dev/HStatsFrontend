var hstatsUsageChart = null;
var hstatsMapSeries = null;
var pendingUsageData = null;
var pendingMapData = null;

anychart.onDocumentReady(function () {
    hstatsUsageChart = anychart.column([]);
    hstatsUsageChart.background().fill("transparent");
    hstatsUsageChart.yScale().minimum(0).maximum(100);
    hstatsUsageChart.yAxis().labels().fontColor("#a9b5d1");
    hstatsUsageChart.yAxis().labels().format("{%Value}%");
    hstatsUsageChart.xAxis().labels().fontColor("#a9b5d1");
    hstatsUsageChart.yAxis().stroke("#233049");
    hstatsUsageChart.xAxis().stroke("#233049");
    hstatsUsageChart.xGrid().stroke("#1a2436");
    hstatsUsageChart.yGrid().stroke("#1a2436");
    hstatsUsageChart.tooltip().format("{%Value}%");
    hstatsUsageChart.palette(["#6aa7ff"]);
    hstatsUsageChart.container("mod-usage-chart");
    hstatsUsageChart.draw();
    if (pendingUsageData) {
        hstatsUsageChart.data(pendingUsageData);
        pendingUsageData = null;
    }

    var map = anychart.map();
    hstatsMapSeries = map.choropleth([]);
    hstatsMapSeries.geoIdField("id");
    hstatsMapSeries.colorScale(anychart.scales.linearColor("#1f2b46", "#6aa7ff"));
    hstatsMapSeries.hovered().fill("#8ec0ff");
    map.geoData(anychart.maps["world"]);
    map.background().fill("transparent");
    map.container("mod-map-chart");
    map.draw();
    if (pendingMapData) {
        hstatsMapSeries.data(pendingMapData);
        pendingMapData = null;
    }
});

(function () {
    var formatter = new Intl.NumberFormat("en-US");
    var compactFormatter = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

    function formatAxisValue(value) {
        if (Math.abs(value) >= 1000) {
            return compactFormatter.format(Math.round(value));
        }
        return String(Math.round(value));
    }

    function getNiceStep(range) {
        var rough = range / 3;
        var magnitude = Math.pow(10, Math.floor(Math.log10(rough)));
        var norm = rough / magnitude;
        if (norm <= 1) {
            return 1 * magnitude;
        }
        if (norm <= 2) {
            return 2 * magnitude;
        }
        if (norm <= 5) {
            return 5 * magnitude;
        }
        return 10 * magnitude;
    }

    function buildSparkline(container) {
        var data = [];
        var labels = [];
        var axisLabels = [];
        try {
            data = JSON.parse(container.dataset.sparkline || "[]");
            labels = JSON.parse(container.dataset.labels || "[]");
            axisLabels = JSON.parse(container.dataset.axisLabels || "[]");
        } catch (err) {
            data = [];
            labels = [];
            axisLabels = [];
        }
        if (!data.length) {
            container.innerHTML = "";
            container.classList.add("is-empty");
            return;
        }
        container.classList.remove("is-empty");

        var width = Math.max(container.clientWidth || 0, 260);
        var height = Math.max(container.clientHeight || 0, 150);
        var padding = { top: 12, right: 8, bottom: 34, left: 40 };
        var innerWidth = width - padding.left - padding.right;
        var innerHeight = height - padding.top - padding.bottom;

        var minValue = Math.min.apply(null, data);
        var maxValue = Math.max.apply(null, data);
        var range = maxValue - minValue || 1;
        var step = getNiceStep(range);
        var niceMin = Math.floor(minValue / step) * step;
        var niceMax = Math.ceil(maxValue / step) * step;
        var scaleRange = niceMax - niceMin || 1;

        var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("viewBox", "0 0 " + width + " " + height);
        svg.setAttribute("role", "img");
        svg.setAttribute("aria-label", "Trend over 12 months");
        svg.classList.add("sparkline-svg");

        var axisGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
        axisGroup.classList.add("sparkline-axis");

        var axisLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
        axisLine.setAttribute("x1", padding.left);
        axisLine.setAttribute("y1", padding.top);
        axisLine.setAttribute("x2", padding.left);
        axisLine.setAttribute("y2", padding.top + innerHeight);
        axisLine.classList.add("sparkline-axis-line");
        axisGroup.appendChild(axisLine);

        var axisBottom = document.createElementNS("http://www.w3.org/2000/svg", "line");
        axisBottom.setAttribute("x1", padding.left);
        axisBottom.setAttribute("y1", padding.top + innerHeight);
        axisBottom.setAttribute("x2", padding.left + innerWidth);
        axisBottom.setAttribute("y2", padding.top + innerHeight);
        axisBottom.classList.add("sparkline-axis-line");
        axisGroup.appendChild(axisBottom);

        var tickValues = [];
        for (var t = niceMin; t <= niceMax + step * 0.5; t += step) {
            tickValues.push(t);
        }

        tickValues.forEach(function (tick) {
            var y = padding.top + innerHeight - ((tick - niceMin) / scaleRange) * innerHeight;
            var grid = document.createElementNS("http://www.w3.org/2000/svg", "line");
            grid.setAttribute("x1", padding.left);
            grid.setAttribute("y1", y);
            grid.setAttribute("x2", padding.left + innerWidth);
            grid.setAttribute("y2", y);
            grid.classList.add("sparkline-grid");
            axisGroup.appendChild(grid);

            var tickLabel = document.createElementNS("http://www.w3.org/2000/svg", "text");
            tickLabel.textContent = formatAxisValue(tick);
            tickLabel.setAttribute("x", String(padding.left - 6));
            tickLabel.setAttribute("y", String(y));
            tickLabel.setAttribute("text-anchor", "end");
            tickLabel.setAttribute("dominant-baseline", "middle");
            tickLabel.classList.add("sparkline-axis-tick-label");
            axisGroup.appendChild(tickLabel);
        });

        var yLabel = document.createElementNS("http://www.w3.org/2000/svg", "text");
        yLabel.textContent = container.dataset.yLabel || "Value";
        yLabel.setAttribute("x", "12");
        yLabel.setAttribute("y", String(padding.top + innerHeight / 2));
        yLabel.setAttribute("transform", "rotate(-90 12 " + (padding.top + innerHeight / 2) + ")");
        yLabel.classList.add("sparkline-axis-label");
        axisGroup.appendChild(yLabel);

        var xLabel = document.createElementNS("http://www.w3.org/2000/svg", "text");
        xLabel.textContent = container.dataset.xLabel || "Time";
        xLabel.setAttribute("x", String(padding.left + innerWidth / 2));
        xLabel.setAttribute("y", String(height - 4));
        xLabel.setAttribute("text-anchor", "middle");
        xLabel.classList.add("sparkline-axis-label");
        axisGroup.appendChild(xLabel);

        svg.appendChild(axisGroup);

        var lineGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
        lineGroup.classList.add("sparkline-line-group");

        var points = data.map(function (value, index) {
            var x = padding.left + (innerWidth * (index / (data.length - 1 || 1)));
            var y = padding.top + innerHeight - ((value - niceMin) / scaleRange) * innerHeight;
            return { x: x, y: y, value: value, label: labels[index] || "Month " + (index + 1) };
        });

        points.forEach(function (point, index) {
            var tick = document.createElementNS("http://www.w3.org/2000/svg", "line");
            tick.setAttribute("x1", point.x);
            tick.setAttribute("y1", padding.top + innerHeight);
            tick.setAttribute("x2", point.x);
            tick.setAttribute("y2", padding.top + innerHeight + 4);
            tick.classList.add("sparkline-axis-tick");
            axisGroup.appendChild(tick);

            var tickLabel = document.createElementNS("http://www.w3.org/2000/svg", "text");
            var axisLabel = axisLabels[index] != null ? axisLabels[index] : point.label;
            tickLabel.textContent = axisLabel;
            tickLabel.setAttribute("x", String(point.x));
            tickLabel.setAttribute("y", String(padding.top + innerHeight + 14));
            tickLabel.setAttribute("text-anchor", "middle");
            tickLabel.classList.add("sparkline-axis-tick-label");
            axisGroup.appendChild(tickLabel);
        });

        var path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", points.map(function (p, idx) {
            return (idx === 0 ? "M" : "L") + p.x + " " + p.y;
        }).join(" "));
        path.classList.add("sparkline-line");
        lineGroup.appendChild(path);

        var area = document.createElementNS("http://www.w3.org/2000/svg", "path");
        area.setAttribute("d", [
            "M", points[0].x, points[0].y,
            points.slice(1).map(function (p) { return "L" + p.x + " " + p.y; }).join(" "),
            "L", points[points.length - 1].x, padding.top + innerHeight,
            "L", points[0].x, padding.top + innerHeight,
            "Z"
        ].join(" "));
        area.classList.add("sparkline-area");
        lineGroup.insertBefore(area, path);

        svg.appendChild(lineGroup);

        var dotsGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
        dotsGroup.classList.add("sparkline-dots");

        var dots = [];
        points.forEach(function (point, index) {
            var dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            dot.setAttribute("cx", point.x);
            dot.setAttribute("cy", point.y);
            dot.setAttribute("r", "3.5");
            dot.setAttribute("tabindex", "0");
            dot.setAttribute("data-value", point.value);
            dot.setAttribute("data-label", point.label);
            dot.classList.add("sparkline-dot");
            dot.style.animationDelay = (index * 0.04) + "s";
            dotsGroup.appendChild(dot);
            dots.push(dot);
        });

        svg.appendChild(dotsGroup);

        var hoverLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
        hoverLine.classList.add("sparkline-hover-line");
        hoverLine.setAttribute("y1", padding.top);
        hoverLine.setAttribute("y2", padding.top + innerHeight);
        svg.appendChild(hoverLine);

        var hitGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
        hitGroup.classList.add("sparkline-hits");

        points.forEach(function (point, index) {
            var left = index === 0 ? padding.left : (points[index - 1].x + point.x) / 2;
            var right = index === points.length - 1 ? padding.left + innerWidth : (point.x + points[index + 1].x) / 2;
            var rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
            rect.setAttribute("x", left);
            rect.setAttribute("y", padding.top);
            rect.setAttribute("width", right - left);
            rect.setAttribute("height", innerHeight);
            rect.setAttribute("data-index", String(index));
            rect.classList.add("sparkline-hit");
            hitGroup.appendChild(rect);
        });

        svg.appendChild(hitGroup);

        var tooltip = document.createElement("div");
        tooltip.className = "sparkline-tooltip";
        tooltip.setAttribute("role", "tooltip");

        function setActive(index) {
            dots.forEach(function (dot, i) {
                dot.classList.toggle("is-active", i === index);
            });
        }

        function showTooltip(index) {
            var point = points[index];
            if (!point) {
                return;
            }
            var value = point.value;
            var label = point.label;
            tooltip.textContent = label + ": " + formatter.format(value);
            tooltip.classList.add("is-visible");

            var rect = container.getBoundingClientRect();
            var left = (point.x / width) * rect.width;
            var top = (point.y / height) * rect.height;
            tooltip.style.left = left + "px";
            tooltip.style.top = top + "px";

            hoverLine.setAttribute("x1", point.x);
            hoverLine.setAttribute("x2", point.x);
            hoverLine.classList.add("is-visible");
            setActive(index);
        }

        function hideTooltip() {
            tooltip.classList.remove("is-visible");
            hoverLine.classList.remove("is-visible");
            setActive(-1);
        }

        hitGroup.querySelectorAll(".sparkline-hit").forEach(function (rect) {
            rect.addEventListener("mouseenter", function () {
                showTooltip(Number(rect.getAttribute("data-index")));
            });
            rect.addEventListener("mouseleave", hideTooltip);
        });

        dots.forEach(function (dot, index) {
            dot.addEventListener("focus", function () {
                showTooltip(index);
            });
            dot.addEventListener("blur", hideTooltip);
        });

        container.innerHTML = "";
        container.appendChild(svg);
        container.appendChild(tooltip);

        var length = path.getTotalLength();
        path.style.strokeDasharray = String(length);
        path.style.strokeDashoffset = String(length);
        requestAnimationFrame(function () {
            path.classList.add("sparkline-animate");
        });
    }

    function renderSparkline(container, data, labels, yLabel, xLabel, axisLabels) {
        if (!container) {
            return;
        }
        if (!container.dataset.defaultLabels && container.dataset.labels) {
            container.dataset.defaultLabels = container.dataset.labels;
        }
        container.dataset.sparkline = JSON.stringify(data || []);
        container.dataset.labels = JSON.stringify(labels || []);
        container.dataset.axisLabels = JSON.stringify(axisLabels || []);
        if (yLabel) {
            container.dataset.yLabel = yLabel;
        }
        if (xLabel) {
            container.dataset.xLabel = xLabel;
        }
        buildSparkline(container);
    }

    function initSparklines() {
        document.querySelectorAll(".sparkline-chart").forEach(buildSparkline);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initSparklines);
    } else {
        initSparklines();
    }

    window.hstatsRenderSparkline = renderSparkline;
})();

(function () {
    if (!window.hstatsApi) {
        return;
    }

    var modListEl = document.querySelector(".mod-switcher-chips");
    var addButton = document.querySelector(".add-mod-button");
    var deleteButton = document.querySelector(".delete-mod-button");
    var modUuidEl = document.getElementById("dashboard-mod-uuid");
    var copyButton = document.querySelector(".uuid-copy-button");
    var totalPlayersEl = document.getElementById("dashboard-total-players");
    var totalServersEl = document.getElementById("dashboard-total-servers");
    var peakPlayersEl = document.getElementById("dashboard-peak-players");
    var peakServersEl = document.getElementById("dashboard-peak-servers");
    var activeKey = "hstats_active_mod";
    var modsKey = "hstats_mods";

    function getMods() {
        try {
            return JSON.parse(localStorage.getItem(modsKey) || "[]");
        } catch (err) {
            return [];
        }
    }

    function saveMods(mods) {
        localStorage.setItem(modsKey, JSON.stringify(mods));
    }

    function updateUuidDisplay(uuid) {
        if (modUuidEl) {
            modUuidEl.textContent = uuid || "Select a mod";
        }
        if (copyButton) {
            copyButton.disabled = !uuid;
        }
        if (deleteButton) {
            deleteButton.disabled = !uuid;
        }
    }

    function setActive(uuid) {
        if (uuid) {
            localStorage.setItem(activeKey, uuid);
        } else {
            localStorage.removeItem(activeKey);
        }
        renderMods();
        updateUuidDisplay(uuid);
        loadPluginInfo(uuid);
    }

    function renderMods() {
        if (!modListEl) {
            return;
        }
        var mods = getMods();
        var activeUuid = localStorage.getItem(activeKey);
        modListEl.innerHTML = "";

        if (!mods.length) {
            var empty = document.createElement("span");
            empty.className = "mod-chip disabled";
            empty.textContent = "No mods yet";
            modListEl.appendChild(empty);
            return;
        }

        mods.forEach(function (mod) {
            var btn = document.createElement("button");
            btn.className = "mod-chip";
            btn.type = "button";
            btn.textContent = mod.name;
            btn.dataset.uuid = mod.uuid;
            if (mod.uuid === activeUuid) {
                btn.classList.add("active");
            }
            btn.addEventListener("click", function () {
                setActive(mod.uuid);
            });
            modListEl.appendChild(btn);
        });
    }

    function updateNumber(el, value) {
        if (!el || value == null) {
            return;
        }
        el.dataset.value = String(value);
        if (window.hstatsUpdateNumber) {
            window.hstatsUpdateNumber(el, value);
        } else {
            el.textContent = new Intl.NumberFormat("en-US").format(value);
        }
    }

    function updatePeak(el, key, currentValue) {
        if (!el || currentValue == null) {
            return;
        }
        var stored = Number(localStorage.getItem(key) || 0);
        var next = currentValue > stored ? currentValue : stored;
        localStorage.setItem(key, String(next));
        updateNumber(el, next);
    }

    function toPieData(source) {
        if (!source) {
            return null;
        }
        var entries = [];
        if (Array.isArray(source)) {
            var counts = {};
            source.forEach(function (item) {
                if (item == null) {
                    return;
                }
                if (typeof item === "string" || typeof item === "number") {
                    var key = String(item);
                    counts[key] = (counts[key] || 0) + 1;
                    return;
                }
                if (item && typeof item === "object") {
                    var label = item.label || item.x || item.name || item.version;
                    var value = item.value || item.count || item.total;
                    if (label && value != null) {
                        entries.push({ label: String(label), value: Number(value) });
                    }
                }
            });
            Object.keys(counts).forEach(function (key) {
                entries.push({ label: key, value: counts[key] });
            });
        } else {
            Object.keys(source).forEach(function (key) {
                entries.push({ label: key, value: Number(source[key]) });
            });
        }
        entries.sort(function (a, b) {
            return b.value - a.value;
        });
        return entries.slice(0, 5);
    }

    function updateUsageChart(versions) {
        var entries = toPieData(versions) || [];
        var total = entries.reduce(function (sum, item) {
            return sum + item.value;
        }, 0);
        var data = entries.map(function (item) {
            var value = total ? (item.value / total) * 100 : item.value;
            return [item.label, Number(value.toFixed(1))];
        });
        if (!data.length) {
            data = [];
        }
        if (!hstatsUsageChart) {
            pendingUsageData = data;
            return;
        }
        hstatsUsageChart.data(data);
    }

    function updateMap(countries) {
        if (!countries) {
            return;
        }
        var data = [];
        Object.keys(countries).forEach(function (key) {
            data.push({ id: key, value: Number(countries[key]) });
        });
        if (!hstatsMapSeries) {
            pendingMapData = data;
            return;
        }
        hstatsMapSeries.data(data);
    }

    function updatePie(id, data) {
        var pieEl = document.getElementById(id);
        if (!pieEl || !window.hstatsRenderPie) {
            return;
        }
        window.hstatsRenderPie(pieEl, data || []);
    }

    function buildMonthlyHistory(history) {
        if (!Array.isArray(history) || !history.length) {
            return null;
        }
        var monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        var order = [];
        var map = {};

        history.forEach(function (entry) {
            if (!entry || !entry.day) {
                return;
            }
            var key = String(entry.day).slice(0, 7);
            if (!map[key]) {
                var monthIndex = Number(key.slice(5, 7)) - 1;
                map[key] = {
                    label: monthNames[monthIndex] || key,
                    players: 0,
                    servers: 0
                };
                order.push(key);
            }
            var players = Number(entry.players_count || 0);
            var servers = Number(entry.servers_count || 0);
            map[key].players = Math.max(map[key].players, players);
            map[key].servers = Math.max(map[key].servers, servers);
        });

        var keys = order.slice(-12);
        return {
            labels: keys.map(function (key) { return map[key].label; }),
            players: keys.map(function (key) { return map[key].players; }),
            servers: keys.map(function (key) { return map[key].servers; })
        };
    }

    function buildDailyHistory(history) {
        var monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        var labels = [];
        var players = [];
        var servers = [];
        history.forEach(function (entry) {
            if (!entry || !entry.day) {
                return;
            }
            var date = new Date(entry.day + "T00:00:00Z");
            var label = monthNames[date.getUTCMonth()] + " " + String(date.getUTCDate()).padStart(2, "0");
            labels.push(label);
            players.push(Number(entry.players_count || 0));
            servers.push(Number(entry.servers_count || 0));
        });
        return { labels: labels, players: players, servers: servers };
    }

    function buildAxisLabels(labels) {
        if (!labels || !labels.length) {
            return [];
        }
        var maxLabels = 8;
        if (labels.length <= maxLabels) {
            return labels.slice();
        }
        var step = Math.ceil(labels.length / maxLabels);
        return labels.map(function (label, index) {
            return index % step === 0 ? label : "";
        });
    }

    function getFallbackLabels(container, xLabel) {
        var labels = [];
        if (container) {
            try {
                labels = JSON.parse(container.dataset.defaultLabels || container.dataset.labels || "[]");
            } catch (err) {
                labels = [];
            }
        }
        if (!labels.length) {
            labels = xLabel === "Days"
                ? ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
                : ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        }
        return labels;
    }

    function renderEmptySparkline(container, yLabel, xLabel) {
        if (!container || !window.hstatsRenderSparkline) {
            return;
        }
        var labels = getFallbackLabels(container, xLabel);
        var zeros = labels.map(function () { return 0; });
        var axisLabels = buildAxisLabels(labels);
        window.hstatsRenderSparkline(container, zeros, labels, yLabel, xLabel, axisLabels);
    }

    function updateHistory(history) {
        if (!window.hstatsRenderSparkline) {
            return;
        }
        var monthly = null;
        var xLabel = "Months";
        if (history && history.length <= 45) {
            monthly = buildDailyHistory(history);
            xLabel = "Days";
        } else {
            monthly = buildMonthlyHistory(history);
        }
        var playerChart = document.querySelector('.sparkline-chart[data-y-label="Players"]');
        var serverChart = document.querySelector('.sparkline-chart[data-y-label="Servers"]');
        if (!monthly || !monthly.labels.length) {
            renderEmptySparkline(playerChart, "Players", xLabel);
            renderEmptySparkline(serverChart, "Servers", xLabel);
            return;
        }
        var axisLabels = buildAxisLabels(monthly.labels);
        if (playerChart) {
            window.hstatsRenderSparkline(playerChart, monthly.players, monthly.labels, "Players", xLabel, axisLabels);
        }
        if (serverChart) {
            window.hstatsRenderSparkline(serverChart, monthly.servers, monthly.labels, "Servers", xLabel, axisLabels);
        }
    }

    async function loadPluginInfo(uuid) {
        if (!uuid) {
            return;
        }
        try {
            var data = await window.hstatsApi.get("/api/plugin/plugin-info/" + uuid);
            updateNumber(totalPlayersEl, data.total_players);
            updateNumber(totalServersEl, data.total_servers);
            updatePeak(peakPlayersEl, "hstats_peak_players_" + uuid, data.total_players);
            updatePeak(peakServersEl, "hstats_peak_servers_" + uuid, data.total_servers);
            updateUsageChart(data.versions);
            updatePie("mod-os-chart", toPieData(data.os_names));
            updatePie("mod-java-chart", toPieData(data.java_versions));
            updatePie("mod-os-version-chart", toPieData(data.os_versions));
            updatePie("mod-core-chart", toPieData(data.core_counts));
            updateMap(data.countries || {});
            updateHistory(data.history || []);
        } catch (err) {
            if (err.status === 401) {
                window.location.href = "/login.html";
            }
        }
    }

    async function addMod() {
        var name = window.prompt("Mod name?");
        if (!name) {
            return;
        }
        var version = window.prompt("Current version?", "1.0.0");
        if (!version) {
            return;
        }
        try {
            var result = await window.hstatsApi.post("/api/plugin/add-plugin", {
                name: name,
                version: version
            });
            var mods = getMods();
            mods.push({ name: name, version: version, uuid: result.plugin_uuid });
            saveMods(mods);
            setActive(result.plugin_uuid);
        } catch (err) {
            if (err.status === 401) {
                window.location.href = "/login.html";
                return;
            }
            window.alert(err.message || "Could not add mod.");
        }
    }

    async function deleteMod() {
        var activeUuid = localStorage.getItem(activeKey);
        if (!activeUuid) {
            return;
        }
        var mods = getMods();
        var mod = mods.find(function (entry) {
            return entry.uuid === activeUuid;
        });
        var label = mod ? mod.name : "this mod";
        var confirmed = window.confirm("Delete " + label + "? This cannot be undone.");
        if (!confirmed) {
            return;
        }
        try {
            await window.hstatsApi.post("/api/plugin/delete-plugin", { uuid: activeUuid });
        } catch (err) {
            if (err.status === 401) {
                window.location.href = "/login.html";
                return;
            }
            if (err.status === 404) {
                window.alert("That mod was already removed on the server. Cleaning up locally.");
            } else {
                window.alert(err.message || "Could not delete mod.");
                return;
            }
        }

        mods = mods.filter(function (entry) {
            return entry.uuid !== activeUuid;
        });
        saveMods(mods);
        if (mods.length) {
            setActive(mods[0].uuid);
        } else {
            localStorage.removeItem(activeKey);
            updateUuidDisplay(null);
            renderMods();
        }
    }

    function copyUuid() {
        var activeUuid = localStorage.getItem(activeKey);
        if (!activeUuid) {
            return;
        }
        if (!navigator.clipboard || !navigator.clipboard.writeText) {
            window.prompt("Copy UUID:", activeUuid);
            return;
        }
        navigator.clipboard.writeText(activeUuid).then(function () {
            if (!copyButton) {
                return;
            }
            var original = copyButton.textContent;
            copyButton.textContent = "Copied!";
            copyButton.classList.add("is-copied");
            setTimeout(function () {
                copyButton.textContent = original;
                copyButton.classList.remove("is-copied");
            }, 1400);
        });
    }

    function init() {
        renderMods();
        var active = localStorage.getItem(activeKey);
        if (!active) {
            var mods = getMods();
            if (mods.length) {
                active = mods[0].uuid;
                localStorage.setItem(activeKey, active);
            }
        }
        updateUuidDisplay(active);
        loadPluginInfo(active);
    }

    if (addButton) {
        addButton.addEventListener("click", addMod);
    }
    if (deleteButton) {
        deleteButton.addEventListener("click", deleteMod);
    }
    if (copyButton) {
        copyButton.addEventListener("click", copyUuid);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();

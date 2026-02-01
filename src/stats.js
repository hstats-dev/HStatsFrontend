anychart.onDocumentReady(function () {
    var map = anychart.map();
    var series = map.choropleth([]);
    series.geoIdField("id");
    series.colorScale(anychart.scales.linearColor("#1f2b46", "#6aa7ff"));
    series.hovered().fill("#8ec0ff");
    map.geoData(anychart.maps["world"]);
    map.background().fill("transparent");
    map.container("container");
    map.draw();

    function updateMetric(selector, value) {
        var el = document.querySelector(selector);
        if (!el) {
            return;
        }
        el.dataset.value = String(value);
        if (window.hstatsUpdateNumber) {
            window.hstatsUpdateNumber(el, value);
        } else {
            el.textContent = new Intl.NumberFormat("en-US").format(value);
        }
    }

    function toPieData(source, limit) {
        if (!source) {
            return null;
        }
        var entries = [];
        if (Array.isArray(source)) {
            source.forEach(function (item) {
                if (item && typeof item === "object") {
                    var label = item.label || item.x || item.name || item.version;
                    var value = item.value || item.count || item.total;
                    if (label && value != null) {
                        entries.push({ label: String(label), value: Number(value) });
                    }
                }
            });
        } else {
            Object.keys(source).forEach(function (key) {
                entries.push({ label: key, value: Number(source[key]) });
            });
        }
        entries.sort(function (a, b) {
            return b.value - a.value;
        });
        if (limit && entries.length > limit) {
            entries = entries.slice(0, limit);
        }
        return entries;
    }

    function updatePie(id, data) {
        var el = document.getElementById(id);
        if (!el || !window.hstatsRenderPie) {
            return;
        }
        window.hstatsRenderPie(el, data || []);
    }

    function updateMap(countries) {
        if (!countries) {
            return;
        }
        var data = [];
        Object.keys(countries).forEach(function (key) {
            data.push({ id: key, value: Number(countries[key]) });
        });
        series.data(data);
    }

    async function loadServerData() {
        if (!window.hstatsApi) {
            return;
        }
        try {
            var data = await window.hstatsApi.get("/api/server-data");
            updateMetric(".network-card:nth-of-type(1) .big-stat", data.online_players);
            updateMetric(".network-card:nth-of-type(2) .big-stat", data.online_servers);
            var osData = toPieData(data.os_names, 5);
            updatePie("stats-os-chart", osData);
            var javaData = toPieData(data.java_versions, 5);
            updatePie("stats-version-chart", javaData);
            updateMap(data.countries || {});
        } catch (err) {
            // leave placeholders
        }
    }

    loadServerData();
});

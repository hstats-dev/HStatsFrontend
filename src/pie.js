(function () {
    var palette = ["#6aa7ff", "#3c5eff", "#9ed3ff", "#7dd3fc", "#60a5fa"];

    function polarToCartesian(cx, cy, radius, angle) {
        var rad = (angle - 90) * (Math.PI / 180);
        return {
            x: cx + (radius * Math.cos(rad)),
            y: cy + (radius * Math.sin(rad))
        };
    }

    function describeDonutArc(cx, cy, outer, inner, startAngle, endAngle) {
        var startOuter = polarToCartesian(cx, cy, outer, endAngle);
        var endOuter = polarToCartesian(cx, cy, outer, startAngle);
        var startInner = polarToCartesian(cx, cy, inner, startAngle);
        var endInner = polarToCartesian(cx, cy, inner, endAngle);
        var largeArc = endAngle - startAngle <= 180 ? "0" : "1";

        return [
            "M", startOuter.x, startOuter.y,
            "A", outer, outer, 0, largeArc, 0, endOuter.x, endOuter.y,
            "L", startInner.x, startInner.y,
            "A", inner, inner, 0, largeArc, 1, endInner.x, endInner.y,
            "Z"
        ].join(" ");
    }

    function formatPercent(value, total, decimals) {
        var percent = total ? (value / total) * 100 : 0;
        return percent.toFixed(decimals);
    }

    function buildEmptyPie(el) {
        var size = 200;
        var cx = 100;
        var cy = 100;
        var outer = 90;
        var inner = 48;
        var ringRadius = (outer + inner) / 2;
        var ringWidth = outer - inner;

        var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("viewBox", "0 0 200 200");
        svg.classList.add("pie-svg");

        var ring = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        ring.setAttribute("cx", String(cx));
        ring.setAttribute("cy", String(cy));
        ring.setAttribute("r", String(ringRadius));
        ring.setAttribute("fill", "none");
        ring.setAttribute("stroke", "rgba(148, 176, 255, 0.25)");
        ring.setAttribute("stroke-width", String(ringWidth));

        var centerGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
        centerGroup.classList.add("pie-center", "is-active");
        var centerText = document.createElementNS("http://www.w3.org/2000/svg", "text");
        centerText.setAttribute("x", String(cx));
        centerText.setAttribute("y", String(cy));
        centerText.setAttribute("text-anchor", "middle");
        centerText.classList.add("pie-center-value");
        centerText.textContent = "0%";
        centerGroup.appendChild(centerText);

        svg.appendChild(ring);
        svg.appendChild(centerGroup);

        el.innerHTML = "";
        el.appendChild(svg);
        el.classList.add("is-empty");
    }

    function buildPieChart(el) {
        var data = [];
        try {
            data = JSON.parse(el.dataset.pie || "[]");
        } catch (err) {
            data = [];
        }
        if (!data.length) {
            buildEmptyPie(el);
            return;
        }

        el.classList.remove("is-empty");

        var total = data.reduce(function (sum, item) {
            return sum + item.value;
        }, 0);
        var decimals = Number(el.dataset.decimals || "0");
        if (!total) {
            buildEmptyPie(el);
            return;
        }

        var size = 200;
        var cx = 100;
        var cy = 100;
        var outer = 90;
        var inner = 48;

        var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("viewBox", "0 0 200 200");
        svg.classList.add("pie-svg");

        var slicesGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
        slicesGroup.classList.add("pie-slices");

        var calloutsGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
        calloutsGroup.classList.add("pie-callouts");

        var centerGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
        centerGroup.classList.add("pie-center");
        var centerText = document.createElementNS("http://www.w3.org/2000/svg", "text");
        centerText.setAttribute("x", String(cx));
        centerText.setAttribute("y", String(cy - 4));
        centerText.setAttribute("text-anchor", "middle");
        centerText.classList.add("pie-center-title");

        var centerTitle = document.createElementNS("http://www.w3.org/2000/svg", "tspan");
        centerTitle.setAttribute("x", String(cx));
        centerTitle.textContent = "";

        var centerValue = document.createElementNS("http://www.w3.org/2000/svg", "tspan");
        centerValue.setAttribute("x", String(cx));
        centerValue.setAttribute("dy", "1.2em");
        centerValue.classList.add("pie-center-value");
        centerValue.textContent = "";

        centerText.appendChild(centerTitle);
        centerText.appendChild(centerValue);
        centerGroup.appendChild(centerText);

        var startAngle = 0;
        var sliceNodes = [];
        var calloutNodes = [];

        data.forEach(function (slice, index) {
            var value = slice.value;
            var portion = total ? (value / total) : 0;
            var endAngle = startAngle + (portion * 360);
            if (data.length === 1 && portion > 0) {
                endAngle = startAngle + 359.99;
            }
            var pathData = describeDonutArc(cx, cy, outer, inner, startAngle, endAngle);

            var group = document.createElementNS("http://www.w3.org/2000/svg", "g");
            group.classList.add("pie-slice-group");
            group.dataset.index = String(index);

            var path = document.createElementNS("http://www.w3.org/2000/svg", "path");
            path.classList.add("pie-slice");
            path.setAttribute("d", pathData);
            path.setAttribute("fill", slice.color || palette[index % palette.length]);
            path.setAttribute("tabindex", "0");
            path.setAttribute("aria-label", slice.label + " " + formatPercent(value, total, decimals) + "%");

            path.addEventListener("mouseenter", function () {
                setActive(index);
            });
            path.addEventListener("mouseleave", function () {
                clearActive();
            });
            path.addEventListener("focus", function () {
                setActive(index);
            });
            path.addEventListener("blur", function () {
                clearActive();
            });

            group.appendChild(path);
            slicesGroup.appendChild(group);
            sliceNodes.push(group);

            var midAngle = startAngle + ((endAngle - startAngle) / 2);
            var lineStart = polarToCartesian(cx, cy, outer + 2, midAngle);
            var lineBreak = polarToCartesian(cx, cy, outer + 14, midAngle);
            var isRight = Math.cos((midAngle - 90) * (Math.PI / 180)) >= 0;
            var lineEndX = lineBreak.x + (isRight ? 20 : -20);
            var lineEndY = lineBreak.y;

            var callout = document.createElementNS("http://www.w3.org/2000/svg", "g");
            callout.classList.add("pie-callout");
            callout.dataset.index = String(index);

            var polyline = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
            polyline.setAttribute("points", [
                lineStart.x + "," + lineStart.y,
                lineBreak.x + "," + lineBreak.y,
                lineEndX + "," + lineEndY
            ].join(" "));
            polyline.classList.add("pie-line");

            var label = document.createElementNS("http://www.w3.org/2000/svg", "text");
            label.setAttribute("x", String(lineEndX + (isRight ? 6 : -6)));
            label.setAttribute("y", String(lineEndY));
            label.setAttribute("text-anchor", isRight ? "start" : "end");
            label.setAttribute("dominant-baseline", "middle");
            label.classList.add("pie-label");
            label.textContent = slice.label + " " + formatPercent(value, total, decimals) + "%";

            callout.appendChild(polyline);
            callout.appendChild(label);
            calloutsGroup.appendChild(callout);
            calloutNodes.push(callout);

            startAngle = endAngle;
        });

        function setActive(index) {
            sliceNodes.forEach(function (node, i) {
                node.classList.toggle("is-active", i === index);
            });
            calloutNodes.forEach(function (node, i) {
                node.classList.toggle("is-active", i === index);
            });
            if (data[index]) {
                centerTitle.textContent = data[index].label;
                centerValue.textContent = formatPercent(data[index].value, total, decimals) + "%";
            }
            centerGroup.classList.add("is-active");
        }

        function clearActive() {
            sliceNodes.forEach(function (node) {
                node.classList.remove("is-active");
            });
            calloutNodes.forEach(function (node) {
                node.classList.remove("is-active");
            });
            centerTitle.textContent = "";
            centerValue.textContent = "";
            centerGroup.classList.remove("is-active");
        }

        svg.appendChild(slicesGroup);
        svg.appendChild(calloutsGroup);
        svg.appendChild(centerGroup);

        el.innerHTML = "";
        el.appendChild(svg);
    }

    function initPies() {
        var charts = document.querySelectorAll("[data-pie]");
        charts.forEach(function (el) {
            buildPieChart(el);
        });
    }

    function renderPie(el, data) {
        if (!el) {
            return;
        }
        el.dataset.pie = JSON.stringify(data || []);
        buildPieChart(el);
    }

    window.hstatsInitPies = initPies;
    window.hstatsRenderPie = renderPie;

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initPies);
    } else {
        initPies();
    }
})();

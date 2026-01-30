(function () {
    var formatter = new Intl.NumberFormat("en-US");

    function parseNumber(text) {
        if (!text) {
            return 0;
        }
        var cleaned = text.replace(/,/g, "").trim();
        var suffix = cleaned.slice(-1).toUpperCase();
        if (suffix === "M") {
            return parseFloat(cleaned) * 1000000;
        }
        if (suffix === "K") {
            return parseFloat(cleaned) * 1000;
        }
        if (suffix === "%") {
            return parseFloat(cleaned);
        }
        return parseFloat(cleaned) || 0;
    }

    function formatValue(value, options) {
        var format = options.format;
        var suffix = options.suffix || "";
        if (format === "short") {
            if (value >= 1000000) {
                return (value / 1000000).toFixed(2).replace(/\.00$/, "") + "M" + suffix;
            }
            if (value >= 1000) {
                return (value / 1000).toFixed(1).replace(/\.0$/, "") + "K" + suffix;
            }
        }
        return formatter.format(Math.round(value)) + suffix;
    }

    function rollTo(el, newText, direction) {
        var roll = document.createElement("span");
        roll.className = "number-roll";

        var inner = document.createElement("span");
        inner.className = "number-roll-inner " + (direction === "down" ? "number-roll-down" : "number-roll-up");
        if (direction === "down") {
            inner.style.transform = "translateY(-100%)";
        }

        var oldSpan = document.createElement("span");
        oldSpan.textContent = el.textContent;
        var newSpan = document.createElement("span");
        newSpan.textContent = newText;

        if (direction === "down") {
            inner.appendChild(newSpan);
            inner.appendChild(oldSpan);
        } else {
            inner.appendChild(oldSpan);
            inner.appendChild(newSpan);
        }

        roll.appendChild(inner);
        el.textContent = "";
        el.appendChild(roll);

        inner.addEventListener("animationend", function () {
            el.textContent = newText;
        }, { once: true });
    }

    function animateCount(el, target, options) {
        var start = 0;
        var duration = options.duration || 1200;
        var startTime = null;

        function step(timestamp) {
            if (!startTime) {
                startTime = timestamp;
            }
            var progress = Math.min((timestamp - startTime) / duration, 1);
            var eased = 1 - Math.pow(1 - progress, 3);
            var current = start + (target - start) * eased;
            el.textContent = formatValue(current, options);
            if (progress < 1) {
                requestAnimationFrame(step);
            } else {
                el.textContent = formatValue(target, options);
                el.dataset.current = String(target);
            }
        }

        requestAnimationFrame(step);
    }

    function getOptions(el) {
        return {
            format: el.dataset.format || "",
            suffix: el.dataset.suffix || "",
            duration: Number(el.dataset.duration) || 1200
        };
    }

    function initCounts() {
        var elements = document.querySelectorAll("[data-count]");
        elements.forEach(function (el) {
            var value = el.dataset.value ? Number(el.dataset.value) : parseNumber(el.textContent);
            var options = getOptions(el);
            el.dataset.value = String(value);
            animateCount(el, value, options);
        });
    }

    window.hstatsUpdateNumber = function (target, newValue, opts) {
        var el = typeof target === "string" ? document.querySelector(target) : target;
        if (!el) {
            return;
        }
        var options = Object.assign(getOptions(el), opts || {});
        var current = el.dataset.current ? Number(el.dataset.current) : parseNumber(el.textContent);
        var nextValue = typeof newValue === "number" ? newValue : Number(newValue);
        var newText = formatValue(nextValue, options);
        var direction = nextValue < current ? "down" : "up";
        rollTo(el, newText, direction);
        el.dataset.current = String(nextValue);
        el.dataset.value = String(nextValue);
    };

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initCounts);
    } else {
        initCounts();
    }
})();

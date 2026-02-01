(function () {
    var isLocalhost = !window.location.hostname ||
        window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1";
    var API_BASE = isLocalhost ? "http://localhost:3000" : "https://api.hstats.dev";

    async function request(path, options) {
        var opts = options || {};
        var method = opts.method || "GET";
        var headers = opts.headers || {};
        var body = opts.body;

        if (body && typeof body === "object" && !(body instanceof FormData)) {
            headers["Content-Type"] = "application/json";
            body = JSON.stringify(body);
        }

        var response = await fetch(API_BASE + path, {
            method: method,
            headers: headers,
            body: body,
            credentials: "include"
        });

        var text = await response.text();
        var data = null;
        try {
            data = text ? JSON.parse(text) : null;
        } catch (err) {
            data = null;
        }

        if (!response.ok) {
            var message = (data && (data.message || data.error)) || text || response.statusText;
            var error = new Error(message);
            error.status = response.status;
            error.data = data;
            throw error;
        }

        return data || {};
    }

    function get(path) {
        return request(path, { method: "GET" });
    }

    function post(path, body) {
        return request(path, { method: "POST", body: body });
    }

    window.hstatsApi = {
        baseUrl: API_BASE,
        request: request,
        get: get,
        post: post
    };
})();

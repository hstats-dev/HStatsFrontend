(function () {
    var form = document.querySelector(".form-stack");
    if (!form || !window.hstatsApi) {
        return;
    }

    var emailInput = document.querySelector("#login-email");
    var passwordInput = document.querySelector("#login-password");
    var submitButton = form.querySelector(".primary-button");
    var message = document.createElement("div");
    message.className = "form-message";
    form.appendChild(message);

    function setMessage(text, type) {
        message.textContent = text;
        message.classList.toggle("success", type === "success");
    }

    function setLoading(loading) {
        submitButton.disabled = loading;
        submitButton.textContent = loading ? "Signing in..." : "Login";
    }

    async function handleSubmit(event) {
        event.preventDefault();
        setMessage("");

        var email = emailInput.value.trim();
        var password = passwordInput.value;

        if (!email || !password) {
            setMessage("Please enter an email and password.");
            return;
        }

        try {
            setLoading(true);
            await window.hstatsApi.post("/api/account/login", {
                email: email,
                password: password
            });
            setMessage("Logged in. Redirecting...", "success");
            window.location.href = "/dashboard.html";
        } catch (err) {
            setMessage(err.message || "Login failed. Please try again.");
        } finally {
            setLoading(false);
        }
    }

    form.addEventListener("submit", handleSubmit);
    submitButton.addEventListener("click", handleSubmit);
})();

(function () {
    var form = document.querySelector(".form-stack");
    if (!form || !window.hstatsApi) {
        return;
    }

    var emailInput = document.querySelector("#register-email");
    var passwordInput = document.querySelector("#register-password");
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
        submitButton.textContent = loading ? "Creating..." : "Create account";
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

        if (password.length < 8 || password.length > 128) {
            setMessage("Password must be 8 to 128 characters.");
            return;
        }

        try {
            setLoading(true);
            await window.hstatsApi.post("/api/account/register", {
                email: email,
                password: password
            });
            setMessage("Account created. Redirecting...", "success");
            window.location.href = "/dashboard.html";
        } catch (err) {
            setMessage(err.message || "Registration failed. Please try again.");
        } finally {
            setLoading(false);
        }
    }

    form.addEventListener("submit", handleSubmit);
    submitButton.addEventListener("click", handleSubmit);
})();

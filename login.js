document
	.getElementById("loginForm")
	.addEventListener("submit", async function (event) {
		event.preventDefault(); // Prevent form submission

		const username = document.getElementById("username").value;
		const password = document.getElementById("password").value;
		const message = document.getElementById("error-message");

		try {
			const response = await fetch("http://localhost:3000/login", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ username, password }),
			});

			const data = await response.json();

			if (response.ok) {
				// Set loggedIn status in local storage
				localStorage.setItem("loggedIn", "true");
				localStorage.setItem("token", data.token);
				// Redirect to index page
				window.location.href = "index.html";
			} else {
				message.textContent = data.error; // Display error message
				message.style.color = "red";
			}
		} catch (error) {
			message.textContent = "An error occurred. Please try again.";
			message.style.color = "red";
		}
	});
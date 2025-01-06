document.getElementById('recycling-form').addEventListener('submit', function(event) {
    event.preventDefault();

    const item = document.getElementById('item').value.trim();
    const quantity = document.getElementById('quantity').value.trim();

    if (item && quantity) {
        const logList = document.getElementById('log-list');
        const logEntry = document.createElement('li');
        logEntry.textContent = `${quantity} x ${item}`;
        logList.appendChild(logEntry);

        // Clear the form
        document.getElementById('recycling-form').reset();
    } else {
        alert('Please fill in both item and quantity fields.');
    }
});

document.getElementById('loginForm').addEventListener('submit', function(event) {
    event.preventDefault(); // Prevent form submission

    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();
    const message = document.getElementById('message');

    // Basic validation (this is just an example)
    if (username === 'admin' && password === 'password') {
        message.textContent = 'Login successful!';
        message.style.color = 'green';
        // Redirect or perform other actions here
    } else {
        message.textContent = 'Invalid username or password.';
        message.style.color = 'red';
    }
});
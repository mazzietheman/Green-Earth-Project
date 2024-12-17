const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const cors = require("cors");
const bcrypt = require("bcrypt");
const nodemailer = require("nodemailer");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Connect to MongoDB
mongoose
	.connect("mongodb://localhost:27017/recycle_project", {})
	.then(() => {
		console.log("MongoDB connected");
	})
	.catch((err) => {
		console.error("MongoDB connection error:", err);
	});

// Define a schema and model for join requests
const joinSchema = new mongoose.Schema({
	username: String,
	email: String,
	password: String,
	vcode: String,
	city: String,
});

const JoinRequest = mongoose.model("JoinRequest", joinSchema);

const transporter = nodemailer.createTransport({
	service: "gmail", // Use your email service provider
	auth: {
		user: "mazzie8079@gmail.com", // Your email address
		pass: "ygpj nqzt aldd tatj", // Your email password or app password
	},
});

// Route to handle join requests
app.post("/join", async (req, res) => {
	const { username, email, city, password } = req.body;

	// Validate input (add your validation logic here)
	if (!username || !email || !city || !password) {
		return res
			.status(400)
			.json({ success: false, message: "All fields are required." });
	}

	//check if email address already registered
	const doesUserExit = await JoinRequest.exists({ email: email });
	if (doesUserExit) {
		res.status(201).json({
			success: false,
			message: "Email address already registered",
		});
		return;
	}

	//check if username already registered
	const doesUsernameExit = await JoinRequest.exists({ username: username });
	if (doesUsernameExit) {
		res.status(201).json({
			success: false,
			message: "Username address already registered",
		});
		return;
	}

	// Hash the password before saving (use bcrypt or similar)
	const hashedPassword = await bcrypt.hash(password, 10);

	const newJoinRequest = new JoinRequest({
		username,
		email,
		password: hashedPassword,
		vcode: "",
		city,
	});

	try {
		await newJoinRequest.save();
		res.status(201).json({
			success: true,
			message: "Join request submitted successfully!",
		});
	} catch (error) {
		res.status(500).json({
			success: false,
			message: "An error occurred while saving your request.",
		});
	}
});

app.post("/verify-code", async (req, res) => {
	const { email, code } = req.body;

	try {
		const row = await JoinRequest.findOne({ email: email });

		if (code === row.vcode) {
			res.status(200).json({
				success: true,
				message: "Verification successful",
			});
		} else {
			res.status(400).json({
				success: false,
				message: "Invalid verificaton code.",
			});
		}
	} catch (error) {
		res.status(500).json({ success: false, message: error.message });
	}
});

app.post("/send-verification", async (req, res) => {
	const { email } = req.body;

	// Generate a random verification code
	const verificationCode = Math.floor(
		100000 + Math.random() * 900000
	).toString(); // 6-digit code

	await JoinRequest.updateMany({ email: email }, { vcode: verificationCode });

	// Set up email options
	const mailOptions = {
		from: "mazzie8079@gmail.com", // Your email address
		to: email,
		subject: "Verification Code",
		text: `Your verification code is: ${verificationCode}`,
	};

	// Send the email
	transporter.sendMail(mailOptions, (error, info) => {
		if (error) {
			console.error("Error sending email:", error); // Log the error
			return res
				.status(500)
				.json({ error: "An error occurred while sending the email." });
		}
		res.status(200).json({
			message: "Verification code sent successfully!",
			code: VerificationCode,
		});
	});
});

// Route to handle login requests
app.post("/login", async (req, res) => {
	const { username, password } = req.body;

	// Validate input
	if (!username || !password) {
		return res
			.status(400)
			.json({ error: "Username and password are required." });
	}

	try {
		// Find the user in the database
		const user = await JoinRequest.findOne({ username });
		if (!user) {
			return res
				.status(401)
				.json({ error: "Invalid username or password." });
		}

		// Compare the password with the hashed password in the database
		const isMatch = await bcrypt.compare(password, user.password);
		if (!isMatch) {
			return res
				.status(401)
				.json({ error: "Invalid username or password." });
		}

		// Successful login
		res.status(200).json({ message: "Login successful!" });
	} catch (error) {
		res.status(500).json({ error: "An error occurred during login." });
	}
});

// Start the server
app.listen(PORT, () => {
	console.log(`Server is running on http://localhost:${PORT}`);
});

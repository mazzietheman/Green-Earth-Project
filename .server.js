const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const cors = require("cors");
const bcrypt = require("bcrypt");
const nodemailer = require("nodemailer");
const mongoosePaginate = require("mongoose-paginate-v2");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname));

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
	firstname: String,
	lastname: String,
	username: String,
	email: String,
	password: String,
	vcode: String,
	city: String,
	group: String,
	token: String,
});

joinSchema.plugin(mongoosePaginate);

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
	const { firstname, lastname, username, email, city, password } = req.body;

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
		firstname,
		lastname,
		username,
		email,
		password: hashedPassword,
		vcode: "",
		city,
		group: "member",
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
		try {
			var tokenString = require("crypto").randomBytes(64).toString("hex");
			await JoinRequest.findOneAndUpdate(
				{ _id: user._id },
				{ $set: { token: tokenString } },
				{ new: true }
			);
		} catch (error) {
			res.status(500).json({ error: error.message });
		}

		res.status(200).json({
			message: "Login successful!",
			token: tokenString,
		});
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
});

const tokenCheck = (allowedGroup) => {
	return async (req, res, next) => {
		let tokenString = "";
		if (
			req.headers.authorization &&
			req.headers.authorization.split(" ")[0] === "Bearer"
		) {
			tokenString = req.headers.authorization.split(" ")[1];
		}

		try {
			const user = await JoinRequest.findOne({ token: tokenString });

			if (allowedGroup.includes(user.group)) {
				req.username = user.username;
				next();
			} else {
				return res.status(403).send({
					success: false,
					message: "Unauthorized group",
				});
			}
		} catch (err) {
			return res.status(403).send({
				success: false,
				message: "Unauthorized",
			});
		}
	};
};

app.get(
	"/test_login",
	tokenCheck(["member", "kiosk", "plant", "administrator"]),
	async function (req, res) {
		return res.status(200).send({
			success: true,
			username: req.username,
			message: "Yes you loged in",
		});
	}
);

app.get(
	"/member_qr_code_url",
	tokenCheck(["member"]),
	async function (req, res) {
		const username = req.username;
		return res.status(200).send({
			success: true,
			code: username,
		});
	}
);

app.get("/users/all", async (req, res) => {
	try {
		let email = req.query.email;
		let pageNumber = req.query.page;
		let group = req.query.group;

		if (pageNumber === undefined) {
			pageNumber = 1;
		}

		let query = {};
		if (email) {
			query.email = { $regex: new RegExp(email), $options: "i" };
		}

		if (group) {
			query.group = group;
		}

		const rs = await JoinRequest.paginate(query, {
			page: pageNumber,
			limit: 10,
		});
		const rows = rs.docs;
		let members = [];

		for (var i = 0; i < rows.length; i++) {
			members[i] = {
				id: rows[i]._id.toString(),
				name: rows[i].firstname + " " + rows[i].lastname,
				username: rows[i].username,
				email: rows[i].email,
				city: rows[i].city,
				group: rows[i].group,
			};
		}

		const r = {
			rows: members,
			totalDocs: rs.totalDocs,
			limit: rs.limit,
			totalPages: rs.totalPages,
			page: rs.age,
			pagingCounter: rs.pagingCounter,
			hasPrevPage: rs.hasPrevPage,
			hasNextPage: rs.hasNextPage,
			prevPage: rs.prevPage,
			nextPage: rs.nextPage,
		};

		res.status(200).json({ success: true, data: r });
	} catch (error) {
		res.status(500).json({ success: false, message: error.message });
	}
});

app.get("/users/:id", async (req, res) => {
	const id = req.params.id;

	try {
		const row = await JoinRequest.findById(id);
		res.status(200).json({
			success: true,
			data: row,
		});
	} catch (error) {
		res.status(404).json({
			success: false,
			message: error.message,
		});
	}
});

app.post("/users/add", async (req, res) => {
	const { firstname, lastname, username, email, city, group, password } =
		req.body;

	// Validate input
	if (!username || !email) {
		return res.status(404).json({
			success: false,
			message: "Username and email are required.",
		});
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
			message: "Username already registered",
		});
		return;
	}

	// Hash the password before saving (use bcrypt or similar)
	const hashedPassword = await bcrypt.hash(password, 10);

	const newJoinRequest = new JoinRequest({
		firstname,
		lastname,
		username,
		email,
		city,
		group,
		password: hashedPassword,
	});

	try {
		await newJoinRequest.save();
		res.status(200).json({
			success: true,
			message: "Member inserted successfully.",
		});
	} catch (error) {
		res.status(500).json({
			success: true,
			error: "An error occurred while saving your request.",
		});
	}
});

app.post("/users/edit", async (req, res) => {
	const { _id, firstname, lastname, username, email, city, group } = req.body;

	let currentID = new mongoose.Types.ObjectId(_id);

	// Validate input
	if (!username || !email) {
		return res.status(404).json({
			success: false,
			message: "Username and email are required.",
		});
	}

	//check if email address already registered in other users
	const doesUserExit = await JoinRequest.exists({
		_id: { $ne: currentID },
		email: email,
	});
	if (doesUserExit) {
		res.status(201).json({
			success: false,
			message: "Email address already registered in other users",
		});
		return;
	}

	//check if username already registered in other users
	const doesUsernameExit = await JoinRequest.exists({
		_id: { $ne: currentID },
		username: username,
	});
	if (doesUsernameExit) {
		res.status(201).json({
			success: false,
			message: "Username already registered in other users",
		});
		return;
	}

	await JoinRequest.findByIdAndUpdate(_id, req.body, {
		useFindAndModify: false,
	})
		.then((data) => {
			if (!data) {
				res.status(404).json({
					success: false,
					message: "Member not found.",
				});
			} else {
				res.status(200).json({
					success: true,
					message: "Member updated successfully.",
				});
			}
		})
		.catch((err) => {
			res.status(500).send({
				success: false,
				message: err.message,
			});
		});
});

app.delete("/users/:id", async (req, res) => {
	const id = req.params.id;

	await JoinRequest.findByIdAndDelete(id)
		.then((data) => {
			if (!data) {
				res.status(404).json({
					success: false,
					message: "Member not found",
				});
			} else {
				res.status(200).json({
					success: true,
					message: "Member deleted successfully!",
				});
			}
		})
		.catch((error) => {
			res.status(500).json({
				success: false,
				message: error.message,
			});
		});
});

// Start the server
app.listen(PORT, () => {
	console.log(`Server is running on http://127.0.0.1:${PORT}`);
});
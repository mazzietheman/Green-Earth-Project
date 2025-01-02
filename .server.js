const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const cors = require("cors");
const bcrypt = require("bcrypt");
const nodemailer = require("nodemailer");
const mongoosePaginate = require("mongoose-paginate-v2");
const moment = require("moment");

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

//function to check user login
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
				//append data to request
				req.username = user.username;
				req.userid = user._id;
				req.usergroup = user.group;

				//resume request
				next();
			} else {
				//not allowed
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

//function to check user login or not
app.get(
	"/test_login",
	tokenCheck(["member", "kiosk", "plant", "administrator"]),
	async function (req, res) {
		return res.status(200).send({
			success: true,
			username: req.username,
			usergroup: req.usergroup,
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

	let currentID = mongoose.Types.ObjectId.createFromHexString(_id);

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

//product-------------------------------------------------------------------
const productSchema = new mongoose.Schema({
	name: String,
	price: Number,
});

const Products = mongoose.model("Products", productSchema);

app.get(
	"/product/all",
	tokenCheck(["member", "kiosk", "administrator"]),
	async (req, res) => {
		try {
			let name = req.query.name;

			let query = {};
			if (name) {
				query.name = { $regex: new RegExp(name), $options: "i" };
			}

			const rows = await Products.find(query);
			let data = [];

			for (var i = 0; i < rows.length; i++) {
				data[i] = {
					id: rows[i]._id.toString(),
					name: rows[i].name,
					price: rows[i].price,
				};
			}

			const r = {
				rows: data,
			};

			res.status(200).json({ success: true, data: r });
		} catch (error) {
			res.status(500).json({ success: false, message: error.message });
		}
	}
);

app.get("/product/:id", tokenCheck(["administrator"]), async (req, res) => {
	const id = req.params.id;

	try {
		const row = await Products.findById(id);
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

app.post("/product/add", tokenCheck(["administrator"]), async (req, res) => {
	const { name, price } = req.body;

	// Validate input
	if (!name || !price) {
		return res.status(404).json({
			success: false,
			message: "Name and price are required.",
		});
	}

	const newProduct = new Products({
		name: name,
		price: price,
	});

	try {
		await newProduct.save();
		res.status(200).json({
			success: true,
			message: "Product inserted successfully.",
		});
	} catch (error) {
		res.status(500).json({
			success: true,
			error: "An error occurred while saving your request.",
		});
	}
});

app.post("/product/edit", tokenCheck(["administrator"]), async (req, res) => {
	const { _id, name, price } = req.body;

	// Validate input
	if (!name || !price) {
		return res.status(404).json({
			success: false,
			message: "Name and price are required.",
		});
	}

	await Products.findByIdAndUpdate(_id, req.body, {
		useFindAndModify: false,
	})
		.then((data) => {
			if (!data) {
				res.status(404).json({
					success: false,
					message: "Product not found.",
				});
			} else {
				res.status(200).json({
					success: true,
					message: "Product updated successfully.",
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

app.delete("/product/:id", tokenCheck(["administrator"]), async (req, res) => {
	const id = req.params.id;

	await Products.findByIdAndDelete(id)
		.then((data) => {
			if (!data) {
				res.status(404).json({
					success: false,
					message: "Product not found",
				});
			} else {
				res.status(200).json({
					success: true,
					message: "Product deleted successfully!",
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

//-------------------------------------------------------------------
const receiveGoodsSchema = new mongoose.Schema({
	transID: String,
	kiosk: joinSchema,
	member: joinSchema,
	product: productSchema,
	weight: Number,
	kioskUsername: String,
	memberUsername: String,
	amount: Number,
	createdAt: Date,
	updatedAt: Date,
	status: String,
});

receiveGoodsSchema.plugin(mongoosePaginate);

const ReceiveGoods = mongoose.model("ReceiveGoods", receiveGoodsSchema);

app.get(
	"/receive_goods/all",
	tokenCheck(["kiosk", "administrator"]),
	async (req, res) => {
		try {
			//get query string from frontend
			let memberUsername = req.query.memberUsername;
			let pageNumber = req.query.page;

			//if page number is undefined. set to 1
			if (pageNumber === undefined) {
				pageNumber = 1;
			}

			//define empty filter
			let query = {};

			//if memberUsername not empty, add filter
			if (memberUsername) {
				query.memberUsername = memberUsername;
			}

			//filter to make sure kiosk cannot see another kiosk data
			if (req.usergroup == "kiosk") {
				query.kioskUsername = req.username;
			}

			//get data from database
			const rs = await ReceiveGoods.paginate(query, {
				page: pageNumber,
				limit: 10,
			});
			const rows = rs.docs;

			//define empty data
			let data = [];

			for (var i = 0; i < rows.length; i++) {
				//for security reason, we hide password and token
				if (rows[i].kiosk) {
					rows[i].kiosk.password = "";
					rows[i].kiosk.token = "";
				}

				//for security reason, we hide password and token
				if (rows[i].member) {
					rows[i].member.password = "";
					rows[i].member.token = "";
				}

				//append database row to data
				data[i] = {
					id: rows[i]._id.toString(),
					transID: rows[i].transID,
					kiosk: rows[i].kiosk,
					member: rows[i].member,
					product: rows[i].product,
					weight: rows[i].weight,
					amount: rows[i].amount,
					status: rows[i].status,
					createdAt: moment(rows[i].createdAt).format(
						"ddd, D MMM YY HH:mm"
					),
				};
			}

			//calculate summary of weight and amount
			const summary = await ReceiveGoods.aggregate([
				{ $match: query },
				{
					$group: {
						_id: null,
						weight: { $sum: "$weight" },
						amount: { $sum: "$amount" },
					},
				},
			]);
			let totalWeight = summary[0].weight;
			let totalAmount = summary[0].amount;

			//calculate data to be sent to the frontend
			const r = {
				rows: data,
				totalDocs: rs.totalDocs,
				limit: rs.limit,
				totalPages: rs.totalPages,
				page: rs.age,
				pagingCounter: rs.pagingCounter,
				hasPrevPage: rs.hasPrevPage,
				hasNextPage: rs.hasNextPage,
				prevPage: rs.prevPage,
				nextPage: rs.nextPage,
				totalAmount: totalAmount,
				totalWeight: totalWeight,
			};

			//sent data to the frontend
			res.status(200).json({ success: true, data: r });
		} catch (error) {
			res.status(500).json({ success: false, message: error.message });
		}
	}
);

app.get(
	"/receive_goods/:id",
	tokenCheck(["kiosk", "administrator"]),
	async (req, res) => {
		//get ID from URL parameter
		const id = req.params.id;

		try {
			//get data from database
			const row = await ReceiveGoods.findById(id);

			///for security reason, we hide password and token
			row.kiosk.password = "";
			row.kiosk.token = "";
			row.member.password = "";
			row.member.token = "";

			//sent data to the frontend
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
	}
);

app.post(
	"/receive_goods/add",
	tokenCheck(["kiosk", "administrator"]),
	async (req, res) => {
		//get data from frontend
		const { memberUsername, idProduct, weight } = req.body;

		//get request data from tokenCheck function
		const kioskUsername = req.username;

		// Validate input
		if (!memberUsername || !idProduct || !weight) {
			return res.status(404).json({
				success: false,
				message: "All data are required.",
			});
		}

		try {
			//get member data from database
			const member = await JoinRequest.findOne({
				username: memberUsername,
			});

			//if member not valid, return error message
			if (!member) {
				return res.status(500).json({
					success: false,
					message: "Member Not Found",
				});
			}

			//get kiosk data from database
			const kiosk = await JoinRequest.findOne({
				username: kioskUsername,
			});

			//if kiosk not valid, return error message
			if (!kiosk) {
				return res.status(500).json({
					success: false,
					message: "Kiosk Not Found",
				});
			}

			//get product data from database
			const product = await Products.findById(idProduct);

			//calculate total amount
			let totalAmount = product.price * weight;

			//create generated transaction ID
			const newID = await generateTransID();

			//set saved data
			const newReceiveGoods = new ReceiveGoods({
				transID: newID,
				kiosk: kiosk,
				member: member,
				product: product,
				weight: weight,
				kioskUsername: kioskUsername,
				memberUsername: memberUsername,
				amount: totalAmount,
				createdAt: new Date(),
				updatedAt: new Date(),
				status: "pending",
			});

			try {
				//saving data to the database
				await newReceiveGoods.save();
				res.status(200).json({
					success: true,
					message: "Product received",
				});
			} catch (error) {
				res.status(500).json({
					success: true,
					error: "An error occurred while saving your request.",
				});
			}
		} catch (error) {
			res.status(404).json({
				success: false,
				message: error.message,
			});
		}
	}
);

app.post(
	"/receive_goods/edit",
	tokenCheck(["kiosk", "administrator"]),
	async (req, res) => {
		//get data from frontend
		const { _id, memberUsername, idProduct, weight } = req.body;

		//create object ID for mongoDB based on given ID (_id)
		let currentID = mongoose.Types.ObjectId.createFromHexString(_id);

		// Validate input
		if (!memberUsername || !idProduct || !weight) {
			return res.status(404).json({
				success: false,
				message: "All data are required.",
			});
		}

		try {
			//get member data from database
			const member = await JoinRequest.findOne({
				username: memberUsername,
			});

			//if member not valid, return error message
			if (!member) {
				return res.status(500).json({
					success: false,
					message: "Member Not Found",
				});
			}

			//get product data from database
			const product = await Products.findById(idProduct);

			//calculate total amount
			let totalAmount = product.price * weight;

			try {
				//update data
				await ReceiveGoods.updateOne(
					{ _id: currentID },
					{
						member: member,
						product: product,
						weight: weight,
						memberUsername: memberUsername,
						amount: totalAmount,
						updatedAt: new Date(),
					}
				);
				res.status(200).json({
					success: true,
					message: "Data updated",
				});
			} catch (error) {
				res.status(500).json({
					success: true,
					error: "An error occurred while saving your request.",
				});
			}
		} catch (error) {
			res.status(404).json({
				success: false,
				message: error.message,
			});
		}
	}
);

app.delete(
	"/receive_goods/:id",
	tokenCheck(["kiosk", "administrator"]),
	async (req, res) => {
		//get ID from URL parameter
		const id = req.params.id;

		//delete from database
		await ReceiveGoods.findByIdAndDelete(id)
			.then((data) => {
				if (!data) {
					res.status(404).json({
						success: false,
						message: "Receive Goods not found",
					});
				} else {
					res.status(200).json({
						success: true,
						message: "Receive Goods deleted successfully!",
					});
				}
			})
			.catch((error) => {
				res.status(500).json({
					success: false,
					message: error.message,
				});
			});
	}
);

//function to generate transaction ID.you can modify it as needed
async function generateTransID() {
	let number = await ReceiveGoods.countDocuments();
	number++;
	return "TRX" + number;
}

// Start the server
app.listen(PORT, () => {
	console.log(`Server is running on http://127.0.0.1:${PORT}`);
});

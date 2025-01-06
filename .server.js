const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const cors = require("cors");
const bcrypt = require("bcrypt");
const nodemailer = require("nodemailer");
const mongoosePaginate = require("mongoose-paginate-v2");
const QRCode = require('qrcode');
const jwt = require('jsonwebtoken');
const crypto = require("crypto");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname));

// Connect to MongoDB
mongoose
    .connect("mongodb://localhost:27017/recycle_project", {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    })
    .then(() => {
        console.log("MongoDB connected");
    })
    .catch((err) => {
        console.error("MongoDB connection error:", err);
    });

// Define a schema and model for join requests
const joinSchema = new mongoose.Schema({
    firstname: { type: String, required: true },
    lastname: { type: String, required: true },
    username: { type: String, unique: true, required: true },
    email: { type: String, unique: true, required: true },
    password: { type: String, required: true },
    vcode: String,
    city: { type: String, required: true },
    group: { type: String, default: "member" },
    token: String,
}, { timestamps: true });

joinSchema.plugin(mongoosePaginate);

const JoinRequest = mongoose.model("JoinRequest", joinSchema);

const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

// Helper function to validate input
const validateFields = (fields, res) => {
    for (const field in fields) {
        if (!fields[field]) {
            res.status(400).json({ success: false, message: `${field} is required.` });
            return false;
        }
    }
    return true;
};

// Route to handle join requests
app.post("/join", async (req, res) => {
    const { firstname, lastname, username, email, city, password } = req.body;

    if (!validateFields({ firstname, lastname, username, email, city, password }, res)) return;

    try {
        // Check if username or email already exists
        const [doesUserExist, doesUsernameExist] = await Promise.all([
            JoinRequest.exists({ email }),
            JoinRequest.exists({ username }),
        ]);

        if (doesUserExist) {
            return res.status(409).json({ success: false, message: "Email address already registered." });
        }
        if (doesUsernameExist) {
            return res.status(409).json({ success: false, message: "Username already registered." });
        }

        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);

        const newJoinRequest = new JoinRequest({
            firstname,
            lastname,
            username,
            email,
            password: hashedPassword,
            vcode: "",
            city,
        });

        await newJoinRequest.save();

        res.status(201).json({ success: true, message: "Join request submitted successfully!" });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

app.post("/send-verification", async (req, res) => {
    const { email } = req.body;

    if (!validateFields({ email }, res)) return;

    try {
        const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
        await JoinRequest.updateOne({ email }, { vcode: verificationCode });

        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: "Verification Code",
            text: `Your verification code is: ${verificationCode}`,
        };

        await transporter.sendMail(mailOptions);

        res.status(200).json({ success: true, message: "Verification code sent successfully!" });
    } catch (error) {
        res.status(500).json({ success: false, message: "Error sending verification code." });
    }
});

// Route to handle login requests
app.post("/login", async (req, res) => {
    const { username, password } = req.body;

    if (!validateFields({ username, password }, res)) return;

    try {
        const user = await JoinRequest.findOne({ username });
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ success: false, message: "Invalid username or password." });
        }

        const tokenString = crypto.randomBytes(64).toString("hex");
        user.token = tokenString;
        await user.save();

        res.status(200).json({ success: true, message: "Login successful!", token: tokenString });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

const tokenCheck = (allowedGroups) => {
    return async (req, res, next) => {
        const tokenString = req.headers.authorization?.split(" ")[1];

        if (!tokenString) {
            return res.status(403).json({ success: false, message: "Unauthorized." });
        }

        try {
            const user = await JoinRequest.findOne({ token: tokenString });
            if (!user || !allowedGroups.includes(user.group)) {
                return res.status(403).json({ success: false, message: "Unauthorized group." });
            }
            req.username = user.username;
            next();
        } catch (err) {
            res.status(403).json({ success: false, message: "Unauthorized." });
        }
    };
};

// Example route
app.get("/test_login", tokenCheck(["member", "administrator"]), (req, res) => {
    res.status(200).json({ success: true, username: req.username, message: "You are logged in!" });
});

app.post("/users/update", async (req, res) => {
    const { _id, ...updateData } = req.body;

    try {
        const data = await JoinRequest.findByIdAndUpdate(_id, updateData, {
            useFindAndModify: false,
            new: true, // Return the updated document
        });

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
    } catch (err) {
        res.status(500).send({
            success: false,
            message: err.message,
        });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://127.0.0.1:${PORT}`);
});
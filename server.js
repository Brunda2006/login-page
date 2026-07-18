require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const session = require("express-session");
const path = require("path");
const User = require("./models/User");

const app = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ──────────────────────────────────────────────
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname)));

app.use(session({
    secret: process.env.SESSION_SECRET || "changeme",
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 } // 1 hour
}));

// ── MongoDB ─────────────────────────────────────────────────
mongoose.connect(process.env.MONGO_URI)
.then(() => console.log("MongoDB Connected"))
.catch(err => console.log(err));

// ── Routes ──────────────────────────────────────────────────

// Serve login page
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "login.html"));
});

// Serve dashboard
app.get("/dashboard", (req, res) => {
    res.sendFile(path.join(__dirname, "dashboard.html"));
});

// Register
app.post("/api/register", async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password)
            return res.status(400).json({ message: "Username and password are required." });

        if (password.length < 6)
            return res.status(400).json({ message: "Password must be at least 6 characters." });

        const exists = await User.findOne({ username: username.toLowerCase().trim() });
        if (exists)
            return res.status(409).json({ message: "Username already taken." });

        const user = await User.create({ username, password });
        req.session.userId = user._id;

        res.status(201).json({ message: "Account created successfully.", username: user.username });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error. Please try again." });
    }
});

// Login
app.post("/api/login", async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password)
            return res.status(400).json({ message: "Please fill in all fields." });

        const user = await User.findOne({ username: username.toLowerCase().trim() });
        if (!user)
            return res.status(401).json({ message: "Invalid username or password." });

        const match = await user.comparePassword(password);
        if (!match)
            return res.status(401).json({ message: "Invalid username or password." });

        req.session.userId = user._id;

        res.json({ message: "Login successful.", username: user.username });
    } catch (err) {
        console.error("Login error:", err.message);
        res.status(500).json({ message: "Server error. Please try again." });
    }
});

// Logout
app.post("/api/logout", (req, res) => {
    req.session.destroy(() => res.json({ message: "Logged out." }));
});

// ── Seed default admin ───────────────────────────────────────
async function seedAdmin() {
    try {
        // Remove any existing admin that might have a plain-text password
        await User.deleteOne({ username: "admin" });
        await User.create({ username: "admin", password: "admin123", role: "faculty" });
        console.log("✅ Admin user ready  →  admin / admin123");
    } catch (err) {
        console.error("Seed error:", err.message);
    }
}

// ── Start ────────────────────────────────────────────────────
mongoose.connection.once("open", () => seedAdmin());

app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));

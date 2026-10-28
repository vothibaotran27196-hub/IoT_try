const express = require("express");

const path = require("path");

const app = express();
const PORT = 3000;

/*
app.get("/", (req, res) => {
    res.send("Hello from Express!");
});
*/

app.use(express.static(path.join(__dirname, "public")));

app.get("/api/sensor", (req, res) => {
    res.json({
        temperature: 25,
        humidity: 40,
        timestamp: new Date().toLocaleString(),
        location: "Here"
    });
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
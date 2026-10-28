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
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
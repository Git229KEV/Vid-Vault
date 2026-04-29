const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve all static files from the current directory
app.use(express.static(path.join(__dirname)));

// Route all requests to index.html (useful if you add client-side routing later)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`\n🚀 VaultPlay Server is running!`);
    console.log(`👉 Open http://localhost:${PORT} in your browser\n`);
});

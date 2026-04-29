const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve all static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Route all requests to index.html
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`\n🚀 VaultPlay Server is running!`);
    console.log(`👉 Open http://localhost:${PORT} in your browser\n`);
});

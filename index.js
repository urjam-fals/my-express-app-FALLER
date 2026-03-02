const express = require('express');
const app = express();
const port = 3000;

// Middleware to parse JSON bodies
app.use(express.json());

// New route to display list of items
const items = ['Apple', 'Banana', 'Orange'];
app.get('/items', (req, res) => {
    res.json(items);
});

// Add middleware to log incoming requests
app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
});

// Serve static files from the "public" folder
app.use(express.static('public'));

// Add middleware to handle errors 
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});

app.post('/submit', (req, res) => {
    const data = req.body;
    res.send(`Received: ${JSON.stringify(data)}`);
});

// // Define a route for the home page
// app.get('/', (req, res) => {
//     res.send('Hello, World!');
// });
app.get('/items', (req, res) => {
    res.json(items);
});

// Handle Item submissions
app.post('/items', (req, res) => {
    const newItem = req.body.item;
    if (newItem) {
        items.push(newItem);
    }
    res.json(items);
});

// Add a new route to handle a get request
app.get('/about', (req, res) => {
    res.send('About Us');
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});


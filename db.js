require('dotenv').config();
const mysql = require('mysql2');

// Create a MySQL connection
const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: 3306, // MySQL default port
});



db.connect(err => {
    if (err) {
        console.error('Database connection failed:', err.message);
        throw err; // Stop the server if the database is not connected
    }
    console.log('MySQL Connected...');
});


module.exports = db;

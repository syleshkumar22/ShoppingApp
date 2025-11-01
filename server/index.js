require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const mysql = require('mysql2');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));

// MySQL pool connection
const db = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'shopping_app',
});

// ------------------------
// PRODUCTS ROUTES
// ------------------------

// Get all products
app.get('/api/ecommerce/products', (req, res) => {
  const sql = 'SELECT * FROM products';
  db.query(sql, (err, rows) => {
    if (err) {
      console.error('Error fetching products:', err);
      return res.status(500).json({ message: 'Database error', error: err });
    }
    res.json(rows);
  });
});

// ------------------------
// CART ROUTES
// ------------------------

// Get current cart items
app.get('/api/ecommerce/cart', (req, res) => {
  const sql = 'SELECT * FROM cart ORDER BY id DESC';
  db.query(sql, (err, rows) => {
    if (err) return res.status(500).json({ message: 'Database error', error: err });
    res.json(rows);
  });
});

// Add product to cart (increment if exists)
app.post('/api/ecommerce/cart', (req, res) => {
  const { product } = req.body;

  if (!product) return res.status(400).json({ message: 'Product required' });

  // Check if product already in cart
  const checkSql = 'SELECT * FROM cart WHERE product_id = ?';
  db.query(checkSql, [product.id], (err, results) => {
    if (err) return res.status(500).json({ message: 'Database error', error: err });

    if (results.length > 0) {
      // Already in cart → increment quantity
      const updateSql = 'UPDATE cart SET quantity = quantity + 1 WHERE product_id = ?';
      db.query(updateSql, [product.id], (err2) => {
        if (err2) return res.status(500).json({ message: 'Database error', error: err2 });
        res.json({ message: 'Quantity updated' });
      });
    } else {
      // Insert new product
      const insertSql =
        'INSERT INTO cart (product_id, name, description, price, quantity, image_url) VALUES (?, ?, ?, ?, 1, ?)';
      const values = [
        product.id,
        product.name,
        product.description || '',
        product.price,
        product.image_url || ''
      ];
      db.query(insertSql, values, (err2) => {
        if (err2) return res.status(500).json({ message: 'Database error', error: err2 });
        res.json({ message: 'Product added' });
      });
    }
  });
});

// Remove product from cart completely
app.delete('/api/ecommerce/cart/:productId', (req, res) => {
  const { productId } = req.params;
  const sql = 'DELETE FROM cart WHERE product_id = ?';
  db.query(sql, [productId], (err) => {
    if (err) return res.status(500).json({ message: 'Database error', error: err });
    res.json({ message: 'Product removed' });
  });
});

// Decrease quantity by 1 (or remove if 1)
app.patch('/api/ecommerce/cart/:productId/decrease', (req, res) => {
  const { productId } = req.params;
  const sqlCheck = 'SELECT quantity FROM cart WHERE product_id = ?';
  db.query(sqlCheck, [productId], (err, results) => {
    if (err) return res.status(500).json({ message: 'Database error', error: err });
    if (results.length === 0) return res.status(404).json({ message: 'Product not in cart' });

    if (results[0].quantity > 1) {
      const sqlUpdate = 'UPDATE cart SET quantity = quantity - 1 WHERE product_id = ?';
      db.query(sqlUpdate, [productId], (err2) => {
        if (err2) return res.status(500).json({ message: 'Database error', error: err2 });
        res.json({ message: 'Quantity decreased' });
      });
    } else {
      const sqlDelete = 'DELETE FROM cart WHERE product_id = ?';
      db.query(sqlDelete, [productId], (err2) => {
        if (err2) return res.status(500).json({ message: 'Database error', error: err2 });
        res.json({ message: 'Product removed' });
      });
    }
  });
});

// ------------------------
// HEALTH CHECK
// ------------------------
app.get('/health', (req, res) => res.json({ ok: true }));

// ------------------------
// START SERVER
// ------------------------
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

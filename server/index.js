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
// POST /api/ecommerce/cart
app.post('/api/ecommerce/cart', (req, res) => {
  console.log('========== ADD TO CART REQUEST ==========');
  console.log('Full request body:', JSON.stringify(req.body, null, 2));
  
  const { product } = req.body;
  
  console.log('Extracted product:', product);
  console.log('Product ID:', product?.id);
  console.log('Product ID type:', typeof product?.id);
  
  if (!product || typeof product.id === 'undefined') {
    console.log('❌ VALIDATION FAILED: Product or product.id is missing');
    return res.status(400).json({ message: 'Product required' });
  }

  console.log('✅ Validation passed, checking cart for product_id:', product.id);

  const checkSql = 'SELECT * FROM cart WHERE product_id = ?';
  db.query(checkSql, [product.id], (err, results) => {
    if (err) {
      console.error('❌ DATABASE ERROR on SELECT:', err);
      return res.status(500).json({ message: 'Database error', error: err.message });
    }

    console.log('Cart check results:', results);
    console.log('Results length:', results.length);

    if (results.length > 0) {
      console.log('Product exists in cart, updating quantity');
      const updateSql = 'UPDATE cart SET quantity = quantity + 1 WHERE product_id = ?';
      db.query(updateSql, [product.id], (err2) => {
        if (err2) {
          console.error('❌ DATABASE ERROR on UPDATE:', err2);
          return res.status(500).json({ message: 'Database error', error: err2.message });
        }
        console.log('✅ Quantity updated successfully');
        return res.json({ message: 'Quantity updated' });
      });
    } else {
      console.log('Product NOT in cart, inserting new row');
      console.log('Values to insert:', {
        product_id: product.id,
        name: product.name,
        description: product.description,
        price: product.price,
        image_url: product.image_url
      });
      
      const insertSql =
        'INSERT INTO cart (product_id, name, description, price, quantity, image_url) VALUES (?, ?, ?, ?, 1, ?)';
      const values = [
        product.id,
        product.name || '',
        product.description || '',
        product.price || 0.0,
        product.image_url || ''
      ];
      
      console.log('SQL:', insertSql);
      console.log('Values array:', values);
      
      db.query(insertSql, values, (err2) => {
        if (err2) {
          console.error('❌ DATABASE ERROR on INSERT:', err2);
          console.error('Error code:', err2.code);
          console.error('Error sqlMessage:', err2.sqlMessage);
          return res.status(500).json({ message: 'Database error', error: err2.message });
        }
        console.log('✅ Product added successfully');
        return res.json({ message: 'Product added' });
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

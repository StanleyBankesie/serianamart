import mysql from 'mysql2/promise';

async function run() {
  try {
    const pool = mysql.createPool({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'seriana_db'
    });

    const [customers] = await pool.query('SELECT id, customer_name, price_type_id FROM sal_customers WHERE customer_name LIKE "%Abandenden%"');
    console.log('Customers:', customers);

    const [products] = await pool.query('SELECT id, item_name, selling_price FROM inv_items WHERE item_name LIKE "%Softcare%"');
    console.log('Products:', products);

    const [priceTypes] = await pool.query('SELECT id, name FROM sal_price_types');
    console.log('Price Types:', priceTypes);

    const [customerPrices] = await pool.query('SELECT * FROM sal_customer_prices ORDER BY id DESC LIMIT 5');
    console.log('Customer Prices:', customerPrices);

    await pool.end();
  } catch (err) {
    console.error(err);
  }
}
run();

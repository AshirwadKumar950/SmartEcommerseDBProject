from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
import mysql.connector
import os

# --- Flask Setup ---
app = Flask(__name__)
CORS(app)

# 📝 Database Connection Function
def get_db_connection():
    """Establishes a connection to the MySQL database."""
    try:
        connection = mysql.connector.connect(
            host="localhost",
            user="root",
            password="Aashu@123",  
            database="ecommercedb"
        )
        return connection
    except mysql.connector.Error as err:
        print(f"Database connection error: {err}")
        raise err

# --- API Endpoints ---

# 1. Route to serve the frontend
@app.route('/')
def serve_frontend():
    """Serves the main index.html file."""
    return render_template('index.html')

# 2. API Route to get all products (GET)
@app.route('/api/products', methods=['GET'])
def get_products():
    """Fetches all available products and returns them as JSON."""
    products = []
    db = None
    cursor = None
    try:
        db = get_db_connection()
        cursor = db.cursor(dictionary=True)
        query = "SELECT ProductID, Name, Price, Category, StockQty FROM Products WHERE StockQty > 0"
        cursor.execute(query)
        products = cursor.fetchall()
    except mysql.connector.Error as err:
        print(f"Database Error: {err}")
        return jsonify({"success": False, "message": f"Database connection error: {err}"}), 500
    except Exception as e:
        return jsonify({"success": False, "message": f"Server error: {e}"}), 500
    finally:
        if cursor: cursor.close()
        if db and db.is_connected(): db.close()

    return jsonify(products)

# 3. API Route to place an order (POST)
@app.route('/api/place_order', methods=['POST'])
def place_order():
    """Handles the full database transaction for a new order."""
    data = request.get_json()
    customer_id = data.get('customer_id')
    cart_items = data.get('cart')
    
    if not customer_id or not cart_items:
        return jsonify({"success": False, "message": "Missing customer ID or cart items."}), 400

    total_amount = sum(item['price'] * item['quantity'] for item in cart_items)

    db = None
    cursor = None
    
    try:
        db = get_db_connection()
        cursor = db.cursor()
        
        # --- Start Transaction ---
        db.start_transaction()
        
        # a. Insert into Orders table
        order_query = "INSERT INTO Orders (CustomerID, TotalAmount, Status) VALUES (%s, %s, 'Completed')"
        cursor.execute(order_query, (customer_id, total_amount))
        order_id = cursor.lastrowid
        
        if not order_id:
            raise Exception("Failed to get new Order ID.")

        # b, d. Insert OrderItems and Update Stock
        for item in cart_items:
            product_id = item['id']
            quantity = item['quantity']
            
            # Update Products Stock Quantity (decrement, checking for sufficient stock)
            stock_update_query = "UPDATE Products SET StockQty = StockQty - %s WHERE ProductID = %s AND StockQty >= %s"
            cursor.execute(stock_update_query, (quantity, product_id, quantity))
            
            if cursor.rowcount == 0:
                raise Exception(f"Insufficient stock for Product ID {product_id}. Transaction aborted.")

            # Insert into OrderItems
            item_query = "INSERT INTO OrderItems (OrderID, ProductID, Quantity, Price) VALUES (%s, %s, %s, %s)"
            cursor.execute(item_query, (order_id, product_id, quantity, item['price']))
            
        # c. Insert into Payments table
        payment_query = "INSERT INTO Payments (OrderID, Amount, PaymentMethod, Status) VALUES (%s, %s, 'Card', 'Success')"
        cursor.execute(payment_query, (order_id, total_amount))
        
        # --- Commit Transaction ---
        db.commit()
        
        return jsonify({"success": True, "order_id": order_id, "message": f"Order {order_id} placed successfully! Total: ${total_amount}"}), 200

    except Exception as e:
        print(f"Transaction failed: {e}")
        if db:
            db.rollback()
        return jsonify({"success": False, "message": f"Order failed: {e}"}), 500
    finally:
        if cursor: cursor.close()
        if db and db.is_connected(): db.close()

# 🚀 Run the application
if __name__ == '__main__':
    app.run(debug=True, port=5000)
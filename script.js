// A simple state object to hold our data
const state = {
    allProducts: [],
    filteredProducts: [],
    cart: [],
    selectedCategory: 'All',
};

const API_BASE_URL = window.location.origin;

// --- DOM Elements ---
const categoryFilterEl = document.getElementById('category-filter');
const productListEl = document.getElementById('product-list');
const cartItemsEl = document.getElementById('cart-items');
const cartTotalEl = document.getElementById('cart-total');
const checkoutButtonEl = document.getElementById('checkout-button');
const customerIdInputEl = document.getElementById('customer-id');
const messageBoxEl = document.getElementById('message-box');
const emptyCartMessageEl = document.getElementById('empty-cart-message');

// --- Functions to Update the UI ---

const renderCategoryFilter = () => {
    categoryFilterEl.innerHTML = '';
    const categories = ['All', ...new Set(state.allProducts.map(p => p.Category))].sort();

    categories.forEach(category => {
        const button = document.createElement('button');
        button.className = 'filter-btn';
        button.textContent = category;
        button.dataset.category = category;
        if (category === state.selectedCategory) {
            button.classList.add('active');
        }
        categoryFilterEl.appendChild(button);
    });
};

const renderProducts = () => {
    state.filteredProducts = state.selectedCategory === 'All'
        ? state.allProducts
        : state.allProducts.filter(p => p.Category === state.selectedCategory);

    productListEl.innerHTML = '';
    if (state.filteredProducts.length === 0) {
        productListEl.innerHTML = `<p class="empty-message">No products found in this category.</p>`;
    }

    state.filteredProducts.forEach(product => {
        const productCard = document.createElement('div');
        productCard.className = 'product-card';
        productCard.innerHTML = `
            <div class="product-info">
                <h3>${product.Name}</h3>
                <p>Category: ${product.Category}</p>
                <p>Stock: ${product.StockQty}</p>
                <p class="product-price">$${product.Price.toFixed(2)}</p>
            </div>
            <button class="add-to-cart-btn" data-product-id="${product.ProductID}">Add to Cart</button>
        `;
        productListEl.appendChild(productCard);
    });
};

const renderCart = () => {
    cartItemsEl.innerHTML = '';
    let total = 0;

    if (state.cart.length === 0) {
        emptyCartMessageEl.classList.remove('hidden');
    } else {
        emptyCartMessageEl.classList.add('hidden');
    }

    state.cart.forEach(item => {
        const cartItemEl = document.createElement('div');
        cartItemEl.className = 'cart-item';
        cartItemEl.innerHTML = `
            <div class="cart-item-details">
                <h4>${item.name}</h4>
                <p>${item.quantity} x $${item.price.toFixed(2)}</p>
            </div>
            <button class="remove-btn" data-product-id="${item.id}">X</button>
        `;
        cartItemsEl.appendChild(cartItemEl);
        total += item.price * item.quantity;
    });

    cartTotalEl.textContent = `$${total.toFixed(2)}`;
    checkoutButtonEl.disabled = state.cart.length === 0;
};

const showMessage = (text, isSuccess) => {
    messageBoxEl.textContent = text;
    messageBoxEl.classList.remove('hidden', 'success', 'error');
    if (isSuccess) {
        messageBoxEl.classList.add('success');
    } else {
        messageBoxEl.classList.add('error');
    }

    setTimeout(() => {
        messageBoxEl.classList.add('hidden');
    }, 5000);
};

// --- Event Handlers ---

const handleAddToCart = (event) => {
    const button = event.target.closest('.add-to-cart-btn');
    if (!button) return;

    const productId = parseInt(button.dataset.productId);
    const product = state.allProducts.find(p => p.ProductID === productId);

    if (product) {
        const existingItem = state.cart.find(item => item.id === productId);
        if (existingItem) {
            existingItem.quantity++;
        } else {
            state.cart.push({
                id: product.ProductID,
                name: product.Name,
                price: product.Price,
                quantity: 1,
            });
        }
        renderCart();
    }
};

const handleRemoveFromCart = (event) => {
    const button = event.target.closest('.remove-btn');
    if (!button) return;

    const productId = parseInt(button.dataset.productId);
    state.cart = state.cart.filter(item => item.id !== productId);
    renderCart();
};

const handleCheckout = async () => {
    const customerId = customerIdInputEl.value.trim();

    if (!customerId || isNaN(parseInt(customerId)) || parseInt(customerId) <= 0) {
        showMessage("Please enter a valid Customer ID.", false);
        return;
    }

    if (state.cart.length === 0) {
        showMessage("Your cart is empty.", false);
        return;
    }

    showMessage('Processing Order...', true);

    const payload = {
        customer_id: parseInt(customerId),
        cart: state.cart.map(item => ({
            id: item.id,
            quantity: item.quantity,
            price: item.price
        }))
    };

    try {
        const response = await fetch(`${API_BASE_URL}/api/place_order`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        const result = await response.json();

        if (result.success) {
            showMessage(result.message, true);
            state.cart = [];
            customerIdInputEl.value = '';
            fetchProducts();
        } else {
            showMessage(result.message, false);
        }

    } catch (error) {
        console.error('Fetch error:', error);
        showMessage("A network error occurred. Check if the Flask API is running.", false);
    }
};

const handleCategoryFilter = (event) => {
    const button = event.target.closest('.filter-btn');
    if (!button) return;

    document.querySelector('.filter-btn.active')?.classList.remove('active');
    button.classList.add('active');

    state.selectedCategory = button.dataset.category;
    renderProducts();
};

// --- Initial Data Fetching ---

const fetchProducts = async () => {
    try {
        const response = await fetch(`${API_BASE_URL}/api/products`);
        if (!response.ok) {
            const errorData = await response.text();
            throw new Error(`API returned status ${response.status}. Check DB connection.`);
        }
        state.allProducts = await response.json();
        renderCategoryFilter();
        renderProducts();
    } catch (err) {
        const errorMessage = `Connection Error: Check if the Flask API is running. Details: ${err.message}`;
        productListEl.innerHTML = `<p class="error-message">${errorMessage}</p>`;
        console.error("Failed to fetch products:", err);
    }
};

// --- Event Listeners ---
document.addEventListener('DOMContentLoaded', () => {
    fetchProducts();
    renderCart();
});

productListEl.addEventListener('click', handleAddToCart);
cartItemsEl.addEventListener('click', handleRemoveFromCart);
checkoutButtonEl.addEventListener('click', handleCheckout);
categoryFilterEl.addEventListener('click', handleCategoryFilter);
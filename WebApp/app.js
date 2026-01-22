// SalvadoreX POS - Unified Web Application
// Works with NativeAPI bridge (Windows/Android) or localStorage fallback (browser)

// API wrapper - uses NativeAPI if available, otherwise localStorage
const API = {
    isOffline: function() {
        if (window.NativeAPI && typeof window.NativeAPI.isOffline === 'function') {
            return window.NativeAPI.isOffline();
        }
        return !navigator.onLine;
    },
    getProducts: function() {
        if (window.NativeAPI && typeof window.NativeAPI.getProducts === 'function') {
            return window.NativeAPI.getProducts();
        }
        return localStorage.getItem('products') || '[]';
    },
    saveProduct: function(json) {
        if (window.NativeAPI && typeof window.NativeAPI.saveProduct === 'function') {
            window.NativeAPI.saveProduct(json);
        } else {
            const products = JSON.parse(localStorage.getItem('products') || '[]');
            const product = JSON.parse(json);
            const idx = products.findIndex(p => p.id === product.id);
            if (idx >= 0) products[idx] = product;
            else products.push({ ...product, id: product.id || crypto.randomUUID() });
            localStorage.setItem('products', JSON.stringify(products));
        }
    },
    getCategories: function() {
        if (window.NativeAPI && typeof window.NativeAPI.getCategories === 'function') {
            return window.NativeAPI.getCategories();
        }
        return localStorage.getItem('categories') || '[]';
    },
    saveCategory: function(json) {
        if (window.NativeAPI && typeof window.NativeAPI.saveCategory === 'function') {
            window.NativeAPI.saveCategory(json);
        } else {
            const categories = JSON.parse(localStorage.getItem('categories') || '[]');
            const category = JSON.parse(json);
            const idx = categories.findIndex(c => c.id === category.id);
            if (idx >= 0) categories[idx] = category;
            else categories.push({ ...category, id: category.id || crypto.randomUUID() });
            localStorage.setItem('categories', JSON.stringify(categories));
        }
    },
    getCustomers: function() {
        if (window.NativeAPI && typeof window.NativeAPI.getCustomers === 'function') {
            return window.NativeAPI.getCustomers();
        }
        return localStorage.getItem('customers') || '[]';
    },
    saveCustomer: function(json) {
        if (window.NativeAPI && typeof window.NativeAPI.saveCustomer === 'function') {
            window.NativeAPI.saveCustomer(json);
        } else {
            const customers = JSON.parse(localStorage.getItem('customers') || '[]');
            const customer = JSON.parse(json);
            const idx = customers.findIndex(c => c.id === customer.id);
            if (idx >= 0) customers[idx] = customer;
            else customers.push({ ...customer, id: customer.id || crypto.randomUUID() });
            localStorage.setItem('customers', JSON.stringify(customers));
        }
    },
    getSales: function() {
        if (window.NativeAPI && typeof window.NativeAPI.getSales === 'function') {
            return window.NativeAPI.getSales();
        }
        return localStorage.getItem('sales') || '[]';
    },
    saveSale: function(json) {
        if (window.NativeAPI && typeof window.NativeAPI.saveSale === 'function') {
            window.NativeAPI.saveSale(json);
        } else {
            const sales = JSON.parse(localStorage.getItem('sales') || '[]');
            const sale = JSON.parse(json);
            sales.push({ ...sale, id: sale.id || crypto.randomUUID() });
            localStorage.setItem('sales', JSON.stringify(sales));
        }
    },
    getSetting: function(key) {
        if (window.NativeAPI && typeof window.NativeAPI.getSetting === 'function') {
            return window.NativeAPI.getSetting(key);
        }
        return localStorage.getItem('setting_' + key) || '';
    },
    setSetting: function(key, value) {
        if (window.NativeAPI && typeof window.NativeAPI.setSetting === 'function') {
            window.NativeAPI.setSetting(key, value);
        } else {
            localStorage.setItem('setting_' + key, value);
        }
    },
    syncNow: function() {
        if (window.NativeAPI && typeof window.NativeAPI.syncNow === 'function') {
            window.NativeAPI.syncNow();
        }
    },
    getHardwareId: function() {
        if (window.NativeAPI && typeof window.NativeAPI.getHardwareId === 'function') {
            return window.NativeAPI.getHardwareId();
        }
        return 'BROWSER-MODE';
    }
};

// Constants
const IVA_RATE = 0.16;

// State
let products = [];
let categories = [];
let customers = [];
let cart = [];
let selectedCategory = 'all';
let globalDiscount = 0;
let paymentMethod = 'cash';
let currentPage = 'pos';
let numpadInput = '';
let currentPaymentTotal = 0;
let lastCompletedSale = null;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, initializing app...');
    console.log('NativeAPI available:', !!window.NativeAPI);
    
    setTimeout(function() {
        initApp();
    }, 100);
});

function initApp() {
    try {
        loadData();
        setupEventListeners();
        updateConnectionStatus();
        renderCategoryTabs();
        renderProducts();
        renderCart();
        
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
        
        console.log('App initialized successfully');
        console.log('Products loaded:', products.length);
        console.log('Categories loaded:', categories.length);
    } catch(e) {
        console.error('Error initializing app:', e);
    }
    
    window.addEventListener('online', updateConnectionStatus);
    window.addEventListener('offline', updateConnectionStatus);
}

function loadData() {
    try {
        const productsData = API.getProducts();
        products = JSON.parse(productsData || '[]');
        
        const categoriesData = API.getCategories();
        categories = JSON.parse(categoriesData || '[]');
        
        const customersData = API.getCustomers();
        customers = JSON.parse(customersData || '[]');
        
    } catch(e) {
        console.error('Error loading data:', e);
        products = [];
        categories = [];
        customers = [];
    }
}

function setupEventListeners() {
    // Sidebar navigation
    document.querySelectorAll('.sidebar-item').forEach(function(item) {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            const page = this.getAttribute('data-page');
            navigateTo(page);
        });
    });
    
    // Search input
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('input', debounce(renderProducts, 200));
        searchInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                handleBarcodeSearch(this.value);
            }
        });
    }
    
    // Category filter in header
    const categoryFilter = document.getElementById('category-filter-header');
    if (categoryFilter) {
        categoryFilter.addEventListener('change', function(e) {
            selectedCategory = e.target.value;
            renderProducts();
            renderCategoryTabs();
        });
    }
    
    // Global discount
    const globalDiscountInput = document.getElementById('global-discount');
    if (globalDiscountInput) {
        globalDiscountInput.addEventListener('input', function(e) {
            globalDiscount = Math.min(100, Math.max(0, parseFloat(e.target.value) || 0));
            updateCartTotals();
        });
    }
    
    // Clear cart
    const clearCartBtn = document.getElementById('clear-cart-btn');
    if (clearCartBtn) {
        clearCartBtn.addEventListener('click', clearCart);
    }
    
    // Checkout
    const checkoutBtn = document.getElementById('checkout-btn');
    if (checkoutBtn) {
        checkoutBtn.addEventListener('click', openPaymentModal);
    }
    
    // Payment modal
    const closePaymentBtn = document.getElementById('close-payment');
    if (closePaymentBtn) {
        closePaymentBtn.addEventListener('click', closePaymentModal);
    }
    
    const cancelPaymentBtn = document.getElementById('cancel-payment');
    if (cancelPaymentBtn) {
        cancelPaymentBtn.addEventListener('click', closePaymentModal);
    }
    
    const completeSaleBtn = document.getElementById('complete-sale');
    if (completeSaleBtn) {
        completeSaleBtn.addEventListener('click', completeSale);
    }
    
    // Payment methods
    document.querySelectorAll('.payment-method').forEach(function(btn) {
        btn.addEventListener('click', function() {
            selectPaymentMethod(this.getAttribute('data-method'));
        });
    });
    
    // Numpad keys
    document.querySelectorAll('.numpad-key').forEach(function(btn) {
        btn.addEventListener('click', function() {
            handleNumpadPress(this.getAttribute('data-key'));
        });
    });
    
    // Quick amount buttons
    document.querySelectorAll('.quick-amount').forEach(function(btn) {
        btn.addEventListener('click', function() {
            handleQuickAmount(parseInt(this.getAttribute('data-amount')));
        });
    });
    
    // Exact amount button
    const exactAmountBtn = document.getElementById('exact-amount-btn');
    if (exactAmountBtn) {
        exactAmountBtn.addEventListener('click', handleExactAmount);
    }
    
    // Numpad clear button
    const numpadClearBtn = document.getElementById('numpad-clear');
    if (numpadClearBtn) {
        numpadClearBtn.addEventListener('click', handleNumpadClear);
    }
    
    // Numpad backspace button
    const numpadBackspaceBtn = document.getElementById('numpad-backspace');
    if (numpadBackspaceBtn) {
        numpadBackspaceBtn.addEventListener('click', handleNumpadBackspace);
    }
    
    // View Switcher (Simulated)
    document.querySelectorAll('.view-switcher-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const view = this.getAttribute('data-view');
            switchView(view);
        });
    });
    
    // Add product modal
    const closeAddProductBtn = document.getElementById('close-add-product');
    if (closeAddProductBtn) {
        closeAddProductBtn.addEventListener('click', closeAddProductModal);
    }
    
    const saveNewProductBtn = document.getElementById('save-new-product');
    if (saveNewProductBtn) {
        saveNewProductBtn.addEventListener('click', saveNewProduct);
    }
    
    // Close modals on backdrop click
    document.getElementById('payment-modal')?.addEventListener('click', function(e) {
        if (e.target === this) closePaymentModal();
    });
    
    document.getElementById('add-product-modal')?.addEventListener('click', function(e) {
        if (e.target === this) closeAddProductModal();
    });
    
    // Receipt modal
    const closeReceiptBtn = document.getElementById('close-receipt');
    if (closeReceiptBtn) {
        closeReceiptBtn.addEventListener('click', closeReceiptModal);
    }
    
    const printReceiptBtn = document.getElementById('print-receipt-btn');
    if (printReceiptBtn) {
        printReceiptBtn.addEventListener('click', function() {
            printReceipt(lastCompletedSale);
        });
    }
    
    const newSaleBtn = document.getElementById('new-sale-btn');
    if (newSaleBtn) {
        newSaleBtn.addEventListener('click', closeReceiptModal);
    }
    
    document.getElementById('receipt-modal')?.addEventListener('click', function(e) {
        if (e.target === this) closeReceiptModal();
    });
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function navigateTo(page) {
    currentPage = page;
    
    document.querySelectorAll('.sidebar-item').forEach(function(item) {
        const itemPage = item.getAttribute('data-page');
        if (itemPage === page) {
            item.classList.add('active');
            item.classList.remove('text-sidebar-muted');
            item.classList.add('text-white');
        } else {
            item.classList.remove('active');
            item.classList.add('text-sidebar-muted');
            item.classList.remove('text-white');
        }
    });
    
    // Show/hide POS-specific elements
    const posContent = document.getElementById('pos-content');
    const moduleContent = document.getElementById('module-content');
    const cartSidebar = document.getElementById('cart-sidebar');
    const searchHeader = document.getElementById('search-header');
    
    if (page === 'pos') {
        if (posContent) posContent.classList.remove('hidden');
        if (moduleContent) moduleContent.classList.add('hidden');
        if (cartSidebar) cartSidebar.classList.remove('hidden');
        if (searchHeader) searchHeader.classList.remove('hidden');
    } else {
        if (posContent) posContent.classList.add('hidden');
        if (moduleContent) moduleContent.classList.remove('hidden');
        if (cartSidebar) cartSidebar.classList.add('hidden');
        if (searchHeader) searchHeader.classList.add('hidden');
        renderModuleContent(page);
    }
    
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

function renderModuleContent(page) {
    const container = document.getElementById('module-content');
    if (!container) return;
    
    const moduleRenderers = {
        'cocina': renderCocinaModule,
        'corte': renderCorteModule,
        'fila': renderFilaModule,
        'dashboard': renderDashboardModule,
        'inventario': renderInventarioModule,
        'ingredientes': renderIngredientesModule,
        'menu-digital': renderMenuDigitalModule,
        'devoluciones': renderDevolucionesModule,
        'clientes': renderClientesModule,
        'solicitudes': renderSolicitudesModule,
        'reportes': renderReportesModule,
        'facturacion': renderFacturacionModule,
        'marcas-blancas': renderMarcasBlancasModule,
        'soporte': renderSoporteModule,
        'configuracion': renderConfiguracionModule
    };
    
    const renderer = moduleRenderers[page];
    if (renderer) {
        container.innerHTML = renderer();
    }
    
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

// ==========================================
// MODULE RENDERERS
// ==========================================

function renderCocinaModule() {
    const sales = JSON.parse(API.getSales() || '[]');
    const pendingOrders = sales.slice(-5).reverse();
    
    let ordersHTML = '';
    if (pendingOrders.length > 0) {
        pendingOrders.forEach((order, idx) => {
            const status = idx === 0 ? 'En preparación' : 'Pendiente';
            const statusColor = idx === 0 ? 'bg-yellow-500' : 'bg-blue-500';
            ordersHTML += `
                <div class="bg-white rounded-lg border border-border p-4 shadow-sm">
                    <div class="flex justify-between items-center mb-3">
                        <span class="font-bold text-lg">#${order.receipt_number || (1000 + idx)}</span>
                        <span class="${statusColor} text-white text-xs px-2 py-1 rounded-full">${status}</span>
                    </div>
                    <div class="space-y-2 mb-3">
                        ${(order.items || []).map(item => `
                            <div class="flex justify-between text-sm">
                                <span>${item.quantity}x ${item.product_name}</span>
                            </div>
                        `).join('')}
                    </div>
                    <div class="flex gap-2 mt-3">
                        <button class="flex-1 h-9 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700 transition" onclick="showToast('Orden marcada como lista', 'success')">
                            <i data-lucide="check" class="w-4 h-4 inline mr-1"></i>Listo
                        </button>
                    </div>
                </div>
            `;
        });
    } else {
        ordersHTML = `
            <div class="col-span-full flex flex-col items-center justify-center py-16 text-muted-foreground">
                <i data-lucide="chef-hat" class="w-16 h-16 mb-4 stroke-1"></i>
                <p class="font-medium text-lg">Sin órdenes pendientes</p>
                <p class="text-sm">Las nuevas órdenes aparecerán aquí</p>
            </div>
        `;
    }
    
    return `
        <div class="h-full flex flex-col">
            <div class="bg-white border-b border-border px-6 py-4">
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-3">
                        <i data-lucide="utensils-crossed" class="w-6 h-6 text-primary"></i>
                        <div>
                            <h1 class="text-xl font-bold text-foreground">Cocina</h1>
                            <p class="text-sm text-muted-foreground">Pantalla de órdenes para cocina</p>
                        </div>
                    </div>
                    <div class="flex gap-2">
                        <button class="h-9 px-4 bg-primary text-white text-sm font-medium rounded-md hover:bg-primary/90 transition flex items-center gap-2" onclick="showToast('Actualizando órdenes...', 'info')">
                            <i data-lucide="refresh-cw" class="w-4 h-4"></i>
                            Actualizar
                        </button>
                    </div>
                </div>
            </div>
            <div class="flex-1 overflow-auto p-6 bg-muted">
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    ${ordersHTML}
                </div>
            </div>
        </div>
    `;
}

function renderCorteModule() {
    const sales = JSON.parse(API.getSales() || '[]');
    const today = new Date().toDateString();
    const todaySales = sales.filter(s => new Date(s.created_at).toDateString() === today);
    const totalVentas = todaySales.reduce((sum, s) => sum + (s.total || 0), 0);
    const efectivo = todaySales.filter(s => s.payment_method === 'cash').reduce((sum, s) => sum + (s.total || 0), 0);
    const tarjeta = todaySales.filter(s => s.payment_method === 'card').reduce((sum, s) => sum + (s.total || 0), 0);
    const transferencia = todaySales.filter(s => s.payment_method === 'transfer').reduce((sum, s) => sum + (s.total || 0), 0);
    
    return `
        <div class="h-full flex flex-col">
            <div class="bg-white border-b border-border px-6 py-4">
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-3">
                        <i data-lucide="wallet" class="w-6 h-6 text-primary"></i>
                        <div>
                            <h1 class="text-xl font-bold text-foreground">Corte de Caja</h1>
                            <p class="text-sm text-muted-foreground">Resumen diario de ventas y cierre de caja</p>
                        </div>
                    </div>
                    <button class="h-9 px-4 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 transition flex items-center gap-2" onclick="showToast('Funcionalidad próximamente', 'info')">
                        <i data-lucide="printer" class="w-4 h-4"></i>
                        Imprimir Corte
                    </button>
                </div>
            </div>
            <div class="flex-1 overflow-auto p-6 bg-muted">
                <div class="max-w-4xl mx-auto space-y-6">
                    <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div class="bg-white rounded-lg border border-border p-4">
                            <div class="flex items-center gap-2 mb-2">
                                <i data-lucide="trending-up" class="w-5 h-5 text-green-600"></i>
                                <span class="text-sm text-muted-foreground">Ventas del Día</span>
                            </div>
                            <p class="text-2xl font-bold text-foreground">$${totalVentas.toFixed(2)}</p>
                            <p class="text-xs text-muted-foreground">${todaySales.length} transacciones</p>
                        </div>
                        <div class="bg-white rounded-lg border border-border p-4">
                            <div class="flex items-center gap-2 mb-2">
                                <i data-lucide="banknote" class="w-5 h-5 text-green-600"></i>
                                <span class="text-sm text-muted-foreground">Efectivo</span>
                            </div>
                            <p class="text-2xl font-bold text-foreground">$${efectivo.toFixed(2)}</p>
                        </div>
                        <div class="bg-white rounded-lg border border-border p-4">
                            <div class="flex items-center gap-2 mb-2">
                                <i data-lucide="credit-card" class="w-5 h-5 text-blue-600"></i>
                                <span class="text-sm text-muted-foreground">Tarjeta</span>
                            </div>
                            <p class="text-2xl font-bold text-foreground">$${tarjeta.toFixed(2)}</p>
                        </div>
                        <div class="bg-white rounded-lg border border-border p-4">
                            <div class="flex items-center gap-2 mb-2">
                                <i data-lucide="smartphone" class="w-5 h-5 text-purple-600"></i>
                                <span class="text-sm text-muted-foreground">Transferencia</span>
                            </div>
                            <p class="text-2xl font-bold text-foreground">$${transferencia.toFixed(2)}</p>
                        </div>
                    </div>
                    <div class="bg-white rounded-lg border border-border p-6">
                        <h3 class="font-semibold text-lg mb-4">Últimas Ventas</h3>
                        <div class="space-y-3">
                            ${todaySales.slice(-5).reverse().map(sale => `
                                <div class="flex justify-between items-center py-2 border-b border-border last:border-0">
                                    <div>
                                        <span class="font-medium">#${sale.receipt_number || 'N/A'}</span>
                                        <span class="text-sm text-muted-foreground ml-2">${formatTime(sale.created_at)}</span>
                                    </div>
                                    <span class="font-bold text-primary">$${(sale.total || 0).toFixed(2)}</span>
                                </div>
                            `).join('') || '<p class="text-muted-foreground text-center py-4">No hay ventas hoy</p>'}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderFilaModule() {
    return `
        <div class="h-full flex flex-col">
            <div class="bg-white border-b border-border px-6 py-4">
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-3">
                        <i data-lucide="users" class="w-6 h-6 text-primary"></i>
                        <div>
                            <h1 class="text-xl font-bold text-foreground">Fila Virtual</h1>
                            <p class="text-sm text-muted-foreground">Gestión de turnos y cola de clientes</p>
                        </div>
                    </div>
                    <button class="h-9 px-4 bg-primary text-white text-sm font-medium rounded-md hover:bg-primary/90 transition flex items-center gap-2" onclick="showToast('Nuevo turno agregado', 'success')">
                        <i data-lucide="plus" class="w-4 h-4"></i>
                        Nuevo Turno
                    </button>
                </div>
            </div>
            <div class="flex-1 overflow-auto p-6 bg-muted">
                <div class="max-w-4xl mx-auto">
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                        <div class="bg-primary text-white rounded-lg p-6 text-center">
                            <p class="text-sm opacity-80 mb-1">Turno Actual</p>
                            <p class="text-5xl font-bold">A-001</p>
                        </div>
                        <div class="bg-white rounded-lg border border-border p-6 text-center">
                            <p class="text-sm text-muted-foreground mb-1">En Espera</p>
                            <p class="text-4xl font-bold text-foreground">3</p>
                        </div>
                        <div class="bg-white rounded-lg border border-border p-6 text-center">
                            <p class="text-sm text-muted-foreground mb-1">Tiempo Promedio</p>
                            <p class="text-4xl font-bold text-foreground">5 min</p>
                        </div>
                    </div>
                    <div class="bg-white rounded-lg border border-border p-6">
                        <h3 class="font-semibold text-lg mb-4">Cola de Espera</h3>
                        <div class="space-y-3">
                            <div class="flex justify-between items-center py-3 px-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                                <div class="flex items-center gap-3">
                                    <span class="bg-yellow-500 text-white w-10 h-10 rounded-full flex items-center justify-center font-bold">A1</span>
                                    <span class="font-medium">En atención</span>
                                </div>
                                <button class="h-8 px-3 bg-green-600 text-white text-sm rounded-md" onclick="showToast('Turno completado', 'success')">Completar</button>
                            </div>
                            <div class="flex justify-between items-center py-3 px-4 bg-muted rounded-lg">
                                <div class="flex items-center gap-3">
                                    <span class="bg-primary text-white w-10 h-10 rounded-full flex items-center justify-center font-bold">A2</span>
                                    <span class="font-medium">Esperando</span>
                                </div>
                                <button class="h-8 px-3 bg-primary text-white text-sm rounded-md" onclick="showToast('Llamando turno A2', 'info')">Llamar</button>
                            </div>
                            <div class="flex justify-between items-center py-3 px-4 bg-muted rounded-lg">
                                <div class="flex items-center gap-3">
                                    <span class="bg-primary text-white w-10 h-10 rounded-full flex items-center justify-center font-bold">A3</span>
                                    <span class="font-medium">Esperando</span>
                                </div>
                                <button class="h-8 px-3 bg-primary text-white text-sm rounded-md" onclick="showToast('Llamando turno A3', 'info')">Llamar</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderDashboardModule() {
    const sales = JSON.parse(API.getSales() || '[]');
    const totalVentas = sales.reduce((sum, s) => sum + (s.total || 0), 0);
    const totalProductos = products.length;
    const totalClientes = customers.length;
    
    return `
        <div class="h-full flex flex-col">
            <div class="bg-white border-b border-border px-6 py-4">
                <div class="flex items-center gap-3">
                    <i data-lucide="home" class="w-6 h-6 text-primary"></i>
                    <div>
                        <h1 class="text-xl font-bold text-foreground">Dashboard</h1>
                        <p class="text-sm text-muted-foreground">Resumen general del negocio</p>
                    </div>
                </div>
            </div>
            <div class="flex-1 overflow-auto p-6 bg-muted">
                <div class="max-w-6xl mx-auto space-y-6">
                    <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div class="bg-white rounded-lg border border-border p-4">
                            <div class="flex items-center gap-2 mb-2">
                                <i data-lucide="dollar-sign" class="w-5 h-5 text-green-600"></i>
                                <span class="text-sm text-muted-foreground">Ventas Totales</span>
                            </div>
                            <p class="text-2xl font-bold text-foreground">$${totalVentas.toFixed(2)}</p>
                        </div>
                        <div class="bg-white rounded-lg border border-border p-4">
                            <div class="flex items-center gap-2 mb-2">
                                <i data-lucide="shopping-bag" class="w-5 h-5 text-blue-600"></i>
                                <span class="text-sm text-muted-foreground">Transacciones</span>
                            </div>
                            <p class="text-2xl font-bold text-foreground">${sales.length}</p>
                        </div>
                        <div class="bg-white rounded-lg border border-border p-4">
                            <div class="flex items-center gap-2 mb-2">
                                <i data-lucide="package" class="w-5 h-5 text-purple-600"></i>
                                <span class="text-sm text-muted-foreground">Productos</span>
                            </div>
                            <p class="text-2xl font-bold text-foreground">${totalProductos}</p>
                        </div>
                        <div class="bg-white rounded-lg border border-border p-4">
                            <div class="flex items-center gap-2 mb-2">
                                <i data-lucide="users" class="w-5 h-5 text-orange-600"></i>
                                <span class="text-sm text-muted-foreground">Clientes</span>
                            </div>
                            <p class="text-2xl font-bold text-foreground">${totalClientes}</p>
                        </div>
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div class="bg-white rounded-lg border border-border p-6">
                            <h3 class="font-semibold text-lg mb-4">Ventas por Día</h3>
                            <div class="h-48 flex items-end justify-around gap-2">
                                <div class="flex flex-col items-center">
                                    <div class="w-12 bg-primary/20 rounded-t" style="height: 60%"></div>
                                    <span class="text-xs mt-2">Lun</span>
                                </div>
                                <div class="flex flex-col items-center">
                                    <div class="w-12 bg-primary/40 rounded-t" style="height: 80%"></div>
                                    <span class="text-xs mt-2">Mar</span>
                                </div>
                                <div class="flex flex-col items-center">
                                    <div class="w-12 bg-primary/60 rounded-t" style="height: 45%"></div>
                                    <span class="text-xs mt-2">Mié</span>
                                </div>
                                <div class="flex flex-col items-center">
                                    <div class="w-12 bg-primary/80 rounded-t" style="height: 70%"></div>
                                    <span class="text-xs mt-2">Jue</span>
                                </div>
                                <div class="flex flex-col items-center">
                                    <div class="w-12 bg-primary rounded-t" style="height: 90%"></div>
                                    <span class="text-xs mt-2">Vie</span>
                                </div>
                                <div class="flex flex-col items-center">
                                    <div class="w-12 bg-primary rounded-t" style="height: 100%"></div>
                                    <span class="text-xs mt-2">Sáb</span>
                                </div>
                                <div class="flex flex-col items-center">
                                    <div class="w-12 bg-primary/50 rounded-t" style="height: 55%"></div>
                                    <span class="text-xs mt-2">Dom</span>
                                </div>
                            </div>
                        </div>
                        <div class="bg-white rounded-lg border border-border p-6">
                            <h3 class="font-semibold text-lg mb-4">Productos Más Vendidos</h3>
                            <div class="space-y-3">
                                <div class="flex justify-between items-center">
                                    <span>Producto 1</span>
                                    <div class="flex items-center gap-2">
                                        <div class="w-24 h-2 bg-muted rounded-full overflow-hidden"><div class="h-full bg-primary" style="width: 90%"></div></div>
                                        <span class="text-sm text-muted-foreground">45</span>
                                    </div>
                                </div>
                                <div class="flex justify-between items-center">
                                    <span>Producto 2</span>
                                    <div class="flex items-center gap-2">
                                        <div class="w-24 h-2 bg-muted rounded-full overflow-hidden"><div class="h-full bg-primary" style="width: 75%"></div></div>
                                        <span class="text-sm text-muted-foreground">38</span>
                                    </div>
                                </div>
                                <div class="flex justify-between items-center">
                                    <span>Producto 3</span>
                                    <div class="flex items-center gap-2">
                                        <div class="w-24 h-2 bg-muted rounded-full overflow-hidden"><div class="h-full bg-primary" style="width: 60%"></div></div>
                                        <span class="text-sm text-muted-foreground">30</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderInventarioModule() {
    let productsHTML = '';
    if (products.length > 0) {
        products.forEach(product => {
            const stock = product.stock || 0;
            const stockColor = stock <= 5 ? 'text-red-600' : stock <= 10 ? 'text-yellow-600' : 'text-green-600';
            productsHTML += `
                <tr class="border-b border-border hover:bg-muted/50">
                    <td class="py-3 px-4">
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 bg-muted rounded-md flex items-center justify-center">
                                <i data-lucide="package" class="w-5 h-5 text-muted-foreground"></i>
                            </div>
                            <span class="font-medium">${escapeHtml(product.name)}</span>
                        </div>
                    </td>
                    <td class="py-3 px-4 text-muted-foreground">${product.sku || '-'}</td>
                    <td class="py-3 px-4 font-medium">$${parseFloat(product.price || 0).toFixed(2)}</td>
                    <td class="py-3 px-4 ${stockColor} font-medium">${stock}</td>
                    <td class="py-3 px-4">
                        <button class="h-8 px-3 text-sm border border-border rounded-md hover:bg-accent" onclick="showToast('Editar producto próximamente', 'info')">Editar</button>
                    </td>
                </tr>
            `;
        });
    } else {
        productsHTML = `
            <tr><td colspan="5" class="py-8 text-center text-muted-foreground">
                <i data-lucide="package" class="w-12 h-12 mx-auto mb-2 stroke-1"></i>
                <p>No hay productos registrados</p>
            </td></tr>
        `;
    }
    
    return `
        <div class="h-full flex flex-col">
            <div class="bg-white border-b border-border px-6 py-4">
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-3">
                        <i data-lucide="package" class="w-6 h-6 text-primary"></i>
                        <div>
                            <h1 class="text-xl font-bold text-foreground">Inventario</h1>
                            <p class="text-sm text-muted-foreground">Gestión de productos y existencias</p>
                        </div>
                    </div>
                    <button class="h-9 px-4 bg-primary text-white text-sm font-medium rounded-md hover:bg-primary/90 transition flex items-center gap-2" onclick="openAddProductModal()">
                        <i data-lucide="plus" class="w-4 h-4"></i>
                        Agregar Producto
                    </button>
                </div>
            </div>
            <div class="flex-1 overflow-auto p-6 bg-muted">
                <div class="bg-white rounded-lg border border-border overflow-hidden">
                    <table class="w-full">
                        <thead class="bg-muted/50">
                            <tr>
                                <th class="text-left py-3 px-4 font-medium text-muted-foreground">Producto</th>
                                <th class="text-left py-3 px-4 font-medium text-muted-foreground">SKU</th>
                                <th class="text-left py-3 px-4 font-medium text-muted-foreground">Precio</th>
                                <th class="text-left py-3 px-4 font-medium text-muted-foreground">Stock</th>
                                <th class="text-left py-3 px-4 font-medium text-muted-foreground">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${productsHTML}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
}

function renderIngredientesModule() {
    return `
        <div class="h-full flex flex-col">
            <div class="bg-white border-b border-border px-6 py-4">
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-3">
                        <i data-lucide="soup" class="w-6 h-6 text-primary"></i>
                        <div>
                            <h1 class="text-xl font-bold text-foreground">Ingredientes</h1>
                            <p class="text-sm text-muted-foreground">Control de ingredientes y materias primas</p>
                        </div>
                    </div>
                    <button class="h-9 px-4 bg-primary text-white text-sm font-medium rounded-md hover:bg-primary/90 transition flex items-center gap-2" onclick="showToast('Próximamente', 'info')">
                        <i data-lucide="plus" class="w-4 h-4"></i>
                        Agregar Ingrediente
                    </button>
                </div>
            </div>
            <div class="flex-1 overflow-auto p-6 bg-muted">
                <div class="max-w-4xl mx-auto">
                    <div class="bg-white rounded-lg border border-border overflow-hidden">
                        <table class="w-full">
                            <thead class="bg-muted/50">
                                <tr>
                                    <th class="text-left py-3 px-4 font-medium text-muted-foreground">Ingrediente</th>
                                    <th class="text-left py-3 px-4 font-medium text-muted-foreground">Cantidad</th>
                                    <th class="text-left py-3 px-4 font-medium text-muted-foreground">Unidad</th>
                                    <th class="text-left py-3 px-4 font-medium text-muted-foreground">Estado</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr class="border-b border-border">
                                    <td class="py-3 px-4 font-medium">Harina de Trigo</td>
                                    <td class="py-3 px-4">25</td>
                                    <td class="py-3 px-4">kg</td>
                                    <td class="py-3 px-4"><span class="bg-green-100 text-green-700 text-xs px-2 py-1 rounded-full">Suficiente</span></td>
                                </tr>
                                <tr class="border-b border-border">
                                    <td class="py-3 px-4 font-medium">Aceite Vegetal</td>
                                    <td class="py-3 px-4">8</td>
                                    <td class="py-3 px-4">L</td>
                                    <td class="py-3 px-4"><span class="bg-yellow-100 text-yellow-700 text-xs px-2 py-1 rounded-full">Bajo</span></td>
                                </tr>
                                <tr class="border-b border-border">
                                    <td class="py-3 px-4 font-medium">Sal</td>
                                    <td class="py-3 px-4">5</td>
                                    <td class="py-3 px-4">kg</td>
                                    <td class="py-3 px-4"><span class="bg-green-100 text-green-700 text-xs px-2 py-1 rounded-full">Suficiente</span></td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderMenuDigitalModule() {
    const businessName = API.getSetting('business_name') || 'Mi Negocio';
    
    return `
        <div class="h-full flex flex-col">
            <div class="bg-white border-b border-border px-6 py-4">
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-3">
                        <i data-lucide="chef-hat" class="w-6 h-6 text-primary"></i>
                        <div>
                            <h1 class="text-xl font-bold text-foreground">Menú Digital</h1>
                            <p class="text-sm text-muted-foreground">Códigos QR para tu menú digital</p>
                        </div>
                    </div>
                    <button class="h-9 px-4 bg-primary text-white text-sm font-medium rounded-md hover:bg-primary/90 transition flex items-center gap-2" onclick="showToast('Próximamente', 'info')">
                        <i data-lucide="qr-code" class="w-4 h-4"></i>
                        Generar QR
                    </button>
                </div>
            </div>
            <div class="flex-1 overflow-auto p-6 bg-muted">
                <div class="max-w-2xl mx-auto">
                    <div class="bg-white rounded-lg border border-border p-8 text-center">
                        <div class="w-48 h-48 mx-auto bg-muted rounded-lg flex items-center justify-center mb-6">
                            <div class="grid grid-cols-5 gap-1">
                                ${Array(25).fill().map(() => `<div class="w-6 h-6 ${Math.random() > 0.5 ? 'bg-foreground' : 'bg-white border border-border'} rounded-sm"></div>`).join('')}
                            </div>
                        </div>
                        <h3 class="text-lg font-semibold mb-2">${escapeHtml(businessName)}</h3>
                        <p class="text-muted-foreground mb-4">Escanea el código QR para ver el menú</p>
                        <div class="flex justify-center gap-3">
                            <button class="h-9 px-4 border border-border rounded-md text-sm font-medium hover:bg-accent transition flex items-center gap-2" onclick="showToast('Próximamente', 'info')">
                                <i data-lucide="download" class="w-4 h-4"></i>
                                Descargar
                            </button>
                            <button class="h-9 px-4 border border-border rounded-md text-sm font-medium hover:bg-accent transition flex items-center gap-2" onclick="showToast('Próximamente', 'info')">
                                <i data-lucide="share-2" class="w-4 h-4"></i>
                                Compartir
                            </button>
                        </div>
                    </div>
                    <div class="mt-6 bg-white rounded-lg border border-border p-6">
                        <h3 class="font-semibold mb-4">Productos en el Menú</h3>
                        <p class="text-muted-foreground">${products.length} productos disponibles</p>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderDevolucionesModule() {
    return `
        <div class="h-full flex flex-col">
            <div class="bg-white border-b border-border px-6 py-4">
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-3">
                        <i data-lucide="rotate-ccw" class="w-6 h-6 text-primary"></i>
                        <div>
                            <h1 class="text-xl font-bold text-foreground">Devoluciones</h1>
                            <p class="text-sm text-muted-foreground">Gestión de devoluciones y reembolsos</p>
                        </div>
                    </div>
                    <button class="h-9 px-4 bg-primary text-white text-sm font-medium rounded-md hover:bg-primary/90 transition flex items-center gap-2" onclick="showToast('Próximamente', 'info')">
                        <i data-lucide="plus" class="w-4 h-4"></i>
                        Nueva Devolución
                    </button>
                </div>
            </div>
            <div class="flex-1 overflow-auto p-6 bg-muted">
                <div class="max-w-4xl mx-auto">
                    <div class="bg-white rounded-lg border border-border p-6">
                        <div class="flex flex-col items-center justify-center py-12 text-muted-foreground">
                            <i data-lucide="rotate-ccw" class="w-16 h-16 mb-4 stroke-1"></i>
                            <p class="font-medium text-lg mb-2">Sin devoluciones</p>
                            <p class="text-sm">No hay devoluciones registradas</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderClientesModule() {
    let customersHTML = '';
    if (customers.length > 0) {
        customers.forEach(customer => {
            customersHTML += `
                <tr class="border-b border-border hover:bg-muted/50">
                    <td class="py-3 px-4">
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 bg-primary text-white rounded-full flex items-center justify-center font-semibold">
                                ${(customer.name || 'C').charAt(0).toUpperCase()}
                            </div>
                            <span class="font-medium">${escapeHtml(customer.name || 'Sin nombre')}</span>
                        </div>
                    </td>
                    <td class="py-3 px-4 text-muted-foreground">${customer.phone || '-'}</td>
                    <td class="py-3 px-4 text-muted-foreground">${customer.email || '-'}</td>
                    <td class="py-3 px-4">
                        <button class="h-8 px-3 text-sm border border-border rounded-md hover:bg-accent" onclick="showToast('Editar cliente próximamente', 'info')">Editar</button>
                    </td>
                </tr>
            `;
        });
    } else {
        customersHTML = `
            <tr><td colspan="4" class="py-8 text-center text-muted-foreground">
                <i data-lucide="users" class="w-12 h-12 mx-auto mb-2 stroke-1"></i>
                <p>No hay clientes registrados</p>
            </td></tr>
        `;
    }
    
    return `
        <div class="h-full flex flex-col">
            <div class="bg-white border-b border-border px-6 py-4">
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-3">
                        <i data-lucide="users" class="w-6 h-6 text-primary"></i>
                        <div>
                            <h1 class="text-xl font-bold text-foreground">Clientes</h1>
                            <p class="text-sm text-muted-foreground">Base de datos de clientes</p>
                        </div>
                    </div>
                    <button class="h-9 px-4 bg-primary text-white text-sm font-medium rounded-md hover:bg-primary/90 transition flex items-center gap-2" onclick="showToast('Próximamente', 'info')">
                        <i data-lucide="plus" class="w-4 h-4"></i>
                        Agregar Cliente
                    </button>
                </div>
            </div>
            <div class="flex-1 overflow-auto p-6 bg-muted">
                <div class="bg-white rounded-lg border border-border overflow-hidden">
                    <table class="w-full">
                        <thead class="bg-muted/50">
                            <tr>
                                <th class="text-left py-3 px-4 font-medium text-muted-foreground">Nombre</th>
                                <th class="text-left py-3 px-4 font-medium text-muted-foreground">Teléfono</th>
                                <th class="text-left py-3 px-4 font-medium text-muted-foreground">Email</th>
                                <th class="text-left py-3 px-4 font-medium text-muted-foreground">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${customersHTML}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
}

function renderSolicitudesModule() {
    return `
        <div class="h-full flex flex-col">
            <div class="bg-white border-b border-border px-6 py-4">
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-3">
                        <i data-lucide="ticket" class="w-6 h-6 text-primary"></i>
                        <div>
                            <h1 class="text-xl font-bold text-foreground">Solicitudes</h1>
                            <p class="text-sm text-muted-foreground">Pedidos desde el menú digital</p>
                        </div>
                    </div>
                    <button class="h-9 px-4 bg-primary text-white text-sm font-medium rounded-md hover:bg-primary/90 transition flex items-center gap-2" onclick="showToast('Actualizando...', 'info')">
                        <i data-lucide="refresh-cw" class="w-4 h-4"></i>
                        Actualizar
                    </button>
                </div>
            </div>
            <div class="flex-1 overflow-auto p-6 bg-muted">
                <div class="max-w-4xl mx-auto">
                    <div class="bg-white rounded-lg border border-border p-6">
                        <div class="flex flex-col items-center justify-center py-12 text-muted-foreground">
                            <i data-lucide="inbox" class="w-16 h-16 mb-4 stroke-1"></i>
                            <p class="font-medium text-lg mb-2">Sin solicitudes</p>
                            <p class="text-sm text-center">Los pedidos del menú digital aparecerán aquí</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderReportesModule() {
    const sales = JSON.parse(API.getSales() || '[]');
    const totalVentas = sales.reduce((sum, s) => sum + (s.total || 0), 0);
    
    return `
        <div class="h-full flex flex-col">
            <div class="bg-white border-b border-border px-6 py-4">
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-3">
                        <i data-lucide="bar-chart-3" class="w-6 h-6 text-primary"></i>
                        <div>
                            <h1 class="text-xl font-bold text-foreground">Reportes</h1>
                            <p class="text-sm text-muted-foreground">Reportes de ventas e inventario</p>
                        </div>
                    </div>
                    <button class="h-9 px-4 bg-primary text-white text-sm font-medium rounded-md hover:bg-primary/90 transition flex items-center gap-2" onclick="showToast('Próximamente', 'info')">
                        <i data-lucide="download" class="w-4 h-4"></i>
                        Exportar
                    </button>
                </div>
            </div>
            <div class="flex-1 overflow-auto p-6 bg-muted">
                <div class="max-w-4xl mx-auto space-y-6">
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div class="bg-white rounded-lg border border-border p-4 cursor-pointer hover:shadow-md transition" onclick="showToast('Próximamente', 'info')">
                            <div class="flex items-center gap-3 mb-3">
                                <div class="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                                    <i data-lucide="trending-up" class="w-5 h-5 text-green-600"></i>
                                </div>
                                <span class="font-medium">Reporte de Ventas</span>
                            </div>
                            <p class="text-sm text-muted-foreground">Análisis detallado de ventas por período</p>
                        </div>
                        <div class="bg-white rounded-lg border border-border p-4 cursor-pointer hover:shadow-md transition" onclick="showToast('Próximamente', 'info')">
                            <div class="flex items-center gap-3 mb-3">
                                <div class="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                                    <i data-lucide="package" class="w-5 h-5 text-blue-600"></i>
                                </div>
                                <span class="font-medium">Reporte de Inventario</span>
                            </div>
                            <p class="text-sm text-muted-foreground">Estado actual del inventario</p>
                        </div>
                        <div class="bg-white rounded-lg border border-border p-4 cursor-pointer hover:shadow-md transition" onclick="showToast('Próximamente', 'info')">
                            <div class="flex items-center gap-3 mb-3">
                                <div class="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                                    <i data-lucide="users" class="w-5 h-5 text-purple-600"></i>
                                </div>
                                <span class="font-medium">Reporte de Clientes</span>
                            </div>
                            <p class="text-sm text-muted-foreground">Análisis de clientes y compras</p>
                        </div>
                    </div>
                    <div class="bg-white rounded-lg border border-border p-6">
                        <h3 class="font-semibold text-lg mb-4">Resumen Rápido</h3>
                        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div class="text-center">
                                <p class="text-2xl font-bold text-primary">${sales.length}</p>
                                <p class="text-sm text-muted-foreground">Ventas</p>
                            </div>
                            <div class="text-center">
                                <p class="text-2xl font-bold text-green-600">$${totalVentas.toFixed(0)}</p>
                                <p class="text-sm text-muted-foreground">Ingresos</p>
                            </div>
                            <div class="text-center">
                                <p class="text-2xl font-bold text-blue-600">${products.length}</p>
                                <p class="text-sm text-muted-foreground">Productos</p>
                            </div>
                            <div class="text-center">
                                <p class="text-2xl font-bold text-purple-600">${customers.length}</p>
                                <p class="text-sm text-muted-foreground">Clientes</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderFacturacionModule() {
    return `
        <div class="h-full flex flex-col">
            <div class="bg-white border-b border-border px-6 py-4">
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-3">
                        <i data-lucide="receipt" class="w-6 h-6 text-primary"></i>
                        <div>
                            <h1 class="text-xl font-bold text-foreground">Facturación</h1>
                            <p class="text-sm text-muted-foreground">Emisión de facturas electrónicas (CFDI)</p>
                        </div>
                    </div>
                    <button class="h-9 px-4 bg-primary text-white text-sm font-medium rounded-md hover:bg-primary/90 transition flex items-center gap-2" onclick="showToast('Próximamente', 'info')">
                        <i data-lucide="plus" class="w-4 h-4"></i>
                        Nueva Factura
                    </button>
                </div>
            </div>
            <div class="flex-1 overflow-auto p-6 bg-muted">
                <div class="max-w-4xl mx-auto space-y-6">
                    <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start gap-3">
                        <i data-lucide="alert-triangle" class="w-5 h-5 text-yellow-600 mt-0.5"></i>
                        <div>
                            <p class="font-medium text-yellow-800">Configuración Requerida</p>
                            <p class="text-sm text-yellow-700">Configura tus datos fiscales y certificados CSD para emitir facturas.</p>
                        </div>
                    </div>
                    <div class="bg-white rounded-lg border border-border p-6">
                        <h3 class="font-semibold text-lg mb-4">Datos Fiscales</h3>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label class="text-sm text-muted-foreground">RFC</label>
                                <input type="text" class="w-full h-9 px-3 mt-1 border border-border rounded-md" placeholder="XAXX010101000" disabled>
                            </div>
                            <div>
                                <label class="text-sm text-muted-foreground">Razón Social</label>
                                <input type="text" class="w-full h-9 px-3 mt-1 border border-border rounded-md" placeholder="Mi Empresa SA de CV" disabled>
                            </div>
                        </div>
                        <button class="mt-4 h-9 px-4 border border-border rounded-md text-sm font-medium hover:bg-accent transition" onclick="showToast('Próximamente', 'info')">
                            Configurar Datos Fiscales
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderMarcasBlancasModule() {
    return `
        <div class="h-full flex flex-col">
            <div class="bg-white border-b border-border px-6 py-4">
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-3">
                        <i data-lucide="building-2" class="w-6 h-6 text-primary"></i>
                        <div>
                            <h1 class="text-xl font-bold text-foreground">Marcas Blancas</h1>
                            <p class="text-sm text-muted-foreground">Personalización de marca y branding</p>
                        </div>
                    </div>
                </div>
            </div>
            <div class="flex-1 overflow-auto p-6 bg-muted">
                <div class="max-w-2xl mx-auto space-y-6">
                    <div class="bg-white rounded-lg border border-border p-6">
                        <h3 class="font-semibold text-lg mb-4">Personaliza tu Marca</h3>
                        <div class="space-y-4">
                            <div>
                                <label class="text-sm font-medium">Nombre del Negocio</label>
                                <input type="text" class="w-full h-9 px-3 mt-1 border border-border rounded-md" placeholder="Mi Negocio" value="${escapeHtml(API.getSetting('business_name') || '')}">
                            </div>
                            <div>
                                <label class="text-sm font-medium">Logo</label>
                                <div class="mt-1 border-2 border-dashed border-border rounded-lg p-8 text-center">
                                    <i data-lucide="upload" class="w-8 h-8 mx-auto text-muted-foreground mb-2"></i>
                                    <p class="text-sm text-muted-foreground">Arrastra tu logo o haz clic para subir</p>
                                </div>
                            </div>
                            <div>
                                <label class="text-sm font-medium">Color Principal</label>
                                <div class="flex items-center gap-2 mt-1">
                                    <input type="color" value="#3B82F6" class="w-10 h-10 rounded cursor-pointer">
                                    <span class="text-sm text-muted-foreground">#3B82F6</span>
                                </div>
                            </div>
                        </div>
                        <button class="mt-6 h-9 px-4 bg-primary text-white text-sm font-medium rounded-md hover:bg-primary/90 transition" onclick="showToast('Próximamente', 'info')">
                            Guardar Cambios
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderSoporteModule() {
    return `
        <div class="h-full flex flex-col">
            <div class="bg-white border-b border-border px-6 py-4">
                <div class="flex items-center gap-3">
                    <i data-lucide="headphones" class="w-6 h-6 text-primary"></i>
                    <div>
                        <h1 class="text-xl font-bold text-foreground">Soporte Remoto</h1>
                        <p class="text-sm text-muted-foreground">Conexión con soporte técnico</p>
                    </div>
                </div>
            </div>
            <div class="flex-1 overflow-auto p-6 bg-muted">
                <div class="max-w-md mx-auto">
                    <div class="bg-white rounded-lg border border-border p-8 text-center">
                        <div class="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
                            <i data-lucide="headphones" class="w-10 h-10 text-primary"></i>
                        </div>
                        <h3 class="text-lg font-semibold mb-2">Soporte Técnico Remoto</h3>
                        <p class="text-muted-foreground mb-6">Permite que un técnico se conecte a tu sistema para resolver problemas.</p>
                        <div class="bg-muted rounded-lg p-4 mb-6">
                            <p class="text-sm text-muted-foreground mb-1">Tu código de soporte:</p>
                            <p class="text-3xl font-mono font-bold tracking-wider">${Math.random().toString(36).substring(2, 8).toUpperCase()}</p>
                        </div>
                        <button class="w-full h-11 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition flex items-center justify-center gap-2" onclick="showToast('Próximamente', 'info')">
                            <i data-lucide="play" class="w-4 h-4"></i>
                            Iniciar Sesión de Soporte
                        </button>
                        <p class="text-xs text-muted-foreground mt-4">Comparte este código con el técnico de soporte</p>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderConfiguracionModule() {
    const businessName = API.getSetting('business_name') || '';
    const businessAddress = API.getSetting('business_address') || '';
    const businessPhone = API.getSetting('business_phone') || '';
    const hardwareId = API.getHardwareId();
    
    return `
        <div class="h-full flex flex-col">
            <div class="bg-white border-b border-border px-6 py-4">
                <div class="flex items-center gap-3">
                    <i data-lucide="settings" class="w-6 h-6 text-primary"></i>
                    <div>
                        <h1 class="text-xl font-bold text-foreground">Configuración</h1>
                        <p class="text-sm text-muted-foreground">Ajustes del sistema y negocio</p>
                    </div>
                </div>
            </div>
            <div class="flex-1 overflow-auto p-6 bg-muted">
                <div class="max-w-2xl mx-auto space-y-6">
                    <div class="bg-white rounded-lg border border-border p-6">
                        <h3 class="font-semibold text-lg mb-4">Información del Negocio</h3>
                        <div class="space-y-4">
                            <div>
                                <label class="text-sm font-medium">Nombre del Negocio</label>
                                <input type="text" id="config-business-name" class="w-full h-9 px-3 mt-1 border border-border rounded-md" placeholder="Mi Negocio" value="${escapeHtml(businessName)}">
                            </div>
                            <div>
                                <label class="text-sm font-medium">Dirección</label>
                                <input type="text" id="config-business-address" class="w-full h-9 px-3 mt-1 border border-border rounded-md" placeholder="Calle 123, Colonia" value="${escapeHtml(businessAddress)}">
                            </div>
                            <div>
                                <label class="text-sm font-medium">Teléfono</label>
                                <input type="text" id="config-business-phone" class="w-full h-9 px-3 mt-1 border border-border rounded-md" placeholder="+52 123 456 7890" value="${escapeHtml(businessPhone)}">
                            </div>
                        </div>
                        <button class="mt-4 h-9 px-4 bg-primary text-white text-sm font-medium rounded-md hover:bg-primary/90 transition" onclick="saveBusinessSettings()">
                            Guardar Cambios
                        </button>
                    </div>
                    <div class="bg-white rounded-lg border border-border p-6">
                        <h3 class="font-semibold text-lg mb-4">Impresora de Tickets</h3>
                        <div class="flex items-center justify-between p-3 bg-muted rounded-lg">
                            <div class="flex items-center gap-3">
                                <i data-lucide="printer" class="w-5 h-5 text-muted-foreground"></i>
                                <span>Sin impresora configurada</span>
                            </div>
                            <button class="h-8 px-3 text-sm border border-border rounded-md hover:bg-accent" onclick="showToast('Próximamente', 'info')">Configurar</button>
                        </div>
                    </div>
                    <div class="bg-white rounded-lg border border-border p-6">
                        <h3 class="font-semibold text-lg mb-4">Licencia</h3>
                        <div class="space-y-2">
                            <div class="flex justify-between">
                                <span class="text-muted-foreground">ID de Hardware:</span>
                                <span class="font-mono text-sm">${hardwareId}</span>
                            </div>
                            <div class="flex justify-between">
                                <span class="text-muted-foreground">Estado:</span>
                                <span class="text-green-600 font-medium">Activa</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function saveBusinessSettings() {
    const name = document.getElementById('config-business-name')?.value || '';
    const address = document.getElementById('config-business-address')?.value || '';
    const phone = document.getElementById('config-business-phone')?.value || '';
    
    API.setSetting('business_name', name);
    API.setSetting('business_address', address);
    API.setSetting('business_phone', phone);
    
    showToast('Configuración guardada', 'success');
}

function handleBarcodeSearch(searchTerm) {
    if (!searchTerm) return;
    
    const product = products.find(p => 
        p.barcode === searchTerm || 
        p.sku === searchTerm ||
        p.id === searchTerm
    );
    
    if (product) {
        addToCart(product.id);
        document.getElementById('search-input').value = '';
    }
}

function renderCategoryTabs() {
    const tabsContainer = document.getElementById('category-tabs');
    if (!tabsContainer) return;
    
    const productCategories = [];
    const categoryMap = {};
    
    products.forEach(function(p) {
        if (p.category_id && !categoryMap[p.category_id]) {
            categoryMap[p.category_id] = true;
            productCategories.push(p.category_id);
        }
    });
    
    const categoryCounts = { all: products.length };
    productCategories.forEach(function(catId) {
        categoryCounts[catId] = products.filter(function(p) { return p.category_id === catId; }).length;
    });
    
    let tabsHTML = '';
    
    // All tab
    tabsHTML += '<button class="category-tab px-4 py-2 rounded-full text-sm font-medium transition ' + 
        (selectedCategory === 'all' ? 'bg-primary text-white' : 'bg-muted hover:bg-accent text-muted-foreground') + 
        '" data-category="all">Todos <span class="opacity-80">(' + categoryCounts['all'] + ')</span></button>';
    
    // Best sellers tab
    tabsHTML += '<button class="category-tab px-4 py-2 rounded-full text-sm font-medium transition ' + 
        (selectedCategory === 'mas-vendidos' ? 'bg-primary text-white' : 'bg-muted hover:bg-accent text-muted-foreground') + 
        '" data-category="mas-vendidos">Más vendidos</button>';
    
    // Category tabs
    productCategories.forEach(function(catId) {
        const category = categories.find(c => c.id === catId);
        const catName = category ? category.name : catId;
        const count = categoryCounts[catId] || 0;
        const isActive = selectedCategory === catId;
        
        tabsHTML += '<button class="category-tab px-4 py-2 rounded-full text-sm font-medium transition ' + 
            (isActive ? 'bg-primary text-white' : 'bg-muted hover:bg-accent text-muted-foreground') + 
            '" data-category="' + catId + '">' + catName + ' <span class="opacity-80">(' + count + ')</span></button>';
    });
    
    tabsContainer.innerHTML = tabsHTML;
    
    // Add click events
    tabsContainer.querySelectorAll('.category-tab').forEach(function(tab) {
        tab.addEventListener('click', function() {
            selectedCategory = this.getAttribute('data-category');
            renderProducts();
            renderCategoryTabs();
        });
    });
    
    // Update header dropdown
    const headerFilter = document.getElementById('category-filter-header');
    if (headerFilter) {
        headerFilter.innerHTML = '<option value="all">Todos</option>';
        productCategories.forEach(function(catId) {
            const category = categories.find(c => c.id === catId);
            const catName = category ? category.name : catId;
            headerFilter.innerHTML += '<option value="' + catId + '" ' + (selectedCategory === catId ? 'selected' : '') + '>' + catName + '</option>';
        });
    }
}

function renderProducts() {
    const grid = document.getElementById('products-grid');
    const emptyState = document.getElementById('empty-state');
    const searchInput = document.getElementById('search-input');
    const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
    
    if (!grid) return;
    
    let filtered = products.slice();
    
    // Filter by search
    if (searchTerm) {
        filtered = filtered.filter(function(p) {
            return p.name.toLowerCase().indexOf(searchTerm) !== -1 ||
                (p.sku && p.sku.toLowerCase().indexOf(searchTerm) !== -1) ||
                (p.barcode && p.barcode.toLowerCase().indexOf(searchTerm) !== -1);
        });
    }
    
    // Filter by category
    if (selectedCategory && selectedCategory !== 'all' && selectedCategory !== 'mas-vendidos') {
        filtered = filtered.filter(function(p) { return p.category_id === selectedCategory; });
    }
    
    if (filtered.length === 0) {
        grid.innerHTML = '';
        if (emptyState) {
            emptyState.classList.remove('hidden');
            emptyState.classList.add('flex');
        }
        if (typeof lucide !== 'undefined') lucide.createIcons();
        return;
    }
    
    if (emptyState) {
        emptyState.classList.add('hidden');
        emptyState.classList.remove('flex');
    }
    
    let html = '';
    filtered.forEach(function(product) {
        const price = parseFloat(product.price || 0).toFixed(2);
        const productName = escapeHtml(product.name);
        
        html += '<div class="product-card bg-white rounded-lg shadow-sm border border-border cursor-pointer overflow-hidden" onclick="addToCart(\'' + product.id + '\')" data-testid="card-product-' + product.id + '">';
        html += '<div class="h-28 bg-muted flex items-center justify-center relative">';
        if (product.image_url) {
            html += '<img src="' + product.image_url + '" alt="' + productName + '" class="h-full w-full object-cover" onerror="this.style.display=\'none\'; this.nextElementSibling.style.display=\'flex\';">';
            html += '<div class="absolute inset-0 items-center justify-center hidden"><i data-lucide="package" class="w-10 h-10 text-muted-foreground stroke-1"></i></div>';
        } else {
            html += '<i data-lucide="package" class="w-10 h-10 text-muted-foreground stroke-1"></i>';
        }
        html += '</div>';
        html += '<div class="p-3">';
        html += '<h3 class="font-medium text-foreground text-sm truncate">' + productName + '</h3>';
        html += '<p class="text-primary font-bold text-lg">$' + price + '</p>';
        html += '</div></div>';
    });
    
    grid.innerHTML = html;
    
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Cart Functions
function addToCart(productId) {
    const product = products.find(function(p) { return p.id === productId; });
    if (!product) {
        console.error('Product not found:', productId);
        return;
    }
    
    const existing = cart.find(function(item) { return item.product.id === productId; });
    if (existing) {
        existing.quantity++;
    } else {
        cart.push({ product: product, quantity: 1, discount: 0 });
    }
    
    // Bounce animation on cart count
    const cartCount = document.getElementById('cart-count');
    if (cartCount) {
        cartCount.classList.add('bounce');
        setTimeout(() => cartCount.classList.remove('bounce'), 300);
    }
    
    renderCart();
    showToast(product.name + ' agregado al carrito', 'success');
}

function updateCartQuantity(productId, delta) {
    const item = cart.find(function(i) { return i.product.id === productId; });
    if (!item) return;
    
    item.quantity += delta;
    if (item.quantity <= 0) {
        cart = cart.filter(function(i) { return i.product.id !== productId; });
    }
    
    renderCart();
}

function removeFromCart(productId) {
    cart = cart.filter(function(i) { return i.product.id !== productId; });
    renderCart();
}

function clearCart() {
    if (cart.length === 0) return;
    
    cart = [];
    globalDiscount = 0;
    
    const globalDiscountInput = document.getElementById('global-discount');
    if (globalDiscountInput) globalDiscountInput.value = '0';
    
    renderCart();
    showToast('Carrito limpiado', 'info');
}

function updateItemDiscount(productId, discount) {
    const item = cart.find(function(i) { return i.product.id === productId; });
    if (item) {
        item.discount = Math.min(100, Math.max(0, parseFloat(discount) || 0));
        renderCart();
    }
}

function renderCart() {
    const container = document.getElementById('cart-items');
    const cartCount = document.getElementById('cart-count');
    const cartEmpty = document.getElementById('cart-empty');
    const checkoutBtn = document.getElementById('checkout-btn');
    
    const totalItems = cart.reduce(function(sum, item) { return sum + item.quantity; }, 0);
    if (cartCount) cartCount.textContent = '(' + totalItems + ')';
    
    if (cart.length === 0) {
        if (container) {
            container.innerHTML = `
                <div id="cart-empty" class="flex flex-col items-center justify-center h-full text-muted-foreground p-8">
                    <i data-lucide="shopping-cart" class="w-16 h-16 mb-4 stroke-1"></i>
                    <p class="font-semibold text-lg mb-2">Carrito vacío</p>
                    <p class="text-sm text-center">Agrega productos para comenzar una venta</p>
                </div>
            `;
        }
        if (checkoutBtn) checkoutBtn.disabled = true;
        updateCartTotals();
        if (typeof lucide !== 'undefined') lucide.createIcons();
        return;
    }
    
    if (checkoutBtn) checkoutBtn.disabled = false;
    
    if (container) {
        let html = '<div class="p-4 space-y-3">';
        cart.forEach(function(item) {
            const itemSubtotal = item.product.price * item.quantity;
            const itemDiscount = itemSubtotal * ((item.discount || 0) / 100);
            const itemTotal = itemSubtotal - itemDiscount;
            const productName = escapeHtml(item.product.name);
            
            html += '<div class="cart-item bg-muted/50 rounded-lg p-3 border border-border">';
            
            // Top row: Image, name, remove button
            html += '<div class="flex items-start gap-3 mb-3">';
            html += '<div class="w-12 h-12 bg-muted rounded-md flex items-center justify-center flex-shrink-0 overflow-hidden">';
            if (item.product.image_url) {
                html += '<img src="' + item.product.image_url + '" alt="' + productName + '" class="w-full h-full object-cover">';
            } else {
                html += '<i data-lucide="package" class="w-6 h-6 text-muted-foreground"></i>';
            }
            html += '</div>';
            html += '<div class="flex-1 min-w-0">';
            html += '<p class="font-medium text-sm text-foreground truncate">' + productName + '</p>';
            html += '<p class="text-xs text-muted-foreground">$' + parseFloat(item.product.price).toFixed(2) + ' c/u</p>';
            html += '</div>';
            html += '<button onclick="removeFromCart(\'' + item.product.id + '\')" class="w-7 h-7 flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition">';
            html += '<i data-lucide="x" class="w-4 h-4"></i>';
            html += '</button>';
            html += '</div>';
            
            // Bottom row: Quantity controls, discount, total
            html += '<div class="flex items-center justify-between gap-2">';
            
            // Quantity controls
            html += '<div class="flex items-center gap-1">';
            html += '<button onclick="updateCartQuantity(\'' + item.product.id + '\', -1)" class="w-8 h-8 rounded-md border border-border bg-white hover:bg-accent flex items-center justify-center text-foreground transition">';
            html += '<i data-lucide="minus" class="w-4 h-4"></i>';
            html += '</button>';
            html += '<span class="w-10 text-center font-semibold text-sm">' + item.quantity + '</span>';
            html += '<button onclick="updateCartQuantity(\'' + item.product.id + '\', 1)" class="w-8 h-8 rounded-md border border-border bg-white hover:bg-accent flex items-center justify-center text-foreground transition">';
            html += '<i data-lucide="plus" class="w-4 h-4"></i>';
            html += '</button>';
            html += '</div>';
            
            // Discount input
            html += '<div class="flex items-center gap-1">';
            html += '<input type="number" value="' + (item.discount || 0) + '" onchange="updateItemDiscount(\'' + item.product.id + '\', this.value)" class="w-14 h-8 text-center text-xs border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary" min="0" max="100" placeholder="0">';
            html += '<span class="text-xs text-muted-foreground">%</span>';
            html += '</div>';
            
            // Line total
            html += '<span class="font-bold text-primary text-sm min-w-[70px] text-right">$' + itemTotal.toFixed(2) + '</span>';
            
            html += '</div>';
            html += '</div>';
        });
        html += '</div>';
        container.innerHTML = html;
    }
    
    updateCartTotals();
    
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

function updateCartTotals() {
    // Calculate subtotal (before any discounts)
    const subtotal = cart.reduce(function(sum, item) { 
        return sum + (item.product.price * item.quantity); 
    }, 0);
    
    // Calculate item-level discounts
    const itemDiscounts = cart.reduce(function(sum, item) {
        const itemTotal = item.product.price * item.quantity;
        return sum + (itemTotal * ((item.discount || 0) / 100));
    }, 0);
    
    // Subtotal after item discounts
    const subtotalAfterItemDiscounts = subtotal - itemDiscounts;
    
    // Global discount applied to subtotal after item discounts
    const globalDiscountAmount = subtotalAfterItemDiscounts * (globalDiscount / 100);
    
    // Total discount
    const totalDiscount = itemDiscounts + globalDiscountAmount;
    
    // Subtotal before tax (after all discounts)
    const subtotalBeforeTax = subtotal - totalDiscount;
    
    // IVA calculation
    const iva = subtotalBeforeTax * IVA_RATE;
    
    // Final total
    const total = subtotalBeforeTax + iva;
    
    const subtotalEl = document.getElementById('cart-subtotal');
    const discountEl = document.getElementById('cart-discount');
    const ivaEl = document.getElementById('cart-iva');
    const totalEl = document.getElementById('cart-total');
    
    if (subtotalEl) subtotalEl.textContent = '$' + subtotal.toFixed(2);
    if (discountEl) discountEl.textContent = '-$' + totalDiscount.toFixed(2);
    if (ivaEl) ivaEl.textContent = '$' + iva.toFixed(2);
    if (totalEl) totalEl.textContent = '$' + total.toFixed(2);
}

function getCartTotal() {
    const subtotal = cart.reduce(function(sum, item) { 
        return sum + (item.product.price * item.quantity); 
    }, 0);
    
    const itemDiscounts = cart.reduce(function(sum, item) {
        const itemTotal = item.product.price * item.quantity;
        return sum + (itemTotal * ((item.discount || 0) / 100));
    }, 0);
    
    const subtotalAfterItemDiscounts = subtotal - itemDiscounts;
    const globalDiscountAmount = subtotalAfterItemDiscounts * (globalDiscount / 100);
    const totalDiscount = itemDiscounts + globalDiscountAmount;
    const subtotalBeforeTax = subtotal - totalDiscount;
    const iva = subtotalBeforeTax * IVA_RATE;
    
    return subtotalBeforeTax + iva;
}

// Payment Functions
function openPaymentModal() {
    const modal = document.getElementById('payment-modal');
    const total = getCartTotal();
    currentPaymentTotal = total;
    numpadInput = '';
    
    const paymentTotalEl = document.getElementById('payment-total');
    if (paymentTotalEl) paymentTotalEl.textContent = '$' + total.toFixed(2);
    
    const exactAmountValueEl = document.getElementById('exact-amount-value');
    if (exactAmountValueEl) exactAmountValueEl.textContent = total.toFixed(2);
    
    // Reset payment method to cash
    selectPaymentMethod('cash');
    
    // Update displays
    updatePaymentDisplay();
    
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

function closePaymentModal() {
    const modal = document.getElementById('payment-modal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    numpadInput = '';
}

function selectPaymentMethod(method) {
    paymentMethod = method;
    
    const methodColors = {
        'cash': { bg: 'bg-green-500', border: 'border-green-500' },
        'card': { bg: 'bg-blue-500', border: 'border-blue-500' },
        'transfer': { bg: 'bg-purple-500', border: 'border-purple-500' },
        'credit': { bg: 'bg-amber-500', border: 'border-amber-500' }
    };
    
    document.querySelectorAll('.payment-method').forEach(function(btn) {
        const btnMethod = btn.getAttribute('data-method');
        const icon = btn.querySelector('[data-lucide]');
        const text = btn.querySelector('span');
        const colors = methodColors[btnMethod];
        
        // Remove all color classes first
        btn.classList.remove('bg-green-500', 'border-green-500', 'bg-blue-500', 'border-blue-500', 
                            'bg-purple-500', 'border-purple-500', 'bg-amber-500', 'border-amber-500',
                            'text-white', 'border-border');
        
        if (btnMethod === method) {
            btn.classList.add(colors.bg, colors.border, 'text-white');
            if (icon) {
                icon.classList.remove('text-muted-foreground');
                icon.classList.add('text-white');
            }
            if (text) {
                text.classList.remove('text-muted-foreground');
                text.classList.add('text-white');
            }
        } else {
            btn.classList.add('border-border');
            if (icon) {
                icon.classList.add('text-muted-foreground');
                icon.classList.remove('text-white');
            }
            if (text) {
                text.classList.add('text-muted-foreground');
                text.classList.remove('text-white');
            }
        }
    });
    
    updatePaymentDisplay();
    
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

function switchView(view) {
    const sidebar = document.getElementById('sidebar');
    const main = document.querySelector('main');
    const app = document.getElementById('app');
    
    // Reset classes
    app.className = 'flex h-full';
    sidebar.classList.remove('hidden');
    
    document.querySelectorAll('.view-switcher-btn').forEach(btn => {
        btn.classList.remove('bg-primary', 'text-white');
        btn.classList.add('bg-muted', 'text-muted-foreground');
    });
    
    const activeBtn = document.querySelector(`.view-switcher-btn[data-view="${view}"]`);
    if (activeBtn) {
        activeBtn.classList.add('bg-primary', 'text-white');
        activeBtn.classList.remove('bg-muted', 'text-muted-foreground');
    }

    if (view === 'desktop') {
        // Standard Desktop View
        sidebar.classList.remove('hidden');
    } else if (view === 'android') {
        // Mobile / Android View
        sidebar.classList.add('hidden');
    } else if (view === 'web') {
        // Standard Web View (similar to desktop but maybe different headers)
        sidebar.classList.remove('hidden');
    }
}

function handleNumpadPress(key) {
    // Prevent multiple decimal points
    if (key === '.' && numpadInput.includes('.')) return;
    
    let candidate;
    if (key === '00' && numpadInput === '') {
        candidate = '0';
    } else if (numpadInput === '0' && key !== '.' && key !== '00') {
        candidate = key;
    } else {
        candidate = numpadInput + key;
    }
    
    // Validate format (max 7 digits before decimal, max 2 after)
    const parts = candidate.split('.');
    if (parts.length === 2 && parts[1].length > 2) return;
    if (parts[0].length > 7) return;
    
    const numValue = parseFloat(candidate);
    if (isNaN(numValue) || numValue > 9999999.99) return;
    
    numpadInput = candidate;
    updatePaymentDisplay();
}

function handleQuickAmount(amount) {
    numpadInput = amount.toString();
    updatePaymentDisplay();
}

function handleExactAmount() {
    numpadInput = currentPaymentTotal.toFixed(2);
    updatePaymentDisplay();
}

function handleNumpadClear() {
    numpadInput = '';
    updatePaymentDisplay();
}

function handleNumpadBackspace() {
    numpadInput = numpadInput.slice(0, -1);
    updatePaymentDisplay();
}

function updatePaymentDisplay() {
    const amountPaid = parseFloat(numpadInput) || 0;
    const remaining = Math.max(0, currentPaymentTotal - amountPaid);
    const change = Math.max(0, amountPaid - currentPaymentTotal);
    
    // Update amount received display
    const amountReceivedEl = document.getElementById('amount-received-display');
    if (amountReceivedEl) {
        amountReceivedEl.textContent = '$' + (numpadInput || '0.00');
    }
    
    // Update remaining/change card
    const remainingCard = document.getElementById('remaining-card');
    const remainingLabel = document.getElementById('remaining-label');
    const remainingAmount = document.getElementById('remaining-amount');
    
    if (remainingCard && remainingLabel && remainingAmount) {
        if (remaining > 0) {
            remainingCard.classList.remove('bg-green-500/10');
            remainingCard.classList.add('bg-destructive/10');
            remainingLabel.textContent = 'Falta por Pagar';
            remainingAmount.textContent = '$' + remaining.toFixed(2);
            remainingAmount.classList.remove('text-green-600');
            remainingAmount.classList.add('text-destructive');
        } else {
            remainingCard.classList.remove('bg-destructive/10');
            remainingCard.classList.add('bg-green-500/10');
            remainingLabel.textContent = 'Cambio';
            remainingAmount.textContent = '$' + change.toFixed(2);
            remainingAmount.classList.remove('text-destructive');
            remainingAmount.classList.add('text-green-600');
        }
    }
    
    // Update complete button state
    const completeSaleBtn = document.getElementById('complete-sale');
    if (completeSaleBtn) {
        const canComplete = paymentMethod !== 'cash' || amountPaid >= currentPaymentTotal;
        completeSaleBtn.disabled = !canComplete;
    }
}

function completeSale() {
    if (cart.length === 0) {
        showToast('El carrito está vacío', 'error');
        return;
    }
    
    const total = currentPaymentTotal;
    const subtotal = cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
    
    const itemDiscounts = cart.reduce((sum, item) => {
        const itemTotal = item.product.price * item.quantity;
        return sum + (itemTotal * ((item.discount || 0) / 100));
    }, 0);
    
    const subtotalAfterItemDiscounts = subtotal - itemDiscounts;
    const globalDiscountAmount = subtotalAfterItemDiscounts * (globalDiscount / 100);
    const totalDiscount = itemDiscounts + globalDiscountAmount;
    const subtotalBeforeTax = subtotal - totalDiscount;
    const iva = subtotalBeforeTax * IVA_RATE;
    
    const amountPaid = parseFloat(numpadInput) || 0;
    
    if (paymentMethod === 'cash' && amountPaid < total) {
        showToast('Cantidad insuficiente', 'error');
        return;
    }
    
    const sale = {
        id: crypto.randomUUID(),
        receipt_number: 'REC-' + Date.now(),
        subtotal: subtotal,
        discount: totalDiscount,
        iva: iva,
        total: total,
        payment_method: paymentMethod,
        amount_paid: paymentMethod === 'cash' ? amountPaid : total,
        change_amount: paymentMethod === 'cash' ? Math.max(0, amountPaid - total) : 0,
        status: 'completed',
        items: cart.map(function(item) {
            const itemSubtotal = item.product.price * item.quantity;
            const itemDiscount = itemSubtotal * ((item.discount || 0) / 100);
            return {
                product_id: item.product.id,
                product_name: item.product.name,
                quantity: item.quantity,
                unit_price: item.product.price,
                discount: item.discount || 0,
                total: itemSubtotal - itemDiscount
            };
        }),
        created_at: new Date().toISOString()
    };
    
    try {
        API.saveSale(JSON.stringify(sale));
        lastCompletedSale = sale;
        clearCart();
        closePaymentModal();
        showReceiptModal(sale);
    } catch(e) {
        console.error('Error saving sale:', e);
        showToast('Error al procesar la venta', 'error');
    }
}

// Add Product Modal
function openAddProductModal() {
    const modal = document.getElementById('add-product-modal');
    
    // Populate categories dropdown
    const categorySelect = document.getElementById('new-product-category');
    if (categorySelect) {
        categorySelect.innerHTML = '<option value="">Sin categoría</option>';
        categories.forEach(function(cat) {
            categorySelect.innerHTML += '<option value="' + cat.id + '">' + escapeHtml(cat.name) + '</option>';
        });
    }
    
    // Clear form
    document.getElementById('new-product-name').value = '';
    document.getElementById('new-product-price').value = '';
    document.getElementById('new-product-cost').value = '';
    document.getElementById('new-product-sku').value = '';
    document.getElementById('new-product-stock').value = '0';
    
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    
    setTimeout(() => {
        document.getElementById('new-product-name')?.focus();
    }, 100);
}

function closeAddProductModal() {
    const modal = document.getElementById('add-product-modal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

function saveNewProduct() {
    const name = document.getElementById('new-product-name').value.trim();
    const price = parseFloat(document.getElementById('new-product-price').value) || 0;
    const cost = parseFloat(document.getElementById('new-product-cost').value) || 0;
    const sku = document.getElementById('new-product-sku').value.trim();
    const stock = parseInt(document.getElementById('new-product-stock').value) || 0;
    const categoryId = document.getElementById('new-product-category').value;
    
    if (!name) {
        showToast('El nombre es requerido', 'error');
        return;
    }
    
    if (price <= 0) {
        showToast('El precio debe ser mayor a 0', 'error');
        return;
    }
    
    const product = {
        id: crypto.randomUUID(),
        name: name,
        price: price,
        cost: cost,
        sku: sku || null,
        barcode: sku || null,
        stock: stock,
        category_id: categoryId || null,
        created_at: new Date().toISOString()
    };
    
    try {
        API.saveProduct(JSON.stringify(product));
        products.push(product);
        renderProducts();
        renderCategoryTabs();
        closeAddProductModal();
        showToast('Producto agregado: ' + name, 'success');
    } catch(e) {
        console.error('Error saving product:', e);
        showToast('Error al guardar el producto', 'error');
    }
}

// Connection Status
function updateConnectionStatus() {
    const isOffline = API.isOffline();
    const indicator = document.getElementById('status-indicator');
    const text = document.getElementById('status-text');
    
    if (indicator && text) {
        if (isOffline) {
            indicator.classList.remove('bg-green-500');
            indicator.classList.add('bg-yellow-500');
            text.textContent = 'Modo Offline';
        } else {
            indicator.classList.remove('bg-yellow-500');
            indicator.classList.add('bg-green-500');
            text.textContent = 'Conectado';
        }
    }
}

// Toast Notifications
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = 'toast pointer-events-auto';
    
    let bgColor = 'bg-foreground';
    let icon = 'check-circle';
    
    switch(type) {
        case 'success':
            bgColor = 'bg-green-600';
            icon = 'check-circle';
            break;
        case 'error':
            bgColor = 'bg-destructive';
            icon = 'x-circle';
            break;
        case 'info':
            bgColor = 'bg-primary';
            icon = 'info';
            break;
        case 'warning':
            bgColor = 'bg-yellow-500';
            icon = 'alert-triangle';
            break;
    }
    
    toast.innerHTML = `
        <div class="${bgColor} text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 min-w-[280px]">
            <i data-lucide="${icon}" class="w-5 h-5 flex-shrink-0"></i>
            <span class="text-sm font-medium">${escapeHtml(message)}</span>
        </div>
    `;
    
    container.appendChild(toast);
    
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
    
    setTimeout(function() {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100px)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(function() {
            toast.remove();
        }, 300);
    }, 3000);
}

// Receipt Functions
function getPaymentMethodName(method) {
    const methods = {
        'cash': 'Efectivo',
        'card': 'Tarjeta',
        'transfer': 'Transferencia',
        'credit': 'Crédito'
    };
    return methods[method] || method;
}

function formatDate(dateString) {
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
}

function formatTime(dateString) {
    const date = new Date(dateString);
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
}

function generateReceiptHTML(sale, forPrint = false) {
    const businessName = API.getSetting('business_name') || 'SalvadoreX';
    const businessAddress = API.getSetting('business_address') || '';
    const businessPhone = API.getSetting('business_phone') || '';
    const businessRFC = API.getSetting('business_rfc') || '';
    
    const date = formatDate(sale.created_at);
    const time = formatTime(sale.created_at);
    const ticketNumber = sale.receipt_number || 'N/A';
    
    const widthPx = forPrint ? 280 : '100%';
    
    let html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Ticket - ${ticketNumber}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: 'Courier New', monospace; 
            font-size: 12px; 
            ${forPrint ? `width: ${widthPx}px;` : ''}
            padding: 10px;
            line-height: 1.4;
            background: white;
        }
        .center { text-align: center; }
        .bold { font-weight: bold; }
        .separator { 
            border-top: 1px dashed #000; 
            margin: 8px 0; 
        }
        .double-separator { 
            border-top: 2px dashed #000; 
            margin: 8px 0; 
        }
        .row { 
            display: flex; 
            justify-content: space-between; 
            margin: 2px 0;
        }
        .item { margin: 4px 0; }
        .item-name { font-size: 11px; }
        .total-section { margin-top: 8px; }
        .grand-total { 
            font-size: 14px; 
            font-weight: bold; 
            margin: 8px 0;
            padding: 4px 0;
        }
        .footer { 
            margin-top: 16px; 
            text-align: center; 
            font-size: 11px; 
        }
        @media print {
            body { width: 280px; }
            @page { margin: 0; }
        }
    </style>
</head>
<body>
    <div class="center bold" style="font-size: 16px;">${escapeHtml(businessName.toUpperCase())}</div>
    ${businessAddress ? `<div class="center" style="font-size: 10px;">${escapeHtml(businessAddress)}</div>` : ''}
    ${businessPhone ? `<div class="center" style="font-size: 10px;">Tel: ${escapeHtml(businessPhone)}</div>` : ''}
    ${businessRFC ? `<div class="center" style="font-size: 10px;">RFC: ${escapeHtml(businessRFC)}</div>` : ''}
    
    <div class="double-separator"></div>
    
    <div class="center bold">TICKET #${escapeHtml(ticketNumber)}</div>
    <div class="center">${date} ${time}</div>
    
    <div class="separator"></div>
    
    <div style="font-size: 11px;">
`;
    
    // Items
    sale.items.forEach(function(item) {
        const itemTotal = item.total.toFixed(2);
        const unitPrice = parseFloat(item.unit_price).toFixed(2);
        const discountText = item.discount > 0 ? ` (-${item.discount}%)` : '';
        
        html += `
        <div class="item">
            <div class="row">
                <span>${item.quantity}x ${escapeHtml(item.product_name)}</span>
                <span>$${itemTotal}</span>
            </div>
            <div style="font-size: 10px; color: #666; margin-left: 16px;">
                @ $${unitPrice} c/u${discountText}
            </div>
        </div>
`;
    });
    
    html += `
    </div>
    
    <div class="separator"></div>
    
    <div class="total-section">
        <div class="row">
            <span>Subtotal:</span>
            <span>$${sale.subtotal.toFixed(2)}</span>
        </div>
`;
    
    if (sale.discount > 0) {
        html += `
        <div class="row">
            <span>Descuento:</span>
            <span>-$${sale.discount.toFixed(2)}</span>
        </div>
`;
    }
    
    html += `
        <div class="row">
            <span>IVA (16%):</span>
            <span>$${sale.iva.toFixed(2)}</span>
        </div>
    </div>
    
    <div class="double-separator"></div>
    
    <div class="grand-total row">
        <span>TOTAL:</span>
        <span>$${sale.total.toFixed(2)}</span>
    </div>
    
    <div class="double-separator"></div>
    
    <div class="row">
        <span>${getPaymentMethodName(sale.payment_method)}:</span>
        <span>$${sale.amount_paid.toFixed(2)}</span>
    </div>
`;
    
    if (sale.change_amount > 0) {
        html += `
    <div class="row">
        <span>Cambio:</span>
        <span>$${sale.change_amount.toFixed(2)}</span>
    </div>
`;
    }
    
    html += `
    
    <div class="footer">
        <div class="bold" style="font-size: 12px;">¡GRACIAS POR SU COMPRA!</div>
        <div style="margin-top: 4px;">Conserve su ticket</div>
    </div>
</body>
</html>
`;
    
    return html;
}

function generateReceiptPreview(sale) {
    const businessName = API.getSetting('business_name') || 'SalvadoreX';
    const date = formatDate(sale.created_at);
    const time = formatTime(sale.created_at);
    const ticketNumber = sale.receipt_number || 'N/A';
    
    let html = `
        <div class="text-center mb-3">
            <div class="font-bold text-base">${escapeHtml(businessName.toUpperCase())}</div>
        </div>
        <div class="border-t border-dashed border-gray-400 my-2"></div>
        <div class="text-center font-bold">TICKET #${escapeHtml(ticketNumber)}</div>
        <div class="text-center text-xs text-gray-600 mb-2">${date} ${time}</div>
        <div class="border-t border-dashed border-gray-400 my-2"></div>
`;
    
    sale.items.forEach(function(item) {
        const itemTotal = item.total.toFixed(2);
        html += `
        <div class="flex justify-between text-xs mb-1">
            <span>${item.quantity}x ${escapeHtml(item.product_name)}</span>
            <span class="font-medium">$${itemTotal}</span>
        </div>
`;
    });
    
    html += `
        <div class="border-t border-dashed border-gray-400 my-2"></div>
        <div class="flex justify-between text-xs">
            <span>Subtotal:</span>
            <span>$${sale.subtotal.toFixed(2)}</span>
        </div>
`;
    
    if (sale.discount > 0) {
        html += `
        <div class="flex justify-between text-xs text-green-600">
            <span>Descuento:</span>
            <span>-$${sale.discount.toFixed(2)}</span>
        </div>
`;
    }
    
    html += `
        <div class="flex justify-between text-xs">
            <span>IVA (16%):</span>
            <span>$${sale.iva.toFixed(2)}</span>
        </div>
        <div class="border-t-2 border-dashed border-gray-400 my-2"></div>
        <div class="flex justify-between font-bold">
            <span>TOTAL:</span>
            <span>$${sale.total.toFixed(2)}</span>
        </div>
        <div class="border-t-2 border-dashed border-gray-400 my-2"></div>
        <div class="flex justify-between text-xs">
            <span>${getPaymentMethodName(sale.payment_method)}:</span>
            <span>$${sale.amount_paid.toFixed(2)}</span>
        </div>
`;
    
    if (sale.change_amount > 0) {
        html += `
        <div class="flex justify-between text-xs font-medium text-green-600">
            <span>Cambio:</span>
            <span>$${sale.change_amount.toFixed(2)}</span>
        </div>
`;
    }
    
    html += `
        <div class="text-center mt-4 pt-2 border-t border-dashed border-gray-400">
            <div class="font-bold">¡GRACIAS POR SU COMPRA!</div>
        </div>
`;
    
    return html;
}

function showReceiptModal(sale) {
    const modal = document.getElementById('receipt-modal');
    const preview = document.getElementById('receipt-preview');
    
    if (preview) {
        preview.innerHTML = generateReceiptPreview(sale);
    }
    
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
    
    showToast('¡Venta completada! Total: $' + sale.total.toFixed(2), 'success');
}

function closeReceiptModal() {
    const modal = document.getElementById('receipt-modal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

function printReceipt(sale) {
    if (!sale) {
        showToast('No hay venta para imprimir', 'error');
        return;
    }
    
    // Check if Windows native bridge is available
    if (window.SalvadoreX && typeof window.SalvadoreX.printReceipt === 'function') {
        try {
            const receiptData = {
                businessName: API.getSetting('business_name') || 'SalvadoreX',
                businessAddress: API.getSetting('business_address') || '',
                businessPhone: API.getSetting('business_phone') || '',
                businessRFC: API.getSetting('business_rfc') || '',
                ticketNumber: sale.receipt_number,
                date: formatDate(sale.created_at),
                time: formatTime(sale.created_at),
                items: sale.items.map(function(item) {
                    return {
                        name: item.product_name,
                        quantity: item.quantity,
                        unitPrice: item.unit_price,
                        discount: item.discount,
                        total: item.total
                    };
                }),
                subtotal: sale.subtotal,
                discount: sale.discount,
                tax: sale.iva,
                total: sale.total,
                payments: [{
                    method: getPaymentMethodName(sale.payment_method),
                    amount: sale.amount_paid
                }],
                change: sale.change_amount,
                footerMessage: 'Conserve su ticket'
            };
            
            window.SalvadoreX.printReceipt(JSON.stringify(receiptData));
            showToast('Imprimiendo ticket...', 'info');
            return;
        } catch(e) {
            console.error('Error printing via native bridge:', e);
        }
    }
    
    // Fallback to browser print
    const receiptHTML = generateReceiptHTML(sale, true);
    const printWindow = window.open('', '_blank', 'width=320,height=600,scrollbars=yes');
    
    if (!printWindow) {
        showToast('Por favor permita las ventanas emergentes para imprimir', 'warning');
        return;
    }
    
    printWindow.document.write(receiptHTML);
    printWindow.document.close();
    
    printWindow.onload = function() {
        setTimeout(function() {
            printWindow.focus();
            printWindow.print();
        }, 250);
    };
    
    showToast('Imprimiendo ticket...', 'info');
}

// Expose functions globally for onclick handlers
window.addToCart = addToCart;
window.updateCartQuantity = updateCartQuantity;
window.removeFromCart = removeFromCart;
window.updateItemDiscount = updateItemDiscount;
window.openAddProductModal = openAddProductModal;
window.printReceipt = printReceipt;
window.showReceiptModal = showReceiptModal;
window.closeReceiptModal = closeReceiptModal;

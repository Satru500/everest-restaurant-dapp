/**
 * server.js — Everest Restaurant API Gateway
 * CN6035 Mobile & Distributed Systems
 *
 * Express.js RESTful API that connects to the RestaurantManager
 * smart contract running on a local Hardhat node (or Sepolia testnet).
 *
 * Requires the contract to be deployed first:
 *   npx hardhat run scripts/deploy.js --network localhost
 */

'use strict';

const express    = require('express');
const cors       = require('cors');
const helmet     = require('helmet');
const morgan     = require('morgan');
const { ethers } = require('ethers');
const path       = require('path');
const fs         = require('fs');

require('dotenv').config();

// ── App setup ─────────────────────────────────────────────────
const app  = express();
const PORT = process.env.PORT || 3001;

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE'] }));
app.use(express.json());
app.use(morgan('dev'));

// ── Contract ABI ──────────────────────────────────────────────
// Only the functions this API actually calls
const CONTRACT_ABI = [
  // View functions
  'function menuItemCount() view returns (uint256)',
  'function getAllMenuItems() view returns (tuple(uint256 id, string name, string description, uint256 price, string category, bool isAvailable, uint256 createdAt)[])',
  'function getMenuItem(uint256 _itemId) view returns (tuple(uint256 id, string name, string description, uint256 price, string category, bool isAvailable, uint256 createdAt))',
  'function getAllOrders() view returns (tuple(uint256 id, address customer, uint256[] itemIds, uint256[] quantities, uint256 totalAmount, uint8 status, uint256 tableNumber, uint256 createdAt, uint256 updatedAt)[])',
  'function getOrder(uint256 _orderId) view returns (tuple(uint256 id, address customer, uint256[] itemIds, uint256[] quantities, uint256 totalAmount, uint8 status, uint256 tableNumber, uint256 createdAt, uint256 updatedAt))',
  'function getAllTables() view returns (tuple(uint256 id, uint256 capacity, uint8 status, address currentCustomer)[])',
  'function getAvailableTables() view returns (tuple(uint256 id, uint256 capacity, uint8 status, address currentCustomer)[])',
  'function getAllReservations() view returns (tuple(uint256 id, address customer, uint256 tableId, uint256 partySize, uint256 reservationTime, uint8 status, string customerName, string contactInfo)[])',
  'function getRestaurantStats() view returns (uint256, uint256, uint256, uint256, uint256)',
  'function calculateOrderTotal(uint256[] _itemIds, uint256[] _quantities) view returns (uint256)',
  'function isStaff(address) view returns (bool)',
  // Write functions (require a signer / private key)
  'function addMenuItem(string _name, string _description, uint256 _price, string _category)',
  'function updateMenuItem(uint256 _itemId, string _name, uint256 _price, bool _isAvailable)',
  'function toggleMenuItemAvailability(uint256 _itemId)',
  'function placeOrder(uint256[] _itemIds, uint256[] _quantities, uint256 _tableNumber) payable',
  'function updateOrderStatus(uint256 _orderId, uint8 _newStatus)',
  'function updateTableStatus(uint256 _tableId, uint8 _newStatus)',
  'function addTable(uint256 _capacity)',
  'function makeReservation(uint256 _tableId, uint256 _partySize, uint256 _reservationTime, string _customerName, string _contactInfo)',
  'function updateReservationStatus(uint256 _reservationId, uint8 _newStatus)'
];

// ── Blockchain connection ──────────────────────────────────────

// Read contract address from: .env → deployment.json → hardhat default
function resolveContractAddress() {
  if (process.env.CONTRACT_ADDRESS) return process.env.CONTRACT_ADDRESS;
  const depPath = path.join(__dirname, '../deployment.json');
  if (fs.existsSync(depPath)) {
    try { return JSON.parse(fs.readFileSync(depPath, 'utf8')).contractAddress; }
    catch (_) { /* fall through */ }
  }
  // Hardhat's deterministic first-deployment address
  return '0x5FbDB2315678afecb367f032d93F642f64180aa3';
}

const CONTRACT_ADDRESS = resolveContractAddress();
const RPC_URL          = process.env.RPC_URL || 'http://127.0.0.1:8545';

// provider is read-only; signers are created per-request from a private key
const provider = new ethers.JsonRpcProvider(RPC_URL);
const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);

// Validate contract is reachable on startup
async function verifyConnection() {
  try {
    const network = await provider.getNetwork();
    const count   = await contract.menuItemCount();
    console.log(`✅ Connected to blockchain  — Chain ID ${network.chainId}`);
    console.log(`✅ Contract verified        — ${CONTRACT_ADDRESS}`);
    console.log(`   Menu items on-chain: ${count}`);
  } catch (err) {
    console.error('\n❌ Cannot reach blockchain:', err.message);
    console.error('   Make sure the Hardhat node is running:');
    console.error('   npx hardhat node\n');
    process.exit(1);  // Do not start if blockchain is unreachable
  }
}

// Build a write-capable signer from a private key (passed in request body)
function buildSigner(privateKey) {
  if (!privateKey) return null;
  try   { return new ethers.Wallet(privateKey, provider); }
  catch { return null; }
}

// ── Label maps ────────────────────────────────────────────────
const ORDER_STATUSES       = ['Pending', 'Confirmed', 'Preparing', 'Ready', 'Delivered', 'Cancelled'];
const TABLE_STATUSES       = ['Available', 'Occupied', 'Reserved', 'Maintenance'];
const RESERVATION_STATUSES = ['Pending', 'Confirmed', 'Cancelled', 'Completed'];

// ── Response formatters ───────────────────────────────────────
function formatMenuItem(item) {
  return {
    id:          Number(item.id),
    name:        item.name,
    description: item.description,
    price:       item.price.toString(),
    priceEth:    ethers.formatEther(item.price),
    category:    item.category,
    isAvailable: item.isAvailable,
    createdAt:   Number(item.createdAt)
  };
}

function formatOrder(order) {
  return {
    id:             Number(order.id),
    customer:       order.customer,
    itemIds:        Array.from(order.itemIds).map(Number),
    quantities:     Array.from(order.quantities).map(Number),
    totalAmount:    order.totalAmount.toString(),
    totalAmountEth: ethers.formatEther(order.totalAmount),
    status:         Number(order.status),
    statusLabel:    ORDER_STATUSES[Number(order.status)],
    tableNumber:    Number(order.tableNumber),
    createdAt:      Number(order.createdAt),
    updatedAt:      Number(order.updatedAt)
  };
}

function formatTable(table) {
  return {
    id:              Number(table.id),
    capacity:        Number(table.capacity),
    status:          Number(table.status),
    statusLabel:     TABLE_STATUSES[Number(table.status)],
    currentCustomer: table.currentCustomer
  };
}

function formatReservation(r) {
  return {
    id:              Number(r.id),
    customer:        r.customer,
    tableId:         Number(r.tableId),
    partySize:       Number(r.partySize),
    reservationTime: Number(r.reservationTime),
    status:          Number(r.status),
    statusLabel:     RESERVATION_STATUSES[Number(r.status)],
    customerName:    r.customerName,
    contactInfo:     r.contactInfo
  };
}

// ── Routes ────────────────────────────────────────────────────

// GET /api/health
app.get('/api/health', async (req, res) => {
  try {
    const network     = await provider.getNetwork();
    const blockNumber = await provider.getBlockNumber();
    const [mi, ord, tbl, rsv] = await contract.getRestaurantStats();
    res.json({
      status:  'ok',
      service: 'Everest Restaurant API',
      module:  'CN6035 — Mobile & Distributed Systems',
      blockchain: {
        status:          'connected',
        rpcUrl:          RPC_URL,
        contractAddress: CONTRACT_ADDRESS,
        chainId:         Number(network.chainId),
        blockNumber
      },
      stats: {
        menuItems:    Number(mi),
        orders:       Number(ord),
        tables:       Number(tbl),
        reservations: Number(rsv)
      }
    });
  } catch (err) {
    res.status(503).json({ status: 'error', error: err.message });
  }
});

// ── Menu ──────────────────────────────────────────────────────

// GET /api/menu  or  GET /api/menu?category=Main
app.get('/api/menu', async (req, res) => {
  try {
    let items = Array.from(await contract.getAllMenuItems()).map(formatMenuItem);
    if (req.query.category) {
      items = items.filter(i => i.category.toLowerCase() === req.query.category.toLowerCase());
    }
    res.json({ success: true, count: items.length, data: items });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/menu/:id
app.get('/api/menu/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (!id || id < 1) return res.status(400).json({ success: false, error: 'Invalid ID' });
    const item = formatMenuItem(await contract.getMenuItem(id));
    res.json({ success: true, data: item });
  } catch (err) {
    res.status(404).json({ success: false, error: 'Menu item not found' });
  }
});

// POST /api/menu  — staff only, requires signerPrivateKey
app.post('/api/menu', async (req, res) => {
  try {
    const { name, description = '', price, category, signerPrivateKey } = req.body;

    if (!name || !price || !category || !signerPrivateKey) {
      return res.status(400).json({
        success: false,
        error: 'name, price (ETH), category, and signerPrivateKey are required'
      });
    }

    const priceFloat = parseFloat(price);
    if (isNaN(priceFloat) || priceFloat <= 0) {
      return res.status(400).json({ success: false, error: 'price must be a positive number in ETH' });
    }

    const signer = buildSigner(signerPrivateKey);
    if (!signer) return res.status(400).json({ success: false, error: 'Invalid private key' });

    const tx      = await contract.connect(signer).addMenuItem(name, description, ethers.parseEther(priceFloat.toString()), category);
    const receipt = await tx.wait();
    res.json({ success: true, message: 'Menu item added on blockchain', txHash: receipt.hash });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/menu/:id/toggle  — staff only
app.put('/api/menu/:id/toggle', async (req, res) => {
  try {
    const id     = parseInt(req.params.id);
    const signer = buildSigner(req.body.signerPrivateKey);
    if (!signer) return res.status(400).json({ success: false, error: 'signerPrivateKey required' });

    const tx      = await contract.connect(signer).toggleMenuItemAvailability(id);
    const receipt = await tx.wait();
    res.json({ success: true, message: `Menu item ${id} availability toggled`, txHash: receipt.hash });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Orders ────────────────────────────────────────────────────

// GET /api/orders  or  GET /api/orders?status=0
app.get('/api/orders', async (req, res) => {
  try {
    let orders = Array.from(await contract.getAllOrders()).map(formatOrder);
    if (req.query.status !== undefined) {
      orders = orders.filter(o => o.status === parseInt(req.query.status));
    }
    if (req.query.customer) {
      orders = orders.filter(o => o.customer.toLowerCase() === req.query.customer.toLowerCase());
    }
    res.json({ success: true, count: orders.length, data: orders });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/orders/:id
app.get('/api/orders/:id', async (req, res) => {
  try {
    const order = formatOrder(await contract.getOrder(parseInt(req.params.id)));
    res.json({ success: true, data: order });
  } catch (err) {
    res.status(404).json({ success: false, error: 'Order not found' });
  }
});

// POST /api/orders  — requires signerPrivateKey for the customer wallet
app.post('/api/orders', async (req, res) => {
  try {
    const { itemIds, quantities, tableNumber, signerPrivateKey } = req.body;

    if (!itemIds || !quantities || !tableNumber || !signerPrivateKey) {
      return res.status(400).json({
        success: false,
        error: 'itemIds, quantities, tableNumber, and signerPrivateKey are required'
      });
    }
    if (!Array.isArray(itemIds) || itemIds.length !== quantities.length) {
      return res.status(400).json({ success: false, error: 'itemIds and quantities must be equal-length arrays' });
    }

    const signer = buildSigner(signerPrivateKey);
    if (!signer) return res.status(400).json({ success: false, error: 'Invalid private key' });

    const total   = await contract.calculateOrderTotal(itemIds, quantities);
    const tx      = await contract.connect(signer).placeOrder(itemIds, quantities, tableNumber, { value: total });
    const receipt = await tx.wait();

    res.json({ success: true, message: 'Order placed on blockchain', txHash: receipt.hash });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/orders/:id/status  — staff only
app.put('/api/orders/:id/status', async (req, res) => {
  try {
    const id     = parseInt(req.params.id);
    const { status, signerPrivateKey } = req.body;

    if (status === undefined || status === null || !signerPrivateKey) {
      return res.status(400).json({ success: false, error: 'status (0–5) and signerPrivateKey are required' });
    }

    const signer  = buildSigner(signerPrivateKey);
    if (!signer) return res.status(400).json({ success: false, error: 'Invalid private key' });

    const tx      = await contract.connect(signer).updateOrderStatus(id, parseInt(status));
    const receipt = await tx.wait();
    res.json({ success: true, message: `Order ${id} status updated to ${ORDER_STATUSES[status]}`, txHash: receipt.hash });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Tables ────────────────────────────────────────────────────

// GET /api/tables  or  GET /api/tables?available=true
app.get('/api/tables', async (req, res) => {
  try {
    const raw    = req.query.available === 'true'
      ? await contract.getAvailableTables()
      : await contract.getAllTables();
    const tables = Array.from(raw).map(formatTable);
    res.json({ success: true, count: tables.length, data: tables });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/tables/:id/status  — staff only
app.put('/api/tables/:id/status', async (req, res) => {
  try {
    const id     = parseInt(req.params.id);
    const { status, signerPrivateKey } = req.body;

    if (status === undefined || !signerPrivateKey) {
      return res.status(400).json({ success: false, error: 'status (0–3) and signerPrivateKey are required' });
    }

    const signer  = buildSigner(signerPrivateKey);
    if (!signer) return res.status(400).json({ success: false, error: 'Invalid private key' });

    const tx      = await contract.connect(signer).updateTableStatus(id, parseInt(status));
    const receipt = await tx.wait();
    res.json({ success: true, message: `Table ${id} status updated to ${TABLE_STATUSES[status]}`, txHash: receipt.hash });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Reservations ──────────────────────────────────────────────

// GET /api/reservations
app.get('/api/reservations', async (req, res) => {
  try {
    const reservations = Array.from(await contract.getAllReservations()).map(formatReservation);
    res.json({ success: true, count: reservations.length, data: reservations });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/reservations  — customer signs with their wallet
app.post('/api/reservations', async (req, res) => {
  try {
    const { tableId, partySize, reservationTime, customerName, contactInfo = '', signerPrivateKey } = req.body;

    if (!tableId || !partySize || !reservationTime || !customerName || !signerPrivateKey) {
      return res.status(400).json({
        success: false,
        error: 'tableId, partySize, reservationTime, customerName, and signerPrivateKey are required'
      });
    }

    const timestamp = Math.floor(new Date(reservationTime).getTime() / 1000);
    if (timestamp <= Math.floor(Date.now() / 1000)) {
      return res.status(400).json({ success: false, error: 'reservationTime must be in the future' });
    }

    const signer  = buildSigner(signerPrivateKey);
    if (!signer) return res.status(400).json({ success: false, error: 'Invalid private key' });

    const tx      = await contract.connect(signer).makeReservation(tableId, partySize, timestamp, customerName, contactInfo);
    const receipt = await tx.wait();
    res.json({ success: true, message: 'Reservation created on blockchain', txHash: receipt.hash });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/reservations/:id/status  — staff only
app.put('/api/reservations/:id/status', async (req, res) => {
  try {
    const id     = parseInt(req.params.id);
    const { status, signerPrivateKey } = req.body;

    if (status === undefined || !signerPrivateKey) {
      return res.status(400).json({ success: false, error: 'status (0–3) and signerPrivateKey are required' });
    }

    const signer  = buildSigner(signerPrivateKey);
    if (!signer) return res.status(400).json({ success: false, error: 'Invalid private key' });

    const tx      = await contract.connect(signer).updateReservationStatus(id, parseInt(status));
    const receipt = await tx.wait();
    res.json({ success: true, message: `Reservation ${id} status updated to ${RESERVATION_STATUSES[status]}`, txHash: receipt.hash });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Stats ─────────────────────────────────────────────────────

// GET /api/stats
app.get('/api/stats', async (req, res) => {
  try {
    const [mi, ord, tbl, rsv, bal] = await contract.getRestaurantStats();
    res.json({
      success: true,
      data: {
        totalMenuItems:     Number(mi),
        totalOrders:        Number(ord),
        totalTables:        Number(tbl),
        totalReservations:  Number(rsv),
        contractBalance:    bal.toString(),
        contractBalanceEth: ethers.formatEther(bal)
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── 404 ───────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, error: `Not found: ${req.method} ${req.path}` });
});

// ── Start ─────────────────────────────────────────────────────
app.listen(PORT, async () => {
  console.log('\n🏔️  Everest Restaurant API Gateway');
  console.log('=====================================');
  console.log(`🚀 Server:   http://localhost:${PORT}`);
  console.log(`📋 Module:   CN6035 — Mobile & Distributed Systems`);
  console.log(`📍 Contract: ${CONTRACT_ADDRESS}`);
  console.log(`🔗 RPC:      ${RPC_URL}`);
  await verifyConnection();
  console.log('\n📡 Endpoints:');
  console.log('   GET  /api/health');
  console.log('   GET  /api/menu              GET /api/menu?category=Main');
  console.log('   POST /api/menu              (staff — requires signerPrivateKey)');
  console.log('   PUT  /api/menu/:id/toggle   (staff — requires signerPrivateKey)');
  console.log('   GET  /api/orders            GET /api/orders?status=0');
  console.log('   POST /api/orders            (requires signerPrivateKey)');
  console.log('   PUT  /api/orders/:id/status (staff — requires signerPrivateKey)');
  console.log('   GET  /api/tables            GET /api/tables?available=true');
  console.log('   PUT  /api/tables/:id/status (staff — requires signerPrivateKey)');
  console.log('   GET  /api/reservations');
  console.log('   POST /api/reservations      (requires signerPrivateKey)');
  console.log('   PUT  /api/reservations/:id/status');
  console.log('   GET  /api/stats');
  console.log('=====================================\n');
});

module.exports = app;

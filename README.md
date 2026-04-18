# Everest Restaurant DApp
### CN6035 — Mobile & Distributed Systems | University of East London 2025/26

A decentralised restaurant management system built on Ethereum.  
All data — menu items, orders, tables, reservations — is stored on the blockchain.

---

## Project Structure

```
everest-restaurant/
├── contracts/
│   └── RestaurantManager.sol     ← Ethereum smart contract (Solidity 0.8.19)
├── scripts/
│   └── deploy.js                 ← Deploy script (writes addresses to backend & frontend)
├── backend/
│   ├── server.js                 ← Express.js API Gateway (blockchain only)
│   └── package.json
├── frontend/
│   ├── index.html                ← Single-page DApp (requires MetaMask)
│   └── src/
│       └── contract-config.json  ← Auto-generated after deploy
├── hardhat.config.js
├── package.json
└── .env.example
```

---

## How to Run in VS Code

### What you need first

- **Node.js v18+** → https://nodejs.org
- **VS Code** → https://code.visualstudio.com
- **MetaMask** browser extension → https://metamask.io
- **Live Server** VS Code extension (optional but recommended)

---

### Step 1 — Open in VS Code

Open the `everest-restaurant` folder in VS Code.  
Open the integrated terminal: **Terminal → New Terminal** (Ctrl+`)

---

### Step 2 — Install root dependencies

```bash
npm install
```

---

### Step 3 — Compile the smart contract

```bash
npx hardhat compile
```

Expected output: `Compiled 1 Solidity file successfully`

---

### Step 4 — Start a local Ethereum node

Open a **new terminal tab** in VS Code:

```bash
npx hardhat node
```

**Keep this running.** Note the output — it gives you test accounts with private keys:

```
Account #0: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 (10000 ETH)
Private Key: 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
```

---

### Step 5 — Deploy the smart contract

Open another **new terminal tab**:

```bash
npx hardhat run scripts/deploy.js --network localhost
```

Expected output:
```
✅ Contract deployed successfully!
   Address: 0x5FbDB2315678afecb367f032d93F642f64180aa3
   Menu items: 12
   Tables:     5
backend/.env updated
frontend/src/contract-config.json saved
```

---

### Step 6 — Start the backend API

```bash
cd backend
npm install
node server.js
```

Expected output:
```
🚀 Server: http://localhost:3001
✅ Connected to blockchain — Chain ID 31337
✅ Contract verified — 0x5FbDB2315678...
```

Test it: open **http://localhost:3001/api/health** in your browser.

---

### Step 7 — Open the frontend

**Option A — Live Server (recommended):**
1. Right-click `frontend/index.html` in VS Code
2. Select **Open with Live Server**
3. Opens at `http://127.0.0.1:5500/frontend/index.html`

**Option B — Direct file open:**
- Double-click `frontend/index.html` to open in browser

---

### Step 8 — Connect MetaMask

1. Open MetaMask in your browser
2. Add a custom network:
   - Network Name: **Hardhat Local**
   - RPC URL: `http://127.0.0.1:8545`
   - Chain ID: `31337`
   - Currency Symbol: `ETH`
3. Import Account #0 using the private key from Step 4
4. Click **"🦊 Connect MetaMask"** in the app

The app will unlock and show the full dashboard.

---

## Technologies

| Layer | Technology |
|---|---|
| Smart Contract | Solidity 0.8.19 |
| Development Chain | Hardhat |
| Backend | Node.js + Express.js |
| Blockchain SDK | Ethers.js v6 |
| Frontend | HTML5 / CSS3 / Vanilla JS |
| Wallet | MetaMask (required) |

---

## API Reference

`Base URL: http://localhost:3001`

| Method | Endpoint | Auth |
|---|---|---|
| GET | `/api/health` | None |
| GET | `/api/menu` | None |
| GET | `/api/menu?category=Main` | None |
| POST | `/api/menu` | signerPrivateKey |
| PUT | `/api/menu/:id/toggle` | signerPrivateKey |
| GET | `/api/orders` | None |
| GET | `/api/orders?status=0` | None |
| POST | `/api/orders` | signerPrivateKey |
| PUT | `/api/orders/:id/status` | signerPrivateKey |
| GET | `/api/tables` | None |
| PUT | `/api/tables/:id/status` | signerPrivateKey |
| GET | `/api/reservations` | None |
| POST | `/api/reservations` | signerPrivateKey |
| PUT | `/api/reservations/:id/status` | signerPrivateKey |
| GET | `/api/stats` | None |

---

*CN6035 Mobile & Distributed Systems — University of East London 2025/26*

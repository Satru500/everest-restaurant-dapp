/**
 * deploy.js
 * CN6035 — Everest Restaurant DApp
 *
 * Deploys RestaurantManager to the local Hardhat node and writes
 * the contract address to backend/.env and frontend/src/contract-config.json
 * so both layers pick it up automatically.
 *
 * Usage:
 *   npx hardhat run scripts/deploy.js --network localhost
 */

const { ethers } = require("hardhat");
const fs   = require("fs");
const path = require("path");

async function main() {
  console.log("\n🏔️  Everest Restaurant — Smart Contract Deployment");
  console.log("====================================================");

  const [deployer] = await ethers.getSigners();
  const balance    = await ethers.provider.getBalance(deployer.address);

  console.log("Deployer address:", deployer.address);
  console.log("Deployer balance:", ethers.formatEther(balance), "ETH");

  console.log("\nDeploying RestaurantManager...");
  const Factory  = await ethers.getContractFactory("RestaurantManager");
  const contract = await Factory.deploy();
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  const network = await ethers.provider.getNetwork();
  const stats   = await contract.getRestaurantStats();

  console.log("\n✅ Contract deployed successfully!");
  console.log("   Address:", address);
  console.log("   Network:", network.name, "| Chain ID:", Number(network.chainId));
  console.log("   Menu items:", Number(stats[0]));
  console.log("   Tables:    ", Number(stats[2]));

  // ── Write deployment.json (project root) ─────────────────────────────────
  const deploymentData = {
    contractAddress: address,
    deployer:        deployer.address,
    network:         network.name,
    chainId:         Number(network.chainId),
    deployedAt:      new Date().toISOString()
  };
  fs.writeFileSync(
    path.join(__dirname, "../deployment.json"),
    JSON.stringify(deploymentData, null, 2)
  );

  // ── Write contract-config.json (for frontend) ────────────────────────────
  const frontendSrc = path.join(__dirname, "../frontend/src");
  if (!fs.existsSync(frontendSrc)) fs.mkdirSync(frontendSrc, { recursive: true });
  fs.writeFileSync(
    path.join(frontendSrc, "contract-config.json"),
    JSON.stringify({
      contractAddress: address,
      chainId:         Number(network.chainId),
      network:         network.name,
      deployedAt:      new Date().toISOString()
    }, null, 2)
  );

  // ── Write backend/.env ────────────────────────────────────────────────────
  fs.writeFileSync(
    path.join(__dirname, "../backend/.env"),
    `CONTRACT_ADDRESS=${address}\nRPC_URL=http://127.0.0.1:8545\nPORT=3001\n`
  );

  console.log("\n📁 Files written:");
  console.log("   deployment.json");
  console.log("   frontend/src/contract-config.json");
  console.log("   backend/.env");

  console.log("\n====================================================");
  console.log("Next steps:");
  console.log("  1. cd backend && npm install && node server.js");
  console.log("  2. Open frontend/index.html with Live Server");
  console.log("  3. Connect MetaMask → Hardhat Local (Chain ID 31337)");
  console.log("====================================================\n");
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error("\n❌ Deployment failed:", err.message);
    process.exit(1);
  });

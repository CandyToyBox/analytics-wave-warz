# 🌊 WaveWarz Analytics

**WaveWarz Analytics** is a real-time battle mechanics dashboard and settlement calculator for the WaveWarz decentralized music battle platform on Solana. It visualizes Total Value Locked (TVL), trading volume, unique trader activity, and prize pool distribution by combining static metadata with live on-chain data.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Solana](https://img.shields.io/badge/Solana-Mainnet-green)
![Status](https://img.shields.io/badge/Status-Live-orange)

## 🚀 Features

### 1. 📊 Live Battle Dashboard
- **Real-time TVL:** Fetches live SOL balances from Battle Vault PDAs (Program Derived Addresses).
- **Volume Tracking:** Analyzes on-chain transaction history to calculate trading volume and dominance for Artist A vs. Artist B.
- **Trader Metrics:** Tracks unique wallets and total trade counts.

### 2. 💰 Settlement Simulator & ROI Calculator
- **Outcome Simulation:** Calculates payouts based on the complex WaveWarz settlement logic (Winner take all, fee splits, etc.).
- **ROI Estimator:** Allows users to input an investment amount (SOL) and side (Artist A/B) to see projected profit/loss based on current pool mechanics.
- **Fee Breakdown:** Visualizes the distribution of funds to Winning Traders (40%), Winning Artist (5%), Losing Artist (2%), and Platform (3%).

### 3. ⏪ Historical Replay
- Visualizes the "tug-of-war" volatility of a battle.
- Replays key events like "Lead Changes" and "Whale Buys" on a time-series chart.

### 4. 🏆 Leaderboard
- Aggregates data across the entire battle history to rank artists by total battles, wins, and activity levels.

---

## 🛠 Tech Stack

- **Frontend:** React 19, TypeScript
- **Styling:** Tailwind CSS
- **Blockchain:** `@solana/web3.js`
- **Data Provider:** Helius RPC & Enhanced Transaction APIs
- **Visualization:** Recharts
- **Icons:** Lucide React

---

## ⚙️ How It Works

### Hybrid Data Architecture
The app uses a hybrid approach to ensure speed and accuracy:
1.  **Static Registry:** A curated CSV (`data.ts`) contains battle metadata (UUIDs, Artist Names, Image URLs).
2.  **On-Chain Hydration:** When a user selects a battle, the app connects to the Solana Mainnet to fetch the "Live" state.

### Blockchain Integration (`solanaService.ts`)
The app communicates directly with the WaveWarz Solana Program (`9TUfEHvk5fN5vogtQyrefgNqzKy2Bqb4nWVhSFUg2fYo`).

1.  **PDA Derivation:**
    The app automatically calculates the specific address for every battle using seeds:
    ```typescript
    // battle_id is converted to u64 LE bytes
    [b"battle", battle_id] -> Battle State Account
    [b"battle_vault", battle_id] -> Battle Sol Vault
    ```

2.  **Binary Decoding:**
    Instead of relying on heavy IDL parsing libraries at runtime, the app uses a custom `DataView` parser to read the raw byte array from the Solana account, extracting exact fields like `start_time`, `end_time`, and `total_distribution_amount`.

3.  **Volume Estimation:**
    Using Helius Transaction APIs, the app iterates through recent transaction history, filtering for `NativeTransfers` moving in and out of the Battle Vault to calculate real trading volume.

---

## 📦 Installation & Setup

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/your-username/wavewarz-analytics.git
    cd wavewarz-analytics
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Configure Environment:**
    *Note: The project currently contains a hardcoded Helius Public Demo Key. For production, create a `.env` file:*
    ```env
    VITE_HELIUS_API_KEY=your_api_key_here
    ```

4.  **Run the development server:**
    ```bash
    npm run dev
    ```

---

## 🚀 Deployment & Configuration

### Application Deployment

The application is deployed on Vercel and connects to Supabase for data storage.

### Post-Deployment Configuration

After deploying the application code, you'll need to configure Supabase settings manually via the Supabase Dashboard. See [`SUPABASE_CONFIGURATION.md`](./SUPABASE_CONFIGURATION.md) for detailed instructions on:

1. **Database Index Optimization** - Run the SQL migration to remove unused indexes and optimize performance
2. **Auth Server Connection Pool** - Switch from fixed to percentage-based connection allocation for better scaling
3. **Webhook Verification** - Ensure the battle webhook is configured correctly

These configurations are **not in application code** and require manual setup through the Supabase Dashboard.

### Database Migrations

SQL migrations are located in the [`migrations/`](./migrations/) directory. See [`migrations/README.md`](./migrations/README.md) for:
- How to apply migrations
- Validation queries
- Rollback instructions

---

## 🧮 Settlement Logic

The calculator implements the specific WaveWarz distribution blueprint:

| Party | Share of Loser's Pool |
| :--- | :--- |
| **Winning Traders** | **40%** (Distributed proportionally) |
| **Losing Traders** | **50%** (Retention of capital) |
| **Winning Artist** | **5%** |
| **Losing Artist** | **2%** |
| **Platform** | **3%** |

*Note: Winning traders also reclaim 100% of their share of the Winner's Pool.*

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1.  Fork the Project
2.  Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3.  Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4.  Push to the Branch (`git push origin feature/AmazingFeature`)
5.  Open a Pull Request

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

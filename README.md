# Notte Bellamonte Three-Phase Classroom Simulation

A simplified web-based simulation for teaching corporate governance (Week 6: CBCA s.241 oppression vs s.214 dissolution) in a 45-minute classroom session.

## Overview

The simulation has **3 phases**:

1. **Phase 1: Legal Framework Debate** — Students vote on whether the situation is oppression (s.241), dissolution (s.214), or partnership analogy
2. **Phase 2: Remedy Selection** — Students vote on the remedy (buyout, shotgun, timed auction, liquidation)
3. **Phase 3: Buy-Sell Execution** — Pairs who voted for a buy-sell mechanism execute it (shotgun or timed auction)

The scenario: **Lucia and Marco** are 50/50 co-owners of Notte Bellamonte Winery with no shareholder agreement. They are deadlocked over expansion strategy.

---

## Quick Start (for Testing)

### 1. Install Dependencies

```bash
cd notte-bellamonte-simulation
npm install
```

### 2. Start the Server

```bash
npm start
```

You should see:

```
🍷 Notte Bellamonte Simulation Server
📍 http://localhost:3040
🎓 Instructor: http://localhost:3040/instructor.html
👥 Students:  http://localhost:3040/student.html
```

### 3. Open in Browser

**Instructor:**
- Open: http://localhost:3040/instructor.html
- Click **"Create Session"**
- Copy the Session ID (e.g., `s12abc3def`)

**Students** (open multiple tabs/windows):
- Go to: http://localhost:3040/student.html
- Paste the Session ID
- Enter a name (e.g., "Alice", "Bob")
- Click **"Join Session"**

### 4. Run the Simulation

1. **Instructor:** Click **"Advance to Phase 1"**
2. **Students:** See the scenario and vote on legal framework (oppression/dissolution/partnership)
3. **Instructor:** Click **"Reveal Detailed Results"** when all have voted
4. **Instructor:** Click **"Advance to Phase 2"**
5. **Students:** Vote on remedy (buyout/shotgun/timed auction/liquidation)
6. **Instructor:** Reveal Phase 2 results and advance to Phase 3
7. **Phase 3:** Pairs execute the buy-sell mechanism (if selected)

---

## Running on University WiFi (for 45-minute Class)

Since your classroom uses public university WiFi, the server must be **self-hosted on a machine in the classroom**. Here's how:

### Option A: Run on Your Laptop (Recommended for Small Classes)

1. **Connect to university WiFi** on your laptop
2. **Install Node.js** if not already installed: https://nodejs.org/ (LTS version)
3. **Navigate to the project directory:**
   ```bash
   cd /path/to/notte-bellamonte-simulation
   npm install
   npm start
   ```
4. **Find your laptop's IP address:**
   - **Mac/Linux:** Open Terminal, run `ipconfig getifaddr en0` (or `ifconfig` to see all)
   - **Windows:** Open Command Prompt, run `ipconfig` (look for IPv4 address)
   - Example: `192.168.1.45`

5. **Share the URL with students:**
   - **Instructor:** `http://192.168.1.45:3040/instructor.html` (on your laptop)
   - **Students:** `http://192.168.1.45:3040/student.html` (each student on their device)

6. **Students join from their laptops/phones** on the same WiFi

### Option B: Use a Server Machine in the Lab

If your department has a server available:

1. SSH into the server
2. Clone this project (or upload the files)
3. Install Node.js and run `npm start`
4. Get the server's IP address
5. Share the URL with students

---

## How to Find Your Laptop's IP Address

### Mac:
```bash
ifconfig
```
Look for `inet` address under your active connection (usually `en0` for WiFi)

### Windows (Command Prompt):
```bash
ipconfig
```
Look for "IPv4 Address" under your active network adapter

### Linux:
```bash
hostname -I
```

**Example:** If your IP is `192.168.1.45`, students access:
- `http://192.168.1.45:3040/student.html`

---

## What Students See

### Phase 1 Voting
- Scenario card explaining Lucia/Marco's conflict
- Three vote buttons: Oppression, Dissolution, Partnership Analogy
- "Waiting for others..." message while votes are collected

### Phase 2 Voting
- Results from Phase 1 displayed
- Four remedy buttons: Buyout, Shotgun, Timed Auction, Liquidation
- Voting progress counter

### Phase 3 Execution
**If assigned to a pair:**
- **Shotgun mode:** One partner sets price; other chooses buy/sell
- **Timed Auction:** Price drops $50K/second; first to lock wins; other chooses buy/sell

**If not in a pair:**
- "You're observing this phase" message

---

## What Instructor Sees

### Dashboard shows:
- Session ID (for sharing with students)
- Participant count (live updates)
- Current phase
- **Phase 1:** Real-time vote counts (oppression/dissolution/partnership)
- **Phase 2:** Real-time vote counts + winning remedy
- **Phase 3:** Buy-sell pair status table

### Controls:
- **"Advance to Phase X"** button (manual, requires confirmation)
- **"Create Session"** button to start
- **"Reveal Detailed Results"** to show names + votes

---

## Troubleshooting

### "Cannot find module"
```bash
npm install
```

### "Port 3040 already in use"
```bash
PORT=3041 npm start
```

### Students can't connect
1. Verify your IP address is correct
2. Check that all devices are on the same WiFi
3. Try `http://localhost:3040` on your laptop to confirm server is running
4. Disable any firewall blocks for Node.js

---

## 45-Minute Session Plan

| Time | Activity |
|------|----------|
| 0-2 min | Create session, share Session ID |
| 2-5 min | Students join |
| 5-7 min | Advance to Phase 1 |
| 7-15 min | Students vote on legal framework |
| 15-18 min | Reveal Phase 1 results |
| 18-20 min | Advance to Phase 2 |
| 20-28 min | Students vote on remedy |
| 28-30 min | Reveal Phase 2 results |
| 30-40 min | Advance to Phase 3, execute buy-sell |
| 40-45 min | Debrief & discussion |

---

Good luck with your 45-minute simulation! 🍷

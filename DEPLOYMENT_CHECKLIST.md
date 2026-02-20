# Deployment Checklist for Notte Bellamonte Simulation

## Pre-Classroom Checklist (Do This Before Class)

### 1 Week Before
- [ ] Review the scenario with colleagues
- [ ] Ensure you understand all 3 phases
- [ ] Read through [SESSION_SUMMARY.md](SESSION_SUMMARY.md)
- [ ] Run through [QUICK_REFERENCE.md](QUICK_REFERENCE.md) class flow

### 2 Days Before
- [ ] Test the application locally:
  ```bash
  cd ~/Library/CloudStorage/GoogleDrive-yashar21173@gmail.com/My\ Drive/Courses/2L\ -\ S2/JUR360\ -\ Corporate\ Governance/Readings/W6/notte-bellamonte-simulation
  node server.js
  ```
- [ ] Verify it starts without errors
- [ ] Open http://localhost:3040/ in your browser

### 1 Day Before
- [ ] Full end-to-end test with at least 4 test users:
  - [ ] Create session
  - [ ] Phase 1: All students vote (verify vote counter updates)
  - [ ] Reveal Phase 1 results
  - [ ] Phase 2: All students vote (ensure at least 2 vote for Shotgun/Timed)
  - [ ] Reveal Phase 2 results
  - [ ] Advance to Phase 3 (verify pairs form)
  - [ ] Execute buy-sell (watch live display)

### Day Of Class (30 minutes before)
- [ ] Ensure you have:
  - [ ] Laptop/device connected to classroom WiFi/network
  - [ ] Classroom projector/display ready
  - [ ] WiFi password or network access confirmed

- [ ] Start the server:
  ```bash
  cd ~/Library/CloudStorage/GoogleDrive-yashar21173@gmail.com/My\ Drive/Courses/2L\ -\ S2/JUR360\ -\ Corporate\ Governance/Readings/W6/notte-bellamonte-simulation
  node server.js
  ```

- [ ] Navigate to the application:
  - **Option A (Production - Recommended)**:
    - URL: https://notte-bellamonte-simulation-production.up.railway.app/
    - No local server needed (already deployed on Railway)

  - **Option B (Local Server)**:
    - URL: http://localhost:3040/ (for testing)
    - Server must be running on your machine
    - Students: http://YOUR_IP:3040/student.html

- [ ] Create a test session:
  - [ ] Click "Create Session"
  - [ ] Get a session ID (6-digit alphanumeric)
  - [ ] Write it on the board or share via screen

- [ ] Test one student joining:
  - [ ] Open student URL on a second device
  - [ ] Enter session ID and test name
  - [ ] Verify it shows in participant counter

---

## During Class

### Opening (5 minutes before class starts)
- [ ] Have the session created and ready
- [ ] Display the student URL on the projector
- [ ] Have session ID visible
- [ ] Instructor dashboard open on your screen

### Student Login Phase (First 2 minutes)
- [ ] Call out the student URL and session ID
- [ ] Watch participant counter increase
- [ ] Wait until all students have joined (or call out who's missing)
- [ ] When ready, say "Let's begin Phase 1"

### Phase 1: Legal Framework Vote (10 minutes)
- [ ] Click "Advance to Phase 1"
- [ ] Explain the scenario if needed:
  - "Lucia and Marco are 50/50 co-owners of Notte Bellamonte Winery"
  - "They are deadlocked over expansion strategy"
  - "One wants to expand, the other doesn't"

- [ ] Direct students to vote (Oppression s.241 / Dissolution s.214 / Partnership)
- [ ] Watch vote counter increase in real-time
- [ ] When all have voted (or time is up), say "I'm revealing the results"
- [ ] Click "Reveal Detailed Results" to show:
  - Vote counts for each option
  - Student names and their votes (for transparency)

- [ ] Discuss: "What does this result tell us about how the class views this situation?"

### Phase 2: Remedy Selection Vote (15 minutes)
- [ ] Click "Advance to Phase 2"
- [ ] Explain the four remedy options:
  - **Buyout**: Third party buys one partner out (not a buy-sell mechanism)
  - **Shotgun**: One partner sets price, other chooses buy/sell at that price
  - **Timed Auction**: Price descends; either can lock; other chooses buy/sell
  - **Liquidation**: Sell company and divide proceeds (nuclear option)

- [ ] Students discuss and vote
- [ ] Watch vote counter
- [ ] When ready, click "Reveal Phase 2 Results"
- [ ] Discuss: "Why did the class prefer this remedy?"

### Phase 3: Buy-Sell Execution (15 minutes)
- [ ] Click "Advance to Phase 3"
- [ ] **CRITICAL**: Verify pairs formed:
  - [ ] Check the pairs table shows partner names
  - [ ] Confirm pairs are from students who voted for shotgun/timed auction

- [ ] Explain what's about to happen:
  - "Now we'll see a live buy-sell mechanism in action"
  - "Students in pairs: you're about to negotiate"
  - "Everyone: watch what happens in real-time"

- [ ] If **Shotgun mode**:
  - Partner A: "Set a price you're willing to buy or sell shares at"
  - Partner B: "Decide if you'll buy at that price or sell at that price"
  - Watch live display as transaction executes

- [ ] If **Timed Auction mode**:
  - "Price is descending. Either of you can lock at any time."
  - Partner who doesn't lock chooses buy or sell at locked price
  - Watch live display update

- [ ] After execution:
  - Point out the transaction to the class
  - Explain what just happened: "At $2.1M, Partner B chose to BUY at that price"
  - Or: "Partner A locked at $2.3M, then Partner B SOLD at that price"

### Closing (5 minutes)
- [ ] Thank students for participating
- [ ] Optional: "What did you learn about buy-sell mechanisms?"
- [ ] Remind them: "This is what lawyers negotiate in real corporate disputes"

---

## Troubleshooting During Class

### "The website won't load"
- [ ] Check WiFi connection
- [ ] If using local server: `node server.js` running?
- [ ] Try restarting the browser
- [ ] If using Railway: Wait 30 seconds (might be starting up)

### "Students can't join"
- [ ] Verify they have the correct session ID (case-sensitive)
- [ ] Check they're on the right URL
- [ ] Try F5 to refresh
- [ ] Ask one student to show you their screen

### "Vote counter not updating"
- [ ] Verify students clicked the vote button (not just selected it)
- [ ] Check for blue "Vote Submitted" message on their screen
- [ ] Refresh instructor dashboard (F5)

### "Pairs didn't form in Phase 3"
- [ ] Check Phase 2 results: Did at least 2 students vote for Shotgun/Timed Auction?
- [ ] Reload the page (F5) to refresh pair data
- [ ] If still broken: Go back to Phase 2, re-reveal results, then advance again

### "Live display not showing price/transaction"
- [ ] Reload page (F5)
- [ ] Ensure students are actually in a pair
- [ ] Watch the live display container on your instructor screen
- [ ] Ask a student if they see the price on their screen

### Server crashed / Connection lost
- [ ] If using local: Restart server with `node server.js`
- [ ] Create a NEW session (data is lost)
- [ ] Share new session ID with students
- [ ] If using Railway: Wait 30 seconds and reload

---

## Post-Class

### Immediately After
- [ ] Thank students
- [ ] Ask for quick feedback: "What did you think of that simulation?"
- [ ] Stop the server (if running locally): Press Ctrl+C in terminal

### Same Day
- [ ] Write down any issues that occurred
- [ ] Note student reactions and questions
- [ ] Plan any changes for next semester

### Within 1 Week
- [ ] Review what worked well
- [ ] Note what could be improved
- [ ] Gather student feedback (survey?)
- [ ] Suggest any code improvements

---

## Deployment Options

### Option 1: Railway (Recommended - No Setup Needed)
**Best for**: Live classroom use, no local server

```
URL: https://notte-bellamonte-simulation-production.up.railway.app
Instructor: https://notte-bellamonte-simulation-production.up.railway.app/
Students: https://notte-bellamonte-simulation-production.up.railway.app/student.html
```

**Pros**:
- Works from any internet connection
- No local server needed
- Always available
- Auto-deploys on code changes

**Cons**:
- Requires internet
- Can't modify without git push
- Server shutdown loses data

### Option 2: Local Server (For Testing)
**Best for**: Testing locally, classroom with stable WiFi

```bash
# In project directory:
node server.js

# Then share your IP:
http://YOUR_IP:3040/student.html
```

**Pros**:
- Full control
- Can modify on the fly
- Offline capable
- No internet required

**Cons**:
- Requires Node.js installed
- Need to get your IP address
- Must run on your laptop
- Students must be on same network

### Option 3: Hybrid (Best of Both)
**Use Railway for class, test locally first**

1. Test locally to verify everything works
2. Make any changes and git push
3. Use Railway URL for actual class

---

## Performance Tips

### For Smooth Operation
- [ ] Close unnecessary browser tabs
- [ ] Disable browser extensions (ad blockers can interfere)
- [ ] Use a wired connection if possible (more stable than WiFi)
- [ ] Test video projection before class
- [ ] Have a backup device ready (phone with student URL)
- [ ] Don't multitask during simulation

### Server Performance
- [ ] Check no other Node.js processes are running (port 3040 conflicts)
- [ ] Adequate laptop RAM (8GB+ recommended)
- [ ] Stable WiFi signal throughout classroom
- [ ] Minimal network congestion during class

---

## Security Notes

### Before Using in Class
- [ ] Session IDs are semi-random but not cryptographically secure
- [ ] This is fine for a classroom, not for sensitive data
- [ ] Each session creates new data (not persistent)
- [ ] No authentication required (assumes trusted environment)

### Data Privacy
- [ ] Instructor sees all votes with student names
- [ ] Other students see aggregate results (not individual names)
- [ ] No data is stored after server stops
- [ ] Consider announcing this to students for transparency

---

## Final Checklist Before Going Live

**24 Hours Before Class**
- [ ] Full end-to-end test completed
- [ ] All features working
- [ ] Could you explain each phase to someone?

**1 Hour Before Class**
- [ ] Server is running (if local) or Railway is accessible
- [ ] Participant counter displays correctly
- [ ] Projector/display working
- [ ] Session can be created and shared

**At the Start of Class**
- [ ] All students are able to join
- [ ] Student counter matches expected attendance
- [ ] You're ready to explain the scenario

---

## Emergency Contacts / Backup Plans

**If things go wrong:**
1. Have the scenario printed out (for discussion without app)
2. Have a backup way to collect votes (show of hands, paper ballot)
3. Know how to quickly restart the server
4. Have the GitHub link handy to download fresh code
5. Have a colleague's contact for technical support

---

## Success Metrics

After running the simulation, you'll know it was successful if:
- ✅ All students were able to join and participate
- ✅ Vote counts updated in real-time
- ✅ Pairs formed correctly in Phase 3
- ✅ Buy-sell mechanism executed
- ✅ Live display showed transaction to entire class
- ✅ Students understood the practical application of doctrine
- ✅ Students engaged with the material

---

**You're ready to go! Good luck with your class.** 🍷

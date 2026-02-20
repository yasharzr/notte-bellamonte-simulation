# Quick Reference Guide - Notte Bellamonte Simulation

## 🚀 Quick Start (Testing)

### 1. Start Local Server
```bash
cd ~/Library/CloudStorage/GoogleDrive-yashar21173@gmail.com/My\ Drive/Courses/2L\ -\ S2/JUR360\ -\ Corporate\ Governance/Readings/W6/notte-bellamonte-simulation
node server.js
```

### 2. Open URLs
- **Instructor**: http://localhost:3040/
- **Students**: http://localhost:3040/student.html

---

## 🌐 For Class (Production)

### Instructor URL
```
https://notte-bellamonte-simulation-production.up.railway.app/
```

### Student URL
```
https://notte-bellamonte-simulation-production.up.railway.app/student.html
```

---

## 📋 Typical Class Session Flow

| Step | Who | What | Time |
|------|-----|------|------|
| 1 | Instructor | Create session, get ID | 1 min |
| 2 | Students | Join with ID + name | 2 min |
| 3 | Instructor | Advance to Phase 1 | <1 min |
| 4 | Students | Discuss & vote on legal framework | 10 min |
| 5 | Instructor | Reveal Phase 1 results | <1 min |
| 6 | Instructor | Advance to Phase 2 | <1 min |
| 7 | Students | Discuss & vote on remedy | 15 min |
| 8 | Instructor | Reveal Phase 2 results | <1 min |
| 9 | Instructor | Advance to Phase 3 | <1 min |
| 10 | Paired Students | Execute buy-sell mechanism | 15 min |
| 11 | Instructor | End simulation | <1 min |

**Total**: ~45 minutes

---

## 🐛 Last Fix Applied

**Date**: February 18, 2026
**Issue**: Phase 3 buy-sell not executing (showing zeros and observer message)
**Fix**: Auto-tally Phase 2 votes and form pairs on advance-phase endpoint
**Status**: ✅ Deployed to Railway

---

## 📂 Key Files Changed

- `server.js` (lines 341-407): Modified advance-phase endpoint
  - Now auto-tallies Phase 2 votes
  - Forms pairs automatically
  - Sets buysellMode correctly

---

## 🔄 Git Workflow

```bash
# Make changes, then:
git add .
git commit -m "Description of change"
git push origin main

# Auto-deploys to Railway in ~30 seconds
```

---

## ⚡ Real-Time Features

- **1-second refresh**: Instructor dashboard updates participant count live
- **Socket.io**: All students see buy-sell transactions as they happen
- **Live display**: Price, offeror/offeree, and status visible to entire class

---

## ✅ What's Working

- ✅ Phase 1 voting (Oppression/Dissolution/Partnership)
- ✅ Phase 2 voting (Buyout/Shotgun/Timed/Liquidation)
- ✅ Auto-pair formation from buy-sell voters
- ✅ Shotgun sale (price offer → buy/sell choice)
- ✅ Timed auction (descending price → lock → final choice)
- ✅ Real-time updates across all devices
- ✅ Live visualization for entire class

---

## 🧪 Test Before Class

Run through this checklist locally:

1. Start server locally
2. Open instructor and 4 test student windows
3. Create session
4. All 4 students join
5. Phase 1: All vote (check vote counter)
6. Reveal Phase 1: Check vote display
7. Phase 2: All vote (at least 2 for Shotgun/Timed)
8. Reveal Phase 2: Check vote display
9. Advance to Phase 3: Verify pairs form
10. Execute buy-sell: Watch live display update

---

## 🚨 Important Reminders

- **For live class**: Use production URL (Railway link)
- **Session data**: Only exists while server runs (not persistent)
- **Test mode**: Use localhost for testing before class
- **Students vote**: Must actually submit votes, not just see buttons
- **Pair requirement**: At least 2 students must vote for buy-sell mechanisms
- **Browser console**: Check for errors if things don't work

---

## 📞 Troubleshooting

| Problem | Check |
|---------|-------|
| "Cannot GET /instructor.html" | Server not running (run `node server.js`) |
| No vote counter update | Refresh page; check that votes are submitted |
| Pairs not forming | Verify at least 2 students voted for Shotgun/Timed |
| Real-time not working | Check browser dev console for Socket.io errors |
| Students can't join | Correct session ID? Check console for error messages |

---

**Status**: Production ready for classroom use ✅
**Last tested**: February 18, 2026

/**
 * Notte Bellamonte Three-Phase Classroom Simulation
 * Phase 1: Legal Framework Voting (Oppression vs Dissolution vs Partnership)
 * Phase 2: Remedy Selection (Buyout, Shotgun, Timed Auction, Liquidation)
 * Phase 3: Buy-Sell Execution (ALL participants paired: Lucia vs Marco)
 */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});
const PORT = process.env.PORT || 3040;

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'instructor.html'));
});

// ─── Session Store ─────────────────────────────────────────────────────────

const sessions = new Map();

function mkSession(config) {
  const id = 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const s = {
    id,
    config: {
      scenarioName: 'Notte Bellamonte Winery',
      valuationMin: 1500000,
      valuationMax: 3500000,
      offerTimeLimitSeconds: 120,
      responseTimeLimitSeconds: 60,
      timedAuctionStartPrice: 3000000,
      timedAuctionDropPerSecond: 50000,
      ...config
    },
    phase: 'lobby', // lobby -> phase_1_debate -> phase_2_remedy -> phase_3_buysell -> complete
    participants: [],
    roleCounter: 0, // alternates: 0=lucia, 1=marco, 2=lucia, etc.

    // Phase 1: Legal Framework Voting
    phase1Votes: new Map(), // participantId -> { choice, submittedAt, name }
    phase1Results: { oppression: 0, dissolution: 0, partnership: 0, revealed: false },

    // Phase 2: Remedy Selection Voting
    phase2Votes: new Map(), // participantId -> { remedy, submittedAt, name }
    phase2Results: { buyout: 0, shotgun: 0, timedauction: 0, liquidation: 0, revealed: false, winningRemedy: null },

    // Phase 3: Buy-Sell Execution
    buysellPairs: [],
    buysellMode: 'shotgun', // or 'timedauction'

    createdAt: Date.now(),
  };
  sessions.set(id, s);
  return s;
}

// ─── Helper Functions ──────────────────────────────────────────────────────

function tallyVotes(voteMap, choices, field = 'choice') {
  const result = {};
  for (const choice of choices) result[choice] = 0;
  for (const vote of voteMap.values()) {
    const val = vote[field];
    if (val in result) result[val]++;
  }
  return result;
}

function getWinningRemedy(phase2Results) {
  const { buyout, shotgun, timedauction, liquidation } = phase2Results;
  const votes = { buyout, shotgun, timedauction, liquidation };
  const max = Math.max(...Object.values(votes));
  for (const [remedy, count] of Object.entries(votes)) {
    if (count === max) return remedy;
  }
  return null;
}

// ─── API Routes ────────────────────────────────────────────────────────────

app.post('/api/session', (req, res) => {
  const s = mkSession(req.body.config || {});
  res.json({ sessionId: s.id });
});

app.get('/api/session/:id', (req, res) => {
  const s = sessions.get(req.params.id);
  if (!s) return res.status(404).json({ error: 'Session not found' });

  // Build response (instructor-visible: all data; students: limited)
  const isInstructor = req.query.role === 'instructor';

  res.json({
    id: s.id,
    phase: s.phase,
    config: s.config,
    participants: s.participants.map(p => ({ id: p.id, name: p.name, role: p.role, status: p.status })),
    participantCount: s.participants.length,
    lucias: s.participants.filter(p => p.role === 'lucia').length,
    marcos: s.participants.filter(p => p.role === 'marco').length,

    // Phase 1 Results
    phase1Results: s.phase1Results,
    phase1Votes: isInstructor ? Array.from(s.phase1Votes.values()) : [],

    // Phase 2 Results
    phase2Results: s.phase2Results,
    phase2Votes: isInstructor ? Array.from(s.phase2Votes.values()) : [],

    // Phase 3 Pairs
    buysellPairs: s.buysellPairs,
    buysellMode: s.buysellMode,
  });
});

app.post('/api/session/:id/join', (req, res) => {
  const s = sessions.get(req.params.id);
  if (!s) return res.status(404).json({ error: 'Session not found' });

  const { name } = req.body;

  const participant = {
    id: Math.random().toString(36).slice(2, 10),
    name,
    role: null, // Roles assigned in Phase 3 only
    status: 'active',
    lastSeen: Date.now(),
    joinedAt: Date.now(),
  };
  s.participants.push(participant);

  io.to(s.id).emit('participant_joined', { name, count: s.participants.length });

  res.json({ participantId: participant.id, sessionId: s.id });
});

// Reconnect: student refreshed or lost connection
app.post('/api/session/:id/reconnect', (req, res) => {
  const s = sessions.get(req.params.id);
  if (!s) return res.status(404).json({ error: 'Session not found' });

  const { participantId } = req.body;
  const participant = s.participants.find(p => p.id === participantId);

  if (!participant) {
    return res.status(404).json({ error: 'not_found' });
  }

  participant.status = 'active';
  participant.lastSeen = Date.now();

  res.json({
    ok: true,
    participantId: participant.id,
    name: participant.name,
    role: participant.role,
    sessionId: s.id,
    phase: s.phase,
  });
});

// PHASE 1: Vote on legal framework
app.post('/api/session/:id/vote-phase1', (req, res) => {
  const s = sessions.get(req.params.id);
  if (!s) return res.status(404).json({ error: 'Session not found' });
  if (s.phase !== 'phase_1_debate') return res.status(400).json({ error: 'Not in phase 1' });

  const { participantId, choice } = req.body;
  if (!['oppression', 'dissolution', 'partnership'].includes(choice)) {
    return res.status(400).json({ error: 'Invalid choice' });
  }

  const participant = s.participants.find(p => p.id === participantId);
  if (!participant) return res.status(400).json({ error: 'Participant not found' });

  s.phase1Votes.set(participantId, { choice, submittedAt: Date.now(), name: participant.name });

  // Emit to instructor for real-time dashboard
  io.to('instructor-' + s.id).emit('phase1_vote_update', {
    votesSubmitted: s.phase1Votes.size,
    votesExpected: s.participants.length,
    counts: tallyVotes(s.phase1Votes, ['oppression', 'dissolution', 'partnership']),
  });

  res.json({ ok: true });
});

// PHASE 1: Reveal results
app.post('/api/session/:id/reveal-phase1', (req, res) => {
  const s = sessions.get(req.params.id);
  if (!s) return res.status(404).json({ error: 'Session not found' });

  s.phase1Results.revealed = true;
  s.phase1Results = {
    ...tallyVotes(s.phase1Votes, ['oppression', 'dissolution', 'partnership']),
    revealed: true,
    allVotes: Array.from(s.phase1Votes.values()).map(v => ({ name: v.name, choice: v.choice })),
  };

  io.to(s.id).emit('phase1_revealed', s.phase1Results);
  res.json(s.phase1Results);
});

// PHASE 2: Vote on remedy
app.post('/api/session/:id/vote-phase2', (req, res) => {
  const s = sessions.get(req.params.id);
  if (!s) return res.status(404).json({ error: 'Session not found' });
  if (s.phase !== 'phase_2_remedy') return res.status(400).json({ error: 'Not in phase 2' });

  const { participantId, remedy } = req.body;
  if (!['buyout', 'shotgun', 'timedauction', 'liquidation'].includes(remedy)) {
    return res.status(400).json({ error: 'Invalid remedy' });
  }

  const participant = s.participants.find(p => p.id === participantId);
  if (!participant) return res.status(400).json({ error: 'Participant not found' });

  s.phase2Votes.set(participantId, { remedy, submittedAt: Date.now(), name: participant.name });

  // Emit to instructor for real-time dashboard
  io.to('instructor-' + s.id).emit('phase2_vote_update', {
    votesSubmitted: s.phase2Votes.size,
    votesExpected: s.participants.length,
    counts: tallyVotes(s.phase2Votes, ['buyout', 'shotgun', 'timedauction', 'liquidation'], 'remedy'),
  });

  res.json({ ok: true });
});

// PHASE 2: Reveal results
app.post('/api/session/:id/reveal-phase2', (req, res) => {
  const s = sessions.get(req.params.id);
  if (!s) return res.status(404).json({ error: 'Session not found' });

  const counts = tallyVotes(s.phase2Votes, ['buyout', 'shotgun', 'timedauction', 'liquidation'], 'remedy');
  const winningRemedy = getWinningRemedy(counts);

  s.phase2Results = {
    ...counts,
    revealed: true,
    winningRemedy,
    allVotes: Array.from(s.phase2Votes.values()).map(v => ({ name: v.name, remedy: v.remedy })),
  };

  // Set buy-sell mode based on winning remedy; default to shotgun if non-buy-sell won
  if (['shotgun', 'timedauction'].includes(winningRemedy)) {
    s.buysellMode = winningRemedy;
  } else {
    s.buysellMode = 'shotgun';
  }

  io.to(s.id).emit('phase2_revealed', s.phase2Results);
  res.json(s.phase2Results);
});

// PHASE 3: Form buy-sell pairs
app.post('/api/session/:id/form-buysell-pairs', (req, res) => {
  const s = sessions.get(req.params.id);
  if (!s) return res.status(404).json({ error: 'Session not found' });
  if (s.phase !== 'phase_3_buysell') return res.status(400).json({ error: 'Not in phase 3' });

  // Assign roles if not yet assigned, then pair
  const active = s.participants.filter(p => p.status === 'active');
  if (!active.some(p => p.role)) {
    s.roleCounter = 0;
    for (const p of active) {
      p.role = s.roleCounter % 2 === 0 ? 'lucia' : 'marco';
      s.roleCounter++;
    }
  }

  const lucias = active.filter(p => p.role === 'lucia');
  const marcos = active.filter(p => p.role === 'marco');

  const pairCount = Math.min(lucias.length, marcos.length);
  s.buysellPairs = [];
  for (let i = 0; i < pairCount; i++) {
    const pairId = 'pair-' + Math.random().toString(36).slice(2, 8);
    s.buysellPairs.push({
      pairId,
      partnerA: { id: lucias[i].id, name: lucias[i].name, role: 'Lucia' },
      partnerB: { id: marcos[i].id, name: marcos[i].name, role: 'Marco' },
      status: 'waiting_for_offer',
      shotgunOffer: null,
      shotgunOfferorId: null,
      shotgunChoice: null,
      finalPrice: null,
      timedAuctionLockedPrice: null,
      timedAuctionLockedBy: null,
    });
  }

  io.to(s.id).emit('buysell_pairs_formed', { pairs: s.buysellPairs, mode: s.buysellMode });
  res.json({ pairs: s.buysellPairs, mode: s.buysellMode });
});

// PHASE 3: Shotgun offer
app.post('/api/session/:id/buysell/:pairId/offer', (req, res) => {
  const s = sessions.get(req.params.id);
  if (!s) return res.status(404).json({ error: 'Session not found' });

  const pair = s.buysellPairs.find(p => p.pairId === req.params.pairId);
  if (!pair) return res.status(404).json({ error: 'Pair not found' });

  const { participantId, price } = req.body;
  pair.shotgunOffer = price;
  pair.shotgunOfferorId = participantId;
  pair.status = 'offered';

  io.to(s.id).emit('shotgun_offer_made', { pairId: pair.pairId, price });
  res.json({ ok: true });
});

// PHASE 3: Shotgun response
app.post('/api/session/:id/buysell/:pairId/respond', (req, res) => {
  const s = sessions.get(req.params.id);
  if (!s) return res.status(404).json({ error: 'Session not found' });

  const pair = s.buysellPairs.find(p => p.pairId === req.params.pairId);
  if (!pair) return res.status(404).json({ error: 'Pair not found' });

  const { choice } = req.body; // 'buy' or 'sell'
  pair.shotgunChoice = choice;
  pair.finalPrice = pair.shotgunOffer;
  pair.status = 'complete';

  const remedy = choice === 'buy'
    ? `${pair.partnerB.name} bought ${pair.partnerA.name}'s shares at $${pair.finalPrice}`
    : `${pair.partnerB.name} sold their shares to ${pair.partnerA.name} at $${pair.finalPrice}`;

  io.to(s.id).emit('buysell_complete', { pairId: pair.pairId, remedy });
  res.json({ ok: true, remedy });
});

// PHASE 3: Timed auction lock
app.post('/api/session/:id/buysell/:pairId/lock-timed', (req, res) => {
  const s = sessions.get(req.params.id);
  if (!s) return res.status(404).json({ error: 'Session not found' });

  const pair = s.buysellPairs.find(p => p.pairId === req.params.pairId);
  if (!pair) return res.status(404).json({ error: 'Pair not found' });

  const { participantId, price } = req.body;
  pair.timedAuctionLockedPrice = price;
  pair.timedAuctionLockedBy = participantId;
  pair.status = 'waiting_for_final_choice';

  io.to(s.id).emit('timed_price_locked', { pairId: pair.pairId, price, lockedBy: participantId });
  res.json({ ok: true });
});

// PHASE 3: Timed auction final choice
app.post('/api/session/:id/buysell/:pairId/final-choice', (req, res) => {
  const s = sessions.get(req.params.id);
  if (!s) return res.status(404).json({ error: 'Session not found' });

  const pair = s.buysellPairs.find(p => p.pairId === req.params.pairId);
  if (!pair) return res.status(404).json({ error: 'Pair not found' });

  const { choice } = req.body; // 'buy' or 'sell'
  pair.shotgunChoice = choice;
  pair.finalPrice = pair.timedAuctionLockedPrice;
  pair.status = 'complete';

  const remedy = choice === 'buy'
    ? `${pair.partnerB.name} bought ${pair.partnerA.name}'s shares at $${pair.finalPrice}`
    : `${pair.partnerB.name} sold their shares to ${pair.partnerA.name} at $${pair.finalPrice}`;

  io.to(s.id).emit('buysell_complete', { pairId: pair.pairId, remedy });
  res.json({ ok: true, remedy });
});

// Advance phase
app.post('/api/session/:id/advance-phase', (req, res) => {
  const s = sessions.get(req.params.id);
  if (!s) return res.status(404).json({ error: 'Session not found' });

  const order = ['lobby', 'phase_1_debate', 'phase_2_remedy', 'phase_3_buysell', 'complete'];
  const idx = order.indexOf(s.phase);

  if (idx === -1 || idx >= order.length - 1) {
    return res.status(400).json({ error: 'Cannot advance further' });
  }

  const nextPhase = order[idx + 1];
  s.phase = nextPhase;

  // Initialize phase data - only clear when ENTERING a voting phase
  if (nextPhase === 'phase_1_debate') {
    s.phase1Votes.clear();
  } else if (nextPhase === 'phase_2_remedy') {
    s.phase2Votes.clear();
  } else if (nextPhase === 'phase_3_buysell') {
    // Reveal phase 2 results if not already revealed
    if (!s.phase2Results.revealed) {
      const counts = tallyVotes(s.phase2Votes, ['buyout', 'shotgun', 'timedauction', 'liquidation'], 'remedy');
      const winningRemedy = getWinningRemedy(counts);
      s.phase2Results = {
        ...counts,
        revealed: true,
        winningRemedy,
        allVotes: Array.from(s.phase2Votes.values()).map(v => ({ name: v.name, remedy: v.remedy })),
      };
      if (['shotgun', 'timedauction'].includes(winningRemedy)) {
        s.buysellMode = winningRemedy;
      } else {
        // Default to shotgun for Phase 3 exercise even if class voted buyout/liquidation
        s.buysellMode = 'shotgun';
      }
    }

    // ── ASSIGN ROLES NOW (Phase 3 only) ──
    // Shuffle active participants, then alternate lucia/marco
    const active = s.participants.filter(p => p.status === 'active');
    for (let i = active.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [active[i], active[j]] = [active[j], active[i]];
    }
    s.roleCounter = 0;
    for (const p of active) {
      p.role = s.roleCounter % 2 === 0 ? 'lucia' : 'marco';
      s.roleCounter++;
    }

    // Form buy-sell pairs (each Lucia with a Marco)
    const lucias = active.filter(p => p.role === 'lucia');
    const marcos = active.filter(p => p.role === 'marco');

    const pairCount = Math.min(lucias.length, marcos.length);
    s.buysellPairs = [];
    for (let i = 0; i < pairCount; i++) {
      const pairId = 'pair-' + Math.random().toString(36).slice(2, 8);
      s.buysellPairs.push({
        pairId,
        partnerA: { id: lucias[i].id, name: lucias[i].name, role: 'Lucia' },
        partnerB: { id: marcos[i].id, name: marcos[i].name, role: 'Marco' },
        status: 'waiting_for_offer',
        shotgunOffer: null,
        shotgunOfferorId: null,
        shotgunChoice: null,
        finalPrice: null,
        timedAuctionLockedPrice: null,
        timedAuctionLockedBy: null,
      });
    }
  }

  io.to(s.id).emit('phase_changed', { phase: nextPhase });
  res.json({ phase: nextPhase });
});

// ─── Analytics endpoint for data analysis page ────────────────────────────

app.get('/api/session/:id/analytics', (req, res) => {
  const s = sessions.get(req.params.id);
  if (!s) return res.status(404).json({ error: 'Session not found' });

  const phase1Counts = tallyVotes(s.phase1Votes, ['oppression', 'dissolution', 'partnership']);
  const phase2Counts = tallyVotes(s.phase2Votes, ['buyout', 'shotgun', 'timedauction', 'liquidation'], 'remedy');

  // Build pair outcomes
  const pairOutcomes = s.buysellPairs.map(p => ({
    partnerA: p.partnerA.name,
    partnerB: p.partnerB.name,
    offer: p.shotgunOffer,
    choice: p.shotgunChoice,
    finalPrice: p.finalPrice,
    status: p.status,
  }));

  res.json({
    sessionId: s.id,
    participantCount: s.participants.length,
    phase: s.phase,
    phase1: {
      totalVotes: s.phase1Votes.size,
      counts: phase1Counts,
      votes: Array.from(s.phase1Votes.values()).map(v => ({ name: v.name, choice: v.choice })),
    },
    phase2: {
      totalVotes: s.phase2Votes.size,
      counts: phase2Counts,
      winningRemedy: s.phase2Results.winningRemedy,
      votes: Array.from(s.phase2Votes.values()).map(v => ({ name: v.name, remedy: v.remedy })),
    },
    phase3: {
      mode: s.buysellMode,
      pairs: pairOutcomes,
      completedPairs: pairOutcomes.filter(p => p.status === 'complete').length,
      totalPairs: pairOutcomes.length,
    },
  });
});

// ─── Socket.IO ─────────────────────────────────────────────────────────────

io.on('connection', (socket) => {
  socket.on('join_session', ({ sessionId, role }) => {
    if (role === 'instructor') {
      socket.join('instructor-' + sessionId);
    } else {
      socket.join(sessionId);
    }
  });

  socket.on('disconnect', () => {
    // Handle cleanup if needed
  });
});

// ─── Server Start ──────────────────────────────────────────────────────────

server.listen(PORT, () => {
  console.log(`\n🍷 Notte Bellamonte Simulation Server`);
  console.log(`📍 http://localhost:${PORT}`);
  console.log(`🎓 Instructor: http://localhost:${PORT}/instructor.html`);
  console.log(`👥 Students:  http://localhost:${PORT}/student.html\n`);
});

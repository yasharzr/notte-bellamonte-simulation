/**
 * Notte Bellamonte Three-Phase Classroom Simulation
 * Phase 1: Legal Framework Voting (Oppression vs Dissolution)
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

// ─── Character Data ───────────────────────────────────────────────────────

const CHARACTER_DATA = {
  lucia: {
    name: 'Lucia Bellamonte',
    tagline: 'I helped build this legacy for 30 years, and I won\'t be pushed aside by my own nephew.',
    position: 'Marco is executing a "squeeze-out" by unilaterally increasing his salary, cutting the routine dividends I rely on, and slandering my reputation to our clients. This is not a simple deadlock; it is oppressive conduct that violates my reasonable expectations as an equal 50/50 owner.',
    goal: 'I\'ve filed an application under CBCA s. 241 for an oppression remedy to restore fair governance and protect my brother\'s legacy. If we cannot reconcile, I want a structured buyout rather than the "nuclear" dissolution Marco wants, which would destroy the winery\'s value.',
    strengths: 'I have 30 years of credibility and brand history with the vineyard. My plan is stable and responsible: I have proposed reinvesting profits into the land and cutting executive pay, including my own, to ensure long-term health.',
    weaknesses: 'Marco handles day-to-day operations, giving him more control over the business narrative. Without a shareholder agreement or tie-breaking mechanism, my refusal to go public can be framed as the cause of the company\'s paralysis.',
    secrets: [
      { label: 'True Intentions', text: 'Marco thinks I\'ll never sell because I care about the family legacy. That\'s not true. I will sell if the price is fair, but I won\'t let him use threats of dissolution to force a discount. My oppression claim is real, but I\'m also using it for leverage so the court sees this as a squeeze-out, not just "deadlock." I also suspect Marco is bluffing about actually wanting to destroy Notte, and I plan to call that bluff if he tries to scare me into giving up control.' },
      { label: 'Buying Price', text: 'If I were to buy his shares, I am willing to spend up to $4.35 million to acquire Marco\'s 50%. I can finance this through a lender and family backing, but it is conditional on keeping the company private and closing quickly.' },
      { label: 'Selling Price', text: 'If I were to sell my shares, my minimum is $4.9 million. I will not accept a deadlock discount just because Marco is making threats. I value the company at roughly $10 million, but I also know the vineyard needs near-term repairs and stabilizing operations, which is why I have a hard ceiling on what I can pay to buy him out.' },
    ],
    floorSell: 4900000,
    ceilingBuy: 4350000,
  },
  marco: {
    name: 'Marco Bellamonte',
    tagline: 'I\'m glad you chose the only correct side in this dispute, because there\'s no way I\'m in the wrong.',
    position: 'Lucia is getting in the way of my plans to make Notte Bellamonte Inc a revitalized success. She is the reason for this deadlock. If she won\'t step down, I would rather let the business dissolve than let her waste my time any longer.',
    goal: 'I filed an application under s. 214 of the CBCA because I want an equitable dissolution of the company. I would rather take my losses now than let Lucia cause more damage. Lucia is preventing me from making vital business operation decisions. I can start anew anyways, family legacy is of no concern to me.',
    strengths: 'I am handling the day-to-day operations of the company. I am trying to grow the company, not stagnate, which is why I think going public is the best idea. That way, production will grow larger and we will be able to expand and become bigger than ever before. I believe I have the best interests of the corporation at heart.',
    weaknesses: 'What I wanted to do with the company is different from how the company has operated over the last several decades, so other peoples\' expectations are not being met. Although I personally wouldn\'t consider this a weakness, some would argue that my pay package increase (which can be done without majority approval) and my lack of declaring dividends is a weakness. In my humble opinion, I did not declare dividends for Lucia because that money is better used for the expansion of the company, after all, money does not grow on trees.',
    secrets: [
      { label: 'The Bluff', text: 'I am merely using equitable dissolution as a bluff. Truthfully, I hope my willingness to destroy this company makes Lucia scared enough to back off and give me control of the company. I figured if I simply tried to buy her shares outright, she might resist, but if I threatened to dissolve the company itself, she might be willing to concede her shares to me. If the court does not decide on equitable dissolution, I am fine with that as long as the court does not deem my conduct to be oppressive.' },
      { label: 'Buying Price', text: 'If I were to buy her shares, I am willing to spend up to $4.25 million to acquire her shares. I have financial backing from outside investors who are interested in my grand plan to expand the company. Given the company\'s likely worth around $10 million, Lucia may expect $5 million for her shares, which is why I want to threaten her with equitable dissolution in hopes of Lucia willing to accept a lower price.' },
      { label: 'Cash Position', text: 'Between personal funds and investor commitments, I have access to up to $4.5 million for this acquisition.' },
    ],
    floorSell: 4250000,
    ceilingBuy: 4250000,
  },
};

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
      timedAuctionStartPrice: 5000000,
      timedAuctionDropPerSecond: 25000,
      ...config
    },
    phase: 'lobby', // lobby -> phase_1_debate -> phase_2_remedy -> phase_3_buysell -> complete
    participants: [],
    roleCounter: 0,

    // Phase 1: Legal Framework Voting
    phase1Votes: new Map(),
    phase1Results: { oppression: 0, dissolution: 0, revealed: false },

    // Phase 2: Remedy Selection Voting
    phase2Votes: new Map(),
    phase2Results: { dissolution: 0, shotgun: 0, openmarket: 0, revealed: false, winningRemedy: null },

    // Phase 3: Buy-Sell Execution
    buysellPairs: [],
    buysellMode: 'shotgun',

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

  const isInstructor = req.query.role === 'instructor';

  res.json({
    id: s.id,
    phase: s.phase,
    config: s.config,
    participants: s.participants.map(p => ({ id: p.id, name: p.name, role: p.role, status: p.status })),
    participantCount: s.participants.length,
    lucias: s.participants.filter(p => p.role === 'lucia').length,
    marcos: s.participants.filter(p => p.role === 'marco').length,

    phase1Results: s.phase1Results,
    phase1Votes: isInstructor ? Array.from(s.phase1Votes.values()) : [],

    phase2Results: s.phase2Results,
    phase2Votes: isInstructor ? Array.from(s.phase2Votes.values()) : [],

    buysellPairs: s.buysellPairs,
    buysellMode: s.buysellMode,
  });
});

app.post('/api/session/:id/join', (req, res) => {
  const s = sessions.get(req.params.id);
  if (!s) return res.status(404).json({ error: 'Session not found' });

  const { name } = req.body;

  // Assign role at join time (alternating lucia/marco)
  const role = s.roleCounter % 2 === 0 ? 'lucia' : 'marco';
  s.roleCounter++;

  const participant = {
    id: Math.random().toString(36).slice(2, 10),
    name,
    role,
    status: 'active',
    lastSeen: Date.now(),
    joinedAt: Date.now(),
  };
  s.participants.push(participant);

  io.to(s.id).emit('participant_joined', { name, count: s.participants.length, role });

  res.json({ participantId: participant.id, sessionId: s.id, role });
});

// Reconnect
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

// Character data endpoint — only returns data for the participant's own role
app.get('/api/session/:id/character/:participantId', (req, res) => {
  const s = sessions.get(req.params.id);
  if (!s) return res.status(404).json({ error: 'Session not found' });

  const participant = s.participants.find(p => p.id === req.params.participantId);
  if (!participant) return res.status(404).json({ error: 'Participant not found' });
  if (!participant.role) return res.status(400).json({ error: 'No role assigned yet' });

  const data = CHARACTER_DATA[participant.role];
  res.json({ role: participant.role, character: data });
});

// PHASE 1: Vote on legal framework
app.post('/api/session/:id/vote-phase1', (req, res) => {
  const s = sessions.get(req.params.id);
  if (!s) return res.status(404).json({ error: 'Session not found' });
  if (s.phase !== 'phase_1_debate') return res.status(400).json({ error: 'Not in phase 1' });

  const { participantId, choice } = req.body;
  if (!['oppression', 'dissolution'].includes(choice)) {
    return res.status(400).json({ error: 'Invalid choice' });
  }

  const participant = s.participants.find(p => p.id === participantId);
  if (!participant) return res.status(400).json({ error: 'Participant not found' });

  s.phase1Votes.set(participantId, { choice, submittedAt: Date.now(), name: participant.name });

  io.to('instructor-' + s.id).emit('phase1_vote_update', {
    votesSubmitted: s.phase1Votes.size,
    votesExpected: s.participants.length,
    counts: tallyVotes(s.phase1Votes, ['oppression', 'dissolution']),
  });

  res.json({ ok: true });
});

// PHASE 1: Reveal results
app.post('/api/session/:id/reveal-phase1', (req, res) => {
  const s = sessions.get(req.params.id);
  if (!s) return res.status(404).json({ error: 'Session not found' });

  s.phase1Results.revealed = true;
  s.phase1Results = {
    ...tallyVotes(s.phase1Votes, ['oppression', 'dissolution']),
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
  if (!['dissolution', 'shotgun', 'openmarket'].includes(remedy)) {
    return res.status(400).json({ error: 'Invalid remedy' });
  }

  const participant = s.participants.find(p => p.id === participantId);
  if (!participant) return res.status(400).json({ error: 'Participant not found' });

  s.phase2Votes.set(participantId, { remedy, submittedAt: Date.now(), name: participant.name });

  io.to('instructor-' + s.id).emit('phase2_vote_update', {
    votesSubmitted: s.phase2Votes.size,
    votesExpected: s.participants.length,
    counts: tallyVotes(s.phase2Votes, ['dissolution', 'shotgun', 'openmarket'], 'remedy'),
  });

  res.json({ ok: true });
});

// PHASE 2: Reveal results
app.post('/api/session/:id/reveal-phase2', (req, res) => {
  const s = sessions.get(req.params.id);
  if (!s) return res.status(404).json({ error: 'Session not found' });

  const counts = tallyVotes(s.phase2Votes, ['dissolution', 'shotgun', 'openmarket'], 'remedy');
  const winningRemedy = getWinningRemedy(counts);

  s.phase2Results = {
    ...counts,
    revealed: true,
    winningRemedy,
    allVotes: Array.from(s.phase2Votes.values()).map(v => ({ name: v.name, remedy: v.remedy })),
  };

  // For now, all pairs use shotgun mechanism regardless of vote
  s.buysellMode = 'shotgun';

  io.to(s.id).emit('phase2_revealed', s.phase2Results);
  res.json(s.phase2Results);
});

// PHASE 3: Mechanism vote per pair
app.post('/api/session/:id/buysell/:pairId/vote-mechanism', (req, res) => {
  const s = sessions.get(req.params.id);
  if (!s) return res.status(404).json({ error: 'Session not found' });

  const pair = s.buysellPairs.find(p => p.pairId === req.params.pairId);
  if (!pair) return res.status(404).json({ error: 'Pair not found' });

  const { participantId, mechanism } = req.body;
  if (!['shotgun', 'timedauction'].includes(mechanism)) {
    return res.status(400).json({ error: 'Invalid mechanism' });
  }

  pair.mechanismVotes[participantId] = mechanism;

  // Notify partner that a vote was cast
  io.to(s.id).emit('mechanism_vote_cast', { pairId: pair.pairId, participantId });

  // Check if both have voted
  const voteA = pair.mechanismVotes[pair.partnerA.id];
  const voteB = pair.mechanismVotes[pair.partnerB.id];

  if (voteA && voteB) {
    if (voteA === voteB) {
      pair.chosenMechanism = voteA;
      pair.mechanismAgreed = true;
    } else {
      pair.chosenMechanism = Math.random() < 0.5 ? 'shotgun' : 'timedauction';
      pair.mechanismAgreed = false;
    }
    pair.status = 'waiting_for_offer';

    io.to(s.id).emit('mechanism_decided', {
      pairId: pair.pairId,
      chosenMechanism: pair.chosenMechanism,
      agreed: pair.mechanismAgreed,
      voteA,
      voteB,
    });
  }

  res.json({ ok: true });
});

// PHASE 3: Form buy-sell pairs (standalone endpoint)
app.post('/api/session/:id/form-buysell-pairs', (req, res) => {
  const s = sessions.get(req.params.id);
  if (!s) return res.status(404).json({ error: 'Session not found' });
  if (s.phase !== 'phase_3_buysell') return res.status(400).json({ error: 'Not in phase 3' });

  // Roles already assigned at join time
  const active = s.participants.filter(p => p.status === 'active');
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
      status: 'choosing_mechanism',
      mechanismVotes: {},
      chosenMechanism: null,
      mechanismAgreed: null,
      shotgunOffer: null,
      shotgunOfferorId: null,
      shotgunChoice: null,
      finalPrice: null,
      timedAuctionLockedPrice: null,
      timedAuctionLockedBy: null,
      timedAuctionReady: {},
      timedAuctionStartTime: null,
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

  io.to(s.id).emit('shotgun_offer_made', { pairId: pair.pairId, price, offerorId: participantId });
  res.json({ ok: true });
});

// PHASE 3: Shotgun response
app.post('/api/session/:id/buysell/:pairId/respond', (req, res) => {
  const s = sessions.get(req.params.id);
  if (!s) return res.status(404).json({ error: 'Session not found' });

  const pair = s.buysellPairs.find(p => p.pairId === req.params.pairId);
  if (!pair) return res.status(404).json({ error: 'Pair not found' });

  const { choice, participantId } = req.body;
  pair.shotgunChoice = choice;
  pair.finalPrice = pair.shotgunOffer;
  pair.responderId = participantId;
  pair.status = 'complete';

  // Determine buyer/seller
  if (choice === 'buy') {
    pair.buyer = participantId;
    pair.seller = pair.shotgunOfferorId;
  } else {
    pair.buyer = pair.shotgunOfferorId;
    pair.seller = participantId;
  }

  const responderName = participantId === pair.partnerA.id ? pair.partnerA.name : pair.partnerB.name;
  const offerorName = pair.shotgunOfferorId === pair.partnerA.id ? pair.partnerA.name : pair.partnerB.name;

  const remedy = choice === 'buy'
    ? `${responderName} bought ${offerorName}'s shares at $${pair.finalPrice.toLocaleString()}`
    : `${responderName} sold their shares to ${offerorName} at $${pair.finalPrice.toLocaleString()}`;

  io.to(s.id).emit('buysell_complete', { pairId: pair.pairId, remedy, choice, finalPrice: pair.finalPrice });
  res.json({ ok: true, remedy });
});

// PHASE 3: Timed auction ready signal (both must click Begin)
app.post('/api/session/:id/buysell/:pairId/timed-ready', (req, res) => {
  const s = sessions.get(req.params.id);
  if (!s) return res.status(404).json({ error: 'Session not found' });

  const pair = s.buysellPairs.find(p => p.pairId === req.params.pairId);
  if (!pair) return res.status(404).json({ error: 'Pair not found' });

  const { participantId } = req.body;
  if (!pair.timedAuctionReady) pair.timedAuctionReady = {};
  pair.timedAuctionReady[participantId] = true;

  // Notify partner that this person is ready
  io.to(s.id).emit('timed_auction_partner_ready', { pairId: pair.pairId, participantId });

  // Check if both are ready
  const readyA = pair.timedAuctionReady[pair.partnerA.id];
  const readyB = pair.timedAuctionReady[pair.partnerB.id];

  if (readyA && readyB) {
    pair.timedAuctionStartTime = Date.now();
    io.to(s.id).emit('timed_auction_start', {
      pairId: pair.pairId,
      startTime: pair.timedAuctionStartTime,
      startPrice: s.config.timedAuctionStartPrice,
      dropPerSecond: s.config.timedAuctionDropPerSecond,
    });
  }

  res.json({ ok: true, bothReady: !!(readyA && readyB) });
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

  const { choice, participantId } = req.body;
  pair.shotgunChoice = choice;
  pair.finalPrice = pair.timedAuctionLockedPrice;
  pair.responderId = participantId;
  pair.status = 'complete';

  if (choice === 'buy') {
    pair.buyer = participantId;
    pair.seller = pair.timedAuctionLockedBy === participantId
      ? (participantId === pair.partnerA.id ? pair.partnerB.id : pair.partnerA.id)
      : pair.timedAuctionLockedBy;
  } else {
    pair.seller = participantId;
    pair.buyer = pair.timedAuctionLockedBy === participantId
      ? (participantId === pair.partnerA.id ? pair.partnerB.id : pair.partnerA.id)
      : pair.timedAuctionLockedBy;
  }

  const responderName = participantId === pair.partnerA.id ? pair.partnerA.name : pair.partnerB.name;
  const lockerName = pair.timedAuctionLockedBy === pair.partnerA.id ? pair.partnerA.name : pair.partnerB.name;

  const remedy = choice === 'buy'
    ? `${responderName} bought ${lockerName}'s shares at $${pair.finalPrice.toLocaleString()}`
    : `${responderName} sold their shares to ${lockerName} at $${pair.finalPrice.toLocaleString()}`;

  io.to(s.id).emit('buysell_complete', { pairId: pair.pairId, remedy, choice, finalPrice: pair.finalPrice });
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

  if (nextPhase === 'phase_1_debate') {
    s.phase1Votes.clear();
  } else if (nextPhase === 'phase_2_remedy') {
    s.phase2Votes.clear();
  } else if (nextPhase === 'phase_3_buysell') {
    // Reveal phase 2 results if not already revealed
    if (!s.phase2Results.revealed) {
      const counts = tallyVotes(s.phase2Votes, ['dissolution', 'shotgun', 'openmarket'], 'remedy');
      const winningRemedy = getWinningRemedy(counts);
      s.phase2Results = {
        ...counts,
        revealed: true,
        winningRemedy,
        allVotes: Array.from(s.phase2Votes.values()).map(v => ({ name: v.name, remedy: v.remedy })),
      };
      // For now, all pairs use shotgun mechanism regardless of vote
      s.buysellMode = 'shotgun';
    }

    // Roles already assigned at join time — just form pairs
    const active = s.participants.filter(p => p.status === 'active');
    // Shuffle within each role to randomize pairings
    const lucias = active.filter(p => p.role === 'lucia');
    const marcos = active.filter(p => p.role === 'marco');
    for (let i = lucias.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [lucias[i], lucias[j]] = [lucias[j], lucias[i]];
    }
    for (let i = marcos.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [marcos[i], marcos[j]] = [marcos[j], marcos[i]];
    }

    const pairCount = Math.min(lucias.length, marcos.length);
    s.buysellPairs = [];
    for (let i = 0; i < pairCount; i++) {
      const pairId = 'pair-' + Math.random().toString(36).slice(2, 8);
      s.buysellPairs.push({
        pairId,
        partnerA: { id: lucias[i].id, name: lucias[i].name, role: 'Lucia' },
        partnerB: { id: marcos[i].id, name: marcos[i].name, role: 'Marco' },
        status: 'waiting_for_offer',
        mechanismVotes: {},
        chosenMechanism: 'shotgun',
        mechanismAgreed: true,
        shotgunOffer: null,
        shotgunOfferorId: null,
        shotgunChoice: null,
        finalPrice: null,
        timedAuctionLockedPrice: null,
        timedAuctionLockedBy: null,
        timedAuctionReady: {},
        timedAuctionStartTime: null,
      });
    }
  }

  io.to(s.id).emit('phase_changed', { phase: nextPhase });
  res.json({ phase: nextPhase });
});

// ─── Analytics endpoint ────────────────────────────────────────────────────

app.get('/api/session/:id/analytics', (req, res) => {
  const s = sessions.get(req.params.id);
  if (!s) return res.status(404).json({ error: 'Session not found' });

  const phase1Counts = tallyVotes(s.phase1Votes, ['oppression', 'dissolution']);
  const phase2Counts = tallyVotes(s.phase2Votes, ['dissolution', 'shotgun', 'openmarket'], 'remedy');

  // Build pair outcomes with mechanism data
  const pairOutcomes = s.buysellPairs.map(p => {
    const buyerParticipant = p.buyer ? s.participants.find(pp => pp.id === p.buyer) : null;
    const sellerParticipant = p.seller ? s.participants.find(pp => pp.id === p.seller) : null;

    return {
      pairId: p.pairId,
      partnerA: p.partnerA.name,
      partnerARole: p.partnerA.role,
      partnerB: p.partnerB.name,
      partnerBRole: p.partnerB.role,
      chosenMechanism: p.chosenMechanism,
      mechanismAgreed: p.mechanismAgreed,
      mechanismVoteA: p.mechanismVotes[p.partnerA.id] || null,
      mechanismVoteB: p.mechanismVotes[p.partnerB.id] || null,
      offer: p.shotgunOffer || p.timedAuctionLockedPrice,
      choice: p.shotgunChoice,
      finalPrice: p.finalPrice,
      status: p.status,
      buyerName: buyerParticipant ? buyerParticipant.name : null,
      buyerRole: buyerParticipant ? buyerParticipant.role : null,
      sellerName: sellerParticipant ? sellerParticipant.name : null,
      sellerRole: sellerParticipant ? sellerParticipant.role : null,
    };
  });

  // Price stats
  const prices = pairOutcomes.filter(p => p.finalPrice).map(p => p.finalPrice);
  const priceStats = {};
  if (prices.length > 0) {
    const sorted = [...prices].sort((a, b) => a - b);
    priceStats.min = sorted[0];
    priceStats.max = sorted[sorted.length - 1];
    priceStats.avg = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length);
    priceStats.median = sorted.length % 2 === 0
      ? Math.round((sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2)
      : sorted[Math.floor(sorted.length / 2)];
  }

  // Mechanism stats
  const mechanismStats = {
    shotgunCount: pairOutcomes.filter(p => p.chosenMechanism === 'shotgun').length,
    timedAuctionCount: pairOutcomes.filter(p => p.chosenMechanism === 'timedauction').length,
    agreedCount: pairOutcomes.filter(p => p.mechanismAgreed === true).length,
    disagreedCount: pairOutcomes.filter(p => p.mechanismAgreed === false).length,
  };

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
      pairs: pairOutcomes,
      completedPairs: pairOutcomes.filter(p => p.status === 'complete').length,
      totalPairs: pairOutcomes.length,
      priceStats,
      mechanismStats,
      luciaFloorSell: CHARACTER_DATA.lucia.floorSell,
      luciaCeilingBuy: CHARACTER_DATA.lucia.ceilingBuy,
      marcoFloorSell: CHARACTER_DATA.marco.floorSell,
      marcoCeilingBuy: CHARACTER_DATA.marco.ceilingBuy,
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

// Global state
let socket;
let sessionId = null;
let currentPhase = 'lobby';
let sessionData = {};

// Initialize
window.addEventListener('DOMContentLoaded', () => {
  socket = io();

  socket.on('phase_changed', (data) => {
    loadSession();
  });

  socket.on('phase1_vote_update', (data) => {
    updatePhase1Display(data);
  });

  socket.on('phase2_vote_update', (data) => {
    updatePhase2Display(data);
  });

  socket.on('participant_joined', (data) => {
    loadSession();
  });

  // Check if session ID is in URL
  const params = new URLSearchParams(window.location.search);
  const urlSessionId = params.get('session');
  if (urlSessionId) {
    sessionId = urlSessionId;
    socket.emit('join_session', { sessionId, role: 'instructor' });
    loadSession();
    document.getElementById('createSessionCard').classList.add('hidden');
  }
});

// ─── SESSION CREATION ──────────────────────────────────────────────

function createSession() {
  fetch('/api/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ config: {} }),
  })
    .then(res => res.json())
    .then(data => {
      sessionId = data.sessionId;
      socket.emit('join_session', { sessionId, role: 'instructor' });

      document.getElementById('createSessionCard').classList.add('hidden');

      // Copy session ID to clipboard and show instructions
      navigator.clipboard.writeText(sessionId);
      alert(`✓ Session created!\n\nSession ID: ${sessionId}\n\n(Copied to clipboard)\n\nShare this ID with students.\nStudent URL: http://localhost:3040/student.html`);

      loadSession();
    })
    .catch(err => {
      document.getElementById('createError').textContent = 'Error: ' + err.message;
      document.getElementById('createError').style.display = 'block';
    });
}

// ─── LOAD & RENDER SESSION ────────────────────────────────────────

function loadSession() {
  if (!sessionId) return;

  fetch(`/api/session/${sessionId}?role=instructor`)
    .then(res => res.json())
    .then(data => {
      sessionData = data;
      currentPhase = data.phase;
      renderDashboard();
    })
    .catch(err => console.error('Load error:', err));
}

function renderDashboard() {
  // Update header
  document.getElementById('sessionDisplay').textContent = sessionId;
  document.getElementById('participantCount').textContent = sessionData.participants.length;
  document.getElementById('phaseDisplay').textContent = currentPhase.toUpperCase();

  const phaseLabels = {
    lobby: 'Lobby (Waiting)',
    phase_1_debate: 'Phase 1: Legal Framework Vote',
    phase_2_remedy: 'Phase 2: Remedy Selection Vote',
    phase_3_buysell: 'Phase 3: Buy-Sell Execution',
    complete: 'Complete',
  };

  document.getElementById('currentPhaseLabel').textContent = phaseLabels[currentPhase] || 'Unknown';

  // Update advance button
  const nextPhases = {
    lobby: 'phase_1_debate',
    phase_1_debate: 'phase_2_remedy',
    phase_2_remedy: 'phase_3_buysell',
    phase_3_buysell: 'complete',
    complete: null,
  };
  const nextPhase = nextPhases[currentPhase];
  const advBtn = document.getElementById('advanceBtn');
  if (nextPhase) {
    advBtn.textContent = 'Advance to ' + (phaseLabels[nextPhase] || 'Next Phase');
    advBtn.disabled = false;
  } else {
    advBtn.textContent = 'Simulation Complete';
    advBtn.disabled = true;
  }

  // Show/hide phase cards
  document.getElementById('phase1Card').classList.add('hidden');
  document.getElementById('phase2Card').classList.add('hidden');
  document.getElementById('phase3Card').classList.add('hidden');

  if (currentPhase === 'phase_1_debate') {
    document.getElementById('phase1Card').classList.remove('hidden');
    renderPhase1();
  } else if (currentPhase === 'phase_2_remedy') {
    document.getElementById('phase2Card').classList.remove('hidden');
    renderPhase2();
  } else if (currentPhase === 'phase_3_buysell') {
    document.getElementById('phase3Card').classList.remove('hidden');
    renderPhase3();
  }
}

// ─── PHASE 1 RENDERING ────────────────────────────────────────────

function renderPhase1() {
  const phase1Data = sessionData.phase1Results || { oppression: 0, dissolution: 0, partnership: 0, revealed: false };

  // Update vote counts
  document.getElementById('phase1VoteCount').textContent = `${sessionData.phase1Votes.length} / ${sessionData.participants.length}`;

  document.getElementById('oppression-count').textContent = phase1Data.oppression;
  document.getElementById('dissolution-count').textContent = phase1Data.dissolution;
  document.getElementById('partnership-count').textContent = phase1Data.partnership;

  if (phase1Data.revealed) {
    document.getElementById('phase1VotingInProgress').classList.add('hidden');
    document.getElementById('phase1VotesRevealed').classList.remove('hidden');
    renderPhase1Details(phase1Data.allVotes || []);
  } else {
    document.getElementById('phase1VotingInProgress').classList.remove('hidden');
    document.getElementById('phase1VotesRevealed').classList.add('hidden');
  }
}

function renderPhase1Details(votes) {
  const tbody = document.getElementById('phase1VoteDetails');
  tbody.innerHTML = votes.map(v => `
    <tr>
      <td>${v.name}</td>
      <td><strong>${v.choice.charAt(0).toUpperCase() + v.choice.slice(1)}</strong></td>
    </tr>
  `).join('');
}

function revealPhase1() {
  fetch(`/api/session/${sessionId}/reveal-phase1`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  })
    .then(res => res.json())
    .then(data => {
      loadSession();
    })
    .catch(err => console.error('Reveal error:', err));
}

function updatePhase1Display(data) {
  document.getElementById('phase1VoteCount').textContent = `${data.votesSubmitted} / ${data.votesExpected}`;
  document.getElementById('oppression-count').textContent = data.counts.oppression;
  document.getElementById('dissolution-count').textContent = data.counts.dissolution;
  document.getElementById('partnership-count').textContent = data.counts.partnership;
}

// ─── PHASE 2 RENDERING ────────────────────────────────────────────

function renderPhase2() {
  const phase2Data = sessionData.phase2Results || { buyout: 0, shotgun: 0, timedauction: 0, liquidation: 0, revealed: false };

  document.getElementById('phase2VoteCount').textContent = `${sessionData.phase2Votes.length} / ${sessionData.participants.length}`;

  document.getElementById('buyout-count').textContent = phase2Data.buyout;
  document.getElementById('shotgun-count').textContent = phase2Data.shotgun;
  document.getElementById('timedauction-count').textContent = phase2Data.timedauction;
  document.getElementById('liquidation-count').textContent = phase2Data.liquidation;

  if (phase2Data.winningRemedy) {
    document.getElementById('phase2Winner').classList.remove('hidden');
    const remedyLabels = {
      buyout: 'Buyout',
      shotgun: 'Shotgun Mechanism',
      timedauction: 'Timed Auction',
      liquidation: 'Liquidation',
    };
    document.getElementById('winnerDisplay').textContent = remedyLabels[phase2Data.winningRemedy] || phase2Data.winningRemedy;
  }

  if (phase2Data.revealed) {
    document.getElementById('phase2VotingInProgress').classList.add('hidden');
    document.getElementById('phase2VotesRevealed').classList.remove('hidden');
    renderPhase2Details(phase2Data.allVotes || []);
  } else {
    document.getElementById('phase2VotingInProgress').classList.remove('hidden');
    document.getElementById('phase2VotesRevealed').classList.add('hidden');
  }
}

function renderPhase2Details(votes) {
  const tbody = document.getElementById('phase2VoteDetails');
  const labels = {
    buyout: 'Buyout',
    shotgun: 'Shotgun',
    timedauction: 'Timed Auction',
    liquidation: 'Liquidation',
  };
  tbody.innerHTML = votes.map(v => `
    <tr>
      <td>${v.name}</td>
      <td><strong>${labels[v.remedy] || v.remedy}</strong></td>
    </tr>
  `).join('');
}

function revealPhase2() {
  fetch(`/api/session/${sessionId}/reveal-phase2`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  })
    .then(res => res.json())
    .then(data => {
      loadSession();
    })
    .catch(err => console.error('Reveal error:', err));
}

function updatePhase2Display(data) {
  document.getElementById('phase2VoteCount').textContent = `${data.votesSubmitted} / ${data.votesExpected}`;
  document.getElementById('buyout-count').textContent = data.counts.buyout;
  document.getElementById('shotgun-count').textContent = data.counts.shotgun;
  document.getElementById('timedauction-count').textContent = data.counts.timedauction;
  document.getElementById('liquidation-count').textContent = data.counts.liquidation;
}

// ─── PHASE 3 RENDERING ────────────────────────────────────────────

function renderPhase3() {
  const pairs = sessionData.buysellPairs || [];
  document.getElementById('pairCount').textContent = pairs.length;

  const container = document.getElementById('buysellPairsContainer');
  if (pairs.length === 0) {
    container.innerHTML = '<p style="color: #aaa; font-size: 13px;">Forming pairs... This will be populated once Phase 2 voting is revealed.</p>';
    return;
  }

  container.innerHTML = pairs.map(p => {
    const statusLabel = p.status === 'complete' ? '✓ Complete' : p.status.replace(/_/g, ' ').toUpperCase();
    const isComplete = p.status === 'complete';
    const remedyText = p.finalPrice ? `${p.shotgunChoice === 'buy' ? p.partnerB.name : p.partnerA.name} ${p.shotgunChoice === 'buy' ? 'bought' : 'sold'} at $${p.finalPrice.toLocaleString()}` : '--';

    return `
      <div class="pair-row ${isComplete ? 'complete' : ''}">
        <div class="pair-names">
          <strong>${p.partnerA.name}</strong> vs <strong>${p.partnerB.name}</strong>
        </div>
        <div>Offer: $${p.shotgunOffer ? p.shotgunOffer.toLocaleString() : '--'}</div>
        <div>Choice: ${p.shotgunChoice || '--'}</div>
        <div>Final: ${remedyText}</div>
        <div class="status">${statusLabel}</div>
      </div>
    `;
  }).join('');
}

// ─── PHASE ADVANCEMENT ────────────────────────────────────────────

function advancePhase() {
  if (!sessionId || !confirm('Advance to next phase? Make sure all votes are collected.')) return;

  fetch(`/api/session/${sessionId}/advance-phase`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  })
    .then(res => res.json())
    .then(data => {
      loadSession();
    })
    .catch(err => {
      alert('Error advancing phase: ' + err.message);
    });
}

// Auto-reload dashboard every 2 seconds
setInterval(() => {
  if (sessionId && currentPhase !== 'lobby') {
    loadSession();
  }
}, 2000);

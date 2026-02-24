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
    console.log('Participant joined:', data);
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
  const phaseBadgeLabels = {
    lobby: 'LOBBY',
    phase_1_debate: 'PHASE 1',
    phase_2_remedy: 'PHASE 2',
    phase_3_buysell: 'PHASE 3',
    complete: 'COMPLETE',
  };
  document.getElementById('phaseDisplay').textContent = phaseBadgeLabels[currentPhase] || currentPhase.toUpperCase();

  // Show analytics button
  const analyticsBtn = document.getElementById('analyticsBtn');
  if (analyticsBtn) analyticsBtn.style.display = 'inline-block';

  // Role counts (visible from lobby onwards since roles assigned at join)
  const lucias = sessionData.lucias || 0;
  const marcos = sessionData.marcos || 0;
  const roleItem = document.getElementById('roleCountItem');
  if (sessionData.participants && sessionData.participants.length > 0) {
    roleItem.classList.remove('hidden');
    document.getElementById('roleCountDisplay').textContent = lucias + ' / ' + marcos;
  } else {
    roleItem.classList.add('hidden');
  }

  // Participant list
  renderParticipantList();

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

// ─── PARTICIPANT LIST ─────────────────────────────────────────────

function renderParticipantList() {
  const card = document.getElementById('participantListCard');
  const container = document.getElementById('participantList');
  if (!sessionData.participants || sessionData.participants.length === 0) {
    card.classList.add('hidden');
    return;
  }
  card.classList.remove('hidden');

  container.innerHTML = sessionData.participants.map(p => {
    if (p.role) {
      const isLucia = p.role === 'lucia';
      const bg = isLucia ? '#d4af37' : '#7c8a9e';
      const color = isLucia ? '#000' : '#fff';
      const roleLabel = isLucia ? 'Lucia' : 'Marco';
      return `<span style="padding:6px 12px; background:${bg}; color:${color}; border-radius:20px; font-size:12px; font-weight:600;">${p.name} (${roleLabel})</span>`;
    }
    return `<span style="padding:6px 12px; background:#4a5a6a; color:#fff; border-radius:20px; font-size:12px; font-weight:600;">${p.name}</span>`;
  }).join('');
}

// ─── PHASE 1 RENDERING ────────────────────────────────────────────

function renderPhase1() {
  const phase1Data = sessionData.phase1Results || { oppression: 0, dissolution: 0, revealed: false };

  // Update vote counts
  document.getElementById('phase1VoteCount').textContent = `${sessionData.phase1Votes.length} / ${sessionData.participants.length}`;

  document.getElementById('oppression-count').textContent = phase1Data.oppression;
  document.getElementById('dissolution-count').textContent = phase1Data.dissolution;

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
}

// ─── PHASE 2 RENDERING ────────────────────────────────────────────

function renderPhase2() {
  const phase2Data = sessionData.phase2Results || { dissolution: 0, shotgun: 0, openmarket: 0, revealed: false };

  document.getElementById('phase2VoteCount').textContent = `${sessionData.phase2Votes.length} / ${sessionData.participants.length}`;

  document.getElementById('dissolution2-count').textContent = phase2Data.dissolution;
  document.getElementById('shotgun-count').textContent = phase2Data.shotgun;
  document.getElementById('openmarket-count').textContent = phase2Data.openmarket;

  if (phase2Data.winningRemedy) {
    document.getElementById('phase2Winner').classList.remove('hidden');
    const remedyLabels = {
      dissolution: 'Equitable Dissolution',
      shotgun: 'Shotgun Sale',
      openmarket: 'Open Market Sale',
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
    dissolution: 'Equitable Dissolution',
    shotgun: 'Shotgun Sale',
    openmarket: 'Open Market Sale',
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
  document.getElementById('dissolution2-count').textContent = data.counts.dissolution;
  document.getElementById('shotgun-count').textContent = data.counts.shotgun;
  document.getElementById('openmarket-count').textContent = data.counts.openmarket;
}

// ─── PHASE 3 RENDERING ────────────────────────────────────────────

function renderPhase3() {
  const pairs = sessionData.buysellPairs || [];
  document.getElementById('pairCount').textContent = pairs.length;

  const container = document.getElementById('buysellPairsContainer');
  if (pairs.length === 0) {
    container.innerHTML = '<p style="color: #aaa; font-size: 13px;">Forming pairs... This will be populated once Phase 2 voting is revealed.</p>';
    document.getElementById('liveShotgunContainer').classList.add('hidden');
    return;
  }

  container.innerHTML = pairs.map(p => {
    let statusLabel;
    if (p.status === 'complete') statusLabel = '✓ Complete';
    else if (p.status === 'waiting_for_offer') statusLabel = 'Waiting for Offer';
    else if (p.status === 'offered') statusLabel = 'Offer Made';
    else statusLabel = p.status.replace(/_/g, ' ').toUpperCase();

    const isComplete = p.status === 'complete';

    // Mechanism info
    let mechInfo = '<div style="font-size:11px; color:#d4af37;">Shotgun</div>';

    const priceInfo = p.finalPrice ? `$${p.finalPrice.toLocaleString()}` : (p.shotgunOffer ? `Offer: $${p.shotgunOffer.toLocaleString()}` : '--');
    const choiceInfo = p.shotgunChoice ? (p.shotgunChoice === 'buy' ? 'BUY' : 'SELL') : '--';

    return `
      <div class="pair-row ${isComplete ? 'complete' : ''}">
        <div class="pair-names">
          <strong>${p.partnerA.name}</strong> (Lucia) vs <strong>${p.partnerB.name}</strong> (Marco)
        </div>
        ${mechInfo}
        <div>Price: ${priceInfo}</div>
        <div>Choice: ${choiceInfo}</div>
        <div class="status">${statusLabel}</div>
      </div>
    `;
  }).join('');

  // Show live shotgun sale display
  renderLiveShotgunSale(pairs);
}

function renderLiveShotgunSale(pairs) {
  const activePair = pairs.find(p => p.status !== 'complete');

  if (!activePair) {
    document.getElementById('liveShotgunContainer').classList.add('hidden');
    return;
  }

  document.getElementById('liveShotgunContainer').classList.remove('hidden');

  if (activePair.status === 'waiting_for_offer') {
    document.getElementById('shotgunLiveContent').innerHTML = `
      <div style="text-align: center; padding: 30px;">
        <p style="font-size: 16px; color: #aaa; margin-bottom: 20px;">Waiting for offeror to set price...</p>
        <div style="font-size: 14px; color: #d4af37;">
          <strong>${activePair.partnerA.name}</strong> (Offeror) ⚔️ <strong>${activePair.partnerB.name}</strong> (Offeree)
        </div>
      </div>
    `;
  } else if (activePair.status === 'offered') {
    document.getElementById('shotgunLiveContent').innerHTML = `
      <div style="text-align: center; padding: 30px;">
        <div style="font-size: 48px; font-weight: bold; color: #d4af37; margin: 20px 0;">$${activePair.shotgunOffer.toLocaleString()}</div>
        <p style="font-size: 14px; color: #aaa; margin-bottom: 20px;">Offeror: <strong style="color: #fff;">${activePair.partnerA.name}</strong></p>
        <p style="font-size: 18px; color: #fff; margin-bottom: 20px;"><strong>${activePair.partnerB.name}</strong> is choosing...</p>
        <div style="display: flex; gap: 20px; justify-content: center; margin-top: 25px;">
          <div style="padding: 15px 25px; background: rgba(74, 222, 128, 0.2); border: 2px solid #4ade80; border-radius: 6px; color: #4ade80; font-weight: 600;">💰 BUY</div>
          <div style="padding: 15px 25px; background: rgba(248, 113, 113, 0.2); border: 2px solid #f87171; border-radius: 6px; color: #f87171; font-weight: 600;">📊 SELL</div>
        </div>
      </div>
    `;
  } else if (activePair.status === 'complete') {
    const choice = activePair.shotgunChoice === 'buy' ? '💰 BOUGHT' : '📊 SOLD';
    const choiceColor = activePair.shotgunChoice === 'buy' ? '#4ade80' : '#f87171';
    document.getElementById('shotgunLiveContent').innerHTML = `
      <div style="text-align: center; padding: 30px;">
        <div style="font-size: 48px; font-weight: bold; color: #d4af37; margin: 20px 0;">$${activePair.finalPrice.toLocaleString()}</div>
        <p style="font-size: 16px; color: #aaa; margin-bottom: 20px;">
          <strong style="color: #fff;">${activePair.partnerB.name}</strong> chose to <span style="color: ${choiceColor};">${choice}</span>
        </p>
        <div style="padding: 15px; background: #3a3a4e; border-radius: 6px; margin-top: 15px;">
          <p style="font-size: 13px; color: #aaa;">✓ Transaction Complete</p>
        </div>
      </div>
    `;
  }
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

function openAnalytics() {
  if (sessionId) {
    window.open(`/analytics.html?session=${sessionId}`, '_blank');
  }
}

// Auto-reload dashboard every 1 second (to see participant count updates)
setInterval(() => {
  if (sessionId) {
    loadSession();
  }
}, 1000);

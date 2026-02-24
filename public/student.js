// Global state
let socket;
let sessionId;
let participantId;
let userName;
let userRole;
let currentPair = null;
let currentPhase = 'lobby';
let characterData = null;
let p3Stage = null; // tracks which Phase 3 stage we're on
let timedAuctionInterval;
let currentPrice = 5000000;
const STARTING_PRICE = 5000000;
const DROP_PER_SECOND = 25000;

// Initialize on page load
window.addEventListener('DOMContentLoaded', () => {
  socket = io();

  socket.on('phase_changed', (data) => {
    currentPhase = data.phase;
    loadSession();
  });

  socket.on('phase1_vote_update', (data) => updatePhase1VoteCount(data));
  socket.on('phase2_vote_update', (data) => updatePhase2VoteCount(data));
  socket.on('phase1_revealed', (data) => displayPhase1Results(data));
  socket.on('phase2_revealed', (data) => displayPhase2Results(data));

  socket.on('buysell_pairs_formed', (data) => {
    loadSession();
  });

  socket.on('mechanism_vote_cast', (data) => {
    if (currentPair && currentPair.pairId === data.pairId && data.participantId !== participantId) {
      const el = document.getElementById('mechanismPartnerStatus');
      if (el) el.textContent = 'Your partner has voted!';
    }
  });

  socket.on('mechanism_decided', (data) => {
    if (currentPair && currentPair.pairId === data.pairId) {
      currentPair.chosenMechanism = data.chosenMechanism;
      currentPair.mechanismAgreed = data.agreed;
      currentPair.status = 'waiting_for_offer';
      showMechanismResult(data);
    }
  });

  socket.on('shotgun_offer_made', (data) => {
    if (currentPair && currentPair.pairId === data.pairId) {
      currentPair.shotgunOffer = data.price;
      currentPair.shotgunOfferorId = data.offerorId;
      currentPair.status = 'offered';
      // If I'm the offeree, show the offer
      if (data.offerorId !== participantId) {
        showOffereeResponse(data.price);
      }
    }
  });

  socket.on('timed_price_locked', (data) => {
    if (currentPair && currentPair.pairId === data.pairId) {
      clearInterval(timedAuctionInterval);
      currentPair.status = 'waiting_for_final_choice';
      if (data.lockedBy !== participantId) {
        showTimedLockResponse(data.price);
      } else {
        showTimedWaitingForChoice();
      }
    }
  });

  socket.on('timed_auction_partner_ready', (data) => {
    if (currentPair && currentPair.pairId === data.pairId && data.participantId !== participantId) {
      const el = document.getElementById('timedPartnerStatus');
      if (el) el.textContent = 'Your partner is ready!';
    }
  });

  socket.on('timed_auction_start', (data) => {
    if (currentPair && currentPair.pairId === data.pairId) {
      startTimedAuctionClock(data.startTime, data.startPrice, data.dropPerSecond);
    }
  });

  socket.on('buysell_complete', (data) => {
    if (currentPair && currentPair.pairId === data.pairId) {
      currentPair.status = 'complete';
      currentPair.shotgunChoice = data.choice;
      currentPair.finalPrice = data.finalPrice;
      showOutcome(data);
    }
  });

  socket.on('participant_joined', () => loadSession());

  // Auto-reconnect
  const storedSession = sessionStorage.getItem('nb_sessionId');
  const storedPid = sessionStorage.getItem('nb_participantId');
  if (storedSession && storedPid) {
    autoReconnect(storedSession, storedPid);
  }
});

// ─── JOIN SESSION ──────────────────────────────────────────────────

function joinSession() {
  const sessionIdInput = document.getElementById('sessionIdInput').value.trim();
  const nameInput = document.getElementById('nameInput').value.trim();

  if (!sessionIdInput || !nameInput) {
    showLoginError('Please enter session ID and your name');
    return;
  }

  fetch(`/api/session/${sessionIdInput}/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: nameInput }),
  })
    .then(res => res.json())
    .then(data => {
      if (data.error) {
        showLoginError(data.error);
      } else {
        sessionId = data.sessionId;
        participantId = data.participantId;
        userName = nameInput;
        userRole = data.role || null;

        sessionStorage.setItem('nb_sessionId', sessionId);
        sessionStorage.setItem('nb_participantId', participantId);
        sessionStorage.setItem('nb_userName', userName);

        if (userRole) showRoleBadge();

        socket.emit('join_session', { sessionId, role: 'student' });

        document.getElementById('loginScreen').classList.add('hidden');
        document.getElementById('mainApp').classList.remove('hidden');

        loadSession();
      }
    })
    .catch(err => showLoginError('Connection error: ' + err.message));
}

function showLoginError(msg) {
  const el = document.getElementById('loginError');
  el.textContent = msg;
  el.classList.remove('hidden');
}

// ─── AUTO-RECONNECT ─────────────────────────────────────────────────

function autoReconnect(storedSession, storedPid) {
  fetch(`/api/session/${storedSession}/reconnect`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ participantId: storedPid }),
  })
    .then(res => res.json())
    .then(data => {
      if (data.ok) {
        sessionId = data.sessionId;
        participantId = data.participantId;
        userName = data.name;
        userRole = data.role || null;

        socket.emit('join_session', { sessionId, role: 'student' });

        document.getElementById('loginScreen').classList.add('hidden');
        document.getElementById('mainApp').classList.remove('hidden');

        if (userRole) showRoleBadge();
        loadSession();
      } else {
        sessionStorage.removeItem('nb_sessionId');
        sessionStorage.removeItem('nb_participantId');
        sessionStorage.removeItem('nb_userName');
      }
    })
    .catch(() => {
      sessionStorage.removeItem('nb_sessionId');
      sessionStorage.removeItem('nb_participantId');
      sessionStorage.removeItem('nb_userName');
    });
}

function showRoleBadge() {
  const badge = document.getElementById('roleBadge');
  if (!badge || !userRole) return;

  if (userRole === 'lucia') {
    badge.textContent = 'You are LUCIA';
    badge.style.background = '#d4af37';
    badge.style.color = '#000';
  } else {
    badge.textContent = 'You are MARCO';
    badge.style.background = '#7c8a9e';
    badge.style.color = '#fff';
  }
  badge.classList.remove('hidden');
}

// ─── LOAD SESSION STATE ────────────────────────────────────────────

function loadSession() {
  fetch(`/api/session/${sessionId}?role=student`)
    .then(res => res.json())
    .then(data => {
      currentPhase = data.phase;
      renderPhase(data);
    })
    .catch(err => console.error('Load session error:', err));
}

function renderPhase(sessionData) {
  document.getElementById('phase1Container').classList.add('hidden');
  document.getElementById('phase2Container').classList.add('hidden');
  document.getElementById('phase3Container').classList.add('hidden');

  const phaseText = {
    lobby: 'Waiting to start...',
    phase_1_debate: 'Phase 1: Legal Framework Vote',
    phase_2_remedy: 'Phase 2: Remedy Selection Vote',
    phase_3_buysell: 'Phase 3: Buy-Sell Execution',
    complete: 'Simulation Complete',
  };

  document.getElementById('phaseText').textContent = phaseText[currentPhase] || 'Unknown phase';
  const phaseBadgeLabels = {
    lobby: 'LOBBY',
    phase_1_debate: 'PHASE 1',
    phase_2_remedy: 'PHASE 2',
    phase_3_buysell: 'PHASE 3',
    complete: 'COMPLETE',
  };
  document.getElementById('phaseBadge').textContent = phaseBadgeLabels[currentPhase] || currentPhase.toUpperCase();

  if (currentPhase === 'phase_1_debate') {
    document.getElementById('phase1Container').classList.remove('hidden');
  } else if (currentPhase === 'phase_2_remedy') {
    document.getElementById('phase2Container').classList.remove('hidden');
    if (sessionData.phase1Results.revealed) {
      displayPhase1Results(sessionData.phase1Results);
    }
  } else if (currentPhase === 'phase_3_buysell') {
    document.getElementById('phase3Container').classList.remove('hidden');

    // Find my pair
    currentPair = sessionData.buysellPairs.find(
      p => p.partnerA.id === participantId || p.partnerB.id === participantId
    );

    if (!currentPair) {
      hideAllP3Stages();
      document.getElementById('p3Observer').classList.remove('hidden');
      return;
    }

    // Determine which stage to show based on pair status
    if (p3Stage === 'outcome' || currentPair.status === 'complete') {
      if (currentPair.status === 'complete') {
        hideAllP3Stages();
        showOutcome({
          choice: currentPair.shotgunChoice,
          finalPrice: currentPair.finalPrice,
          remedy: '',
        });
      }
    } else if (p3Stage === 'negotiation') {
      // Already in negotiation stage — stay there
    } else if (p3Stage === 'brief') {
      // Already showing briefing
    } else if (p3Stage === 'reveal') {
      // Already showing role reveal
    } else {
      // Fresh entry or reconnect — decide what to show
      if (currentPair.status === 'complete') {
        hideAllP3Stages();
        showOutcome({ choice: currentPair.shotgunChoice, finalPrice: currentPair.finalPrice, remedy: '' });
      } else if (currentPair.status === 'offered' || currentPair.status === 'waiting_for_final_choice') {
        // Reconnect into active negotiation (offer already made)
        p3Stage = 'negotiation';
        hideAllP3Stages();
        showNegotiation();
      } else if (characterData) {
        // Already fetched character data (reconnect case) — go to negotiation
        p3Stage = 'negotiation';
        hideAllP3Stages();
        showNegotiation();
      } else {
        // First time entering Phase 3 — start from role reveal
        showRoleReveal();
      }
    }
  }
}

function hideAllP3Stages() {
  ['p3RoleReveal', 'p3CharacterBrief', 'p3MechanismChoice', 'p3Negotiation', 'p3Outcome', 'p3Observer'].forEach(id => {
    document.getElementById(id).classList.add('hidden');
  });
}

// ─── PHASE 1: VOTING ────────────────────────────────────────────────

function votePhase1(choice) {
  document.querySelectorAll('#phase1Container .vote-btn').forEach(btn => btn.classList.remove('active'));
  event.target.closest('.vote-btn').classList.add('active');

  fetch(`/api/session/${sessionId}/vote-phase1`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ participantId, choice }),
  })
    .then(res => res.json())
    .then(data => {
      if (data.ok) {
        document.getElementById('phase1Submitted').classList.remove('hidden');
        document.querySelectorAll('#phase1Container .vote-btn').forEach(btn => btn.disabled = true);
      }
    })
    .catch(err => {
      document.getElementById('phase1Error').textContent = 'Error: ' + err.message;
      document.getElementById('phase1Error').classList.remove('hidden');
    });
}

function updatePhase1VoteCount(data) {
  const el = document.getElementById('phase1VoteCount');
  if (el) el.textContent = `${data.votesSubmitted} / ${data.votesExpected} have voted`;
}

function displayPhase1Results(results) {
  const { oppression, dissolution } = results;
  document.getElementById('phase1ResultDisplay').innerHTML = `
    <h3>Phase 1 Results</h3>
    <div class="result-item"><span>Oppression (s.241)</span><strong>${oppression} votes</strong></div>
    <div class="result-item"><span>Dissolution (s.214)</span><strong>${dissolution} votes</strong></div>
  `;
}

// ─── PHASE 2: REMEDY VOTING ────────────────────────────────────────

function votePhase2(remedy) {
  document.querySelectorAll('#phase2Container .vote-btn').forEach(btn => btn.classList.remove('active'));
  event.target.closest('.vote-btn').classList.add('active');

  fetch(`/api/session/${sessionId}/vote-phase2`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ participantId, remedy }),
  })
    .then(res => res.json())
    .then(data => {
      if (data.ok) {
        document.getElementById('phase2Submitted').classList.remove('hidden');
        document.querySelectorAll('#phase2Container .vote-btn').forEach(btn => btn.disabled = true);
      }
    })
    .catch(err => {
      document.getElementById('phase2Error').textContent = 'Error: ' + err.message;
      document.getElementById('phase2Error').classList.remove('hidden');
    });
}

function updatePhase2VoteCount(data) {
  const el = document.getElementById('phase2VoteCount');
  if (el) el.textContent = `${data.votesSubmitted} / ${data.votesExpected} have voted`;
}

function displayPhase2Results(results) {
  const { dissolution, shotgun, openmarket, winningRemedy } = results;
  const remedyLabels = { dissolution: 'Equitable Dissolution', shotgun: 'Shotgun Sale', openmarket: 'Open Market Sale' };
  document.getElementById('phase1ResultDisplay').innerHTML = `
    <h3>Phase 2 Results</h3>
    <div class="result-item"><span>Equitable Dissolution</span><strong>${dissolution || 0} votes</strong></div>
    <div class="result-item"><span>Shotgun Sale</span><strong>${shotgun || 0} votes</strong></div>
    <div class="result-item"><span>Open Market Sale</span><strong>${openmarket || 0} votes</strong></div>
    <div style="margin-top:12px; padding-top:12px; border-top:1px solid rgba(255,255,255,0.2);">
      <p style="font-size:12px; color:#aaa;">Winning Remedy:</p>
      <p style="font-size:16px; font-weight:bold; color:#d4af37;">${remedyLabels[winningRemedy] || (winningRemedy || '').toUpperCase()}</p>
    </div>
  `;
}

// ═══════════════════════════════════════════════════════════════════
// PHASE 3: FIVE-STAGE FLOW
// ═══════════════════════════════════════════════════════════════════

// ─── Stage 1: Role Reveal ──────────────────────────────────────────

function showRoleReveal() {
  p3Stage = 'reveal';
  hideAllP3Stages();

  const container = document.getElementById('p3RoleReveal');
  const isLucia = userRole === 'lucia';
  const name = isLucia ? 'LUCIA BELLAMONTE' : 'MARCO BELLAMONTE';
  const cls = isLucia ? 'lucia' : 'marco';

  container.innerHTML = `
    <div class="role-reveal ${cls}">
      <div class="role-label-big">Your Role</div>
      <div class="role-name">${name}</div>
      <div class="role-tagline">"${isLucia
        ? 'I helped build this legacy for 30 years, and I won\'t be pushed aside by my own nephew.'
        : 'I\'m glad you chose the only correct side in this dispute, because there\'s no way I\'m in the wrong.'
      }"</div>
      <button class="button" onclick="goToCharacterBrief()" style="max-width:300px; margin:0 auto;">Continue</button>
    </div>
  `;
  container.classList.remove('hidden');
}

// ─── Stage 2: Character Briefing + Secrets ─────────────────────────

function goToCharacterBrief() {
  p3Stage = 'brief';
  hideAllP3Stages();

  const container = document.getElementById('p3CharacterBrief');
  container.innerHTML = '<div class="waiting-text">Loading your briefing<span class="dots"></span></div>';
  container.classList.remove('hidden');

  fetch(`/api/session/${sessionId}/character/${participantId}`)
    .then(res => res.json())
    .then(data => {
      if (data.error) {
        container.innerHTML = '<p style="color:#f87171;">Error loading character data.</p>';
        return;
      }
      characterData = data.character;
      renderCharacterBrief(container, data.role, data.character);
    })
    .catch(err => {
      container.innerHTML = '<p style="color:#f87171;">Connection error.</p>';
    });
}

function renderCharacterBrief(container, role, char) {
  const cls = role === 'lucia' ? 'lucia' : 'marco';

  // Get opponent info
  const partner = currentPair
    ? (currentPair.partnerA.id === participantId ? currentPair.partnerB : currentPair.partnerA)
    : null;

  const opponentSection = partner ? `
    <div style="margin-bottom:20px; padding:16px; background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.15); border-radius:8px; text-align:center;">
      <div style="font-size:12px; color:#aaa; text-transform:uppercase; letter-spacing:1px; margin-bottom:6px;">Your Opponent</div>
      <div style="font-size:18px; font-weight:700; color:#fff;">${partner.name}</div>
      <div style="font-size:13px; color:${role === 'lucia' ? '#7c8a9e' : '#d4af37'}; margin-top:4px;">Playing as ${partner.role}</div>
    </div>
  ` : '';

  let html = `
    ${opponentSection}

    <div class="dossier">
      <div class="dossier-header ${cls}">${char.name}: Case File</div>
      <div class="dossier-section">
        <div class="dossier-label">My Position</div>
        <div class="dossier-text">${char.position}</div>
      </div>
      <div class="dossier-section">
        <div class="dossier-label">My Goal</div>
        <div class="dossier-text">${char.goal}</div>
      </div>
      <div class="dossier-section">
        <div class="dossier-label">My Strengths</div>
        <div class="dossier-text">${char.strengths}</div>
      </div>
      <div class="dossier-section">
        <div class="dossier-label">My Weaknesses</div>
        <div class="dossier-text">${char.weaknesses}</div>
      </div>
    </div>

    <div class="classified-box">
      <div class="classified-stamp">Classified: For Your Eyes Only</div>
      <div class="classified-body">
        ${char.secrets.map(s => `
          <div class="secret-item">
            <div class="secret-label">${s.label}</div>
            <div class="secret-text">${s.text}</div>
          </div>
        `).join('')}
      </div>
    </div>

    <div style="margin-top:20px; padding:20px; background:rgba(212,175,55,0.08); border:1px solid rgba(212,175,55,0.25); border-radius:10px;">
      <h3 style="color:#d4af37; margin-bottom:12px; font-size:16px; text-align:center;">How the Shotgun Sale Works</h3>
      <div style="display:flex; flex-direction:column; gap:10px; font-size:13px; color:#ccc; line-height:1.6;">
        <div style="display:flex; gap:10px; align-items:flex-start;">
          <span style="background:#d4af37; color:#000; font-weight:800; min-width:24px; height:24px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:12px;">1</span>
          <span>One party (the <strong style="color:#fff;">Offeror</strong>) names a price for their 50% of the company.</span>
        </div>
        <div style="display:flex; gap:10px; align-items:flex-start;">
          <span style="background:#d4af37; color:#000; font-weight:800; min-width:24px; height:24px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:12px;">2</span>
          <span>The other party (the <strong style="color:#fff;">Responder</strong>) must then choose: <strong style="color:#4ade80;">BUY</strong> the offeror's shares at that price, or <strong style="color:#f87171;">SELL</strong> their own shares at that price.</span>
        </div>
        <div style="display:flex; gap:10px; align-items:flex-start;">
          <span style="background:#d4af37; color:#000; font-weight:800; min-width:24px; height:24px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:12px;">3</span>
          <span>This mechanism is self-policing: the offeror must price fairly because they could end up on either side of the deal.</span>
        </div>
      </div>
    </div>

    <button class="button" onclick="goToNegotiation()" style="margin-top:20px;">I Understand My Position: Proceed to Shotgun</button>
  `;

  container.innerHTML = html;
}

// ─── Stage 3: Mechanism Choice ──────────────────────────────────────

function goToMechanismChoice() {
  p3Stage = 'mechanism';
  hideAllP3Stages();

  // If mechanism already decided (reconnect), skip to negotiation
  if (currentPair && currentPair.chosenMechanism && currentPair.status !== 'choosing_mechanism') {
    p3Stage = 'negotiation';
    showNegotiation();
    return;
  }

  showMechanismChoice();
}

function showMechanismChoice() {
  const container = document.getElementById('p3MechanismChoice');
  const partner = currentPair.partnerA.id === participantId ? currentPair.partnerB : currentPair.partnerA;

  container.innerHTML = `
    <div class="card">
      <h3 style="color:#d4af37; margin-bottom:8px; text-align:center;">Choose Your Mechanism</h3>
      <p style="color:#aaa; text-align:center; margin-bottom:20px; font-size:14px;">
        You and <strong style="color:#fff;">${partner.name}</strong> each choose independently.<br>
        If you agree, that mechanism is used. If you disagree, one is randomly selected.
      </p>

      <div class="mechanism-cards">
        <div class="mechanism-card" id="mechShotgun" onclick="selectMechanism('shotgun')">
          <h3>Shotgun Clause</h3>
          <p>One side names a price for their 50%.<br>The other side chooses to <strong>BUY</strong> or <strong>SELL</strong> at that price.</p>
        </div>
        <div class="mechanism-card" id="mechTimed" onclick="selectMechanism('timedauction')">
          <h3>Timed Auction</h3>
          <p>Price starts high and drops every second.<br>First to lock sets the price.<br>The other chooses <strong>BUY</strong> or <strong>SELL</strong>.</p>
        </div>
      </div>

      <div id="mechanismPartnerStatus" style="text-align:center; color:#aaa; font-size:14px; margin-top:10px;">
        Waiting for your partner to vote...
      </div>
      <div id="mechanismSubmitted" class="status-message hidden" style="text-align:center;">
        Your vote is in. Waiting for your partner...
      </div>
    </div>
  `;
  container.classList.remove('hidden');

  // If already voted (reconnect), show submitted state
  if (currentPair.mechanismVotes && currentPair.mechanismVotes[participantId]) {
    document.getElementById('mechanismSubmitted').classList.remove('hidden');
    document.querySelectorAll('.mechanism-card').forEach(c => {
      c.style.pointerEvents = 'none';
      c.style.opacity = '0.5';
    });
  }
}

function selectMechanism(mechanism) {
  // Highlight selection
  document.querySelectorAll('.mechanism-card').forEach(c => c.classList.remove('selected'));
  document.getElementById(mechanism === 'shotgun' ? 'mechShotgun' : 'mechTimed').classList.add('selected');

  // Disable further clicks
  document.querySelectorAll('.mechanism-card').forEach(c => {
    c.style.pointerEvents = 'none';
    c.style.opacity = '0.5';
  });
  document.getElementById(mechanism === 'shotgun' ? 'mechShotgun' : 'mechTimed').style.opacity = '1';

  document.getElementById('mechanismSubmitted').classList.remove('hidden');

  fetch(`/api/session/${sessionId}/buysell/${currentPair.pairId}/vote-mechanism`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ participantId, mechanism }),
  }).catch(err => console.error('Mechanism vote error:', err));
}

function showMechanismResult(data) {
  const container = document.getElementById('p3MechanismChoice');
  const mechLabel = data.chosenMechanism === 'shotgun' ? 'Shotgun Clause' : 'Timed Auction';
  const agreed = data.agreed;

  container.innerHTML = `
    <div class="card" style="text-align:center;">
      <h3 style="color:#d4af37; margin-bottom:16px;">Mechanism Selected</h3>
      <div style="font-size:32px; font-weight:800; color:#d4af37; margin:20px 0;">${mechLabel}</div>
      <p style="color:#aaa; font-size:14px; margin-bottom:20px;">
        ${agreed ? 'You both agreed!' : 'You disagreed, so this was randomly selected.'}
      </p>
      <button class="button" onclick="goToNegotiation()" style="max-width:300px; margin:0 auto;">Begin Negotiation</button>
    </div>
  `;
}

function goToNegotiation() {
  p3Stage = 'negotiation';
  hideAllP3Stages();
  showNegotiation();
}

// ─── Stage 4: Negotiation ──────────────────────────────────────────

function showNegotiation() {
  const container = document.getElementById('p3Negotiation');
  container.classList.remove('hidden');

  const mechanism = currentPair.chosenMechanism;
  const isPartnerA = currentPair.partnerA.id === participantId;
  const partner = isPartnerA ? currentPair.partnerB : currentPair.partnerA;

  // Handle reconnection into various states
  if (currentPair.status === 'complete') {
    showOutcome({ choice: currentPair.shotgunChoice, finalPrice: currentPair.finalPrice, remedy: '' });
    return;
  }

  if (mechanism === 'shotgun') {
    showShotgunNegotiation(container, isPartnerA, partner);
  } else {
    showTimedAuctionNegotiation(container, isPartnerA, partner);
  }
}

function showShotgunNegotiation(container, isPartnerA, partner) {
  const isOfferor = isPartnerA; // Lucia (partnerA) is offeror

  if (currentPair.status === 'offered' && !isOfferor) {
    // Reconnecting as offeree after offer was made
    renderShotgunOffereeView(container, partner, currentPair.shotgunOffer);
    return;
  }

  if (currentPair.status === 'offered' && isOfferor) {
    // Reconnecting as offeror — waiting for response
    container.innerHTML = `
      <div class="card" style="text-align:center;">
        <h3 style="color:#d4af37; margin-bottom:16px;">Shotgun Clause</h3>
        <p style="color:#aaa; margin-bottom:10px;">Your offer is in.</p>
        <div class="big-price">$${currentPair.shotgunOffer.toLocaleString()}</div>
        <div class="waiting-text">${partner.name} is deciding<span class="dots"></span></div>
      </div>
    `;
    return;
  }

  if (isOfferor) {
    // Offeror: name a price
    container.innerHTML = `
      <div class="card">
        <h3 style="color:#d4af37; margin-bottom:8px; text-align:center;">Shotgun Clause</h3>
        <p style="color:#aaa; text-align:center; margin-bottom:6px; font-size:14px;">You are the <strong style="color:#d4af37;">OFFEROR</strong></p>
        <p style="color:#888; text-align:center; margin-bottom:24px; font-size:13px;">
          Name your price for 50% of Notte Bellamonte Winery.<br>
          <strong>${partner.name}</strong> will choose to BUY or SELL at this price.
        </p>
        <input type="number" class="offer-input" id="shotgunPriceInput" placeholder="e.g. 4250000" min="0" step="50000">
        <button class="submit-offer-btn" onclick="submitShotgunOffer()">Lock In Offer</button>
      </div>
    `;
  } else {
    // Offeree: waiting for offer
    container.innerHTML = `
      <div class="card" style="text-align:center;">
        <h3 style="color:#d4af37; margin-bottom:16px;">Shotgun Clause</h3>
        <p style="color:#aaa; margin-bottom:10px;">You are the <strong style="color:#d4af37;">RESPONDER</strong></p>
        <div class="waiting-text">${partner.name} is setting the price<span class="dots"></span></div>
      </div>
    `;
  }
}

function renderShotgunOffereeView(container, partner, price) {
  container.innerHTML = `
    <div class="card" style="text-align:center;">
      <h3 style="color:#d4af37; margin-bottom:16px;">The Offer Is In</h3>
      <div class="big-price">$${price.toLocaleString()}</div>
      <p style="color:#aaa; margin-bottom:24px; font-size:15px;">
        <strong style="color:#fff;">${partner.name}</strong> has set the price. Your move:
      </p>
      <button class="action-btn buy-btn" onclick="respondShotgun('buy')">
        Buy Their 50% for $${price.toLocaleString()}
      </button>
      <button class="action-btn sell-btn" onclick="respondShotgun('sell')">
        Sell Your 50% for $${price.toLocaleString()}
      </button>
    </div>
  `;
}

function submitShotgunOffer() {
  const price = parseInt(document.getElementById('shotgunPriceInput').value);
  if (!price || price <= 0) {
    alert('Please enter a valid price');
    return;
  }

  const container = document.getElementById('p3Negotiation');
  const partner = currentPair.partnerA.id === participantId ? currentPair.partnerB : currentPair.partnerA;

  fetch(`/api/session/${sessionId}/buysell/${currentPair.pairId}/offer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ participantId, price }),
  })
    .then(res => res.json())
    .then(data => {
      if (data.ok) {
        currentPair.shotgunOffer = price;
        currentPair.status = 'offered';
        container.innerHTML = `
          <div class="card" style="text-align:center;">
            <h3 style="color:#d4af37; margin-bottom:16px;">Shotgun Clause</h3>
            <p style="color:#aaa; margin-bottom:10px;">Your offer is in.</p>
            <div class="big-price">$${price.toLocaleString()}</div>
            <div class="waiting-text">${partner.name} is deciding<span class="dots"></span></div>
          </div>
        `;
      }
    })
    .catch(err => console.error('Offer error:', err));
}

function showOffereeResponse(price) {
  const container = document.getElementById('p3Negotiation');
  const partner = currentPair.partnerA.id === participantId ? currentPair.partnerB : currentPair.partnerA;
  renderShotgunOffereeView(container, partner, price);
}

function respondShotgun(choice) {
  fetch(`/api/session/${sessionId}/buysell/${currentPair.pairId}/respond`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ choice, participantId }),
  })
    .then(res => res.json())
    .then(data => {
      if (data.ok) {
        // Outcome will be shown via socket event
      }
    })
    .catch(err => console.error('Response error:', err));
}

// ─── Timed Auction ──────────────────────────────────────────────────

function showTimedAuctionNegotiation(container, isPartnerA, partner) {
  if (currentPair.status === 'waiting_for_final_choice') {
    // Reconnect: price already locked
    if (currentPair.timedAuctionLockedBy === participantId) {
      showTimedWaitingForChoice();
    } else {
      showTimedLockResponse(currentPair.timedAuctionLockedPrice);
    }
    return;
  }

  // Check if auction already started (reconnect case) by checking if startTime exists
  if (currentPair.timedAuctionStartTime) {
    // Auction already running — join in progress
    startTimedAuctionClock(currentPair.timedAuctionStartTime, STARTING_PRICE, DROP_PER_SECOND);
    return;
  }

  // Show "Begin" button — both must click before clock starts
  container.innerHTML = `
    <div class="card" style="text-align:center;">
      <h3 style="color:#d4af37; margin-bottom:8px;">Timed Auction</h3>
      <p style="color:#aaa; margin-bottom:6px; font-size:14px;">Price starts at $${STARTING_PRICE.toLocaleString()} and drops $${DROP_PER_SECOND.toLocaleString()} every second</p>
      <p style="color:#888; margin-bottom:20px; font-size:13px;">First to lock sets the price. The other chooses BUY or SELL.</p>
      <div class="big-price" id="timedPriceDisplay">$${STARTING_PRICE.toLocaleString()}</div>
      <button class="lock-btn" id="timedBeginBtn" onclick="signalTimedReady()">Click to Begin</button>
      <div id="timedPartnerStatus" style="text-align:center; color:#aaa; font-size:14px; margin-top:10px;">
        Both partners must click Begin to start the clock.
      </div>
      <div id="timedReadyMsg" class="status-message hidden" style="text-align:center; margin-top:10px;">
        You're ready! Waiting for your partner to click Begin...
      </div>
    </div>
  `;
}

function signalTimedReady() {
  // Disable the begin button
  const btn = document.getElementById('timedBeginBtn');
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Waiting for partner...';
    btn.style.opacity = '0.5';
  }
  document.getElementById('timedReadyMsg').classList.remove('hidden');

  fetch(`/api/session/${sessionId}/buysell/${currentPair.pairId}/timed-ready`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ participantId }),
  }).catch(err => console.error('Timed ready error:', err));
}

function startTimedAuctionClock(startTime, startPrice, dropPerSecond) {
  clearInterval(timedAuctionInterval);

  const container = document.getElementById('p3Negotiation');

  // Calculate current price based on elapsed time
  const elapsed = (Date.now() - startTime) / 1000;
  currentPrice = Math.max(0, startPrice - Math.floor(elapsed) * dropPerSecond);

  container.innerHTML = `
    <div class="card" style="text-align:center;">
      <h3 style="color:#d4af37; margin-bottom:8px;">Timed Auction: LIVE</h3>
      <p style="color:#f87171; margin-bottom:6px; font-size:14px; font-weight:700;">Price is dropping!</p>
      <p style="color:#888; margin-bottom:20px; font-size:13px;">First to lock sets the price. The other chooses BUY or SELL.</p>
      <div class="big-price dropping" id="timedPriceDisplay">$${currentPrice.toLocaleString()}</div>
      <button class="lock-btn" id="timedLockBtn" onclick="lockTimedPrice()">Lock This Price</button>
    </div>
  `;

  timedAuctionInterval = setInterval(() => {
    const elapsedNow = (Date.now() - startTime) / 1000;
    currentPrice = Math.max(0, startPrice - Math.floor(elapsedNow) * dropPerSecond);
    const el = document.getElementById('timedPriceDisplay');
    if (el) el.textContent = '$' + currentPrice.toLocaleString();

    if (currentPrice <= 0) {
      clearInterval(timedAuctionInterval);
      const btn = document.getElementById('timedLockBtn');
      if (btn) btn.disabled = true;
    }
  }, 200); // Update 5x/second for smooth display
}

function lockTimedPrice() {
  clearInterval(timedAuctionInterval);

  fetch(`/api/session/${sessionId}/buysell/${currentPair.pairId}/lock-timed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ participantId, price: currentPrice }),
  })
    .then(res => res.json())
    .then(data => {
      if (data.ok) {
        showTimedWaitingForChoice();
      }
    })
    .catch(err => console.error('Lock error:', err));
}

function showTimedWaitingForChoice() {
  const container = document.getElementById('p3Negotiation');
  const price = currentPair.timedAuctionLockedPrice || currentPrice;
  const partner = currentPair.partnerA.id === participantId ? currentPair.partnerB : currentPair.partnerA;

  container.innerHTML = `
    <div class="card" style="text-align:center;">
      <h3 style="color:#d4af37; margin-bottom:16px;">Price Locked</h3>
      <div class="big-price">$${price.toLocaleString()}</div>
      <div class="waiting-text">${partner.name} is choosing BUY or SELL<span class="dots"></span></div>
    </div>
  `;
}

function showTimedLockResponse(price) {
  clearInterval(timedAuctionInterval);
  const container = document.getElementById('p3Negotiation');
  const partner = currentPair.partnerA.id === participantId ? currentPair.partnerB : currentPair.partnerA;

  container.innerHTML = `
    <div class="card" style="text-align:center;">
      <h3 style="color:#d4af37; margin-bottom:16px;">Price Locked by ${partner.name}</h3>
      <div class="big-price">$${price.toLocaleString()}</div>
      <p style="color:#aaa; margin-bottom:24px; font-size:15px;">The price has been locked. Your move:</p>
      <button class="action-btn buy-btn" onclick="respondTimed('buy')">
        Buy Their 50% for $${price.toLocaleString()}
      </button>
      <button class="action-btn sell-btn" onclick="respondTimed('sell')">
        Sell Your 50% for $${price.toLocaleString()}
      </button>
    </div>
  `;
}

function respondTimed(choice) {
  fetch(`/api/session/${sessionId}/buysell/${currentPair.pairId}/final-choice`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ choice, participantId }),
  })
    .then(res => res.json())
    .then(data => {
      if (data.ok) {
        // Outcome shown via socket event
      }
    })
    .catch(err => console.error('Final choice error:', err));
}

// ─── Stage 5: Outcome ──────────────────────────────────────────────

function showOutcome(data) {
  p3Stage = 'outcome';
  hideAllP3Stages();

  const container = document.getElementById('p3Outcome');
  const price = data.finalPrice || currentPair.finalPrice;
  const choice = data.choice || currentPair.shotgunChoice;
  const partner = currentPair.partnerA.id === participantId ? currentPair.partnerB : currentPair.partnerA;
  const myRole = currentPair.partnerA.id === participantId ? currentPair.partnerA.role : currentPair.partnerB.role;

  // Determine who bought and who sold
  let buyerName, sellerName;
  // The person who chose 'buy' is the buyer
  // The responder/chooser's identity depends on the mechanism
  if (currentPair.responderId === participantId) {
    buyerName = choice === 'buy' ? userName : partner.name;
    sellerName = choice === 'buy' ? partner.name : userName;
  } else {
    buyerName = choice === 'buy' ? partner.name : userName;
    sellerName = choice === 'buy' ? userName : partner.name;
  }

  const choiceColor = choice === 'buy' ? '#4ade80' : '#f87171';
  const choiceLabel = choice === 'buy' ? 'BUY' : 'SELL';

  container.innerHTML = `
    <div class="outcome-box">
      <h2>Deal Complete</h2>
      <div class="outcome-price">$${price.toLocaleString()}</div>
      <div class="outcome-detail">
        <strong style="color:${choiceColor};">${buyerName}</strong> bought the shares
      </div>
      <div class="outcome-detail">
        <strong>${sellerName}</strong> sold their 50% stake
      </div>
      <div style="margin-top:20px; padding:15px; background:rgba(0,0,0,0.3); border-radius:8px;">
        <p style="font-size:13px; color:#888;">Transaction Complete</p>
        <a href="/analytics.html?session=${sessionId}" target="_blank" style="display:inline-block; margin-top:12px; padding:10px 20px; background:#d4af37; color:#000; border-radius:6px; text-decoration:none; font-size:13px; font-weight:600;">View Class Analytics &amp; Debrief</a>
      </div>
    </div>
  `;
  container.classList.remove('hidden');
}

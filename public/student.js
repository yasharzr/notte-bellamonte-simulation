// Global state
let socket;
let sessionId;
let participantId;
let userName;
let userRole; // 'lucia' or 'marco'
let currentPair = null;
let currentPhase = 'lobby';

// Initialize on page load
window.addEventListener('DOMContentLoaded', () => {
  socket = io();

  socket.on('phase_changed', (data) => {
    currentPhase = data.phase;
    loadSession();
  });

  socket.on('phase1_vote_update', (data) => {
    updatePhase1VoteCount(data);
  });

  socket.on('phase2_vote_update', (data) => {
    updatePhase2VoteCount(data);
  });

  socket.on('phase1_revealed', (data) => {
    displayPhase1Results(data);
  });

  socket.on('phase2_revealed', (data) => {
    displayPhase2Results(data);
  });

  socket.on('buysell_pairs_formed', (data) => {
    checkIfInPair(data.pairs, data.mode);
  });

  socket.on('shotgun_offer_made', (data) => {
    if (currentPair && currentPair.pairId === data.pairId) {
      currentPair.shotgunOffer = data.price;
      currentPair.status = 'offered';
      displayShotgunOffer(data);
    }
    // Update live display for all students
    loadSession();
  });

  socket.on('timed_price_locked', (data) => {
    if (currentPair && currentPair.pairId === data.pairId) {
      displayTimedLock(data);
    }
  });

  socket.on('buysell_complete', (data) => {
    if (currentPair && currentPair.pairId === data.pairId) {
      displayBuySellComplete(data);
    }
  });

  socket.on('participant_joined', (data) => {
    loadSession();
  });

  // ─── AUTO-RECONNECT from sessionStorage ───────────────────────
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
        userRole = data.role;

        // Persist to sessionStorage for reconnection
        sessionStorage.setItem('nb_sessionId', sessionId);
        sessionStorage.setItem('nb_participantId', participantId);
        sessionStorage.setItem('nb_userName', userName);
        sessionStorage.setItem('nb_role', userRole);

        socket.emit('join_session', { sessionId, role: 'student' });

        document.getElementById('loginScreen').classList.add('hidden');
        document.getElementById('mainApp').classList.remove('hidden');

        showRoleBadge();
        showCharacterSheet();
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
        // Restore identity
        sessionId = data.sessionId;
        participantId = data.participantId;
        userName = data.name;
        userRole = data.role;

        socket.emit('join_session', { sessionId, role: 'student' });

        document.getElementById('loginScreen').classList.add('hidden');
        document.getElementById('mainApp').classList.remove('hidden');

        showRoleBadge();
        showCharacterSheet();
        loadSession();
      } else {
        // Session or participant gone — clear storage, show login
        sessionStorage.removeItem('nb_sessionId');
        sessionStorage.removeItem('nb_participantId');
        sessionStorage.removeItem('nb_userName');
        sessionStorage.removeItem('nb_role');
      }
    })
    .catch(() => {
      // Server unreachable — clear storage, show login
      sessionStorage.removeItem('nb_sessionId');
      sessionStorage.removeItem('nb_participantId');
      sessionStorage.removeItem('nb_userName');
      sessionStorage.removeItem('nb_role');
    });
}

function showRoleBadge() {
  const badge = document.getElementById('roleBadge');
  if (!badge) return;

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

function showCharacterSheet() {
  const sheet = document.getElementById('characterSheet');
  const nameEl = document.getElementById('characterName');
  const descEl = document.getElementById('characterDesc');
  if (!sheet || !nameEl || !descEl) return;

  if (userRole === 'lucia') {
    nameEl.textContent = 'Your Role: Lucia Bellamonte';
    descEl.innerHTML = '<strong>Position:</strong> Preserve the family legacy.<br><br>' +
      '"We must preserve the family legacy. We remain committed to the vineyard and our brand. No outside buyers. ' +
      'This winery is what Papa built, and it should stay in the family the way he intended."<br><br>' +
      '<strong>You believe:</strong> The winery\'s value is in its tradition, boutique quality, and the Bellamonte name. ' +
      'Modernization would destroy everything your father built.';
  } else {
    nameEl.textContent = 'Your Role: Marco Bellamonte';
    descEl.innerHTML = '<strong>Position:</strong> Modernize and expand.<br><br>' +
      '"We must adapt to modern times. The market is changing and we need to change with it. ' +
      'We automate production, scale internationally, and finally branch out."<br><br>' +
      '<strong>You believe:</strong> The winery is stuck in the past. To survive and grow, it needs investment, ' +
      'new technology, and possibly outside partners or going public.';
  }

  sheet.classList.remove('hidden');
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
  // Hide all phase containers
  document.getElementById('phase1Container').classList.add('hidden');
  document.getElementById('phase2Container').classList.add('hidden');
  document.getElementById('phase3Container').classList.add('hidden');

  // Update header
  const phaseText = {
    lobby: 'Waiting to start...',
    phase_1_debate: 'Phase 1: Legal Framework Vote',
    phase_2_remedy: 'Phase 2: Remedy Selection Vote',
    phase_3_buysell: 'Phase 3: Buy-Sell Execution',
    complete: 'Simulation Complete',
  };

  document.getElementById('phaseText').textContent = phaseText[currentPhase] || 'Unknown phase';
  document.getElementById('phaseBadge').textContent = currentPhase.toUpperCase();

  if (currentPhase === 'phase_1_debate') {
    document.getElementById('phase1Container').classList.remove('hidden');
  } else if (currentPhase === 'phase_2_remedy') {
    document.getElementById('phase2Container').classList.remove('hidden');
    if (sessionData.phase1Results.revealed) {
      displayPhase1Results(sessionData.phase1Results);
    }
  } else if (currentPhase === 'phase_3_buysell') {
    document.getElementById('phase3Container').classList.remove('hidden');
    if (sessionData.phase2Results.revealed) {
      displayPhase2Results(sessionData.phase2Results);
    }
    checkIfInPair(sessionData.buysellPairs, sessionData.buysellMode);
  }
}

// ─── PHASE 1: VOTING ────────────────────────────────────────────────

function votePhase1(choice) {
  // Update UI to show selection
  document.querySelectorAll('#phase1Container .vote-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  event.target.closest('.vote-btn').classList.add('active');

  // Submit vote
  fetch(`/api/session/${sessionId}/vote-phase1`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ participantId, choice }),
  })
    .then(res => res.json())
    .then(data => {
      if (data.ok) {
        document.getElementById('phase1Submitted').classList.remove('hidden');
        document.querySelectorAll('#phase1Container .vote-btn').forEach(btn => {
          btn.disabled = true;
        });
      }
    })
    .catch(err => {
      document.getElementById('phase1Error').textContent = 'Error submitting vote: ' + err.message;
      document.getElementById('phase1Error').classList.remove('hidden');
    });
}

function updatePhase1VoteCount(data) {
  const { votesSubmitted, votesExpected, counts } = data;
  const html = `${votesSubmitted} / ${votesExpected} have voted`;
  const el = document.getElementById('phase1VoteCount');
  if (el) el.textContent = html;
}

function displayPhase1Results(results) {
  const { oppression, dissolution, partnership } = results;
  const html = `
    <h3>Phase 1 Results</h3>
    <div class="result-item">
      <span>Oppression (s.241)</span>
      <strong>${oppression} votes</strong>
    </div>
    <div class="result-item">
      <span>Dissolution (s.214)</span>
      <strong>${dissolution} votes</strong>
    </div>
    <div class="result-item">
      <span>Partnership Analogy</span>
      <strong>${partnership} votes</strong>
    </div>
  `;
  document.getElementById('phase1ResultDisplay').innerHTML = html;
}

// ─── PHASE 2: REMEDY VOTING ────────────────────────────────────────

function votePhase2(remedy) {
  // Update UI
  document.querySelectorAll('#phase2Container .vote-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  event.target.closest('.vote-btn').classList.add('active');

  // Submit vote
  fetch(`/api/session/${sessionId}/vote-phase2`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ participantId, remedy }),
  })
    .then(res => res.json())
    .then(data => {
      if (data.ok) {
        document.getElementById('phase2Submitted').classList.remove('hidden');
        document.querySelectorAll('#phase2Container .vote-btn').forEach(btn => {
          btn.disabled = true;
        });
      }
    })
    .catch(err => {
      document.getElementById('phase2Error').textContent = 'Error submitting vote: ' + err.message;
      document.getElementById('phase2Error').classList.remove('hidden');
    });
}

function updatePhase2VoteCount(data) {
  const { votesSubmitted, votesExpected } = data;
  const html = `${votesSubmitted} / ${votesExpected} have voted`;
  const el = document.getElementById('phase2VoteCount');
  if (el) el.textContent = html;
}

function displayPhase2Results(results) {
  const { buyout, shotgun, timedauction, liquidation, winningRemedy } = results;
  const html = `
    <h3>Phase 2 Results</h3>
    <div class="result-item">
      <span>Buyout</span>
      <strong>${buyout} votes</strong>
    </div>
    <div class="result-item">
      <span>Shotgun</span>
      <strong>${shotgun} votes</strong>
    </div>
    <div class="result-item">
      <span>Timed Auction</span>
      <strong>${timedauction} votes</strong>
    </div>
    <div class="result-item">
      <span>Liquidation</span>
      <strong>${liquidation} votes</strong>
    </div>
    <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.2);">
      <p style="font-size: 12px; color: #aaa;">Winning Remedy:</p>
      <p style="font-size: 16px; font-weight: bold; color: #d4af37;">${winningRemedy.toUpperCase()}</p>
    </div>
  `;
  document.getElementById('phase2ResultDisplay').innerHTML = html;
}

// ─── PHASE 3: BUY-SELL EXECUTION ──────────────────────────────────

function checkIfInPair(pairs, mode) {
  currentPair = pairs.find(p => p.partnerA.id === participantId || p.partnerB.id === participantId);

  if (!currentPair) {
    document.getElementById('noPairMessage').classList.remove('hidden');
    document.getElementById('shotgunContainer').classList.add('hidden');
    document.getElementById('timedAuctionContainer').classList.add('hidden');
    return;
  }

  document.getElementById('noPairMessage').classList.add('hidden');

  // Determine role
  const isPartnerA = currentPair.partnerA.id === participantId;
  const isOfferor = isPartnerA; // Partner A is offeror

  if (mode === 'shotgun') {
    document.getElementById('shotgunContainer').classList.remove('hidden');
    document.getElementById('timedAuctionContainer').classList.add('hidden');

    document.getElementById('partnerA').textContent = currentPair.partnerA.name;
    document.getElementById('partnerB').textContent = currentPair.partnerB.name;

    if (isOfferor) {
      document.getElementById('shotgunOfferor').classList.remove('hidden');
      document.getElementById('shotgunOfferee').classList.add('hidden');
    } else {
      document.getElementById('shotgunOfferor').classList.add('hidden');
      document.getElementById('shotgunOfferee').classList.remove('hidden');

      if (currentPair.shotgunOffer) {
        displayShotgunOffer({ price: currentPair.shotgunOffer });
      }
    }
  } else if (mode === 'timedauction') {
    document.getElementById('shotgunContainer').classList.add('hidden');
    document.getElementById('timedAuctionContainer').classList.remove('hidden');

    document.getElementById('partnerAT').textContent = currentPair.partnerA.name;
    document.getElementById('partnerBT').textContent = currentPair.partnerB.name;

    startTimedAuction();
  }
}

// ─── SHOTGUN ───────────────────────────────────────────────────────

function submitShotgunOffer() {
  const price = parseInt(document.getElementById('priceInput').value);
  if (!price || price <= 0) {
    alert('Please enter a valid price');
    return;
  }

  fetch(`/api/session/${sessionId}/buysell/${currentPair.pairId}/offer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ participantId, price }),
  })
    .then(res => res.json())
    .then(data => {
      if (data.ok) {
        document.getElementById('shotgunOfferor').classList.add('hidden');
        document.getElementById('shotgunOfferee').classList.remove('hidden');
        document.getElementById('priceWaitingDisplay').textContent = `$${price.toLocaleString()}`;
        document.getElementById('priceWaitingDisplay').classList.remove('hidden');
      }
    })
    .catch(err => console.error('Offer error:', err));
}

function displayShotgunOffer(data) {
  document.getElementById('shotgunOfferor').classList.add('hidden');
  document.getElementById('shotgunOfferee').classList.remove('hidden');
  document.getElementById('priceWaitingDisplay').textContent = `$${data.price.toLocaleString()}`;
  document.getElementById('priceWaitingDisplay').classList.remove('hidden');
  document.getElementById('choiceContainer').classList.remove('hidden');

  // Show live display to everyone
  updateLiveShotgunDisplay();
}

function updateLiveShotgunDisplay() {
  if (!currentPair) return;

  const container = document.getElementById('liveShotgunContent');

  if (currentPair.status === 'waiting_for_offer') {
    container.innerHTML = `
      <p style="font-size: 16px; color: #aaa; margin-bottom: 20px;">Waiting for offeror to set price...</p>
      <div style="font-size: 14px; color: #d4af37;">
        <strong>${currentPair.partnerA.name}</strong> (Offeror) ⚔️ <strong>${currentPair.partnerB.name}</strong> (Offeree)
      </div>
    `;
  } else if (currentPair.status === 'offered') {
    container.innerHTML = `
      <div style="font-size: 48px; font-weight: bold; color: #d4af37; margin: 20px 0;">$${currentPair.shotgunOffer.toLocaleString()}</div>
      <p style="font-size: 14px; color: #aaa; margin-bottom: 20px;">Offeror: <strong style="color: #fff;">${currentPair.partnerA.name}</strong></p>
      <p style="font-size: 18px; color: #fff; margin-bottom: 20px;"><strong>${currentPair.partnerB.name}</strong> is choosing...</p>
      <div style="display: flex; gap: 20px; justify-content: center; margin-top: 25px;">
        <div style="padding: 15px 25px; background: rgba(74, 222, 128, 0.2); border: 2px solid #4ade80; border-radius: 6px; color: #4ade80; font-weight: 600;">💰 BUY</div>
        <div style="padding: 15px 25px; background: rgba(248, 113, 113, 0.2); border: 2px solid #f87171; border-radius: 6px; color: #f87171; font-weight: 600;">📊 SELL</div>
      </div>
    `;
  } else if (currentPair.status === 'complete') {
    const choice = currentPair.shotgunChoice === 'buy' ? '💰 BOUGHT' : '📊 SOLD';
    const choiceColor = currentPair.shotgunChoice === 'buy' ? '#4ade80' : '#f87171';
    container.innerHTML = `
      <div style="font-size: 48px; font-weight: bold; color: #d4af37; margin: 20px 0;">$${currentPair.finalPrice.toLocaleString()}</div>
      <p style="font-size: 16px; color: #aaa; margin-bottom: 20px;">
        <strong style="color: #fff;">${currentPair.partnerB.name}</strong> chose to <span style="color: ${choiceColor};">${choice}</span>
      </p>
      <div style="padding: 15px; background: #3a3a4e; border-radius: 6px; margin-top: 15px;">
        <p style="font-size: 13px; color: #aaa;">✓ Transaction Complete</p>
      </div>
    `;
  }
}

function respondShotgun(choice) {
  fetch(`/api/session/${sessionId}/buysell/${currentPair.pairId}/respond`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ choice }),
  })
    .then(res => res.json())
    .then(data => {
      if (data.ok) {
        document.getElementById('choiceContainer').classList.add('hidden');
        document.getElementById('shotgunContainer').innerHTML =
          '<div class="status-message">✓ Complete! Remedy: ' + data.remedy + '</div>';
      }
    })
    .catch(err => console.error('Response error:', err));
}

// ─── TIMED AUCTION ─────────────────────────────────────────────────

let timedAuctionInterval;
let currentPrice = 3000000;
const STARTING_PRICE = 3000000;
const DROP_PER_SECOND = 50000;

function startTimedAuction() {
  currentPrice = STARTING_PRICE;
  document.getElementById('currentPrice').textContent = '$' + STARTING_PRICE.toLocaleString();
  document.getElementById('lockButtonContainer').classList.remove('hidden');

  timedAuctionInterval = setInterval(() => {
    currentPrice -= DROP_PER_SECOND;
    if (currentPrice < 0) currentPrice = 0;
    document.getElementById('currentPrice').textContent = '$' + currentPrice.toLocaleString();

    if (currentPrice <= 0) {
      clearInterval(timedAuctionInterval);
      document.getElementById('currentPrice').textContent = '$0 (Reserve price reached)';
      document.getElementById('lockButtonContainer').classList.add('hidden');
    }
  }, 1000);
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
        document.getElementById('lockButtonContainer').classList.add('hidden');
        document.getElementById('lockMessage').classList.remove('hidden');
      }
    })
    .catch(err => console.error('Lock error:', err));
}

function displayTimedLock(data) {
  clearInterval(timedAuctionInterval);
  document.getElementById('lockButtonContainer').classList.add('hidden');
  document.getElementById('lockMessage').classList.remove('hidden');
  document.getElementById('lockedPrice').textContent = data.price.toLocaleString();
  document.getElementById('choiceWaitingContainer').classList.remove('hidden');
}

function respondTimed(choice) {
  fetch(`/api/session/${sessionId}/buysell/${currentPair.pairId}/final-choice`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ choice }),
  })
    .then(res => res.json())
    .then(data => {
      if (data.ok) {
        document.getElementById('choiceWaitingContainer').classList.add('hidden');
        document.getElementById('timedAuctionContainer').innerHTML =
          '<div class="status-message">✓ Complete! Remedy: ' + data.remedy + '</div>';
      }
    })
    .catch(err => console.error('Final choice error:', err));
}

function displayBuySellComplete(data) {
  // Update live display
  loadSession();
  if (currentPair) {
    updateLiveShotgunDisplay();
  }
}

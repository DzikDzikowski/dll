const URL_SKLADY = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRGrmAtBoNiMpuQCt7TpNIPS9jpda25BBd6PMhFOdTLXsi1sIwwYB-UfiAkQ7w9T4wPpO7c6ZGfhPoB/pub?gid=0&single=true&output=csv';
const URL_LISTA_DRUZYN = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRGrmAtBoNiMpuQCt7TpNIPS9jpda25BBd6PMhFOdTLXsi1sIwwYB-UfiAkQ7w9T4wPpO7c6ZGfhPoB/pub?gid=1075690206&single=true&output=csv';
const URL_WYNIKI = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRGrmAtBoNiMpuQCt7TpNIPS9jpda25BBd6PMhFOdTLXsi1sIwwYB-UfiAkQ7w9T4wPpO7c6ZGfhPoB/pub?gid=309145836&single=true&output=csv';

const CORE_ROLES = ['Top', 'Jg', 'Mid', 'ADC', 'Sup', 'Adc', 'Jungle'];
let allRosters = [];
let listTeamsData = [];
let resultsData = [];
let teamLogos = {};
let loadedCount = 0;

function switchTab(tabId, btnElement) {
    document.querySelectorAll('.section-view').forEach(sec => sec.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));

    document.getElementById(`${tabId}-section`).classList.add('active');
    if(btnElement) btnElement.classList.add('active');
}

function loadAllData() {
    Papa.parse(URL_SKLADY, {
        download: true, header: false, skipEmptyLines: true,
        complete: function(results) {
            const rows = results.data.slice(1);
            let playerMap = {};
            rows.forEach(row => {
                const druzyna = (row[0] || '').trim();
                const nick = (row[1] || '').trim();
                if (!druzyna || !nick) return;

                const key = `${druzyna.toLowerCase()}_${nick.toLowerCase()}`;
                if (!playerMap[key]) {
                    playerMap[key] = {
                        druzyna: druzyna,
                        nick: nick,
                        discordid: (row[2] || '').trim(),
                        roles: [],
                        op_gg_east: (row[4] || '').trim(),
                        op_gg_west: (row[5] || '').trim(),
                        avatar: (row[6] || '').trim()
                    };
                }
                const role = (row[3] || '').trim();
                if (role) {
                    role.split(',').forEach(r => {
                        const cleanR = r.trim();
                        if (cleanR && !playerMap[key].roles.includes(cleanR)) {
                            playerMap[key].roles.push(cleanR);
                        }
                    });
                }
            });
            allRosters = Object.values(playerMap);
            checkLoaded();
        }
    });

    Papa.parse(URL_LISTA_DRUZYN, {
        download: true, header: false, skipEmptyLines: true,
        complete: function(results) {
            const rows = results.data.slice(1);
            listTeamsData = [];
            rows.forEach(row => {
                const team = (row[0] || '').trim();
                const logo = (row[1] || '').trim();
                if(team) {
                    listTeamsData.push({ druzyna: team });
                    if(logo) {
                        teamLogos[team.toLowerCase()] = logo;
                    }
                }
            });
            checkLoaded();
        }
    });

    Papa.parse(URL_WYNIKI, {
        download: true, header: false, skipEmptyLines: true,
        complete: function(results) {
            const rows = results.data.slice(1);
            resultsData = rows.map(row => ({
                kolejka: (row[0] || '').trim(),
                gospodarz: (row[1] || '').trim(),
                gosc: (row[2] || '').trim(),
                wynik: (row[3] || '').trim(),
                data: (row[4] || '').trim()
            })).filter(m => m.gospodarz && m.gosc);
            checkLoaded();
        }
    });
}

function checkLoaded() {
    loadedCount++;
    if (loadedCount === 3) {
        document.getElementById('loading').style.display = 'none';
        setupTeamButtons();
        renderTable();
        renderResults();
    }
}

function setupTeamButtons() {
    const teams = [...new Set(listTeamsData.map(item => item.druzyna))];
    const btnContainer = document.getElementById('team-buttons');
    btnContainer.innerHTML = '';

    if(teams.length === 0) return;

    // Dzielimy drużyny na pół (główny rząd i dolny rząd)
    const midPoint = Math.ceil(teams.length / 2);
    const topTeams = teams.slice(0, midPoint);
    const bottomTeams = teams.slice(midPoint);

    const createRow = (rowTeams) => {
        const rowDiv = document.createElement('div');
        rowDiv.className = 'teams-row';
        if(bottomTeams.length > 0 && rowTeams === topTeams) {
            rowDiv.style.marginBottom = '12px'; // Odstęp między rzędami
        }

        rowTeams.forEach(team => {
            const btn = document.createElement('button');
            // Pierwsza drużyna domyślnie aktywna
            const isFirst = (teams[0] === team);
            btn.className = `team-btn ${isFirst ? 'active' : ''}`;
            
            const logoUrl = teamLogos[team.toLowerCase()];
            const logoHtml = logoUrl ? `<img src="${logoUrl}" alt="${team}">` : '';

            btn.innerHTML = `${logoHtml} ${team}`;
            btn.onclick = () => selectTeam(team, btn);
            rowDiv.appendChild(btn);
        });

        return rowDiv;
    };

    btnContainer.appendChild(createRow(topTeams));
    if(bottomTeams.length > 0) {
        btnContainer.appendChild(createRow(bottomTeams));
    }

    if(teams.length > 0) {
        selectTeam(teams[0], btnContainer.querySelector('.team-btn'));
    }
}
function selectTeam(teamName, btnElement) {
    document.querySelectorAll('.team-btn').forEach(b => b.classList.remove('active'));
    if(btnElement) btnElement.classList.add('active');

    document.getElementById('current-team-name').innerText = `SKŁAD ${teamName.toUpperCase()}`;
    const teamPlayers = allRosters.filter(p => p.druzyna.toLowerCase() === teamName.toLowerCase());
    renderRoster(teamPlayers, teamName);
}

function renderRoster(players, teamName) {
    const container = document.getElementById('roster-content');
    container.innerHTML = '';

    const teamLogo = teamLogos[teamName.toLowerCase()];
    const ownerKeywords = ['owner', 'właściciel', 'wlasciciel'];
    const standardCoreRoles = ['top', 'jg', 'jungle', 'mid', 'adc', 'sup'];

    // 1. Skład podstawowy
    container.appendChild(createCategoryTitle('Podstawowy skład'));
    const coreGrid = document.createElement('div');
    coreGrid.className = 'grid';
    
    ['Top', 'Jg', 'Mid', 'Adc', 'Sup'].forEach(role => {
        const player = players.find(p => {
            return p.roles.some(r => r.toLowerCase() === role.toLowerCase());
        });
        coreGrid.appendChild(createPlayerCard(player, role, teamLogo));
    });
    container.appendChild(coreGrid);

    // 2. Sztab Szkoleniowy
    const staffRoles = ['trener', 'asystent', 'asystent trenera', 'coach', 'manager', 'menedżer', 'owner', 'właściciel', 'wlasciciel'];
    const staffPlayers = players.filter(p => {
        const hasStaffRole = p.roles.some(r => staffRoles.includes(r.toLowerCase()));
        const hasCoreRole = p.roles.some(r => standardCoreRoles.includes(r.toLowerCase()));
        const isPureOwnerManager = p.roles.every(r => ownerKeywords.includes(r.toLowerCase()) || ['manager', 'menedżer'].includes(r.toLowerCase()));

        return hasStaffRole && (!hasCoreRole || isPureOwnerManager);
    });

    if(staffPlayers.length > 0) {
        container.appendChild(createCategoryTitle('Sztab Szkoleniowy'));
        const staffGrid = document.createElement('div');
        staffGrid.className = 'grid';
        staffPlayers.forEach(p => {
            let mainRole = p.roles.find(r => ['trener', 'asystent', 'asystent trenera', 'coach', 'manager', 'menedżer'].includes(r.toLowerCase())) || 'Sztab';
            if (p.roles.some(r => ownerKeywords.includes(r.toLowerCase()))) {
                mainRole = 'Owner';
            }
            staffGrid.appendChild(createPlayerCard(p, mainRole, teamLogo));
        });
        container.appendChild(staffGrid);
    }

    // 3. Rezerwowi
    const subPlayers = players.filter(p => {
        const isSubRole = p.roles.some(r => ['sub', 'rezerwowy', 'substitute'].includes(r.toLowerCase()));
        const hasCoreRole = p.roles.some(r => standardCoreRoles.includes(r.toLowerCase()));
        return isSubRole && !hasCoreRole;
    });

    if(subPlayers.length > 0) {
        container.appendChild(createCategoryTitle('Rezerwowi'));
        const subGrid = document.createElement('div');
        subGrid.className = 'grid';
        subPlayers.forEach(p => {
            const mainRole = p.roles.find(r => ['sub', 'rezerwowy', 'substitute'].includes(r.toLowerCase())) || 'Sub';
            subGrid.appendChild(createPlayerCard(p, mainRole, teamLogo));
        });
        container.appendChild(subGrid);
    }
}

function createCategoryTitle(text) {
    const div = document.createElement('div');
    div.className = 'category-title';
    div.innerText = text;
    return div;
}

function createPlayerCard(player, defaultRole, teamLogo) {
    const card = document.createElement('div');
    if (!player) {
        card.className = 'card empty-slot';
        card.innerHTML = `
            <div class="avatar-box"><span class="role-badge">${defaultRole}</span><div class="default-avatar">?</div></div>
            <div class="card-body"><div class="player-nick">Brak zawodnika</div></div>
            <div class="card-footer"><span class="opgg-btn disabled">EUNE</span><span class="opgg-btn disabled">EUW</span></div>
        `;
        return card;
    }

    let avatarHtml = '';
    if (player.avatar) {
        avatarHtml = `<img src="${player.avatar}" alt="${player.nick}">`;
    } else if (teamLogo) {
        avatarHtml = `<img src="${teamLogo}" alt="Logo drużyny" class="team-logo-avatar">`;
    } else {
        avatarHtml = `<div class="default-avatar">🛡️</div>`;
    }

    const ownerKeywords = ['owner', 'właściciel', 'wlasciciel'];
    const isOwner = player.roles.some(r => ownerKeywords.includes(r.toLowerCase()));
    const ribbonHtml = isOwner ? `<div class="owner-ribbon">Owner</div>` : '';

    const euneBtn = player.op_gg_east ? `<a href="${player.op_gg_east}" target="_blank" class="opgg-btn">EUNE</a>` : `<span class="opgg-btn disabled">EUNE</span>`;
    const euwBtn = player.op_gg_west ? `<a href="${player.op_gg_west}" target="_blank" class="opgg-btn">EUW</a>` : `<span class="opgg-btn disabled">EUW</span>`;

    card.className = 'card';
    card.innerHTML = `
        <div class="avatar-box">
            <span class="role-badge">${defaultRole}</span>
            ${ribbonHtml}
            ${avatarHtml}
        </div>
        <div class="card-body">
            <div class="player-nick">${player.nick}</div>
            ${player.discordid ? `<div class="discord-tag">${player.discordid}</div>` : ''}
        </div>
        <div class="card-footer">${euneBtn}${euwBtn}</div>
    `;
    return card;
}

function renderTable() {
    const container = document.getElementById('table-content');
    const teamNames = listTeamsData.map(row => row.druzyna);
    
    if(teamNames.length === 0) {
        container.innerHTML = '<p style="text-align:center; color:#6b7a90; margin-top:30px;">Brak drużyn na liście.</p>';
        return;
    }

    let stats = {};
    teamNames.forEach(team => {
        stats[team.toLowerCase()] = {
            name: team,
            played: 0,
            wins: 0,
            losses: 0,
            mapsWon: 0,
            mapsLost: 0,
            points: 0
        };
    });

    resultsData.forEach(match => {
        const home = match.gospodarz.toLowerCase();
        const away = match.gosc.toLowerCase();
        const scoreMatch = match.wynik.match(/(\d+)\s*[:\-]\s*(\d+)/);

        if(scoreMatch && stats[home] && stats[away]) {
            const homeMaps = parseInt(scoreMatch[1]);
            const awayMaps = parseInt(scoreMatch[2]);

            stats[home].played++;
            stats[away].played++;

            stats[home].mapsWon += homeMaps;
            stats[home].mapsLost += awayMaps;
            stats[away].mapsWon += awayMaps;
            stats[away].mapsLost += homeMaps;

            if(homeMaps === 2 && awayMaps === 0) {
                stats[home].wins++;
                stats[home].points += 5;
                stats[away].losses++;
            } else if(homeMaps === 2 && awayMaps === 1) {
                stats[home].wins++;
                stats[home].points += 3;
                stats[away].losses++;
                stats[away].points += 1;
            } else if(homeMaps === 1 && awayMaps === 2) {
                stats[away].wins++;
                stats[away].points += 3;
                stats[home].losses++;
                stats[home].points += 1;
            } else if(homeMaps === 0 && awayMaps === 2) {
                stats[away].wins++;
                stats[away].points += 5;
                stats[home].losses++;
            }
        }
    });

    let sortedTeams = Object.values(stats).sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        const diffA = a.mapsWon - a.mapsLost;
        const diffB = b.mapsWon - b.mapsLost;
        if (diffB !== diffA) return diffB - diffA;
        return b.mapsWon - a.mapsWon;
    });

    let html = `
        <table class="league-table">
            <thead>
                <tr>
                    <th>Poz</th>
                    <th>Drużyna</th>
                    <th>M</th>
                    <th>W</th>
                    <th>P</th>
                    <th>Bilans</th>
                    <th>Pkt</th>
                </tr>
            </thead>
            <tbody>
    `;

    sortedTeams.forEach((teamObj, index) => {
        const logoUrl = teamLogos[teamObj.name.toLowerCase()];
        const logoHtml = logoUrl ? `<img src="${logoUrl}" alt="">` : '';
        const mapDiff = teamObj.mapsWon - teamObj.mapsLost;
        const diffStr = (mapDiff > 0 ? '+' : '') + mapDiff;

        html += `
            <tr>
                <td><strong>${index + 1}</strong></td>
                <td>
                    <div class="table-team-cell">
                        ${logoHtml}
                        <strong>${teamObj.name}</strong>
                    </div>
                </td>
                <td>${teamObj.played}</td>
                <td style="color: #00ff88;">${teamObj.wins}</td>
                <td style="color: #ff4444;">${teamObj.losses}</td>
                <td>${teamObj.mapsWon}:${teamObj.mapsLost} (${diffStr})</td>
                <td><strong style="color: #ffd700;">${teamObj.points}</strong></td>
            </tr>
        `;
    });

    html += `</tbody></table>`;
    container.innerHTML = html;
}

function renderResults() {
    const container = document.getElementById('results-content');
    if(resultsData.length === 0) {
        container.innerHTML = '<p style="text-align:center; color:#6b7a90; margin-top:30px;">Brak rozegranych meczów.</p>';
        return;
    }

    let html = '';
    resultsData.forEach(match => {
        const homeLogoUrl = teamLogos[match.gospodarz.toLowerCase()];
        const awayLogoUrl = teamLogos[match.gosc.toLowerCase()];

        const homeLogoHtml = homeLogoUrl ? `<img src="${homeLogoUrl}" alt="">` : '';
        const awayLogoHtml = awayLogoUrl ? `<img src="${awayLogoUrl}" alt="">` : '';

        html += `
            <div class="result-card">
                <div>
                    <div class="match-info">Kolejka ${match.kolejka} ${match.data ? '• ' + match.data : ''}</div>
                    <div class="match-teams-container">
                        <div class="match-team">${homeLogoHtml} <span>${match.gospodarz}</span></div>
                        <span style="color:#6b7a90; font-weight:normal; margin:0 5px;">vs</span>
                        <div class="match-team">${awayLogoHtml} <span>${match.gosc}</span></div>
                    </div>
                </div>
                <div class="match-score">${match.wynik}</div>
            </div>
        `;
    });
    container.innerHTML = html;
}

loadAllData();
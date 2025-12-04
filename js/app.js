let currentTerms = {
    tracks: 'medium_term',
    artists: 'medium_term'
};

// Playback State
let isPlaying = false;
let currentProgressMs = 0;
let currentDurationMs = 0;
let lastUpdateTime = 0;
let playbackTimer = null;

async function loadData() {
    try {
        // Add timestamp to prevent caching
        const response = await fetch('data/data.json?t=' + new Date().getTime());
        if (!response.ok) throw new Error('Failed to load data');
        const data = await response.json();

        updateNowPlaying(data.current_playback);
        updateTopTracks(data.top_tracks[currentTerms.tracks]);
        updateTopArtists(data.top_artists[currentTerms.artists]);
        updateRecentlyPlayed(data.recently_played);

    } catch (error) {
        console.error(error);
        renderOfflineState();

        const errorMsg = 'Waiting for data... (Run fetch_spotify_data.py)';
        document.querySelectorAll('.loading').forEach(el => el.textContent = errorMsg);
    }
}

function renderOfflineState() {
    const container = document.getElementById('now-playing-container');
    container.style.display = 'block';

    document.getElementById('np-image').src = 'https://via.placeholder.com/120/333333/FFFFFF?text=OFFLINE';
    document.getElementById('np-title').textContent = 'Connection Lost';
    document.getElementById('np-artist').textContent = 'Check if fetch_spotify_data.py is running';
    const bar = document.getElementById('np-bar');
    if (bar) bar.style.width = '0%';
    document.getElementById('np-time').textContent = '0:00 / 0:00';
}

function updateNowPlaying(current) {
    const container = document.getElementById('now-playing-container');
    container.style.display = 'block';

    if (current && current.item) {
        const item = current.item;

        document.getElementById('np-title').innerHTML = `<a href="${item.external_urls.spotify}" class="spotify-link" target="_blank">${item.name}</a>`;
        document.getElementById('np-artist').innerHTML = item.artists.map(a => `<a href="${a.external_urls.spotify}" class="spotify-link" target="_blank">${a.name}</a>`).join(', ');
        document.getElementById('np-image').src = item.album.images[0]?.url || '';

        // Update State
        isPlaying = current.is_playing;
        currentProgressMs = current.progress_ms;
        currentDurationMs = item.duration_ms;
        lastUpdateTime = Date.now();

        updatePlaybackUI();

    } else {
        // Idle State
        isPlaying = false;
        document.getElementById('np-image').src = 'https://via.placeholder.com/120/1db954/FFFFFF?text=IDLE';
        document.getElementById('np-title').textContent = 'Not Playing';
        document.getElementById('np-artist').textContent = 'Take a break...';
        document.getElementById('np-bar').style.width = '0%';
        document.getElementById('np-time').textContent = '0:00 / 0:00';
    }
}

function updatePlaybackUI() {
    if (currentDurationMs > 0) {
        const progressPercent = (currentProgressMs / currentDurationMs) * 100;
        document.getElementById('np-bar').style.width = `${Math.min(progressPercent, 100)}%`;

        const currentStr = formatTime(currentProgressMs);
        const durationStr = formatTime(currentDurationMs);
        document.getElementById('np-time').textContent = `${currentStr} / ${durationStr}`;
    }
}

function formatTime(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function startPlaybackTimer() {
    if (playbackTimer) clearInterval(playbackTimer);

    playbackTimer = setInterval(() => {
        if (isPlaying) {
            // Estimate progress based on elapsed time since last update
            const now = Date.now();
            const elapsed = now - lastUpdateTime;

            // Increment progress (but don't exceed duration)
            if (currentProgressMs < currentDurationMs) {
                currentProgressMs += 1000; // Increment by 1 second
                lastUpdateTime = now; // Reset base time
                updatePlaybackUI();
            }
        }
    }, 1000);
}

function setTerm(type, term) {
    currentTerms[type] = term;
    updateActiveButton(`${type}-term`, term);
    loadData(); // Reload immediately
}

function updateTopTracks(tracks) {
    const list = document.getElementById('top-tracks-list');
    if (!tracks || tracks.length === 0) {
        list.innerHTML = '<div class="loading">No data available.</div>';
        return;
    }

    list.innerHTML = tracks.map((track, index) => {
        const img = track.album.images[2]?.url || track.album.images[0]?.url || 'https://via.placeholder.com/50';
        const artistNames = track.artists.map(a => a.name).join(', ');

        return `
            <li class="list-item">
                <div class="rank">${index + 1}</div>
                <img src="${img}" class="art-img" alt="${track.name}">
                <div class="info">
                    <span class="title"><a href="${track.external_urls.spotify}" class="spotify-link" target="_blank">${track.name}</a></span>
                    <span class="artist">${track.artists.map(a => `<a href="${a.external_urls.spotify}" class="spotify-link" target="_blank">${a.name}</a>`).join(', ')}</span>
                </div>
            </li>
        `;
    }).join('');
}

function updateTopArtists(artists) {
    const list = document.getElementById('top-artists-list');
    if (!artists || artists.length === 0) {
        list.innerHTML = '<div class="loading">No data available.</div>';
        return;
    }

    list.innerHTML = artists.map((artist, index) => {
        const img = artist.images[2]?.url || artist.images[0]?.url || 'https://via.placeholder.com/50';
        const genres = artist.genres.slice(0, 2).map(g => `<span class="genre-tag">${g}</span>`).join('');

        return `
            <li class="list-item">
                <div class="rank">${index + 1}</div>
                <img src="${img}" class="art-img" alt="${artist.name}">
                <div class="info">
                    <span class="title"><a href="${artist.external_urls.spotify}" class="spotify-link" target="_blank">${artist.name}</a></span>
                    <div>${genres}</div>
                </div>
            </li>
        `;
    }).join('');
}

function updateRecentlyPlayed(recent) {
    const list = document.getElementById('recent-list');
    if (!recent || recent.length === 0) {
        list.innerHTML = '<div class="loading">No recent history found.</div>';
        return;
    }

    list.innerHTML = recent.map((item, index) => {
        const track = item.track;
        const img = track.album.images[2]?.url || track.album.images[0]?.url || 'https://via.placeholder.com/50';
        const artistNames = track.artists.map(a => a.name).join(', ');
        const playedAt = new Date(item.played_at).toLocaleString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

        return `
            <li class="list-item">
                <img src="${img}" class="art-img" alt="${track.name}">
                <div class="info">
                    <span class="title"><a href="${track.external_urls.spotify}" class="spotify-link" target="_blank">${track.name}</a></span>
                    <span class="artist">${track.artists.map(a => `<a href="${a.external_urls.spotify}" class="spotify-link" target="_blank">${a.name}</a>`).join(', ')}</span>
                </div>
                <div class="played-at">${playedAt}</div>
            </li>
        `;
    }).join('');
}

function updateActiveButton(parentId, term) {
    const parent = document.getElementById(parentId);
    parent.querySelectorAll('.term-btn').forEach(btn => {
        if (btn.getAttribute('onclick').includes(term)) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
}

// Initial load
loadData();
startPlaybackTimer();

// Poll every 10 seconds (API matches this)
setInterval(loadData, 10000);

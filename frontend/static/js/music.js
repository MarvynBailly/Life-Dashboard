/**
 * Music Page
 */

let musicRefreshInterval = null;

document.addEventListener('DOMContentLoaded', function() {
    loadNowPlaying();
    loadTopArtists();

    // Refresh now playing every 15 seconds
    musicRefreshInterval = setInterval(() => {
        loadNowPlaying();
    }, 15000);
});

async function loadNowPlaying() {
    try {
        const response = await fetch('/api/lastfm/nowplaying');
        const track = await response.json();

        const albumArt = document.getElementById('album-art');
        const trackTitle = document.getElementById('track-title');
        const trackArtist = document.getElementById('track-artist');
        const trackAlbum = document.getElementById('track-album');
        const playingIndicator = document.getElementById('playing-indicator');

        if (track && !track.error) {
            if (albumArt) albumArt.src = track.album_art || '/static/img/default-album.png';
            if (trackTitle) trackTitle.textContent = track.title || 'Not Playing';
            if (trackArtist) trackArtist.textContent = track.artist || '--';
            if (trackAlbum) trackAlbum.textContent = track.album || '';
            if (playingIndicator) {
                playingIndicator.style.display = track.is_playing ? 'flex' : 'none';
            }
        } else {
            if (trackTitle) trackTitle.textContent = 'Not Playing';
            if (trackArtist) trackArtist.textContent = '--';
            if (playingIndicator) playingIndicator.style.display = 'none';
        }

    } catch (error) {
        console.error('Error loading now playing:', error);
    }
}

async function loadTopArtists() {
    try {
        const response = await fetch('/api/lastfm/top?type=artists&period=7day&limit=10');
        const artists = await response.json();

        if (charts.topArtists) charts.topArtists.destroy();
        charts.topArtists = createTopArtistsChart('chart-top-artists', artists);

    } catch (error) {
        console.error('Error loading top artists:', error);
    }
}

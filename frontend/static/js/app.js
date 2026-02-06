/**
 * Life Dashboard - Main Application
 */

// Global state
let charts = {};
let refreshInterval = null;
let notesOffset = 0;
let journalOffset = 0;
const NOTES_LIMIT = 10;
const JOURNAL_LIMIT = 10;

/**
 * Initialize the dashboard
 */
async function initDashboard() {
    console.log('Initializing Life Dashboard...');

    // Load all data
    await Promise.all([
        loadStats(),
        loadWakaTimeData(),
        loadActivityWatch(),
        loadGitHubData(),
        loadTodos(),
        loadNotes(),
        loadNowPlaying(),
        loadQuote(),
        loadTopArtists(),
        loadJournalEntries()
    ]);

    // Set up event listeners
    setupEventListeners();

    // Start auto-refresh for now playing
    startAutoRefresh();

    console.log('Dashboard initialized');
}

/**
 * Set up event listeners
 */
function setupEventListeners() {
    // Refresh button
    document.getElementById('refresh-btn')?.addEventListener('click', refreshAllData);

    // Date range selector
    document.getElementById('date-range')?.addEventListener('change', (e) => {
        loadWakaTimeData(e.target.value);
    });

    // Todo input
    document.getElementById('todo-input')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addTodo();
    });
    document.getElementById('add-todo-btn')?.addEventListener('click', addTodo);

    // Quote refresh
    document.getElementById('refresh-quote-btn')?.addEventListener('click', loadQuote);

    // Journal write
    document.getElementById('write-journal-btn')?.addEventListener('click', showJournalModal);

    // Note add
    document.getElementById('add-note-btn')?.addEventListener('click', showAddNoteModal);
}

/**
 * Start auto-refresh for now playing
 */
function startAutoRefresh() {
    // Refresh now playing every 15 seconds
    refreshInterval = setInterval(() => {
        loadNowPlaying();
    }, 15000);
}

/**
 * Refresh all data
 */
async function refreshAllData() {
    const btn = document.getElementById('refresh-btn');
    if (btn) {
        btn.disabled = true;
        btn.textContent = '⏳';
    }

    await Promise.all([
        loadStats(),
        loadWakaTimeData(),
        loadActivityWatch(),
        loadGitHubData(),
        loadTodos(),
        loadNotes(),
        loadNowPlaying(),
        loadTopArtists()
    ]);

    if (btn) {
        btn.disabled = false;
        btn.textContent = '🔄';
    }
}

/**
 * Load header statistics
 */
async function loadStats() {
    try {
        const response = await fetch('/api/stats/summary');
        const data = await response.json();

        document.getElementById('stat-coding-time').textContent =
            data.coding?.total_time || '0 hrs';
        document.getElementById('stat-active-todos').textContent =
            data.productivity?.active_todos || 0;
        document.getElementById('stat-journal-streak').textContent =
            data.productivity?.journal_streak || 0;
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

/**
 * Load WakaTime data and render charts
 */
async function loadWakaTimeData(range = 'last_7_days') {
    try {
        // Load stats
        const statsResponse = await fetch(`/api/wakatime/stats?range=${range}`);
        const stats = await statsResponse.json();

        if (stats && !stats.error) {
            // Update projects chart and list
            if (charts.projects) charts.projects.destroy();
            charts.projects = createProjectsChart('chart-projects', stats.projects);
            updateStatsList('projects-list', stats.projects);

            // Update languages chart and list
            if (charts.languages) charts.languages.destroy();
            charts.languages = createLanguagesChart('chart-languages', stats.languages);
            updateStatsList('languages-list', stats.languages);

            // Update editors chart
            if (charts.editors) charts.editors.destroy();
            charts.editors = createEditorsChart('chart-editors', stats.editors);

            // Update OS chart
            if (charts.os) charts.os.destroy();
            charts.os = createOSChart('chart-os', stats.operating_systems);
        }

        // Load summaries for line chart
        const summariesResponse = await fetch('/api/wakatime/summaries?days=7');
        const summaries = await summariesResponse.json();

        if (summaries && summaries.length > 0) {
            // Update coding activity chart
            if (charts.codingActivity) charts.codingActivity.destroy();
            charts.codingActivity = createCodingActivityChart('chart-coding-activity', summaries);

            // Update weekly heatmap
            generateWeeklyHeatmap('weekly-heatmap', summaries);

            // Update today's total
            const today = summaries[summaries.length - 1];
            if (today) {
                document.getElementById('today-total').textContent = today.total_text || '0 hrs 0 mins';
            }
        }

        // Load today's heartbeats and ActivityWatch timeline in parallel
        const [heartbeatsResponse, awTimelineResponse] = await Promise.all([
            fetch('/api/wakatime/heartbeats'),
            fetch('/api/activitywatch/timeline').catch(() => null)
        ]);
        const heartbeats = await heartbeatsResponse.json();
        const awTimeline = awTimelineResponse ? await awTimelineResponse.json().catch(() => []) : [];

        // Create the combined timeline visualization
        createTodayTimeline('timeline-rows', heartbeats, awTimeline);

        // Calculate today's total from heartbeats data
        if (heartbeats && heartbeats.length > 0) {
            const totalSeconds = heartbeats.reduce((sum, item) => sum + (item.duration || 0), 0);
            const hours = Math.floor(totalSeconds / 3600);
            const minutes = Math.floor((totalSeconds % 3600) / 60);
            document.getElementById('today-total').textContent = `${hours} hrs ${minutes} mins`;
        }

    } catch (error) {
        console.error('Error loading WakaTime data:', error);
    }
}

/**
 * Load ActivityWatch data and render charts
 */
async function loadActivityWatch() {
    try {
        // Load summary (today since midnight) and AFK timeline in parallel
        const [summaryResponse, afkTimelineResponse] = await Promise.all([
            fetch('/api/activitywatch/summary?today=true'),
            fetch('/api/activitywatch/afk-timeline').catch(() => null)
        ]);
        const summary = await summaryResponse.json();
        const afkTimeline = afkTimelineResponse ? await afkTimelineResponse.json().catch(() => []) : [];

        if (summary && !summary.error) {
            // Update app usage chart
            if (charts.appUsage) charts.appUsage.destroy();
            charts.appUsage = createAppUsageChart('chart-app-usage', summary.apps);
            updateAppUsageList('app-usage-list', summary.apps);

            // Update screen time stats
            const activeDisplay = document.getElementById('aw-active-display');
            const afkDisplay = document.getElementById('aw-afk-display');
            const activeTime = document.getElementById('aw-active-time');
            const activeBar = document.getElementById('aw-active-bar');

            if (activeDisplay) activeDisplay.textContent = summary.total_active_text || '0 hrs 0 mins';
            if (afkDisplay) afkDisplay.textContent = summary.afk_text || '0 hrs 0 mins';
            if (activeTime) activeTime.textContent = summary.total_active_text || '--';

            // Calculate percentage for progress bar
            const totalTime = summary.total_active_time + summary.afk_time;
            if (totalTime > 0 && activeBar) {
                const activePercent = (summary.total_active_time / totalTime) * 100;
                activeBar.style.width = `${activePercent}%`;
            }
        } else {
            // Show error state
            const chartContainer = document.getElementById('chart-app-usage');
            if (chartContainer) {
                chartContainer.innerHTML = '<div class="text-center text-dim">ActivityWatch not available<br><small>Make sure it\'s running on localhost:5600</small></div>';
            }
        }

        // Render AFK timeline
        createAfkTimeline('afk-timeline-rows', afkTimeline);

    } catch (error) {
        console.error('Error loading ActivityWatch data:', error);
        const chartContainer = document.getElementById('chart-app-usage');
        if (chartContainer) {
            chartContainer.innerHTML = '<div class="text-center text-dim">ActivityWatch not available<br><small>Make sure it\'s running on localhost:5600</small></div>';
        }
    }
}

/**
 * Load GitHub data and render charts
 */
async function loadGitHubData() {
    try {
        const [reposResponse, contributionsResponse] = await Promise.all([
            fetch('/api/github/repos?per_page=10'),
            fetch('/api/github/contributions?days=30')
        ]);

        const repos = await reposResponse.json();
        const contributions = await contributionsResponse.json();

        // Repos chart and list
        if (repos && repos.length > 0) {
            if (charts.githubRepos) charts.githubRepos.destroy();
            charts.githubRepos = createGitHubReposChart('chart-github-repos', repos);
        } else {
            const reposContainer = document.getElementById('chart-github-repos');
            if (reposContainer) {
                reposContainer.innerHTML = '<div class="text-center text-dim">GitHub not configured<br><small>Set GITHUB_TOKEN to enable</small></div>';
            }
        }

        // Contributions chart
        if (contributions && contributions.daily && contributions.daily.length > 0) {
            if (charts.githubContributions) charts.githubContributions.destroy();
            charts.githubContributions = createGitHubContributionsChart('chart-github-contributions', contributions.daily);

            const totalEl = document.getElementById('github-total-commits');
            if (totalEl) {
                totalEl.textContent = `${contributions.total_commits} commits (${contributions.days}d)`;
            }
        } else {
            const contribContainer = document.getElementById('chart-github-contributions');
            if (contribContainer) {
                contribContainer.innerHTML = '<div class="text-center text-dim">GitHub not configured<br><small>Set GITHUB_TOKEN and GITHUB_USERNAME to enable</small></div>';
            }
        }

    } catch (error) {
        console.error('Error loading GitHub data:', error);
        const reposContainer = document.getElementById('chart-github-repos');
        if (reposContainer) {
            reposContainer.innerHTML = '<div class="text-center text-dim">GitHub not available</div>';
        }
    }
}

/**
 * Update GitHub repos list
 */
function updateGitHubReposList(listId, repos) {
    const list = document.querySelector(`#${listId}`);
    if (!list || !repos || repos.length === 0) {
        if (list) list.innerHTML = '';
        return;
    }

    const topRepos = repos.slice(0, 5);
    list.innerHTML = topRepos.map((repo, index) => `
        <li class="stats-list-item">
            <span class="stats-list-label">
                <span class="stats-list-dot" style="background-color: ${chartColors[index % chartColors.length]}"></span>
                <span class="stats-list-name">${escapeHtml(repo.name)}</span>
                ${repo.private ? '<span class="text-dim" style="font-size: 0.7em; margin-left: 4px;">private</span>' : ''}
            </span>
            <span class="stats-list-value">${repo.language || 'N/A'}</span>
        </li>
    `).join('');
}

/**
 * Update app usage list with items
 */
function updateAppUsageList(listId, items) {
    const list = document.querySelector(`#${listId}`);
    if (!list || !items || items.length === 0) {
        if (list) list.innerHTML = '';
        return;
    }

    const topItems = items.slice(0, 5);
    const chartColors = ['#3b82f6', '#14b8a6', '#22c55e', '#eab308', '#f97316', '#8b5cf6', '#ec4899', '#06b6d4'];

    list.innerHTML = topItems.map((item, index) => `
        <li class="stats-list-item">
            <span class="stats-list-label">
                <span class="stats-list-dot" style="background-color: ${chartColors[index % chartColors.length]}"></span>
                <span class="stats-list-name">${escapeHtml(item.name)}</span>
            </span>
            <span class="stats-list-value">${item.text || formatAppDuration(item.seconds)}</span>
        </li>
    `).join('');
}

/**
 * Format seconds for app usage display
 */
function formatAppDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
}

/**
 * Load and display todos
 */
async function loadTodos() {
    try {
        const response = await fetch('/api/todos/active?limit=20');
        const todos = await response.json();

        const todoList = document.getElementById('todo-list');
        const todoCount = document.getElementById('todo-count');

        if (!todoList) return;

        if (!todos || todos.length === 0) {
            todoList.innerHTML = '<li class="text-center text-dim">No active tasks</li>';
            if (todoCount) todoCount.textContent = '0 tasks';
            return;
        }

        todoList.innerHTML = todos.map(todo => `
            <li class="todo-item ${todo.status === 'completed' ? 'completed' : ''}" data-id="${todo.id}">
                <div class="todo-checkbox ${todo.status === 'completed' ? 'checked' : ''}"
                     onclick="toggleTodo(${todo.id})"></div>
                <span class="todo-text" style="margin-left: ${todo.indent_level * 20}px">${escapeHtml(todo.text)}</span>
                ${todo.priority > 0 ? `<span class="todo-priority">P${todo.priority}</span>` : ''}
            </li>
        `).join('');

        if (todoCount) {
            todoCount.textContent = `${todos.length} task${todos.length !== 1 ? 's' : ''}`;
        }

    } catch (error) {
        console.error('Error loading todos:', error);
    }
}

/**
 * Add a new todo
 */
async function addTodo() {
    const input = document.getElementById('todo-input');
    const text = input?.value.trim();

    if (!text) return;

    try {
        const response = await fetch('/api/todos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text })
        });

        if (response.ok) {
            input.value = '';
            await loadTodos();
            await loadStats();
        }
    } catch (error) {
        console.error('Error adding todo:', error);
    }
}

/**
 * Toggle todo completion
 */
async function toggleTodo(todoId) {
    try {
        const response = await fetch(`/api/todos/${todoId}/toggle`, {
            method: 'POST'
        });

        if (response.ok) {
            await loadTodos();
            await loadStats();
        }
    } catch (error) {
        console.error('Error toggling todo:', error);
    }
}

/**
 * Load and display notes with pagination
 */
async function loadNotes(append = false) {
    try {
        if (!append) notesOffset = 0;

        const response = await fetch(`/api/notes?limit=${NOTES_LIMIT}&offset=${notesOffset}`);
        const notes = await response.json();

        const notesList = document.getElementById('notes-list');
        if (!notesList) return;

        if (!notes || notes.length === 0) {
            if (!append) {
                notesList.innerHTML = '<div class="text-center text-dim">No notes yet</div>';
            }
            // Remove load more button if no more notes
            document.getElementById('load-more-notes')?.remove();
            return;
        }

        const notesHtml = notes.map(note => `
            <div class="note-item" onclick="viewNote(${note.id})">
                ${note.title ? `<div class="note-title">${escapeHtml(note.title)}</div>` : ''}
                <div class="note-preview">${renderInlineMarkdown(note.content.substring(0, 150))}${note.content.length > 150 ? '...' : ''}</div>
                <div class="note-date">${formatDate(note.note_date)}</div>
            </div>
        `).join('');

        if (append) {
            // Remove existing load more button before appending
            document.getElementById('load-more-notes')?.remove();
            notesList.insertAdjacentHTML('beforeend', notesHtml);
        } else {
            notesList.innerHTML = notesHtml;
        }

        // Add load more button if we got a full page
        if (notes.length === NOTES_LIMIT) {
            notesList.insertAdjacentHTML('beforeend', `
                <button class="btn btn-secondary load-more-btn" id="load-more-notes" onclick="loadMoreNotes()">
                    Load More
                </button>
            `);
        }

        notesOffset += notes.length;

    } catch (error) {
        console.error('Error loading notes:', error);
    }
}

/**
 * Load more notes
 */
function loadMoreNotes() {
    loadNotes(true);
}

/**
 * View a note in a modal
 */
async function viewNote(noteId) {
    try {
        const response = await fetch(`/api/notes/${noteId}`);
        const note = await response.json();

        if (note.detail) {
            alert('Note not found');
            return;
        }

        // Create modal
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal modal-wide">
                <div class="modal-header">
                    <h3 id="note-modal-title">${note.title ? escapeHtml(note.title) : 'Note'}</h3>
                    <button class="btn btn-icon modal-close" onclick="closeModal(this)">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="note-date-display">${formatDate(note.note_date)}</div>
                    <div id="note-view-content">
                        <div class="markdown-content">${renderMarkdown(note.content)}</div>
                    </div>
                    <div id="note-edit-content" style="display: none;">
                        <input type="text" class="form-input" id="edit-note-title" value="${note.title ? escapeHtml(note.title) : ''}" placeholder="Title (optional)">
                        <div class="markdown-editor">
                            <div class="editor-pane">
                                <div class="pane-header">Markdown</div>
                                <textarea class="form-textarea" id="edit-note-content">${escapeHtml(note.content)}</textarea>
                            </div>
                            <div class="preview-pane">
                                <div class="pane-header">Preview</div>
                                <div class="preview-content markdown-content" id="edit-note-preview"></div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <div id="note-view-actions">
                        <button class="btn btn-secondary" onclick="closeModal(this)">Close</button>
                        <button class="btn btn-primary" onclick="toggleEditNote(${note.id})">Edit</button>
                        <button class="btn btn-danger" onclick="deleteNote(${note.id}, this)">Delete</button>
                    </div>
                    <div id="note-edit-actions" style="display: none;">
                        <button class="btn btn-secondary" onclick="cancelEditNote()">Cancel</button>
                        <button class="btn btn-primary" onclick="saveEditNote(${note.id}, this)">Save</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        // Close on backdrop click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal(modal.querySelector('.modal-close'));
        });
    } catch (error) {
        console.error('Error viewing note:', error);
    }
}

/**
 * Toggle edit mode for note
 */
function toggleEditNote(noteId) {
    document.getElementById('note-view-content').style.display = 'none';
    document.getElementById('note-edit-content').style.display = 'block';
    document.getElementById('note-view-actions').style.display = 'none';
    document.getElementById('note-edit-actions').style.display = 'flex';
    setupLivePreview('edit-note-content', 'edit-note-preview');
    document.getElementById('edit-note-content')?.focus();
}

/**
 * Cancel editing note
 */
function cancelEditNote() {
    document.getElementById('note-view-content').style.display = 'block';
    document.getElementById('note-edit-content').style.display = 'none';
    document.getElementById('note-view-actions').style.display = 'flex';
    document.getElementById('note-edit-actions').style.display = 'none';
}

/**
 * Save edited note
 */
async function saveEditNote(noteId, btn) {
    const title = document.getElementById('edit-note-title')?.value.trim();
    const content = document.getElementById('edit-note-content')?.value.trim();

    if (!content) {
        alert('Please enter note content');
        return;
    }

    try {
        const response = await fetch(`/api/notes/${noteId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: title || null, content })
        });

        if (response.ok) {
            // Update the view content with the new values
            const viewContent = document.getElementById('note-view-content');
            const modalTitle = document.getElementById('note-modal-title');

            if (viewContent) {
                viewContent.innerHTML = `<div class="markdown-content">${renderMarkdown(content)}</div>`;
            }
            if (modalTitle) {
                modalTitle.textContent = title || 'Note';
            }

            // Switch back to view mode
            cancelEditNote();

            // Refresh the notes list in the background
            loadNotes();
        } else {
            alert('Failed to save note');
        }
    } catch (error) {
        console.error('Error saving note:', error);
        alert('Error saving note');
    }
}

/**
 * Show add note modal
 */
function showAddNoteModal() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal modal-wide">
            <div class="modal-header">
                <h3>New Note</h3>
                <button class="btn btn-icon modal-close" onclick="closeModal(this)">&times;</button>
            </div>
            <div class="modal-body">
                <input type="text" class="form-input" id="new-note-title" placeholder="Title (optional)">
                <div class="markdown-editor">
                    <div class="editor-pane">
                        <div class="pane-header">Markdown</div>
                        <textarea class="form-textarea" id="new-note-content" placeholder="Write your note using markdown..."></textarea>
                    </div>
                    <div class="preview-pane">
                        <div class="pane-header">Preview</div>
                        <div class="preview-content markdown-content" id="new-note-preview"></div>
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="closeModal(this)">Cancel</button>
                <button class="btn btn-primary" onclick="saveNewNote(this)">Save Note</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    // Set up live preview and focus
    setTimeout(() => {
        setupLivePreview('new-note-content', 'new-note-preview');
        document.getElementById('new-note-content')?.focus();
    }, 100);

    // Close on backdrop click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal(modal.querySelector('.modal-close'));
    });
}

/**
 * Save a new note
 */
async function saveNewNote(btn) {
    const title = document.getElementById('new-note-title')?.value.trim();
    const content = document.getElementById('new-note-content')?.value.trim();

    if (!content) {
        alert('Please enter note content');
        return;
    }

    try {
        const response = await fetch('/api/notes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: title || null, content })
        });

        if (response.ok) {
            closeModal(btn);
            await loadNotes();
        } else {
            alert('Failed to save note');
        }
    } catch (error) {
        console.error('Error saving note:', error);
        alert('Error saving note');
    }
}

/**
 * Delete a note
 */
async function deleteNote(noteId, btn) {
    if (!confirm('Are you sure you want to delete this note?')) return;

    try {
        const response = await fetch(`/api/notes/${noteId}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            closeModal(btn);
            await loadNotes();
        } else {
            alert('Failed to delete note');
        }
    } catch (error) {
        console.error('Error deleting note:', error);
    }
}

/**
 * Close a modal
 */
function closeModal(element) {
    const modal = element.closest('.modal-overlay');
    if (modal) modal.remove();
}

/**
 * Load now playing from Last.fm
 */
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

/**
 * Load top artists
 */
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

/**
 * Load a quote
 */
async function loadQuote() {
    try {
        const response = await fetch('/api/quotes?count=1');
        const quotes = await response.json();

        const quoteText = document.getElementById('quote-text');
        const quoteAuthor = document.getElementById('quote-author');

        if (quotes && quotes.length > 0) {
            const quote = quotes[0];
            if (quoteText) quoteText.textContent = quote.quote;
            if (quoteAuthor) quoteAuthor.textContent = quote.author;
        }

    } catch (error) {
        console.error('Error loading quote:', error);
    }
}

/**
 * Load journal entries with pagination
 */
async function loadJournalEntries(append = false) {
    try {
        if (!append) journalOffset = 0;

        // Load entries and streak in parallel
        const [entriesResponse, streakResponse] = await Promise.all([
            fetch(`/api/journal?limit=${JOURNAL_LIMIT}&offset=${journalOffset}`),
            fetch('/api/journal/streak')
        ]);

        const entries = await entriesResponse.json();
        const streakData = await streakResponse.json();

        // Update streak display
        const streakDisplay = document.getElementById('journal-streak-display');
        if (streakDisplay) {
            streakDisplay.textContent = streakData.streak || 0;
        }

        // Check if today's entry exists
        const today = new Date().toISOString().split('T')[0];
        const hasTodayEntry = entries.some(e => e.entry_date === today);
        const todayIndicator = document.getElementById('journal-today-indicator');
        if (todayIndicator) {
            todayIndicator.style.display = hasTodayEntry ? 'none' : 'flex';
        }

        const journalList = document.getElementById('journal-list');
        if (!journalList) return;

        if (!entries || entries.length === 0) {
            if (!append) {
                journalList.innerHTML = '<div class="text-center text-dim">No journal entries yet</div>';
            }
            document.getElementById('load-more-journal')?.remove();
            return;
        }

        const entriesHtml = entries.map(entry => `
            <div class="journal-item" onclick="viewJournalEntry('${entry.entry_date}')">
                <div class="journal-item-header">
                    <span class="journal-date">${formatJournalDate(entry.entry_date)}</span>
                    ${entry.mood ? `<span class="journal-mood">${getMoodEmoji(entry.mood)}</span>` : ''}
                </div>
                <div class="journal-preview">${renderInlineMarkdown(entry.content.substring(0, 150))}${entry.content.length > 150 ? '...' : ''}</div>
            </div>
        `).join('');

        if (append) {
            document.getElementById('load-more-journal')?.remove();
            journalList.insertAdjacentHTML('beforeend', entriesHtml);
        } else {
            journalList.innerHTML = entriesHtml;
        }

        // Add load more button if we got a full page
        if (entries.length === JOURNAL_LIMIT) {
            journalList.insertAdjacentHTML('beforeend', `
                <button class="btn btn-secondary load-more-btn" id="load-more-journal" onclick="loadMoreJournal()">
                    Load More
                </button>
            `);
        }

        journalOffset += entries.length;

    } catch (error) {
        console.error('Error loading journal entries:', error);
    }
}

/**
 * Load more journal entries
 */
function loadMoreJournal() {
    loadJournalEntries(true);
}

/**
 * View a journal entry in a modal
 */
async function viewJournalEntry(entryDate) {
    try {
        const response = await fetch(`/api/journal/${entryDate}`);
        const entry = await response.json();

        if (entry.detail) {
            alert('Journal entry not found');
            return;
        }

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal modal-wide">
                <div class="modal-header">
                    <h3 id="journal-modal-title">${formatJournalDate(entry.entry_date)} ${entry.mood ? getMoodEmoji(entry.mood) : ''}</h3>
                    <button class="btn btn-icon modal-close" onclick="closeModal(this)">&times;</button>
                </div>
                <div class="modal-body">
                    <div id="journal-view-content">
                        <div class="markdown-content">${renderMarkdown(entry.content)}</div>
                    </div>
                    <div id="journal-edit-content" style="display: none;">
                        <div class="markdown-editor">
                            <div class="editor-pane">
                                <div class="pane-header">Markdown</div>
                                <textarea class="form-textarea" id="edit-journal-content">${escapeHtml(entry.content)}</textarea>
                            </div>
                            <div class="preview-pane">
                                <div class="pane-header">Preview</div>
                                <div class="preview-content markdown-content" id="edit-journal-preview"></div>
                            </div>
                        </div>
                        <div class="mood-selector mt-sm">
                            <label class="text-secondary">Mood:</label>
                            <div class="mood-options">
                                ${[1,2,3,4,5].map(m => `
                                    <button class="mood-btn ${entry.mood === m ? 'active' : ''}" data-mood="${m}" onclick="selectMood(this, ${m})">${getMoodEmoji(m)}</button>
                                `).join('')}
                            </div>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <div id="journal-view-actions">
                        <button class="btn btn-secondary" onclick="closeModal(this)">Close</button>
                        <button class="btn btn-primary" onclick="toggleEditJournal('${entry.entry_date}')">Edit</button>
                    </div>
                    <div id="journal-edit-actions" style="display: none;">
                        <button class="btn btn-secondary" onclick="cancelEditJournal()">Cancel</button>
                        <button class="btn btn-primary" onclick="saveEditJournal('${entry.entry_date}', this)">Save</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal(modal.querySelector('.modal-close'));
        });
    } catch (error) {
        console.error('Error viewing journal entry:', error);
    }
}

/**
 * Show journal modal for writing/editing
 */
function showJournalModal(existingEntry = null) {
    // Handle case when called as event handler (receives MouseEvent)
    if (existingEntry instanceof Event) existingEntry = null;

    const today = new Date().toISOString().split('T')[0];
    const isEdit = existingEntry !== null && existingEntry.entry_date;
    const initialDate = isEdit ? existingEntry.entry_date : today;

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal modal-wide">
            <div class="modal-header">
                <h3>${isEdit ? 'Edit Journal Entry' : 'New Journal Entry'}</h3>
                <button class="btn btn-icon modal-close" onclick="closeModal(this)">&times;</button>
            </div>
            <div class="modal-body">
                <div class="journal-date-picker">
                    <label class="text-secondary">Date:</label>
                    <input type="date" class="form-input" id="journal-date-input" value="${initialDate}" max="${today}">
                </div>
                <div class="markdown-editor">
                    <div class="editor-pane">
                        <div class="pane-header">Markdown</div>
                        <textarea class="form-textarea" id="new-journal-content" placeholder="How was your day? What's on your mind? (supports markdown)">${isEdit ? escapeHtml(existingEntry.content) : ''}</textarea>
                    </div>
                    <div class="preview-pane">
                        <div class="pane-header">Preview</div>
                        <div class="preview-content markdown-content" id="new-journal-preview"></div>
                    </div>
                </div>
                <div class="mood-selector mt-sm">
                    <label class="text-secondary">How are you feeling?</label>
                    <div class="mood-options">
                        ${[1,2,3,4,5].map(m => `
                            <button class="mood-btn ${isEdit && existingEntry.mood === m ? 'active' : ''}" data-mood="${m}" onclick="selectMood(this, ${m})">${getMoodEmoji(m)}</button>
                        `).join('')}
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="closeModal(this)">Cancel</button>
                <button class="btn btn-primary" onclick="saveJournalEntry(this)">Save Entry</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    // When date changes, check if entry exists for that date and pre-fill
    const dateInput = document.getElementById('journal-date-input');
    dateInput.addEventListener('change', async () => {
        const selectedDate = dateInput.value;
        const contentArea = document.getElementById('new-journal-content');
        const preview = document.getElementById('new-journal-preview');
        try {
            const res = await fetch(`/api/journal/${selectedDate}`);
            if (res.ok) {
                const entry = await res.json();
                if (entry && !entry.detail) {
                    contentArea.value = entry.content;
                    // Clear all mood buttons and set the right one
                    document.querySelectorAll('.mood-btn').forEach(b => b.classList.remove('active'));
                    if (entry.mood) {
                        document.querySelector(`.mood-btn[data-mood="${entry.mood}"]`)?.classList.add('active');
                    }
                }
            } else {
                // No entry for this date, clear the form
                contentArea.value = '';
                document.querySelectorAll('.mood-btn').forEach(b => b.classList.remove('active'));
            }
            // Update preview after content change
            if (preview) preview.innerHTML = renderMarkdown(contentArea.value);
        } catch (e) {
            // Ignore errors
        }
    });

    // Check if initial date's entry exists and pre-fill
    fetch(`/api/journal/${initialDate}`)
        .then(res => res.ok ? res.json() : null)
        .then(entry => {
            if (entry && !entry.detail) {
                const contentArea = document.getElementById('new-journal-content');
                const preview = document.getElementById('new-journal-preview');
                contentArea.value = entry.content;
                if (entry.mood) {
                    document.querySelector(`.mood-btn[data-mood="${entry.mood}"]`)?.classList.add('active');
                }
                // Update preview after content change
                if (preview) preview.innerHTML = renderMarkdown(contentArea.value);
            }
        })
        .catch(() => {});

    // Set up live preview and focus
    setTimeout(() => {
        setupLivePreview('new-journal-content', 'new-journal-preview');
        document.getElementById('new-journal-content')?.focus();
    }, 100);

    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal(modal.querySelector('.modal-close'));
    });
}

/**
 * Select mood in modal
 */
function selectMood(btn, mood) {
    // Remove active from all mood buttons in the same container
    btn.parentElement.querySelectorAll('.mood-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
}

/**
 * Get selected mood from modal
 */
function getSelectedMood() {
    const activeBtn = document.querySelector('.mood-btn.active');
    return activeBtn ? parseInt(activeBtn.dataset.mood) : null;
}

/**
 * Save journal entry
 */
async function saveJournalEntry(btn) {
    const content = document.getElementById('new-journal-content')?.value.trim();
    const mood = getSelectedMood();
    const entryDate = document.getElementById('journal-date-input')?.value;

    if (!content) {
        alert('Please write something in your journal');
        return;
    }

    if (!entryDate) {
        alert('Please select a date');
        return;
    }

    try {
        const response = await fetch('/api/journal', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content, mood, entry_date: entryDate })
        });

        if (response.ok) {
            closeModal(btn);
            await loadJournalEntries();
            await loadStats();
        } else {
            alert('Failed to save journal entry');
        }
    } catch (error) {
        console.error('Error saving journal entry:', error);
        alert('Error saving journal entry');
    }
}

/**
 * Toggle edit mode for journal
 */
function toggleEditJournal(entryDate) {
    document.getElementById('journal-view-content').style.display = 'none';
    document.getElementById('journal-edit-content').style.display = 'block';
    document.getElementById('journal-view-actions').style.display = 'none';
    document.getElementById('journal-edit-actions').style.display = 'flex';
    setupLivePreview('edit-journal-content', 'edit-journal-preview');
    document.getElementById('edit-journal-content')?.focus();
}

/**
 * Cancel editing journal
 */
function cancelEditJournal() {
    document.getElementById('journal-view-content').style.display = 'block';
    document.getElementById('journal-edit-content').style.display = 'none';
    document.getElementById('journal-view-actions').style.display = 'flex';
    document.getElementById('journal-edit-actions').style.display = 'none';
}

/**
 * Save edited journal entry
 */
async function saveEditJournal(entryDate, btn) {
    const content = document.getElementById('edit-journal-content')?.value.trim();
    const mood = getSelectedMood();

    if (!content) {
        alert('Please enter journal content');
        return;
    }

    try {
        const response = await fetch(`/api/journal/${entryDate}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content, mood })
        });

        if (response.ok) {
            const viewContent = document.getElementById('journal-view-content');
            const modalTitle = document.getElementById('journal-modal-title');

            if (viewContent) {
                viewContent.innerHTML = `<div class="markdown-content">${renderMarkdown(content)}</div>`;
            }
            if (modalTitle) {
                modalTitle.textContent = `${formatJournalDate(entryDate)} ${mood ? getMoodEmoji(mood) : ''}`;
            }

            cancelEditJournal();
            loadJournalEntries();
        } else {
            alert('Failed to save journal entry');
        }
    } catch (error) {
        console.error('Error saving journal entry:', error);
        alert('Error saving journal entry');
    }
}

/**
 * Format journal date for display
 */
function formatJournalDate(dateString) {
    const date = new Date(dateString + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const entryDate = new Date(date);
    entryDate.setHours(0, 0, 0, 0);

    const diffDays = Math.floor((today - entryDate) / (1000 * 60 * 60 * 24));

    const fullDate = date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined
    });

    if (diffDays === 0) return `Today · ${fullDate}`;
    if (diffDays === 1) return `Yesterday · ${fullDate}`;

    return fullDate;
}

/**
 * Get mood emoji
 */
function getMoodEmoji(mood) {
    const moods = {
        1: '😢',
        2: '😕',
        3: '😐',
        4: '🙂',
        5: '😊'
    };
    return moods[mood] || '';
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Render markdown to HTML safely
 */
function renderMarkdown(text) {
    if (!text) return '<span class="preview-placeholder">Nothing to preview</span>';
    try {
        // Configure marked for safety
        marked.setOptions({
            breaks: true,      // Convert \n to <br>
            gfm: true,         // GitHub Flavored Markdown
            headerIds: false,  // Don't add IDs to headers
            mangle: false      // Don't escape email addresses
        });
        return marked.parse(text);
    } catch (e) {
        console.error('Markdown render error:', e);
        return escapeHtml(text).replace(/\n/g, '<br>');
    }
}

/**
 * Render inline markdown only (for previews)
 * Handles: headers, bold, italic, code, strikethrough
 */
function renderInlineMarkdown(text) {
    if (!text) return '';
    // Escape HTML first
    let html = escapeHtml(text);
    // Headers: # text -> bold (strip the # symbols for preview)
    html = html.replace(/^#{1,6}\s+(.+?)$/gm, '<strong>$1</strong>');
    html = html.replace(/\s#{1,6}\s+/g, ' '); // Handle mid-text headers
    // Bold: **text** or __text__
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');
    // Italic: *text* or _text_ (but not inside words)
    html = html.replace(/\*([^\s*].*?[^\s*])\*/g, '<em>$1</em>');
    html = html.replace(/\*([^\s*])\*/g, '<em>$1</em>');
    // Inline code: `text`
    html = html.replace(/`(.+?)`/g, '<code>$1</code>');
    // Strikethrough: ~~text~~
    html = html.replace(/~~(.+?)~~/g, '<del>$1</del>');
    return html;
}

/**
 * Set up live preview for a markdown editor
 */
function setupLivePreview(textareaId, previewId) {
    const textarea = document.getElementById(textareaId);
    const preview = document.getElementById(previewId);
    if (!textarea || !preview) return;

    const updatePreview = () => {
        preview.innerHTML = renderMarkdown(textarea.value);
    };

    textarea.addEventListener('input', updatePreview);
    updatePreview(); // Initial render
}

/**
 * Format date for display
 */
function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;

    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
}

/**
 * Create a WakaTime-style timeline visualization for today's coding activity
 */
function createTodayTimeline(containerId, durations, awEvents) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const hasWakaTime = durations && durations.length > 0;
    const hasAW = awEvents && awEvents.length > 0;

    // If no data from either source, show empty message
    if (!hasWakaTime && !hasAW) {
        container.innerHTML = '<div class="timeline-empty">No activity yet today</div>';
        return;
    }

    // Color palettes
    const wakaColors = [
        '#3b82f6', // Blue
        '#8b5cf6', // Purple
        '#14b8a6', // Teal
        '#22c55e', // Green
        '#eab308', // Yellow
        '#f97316', // Orange
        '#ec4899', // Pink
        '#06b6d4', // Cyan
    ];

    const awColors = [
        '#f97316', // Orange
        '#ec4899', // Pink
        '#06b6d4', // Cyan
        '#eab308', // Yellow
        '#a855f7', // Violet
        '#10b981', // Emerald
        '#f43f5e', // Rose
        '#84cc16', // Lime
    ];

    // Get today's date boundaries (midnight to midnight)
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() / 1000;

    let html = '';

    // Helper to build timeline rows for a grouped dataset
    function buildTimelineRows(groupedData, colors, maxRows) {
        let rowsHtml = '';
        const sorted = Object.entries(groupedData)
            .sort((a, b) => b[1].totalSeconds - a[1].totalSeconds)
            .slice(0, maxRows);

        sorted.forEach(([name, data], index) => {
            const color = colors[index % colors.length];
            const hours = Math.floor(data.totalSeconds / 3600);
            const minutes = Math.floor((data.totalSeconds % 3600) / 60);
            const timeStr = hours > 0 ? `${hours}:${minutes.toString().padStart(2, '0')}` : `${minutes}m`;

            rowsHtml += `
                <div class="timeline-row">
                    <div class="timeline-label">
                        <span class="timeline-label-name" title="${escapeHtml(name)}">${escapeHtml(name)}</span>
                        <span class="timeline-label-time">${timeStr}</span>
                    </div>
                    <div class="timeline-track">
            `;

            data.blocks.forEach(block => {
                const startPercent = Math.max(0, ((block.start - todayStart) / 86400) * 100);
                const widthPercent = Math.max(0.5, (block.duration / 86400) * 100);

                if (startPercent < 100 && startPercent >= 0) {
                    rowsHtml += `<div class="timeline-block" style="left: ${startPercent}%; width: ${widthPercent}%; background-color: ${color};" title="${escapeHtml(name)}: ${formatTimelineTooltip(block.start, block.duration)}"></div>`;
                }
            });

            rowsHtml += `
                    </div>
                </div>
            `;
        });
        return rowsHtml;
    }

    // Clean up app names (strip .exe, prettify known apps)
    function cleanAppName(raw) {
        let name = raw.replace(/\.exe$/i, '');
        const prettyNames = {
            'Code': 'VS Code',
            'WindowsTerminal': 'Terminal',
            'vivaldi': 'Vivaldi',
            'firefox': 'Firefox',
            'chrome': 'Chrome',
            'explorer': 'Explorer',
            'Spotify': 'Spotify',
            'slack': 'Slack',
            'Discord': 'Discord',
            'SnippingTool': 'Snipping Tool',
            'Obsidian': 'Obsidian',
        };
        return prettyNames[name] || name;
    }

    // --- ActivityWatch: Apps section ---
    if (hasAW) {
        const appData = {};
        awEvents.forEach(item => {
            const app = cleanAppName(item.app || 'Unknown');
            if (!appData[app]) {
                appData[app] = { totalSeconds: 0, blocks: [] };
            }
            appData[app].totalSeconds += item.duration || 0;
            appData[app].blocks.push({
                start: item.time,
                duration: item.duration
            });
        });

        html += '<div class="timeline-section-label">Apps</div>';
        html += buildTimelineRows(appData, awColors, 8);
    }

    // --- WakaTime: Languages section ---
    if (hasWakaTime) {
        const languageData = {};
        durations.forEach(item => {
            const lang = item.language || 'Other';
            if (!languageData[lang]) {
                languageData[lang] = { totalSeconds: 0, blocks: [] };
            }
            languageData[lang].totalSeconds += item.duration || 0;
            languageData[lang].blocks.push({
                start: item.time,
                duration: item.duration
            });
        });

        if (hasAW) {
            html += '<div class="timeline-section-divider"></div>';
        }
        html += '<div class="timeline-section-label">Languages</div>';
        html += buildTimelineRows(languageData, wakaColors, 8);
    }

    container.innerHTML = html;
}

/**
 * Format tooltip for timeline blocks
 */
function formatTimelineTooltip(startTimestamp, durationSeconds) {
    const startDate = new Date(startTimestamp * 1000);
    const hours = startDate.getHours();
    const minutes = startDate.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const hour12 = hours % 12 || 12;
    const startTime = `${hour12}:${minutes.toString().padStart(2, '0')} ${ampm}`;

    const durMins = Math.round(durationSeconds / 60);
    const durStr = durMins >= 60 ? `${Math.floor(durMins / 60)}h ${durMins % 60}m` : `${durMins}m`;

    return `${startTime} (${durStr})`;
}

/**
 * Create a single-track timeline visualization for AFK/Active periods.
 * Both active (green) and AFK (yellow) blocks are rendered on one track,
 * with a label row showing totals for each.
 */
function createAfkTimeline(containerId, events) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (!events || events.length === 0) {
        container.innerHTML = '<div class="timeline-empty">No data yet today</div>';
        return;
    }

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() / 1000;

    // Calculate totals per status
    let activeTotal = 0, afkTotal = 0;
    events.forEach(e => {
        if (e.status === 'afk') afkTotal += e.duration;
        else activeTotal += e.duration;
    });

    function fmtDur(s) {
        const h = Math.floor(s / 3600);
        const m = Math.floor((s % 3600) / 60);
        return h > 0 ? `${h}:${m.toString().padStart(2, '0')}` : `${m}m`;
    }

    // Build single-track timeline with both statuses on one row
    let html = `
        <div class="timeline-row">
            <div class="timeline-label">
                <span class="timeline-label-name">Activity</span>
            </div>
            <div class="timeline-track">
    `;

    // Sort all events by time and render on one track
    const sorted = [...events].sort((a, b) => a.time - b.time);
    sorted.forEach(e => {
        const color = e.status === 'afk' ? 'var(--accent-yellow)' : 'var(--accent-green)';
        const label = e.status === 'afk' ? 'AFK' : 'Active';
        const startPercent = Math.max(0, ((e.time - todayStart) / 86400) * 100);
        const widthPercent = Math.max(0.15, (e.duration / 86400) * 100);

        if (startPercent < 100 && startPercent >= 0) {
            html += `<div class="timeline-block" style="left: ${startPercent}%; width: ${widthPercent}%; background-color: ${color};" title="${label}: ${formatTimelineTooltip(e.time, e.duration)}"></div>`;
        }
    });

    html += `
            </div>
        </div>
        <div class="afk-timeline-legend">
            <span class="legend-item"><span class="legend-dot" style="background: var(--accent-green);"></span> Active ${fmtDur(activeTotal)}</span>
            <span class="legend-item"><span class="legend-dot" style="background: var(--accent-yellow);"></span> AFK ${fmtDur(afkTotal)}</span>
        </div>
    `;

    container.innerHTML = html;
}

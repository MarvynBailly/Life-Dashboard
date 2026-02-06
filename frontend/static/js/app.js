/**
 * Life Dashboard - Main Application
 */

// Global state
let charts = {};

/**
 * Initialize the dashboard
 */
async function initDashboard() {
    console.log('Initializing Life Dashboard...');

    // Load all data
    await Promise.all([
        loadWakaTimeData(),
        loadActivityWatch(),
        loadGitHubData()
    ]);

    // Set up event listeners
    setupEventListeners();

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
        loadWakaTimeData(),
        loadActivityWatch(),
        loadGitHubData()
    ]);

    if (btn) {
        btn.disabled = false;
        btn.textContent = '🔄';
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
 * Close a modal
 */
function closeModal(element) {
    const modal = element.closest('.modal-overlay');
    if (modal) modal.remove();
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

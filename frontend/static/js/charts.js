/**
 * Life Dashboard - Chart Configuration
 * ApexCharts setup with WakaTime-inspired styling
 */

// Chart color palette
const chartColors = [
    '#3b82f6', // Blue
    '#14b8a6', // Teal
    '#22c55e', // Green
    '#eab308', // Yellow
    '#f97316', // Orange
    '#8b5cf6', // Purple
    '#ec4899', // Pink
    '#06b6d4', // Cyan
];

// Common chart theme options
const darkTheme = {
    mode: 'dark',
    palette: 'palette1',
    monochrome: {
        enabled: false
    }
};

// Common chart options
const commonOptions = {
    chart: {
        background: 'transparent',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        toolbar: {
            show: false
        },
        animations: {
            enabled: true,
            easing: 'easeinout',
            speed: 800
        }
    },
    theme: darkTheme,
    colors: chartColors,
    grid: {
        borderColor: '#374151',
        strokeDashArray: 3
    },
    tooltip: {
        theme: 'dark',
        style: {
            fontSize: '12px'
        }
    },
    legend: {
        labels: {
            colors: '#9ca3af'
        }
    },
    xaxis: {
        labels: {
            style: {
                colors: '#9ca3af',
                fontSize: '11px'
            }
        },
        axisBorder: {
            color: '#374151'
        },
        axisTicks: {
            color: '#374151'
        }
    },
    yaxis: {
        labels: {
            style: {
                colors: '#9ca3af',
                fontSize: '11px'
            }
        }
    }
};

/**
 * Create a line chart for coding activity over time
 */
function createCodingActivityChart(containerId, data) {
    const options = {
        ...commonOptions,
        chart: {
            ...commonOptions.chart,
            type: 'area',
            height: 280
        },
        series: [{
            name: 'Coding Time',
            data: data.map(d => Math.round(d.total_seconds / 3600 * 10) / 10) // Convert to hours
        }],
        xaxis: {
            ...commonOptions.xaxis,
            type: 'category',
            categories: data.map(d => {
                const date = new Date(d.date + 'T00:00:00');
                return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            }),
            tickPlacement: 'on'
        },
        yaxis: {
            ...commonOptions.yaxis,
            title: {
                text: 'Hours',
                style: {
                    color: '#9ca3af'
                }
            },
            min: 0
        },
        stroke: {
            curve: 'smooth',
            width: 3
        },
        fill: {
            type: 'gradient',
            gradient: {
                shadeIntensity: 1,
                opacityFrom: 0.4,
                opacityTo: 0.1,
                stops: [0, 90, 100]
            }
        },
        dataLabels: {
            enabled: false
        },
        markers: {
            size: 4,
            hover: {
                size: 6
            }
        }
    };

    const chart = new ApexCharts(document.querySelector(`#${containerId}`), options);
    chart.render();
    return chart;
}

/**
 * Create a bar chart for today's hourly breakdown
 */
function createTodayBreakdownChart(containerId, data) {
    // Generate hourly data (24 hours)
    const hourlyData = Array(24).fill(0);
    if (data && data.length > 0) {
        data.forEach(item => {
            // WakaTime uses 'time' for timestamp, ActivityWatch uses 'timestamp'
            const timestamp = item.time || item.timestamp;
            if (timestamp) {
                const hour = new Date(timestamp * 1000).getHours();
                hourlyData[hour] += item.duration / 60; // Convert to minutes
            }
        });
    }

    const options = {
        ...commonOptions,
        chart: {
            ...commonOptions.chart,
            type: 'bar',
            height: 280
        },
        series: [{
            name: 'Minutes',
            data: hourlyData
        }],
        plotOptions: {
            bar: {
                borderRadius: 2,
                columnWidth: '60%'
            }
        },
        xaxis: {
            ...commonOptions.xaxis,
            categories: Array.from({length: 24}, (_, i) => `${i}:00`),
            labels: {
                ...commonOptions.xaxis.labels,
                rotate: -45,
                rotateAlways: true
            }
        },
        yaxis: {
            ...commonOptions.yaxis,
            title: {
                text: 'Minutes',
                style: {
                    color: '#9ca3af'
                }
            }
        },
        dataLabels: {
            enabled: false
        }
    };

    const chart = new ApexCharts(document.querySelector(`#${containerId}`), options);
    chart.render();
    return chart;
}

/**
 * Create a horizontal bar chart for projects
 */
function createProjectsChart(containerId, data) {
    if (!data || data.length === 0) {
        document.querySelector(`#${containerId}`).innerHTML = '<div class="text-center text-dim">No project data available</div>';
        return null;
    }

    const topProjects = data.slice(0, 8);

    const options = {
        ...commonOptions,
        chart: {
            ...commonOptions.chart,
            type: 'bar',
            height: 200
        },
        series: [{
            name: 'Hours',
            data: topProjects.map(p => Math.round(p.total_seconds / 3600 * 10) / 10)
        }],
        plotOptions: {
            bar: {
                horizontal: true,
                borderRadius: 4,
                barHeight: '70%',
                distributed: true
            }
        },
        xaxis: {
            ...commonOptions.xaxis,
            categories: topProjects.map(p => p.name)
        },
        yaxis: {
            ...commonOptions.yaxis,
            labels: {
                ...commonOptions.yaxis.labels,
                maxWidth: 150
            }
        },
        dataLabels: {
            enabled: true,
            formatter: val => `${val}h`,
            style: {
                fontSize: '11px'
            }
        },
        legend: {
            show: false
        }
    };

    const chart = new ApexCharts(document.querySelector(`#${containerId}`), options);
    chart.render();
    return chart;
}

/**
 * Create a donut chart for languages
 */
function createLanguagesChart(containerId, data) {
    if (!data || data.length === 0) {
        document.querySelector(`#${containerId}`).innerHTML = '<div class="text-center text-dim">No language data available</div>';
        return null;
    }

    const topLanguages = data.slice(0, 6);

    const options = {
        ...commonOptions,
        chart: {
            ...commonOptions.chart,
            type: 'donut',
            height: 200
        },
        series: topLanguages.map(l => Math.round(l.total_seconds / 60)), // Minutes
        labels: topLanguages.map(l => l.name),
        plotOptions: {
            pie: {
                donut: {
                    size: '65%',
                    labels: {
                        show: true,
                        name: {
                            show: true,
                            fontSize: '14px',
                            color: '#e4e7eb'
                        },
                        value: {
                            show: true,
                            fontSize: '20px',
                            color: '#e4e7eb',
                            formatter: val => `${Math.round(val / 60)}h`
                        },
                        total: {
                            show: true,
                            label: 'Total',
                            color: '#9ca3af',
                            formatter: w => {
                                const total = w.globals.seriesTotals.reduce((a, b) => a + b, 0);
                                return `${Math.round(total / 60)}h`;
                            }
                        }
                    }
                }
            }
        },
        dataLabels: {
            enabled: false
        },
        legend: {
            position: 'bottom',
            horizontalAlign: 'center'
        }
    };

    const chart = new ApexCharts(document.querySelector(`#${containerId}`), options);
    chart.render();
    return chart;
}

/**
 * Create a donut chart for editors
 */
function createEditorsChart(containerId, data) {
    if (!data || data.length === 0) {
        document.querySelector(`#${containerId}`).innerHTML = '<div class="text-center text-dim">No editor data available</div>';
        return null;
    }

    const options = {
        ...commonOptions,
        chart: {
            ...commonOptions.chart,
            type: 'donut',
            height: 150
        },
        series: data.map(e => Math.round(e.total_seconds / 60)),
        labels: data.map(e => e.name),
        plotOptions: {
            pie: {
                donut: {
                    size: '60%'
                }
            }
        },
        dataLabels: {
            enabled: false
        },
        legend: {
            position: 'right',
            fontSize: '11px'
        }
    };

    const chart = new ApexCharts(document.querySelector(`#${containerId}`), options);
    chart.render();
    return chart;
}

/**
 * Create a donut chart for operating systems
 */
function createOSChart(containerId, data) {
    if (!data || data.length === 0) {
        document.querySelector(`#${containerId}`).innerHTML = '<div class="text-center text-dim">No OS data available</div>';
        return null;
    }

    const options = {
        ...commonOptions,
        chart: {
            ...commonOptions.chart,
            type: 'donut',
            height: 150
        },
        series: data.map(os => Math.round(os.total_seconds / 60)),
        labels: data.map(os => os.name),
        plotOptions: {
            pie: {
                donut: {
                    size: '60%'
                }
            }
        },
        dataLabels: {
            enabled: false
        },
        legend: {
            position: 'right',
            fontSize: '11px'
        }
    };

    const chart = new ApexCharts(document.querySelector(`#${containerId}`), options);
    chart.render();
    return chart;
}

/**
 * Create a bar chart for top artists
 */
function createTopArtistsChart(containerId, data) {
    if (!data || data.length === 0) {
        document.querySelector(`#${containerId}`).innerHTML = '<div class="text-center text-dim">No music data available</div>';
        return null;
    }

    const topArtists = data.slice(0, 10);

    const options = {
        ...commonOptions,
        chart: {
            ...commonOptions.chart,
            type: 'bar',
            height: 200
        },
        series: [{
            name: 'Plays',
            data: topArtists.map(a => a.playcount)
        }],
        plotOptions: {
            bar: {
                borderRadius: 4,
                columnWidth: '60%',
                distributed: true
            }
        },
        xaxis: {
            ...commonOptions.xaxis,
            categories: topArtists.map(a => a.name),
            labels: {
                ...commonOptions.xaxis.labels,
                rotate: -45,
                rotateAlways: true
            }
        },
        dataLabels: {
            enabled: false
        },
        legend: {
            show: false
        }
    };

    const chart = new ApexCharts(document.querySelector(`#${containerId}`), options);
    chart.render();
    return chart;
}

/**
 * Generate weekly heatmap
 */
function generateWeeklyHeatmap(containerId, data) {
    const container = document.querySelector(`#${containerId}`);
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

    // Process data into day buckets
    const dayData = {};
    days.forEach(day => dayData[day] = 0);

    if (data && data.length > 0) {
        data.forEach(item => {
            const date = new Date(item.date + 'T00:00:00');
            const dayName = days[date.getDay() === 0 ? 6 : date.getDay() - 1];
            dayData[dayName] += item.total_seconds / 3600; // Hours
        });
    }

    // Calculate max for scaling
    const maxHours = Math.max(...Object.values(dayData), 1);

    // Generate HTML
    let html = '';
    days.forEach(day => {
        const hours = dayData[day];
        const level = Math.min(5, Math.ceil((hours / maxHours) * 5));
        html += `
            <div class="heatmap-row">
                <span class="heatmap-label">${day}</span>
                <div class="heatmap-cells">
                    <div class="heatmap-cell" data-level="${level}" title="${hours.toFixed(1)} hours"></div>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

/**
 * Update stats list with items
 */
function updateStatsList(listId, items, colorKey = true) {
    const list = document.querySelector(`#${listId}`);
    if (!list || !items || items.length === 0) {
        if (list) list.innerHTML = '<li class="text-center text-dim">No data available</li>';
        return;
    }

    const topItems = items.slice(0, 5);

    list.innerHTML = topItems.map((item, index) => `
        <li class="stats-list-item">
            <span class="stats-list-label">
                ${colorKey ? `<span class="stats-list-dot" style="background-color: ${chartColors[index % chartColors.length]}"></span>` : ''}
                <span class="stats-list-name">${item.name}</span>
            </span>
            <span>
                <span class="stats-list-value">${item.text || formatDuration(item.total_seconds)}</span>
                ${item.percent ? `<span class="stats-list-percent">${item.percent.toFixed(1)}%</span>` : ''}
            </span>
        </li>
    `).join('');
}

/**
 * Format seconds as human-readable duration
 */
function formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
}

/**
 * Render GitHub repos as a styled list (no chart needed)
 */
function createGitHubReposChart(containerId, data) {
    const container = document.querySelector(`#${containerId}`);
    if (!container) return null;

    if (!data || data.length === 0) {
        container.innerHTML = '<div class="text-center text-dim">No GitHub repo data available</div>';
        return null;
    }

    const topRepos = data.slice(0, 8);

    container.innerHTML = topRepos.map((repo, index) => `
        <div style="display: flex; align-items: center; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #1f2937;">
            <div style="display: flex; align-items: center; gap: 8px; min-width: 0;">
                <span class="stats-list-dot" style="background-color: ${chartColors[index % chartColors.length]}; flex-shrink: 0;"></span>
                <span style="color: #e4e7eb; font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${data.length > 0 ? escapeHtml(repo.name) : repo.name}</span>
                ${repo.private ? '<span style="font-size: 10px; color: #6b7280; background: #1f2937; padding: 1px 5px; border-radius: 3px;">private</span>' : ''}
            </div>
            <div style="display: flex; align-items: center; gap: 10px; flex-shrink: 0; font-size: 12px; color: #9ca3af;">
                <span style="color: #9ca3af;">${repo.language || ''}</span>
                ${repo.stars > 0 ? '<span>&#9733; ' + repo.stars + '</span>' : ''}
                ${repo.forks > 0 ? '<span>&#128259; ' + repo.forks + '</span>' : ''}
            </div>
        </div>
    `).join('');

    // Return a fake chart object with a destroy method for consistency
    return { destroy: () => { container.innerHTML = ''; } };
}

/**
 * Create an area chart for GitHub contributions (daily commits)
 */
function createGitHubContributionsChart(containerId, data) {
    if (!data || data.length === 0) {
        document.querySelector(`#${containerId}`).innerHTML = '<div class="text-center text-dim">No contribution data available</div>';
        return null;
    }

    const options = {
        ...commonOptions,
        chart: {
            ...commonOptions.chart,
            type: 'area',
            height: 280
        },
        series: [{
            name: 'Commits',
            data: data.map(d => d.commits)
        }],
        xaxis: {
            ...commonOptions.xaxis,
            type: 'category',
            categories: data.map(d => {
                const date = new Date(d.date + 'T00:00:00');
                return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            }),
            tickAmount: 10,
            labels: {
                ...commonOptions.xaxis.labels,
                rotate: -45,
                rotateAlways: false
            }
        },
        yaxis: {
            ...commonOptions.yaxis,
            title: {
                text: 'Commits',
                style: {
                    color: '#9ca3af'
                }
            },
            min: 0,
            forceNiceScale: true
        },
        stroke: {
            curve: 'smooth',
            width: 3
        },
        fill: {
            type: 'gradient',
            gradient: {
                shadeIntensity: 1,
                opacityFrom: 0.4,
                opacityTo: 0.1,
                stops: [0, 90, 100]
            }
        },
        colors: ['#22c55e'],
        dataLabels: {
            enabled: false
        },
        markers: {
            size: 3,
            hover: {
                size: 5
            }
        }
    };

    const chart = new ApexCharts(document.querySelector(`#${containerId}`), options);
    chart.render();
    return chart;
}

/**
 * Create a horizontal bar chart for ActivityWatch app usage
 */
function createAppUsageChart(containerId, data) {
    if (!data || data.length === 0) {
        document.querySelector(`#${containerId}`).innerHTML = '<div class="text-center text-dim">No app usage data available</div>';
        return null;
    }

    const topApps = data.slice(0, 8);

    const options = {
        ...commonOptions,
        chart: {
            ...commonOptions.chart,
            type: 'bar',
            height: 200
        },
        series: [{
            name: 'Hours',
            data: topApps.map(a => Math.round(a.seconds / 3600 * 10) / 10)
        }],
        plotOptions: {
            bar: {
                horizontal: true,
                borderRadius: 4,
                barHeight: '70%',
                distributed: true
            }
        },
        xaxis: {
            ...commonOptions.xaxis,
            categories: topApps.map(a => a.name)
        },
        yaxis: {
            ...commonOptions.yaxis,
            labels: {
                ...commonOptions.yaxis.labels,
                maxWidth: 150
            }
        },
        dataLabels: {
            enabled: true,
            formatter: val => `${val}h`,
            style: {
                fontSize: '11px'
            }
        },
        legend: {
            show: false
        }
    };

    const chart = new ApexCharts(document.querySelector(`#${containerId}`), options);
    chart.render();
    return chart;
}

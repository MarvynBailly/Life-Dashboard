// ========================================
// LIFE OS DASHBOARD - MAIN APP LOGIC
// ========================================

// Initialize all modules when page loads
document.addEventListener('DOMContentLoaded', async function() {
    initializeDraggableModules();
    initializeResizableModules();
    
    // Try to load from server first, fallback to localStorage
    await loadModulesFromServer();
    
    // Load dynamic content
    updateNowPlaying();
    loadQuotes();
    
    // Set up periodic updates
    setInterval(updateNowPlaying, 15000);
});

// ========================================
// DRAGGABLE FUNCTIONALITY
// ========================================

function initializeDraggableModules() {
    const modules = document.querySelectorAll('.module-box');
    
    modules.forEach(module => {
        const header = module.querySelector('.module-header');
        if (header) {
            dragElement(module);
        }
        
        // Add click handler to bring module to front
        module.addEventListener('mousedown', function() {
            bringToFront(module);
        });
    });
}

// Track highest z-index
let highestZIndex = 100;

function bringToFront(element) {
    highestZIndex++;
    element.style.zIndex = highestZIndex;
}

function dragElement(elmnt) {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    const header = document.getElementById(elmnt.id + "header");
    
    if (header) {
        // if present, the header is where you move the DIV from:
        header.onmousedown = dragMouseDown;
    } else {
        // otherwise, move the DIV from anywhere inside the DIV:
        elmnt.onmousedown = dragMouseDown;
    }

    function dragMouseDown(e) {
        e = e || window.event;
        e.preventDefault();
        // get the mouse cursor position at startup:
        pos3 = e.clientX;
        pos4 = e.clientY;
        document.onmouseup = closeDragElement;
        // call a function whenever the cursor moves:
        document.onmousemove = elementDrag;
        
        // Bring to front when dragging
        bringToFront(elmnt);
        
        // Add dragging class for visual feedback
        elmnt.style.transition = 'none';
    }

    function elementDrag(e) {
        e = e || window.event;
        e.preventDefault();
        // calculate the new cursor position:
        pos1 = pos3 - e.clientX;
        pos2 = pos4 - e.clientY;
        pos3 = e.clientX;
        pos4 = e.clientY;
        // set the element's new position:
        elmnt.style.top = (elmnt.offsetTop - pos2) + "px";
        elmnt.style.left = (elmnt.offsetLeft - pos1) + "px";
        elmnt.style.right = 'auto';
        elmnt.style.bottom = 'auto';
    }

    function closeDragElement() {
        // stop moving when mouse button is released:
        document.onmouseup = null;
        document.onmousemove = null;
        elmnt.style.transition = '';
        
        // Save position to localStorage and server
        saveModulePosition(elmnt.id);
        saveAllModulesToServer();
    }
}

// ========================================
// RESIZABLE FUNCTIONALITY
// ========================================

function initializeResizableModules() {
    const modules = document.querySelectorAll('.module-box');
    
    modules.forEach(module => {
        const resizeHandle = module.querySelector('.resize-handle');
        if (resizeHandle) {
            makeResizable(module, resizeHandle);
        }
    });
}

function makeResizable(element, handle) {
    let isResizing = false;
    let startX, startY, startWidth, startHeight;
    
    handle.addEventListener('mousedown', function(e) {
        isResizing = true;
        startX = e.clientX;
        startY = e.clientY;
        startWidth = parseInt(getComputedStyle(element).width, 10);
        startHeight = parseInt(getComputedStyle(element).height, 10);
        
        element.style.transition = 'none';
        
        document.addEventListener('mousemove', resize);
        document.addEventListener('mouseup', stopResize);
        
        e.preventDefault();
    });
    
    function resize(e) {
        if (!isResizing) return;
        
        const width = startWidth + (e.clientX - startX);
        const height = startHeight + (e.clientY - startY);
        
        // Apply min-width and min-height constraints
        if (width >= 250) {
            element.style.width = width + 'px';
        }
        if (height >= 150) {
            element.style.height = height + 'px';
        }
    }
    
    function stopResize() {
        isResizing = false;
        element.style.transition = '';
        document.removeEventListener('mousemove', resize);
        document.removeEventListener('mouseup', stopResize);
        
        // Save size to localStorage and server
        saveModulePosition(element.id);
        saveAllModulesToServer();
    }
}

// ========================================
// COLLAPSE FUNCTIONALITY
// ========================================

function toggleCollapse(moduleId) {
    const module = document.getElementById(moduleId);
    const button = module.querySelector('.collapse-btn');
    
    if (module.classList.contains('collapsed')) {
        // Uncollapsing - restore previous size
        module.classList.remove('collapsed');
        button.textContent = '−';
        
        // Restore dimensions from saved state
        const saved = localStorage.getItem(`module-${moduleId}`);
        if (saved) {
            const position = JSON.parse(saved);
            if (position.width) module.style.width = position.width;
            if (position.height) module.style.height = position.height;
        }
    } else {
        // Collapsing - save current size before collapsing
        saveModulePosition(moduleId);
        module.classList.add('collapsed');
        button.textContent = '+';
    }
    
    // Save collapsed state
    saveModulePosition(moduleId);
    saveAllModulesToServer();
}

// ========================================
// POSITION & STATE PERSISTENCE
// ========================================

function saveModulePosition(moduleId) {
    const module = document.getElementById(moduleId);
    if (!module) return;
    
    const position = {
        top: module.style.top,
        left: module.style.left,
        right: module.style.right,
        bottom: module.style.bottom,
        width: module.style.width,
        height: module.style.height,
        collapsed: module.classList.contains('collapsed')
    };
    
    localStorage.setItem(`module-${moduleId}`, JSON.stringify(position));
}

function loadModulePositions() {
    const modules = document.querySelectorAll('.module-box');
    
    modules.forEach(module => {
        const saved = localStorage.getItem(`module-${module.id}`);
        if (saved) {
            const position = JSON.parse(saved);
            
            if (position.top) module.style.top = position.top;
            if (position.left) module.style.left = position.left;
            if (position.right) module.style.right = position.right;
            if (position.bottom) module.style.bottom = position.bottom;
            if (position.width) module.style.width = position.width;
            if (position.height) module.style.height = position.height;
            
            if (position.collapsed) {
                module.classList.add('collapsed');
                const button = module.querySelector('.collapse-btn');
                if (button) button.textContent = '+';
            }
        }
    });
}

// Save all module positions to server
async function saveAllModulesToServer() {
    const modules = document.querySelectorAll('.module-box');
    const layout = {};
    
    modules.forEach(module => {
        const position = {
            top: module.style.top,
            left: module.style.left,
            right: module.style.right,
            bottom: module.style.bottom,
            width: module.style.width,
            height: module.style.height,
            collapsed: module.classList.contains('collapsed')
        };
        layout[module.id] = position;
    });
    
    console.log('Saving layout to server:', layout);
    
    try {
        const response = await fetch('/savelayout', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(layout)
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            console.error('Server error saving layout:', errorData);
            throw new Error(errorData.error || 'Failed to save');
        }
        
        const result = await response.json();
        console.log('Layout saved successfully:', result);
        
    } catch (e) {
        console.error('Failed to save layout to server:', e);
        throw e;
    }
}

// Apply default positions from data attributes
function applyDefaultPositions() {
    const modules = document.querySelectorAll('.module-box');
    
    modules.forEach(module => {
        const defaultStyle = module.getAttribute('data-default-style');
        if (defaultStyle) {
            // Parse the default style string
            const styles = defaultStyle.split(';').map(s => s.trim()).filter(s => s);
            styles.forEach(style => {
                const [prop, value] = style.split(':').map(s => s.trim());
                if (prop && value) {
                    module.style[prop] = value;
                }
            });
        }
    });
}

// Load module positions from server
async function loadModulesFromServer() {
    // First, apply default positions
    applyDefaultPositions();
    
    try {
        const response = await fetch('/loadlayout');
        if (response.ok) {
            const layout = await response.json();
            
            // If we have saved layout data, apply it
            if (Object.keys(layout).length > 0) {
                Object.keys(layout).forEach(moduleId => {
                    const module = document.getElementById(moduleId);
                    if (module) {
                        const position = layout[moduleId];
                        
                        if (position.top) module.style.top = position.top;
                        if (position.left) module.style.left = position.left;
                        if (position.right) module.style.right = position.right;
                        if (position.bottom) module.style.bottom = position.bottom;
                        if (position.width) module.style.width = position.width;
                        if (position.height) module.style.height = position.height;
                        
                        if (position.collapsed) {
                            module.classList.add('collapsed');
                            const button = module.querySelector('.collapse-btn');
                            if (button) button.textContent = '+';
                        }
                        
                        // Also save to localStorage as backup
                        localStorage.setItem(`module-${moduleId}`, JSON.stringify(position));
                    }
                });
            }
        }
    } catch (e) {
        console.error('Failed to load layout from server:', e);
        // Fall back to localStorage
        loadModulePositions();
    } finally {
        // Make modules visible after positioning
        const modules = document.querySelectorAll('.module-box');
        modules.forEach(module => {
            module.classList.add('positioned');
        });
    }
}

// ========================================
// NOW PLAYING (Last.fm Integration)
// ========================================

// Store current album art URL globally
let currentAlbumArt = null;

async function updateNowPlaying() {
    try {
        const res = await fetch("/nowplaying");
        const data = await res.json();

        const box = document.getElementById("now-playing-content");
        const moduleBody = document.querySelector("#music-module .module-body");

        // Update content
        box.innerHTML = `
            <div class="now-playing-title">${data.title || 'No track playing'}</div>
            <div class="now-playing-artist">${data.artist || ''}</div>
        `;
        
        // Store album art URL globally
        currentAlbumArt = data.album_art;
        
        // Set album art as background
        if (data.album_art) {
            moduleBody.style.backgroundImage = `url('${data.album_art}')`;
            moduleBody.style.backgroundSize = 'cover';
            moduleBody.style.backgroundPosition = 'center';
            moduleBody.style.backgroundRepeat = 'no-repeat';
        } else {
            moduleBody.style.backgroundImage = 'none';
        }

    } catch (e) {
        console.error("Failed to fetch now playing:", e);
        const box = document.getElementById("now-playing-content");
        box.innerHTML = '<span class="dim">Unable to load</span>';
    }
}

// Track cast state
let isCastActive = false;

function castAlbumArtToBackground() {
    const body = document.body;
    const overlay = document.getElementById('background-overlay');
    const castBtn = document.querySelector('.cast-btn');
    
    // Toggle OFF - Remove background
    if (isCastActive) {
        // Remove background image
        body.style.backgroundImage = 'none';
        body.style.background = 'linear-gradient(135deg, #0a0e27 0%, #151b3d 100%)';
        
        // Remove overlay
        if (overlay) {
            overlay.remove();
        }
        
        isCastActive = false;
        
        // Update button
        if (castBtn) {
            castBtn.textContent = '🖼️';
            castBtn.title = 'Cast to Background';
        }
        
        return;
    }
    
    // Toggle ON - Apply background
    if (!currentAlbumArt) {
        alert("No album art available to cast");
        return;
    }
    
    // Apply album art to body background
    body.style.backgroundImage = `url('${currentAlbumArt}')`;
    body.style.backgroundSize = 'cover';
    body.style.backgroundPosition = 'center';
    body.style.backgroundRepeat = 'no-repeat';
    body.style.backgroundAttachment = 'fixed';
    
    // Add a dark overlay for better module visibility
    if (!document.getElementById('background-overlay')) {
        const newOverlay = document.createElement('div');
        newOverlay.id = 'background-overlay';
        newOverlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(10, 14, 39, 0.75);
            pointer-events: none;
            z-index: 1;
        `;
        document.body.appendChild(newOverlay);
    }
    
    // Ensure modules are above the overlay
    document.querySelectorAll('.module-box').forEach(module => {
        if (!module.style.zIndex || parseInt(module.style.zIndex) < 100) {
            module.style.zIndex = '100';
        }
    });
    
    isCastActive = true;
    
    // Update button
    if (castBtn) {
        castBtn.textContent = '✖️';
        castBtn.title = 'Remove Background';
    }
}

// ========================================
// DAILY QUOTES
// ========================================

async function loadQuotes() {
    const container = document.getElementById("quotes-container");
    if (!container) return;
    
    container.innerHTML = '<div class="quotes-loading">Loading quotes...</div>';
    
    try {
        const res = await fetch("/quotes");
        const quotes = await res.json();
        
        if (!quotes || quotes.length === 0) {
            container.innerHTML = '<div class="quotes-loading">No quotes available</div>';
            return;
        }
        
        container.innerHTML = quotes.map((quote, idx) => `
            <div class="quote-item">
                <div class="quote-text">"${escapeHtml(quote.text)}"</div>
                <div class="quote-footer">
                    <div class="quote-author">— ${escapeHtml(quote.author)}</div>
                    <button class="save-quote-btn" onclick="saveQuoteToNotes(${idx}, \`${escapeHtml(quote.text)}\`, \`${escapeHtml(quote.author)}\`)">
                        Save
                    </button>
                </div>
            </div>
        `).join('');
    } catch (e) {
        console.error("Failed to load quotes:", e);
        container.innerHTML = '<div class="quotes-loading">Failed to load quotes</div>';
    }
}

async function saveQuoteToNotes(idx, text, author) {
    try {
        const response = await fetch("/addnote", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ 
                title: "Quote", 
                content: `> "${text}"\n> \n> — ${author}` 
            })
        });
        
        if (response.ok) {
            // Mark button as saved
            const buttons = document.querySelectorAll('.save-quote-btn');
            if (buttons[idx]) {
                buttons[idx].classList.add('saved');
                buttons[idx].textContent = '✓ Saved';
                setTimeout(() => {
                    buttons[idx].classList.remove('saved');
                    buttons[idx].textContent = 'Save';
                }, 2000);
            }
        } else {
            alert("Failed to save quote");
        }
    } catch (e) {
        console.error("Failed to save quote:", e);
        alert("Error saving quote");
    }
}

// ========================================
// TODO & NOTE FORM HANDLERS
// ========================================

function toggleAddTodoForm() {
    const form = document.getElementById("add-todo-form");
    const btn = document.getElementById("toggle-todo-form-btn");
    
    if (form.classList.contains("hidden")) {
        form.classList.remove("hidden");
        btn.style.display = "none";
        document.getElementById("todo-text").focus();
    } else {
        form.classList.add("hidden");
        btn.style.display = "block";
        document.getElementById("add-todo-form-element").reset();
    }
}

async function addTodoTask(event) {
    event.preventDefault();
    
    const text = document.getElementById("todo-text").value;
    
    try {
        const response = await fetch("/addtodo", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ text: text })
        });
        
        if (response.ok) {
            // Reload the todo list
            const todoList = document.getElementById("todo-list");
            const res = await fetch("/todos");
            todoList.innerHTML = await res.text();
            
            // Close the form
            toggleAddTodoForm();
        } else {
            alert("Failed to add task");
        }
    } catch (e) {
        console.error("Failed to add task:", e);
        alert("Error adding task");
    }
}

function toggleAddNoteForm() {
    const form = document.getElementById("add-note-form");
    const btn = document.getElementById("toggle-note-form-btn");
    
    if (form.classList.contains("hidden")) {
        form.classList.remove("hidden");
        btn.style.display = "none";
        document.getElementById("note-title").focus();
    } else {
        form.classList.add("hidden");
        btn.style.display = "block";
        document.getElementById("add-note-form-element").reset();
    }
}

async function addNote(event) {
    event.preventDefault();
    
    const title = document.getElementById("note-title").value;
    const content = document.getElementById("note-content").value;
    
    try {
        const response = await fetch("/addnote", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ 
                title: title, 
                content: content 
            })
        });
        
        if (response.ok) {
            // Reload the notes
            const notesBody = document.querySelector("#notes-module .markdown-body");
            const res = await fetch("/notes");
            notesBody.innerHTML = await res.text();
            
            // Close the form
            toggleAddNoteForm();
        } else {
            alert("Failed to add note");
        }
    } catch (e) {
        console.error("Failed to add note:", e);
        alert("Error adding note");
    }
}

// ========================================
// ADMIN CONTROLS
// ========================================

function showAdminStatus(message, type = 'info') {
    const status = document.getElementById('admin-status');
    if (!status) return;
    
    status.textContent = message;
    status.className = `admin-status ${type}`;
    
    // Auto-clear after 3 seconds
    setTimeout(() => {
        status.textContent = '';
        status.className = 'admin-status';
    }, 3000);
}

async function saveLayoutNow() {
    try {
        await saveAllModulesToServer();
        
        // Also update the JSON display
        await displayCurrentLayout();
        
        showAdminStatus('✓ Layout saved successfully!', 'success');
    } catch (e) {
        console.error('Failed to save layout:', e);
        showAdminStatus('✗ Failed to save layout', 'error');
    }
}

async function loadLayoutNow() {
    try {
        await loadModulesFromServer();
        
        // Also update the JSON display
        await displayCurrentLayout();
        
        showAdminStatus('✓ Layout loaded successfully!', 'success');
    } catch (e) {
        console.error('Failed to load layout:', e);
        showAdminStatus('✗ Failed to load layout', 'error');
    }
}

async function resetLayout() {
    if (!confirm('Reset all modules to default positions? This will reload the page.')) {
        return;
    }
    
    try {
        // Clear localStorage
        const modules = document.querySelectorAll('.module-box');
        modules.forEach(module => {
            localStorage.removeItem(`module-${module.id}`);
        });
        
        // Clear server layout
        await fetch('/savelayout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });
        
        showAdminStatus('✓ Layout reset! Reloading...', 'success');
        
        setTimeout(() => {
            location.reload();
        }, 1000);
    } catch (e) {
        console.error('Failed to reset layout:', e);
        showAdminStatus('✗ Failed to reset layout', 'error');
    }
}

async function displayCurrentLayout() {
    try {
        const response = await fetch('/loadlayout');
        if (response.ok) {
            const layout = await response.json();
            const textarea = document.getElementById('layout-json');
            if (textarea) {
                textarea.value = JSON.stringify(layout, null, 2);
            }
        }
    } catch (e) {
        console.error('Failed to display layout:', e);
    }
}

function copyLayoutJSON() {
    const textarea = document.getElementById('layout-json');
    if (!textarea || !textarea.value) {
        showAdminStatus('No layout data to copy', 'error');
        return;
    }
    
    textarea.select();
    document.execCommand('copy');
    
    showAdminStatus('✓ JSON copied to clipboard!', 'success');
}

function downloadLayoutJSON() {
    const textarea = document.getElementById('layout-json');
    if (!textarea || !textarea.value) {
        showAdminStatus('No layout data to download', 'error');
        return;
    }
    
    const blob = new Blob([textarea.value], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dashboard_layout_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showAdminStatus('✓ JSON downloaded!', 'success');
}

// Load and display current layout when admin module is visible
document.addEventListener('DOMContentLoaded', function() {
    // Wait a bit for layout to load, then display it
    setTimeout(displayCurrentLayout, 1000);
});

// ========================================
// UTILITY FUNCTIONS
// ========================================

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Reset all module positions (for debugging)
function resetModulePositions() {
    const modules = document.querySelectorAll('.module-box');
    modules.forEach(module => {
        localStorage.removeItem(`module-${module.id}`);
    });
    location.reload();
}

// Make reset function available in console
window.resetModulePositions = resetModulePositions;

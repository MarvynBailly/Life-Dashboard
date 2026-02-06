/**
 * Notes & Journal Page
 */

let notesOffset = 0;
let journalOffset = 0;
const NOTES_LIMIT = 10;
const JOURNAL_LIMIT = 10;

document.addEventListener('DOMContentLoaded', function() {
    loadTodos();
    loadNotes();
    loadJournalEntries();

    document.getElementById('todo-input')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addTodo();
    });
    document.getElementById('add-todo-btn')?.addEventListener('click', addTodo);
    document.getElementById('write-journal-btn')?.addEventListener('click', showJournalModal);
    document.getElementById('add-note-btn')?.addEventListener('click', showAddNoteModal);
});

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
        }
    } catch (error) {
        console.error('Error adding todo:', error);
    }
}

async function toggleTodo(todoId) {
    try {
        const response = await fetch(`/api/todos/${todoId}/toggle`, {
            method: 'POST'
        });

        if (response.ok) {
            await loadTodos();
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
            document.getElementById('load-more-notes')?.remove();
            notesList.insertAdjacentHTML('beforeend', notesHtml);
        } else {
            notesList.innerHTML = notesHtml;
        }

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

        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal(modal.querySelector('.modal-close'));
        });
    } catch (error) {
        console.error('Error viewing note:', error);
    }
}

function toggleEditNote(noteId) {
    document.getElementById('note-view-content').style.display = 'none';
    document.getElementById('note-edit-content').style.display = 'block';
    document.getElementById('note-view-actions').style.display = 'none';
    document.getElementById('note-edit-actions').style.display = 'flex';
    setupLivePreview('edit-note-content', 'edit-note-preview');
    document.getElementById('edit-note-content')?.focus();
}

function cancelEditNote() {
    document.getElementById('note-view-content').style.display = 'block';
    document.getElementById('note-edit-content').style.display = 'none';
    document.getElementById('note-view-actions').style.display = 'flex';
    document.getElementById('note-edit-actions').style.display = 'none';
}

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
            const viewContent = document.getElementById('note-view-content');
            const modalTitle = document.getElementById('note-modal-title');

            if (viewContent) {
                viewContent.innerHTML = `<div class="markdown-content">${renderMarkdown(content)}</div>`;
            }
            if (modalTitle) {
                modalTitle.textContent = title || 'Note';
            }

            cancelEditNote();
            loadNotes();
        } else {
            alert('Failed to save note');
        }
    } catch (error) {
        console.error('Error saving note:', error);
        alert('Error saving note');
    }
}

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

    setTimeout(() => {
        setupLivePreview('new-note-content', 'new-note-preview');
        document.getElementById('new-note-content')?.focus();
    }, 100);

    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal(modal.querySelector('.modal-close'));
    });
}

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
 * Load journal entries with pagination
 */
async function loadJournalEntries(append = false) {
    try {
        if (!append) journalOffset = 0;

        const [entriesResponse, streakResponse] = await Promise.all([
            fetch(`/api/journal?limit=${JOURNAL_LIMIT}&offset=${journalOffset}`),
            fetch('/api/journal/streak')
        ]);

        const entries = await entriesResponse.json();
        const streakData = await streakResponse.json();

        const streakDisplay = document.getElementById('journal-streak-display');
        if (streakDisplay) {
            streakDisplay.textContent = streakData.streak || 0;
        }

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

function loadMoreJournal() {
    loadJournalEntries(true);
}

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

function showJournalModal(existingEntry = null) {
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
                    document.querySelectorAll('.mood-btn').forEach(b => b.classList.remove('active'));
                    if (entry.mood) {
                        document.querySelector(`.mood-btn[data-mood="${entry.mood}"]`)?.classList.add('active');
                    }
                }
            } else {
                contentArea.value = '';
                document.querySelectorAll('.mood-btn').forEach(b => b.classList.remove('active'));
            }
            if (preview) preview.innerHTML = renderMarkdown(contentArea.value);
        } catch (e) {
            // Ignore errors
        }
    });

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
                if (preview) preview.innerHTML = renderMarkdown(contentArea.value);
            }
        })
        .catch(() => {});

    setTimeout(() => {
        setupLivePreview('new-journal-content', 'new-journal-preview');
        document.getElementById('new-journal-content')?.focus();
    }, 100);

    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal(modal.querySelector('.modal-close'));
    });
}

function selectMood(btn, mood) {
    btn.parentElement.querySelectorAll('.mood-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
}

function getSelectedMood() {
    const activeBtn = document.querySelector('.mood-btn.active');
    return activeBtn ? parseInt(activeBtn.dataset.mood) : null;
}

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
        } else {
            alert('Failed to save journal entry');
        }
    } catch (error) {
        console.error('Error saving journal entry:', error);
        alert('Error saving journal entry');
    }
}

function toggleEditJournal(entryDate) {
    document.getElementById('journal-view-content').style.display = 'none';
    document.getElementById('journal-edit-content').style.display = 'block';
    document.getElementById('journal-view-actions').style.display = 'none';
    document.getElementById('journal-edit-actions').style.display = 'flex';
    setupLivePreview('edit-journal-content', 'edit-journal-preview');
    document.getElementById('edit-journal-content')?.focus();
}

function cancelEditJournal() {
    document.getElementById('journal-view-content').style.display = 'block';
    document.getElementById('journal-edit-content').style.display = 'none';
    document.getElementById('journal-view-actions').style.display = 'flex';
    document.getElementById('journal-edit-actions').style.display = 'none';
}

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

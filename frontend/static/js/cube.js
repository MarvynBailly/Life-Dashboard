/**
 * Cube Algorithms Page
 */

(function() {
    let categories = [];
    let activeCategoryId = null;
    let editingAlgId = null;

    // ==========================================================================
    // API helpers
    // ==========================================================================

    async function apiGet(url) {
        const res = await fetch(url);
        return res.json();
    }

    async function apiPost(url, body) {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        if (!res.ok) throw new Error(await res.text());
        return res.json();
    }

    async function apiPatch(url, body) {
        const res = await fetch(url, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        if (!res.ok) throw new Error(await res.text());
        return res.json();
    }

    async function apiDelete(url) {
        const res = await fetch(url, { method: 'DELETE' });
        if (!res.ok && res.status !== 204) throw new Error(await res.text());
    }

    // ==========================================================================
    // Data loading
    // ==========================================================================

    async function loadCategories() {
        categories = await apiGet('/api/cube/categories');
        renderTabs();
        if (activeCategoryId) {
            renderAlgorithms();
        } else if (categories.length > 0) {
            activeCategoryId = categories[0].id;
            renderTabs();
            renderAlgorithms();
        } else {
            renderAlgorithms();
        }
    }

    // ==========================================================================
    // Rendering
    // ==========================================================================

    function renderTabs() {
        const container = document.getElementById('cube-tabs');
        const addBtn = document.getElementById('add-category-btn');

        // Remove existing tabs (keep the add button)
        container.querySelectorAll('.cube-tab').forEach(el => el.remove());

        categories.forEach(cat => {
            const tab = document.createElement('button');
            tab.className = 'cube-tab' + (cat.id === activeCategoryId ? ' active' : '');
            tab.textContent = cat.name;
            tab.dataset.id = cat.id;

            tab.addEventListener('click', () => {
                activeCategoryId = cat.id;
                renderTabs();
                renderAlgorithms();
            });

            tab.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                openCategoryEditModal(cat);
            });

            container.insertBefore(tab, addBtn);
        });

        // Show/hide add algorithm button
        document.getElementById('add-alg-btn').style.display = activeCategoryId ? '' : 'none';
    }

    function renderAlgorithms() {
        const container = document.getElementById('cube-algorithms');
        const cat = categories.find(c => c.id === activeCategoryId);

        if (!cat) {
            container.innerHTML = '<div class="cube-empty">Select or create a category to get started</div>';
            return;
        }

        const algs = cat.algorithms || [];
        if (algs.length === 0) {
            container.innerHTML = '<div class="cube-empty">No algorithms yet. Click "+ Algorithm" to add one.</div>';
            return;
        }

        container.innerHTML = algs.map(alg => `
            <div class="cube-alg-card" data-id="${alg.id}">
                ${alg.image_url ? `<img class="cube-alg-image" src="${escapeHtml(alg.image_url)}" alt="${escapeHtml(alg.name)}">` : ''}
                <div class="cube-alg-info">
                    <div class="cube-alg-name">${escapeHtml(alg.name)}</div>
                    <div class="cube-alg-notation">${escapeHtml(alg.notation)}</div>
                    ${alg.notes ? `<div class="cube-alg-notes">${escapeHtml(alg.notes)}</div>` : ''}
                </div>
                <button class="btn btn-secondary btn-icon cube-alg-edit" data-id="${alg.id}" title="Edit">&#9998;</button>
            </div>
        `).join('');

        // Bind edit buttons
        container.querySelectorAll('.cube-alg-edit').forEach(btn => {
            btn.addEventListener('click', () => {
                const algId = parseInt(btn.dataset.id);
                const alg = algs.find(a => a.id === algId);
                if (alg) openAlgModal(alg);
            });
        });
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // ==========================================================================
    // Category actions
    // ==========================================================================

    function showCategoryForm() {
        document.getElementById('category-form').style.display = 'flex';
        document.getElementById('category-name-input').value = '';
        document.getElementById('category-name-input').focus();
    }

    function hideCategoryForm() {
        document.getElementById('category-form').style.display = 'none';
    }

    async function saveCategory() {
        const name = document.getElementById('category-name-input').value.trim();
        if (!name) return;
        await apiPost('/api/cube/categories', { name, display_order: categories.length });
        hideCategoryForm();
        await loadCategories();
    }

    function openCategoryEditModal(cat) {
        document.getElementById('cat-edit-name').value = cat.name;
        document.getElementById('cat-edit-modal').style.display = 'flex';
        document.getElementById('cat-edit-modal').dataset.id = cat.id;
    }

    function closeCategoryEditModal() {
        document.getElementById('cat-edit-modal').style.display = 'none';
    }

    async function saveCategoryEdit() {
        const id = document.getElementById('cat-edit-modal').dataset.id;
        const name = document.getElementById('cat-edit-name').value.trim();
        if (!name) return;
        await apiPatch(`/api/cube/categories/${id}`, { name });
        closeCategoryEditModal();
        await loadCategories();
    }

    async function deleteCategory() {
        const id = document.getElementById('cat-edit-modal').dataset.id;
        if (!confirm('Delete this category and all its algorithms?')) return;
        await apiDelete(`/api/cube/categories/${id}`);
        closeCategoryEditModal();
        if (activeCategoryId === parseInt(id)) {
            activeCategoryId = categories.length > 1 ? categories.find(c => c.id !== parseInt(id))?.id : null;
        }
        await loadCategories();
    }

    // ==========================================================================
    // Algorithm modal
    // ==========================================================================

    function openAlgModal(alg) {
        editingAlgId = alg ? alg.id : null;
        document.getElementById('alg-modal-title').textContent = alg ? 'Edit Algorithm' : 'Add Algorithm';
        document.getElementById('alg-name').value = alg ? alg.name : '';
        document.getElementById('alg-notation').value = alg ? alg.notation : '';
        document.getElementById('alg-notes').value = alg ? (alg.notes || '') : '';
        document.getElementById('alg-image-url').value = alg ? (alg.image_url || '') : '';
        document.getElementById('alg-delete-btn').style.display = alg ? '' : 'none';
        document.getElementById('alg-modal').style.display = 'flex';
        document.getElementById('alg-name').focus();
    }

    function closeAlgModal() {
        document.getElementById('alg-modal').style.display = 'none';
        editingAlgId = null;
    }

    async function saveAlgorithm() {
        const name = document.getElementById('alg-name').value.trim();
        const notation = document.getElementById('alg-notation').value.trim();
        const notes = document.getElementById('alg-notes').value.trim() || null;
        const image_url = document.getElementById('alg-image-url').value.trim() || null;

        if (!name || !notation) return;

        if (editingAlgId) {
            await apiPatch(`/api/cube/algorithms/${editingAlgId}`, { name, notation, notes, image_url });
        } else {
            await apiPost('/api/cube/algorithms', {
                category_id: activeCategoryId,
                name,
                notation,
                notes,
                image_url,
                display_order: (categories.find(c => c.id === activeCategoryId)?.algorithms?.length || 0)
            });
        }

        closeAlgModal();
        await loadCategories();
    }

    async function deleteAlgorithm() {
        if (!editingAlgId) return;
        if (!confirm('Delete this algorithm?')) return;
        await apiDelete(`/api/cube/algorithms/${editingAlgId}`);
        closeAlgModal();
        await loadCategories();
    }

    // ==========================================================================
    // Event binding
    // ==========================================================================

    document.addEventListener('DOMContentLoaded', () => {
        // Category form
        document.getElementById('add-category-btn').addEventListener('click', showCategoryForm);
        document.getElementById('category-cancel-btn').addEventListener('click', hideCategoryForm);
        document.getElementById('category-save-btn').addEventListener('click', saveCategory);
        document.getElementById('category-name-input').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') saveCategory();
            if (e.key === 'Escape') hideCategoryForm();
        });

        // Category edit modal
        document.getElementById('cat-edit-close').addEventListener('click', closeCategoryEditModal);
        document.getElementById('cat-edit-cancel').addEventListener('click', closeCategoryEditModal);
        document.getElementById('cat-edit-save').addEventListener('click', saveCategoryEdit);
        document.getElementById('cat-delete-btn').addEventListener('click', deleteCategory);

        // Algorithm modal
        document.getElementById('add-alg-btn').addEventListener('click', () => openAlgModal(null));
        document.getElementById('alg-modal-close').addEventListener('click', closeAlgModal);
        document.getElementById('alg-cancel-btn').addEventListener('click', closeAlgModal);
        document.getElementById('alg-save-btn').addEventListener('click', saveAlgorithm);
        document.getElementById('alg-delete-btn').addEventListener('click', deleteAlgorithm);

        // Close modals on overlay click
        document.getElementById('alg-modal').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) closeAlgModal();
        });
        document.getElementById('cat-edit-modal').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) closeCategoryEditModal();
        });

        // Load data
        loadCategories();
    });
})();

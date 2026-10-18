// admin/categories.js — admin portal: categories page
'use strict';

/* ════════════════════════════════════════════════════════════
   CATEGORIES
═══════════════════════════════════════════════════════════════*/

async function loadCategories() {
  setLoading('categories-table-wrap', 'Loading categories…');
  const res = await apiGet('categories');
  if (!res.success) { document.getElementById('categories-table-wrap').innerHTML = errorHTML(res.message); return; }
  session.categories = res.data || [];
  renderCategoriesTable(session.categories);
}

function renderCategoriesTable(cats) {
  const wrap = document.getElementById('categories-table-wrap');
  if (!cats.length) { wrap.innerHTML = emptyStateHTML('🗂️', 'No Categories', 'Add your first category.'); return; }
  const rows = cats.map(c => `<tr>
    <td>${productIcon(c.name)} ${escHtml(c.name)}</td>
    <td>${escHtml(c.product_count ?? 0)}</td>
    <td>
      <button class="btn-action" onclick="openCategoryModal(${c.category_id}, '${escHtml(c.name)}')">✏️</button>
      <button class="btn-action btn-action-red" onclick="deleteCategory(${c.category_id})">✕</button>
    </td>
  </tr>`).join('');
  wrap.innerHTML = `<table class="data-table"><thead><tr><th>Name</th><th>Products</th><th>Actions</th></tr></thead><tbody>${rows}</tbody></table>`;
}

let _categoryId = 0;

function openCategoryModal(id = 0, name = '') {
  _categoryId = id;
  document.getElementById('category-modal-title').textContent = id ? 'Edit Category' : 'Add Category';
  document.getElementById('cat-name-input').value = name;
  document.getElementById('cat-form-error').style.display = 'none';
  openModal('category-modal', 'cat-modal-close');
}

async function confirmSaveCategory() {
  const errEl = document.getElementById('cat-form-error');
  errEl.style.display = 'none';
  const name = document.getElementById('cat-name-input').value.trim();
  if (!name) { errEl.textContent = 'Category name is required.'; errEl.style.display = ''; return; }
  const res = await apiPost('save_category', { category_id: _categoryId, name });
  if (!res.success) { errEl.textContent = res.message; errEl.style.display = ''; return; }
  toast(_categoryId ? 'Category updated.' : 'Category added.', 'success');
  closeModal('category-modal');
  session.categories = []; // invalidate cache — dropdowns will rebuild on next load
  loadCategories();
}

async function deleteCategory(id) {
  if (!confirm('Delete this category? It must have no products assigned.')) return;
  const res = await apiPost('delete_category', { category_id: id });
  if (!res.success) { toast(res.message, 'error'); return; }
  toast('Category deleted.', 'success');
  session.categories = []; // invalidate cache — dropdowns will rebuild on next load
  loadCategories();
}


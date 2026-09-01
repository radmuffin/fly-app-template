import { FlyClient } from '/_fly/fly-device-sync.js';
import { FlyToast, FlyTheme } from '/_fly/fly-ui.js';

const api = new FlyClient({ baseUrl: '/api' });
const notesList = document.getElementById('notes-list');
const noteForm = document.getElementById('note-form');
const noteInput = document.getElementById('note-input');
const themeBtn = document.getElementById('theme-btn');

themeBtn.addEventListener('click', () => {
  FlyTheme.toggle();
});

async function loadNotes() {
  try {
    const res = await api.get('/notes');
    if (res && res.data) {
      renderNotes(res.data);
    }
  } catch (err) {
    FlyToast.error(`Failed to load notes: ${err.message}`);
  }
}

function renderNotes(notes) {
  if (notes.length === 0) {
    notesList.innerHTML = '<p style="color: var(--fly-text-secondary); text-align: center;">No notes yet. Add one above!</p>';
    return;
  }
  notesList.innerHTML = notes
    .map(
      (n) => `
      <div class="note-card">
        <div>${FlyToast.escape(n.content)}</div>
        <div class="note-date">${new Date(n.created_at).toLocaleString()}</div>
      </div>
    `
    )
    .join('');
}

noteForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const content = noteInput.value.trim();
  if (!content) return;

  try {
    await api.post('/notes', { content });
    noteInput.value = '';
    FlyToast.success('Note saved!');
    await loadNotes();
  } catch (err) {
    FlyToast.error(`Failed to save note: ${err.message}`);
  }
});

loadNotes();

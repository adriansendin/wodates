export function renderAdminVerificationPage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Admin panel – Verification</title>
  <style>
    :root {
      color-scheme: light dark;
      --bg: #0f172a;
      --panel: #111827;
      --text: #e5e7eb;
      --muted: #9ca3af;
      --accent: #22c55e;
      --danger: #ef4444;
      --border: #1f2937;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: Inter, system-ui, -apple-system, Segoe UI, sans-serif;
      background: var(--bg);
      color: var(--text);
      display: flex;
      justify-content: center;
      padding: 32px 16px 48px;
    }
    .card {
      width: min(960px, 100%);
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 24px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.35);
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      margin-bottom: 16px;
      flex-wrap: wrap;
    }
    h1 {
      margin: 0;
      font-size: 20px;
      letter-spacing: -0.02em;
    }
    .status {
      color: var(--muted);
      font-size: 14px;
    }
    .photo-wrapper {
      position: relative;
      border-radius: 12px;
      overflow: hidden;
      background: #0b1220;
      border: 1px solid var(--border);
      min-height: 360px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    img#verification-photo {
      max-width: 100%;
      max-height: 70vh;
      object-fit: contain;
      display: none;
    }
    .empty-state {
      text-align: center;
      color: var(--muted);
      padding: 48px 16px;
    }
    .actions {
      margin-top: 16px;
      display: flex;
      gap: 12px;
      justify-content: space-between;
      flex-wrap: wrap;
    }
    button {
      flex: 1;
      padding: 12px 16px;
      border-radius: 10px;
      border: 1px solid transparent;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      transition: transform 120ms ease, box-shadow 120ms ease, opacity 120ms ease;
    }
    button:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      transform: none;
    }
    .btn-approve {
      background: linear-gradient(120deg, #16a34a, #22c55e);
      color: #052e16;
      box-shadow: 0 10px 30px rgba(34, 197, 94, 0.25);
    }
    .btn-approve:not(:disabled):hover { transform: translateY(-1px); }
    .btn-reject {
      background: linear-gradient(120deg, #b91c1c, #ef4444);
      color: #fff;
      box-shadow: 0 10px 30px rgba(239, 68, 68, 0.25);
    }
    .btn-reject:not(:disabled):hover { transform: translateY(-1px); }
    .meta {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
      margin-top: 8px;
      font-size: 13px;
      color: var(--muted);
    }
    .pill {
      padding: 6px 10px;
      border-radius: 999px;
      background: #0b1220;
      border: 1px solid var(--border);
    }
    .error {
      color: #fecdd3;
      margin-top: 12px;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <main class="card">
    <div class="header">
      <h1>Manual verification</h1>
      <div class="status" id="status-text">Loading next request...</div>
    </div>

    <div class="photo-wrapper">
      <img id="verification-photo" alt="Verification photo" />
      <div class="empty-state" id="empty-state" style="display:none;">
        There are no photos pending verification.
      </div>
    </div>

    <div class="meta" id="meta"></div>
    <div class="error" id="error" style="display:none;"></div>

    <div class="actions" id="actions" style="display:none;">
      <button class="btn-reject" id="reject-btn">❌ Reject</button>
      <button class="btn-approve" id="approve-btn">✔️ Approve</button>
    </div>
  </main>

  <script>
    (() => {
      const statusText = document.getElementById('status-text');
      const photo = document.getElementById('verification-photo');
      const emptyState = document.getElementById('empty-state');
      const errorBox = document.getElementById('error');
      const meta = document.getElementById('meta');
      const actions = document.getElementById('actions');
      const approveBtn = document.getElementById('approve-btn');
      const rejectBtn = document.getElementById('reject-btn');

      let currentRequestId = null;

      const setBusy = (busy) => {
        approveBtn.disabled = busy;
        rejectBtn.disabled = busy;
      };

      const showError = (message) => {
        errorBox.textContent = message || 'An error occurred.';
        errorBox.style.display = 'block';
      };

      const clearError = () => {
        errorBox.textContent = '';
        errorBox.style.display = 'none';
      };

      const renderMeta = (data) => {
        meta.innerHTML = '';
        if (!data) return;
        const pills = [
          ['User', data.user_id],
          ['Request', data.id],
          ['Created', new Date(data.created_at).toLocaleString()],
        ];

        pills.forEach(([label, value]) => {
          const pill = document.createElement('span');
          pill.className = 'pill';
          pill.textContent = \`\${label}: \${value}\`;
          meta.appendChild(pill);
        });
      };

      async function loadNext() {
        setBusy(true);
        clearError();
        statusText.textContent = 'Loading next request...';
        photo.style.display = 'none';
        emptyState.style.display = 'none';
        actions.style.display = 'none';
        currentRequestId = null;

        try {
          const response = await fetch('/admin/verification/next', {
            credentials: 'same-origin',
          });
          if (!response.ok) {
            const text = await response.text();
            throw new Error(text || "Couldn't load the next request");
          }

          const payload = await response.json();

          if (payload.done) {
            statusText.textContent = 'No pending requests';
            meta.innerHTML = '';
            emptyState.style.display = 'block';
            return;
          }

          currentRequestId = payload.id;
          photo.src = payload.signed_url;
          photo.style.display = 'block';
          actions.style.display = 'flex';
          statusText.textContent = 'Pending request';
          renderMeta(payload);
        } catch (error) {
          console.error(error);
          showError(error.message);
          statusText.textContent = 'Error loading';
        } finally {
          setBusy(false);
        }
      }

      async function decide(action) {
        if (!currentRequestId) return;
        setBusy(true);
        clearError();
        statusText.textContent = action === 'approve' ? 'Approving...' : 'Rejecting...';

        try {
          const response = await fetch(
            \`/admin/verification/\${currentRequestId}/\${action}\`,
            {
              method: 'POST',
              credentials: 'same-origin',
            }
          );

          if (!response.ok) {
            const text = await response.text();
            throw new Error(text || "Couldn't update the request");
          }

          await loadNext();
        } catch (error) {
          console.error(error);
          showError(error.message);
          statusText.textContent = 'Error updating';
        } finally {
          setBusy(false);
        }
      }

      approveBtn.addEventListener('click', () => decide('approve'));
      rejectBtn.addEventListener('click', () => decide('reject'));

      loadNext();
    })();
  </script>
</body>
</html>`;
}

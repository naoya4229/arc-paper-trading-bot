body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  background: linear-gradient(135deg, #071325, #101f38 60%, #091823);
  color: #e8edf7;
}

* {
  box-sizing: border-box;
}

.page-shell {
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px 16px 40px;
}

.topbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  margin-bottom: 20px;
}

.eyebrow {
  margin: 0;
  letter-spacing: 0.08em;
  font-size: 0.72rem;
  color: #7cc0ff;
  text-transform: uppercase;
}

.topbar h1 {
  margin: 4px 0 0;
  font-size: clamp(1.8rem, 4vw, 2.5rem);
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 18px;
}

.card {
  background: rgba(17, 25, 38, 0.84);
  border: 1px solid rgba(108, 152, 210, 0.22);
  border-radius: 16px;
  padding: 18px;
  box-shadow: 0 10px 22px rgba(0, 0, 0, 0.2);
}

.status-card,
.wallet-card,
.config-card,
.market-card,
.positions-card,
.history-card {
  min-height: 200px;
}

.full-span {
  grid-column: 1 / -1;
}

h2 {
  margin: 0 0 14px;
  font-size: 1.15rem;
}

.status-row,
.info-block,
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.label {
  font-size: 0.78rem;
  color: #9fb8d7;
}

button,
input {
  border-radius: 10px;
  border: 1px solid rgba(146, 180, 232, 0.3);
  font: inherit;
}

button {
  padding: 10px 16px;
  cursor: pointer;
  transition: opacity 0.2s ease;
}

button:hover {
  opacity: 0.92;
}

.primary {
  background: #3aa0ff;
  color: #081c2d;
  font-weight: 700;
}

.secondary {
  background: rgba(122, 157, 224, 0.15);
  color: #eaf4ff;
}

.danger {
  background: rgba(220, 78, 78, 0.16);
  color: #ffb3b3;
  border-color: rgba(255, 120, 120, 0.35);
}

.wide {
  width: 100%;
  margin-top: 12px;
}

.kpis {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-top: 18px;
}

.kpis > div {
  background: rgba(98, 128, 168, 0.08);
  border-radius: 12px;
  padding: 12px 10px;
}

.kpi-label {
  display: block;
  font-size: 0.75rem;
  color: #9eb8d7;
  margin-bottom: 8px;
}

.info-block {
  flex-direction: column;
  align-items: flex-start;
  margin-top: 12px;
  padding: 10px 12px;
  background: rgba(110, 139, 179, 0.08);
  border-radius: 12px;
}

.input-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 10px;
}

.input-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

input {
  width: 100%;
  padding: 10px 12px;
  background: rgba(18, 30, 43, 0.9);
  color: #edf5ff;
}

.token-table,
.position-table {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 12px;
}

.token-row,
.position-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  background: rgba(126, 146, 183, 0.07);
  border-radius: 10px;
}

table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 10px;
}

th,
td {
  text-align: left;
  padding: 10px 8px;
  border-bottom: 1px solid rgba(150, 174, 205, 0.18);
  font-size: 0.9rem;
}

@media (max-width: 640px) {
  .topbar {
    flex-direction: column;
    align-items: flex-start;
  }

  .input-grid,
  .kpis {
    grid-template-columns: 1fr;
  }

  .token-row,
  .position-row,
  .status-row,
  .toolbar {
    flex-direction: column;
    align-items: flex-start;
  }
}

import { useState, useEffect } from 'react';
import { API_BASE_URL } from '../config';

const editableRowFields = ['client', 'remarks', 'type', 'budget', 'quoted', 'interviews', 'status', 'note', 'createdAt'];
const emptyDirectDraft = { client: '', remarks: '', type: 'Fixed', budget: '', quoted: '', interviews: '', status: 'Open', note: '', createdAt: '' };

const decimalOnly = (value) => {
  const cleaned = String(value).replace(/[^\d.]/g, '');
  const [whole, ...decimalParts] = cleaned.split('.');
  return decimalParts.length ? `${whole}.${decimalParts.join('')}` : whole;
};

const integerOnly = (value) => String(value).replace(/\D/g, '');

const todayDateKey = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const firstDayOfCurrentMonthKey = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}-01`;
};

function TeamLeadDashboard({ user, onLogout }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingRowId, setEditingRowId] = useState(null);
  const [editDraft, setEditDraft] = useState(null);
  const [savingRowId, setSavingRowId] = useState(null);
  const [deletingRowId, setDeletingRowId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [addingRowBidderId, setAddingRowBidderId] = useState(null);
  const [newRowDraft, setNewRowDraft] = useState(emptyDirectDraft);
  const [savingNewRow, setSavingNewRow] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [spentDraft, setSpentDraft] = useState('');
  const [isEditingSpent, setIsEditingSpent] = useState(false);
  const [savingSpent, setSavingSpent] = useState(false);

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/api/data/dashboard`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const json = await res.json();
      if (res.status === 401 || res.status === 403) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.reload();
        return;
      }
      if (res.ok) {
        setData(json);
        setStartDate(current => current || firstDayOfCurrentMonthKey());
        setEndDate(current => current || todayDateKey());
        setSpentDraft(json.team?.spent || 0);
      } else {
        setError(json.error);
      }
    } catch (err) {
      setError('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const saveSpent = async () => {
    if (!data?.team?.id) return;
    try {
      setSavingSpent(true);
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/api/teams/${data.team.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ spent: spentDraft })
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || 'Failed to save spent amount');
      }

      setIsEditingSpent(false);
      fetchDashboard();
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingSpent(false);
    }
  };

  const updateLocalRow = (id, updates) => {
    setData(current => current ? ({
      ...current,
      team: {
        ...current.team,
        bidders: current.team.bidders.map(bidder => ({
          ...bidder,
          rows: bidder.rows.map(row => row.id === id ? { ...row, ...updates } : row)
        }))
      }
    }) : current);
  };

  const removeLocalRow = (id) => {
    setData(current => current ? ({
      ...current,
      team: {
        ...current.team,
        bidders: current.team.bidders.map(bidder => ({
          ...bidder,
          rows: bidder.rows.filter(row => row.id !== id)
        }))
      }
    }) : current);
  };

  const saveRowUpdates = async (id, updates) => {
    const token = localStorage.getItem('token');
    const res = await fetch(`${API_BASE_URL}/api/rows/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(updates)
    });

    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      throw new Error(json.error || 'Failed to save row');
    }
  };

  const updateRow = async (id, field, value) => {
    updateLocalRow(id, { [field]: value });
    await saveRowUpdates(id, { [field]: value });
  };

  const startEditRow = (row) => {
    setEditingRowId(row.id);
    setEditDraft(
      editableRowFields.reduce((draft, field) => ({
        ...draft,
        [field]: row[field] || ''
      }), {})
    );
  };

  const cancelEditRow = () => {
    setEditingRowId(null);
    setEditDraft(null);
  };

  const changeEditDraft = (field, value) => {
    setEditDraft(current => ({ ...current, [field]: value }));
  };

  const saveEditedRow = async (id) => {
    if (!editDraft?.client?.trim()) return;

    try {
      setSavingRowId(id);
      await saveRowUpdates(id, editDraft);
      updateLocalRow(id, editDraft);
      cancelEditRow();
      fetchDashboard();
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingRowId(null);
    }
  };

  const startAddRow = (bidderId) => {
    setNewRowDraft({ ...emptyDirectDraft, createdAt: todayDateKey() });
    setAddingRowBidderId(bidderId);
  };

  const cancelAddRow = () => {
    setNewRowDraft(emptyDirectDraft);
    setAddingRowBidderId(null);
  };

  const changeNewRowDraft = (field, value) => {
    setNewRowDraft(current => ({ ...current, [field]: value }));
  };

  const saveNewRow = async (bidderId) => {
    if (!newRowDraft.client.trim()) return;

    try {
      setSavingNewRow(true);
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/api/rows`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...newRowDraft,
          bidderId,
          wk: data.state.weekNo
        })
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || 'Failed to add client');
      }

      cancelAddRow();
      fetchDashboard();
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingNewRow(false);
    }
  };

  const openDeletePrompt = (row, bidderName) => {
    setDeleteTarget({ ...row, bidderName });
  };

  const closeDeletePrompt = () => {
    if (deletingRowId) return;
    setDeleteTarget(null);
  };

  const confirmDeleteRow = async () => {
    if (!deleteTarget) return;

    try {
      setDeletingRowId(deleteTarget.id);
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/api/rows`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ id: deleteTarget.id })
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || 'Failed to delete row');
      }

      removeLocalRow(deleteTarget.id);
      setDeleteTarget(null);
      fetchDashboard();
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingRowId(null);
    }
  };
  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  const team = data.team;
  const stats = team.stats;
  const amount = (value) => {
    const parsed = parseFloat(String(value || '').replace(/[^0-9.\-]/g, ''));
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  };
  const rowWorth = (row) => amount(row.quoted) || amount(row.budget);
  const rowRevenue = (row) => row.status === 'Converted' ? amount(row.won) || amount(row.quoted) || amount(row.budget) : 0;
  const statusClass = (status) => (
    status === 'Converted' ? 'won' :
    status === 'Hired elsewhere' ? 'lost' :
    status === 'Job post deleted' || status === 'Client ended conversation' ? 'dead' :
    'open'
  );
  const renderText = (value) => value || <span className="muted-inline">-</span>;
  const formatInsertedDate = (value) => {
    if (!value) return <span className="muted-inline">-</span>;

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return <span className="muted-inline">-</span>;

    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };
  const rowDateKey = (value) => {
    if (!value) return '';

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  const isRowInDateRange = (row) => {
    const dateToUse = (row.status === 'Converted' && row.convertedOn) ? row.convertedOn : row.createdAt;
    const key = rowDateKey(dateToUse);
    if (!key) return false;
    if (startDate && key < startDate) return false;
    if (endDate && key > endDate) return false;
    return true;
  };
  const summarizeRows = (rows, bids = 0) => {
    const validRows = rows.filter(row => row.client?.trim());
    const uniqueClients = new Set(validRows.map(row => row.client.trim().toLowerCase()));
    const openRows = validRows.filter(row => row.status === 'Open');
    const converted = validRows.filter(row => row.status === 'Converted').length;

    return {
      clients: uniqueClients.size,
      fresh: validRows.filter(row => row.wk >= data.state.weekNo).length,
      hourly: openRows.filter(row => row.type === 'Hourly').length,
      pipeline: openRows.reduce((sum, row) => sum + rowWorth(row), 0),
      big: openRows.filter(row => rowWorth(row) >= data.state.thresh && rowWorth(row) > 0).length,
      Converted: converted,
      revenue: validRows.reduce((sum, row) => sum + rowRevenue(row), 0),
      conv: validRows.length ? converted / validRows.length : 0,
      bids,
    };
  };
  const isDirectBidder = (bidder) => bidder.direct === true || bidder.direct === 1;

  const filteredBidders = team.bidders.map(bidder => {
    const rows = bidder.rows.filter(isRowInDateRange);
    const bids = (bidder.dailyBidCounts || []).filter(r => {
      const key = rowDateKey(r.date);
      if (!key) return false;
      if (startDate && key < startDate) return false;
      if (endDate && key > endDate) return false;
      return true;
    }).reduce((sum, r) => sum + Number(r.totalBids || 0), 0);
    return {
      ...bidder,
      rows,
      stats: summarizeRows(rows, bids),
    };
  });
  const teamBids = filteredBidders.reduce((sum, b) => sum + b.stats.bids, 0);
  const statsForRange = summarizeRows(filteredBidders.flatMap(bidder => bidder.rows), teamBids);

  // Compute follow-up candidates for every non-converted row in this team.
  const allRows = filteredBidders.flatMap(b => b.rows);
  const convertedRows = allRows.filter(r =>
    r.client?.trim() && r.status === 'Converted'
  ).sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  const followUps = allRows.filter(r => 
    r.client?.trim() && r.status !== 'Converted'
  ).sort((a, b) => rowWorth(b) - rowWorth(a));
  const regularBidders = filteredBidders.filter(bidder => !isDirectBidder(bidder));
  const directBidders = filteredBidders.filter(isDirectBidder);

  const renderBidderRows = (bidder) => {
    const isAdding = addingRowBidderId === bidder.id;
    return (
    <div className={`bidder${isDirectBidder(bidder) ? ' direct' : ''}`} key={bidder.id}>
      <div className="b-head">
        <div className="b-id">
          <div className="b-name">{isDirectBidder(bidder) ? "Direct and repeat clients" : bidder.name}</div>
        </div>
        <div className="b-figs">
          <div className="b-fig"><div className="bf-lab">Bids</div><div className="bf-val">{bidder.stats.bids}</div></div>
          <div className="b-fig"><div className="bf-lab">Response</div><div className="bf-val">{bidder.stats.clients}</div></div>
          <div className="b-fig"><div className="bf-lab">Pipeline</div><div className="bf-val"><span className="cur">$</span>{bidder.stats.pipeline.toLocaleString()}</div></div>
          <div className="b-fig"><div className="bf-lab">Won</div><div className="bf-val" style={{ color: 'var(--s-won-d)' }}><span className="cur">$</span>{bidder.stats.revenue.toLocaleString()}</div></div>
        </div>
      </div>
      <div style={{ marginBottom: "1rem", display: "flex", justifyContent: "flex-end" }}>
        {!isAdding && <button className="btn mini add-row" style={{ marginTop: 0 }} onClick={() => startAddRow(bidder.id)}>+ Add a client</button>}
      </div>
      <div className="wrapscroll">
        <table>
          <thead>
            <tr>
              <th style={{ width: '12%' }}>Date</th>
              <th style={{ width: '13%' }}>Client</th>
              <th style={{ width: '14%' }}>Remarks</th>
              <th className="c" style={{ width: '10%' }}>Type</th>
              <th className="r" style={{ width: '6%' }}>Hrs</th>
              <th className="r" style={{ width: '6%' }}>Amt/Hr</th>
              <th className="r" style={{ width: '7%' }}>Budget</th>
              <th className="r" style={{ width: '7%' }}>Quoted</th>
              <th className="c" style={{ width: '6%' }}>Int.</th>
              <th className="c" style={{ width: '10%' }}>Status</th>
              <th style={{ width: '6%' }}>TL note</th>
              <th className="c" style={{ width: '3%' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
              {isAdding && (
              <tr className="draft-row fresh">
                <td>
                  <input type="date" className="f" value={newRowDraft.createdAt || ''} onChange={e => changeNewRowDraft('createdAt', e.target.value)} />
                </td>
                <td>
                  <input className="f" placeholder="Client name *" list="client-suggestions" value={newRowDraft.client} onChange={e => changeNewRowDraft('client', e.target.value)} />
                </td>
                <td>
                  <input className="f" placeholder="Remarks" value={newRowDraft.remarks} onChange={e => changeNewRowDraft('remarks', e.target.value)} />
                </td>
                <td className="c">
                  <select className="f slim" value={newRowDraft.type} onChange={e => changeNewRowDraft('type', e.target.value)}>
                    <option>Fixed</option>
                    <option>Hourly</option>
                    <option>Hourly bid, fixed quote</option>
                  </select>
                </td>
                <td className="r">
                  {newRowDraft.type === 'Fixed' ? <span className="muted-inline">-</span> : (
                    <input className="f num" inputMode="decimal" placeholder="Hrs" value={newRowDraft.workedHours || ''} onChange={e => changeNewRowDraft('workedHours', decimalOnly(e.target.value))} />
                  )}
                </td>
                <td className="r">
                  {newRowDraft.type === 'Fixed' ? <span className="muted-inline">-</span> : (
                    <input className="f num" inputMode="decimal" placeholder="Amt/Hr" value={newRowDraft.amtPerHour || ''} onChange={e => changeNewRowDraft('amtPerHour', decimalOnly(e.target.value))} />
                  )}
                </td>
                <td className="r">
                  <input className="f num" inputMode="decimal" placeholder="Budget" value={newRowDraft.budget} onChange={e => changeNewRowDraft('budget', decimalOnly(e.target.value))} />
                </td>
                <td className="r">
                  {newRowDraft.type === 'Fixed' ? (
                    <input className="f num" inputMode="decimal" placeholder="Quoted" value={newRowDraft.quoted} onChange={e => changeNewRowDraft('quoted', decimalOnly(e.target.value))} />
                  ) : (
                    <span className="muted-inline">{newRowDraft.quoted || "-"}</span>
                  )}
                </td>
                <td className="c">
                  <input className="f cen" inputMode="numeric" placeholder="Int." value={newRowDraft.interviews} onChange={e => changeNewRowDraft('interviews', integerOnly(e.target.value))} />
                </td>
                <td className="c statcell">
                  <select className={`f st-${statusClass(newRowDraft.status)}`} value={newRowDraft.status} onChange={e => changeNewRowDraft('status', e.target.value)}>
                    <option>Open</option>
                    <option>Converted</option>
                    <option>Hired elsewhere</option>
                    <option>Job post deleted</option>
                    <option>Client ended conversation</option>
                  </select>
                </td>
                <td>
                  <input className="f" placeholder="TL note" value={newRowDraft.note} onChange={e => changeNewRowDraft('note', e.target.value)} />
                </td>
                <td className="c row-actions">
                  <div className="action-pair">
                    <button className="icon-btn save" type="button" title="Save client" aria-label="Save client" onClick={() => saveNewRow(bidder.id)} disabled={savingNewRow || !newRowDraft.client.trim()}>
                      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4 4L19 6.5" /></svg>
                    </button>
                    <button className="icon-btn cancel" type="button" title="Cancel add" aria-label="Cancel add" onClick={cancelAddRow} disabled={savingNewRow}>
                      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11" /></svg>
                    </button>
                  </div>
                </td>
              </tr>
            )}
              {bidder.rows.map(r => {
              const isEditing = editingRowId === r.id;
              const row = isEditing ? editDraft : r;

              return (
                <tr key={r.id}>
                  <td>
                    {isEditing ? (
                      <input type="date" className="f" value={row.createdAt ? rowDateKey(row.createdAt) : ''} onChange={e => changeEditDraft('createdAt', e.target.value)} />
                    ) : formatInsertedDate(r.createdAt)}
                  </td>
                  <td>
                    {isEditing ? (
                      <input className="f" list="client-suggestions" value={row.client || ''} onChange={e => changeEditDraft('client', e.target.value)} />
                    ) : renderText(r.client)}
                  </td>
                  <td>
                    {isEditing ? (
                      <input className="f" value={row.remarks || ''} onChange={e => changeEditDraft('remarks', e.target.value)} />
                    ) : renderText(r.remarks)}
                  </td>
                  <td className="c">
                    {isEditing ? (
                      <select className="f slim" value={row.type || 'Fixed'} onChange={e => changeEditDraft('type', e.target.value)}>
                        <option>Fixed</option>
                        <option>Hourly</option>
                        <option>Hourly bid, fixed quote</option>
                      </select>
                    ) : renderText(r.type)}
                  </td>
                  <td className="r">
                    {isEditing ? (
                      row.type === "Fixed" ? (
                        <span className="muted-inline">-</span>
                      ) : (
                        <input className="f num" inputMode="decimal" value={row.workedHours || ''} onChange={e => changeEditDraft('workedHours', decimalOnly(e.target.value))} />
                      )
                    ) : (
                      r.type === "Fixed" ? <span className="muted-inline">-</span> : renderText(r.workedHours)
                    )}
                  </td>
                  <td className="r">
                    {isEditing ? (
                      row.type === "Fixed" ? (
                        <span className="muted-inline">-</span>
                      ) : (
                        <input className="f num" inputMode="decimal" value={row.amtPerHour || ''} onChange={e => changeEditDraft('amtPerHour', decimalOnly(e.target.value))} />
                      )
                    ) : (
                      r.type === "Fixed" ? <span className="muted-inline">-</span> : renderText(r.amtPerHour)
                    )}
                  </td>
                  <td className="r">
                    {isEditing ? (
                      <input className="f num" inputMode="decimal" value={row.budget || ''} onChange={e => changeEditDraft('budget', decimalOnly(e.target.value))} />
                    ) : renderText(r.budget)}
                  </td>
                  <td className="r">
                    {isEditing ? (
                      row.type === "Fixed" ? (
                        <input className="f num" inputMode="decimal" value={row.quoted || ''} onChange={e => changeEditDraft('quoted', decimalOnly(e.target.value))} />
                      ) : (
                        <span className="muted-inline">{row.quoted || "-"}</span>
                      )
                    ) : renderText(r.quoted)}
                  </td>
                  <td className="c">
                    {isEditing ? (
                      <input className="f cen" inputMode="numeric" value={row.interviews || ''} onChange={e => changeEditDraft('interviews', integerOnly(e.target.value))} />
                    ) : renderText(r.interviews)}
                  </td>
                  <td className="c statcell">
                    {isEditing ? (
                      <select className={`f st-${statusClass(row.status)}`} value={row.status || 'Open'} onChange={e => changeEditDraft('status', e.target.value)}>
                        <option>Open</option>
                        <option>Converted</option>
                        <option>Hired elsewhere</option>
                        <option>Job post deleted</option>
                        <option>Client ended conversation</option>
                      </select>
                    ) : (
                      <span className={`status-text st-${statusClass(r.status)}`}>{r.status}</span>
                    )}
                  </td>
                  <td>
                    {isEditing ? (
                      <input className="f" value={row.note || ''} onChange={e => changeEditDraft('note', e.target.value)} />
                    ) : renderText(r.note)}
                  </td>
                  <td className="c row-actions">
                    {isEditing ? (
                      <div className="action-pair">
                        <button className="icon-btn save" type="button" title="Save row" aria-label="Save row" onClick={() => saveEditedRow(r.id)} disabled={savingRowId === r.id || !editDraft?.client?.trim()}>
                          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4 4L19 6.5" /></svg>
                        </button>
                        <button className="icon-btn cancel" type="button" title="Cancel edit" aria-label="Cancel edit" onClick={cancelEditRow} disabled={savingRowId === r.id}>
                          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11" /></svg>
                        </button>
                      </div>
                    ) : (
                      <div className="action-pair">
                        <button className="icon-btn" type="button" title="Edit row" aria-label="Edit row" onClick={() => startEditRow(r)}>
                          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3zM13.5 8.5l2 2" /></svg>
                        </button>
                        <button className="icon-btn danger" type="button" title="Delete row" aria-label="Delete row" onClick={() => openDeletePrompt(r, bidder.name)} disabled={deletingRowId === r.id}>
                          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 14h10l1-14M9 7V4h6v3" /></svg>
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
            
          </tbody>
        </table>
      </div>
      
    </div>
    );
  };

  const allBiddersRows = data?.team?.bidders?.flatMap(b => b.rows || []) || [];
  const uniqueClientNames = Array.from(new Set(allBiddersRows.map(r => r.client?.trim()).filter(Boolean))).sort();

  return (
    <div className="sheet">
      <datalist id="client-suggestions">
        {uniqueClientNames.map(name => (
          <option key={name} value={name} />
        ))}
      </datalist>
      {deleteTarget && (
        <div className="modal-backdrop" role="presentation" onClick={closeDeletePrompt}>
          <div className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="delete-title" onClick={e => e.stopPropagation()}>
            <div className="modal-kicker">Confirm delete</div>
            <h3 id="delete-title" className="modal-title">Delete this client row?</h3>
            <p className="modal-copy">
              This will remove <b>{deleteTarget.client || 'this row'}</b>{deleteTarget.bidderName ? ` from ${deleteTarget.bidderName}` : ''}.
            </p>
            <div className="modal-actions">
              <button className="btn ghost" type="button" onClick={closeDeletePrompt} disabled={deletingRowId === deleteTarget.id}>Cancel</button>
              <button className="btn danger solid" type="button" onClick={confirmDeleteRow} disabled={deletingRowId === deleteTarget.id}>
                {deletingRowId === deleteTarget.id ? 'Deleting...' : 'Delete row'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="toolbar">
        <img className="toolbar-brand" src="/10turtle-wordmark.svg" alt="10turtle" />
        <button className="btn ghost" onClick={onLogout}>Logout</button>
      </div>

      <header className="masthead">
        <h1 className="report-title">{team.name}</h1>
        <div className="accent-rule"></div>
        <div className="date-filter">
          <div className="date-filter-field">
            <span className="f-lab">From</span>
            <input className="dt" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
          </div>
          <div className="date-filter-field">
            <span className="f-lab">To</span>
            <input className="dt" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>
          <button
            className="btn mini ghost"
            type="button"
            onClick={() => {
              const today = todayDateKey();
              setStartDate(firstDayOfCurrentMonthKey());
              setEndDate(today);
            }}
          >
            Reset week
          </button>
        </div>
      </header>

      <section>
        <div className="sec-head"><span className="sec-num">01</span><span className="sec-label">Team snapshot</span></div>
        <h2 className="sec-title">The team's week so far</h2>
        <div className="stats grid-6">
          <div className="stat">
            <div className="s-lab">Bids</div>
            <div className="s-row"><div className="big">{statsForRange.bids}</div></div>
            <div className="s-sub"></div>
          </div>
          <div className="stat">
            <div className="s-lab">Response</div>
            <div className="s-row"><div className="big">{statsForRange.clients}</div></div>
            <div className="s-sub">{statsForRange.fresh} fresh · {statsForRange.hourly} hourly</div>
          </div>
          <div className="stat">
            <div className="s-lab">Open Pipeline</div>
            <div className="s-row"><span className="cur">$</span><div className="big">{statsForRange.pipeline.toLocaleString()}</div></div>
            <div className="s-sub">{statsForRange.big} big tickets over ${data.state.thresh}</div>
          </div>
          <div className="stat">
            <div className="s-lab">Clients Converted</div>
            <div className="s-row"><div className="big">{statsForRange.Converted}</div></div>
            <div className="s-sub">{(statsForRange.conv * 100).toFixed(0)}% conversion rate</div>
          </div>
          <div className="stat accent">
            <div className="s-lab">Revenue Won</div>
            <div className="s-row"><span className="cur">$</span><div className="big">{statsForRange.revenue.toLocaleString()}</div></div>
            <div className="s-sub">Team total</div>
          </div>
          <div className="stat" style={{ borderLeft: '1px solid var(--rule)', padding: '20px 30px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ borderBottom: '1px solid var(--rule)', paddingBottom: '40px' }}>
              <div className="s-lab">Net Amount</div>
              <div className="s-row" style={{ marginTop: 0 }}><span className="cur">$</span><div className="big" style={{ fontSize: '2.4rem', color: (statsForRange.revenue - (data.team.spent || 0)) >= 0 ? 'var(--s-won-d)' : 'var(--s-lost-d)' }}>{(statsForRange.revenue - (data.team.spent || 0)).toLocaleString()}</div></div>
            </div>
            <div style={{ marginTop: 'auto' }}>
              <div className="s-lab" style={{ marginBottom: '4px' }}>Monthly Spent</div>
              {isEditingSpent ? (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="number"
                    className="f num"
                    style={{ width: '100px' }}
                    value={spentDraft}
                    onChange={e => setSpentDraft(e.target.value)}
                  />
                  <button className="btn mini" onClick={saveSpent} disabled={savingSpent}>Save</button>
                  <button className="btn mini ghost" onClick={() => { setIsEditingSpent(false); setSpentDraft(data.team.spent || 0); }} disabled={savingSpent}>Cancel</button>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div className="s-row" style={{ marginTop: 0 }}><span className="cur">$</span><div className="big" style={{ fontSize: '1.5rem' }}>{(data.team.spent || 0).toLocaleString()}</div></div>
                  <button className="icon-btn" onClick={() => setIsEditingSpent(true)}>
                    <svg viewBox="0 0 24 24" aria-hidden="true" width="16" height="16"><path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3zM13.5 8.5l2 2" /></svg>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {convertedRows.length > 0 && (
        <section>
          <div className="sec-head"><span className="sec-num">02</span><span className="sec-label">Converted</span></div>
          <h2 className="sec-title">Converted clients</h2>
          <p className="sec-note">Closed clients from your team, newest first.</p>
          <div className="wrapscroll">
            <table>
              <thead>
                <tr>
                  <th style={{ width: '10%' }}>Date</th>
                  <th style={{ width: '15%' }}>Client</th>
                  <th style={{ width: '10%' }}>Bidder</th>
                  <th style={{ width: '23%' }}>Remarks</th>
                  <th className="r" style={{ width: '9%' }}>Worth</th>
                  <th className="c" style={{ width: '6%' }}>Int.</th>
                  <th className="c" style={{ width: '12%' }}>Status</th>
                  <th style={{ width: '15%' }}>Converted On</th>
                </tr>
              </thead>
              <tbody>
                {convertedRows.map(r => {
                  const bidder = team.bidders.find(b => b.id === r.bidderId);

                  return (
                    <tr key={`converted-${r.id}`}>
                      <td>{formatInsertedDate(r.createdAt)}</td>
                      <td>{renderText(r.client)}</td>
                      <td>{bidder?.name || <span className="muted-inline">-</span>}</td>
                      <td>{renderText(r.remarks)}</td>
                      <td className="r">${rowWorth(r).toLocaleString()}</td>
                      <td className="c">{renderText(r.interviews)}</td>
                      <td className="c"><span className="status-text st-won">{r.status}</span></td>
                      <td>{formatInsertedDate(r.convertedOn)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {followUps.length > 0 && (
        <section>
          <div className="sec-head"><span className="sec-num">03</span><span className="sec-label">Follow up</span></div>
          <h2 className="sec-title">Big tickets to chase</h2>
          <p className="sec-note">Every non-converted row in your team. <b>The last column is your note to the bidder.</b></p>
          <div className="wrapscroll">
            <table>
              <thead>
                <tr>
                  <th style={{ width: '11%' }}>Date</th>
                  <th style={{ width: '13%' }}>Client</th>
                  <th style={{ width: '9%' }}>Bidder</th>
                  <th className="c" style={{ width: '8%' }}>Type</th>
                  <th className="r" style={{ width: '5%' }}>Hrs</th>
                  <th className="r" style={{ width: '6%' }}>Amt/Hr</th>
                  <th className="r" style={{ width: '8%' }}>Worth</th>
                  <th className="c" style={{ width: '5%' }}>Int.</th>
                  <th className="c" style={{ width: '9%' }}>Status</th>
                  <th style={{ width: '22%' }}>Your instruction to bidder</th>
                  <th className="c" style={{ width: '4%' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {followUps.map(r => {
                  const bidder = team.bidders.find(b => b.id === r.bidderId);
                  const isEditing = editingRowId === r.id;
                  const row = isEditing ? editDraft : r;

                  return (
                    <tr key={`fu-${r.id}`} className={r.status === 'Open' && rowWorth(r) >= data.state.thresh ? 'fish' : ''}>
                      <td>{formatInsertedDate(r.createdAt)}</td>
                      <td>
                        {isEditing ? (
                          <input className="f" list="client-suggestions" value={row.client || ''} onChange={e => changeEditDraft('client', e.target.value)} />
                        ) : renderText(r.client)}
                      </td>
                      <td>{bidder?.name}</td>
                      <td className="c">
                        {isEditing ? (
                          <select className="f slim" value={row.type || 'Fixed'} onChange={e => changeEditDraft('type', e.target.value)}>
                            <option>Fixed</option>
                            <option>Hourly</option>
                            <option>Hourly bid, fixed quote</option>
                          </select>
                        ) : renderText(r.type)}
                      </td>
                      <td className="r">
                        {isEditing ? (
                          row.type === "Fixed" ? (
                            <span className="muted-inline">-</span>
                          ) : (
                            <input className="f num" inputMode="decimal" value={row.workedHours || ''} onChange={e => changeEditDraft('workedHours', decimalOnly(e.target.value))} />
                          )
                        ) : (
                          r.type === "Fixed" ? <span className="muted-inline">-</span> : renderText(r.workedHours)
                        )}
                      </td>
                      <td className="r">
                        {isEditing ? (
                          row.type === "Fixed" ? (
                            <span className="muted-inline">-</span>
                          ) : (
                            <input className="f num" inputMode="decimal" value={row.amtPerHour || ''} onChange={e => changeEditDraft('amtPerHour', decimalOnly(e.target.value))} />
                          )
                        ) : (
                          r.type === "Fixed" ? <span className="muted-inline">-</span> : renderText(r.amtPerHour)
                        )}
                      </td>
                      <td className="r">
                        {isEditing ? (
                          row.type === "Fixed" ? (
                            <input className="f num" inputMode="decimal" value={row.quoted || row.budget || ''} onChange={e => changeEditDraft('quoted', decimalOnly(e.target.value))} />
                          ) : (
                            <span className="muted-inline">{row.quoted || "-"}</span>
                          )
                        ) : `$${rowWorth(r).toLocaleString()}`}
                      </td>
                      <td className="c">
                        {isEditing ? (
                          <input className="f cen" inputMode="numeric" value={row.interviews || ''} onChange={e => changeEditDraft('interviews', integerOnly(e.target.value))} />
                        ) : r.interviews}
                      </td>
                      <td className="c">
                        {isEditing ? (
                          <select className={`f st-${statusClass(row.status)}`} value={row.status || 'Open'} onChange={e => changeEditDraft('status', e.target.value)}>
                            <option>Open</option>
                            <option>Converted</option>
                            <option>Hired elsewhere</option>
                            <option>Job post deleted</option>
                            <option>Client ended conversation</option>
                          </select>
                        ) : (
                          <span className={`tag auto`}>{r.status}</span>
                        )}
                      </td>
                      <td>
                        <input 
                          className="f" 
                          placeholder="Write a follow-up note..." 
                          value={row.note || ''} 
                          onChange={e => isEditing ? changeEditDraft('note', e.target.value) : updateRow(r.id, 'note', e.target.value)} 
                        />
                      </td>
                      <td className="c row-actions">
                        {isEditing ? (
                          <div className="action-pair">
                            <button className="icon-btn save" type="button" title="Save row" aria-label="Save row" onClick={() => saveEditedRow(r.id)} disabled={savingRowId === r.id || !editDraft?.client?.trim()}>
                              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4 4L19 6.5" /></svg>
                            </button>
                            <button className="icon-btn cancel" type="button" title="Cancel edit" aria-label="Cancel edit" onClick={cancelEditRow} disabled={savingRowId === r.id}>
                              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11" /></svg>
                            </button>
                          </div>
                        ) : (
                          <div className="action-pair">
                            <button className="icon-btn" type="button" title="Edit row" aria-label="Edit row" onClick={() => startEditRow(r)}>
                              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3zM13.5 8.5l2 2" /></svg>
                            </button>
                            <button className="icon-btn danger" type="button" title="Delete row" aria-label="Delete row" onClick={() => openDeletePrompt(r, bidder?.name)} disabled={deletingRowId === r.id}>
                              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 14h10l1-14M9 7V4h6v3" /></svg>
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section>
        <div className="sec-head"><span className="sec-num">04</span><span className="sec-label">Bidder by bidder</span></div>
        <h2 className="sec-title">Everyone's entries</h2>
        <p className="sec-note">You can edit any field here. Your changes are saved immediately and the bidder sees them.</p>
        
        {regularBidders.map(bidder => renderBidderRows(bidder))}

        {directBidders.map(bidder => renderBidderRows(bidder))}
      </section>
    </div>
  );
}

export default TeamLeadDashboard;

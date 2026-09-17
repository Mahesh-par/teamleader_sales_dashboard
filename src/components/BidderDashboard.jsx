import { useState, useEffect } from 'react';
import { API_BASE_URL } from '../config';

const decimalOnly = (value) => {
  const cleaned = String(value).replace(/[^\d.]/g, '');
  const [whole, ...decimalParts] = cleaned.split('.');
  return decimalParts.length ? `${whole}.${decimalParts.join('')}` : whole;
};

const integerOnly = (value) => String(value).replace(/\D/g, '');

function BidderDashboard({ user, onLogout }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isAdding, setIsAdding] = useState(false);
  const [draftRow, setDraftRow] = useState({ client: '', remarks: '', type: 'Fixed', budget: '', quoted: '', interviews: '', status: 'Open' });

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
      if (res.ok) setData(json);
      else setError(json.error);
    } catch (err) {
      setError('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const updateRow = async (id, field, value) => {
    setData(current => current ? ({
      ...current,
      team: {
        ...current.team,
        bidders: current.team.bidders.map(bidder => ({
          ...bidder,
          rows: bidder.rows.map(row => row.id === id ? { ...row, [field]: value } : row)
        }))
      }
    }) : current);
    const token = localStorage.getItem('token');
    await fetch(`${API_BASE_URL}/api/rows/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ [field]: value })
    });
    fetchDashboard(); // Refresh data to get new stats
  };

  const addRow = () => {
    setDraftRow({ client: '', remarks: '', type: 'Fixed', budget: '', quoted: '', interviews: '', status: 'Open' });
    setIsAdding(true);
  };

  const saveRow = async () => {
    if (!bidder) return;
    if (!draftRow.client.trim()) return;
    
    const token = localStorage.getItem('token');
    await fetch(`${API_BASE_URL}/api/rows`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        ...draftRow,
        bidderId: bidder.id,
        wk: data.state.weekNo
      })
    });
    setIsAdding(false);
    fetchDashboard();
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  const bidder = data.team.bidders.find(b => b.name === user.name);
  if (!bidder) return <div>Bidder data not found</div>;

  const stats = bidder.stats;
  const asks = bidder.rows.filter(r => r.note && r.note.trim() !== '' && r.status === 'Open').sort((a, b) => {
    const worthA = parseFloat(a.quoted || a.budget || 0);
    const worthB = parseFloat(b.quoted || b.budget || 0);
    return worthB - worthA;
  });

  return (
    <div className="sheet">
      <div className="toolbar">
        <button className="btn ghost" onClick={onLogout}>Logout</button>
      </div>

      <header className="masthead">
        <div className="mh-top">
          <img className="brand-mark" src="/10turtle-wordmark.svg" alt="10turtle" />
          <div className="mh-meta">Bidder view<br/>Entry and follow up</div>
        </div>
        <div className="kicker">Weekly sales · Bidder entry</div>
        <h1 className="report-title">{user.name}</h1>
        <div className="accent-rule"></div>
      </header>

      <section>
        <div className="sec-head"><span className="sec-num">01</span><span className="sec-label">Where I am</span></div>
        <h2 className="sec-title">My week so far</h2>
        <p className="sec-note">Only your own clients. Your team lead sees these the moment you save.</p>
        <div className="stats">
          <div className="stat">
            <div className="s-lab">Response</div>
            <div className="s-row"><div className="big">{stats.clients}</div></div>
            <div className="s-sub">{stats.fresh} fresh · {stats.hourly} hourly</div>
          </div>
          <div className="stat">
            <div className="s-lab">Open Pipeline</div>
            <div className="s-row"><span className="cur">$</span><div className="big">{stats.pipeline.toLocaleString()}</div></div>
            <div className="s-sub">{stats.big} big tickets over ${data.state.thresh}</div>
          </div>
          <div className="stat accent">
            <div className="s-lab">Revenue Won</div>
            <div className="s-row"><span className="cur">$</span><div className="big">{stats.revenue.toLocaleString()}</div></div>
            <div className="s-sub">{stats.Converted} converted ({(stats.conv * 100).toFixed(0)}%)</div>
          </div>
        </div>
      </section>

      {asks.length > 0 && (
        <section>
          <div className="sec-head"><span className="sec-num">02</span><span className="sec-label">From my team lead</span></div>
          <h2 className="sec-title">What to chase this week <span className="blockcount">{asks.length}</span></h2>
          <p className="sec-note">Your team lead writes these. Biggest first. You cannot edit them, you act on them.</p>
          <div className="wrapscroll">
            <table>
              <thead>
                <tr>
                  <th style={{ width: '26%' }}>Client</th>
                  <th className="r" style={{ width: '12%' }}>Worth</th>
                  <th className="c" style={{ width: '9%' }}>Int.</th>
                  <th style={{ width: '53%' }}>The angle</th>
                </tr>
              </thead>
              <tbody>
                {asks.map(r => (
                  <tr key={`ask-${r.id}`}>
                    <td>{r.client}</td>
                    <td className="r">${r.quoted || r.budget}</td>
                    <td className="c">{r.interviews}</td>
                    <td>{r.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section>
        <div className="sec-head"><span className="sec-num">03</span><span className="sec-label">My entries</span></div>
        <h2 className="sec-title">Every client I responded to</h2>
        <div className="legend">
          <span className="lg"><span className="sw fresh"></span>Added this week</span>
          <span className="lg"><span className="dotc won"></span>Converted</span>
          <span className="lg"><span className="dotc open"></span>Open</span>
          <span className="lg"><span className="dotc lost"></span>Hired elsewhere</span>
          <span className="lg"><span className="dotc dead"></span>Post deleted or ended</span>
        </div>
        <div className="wrapscroll">
          <table>
            <thead>
              <tr>
                <th style={{ width: '15%' }}>Client</th>
                <th style={{ width: '21%' }}>Remarks</th>
                <th className="c" style={{ width: '12%' }}>Type</th>
                <th className="r" style={{ width: '8%' }}>Budget</th>
                <th className="r" style={{ width: '8%' }}>Quoted</th>
                <th className="c" style={{ width: '6%' }}>Int.</th>
                <th className="c" style={{ width: '17%' }}>Status</th>
                <th style={{ width: '13%' }}>TL note</th>
              </tr>
            </thead>
            <tbody>
              {bidder.rows.map(r => (
                <tr key={r.id} className={r.wk >= data.state.weekNo ? 'fresh' : 'carried'}>
                  <td>
                    <input className="f" value={r.client} onChange={e => updateRow(r.id, 'client', e.target.value)} />
                  </td>
                  <td>
                    <input className="f" value={r.remarks} onChange={e => updateRow(r.id, 'remarks', e.target.value)} />
                  </td>
                  <td className="c">
                    <select className="f slim" value={r.type} onChange={e => updateRow(r.id, 'type', e.target.value)}>
                      <option>Fixed</option>
                      <option>Hourly</option>
                      <option>Hourly bid, fixed quote</option>
                    </select>
                  </td>
                  <td className="r">
                    <input className="f num" inputMode="decimal" value={r.budget} onChange={e => updateRow(r.id, 'budget', decimalOnly(e.target.value))} />
                  </td>
                  <td className="r">
                    <input className="f num" inputMode="decimal" value={r.quoted} onChange={e => updateRow(r.id, 'quoted', decimalOnly(e.target.value))} />
                  </td>
                  <td className="c">
                    <input className="f cen" inputMode="numeric" value={r.interviews} onChange={e => updateRow(r.id, 'interviews', integerOnly(e.target.value))} />
                  </td>
                  <td className="c statcell">
                    <select className={`f st-${r.status === 'Converted' ? 'won' : r.status === 'Hired elsewhere' ? 'lost' : r.status === 'Job post deleted' || r.status === 'Client ended conversation' ? 'dead' : 'open'}`} value={r.status} onChange={e => updateRow(r.id, 'status', e.target.value)}>
                      <option>Open</option>
                      <option>Converted</option>
                      <option>Hired elsewhere</option>
                      <option>Job post deleted</option>
                      <option>Client ended conversation</option>
                    </select>
                  </td>
                  <td className="readonly">{r.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {isAdding ? (
          <div className="add-draft">
            <input className="f" placeholder="Client name *" value={draftRow.client} onChange={e => setDraftRow({ ...draftRow, client: e.target.value })} />
            <input className="f" placeholder="Remarks" value={draftRow.remarks} onChange={e => setDraftRow({ ...draftRow, remarks: e.target.value })} />
            <select className="f slim" value={draftRow.type} onChange={e => setDraftRow({ ...draftRow, type: e.target.value })}><option>Fixed</option><option>Hourly</option><option>Hourly bid, fixed quote</option></select>
            <input className="f num" inputMode="decimal" placeholder="Budget" value={draftRow.budget} onChange={e => setDraftRow({ ...draftRow, budget: decimalOnly(e.target.value) })} />
            <input className="f num" inputMode="decimal" placeholder="Quoted" value={draftRow.quoted} onChange={e => setDraftRow({ ...draftRow, quoted: decimalOnly(e.target.value) })} />
            <input className="f cen" inputMode="numeric" placeholder="Interviews" value={draftRow.interviews} onChange={e => setDraftRow({ ...draftRow, interviews: integerOnly(e.target.value) })} />
            <button className="btn solid mini" onClick={saveRow} disabled={!draftRow.client.trim()}>Save client</button>
            <button className="btn ghost mini" onClick={() => setIsAdding(false)}>Cancel</button>
          </div>
        ) : <button className="btn mini add-row" onClick={addRow}>+ Add a client</button>}
      </section>
    </div>
  );
}

export default BidderDashboard;

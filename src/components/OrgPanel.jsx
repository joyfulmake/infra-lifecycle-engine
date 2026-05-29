import { useState } from 'react';
import { createOrg, joinOrgByCode } from '../lib/orgDb.js';

export default function OrgPanel({ authUser, org, setOrg, builds, shareToTeam, currentBuildId }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState(null); // 'create' | 'join'
  const [orgName, setOrgName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const sharedBuilds = builds.filter(b => b._shared);
  const isOwner = org && org.ownerEmail === authUser?.email;

  async function handleCreate() {
    if (!orgName.trim()) return;
    setBusy(true); setMsg('');
    try {
      const created = await createOrg(authUser.email, orgName.trim());
      setOrg(created);
      setMsg('Team created! Share the invite code with your colleagues.');
      setMode(null);
    } catch (e) {
      setMsg('Error: ' + e.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleJoin() {
    if (!inviteCode.trim()) return;
    setBusy(true); setMsg('');
    try {
      const joined = await joinOrgByCode(authUser.email, inviteCode.trim());
      if (!joined) { setMsg('Invite code not found. Check with your team admin.'); return; }
      setOrg(joined);
      setMsg('Joined team: ' + joined.name);
      setMode(null);
    } catch (e) {
      setMsg('Error: ' + e.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleShare() {
    const build = builds.find(b => b.id === currentBuildId && !b._shared);
    if (!build) { setMsg('Load a personal build first to share it with the team.'); return; }
    setBusy(true); setMsg('');
    try {
      await shareToTeam(build);
      setMsg('Build "' + build.name + '" shared with the team.');
    } catch (e) {
      setMsg('Error: ' + e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="pb-2">
      <button onClick={() => setOpen(o => !o)} className="w-full text-left text-xs text-white/60 hover:text-white/90 flex items-center gap-1 mb-1">
        <span>{open ? '▾' : '▸'}</span> Team Workspace
        {org && <span className="ml-1 text-white/40 truncate max-w-[120px]">· {org.name}</span>}
        {!org && <span className="ml-1 badge badge-blue text-xs" style={{ fontSize: 9 }}>Team+</span>}
      </button>

      {open && (
        <div className="bg-white/5 rounded-lg p-2 space-y-2 fade-in text-xs">

          {/* No org yet */}
          {!org && (
            <>
              <div className="text-white/40 leading-snug">
                Create or join a team workspace to share builds with colleagues on the same Team plan.
              </div>
              {!mode && (
                <div className="flex gap-1">
                  <button className="flex-1 btn-teal py-1 text-xs" onClick={() => { setMode('create'); setMsg(''); }}>Create Team</button>
                  <button className="flex-1 text-xs text-teal border border-teal/30 rounded px-2 py-1 hover:bg-teal/5" onClick={() => { setMode('join'); setMsg(''); }}>Join Team</button>
                </div>
              )}
              {mode === 'create' && (
                <div className="space-y-1.5">
                  <input
                    className="w-full bg-white/10 text-white border border-white/20 rounded px-2 py-1 placeholder:text-white/30 focus:outline-none text-xs"
                    placeholder="Team name (e.g. Infra Squad)"
                    value={orgName}
                    onChange={e => setOrgName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleCreate()}
                  />
                  <div className="flex gap-1">
                    <button className="flex-1 btn-teal py-1 text-xs" onClick={handleCreate} disabled={busy || !orgName.trim()}>
                      {busy ? 'Creating...' : 'Create'}
                    </button>
                    <button className="text-xs text-white/40 hover:text-white/70 px-2" onClick={() => setMode(null)}>Cancel</button>
                  </div>
                </div>
              )}
              {mode === 'join' && (
                <div className="space-y-1.5">
                  <input
                    className="w-full bg-white/10 text-white border border-white/20 rounded px-2 py-1 placeholder:text-white/30 focus:outline-none text-xs uppercase tracking-widest"
                    placeholder="Invite code (e.g. ABC123)"
                    value={inviteCode}
                    onChange={e => setInviteCode(e.target.value.toUpperCase())}
                    onKeyDown={e => e.key === 'Enter' && handleJoin()}
                  />
                  <div className="flex gap-1">
                    <button className="flex-1 btn-teal py-1 text-xs" onClick={handleJoin} disabled={busy || !inviteCode.trim()}>
                      {busy ? 'Joining...' : 'Join'}
                    </button>
                    <button className="text-xs text-white/40 hover:text-white/70 px-2" onClick={() => setMode(null)}>Cancel</button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Org exists */}
          {org && (
            <>
              <div className="flex items-center justify-between">
                <span className="text-white/70 font-semibold">{org.name}</span>
                {isOwner && <span className="badge badge-teal" style={{ fontSize: 9 }}>Admin</span>}
              </div>
              <div className="text-white/40">{org.memberEmails.length} member{org.memberEmails.length !== 1 ? 's' : ''}</div>

              {isOwner && (
                <div className="bg-white/5 rounded px-2 py-1.5 border border-white/10">
                  <div className="text-white/50 mb-0.5">Invite code</div>
                  <div className="font-mono text-teal font-bold tracking-widest text-sm">{org.inviteCode}</div>
                  <div className="text-white/30 mt-0.5">Share this code with colleagues to add them to {org.name}.</div>
                </div>
              )}

              <div>
                <div className="text-white/50 mb-1">Shared builds ({sharedBuilds.length})</div>
                {sharedBuilds.length === 0 && (
                  <div className="text-white/30 text-center py-1">No shared builds yet</div>
                )}
                {sharedBuilds.slice(0, 5).map(b => (
                  <div key={b.id} className="flex items-center gap-1.5 py-0.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                    <span className="text-white/60 truncate flex-1">{b.name}</span>
                    {b.sharedBy && <span className="text-white/25 text-xs">{b.sharedBy.split('@')[0]}</span>}
                  </div>
                ))}
              </div>

              {currentBuildId && (
                <button
                  className="w-full text-xs text-blue-300 border border-blue-400/30 rounded px-2 py-1 hover:bg-blue-400/10 transition-colors"
                  onClick={handleShare}
                  disabled={busy}
                >
                  {busy ? 'Sharing...' : 'Share current build with team'}
                </button>
              )}
            </>
          )}

          {msg && (
            <div className={['text-xs rounded px-2 py-1', msg.startsWith('Error') ? 'bg-red-500/10 text-red-300' : 'bg-green-500/10 text-green-300'].join(' ')}>
              {msg}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

import { useState } from 'react';
import { useStore } from '../../store/useStore.js';
import { useAuth } from '../../lib/AuthContext.jsx';
import { canUseFeature } from '../../lib/auth.js';

const ROLES = [
  { role: 'PM',             fn: 'Project Management',    defaultRaci: 'A',   desc: 'Overall delivery accountability and stakeholder management' },
  { role: 'Deputy PM',      fn: 'Project Management',    defaultRaci: 'A',   desc: 'PM cover; coordinates cross-functional updates' },
  { role: 'Change Manager', fn: 'Change Management',     defaultRaci: 'A',   desc: 'CAB co-ordination, change freeze oversight, RFC submission' },
  { role: 'Unix Admin',     fn: 'Unix / OS',             defaultRaci: 'R',   desc: 'OS build, kernel tuning, zoning requests, patching' },
  { role: 'Unix Lead',      fn: 'Unix / OS',             defaultRaci: 'A/R', desc: 'Unix team sign-off; escalation point for platform issues' },
  { role: 'DB Admin',       fn: 'Database',              defaultRaci: 'R',   desc: 'DB install, config, migration, backup, tuning' },
  { role: 'DBA Lead',       fn: 'Database',              defaultRaci: 'A/R', desc: 'DBA team sign-off; data migration strategy owner' },
  { role: 'App Admin',      fn: 'Application',           defaultRaci: 'R',   desc: 'Application deployment, config, go-live validation' },
  { role: 'App Lead',       fn: 'Application',           defaultRaci: 'A/R', desc: 'App team sign-off; owns release artefacts' },
  { role: 'Net Admin',      fn: 'Network',               defaultRaci: 'R',   desc: 'VLAN provisioning, firewall rules, DNS, VIP' },
  { role: 'Net Lead',       fn: 'Network',               defaultRaci: 'A/R', desc: 'Network team sign-off; routing escalation point' },
  { role: 'Storage Admin',  fn: 'Storage',               defaultRaci: 'R',   desc: 'LUN allocation, zoning, SAN fabric, snapshot policy' },
  { role: 'Storage Lead',   fn: 'Storage',               defaultRaci: 'A/R', desc: 'Storage team sign-off; capacity planning owner' },
  { role: 'Backup Admin',   fn: 'Backup / DR',           defaultRaci: 'R',   desc: 'Backup job setup, test restores, offsite replication' },
  { role: 'Backup Lead',    fn: 'Backup / DR',           defaultRaci: 'A/R', desc: 'Backup team sign-off; DR test schedule owner' },
  { role: 'Web Admin',      fn: 'Web / HTTP',            defaultRaci: 'R',   desc: 'Web server config, SSL certs, reverse proxy rules' },
  { role: 'Web Lead',       fn: 'Web / HTTP',            defaultRaci: 'A/R', desc: 'Web team sign-off; CDN and WAF policy owner' },
  { role: 'SecOps',         fn: 'Security',              defaultRaci: 'C',   desc: 'Security baseline review, vulnerability assessment, pen test' },
  { role: 'SecOps Lead',    fn: 'Security',              defaultRaci: 'A/C', desc: 'Security sign-off; compliance framework owner' },
  { role: 'QA Team Lead',   fn: 'Quality Assurance',     defaultRaci: 'A/R', desc: 'Smoke test execution, go/no-go decision, RTM sign-off' },
];

const RACI_OPTS = ['R', 'A', 'C', 'I', 'A/R', 'A/C', '-'];
const RACI_COLOR = {
  'R':   'bg-teal/15 text-teal font-bold',
  'A':   'bg-amber-100 text-amber-800 font-bold',
  'C':   'bg-blue-100 text-blue-700 font-semibold',
  'I':   'bg-slate-100 text-slate-600',
  'A/R': 'bg-orange-100 text-orange-800 font-bold',
  'A/C': 'bg-purple-100 text-purple-700 font-semibold',
  '-':   'bg-slate-50 text-slate-300',
};

function RaciLegend() {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 mb-4">
      {[['R', 'Responsible — does the work'],['A', 'Accountable — sign-off authority'],['C', 'Consulted — provides input'],['I', 'Informed — kept in the loop']].map(([k, v]) => (
        <div key={k} className="flex items-center gap-1.5">
          <span className={`inline-flex items-center justify-center w-5 h-5 rounded text-xs ${RACI_COLOR[k] || ''}`}>{k}</span>
          <span>{v}</span>
        </div>
      ))}
    </div>
  );
}

function RoleRow({ roleDef, assignment, onSave, canEdit }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: assignment?.name || '',
    email: assignment?.email || '',
    backup: assignment?.backup || '',
    raci: assignment?.raci || roleDef.defaultRaci,
  });

  const raci = assignment?.raci || roleDef.defaultRaci;
  const assigned = assignment?.name || assignment?.email;

  function handleSave() {
    onSave(roleDef.role, form);
    setEditing(false);
  }

  return (
    <div className="border-b border-slate-100 last:border-b-0">
      <div
        className={['flex items-start gap-3 px-3 py-2 transition-colors', canEdit ? 'cursor-pointer hover:bg-slate-50' : ''].join(' ')}
        onClick={() => canEdit && !editing && setEditing(true)}
      >
        <div className="w-32 flex-shrink-0">
          <div className="text-xs font-semibold text-slate-700">{roleDef.role}</div>
          <div className="text-xs text-slate-400 leading-tight">{roleDef.fn}</div>
        </div>
        <div className="flex-1 min-w-0">
          {assigned ? (
            <>
              <div className="text-xs font-medium text-slate-700">{assignment.name || '—'}</div>
              <div className="text-xs text-slate-400">{assignment.email || ''}</div>
              {assignment.backup && <div className="text-xs text-slate-400">Backup: {assignment.backup}</div>}
            </>
          ) : (
            <div className="text-xs text-slate-300 italic">Not assigned</div>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={`inline-flex items-center justify-center w-7 h-6 rounded text-xs ${RACI_COLOR[raci] || RACI_COLOR['-']}`}>{raci}</span>
          {canEdit && !editing && (
            <button className="text-xs text-slate-300 hover:text-teal px-1">Edit</button>
          )}
        </div>
      </div>

      {editing && (
        <div className="px-3 pb-3 pt-1 bg-slate-50 border-t border-slate-100 fade-in">
          <div className="text-xs text-slate-500 italic mb-2 leading-snug">{roleDef.desc}</div>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <div>
              <label className="text-xs text-slate-500 block mb-0.5">Name</label>
              <input
                type="text"
                className="w-full border border-slate-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-teal"
                placeholder="Full name"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-0.5">Email</label>
              <input
                type="email"
                className="w-full border border-slate-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-teal"
                placeholder="work@company.com"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-0.5">Backup Contact</label>
              <input
                type="text"
                className="w-full border border-slate-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-teal"
                placeholder="Name or email"
                value={form.backup}
                onChange={e => setForm(f => ({ ...f, backup: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-0.5">RACI</label>
              <select
                className="w-full border border-slate-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-teal"
                value={form.raci}
                onChange={e => setForm(f => ({ ...f, raci: e.target.value }))}
              >
                {RACI_OPTS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button className="text-xs bg-teal text-white rounded px-3 py-1 hover:bg-teal/80" onClick={handleSave}>Save</button>
            <button className="text-xs text-slate-400 hover:text-slate-600 border border-slate-200 rounded px-3 py-1" onClick={() => setEditing(false)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function RolesTab() {
  const s = useStore();
  const { authUser } = useAuth();

  const pmEmail = s.requirements?.pmEmail || '';
  const pmBackupEmail = s.requirements?.pmBackupEmail || '';
  const isPro = canUseFeature(authUser, 'save_builds');

  const isEditor = isPro && (
    !pmEmail ||
    authUser?.email === pmEmail ||
    authUser?.email === pmBackupEmail
  );

  const byFn = {};
  ROLES.forEach(r => {
    if (!byFn[r.fn]) byFn[r.fn] = [];
    byFn[r.fn].push(r);
  });

  const totalAssigned = ROLES.filter(r => s.roleAssignments[r.role]?.name || s.roleAssignments[r.role]?.email).length;

  return (
    <div className="p-4 h-full overflow-y-auto fade-in">
      <div className="flex items-start justify-between mb-1">
        <div>
          <div className="text-sm font-bold text-slate-700">Project RACI — Roles &amp; Assignments</div>
          <div className="text-xs text-slate-500">
            {totalAssigned} of {ROLES.length} roles assigned
            {!isEditor && isPro && pmEmail && (
              <span className="ml-2 text-amber-600">— editing restricted to PM ({pmEmail})</span>
            )}
            {!isPro && <span className="ml-2 text-amber-600">— Professional+ required to edit</span>}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="flex gap-1.5">
            <span className="badge badge-teal">{totalAssigned} assigned</span>
            <span className="badge badge-slate">{ROLES.length - totalAssigned} open</span>
          </div>
          {isEditor && (
            <div className="text-xs text-teal/80">Click any row to assign</div>
          )}
        </div>
      </div>

      <RaciLegend />

      {!isPro && (
        <div className="card p-4 mb-4 border-l-4 border-amber-400 bg-amber-50/50">
          <div className="text-xs font-semibold text-amber-800 mb-1">Professional+ Required to Edit</div>
          <div className="text-xs text-amber-700">Sign in with a Professional or Team plan to assign team members and customise RACI values. View is available to all plans.</div>
        </div>
      )}

      {isPro && pmEmail && !isEditor && (
        <div className="card p-3 mb-4 border-l-4 border-slate-300 bg-slate-50">
          <div className="text-xs text-slate-600">Role editing is restricted to the PM (<span className="font-semibold">{pmEmail}</span>) and their backup. Sign in with the PM account to make changes.</div>
        </div>
      )}

      <div className="space-y-4">
        {Object.entries(byFn).map(([fn, roles]) => (
          <div key={fn} className="card overflow-hidden">
            <div className="bg-slate-50 px-3 py-2 border-b border-slate-200 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600">{fn}</span>
              <span className="text-xs text-slate-400">{roles.filter(r => s.roleAssignments[r.role]?.name || s.roleAssignments[r.role]?.email).length}/{roles.length} assigned</span>
            </div>
            <div>
              {roles.map(roleDef => (
                <RoleRow
                  key={roleDef.role}
                  roleDef={roleDef}
                  assignment={s.roleAssignments[roleDef.role]}
                  onSave={s.setRoleAssignment}
                  canEdit={isEditor}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 text-xs text-slate-400 leading-relaxed">
        Set PM Email and PM Backup Email in Requirements (Phase 1 sidebar) to restrict editing to those accounts. All plan holders can view assignments.
      </div>
    </div>
  );
}

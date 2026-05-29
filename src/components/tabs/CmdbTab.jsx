import { useStore } from '../../store/useStore.js';
import { useAuth } from '../../lib/AuthContext.jsx';
import { canUseFeature } from '../../lib/auth.js';
import { getEolInfo } from '../../lib/eolData.js';
import { ALL_INC } from '../../lib/incidents.js';
import { ALL_UUM } from '../../lib/uumItems.js';

// Map layer names to CMDB CI types
const LAYER_CI = {
  hw:       'Hardware',
  unix:     'Operating System',
  os:       'Operating System',
  web:      'Web / HTTP',
  app:      'Application',
  db:       'Database',
  storage:  'Storage',
  stor:     'Storage',
  backup:   'Backup / DR',
  bk:       'Backup / DR',
  network:  'Network',
  net:      'Network',
  security: 'Security',
  sec:      'Security',
};

function resolveLayer(layerArr) {
  const types = new Set();
  (layerArr || []).forEach(l => {
    const ci = LAYER_CI[l.toLowerCase()];
    if (ci) types.add(ci);
  });
  return [...types];
}

function EolBadge({ component }) {
  const info = getEolInfo(component);
  if (!info) return null;
  const cls = { active: 'badge-green', eos_soon: 'badge-amber', eol: 'badge-red', unknown: 'badge-slate' };
  return (
    <div className="flex flex-col items-start gap-0.5">
      <span className={`badge ${cls[info.status] || 'badge-slate'}`}>{info.label}</span>
      {info.date && <span className="text-xs text-slate-400">{info.date}</span>}
    </div>
  );
}

function CiRow({ ci, idx }) {
  const incBadges = ci.incidents.slice(0, 3);
  const uumBadges = ci.uums.slice(0, 3);
  const rowBg = idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60';
  const eolInfo = getEolInfo(ci.component);
  const hasAlert = eolInfo?.status === 'eol' || eolInfo?.status === 'eos_soon';

  return (
    <tr className={[
      'border-b border-slate-100 transition-colors hover:bg-blue-50/20',
      rowBg,
      hasAlert ? 'border-l-2 border-l-amber-400' : '',
    ].join(' ')}>
      <td className="py-2.5 px-3 w-10">
        <span className="text-xs font-mono text-slate-400">{String(idx + 1).padStart(2, '0')}</span>
      </td>
      <td className="py-2.5 px-3 w-32">
        <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">{ci.type}</span>
      </td>
      <td className="py-2.5 px-3">
        <div className="text-xs font-semibold text-slate-800">{ci.component || '—'}</div>
        {ci.detail && <div className="text-xs text-slate-400 mt-0.5 truncate max-w-xs">{ci.detail}</div>}
      </td>
      <td className="py-2.5 px-3 w-36">
        <EolBadge component={ci.component} />
      </td>
      <td className="py-2.5 px-3 w-48">
        {incBadges.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {incBadges.map(code => (
              <span key={code} className="badge badge-red text-xs">{code}</span>
            ))}
            {ci.incidents.length > 3 && (
              <span className="text-xs text-slate-400">+{ci.incidents.length - 3}</span>
            )}
          </div>
        ) : (
          <span className="text-xs text-slate-300">None</span>
        )}
      </td>
      <td className="py-2.5 px-3 w-48">
        {uumBadges.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {uumBadges.map(code => (
              <span key={code} className="badge badge-amber text-xs">{code}</span>
            ))}
            {ci.uums.length > 3 && (
              <span className="text-xs text-slate-400">+{ci.uums.length - 3}</span>
            )}
          </div>
        ) : (
          <span className="text-xs text-slate-300">None</span>
        )}
      </td>
      <td className="py-2.5 px-3 w-32">
        <span className="text-xs text-slate-500">{ci.owner}</span>
      </td>
    </tr>
  );
}

function FlowNode({ label, sub, color, alert }) {
  const colors = {
    navy:   'bg-[#1A2E4A] text-white border-[#1A2E4A]',
    teal:   'bg-teal-600 text-white border-teal-600',
    amber:  'bg-amber-100 text-amber-800 border-amber-300',
    green:  'bg-green-100 text-green-800 border-green-300',
    slate:  'bg-slate-100 text-slate-700 border-slate-300',
    red:    'bg-red-100 text-red-800 border-red-400',
  };
  return (
    <div className={[
      'rounded-lg border-2 px-3 py-2 text-center min-w-[100px] relative',
      colors[color] || colors.slate,
      alert ? 'ring-2 ring-red-400 ring-offset-1' : '',
    ].join(' ')}>
      <div className="text-xs font-bold leading-tight">{label}</div>
      {sub && <div className="text-xs opacity-70 mt-0.5 leading-tight">{sub}</div>}
      {alert && (
        <div className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold">
          !
        </div>
      )}
    </div>
  );
}

function Arrow({ dir = 'down' }) {
  return (
    <div className={`flex ${dir === 'down' ? 'flex-col items-center' : 'flex-row items-center'}`}>
      <div className={dir === 'down' ? 'w-0.5 h-4 bg-slate-300' : 'h-0.5 w-4 bg-slate-300'} />
      <svg className={`w-3 h-3 text-slate-400 flex-shrink-0 ${dir === 'right' ? 'rotate-[-90deg]' : ''}`} fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
      </svg>
    </div>
  );
}

export default function CmdbTab() {
  const s = useStore();
  const { authUser, setShowAuthModal } = useAuth();
  const hasCmdb = canUseFeature(authUser, 'cmdb');

  if (!hasCmdb) {
    return (
      <div className="p-8 flex flex-col items-center justify-center h-full">
        <div className="text-center max-w-sm">
          <div className="w-14 h-14 bg-teal-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <div className="text-base font-bold text-slate-700 mb-2">CMDB — Pro Feature</div>
          <div className="text-sm text-slate-500 mb-4">
            The Configuration Management Database tracks all CIs, EOL/EOS status, incident and UUM mappings, and connectivity.
          </div>
          <div className="space-y-2 text-left bg-slate-50 rounded-lg p-4 mb-5 text-xs text-slate-600 border border-slate-200">
            <div className="font-semibold text-slate-700 mb-1">Included in Pro+</div>
            {['CI register with EOL / EOS alerts', 'Incident & UUM mapping per component', 'Live connectivity flow diagram', 'Editable design parameters', 'Auto-updates on build changes'].map(f => (
              <div key={f} className="flex items-center gap-2">
                <svg className="w-3 h-3 text-teal-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                {f}
              </div>
            ))}
          </div>
          <button
            onClick={() => setShowAuthModal(true)}
            className="btn-teal px-6 py-2 text-sm"
          >
            Upgrade to Pro
          </button>
          <div className="mt-2 text-xs text-slate-400">Use code OPSPRO to try Pro instantly</div>
        </div>
      </div>
    );
  }

  const { ctx, selInc, selUUM, sysDesignData, customInc } = s;

  // Build CI list
  const cis = [
    {
      type: 'Hardware',
      component: ctx.hw,
      detail: sysDesignData?.unix?.cpu ? `CPU: ${sysDesignData.unix.cpu} | RAM: ${sysDesignData.unix.ram}` : null,
      owner: 'Unix Admin',
      layers: ['hw'],
    },
    {
      type: 'Operating System',
      component: ctx.os,
      detail: sysDesignData?.unix?.kernel_params ? `Kernel: ${sysDesignData.unix.kernel_params}` : null,
      owner: 'Unix Admin',
      layers: ['unix', 'os'],
    },
    {
      type: 'Database',
      component: ctx.db,
      detail: sysDesignData?.db?.listener_port ? `Port: ${sysDesignData.db.listener_port} | Pool: ${sysDesignData.db.max_conn}` : null,
      owner: 'DB Admin',
      layers: ['db'],
    },
    {
      type: 'Application',
      component: ctx.app,
      detail: sysDesignData?.app?.app_port ? `Port: ${sysDesignData.app.app_port} | Deploy: ${sysDesignData.app.deploy_method}` : null,
      owner: 'App Admin',
      layers: ['app'],
    },
    {
      type: 'Web / HTTP',
      component: ctx.app?.includes('NGINX') || ctx.app?.includes('Apache') || ctx.app?.includes('IIS') ? ctx.app : (sysDesignData?.web?.notes ? 'NGINX / Apache (see config)' : null),
      detail: sysDesignData?.web?.ssl_protocols ? `TLS: ${sysDesignData.web.ssl_protocols}` : null,
      owner: 'Web Admin',
      layers: ['web'],
    },
    {
      type: 'Storage',
      component: sysDesignData?.storage?.san_fabric || (ctx.hw ? 'SAN / NFS' : null),
      detail: sysDesignData?.storage?.lun_size ? `LUN: ${sysDesignData.storage.lun_size} | RAID: ${sysDesignData.storage.raid_level}` : null,
      owner: 'Storage Admin',
      layers: ['storage', 'stor'],
    },
    {
      type: 'Backup / DR',
      component: sysDesignData?.backup?.backup_tool || (ctx.hw ? 'RMAN / Veeam' : null),
      detail: sysDesignData?.backup?.rpo_hours ? `RPO: ${sysDesignData.backup.rpo_hours}h | RTO: ${sysDesignData.backup.rto_hours}h` : null,
      owner: 'Backup Admin',
      layers: ['backup', 'bk'],
    },
    {
      type: 'Network',
      component: sysDesignData?.network?.bandwidth || (ctx.hw ? 'Enterprise Network' : null),
      detail: sysDesignData?.network?.vlan_ids ? `VLANs: ${sysDesignData.network.vlan_ids}` : null,
      owner: 'Net Admin',
      layers: ['network', 'net'],
    },
    {
      type: 'Security',
      component: sysDesignData?.security?.compliance_framework || (ctx.hw ? 'ISO 27001 / CIS' : null),
      detail: sysDesignData?.security?.siem_endpoint ? `SIEM: ${sysDesignData.security.siem_endpoint}` : null,
      owner: 'SecOps',
      layers: ['security', 'sec'],
    },
  ].filter(ci => ci.component);

  // Map incidents/UUMs to CI types
  function resolveInc(code) {
    return ALL_INC.find(i => i.code === code) || (customInc || []).find(c => c.code === code) || null;
  }

  const ciRows = cis.map(ci => ({
    ...ci,
    incidents: selInc.filter(code => {
      const inc = resolveInc(code);
      return inc && resolveLayer(inc.layers).some(ciType => ciType === ci.type);
    }),
    uums: selUUM.filter(code => {
      const uum = ALL_UUM.find(u => u.code === code);
      return uum && resolveLayer(uum.layers).some(ciType => ciType === ci.type);
    }),
  }));

  const eolCount = ciRows.filter(ci => getEolInfo(ci.component)?.status === 'eol').length;
  const eosSoonCount = ciRows.filter(ci => getEolInfo(ci.component)?.status === 'eos_soon').length;
  const incImpactCount = ciRows.filter(ci => ci.incidents.length > 0).length;
  const uumImpactCount = ciRows.filter(ci => ci.uums.length > 0).length;

  return (
    <div className="p-4 h-full overflow-y-auto fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-sm font-bold text-slate-700">Configuration Management Database (CMDB)</div>
          <div className="text-xs text-slate-500">{ciRows.length} configuration items · {ctx.hw} / {ctx.os}</div>
        </div>
        <div className="flex items-center gap-2">
          {eolCount > 0 && <span className="badge badge-red">{eolCount} EOL</span>}
          {eosSoonCount > 0 && <span className="badge badge-amber">{eosSoonCount} EOS Soon</span>}
          {incImpactCount > 0 && <span className="badge badge-red">{incImpactCount} CI w/ Incidents</span>}
          {uumImpactCount > 0 && <span className="badge badge-amber">{uumImpactCount} CI w/ UUM</span>}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        {[
          { label: 'Total CIs', value: ciRows.length, sub: 'Active components', color: 'text-slate-700', bg: 'bg-white border-slate-200' },
          { label: 'EOL / EOS Risk', value: eolCount + eosSoonCount, sub: `${eolCount} EOL · ${eosSoonCount} EOS Soon`, color: eolCount > 0 ? 'text-red-600' : 'text-amber-600', bg: eolCount > 0 ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200' },
          { label: 'Incident Impact', value: incImpactCount, sub: `${selInc.length} active incidents`, color: incImpactCount > 0 ? 'text-red-600' : 'text-slate-700', bg: incImpactCount > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-slate-200' },
          { label: 'UUM Scheduled', value: uumImpactCount, sub: `${selUUM.length} UUM items`, color: uumImpactCount > 0 ? 'text-amber-600' : 'text-slate-700', bg: uumImpactCount > 0 ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-200' },
        ].map(card => (
          <div key={card.label} className={`rounded-lg border px-3 py-2 ${card.bg}`}>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{card.label}</div>
            <div className={`text-2xl font-bold leading-tight mt-0.5 ${card.color}`}>{card.value}</div>
            <div className="text-xs text-slate-400">{card.sub}</div>
          </div>
        ))}
      </div>

      {/* CI Register table */}
      <div className="card overflow-hidden mb-4">
        <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200">
          <div className="text-xs font-bold text-slate-600 uppercase tracking-wide">CI Register</div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-white border-b border-slate-200 text-left">
                <th className="py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-10">#</th>
                <th className="py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-32">Type</th>
                <th className="py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Component / Version</th>
                <th className="py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-36">EOL / EOS</th>
                <th className="py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-48">Active Incidents</th>
                <th className="py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-48">UUM Changes</th>
                <th className="py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-32">Owner</th>
              </tr>
            </thead>
            <tbody>
              {ciRows.map((ci, idx) => (
                <CiRow key={ci.type} ci={ci} idx={idx} />
              ))}
              {ciRows.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-xs text-slate-400">
                    No CIs found — build an environment in Phase 1 first.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Connectivity flow + EOL alerts */}
      <div className="grid grid-cols-2 gap-4">

        {/* Mini flow diagram */}
        <div className="card overflow-hidden">
          <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200">
            <div className="text-xs font-bold text-slate-600 uppercase tracking-wide">Connectivity Map</div>
          </div>
          <div className="p-4 flex flex-col items-center gap-0">
            <FlowNode
              label="Hardware"
              sub={ctx.hw?.split(' ').slice(0, 3).join(' ')}
              color="navy"
              alert={ciRows.find(c => c.type === 'Hardware')?.incidents?.length > 0}
            />
            <Arrow />
            <FlowNode
              label="Operating System"
              sub={ctx.os?.split(' ').slice(0, 2).join(' ')}
              color={getEolInfo(ctx.os)?.status === 'eol' ? 'red' : getEolInfo(ctx.os)?.status === 'eos_soon' ? 'amber' : 'slate'}
              alert={ciRows.find(c => c.type === 'Operating System')?.incidents?.length > 0}
            />
            <Arrow />
            <div className="flex items-start gap-6">
              <div className="flex flex-col items-center gap-0">
                <FlowNode
                  label="Application"
                  sub={ctx.app?.split(' ').slice(0, 2).join(' ')}
                  color="amber"
                  alert={ciRows.find(c => c.type === 'Application')?.incidents?.length > 0}
                />
              </div>
              <div className="flex items-center gap-2 mt-4">
                <Arrow dir="right" />
                <FlowNode
                  label="Database"
                  sub={ctx.db?.split(' ').slice(0, 2).join(' ')}
                  color={getEolInfo(ctx.db)?.status === 'eol' ? 'red' : 'green'}
                  alert={ciRows.find(c => c.type === 'Database')?.incidents?.length > 0}
                />
              </div>
            </div>
            <Arrow />
            <FlowNode
              label="Storage / Backup"
              sub={sysDesignData?.storage?.san_fabric || 'SAN / NFS'}
              color="teal"
              alert={ciRows.find(c => c.type === 'Storage')?.incidents?.length > 0}
            />
            <Arrow />
            <FlowNode
              label="Network / Security"
              sub={sysDesignData?.security?.compliance_framework || 'ISO 27001'}
              color="navy"
              alert={ciRows.find(c => c.type === 'Security')?.incidents?.length > 0}
            />
          </div>
        </div>

        {/* EOL / EOS alerts */}
        <div className="card overflow-hidden">
          <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200">
            <div className="text-xs font-bold text-slate-600 uppercase tracking-wide">EOL / EOS Risk Assessment</div>
          </div>
          <div className="divide-y divide-slate-100">
            {ciRows.map(ci => {
              const info = getEolInfo(ci.component);
              if (!info || info.status === 'active' || info.status === 'unknown') return null;
              return (
                <div key={ci.type} className={[
                  'px-4 py-3 flex items-center gap-3',
                  info.status === 'eol' ? 'bg-red-50/50' : 'bg-amber-50/50',
                ].join(' ')}>
                  <div className="flex-shrink-0">
                    <span className={`badge ${info.badge}`}>{info.label}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-slate-700">{ci.type}</div>
                    <div className="text-xs text-slate-500 truncate">{ci.component}</div>
                  </div>
                  <div className="text-xs text-slate-400 flex-shrink-0">EOS: {info.date || '—'}</div>
                </div>
              );
            }).filter(Boolean)}
            {ciRows.every(ci => !getEolInfo(ci.component) || getEolInfo(ci.component)?.status === 'active') && (
              <div className="px-4 py-4 text-center text-xs text-green-600 font-semibold">
                All components within support lifecycle
              </div>
            )}
          </div>

          {/* Incident-CI mapping */}
          {selInc.length > 0 && (
            <>
              <div className="px-4 py-2.5 bg-slate-50 border-t border-b border-slate-200">
                <div className="text-xs font-bold text-slate-600 uppercase tracking-wide">Incident → CI Mapping</div>
              </div>
              <div className="divide-y divide-slate-100">
                {selInc.slice(0, 6).map(code => {
                  const inc = resolveInc(code);
                  if (!inc) return null;
                  const affectedCIs = resolveLayer(inc.layers);
                  return (
                    <div key={code} className="px-4 py-2.5 flex items-start gap-3">
                      <span className="badge badge-red flex-shrink-0 mt-0.5">{inc.short}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-slate-600 font-medium truncate">{inc.txt?.substring((inc.short?.length || 0) + 2, 60)}</div>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {affectedCIs.map(ci => (
                            <span key={ci} className="text-xs bg-slate-100 text-slate-600 rounded px-1.5 py-0.5">{ci}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

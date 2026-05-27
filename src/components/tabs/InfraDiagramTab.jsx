import { useStore } from '../../store/useStore.js';
import { ALL_INC } from '../../lib/incidents.js';
import { ALL_UUM } from '../../lib/uumItems.js';

function LayerBox({ title, value, subtitle, color, incidents, uumItems, width = '100%' }) {
  const hasInc = incidents.length > 0;
  const borderColor = hasInc ? '#EF4444' : color;
  const bgColor = hasInc ? '#FEF2F2' : '#F8FAFC';

  return (
    <div
      style={{
        border: `2px solid ${borderColor}`,
        borderRadius: 10,
        padding: '10px 14px',
        background: bgColor,
        position: 'relative',
        width,
        boxSizing: 'border-box',
        minHeight: 64,
      }}
    >
      <div style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 }}>{title}</div>
      <div style={{ fontSize: 13, fontWeight: 700, color: hasInc ? '#991B1B' : '#1E293B', lineHeight: 1.3 }}>{value || <span style={{ color: '#CBD5E1', fontStyle: 'italic', fontWeight: 400 }}>Not configured</span>}</div>
      {subtitle && <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 2 }}>{subtitle}</div>}
      {hasInc && (
        <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 3 }}>
          {incidents.map((inc, i) => (
            <span key={i} style={{ background: '#FEE2E2', color: '#B91C1C', fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 4, border: '1px solid #FECACA' }}>
              {inc}
            </span>
          ))}
        </div>
      )}
      {uumItems.length > 0 && (
        <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 3 }}>
          {uumItems.map((u, i) => (
            <span key={i} style={{ background: '#FEF3C7', color: '#92400E', fontSize: 9, fontWeight: 600, padding: '1px 6px', borderRadius: 4, border: '1px solid #FDE68A' }}>
              {u}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function Connector({ label }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '2px 0' }}>
      <div style={{ width: 2, height: 12, background: '#CBD5E1' }} />
      {label && (
        <div style={{ background: '#F1F5F9', border: '1px solid #E2E8F0', borderRadius: 4, padding: '0 6px', fontSize: 9, color: '#94A3B8', fontWeight: 600 }}>{label}</div>
      )}
      <div style={{ width: 2, height: 12, background: '#CBD5E1' }} />
      <div style={{ width: 0, height: 0, borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderTop: '7px solid #94A3B8' }} />
    </div>
  );
}

function SideConnector() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', padding: '0 4px' }}>
      <div style={{ height: 2, width: 16, background: '#CBD5E1' }} />
      <div style={{ width: 0, height: 0, borderTop: '5px solid transparent', borderBottom: '5px solid transparent', borderLeft: '7px solid #94A3B8' }} />
    </div>
  );
}

function DesignCard({ label, value }) {
  if (!value?.trim()) return null;
  return (
    <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 6, padding: '4px 8px', fontSize: 10 }}>
      <div style={{ color: '#94A3B8', fontWeight: 600, marginBottom: 1 }}>{label}</div>
      <div style={{ color: '#1E293B', fontWeight: 600 }}>{value}</div>
    </div>
  );
}

export default function InfraDiagramTab() {
  const s = useStore();

  if (!s.isBuilt) {
    return (
      <div className="p-6 flex flex-col items-center justify-center h-full">
        <div className="text-center max-w-sm">
          <div className="font-semibold text-slate-700 mb-1">Infrastructure Diagram</div>
          <div className="text-sm text-slate-500">Build the environment in Phase 1 to generate the topology diagram.</div>
        </div>
      </div>
    );
  }

  const ctx = s.ctx;
  const design = s.sysDesignData;

  // Map incident codes to affected layers
  const selIncObjects = s.selInc.map(code => {
    const found = ALL_INC.find(i => i.code === code);
    if (!found) {
      const custom = s.customInc?.find(c => c.code === code);
      return custom ? { ...custom, grp: 'Custom' } : null;
    }
    return found;
  }).filter(Boolean);

  const grpToLayer = {
    'OS / Kernel': 'os', 'Network': 'network', 'Database': 'db', 'Application': 'app',
    'Security': 'security', 'Backup': 'backup', 'Storage': 'storage',
    'Unix / OS': 'os', 'Web / HTTP': 'app', 'Custom': 'app',
  };

  const layerInc = { hw: [], os: [], app: [], db: [], network: [], storage: [], backup: [], security: [] };
  selIncObjects.forEach(inc => {
    const layer = grpToLayer[inc.grp] || 'app';
    if (layerInc[layer]) layerInc[layer].push(inc.short?.substring(0, 30) || inc.code);
  });

  const selUUMObjects = s.selUUM.map(code => ALL_UUM.find(u => u.code === code)).filter(Boolean);
  const layerUUM = { hw: [], os: [], app: [], db: [], network: [], storage: [], backup: [], security: [] };
  selUUMObjects.forEach(u => {
    const layers = u.layers || [];
    layers.forEach(l => {
      if (layerUUM[l]) layerUUM[l].push(u.short?.substring(0, 25) || u.code);
    });
  });

  const unix = design.unix || {};
  const web = design.web || {};
  const app = design.app || {};
  const db = design.db || {};
  const storage = design.storage || {};
  const backup = design.backup || {};
  const network = design.network || {};
  const security = design.security || {};

  const anyInc = selIncObjects.length > 0;
  const overallHealth = !s.isBuilt ? 'NOT BUILT' : s.promoted ? 'PRODUCTION STABLE' : anyInc ? 'FAULT ACTIVE' : s.cabDeclined ? 'CHANGE DECLINED' : s.cabApproved ? 'CAB APPROVED' : s.phase2Active ? 'REMEDIATION' : 'HEALTHY';
  const healthColor = { 'PRODUCTION STABLE': '#16A34A', 'FAULT ACTIVE': '#DC2626', 'CHANGE DECLINED': '#DC2626', 'REMEDIATION': '#D97706', 'CAB APPROVED': '#0F766E', 'HEALTHY': '#0F766E', 'NOT BUILT': '#94A3B8' }[overallHealth] || '#0F766E';

  return (
    <div className="p-4 h-full overflow-y-auto fade-in">

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-sm font-bold text-slate-700">Infrastructure Topology Diagram</div>
          <div className="text-xs text-slate-500">{s.requirements.projectName || 'Infrastructure Project'} — {s.requirements.envType || 'Production'}</div>
        </div>
        <div className="flex items-center gap-2">
          <div style={{ background: healthColor, color: 'white', borderRadius: 6, padding: '3px 10px', fontSize: 11, fontWeight: 700, letterSpacing: 0.5 }}>
            {overallHealth}
          </div>
          {anyInc && <span className="badge badge-red">{selIncObjects.length} incident{selIncObjects.length > 1 ? 's' : ''}</span>}
          {s.selUUM.length > 0 && <span className="badge badge-amber">{s.selUUM.length} UUM</span>}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mb-4 text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2 border border-slate-200">
        <div className="flex items-center gap-1.5"><div style={{ width: 12, height: 12, borderRadius: 3, border: '2px solid #0F766E', background: '#F8FAFC' }} /><span>Healthy layer</span></div>
        <div className="flex items-center gap-1.5"><div style={{ width: 12, height: 12, borderRadius: 3, border: '2px solid #EF4444', background: '#FEF2F2' }} /><span>Incident active</span></div>
        <div className="flex items-center gap-1.5"><div style={{ width: 10, height: 10, borderRadius: 2, background: '#FEE2E2', border: '1px solid #FECACA' }} /><span>Incident tag</span></div>
        <div className="flex items-center gap-1.5"><div style={{ width: 10, height: 10, borderRadius: 2, background: '#FEF3C7', border: '1px solid #FDE68A' }} /><span>UUM change</span></div>
      </div>

      {/* Main Topology Diagram */}
      <div className="card p-4 mb-4">
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', maxWidth: 700, margin: '0 auto' }}>

          {/* Top: Hardware */}
          <LayerBox
            title="Hardware Platform"
            value={ctx.hw}
            subtitle={`${unix.cpu || ''} ${unix.ram ? '| ' + unix.ram : ''}`}
            color="#6366F1"
            incidents={layerInc.hw}
            uumItems={layerUUM.hw}
            width="80%"
          />

          <Connector label="Virtualisation / Bare Metal" />

          {/* OS Layer */}
          <LayerBox
            title="Operating System"
            value={ctx.os}
            subtitle={[unix.kernel_params && 'Kernel tuned', unix.selinux && `SELinux: ${unix.selinux}`, unix.patch_window && `Patch: ${unix.patch_window}`].filter(Boolean).join(' | ')}
            color="#0F766E"
            incidents={layerInc.os}
            uumItems={layerUUM.os}
            width="80%"
          />

          <Connector label="System calls / IPC" />

          {/* Middle row: App + DB side by side */}
          <div style={{ display: 'flex', width: '100%', gap: 8, alignItems: 'flex-start' }}>

            {/* Left: Web → App */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <LayerBox
                title="Web / HTTP Layer"
                value={ctx.app?.includes('NGINX') || ctx.app?.includes('Apache') ? ctx.app : (web.health_check_url ? 'HTTP Tier' : ctx.app)}
                subtitle={[web.ssl_protocols && `TLS: ${web.ssl_protocols}`, web.load_bal_algo && `LB: ${web.load_bal_algo}`].filter(Boolean).join(' | ')}
                color="#3B82F6"
                incidents={layerInc.app.filter((_, i) => i < 2)}
                uumItems={layerUUM.app.filter((_, i) => i < 2)}
                width="100%"
              />
              <Connector />
              <LayerBox
                title="Application Runtime"
                value={ctx.app}
                subtitle={[app.jvm_xmx && `Heap: ${app.jvm_xmx}`, app.thread_pool && `Threads: ${app.thread_pool}`, app.app_port && `Port: ${app.app_port}`].filter(Boolean).join(' | ')}
                color="#8B5CF6"
                incidents={layerInc.app.filter((_, i) => i >= 2)}
                uumItems={layerUUM.app.filter((_, i) => i >= 2)}
                width="100%"
              />
            </div>

            <SideConnector />

            {/* Right: Database */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <LayerBox
                title="Database Engine"
                value={ctx.db}
                subtitle={[db.buf_pool && `Buffer: ${db.buf_pool}`, db.max_conn && `MaxConn: ${db.max_conn}`, db.listener_port && `Port: ${db.listener_port}`].filter(Boolean).join(' | ')}
                color="#F59E0B"
                incidents={layerInc.db}
                uumItems={layerUUM.db}
                width="100%"
              />
              <Connector label="JDBC / native" />
              <LayerBox
                title="DB Storage"
                value={`${db.replication || 'Standalone'}`}
                subtitle={[db.standby_lag && `Standby lag: ${db.standby_lag}`, db.archive_dest && `Archive: ${db.archive_dest}`].filter(Boolean).join(' | ')}
                color="#D97706"
                incidents={[]}
                uumItems={layerUUM.db.filter((_, i) => i >= 2)}
                width="100%"
              />
            </div>
          </div>

          <Connector label="SAN / NFS / iSCSI" />

          {/* Storage */}
          <div style={{ display: 'flex', width: '100%', gap: 8 }}>
            <LayerBox
              title="Block / File Storage"
              value={[storage.raid_level && `RAID: ${storage.raid_level}`, storage.lun_size && `LUN: ${storage.lun_size}`, storage.iops_req && `IOPS: ${storage.iops_req}`].filter(Boolean).join(' | ') || 'Storage Layer'}
              subtitle={[storage.multipath_mode && `Multipath: ${storage.multipath_mode}`, storage.thin_prov && `Thin: ${storage.thin_prov}`].filter(Boolean).join(' | ')}
              color="#64748B"
              incidents={layerInc.storage}
              uumItems={layerUUM.storage}
              width="50%"
            />
            <LayerBox
              title="Backup / DR"
              value={[backup.backup_tool && backup.backup_tool, `RPO: ${backup.rpo_hours || '4'}h`, `RTO: ${backup.rto_hours || '8'}h`].filter(Boolean).join(' | ')}
              subtitle={[backup.offsite_target && `Offsite: ${backup.offsite_target}`, backup.immutable && `Immutable: ${backup.immutable}`].filter(Boolean).join(' | ')}
              color="#0EA5E9"
              incidents={layerInc.backup}
              uumItems={layerUUM.backup}
              width="50%"
            />
          </div>

          <Connector label="TCP/IP stack" />

          {/* Network + Security */}
          <div style={{ display: 'flex', width: '100%', gap: 8 }}>
            <LayerBox
              title="Network"
              value={[network.vlan_ids && `VLANs: ${network.vlan_ids}`, network.bandwidth && network.bandwidth, network.bond_mode && `Bond: ${network.bond_mode}`].filter(Boolean).join(' | ') || 'Network Layer'}
              subtitle={[network.fw_rules && `FW Rules active`, network.load_bal && `LB: ${network.load_bal}`].filter(Boolean).join(' | ')}
              color="#06B6D4"
              incidents={layerInc.network}
              uumItems={layerUUM.network}
              width="50%"
            />
            <LayerBox
              title="Security Controls"
              value={[security.compliance_framework && security.compliance_framework, security.mfa_required && `MFA: ${security.mfa_required}`].filter(Boolean).join(' | ') || 'Security Layer'}
              subtitle={[security.siem_endpoint && `SIEM active`, security.ids_ips && `IDS/IPS: ${security.ids_ips}`, security.edr && `EDR: ${security.edr}`].filter(Boolean).join(' | ')}
              color="#EF4444"
              incidents={layerInc.security}
              uumItems={layerUUM.security}
              width="50%"
            />
          </div>
        </div>
      </div>

      {/* Key Metrics Grid */}
      {s.designApplied && (
        <div className="card p-4 mb-4">
          <div className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-3">Key Design Parameters</div>
          <div className="grid grid-cols-3 gap-3">
            <DesignCard label="CPU Allocation" value={unix.cpu} />
            <DesignCard label="RAM" value={unix.ram} />
            <DesignCard label="NTP Server" value={unix.ntp_server} />
            <DesignCard label="TLS Protocols" value={web.ssl_protocols} />
            <DesignCard label="WAF" value={web.waf} />
            <DesignCard label="HSTS" value={web.hsts} />
            <DesignCard label="JVM Heap Max" value={app.jvm_xmx} />
            <DesignCard label="GC Policy" value={app.gc_policy} />
            <DesignCard label="Cache Provider" value={app.cache_provider} />
            <DesignCard label="Buffer Pool" value={db.buf_pool} />
            <DesignCard label="Replication" value={db.replication} />
            <DesignCard label="TDE" value={db.tde} />
            <DesignCard label="RAID Level" value={storage.raid_level} />
            <DesignCard label="IOPS Requirement" value={storage.iops_req} />
            <DesignCard label="Thin Provisioning" value={storage.thin_prov} />
            <DesignCard label="RPO (hours)" value={backup.rpo_hours} />
            <DesignCard label="RTO (hours)" value={backup.rto_hours} />
            <DesignCard label="Backup Tool" value={backup.backup_tool} />
            <DesignCard label="Bandwidth" value={network.bandwidth} />
            <DesignCard label="VLANs" value={network.vlan_ids} />
            <DesignCard label="Firewall Rules" value={network.fw_rules} />
            <DesignCard label="Compliance" value={security.compliance_framework} />
            <DesignCard label="Patch SLA" value={security.patch_sla} />
            <DesignCard label="SIEM" value={security.siem_endpoint} />
          </div>
        </div>
      )}

      {/* Incident Impact Map */}
      {selIncObjects.length > 0 && (
        <div className="card p-4 border-l-4 border-red-500 mb-4">
          <div className="text-xs font-bold text-red-700 uppercase tracking-wide mb-3">Active Incident Impact Map</div>
          <div className="space-y-2">
            {selIncObjects.map(inc => {
              const fixed = s.promoted || s.selFix.includes(inc.code);
              return (
                <div key={inc.code} className={['rounded border px-3 py-2 text-xs flex items-start gap-3', fixed ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'].join(' ')}>
                  <span className={['flex-shrink-0 font-bold', fixed ? 'text-green-600' : 'text-red-600'].join(' ')}>{fixed ? 'RESOLVED' : 'ACTIVE'}</span>
                  <div>
                    <div className="font-semibold text-slate-800">{inc.short}</div>
                    <div className="text-slate-500 mt-0.5 leading-snug">{inc.txt?.substring((inc.short?.length || 0) + 2, 120)}</div>
                  </div>
                  <span className="ml-auto flex-shrink-0 text-xs text-slate-400">{inc.grp}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* UUM Change Schedule */}
      {selUUMObjects.length > 0 && (
        <div className="card p-4 border-l-4 border-amber-400">
          <div className="text-xs font-bold text-amber-700 uppercase tracking-wide mb-3">UUM Change Schedule</div>
          <div className="space-y-2">
            {selUUMObjects.map(u => (
              <div key={u.code} className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs flex items-start gap-3">
                <span className={['flex-shrink-0 badge text-xs', u.type === 'migration' ? 'badge-blue' : u.type === 'upgrade' ? 'badge-amber' : 'badge-slate'].join(' ')}>{u.type.toUpperCase()}</span>
                <div>
                  <div className="font-semibold text-slate-800">{u.short}</div>
                  <div className="text-slate-500 mt-0.5">{u.layers?.join(', ') || 'General'} layer(s)</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

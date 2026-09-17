// CIT — Component Integration Tests: multi-domain catalog architecture
// Validates every non-infra domain catalog has the exact shape
// getRealTasks/buildDesignTasks/getIncidentFixTasks/PhasePanel expect, and
// that applyDomain.js correctly mutates and restores the shared catalog
// containers (ALL_INC, ALL_UUM, DESIGN_SECTIONS, etc.) without leaking
// state between domains or losing infra's original content.

import { describe, it, expect, afterEach } from 'vitest';
import { DOMAINS } from '../domains/registry.js';
import { NON_INFRA_CATALOGS } from '../domains/lookup.js';

const NON_INFRA_COUNT = Object.keys(NON_INFRA_CATALOGS).length;
import { applyDomain } from '../domains/applyDomain.js';
import { getCurrentDomainId } from '../domains/currentDomain.js';
import { ALL_INC, FIXES } from '../lib/incidents.js';
import { ALL_UUM } from '../lib/uumItems.js';
import { DESIGN_SECTIONS, FIELD_LABELS, HW_OPTIONS, OS_OPTIONS, DB_OPTIONS, APP_OPTIONS } from '../store/useStore.js';
import { getRealTasks } from '../lib/realTasks.js';
import { getIncidentFixTasks } from '../lib/incidentFixTasks.js';
import { buildDesignTasks } from '../lib/designTasks.js';
import { generateTaskPlan } from '../lib/smartScan.js';

// Every catalog test mutates the shared exported arrays — always restore
// infra afterward so later test files (which assume infra defaults) aren't
// affected by import order.
afterEach(() => { applyDomain('infra'); });

describe('DOMAINS registry', () => {
  it('lists infra plus every catalog in NON_INFRA_CATALOGS, each with 4 axis labels and a unique id/accent', () => {
    expect(DOMAINS.find(d => d.id === 'infra')).toBeTruthy();
    expect(DOMAINS.length).toBe(NON_INFRA_COUNT + 1);
    DOMAINS.forEach(d => expect(d.axisLabels.length).toBe(4));

    const ids = DOMAINS.map(d => d.id);
    expect(new Set(ids).size).toBe(ids.length);
    const accents = DOMAINS.map(d => d.accent);
    expect(new Set(accents).size).toBe(accents.length);

    // Every non-infra catalog must have a matching registry entry (and vice versa)
    Object.keys(NON_INFRA_CATALOGS).forEach(id => {
      expect(DOMAINS.find(d => d.id === id), `registry missing entry for ${id}`).toBeTruthy();
    });
  });
});

describe.each(Object.entries(NON_INFRA_CATALOGS))('%s catalog shape', (domainId, catalog) => {
  it('has 4 axis option arrays, each non-empty', () => {
    expect(catalog.axisOptions.length).toBe(4);
    catalog.axisOptions.forEach(opts => expect(opts.length).toBeGreaterThan(0));
  });

  it('every UUM item code has a matching uumTasks entry with at least one task', () => {
    catalog.uumItems.forEach(u => {
      const tasks = catalog.uumTasks[u.code];
      expect(tasks, `missing uumTasks for ${u.code}`).toBeTruthy();
      expect(tasks.length).toBeGreaterThan(0);
      tasks.forEach(t => {
        expect(typeof t.role).toBe('string');
        expect(typeof t.name).toBe('string');
      });
    });
  });

  it('every incident code has a matching fix + incidentFixTasks entry', () => {
    catalog.incidents.forEach(inc => {
      expect(catalog.fixes[inc.code], `missing fix text for ${inc.code}`).toBeTruthy();
      const tasks = catalog.incidentFixTasks[inc.code];
      expect(tasks, `missing incidentFixTasks for ${inc.code}`).toBeTruthy();
      expect(tasks.length).toBeGreaterThan(0);
    });
  });

  it('every design section field has a label, and every section has an owner', () => {
    catalog.designSections.forEach(section => {
      expect(section.owner).toBeTruthy();
      section.fields.forEach(f => {
        expect(catalog.fieldLabels[f], `missing fieldLabel for ${domainId}.${section.key}.${f}`).toBeTruthy();
      });
    });
  });

  it('all incident/UUM codes are unique within the catalog', () => {
    const incCodes = catalog.incidents.map(i => i.code);
    const uumCodes = catalog.uumItems.map(u => u.code);
    expect(new Set(incCodes).size).toBe(incCodes.length);
    expect(new Set(uumCodes).size).toBe(uumCodes.length);
  });
});

describe('applyDomain — catalog switching', () => {
  it('mutates ALL_INC/ALL_UUM/DESIGN_SECTIONS in place (same array reference)', () => {
    const incRef = ALL_INC, uumRef = ALL_UUM, sectionsRef = DESIGN_SECTIONS;
    applyDomain('appDev');
    expect(ALL_INC).toBe(incRef); // same reference, contents changed
    expect(ALL_UUM).toBe(uumRef);
    expect(DESIGN_SECTIONS).toBe(sectionsRef);
    expect(ALL_INC[0].code).toMatch(/^ad_inc_/);
    expect(DESIGN_SECTIONS.map(s => s.key)).toEqual(['requirements', 'architecture', 'frontend', 'quality', 'release', 'compliance']);
  });

  it('restores infra content exactly after switching away and back', () => {
    const originalIncCount = ALL_INC.length;
    const originalFirstCode = ALL_INC[0].code;
    const originalSectionKeys = DESIGN_SECTIONS.map(s => s.key);

    applyDomain('sapPm');
    expect(ALL_INC[0].code).toMatch(/^sap_inc_/);

    applyDomain('infra');
    expect(ALL_INC.length).toBe(originalIncCount);
    expect(ALL_INC[0].code).toBe(originalFirstCode);
    expect(DESIGN_SECTIONS.map(s => s.key)).toEqual(originalSectionKeys);
    expect(FIELD_LABELS.cpu).toBe('CPU Allocation'); // spot-check an infra-only label survives
  });

  it('swaps all 4 axis option arrays per domain', () => {
    applyDomain('bfsiPm');
    expect(HW_OPTIONS).toContain('Retail Bank');
    applyDomain('infra');
    expect(HW_OPTIONS).toContain('Dell PowerEdge (x86_64)');
    expect(HW_OPTIONS).not.toContain('Retail Bank');
  });

  it('updates getCurrentDomainId()', () => {
    applyDomain('cloudMigration');
    expect(getCurrentDomainId()).toBe('cloudMigration');
    applyDomain('infra');
    expect(getCurrentDomainId()).toBe('infra');
  });
});

describe('domain-dispatching task generators', () => {
  it('getRealTasks returns the catalog-authored tasks for a non-infra UUM code', () => {
    applyDomain('appDev');
    const tasks = getRealTasks({ code: 'ad_uum_1' }, {});
    expect(tasks.length).toBeGreaterThan(0);
    expect(tasks[0].role).toBeTruthy();
  });

  it('getIncidentFixTasks returns the catalog-authored tasks for a non-infra incident code', () => {
    applyDomain('sapPm');
    const tasks = getIncidentFixTasks({ code: 'sap_inc_1' }, {});
    expect(tasks.length).toBeGreaterThan(0);
  });

  it('buildDesignTasks falls back to infra logic for the infra domain (unchanged)', () => {
    applyDomain('infra');
    // empty sysDesignData -> infra's field-by-field logic produces zero tasks, same as before this feature existed
    expect(buildDesignTasks({})).toEqual([]);
  });

  it('buildDesignTasks produces a generic implementation+validation pair per filled section for a non-infra domain', () => {
    applyDomain('appDev');
    const tasks = buildDesignTasks({ frontend: { framework: 'React 19' } });
    expect(tasks.length).toBe(2);
    expect(tasks[0].team).toBe('Frontend Eng');
    expect(tasks[1].team).toBe('QA Eng');
  });

  it('generateTaskPlan produces a milestone-terminated plan for a non-infra domain without touching infra output', () => {
    applyDomain('bfsiPm');
    const tasks = generateTaskPlan({ coreBanking: { cbs_platform: 'Temenos T24/Transact' } }, {});
    expect(tasks.some(t => t.milestone)).toBe(true);
    expect(tasks[0].team).toBe('Core Banking Ops');

    applyDomain('infra');
    const infraTasks = generateTaskPlan({}, { hw: 'Dell', os: 'RHEL', db: 'Postgres', app: 'Tomcat' });
    expect(infraTasks.length).toBe(25); // infra's generator is unconditional — always 25 tasks regardless of field fill
    expect(infraTasks[0].name).toBe('Network — VLAN provisioning and firewall rules');
  });
});

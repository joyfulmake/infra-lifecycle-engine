import { useEffect, useRef } from 'react';
import { useStore } from '../store/useStore.js';
import { runCoherenceChecks } from './coherenceEngine.js';

export function useCoherenceEngine() {
  const timerRef = useRef(null);

  const isBuilt = useStore(s => s.isBuilt);
  const designApplied = useStore(s => s.designApplied);
  const phase2Active = useStore(s => s.phase2Active);
  const rtmSigned = useStore(s => s.rtmSigned);
  const promoted = useStore(s => s.promoted);
  const cabApproved = useStore(s => s.cabApproved);
  const rtmStale = useStore(s => s.rtmStale);
  const tasksStaleReason = useStore(s => s.tasksStaleReason);
  const selInc = useStore(s => s.selInc);
  const selUUM = useStore(s => s.selUUM);
  const customInc = useStore(s => s.customInc);
  const sysDesignData = useStore(s => s.sysDesignData);
  const requirements = useStore(s => s.requirements);
  const rtmRows = useStore(s => s.rtmRows);
  const roleAssignments = useStore(s => s.roleAssignments);
  const liveEolData = useStore(s => s.liveEolData);
  const setCoherenceAlerts = useStore(s => s.setCoherenceAlerts);

  useEffect(() => {
    if (!isBuilt) {
      setCoherenceAlerts([]);
      return;
    }
    const snapshot = {
      isBuilt, designApplied, phase2Active, rtmSigned,
      promoted, cabApproved, rtmStale, tasksStaleReason,
      selInc, selUUM, customInc, sysDesignData, requirements, rtmRows, roleAssignments,
      liveEolData,
    };
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setCoherenceAlerts(runCoherenceChecks(snapshot));
    }, 600);
    return () => clearTimeout(timerRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isBuilt, designApplied, phase2Active, rtmSigned, promoted, cabApproved, rtmStale, tasksStaleReason, selInc, selUUM, customInc, sysDesignData, requirements, rtmRows, roleAssignments, liveEolData]);
}

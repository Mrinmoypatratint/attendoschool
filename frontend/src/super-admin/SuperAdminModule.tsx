import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { SuperAdminLayout } from './SuperAdminLayout';
import { SuperAdminOverview } from './SuperAdminOverview';
import { SchoolsManagement } from './SchoolsManagement';
import { SubscriptionsManagement } from './SubscriptionsManagement';
import { PaymentsLedger } from './PaymentsLedger';
import { InvoicesManagement } from './InvoicesManagement';
import { MonitoringHealth } from './MonitoringHealth';
import { PlatformAnalytics } from './PlatformAnalytics';
import { PeopleDirectory } from './PeopleDirectory';
import { RolesPermissions } from './RolesPermissions';
import { SecurityCenter } from './SecurityCenter';
import { AuditLogsViewer } from './AuditLogsViewer';
import { PlatformSettings } from './PlatformSettings';
import { ReportsManagement } from './ReportsManagement';
import { BackupsManagement } from './BackupsManagement';
import './super-admin.css';

function resolveSubRoute(pathname: string, hash: string): string {
  // 1. Check hash first if present
  const cleanHash = (hash || '').replace(/^#/, '').split('?')[0].trim();
  if (cleanHash) {
    if (cleanHash.startsWith('/super-admin/')) {
      const sub = cleanHash.replace('/super-admin/', '');
      if (sub === 'monitor' || sub === 'monitoring' || sub === 'health') return '/super-admin/monitoring';
      if (sub === 'users' || sub === 'people') return '/super-admin/people';
      if (sub === 'roles' || sub === 'permissions') return '/super-admin/permissions';
      if (sub === 'reports' || sub === 'attendance-reports') return '/super-admin/reports';
      if (sub === 'backups' || sub === 'backup') return '/super-admin/backups';
      if (sub === 'schools') return '/super-admin/schools';
      if (sub === 'subscriptions') return '/super-admin/subscriptions';
      if (sub === 'payments') return '/super-admin/payments';
      if (sub === 'invoices') return '/super-admin/invoices';
      if (sub === 'analytics') return '/super-admin/analytics';
      if (sub === 'security') return '/super-admin/security';
      if (sub === 'audit-logs' || sub === 'audit') return '/super-admin/audit-logs';
      if (sub === 'settings') return '/super-admin/settings';
      return cleanHash;
    }
    if (cleanHash === '/super-admin' || cleanHash === '/dashboard') return '/super-admin';
    if (cleanHash === '/schools') return '/super-admin/schools';
    if (cleanHash === '/subscriptions') return '/super-admin/subscriptions';
    if (cleanHash === '/payments') return '/super-admin/payments';
    if (cleanHash === '/invoices') return '/super-admin/invoices';
    if (cleanHash === '/monitor' || cleanHash === '/monitoring' || cleanHash === '/health') return '/super-admin/monitoring';
    if (cleanHash === '/analytics') return '/super-admin/analytics';
    if (cleanHash === '/reports' || cleanHash === '/attendance-reports') return '/super-admin/reports';
    if (cleanHash === '/people' || cleanHash === '/users') return '/super-admin/people';
    if (cleanHash === '/permissions' || cleanHash === '/roles') return '/super-admin/permissions';
    if (cleanHash === '/security') return '/super-admin/security';
    if (cleanHash === '/audit-logs' || cleanHash === '/audit') return '/super-admin/audit-logs';
    if (cleanHash === '/backups' || cleanHash === '/backup') return '/super-admin/backups';
    if (cleanHash === '/settings') return '/super-admin/settings';
  }

  // 2. Check pathname from React Router
  const cleanPath = (pathname || '').split('?')[0].trim();
  if (cleanPath.startsWith('/super-admin/')) {
    const sub = cleanPath.replace('/super-admin/', '');
    if (sub === 'monitor' || sub === 'monitoring' || sub === 'health') return '/super-admin/monitoring';
    if (sub === 'users' || sub === 'people') return '/super-admin/people';
    if (sub === 'roles' || sub === 'permissions') return '/super-admin/permissions';
    if (sub === 'reports' || sub === 'attendance-reports') return '/super-admin/reports';
    if (sub === 'backups' || sub === 'backup') return '/super-admin/backups';
    if (sub === 'schools') return '/super-admin/schools';
    if (sub === 'subscriptions') return '/super-admin/subscriptions';
    if (sub === 'payments') return '/super-admin/payments';
    if (sub === 'invoices') return '/super-admin/invoices';
    if (sub === 'analytics') return '/super-admin/analytics';
    if (sub === 'security') return '/super-admin/security';
    if (sub === 'audit-logs' || sub === 'audit') return '/super-admin/audit-logs';
    if (sub === 'settings') return '/super-admin/settings';
    return cleanPath;
  }

  if (cleanPath === '/reports' || cleanPath === '/attendance-reports') return '/super-admin/reports';
  if (cleanPath === '/monitor' || cleanPath === '/monitoring') return '/super-admin/monitoring';
  if (cleanPath === '/payments') return '/super-admin/payments';
  if (cleanPath === '/invoices') return '/super-admin/invoices';
  if (cleanPath === '/backups') return '/super-admin/backups';
  if (cleanPath === '/analytics') return '/super-admin/analytics';
  if (cleanPath === '/people') return '/super-admin/people';
  if (cleanPath === '/permissions') return '/super-admin/permissions';
  if (cleanPath === '/security') return '/super-admin/security';

  return '/super-admin';
}

export const SuperAdminModule: React.FC = () => {
  const location = useLocation();
  const nav = useNavigate();

  const [currentPath, setCurrentPath] = useState<string>(() =>
    resolveSubRoute(location.pathname, window.location.hash)
  );

  useEffect(() => {
    setCurrentPath(resolveSubRoute(location.pathname, window.location.hash));
  }, [location.pathname, location.hash]);

  useEffect(() => {
    const handleHashChange = () => {
      setCurrentPath(resolveSubRoute(location.pathname, window.location.hash));
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [location.pathname]);

  const handleNavigate = useCallback((path: string) => {
    const target = path.split('?')[0].trim();
    if (window.location.hash) {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
    nav(path);
    setCurrentPath(resolveSubRoute(target, ''));
  }, [nav]);

  // Render sub-view according to currentPath
  const renderContent = () => {
    const base = currentPath.split('?')[0].trim();
    switch (base) {
      case '/super-admin/schools':
        return <SchoolsManagement />;
      case '/super-admin/subscriptions':
        return <SubscriptionsManagement onNavigateSchools={() => handleNavigate('/super-admin/schools')} />;
      case '/super-admin/payments':
        return <PaymentsLedger />;
      case '/super-admin/invoices':
        return <InvoicesManagement />;
      case '/super-admin/monitoring':
      case '/super-admin/monitor':
        return <MonitoringHealth />;
      case '/super-admin/analytics':
        return <PlatformAnalytics />;
      case '/super-admin/reports':
      case '/attendance-reports':
        return <ReportsManagement />;
      case '/super-admin/people':
      case '/super-admin/users':
        return <PeopleDirectory />;
      case '/super-admin/permissions':
      case '/super-admin/roles':
        return <RolesPermissions />;
      case '/super-admin/security':
        return <SecurityCenter />;
      case '/super-admin/audit-logs':
        return <AuditLogsViewer />;
      case '/super-admin/backups':
      case '/backups':
        return <BackupsManagement />;
      case '/super-admin/settings':
        return <PlatformSettings />;
      case '/super-admin':
      default:
        return <SuperAdminOverview onNavigate={handleNavigate} />;
    }
  };

  return (
    <SuperAdminLayout currentPath={currentPath} onNavigate={handleNavigate}>
      {renderContent()}
    </SuperAdminLayout>
  );
};

export default SuperAdminModule;

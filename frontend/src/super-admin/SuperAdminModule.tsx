import React, { useState, useEffect } from 'react';
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
import './super-admin.css';

export const SuperAdminModule: React.FC = () => {
  // Determine initial path from hash e.g. #/super-admin/schools -> /super-admin/schools
  const getPathFromHash = () => {
    const rawHash = window.location.hash.replace(/^#/, '');
    const cleanHash = rawHash.split('?')[0].trim();

    if (cleanHash.startsWith('/super-admin/')) {
      const sub = cleanHash.replace('/super-admin/', '');
      if (sub === 'monitor' || sub === 'monitoring') return '/super-admin/monitoring';
      if (sub === 'users' || sub === 'people') return '/super-admin/people';
      if (sub === 'roles' || sub === 'permissions') return '/super-admin/permissions';
      return cleanHash;
    }
    if (cleanHash === '/super-admin') {
      return '/super-admin';
    }
    // Also support aliases like #/schools, #/payments when inside super admin
    if (cleanHash === '/schools') return '/super-admin/schools';
    if (cleanHash === '/subscriptions') return '/super-admin/subscriptions';
    if (cleanHash === '/payments') return '/super-admin/payments';
    if (cleanHash === '/invoices') return '/super-admin/invoices';
    if (cleanHash === '/monitor' || cleanHash === '/monitoring') return '/super-admin/monitoring';
    if (cleanHash === '/analytics') return '/super-admin/analytics';
    if (cleanHash === '/people' || cleanHash === '/users') return '/super-admin/people';
    if (cleanHash === '/permissions' || cleanHash === '/roles') return '/super-admin/permissions';
    if (cleanHash === '/security') return '/super-admin/security';
    if (cleanHash === '/audit-logs') return '/super-admin/audit-logs';
    if (cleanHash === '/settings') return '/super-admin/settings';

    return '/super-admin';
  };

  const [currentPath, setCurrentPath] = useState<string>(getPathFromHash);

  useEffect(() => {
    const handleHashChange = () => {
      setCurrentPath(getPathFromHash());
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const handleNavigate = (path: string) => {
    window.location.hash = path;
    setCurrentPath(path.split('?')[0]);
  };

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

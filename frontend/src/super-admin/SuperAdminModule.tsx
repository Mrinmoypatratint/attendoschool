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
    const hash = window.location.hash.replace(/^#/, '');
    if (hash.startsWith('/super-admin/')) {
      return hash;
    }
    if (hash === '/super-admin') {
      return '/super-admin';
    }
    // Also support aliases like #/schools, #/payments when inside super admin
    if (hash === '/schools') return '/super-admin/schools';
    if (hash === '/subscriptions') return '/super-admin/subscriptions';
    if (hash === '/payments') return '/super-admin/payments';
    if (hash === '/invoices') return '/super-admin/invoices';
    if (hash === '/monitor' || hash === '/monitoring') return '/super-admin/monitor';
    if (hash === '/analytics') return '/super-admin/analytics';
    if (hash === '/people' || hash === '/users') return '/super-admin/users';
    if (hash === '/permissions' || hash === '/roles') return '/super-admin/roles';
    if (hash === '/security') return '/super-admin/security';
    if (hash === '/audit-logs') return '/super-admin/audit-logs';
    if (hash === '/settings') return '/super-admin/settings';

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
    setCurrentPath(path);
  };

  // Render sub-view according to currentPath
  const renderContent = () => {
    switch (currentPath) {
      case '/super-admin/schools':
        return <SchoolsManagement />;
      case '/super-admin/subscriptions':
        return <SubscriptionsManagement onNavigateSchools={() => handleNavigate('/super-admin/schools')} />;
      case '/super-admin/payments':
        return <PaymentsLedger />;
      case '/super-admin/invoices':
        return <InvoicesManagement />;
      case '/super-admin/monitor':
      case '/super-admin/monitoring':
        return <MonitoringHealth />;
      case '/super-admin/analytics':
        return <PlatformAnalytics />;
      case '/super-admin/users':
      case '/super-admin/people':
        return <PeopleDirectory />;
      case '/super-admin/roles':
      case '/super-admin/permissions':
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

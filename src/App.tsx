import React, { useState, useEffect, useCallback } from 'react';
import { Sidebar } from './components/Sidebar.js';
import { Header } from './components/Header.js';
import { DashboardView } from './components/DashboardView.js';
import { CustomersView } from './components/CustomersView.js';
import { LicensesView } from './components/LicensesView.js';
import { SubscriptionsView } from './components/SubscriptionsView.js';
import { RequestsView } from './components/RequestsView.js';
import { ActivitiesView } from './components/ActivitiesView.js';
import { ProductPacksView } from './components/ProductPacksView.js';
import { PosSimulatorView } from './components/PosSimulatorView.js';
import { ApiDocsView } from './components/ApiDocsView.js';
import { AuditView } from './components/AuditView.js';
import { SettingsView } from './components/SettingsView.js';
import { PurchasesView } from './components/PurchasesView.js';
import { TableMenusView } from './components/TableMenusView.js';
import { PublicMenuView } from './components/PublicMenuView.js';
import { LoginView } from './components/LoginView.js';
import { ProfileModal } from './components/ProfileModal.js';

import {
  Customer,
  License,
  LicenseRequest,
  BusinessActivity,
  ProductPack,
  ProductPackVersion,
  AuditLog,
  SystemSettings,
  AdminRole,
  AdminUser,
  CustomerStatus,
  LicenseStatus,
  ProductRecord
} from './types/dzpos.js';

export function App() {
  const [activeTab, setActiveTabState] = useState<string>(() => {
    try {
      return localStorage.getItem('dzpos_active_tab') || 'dashboard';
    } catch {
      return 'dashboard';
    }
  });

  const setActiveTab = (tab: string) => {
    setActiveTabState(tab);
    try {
      localStorage.setItem('dzpos_active_tab', tab);
    } catch (e) {
      console.warn('Failed to save active tab to localStorage:', e);
    }
  };

  const [adminRole, setAdminRole] = useState<AdminRole>('MAIN_ADMIN');
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);

  // Authentication State
  const [currentUser, setCurrentUser] = useState<AdminUser | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [isAuthChecking, setIsAuthChecking] = useState<boolean>(true);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState<boolean>(false);

  // Core Data State
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [licenses, setLicenses] = useState<License[]>([]);
  const [requests, setRequests] = useState<LicenseRequest[]>([]);
  const [activities, setActivities] = useState<BusinessActivity[]>([]);
  const [packs, setPacks] = useState<ProductPack[]>([]);
  const [versions, setVersions] = useState<ProductPackVersion[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [wilayas, setWilayas] = useState<{ code: string; name: string }[]>([]);
  const [settings, setSettings] = useState<SystemSettings>({
    grace_period_days: 7,
    allow_trial_auto_approve: true,
    max_devices_trial: 1,
    max_devices_basic: 1,
    max_devices_pro: 2,
    max_devices_enterprise: 5,
    require_device_binding: true,
    offline_cache_duration_hours: 168,
    system_name: 'DZPOS Central Cloud',
    support_phone: '0550 12 34 56',
    support_email: 'support@dzpos.dz'
  });

  // Navigation passing state (e.g. create license for specific customer)
  const [preselectedCustomer, setPreselectedCustomer] = useState<Customer | null>(null);
  const [preselectedActivityCode, setPreselectedActivityCode] = useState<string>('grocery');
  const [previewMenu, setPreviewMenu] = useState<{ slug: string; tableCode?: string } | null>(null);

  // Check if current URL is a public table menu URL
  const isPublicMenuRoute = typeof window !== 'undefined' && window.location.pathname.startsWith('/menu/');

  // Check saved credentials on load
  useEffect(() => {
    try {
      const savedToken =
        localStorage.getItem('dzpos_auth_token') || sessionStorage.getItem('dzpos_auth_token');
      const savedUserStr =
        localStorage.getItem('dzpos_auth_user') || sessionStorage.getItem('dzpos_auth_user');

      if (savedToken && savedUserStr) {
        const parsedUser = JSON.parse(savedUserStr);
        setAuthToken(savedToken);
        setCurrentUser(parsedUser);
        setAdminRole(parsedUser.role || 'MAIN_ADMIN');
      }
    } catch (e) {
      console.warn('Failed to parse saved session:', e);
    } finally {
      setIsAuthChecking(false);
    }
  }, []);

  const handleLoginSuccess = (user: AdminUser, token: string) => {
    setCurrentUser(user);
    setAuthToken(token);
    setAdminRole(user.role);
  };

  const handleProfileUpdated = (updatedUser: AdminUser) => {
    setCurrentUser(updatedUser);
    setAdminRole(updatedUser.role);
    // Update local or session storage
    if (localStorage.getItem('dzpos_auth_user')) {
      localStorage.setItem('dzpos_auth_user', JSON.stringify(updatedUser));
    }
    if (sessionStorage.getItem('dzpos_auth_user')) {
      sessionStorage.setItem('dzpos_auth_user', JSON.stringify(updatedUser));
    }
  };

  const handleLogout = async () => {
    try {
      if (authToken) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`,
            'x-admin-role': adminRole
          }
        });
      }
    } catch (e) {
      console.error('Logout error:', e);
    } finally {
      localStorage.removeItem('dzpos_auth_token');
      localStorage.removeItem('dzpos_auth_user');
      sessionStorage.removeItem('dzpos_auth_token');
      sessionStorage.removeItem('dzpos_auth_user');
      setCurrentUser(null);
      setAuthToken(null);
      setActiveTab('dashboard');
    }
  };

  // Fetch all data from backend
  const loadAllData = useCallback(async () => {
    if (!currentUser && !authToken) return;

    setIsRefreshing(true);
    try {
      const headers: Record<string, string> = {
        'x-admin-role': adminRole,
        'x-admin-user': currentUser?.username || 'superadmin'
      };
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }

      const [
        custRes,
        licRes,
        reqRes,
        actRes,
        packRes,
        verRes,
        auditRes,
        wilayaRes,
        settRes
      ] = await Promise.all([
        fetch('/api/customers', { headers }).then(r => r.json()),
        fetch('/api/licenses', { headers }).then(r => r.json()),
        fetch('/api/license-requests', { headers }).then(r => r.json()),
        fetch('/api/activities', { headers }).then(r => r.json()),
        fetch('/api/product-packs', { headers }).then(r => r.json()),
        fetch('/api/product-packs/versions/all', { headers }).then(r => r.json()),
        fetch('/api/audit?limit=100', { headers }).then(r => r.json()),
        fetch('/api/customers/wilayas/all', { headers }).then(r => r.json()),
        fetch('/api/settings', { headers }).then(r => r.json())
      ]);

      if (custRes.success) setCustomers(custRes.data);
      if (licRes.success) setLicenses(licRes.data);
      if (reqRes.success) setRequests(reqRes.data);
      if (actRes.success) setActivities(actRes.data);
      if (packRes.success) setPacks(packRes.data);
      if (verRes.success) setVersions(verRes.data);
      if (auditRes.success) setAuditLogs(auditRes.data);
      if (wilayaRes.success) setWilayas(wilayaRes.data);
      if (settRes.success) setSettings(settRes.data);
    } catch (err) {
      console.error('Failed to fetch data from backend:', err);
    } finally {
      setIsRefreshing(false);
    }
  }, [adminRole, currentUser, authToken]);

  useEffect(() => {
    if (currentUser) {
      loadAllData();
    }
  }, [loadAllData, currentUser]);

  // Customer Actions
  const handleCreateCustomer = async (data: Partial<Customer>) => {
    const res = await fetch('/api/customers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-role': adminRole,
        'Authorization': `Bearer ${authToken || ''}`
      },
      body: JSON.stringify(data)
    });
    const result = await res.json();
    if (!result.success) throw new Error(result.error?.message || 'Failed to create customer');
    await loadAllData();
  };

  const handleUpdateCustomerStatus = async (customerId: string, status: CustomerStatus, reason?: string) => {
    const res = await fetch(`/api/customers/${customerId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-role': adminRole,
        'Authorization': `Bearer ${authToken || ''}`
      },
      body: JSON.stringify({ status, reason })
    });
    const result = await res.json();
    if (!result.success) throw new Error(result.error?.message || 'Failed to update status');
    await loadAllData();
  };

  // License Actions
  const handleCreateLicense = async (data: any) => {
    const res = await fetch('/api/licenses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-role': adminRole,
        'Authorization': `Bearer ${authToken || ''}`
      },
      body: JSON.stringify(data)
    });
    const result = await res.json();
    if (!result.success) throw new Error(result.error?.message || 'Failed to create license');
    await loadAllData();
  };

  const handleExtendLicense = async (licenseId: string, days: number, notes?: string) => {
    const res = await fetch(`/api/licenses/${licenseId}/extend`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-role': adminRole,
        'Authorization': `Bearer ${authToken || ''}`
      },
      body: JSON.stringify({ days_to_add: days, notes })
    });
    const result = await res.json();
    if (!result.success) throw new Error(result.error?.message || 'Failed to extend license');
    await loadAllData();
  };

  const handleUpdateLicenseStatus = async (licenseId: string, status: LicenseStatus, reason?: string) => {
    const res = await fetch(`/api/licenses/${licenseId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-role': adminRole,
        'Authorization': `Bearer ${authToken || ''}`
      },
      body: JSON.stringify({ status, reason })
    });
    const result = await res.json();
    if (!result.success) throw new Error(result.error?.message || 'Failed to update license status');
    await loadAllData();
  };

  const handleUnbindDevice = async (licenseId: string, deviceId: string) => {
    const res = await fetch(`/api/licenses/${licenseId}/devices/${deviceId}`, {
      method: 'DELETE',
      headers: {
        'x-admin-role': adminRole,
        'Authorization': `Bearer ${authToken || ''}`
      }
    });
    const result = await res.json();
    if (!result.success) throw new Error(result.error?.message || 'Failed to unbind device');
    await loadAllData();
  };

  // Request Actions
  const handleApproveRequest = async (requestId: string, options: any) => {
    const res = await fetch(`/api/license-requests/${requestId}/approve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-role': adminRole,
        'Authorization': `Bearer ${authToken || ''}`
      },
      body: JSON.stringify(options)
    });
    const result = await res.json();
    if (!result.success) throw new Error(result.error?.message || 'Failed to approve request');
    await loadAllData();
  };

  const handleRejectRequest = async (requestId: string, reason: string) => {
    const res = await fetch(`/api/license-requests/${requestId}/reject`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-role': adminRole,
        'Authorization': `Bearer ${authToken || ''}`
      },
      body: JSON.stringify({ reason })
    });
    const result = await res.json();
    if (!result.success) throw new Error(result.error?.message || 'Failed to reject request');
    await loadAllData();
  };

  // Activity Actions
  const handleCreateActivity = async (data: Partial<BusinessActivity>) => {
    const res = await fetch('/api/activities', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-role': adminRole,
        'Authorization': `Bearer ${authToken || ''}`
      },
      body: JSON.stringify(data)
    });
    const result = await res.json();
    if (!result.success) throw new Error(result.error?.message || 'Failed to create activity');
    await loadAllData();
  };

  const handleUpdateActivity = async (id: string, data: Partial<BusinessActivity>) => {
    const res = await fetch(`/api/activities/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-role': adminRole,
        'Authorization': `Bearer ${authToken || ''}`
      },
      body: JSON.stringify(data)
    });
    const result = await res.json();
    if (!result.success) throw new Error(result.error?.message || 'Failed to update activity');
    await loadAllData();
  };

  // Product Pack & Versioning Actions
  const handleValidatePackFile = async (activityCode: string, fileType: 'json' | 'csv', content: string) => {
    const res = await fetch('/api/product-packs/validate-file', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-role': adminRole,
        'Authorization': `Bearer ${authToken || ''}`
      },
      body: JSON.stringify({
        activity_code: activityCode,
        file_type: fileType,
        raw_content: content
      })
    });
    const result = await res.json();
    if (!result.success) throw new Error(result.error?.message || 'File validation failed');
    return result.data;
  };

  const handleCreatePackVersion = async (activityCode: string, products: ProductRecord[], summary: string, autoPublish: boolean) => {
    const res = await fetch('/api/product-packs/create-version', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-role': adminRole,
        'Authorization': `Bearer ${authToken || ''}`
      },
      body: JSON.stringify({
        activity_code: activityCode,
        products,
        changes_summary: summary,
        auto_publish: autoPublish
      })
    });
    const result = await res.json();
    if (!result.success) throw new Error(result.error?.message || 'Failed to create version');
    await loadAllData();
  };

  const handlePublishVersion = async (versionId: string) => {
    const res = await fetch(`/api/product-packs/versions/${versionId}/publish`, {
      method: 'POST',
      headers: {
        'x-admin-role': adminRole,
        'Authorization': `Bearer ${authToken || ''}`
      }
    });
    const result = await res.json();
    if (!result.success) throw new Error(result.error?.message || 'Failed to publish version');
    await loadAllData();
  };

  const handleRollbackPack = async (activityCode: string, targetVersion: number, reason: string) => {
    const res = await fetch(`/api/product-packs/${activityCode}/rollback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-role': adminRole,
        'Authorization': `Bearer ${authToken || ''}`
      },
      body: JSON.stringify({
        target_version: targetVersion,
        reason
      })
    });
    const result = await res.json();
    if (!result.success) throw new Error(result.error?.message || 'Rollback failed');
    await loadAllData();
  };

  const handleUploadZipBackup = async (file: File, activityCode?: string) => {
    const formData = new FormData();
    formData.append('file', file);
    if (activityCode) formData.append('activity_code', activityCode);

    const res = await fetch('/api/sync/upload-zip', {
      method: 'POST',
      headers: {
        'x-admin-role': adminRole,
        'Authorization': `Bearer ${authToken || ''}`
      },
      body: formData
    });
    const result = await res.json();
    if (!result.success) throw new Error(result.error?.message || result.message || 'فشل رفع حزمة الـ ZIP');
    await loadAllData();
    return result;
  };

  const handleDownloadPack = (activityCode: string, version?: number) => {
    const url = `/api/sync/download?activity_code=${activityCode}${version ? `&version=${version}` : ''}`;
    window.open(url, '_blank');
  };

  // Settings Actions
  const handleUpdateSettings = async (newSettings: Partial<SystemSettings>) => {
    const res = await fetch('/api/settings', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-role': adminRole,
        'Authorization': `Bearer ${authToken || ''}`
      },
      body: JSON.stringify(newSettings)
    });
    const result = await res.json();
    if (!result.success) throw new Error(result.error?.message || 'Failed to update settings');
    await loadAllData();
  };

  const pendingRequestsCount = requests.filter(r => r.status === 'pending').length;

  // Standalone public customer menu route (Zero login required)
  if (isPublicMenuRoute) {
    return <PublicMenuView />;
  }

  if (isAuthChecking) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center text-zinc-400">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-mono">التحقق من جلسة العمل المركزية...</span>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <LoginView onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen bg-[#050505] text-[#e0e0e0] flex font-sans selection:bg-amber-500 selection:text-black antialiased" dir="rtl">
      {/* Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        adminRole={adminRole}
        setAdminRole={setAdminRole}
        pendingRequestsCount={pendingRequestsCount}
        isOpen={isSidebarOpen}
        setIsOpen={setIsSidebarOpen}
        currentUser={currentUser}
        onLogout={handleLogout}
        onOpenProfile={() => setIsProfileModalOpen(true)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#090a0f]">
        {/* Top Header */}
        <Header
          activeTab={activeTab}
          adminRole={adminRole}
          isOnline={isOnline}
          setIsOnline={setIsOnline}
          onRefresh={loadAllData}
          isRefreshing={isRefreshing}
          onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          currentUser={currentUser}
          onLogout={handleLogout}
          onOpenProfile={() => setIsProfileModalOpen(true)}
        />

        {/* Dynamic Page Views */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto space-y-6">
            {activeTab === 'dashboard' && (
              <DashboardView
                customers={customers}
                licenses={licenses}
                requests={requests}
                activities={activities}
                packs={packs}
                auditLogs={auditLogs}
                onNavigate={(tab) => setActiveTab(tab)}
              />
            )}

            {activeTab === 'subscriptions' && (
              <SubscriptionsView
                licenses={licenses}
                customers={customers}
                requests={requests}
                settings={settings}
                adminRole={adminRole}
                currentUser={currentUser}
                onUpdateSettings={handleUpdateSettings}
                onCreateLicense={handleCreateLicense}
                onExtendLicense={handleExtendLicense}
                onUpdateStatus={handleUpdateLicenseStatus}
                onUnbindDevice={handleUnbindDevice}
                onApproveRequest={handleApproveRequest}
                onRefreshData={loadAllData}
              />
            )}

            {activeTab === 'customers' && (
              <CustomersView
                customers={customers}
                activities={activities}
                licenses={licenses}
                wilayas={wilayas}
                onCreateCustomer={handleCreateCustomer}
                onUpdateStatus={handleUpdateCustomerStatus}
                onSelectCustomerForLicense={(cust) => {
                  setPreselectedCustomer(cust);
                  setActiveTab('licenses');
                }}
              />
            )}

            {activeTab === 'licenses' && (
              <LicensesView
                licenses={licenses}
                customers={customers}
                onCreateLicense={handleCreateLicense}
                onExtendLicense={handleExtendLicense}
                onUpdateStatus={handleUpdateLicenseStatus}
                onUnbindDevice={handleUnbindDevice}
                preselectedCustomer={preselectedCustomer}
              />
            )}

            {activeTab === 'requests' && (
              <RequestsView
                requests={requests}
                onApproveRequest={handleApproveRequest}
                onRejectRequest={handleRejectRequest}
              />
            )}

            {activeTab === 'activities' && (
              <ActivitiesView
                activities={activities}
                onCreateActivity={handleCreateActivity}
                onUpdateActivity={handleUpdateActivity}
                onNavigateToPack={(code) => {
                  setPreselectedActivityCode(code);
                  setActiveTab('packs');
                }}
              />
            )}

            {activeTab === 'packs' && (
              <ProductPacksView
                activities={activities}
                packs={packs}
                versions={versions}
                selectedActivityCode={preselectedActivityCode}
                onValidateFile={handleValidatePackFile}
                onCreateVersion={handleCreatePackVersion}
                onPublishVersion={handlePublishVersion}
                onRollback={handleRollbackPack}
                onDownloadPack={handleDownloadPack}
                onUploadZipPack={handleUploadZipBackup}
              />
            )}

            {activeTab === 'purchases' && (
              <PurchasesView
                activities={activities}
                products={[]}
                onRefreshProducts={loadAllData}
              />
            )}

            {activeTab === 'table_menus' && (
              <TableMenusView
                licenses={licenses}
                onOpenPublicPreview={(slug, tableCode) => setPreviewMenu({ slug, tableCode })}
              />
            )}

            {activeTab === 'pos_simulator' && (
              <PosSimulatorView
                activities={activities}
                isOnline={isOnline}
                setIsOnline={setIsOnline}
                defaultLicenseKey={licenses[0]?.license_key || 'DZPOS-PRO-7A9B-4C2E-88D1'}
              />
            )}

            {activeTab === 'api_docs' && (
              <ApiDocsView adminRole={adminRole} />
            )}

            {activeTab === 'audit' && (
              <AuditView auditLogs={auditLogs} />
            )}

            {activeTab === 'settings' && (
              <SettingsView
                settings={settings}
                adminRole={adminRole}
                onUpdateSettings={handleUpdateSettings}
                currentUser={currentUser}
                onOpenProfile={() => setIsProfileModalOpen(true)}
              />
            )}
          </div>
        </main>

        {/* Footer */}
        <footer className="bg-[#0c0d12] border-t border-zinc-800/80 py-3.5 px-6 text-xs text-zinc-400">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-zinc-300 font-semibold">DZPOS Central Cloud</span>
              <span className="text-zinc-500">•</span>
              <span className="text-zinc-400">نظام المزامنة وإدارة التراخيص المركزي v2.4.0</span>
            </div>
            <div className="text-[11px] text-zinc-400 font-mono">
              Offline-First POS Architecture • 58 Wilayas
            </div>
          </div>
        </footer>
      </div>

      {/* Profile Edit Modal */}
      {currentUser && (
        <ProfileModal
          isOpen={isProfileModalOpen}
          onClose={() => setIsProfileModalOpen(false)}
          currentUser={currentUser}
          authToken={authToken}
          onProfileUpdated={handleProfileUpdated}
        />
      )}

      {/* Public Menu Live Preview Modal */}
      {previewMenu && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-2 sm:p-4">
          <div className="bg-zinc-950 border border-zinc-800 w-full max-w-2xl h-[92vh] rounded-3xl overflow-hidden shadow-2xl flex flex-col">
            <div className="bg-zinc-900 border-b border-zinc-800 p-3 px-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
                <span className="text-xs font-bold text-white">معاينة مباشرة لهاتف الزبون</span>
                {previewMenu.tableCode && (
                  <span className="text-[11px] font-mono bg-rose-950 text-rose-300 border border-rose-800 px-2 py-0.5 rounded-full">
                    Table: {previewMenu.tableCode}
                  </span>
                )}
              </div>
              <button
                onClick={() => setPreviewMenu(null)}
                className="text-xs px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-lg transition"
              >
                إغلاق
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <PublicMenuView
                slug={previewMenu.slug}
                tableCode={previewMenu.tableCode}
                isPreview={true}
                onClosePreview={() => setPreviewMenu(null)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
export default App;

import React, { useState } from 'react';
import {
  ShieldAlert,
  Search,
  Filter,
  Clock,
  User,
  Activity,
  Layers,
  KeyRound,
  Download
} from 'lucide-react';
import { AuditLog } from '../types/dzpos.js';

interface AuditViewProps {
  auditLogs: AuditLog[];
}

export const AuditView: React.FC<AuditViewProps> = ({ auditLogs }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [entityFilter, setEntityFilter] = useState('all');
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const filtered = auditLogs.filter(l => {
    const matchSearch =
      l.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.actor.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.entity_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (l.details && JSON.stringify(l.details).toLowerCase().includes(searchTerm.toLowerCase()));

    const matchEntity = entityFilter === 'all' || l.entity === entityFilter;

    return matchSearch && matchEntity;
  });

  const exportCsv = () => {
    const headers = ['ID,Timestamp,Actor,Role,Action,Entity,Entity_ID,IP\n'];
    const rows = filtered.map(l =>
      `"${l.id}","${l.timestamp}","${l.actor}","${l.actor_role}","${l.action}","${l.entity}","${l.entity_id}","${l.ip_address || ''}"`
    );
    const blob = new Blob([headers.concat(rows).join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dzpos_audit_logs_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-[#0c0c0e] p-4 rounded-xl border border-zinc-800 shadow-sm">
        <div>
          <h1 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-emerald-400" />
            <span>سجل العمليات الأمني والمراقبة (Security Audit Trail)</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            تتبع كامل وغير قابل للتعديل لجميع أنشطة المدراء، توليد وتمديد التراخيص، نشر النسخ، وربط أجهزة الكاسة.
          </p>
        </div>

        <button
          onClick={exportCsv}
          className="px-3.5 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 rounded-lg text-xs font-semibold shadow-sm transition flex items-center gap-1.5 cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
          <span>تصدير السجل (CSV)</span>
        </button>
      </div>

      {/* Filters Bar */}
      <div className="bg-[#0c0c0e] p-4 rounded-xl border border-zinc-800 shadow-sm grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="relative">
          <Search className="w-4 h-4 text-zinc-500 absolute right-3 top-3" />
          <input
            type="text"
            placeholder="بحث في الإجراءات، المستخدمين، أو المعرفات..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pr-9 pl-3 py-2 text-xs rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>

        <div>
          <select
            value={entityFilter}
            onChange={(e) => setEntityFilter(e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          >
            <option value="all">جميع الكيانات (All Entities)</option>
            <option value="CUSTOMER">الزبائن (CUSTOMER)</option>
            <option value="LICENSE">التراخيص (LICENSE)</option>
            <option value="LICENSE_REQUEST">طلبات التراخيص (LICENSE_REQUEST)</option>
            <option value="DEVICE">أجهزة الكاسة (DEVICE)</option>
            <option value="PRODUCT_PACK">ملفات المنتجات (PRODUCT_PACK)</option>
            <option value="ACTIVITY">الأنشطة التجارية (ACTIVITY)</option>
          </select>
        </div>
      </div>

      {/* Audit Table */}
      <div className="bg-[#0c0c0e] rounded-xl border border-zinc-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-zinc-900/80 border-b border-zinc-800 text-zinc-400 font-semibold uppercase">
              <tr>
                <th className="px-4 py-3">الوقت والتاريخ</th>
                <th className="px-4 py-3">المستخدم / الفاعل</th>
                <th className="px-4 py-3">الإجراء (Action)</th>
                <th className="px-4 py-3">الكيان والمعرف</th>
                <th className="px-4 py-3">التفاصيل</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 font-mono text-[11px]">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-zinc-500 font-sans">
                    لا توجد سجلات تطابق البحث
                  </td>
                </tr>
              ) : (
                filtered.map((log) => (
                  <tr key={log.id} className="hover:bg-zinc-900/40 transition">
                    <td className="px-4 py-3 text-zinc-400 whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-bold text-zinc-200">{log.actor}</span>
                      <span className="text-[10px] text-zinc-500 block font-sans">({log.actor_role})</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded bg-zinc-900 text-zinc-200 font-bold border border-zinc-700">
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-300">
                      <div className="font-bold font-sans text-xs text-zinc-200">{log.entity}</div>
                      <div className="text-zinc-500 text-[10px] truncate max-w-[150px]">{log.entity_id}</div>
                    </td>
                    <td className="px-4 py-3 max-w-[280px]">
                      {log.details ? (
                        <button
                          onClick={() => setSelectedLog(log)}
                          className="text-emerald-400 hover:text-emerald-300 truncate block text-left underline font-mono text-[10px] cursor-pointer"
                        >
                          {JSON.stringify(log.details)}
                        </button>
                      ) : (
                        <span className="text-zinc-600">-</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Details Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-xs">
          <div className="bg-[#0c0c0e] rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-zinc-800 space-y-4 text-zinc-100">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h2 className="text-base font-bold text-zinc-100">تفاصيل العملية الأمنية</h2>
              <button
                onClick={() => setSelectedLog(null)}
                className="text-zinc-400 hover:text-zinc-200 text-lg font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between">
                <span className="text-zinc-400">الإجراء:</span>
                <span className="font-bold font-mono text-zinc-200">{selectedLog.action}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">الفاعل:</span>
                <span className="font-bold text-zinc-200">{selectedLog.actor} ({selectedLog.actor_role})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">الكيان المعني:</span>
                <span className="font-bold text-zinc-200">{selectedLog.entity} - {selectedLog.entity_id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">عنوان IP:</span>
                <span className="font-mono text-zinc-300">{selectedLog.ip_address || '127.0.0.1'}</span>
              </div>

              <div>
                <span className="font-bold text-zinc-300 block mb-1">حمولة البيانات (JSON Payload):</span>
                <pre className="p-3 bg-[#050505] text-emerald-400 rounded-lg border border-zinc-800 font-mono text-xs overflow-x-auto">
                  {JSON.stringify(selectedLog.details, null, 2)}
                </pre>
              </div>
            </div>

            <div className="pt-3 border-t border-zinc-800 flex justify-end">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

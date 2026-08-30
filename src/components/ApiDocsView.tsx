import React, { useState, useEffect } from 'react';
import {
  FileCode2,
  Play,
  Copy,
  Check,
  Tag,
  ShieldAlert,
  Terminal,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Layers,
  KeyRound,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { AdminRole } from '../types/dzpos.js';

interface ApiDocsViewProps {
  adminRole: AdminRole;
}

export const ApiDocsView: React.FC<ApiDocsViewProps> = ({ adminRole }) => {
  const [docData, setDocData] = useState<any | null>(null);
  const [selectedTag, setSelectedTag] = useState<string>('all');
  const [activeEndpoint, setActiveEndpoint] = useState<number | null>(0);
  const [requestBodies, setRequestBodies] = useState<Record<number, string>>({});
  const [callResults, setCallResults] = useState<Record<number, any>>({});
  const [isLoadingCall, setIsLoadingCall] = useState<number | null>(null);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  useEffect(() => {
    fetch('/api/docs')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.data) {
          setDocData(data.data);
          // Initialize request body buffers
          const initialBodies: Record<number, string> = {};
          data.data.endpoints.forEach((ep: any, index: number) => {
            if (ep.body) {
              initialBodies[index] = JSON.stringify(ep.body, null, 2);
            }
          });
          setRequestBodies(initialBodies);
        }
      })
      .catch(err => console.error('Failed to load API docs:', err));
  }, []);

  const handleExecute = async (ep: any, index: number) => {
    setIsLoadingCall(index);
    const startTime = performance.now();
    try {
      let url = ep.path;
      // If endpoint has default query parameters, add them for test
      if (url.includes(':id')) {
        url = url.replace(':id', 'req_mock_test');
      }
      if (url.includes(':activityCode')) {
        url = url.replace(':activityCode', 'grocery');
      }
      if (ep.queryParams && ep.queryParams.length > 0 && !url.includes('?')) {
        const qStr = ep.queryParams.map((q: any) => `${q.name}=${q.example}`).join('&');
        url = `${url}?${qStr}`;
      }

      const method = ep.method.includes('POST') ? 'POST' : ep.method.includes('PUT') ? 'PUT' : 'GET';
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'x-admin-role': adminRole
      };

      const options: RequestInit = {
        method,
        headers
      };

      if (method !== 'GET' && requestBodies[index]) {
        options.body = requestBodies[index];
      }

      const res = await fetch(url, options);
      const elapsed = Math.round(performance.now() - startTime);
      const resJson = await res.json().catch(() => ({ raw: 'Non-JSON response' }));

      setCallResults(prev => ({
        ...prev,
        [index]: {
          status: res.status,
          statusText: res.statusText,
          timeMs: elapsed,
          data: resJson
        }
      }));
    } catch (err: any) {
      setCallResults(prev => ({
        ...prev,
        [index]: {
          status: 500,
          statusText: 'Network / Client Error',
          data: { error: err.message }
        }
      }));
    } finally {
      setIsLoadingCall(null);
    }
  };

  const getMethodBadge = (method: string) => {
    if (method.includes('GET')) {
      return <span className="bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded text-[11px]">GET</span>;
    }
    if (method.includes('POST')) {
      return <span className="bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded text-[11px]">POST</span>;
    }
    if (method.includes('PUT')) {
      return <span className="bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded text-[11px]">PUT</span>;
    }
    return <span className="bg-rose-100 text-rose-800 font-bold px-2 py-0.5 rounded text-[11px]">{method}</span>;
  };

  if (!docData) {
    return (
      <div className="bg-[#0c0c0e] rounded-xl border border-zinc-800 p-12 text-center text-zinc-500">
        جاري تحميل وثائق الـ API ومواصفات OpenAPI 3.0...
      </div>
    );
  }

  const filteredEndpoints = docData.endpoints.filter((ep: any) => {
    if (selectedTag === 'all') return true;
    return ep.tag === selectedTag;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-[#0c0c0e] border border-zinc-800 rounded-xl p-5 shadow-sm space-y-2">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <FileCode2 className="w-5 h-5 text-emerald-400" />
              <h1 className="text-lg font-bold text-zinc-100">{docData.info.title}</h1>
              <span className="bg-zinc-800 text-zinc-300 text-xs font-mono font-bold px-2 py-0.5 rounded border border-zinc-700">
                OpenAPI {docData.openapi}
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-1">{docData.info.description}</p>
          </div>

          <div className="text-xs font-medium text-zinc-400 bg-zinc-900 p-2.5 rounded-lg border border-zinc-700">
            <span>الصلاحية الحالية المستخدمة للتجربة: </span>
            <strong className="text-emerald-400 font-mono">{adminRole}</strong>
          </div>
        </div>

        {/* Tag Filters */}
        <div className="flex flex-wrap gap-1.5 pt-3 border-t border-zinc-800">
          <button
            onClick={() => setSelectedTag('all')}
            className={`px-2.5 py-1 rounded-md text-xs font-semibold transition cursor-pointer ${
              selectedTag === 'all'
                ? 'bg-zinc-800 text-white border border-zinc-700'
                : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800 border border-zinc-800'
            }`}
          >
            جميع المسارات ({docData.endpoints.length})
          </button>
          {docData.tags.map((t: any) => (
            <button
              key={t.name}
              onClick={() => setSelectedTag(t.name)}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition cursor-pointer ${
                selectedTag === t.name
                  ? 'bg-emerald-600 text-white'
                  : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800 border border-zinc-800'
              }`}
            >
              {t.name}
            </button>
          ))}
        </div>
      </div>

      {/* Endpoints Interactive List */}
      <div className="space-y-4">
        {filteredEndpoints.map((ep: any, index: number) => {
          const isOpen = activeEndpoint === index;
          const result = callResults[index];

          return (
            <div
              key={index}
              className={`bg-[#0c0c0e] rounded-xl border shadow-sm transition overflow-hidden ${
                isOpen ? 'border-zinc-700 ring-1 ring-zinc-700' : 'border-zinc-800 hover:border-zinc-700'
              }`}
            >
              {/* Endpoint Header */}
              <div
                onClick={() => setActiveEndpoint(isOpen ? null : index)}
                className="p-4 flex items-center justify-between gap-3 cursor-pointer bg-zinc-900/40 hover:bg-zinc-900/80 transition"
              >
                <div className="flex items-center gap-3 flex-wrap">
                  {getMethodBadge(ep.method)}
                  <span className="font-mono font-bold text-xs sm:text-sm text-zinc-100">{ep.path}</span>
                  <span className="text-xs text-zinc-400 font-medium hidden md:inline">— {ep.summary}</span>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-[11px] font-medium bg-zinc-900 text-zinc-300 px-2 py-0.5 rounded border border-zinc-700">
                    {ep.auth}
                  </span>
                  {isOpen ? <ChevronUp className="w-4 h-4 text-zinc-400" /> : <ChevronDown className="w-4 h-4 text-zinc-400" />}
                </div>
              </div>

              {/* Endpoint Expanded Body */}
              {isOpen && (
                <div className="p-5 border-t border-zinc-800 space-y-4 bg-[#0c0c0e] text-xs text-zinc-200">
                  <p className="text-zinc-400">{ep.description}</p>

                  {/* Query Params if any */}
                  {ep.queryParams && ep.queryParams.length > 0 && (
                    <div>
                      <span className="font-bold text-zinc-300 block mb-1">معاملات الاستعلام (Query Parameters):</span>
                      <div className="bg-zinc-900/80 p-2.5 rounded-lg border border-zinc-800 space-y-1">
                        {ep.queryParams.map((q: any) => (
                          <div key={q.name} className="flex justify-between font-mono text-[11px]">
                            <span><strong className="text-zinc-200">{q.name}</strong> ({q.required ? 'مطلوب' : 'اختياري'})</span>
                            <span className="text-zinc-400">مثال: {q.example}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Request Body & Sandbox Execution */}
                  {ep.body && (
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-bold text-zinc-300">جسم الطلب (JSON Request Body):</span>
                        <span className="text-[11px] text-zinc-500">يمكنك تعديل القيم وتجربة الطلب مباشرة</span>
                      </div>
                      <textarea
                        rows={5}
                        value={requestBodies[index] || ''}
                        onChange={(e) => setRequestBodies({ ...requestBodies, [index]: e.target.value })}
                        className="w-full p-2.5 font-mono text-xs rounded-lg border border-zinc-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-zinc-950 text-zinc-100"
                      />
                    </div>
                  )}

                  {/* Action Bar: Execute Test Call */}
                  <div className="flex items-center justify-between pt-2 border-t border-zinc-800">
                    <div className="text-[11px] text-zinc-500 font-mono">
                      Target: http://0.0.0.0:3000{ep.path}
                    </div>

                    <button
                      onClick={() => handleExecute(ep, index)}
                      disabled={isLoadingCall === index}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg shadow-sm transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>{isLoadingCall === index ? 'جاري التنفيذ...' : 'تنفيذ الطلب على السيرفر (Execute Call)'}</span>
                    </button>
                  </div>

                  {/* Real Live Response Viewer */}
                  {result && (
                    <div className="mt-4 p-4 rounded-xl border border-zinc-800 bg-[#050505] text-zinc-100 space-y-2">
                      <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                        <div className="flex items-center gap-2">
                          <span className={`font-mono font-bold px-2 py-0.5 rounded text-xs ${
                            result.status >= 200 && result.status < 300
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                              : 'bg-rose-950 text-rose-400 border border-rose-800'
                          }`}>
                            HTTP {result.status} {result.statusText}
                          </span>
                          {result.timeMs && (
                            <span className="text-[11px] text-zinc-400">({result.timeMs} ms)</span>
                          )}
                        </div>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(JSON.stringify(result.data, null, 2));
                            setCopiedIdx(index);
                            setTimeout(() => setCopiedIdx(null), 2000);
                          }}
                          className="text-zinc-400 hover:text-zinc-200 text-xs flex items-center gap-1 cursor-pointer"
                        >
                          {copiedIdx === index ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          <span>نسخ النتيجة</span>
                        </button>
                      </div>

                      <pre className="font-mono text-[11px] text-emerald-400 max-h-60 overflow-y-auto whitespace-pre-wrap">
                        {JSON.stringify(result.data, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

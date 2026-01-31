import React, { useState, useEffect } from 'react';
import { logsAPI } from '../services/api';
import wsService from '../services/websocket';
import { FileText, Search, Filter, RefreshCw, AlertCircle, Info, AlertTriangle, Bug, Download } from 'lucide-react';

const SystemLogs = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [levelFilter, setLevelFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    fetchLogs();

    let interval = null;
    if (autoRefresh) {
      interval = setInterval(() => {
        fetchLogs();
      }, 10000);
    }

    // Listen for real-time log updates
    const handleLogUpdate = (data) => {
      setLogs((prev) => [data, ...prev].slice(0, 1000));
    };

    wsService.on('logs', handleLogUpdate);

    return () => {
      if (interval) clearInterval(interval);
      wsService.off('logs', handleLogUpdate);
    };
  }, [autoRefresh]); // Only re-run when autoRefresh changes

  const fetchLogs = async () => {
    try {
      console.log('🔍 Fetching logs from API...');
      setLoading(true);
      // Fetch only 100 latest logs to prevent memory issues
      const response = await logsAPI.getAll({ limit: 100 });
      console.log('✅ API Response:', {
        success: response.data.success,
        count: response.data.count,
        dataLength: response.data.data?.length
      });
      
      if (response.data.data && Array.isArray(response.data.data)) {
        setLogs(response.data.data);
        console.log(`✅ Set ${response.data.data.length} logs`);
      } else {
        console.warn('⚠️ No data array in response');
        setLogs([]);
      }
    } catch (error) {
      console.error('❌ Error fetching logs:', error.response?.data || error.message);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    if (filteredLogs.length === 0) return;

    const headers = ['Timestamp', 'Level', 'Category', 'Message', 'Source ID', 'Details'];
    const csvRows = [
      headers.join(','),
      ...filteredLogs.map(log => {
        const row = [
          `"${log.timestamp ? new Date(log.timestamp).toLocaleString() : ''}"`,
          `"${log.level || 'info'}"`,
          `"${log.category || ''}"`,
          `"${(log.message || '').replace(/"/g, '""')}"`,
          `"${log.source_id || 'N/A'}"`,
          `"${typeof log.details === 'object' ? JSON.stringify(log.details).replace(/"/g, '""') : (log.details || '')}"`
        ];
        return row.join(',');
      })
    ];

    const csvContent = csvRows.join('\n');
    const dataUri = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csvContent);
    const exportFileDefaultName = `system-logs-${new Date().toISOString().split('T')[0]}.csv`;

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      log.message?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.category?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.source_id?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesLevel = levelFilter === 'all' || (log.level || 'info') === levelFilter;
    const matchesCategory = categoryFilter === 'all' || log.category === categoryFilter;
    return matchesSearch && matchesLevel && matchesCategory;
  });

  const getLevelBadge = (level) => {
    const badges = {
      error: { class: 'badge-danger', icon: AlertCircle },
      warn: { class: 'badge-warning', icon: AlertTriangle },
      info: { class: 'badge-info', icon: Info },
      debug: { class: 'badge-success', icon: Bug },
    };
    const badge = badges[level] || { class: 'badge-info', icon: Info };
    const Icon = badge.icon;
    return (
      <span className={`badge ${badge.class} flex items-center gap-1`}>
        <Icon className="h-3 w-3" />
        {level}
      </span>
    );
  };

  const getCategoryColor = (category) => {
    const colors = {
      mqtt: 'text-purple-400',
      device: 'text-green-400',
      gateway: 'text-blue-400',
      api: 'text-cyan-400',
      db: 'text-emerald-400',
      ota: 'text-orange-400',
      ws: 'text-yellow-400',
    };
    return colors[category] || 'text-slate-400';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500 mx-auto"></div>
          <p className="mt-4 text-slate-400">Loading logs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">System Logs</h1>
          <p className="text-slate-400 mt-1">Monitor system events and errors</p>
        </div>
        <div className="flex gap-3">
          <button onClick={exportToCSV} className="btn-secondary flex items-center gap-2" disabled={filteredLogs.length === 0}>
            <Download className="h-4 w-4" />
            Export CSV
          </button>
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`btn-secondary flex items-center gap-2 ${
              autoRefresh ? 'ring-2 ring-green-500' : ''
            }`}
          >
            <RefreshCw className={`h-4 w-4 ${autoRefresh ? 'animate-spin' : ''}`} />
            Auto Refresh {autoRefresh ? 'ON' : 'OFF'}
          </button>
          <button onClick={fetchLogs} className="btn-secondary flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
              <input
                type="text"
                placeholder="Search logs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input-field pl-10"
              />
            </div>
          </div>
          <div>
            <select
              value={levelFilter}
              onChange={(e) => setLevelFilter(e.target.value)}
              className="input-field"
            >
              <option value="all">All Levels</option>
              <option value="error">Error</option>
              <option value="warn">Warning</option>
              <option value="info">Info</option>
              <option value="debug">Debug</option>
            </select>
          </div>
          <div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="input-field"
            >
              <option value="all">All Categories</option>
              <option value="mqtt">MQTT</option>
              <option value="device">Device</option>
              <option value="gateway">Gateway</option>
              <option value="api">API</option>
              <option value="db">Database</option>
              <option value="ota">OTA</option>
              <option value="ws">WebSocket</option>
            </select>
          </div>
        </div>
      </div>

      {/* Logs List */}
      <div className="card">
        <div className="space-y-3 max-h-[600px] overflow-y-auto">
          {filteredLogs.length > 0 ? (
            filteredLogs.map((log, index) => (
              <div
                key={log._id || index}
                className="bg-slate-900 p-4 rounded-lg border-l-4"
                style={{
                  borderColor:
                    (log.level || 'info') === 'error'
                      ? '#ef4444'
                      : (log.level || 'info') === 'warn'
                      ? '#f59e0b'
                      : (log.level || 'info') === 'info'
                      ? '#3b82f6'
                      : '#10b981',
                }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      {getLevelBadge(log.level || 'info')}
                      <span className={`text-sm font-medium ${getCategoryColor(log.category)}`}>
                        [{log.source_id || log.category?.toUpperCase()}]
                      </span>
                      <span className="text-slate-500 text-xs">
                        {new Date(log.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-white break-words">{log.message}</p>
                    {log.details && (
                      <details className="mt-2">
                        <summary className="text-sm text-slate-400 cursor-pointer hover:text-slate-300">
                          View details
                        </summary>
                        <pre className="mt-2 text-xs text-slate-300 bg-slate-950 p-3 rounded overflow-x-auto">
                          {typeof log.details === 'string' ? log.details : JSON.stringify(log.details, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400">No logs found</p>
              <p className="text-slate-500 text-sm mt-1">
                Try adjusting your filters or wait for new logs
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SystemLogs;

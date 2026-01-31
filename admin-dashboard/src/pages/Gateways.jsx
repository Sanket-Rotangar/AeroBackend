import React, { useState, useEffect } from 'react';
import { gatewaysAPI } from '../services/api';
import wsService from '../services/websocket';
import { Radio, Plus, Search, Eye, RefreshCw, Wifi, Download } from 'lucide-react';

const Gateways = () => {
  const [gateways, setGateways] = useState([]);
  const [selectedGateway, setSelectedGateway] = useState(null);
  const [nodes, setNodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showNodesModal, setShowNodesModal] = useState(false);

  useEffect(() => {
    fetchGateways();

    const handleGatewayUpdate = () => {
      fetchGateways();
      if (selectedGateway) {
        fetchNodes(selectedGateway.gateway_id);
      }
    };

    wsService.on('gateways', handleGatewayUpdate);
    return () => wsService.off('gateways', handleGatewayUpdate);
  }, [selectedGateway]);

  const fetchGateways = async () => {
    try {
      // Fetch all gateways without limit
      const response = await gatewaysAPI.getAll({ limit: 0 });
      setGateways(response.data.data || []);
    } catch (error) {
      console.error('Error fetching gateways:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchNodes = async (gatewayId) => {
    try {
      // Fetch all nodes without limit
      const response = await gatewaysAPI.getNodes(gatewayId, { limit: 0 });
      setNodes(response.data.data || []);
    } catch (error) {
      console.error('Error fetching nodes:', error);
    }
  };

  const handleViewNodes = async (gateway) => {
    setSelectedGateway(gateway);
    await fetchNodes(gateway.gateway_id);
    setShowNodesModal(true);
  };

  const exportToCSV = () => {
    if (filteredGateways.length === 0) return;

    const headers = ['Gateway ID', 'Gateway Name', 'Status', 'Node Count', 'Last Seen'];
    const csvRows = [
      headers.join(','),
      ...filteredGateways.map(gateway => {
        const row = [
          `"${gateway.gateway_id || ''}"`,
          `"${gateway.gateway_name || ''}"`,
          `"${gateway.status || 'unknown'}"`,
          `"${gateway.node_count || 0}"`,
          `"${gateway.last_seen ? new Date(gateway.last_seen).toLocaleString() : 'N/A'}"`
        ];
        return row.join(',');
      })
    ];

    const csvContent = csvRows.join('\n');
    const dataUri = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csvContent);
    const exportFileDefaultName = `gateways-${new Date().toISOString().split('T')[0]}.csv`;

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const filteredGateways = gateways.filter(
    (gw) =>
      gw.gateway_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      gw.gateway_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (status) => {
    const badges = { online: 'badge-success', offline: 'badge-danger', unknown: 'badge-warning' };
    return badges[status] || 'badge-info';
  };

  const getRSSIColor = (rssi) => {
    if (rssi > -50) return 'text-green-500';
    if (rssi > -70) return 'text-yellow-500';
    return 'text-red-500';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500 mx-auto"></div>
          <p className="mt-4 text-slate-400">Loading gateways...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Gateways & Nodes</h1>
          <p className="text-slate-400 mt-1">Monitor BLE/LoRa gateway and node devices</p>
        </div>
        <div className="flex gap-3">
          <button onClick={exportToCSV} className="btn-secondary flex items-center gap-2" disabled={filteredGateways.length === 0}>
            <Download className="h-4 w-4" />
            Export CSV
          </button>
          <button onClick={fetchGateways} className="btn-secondary flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="card">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search gateways..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-field pl-10"
          />
        </div>
      </div>

      {/* Gateways Table */}
      <div className="card">
        <div className="table-container">
          <table className="table">
            <thead className="table-header">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase">
                  Gateway ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase">
                  Node Count
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase">
                  Last Seen
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-300 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {filteredGateways.map((gateway) => (
                <tr key={gateway.gateway_id} className="table-row">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <Radio className="h-5 w-5 text-purple-500" />
                      <span className="text-white font-medium">{gateway.gateway_id}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-slate-300">
                    {gateway.gateway_name || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`badge ${getStatusBadge(gateway.status)}`}>
                      {gateway.status || 'unknown'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-white font-medium">{gateway.node_count || 0}</span>
                    <span className="text-slate-400 text-sm ml-1">nodes</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-slate-300">
                    {gateway.last_seen ? new Date(gateway.last_seen).toLocaleString() : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <button
                      onClick={() => handleViewNodes(gateway)}
                      className="btn-primary flex items-center gap-2 ml-auto"
                    >
                      <Eye className="h-4 w-4" />
                      View Nodes
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredGateways.length === 0 && (
            <div className="text-center py-12">
              <Radio className="h-12 w-12 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400">No gateways found</p>
            </div>
          )}
        </div>
      </div>

      {/* Nodes Modal */}
      {showNodesModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-lg max-w-4xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold text-white mb-4">
              Nodes for {selectedGateway?.gateway_id}
            </h2>

            {nodes.length > 0 ? (
              <div className="table-container">
                <table className="table">
                  <thead className="table-header">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase">
                        MAC Address
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase">
                        Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase">
                        Type
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase">
                        RSSI
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase">
                        Last Seen
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700">
                    {nodes.map((node) => (
                      <tr key={node.mac_address} className="table-row">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <Wifi className="h-5 w-5 text-blue-500" />
                            <span className="text-white font-mono text-sm">{node.mac_address}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-slate-300">
                          {node.node_name || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-slate-300">
                          {node.node_type || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`font-medium ${getRSSIColor(node.rssi)}`}>
                            {node.rssi ? `${node.rssi} dBm` : '-'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-slate-300">
                          {node.last_seen ? new Date(node.last_seen).toLocaleString() : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12">
                <Wifi className="h-12 w-12 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-400">No nodes found for this gateway</p>
              </div>
            )}

            <div className="flex gap-3 pt-6">
              <button onClick={() => setShowNodesModal(false)} className="btn-secondary flex-1">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Gateways;

import React, { useState, useEffect } from 'react';
import wsService from '../services/websocket';
import { sensorDataAPI, gatewaysAPI, devicesAPI } from '../services/api';
import { Activity, Download, Filter, Calendar, RefreshCw, Radio } from 'lucide-react';

const RealTimeData = () => {
  const [sensorData, setSensorData] = useState([]);
  const [gateways, setGateways] = useState([]);
  const [devices, setDevices] = useState([]);
  const [nodes, setNodes] = useState([]);
  const [sourceType, setSourceType] = useState('all'); // 'all', 'device', 'gateway'
  const [selectedGateway, setSelectedGateway] = useState('all');
  const [selectedDevice, setSelectedDevice] = useState('all');
  const [selectedNode, setSelectedNode] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      // Fetch recent 1000 sensor readings
      const response = await sensorDataAPI.getRecent({ limit: 1000 });
      const data = response.data.data || [];
      const formattedData = data.map((item) => ({
        ...item,
        fullTimestamp: item.timestamp,
        timestamp: new Date(item.timestamp).toLocaleString(),
        formattedTime: new Date(item.timestamp).toLocaleTimeString(),
      }));
      setSensorData(formattedData);
    } catch (error) {
      console.error('Error fetching initial sensor data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchGateways = async () => {
    try {
      const response = await gatewaysAPI.getAll();
      setGateways(response.data.data || []);
    } catch (error) {
      console.error('Error fetching gateways:', error);
    }
  };

  const fetchDevices = async () => {
    try {
      const response = await devicesAPI.getAll();
      setDevices(response.data.data || []);
    } catch (error) {
      console.error('Error fetching devices:', error);
    }
  };

  const fetchNodes = async (gatewayId) => {
    if (!gatewayId || gatewayId === 'all') {
      setNodes([]);
      return;
    }
    try {
      const response = await gatewaysAPI.getNodes(gatewayId);
      setNodes(response.data.data || []);
    } catch (error) {
      console.error('Error fetching nodes:', error);
      setNodes([]);
    }
  };

  useEffect(() => {
    // Fetch initial data
    fetchInitialData();
    fetchGateways();
    fetchDevices();

    // Listen for real-time sensor data
    const handleSensorData = (data) => {
      const newData = {
        ...data,
        fullTimestamp: data.timestamp,
        timestamp: new Date(data.timestamp).toLocaleString(),
        formattedTime: new Date(data.timestamp).toLocaleTimeString(),
      };

      // Add to recent data list (keep last 100)
      setSensorData((prev) => [newData, ...prev].slice(0, 100));
    };

    wsService.on('sensor_data', handleSensorData);

    return () => {
      wsService.off('sensor_data', handleSensorData);
    };
  }, []);

  useEffect(() => {
    fetchNodes(selectedGateway);
    setSelectedNode('all'); // Reset node when gateway changes
  }, [selectedGateway]);

  const filteredData = sensorData.filter((d) => {
    // Filter by source type
    const matchesSourceType = (() => {
      if (sourceType === 'all') return true;
      if (sourceType === 'device') return d.source_type === 'device' && !d.gateway_id;
      if (sourceType === 'gateway') return d.source_type === 'node' || d.gateway_id;
      return true;
    })();
    
    // Filter by direct device
    const matchesDevice = selectedDevice === 'all' || 
      (d.source_type === 'device' && d.source_id === selectedDevice);
    
    // Filter by gateway
    const matchesGateway = selectedGateway === 'all' || d.gateway_id === selectedGateway;
    
    // Filter by node (MAC address)
    const matchesNode = selectedNode === 'all' || d.source_id === selectedNode;
    
    // Filter by date range
    const matchesDate = (() => {
      if (!startDate && !endDate) return true;
      const itemDate = new Date(d.fullTimestamp);
      const start = startDate ? new Date(startDate) : null;
      const end = endDate ? new Date(endDate + 'T23:59:59') : null;
      
      if (start && end) return itemDate >= start && itemDate <= end;
      if (start) return itemDate >= start;
      if (end) return itemDate <= end;
      return true;
    })();
    
    return matchesSourceType && matchesDevice && matchesGateway && matchesNode && matchesDate;
  });

  const exportToJSON = () => {
    const dataStr = JSON.stringify(filteredData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    const exportFileDefaultName = `sensor-data-${new Date().toISOString().split('T')[0]}.json`;

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const exportToCSV = () => {
    if (filteredData.length === 0) return;

    // Define CSV headers
    const headers = [
      'Timestamp',
      'Source ID',
      'Source Type',
      'Gateway ID',
      'Data'
    ];

    // Convert data to CSV rows
    const csvRows = [
      headers.join(','), // Header row
      ...filteredData.map(item => {
        const row = [
          `"${item.fullTimestamp || item.timestamp}"`,
          `"${item.source_id || ''}"`,
          `"${item.source_type || ''}"`,
          `"${item.gateway_id || 'N/A'}"`,
          `"${typeof item.data === 'object' ? JSON.stringify(item.data).replace(/"/g, '""') : item.data}"`
        ];
        return row.join(',');
      })
    ];

    const csvContent = csvRows.join('\n');
    const dataUri = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csvContent);
    const exportFileDefaultName = `sensor-data-${new Date().toISOString().split('T')[0]}.csv`;

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const clearFilters = () => {
    setSourceType('all');
    setSelectedDevice('all');
    setSelectedGateway('all');
    setSelectedNode('all');
    setStartDate('');
    setEndDate('');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Real-Time Data Visualization</h1>
          <p className="text-slate-400 mt-1">Monitor live sensor data from your devices</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={exportToCSV}
            className="btn-secondary flex items-center gap-2"
            disabled={filteredData.length === 0}
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
          <button
            onClick={exportToJSON}
            className="btn-primary flex items-center gap-2"
            disabled={filteredData.length === 0}
          >
            <Download className="h-4 w-4" />
            Export JSON
          </button>
        </div>
      </div>

      {/* Advanced Filters */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-primary-500" />
            <h3 className="text-lg font-semibold text-white">Advanced Filters</h3>
          </div>
          <div className="flex gap-2">
            <button
              onClick={clearFilters}
              className="text-sm text-slate-400 hover:text-slate-300 px-3 py-1 rounded-lg hover:bg-slate-700"
            >
              Clear Filters
            </button>
            <button
              onClick={fetchInitialData}
              className="text-sm flex items-center gap-1 text-primary-500 hover:text-primary-400 px-3 py-1 rounded-lg hover:bg-slate-700"
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Source Type Filter */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Source Type</label>
            <select
              value={sourceType}
              onChange={(e) => {
                setSourceType(e.target.value);
                setSelectedGateway('all');
                setSelectedDevice('all');
                setSelectedNode('all');
              }}
              className="input"
            >
              <option value="all">All Sources</option>
              <option value="device">Direct Devices</option>
              <option value="gateway">Gateway Nodes</option>
            </select>
          </div>

          {/* Direct Device Filter */}
          {(sourceType === 'all' || sourceType === 'device') && (
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Direct Device</label>
              <select
                value={selectedDevice}
                onChange={(e) => setSelectedDevice(e.target.value)}
                className="input"
                disabled={sourceType === 'gateway'}
              >
                <option value="all">All Devices</option>
                {devices.map((dev) => (
                  <option key={dev.device_id} value={dev.device_id}>
                    {dev.device_id}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Gateway Filter */}
          {(sourceType === 'all' || sourceType === 'gateway') && (
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Gateway</label>
              <select
                value={selectedGateway}
                onChange={(e) => setSelectedGateway(e.target.value)}
                className="input"
                disabled={sourceType === 'device'}
              >
                <option value="all">All Gateways</option>
                {gateways.map((gw) => (
                  <option key={gw.gateway_id} value={gw.gateway_id}>
                    {gw.gateway_id}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Node Filter */}
          {(sourceType === 'all' || sourceType === 'gateway') && (
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Gateway Node</label>
              <select
                value={selectedNode}
                onChange={(e) => setSelectedNode(e.target.value)}
                className="input"
                disabled={selectedGateway === 'all' || sourceType === 'device'}
              >
                <option value="all">All Nodes</option>
                {nodes.map((node) => (
                  <option key={node.mac_address} value={node.mac_address}>
                    {node.node_name || node.mac_address}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Start Date */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2 flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="input"
            />
          </div>

          {/* End Date */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2 flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              End Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="input"
            />
          </div>
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-slate-400" />
            <span className="text-slate-400">
              Showing <span className="text-white font-semibold">{filteredData.length}</span> of{' '}
              <span className="text-white font-semibold">{sensorData.length}</span> records
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-green-500 font-medium">Live Updates Active</span>
          </div>
        </div>
      </div>

      {/* Live JSON Data Feed */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Radio className="h-5 w-5 text-primary-500 animate-pulse" />
            <h2 className="text-xl font-semibold text-white">Live JSON Data Feed</h2>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-sm text-slate-400">Real-time</span>
          </div>
        </div>

        <div className="space-y-3 max-h-[700px] overflow-y-auto">
          {filteredData.length > 0 ? (
            filteredData.map((data, index) => (
              <div
                key={index}
                className="bg-slate-900 p-4 rounded-lg border border-slate-700 hover:border-primary-500/50 transition-all"
              >
                {/* Header with source info */}
                <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-700">
                  <div className="flex items-center gap-3">
                    <div className="bg-primary-600/20 p-2 rounded-lg">
                      <Activity className="h-4 w-4 text-primary-500" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {data.gateway_id && (
                          <span className="text-xs bg-blue-600/20 text-blue-400 px-2 py-1 rounded">
                            Gateway: {data.gateway_id}
                          </span>
                        )}
                        {data.source_type === 'node' && (
                          <span className="text-xs bg-purple-600/20 text-purple-400 px-2 py-1 rounded">
                            Node: {data.source_id}
                          </span>
                        )}
                        {data.source_type === 'device' && (
                          <span className="text-xs bg-green-600/20 text-green-400 px-2 py-1 rounded">
                            Device: {data.source_id}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-400">{data.timestamp}</p>
                  </div>
                </div>

                {/* JSON Data */}
                <div className="relative">
                  <pre className="text-xs text-slate-300 bg-slate-950 p-3 rounded-lg overflow-x-auto font-mono">
                    {JSON.stringify(data, null, 2)}
                  </pre>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-16">
              <Activity className="h-16 w-16 text-slate-600 mx-auto mb-4 animate-pulse" />
              <p className="text-slate-400 text-lg font-medium">No live data available</p>
              <p className="text-slate-500 text-sm mt-2">
                Data will appear here in JSON format as devices send updates
              </p>
              {(selectedGateway !== 'all' || selectedNode !== 'all' || startDate || endDate) && (
                <button
                  onClick={clearFilters}
                  className="mt-4 text-primary-500 hover:text-primary-400 text-sm"
                >
                  Clear filters to see all data
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RealTimeData;

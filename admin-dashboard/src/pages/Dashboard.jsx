import React, { useState, useEffect } from 'react';
import { devicesAPI, gatewaysAPI, statusAPI, sensorDataAPI } from '../services/api';
import wsService from '../services/websocket';
import { Cpu, Radio, Activity, AlertCircle, Clock } from 'lucide-react';

const Dashboard = () => {
  const [stats, setStats] = useState({
    totalDevices: 0,
    onlineDevices: 0,
    totalGateways: 0,
    onlineGateways: 0,
    totalNodes: 0,
    recentData: [],
  });
  const [loading, setLoading] = useState(true);
  const [systemStatus, setSystemStatus] = useState(null);

  useEffect(() => {
    // Initial fetch
    fetchDashboardData();
    fetchSystemStatus();
    fetchRecentSensorData();

    // Refresh sensor data every 30 seconds
    const sensorDataInterval = setInterval(() => {
      fetchRecentSensorData();
    }, 30000);

    // Listen for real-time updates
    const handleDeviceUpdate = () => {
      fetchDashboardData();
    };

    const handleSensorData = (data) => {
      setStats((prev) => {
        const newData = [data, ...prev.recentData].slice(0, 10);
        return {
          ...prev,
          recentData: newData,
        };
      });
    };

    wsService.on('devices', handleDeviceUpdate);
    wsService.on('gateways', handleDeviceUpdate);
    wsService.on('sensor_data', handleSensorData);

    return () => {
      clearInterval(sensorDataInterval);
      wsService.off('devices', handleDeviceUpdate);
      wsService.off('gateways', handleDeviceUpdate);
      wsService.off('sensor_data', handleSensorData);
    };
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [devicesRes, gatewaysRes] = await Promise.all([
        devicesAPI.getAll({ limit: 0 }), // Fetch all devices
        gatewaysAPI.getAll({ limit: 0 }), // Fetch all gateways
      ]);

      const devices = devicesRes.data.data || [];
      const gateways = gatewaysRes.data.data || [];

      const onlineDevices = devices.filter((d) => d.status === 'active' || d.status === 'online').length;
      const onlineGateways = gateways.filter((g) => g.status === 'active' || g.status === 'online').length;

      // Count total nodes from all gateways
      const totalNodes = gateways.reduce((sum, gateway) => sum + (gateway.node_count || 0), 0);

      setStats((prev) => ({
        ...prev,
        totalDevices: devices.length,
        onlineDevices,
        totalGateways: gateways.length,
        onlineGateways,
        totalNodes,
      }));
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSystemStatus = async () => {
    try {
      const response = await statusAPI.getStatus();
      setSystemStatus(response.data.data);
    } catch (error) {
      console.error('Error fetching system status:', error);
    }
  };

  const fetchRecentSensorData = async () => {
    try {
      const response = await sensorDataAPI.getRecent({ limit: 10 });
      const data = response.data.data || [];
      setStats((prev) => ({
        ...prev,
        recentData: data,
      }));
    } catch (error) {
      console.error('Error fetching recent sensor data:', error);
      setStats((prev) => ({
        ...prev,
        recentData: [],
      }));
    }
  };

  const StatCard = ({ title, value, subtitle, icon: Icon, color }) => (
    <div className="card">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-slate-400 text-sm font-medium">{title}</p>
          <p className={`text-3xl font-bold mt-2 ${color}`}>{value}</p>
          {subtitle && <p className="text-slate-500 text-sm mt-1">{subtitle}</p>}
        </div>
        <div className={`p-4 rounded-xl ${color.replace('text-', 'bg-')}/10`}>
          <Icon className={`h-8 w-8 ${color}`} />
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500 mx-auto"></div>
          <p className="mt-4 text-slate-400">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Dashboard Overview</h1>
        <p className="text-slate-400 mt-1">Monitor your IoT infrastructure in real-time</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <StatCard
          title="Total Devices"
          value={stats.totalDevices}
          subtitle={`${stats.onlineDevices} online`}
          icon={Cpu}
          color="text-blue-500"
        />
        <StatCard
          title="Total Gateways"
          value={stats.totalGateways}
          subtitle={`${stats.onlineGateways} active`}
          icon={Radio}
          color="text-purple-500"
        />
        <StatCard
          title="Connected Nodes"
          value={stats.totalNodes}
          subtitle="BLE/LoRa sensors"
          icon={Activity}
          color="text-green-500"
        />
      </div>

      {/* System Status */}
      {systemStatus && (
        <div className="card">
          <h2 className="text-xl font-semibold text-white mb-4">System Status</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-900 p-4 rounded-lg">
              <p className="text-slate-400 text-sm">MQTT Connection</p>
              <p className="text-white font-semibold mt-1">
                {systemStatus.mqtt?.connected ? (
                  <span className="text-green-500">✓ Connected</span>
                ) : (
                  <span className="text-yellow-500">⚠ Disconnected</span>
                )}
              </p>
            </div>
            <div className="bg-slate-900 p-4 rounded-lg">
              <p className="text-slate-400 text-sm">Database</p>
              <p className="text-white font-semibold mt-1">
                <span className="text-green-500">✓ Connected</span>
              </p>
            </div>
            <div className="bg-slate-900 p-4 rounded-lg">
              <p className="text-slate-400 text-sm">WebSocket</p>
              <p className="text-white font-semibold mt-1">
                {wsService.isConnected() ? (
                  <span className="text-green-500">✓ Connected</span>
                ) : (
                  <span className="text-yellow-500">⚠ Reconnecting</span>
                )}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Recent Sensor Data - JSON Format */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-white">Recent Sensor Data (Live JSON)</h2>
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary-500 animate-pulse" />
            <span className="text-xs text-slate-400">Last 10 records</span>
          </div>
        </div>

        {stats.recentData.length > 0 ? (
          <div className="space-y-3 max-h-[600px] overflow-y-auto">
            {stats.recentData.map((data, index) => (
              <div key={index} className="bg-slate-900 p-4 rounded-lg border border-slate-700 hover:border-primary-500/50 transition-all">
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
                    <div className="flex items-center gap-1 text-slate-400 text-xs">
                      <Clock className="h-3 w-3" />
                      <span>{new Date(data.timestamp).toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {/* JSON Data */}
                <div className="relative">
                  <pre className="text-xs text-slate-300 bg-slate-950 p-3 rounded-lg overflow-x-auto font-mono">
                    {JSON.stringify(data, null, 2)}
                  </pre>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <AlertCircle className="h-12 w-12 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400">No recent sensor data</p>
            <p className="text-slate-500 text-sm mt-1">Data will appear here in JSON format as devices send updates</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;

import React, { useState, useEffect } from 'react';
import { devicesAPI } from '../services/api';
import wsService from '../services/websocket';
import { Cpu, Plus, Search, Edit2, Trash2, Eye, RefreshCw, Download } from 'lucide-react';

const Devices = () => {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('view'); // 'view', 'create', 'edit'
  const [formData, setFormData] = useState({
    device_id: '',
    device_name: '',
    device_type: '',
    location: '',
    firmware_version: '',
  });

  useEffect(() => {
    fetchDevices();

    // Listen for real-time device updates
    const handleDeviceUpdate = () => {
      fetchDevices();
    };

    wsService.on('devices', handleDeviceUpdate);

    return () => {
      wsService.off('devices', handleDeviceUpdate);
    };
  }, []);

  const fetchDevices = async () => {
    try {
      // Fetch all devices without limit
      const response = await devicesAPI.getAll({ limit: 0 });
      setDevices(response.data.data || []);
    } catch (error) {
      console.error('Error fetching devices:', error);
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    if (filteredDevices.length === 0) return;

    const headers = ['Device ID', 'Device Name', 'Type', 'Location', 'Status', 'Firmware Version', 'Last Seen'];
    const csvRows = [
      headers.join(','),
      ...filteredDevices.map(device => {
        const row = [
          `"${device.device_id || ''}"`,
          `"${device.device_name || ''}"`,
          `"${device.device_type || ''}"`,
          `"${device.location || 'N/A'}"`,
          `"${device.status || 'unknown'}"`,
          `"${device.firmware_version || 'N/A'}"`,
          `"${device.last_seen ? new Date(device.last_seen).toLocaleString() : 'Never'}"`
        ];
        return row.join(',');
      })
    ];

    const csvContent = csvRows.join('\n');
    const dataUri = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csvContent);
    const exportFileDefaultName = `devices-${new Date().toISOString().split('T')[0]}.csv`;

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const handleCreate = () => {
    setModalMode('create');
    setFormData({
      device_id: '',
      device_name: '',
      device_type: '',
      location: '',
      firmware_version: '',
    });
    setShowModal(true);
  };

  const handleEdit = (device) => {
    setModalMode('edit');
    setSelectedDevice(device);
    setFormData({
      device_id: device.device_id,
      device_name: device.device_name || '',
      device_type: device.device_type || '',
      location: device.location || '',
      firmware_version: device.firmware_version || '',
    });
    setShowModal(true);
  };

  const handleView = (device) => {
    setModalMode('view');
    setSelectedDevice(device);
    setShowModal(true);
  };

  const handleDelete = async (device) => {
    if (window.confirm(`Are you sure you want to delete device "${device.device_id}"?`)) {
      try {
        await devicesAPI.delete(device.device_id);
        fetchDevices();
      } catch (error) {
        alert('Error deleting device: ' + (error.response?.data?.error || error.message));
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (modalMode === 'create') {
        await devicesAPI.create(formData);
      } else if (modalMode === 'edit') {
        await devicesAPI.update(selectedDevice.device_id, formData);
      }
      setShowModal(false);
      fetchDevices();
    } catch (error) {
      alert('Error saving device: ' + (error.response?.data?.error || error.message));
    }
  };

  const filteredDevices = devices.filter(
    (device) =>
      device.device_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      device.device_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      device.device_type?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (status) => {
    const badges = {
      online: 'badge-success',
      offline: 'badge-danger',
      unknown: 'badge-warning',
    };
    return badges[status] || 'badge-info';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500 mx-auto"></div>
          <p className="mt-4 text-slate-400">Loading devices...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Devices</h1>
          <p className="text-slate-400 mt-1">Manage your IoT devices</p>
        </div>
        <div className="flex gap-3">
          <button onClick={exportToCSV} className="btn-secondary flex items-center gap-2" disabled={filteredDevices.length === 0}>
            <Download className="h-4 w-4" />
            Export CSV
          </button>
          <button onClick={fetchDevices} className="btn-secondary flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
          <button onClick={handleCreate} className="btn-primary flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Add Device
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="card">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search devices..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-field pl-10"
          />
        </div>
      </div>

      {/* Devices Table */}
      <div className="card">
        <div className="table-container">
          <table className="table">
            <thead className="table-header">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                  Device ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                  Firmware
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                  Last Seen
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-300 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {filteredDevices.map((device) => (
                <tr key={device.device_id} className="table-row">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <Cpu className="h-5 w-5 text-primary-500" />
                      <span className="text-white font-medium">{device.device_id}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-slate-300">
                    {device.device_name || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-slate-300">
                    {device.device_type || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`badge ${getStatusBadge(device.status)}`}>
                      {device.status || 'unknown'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-slate-300">
                    {device.firmware_version || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-slate-300">
                    {device.last_seen ? new Date(device.last_seen).toLocaleString() : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleView(device)}
                        className="text-blue-400 hover:text-blue-300"
                        title="View"
                      >
                        <Eye className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => handleEdit(device)}
                        className="text-yellow-400 hover:text-yellow-300"
                        title="Edit"
                      >
                        <Edit2 className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => handleDelete(device)}
                        className="text-red-400 hover:text-red-300"
                        title="Delete"
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredDevices.length === 0 && (
            <div className="text-center py-12">
              <Cpu className="h-12 w-12 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400">No devices found</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-lg max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold text-white mb-4">
              {modalMode === 'view'
                ? 'Device Details'
                : modalMode === 'create'
                ? 'Add New Device'
                : 'Edit Device'}
            </h2>

            {modalMode === 'view' ? (
              <div className="space-y-4">
                <div>
                  <label className="text-slate-400 text-sm">Device ID</label>
                  <p className="text-white font-medium">{selectedDevice?.device_id}</p>
                </div>
                <div>
                  <label className="text-slate-400 text-sm">Name</label>
                  <p className="text-white font-medium">{selectedDevice?.device_name || '-'}</p>
                </div>
                <div>
                  <label className="text-slate-400 text-sm">Type</label>
                  <p className="text-white font-medium">{selectedDevice?.device_type || '-'}</p>
                </div>
                <div>
                  <label className="text-slate-400 text-sm">Status</label>
                  <p>
                    <span className={`badge ${getStatusBadge(selectedDevice?.status)}`}>
                      {selectedDevice?.status || 'unknown'}
                    </span>
                  </p>
                </div>
                <div>
                  <label className="text-slate-400 text-sm">Location</label>
                  <p className="text-white font-medium">{selectedDevice?.location || '-'}</p>
                </div>
                <div>
                  <label className="text-slate-400 text-sm">Firmware Version</label>
                  <p className="text-white font-medium">{selectedDevice?.firmware_version || '-'}</p>
                </div>
                <div>
                  <label className="text-slate-400 text-sm">Last Seen</label>
                  <p className="text-white font-medium">
                    {selectedDevice?.last_seen
                      ? new Date(selectedDevice.last_seen).toLocaleString()
                      : '-'}
                  </p>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-slate-300 mb-2">Device ID *</label>
                  <input
                    type="text"
                    required
                    disabled={modalMode === 'edit'}
                    value={formData.device_id}
                    onChange={(e) => setFormData({ ...formData, device_id: e.target.value })}
                    className="input-field"
                    placeholder="e.g., Device001"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-2">Device Name</label>
                  <input
                    type="text"
                    value={formData.device_name}
                    onChange={(e) => setFormData({ ...formData, device_name: e.target.value })}
                    className="input-field"
                    placeholder="e.g., Temperature Sensor #1"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-2">Device Type</label>
                  <input
                    type="text"
                    value={formData.device_type}
                    onChange={(e) => setFormData({ ...formData, device_type: e.target.value })}
                    className="input-field"
                    placeholder="e.g., ESP32, Arduino"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-2">Location</label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="input-field"
                    placeholder="e.g., Building A, Floor 2"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-2">Firmware Version</label>
                  <input
                    type="text"
                    value={formData.firmware_version}
                    onChange={(e) =>
                      setFormData({ ...formData, firmware_version: e.target.value })
                    }
                    className="input-field"
                    placeholder="e.g., 1.0.0"
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <button type="submit" className="btn-primary flex-1">
                    {modalMode === 'create' ? 'Create Device' : 'Save Changes'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="btn-secondary flex-1"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {modalMode === 'view' && (
              <div className="flex gap-3 pt-4">
                <button onClick={() => setShowModal(false)} className="btn-secondary flex-1">
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Devices;

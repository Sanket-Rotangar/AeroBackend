import React, { useState, useEffect } from 'react';
import { otaAPI, devicesAPI } from '../services/api';
import wsService from '../services/websocket';
import { Upload, Send, History, FileCode, AlertCircle, CheckCircle, Clock } from 'lucide-react';

const OTAManagement = () => {
  const [devices, setDevices] = useState([]);
  const [firmware, setFirmware] = useState([]);
  const [history, setHistory] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState('');
  const [selectedFirmware, setSelectedFirmware] = useState('');
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    fetchData();

    const handleOTAUpdate = () => {
      fetchData();
    };

    wsService.on('ota', handleOTAUpdate);
    return () => wsService.off('ota', handleOTAUpdate);
  }, []);

  const fetchData = async () => {
    try {
      const [devicesRes, firmwareRes, historyRes] = await Promise.all([
        devicesAPI.getAll({ limit: 0 }), // Fetch all devices
        otaAPI.getFirmware({ limit: 50 }),
        otaAPI.getHistory({ limit: 50 }),
      ]);
      setDevices(devicesRes.data.data || []);
      setFirmware(firmwareRes.data.data || []);
      setHistory(historyRes.data.data || []);
    } catch (error) {
      console.error('Error fetching OTA data:', error);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('version', prompt('Enter firmware version:') || '1.0.0');
    formData.append('description', prompt('Enter description (optional):') || '');

    setUploading(true);
    try {
      await otaAPI.uploadFirmware(formData);
      alert('Firmware uploaded successfully!');
      fetchData();
    } catch (error) {
      alert('Upload failed: ' + (error.response?.data?.error || error.message));
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleTriggerUpdate = async () => {
    if (!selectedDevice || !selectedFirmware) {
      alert('Please select both device and firmware');
      return;
    }

    setSending(true);
    try {
      await otaAPI.triggerUpdate({
        device_id: selectedDevice,
        firmware_id: selectedFirmware,
      });
      alert('OTA update triggered successfully!');
      fetchData();
    } catch (error) {
      alert('Failed to trigger update: ' + (error.response?.data?.error || error.message));
    } finally {
      setSending(false);
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      pending: { class: 'badge-warning', icon: Clock },
      in_progress: { class: 'badge-info', icon: Upload },
      success: { class: 'badge-success', icon: CheckCircle },
      failed: { class: 'badge-danger', icon: AlertCircle },
    };
    const badge = badges[status] || { class: 'badge-info', icon: Clock };
    const Icon = badge.icon;
    return (
      <span className={`badge ${badge.class} flex items-center gap-1`}>
        <Icon className="h-3 w-3" />
        {status}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">OTA Management</h1>
        <p className="text-slate-400 mt-1">Upload firmware and trigger over-the-air updates</p>
      </div>

      {/* Upload Section */}
      <div className="card">
        <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
          <Upload className="h-5 w-5 text-primary-500" />
          Upload Firmware
        </h2>
        <div className="flex items-center gap-4">
          <label className="btn-primary cursor-pointer flex items-center gap-2">
            <Upload className="h-4 w-4" />
            {uploading ? 'Uploading...' : 'Choose File'}
            <input
              type="file"
              onChange={handleFileUpload}
              disabled={uploading}
              className="hidden"
              accept=".bin,.hex,.elf"
            />
          </label>
          <p className="text-slate-400 text-sm">
            Supported formats: .bin, .hex, .elf
          </p>
        </div>
      </div>

      {/* Available Firmware */}
      <div className="card">
        <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
          <FileCode className="h-5 w-5 text-green-500" />
          Available Firmware
        </h2>
        <div className="table-container">
          <table className="table">
            <thead className="table-header">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase">
                  Version
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase">
                  Filename
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase">
                  Description
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase">
                  Uploaded
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {firmware.map((fw) => (
                <tr key={fw.id} className="table-row">
                  <td className="px-6 py-4 whitespace-nowrap text-white font-medium">
                    {fw.version}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-slate-300 font-mono text-sm">
                    {fw.filename}
                  </td>
                  <td className="px-6 py-4 text-slate-300">{fw.description || '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-slate-300">
                    {new Date(fw.uploaded_at).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {firmware.length === 0 && (
            <div className="text-center py-12">
              <FileCode className="h-12 w-12 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400">No firmware available</p>
            </div>
          )}
        </div>
      </div>

      {/* Trigger Update */}
      <div className="card">
        <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
          <Send className="h-5 w-5 text-blue-500" />
          Trigger OTA Update
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-slate-300 mb-2">Select Device</label>
            <select
              value={selectedDevice}
              onChange={(e) => setSelectedDevice(e.target.value)}
              className="input-field"
            >
              <option value="">-- Choose Device --</option>
              {devices.map((device) => (
                <option key={device.device_id} value={device.device_id}>
                  {device.device_id} ({device.firmware_version || 'unknown'})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-slate-300 mb-2">Select Firmware</label>
            <select
              value={selectedFirmware}
              onChange={(e) => setSelectedFirmware(e.target.value)}
              className="input-field"
            >
              <option value="">-- Choose Firmware --</option>
              {firmware.map((fw) => (
                <option key={fw.id} value={fw.id}>
                  {fw.version} - {fw.filename}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={handleTriggerUpdate}
              disabled={sending || !selectedDevice || !selectedFirmware}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              <Send className="h-4 w-4" />
              {sending ? 'Sending...' : 'Trigger Update'}
            </button>
          </div>
        </div>
      </div>

      {/* Update History */}
      <div className="card">
        <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
          <History className="h-5 w-5 text-yellow-500" />
          Update History
        </h2>
        <div className="table-container">
          <table className="table">
            <thead className="table-header">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase">
                  Device ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase">
                  Firmware Version
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase">
                  Started At
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase">
                  Completed At
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {history.map((record) => (
                <tr key={record.id} className="table-row">
                  <td className="px-6 py-4 whitespace-nowrap text-white font-medium">
                    {record.device_id}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-slate-300">
                    {record.firmware_version}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">{getStatusBadge(record.status)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-slate-300">
                    {new Date(record.started_at).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-slate-300">
                    {record.completed_at ? new Date(record.completed_at).toLocaleString() : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {history.length === 0 && (
            <div className="text-center py-12">
              <History className="h-12 w-12 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400">No update history</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OTAManagement;

import React, { useState } from 'react';
import { Clock, Download, FileCode, AlertTriangle, Trash2, Check, LucideIcon } from 'lucide-react';

interface Conversion {
  id: number;
  date: string;
  from: string;
  to: string;
  rules: number;
  objects: number;
  warnings: number;
}

const RecentConversions: React.FC = () => {
  const [conversions, setConversions] = useState<Conversion[]>([
    { id: 1, date: 'Feb 2, 02:07 AM', from: 'Cisco ASA', to: 'Fortinet', rules: 161, objects: 213, warnings: 281 },
    { id: 2, date: 'Feb 1, 10:00 AM', from: 'Cisco ASA', to: 'Fortinet', rules: 161, objects: 213, warnings: 281 },
    { id: 3, date: 'Feb 1, 09:12 AM', from: 'Cisco ASA', to: 'Palo Alto', rules: 181, objects: 222, warnings: 281 },
    { id: 4, date: 'Jan 31, 14:30 PM', from: 'Checkpoint', to: 'Palo Alto', rules: 504, objects: 890, warnings: 12 },
    { id: 5, date: 'Jan 30, 11:15 AM', from: 'Juniper SRX', to: 'Fortinet', rules: 42, objects: 110, warnings: 0 },
  ]);

  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  // Toggle selection for a single item
  const toggleSelection = (id: number) => {
    setSelectedIds(prev =>
      prev.includes(id)
        ? prev.filter(selectedId => selectedId !== id)
        : [...prev, id]
    );
  };

  // Toggle select all
  const toggleSelectAll = () => {
    if (selectedIds.length === conversions.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(conversions.map(c => c.id));
    }
  };

  // Delete single item
  const handleDelete = (id: number) => {
    if (confirm('Are you sure you want to delete this conversion?')) {
      setConversions(prev => prev.filter(item => item.id !== id));
      setSelectedIds(prev => prev.filter(selectedId => selectedId !== id));
    }
  };

  // Delete selected items
  const handleBulkDelete = () => {
    if (selectedIds.length === 0) return;

    if (confirm(`Are you sure you want to delete ${selectedIds.length} conversion(s)?`)) {
      setConversions(prev => prev.filter(item => !selectedIds.includes(item.id)));
      setSelectedIds([]);
    }
  };

  // Download handler
  const handleDownload = (item: Conversion) => {
    // Create mock download (in real app, this would download actual file)
    const configContent = `! Configuration: ${item.from} to ${item.to}\n! Generated: ${item.date}\n! Rules: ${item.rules}\n! Objects: ${item.objects}\n! Warnings: ${item.warnings}\n\n! This is a sample configuration file\n`;

    const blob = new Blob([configContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `config_${item.from}_to_${item.to}_${Date.now()}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const allSelected = conversions.length > 0 && selectedIds.length === conversions.length;
  const someSelected = selectedIds.length > 0 && selectedIds.length < conversions.length;

  return (
    <div className="bg-white rounded-3xl border border-brand-100 shadow-card overflow-hidden flex flex-col">
      <div className="px-6 py-5 border-b border-brand-100 flex justify-between items-center bg-white">
        <h3 className="font-bold text-gray-900 text-lg">Recent Conversions</h3>

        {/* Bulk Actions */}
        {selectedIds.length > 0 && (
          <button
            onClick={handleBulkDelete}
            className="flex items-center gap-2 px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 hover:text-rose-800 font-bold text-xs uppercase tracking-wider rounded-lg transition-colors border border-rose-200"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete {selectedIds.length} Selected
          </button>
        )}

        {selectedIds.length === 0 && (
          <button className="text-xs font-bold text-brand-600 hover:text-brand-700 uppercase tracking-wider">View All</button>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-brand-100">
              <th className="px-6 py-4 w-12">
                <button
                  onClick={toggleSelectAll}
                  className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${allSelected
                    ? 'bg-brand-500 border-brand-500'
                    : someSelected
                      ? 'bg-brand-300 border-brand-300'
                      : 'border-gray-300 hover:border-brand-400'
                    }`}
                >
                  {(allSelected || someSelected) && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                </button>
              </th>
              <th className="px-6 py-4">Timestamp</th>
              <th className="px-6 py-4">Conversion</th>
              <th className="px-6 py-4 text-center">Rules</th>
              <th className="px-6 py-4 text-center">Objects</th>
              <th className="px-6 py-4 text-center">Warnings</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {conversions.map((item) => {
              const isSelected = selectedIds.includes(item.id);

              return (
                <tr
                  key={item.id}
                  className={`group hover:bg-gray-50/50 transition-colors border-b border-brand-50 last:border-0 ${isSelected ? 'bg-brand-50/30' : ''
                    }`}
                >
                  <td className="px-6 py-4">
                    <button
                      onClick={() => toggleSelection(item.id)}
                      className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${isSelected
                        ? 'bg-brand-500 border-brand-500'
                        : 'border-gray-300 group-hover:border-brand-400'
                        }`}
                    >
                      {isSelected && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                    </button>
                  </td>
                  <td className="px-6 py-4 font-mono text-xs text-gray-500">
                    <div className="flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-gray-300" />
                      {item.date}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 font-bold text-gray-700">
                      <span className="text-gray-900">{item.from}</span>
                      <span className="text-gray-300">â†’</span>
                      <span className="text-brand-600">{item.to}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center text-gray-600 font-mono text-xs">{item.rules}</td>
                  <td className="px-6 py-4 text-center text-gray-600 font-mono text-xs">{item.objects}</td>
                  <td className="px-6 py-4 text-center">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${item.warnings > 0
                      ? 'bg-amber-50 text-amber-700 border-amber-100'
                      : 'bg-brand-50 text-brand-700 border-brand-100'
                      }`}>
                      {item.warnings > 0 && <AlertTriangle className="w-3 h-3 mr-1" />}
                      {item.warnings}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-50 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleDownload(item)}
                        className="p-1.5 hover:bg-gray-100 rounded text-gray-400 hover:text-brand-600 transition-colors"
                        title="Download Config"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="p-1.5 hover:bg-gray-100 rounded text-gray-400 hover:text-rose-600 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default RecentConversions;

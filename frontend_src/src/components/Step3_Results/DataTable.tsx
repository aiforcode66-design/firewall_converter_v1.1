import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Info, Grid, LucideIcon } from 'lucide-react';
import clsx from 'clsx';

// Data types
interface BaseDataItem {
  name?: string;
  [key: string]: any;
}

interface NetworkObjectItem extends BaseDataItem {
  name: string;
  type: string;
  value1: string; // Updated from value to value1
  value2?: string;
  is_unused?: boolean;
}

interface ServiceObjectItem extends BaseDataItem {
  name: string;
  protocol: string;
  port: string;
  is_unused?: boolean;
}

interface RuleItem extends BaseDataItem {
  id: string | number;
  description?: string; // Backend sends description, mostly used as name
  source_zones: string[];
  destination_zones: string[];
  source_addresses: string[]; // Updated from source
  destination_addresses: string[]; // Updated from destination
  services: string[]; // Updated from service
  application?: string[];
  security_profiles?: string[]; // Updated from profiles
  action: string;
}

interface NATItem extends BaseDataItem {
  id: string | number;
  // name: string; // Backend might not send name
  original_source: string[];
  translated_source: string[];
  original_destination: string[];
  translated_destination: string[];
  // disabled?: boolean; // Backend currently not sending this explicitly, default enabled
}

interface RouteItem extends BaseDataItem {
  destination: string;
  gateway: string; // Updated from next_hop
  interface: string;
  original_text?: string;
}

type DataTableItem = NetworkObjectItem | ServiceObjectItem | RuleItem | NATItem | RouteItem | BaseDataItem;

type DataType = 'network_objects' | 'service_objects' | 'rules' | 'nat' | 'routes';

interface DataTableProps {
  data?: DataTableItem[];
  type?: DataType;
  onDiffClick?: (item: DataTableItem) => void;
}

interface FormatListCellProps {
  items?: string[] | string;
  icon?: LucideIcon;
}

const FormatListCell: React.FC<FormatListCellProps> = ({ items, icon: Icon }) => {
  const [expanded, setExpanded] = useState(false);

  if (!items) return <span className="text-brand-900/40 italic text-xs">Any</span>;

  const list = Array.isArray(items) ? items : String(items).split(/[,;]\s*/).filter(p => p.trim());
  if (list.length === 0) return <span className="text-brand-900/40 italic text-xs">Any</span>;

  const renderItem = (item: string, i: number) => (
    <div key={i} className="truncate text-brand-900/80 font-mono text-[11px] flex items-center gap-1.5" title={item}>
      {Icon && <Icon className="w-3 h-3 text-brand-400" />}
      <span>{item}</span>
    </div>
  );

  if (list.length <= 5) {
    return (
      <div className="flex flex-col gap-1 py-1">
        {list.map((item, i) => renderItem(item, i))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 py-1">
      {list.slice(0, expanded ? list.length : 5).map((item, i) => renderItem(item, i))}
      <button
        onClick={() => setExpanded(!expanded)}
        className="text-[10px] uppercase font-bold text-brand-600 hover:text-brand-700 text-left mt-1 focus:outline-none flex items-center transition-colors"
      >
        {expanded ? 'Show less' : `+ ${list.length - 5} more`}
      </button>
    </div>
  );
};

const DataTable: React.FC<DataTableProps> = ({ data = [], type, onDiffClick }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 50;

  // Reset page when type changes
  useEffect(() => {
    setCurrentPage(1);
  }, [type]);

  const totalPages = Math.ceil(data?.length / rowsPerPage) || 0;
  const startIndex = (currentPage - 1) * rowsPerPage;
  const currentData = data?.slice(startIndex, startIndex + rowsPerPage) || [];

  const handlePageChange = (delta: number) => {
    setCurrentPage(prev => Math.min(Math.max(prev + delta, 1), totalPages));
  };

  if (!data || data.length === 0) {
    return (
      <div className="p-16 text-center text-brand-900/40 flex flex-col items-center justify-center h-full">
        <Info className="w-12 h-12 mb-4 opacity-20" />
        <p className="font-medium">No results to display</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-transparent animate-fade-in relative z-0">
      <div className="flex-grow overflow-auto relative custom-scrollbar">
        <table className="w-full text-left border-collapse">
          <thead className="bg-brand-50/90 sticky top-0 z-10 text-xs font-bold uppercase tracking-wider text-brand-900/60 border-b border-brand-100 backdrop-blur-sm shadow-sm">
            {type === 'network_objects' && (
              <tr>
                <th className="px-5 py-4 w-1/4">Name</th>
                <th className="px-5 py-4 w-1/4">Type</th>
                <th className="px-5 py-4">Value / Members</th>
              </tr>
            )}
            {type === 'service_objects' && (
              <tr>
                <th className="px-5 py-4 w-1/4">Name</th>
                <th className="px-5 py-4 w-1/4">Protocol</th>
                <th className="px-5 py-4">Port / Range</th>
              </tr>
            )}
            {type === 'rules' && (
              <tr>
                <th className="px-4 py-4 w-16 text-center">ID</th>
                <th className="px-4 py-4 w-48">Description</th>
                <th className="px-4 py-4 w-24">Src Zone</th>
                <th className="px-4 py-4 w-24">Dst Zone</th>
                <th className="px-4 py-4">Source</th>
                <th className="px-4 py-4">Destination</th>
                <th className="px-4 py-4 w-32">Service</th>
                <th className="px-4 py-4 w-32">App</th>
                <th className="px-4 py-4 w-32">Profiles</th>
                <th className="px-4 py-4 w-28 text-center">Action</th>
              </tr>
            )}
            {type === 'nat' && (
              <tr>
                <th className="px-4 py-4">ID</th>
                <th className="px-4 py-4">Orig Src</th>
                <th className="px-4 py-4">Trans Src</th>
                <th className="px-4 py-4">Orig Dst</th>
                <th className="px-4 py-4">Trans Dst</th>
                <th className="px-4 py-4 text-center">Status</th>
              </tr>
            )}
            {type === 'routes' && (
              <tr>
                <th className="px-5 py-4">Network / Destination</th>
                <th className="px-5 py-4">Gateway</th>
                <th className="px-5 py-4">Interface</th>
                <th className="px-5 py-4">Comment</th>
              </tr>
            )}
          </thead>
          <tbody className="text-xs text-brand-900/80 bg-white">
            {currentData.map((item, idx) => (
              <tr key={idx} className="group align-top border-b border-brand-50/50 last:border-0 hover:bg-brand-100/40 transition-colors odd:bg-white even:bg-brand-50/30">

                {(type === 'network_objects' || type === 'service_objects') && (
                  <>
                    <td className="px-5 py-3 font-bold text-brand-950">
                      {item.name}
                      {(item as NetworkObjectItem | ServiceObjectItem).is_unused && (
                        <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] uppercase font-bold bg-slate-100 text-slate-500 border border-slate-200">Unused</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-brand-700/70 font-medium">
                      {(item as NetworkObjectItem).type || (item as ServiceObjectItem).protocol}
                    </td>
                    <td className="px-5 py-3 font-mono text-brand-800 text-[11px]">
                      {(item as NetworkObjectItem).value1 || (item as ServiceObjectItem).port}
                    </td>
                  </>
                )}

                {type === 'rules' && (
                  <>
                    <td className="px-4 py-4 text-brand-400 font-mono text-[10px] text-center">{(item as RuleItem).id}</td>
                    <td className="px-4 py-4 text-brand-950 font-bold">{(item as RuleItem).description || (item as RuleItem).name}</td>
                    <td className="px-4 py-4 text-brand-700/70 font-medium"><FormatListCell items={(item as RuleItem).source_zones} /></td>
                    <td className="px-4 py-4 text-brand-700/70 font-medium"><FormatListCell items={(item as RuleItem).destination_zones} /></td>
                    <td className="px-4 py-4"><FormatListCell items={(item as RuleItem).source_addresses} /></td>
                    <td className="px-4 py-4"><FormatListCell items={(item as RuleItem).destination_addresses} /></td>
                    <td className="px-4 py-4"><FormatListCell items={(item as RuleItem).services} /></td>
                    <td className="px-4 py-4"><FormatListCell items={(item as RuleItem).application} icon={Grid} /></td>
                    <td className="px-4 py-4">
                      {(item as RuleItem).security_profiles && (item as RuleItem).security_profiles!.length > 0 ? (
                        (item as RuleItem).security_profiles!.map((p, i) => (
                          <span key={i} className="inline-block px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 text-[10px] font-bold border border-indigo-100 mr-1 mb-1 whitespace-nowrap">{p}</span>
                        ))
                      ) : <span className="text-brand-900/20">-</span>}
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className={clsx(
                        "px-3 py-1 rounded-full text-[10px] uppercase font-bold tracking-wide shadow-sm",
                        ['allow', 'permit', 'accept'].includes((item as RuleItem).action?.toLowerCase() || '')
                          ? "bg-brand-500 text-white shadow-brand-200"
                          : "bg-rose-500 text-white shadow-rose-200"
                      )}>
                        {(item as RuleItem).action}
                      </span>
                    </td>
                  </>
                )}

                {type === 'nat' && (
                  <>
                    <td className="px-4 py-4 text-brand-400 font-mono text-[10px]">{String((item as NATItem).id)}</td>
                    <td className="px-4 py-4"><FormatListCell items={(item as NATItem).original_source} /></td>
                    <td className="px-4 py-4"><FormatListCell items={(item as NATItem).translated_source} /></td>
                    <td className="px-4 py-4"><FormatListCell items={(item as NATItem).original_destination} /></td>
                    <td className="px-4 py-4"><FormatListCell items={(item as NATItem).translated_destination} /></td>
                    <td className="px-4 py-4 text-center">
                      <span className="text-brand-700 bg-brand-50 border border-brand-100 px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wide">
                        Enabled
                      </span>
                    </td>
                  </>
                )}

                {type === 'routes' && (
                  <>
                    <td className="px-5 py-4 text-brand-900 font-mono text-[11px] font-medium">{(item as RouteItem).destination}</td>
                    <td className="px-5 py-4 text-brand-700">{(item as RouteItem).gateway}</td>
                    <td className="px-5 py-4 text-brand-700">{(item as RouteItem).interface}</td>
                    <td className="px-5 py-4 text-brand-700 italic">{(item as RouteItem).original_text || '-'}</td>
                  </>
                )}

              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="border-t border-brand-100 bg-white/60 backdrop-blur-sm p-3 flex justify-between items-center text-xs text-brand-700/60 font-medium">
          <div className="flex items-center gap-2">
            <span>
              Showing {startIndex + 1} - {Math.min(startIndex + rowsPerPage, data.length)} of {data.length}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              className="p-1.5 rounded-lg hover:bg-brand-50 hover:text-brand-800 border border-transparent hover:border-brand-100 transition-all disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:border-transparent"
              onClick={() => handlePageChange(-1)}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="bg-brand-50 text-brand-800 px-3 py-1 rounded-md font-bold text-xs border border-brand-100 mx-1">
              {currentPage} / {totalPages}
            </span>
            <button
              className="p-1.5 rounded-lg hover:bg-brand-50 hover:text-brand-800 border border-transparent hover:border-brand-100 transition-all disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:border-transparent"
              onClick={() => handlePageChange(1)}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DataTable;

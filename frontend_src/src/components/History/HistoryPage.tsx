import React, { useEffect, useState } from 'react';
import {
    History,
    FileText,
    Clock,
    Search,
    RefreshCw,
    Trash2,
    ExternalLink
} from 'lucide-react';

interface ParsingSession {
    id: string;
    created_at: string;
    source_vendor: string;
    filename: string;
    description: string;
}

const HistoryPage: React.FC = () => {
    const [sessions, setSessions] = useState<ParsingSession[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    const fetchHistory = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch('http://localhost:8000/api/v1/history/uploads');
            if (!response.ok) {
                throw new Error('Failed to fetch history');
            }
            const data = await response.json();
            setSessions(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An unknown error occurred');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchHistory();
    }, []);

    const formatDate = (dateString: string) => {
        try {
            return new Date(dateString).toLocaleString();
        } catch (e) {
            return dateString;
        }
    };

    const getVendorBadgeColor = (vendor: string) => {
        switch (vendor.toLowerCase()) {
            case 'cisco_asa': return 'bg-blue-100 text-blue-800 border-blue-200';
            case 'checkpoint': return 'bg-pink-100 text-pink-800 border-pink-200';
            case 'fortinet': return 'bg-green-100 text-green-800 border-green-200';
            case 'palo_alto': return 'bg-orange-100 text-orange-800 border-orange-200';
            default: return 'bg-gray-100 text-gray-800 border-gray-200';
        }
    };

    return (
        <div className="h-full flex flex-col bg-slate-50">
            {/* Header */}
            <header className="bg-white border-b border-gray-200 px-8 py-5 flex items-center justify-between shrink-0">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 font-display flex items-center gap-3">
                        <History className="w-8 h-8 text-brand-600" />
                        Upload History
                    </h1>
                    <p className="text-gray-500 mt-1">
                        View and manage your previously uploaded configurations.
                    </p>
                </div>
                <button
                    onClick={fetchHistory}
                    disabled={loading}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-brand-500 transition-colors disabled:opacity-50"
                >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                </button>
            </header>

            {/* Content */}
            <div className="flex-1 overflow-auto p-8">
                {loading ? (
                    <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                        <RefreshCw className="w-8 h-8 animate-spin mb-4 text-brand-500" />
                        <p>Loading history...</p>
                    </div>
                ) : error ? (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 max-w-2xl mx-auto">
                        <p className="font-semibold">Error loading history</p>
                        <p className="text-sm mt-1">{error}</p>
                        <button
                            onClick={fetchHistory}
                            className="mt-3 text-sm font-medium underline hover:no-underline"
                        >
                            Try Again
                        </button>
                    </div>
                ) : sessions.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-96 text-center max-w-md mx-auto">
                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-6">
                            <FileText className="w-8 h-8 text-gray-400" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">No Uploads Yet</h3>
                        <p className="text-gray-500 mb-6">
                            Upload a firewall configuration to see it appear in your history.
                        </p>
                    </div>
                ) : (
                    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Date Uploaded
                                    </th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Vendor
                                    </th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Filename
                                    </th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Description
                                    </th>
                                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {sessions.map((session) => (
                                    <tr key={session.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            <div className="flex items-center gap-2">
                                                <Clock className="w-4 h-4 text-gray-400" />
                                                {formatDate(session.created_at)}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getVendorBadgeColor(session.source_vendor)}`}>
                                                {session.source_vendor}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                            {session.filename}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                                            {session.description || '-'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <button
                                                disabled
                                                className="text-gray-400 cursor-not-allowed hover:text-gray-600 transition-colors px-3 py-1 rounded-md hover:bg-gray-100 flex items-center gap-1 inline-flex ml-auto"
                                                title="Opening sessions coming soon"
                                            >
                                                <ExternalLink className="w-4 h-4" />
                                                Open
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default HistoryPage;

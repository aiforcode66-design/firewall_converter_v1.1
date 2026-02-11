import React from 'react';
import clsx from 'clsx';

interface VendorOption {
    id: string;
    name: string;
    icon: string;
}

interface VendorSelectorProps {
    label: string;
    value: string;
    onChange: (value: string) => void;
    vendors: VendorOption[];
}

const VendorSelector: React.FC<VendorSelectorProps> = ({
    label,
    value,
    onChange,
    vendors,
}) => {
    return (
        <div className="space-y-3">
            <label className="block text-sm font-semibold text-gray-700">
                {label}
            </label>
            <div className="grid grid-cols-2 gap-3">
                {vendors.map((vendor) => {
                    const isSelected = value === vendor.id;
                    return (
                        <button
                            key={vendor.id}
                            type="button"
                            onClick={() => {
                                console.log('[VendorSelector] Selected vendor:', vendor.id, 'for', label);
                                onChange(vendor.id);
                            }}
                            className={clsx(
                                'p-4 rounded-lg border-2 transition-all text-left',
                                'hover:border-brand-400 hover:bg-brand-50/50',
                                isSelected
                                    ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-200'
                                    : 'border-gray-200 bg-white'
                            )}
                        >
                            <div className="flex items-center gap-3">
                                <div
                                    className={clsx(
                                        'w-10 h-10 rounded-lg flex items-center justify-center text-xl',
                                        isSelected ? 'bg-brand-500 text-white' : 'bg-gray-100 text-gray-600'
                                    )}
                                >
                                    {vendor.icon}
                                </div>
                                <div>
                                    <div
                                        className={clsx(
                                            'font-semibold',
                                            isSelected ? 'text-brand-700' : 'text-gray-900'
                                        )}
                                    >
                                        {vendor.name}
                                    </div>
                                </div>
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

export default VendorSelector;

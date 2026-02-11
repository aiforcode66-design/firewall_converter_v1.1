import React, { useState, Fragment } from 'react';
import { Combobox, Transition } from '@headlessui/react';
import { Check, ChevronDown, Plus } from 'lucide-react';
import clsx from 'clsx';

interface MappingComboboxProps {
    sourceItem: string;
    value: string;
    onChange: (value: string) => void;
    presetOptions: string[];
    placeholder?: string;
    allowCustom?: boolean;
}

const MappingCombobox: React.FC<MappingComboboxProps> = ({
    sourceItem,
    value,
    onChange,
    presetOptions,
    placeholder = 'Select or type...',
    allowCustom = true,
}) => {
    const [query, setQuery] = useState('');

    const filteredOptions =
        query === ''
            ? presetOptions
            : presetOptions.filter((option) =>
                option.toLowerCase().includes(query.toLowerCase())
            );

    const isCustomValue = allowCustom && value && !presetOptions.includes(value);
    const showCreateOption = allowCustom && query !== '' && !filteredOptions.includes(query);

    return (
        <div className="flex items-center gap-4">
            {/* Source Item */}
            <div className="flex-shrink-0 w-48">
                <div className="px-4 py-3 bg-gray-100 border border-gray-200 rounded-lg">
                    <span className="font-mono text-sm font-medium text-gray-900">
                        {sourceItem}
                    </span>
                </div>
            </div>

            {/* Arrow */}
            <div className="flex-shrink-0 text-gray-400 text-xl font-bold">
                →
            </div>

            {/* Combobox */}
            <div className="flex-1">
                <Combobox value={value} onChange={onChange}>
                    <div className="relative">
                        <div className="relative">
                            <Combobox.Input
                                className={clsx(
                                    'w-full px-4 py-3 pr-10 text-sm font-medium rounded-lg border-2 transition-all',
                                    'focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500',
                                    value
                                        ? isCustomValue
                                            ? 'border-orange-300 bg-orange-50 text-orange-900'
                                            : 'border-brand-300 bg-brand-50 text-brand-900'
                                        : 'border-gray-300 bg-white text-gray-900'
                                )}
                                placeholder={placeholder}
                                displayValue={(item: string) => item}
                                onChange={(event) => setQuery(event.target.value)}
                            />
                            <Combobox.Button className="absolute inset-y-0 right-0 flex items-center pr-3">
                                <ChevronDown className="w-5 h-5 text-gray-400" aria-hidden="true" />
                            </Combobox.Button>
                        </div>

                        <Transition
                            as={Fragment}
                            leave="transition ease-in duration-100"
                            leaveFrom="opacity-100"
                            leaveTo="opacity-0"
                            afterLeave={() => setQuery('')}
                        >
                            <Combobox.Options className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg bg-white py-1 text-sm shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                                {filteredOptions.length === 0 && query !== '' ? (
                                    <div className="relative cursor-default select-none px-4 py-2 text-gray-700">
                                        {allowCustom ? (
                                            <div className="text-xs text-gray-500">
                                                Type to create custom mapping
                                            </div>
                                        ) : (
                                            'No options found'
                                        )}
                                    </div>
                                ) : (
                                    <>
                                        {filteredOptions.map((option) => (
                                            <Combobox.Option
                                                key={option}
                                                className={({ active }) =>
                                                    clsx(
                                                        'relative cursor-pointer select-none py-2 pl-10 pr-4',
                                                        active ? 'bg-brand-500 text-white' : 'text-gray-900'
                                                    )
                                                }
                                                value={option}
                                            >
                                                {({ selected, active }) => (
                                                    <>
                                                        <span
                                                            className={clsx(
                                                                'block truncate',
                                                                selected ? 'font-semibold' : 'font-normal'
                                                            )}
                                                        >
                                                            {option}
                                                        </span>
                                                        {selected && (
                                                            <span
                                                                className={clsx(
                                                                    'absolute inset-y-0 left-0 flex items-center pl-3',
                                                                    active ? 'text-white' : 'text-brand-600'
                                                                )}
                                                            >
                                                                <Check className="w-5 h-5" aria-hidden="true" />
                                                            </span>
                                                        )}
                                                    </>
                                                )}
                                            </Combobox.Option>
                                        ))}

                                        {showCreateOption && (
                                            <Combobox.Option
                                                value={query}
                                                className={({ active }) =>
                                                    clsx(
                                                        'relative cursor-pointer select-none py-2 pl-10 pr-4 border-t border-gray-200',
                                                        active ? 'bg-orange-500 text-white' : 'text-orange-700'
                                                    )
                                                }
                                            >
                                                {({ active }) => (
                                                    <div className="flex items-center gap-2">
                                                        <Plus className="w-4 h-4" />
                                                        <span className="font-medium">
                                                            Create "{query}"
                                                        </span>
                                                    </div>
                                                )}
                                            </Combobox.Option>
                                        )}
                                    </>
                                )}
                            </Combobox.Options>
                        </Transition>
                    </div>
                </Combobox>

                {/* Custom indicator */}
                {isCustomValue && (
                    <p className="mt-1 text-xs text-orange-600 font-medium">
                        ℹ️ Custom mapping
                    </p>
                )}
            </div>
        </div>
    );
};

export default MappingCombobox;

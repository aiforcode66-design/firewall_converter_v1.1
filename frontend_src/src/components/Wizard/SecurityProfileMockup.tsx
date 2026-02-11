export const SecurityProfileMockup = () => (
    <div className="bg-white rounded-xl shadow-lg p-8 border border-gray-100">
        <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
            </div>
            <div>
                <h2 className="text-xl font-bold text-gray-900">Security Profile Defaults</h2>
                <p className="text-sm text-gray-600">Assign default security profiles to all converted policies</p>
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
                { label: 'Anti-Virus Profile', placeholder: 'e.g. default' },
                { label: 'Anti-Spyware Profile', placeholder: 'e.g. strict' },
                { label: 'Vulnerability Protection', placeholder: 'e.g. strict' },
                { label: 'URL Filtering Profile', placeholder: 'e.g. default' },
                { label: 'File Blocking Profile', placeholder: 'e.g. basic-file-blocking' },
                { label: 'WildFire Analysis', placeholder: 'e.g. default' },
                { label: 'Log Forwarding Profile', placeholder: 'e.g. default' },
            ].map((field) => (
                <div key={field.label} className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">{field.label}</label>
                    <input
                        type="text"
                        placeholder={field.placeholder}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all outline-none"
                    />
                </div>
            ))}
        </div>
    </div>
);

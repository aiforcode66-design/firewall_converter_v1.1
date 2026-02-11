/**
 * Conversion History Utility
 * Manages localStorage for conversion history
 */

const STORAGE_KEY = 'conversion_history';
const MAX_HISTORY = 50;

/**
 * Save a conversion to history
 * @param {Object} conversionData - Conversion result data
 */
export const saveConversion = (conversionData) => {
    try {
        const history = getHistory();
        const newEntry = {
            id: Date.now(),
            timestamp: new Date().toISOString(),
            source: conversionData.source_vendor || 'Unknown',
            dest: conversionData.dest_vendor || 'Unknown',
            stats: {
                rules: conversionData.stats?.rule_count || 0,
                objects: conversionData.stats?.object_count || 0,
                nat: conversionData.stats?.nat_count || 0,
                warnings: conversionData.stats?.warning_count || 0,
            },
            status: 'completed',
        };

        history.unshift(newEntry);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(0, MAX_HISTORY)));
        return newEntry;
    } catch (error) {
        console.error('Error saving conversion history:', error);
        return null;
    }
};

/**
 * Get conversion history
 * @returns {Array} Conversion history array
 */
export const getHistory = () => {
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        return data ? JSON.parse(data) : [];
    } catch (error) {
        console.error('Error reading conversion history:', error);
        return [];
    }
};

/**
 * Clear all conversion history
 */
export const clearHistory = () => {
    try {
        localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
        console.error('Error clearing conversion history:', error);
    }
};

/**
 * Delete a single conversion from history
 * @param {number} id - Conversion ID
 */
export const deleteConversion = (id) => {
    try {
        const history = getHistory();
        const filtered = history.filter(item => item.id !== id);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    } catch (error) {
        console.error('Error deleting conversion:', error);
    }
};

/**
 * Get conversion statistics
 * @returns {Object} Aggregate statistics
 */
export const getStats = () => {
    const history = getHistory();

    const totalConversions = history.length;
    const totalRules = history.reduce((sum, item) => sum + (item.stats?.rules || 0), 0);

    // Most used source vendor
    const sourceCounts = {};
    history.forEach(item => {
        sourceCounts[item.source] = (sourceCounts[item.source] || 0) + 1;
    });
    const mostUsedSource = Object.keys(sourceCounts).reduce((a, b) =>
        sourceCounts[a] > sourceCounts[b] ? a : b, 'N/A'
    );

    // Most used dest vendor
    const destCounts = {};
    history.forEach(item => {
        destCounts[item.dest] = (destCounts[item.dest] || 0) + 1;
    });
    const mostUsedDest = Object.keys(destCounts).reduce((a, b) =>
        destCounts[a] > destCounts[b] ? a : b, 'N/A'
    );

    return {
        totalConversions,
        totalRules,
        mostUsedSource: totalConversions > 0 ? mostUsedSource : 'N/A',
        mostUsedDest: totalConversions > 0 ? mostUsedDest : 'N/A',
    };
};

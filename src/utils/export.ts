
export const exportToCSV = async (data: any[], filename: string, headers?: string[]) => {
    if (!data || data.length === 0) {
        return { success: false, error: 'No data to export' };
    }

    // Determine headers if not provided
    const cols = headers || Object.keys(data[0]);

    // Create CSV header row
    const csvHeader = cols.join(',') + '\n';

    // Create CSV rows
    const csvRows = data.map(row => {
        return cols.map(col => {
            const val = row[col];
            // Escape double quotes and wrap in quotes if necessary
            const cell = val === null || val === undefined ? '' : String(val).replace(/"/g, '""');
            return `"${cell}"`;
        }).join(',');
    }).join('\n');

    const csvContent = csvHeader + csvRows;

    // Use Electron API to save file
    // @ts-ignore
    if (window.electronAPI && window.electronAPI.utils && window.electronAPI.utils.saveFile) {
        // @ts-ignore
        return await window.electronAPI.utils.saveFile(csvContent, filename, ['csv']);
    } else {
        console.error("Electron API not available");
        return { success: false, error: "Electron API not available" };
    }
};

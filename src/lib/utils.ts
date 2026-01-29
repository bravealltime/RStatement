export function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('th-TH', {
        style: 'decimal',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(amount);
}

export function formatDate(dateStr: string): string {
    // Assuming basic date format handling, can be improved
    // If ISO string
    try {
        const date = new Date(dateStr);
        return new Intl.DateTimeFormat('th-TH', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
        }).format(date);
    } catch (e) {
        return dateStr;
    }
}

import { useState, useMemo } from "react";
import { StatementData, Transaction } from "@/lib/types";
import { TransactionCard } from "./TransactionCard";
import { formatCurrency, formatDate } from "@/lib/utils";

interface DashboardProps {
    data: StatementData;
    onReset: () => void;
}

export function StatementDashboard({ data, onReset }: DashboardProps) {
    const [selectedMonth, setSelectedMonth] = useState<string>("all");
    const [searchQuery, setSearchQuery] = useState<string>("");

    // Extract available months
    const availableMonths = useMemo(() => {
        const months = new Set<string>();
        data.transactions.forEach(t => {
            const date = new Date(t.date);
            // format as YYYY-MM
            const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            months.add(key);
        });
        // Sort descending
        return Array.from(months).sort().reverse();
    }, [data.transactions]);

    // Filter transactions based on selection AND search
    const filteredTransactions = useMemo(() => {
        let result = data.transactions;

        // 1. Filter by Month
        if (selectedMonth !== "all") {
            result = result.filter(t => t.date.startsWith(selectedMonth));
        }

        // 2. Filter by Search Query
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            result = result.filter(t =>
                t.description.toLowerCase().includes(query) ||
                t.amount.toString().includes(query)
            );
        }

        return result;
    }, [data.transactions, selectedMonth, searchQuery]);

    // Calculate totals based on FILTERED transactions
    const totalIncome = filteredTransactions
        .filter((t) => t.type === "income")
        .reduce((acc, t) => acc + t.amount, 0);

    const totalExpense = filteredTransactions
        .filter((t) => t.type === "expense")
        .reduce((acc, t) => acc + t.amount, 0);

    const netBalance = totalIncome - totalExpense;

    // Group by date
    const grouped = filteredTransactions.reduce((acc, t) => {
        if (!acc[t.date]) acc[t.date] = [];
        acc[t.date].push(t);
        return acc;
    }, {} as Record<string, Transaction[]>);

    // Sort dates descending
    const sortedDates = Object.keys(grouped).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

    // Helper to format month options (e.g., "2024-01" -> "มกราคม 2567")
    const formatMonthOption = (key: string) => {
        const [year, month] = key.split("-");
        const date = new Date(parseInt(year), parseInt(month) - 1, 1);
        return date.toLocaleDateString("th-TH", { month: "long", year: "numeric" });
    };

    return (
        <div className="container" style={{ paddingBottom: "4rem" }}>
            <header className="flex flex-col gap-4 mobile-stack" style={{ padding: "2rem 0" }}>
                <div className="flex items-center justify-between mobile-stack" style={{ gap: "1rem" }}>
                    <div>
                        <h1 style={{ color: "var(--primary)" }}>สรุปรายการเดินบัญชี</h1>
                        <p style={{ fontSize: "1.1rem", color: "var(--muted)" }}>
                            {data.bankName} {data.accountNumber ? `(${data.accountNumber})` : ""}
                        </p>
                    </div>
                    <div className="flex flex-col gap-2 align-end mobile-full">
                        <div className="flex gap-2 mobile-stack">
                            {/* Search Input */}
                            <input
                                type="text"
                                placeholder="🔍 ค้นหา (ชื่อ/เลขบัญชี)"
                                className="btn"
                                style={{
                                    background: "white",
                                    border: "1px solid #e2e8f0",
                                    color: "var(--foreground)",
                                    minWidth: "200px"
                                }}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />

                            {/* Month Filter */}
                            <select
                                className="btn"
                                style={{
                                    background: "white",
                                    color: "var(--foreground)",
                                    border: "1px solid #e2e8f0",
                                    cursor: "pointer",
                                    fontSize: "1rem",
                                    paddingRight: "2rem"
                                }}
                                value={selectedMonth}
                                onChange={(e) => setSelectedMonth(e.target.value)}
                            >
                                <option value="all">ทุกเดือน (All)</option>
                                {availableMonths.map(m => (
                                    <option key={m} value={m}>{formatMonthOption(m)}</option>
                                ))}
                            </select>

                            <button className="btn btn-primary" onClick={onReset} style={{ background: "var(--muted)" }}>
                                เปลี่ยนไฟล์
                            </button>
                        </div>
                    </div>
                </div>

                {(data.accountOwner || data.branch || data.address) && (
                    <div className="card" style={{ background: "#f8fafc", border: "1px solid #e2e8f0", width: "100%" }}>
                        <h3 style={{ fontSize: "1.1rem", marginBottom: "0.5rem", color: "var(--foreground)" }}>ข้อมูลบัญชี</h3>
                        <div className="flex flex-col gap-2" style={{ fontSize: "0.95rem", color: "var(--muted)" }}>
                            {data.accountOwner && <p><strong>ชื่อบัญชี:</strong> {data.accountOwner}</p>}
                            {data.branch && <p><strong>สาขา:</strong> {data.branch}</p>}
                            {data.address && <p><strong>ที่อยู่:</strong> {data.address}</p>}
                        </div>
                    </div>
                )}
            </header>

            {/* Summary Cards */}
            <div className="flex gap-4 mb-4 mobile-stack" style={{ flexWrap: "wrap" }}>
                <div className="card flex-col items-center justify-center mobile-full" style={{ flex: 1, minWidth: "150px", background: "#f8fafc", border: "1px solid #cbd5e1" }}>
                    <h3 style={{ color: "var(--muted)", fontSize: "1rem" }}>จำนวนรายการ</h3>
                    <h2 style={{ fontSize: "1.5rem", color: "var(--foreground)" }}>{filteredTransactions.length}</h2>
                </div>

                <div className="card flex-col items-center justify-center mobile-full" style={{ flex: 1, minWidth: "200px", background: "var(--success-bg)", borderColor: "var(--success)" }}>
                    <h3 style={{ color: "var(--success)", fontSize: "1.1rem" }}>รายรับรวม</h3>
                    <h2 style={{ fontSize: "1.75rem", color: "var(--success)" }}>+{formatCurrency(totalIncome)}</h2>
                </div>
                <div className="card flex-col items-center justify-center mobile-full" style={{ flex: 1, minWidth: "200px", background: "var(--danger-bg)", borderColor: "var(--danger)" }}>
                    <h3 style={{ color: "var(--danger)", fontSize: "1.1rem" }}>รายจ่ายรวม</h3>
                    <h2 style={{ fontSize: "1.75rem", color: "var(--danger)" }}>-{formatCurrency(totalExpense)}</h2>
                </div>
                <div className="card flex-col items-center justify-center mobile-full" style={{ flex: 1, minWidth: "200px", background: "#f1f5f9" }}>
                    <h3 style={{ color: "var(--foreground)", fontSize: "1.1rem" }}>ยอดสุทธิ</h3>
                    <h2 style={{ fontSize: "1.75rem", color: netBalance >= 0 ? "var(--success)" : "var(--danger)" }}>
                        {netBalance >= 0 ? "+" : ""}{formatCurrency(netBalance)}
                    </h2>
                </div>
            </div>

            {/* Transaction List */}
            <div className="mt-4">
                {sortedDates.map((date) => (
                    <div key={date} style={{ marginBottom: "2rem" }}>
                        <h3 style={{
                            background: "#e2e8f0",
                            display: "inline-block",
                            padding: "0.5rem 1rem",
                            borderRadius: "20px",
                            marginBottom: "1rem",
                            fontSize: "1.1rem"
                        }}>
                            {formatDate(date)}
                        </h3>
                        {grouped[date].map((t) => (
                            <TransactionCard key={t.id} transaction={t} />
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
}

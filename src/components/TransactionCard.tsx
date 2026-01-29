import { Transaction } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";

interface TransactionCardProps {
    transaction: Transaction;
}

export function TransactionCard({ transaction }: TransactionCardProps) {
    const isIncome = transaction.type === "income";

    return (
        <div
            className="card flex items-center justify-between"
            style={{
                marginBottom: "0.75rem",
                borderLeft: isIncome ? "6px solid var(--success)" : "6px solid var(--danger)",
                gap: "1rem"
            }}
        >
            <div className="flex items-center gap-3" style={{ flex: 1, minWidth: 0 }}>
                <div
                    style={{
                        background: isIncome ? "var(--success-bg)" : "var(--danger-bg)",
                        color: isIncome ? "var(--success)" : "var(--danger)",
                        padding: "10px",
                        borderRadius: "50%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0 // Prevent icon from shrinking
                    }}
                >
                    {isIncome ? <ArrowDownLeft size={24} /> : <ArrowUpRight size={24} />}
                </div>
                <div style={{ minWidth: 0 }}>
                    <h3 style={{
                        fontSize: "0.95rem", // Reduce font slightly to fit long text
                        marginBottom: "0.1rem",
                        lineHeight: "1.4", // Improve readability
                        wordBreak: "break-word" // Ensure long numbers wrap
                    }}>
                        {transaction.description}
                    </h3>
                    <p style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
                        {transaction.time || "00:00"} น.
                    </p>
                </div>
            </div>

            <div className="text-right" style={{ flexShrink: 0 }}>
                <h2
                    style={{
                        fontSize: "1.25rem",
                        color: isIncome ? "var(--success)" : "var(--danger)",
                        fontWeight: "bold",
                        marginBottom: 0
                    }}
                >
                    {isIncome ? "+" : "-"}{formatCurrency(transaction.amount)}
                </h2>
                <p style={{ fontSize: "0.8rem", color: "#888" }}>บาท</p>
            </div>
        </div>
    );
}

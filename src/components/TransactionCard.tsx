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
                marginBottom: "1rem",
                borderLeft: isIncome ? "6px solid var(--success)" : "6px solid var(--danger)",
            }}
        >
            <div className="flex items-center gap-4">
                <div
                    style={{
                        background: isIncome ? "var(--success-bg)" : "var(--danger-bg)",
                        color: isIncome ? "var(--success)" : "var(--danger)",
                        padding: "12px",
                        borderRadius: "50%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                    }}
                >
                    {isIncome ? <ArrowDownLeft size={32} /> : <ArrowUpRight size={32} />}
                </div>
                <div>
                    <h3 style={{ fontSize: "1.25rem", marginBottom: "0.25rem" }}>
                        {transaction.description}
                    </h3>
                    <p style={{ color: "var(--muted)", fontSize: "1rem" }}>
                        {transaction.time || "00:00"} น.
                    </p>
                </div>
            </div>

            <div className="text-center">
                <h2
                    style={{
                        fontSize: "1.5rem",
                        color: isIncome ? "var(--success)" : "var(--danger)",
                        fontWeight: "bold",
                    }}
                >
                    {isIncome ? "+" : "-"}{formatCurrency(transaction.amount)}
                </h2>
                <p style={{ fontSize: "0.9rem", color: "#888" }}>บาท</p>
            </div>
        </div>
    );
}

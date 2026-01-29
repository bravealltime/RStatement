"use client";

import { useState } from "react";
import { UploadCloud } from "lucide-react";
import { StatementData } from "@/lib/types";
import { StatementDashboard } from "@/components/StatementDashboard";
import { parseStatement } from "@/lib/pdf-parser";

// Mock Data for Demo
const MOCK_DATA: StatementData = {
  bankName: "Statement ตัวอย่าง (ธนาคารกสิกรไทย)",
  accountNumber: "xxx-x-x1234-x",
  transactions: [
    { id: "1", date: "2024-01-29", time: "10:30", description: "โอนเงินเข้า - นาย สมชาย", amount: 5000, type: "income" },
    { id: "2", date: "2024-01-29", time: "12:15", description: "ชำระค่าอาหาร Robinhood", amount: 250, type: "expense" },
    { id: "3", date: "2024-01-28", time: "09:00", description: "เงินเดือนเข้า", amount: 35000, type: "income" },
    { id: "4", date: "2024-01-28", time: "18:20", description: "7-Eleven สาขา 1234", amount: 120, type: "expense" },
    { id: "5", date: "2024-01-27", time: "15:45", description: "โอนเงินออก - ค่าเช่าห้อง", amount: 6500, type: "expense" },
  ]
};

export default function Home() {
  const [data, setData] = useState<StatementData | null>(null);
  const [rawText, setRawText] = useState<string>(""); // New state for debugging
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Password handling
  const [showPasswordInput, setShowPasswordInput] = useState(false);
  const [password, setPassword] = useState("");
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    setError(null);

    const file = e.dataTransfer.files[0];
    if (file && file.type === "application/pdf") {
      processFile(file, password);
    } else {
      setError("กรุณาอัพโหลดไฟล์ PDF เท่านั้น");
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setError(null);
      processFile(e.target.files[0], password);
    }
  };

  const processFile = async (file: File, pwd?: string) => {
    setIsLoading(true);
    setError(null);
    setRawText(""); // Reset
    const cleanDetails = pwd ? pwd.trim() : pwd;
    console.log("Processing file:", file.name, "Password provided:", cleanDetails ? "YES" : "NO");

    // Timeout wrapper to prevent hanging
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Timeout: Parsing took too long")), 10000)
    );

    try {
      const result = await Promise.race([
        parseStatement(file, cleanDetails),
        timeoutPromise
      ]) as StatementData;

      if (result.transactions.length === 0) {
        // Do NOT setData(result) here, or it switches to dashboard
        setRawText(result.rawText || "");
        setError("ไม่พบรายการเดินบัญชี หรือรูปแบบไฟล์ไม่ถูกต้อง (โปรดดู Debug Info ด้านล่าง)");
      } else {
        setData(result);
        // Reset password state on success
        setShowPasswordInput(false);
        setPassword("");
        setPendingFile(null);
      }
    } catch (err: any) {
      console.error(err);
      if (err.name === "PasswordException" || err.message?.includes("Password")) {
        setShowPasswordInput(true);
        setPendingFile(file);
        setError(pwd ? "รหัสผ่านไม่ถูกต้อง กรุณาลองใหม่" : "ไฟล์นี้ต้องใช้รหัสผ่าน");
      } else {
        setError("เกิดข้อผิดพลาดในการอ่านไฟล์: " + (err.message || "Unknown error"));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pendingFile && password) {
      processFile(pendingFile, password.trim());
    }
  };

  if (data) {
    return <StatementDashboard data={data} onReset={() => setData(null)} />;
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="text-center mb-8">
        <h1 style={{ color: "var(--primary)", fontSize: "3rem", marginBottom: "0.5rem" }}>
          RStatement
        </h1>
        <p style={{ fontSize: "1.25rem", color: "var(--muted)" }}>
          อ่านรายการเดินบัญชี... ให้เป็นเรื่องง่าย
        </p>
      </div>

      <div
        className="card flex-col items-center justify-center"
        style={{
          width: "100%",
          maxWidth: "600px",
          height: "400px",
          border: "2px dashed var(--primary)",
          background: isDragging ? "var(--primary-bg)" : "var(--surface)",
          cursor: "pointer",
          transition: "all 0.3s",
        }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !showPasswordInput && document.getElementById("file-upload")?.click()}
      >
        <input
          type="file"
          id="file-upload"
          hidden
          accept="application/pdf"
          onChange={handleFileSelect}
          disabled={showPasswordInput}
        />

        {isLoading ? (
          <div className="flex-col items-center animate-pulse">
            <div style={{
              width: "64px", height: "64px",
              border: "4px solid var(--primary)",
              borderTopColor: "transparent",
              borderRadius: "50%",
              animation: "spin 1s linear infinite"
            }} />
            <p className="mt-4 text-xl">กำลังประมวลผล...</p>
          </div>
        ) : showPasswordInput ? (
          <form onSubmit={handlePasswordSubmit} className="flex-col items-center w-full max-w-xs" onClick={(e) => e.stopPropagation()}>
            <div style={{
              background: "var(--primary-bg)",
              padding: "1rem",
              borderRadius: "50%",
              marginBottom: "1rem",
              color: "var(--primary)"
            }}>
              <span style={{ fontSize: "2rem" }}>🔒</span>
            </div>
            <h3 style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>
              ไฟล์นี้มีรหัสผ่าน
            </h3>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="กรอกรหัสผ่าน (วันเกิด?)"
              className="input mb-4 w-full"
              autoFocus
              style={{ textAlign: "center", fontSize: "1.2rem", padding: "0.8rem" }}
            />
            <div className="flex gap-2 w-full">
              <button type="submit" className="btn btn-primary flex-1">
                ยืนยัน
              </button>
              <button
                type="button"
                className="btn btn-secondary flex-1"
                onClick={() => {
                  setShowPasswordInput(false);
                  setPassword("");
                  setPendingFile(null);
                  setError(null);
                }}
              >
                ยกเลิก
              </button>
            </div>
          </form>
        ) : (
          <>
            <div style={{
              background: "var(--primary-bg)",
              padding: "2rem",
              borderRadius: "50%",
              marginBottom: "1.5rem",
              color: "var(--primary)"
            }}>
              <UploadCloud size={64} />
            </div>
            <h3 style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>
              วางไฟล์ Statement PDF ที่นี่
            </h3>
            <p style={{ color: "var(--muted)", marginBottom: "1rem" }}>หรือคลิกเพื่อเลือกไฟล์</p>

            {/* Manual Password Option */}
            <div onClick={(e) => e.stopPropagation()} className="flex items-center gap-2 mt-4 p-2 bg-slate-100 rounded-lg">
              <input
                type="checkbox"
                id="manual-pwd"
                className="w-4 h-4"
                checked={!!password} // Visual check if password typed but checkbox logic handled by input presence
                onChange={(e) => {
                  if (!e.target.checked) setPassword("");
                }}
              />
              <label htmlFor="manual-pwd" className="text-sm font-medium">ไฟล์มีรหัสผ่าน?</label>
              <input
                type="text"
                placeholder="กรอกรหัสผ่านก่อนอัพโหลด"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input px-2 py-1 text-sm w-48"
                style={{ display: "inline-block" }}
              />
            </div>
          </>
        )}
      </div>

      {error && (
        <div style={{ marginTop: "1rem", color: "var(--danger)", background: "var(--danger-bg)", padding: "1rem", borderRadius: "12px", maxWidth: "800px", wordBreak: "break-word" }}>
          <p>⚠️ {error}</p>

          {rawText && (
            <div className="mt-4 text-left p-4 bg-white border rounded overflow-auto" style={{ maxHeight: "300px", fontSize: "0.8rem", color: "#333" }}>
              <p className="font-bold mb-2">Debug Info (Format Check):</p>
              <pre style={{ whiteSpace: "pre-wrap" }}>{rawText.substring(0, 2000)}...</pre>
            </div>
          )}
        </div>
      )}

      <p className="mt-8 text-sm text-muted" style={{ opacity: 0.6 }}>
        รองรับ: KBANK, SCB, KTB (Coming Soon)
      </p>

      <style jsx global>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </main>
  );
}

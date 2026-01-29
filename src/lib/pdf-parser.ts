import { Transaction, StatementData } from "./types";

// Polyfill for Promise.withResolvers (needed for older Safari/iOS)
if (typeof Promise.withResolvers === 'undefined') {
    // @ts-expect-error - Polyfill
    Promise.withResolvers = function () {
        let resolve, reject;
        const promise = new Promise((res, rej) => {
            resolve = res;
            reject = rej;
        });
        return { promise, resolve, reject };
    };
}

export async function parseStatement(file: File, password?: string): Promise<StatementData> {
    // Dynamic import to avoid SSR issues with canvas/worker
    const pdfjsLib = await import("pdfjs-dist");

    console.log("PDFJS Version:", pdfjsLib.version);

    // Set worker
    // Use a fixed version 4.10.38 for stability or matched version
    pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

    const arrayBuffer = await file.arrayBuffer();
    const data = new Uint8Array(arrayBuffer);
    console.log("Attempting to load document. Password provided:", !!password);

    try {
        const loadingTask = pdfjsLib.getDocument({
            data: data,
            password: password
        });

        loadingTask.onPassword = (updatePassword: (password: string) => void, reason: number) => {
            console.log("PDFJS onPassword triggered. Reason:", reason);

            if (reason === 1) { // NEED_PASSWORD
                // Only provide if we haven't failed already? 
                // Actually, if we provided it in constructor, reason shouldn't be 1 unless it was ignored.
                updatePassword(password || "");
            } else { // reason === 2 (INCORRECT_PASSWORD)
                console.error("Password incorrect. Stopping.");
                // create a specific error to catch later
                throw new Error("Password incorrect");
            }
        };

        const pdf = await loadingTask.promise;
        console.log("Document loaded successfully. Pages:", pdf.numPages);

        let fullText = "";

        // Extract text from all pages
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map((item: any) => item.str).join(" ");
            fullText += pageText + "\n";
        }

        console.log("Extracted Text Start:\n", fullText.substring(0, 500));
        console.log("Extracted Text End:\n", fullText.substring(fullText.length - 500));

        return parseKTB(fullText);
    } catch (e: any) {
        console.error("PDFJS Error:", e.name, e.message, e);
        throw e;
    }
}

function parseKTB(text: string): StatementData {
    const transactions: Transaction[] = [];

    // Normalize spaces: remove newlines and multiple spaces
    const cleanText = text.replace(/\s+/g, " ");

    // Regex to find start of lines with Date (DD/MM/YY)
    // Capture group 1: Date
    // Capture group 2: Content until next date or end of text
    const lineRegex = /(\d{2}\/\d{2}\/\d{2})\s+(.*?)(?=\s\d{2}\/\d{2}\/\d{2}|\s*$)/g;

    const matches = cleanText.matchAll(lineRegex);
    let idCounter = 1;

    // Pass 1: Extract raw data
    // We store candidates to analyze balance changes
    const rawTransactions: any[] = [];

    for (const match of matches) {
        const dateStr = match[1];
        const content = match[2];

        // Extract Amounts (looking for x,xxx.xx pattern)
        const amountMatches = content.match(/[\d,]+\.\d{2}/g);

        if (amountMatches && amountMatches.length > 0) {
            // First number is Transaction Amount
            const rawAmount = amountMatches[0].replace(/,/g, "");
            const amount = parseFloat(rawAmount);

            // Last number is likely the Balance
            const rawBalance = amountMatches[amountMatches.length - 1].replace(/,/g, "");
            const balance = parseFloat(rawBalance);

            // Extract Time
            const timeMatch = content.match(/(\d{2}:\d{2})/);
            const time = timeMatch ? timeMatch[1] : undefined;

            // Extract Description
            let description = content.split(amountMatches[0])[0].trim();
            description = description.replace(/\d{2}:\d{2}/, "").trim();

            // Convert Date
            const [d, m, y] = dateStr.split('/');
            const yearTh = 2500 + parseInt(y); // 68 -> 2568
            const yearAd = yearTh - 543;
            const isoDate = `${yearAd}-${m}-${d}`;

            // Initial Keyword Guess (Fallback)
            const isIncomeKeyword = content.includes("โอนเงินเข้า") ||
                content.includes("ฝากเงิน") ||
                content.includes("รับโอน") ||
                content.includes("เงินโอนเข้า") ||
                content.includes("ดอกเบี้ย") ||
                content.includes("เข้าบัญชี") ||
                content.includes("คืนเงิน");

            rawTransactions.push({
                isoDate, time, description, amount, balance, isIncomeKeyword
            });
        }
    }

    // Pass 2: Determine Type using Balance Logic
    for (let i = 0; i < rawTransactions.length; i++) {
        const curr = rawTransactions[i];
        let type: 'income' | 'expense' = 'expense'; // Default

        if (i > 0) {
            const prev = rawTransactions[i - 1];
            // Calculate potential balances
            const ifIncome = prev.balance + curr.amount;
            const ifExpense = prev.balance - curr.amount;

            // Check with small epsilon for float precision
            if (Math.abs(ifIncome - curr.balance) < 0.05) {
                type = 'income';
            } else if (Math.abs(ifExpense - curr.balance) < 0.05) {
                type = 'expense';
            } else {
                // Math doesn't match? Fallback to keyword
                type = curr.isIncomeKeyword ? 'income' : 'expense';
            }
        } else {
            // First item: Rely on Keyword
            type = curr.isIncomeKeyword ? 'income' : 'expense';

            // Or try to look ahead? (If Next Balance confirms Next Move)
            // But keep it simple for now.
        }

        transactions.push({
            id: (idCounter++).toString(),
            date: curr.isoDate,
            time: curr.time,
            description: curr.description,
            amount: curr.amount,
            type
        });
    }

    return {
        bankName: "ธนาคารกรุงไทย (Krungthai)",
        transactions,
        rawText: text
    };
}

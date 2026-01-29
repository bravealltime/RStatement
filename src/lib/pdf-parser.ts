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

// ... (Promise polyfill remains)

export async function parseStatement(file: File, password?: string): Promise<StatementData> {
    // Dynamic import
    const pdfjsLib = await import("pdfjs-dist");

    // Set worker
    pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

    try {
        const arrayBuffer = await file.arrayBuffer();
        const data = new Uint8Array(arrayBuffer);

        const loadingTask = pdfjsLib.getDocument({
            data: data,
            password: password
        });

        const pdf = await loadingTask.promise;
        let fullText = "";

        // Extract text
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map((item: any) => item.str).join(" ");
            fullText += pageText + "\n";
        }

        console.log("Raw text start:", fullText.substring(0, 100));

        // Detection Logic
        if (fullText.includes("K PLUS") || fullText.includes("สาขาเจ้าของบัญชี") || fullText.match(/\d{2}-\d{2}-\d{2}/)) {
            return parseKBank(fullText);
        } else {
            return parseKTB(fullText);
        }

    } catch (e: any) {
        console.error("PDF Parsing Error:", e);
        throw e;
    }
}

function parseKBank(text: string): StatementData {
    const transactions: Transaction[] = [];
    const cleanText = text.replace(/\s+/g, " ");

    // Header Extraction
    const bankName = "ธนาคารกสิกรไทย (KBank)";

    // Account No: 035-1-89304-4 (Look for pattern X-X-X-X or XX-X-X-X)
    const accNumMatch = cleanText.match(/\d{3}-\d{1}-\d{5}-\d{1}/);
    const accountNumber = accNumMatch ? accNumMatch[0] : undefined;

    // Account Name: "ชื่อบัญชี ... สาขา" or similar
    // KBank text often: "ชื่อบัญชี นาย xxx ... x/x/x(0847) สาขา..."
    // Strategy: Look for "ชื่อบัญชี" capture usually until number or address
    const nameMatch = cleanText.match(/ชื่อบัญชี\s+(.*?)\s+(?=\d{3}\/|ถ\.|ต\.|อ\.|จ\.)/);
    const accountOwner = nameMatch ? nameMatch[1].trim() : undefined;

    // Branch
    const branchMatch = cleanText.match(/สาขา(.*?)\s+\d{3}-\d{1}-/);
    const branch = branchMatch ? "สาขา" + branchMatch[1].trim() : undefined;

    // Line Regex: 01-07-25 ...
    const lineRegex = /(\d{2}-\d{2}-\d{2})\s+(\d{2}:\d{2})\s+(.*?)(?=\d{2}-\d{2}-\d{2}\s+\d{2}:\d{2}|$)/g;
    const matches = cleanText.matchAll(lineRegex);

    let idCounter = 1;
    const rawTransactions: any[] = [];

    for (const match of matches) {
        const dateStr = match[1]; // 01-07-25
        const time = match[2];    // 08:53
        const content = match[3]; // K PLUS 1,255.41 ... 16.00

        // Extract numbers
        const numbers = content.match(/[\d,]+\.\d{2}/g);

        if (numbers && numbers.length >= 2) {
            // KBank Format: Date Time Channel Balance Description Amount
            // OR: Date Time Channel [Description] Balance [Description] Amount ?
            // Based on user log: "K PLUS 1,255.41 ... 16.00"
            // The FIRST large number is often Balance. The LAST is Amount.
            // Wait, let's verify if Balance comes first.
            // Example: "01-07-25 08:53 K PLUS 1,255.41 ..."
            // Yes, Balance is early. Amount is at end.

            const rawBalance = numbers[0].replace(/,/g, "");
            // Last number is Amount
            const rawAmount = numbers[numbers.length - 1].replace(/,/g, "");

            const balance = parseFloat(rawBalance);
            const amount = parseFloat(rawAmount);

            // Refine Description
            // Remove the amounts from content
            let description = content;
            numbers.forEach(num => {
                description = description.replace(num, "");
            });
            // Clean up garbage
            description = description.replace("K PLUS", "").replace("ชำระเงิน", "").replace("โอนเงิน", "").replace("รับโอนเงิน", "").trim();
            // Remove extra spaces
            description = description.replace(/\s+/g, " ");

            // Date Convert: 01-07-25 -> 2025-07-01
            // KBank uses AD years (2025 -> 25)
            const [d, m, y] = dateStr.split('-');
            const yearFull = "20" + y;
            const isoDate = `${yearFull}-${m}-${d}`;

            rawTransactions.push({
                isoDate, time, description, amount, balance
            });
        }
    }

    // Determine Type (Income/Expense) via Balance Logic
    for (let i = 0; i < rawTransactions.length; i++) {
        const curr = rawTransactions[i];
        let type: 'income' | 'expense' = 'expense';

        // Check Previous Balance
        if (i < rawTransactions.length - 1) {
            // KBank order is usually Chronological (Oldest -> Newest) ??
            // User log: 01-07 (Row 1), 01-07 (Row 2).. 02-07..
            // Yes, Chronological.
            // So: Prev Balance (+/-) Amount = Current Balance
            // NO. The list in PDF is top-down.
            // Row 0: Bal 1255.41. Prev was 1271.41.
            // So: PrevBalance - Amount = CurrBalance -> Expense
            // PrevBalance + Amount = CurrBalance -> Income

            // Wait, "Previous" in the array loop means the row BEFORE.
            // But what about the First row? We need "Balance Forward" (ยอดยกมา).
            // It might be hard to parse Balance Forward reliably.

            // ALTERNATIVE: Look at Current and NEXT?
            // Row 0: Bal 1255.41. Row 1: Bal 1180.41.
            // 1255.41 -> 1180.41 (Decreased by 75).
            // Row 1 amount is 75. So Row 1 was Expense.

            // Actually, let's stick to: "Compare with Previous Row's Balance".
            // If i=0, we can't check unless we parsed "Balance Forward".
            // Fallback for i=0: Keywords?
        }

        // Let's implement looking at Previous Row (if exists)
        if (i > 0) {
            const prev = rawTransactions[i - 1];
            const diff = curr.balance - prev.balance;

            // If Balance INCREASED -> Income
            if (diff > 0.01) type = 'income';
            else type = 'expense';

            // Verify with Amount if close enough?
            // if (Math.abs(Math.abs(diff) - curr.amount) > 1.0) { ... warning ... }
        } else {
            // Processing First Item
            // Heuristic: If description implies positive? 
            // Or try to deduce from Next Item?
            // If Next Bal < Curr Bal, then Next was expense. Doesn't help Curr.

            // Use Keywords for First Item Fallback
            if (curr.description.includes("รับโอน") || curr.description.includes("ได้รับ")) {
                type = 'income';
            }
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
        bankName,
        accountNumber,
        accountOwner,
        branch,
        transactions,
        rawText: text
    };
}


function parseKTB(text: string): StatementData {
    const transactions: Transaction[] = [];

    // Normalize spaces: remove newlines and multiple spaces
    const cleanText = text.replace(/\s+/g, " ");

    // Extract Header Info
    // 1. Account Name
    const nameMatch = cleanText.match(/ชื่อบัญชี\s+(.*?)\s+ประเภทบัญชี/);
    const accountOwner = nameMatch ? nameMatch[1].trim() : undefined;

    // 2. Account Number
    const accNumMatch = cleanText.match(/เลขที่บัญชี\s+(\d{3}-?\d{1}-?\d{5}-?\d{1}|\d{10})/);
    const accountNumber = accNumMatch ? accNumMatch[1] : undefined;

    // 3. Branch
    const branchMatch = cleanText.match(/สาขา\s+(.*?)\s+เลขที่บัญชี/);
    const branch = branchMatch ? branchMatch[1].trim() : undefined;

    // 4. Address
    const addrMatch = cleanText.match(/ที่อยู่ปัจจุบัน\s+(.*?)\s+ที่อยู่สาขา/);
    const address = addrMatch ? addrMatch[1].trim() : undefined;

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

        // GUARD CLAUSE: Skip header lines
        if (content.includes("ชื่อบัญชี") ||
            content.includes("ที่อยู่ปัจจุบัน") ||
            content.includes("วันที่ส่งคำขอ")) {
            continue;
        }

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
        accountNumber,
        accountOwner,
        branch,
        address,
        transactions,
        rawText: text
    };
}

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

    for (const match of matches) {
        const dateStr = match[1]; // e.g. 01/10/68
        const content = match[2]; // e.g. "โอนเงินออก ... 1,000.00 ... 08:31"

        // 1. Extract Time (HH:mm)
        const timeMatch = content.match(/(\d{2}:\d{2})/);
        const time = timeMatch ? timeMatch[1] : undefined;

        // 2. Extract Amounts (looking for 1,000.00 pattern)
        const amountMatches = content.match(/[\d,]+\.\d{2}/g);

        if (amountMatches && amountMatches.length > 0) {
            // The first amount found is typically the transaction amount
            const rawAmount = amountMatches[0].replace(/,/g, "");
            const amount = parseFloat(rawAmount);

            // 3. Determine Type (Income/Expense)
            const isIncome = content.includes("โอนเงินเข้า") ||
                content.includes("ฝากเงิน") ||
                content.includes("รับโอน") ||
                content.includes("เงินโอนเข้า");

            // Default to expense unless explicit income keywords found
            // (Common expense keywords: โอนเงินออก, ถอนเงิน, จ่าย, หักบัญชี)
            const type: 'income' | 'expense' = isIncome ? 'income' : 'expense';

            // 4. Extract Description
            // Take text BEFORE the first amount
            // Also remove the time if it appears before amount (unlikely but safe to check)
            let description = content.split(amountMatches[0])[0].trim();
            // remove trailing time if present in description part
            description = description.replace(/\d{2}:\d{2}/, "").trim();
            // remove common garbage or codes if needed (e.g. (IORSWT)) - keep for now as detail

            // 5. Convert Date (Thai Year -> AD)
            // e.g. 01/10/68 -> 2568 -> 2025
            const [d, m, y] = dateStr.split('/');
            const yearTh = 2500 + parseInt(y); // 68 -> 2568
            const yearAd = yearTh - 543;
            const isoDate = `${yearAd}-${m}-${d}`;

            transactions.push({
                id: (idCounter++).toString(),
                date: isoDate,
                time,
                description,
                amount,
                type
            });
        }
    }

    return {
        bankName: "ธนาคารกรุงไทย (Krungthai)",
        transactions,
        rawText: text
    };
}

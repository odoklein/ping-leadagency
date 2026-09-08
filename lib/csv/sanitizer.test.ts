import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
    normalizeSinglePhone,
    extractPhones,
    parseCsvDate,
    normalizeEmail,
    normalizeWebsite,
    normalizeCompanyName,
    splitMultiActionCell,
} from "./sanitizer";

describe("CSV Sanitizer Engine", () => {
    it("recovers French phone numbers where Excel stripped the leading zero", () => {
        const phone = normalizeSinglePhone("612345678");
        assert.equal(phone, "+33612345678");

        const landline = normalizeSinglePhone("142345678");
        assert.equal(landline, "+33142345678");
    });

    it("normalizes spaced and dashed French numbers to E.164", () => {
        const phone1 = normalizeSinglePhone("06 12 34 56 78");
        assert.equal(phone1, "+33612345678");

        const phone2 = normalizeSinglePhone("01-42-34-56-78");
        assert.equal(phone2, "+33142345678");
    });

    it("extracts multiple phone numbers separated by semicolons or commas", () => {
        const result = extractPhones("0612345678 ; 0142345678, +33699887766");
        assert.equal(result.primaryPhone, "+33612345678");
        assert.deepEqual(result.additionalPhones, ["+33142345678", "+33699887766"]);
    });

    it("parses French, ISO, and Excel serial dates", () => {
        const frDate = parseCsvDate("25/12/2025");
        assert.ok(frDate instanceof Date);
        assert.equal(frDate.getFullYear(), 2025);
        assert.equal(frDate.getMonth(), 11);
        assert.equal(frDate.getDate(), 25);

        const isoDate = parseCsvDate("2025-06-15");
        assert.ok(isoDate instanceof Date);
        assert.equal(isoDate.getFullYear(), 2025);
        assert.equal(isoDate.getMonth(), 5);
        assert.equal(isoDate.getDate(), 15);

        // Excel serial 45658 = 2025-01-01
        const excelDate = parseCsvDate("45658");
        assert.ok(excelDate instanceof Date);
        assert.equal(excelDate.getFullYear(), 2025);
    });

    it("normalizes email addresses", () => {
        const email = normalizeEmail("   Contact.John@ACME-CORP.COM  ");
        assert.equal(email, "contact.john@acme-corp.com");
    });

    it("cleans website URL and extracts root domain", () => {
        const { url, domain } = normalizeWebsite("www.leadagency.fr/solutions/b2b");
        assert.equal(url, "https://www.leadagency.fr/solutions/b2b");
        assert.equal(domain, "leadagency.fr");
    });

    it("normalizes company name by stripping legal suffixes", () => {
        assert.equal(normalizeCompanyName("Ping Lead Agency SAS"), "ping lead agency");
        assert.equal(normalizeCompanyName("Acme Corp LLC"), "acme");
        assert.equal(normalizeCompanyName("Société Générale SARL."), "société générale");
    });

    it("safely splits multi-action sequences", () => {
        const seq = splitMultiActionCell("Pas de réponse ; Rappel demandé -> RDV pris");
        assert.deepEqual(seq, ["Pas de réponse", "Rappel demandé", "RDV pris"]);
    });
});

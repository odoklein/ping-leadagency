import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { detectBestPreset, applyPresetMappings } from "./presets";

describe("CSV Presets Engine", () => {
    it("auto-detects Apollo.io CSV headers with high confidence", () => {
        const apolloHeaders = [
            "First Name",
            "Last Name",
            "Title",
            "Company",
            "Company Phone",
            "Email",
            "Corporate Phone",
            "Website",
            "# Employees",
            "Industry",
            "Person Linkedin Url",
        ];

        const match = detectBestPreset(apolloHeaders);
        assert.ok(match !== null);
        assert.equal(match.preset.id, "apollo");
        assert.ok(match.confidence >= 80);

        const mappings = applyPresetMappings(match.preset.id, apolloHeaders);
        assert.equal(mappings["Company"], "company.name");
        assert.equal(mappings["First Name"], "contact.firstName");
        assert.equal(mappings["Last Name"], "contact.lastName");
        assert.equal(mappings["Email"], "contact.email");
        assert.equal(mappings["Website"], "company.website");
        assert.equal(mappings["Person Linkedin Url"], "contact.linkedin");
    });

    it("auto-detects Clay / Dropcontact headers", () => {
        const clayHeaders = [
            "company_name",
            "clean_website",
            "first_name",
            "last_name",
            "email_clean",
            "direct_phone",
            "linkedin_url",
            "headcount",
        ];

        const match = detectBestPreset(clayHeaders);
        assert.ok(match !== null);
        assert.equal(match.preset.id, "clay");
        assert.ok(match.matchedCount >= 5);

        const mappings = applyPresetMappings(match.preset.id, clayHeaders);
        assert.equal(mappings["company_name"], "company.name");
        assert.equal(mappings["email_clean"], "contact.email");
        assert.equal(mappings["direct_phone"], "contact.phone");
    });

    it("auto-detects HubSpot CRM export headers", () => {
        const hubspotHeaders = [
            "Company Name",
            "First Name",
            "Last Name",
            "Email",
            "Mobile Phone Number",
            "Company Domain Name",
        ];

        const match = detectBestPreset(hubspotHeaders);
        assert.ok(match !== null);
        assert.equal(match.preset.id, "hubspot");

        const mappings = applyPresetMappings(match.preset.id, hubspotHeaders);
        assert.equal(mappings["Company Name"], "company.name");
        assert.equal(mappings["Company Domain Name"], "company.website");
    });
});

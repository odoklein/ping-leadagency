"use client";

import { memo, useMemo } from "react";

/**
 * Minimal, dependency-free Markdown renderer for assistant answers.
 *
 * Why not a library: the panel is on every page for every role, and a full
 * Markdown + sanitizer bundle costs more than the subset the model actually
 * emits (headings, lists, bold, code, links, tables). Everything is built as
 * React nodes — no `dangerouslySetInnerHTML` — so model output can never inject
 * markup.
 */

// ============================================
// INLINE
// ============================================

// One pass over the line: code | bold | italic | link. Order matters — code wins.
const INLINE_PATTERN =
    /(`[^`\n]+`)|(\*\*[^*\n]+\*\*)|(\*[^*\n]+\*|_[^_\n]+_)|(\[[^\]\n]+\]\([^)\s]+\))/g;

const SAFE_LINK = /^(https?:\/\/|\/)/i;

function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
    const nodes: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    let i = 0;

    INLINE_PATTERN.lastIndex = 0;
    while ((match = INLINE_PATTERN.exec(text)) !== null) {
        if (match.index > lastIndex) {
            nodes.push(text.slice(lastIndex, match.index));
        }
        const token = match[0];
        const key = `${keyPrefix}-i${i++}`;

        if (match[1]) {
            nodes.push(
                <code key={key} className="cp-md-code">
                    {token.slice(1, -1)}
                </code>
            );
        } else if (match[2]) {
            nodes.push(<strong key={key}>{token.slice(2, -2)}</strong>);
        } else if (match[3]) {
            nodes.push(<em key={key}>{token.slice(1, -1)}</em>);
        } else if (match[4]) {
            const split = token.indexOf("](");
            const label = token.slice(1, split);
            const href = token.slice(split + 2, -1);
            // Only same-origin or http(s) links; anything else renders as plain text.
            nodes.push(
                SAFE_LINK.test(href) ? (
                    <a
                        key={key}
                        href={href}
                        target={href.startsWith("/") ? undefined : "_blank"}
                        rel="noopener noreferrer"
                        className="cp-md-link"
                    >
                        {label}
                    </a>
                ) : (
                    <span key={key}>{label}</span>
                )
            );
        }
        lastIndex = match.index + token.length;
    }

    if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
    return nodes;
}

// ============================================
// BLOCK
// ============================================

const HEADING = /^(#{1,4})\s+(.*)$/;
const BULLET = /^\s*[-*•]\s+(.*)$/;
const ORDERED = /^\s*(\d+)[.)]\s+(.*)$/;
const QUOTE = /^>\s?(.*)$/;
const RULE = /^\s*([-*_])\1{2,}\s*$/;
const TABLE_ROW = /^\s*\|(.+)\|\s*$/;
const TABLE_DIVIDER = /^\s*\|[\s:|-]+\|\s*$/;

function splitRow(line: string): string[] {
    return line
        .trim()
        .replace(/^\||\|$/g, "")
        .split("|")
        .map((cell) => cell.trim());
}

function renderBlocks(source: string): React.ReactNode[] {
    const lines = source.replace(/\r\n/g, "\n").split("\n");
    const blocks: React.ReactNode[] = [];
    let index = 0;
    let key = 0;

    while (index < lines.length) {
        const line = lines[index];

        // Fenced code block
        if (line.trimStart().startsWith("```")) {
            const body: string[] = [];
            index++;
            while (index < lines.length && !lines[index].trimStart().startsWith("```")) {
                body.push(lines[index]);
                index++;
            }
            index++; // closing fence
            blocks.push(
                <pre key={`b${key++}`} className="cp-md-pre">
                    <code>{body.join("\n")}</code>
                </pre>
            );
            continue;
        }

        if (!line.trim()) {
            index++;
            continue;
        }

        if (RULE.test(line)) {
            blocks.push(<hr key={`b${key++}`} className="cp-md-hr" />);
            index++;
            continue;
        }

        const heading = HEADING.exec(line);
        if (heading) {
            const level = Math.min(heading[1].length, 4);
            const Tag = (`h${Math.min(level + 2, 6)}`) as "h3" | "h4" | "h5" | "h6";
            blocks.push(
                <Tag key={`b${key++}`} className={`cp-md-h cp-md-h${level}`}>
                    {renderInline(heading[2], `h${key}`)}
                </Tag>
            );
            index++;
            continue;
        }

        // Table: header row + divider + body rows
        if (TABLE_ROW.test(line) && index + 1 < lines.length && TABLE_DIVIDER.test(lines[index + 1])) {
            const headers = splitRow(line);
            index += 2;
            const rows: string[][] = [];
            while (index < lines.length && TABLE_ROW.test(lines[index])) {
                rows.push(splitRow(lines[index]));
                index++;
            }
            blocks.push(
                <div key={`b${key++}`} className="cp-md-table-wrap">
                    <table className="cp-md-table">
                        <thead>
                            <tr>
                                {headers.map((cell, i) => (
                                    <th key={i}>{renderInline(cell, `th${i}`)}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((row, r) => (
                                <tr key={r}>
                                    {row.map((cell, c) => (
                                        <td key={c}>{renderInline(cell, `td${r}-${c}`)}</td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            );
            continue;
        }

        if (QUOTE.test(line)) {
            const body: string[] = [];
            while (index < lines.length && QUOTE.test(lines[index])) {
                body.push(QUOTE.exec(lines[index])![1]);
                index++;
            }
            blocks.push(
                <blockquote key={`b${key++}`} className="cp-md-quote">
                    {renderInline(body.join(" "), `q${key}`)}
                </blockquote>
            );
            continue;
        }

        if (BULLET.test(line)) {
            const items: string[] = [];
            while (index < lines.length && BULLET.test(lines[index])) {
                items.push(BULLET.exec(lines[index])![1]);
                index++;
            }
            blocks.push(
                <ul key={`b${key++}`} className="cp-md-ul">
                    {items.map((item, i) => (
                        <li key={i}>{renderInline(item, `ul${key}-${i}`)}</li>
                    ))}
                </ul>
            );
            continue;
        }

        if (ORDERED.test(line)) {
            const items: string[] = [];
            const start = Number(ORDERED.exec(line)![1]) || 1;
            while (index < lines.length && ORDERED.test(lines[index])) {
                items.push(ORDERED.exec(lines[index])![2]);
                index++;
            }
            blocks.push(
                <ol key={`b${key++}`} className="cp-md-ol" start={start}>
                    {items.map((item, i) => (
                        <li key={i}>{renderInline(item, `ol${key}-${i}`)}</li>
                    ))}
                </ol>
            );
            continue;
        }

        // Paragraph: consume until a blank line or the start of another block.
        const paragraph: string[] = [];
        while (
            index < lines.length &&
            lines[index].trim() &&
            !HEADING.test(lines[index]) &&
            !BULLET.test(lines[index]) &&
            !ORDERED.test(lines[index]) &&
            !QUOTE.test(lines[index]) &&
            !RULE.test(lines[index]) &&
            !TABLE_ROW.test(lines[index]) &&
            !lines[index].trimStart().startsWith("```")
        ) {
            paragraph.push(lines[index]);
            index++;
        }
        blocks.push(
            <p key={`b${key++}`} className="cp-md-p">
                {renderInline(paragraph.join(" "), `p${key}`)}
            </p>
        );
    }

    return blocks;
}

// ============================================
// COMPONENT
// ============================================

/** Renders one assistant answer. Memoized: parsing runs once per message. */
export const Markdown = memo(function Markdown({ content }: { content: string }) {
    const blocks = useMemo(() => renderBlocks(content), [content]);
    return <div className="cp-md">{blocks}</div>;
});

export default Markdown;

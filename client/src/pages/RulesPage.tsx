// client/src/pages/RulesPage.tsx
import React, { useEffect, useState } from "react";
import type { RulesResponse } from "../types";

/**
 * Read-only for now. Editing these is a separate piece of work; this page
 * exists so the receipt's "correction rules" link has somewhere to go and so
 * the rules stop being invisible.
 */
const RulesPage: React.FC = () => {
  const [rules, setRules] = useState<RulesResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/rules")
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed (${response.status})`);
        return response.json();
      })
      .then((data: RulesResponse) => {
        if (!cancelled) setRules(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const maxNameLength = rules?.maxNameLength ?? 32;
  const removedTags = rules?.removedTags ?? ["SIC", "CORRECTFITID"];

  return (
    <main className="max-w-4xl mx-auto px-5 py-9">
      <h1 className="text-[20px] font-semibold tracking-tight text-gray-900">
        Correction rules
      </h1>
      <p className="mt-1.5 text-[14px] text-gray-500 max-w-xl">
        Every file you clean is run through these. The built-in fixes cover the
        formats Money 99 refuses outright; the merchant rules tidy up names so
        they categorize consistently.
      </p>

      <section className="mt-8">
        <div className="flex items-baseline gap-2 mb-3">
          <h2 className="font-semibold text-[14px] text-gray-900">
            Merchant renames
          </h2>
          {rules && (
            <span className="text-[12.5px] text-gray-400">
              {rules.merchantRules.length} rules
            </span>
          )}
        </div>

        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          {error && (
            <div role="alert" className="px-5 py-4 text-[13px] text-rose-700">
              Couldn’t load the rules — {error}
            </div>
          )}

          {!rules && !error && (
            <div className="px-5 py-4 text-[13px] text-gray-400">Loading…</div>
          )}

          {rules && (
            <table className="w-full text-[13.5px]">
              <thead>
                <tr className="text-[11px] uppercase tracking-wider text-gray-400 text-left border-b border-gray-200">
                  <th scope="col" className="font-medium px-5 py-2.5">
                    When a name matches
                  </th>
                  <th scope="col" className="font-medium px-3 py-2.5 w-40">
                    Replace with
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rules.merchantRules.map((rule) => (
                  <tr key={`${rule.pattern}-${rule.replacement}`}>
                    <td className="px-5 py-2.5 font-mono text-[12.5px] text-gray-700 break-all">
                      {rule.pattern}
                    </td>
                    <td className="px-3 py-2.5 font-medium text-gray-900">
                      {rule.replacement}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <p className="mt-3 text-[12.5px] text-gray-400">
          These are fixed for now. Editing them, and adding your own, is coming.
        </p>
      </section>

      <section className="mt-9">
        <div className="flex items-baseline gap-2 mb-3">
          <h2 className="font-semibold text-[14px] text-gray-900">
            Built-in compatibility fixes
          </h2>
          <span className="text-[12.5px] text-gray-400">always on</span>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
          <div className="px-5 py-3.5">
            <div className="font-medium text-[13.5px] text-gray-900">
              Shorten names to {maxNameLength} characters
            </div>
            <div className="text-[12.5px] text-gray-500 mt-0.5">
              Money 99 mangles longer <span className="font-mono">&lt;NAME&gt;</span>{" "}
              values rather than rejecting them, so the damage is easy to miss.
            </div>
          </div>

          <div className="px-5 py-3.5">
            <div className="font-medium text-[13.5px] text-gray-900">
              Strip unsupported tags
            </div>
            <div className="text-[12.5px] text-gray-500 mt-0.5">
              {removedTags.map((tag, index) => (
                <React.Fragment key={tag}>
                  {index > 0 && " and "}
                  <span className="font-mono">&lt;{tag}&gt;</span>
                </React.Fragment>
              ))}{" "}
              — Money 99 aborts the import when it meets them.
            </div>
          </div>

          <div className="px-5 py-3.5">
            <div className="font-medium text-[13.5px] text-gray-900">
              Rewrite the header to OFX 1.02 SGML
            </div>
            <div className="text-[12.5px] text-gray-500 mt-0.5">
              Converts modern XML-style OFX 2.x headers into the plain-text form
              Money 99 expects.
            </div>
          </div>

          <div className="px-5 py-3.5">
            <div className="font-medium text-[13.5px] text-gray-900">
              Drop <span className="font-mono">CREDITLINE</span> account types and
              bare ampersands
            </div>
            <div className="text-[12.5px] text-gray-500 mt-0.5">
              Both are common causes of a refused import.
            </div>
          </div>
        </div>

        <p className="mt-4 text-[12.5px] text-gray-400">
          Your file is processed in memory and never stored.
        </p>
      </section>
    </main>
  );
};

export default RulesPage;

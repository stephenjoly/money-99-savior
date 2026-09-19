// client/src/pages/RulesPage.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MerchantRule, RulesResponse } from "../types";
import {
  DEFAULT_LIMITS,
  clearStoredRules,
  getRememberedNames,
  getRuleUsage,
  loadStoredRules,
  parseImportedRules,
  previewRule,
  saveStoredRules,
  validateRule,
  type RulePreview,
} from "../ruleStore";

const FALLBACK_RULES: MerchantRule[] = [];

interface Draft {
  /** Index being edited, or "new" for the add form. */
  index: number | "new";
  pattern: string;
  replacement: string;
}

const RulesPage: React.FC = () => {
  const [response, setResponse] = useState<RulesResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [customized, setCustomized] = useState(() => loadStoredRules().customized);
  const [rules, setRules] = useState<MerchantRule[]>(
    () => loadStoredRules().rules
  );
  const [draft, setDraft] = useState<Draft | null>(null);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/rules")
      .then((res) => {
        if (!res.ok) throw new Error(`Request failed (${res.status})`);
        return res.json();
      })
      .then((data: RulesResponse) => {
        if (!cancelled) setResponse(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : String(err));
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const limits = response?.limits ?? DEFAULT_LIMITS;
  const defaults = response?.merchantRules ?? FALLBACK_RULES;
  const effectiveRules = customized ? rules : defaults;
  const usage = useMemo(() => getRuleUsage(), []);
  const rememberedNames = useMemo(() => getRememberedNames(), []);

  const persist = useCallback((next: MerchantRule[]) => {
    saveStoredRules(next);
    setCustomized(true);
    setRules(next);
  }, []);

  const resetToDefaults = useCallback(() => {
    clearStoredRules();
    setCustomized(false);
    setRules([]);
    setDraft(null);
    setDraftError(null);
    setNotice("Back to the built-in rules.");
  }, []);

  const startEdit = (index: number) => {
    setDraft({ index, ...effectiveRules[index] });
    setDraftError(null);
    setNotice(null);
  };

  const startAdd = () => {
    setDraft({ index: "new", pattern: "", replacement: "" });
    setDraftError(null);
    setNotice(null);
  };

  const saveDraft = () => {
    if (!draft) return;
    const error = validateRule(draft.pattern, draft.replacement, limits);
    if (error) {
      setDraftError(error);
      return;
    }

    if (draft.index === "new") {
      if (effectiveRules.length >= limits.maxRules) {
        setDraftError(`You can have at most ${limits.maxRules} rules.`);
        return;
      }
      persist([
        ...effectiveRules,
        { pattern: draft.pattern, replacement: draft.replacement },
      ]);
    } else {
      persist(
        effectiveRules.map((rule, index) =>
          index === draft.index
            ? { pattern: draft.pattern, replacement: draft.replacement }
            : rule
        )
      );
    }

    setDraft(null);
    setDraftError(null);
    setNotice("Saved. Your next upload will use this.");
  };

  const deleteRule = (index: number) => {
    persist(effectiveRules.filter((_, i) => i !== index));
    if (draft && draft.index !== "new" && index === draft.index) {
      setDraft(null);
    }
    setNotice("Rule deleted.");
  };

  const exportRules = () => {
    const blob = new Blob([JSON.stringify(effectiveRules, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "money-99-rules.json";
    document.body.appendChild(anchor);
    anchor.click();
    setTimeout(() => {
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    }, 0);
  };

  const importRules = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    try {
      const imported = parseImportedRules(await file.text(), limits);
      persist(imported);
      setDraft(null);
      setDraftError(null);
      setNotice(`Imported ${imported.length} rule${imported.length === 1 ? "" : "s"}.`);
    } catch (err) {
      setNotice(null);
      setDraftError(err instanceof Error ? err.message : String(err));
    }
  };

  const previews: RulePreview[] | null = draft
    ? previewRule(draft.pattern, draft.replacement, rememberedNames)
    : null;

  const maxNameLength = response?.maxNameLength ?? 32;
  const removedTags = response?.removedTags ?? ["SIC", "CORRECTFITID"];

  return (
    <main className="max-w-4xl mx-auto px-5 py-9">
      <div className="flex items-start gap-4 flex-wrap">
        <div className="flex-1 min-w-64">
          <h1 className="text-[20px] font-semibold tracking-tight text-gray-900">
            Correction rules
          </h1>
          <p className="mt-1.5 text-[14px] text-gray-500 max-w-xl">
            Every file you clean is run through these. Built-in fixes cover the
            formats Money 99 refuses outright; your own rules tidy merchant
            names.
          </p>
        </div>
        <button
          type="button"
          onClick={startAdd}
          disabled={draft?.index === "new"}
          className="text-[13px] font-semibold bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-black disabled:opacity-40"
        >
          + New rule
        </button>
      </div>

      <section className="mt-8">
        <div className="flex items-baseline gap-2 mb-3">
          <h2 className="font-semibold text-[14px] text-gray-900">
            Merchant renames
          </h2>
          <span className="text-[12.5px] text-gray-400">
            {effectiveRules.length} rule{effectiveRules.length === 1 ? "" : "s"}
            {customized ? " · stored in this browser" : " · built-in"}
          </span>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          {loadError && (
            <div role="alert" className="px-5 py-4 text-[13px] text-rose-700">
              Couldn’t load the built-in rules — {loadError}
            </div>
          )}

          {!response && !customized && !loadError && (
            <div className="px-5 py-4 text-[13px] text-gray-400">Loading…</div>
          )}

          {(response || customized) && (
            <table className="w-full text-[13.5px]">
              <thead>
                <tr className="text-[11px] uppercase tracking-wider text-gray-400 text-left border-b border-gray-200">
                  <th scope="col" className="font-medium px-5 py-2.5">
                    When a name matches
                  </th>
                  <th scope="col" className="font-medium px-3 py-2.5 w-40">
                    Replace with
                  </th>
                  <th scope="col" className="font-medium px-3 py-2.5 w-16 text-right">
                    Used
                  </th>
                  <th scope="col" className="px-3 py-2.5 w-24">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {effectiveRules.map((rule, index) =>
                  draft && draft.index === index ? (
                    <DraftRow
                      key={`edit-${index}`}
                      draft={draft}
                      error={draftError}
                      previews={previews}
                      hasRememberedNames={rememberedNames.length > 0}
                      onChange={setDraft}
                      onSave={saveDraft}
                      onCancel={() => {
                        setDraft(null);
                        setDraftError(null);
                      }}
                    />
                  ) : (
                    <tr key={`${rule.pattern}-${index}`} className="group hover:bg-gray-50">
                      <td className="px-5 py-2.5 font-mono text-[12.5px] text-gray-700 break-all">
                        {rule.pattern}
                      </td>
                      <td className="px-3 py-2.5 font-medium text-gray-900">
                        {rule.replacement}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-gray-500">
                        {usage[rule.pattern] ? `${usage[rule.pattern]}×` : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <div className="opacity-0 group-hover:opacity-100 focus-within:opacity-100 flex gap-2 justify-end text-[12.5px]">
                          <button
                            type="button"
                            onClick={() => startEdit(index)}
                            className="text-gray-500 hover:text-gray-900"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteRule(index)}
                            className="text-gray-400 hover:text-rose-600"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                )}

                {draft?.index === "new" && (
                  <DraftRow
                    draft={draft}
                    error={draftError}
                    previews={previews}
                    hasRememberedNames={rememberedNames.length > 0}
                    onChange={setDraft}
                    onSave={saveDraft}
                    onCancel={() => {
                      setDraft(null);
                      setDraftError(null);
                    }}
                  />
                )}

                {effectiveRules.length === 0 && !draft && (
                  <tr>
                    <td colSpan={4} className="px-5 py-8 text-center">
                      <p className="text-[13.5px] font-medium text-gray-900">
                        No merchant rules
                      </p>
                      <p className="mt-1 text-[13px] text-gray-500">
                        Uploads will still get the built-in compatibility fixes,
                        but names won’t be renamed.
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}

          <div className="px-5 py-2.5 border-t border-gray-200 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px]">
            <button
              type="button"
              onClick={() => importRef.current?.click()}
              className="text-blue-600 hover:underline"
            >
              Import rules…
            </button>
            <button
              type="button"
              onClick={exportRules}
              className="text-blue-600 hover:underline"
            >
              Export as JSON
            </button>
            {customized && (
              <button
                type="button"
                onClick={resetToDefaults}
                className="text-gray-400 hover:text-gray-700 ml-auto"
              >
                Reset to defaults
              </button>
            )}
          </div>
        </div>

        <input
          ref={importRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => void importRules(e)}
        />

        <div className="mt-3 min-h-5 text-[12.5px]">
          {draftError && !draft && (
            <p role="alert" className="text-rose-700">
              {draftError}
            </p>
          )}
          {notice && !draftError && <p className="text-gray-400">{notice}</p>}
          {!draftError && !notice && (
            <p className="text-gray-400">
              {rememberedNames.length > 0
                ? "Your rules are stored in this browser and sent with each upload."
                : "Your rules are stored in this browser. Preview examples will appear here after you clean a file."}
            </p>
          )}
        </div>
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

const DraftRow: React.FC<{
  draft: Draft;
  error: string | null;
  previews: RulePreview[] | null;
  hasRememberedNames: boolean;
  onChange: (draft: Draft) => void;
  onSave: () => void;
  onCancel: () => void;
}> = ({ draft, error, previews, hasRememberedNames, onChange, onSave, onCancel }) => (
  <tr className="bg-blue-50/40">
    <td colSpan={4} className="px-5 py-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex-1 min-w-52">
          <span className="block text-[11px] uppercase tracking-wider text-gray-400 mb-1">
            When a name matches
          </span>
          <input
            value={draft.pattern}
            onChange={(e) => onChange({ ...draft, pattern: e.target.value })}
            placeholder="e.g. SQ \*MY CAFE"
            spellCheck={false}
            autoFocus
            className="w-full font-mono text-[12.5px] px-2.5 py-1.5 border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
        </label>
        <label className="w-40">
          <span className="block text-[11px] uppercase tracking-wider text-gray-400 mb-1">
            Replace with
          </span>
          <input
            value={draft.replacement}
            onChange={(e) => onChange({ ...draft, replacement: e.target.value })}
            placeholder="e.g. SQUARE"
            spellCheck={false}
            className="w-full text-[13px] px-2.5 py-1.5 border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onSave}
            className="text-[13px] font-semibold bg-gray-900 text-white px-3.5 py-1.5 rounded-md hover:bg-black"
          >
            Save
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="text-[13px] text-gray-500 px-2 py-1.5 hover:text-gray-900"
          >
            Cancel
          </button>
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-3 text-[12.5px] text-rose-700">
          {error}
        </p>
      )}

      {!error && previews && previews.length > 0 && (
        <div className="mt-3 text-[12.5px] flex items-start gap-2">
          <span className="text-gray-400 shrink-0 mt-0.5">Preview</span>
          <div className="font-mono text-[12px] space-y-1 min-w-0">
            {previews.map((preview) => (
              <div key={preview.from} className="break-all">
                <span className="text-gray-400 line-through">{preview.from}</span>{" "}
                <span className="text-gray-300">→</span>{" "}
                <span className="text-emerald-700">{preview.to}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!error && previews && previews.length === 0 && hasRememberedNames && (
        <p className="mt-3 text-[12.5px] text-gray-400">
          No matches in the names from your last file.
        </p>
      )}
    </td>
  </tr>
);

export default RulesPage;
